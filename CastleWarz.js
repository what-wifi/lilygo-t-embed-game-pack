/*
 * CASTLE WARZ  v1.0   by da cbm
 * Castle defence / assault game for Bruce firmware
 * Target: LilyGO T-Embed CC1101 (320x170, rotary encoder)
 *
 * Weapons: spear, bow, crossbow, cannon, catapult, ballista, trebuchet, master.  100 levels.
 * Odd levels: DEFEND your castle.  Even levels: STORM the enemy castle.
 *
 * Controls
 *   Battle: turn = aim angle, click = fire / thrust
 *           Back = next weapon, double-tap Back = pause menu
 *   Menus:  turn = move, click = select, Back = back
 *
 * Plain ES5 (no arrow functions, let/const, template strings or nested
 * functions) so it runs on the Bruce interpreter.
 *
 * Stability notes
 *  - Background is drawn once. Per frame only small dirty rectangles are
 *    restored; there is never a full-screen clear during battle.
 *  - Fixed physics tick, sub-stepped projectiles, NaN guards, entity caps,
 *    and a crash guard around every screen.
 *  - Storage is touched ONLY when you pick SAVE or LOAD.
 */
(function () {

var SAVE_PATH = '/cw.sav';

var D = null, K = null, A = null, S = null;
try { D = require('display'); } catch (e1) {}
try { K = require('keyboard'); } catch (e2) {}
try { A = require('audio'); } catch (e3) {}
try { S = require('storage'); } catch (e4) {}
if (!D && typeof display !== 'undefined') D = display;
if (!K && typeof keyboard !== 'undefined') K = keyboard;
if (!A && typeof audio !== 'undefined') A = audio;
if (!S && typeof storage !== 'undefined') S = storage;
if (!D || !K) { try { console.log('display/keyboard module missing'); } catch (e5) {} return; }

var W = 320, H = 170;
try { var ww = D.width(), hh = D.height(); if (ww > 100 && hh > 100) { W = ww; H = hh; } } catch (e6) {}

var HAS_FC = false, HAS_FRR = false, HAS_RR = false, HAS_C = false, HAS_L = false;
try { HAS_FC = typeof D.drawFillCircle === 'function'; } catch (e7) {}
try { HAS_FRR = typeof D.drawFillRoundRect === 'function'; } catch (e8) {}
try { HAS_RR = typeof D.drawRoundRect === 'function'; } catch (e9) {}
try { HAS_C = typeof D.drawCircle === 'function'; } catch (e10) {}
try { HAS_L = typeof D.drawLine === 'function'; } catch (e11) {}

var vclock = 0;
function ms() {
  try { if (typeof now === 'function') { var v = now(); if (typeof v === 'number' && v === v) return v; } } catch (e) {}
  try { var d = Date.now(); if (typeof d === 'number' && d === d) return d; } catch (e2) {}
  vclock += 10; return vclock;
}
function sleep(n) {
  n = Math.floor(n); if (!(n > 0)) return;
  try { if (typeof delay === 'function') { delay(n); return; } } catch (e) {}
  var end = ms() + n; while (ms() < end) {}
}
function rgb(r, g, b) { return ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3); }
function cl(v, a, b) { return v < a ? a : (v > b ? b : v); }
var WHITE = rgb(255, 255, 255), BLACK = rgb(0, 0, 0), GOLD = rgb(238, 196, 72);
var UI = { trim: GOLD, dark: rgb(40, 28, 14), felt: rgb(34, 70, 40), rail: rgb(58, 28, 10), lamp: rgb(255, 250, 220) };
function th() { return UI; }

/* settings (changed in SETUP) */
var cfg = { sound: true, guide: 1, diff: 1, speed: 1 };
/* progress (written only by SAVE) */
var NL = 100;
var UP_MAX = 20;
var prog = { unlocked: 1, stars: [], gold: 0, ups: [0, 0, 0], dirty: false };
(function () { var i; for (i = 0; i < NL; i++) prog.stars.push(0); })();

/* ------------------------------------------------------------------ */
/* Safe drawing primitives                                             */
/* ------------------------------------------------------------------ */
function fillRect(x, y, w, h, c) {
  x = Math.floor(x); y = Math.floor(y); w = Math.floor(w); h = Math.floor(h);
  if (x < 0) { w += x; x = 0; }
  if (y < 0) { h += y; y = 0; }
  if (x + w > W) w = W - x;
  if (y + h > H) h = H - y;
  if (w <= 0 || h <= 0) return;
  try { D.drawFillRect(x, y, w, h, c); } catch (e) {}
}
function outRect(x, y, w, h, c) {
  fillRect(x, y, w, 1, c); fillRect(x, y + h - 1, w, 1, c);
  fillRect(x, y, 1, h, c); fillRect(x + w - 1, y, 1, h, c);
}
function rrect(x, y, w, h, r, c) {
  x = Math.floor(x); y = Math.floor(y); w = Math.floor(w); h = Math.floor(h);
  if (w <= 0 || h <= 0) return;
  if (HAS_FRR) { try { D.drawFillRoundRect(x, y, w, h, r, c); return; } catch (e) {} }
  fillRect(x, y, w, h, c);
}
function rrectO(x, y, w, h, r, c) {
  x = Math.floor(x); y = Math.floor(y); w = Math.floor(w); h = Math.floor(h);
  if (w <= 0 || h <= 0) return;
  if (HAS_RR) { try { D.drawRoundRect(x, y, w, h, r, c); return; } catch (e) {} }
  outRect(x, y, w, h, c);
}
function line(x1, y1, x2, y2, c) {
  x1 = Math.floor(x1); y1 = Math.floor(y1); x2 = Math.floor(x2); y2 = Math.floor(y2);
  if (HAS_L) { try { D.drawLine(x1, y1, x2, y2, c); return; } catch (e) {} }
  var n = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)), i;
  if (n === 0) { fillRect(x1, y1, 1, 1, c); return; }
  for (i = 0; i <= n; i++) fillRect(x1 + (x2 - x1) * i / n, y1 + (y2 - y1) * i / n, 1, 1, c);
}
function fcirc(x, y, r, c) {
  x = Math.floor(x); y = Math.floor(y); r = Math.floor(r);
  if (r < 1) { fillRect(x, y, 1, 1, c); return; }
  if (HAS_FC) { try { D.drawFillCircle(x, y, r, c); return; } catch (e) {} }
  var dy, dx;
  for (dy = -r; dy <= r; dy++) { dx = Math.floor(Math.sqrt(r * r - dy * dy)); fillRect(x - dx, y + dy, dx * 2 + 1, 1, c); }
}
function circ(x, y, r, c) {
  x = Math.floor(x); y = Math.floor(y); r = Math.floor(r);
  if (r < 1) { fillRect(x, y, 1, 1, c); return; }
  if (HAS_C) { try { D.drawCircle(x, y, r, c); return; } catch (e) {} }
  var a, n = Math.max(12, r * 4);
  for (a = 0; a < n; a++) fillRect(x + r * Math.cos(a * 6.2832 / n), y + r * Math.sin(a * 6.2832 / n), 1, 1, c);
}
function tri(x1, y1, x2, y2, x3, y3, c) {
  var X = [x1, x2, x3], Y = [y1, y2, y3];
  var miny = Math.floor(Math.min(y1, y2, y3)), maxy = Math.floor(Math.max(y1, y2, y3));
  var y, i, j, ya, yb, xx, minx, maxx;
  for (y = miny; y <= maxy; y++) {
    minx = 99999; maxx = -99999;
    for (i = 0; i < 3; i++) {
      j = (i + 1) % 3; ya = Y[i]; yb = Y[j];
      if ((y >= ya && y <= yb) || (y >= yb && y <= ya)) {
        if (ya === yb) { minx = Math.min(minx, X[i], X[j]); maxx = Math.max(maxx, X[i], X[j]); }
        else { xx = X[i] + (X[j] - X[i]) * (y - ya) / (yb - ya); minx = Math.min(minx, xx); maxx = Math.max(maxx, xx); }
      }
    }
    if (maxx >= minx) fillRect(Math.floor(minx + 0.5), y, Math.floor(maxx - minx + 0.5) + 1, 1, c);
  }
}
function txt(s, x, y, sz, c) {
  try { D.setTextSize(sz); D.setTextColor(c); D.drawString(String(s), Math.floor(x), Math.floor(y)); } catch (e) {}
}
function tw(s, sz) { return String(s).length * 6 * sz; }
function ctxt(s, cx, y, sz, c) { txt(s, cx - tw(s, sz) / 2, y, sz, c); }
function rtxt(s, rx, y, sz, c) { txt(s, rx - tw(s, sz), y, sz, c); }
function money(n) { return '$' + n; }

/* ------------------------------------------------------------------ */
/* Input: debounced, direction filtered, always drained                */
/* ------------------------------------------------------------------ */
var ROT_GAP = 55, REV_GAP = 140, BTN_GAP = 240;
var lastRot = 0, lastBtn = 0, lastDir = 0;
function poll() {
  var nx = false, pv = false, sl = false, es = false, t, d;
  try { nx = !!K.getNextPress(); } catch (e1) {}
  try { pv = !!K.getPrevPress(); } catch (e2) {}
  try { sl = !!K.getSelPress(); } catch (e3) {}
  try { es = !!K.getEscPress(); } catch (e4) {}
  t = ms();
  if (es) { if (t - lastBtn >= BTN_GAP) { lastBtn = t; return 'B'; } return ''; }
  if (sl) { if (t - lastBtn >= BTN_GAP) { lastBtn = t; return 'O'; } return ''; }
  if (nx && pv) return '';
  if (nx || pv) {
    d = nx ? 1 : -1;
    if (t - lastRot < ROT_GAP) return '';
    if (d !== lastDir && t - lastRot < REV_GAP) return '';
    lastRot = t; lastDir = d;
    return d > 0 ? 'R' : 'L';
  }
  return '';
}
function waitKey() {
  var k;
  while (true) { k = poll(); if (k !== '') return k; sleep(6); }
}
function settle() { poll(); poll(); poll(); lastBtn = ms(); lastRot = ms(); }
function drain(msec) { var e = ms() + msec; while (ms() < e) { poll(); sleep(8); } lastBtn = ms(); }

/* Selectable item: plain rectangles only, so highlighting always shows.
   Selected = bright fill + inner frame + arrows; unselected = dark fill + trim border. */
function hiBox(x, y, w, h, sel) {
  var t = th();
  fillRect(x, y, w, h, sel ? t.trim : t.dark);
  outRect(x, y, w, h, sel ? WHITE : t.trim);
  if (sel) outRect(x + 2, y + 2, w - 4, h - 4, t.dark);
}
function hiArrows(x, y, w, h, sel) {
  var t = th(), ty = y + Math.floor((h - 8) / 2);
  if (sel) { txt('>', x + 6, ty, 1, t.dark); txt('<', x + w - 12, ty, 1, t.dark); }
}

/* ------------------------------------------------------------------ */
/* Sound (throttled, short)                                            */
/* ------------------------------------------------------------------ */
var lastBeep = 0;
function beep(f, d) {
  var t;
  if (!cfg.sound || !A) return;
  t = ms();
  if (t - lastBeep < 30) return;
  lastBeep = t;
  try { A.tone(f, d); } catch (e) {}
}
function tune(seq) {
  var i;
  if (!cfg.sound || !A) return;
  for (i = 0; i < seq.length; i++) { try { A.tone(seq[i][0], seq[i][1]); } catch (e) {} sleep(seq[i][1]); }
}
function sndMove() { beep(700, 4); }
function sndSel() { beep(1000, 8); }
function sndErr() { beep(220, 40); }
function sndShot(k) { beep(k === 'rock' ? 260 : (k === 'ball' || k === 'mball' ? 180 : (k === 'bolt' ? 900 : 1300)), 10); }
function sndHit() { beep(400, 6); }
function sndKill() { beep(800, 8); }
function sndBoom() { beep(140, 20); }
function sndWin() { tune([[784, 70], [988, 70], [1175, 70], [1568, 160]]); }
function sndLose() { tune([[330, 120], [262, 120], [196, 240]]); }

/* ------------------------------------------------------------------ */
/* Constants and data                                                  */
/* ------------------------------------------------------------------ */
var GY = 148, CL = 6, CR = 58, CTOP = 104, LPX = 54, LPY = 101;
var ECX = 262, ECW = 50, ECTOP = 84;
var SKY = [rgb(86, 108, 168), rgb(116, 134, 184), rgb(148, 160, 200), rgb(178, 184, 214), rgb(204, 206, 226), rgb(226, 216, 216)];
var C_HILL = rgb(66, 108, 78), C_GRASS = rgb(80, 140, 60), C_HUD = rgb(40, 28, 14), C_CLOUD = rgb(240, 240, 248);
var C_DOT = rgb(255, 255, 255);
var HILL = [];
(function () {
  var c, t;
  for (c = 0; c < 80; c++) {
    t = GY - 14 - Math.floor(10 * Math.sin(c * 0.19 + 0.8) + 7 * Math.sin(c * 0.51 + 2.1));
    if (t > GY - 2) t = GY - 2;
    HILL.push(t);
  }
})();
var CLOUDS = [[90, 20], [190, 34], [270, 14]];
var WP = [
  { n: 'SPEAR', v: 0, g: 0, cd: 12, dmg: 14, sp: 0, pierce: 0, kind: 'melee', unl: 1, len: 0 },
  { n: 'BOW', v: 6.5, g: 0.10, cd: 14, dmg: 8, sp: 0, pierce: 0, kind: 'arrow', unl: 1, len: 8 },
  { n: 'CROSSBOW', v: 9.5, g: 0.035, cd: 26, dmg: 15, sp: 0, pierce: 2, kind: 'bolt', unl: 2, len: 9 },
  { n: 'CANNON', v: 7.2, g: 0.12, cd: 55, dmg: 22, sp: 22, pierce: 0, kind: 'ball', unl: 4, len: 12 },
  { n: 'CATAPULT', v: 6.4, g: 0.17, cd: 85, dmg: 30, sp: 30, pierce: 0, kind: 'rock', unl: 6, len: 10 },
  { n: 'BALLISTA', v: 11.0, g: 0.022, cd: 38, dmg: 22, sp: 0, pierce: 4, kind: 'bolt', unl: 40, len: 12 },
  { n: 'TREBUCHET', v: 7.0, g: 0.19, cd: 110, dmg: 48, sp: 42, pierce: 0, kind: 'rock', unl: 50, len: 14 },
  { n: 'MASTER', v: 9.0, g: 0.07, cd: 48, dmg: 55, sp: 28, pierce: 2, kind: 'mball', unl: 75, len: 13 }
];
var WCOL = [rgb(200, 200, 210), rgb(150, 100, 50), rgb(110, 80, 50), rgb(70, 70, 78), rgb(130, 100, 60), rgb(90, 120, 160), rgb(160, 90, 50), rgb(220, 180, 40)];
/* unit types: w,h,hp,speed,armor(vs arrows/bolts),dmg,rate(ticks),gold */
var UT = [
  { w: 6, h: 11, hp: 12, sp: 0.40, ar: 0, dmg: 2, rate: 30, g: 5 },
  { w: 8, h: 13, hp: 34, sp: 0.30, ar: 0.5, dmg: 4, rate: 30, g: 12 },
  { w: 20, h: 12, hp: 70, sp: 0.25, ar: 0.6, dmg: 10, rate: 40, g: 20 },
  { w: 14, h: 24, hp: 260, sp: 0.20, ar: 0.4, dmg: 14, rate: 45, g: 100 }
];
var DIFFH = [0.8, 1, 1.3];
var FR = [40, 33, 26];
var CMUL = { arrow: 0.5, bolt: 0.8, ball: 1.0, rock: 1.3, mball: 1.5 };

var units = [], projs = [], engs = [], fx = [], dots = [], rq = [], spawnQ = [];
var si = 0, uid = 1, tick = 0, lv = 1, mode = 'D', hs = 1, ecd = 150, eerr = 0.1, kills = 0, wsel = 1, ang = 30;
var cds = [0, 0, 0, 0, 0, 0, 0, 0], spearT = 0;
var cas = { hp: 100, mhp: 100, dt: 0 };
var ec = { hp: 0, mhp: 0, dt: 0 };
var endT = 0, foes = 0;
var hc = { foes: -1, gold: -1, hp: -1, ec: -1, cd: -1, wn: '', ang: -1 };

function maxW() { var i, m = 0; for (i = 0; i < WP.length; i++) if (prog.unlocked >= WP[i].unl) m = i; return m; }
function wOK(i) { return prog.unlocked >= WP[i].unl; }
function dmgMul() { return 1 + 0.08 * prog.ups[0]; }
function rldMul() { return Math.max(0.4, 1 - 0.04 * prog.ups[1]); }
function castleMax() { return 100 + 20 * prog.ups[2]; }

/* ------------------------------------------------------------------ */
/* Drawing: background and sprites                                     */
/* ------------------------------------------------------------------ */
function restoreBg(x, y, w, h) {
  var i, y0, y1, ya, yb, c, c0, c1, sx, ex, top, yt, yb2, xe = x + w, ye = y + h;
  for (i = 0; i < 6; i++) {
    y0 = i * 25; y1 = (i === 5) ? GY : y0 + 25;
    ya = Math.max(y0, y); yb = Math.min(y1, ye);
    if (yb > ya) fillRect(x, ya, w, yb - ya, SKY[i]);
  }
  if (ye > GY - 40) {
    c0 = Math.floor(x / 4); c1 = Math.floor((xe - 1) / 4);
    for (c = c0; c <= c1; c++) {
      if (c < 0 || c >= HILL.length) continue;
      sx = Math.max(c * 4, x); ex = Math.min(c * 4 + 4, xe); top = HILL[c];
      yt = Math.max(top, y); yb2 = Math.min(GY, ye);
      if (yb2 > yt && ex > sx) fillRect(sx, yt, ex - sx, yb2 - yt, C_HILL);
    }
  }
  if (ye > GY) { ya = Math.max(GY, y); fillRect(x, ya, w, ye - ya, C_GRASS); }
}
function drawCloud(cx, cy) {
  fcirc(cx, cy, 7, C_CLOUD); fcirc(cx + 9, cy + 2, 6, C_CLOUD);
  fcirc(cx - 9, cy + 3, 5, C_CLOUD); fcirc(cx + 2, cy - 4, 6, C_CLOUD);
}
function tierOf(o) { return Math.min(4, Math.floor(4 * (1 - o.hp / o.mhp))); }
function drawCastle(x, top, w, body, edge, tier, fc) {
  var i, gx = x + Math.floor(w / 2) - 5;
  fillRect(x, top, w, GY - top, body); outRect(x, top, w, GY - top, edge);
  for (i = 0; i < w - 4; i += 9) fillRect(x + i, top - 4, 5, 4, body);
  fillRect(gx, GY - 18, 10, 18, rgb(70, 45, 25)); fillRect(gx + 2, GY - 20, 6, 2, rgb(70, 45, 25));
  fillRect(x + 6, top + 8, 3, 6, edge); fillRect(x + w - 9, top + 8, 3, 6, edge);
  line(x + w - 8, top - 4, x + w - 8, top - 16, edge);
  tri(x + w - 8, top - 16, x + w - 8, top - 10, x + w - 1, top - 13, fc);
  if (tier >= 1) line(x + 4, top + 20, x + 12, top + 34, edge);
  if (tier >= 2) line(x + w - 12, top + 6, x + w - 5, top + 22, edge);
  if (tier >= 3) line(x + 16, top + 14, x + 24, top + 30, edge);
  if (tier >= 4) line(x + 2, top + 4, x + w - 3, top + 24, edge);
}
function drawEng(e) {
  var x = Math.round(e.x), y = e.y, wd = rgb(110, 70, 35), d = rgb(40, 30, 20);
  if (e.t === 0) {
    fillRect(x, y + 4, 14, 3, wd); fcirc(x + 3, y + 8, 2, d); fcirc(x + 11, y + 8, 2, d);
    if (e.fire > 0) { line(x + 7, y + 4, x + 3, y - 4, d); fcirc(x + 3, y - 5, 2, rgb(140, 140, 140)); }
    else { line(x + 7, y + 4, x + 12, y - 3, d); fcirc(x + 12, y - 4, 2, rgb(140, 140, 140)); }
  } else {
    fillRect(x + 1, y + 3, 10, 4, rgb(60, 60, 65)); fillRect(x - 3, y + 1, 8, 3, d); fcirc(x + 6, y + 8, 3, wd);
    if (e.fire > 0) fcirc(x - 5, y + 2, 2, rgb(255, 200, 60));
  }
  if (e.hp < e.mhp * 0.5) line(x + 2, y + 2, x + 10, y + 6, rgb(200, 50, 30));
}
var SKIN = rgb(240, 200, 160), STEEL = rgb(190, 195, 205), DARK = rgb(40, 30, 30);
function drawUnit(u) {
  var x = Math.round(u.x), y = u.y, f = u.att ? 0 : (((tick + u.id * 3) >> 3) & 1), c, b;
  if (u.t === 0) {
    fcirc(x + 3, y + 2, 2, SKIN); fillRect(x + 1, y + 4, 4, 4, rgb(190, 40, 40));
    if (f) { fillRect(x + 1, y + 8, 1, 3, DARK); fillRect(x + 4, y + 8, 1, 2, DARK); }
    else { fillRect(x + 1, y + 8, 1, 2, DARK); fillRect(x + 4, y + 8, 1, 3, DARK); }
    line(x - 2, y + 5, x + 1, y + 6, STEEL);
  } else if (u.t === 1) {
    fillRect(x + 1, y, 6, 4, STEEL); fillRect(x, y + 4, 8, 6, rgb(130, 135, 150)); fillRect(x - 1, y + 4, 3, 6, rgb(50, 80, 190));
    if (f) { fillRect(x + 1, y + 10, 2, 3, DARK); fillRect(x + 5, y + 10, 2, 2, DARK); }
    else { fillRect(x + 1, y + 10, 2, 2, DARK); fillRect(x + 5, y + 10, 2, 3, DARK); }
  } else if (u.t === 2) {
    fillRect(x + 3, y, 14, 4, rgb(110, 70, 40)); fillRect(x, y + 4, 20, 5, rgb(150, 100, 50));
    fillRect(x - 2, y + 5, 3, 3, rgb(90, 90, 100)); fcirc(x + 4, y + 10, 2, DARK); fcirc(x + 16, y + 10, 2, DARK);
  } else {
    fillRect(x + 2, y + 8, 10, 12, rgb(120, 80, 50)); fcirc(x + 7, y + 5, 4, rgb(210, 170, 130));
    fillRect(x + 4, y + 4, 2, 1, DARK); fillRect(x + 8, y + 4, 2, 1, DARK);
    if (f) { fillRect(x + 3, y + 20, 3, 4, DARK); fillRect(x + 8, y + 20, 3, 3, DARK); }
    else { fillRect(x + 3, y + 20, 3, 3, DARK); fillRect(x + 8, y + 20, 3, 4, DARK); }
    line(x - 1, y + 8, x - 3, y + 20, rgb(100, 70, 40)); line(x, y + 8, x - 2, y + 20, rgb(100, 70, 40));
  }
  if (u.hp < u.mhp) {
    c = u.w; b = Math.max(1, Math.floor(c * u.hp / u.mhp));
    fillRect(x, y - 3, c, 1, rgb(200, 40, 40)); fillRect(x, y - 3, b, 1, rgb(60, 220, 60));
  }
}
function drawProj(p) {
  var x = Math.round(p.x), y = Math.round(p.y);
  if (p.kind === 'arrow') { line(x, y, x - p.vx * 0.9, y - p.vy * 0.9, rgb(90, 60, 30)); fillRect(x, y, 1, 1, STEEL); }
  else if (p.kind === 'bolt') { line(x, y, x - p.vx * 0.7, y - p.vy * 0.7, rgb(60, 40, 20)); line(x, y + 1, x - p.vx * 0.7, y + 1 - p.vy * 0.7, rgb(60, 40, 20)); }
  else if (p.kind === 'ball') fcirc(x, y, 2, rgb(30, 30, 35));
  else if (p.kind === 'mball') { fcirc(x, y, 3, rgb(255, 200, 40)); fcirc(x, y, 1, rgb(255, 255, 200)); }
  else if (p.kind === 'rock') fcirc(x, y, 3, rgb(125, 120, 115));
  else if (p.kind === 'eroc') fcirc(x, y, 3, rgb(110, 70, 40));
  else fcirc(x, y, 2, rgb(20, 20, 20));
}
function fxR(f) { return f.big ? (6 + f.t * 4) : (3 + f.t * 2); }
function drawFx(f) {
  var r = fxR(f);
  circ(f.x, f.y, r, f.col); circ(f.x, f.y, Math.max(1, r - 2), f.col);
}
function drawBarrel() {
  var w = WP[wsel], a = ang * 0.0174533, ex, ey;
  fcirc(LPX, LPY, 3, WCOL[wsel]);
  if (w.kind === 'melee') { line(LPX, LPY - 9, LPX, LPY + 3, rgb(150, 110, 60)); tri(LPX, LPY - 13, LPX - 2, LPY - 8, LPX + 2, LPY - 8, STEEL); return; }
  ex = LPX + Math.cos(a) * w.len; ey = LPY - Math.sin(a) * w.len;
  line(LPX, LPY, ex, ey, rgb(50, 35, 25)); line(LPX, LPY - 1, ex, ey - 1, rgb(50, 35, 25));
}
function drawSpear() {
  var L = 14 + (6 - spearT) * 5;
  if (L > 48) L = 48;
  line(CR, 138, CR + L, 138, rgb(150, 110, 60)); line(CR, 139, CR + L, 139, rgb(150, 110, 60));
  tri(CR + L, 135, CR + L, 142, CR + L + 6, 138, STEEL);
}
/* restore bg + every layer inside a rect */
function restore(x, y, w, h) {
  var i, o, c, xe, ye;
  x = Math.floor(x); y = Math.floor(y); w = Math.ceil(w); h = Math.ceil(h);
  if (x < 0) { w += x; x = 0; }
  if (y < 0) { h += y; y = 0; }
  if (x + w > W) w = W - x;
  if (y + h > GY + 4) h = GY + 4 - y;
  if (w <= 0 || h <= 0) return;
  restoreBg(x, y, w, h);
  xe = x + w; ye = y + h;
  for (i = 0; i < CLOUDS.length; i++) {
    c = CLOUDS[i];
    if (c[0] - 15 < xe && c[0] + 16 > x && c[1] - 11 < ye && c[1] + 10 > y) drawCloud(c[0], c[1]);
  }
  if (mode === 'A' && xe > ECX - 3 && ye > ECTOP - 20) drawCastle(ECX, ECTOP, ECW, rgb(128, 96, 100), rgb(60, 34, 40), ec.dt, rgb(150, 40, 150));
  if (x < CR + 4 && ye > CTOP - 20) drawCastle(CL, CTOP, CR - CL, rgb(150, 150, 168), rgb(70, 70, 88), cas.dt, rgb(60, 110, 230));
  for (i = 0; i < engs.length; i++) {
    o = engs[i];
    if (o.alive && o.x < xe + 4 && o.x + 16 > x - 4 && o.y - 8 < ye && o.y + 12 > y) drawEng(o);
  }
  for (i = 0; i < units.length; i++) {
    o = units[i];
    if (o.alive && o.x < xe + 2 && o.x + o.w + 2 > x && o.y - 4 < ye && o.y + o.h + 1 > y) drawUnit(o);
  }
  if (spearT > 0 && x < CR + 62 && xe > CR && ye > 130 && y < 146) drawSpear();
  for (i = 0; i < projs.length; i++) {
    o = projs[i];
    if (o.alive && o.x > x - 8 && o.x < xe + 8 && o.y > y - 8 && o.y < ye + 8) drawProj(o);
  }
  for (i = 0; i < fx.length; i++) {
    o = fx[i]; c = fxR(o);
    if (o.x + c > x && o.x - c < xe && o.y + c > y && o.y - c < ye) drawFx(o);
  }
  if (xe > LPX - 18 && x < LPX + 18 && ye > LPY - 18 && y < LPY + 18) drawBarrel();
  for (i = 0; i < dots.length; i++) {
    if (dots[i][0] + 2 > x && dots[i][0] < xe && dots[i][1] + 2 > y && dots[i][1] < ye) fillRect(dots[i][0], dots[i][1], 2, 2, C_DOT);
  }
}
function addRect(x, y, w, h) {
  var i, r, nx, ny, nx2, ny2;
  x = Math.floor(x); y = Math.floor(y); w = Math.ceil(w); h = Math.ceil(h);
  for (i = 0; i < rq.length; i++) {
    r = rq[i];
    if (x <= r[0] + r[2] && x + w >= r[0] && y <= r[1] + r[3] && y + h >= r[1]) {
      nx = Math.min(x, r[0]); ny = Math.min(y, r[1]);
      nx2 = Math.max(x + w, r[0] + r[2]); ny2 = Math.max(y + h, r[1] + r[3]);
      r[0] = nx; r[1] = ny; r[2] = nx2 - nx; r[3] = ny2 - ny;
      return;
    }
  }
  if (rq.length < 28) rq.push([x, y, w, h]);
  else { r = rq[0]; nx = Math.min(x, r[0]); ny = Math.min(y, r[1]); nx2 = Math.max(x + w, r[0] + r[2]); ny2 = Math.max(y + h, r[1] + r[3]); r[0] = nx; r[1] = ny; r[2] = nx2 - nx; r[3] = ny2 - ny; }
}
var lastSp = 0, aimDirty = false;
function collectDirty() {
  var i, o, rx, ry, f, b, t, x0, y0, x1, y1;
  t = tierOf(cas);
  if (t !== cas.dt) { cas.dt = t; addRect(CL - 2, CTOP - 20, CR - CL + 6, GY - CTOP + 22); }
  if (mode === 'A') {
    t = tierOf(ec);
    if (t !== ec.dt) { ec.dt = t; addRect(ECX - 2, ECTOP - 20, ECW + 4, GY - ECTOP + 22); }
  }
  for (i = engs.length - 1; i >= 0; i--) {
    o = engs[i];
    if (!o.alive) { addRect(o.x - 5, o.y - 8, 24, 22); engs.splice(i, 1); continue; }
    f = (o.fire > 0 ? 1 : 0) + (o.hp < o.mhp * 0.5 ? 2 : 0);
    if (f !== o.lf) { o.lf = f; addRect(o.x - 5, o.y - 8, 24, 22); }
  }
  for (i = units.length - 1; i >= 0; i--) {
    o = units[i];
    if (!o.alive) { if (o.dr) addRect(o.lx - 3, o.y - 5, o.w + 6, o.h + 7); units.splice(i, 1); continue; }
    rx = Math.round(o.x); f = o.att ? 0 : (((tick + o.id * 3) >> 3) & 1);
    b = (o.hp < o.mhp) ? (1 + Math.floor(4 * o.hp / o.mhp)) : 0;
    if (!o.dr || rx !== o.lx || f !== o.lf || b !== o.lb) {
      if (o.dr) addRect(o.lx - 3, o.y - 5, o.w + 6, o.h + 7);
      addRect(rx - 3, o.y - 5, o.w + 6, o.h + 7);
      o.lx = rx; o.lf = f; o.lb = b; o.dr = true;
    }
  }
  for (i = projs.length - 1; i >= 0; i--) {
    o = projs[i];
    if (!o.alive) { if (o.dr) addRect(o.lx - 7, o.ly - 7, 15, 15); projs.splice(i, 1); continue; }
    rx = Math.round(o.x); ry = Math.round(o.y);
    if (!o.dr || rx !== o.lx || ry !== o.ly) {
      x0 = o.dr ? Math.min(o.lx, rx) : rx; y0 = o.dr ? Math.min(o.ly, ry) : ry;
      x1 = o.dr ? Math.max(o.lx, rx) : rx; y1 = o.dr ? Math.max(o.ly, ry) : ry;
      addRect(x0 - 7, y0 - 7, x1 - x0 + 15, y1 - y0 + 15);
      o.lx = rx; o.ly = ry; o.dr = true;
    }
  }
  for (i = fx.length - 1; i >= 0; i--) {
    o = fx[i]; rx = fxR(o);
    addRect(o.x - rx - 2, o.y - rx - 2, rx * 2 + 5, rx * 2 + 5);
    if (o.dead) fx.splice(i, 1);
  }
  if (spearT !== lastSp) { lastSp = spearT; addRect(CR, 130, 64, 18); }
  if (aimDirty) { aimDirty = false; addRect(LPX - 18, LPY - 18, 36, 36); }
}
function renderFrame() {
  var i, r;
  collectDirty();
  for (i = 0; i < rq.length; i++) { r = rq[i]; restore(r[0], r[1], r[2], r[3]); }
  rq = [];
}

/* ------------------------------------------------------------------ */
/* HUD (ground strip, each field redrawn only when it changes)         */
/* ------------------------------------------------------------------ */
function bar(x, y, w, frac, col) {
  frac = cl(frac, 0, 1);
  fillRect(x, y, w, 6, rgb(70, 50, 30));
  fillRect(x + 1, y + 1, Math.floor((w - 2) * frac), 4, col);
  outRect(x, y, w, 6, WHITE);
}
function hudRow1(force) {
  if (!force && hc.foes === foes && hc.gold === prog.gold) return;
  hc.foes = foes; hc.gold = prog.gold;
  fillRect(4, 153, 250, 8, C_HUD);
  txt('L' + lv + ' ' + (mode === 'D' ? 'DEFEND' : 'ASSAULT') + '  $' + prog.gold + '  FOES ' + foes, 6, 153, 1, WHITE);
}
function hudWeapon(force) {
  var s = '[' + WP[wsel].n + ']' + (WP[wsel].kind === 'melee' ? '' : ' ' + ang);
  if (!force && hc.wn === s) return;
  hc.wn = s;
  fillRect(4, 162, 112, 8, C_HUD);
  txt(s, 6, 162, 1, GOLD);
}
function hudCd(force) {
  var tot = Math.max(1, Math.round(WP[wsel].cd * rldMul())), q = Math.floor(12 * (1 - cds[wsel] / tot));
  if (!force && hc.cd === q) return;
  hc.cd = q;
  bar(118, 162, 34, q / 12, q >= 12 ? rgb(90, 220, 90) : rgb(230, 190, 60));
}
function hudHp(force) {
  var a = Math.max(0, Math.round(cas.hp)), b = (mode === 'A') ? Math.max(0, Math.round(ec.hp)) : 0;
  if (!force && hc.hp === a && hc.ec === b) return;
  hc.hp = a; hc.ec = b;
  fillRect(156, 162, 160, 8, C_HUD);
  txt('HP', 156, 162, 1, WHITE);
  bar(170, 162, 56, cas.hp / cas.mhp, cas.hp / cas.mhp > 0.35 ? rgb(70, 200, 90) : rgb(230, 70, 60));
  if (mode === 'A') { txt('EN', 232, 162, 1, WHITE); bar(246, 162, 66, ec.hp / ec.mhp, rgb(200, 80, 200)); }
}
function hudAll() { hudRow1(true); hudWeapon(true); hudCd(true); hudHp(true); }
function hudUpdate() { hudRow1(false); hudWeapon(false); hudCd(false); hudHp(false); }

/* ------------------------------------------------------------------ */
/* Level setup                                                         */
/* ------------------------------------------------------------------ */
function pickType(n, i) {
  var r = (i * 7 + n * 3) % 10;
  if (n % 10 === 0 && i % 8 === 7) return 3;
  if (n >= 8 && r === 7) return 2;
  if (n >= 5 && r < 3) return 1;
  return 0;
}
function addEng(t, x, y, n) {
  var hp = Math.round(40 * hs);
  engs.push({ t: t, x: x, y: y, hp: hp, mhp: hp, cd: 90 + engs.length * 45, fire: 0, alive: true, lf: 0 });
}
function buildLevel(n) {
  var i, cnt, iv, ne, xs, q;
  mode = (n % 2 === 1) ? 'D' : 'A';
  hs = (1 + n * 0.017) * DIFFH[cfg.diff];
  units = []; projs = []; engs = []; fx = []; dots = []; rq = []; spawnQ = []; si = 0; tick = 0; kills = 0; spearT = 0; lastSp = 0;
  cds = [0, 0, 0, 0, 0, 0, 0, 0]; endT = 0;
  cas.mhp = castleMax(); cas.hp = cas.mhp; cas.dt = 0;
  if (mode === 'A') { ec.mhp = Math.round((250 + n * 28) * DIFFH[cfg.diff]); ec.hp = ec.mhp; ec.dt = 0; } else { ec.mhp = 1; ec.hp = 1; ec.dt = 0; }
  if (mode === 'D') { cnt = 6 + Math.floor(n * 1.2); iv = Math.max(16, Math.round(80 - n * 1.3)); }
  else { cnt = 3 + Math.floor(n * 0.7); iv = Math.max(40, Math.round(150 - n * 2)); }
  for (i = 0; i < cnt; i++) {
    q = (i === cnt - 1 && n % 10 === 0) ? 3 : pickType(n, i);
    spawnQ.push([90 + i * iv + ((n * 7 + i * 13) % 11), q]);
  }
  ecd = Math.max(80, Math.round(200 - n * 2.4));
  eerr = Math.max(0.015, 0.12 - n * 0.002);
  if (mode === 'D') {
    ne = Math.min(4, Math.floor(n / 6)); xs = [292, 276, 260, 244];
    for (i = 0; i < ne; i++) addEng(i % 2, xs[i], GY - 10, n);
  } else {
    ne = Math.min(5, 1 + Math.floor(n / 8));
    for (i = 0; i < ne; i++) {
      if (i < 3) addEng(i % 2, ECX + 4 + i * 16, ECTOP - 10, n);
      else addEng(i % 2, 252 - (i - 3) * 16, GY - 10, n);
    }
  }
  foes = cnt;
  if (!wOK(wsel)) wsel = 1;
  ang = cl(ang, 5, 85);
  aimDirty = true;
}

/* ------------------------------------------------------------------ */
/* Simulation                                                          */
/* ------------------------------------------------------------------ */
function addFx(x, y, col, big) { if (fx.length < 14) fx.push({ x: Math.round(x), y: Math.round(y), t: 0, col: col, big: big, dead: false }); }
function stepFx() { var i; for (i = 0; i < fx.length; i++) { fx[i].t++; if (fx[i].t > 5) fx[i].dead = true; } }
function killUnit(u) {
  if (!u.alive) return;
  u.alive = false;
  prog.gold += UT[u.t].g; kills++;
  addFx(u.x + u.w / 2, u.y + u.h / 2, rgb(255, 230, 120), false);
  sndKill();
}
function dmgUnit(u, d) { if (!u.alive) return; u.hp -= d; if (u.hp <= 0) killUnit(u); }
function dmgEng(e, d) {
  if (!e.alive) return;
  e.hp -= d;
  if (e.hp <= 0) { e.alive = false; prog.gold += 30; addFx(e.x + 7, e.y + 4, rgb(255, 160, 40), true); sndBoom(); }
}
function dmgCastle(d) {
  if (ec.hp <= 0) return;
  ec.hp -= d; sndHit();
  if (ec.hp <= 0) { ec.hp = 0; addFx(ECX + 25, ECTOP + 20, rgb(255, 160, 40), true); addFx(ECX + 10, ECTOP + 30, rgb(255, 220, 80), true); sndBoom(); }
}
function impact(p) {
  var i, u, e, d, cx, cy, R;
  if (p.sp > 0) {
    addFx(p.x, p.y, rgb(255, 200, 80), true); sndBoom();
    for (i = 0; i < units.length; i++) {
      u = units[i];
      if (!u.alive) continue;
      cx = u.x + u.w / 2; cy = u.y + u.h / 2;
      d = Math.sqrt((cx - p.x) * (cx - p.x) + (cy - p.y) * (cy - p.y)); R = p.sp + u.w / 2;
      if (d < R) dmgUnit(u, p.dmg * (1 - 0.6 * d / R));
    }
    for (i = 0; i < engs.length; i++) {
      e = engs[i];
      if (!e.alive) continue;
      cx = e.x + 7; cy = e.y + 4;
      d = Math.sqrt((cx - p.x) * (cx - p.x) + (cy - p.y) * (cy - p.y));
      if (d < p.sp + 6) dmgEng(e, p.dmg * (1 - 0.6 * d / (p.sp + 6)));
    }
  } else { addFx(p.x, p.y, WHITE, false); sndHit(); }
}
function hitPlayerProj(p) {
  var i, u, e, d;
  if (p.y >= GY) { p.y = GY; impact(p); p.alive = false; return; }
  for (i = 0; i < units.length; i++) {
    u = units[i];
    /* slightly larger hitbox so fast projectiles don't tunnel past thin units */
    if (u.alive && u.id !== p.last && p.x > u.x - 2 && p.x < u.x + u.w + 2 && p.y > u.y - 2 && p.y < u.y + u.h + 2) {
      d = p.dmg * ((p.kind === 'arrow' || p.kind === 'bolt') ? (1 - u.ar) : 1); /* mball/ball/rock ignore armor */
      dmgUnit(u, d); p.last = u.id;
      if (p.pierce > 0) { p.pierce--; p.dmg *= 0.8; continue; }
      impact(p); p.alive = false; return;
    }
  }
  for (i = 0; i < engs.length; i++) {
    e = engs[i];
    if (e.alive && p.x > e.x - 2 && p.x < e.x + 16 && p.y > e.y - 6 && p.y < e.y + 11) {
      dmgEng(e, p.dmg * (CMUL[p.kind] || 1));
      impact(p); p.alive = false; return;
    }
  }
  if (mode === 'A' && ec.hp > 0 && p.x >= ECX - 1 && p.x <= ECX + ECW + 1 && p.y >= ECTOP - 3) {
    dmgCastle(p.dmg * (CMUL[p.kind] || 1));
    impact(p); p.alive = false;
  }
}
function hitEnemyProj(p) {
  if (p.y >= GY) { addFx(p.x, GY - 2, rgb(150, 120, 80), false); p.alive = false; return; }
  if (p.x <= CR && p.x >= CL && p.y >= CTOP - 4) {
    cas.hp -= p.dmg; addFx(p.x, p.y, rgb(255, 170, 60), true); sndBoom(); p.alive = false;
  }
}
function stepProj(p) {
  var sp, n, s, dx, dy;
  p.vy += p.g;
  sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
  if (!(sp === sp) || sp > 28 || !(p.x === p.x) || !(p.y === p.y)) { p.alive = false; return; }
  /* finer sub-steps reduce tunneling on fast bolts / master shots */
  n = Math.max(1, Math.ceil(sp / 2.2));
  dx = p.vx / n; dy = p.vy / n;
  for (s = 0; s < n && p.alive; s++) {
    p.x += dx; p.y += dy;
    if (!(p.x === p.x) || !(p.y === p.y)) { p.alive = false; return; }
    if (p.own === 0) hitPlayerProj(p); else hitEnemyProj(p);
  }
  p.life++;
  if (p.x > W + 12 || p.x < -12 || p.y > H + 20 || p.y < -30 || p.life > 360) p.alive = false;
}
function addUnit(t) {
  var d = UT[t], hp = Math.round(d.hp * hs);
  units.push({ id: uid++, t: t, x: W + 4, y: GY - d.h, w: d.w, h: d.h, hp: hp, mhp: hp, sp: d.sp, ar: d.ar, att: false, cd: 0, alive: true, dr: false, lx: 0, lf: 0, lb: 0 });
}
function spawnStep() {
  while (si < spawnQ.length && spawnQ[si][0] <= tick) {
    if (units.length >= 56) { spawnQ[si][0] = tick + 10; break; }
    addUnit(spawnQ[si][1]); si++;
  }
}
function unitsStep() {
  var i, u, nat = 0, d, stopX;
  for (i = 0; i < units.length; i++) if (units[i].alive && units[i].att) nat++;
  for (i = 0; i < units.length; i++) {
    u = units[i];
    if (!u.alive) continue;
    if (!(u.x === u.x) || !(u.sp === u.sp) || u.sp <= 0) { u.alive = false; continue; }
    d = UT[u.t];
    if (u.att) {
      /* snap attacking units to a stable wall position so they don't jitter */
      stopX = CR + 2 + Math.min(nat, 10) * 2.5;
      if (u.x < stopX - 0.5 || u.x > stopX + 0.5) u.x = stopX;
      u.cd--;
      if (u.cd <= 0) {
        cas.hp -= d.dmg;
        if (!(cas.hp === cas.hp)) cas.hp = 0;
        u.cd = d.rate;
        addFx(CR, u.y + 4, rgb(255, 120, 80), false);
        sndHit();
      }
    } else {
      u.x -= u.sp;
      /* never walk through the wall */
      if (u.x < CR + 1) u.x = CR + 1;
      stopX = CR + 1 + Math.min(nat, 10) * 2.5;
      if (u.x <= stopX) {
        u.att = true;
        u.x = stopX;
        u.cd = 18 + (u.id % 5); /* slight stagger so attacks don't all land same frame */
        nat++;
      }
    }
  }
}
/* ballistic angle: returns radians or -1 */
function solveAng(dx, dy, v, g, high) {
  var disc = v * v * v * v - g * (g * dx * dx + 2 * dy * v * v), s;
  if (disc < 0 || dx <= 0) return -1;
  s = Math.sqrt(disc);
  return Math.atan((v * v + (high ? s : -s)) / (g * dx));
}
function fireEngine(e) {
  var v, g, high, tx, ty, a, vx, vy, k, dmg, lx = e.x + 7, ly = e.y;
  if (e.t === 0) { v = 6.8; g = 0.15; high = true; k = 'eroc'; dmg = 14; } else { v = 7.5; g = 0.12; high = false; k = 'ecan'; dmg = 9; }
  dmg = dmg * (1 + lv * 0.02);
  tx = CL + 10 + Math.random() * (CR - CL - 16); ty = CTOP + 6 + Math.random() * 34;
  a = solveAng(lx - tx, ly - ty, v, g, high);
  if (a < 0) a = 0.78;
  v = v * (1 + (Math.random() - 0.5) * 2 * eerr);
  vx = -v * Math.cos(a); vy = -v * Math.sin(a);
  if (liveProjs() < 40) projs.push({ own: 1, kind: k, x: lx, y: ly, vx: vx, vy: vy, g: g, dmg: dmg, sp: 0, pierce: 0, last: -1, alive: true, life: 0, dr: false, lx: 0, ly: 0 });
  e.fire = 8; sndShot('rock');
}
function enginesStep() {
  var i, e;
  for (i = 0; i < engs.length; i++) {
    e = engs[i];
    if (!e.alive) continue;
    if (e.fire > 0) e.fire--;
    e.cd--;
    if (e.cd <= 0) { fireEngine(e); e.cd = ecd; }
  }
}
function projStep() { var i; for (i = 0; i < projs.length; i++) if (projs[i].alive) stepProj(projs[i]); }
function cdStep() { var i; for (i = 0; i < cds.length; i++) if (cds[i] > 0) cds[i]--; if (spearT > 0) spearT--; }
function countFoes() {
  var i, n = spawnQ.length - si;
  for (i = 0; i < units.length; i++) if (units[i].alive) n++;
  foes = n;
}
function simTick() {
  tick++;
  spawnStep(); unitsStep(); enginesStep(); projStep(); stepFx(); cdStep(); countFoes();
}
function liveProjs() { var i, n = 0; for (i = 0; i < projs.length; i++) if (projs[i].alive) n++; return n; }
function fireWeapon() {
  var w = WP[wsel], a, i, u, cdv, vx, vy;
  if (!w || cds[wsel] > 0) return false;
  cdv = Math.max(2, Math.round(w.cd * rldMul()));
  if (w.kind === 'melee') {
    spearT = 6; cds[wsel] = cdv;
    for (i = 0; i < units.length; i++) {
      u = units[i];
      if (u.alive && u.x < CR + 42) dmgUnit(u, w.dmg * dmgMul());
    }
    beep(500, 8);
    return true;
  }
  if (liveProjs() >= 40) return false;
  a = ang * 0.0174533;
  vx = w.v * Math.cos(a); vy = -w.v * Math.sin(a);
  if (!(vx === vx) || !(vy === vy)) return false;
  projs.push({ own: 0, kind: w.kind, x: LPX, y: LPY, vx: vx, vy: vy, g: w.g, dmg: w.dmg * dmgMul(), sp: w.sp, pierce: w.pierce, last: -1, alive: true, life: 0, dr: false, lx: 0, ly: 0 });
  cds[wsel] = cdv;
  aimDirty = true;
  sndShot(w.kind);
  return true;
}

/* ------------------------------------------------------------------ */
/* Aim guide dots                                                      */
/* ------------------------------------------------------------------ */
function calcDots() {
  var out = [], w = WP[wsel], a = ang * 0.0174533, x = LPX, y = LPY, vx, vy, t, mx;
  if (cfg.guide === 0 || w.kind === 'melee') return out;
  vx = w.v * Math.cos(a); vy = -w.v * Math.sin(a);
  mx = (cfg.guide === 1) ? 6 : 14;
  for (t = 1; t < 120 && out.length < mx; t++) {
    vy += w.g; x += vx; y += vy;
    if (y >= GY - 2 || x > W) break;
    if (t % 3 === 0 && y > 1) out.push([Math.round(x), Math.round(y)]);
  }
  return out;
}
function dotIn(list, d) {
  var i;
  for (i = 0; i < list.length; i++) if (list[i][0] === d[0] && list[i][1] === d[1]) return true;
  return false;
}
function updateDots() {
  var nd = calcDots(), od = dots, i;
  dots = nd;
  for (i = 0; i < od.length; i++) if (!dotIn(nd, od[i])) addRect(od[i][0] - 1, od[i][1] - 1, 4, 4);
  for (i = 0; i < nd.length; i++) if (!dotIn(od, nd[i])) addRect(nd[i][0] - 1, nd[i][1] - 1, 4, 4);
}
function cycleWeapon() {
  var i, n = wsel;
  for (i = 0; i < WP.length; i++) { n = (n + 1) % WP.length; if (wOK(n)) break; }
  wsel = n;
  aimDirty = true; updateDots(); hudWeapon(false); hudCd(true);
}

/* ------------------------------------------------------------------ */
/* Dialogs / menus (plain-rectangle highlight so it always shows)      */
/* ------------------------------------------------------------------ */
function stxt(s, cx, y, sz, c) { ctxt(s, cx + 1, y + 1, sz, BLACK); ctxt(s, cx, y, sz, c); }
function panel(x, y, w, h) {
  var t = th();
  fillRect(x, y, w, h, t.dark); outRect(x, y, w, h, t.trim); outRect(x + 2, y + 2, w - 4, h - 4, t.trim);
}
function toast(msg, col) {
  var w = Math.max(150, tw(msg, 1) + 24), h = 28, x = Math.floor((W - w) / 2), y = Math.floor((H - h) / 2);
  panel(x, y, w, h);
  ctxt(msg, W / 2, y + 10, 1, col);
  sleep(1200);
}
function lmRow(x, y, w, i, on, opts) {
  var t = th();
  hiBox(x, y, w, 14, on);
  ctxt(opts[i], x + w / 2, y + 3, 1, on ? t.dark : WHITE);
  hiArrows(x, y, w, 14, on);
}
/* returns chosen index, or -1 for Back */
function listMenu(title, sub, opts, stars) {
  var w = 184, n = opts.length, h = 30 + (sub ? 12 : 0) + (stars >= 0 ? 14 : 0) + n * 17 + 6;
  var x = Math.floor((W - w) / 2), y = Math.floor((H - h) / 2), sel = 0, k, old, i, ry, t = th(), sz;
  panel(x, y, w, h);
  sz = (tw(title, 2) <= w - 14) ? 2 : 1;
  ctxt(title, W / 2, y + 7, sz, t.trim);
  ry = y + 26;
  if (stars >= 0) {
    for (i = 0; i < 3; i++) fillRect(W / 2 - 21 + i * 16, ry, 10, 10, i < stars ? GOLD : rgb(90, 70, 40));
    ry += 14;
  }
  if (sub) { ctxt(sub, W / 2, ry, 1, WHITE); ry += 12; }
  for (i = 0; i < n; i++) lmRow(x + 14, ry + i * 17, w - 28, i, i === sel, opts);
  settle();
  while (true) {
    k = waitKey();
    if (k === 'L' || k === 'R') {
      old = sel; sel = (sel + (k === 'R' ? 1 : n - 1)) % n; sndMove();
      lmRow(x + 14, ry + old * 17, w - 28, old, false, opts);
      lmRow(x + 14, ry + sel * 17, w - 28, sel, true, opts);
    } else if (k === 'O') { sndSel(); return sel; }
    else if (k === 'B') { return -1; }
  }
}
function askYesNo(title, msg) {
  var r = listMenu(title, msg, ['NO', 'YES'], -1);
  return r === 1;
}

/* ------------------------------------------------------------------ */
/* Save / load (only ever called from a menu choice)                   */
/* ------------------------------------------------------------------ */
function packSave() {
  return 'V=1;S=' + (cfg.sound ? 1 : 0) + ';G=' + cfg.guide + ';D=' + cfg.diff + ';P=' + cfg.speed + ';U=' + prog.unlocked + ';O=' + prog.gold + ';A=' + prog.ups.join(',') + ';K=' + prog.stars.join('');
}
function readSave() {
  var s = null;
  try { if (S) s = S.read({ fs: 'littlefs', path: SAVE_PATH }); } catch (e) { s = null; }
  return (typeof s === 'string') ? s : null;
}
function saveGame() {
  var s = packSave(), r, back;
  if (!S) return false;
  try { r = S.write({ fs: 'littlefs', path: SAVE_PATH }, s, 'write'); } catch (e) { return false; }
  if (r === false) return false;
  back = readSave();
  if (back === s) { prog.dirty = false; return true; }
  return false;
}
function loadGame() {
  var s = readSave(), p, i, kv, v, ks, u;
  if (!s || s.indexOf('V=1') !== 0) return false;
  p = s.split(';');
  for (i = 0; i < p.length; i++) {
    kv = p[i].split('=');
    if (kv.length < 2) continue;
    if (kv[0] === 'A') {
      ks = kv[1].split(',');
      for (v = 0; v < 3 && v < ks.length; v++) { u = parseInt(ks[v], 10); prog.ups[v] = (u >= 0 && u <= UP_MAX) ? u : 0; }
      continue;
    }
    if (kv[0] === 'K') {
      for (v = 0; v < NL && v < kv[1].length; v++) { u = parseInt(kv[1].charAt(v), 10); prog.stars[v] = (u >= 0 && u <= 3) ? u : 0; }
      continue;
    }
    v = parseInt(kv[1], 10);
    if (v !== v) continue;
    if (kv[0] === 'S') cfg.sound = (v !== 0);
    else if (kv[0] === 'G' && v >= 0 && v <= 2) cfg.guide = v;
    else if (kv[0] === 'D' && v >= 0 && v <= 2) cfg.diff = v;
    else if (kv[0] === 'P' && v >= 0 && v <= 2) cfg.speed = v;
    else if (kv[0] === 'U') prog.unlocked = cl(v, 1, NL);
    else if (kv[0] === 'O') prog.gold = cl(v, 0, 9999999);
  }
  prog.dirty = false;
  return true;
}

/* ------------------------------------------------------------------ */
/* Battle flow                                                         */
/* ------------------------------------------------------------------ */
function renderScene() {
  var i, o;
  restore(0, 0, W, GY + 4);
  fillRect(0, GY + 4, W, H - GY - 4, C_HUD);
  hudAll();
  for (i = 0; i < units.length; i++) { o = units[i]; o.dr = o.alive; o.lx = Math.round(o.x); o.lf = o.att ? 0 : (((tick + o.id * 3) >> 3) & 1); o.lb = (o.hp < o.mhp) ? (1 + Math.floor(4 * o.hp / o.mhp)) : 0; }
  for (i = 0; i < projs.length; i++) { o = projs[i]; o.dr = o.alive; o.lx = Math.round(o.x); o.ly = Math.round(o.y); }
}
function pauseMenu() {
  var r;
  while (true) {
    r = listMenu('PAUSED', '', ['RESUME', 'RESTART', 'SAVE', 'QUIT TO MENU'], -1);
    if (r === 2) { renderScene(); toast(saveGame() ? 'GAME SAVED' : 'SAVE FAILED', WHITE); renderScene(); continue; }
    if (r === 1) return 'restart';
    if (r === 3) return 'menu';
    renderScene();
    return 'resume';
  }
}
function banner(n) {
  var h = 52, w = 232, x = Math.floor((W - w) / 2), y = 40, s2 = '';
  panel(x, y, w, h);
  ctxt('LEVEL ' + n, W / 2, y + 7, 2, GOLD);
  ctxt(n % 10 === 0 ? 'BOSS BATTLE!' : (mode === 'D' ? 'DEFEND YOUR CASTLE!' : 'STORM THE ENEMY CASTLE!'), W / 2, y + 28, 1, WHITE);
  if (prog.unlocked === n) {
    if (n === 2) s2 = 'NEW WEAPON: CROSSBOW';
    else if (n === 4) s2 = 'NEW WEAPON: CANNON';
    else if (n === 6) s2 = 'NEW WEAPON: CATAPULT';
    else if (n === 40) s2 = 'NEW WEAPON: BALLISTA';
    else if (n === 50) s2 = 'NEW WEAPON: TREBUCHET';
    else if (n === 75) s2 = 'NEW MASTER WEAPON!';
  }
  if (!s2 && n <= 2) s2 = 'TURN=AIM CLICK=FIRE BACK=WEAPON 2xBACK=PAUSE';
  if (s2) ctxt(s2, W / 2, y + 40, 1, rgb(160, 220, 255));
  sleep(1700);
}
function runLevel() {
  var t0, k, backT = -1000, prevW = 1, t, m, lastR = 0, res = '';
  settle();
  while (true) {
    t0 = ms();
    simTick();
    if (cas.hp <= 0) { cas.hp = 0; if (endT === 0) { endT = 30; res = 'lose'; addFx(CL + 20, CTOP + 20, rgb(255, 160, 40), true); sndBoom(); } }
    else if (mode === 'A' && ec.hp <= 0) { if (endT === 0) { endT = 40; res = 'win'; } }
    else if (mode === 'D' && si >= spawnQ.length && foes === 0) { if (endT === 0) { endT = 25; res = 'win'; } }
    if (endT > 0) { endT--; if (endT === 0) { renderFrame(); hudUpdate(); return res; } }
    renderFrame();
    hudUpdate();
    k = poll();
    if (k === 'R' || k === 'L') {
      t = ms(); m = (t - lastR < 150) ? 2 : 1; lastR = t;
      ang = cl(ang + (k === 'R' ? m : -m), 5, 85);
      aimDirty = true; updateDots(); hudWeapon(false);
    } else if (k === 'O') {
      if (!fireWeapon()) sndErr();
    } else if (k === 'B') {
      t = ms();
      if (t - backT < 420) {
        if (wOK(prevW)) { wsel = prevW; }
        aimDirty = true; updateDots();
        backT = -1000;
        res = pauseMenu();
        if (res !== 'resume') return res;
        res = '';
        renderScene(); settle();
      } else { prevW = wsel; backT = t; cycleWeapon(); }
    }
    sleep(Math.max(1, FR[cfg.speed] - (ms() - t0)));
  }
}
function startLevel(n) {
  lv = n;
  buildLevel(n);
  hc.foes = -1; hc.gold = -1; hc.hp = -1; hc.ec = -1; hc.cd = -1; hc.wn = ''; hc.ang = -1;
  restore(0, 0, W, GY + 4);
  fillRect(0, GY + 4, W, H - GY - 4, C_HUD);
  banner(n);
  updateDots();
  renderScene();
}
function playLevel(n) {
  var r, st, c, bonus, ratio;
  while (true) {
    startLevel(n);
    r = runLevel();
    if (r === 'menu') return;
    if (r === 'restart') continue;
    if (r === 'win') {
      ratio = cas.hp / cas.mhp;
      st = (ratio >= 0.7) ? 3 : ((ratio >= 0.35) ? 2 : 1);
      bonus = 50 + n * 5 + (mode === 'A' ? 100 + n * 5 : 0);
      prog.gold += bonus;
      if (st > prog.stars[n - 1]) { prog.stars[n - 1] = st; }
      if (n < NL && n + 1 > prog.unlocked) prog.unlocked = n + 1;
      prog.dirty = true;
      sndWin();
      c = listMenu('VICTORY!', 'BONUS $' + bonus + '  GOLD $' + prog.gold, ['NEXT LEVEL', 'ARMORY', 'RETRY', 'MENU'], st);
      if (c === 0) { if (n >= NL) { toast('ALL 100 LEVELS CLEARED!', GOLD); return; } n++; continue; }
      if (c === 1) { armory(); n = (n < NL) ? n + 1 : n; continue; }
      if (c === 2) continue;
      return;
    }
    sndLose();
    c = listMenu('CASTLE FELL', 'GOLD $' + prog.gold, ['RETRY', 'ARMORY', 'MENU'], -1);
    if (c === 0) continue;
    if (c === 1) { armory(); continue; }
    return;
  }
}

/* ------------------------------------------------------------------ */
/* Screens                                                             */
/* ------------------------------------------------------------------ */
function bgPlain() {
  var i;
  restoreBg(0, 0, W, GY + 4);
  for (i = 0; i < CLOUDS.length; i++) drawCloud(CLOUDS[i][0], CLOUDS[i][1]);
  fillRect(0, GY + 4, W, H - GY - 4, C_HUD);
}
var MENU = ['PLAY', 'LEVELS', 'ARMORY', 'SETUP', 'SAVE', 'LOAD', 'EXIT'];
function menuRow(i, on) {
  var t = th(), x = 104, w = 112, y = 44 + i * 14, h = 12;
  hiBox(x, y, w, h, on);
  ctxt(MENU[i], x + w / 2, y + 2, 1, on ? t.dark : WHITE);
  hiArrows(x, y, w, h, on);
}
function menuRender(sel) {
  var i;
  bgPlain();
  drawCastle(8, 110, 52, rgb(150, 150, 168), rgb(70, 70, 88), 0, rgb(60, 110, 230));
  drawCastle(260, 110, 52, rgb(128, 96, 100), rgb(60, 34, 40), 0, rgb(150, 40, 150));
  stxt('CASTLE WARZ', W / 2, 5, 3, GOLD);
  stxt('by da cbm', W / 2, 31, 1, WHITE);
  for (i = 0; i < MENU.length; i++) menuRow(i, i === sel);
  ctxt('TURN = MOVE    CLICK = SELECT', W / 2, 157, 1, WHITE);
}
function menu(start) {
  var sel = start, k, old;
  menuRender(sel); settle();
  while (true) {
    k = waitKey();
    if (k === 'L' || k === 'R') {
      old = sel; sel = (sel + (k === 'R' ? 1 : MENU.length - 1)) % MENU.length;
      sndMove(); menuRow(old, false); menuRow(sel, true);
    } else if (k === 'O') { sndSel(); return sel; }
    else if (k === 'B') { return 6; }
  }
}
function lvCell(i, on) {
  var c = i % 10, r = Math.floor(i / 10), x = 6 + c * 31, y = 26 + r * 12, w = 29, h = 11, t = th(), locked = (i + 1 > prog.unlocked), j;
  if (locked) { fillRect(x, y, w, h, rgb(70, 70, 70)); outRect(x, y, w, h, rgb(110, 110, 110)); return; }
  hiBox(x, y, w, h, on);
  ctxt(String(i + 1), x + w / 2, y + 2, 1, on ? t.dark : WHITE);
  /* stars omitted on dense 100-level grid to save space; shown in victory */
}
function lvRender(sel) {
  var i;
  bgPlain();
  stxt('SELECT LEVEL', W / 2, 6, 2, GOLD);
  for (i = 0; i < NL; i++) lvCell(i, i === sel);
  ctxt('CLICK = PLAY    BACK = MENU', W / 2, 157, 1, WHITE);
}
function levelSelect() {
  var sel = cl(prog.unlocked - 1, 0, NL - 1), k, old, n;
  lvRender(sel); settle();
  while (true) {
    k = waitKey();
    n = cl(prog.unlocked, 1, NL);
    if (k === 'L' || k === 'R') {
      old = sel; sel = (sel + (k === 'R' ? 1 : n - 1)) % n; if (sel >= n) sel = 0;
      sndMove(); lvCell(old, false); lvCell(sel, true);
    } else if (k === 'O') {
      sndSel(); playLevel(sel + 1);
      sel = cl(sel, 0, NL - 1);
      lvRender(sel); settle();
    } else if (k === 'B') { return; }
  }
}
var AR_ROWS = ['DAMAGE', 'RELOAD SPEED', 'CASTLE HP', 'BACK'];
function arCost(i) { return 50 + prog.ups[i] * 45; }
function arRow(i, on) {
  var t = th(), x = 30, y = 40 + i * 24, w = 260, h = 20, v = '';
  hiBox(x, y, w, h, on);
  txt(AR_ROWS[i], x + (on ? 16 : 8), y + 6, 1, on ? t.dark : WHITE);
  if (i < 3) v = 'LV ' + prog.ups[i] + '/' + UP_MAX + '   ' + (prog.ups[i] >= UP_MAX ? 'MAX' : '$' + arCost(i));
  rtxt(v, x + w - (on ? 16 : 8), y + 6, 1, on ? t.dark : t.trim);
  hiArrows(x, y, w, h, on);
}
function arGold() {
  fillRect(60, 28, 200, 10, rgb(40, 28, 14));
  ctxt('GOLD $' + prog.gold, W / 2, 29, 1, GOLD);
}
function armory() {
  var sel = 0, k, old, i;
  bgPlain();
  stxt('ARMORY', W / 2, 6, 2, GOLD);
  arGold();
  for (i = 0; i < AR_ROWS.length; i++) arRow(i, i === sel);
  ctxt('CLICK = BUY    BACK = EXIT', W / 2, 157, 1, WHITE);
  settle();
  while (true) {
    k = waitKey();
    if (k === 'L' || k === 'R') {
      old = sel; sel = (sel + (k === 'R' ? 1 : AR_ROWS.length - 1)) % AR_ROWS.length;
      sndMove(); arRow(old, false); arRow(sel, true);
    } else if (k === 'O') {
      if (sel === 3) return;
      if (prog.ups[sel] < UP_MAX && prog.gold >= arCost(sel)) {
        prog.gold -= arCost(sel); prog.ups[sel]++; prog.dirty = true;
        sndWin(); arRow(sel, true); arGold();
      } else sndErr();
    } else if (k === 'B') { return; }
  }
}
var SET_ROWS = ['SOUND', 'DIFFICULTY', 'GAME SPEED', 'AIM GUIDE', 'RESET PROGRESS', 'BACK'];
function setVal(i) {
  if (i === 0) return cfg.sound ? 'ON' : 'OFF';
  if (i === 1) return ['EASY', 'NORMAL', 'HARD'][cfg.diff];
  if (i === 2) return ['SLOW', 'NORMAL', 'FAST'][cfg.speed];
  if (i === 3) return ['OFF', 'SHORT', 'LONG'][cfg.guide];
  return '';
}
function setRow(i, on) {
  var t = th(), x = 30, y = 30 + i * 19, w = 260, h = 16;
  hiBox(x, y, w, h, on);
  txt(SET_ROWS[i], x + (on ? 16 : 8), y + 4, 1, on ? t.dark : WHITE);
  rtxt(setVal(i), x + w - (on ? 16 : 8), y + 4, 1, on ? t.dark : t.trim);
  hiArrows(x, y, w, h, on);
}
function setRender(sel) {
  var i;
  bgPlain();
  stxt('SETUP', W / 2, 8, 2, GOLD);
  for (i = 0; i < SET_ROWS.length; i++) setRow(i, i === sel);
  ctxt('CLICK = CHANGE    BACK = EXIT', W / 2, 157, 1, WHITE);
}
function setup() {
  var sel = 0, k, old, i;
  setRender(sel); settle();
  while (true) {
    k = waitKey();
    if (k === 'L' || k === 'R') {
      old = sel; sel = (sel + (k === 'R' ? 1 : SET_ROWS.length - 1)) % SET_ROWS.length;
      sndMove(); setRow(old, false); setRow(sel, true);
    } else if (k === 'O') {
      sndSel();
      if (sel === 0) { cfg.sound = !cfg.sound; setRow(0, true); beep(1200, 30); }
      else if (sel === 1) { cfg.diff = (cfg.diff + 1) % 3; setRow(1, true); }
      else if (sel === 2) { cfg.speed = (cfg.speed + 1) % 3; setRow(2, true); }
      else if (sel === 3) { cfg.guide = (cfg.guide + 1) % 3; setRow(3, true); }
      else if (sel === 4) {
        if (askYesNo('RESET PROGRESS?', 'Levels, gold, upgrades cleared')) {
          prog.unlocked = 1; prog.gold = 0; prog.ups = [0, 0, 0]; for (i = 0; i < NL; i++) prog.stars[i] = 0; prog.dirty = true; wsel = 1;
        }
        setRender(sel); settle();
      } else { return; }
    } else if (k === 'B') { return; }
  }
}
function errorScreen(e) {
  var m = '', k;
  try { m = String(e && e.message ? e.message : e); } catch (x) { m = 'unknown'; }
  if (m.length > 38) m = m.substring(0, 38);
  bgPlain();
  stxt('OOPS - RECOVERED', W / 2, 50, 2, WHITE);
  ctxt(m, W / 2, 84, 1, WHITE);
  ctxt('CLICK TO RETURN TO MENU', W / 2, 110, 1, WHITE);
  settle();
  while (true) { k = waitKey(); if (k === 'O' || k === 'B') break; }
}
function main() {
  var errs = 0, sel = 0, c, go = true, n;
  while (go) {
    try {
      c = menu(sel); sel = c;
      if (c === 0) { n = cl(prog.unlocked, 1, NL); playLevel(n); }
      else if (c === 1) { levelSelect(); }
      else if (c === 2) { armory(); }
      else if (c === 3) { setup(); }
      else if (c === 4) { toast(saveGame() ? 'GAME SAVED' : 'SAVE FAILED', WHITE); }
      else if (c === 5) { toast(loadGame() ? 'GAME LOADED' : 'NO SAVE FOUND', WHITE); }
      else { if (!prog.dirty || askYesNo('EXIT GAME?', 'Unsaved progress will be lost')) go = false; }
      errs = 0;
    } catch (e) {
      errs++;
      try { errorScreen(e); } catch (e2) {}
      if (errs >= 5) go = false;
    }
  }
  fillRect(0, 0, W, H, BLACK);
  ctxt('THANKS FOR PLAYING!', W / 2, 78, 1, GOLD);
  sleep(700);
  fillRect(0, 0, W, H, BLACK);
}
main();

})();
