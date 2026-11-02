/*
 * PISSED OFF BIRDS  v1.1   by da cbm
 * Slingshot physics game for Bruce firmware
 * Target: LilyGO T-Embed CC1101 (320x170, rotary encoder)
 *
 * Controls
 *   Aim:    turn = angle, click = lock angle, turn = power, click = FIRE
 *           (Back while setting power returns to angle; Back on angle = pause)
 *   Flight: click = bird power (yellow dash / blue split / black bomb), Back = pause
 *   Menus:  turn = move, click = select, Back = back
 *
 * Plain ES5 (no arrow functions, let/const, template strings or nested
 * functions) so it runs on the Bruce interpreter.
 *
 * Stability notes
 *  - Background is drawn once. Per frame only small dirty rectangles are
 *    restored and the moving sprites redrawn, never a full-screen clear.
 *  - Fixed physics tick with sub-stepping for fast birds, NaN guards, time
 *    limits on every shot, and a crash guard around every screen.
 *  - Storage is touched ONLY when you pick SAVE or LOAD.
 */
(function () {

var SAVE_PATH = '/pob.sav';

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
var cfg = { sound: true, guide: 2, diff: 1, speed: 1 };
/* progress (written only by SAVE) */
var NL = 15;
var prog = { unlocked: 1, stars: [], dirty: false };
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
function sndLaunch() { beep(520, 14); }
function sndHit(m) { beep([320, 220, 1800, 700][m] || 400, 8); }
function sndPop() { beep(900, 10); }
function sndBoom() { beep(150, 20); }
function sndWin() { tune([[784, 70], [988, 70], [1175, 70], [1568, 160]]); }
function sndLose() { tune([[330, 120], [262, 120], [196, 240]]); }

/* ------------------------------------------------------------------ */
/* World constants                                                     */
/* ------------------------------------------------------------------ */
var GY = 148, G = 0.22, BR = 5, RX = 39, RY = 108;
var SKY = [rgb(70, 130, 225), rgb(95, 150, 232), rgb(120, 170, 238), rgb(150, 192, 242), rgb(180, 212, 247), rgb(205, 228, 250)];
var C_HILL = rgb(84, 160, 92), C_GRASS = rgb(70, 170, 60), C_HUD = rgb(40, 28, 14), C_CLOUD = rgb(250, 252, 255);
var C_DOT = rgb(15, 15, 60);
var MATC = [rgb(176, 116, 52), rgb(138, 138, 148), rgb(170, 226, 242)];
var MATD = [rgb(110, 70, 28), rgb(80, 80, 92), rgb(90, 150, 175)];
var HPS = [28, 80, 12], PIGHP = 14, DM = [0.75, 1, 1.4];
var PTS = [100, 200, 60];
var FR = [42, 33, 26];
var BCOL = { R: rgb(220, 40, 40), Y: rgb(245, 210, 40), B: rgb(60, 140, 240), K: rgb(45, 45, 50) };
var HILL = [];
(function () {
  var c, t;
  for (c = 0; c < 80; c++) {
    t = GY - 14 - Math.floor(10 * Math.sin(c * 0.22) + 7 * Math.sin(c * 0.57 + 1.3));
    if (t > GY - 2) t = GY - 2;
    HILL.push(t);
  }
})();
var CLOUDS = [[62, 24], [176, 14], [262, 36]];

var objs = [], birds = [], dots = [], fx = [], rq = [];
var sl = { pull: false, px: RX, py: RY };
var lv = 1, score = 0, LQ = '', qi = 0, pigsLeft = 0, awake = 0, tick = 0, ang = 45, pwr = 60, phase = 0, winTimer = 0;
var supObj = null;

/* ------------------------------------------------------------------ */
/* Background restore (rect based, so it can be clipped exactly)       */
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
function drawObj(o) {
  var x = Math.round(o.x), y = Math.round(o.y), cx, cy, hurt = (o.hp < o.mhp * 0.5);
  if (o.k === 1) {
    cx = x + 6; cy = y + 6;
    fcirc(cx, cy, 6, hurt ? rgb(90, 150, 60) : rgb(110, 200, 70));
    fcirc(cx, cy + 2, 3, rgb(150, 225, 110));
    fillRect(cx - 1, cy + 1, 1, 2, rgb(40, 90, 30)); fillRect(cx + 1, cy + 1, 1, 2, rgb(40, 90, 30));
    fillRect(cx - 4, cy - 3, 2, 2, WHITE); fillRect(cx + 2, cy - 3, 2, 2, WHITE);
    fillRect(cx - 3, cy - 2, 1, 1, BLACK); fillRect(cx + 3, cy - 2, 1, 1, BLACK);
    return;
  }
  fillRect(x, y, o.w, o.h, MATC[o.m]);
  outRect(x, y, o.w, o.h, MATD[o.m]);
  if (o.m === 2) fillRect(x + 1, y + 1, Math.max(1, o.w - 2), 1, WHITE);
  if (hurt) line(x + 1, y + 1, x + o.w - 2, y + o.h - 2, MATD[o.m]);
}
function drawBirdAt(x, y, t) {
  x = Math.round(x); y = Math.round(y);
  fcirc(x, y, BR, BCOL[t] || BCOL.R);
  fillRect(x + 1, y - 2, 2, 2, WHITE); fillRect(x + 2, y - 2, 1, 1, BLACK);
  fillRect(x + 4, y, 3, 2, rgb(250, 150, 20));
  if (t === 'K') fillRect(x - 1, y - 7, 2, 3, rgb(250, 120, 30));
}
function drawBirdSprite(b) {
  var x = Math.round(b.x);
  if (b.y < -BR) { tri(x, 1, x - 3, 6, x + 3, 6, WHITE); return; }
  if (b.y > H + 6) return;
  drawBirdAt(b.x, b.y, b.t);
}
function fxR(f) { return f.big ? (8 + f.t * 5) : (3 + f.t * 2); }
function drawFx(f) {
  var r = fxR(f);
  circ(f.x, f.y, r, f.col); circ(f.x, f.y, Math.max(1, r - 2), f.col);
}
function drawSlingNow() {
  var wd = rgb(96, 60, 24), rb = rgb(50, 28, 12), px = sl.px, py = sl.py;
  fillRect(36, 122, 6, 26, wd);
  fillRect(33, 112, 4, 12, wd); fillRect(41, 112, 4, 12, wd);
  if (sl.pull) {
    line(35, 112, px, py, rb); line(35, 113, px, py + 1, rb);
    line(43, 112, px, py, rb); line(43, 113, px, py + 1, rb);
    drawBirdAt(px, py, LQ.charAt(qi));
  } else {
    line(35, 112, 43, 112, rb); line(35, 113, 43, 113, rb);
  }
}
/* restore bg + everything static/slow inside a rect (birds & fx are drawn by caller) */
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
  if (x < 68 && xe > 2 && ye > 92) drawSlingNow();
  for (i = 0; i < objs.length; i++) {
    o = objs[i];
    if (o.alive && o.x < xe + 1 && o.x + o.w > x - 1 && o.y < ye + 1 && o.y + o.h > y - 1) drawObj(o);
  }
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
  if (rq.length < 24) rq.push([x, y, w, h]);
  else { r = rq[0]; nx = Math.min(x, r[0]); ny = Math.min(y, r[1]); nx2 = Math.max(x + w, r[0] + r[2]); ny2 = Math.max(y + h, r[1] + r[3]); r[0] = nx; r[1] = ny; r[2] = nx2 - nx; r[3] = ny2 - ny; }
}
function collectDirty() {
  var i, o, b, f, rx, ry, cr, mk;
  for (i = 0; i < objs.length; i++) {
    o = objs[i];
    if (!o.alive) { if (o.dr) { addRect(o.lx - 1, o.ly - 1, o.w + 2, o.h + 2); o.dr = false; } continue; }
    rx = Math.round(o.x); ry = Math.round(o.y); cr = (o.hp < o.mhp * 0.5) ? 1 : 0;
    if (!o.dr || rx !== o.lx || ry !== o.ly || cr !== o.lcr) {
      if (o.dr) addRect(o.lx - 1, o.ly - 1, o.w + 2, o.h + 2);
      addRect(rx - 1, ry - 1, o.w + 2, o.h + 2);
      o.lx = rx; o.ly = ry; o.lcr = cr; o.dr = true;
    }
  }
  for (i = 0; i < birds.length; i++) {
    b = birds[i];
    if (!b.alive) {
      if (b.dr) { addRect(b.lx - 8, b.ly - 9, 16, 17); b.dr = false; }
      if (b.mk > -900) { addRect(b.mk - 5, 0, 11, 8); b.mk = -999; }
      continue;
    }
    rx = Math.round(b.x); ry = Math.round(b.y);
    if (!b.dr || rx !== b.lx || ry !== b.ly) {
      if (b.dr) addRect(b.lx - 8, b.ly - 9, 16, 17);
      addRect(rx - 8, ry - 9, 16, 17);
      b.lx = rx; b.ly = ry; b.dr = true;
    }
    mk = (b.y < -BR) ? rx : -999;
    if (mk !== b.mk) {
      if (b.mk > -900) addRect(b.mk - 5, 0, 11, 8);
      if (mk > -900) addRect(mk - 5, 0, 11, 8);
      b.mk = mk;
    }
  }
  for (i = fx.length - 1; i >= 0; i--) {
    f = fx[i]; rx = fxR(f);
    addRect(f.x - rx - 2, f.y - rx - 2, rx * 2 + 5, rx * 2 + 5);
    if (f.dead) fx.splice(i, 1);
  }
}
function renderFrame() {
  var i, any, r;
  collectDirty();
  any = rq.length > 0;
  for (i = 0; i < rq.length; i++) { r = rq[i]; restore(r[0], r[1], r[2], r[3]); }
  rq = [];
  if (any) {
    for (i = 0; i < birds.length; i++) if (birds[i].alive) drawBirdSprite(birds[i]);
    for (i = 0; i < fx.length; i++) drawFx(fx[i]);
  }
}

/* ------------------------------------------------------------------ */
/* HUD (ground strip, each field redrawn only when it changes)         */
/* ------------------------------------------------------------------ */
function hudInfo() {
  fillRect(4, 153, 200, 8, C_HUD);
  txt('LV ' + lv + '  SCORE ' + score + '  PIGS ' + pigsLeft, 6, 153, 1, WHITE);
}
function hudAng() {
  fillRect(4, 162, 84, 8, C_HUD);
  txt((phase === 0 ? '[' : ' ') + 'ANG ' + ang + (phase === 0 ? ']' : ' '), 6, 162, 1, phase === 0 ? GOLD : WHITE);
}
function hudPwr() {
  var c = (phase === 1) ? GOLD : WHITE;
  fillRect(92, 162, 150, 8, C_HUD);
  txt((phase === 1 ? '[' : ' ') + 'PWR ' + pwr + (phase === 1 ? ']' : ' '), 94, 162, 1, c);
  outRect(172, 162, 62, 7, c);
  fillRect(173, 163, Math.floor(60 * pwr / 100), 5, c);
}
function hudBirds() {
  var i, n = 0;
  fillRect(246, 153, 72, 16, C_HUD);
  for (i = qi; i < LQ.length && n < 7; i++, n++) {
    fcirc(253 + n * 9, 161, 3, BCOL[LQ.charAt(i)] || BCOL.R);
  }
}
function hudAll() { hudInfo(); hudAng(); hudPwr(); hudBirds(); }
function renderScene() {
  var i, o, b;
  restore(0, 0, W, GY + 4);
  fillRect(0, GY + 4, W, H - GY - 4, C_HUD);
  hudAll();
  for (i = 0; i < objs.length; i++) { o = objs[i]; o.dr = o.alive; o.lx = Math.round(o.x); o.ly = Math.round(o.y); o.lcr = (o.hp < o.mhp * 0.5) ? 1 : 0; }
  for (i = 0; i < birds.length; i++) {
    b = birds[i];
    if (b.alive) { drawBirdSprite(b); b.dr = true; b.lx = Math.round(b.x); b.ly = Math.round(b.y); }
  }
  for (i = 0; i < fx.length; i++) drawFx(fx[i]);
}

/* ------------------------------------------------------------------ */
/* Level building                                                      */
/* ------------------------------------------------------------------ */
function mk(k, x, y, w, h, m) {
  var hp = (k === 1) ? PIGHP : HPS[m];
  hp = Math.round(hp * DM[cfg.diff]);
  return { k: k, x: x, y: y, w: w, h: h, m: m, hp: hp, mhp: hp, vx: 0, vy: 0, alive: true, dr: false, lx: 0, ly: 0, lcr: 0, cool: 0 };
}
function post(x, by, h, m) { objs.push(mk(0, x, by - h, 6, h, m)); return by - h; }
function beam(x, by, w, m) { objs.push(mk(0, x, by - 6, w, 6, m)); return by - 6; }
function addPig(cx, by) { objs.push(mk(1, cx - 6, by - 12, 12, 12, 3)); pigsLeft++; }
function house(x, by, floors, m0, m1, pigIn, pigTop) {
  var i, y = by, m;
  for (i = 0; i < floors; i++) {
    m = (i % 2 === 0) ? m0 : m1;
    post(x, y, 22, m); post(x + 24, y, 22, m);
    if (i === 0 && pigIn) addPig(x + 15, y);
    y = beam(x - 2, y - 22, 34, m);
  }
  if (pigTop) addPig(x + 15, y);
}
function buildLevel(n) {
  var c, s, xs, f, m0, m1, i, t, PAT = ['R', 'Y', 'B', 'K'];
  objs = []; pigsLeft = 0;
  if (n === 1) { house(200, GY, 1, 0, 0, true, false); LQ = 'RRR'; return; }
  if (n === 2) { house(190, GY, 2, 0, 0, true, true); LQ = 'RRY'; return; }
  if (n === 3) { house(176, GY, 2, 2, 0, true, false); house(242, GY, 1, 0, 0, true, false); LQ = 'RYBR'; return; }
  if (n === 4) { house(172, GY, 2, 0, 1, true, true); house(240, GY, 1, 1, 1, true, false); LQ = 'RYBK'; return; }
  c = 1 + (n >= 6 ? 1 : 0) + (n >= 10 ? 1 : 0);
  xs = (c === 1) ? [210] : ((c === 2) ? [176, 242] : [150, 200, 250]);
  for (s = 0; s < c; s++) {
    f = Math.min(3, 1 + (((n + s) % 3) === 0 ? 1 : 0) + (n >= 8 ? 1 : 0));
    m0 = (n < 6) ? 0 : ((n + s) % 3); m1 = (n + s + 1) % 3;
    house(xs[s], GY, f, m0, m1, true, (n >= 7 && s % 2 === 0));
  }
  t = pigsLeft + 2; if (t < 4) t = 4; if (t > 7) t = 7;
  LQ = '';
  for (i = 0; i < t; i++) LQ += (i === 0) ? 'R' : PAT[(i * 3 + n) % 4];
  if (n >= 8 && LQ.indexOf('K') < 0) LQ = LQ.substring(0, LQ.length - 1) + 'K';
}

/* ------------------------------------------------------------------ */
/* Physics                                                             */
/* ------------------------------------------------------------------ */
function wake() { awake = Math.max(awake, 90); }
function addFx(x, y, col, big) { if (fx.length < 12) fx.push({ x: Math.round(x), y: Math.round(y), t: 0, col: col, big: big, dead: false }); }
function stepFx() { var i; for (i = 0; i < fx.length; i++) { fx[i].t++; if (fx[i].t > 5) fx[i].dead = true; } }
function destroy(o) {
  if (!o.alive) return;
  o.alive = false; o.vx = 0; o.vy = 0;
  addFx(o.x + o.w / 2, o.y + o.h / 2, (o.k === 1) ? rgb(120, 255, 90) : WHITE, false);
  if (o.k === 1) { pigsLeft--; score += 500; sndPop(); hudInfo(); }
  else { score += PTS[o.m]; sndHit(o.m); hudInfo(); }
  wake();
}
function hurt(o, dmg) {
  if (!o.alive) return;
  o.hp -= dmg;
  if (o.hp <= 0) destroy(o); else wake();
}
function surfaceBelow(o) {
  var best = GY, bot = o.y + o.h, i, q;
  supObj = null;
  for (i = 0; i < objs.length; i++) {
    q = objs[i];
    if (q === o || !q.alive) continue;
    if (q.x < o.x + o.w - 2 && q.x + q.w > o.x + 2 && q.y >= bot - 3 && q.y < best) { best = q.y; supObj = q; }
  }
  return best;
}
function landHit(o, imp, sup) {
  var dmg = imp * imp * 2.4 * 0.6;
  hurt(o, dmg * 0.6);
  if (sup && sup.alive) hurt(sup, dmg);
  sndHit(o.m);
  wake();
}
function byBottom(a, b) { return (b.y + b.h) - (a.y + a.h); }
function stepObjects() {
  var n = objs.length, i, j, o, q, sf, mv = false, imp, bot, sp;
  objs.sort(byBottom);
  for (i = 0; i < n; i++) {
    o = objs[i];
    if (!o.alive) continue;
    if (!(o.x === o.x) || !(o.y === o.y)) { o.alive = false; continue; }
    if (o.vx !== 0) {
      o.x += o.vx; o.vx *= 0.86; if (Math.abs(o.vx) < 0.06) o.vx = 0; mv = true;
      if (o.x < 56) { o.x = 56; o.vx = 0; }
      if (o.x + o.w > W - 2) { o.x = W - 2 - o.w; o.vx = 0; }
      if (Math.abs(o.vx) > 0.4 && tick - o.cool > 6) {
        for (j = 0; j < n; j++) {
          q = objs[j];
          if (q !== o && q.alive && q.x < o.x + o.w && q.x + q.w > o.x && q.y < o.y + o.h - 2 && q.y + q.h > o.y + 2) {
            sp = o.vx;
            q.vx += sp * 0.7; hurt(q, sp * sp * 1.6); hurt(o, sp * sp * 0.8);
            o.vx *= 0.35; o.cool = tick; q.cool = tick;
            break;
          }
        }
      }
    }
    if (!o.alive) continue;
    sf = surfaceBelow(o);
    bot = o.y + o.h;
    if (o.vy < 0 || bot < sf - 0.5) {
      o.vy += G; if (o.vy > 7) o.vy = 7;
      o.y += o.vy; mv = true;
      if (o.vy > 0 && o.y + o.h >= sf) {
        imp = o.vy; o.y = sf - o.h; o.vy = 0;
        if (imp > 1.7) landHit(o, imp, supObj);
      }
    } else { o.y = sf - o.h; o.vy = 0; }
  }
  if (mv) awake = Math.max(awake, 12);
}
function bmul(t, o) {
  if (o.k === 1) return (t === 'Y') ? 1.2 : 1;
  if (t === 'Y') return (o.m === 0) ? 2.2 : ((o.m === 1) ? 0.6 : 1.2);
  if (t === 'B') return (o.m === 2) ? 2.4 : ((o.m === 0) ? 0.6 : 0.35);
  if (t === 'K') return 1.2;
  return 1;
}
function hitTest(b, o) {
  var cx = (b.x < o.x) ? o.x : ((b.x > o.x + o.w) ? o.x + o.w : b.x);
  var cy = (b.y < o.y) ? o.y : ((b.y > o.y + o.h) ? o.y + o.h : b.y);
  var dx = b.x - cx, dy = b.y - cy;
  return dx * dx + dy * dy < BR * BR;
}
function explode(b) {
  var i, o, cx, cy, d, f, R = 36, mass;
  if (!b.alive) return;
  b.alive = false; b.fxd = true;
  addFx(b.x, b.y, rgb(255, 170, 40), true);
  sndBoom();
  for (i = 0; i < objs.length; i++) {
    o = objs[i];
    if (!o.alive) continue;
    cx = o.x + o.w / 2; cy = o.y + o.h / 2;
    d = Math.sqrt((cx - b.x) * (cx - b.x) + (cy - b.y) * (cy - b.y));
    if (d < R + o.w / 2) {
      f = 1 - d / (R + 6); if (f < 0.05) f = 0.05;
      mass = Math.max(0.6, o.w * o.h / 150);
      o.vx += (cx - b.x) / (d + 1) * 4 * f / mass;
      if (f > 0.3) o.vy = -1.4 * f;
      hurt(o, 150 * f);
    }
  }
  wake();
}
function birdHit(b, o) {
  var sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy), dmg, cx, cy, dx, dy, d2, dist, nx, ny, vn, mass;
  dmg = sp * sp * 0.9 * bmul(b.t, o);
  o.hp -= dmg;
  wake();
  if (b.t === 'K' && b.fuse === 0) b.fuse = 28;
  if (o.hp <= 0) { destroy(o); b.vx *= 0.78; b.vy *= 0.78; return; }
  sndHit(o.k === 1 ? 3 : o.m);
  mass = Math.max(0.6, o.w * o.h / 150);
  o.vx += b.vx * 0.28 / mass;
  cx = (b.x < o.x) ? o.x : ((b.x > o.x + o.w) ? o.x + o.w : b.x);
  cy = (b.y < o.y) ? o.y : ((b.y > o.y + o.h) ? o.y + o.h : b.y);
  dx = b.x - cx; dy = b.y - cy; d2 = dx * dx + dy * dy;
  if (d2 > 0.0001) { dist = Math.sqrt(d2); nx = dx / dist; ny = dy / dist; }
  else { dist = 0; nx = (b.x < o.x + o.w / 2) ? -1 : 1; ny = 0; }
  b.x += nx * (BR - dist + 0.1); b.y += ny * (BR - dist + 0.1);
  vn = b.vx * nx + b.vy * ny;
  if (vn < 0) { b.vx -= 1.28 * vn * nx; b.vy -= 1.28 * vn * ny; }
  b.vx *= 0.9; b.vy *= 0.95;
}
function stepBird(b) {
  var n, s, i, o, sp;
  b.life++;
  b.vy += G;
  sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
  if (!(sp === sp) || sp > 40) { b.alive = false; return; }
  n = Math.max(1, Math.ceil(sp / 5));
  if (b.fuse > 0) { b.fuse--; if (b.fuse === 0) { explode(b); return; } }
  for (s = 0; s < n && b.alive; s++) {
    b.x += b.vx / n; b.y += b.vy / n;
    if (b.y + BR >= GY) {
      b.y = GY - BR;
      if (b.vy > 1.3) { b.vy = -b.vy * 0.28; sndHit(1); } else b.vy = 0;
      b.vx *= 0.8;
      if (b.t === 'K' && b.fuse === 0) b.fuse = 35;
    }
    for (i = 0; i < objs.length; i++) {
      o = objs[i];
      if (o.alive && hitTest(b, o)) { birdHit(b, o); if (!b.alive) break; }
    }
  }
  if (Math.abs(b.vx) < 0.3 && Math.abs(b.vy) < 0.5) b.still++; else b.still = 0;
  if (b.still > 28) b.alive = false;
  if (b.x > W + 30 || b.x < -30 || b.y > H + 40) b.alive = false;
  if (b.life > 420) b.alive = false;
}
function newBird(t, x, y, vx, vy) {
  return { t: t, x: x, y: y, vx: vx, vy: vy, alive: true, life: 0, still: 0, fuse: 0, used: false, fxd: false, dr: false, lx: 0, ly: 0, mk: -999 };
}
function useAbility() {
  var i, b, a, c, s, kid, sp;
  for (i = 0; i < birds.length; i++) { if (birds[i].alive && !birds[i].used) { b = birds[i]; break; } }
  if (!b) return;
  b.used = true;
  if (b.t === 'Y') {
    b.vx *= 1.75; b.vy *= 1.75;
    sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    if (sp > 12) { b.vx *= 12 / sp; b.vy *= 12 / sp; }
    beep(1500, 10);
  } else if (b.t === 'B') {
    for (a = -1; a <= 1; a += 2) {
      c = Math.cos(a * 0.26); s = Math.sin(a * 0.26);
      kid = newBird('B', b.x, b.y, b.vx * c - b.vy * s, b.vx * s + b.vy * c);
      kid.used = true;
      if (birds.length < 8) birds.push(kid);
    }
    beep(1200, 10);
  } else if (b.t === 'K') {
    explode(b);
  } else { beep(900, 6); }
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
  var w = 176, n = opts.length, h = 30 + (sub ? 12 : 0) + (stars >= 0 ? 14 : 0) + n * 17 + 6;
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
  return 'V=1;S=' + (cfg.sound ? 1 : 0) + ';G=' + cfg.guide + ';D=' + cfg.diff + ';P=' + cfg.speed + ';U=' + prog.unlocked + ';K=' + prog.stars.join(',');
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
  var s = readSave(), p, i, kv, v, ks, u = 1;
  if (!s || s.indexOf('V=1') !== 0) return false;
  p = s.split(';');
  for (i = 0; i < p.length; i++) {
    kv = p[i].split('=');
    if (kv.length < 2) continue;
    if (kv[0] === 'K') {
      ks = kv[1].split(',');
      for (v = 0; v < NL && v < ks.length; v++) { u = parseInt(ks[v], 10); prog.stars[v] = (u >= 0 && u <= 3) ? u : 0; }
      continue;
    }
    v = parseInt(kv[1], 10);
    if (v !== v) continue;
    if (kv[0] === 'S') cfg.sound = (v !== 0);
    else if (kv[0] === 'G' && v >= 0 && v <= 2) cfg.guide = v;
    else if (kv[0] === 'D' && v >= 0 && v <= 2) cfg.diff = v;
    else if (kv[0] === 'P' && v >= 0 && v <= 2) cfg.speed = v;
    else if (kv[0] === 'U') prog.unlocked = cl(v, 1, NL);
  }
  prog.dirty = false;
  return true;
}

/* ------------------------------------------------------------------ */
/* Aiming                                                              */
/* ------------------------------------------------------------------ */
function aimGeom() {
  var a = ang * 0.0174533, d = 6 + pwr * 0.2;
  sl.px = RX - Math.cos(a) * d; sl.py = RY + Math.sin(a) * d;
}
function calcDots() {
  var out = [], a = ang * 0.0174533, v = pwr * 0.095, x = RX, y = RY, vx = v * Math.cos(a), vy = -v * Math.sin(a), t, mx;
  if (cfg.guide === 0) return out;
  mx = (cfg.guide === 1) ? 6 : 16;
  for (t = 1; t < 90 && out.length < mx; t++) {
    vy += G; x += vx; y += vy;
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
function updateAim() {
  var nd = calcDots(), od = dots, i;
  aimGeom();
  dots = nd;
  for (i = 0; i < od.length; i++) if (!dotIn(nd, od[i])) restore(od[i][0] - 1, od[i][1] - 1, 4, 4);
  restore(4, 94, 64, 54);
  for (i = 0; i < nd.length; i++) if (!dotIn(od, nd[i])) fillRect(nd[i][0], nd[i][1], 2, 2, C_DOT);
}
function aimLoop() {
  var k, t, m, lastT = 0, d;
  settle();
  while (true) {
    k = waitKey();
    if (k === 'R' || k === 'L') {
      t = ms(); m = (t - lastT < 150) ? 2 : 1; lastT = t; d = (k === 'R') ? 1 : -1;
      if (phase === 0) { ang = cl(ang + d * m, 5, 85); hudAng(); }
      else { pwr = cl(pwr + d * m * 2, 20, 100); hudPwr(); }
      updateAim();
    } else if (k === 'O') {
      sndSel();
      if (phase === 0) { phase = 1; hudAng(); hudPwr(); } else return 'fire';
    } else if (k === 'B') {
      if (phase === 1) { phase = 0; hudAng(); hudPwr(); } else return 'pause';
    }
  }
}
function fire() {
  var i, a = ang * 0.0174533, v = pwr * 0.095, od = dots;
  dots = []; sl.pull = false;
  for (i = 0; i < od.length; i++) restore(od[i][0] - 1, od[i][1] - 1, 4, 4);
  restore(4, 94, 64, 54);
  birds = [newBird(LQ.charAt(qi), RX, RY, v * Math.cos(a), -v * Math.sin(a))];
  qi++;
  hudBirds();
  sndLaunch();
}

/* ------------------------------------------------------------------ */
/* Level flow                                                          */
/* ------------------------------------------------------------------ */
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
function flightLoop() {
  var t0, k, quiet = 0, i, alive, guard = 0, r;
  winTimer = 0;
  settle();
  while (true) {
    t0 = ms();
    tick++; guard++;
    alive = false;
    for (i = 0; i < birds.length; i++) {
      if (birds[i].alive) {
        stepBird(birds[i]);
        if (birds[i].alive) alive = true;
        else if (!birds[i].fxd) { birds[i].fxd = true; addFx(birds[i].x, birds[i].y, WHITE, false); }
      }
    }
    if (awake > 0) { stepObjects(); awake--; }
    stepFx();
    if (pigsLeft <= 0 && winTimer === 0) winTimer = 45;
    if (winTimer > 0) { winTimer--; if (winTimer === 0) { renderFrame(); return 'done'; } }
    renderFrame();
    k = poll();
    if (k === 'O') useAbility();
    else if (k === 'B') {
      r = pauseMenu();
      if (r !== 'resume') return r;
      settle();
    }
    if (!alive && awake === 0 && fx.length === 0) { quiet++; if (quiet > 20) break; } else quiet = 0;
    if (guard > 900) break;
    sleep(Math.max(1, FR[cfg.speed] - (ms() - t0)));
  }
  renderFrame();
  return 'done';
}
function startLevel(n) {
  buildLevel(n);
  lv = n; score = 0; qi = 0; birds = []; dots = []; fx = []; rq = []; awake = 0; tick = 0;
  ang = 45; pwr = 60; phase = 0; sl.pull = false;
  renderScene();
}
function runLevel() {
  var r, p;
  while (true) {
    if (pigsLeft <= 0) return 'win';
    if (qi >= LQ.length) return 'lose';
    sl.pull = true; phase = 0; dots = [];
    aimGeom(); hudAll(); updateAim();
    r = aimLoop();
    if (r === 'pause') {
      p = pauseMenu();
      if (p === 'resume') { renderScene(); continue; }
      return p;
    }
    fire();
    r = flightLoop();
    if (r === 'restart' || r === 'menu') return r;
  }
}
function playLevel(n) {
  var r, st, bl, c;
  while (true) {
    startLevel(n);
    r = runLevel();
    if (r === 'menu') return;
    if (r === 'restart') continue;
    if (r === 'win') {
      bl = LQ.length - qi; score += bl * 300; hudInfo();
      st = (bl >= 2) ? 3 : ((bl === 1) ? 2 : 1);
      if (st > prog.stars[n - 1]) { prog.stars[n - 1] = st; prog.dirty = true; }
      if (n < NL && n + 1 > prog.unlocked) { prog.unlocked = n + 1; prog.dirty = true; }
      sndWin();
      c = listMenu('LEVEL CLEARED!', 'SCORE ' + score, ['NEXT LEVEL', 'RETRY', 'MENU'], st);
      if (c === 0) { if (n >= NL) { toast('ALL LEVELS CLEARED!', GOLD); return; } n++; continue; }
      if (c === 1) continue;
      return;
    }
    sndLose();
    c = listMenu('LEVEL FAILED', 'SCORE ' + score, ['RETRY', 'MENU'], -1);
    if (c === 0) continue;
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
function thickLine(x1, y1, x2, y2, t, c) {
  var i;
  for (i = 0; i < t; i++) line(x1, y1 + i, x2, y2 + i, c);
}
/* four little corner brackets = the classic "anger vein" mark */
function angerMark(x, y, s, c) {
  fillRect(x - s, y - s, 4, 2, c); fillRect(x - s, y - s, 2, 4, c);
  fillRect(x + s - 3, y - s, 4, 2, c); fillRect(x + s - 1, y - s, 2, 4, c);
  fillRect(x - s, y + s - 1, 4, 2, c); fillRect(x - s, y + s - 3, 2, 4, c);
  fillRect(x + s - 3, y + s - 1, 4, 2, c); fillRect(x + s - 1, y + s - 3, 2, 4, c);
}
function steam(x, y, r) {
  var c = rgb(240, 240, 240);
  fcirc(x, y, r, c);
  fcirc(x - r, y - r - 1, Math.max(1, r - 1), c);
  fcirc(x + 1, y - r * 2 - 2, Math.max(1, r - 2), c);
}
/* one furious eye: white, small pupil, body-colour lid cutting it on a slant.
   dir = +1 when the inner corner is on the right, -1 when on the left */
function madEye(ex, ey, e, dir, lidCol) {
  fcirc(ex, ey, e, WHITE);
  fcirc(ex + dir, ey + 2, Math.max(1, Math.floor(e / 2.5)), BLACK);
  if (dir > 0) tri(ex - e - 1, ey - e - 1, ex + e + 1, ey - e - 1, ex + e + 1, ey + 1, lidCol);
  else tri(ex + e + 1, ey - e - 1, ex - e - 1, ey - e - 1, ex - e - 1, ey + 1, lidCol);
}
function bigBird(cx, cy, r) {
  var e = Math.max(3, Math.floor(r * 0.24));
  var ex1 = cx + 1, ex2 = cx + Math.floor(r * 0.5), ey = cy - Math.floor(r * 0.2);
  var dk = rgb(140, 18, 18), bx = cx + Math.floor(r * 0.25);
  /* steam blowing off the top */
  steam(cx - Math.floor(r * 0.9), cy - r - 4, 3);
  steam(cx + Math.floor(r * 0.7), cy - r - 6, 3);
  /* spiky crest */
  tri(cx - 6, cy - r + 4, cx - 12, cy - r - 8, cx, cy - r + 1, dk);
  tri(cx - 2, cy - r + 2, cx - 3, cy - r - 11, cx + 6, cy - r + 3, dk);
  tri(cx + 3, cy - r + 3, cx + 9, cy - r - 6, cx + 12, cy - r + 6, dk);
  /* body + belly */
  fcirc(cx, cy, r, BCOL.R);
  fcirc(cx, cy + Math.floor(r * 0.5), Math.floor(r * 0.5), rgb(250, 205, 170));
  /* glaring eyes with heavy lids */
  madEye(ex1, ey, e, 1, BCOL.R);
  madEye(ex2, ey, e, -1, BCOL.R);
  /* thick black V brows */
  thickLine(ex1 - e - 3, ey - e - 4, ex1 + e + 1, ey - 1, 4, BLACK);
  thickLine(ex2 + e + 2, ey - e - 4, ex2 - e - 1, ey - 1, 4, BLACK);
  /* beak: upper + lower, snarling */
  tri(bx, cy + 1, cx + Math.floor(r * 0.95), cy + Math.floor(r * 0.14), bx, cy + Math.floor(r * 0.34), rgb(250, 160, 20));
  tri(bx, cy + Math.floor(r * 0.34), cx + Math.floor(r * 0.8), cy + Math.floor(r * 0.28), bx + 1, cy + Math.floor(r * 0.62), rgb(215, 115, 10));
  line(bx, cy + Math.floor(r * 0.34), cx + Math.floor(r * 0.8), cy + Math.floor(r * 0.26), BLACK);
  /* bared teeth along the mouth line */
  fillRect(bx + 3, cy + Math.floor(r * 0.34) + 1, 2, 3, WHITE);
  fillRect(bx + 8, cy + Math.floor(r * 0.34), 2, 3, WHITE);
  /* anger vein */
  angerMark(cx + Math.floor(r * 0.95), cy - Math.floor(r * 0.95), 5, rgb(255, 255, 255));
}
function bigPig(cx, cy, r) {
  var e = Math.max(3, Math.floor(r * 0.23));
  var exL = cx - Math.floor(r * 0.42), exR = cx + Math.floor(r * 0.42), ey = cy - Math.floor(r * 0.22);
  var body = rgb(110, 200, 70), sy = cy + Math.floor(r * 0.4), sr = Math.floor(r * 0.4);
  /* steam out of both ears */
  steam(cx - Math.floor(r * 0.8), cy - Math.floor(r * 1.15), 3);
  steam(cx + Math.floor(r * 0.8), cy - Math.floor(r * 1.15), 3);
  /* ears (pinned back) + body */
  fcirc(cx - Math.floor(r * 0.65), cy - Math.floor(r * 0.75), Math.floor(r * 0.3), rgb(90, 170, 60));
  fcirc(cx + Math.floor(r * 0.65), cy - Math.floor(r * 0.75), Math.floor(r * 0.3), rgb(90, 170, 60));
  fcirc(cx, cy, r, body);
  /* glaring eyes with heavy lids */
  madEye(exL, ey, e, 1, body);
  madEye(exR, ey, e, -1, body);
  /* thick black V brows */
  thickLine(exL - e - 3, ey - e - 4, exL + e + 1, ey - 1, 4, BLACK);
  thickLine(exR + e + 2, ey - e - 4, exR - e - 1, ey - 1, 4, BLACK);
  /* snout, nostrils flared, and tusks */
  fcirc(cx, sy, sr, rgb(150, 225, 110));
  fillRect(cx - Math.floor(r * 0.2) - 1, sy - 2, 3, 5, rgb(40, 90, 30));
  fillRect(cx + Math.floor(r * 0.2) - 1, sy - 2, 3, 5, rgb(40, 90, 30));
  tri(cx - Math.floor(r * 0.45), sy + sr + 2, cx - Math.floor(r * 0.22), sy + sr + 2, cx - Math.floor(r * 0.45), sy + 1, WHITE);
  tri(cx + Math.floor(r * 0.45), sy + sr + 2, cx + Math.floor(r * 0.22), sy + sr + 2, cx + Math.floor(r * 0.45), sy + 1, WHITE);
  /* anger vein */
  angerMark(cx - Math.floor(r * 0.1), cy - r - 4, 5, rgb(255, 60, 60));
}
var MENU = ['PLAY', 'LEVELS', 'SETUP', 'SAVE', 'LOAD', 'EXIT'];
function menuRow(i, on) {
  var t = th(), x = 104, w = 112, y = 44 + i * 15, h = 13;
  hiBox(x, y, w, h, on);
  ctxt(MENU[i], x + w / 2, y + 3, 1, on ? t.dark : WHITE);
  hiArrows(x, y, w, h, on);
}
function menuRender(sel) {
  var i;
  bgPlain();
  stxt('PISSED OFF BIRDS', W / 2, 8, 2, GOLD);
  stxt('by da cbm', W / 2, 27, 1, WHITE);
  bigBird(48, 100, 22);
  bigPig(272, 100, 22);
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
    else if (k === 'B') { return 5; }
  }
}
function lvCell(i, on) {
  var c = i % 5, r = Math.floor(i / 5), x = 14 + c * 60, y = 34 + r * 36, w = 56, h = 32, t = th(), locked = (i + 1 > prog.unlocked), j;
  if (locked) { fillRect(x, y, w, h, rgb(70, 70, 70)); outRect(x, y, w, h, rgb(110, 110, 110)); ctxt('LOCK', x + w / 2, y + 12, 1, rgb(160, 160, 160)); return; }
  hiBox(x, y, w, h, on);
  ctxt(String(i + 1), x + w / 2, y + 4, 2, on ? t.dark : WHITE);
  for (j = 0; j < 3; j++) fillRect(x + w / 2 - 12 + j * 9, y + 22, 6, 6, j < prog.stars[i] ? GOLD : rgb(90, 70, 40));
}
function lvRender(sel) {
  var i;
  bgPlain();
  stxt('SELECT LEVEL', W / 2, 10, 2, GOLD);
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
var SET_ROWS = ['SOUND', 'AIM GUIDE', 'DIFFICULTY', 'GAME SPEED', 'RESET PROGRESS', 'BACK'];
function setVal(i) {
  if (i === 0) return cfg.sound ? 'ON' : 'OFF';
  if (i === 1) return ['OFF', 'SHORT', 'LONG'][cfg.guide];
  if (i === 2) return ['EASY', 'NORMAL', 'HARD'][cfg.diff];
  if (i === 3) return ['SLOW', 'NORMAL', 'FAST'][cfg.speed];
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
      else if (sel === 1) { cfg.guide = (cfg.guide + 1) % 3; setRow(1, true); }
      else if (sel === 2) { cfg.diff = (cfg.diff + 1) % 3; setRow(2, true); }
      else if (sel === 3) { cfg.speed = (cfg.speed + 1) % 3; setRow(3, true); }
      else if (sel === 4) {
        if (askYesNo('RESET PROGRESS?', 'Levels and stars are cleared')) {
          prog.unlocked = 1; for (i = 0; i < NL; i++) prog.stars[i] = 0; prog.dirty = true;
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
      else if (c === 2) { setup(); }
      else if (c === 3) { toast(saveGame() ? 'GAME SAVED' : 'SAVE FAILED', WHITE); }
      else if (c === 4) { toast(loadGame() ? 'GAME LOADED' : 'NO SAVE FOUND', WHITE); }
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
