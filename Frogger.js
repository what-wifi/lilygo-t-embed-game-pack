/*
 * FROGGER  v1.0   by da cbm
 * Cross-the-street game for Bruce firmware
 * Target: LilyGO T-Embed CC1101 (320x170, rotary encoder)
 *
 * Hop your frog across 9 lanes of traffic and into the 5 ponds at the top.
 * Fill all 5 ponds to clear the level.  Traffic gets faster every level.
 *
 * Controls
 *   Game:   turn = hop left / right,  click = hop forward
 *           Back = hop backward (short delay),  double-tap Back = pause menu
 *   Menus:  turn = move, click = select, Back = back
 *
 * Plain ES5 (no arrow functions, let/const, template strings or nested
 * functions) so it runs on the Bruce interpreter.
 *
 * Stability notes
 *  - Background is drawn once. Per frame only the vehicles that moved are
 *    erased and redrawn (no full-screen clear while playing = no flicker).
 *  - Fixed 33 ms physics tick with catch-up, so traffic speed stays the same
 *    even if drawing is slow.
 *  - Frog moves in clean grid hops; input is debounced like CastleWarz.
 *  - Storage is touched ONLY when you pick SAVE or LOAD.
 */
(function () {

var SAVE_PATH = '/frogger.sav';

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
var UI = { trim: rgb(110, 214, 84), dark: rgb(16, 32, 24) };

/* settings (changed in SETUP) */
var cfg = { sound: true, diff: 1, lives: 1 };
var LIVESV = [2, 3, 4, 5];
var DMUL = [0.8, 1.0, 1.25];
var TMUL = [1.25, 1.0, 0.85];
/* progress (written only by SAVE) */
var prog = { hi: 0, dirty: false };

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
function txt(s, x, y, sz, c) {
  try { D.setTextSize(sz); D.setTextColor(c); D.drawString(String(s), Math.floor(x), Math.floor(y)); } catch (e) {}
}
function tw(s, sz) { return String(s).length * 6 * sz; }
function ctxt(s, cx, y, sz, c) { txt(s, cx - tw(s, sz) / 2, y, sz, c); }
function rtxt(s, rx, y, sz, c) { txt(s, rx - tw(s, sz), y, sz, c); }
function stxt(s, cx, y, sz, c) { var o = sz >= 3 ? 2 : 1; ctxt(s, cx + o, y + o, sz, BLACK); ctxt(s, cx, y, sz, c); }

/* ------------------------------------------------------------------ */
/* Input: debounced, direction filtered, always drained                */
/* ------------------------------------------------------------------ */
var ROT_GAP = 55, REV_GAP = 140, BTN_MENU = 240, BTN_GAME = 180;
var BTN_GAP = BTN_MENU;
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

/* Selectable item: plain rectangles only, so highlighting always shows. */
function hiBox(x, y, w, h, sel) {
  fillRect(x, y, w, h, sel ? UI.trim : UI.dark);
  outRect(x, y, w, h, sel ? WHITE : UI.trim);
  if (sel) outRect(x + 2, y + 2, w - 4, h - 4, UI.dark);
}
function hiArrows(x, y, w, h, sel) {
  var ty = y + Math.floor((h - 8) / 2);
  if (sel) { txt('>', x + 6, ty, 1, UI.dark); txt('<', x + w - 12, ty, 1, UI.dark); }
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
function sndErr() { beep(220, 30); }
function sndHop() { beep(950, 5); }
function sndBay() { beep(1250, 40); }
function sndSplat() { beep(150, 70); }
function sndWin() { tune([[784, 70], [988, 70], [1175, 70], [1568, 160]]); }
function sndLose() { tune([[330, 120], [262, 120], [196, 240]]); }

/* ------------------------------------------------------------------ */
/* Constants, colors and data                                          */
/* ------------------------------------------------------------------ */
var RH = 13, CW = 16, NCOL = 20, NROW = 12, HUDY = 156, PAD = 44, LEN = W + 2 * PAD;
var BAYS = [2, 6, 10, 14, 18];
var ROADROWS = [1, 2, 3, 4, 5, 7, 8, 9, 10];

var C_ROAD = rgb(54, 56, 68), C_LINE = rgb(236, 206, 84), C_EDGE = rgb(222, 224, 230);
var C_SW = rgb(176, 170, 180), C_SWJ = rgb(140, 134, 150);
var C_GR = rgb(66, 156, 74), C_GR2 = rgb(48, 124, 60);
var C_HEDGE = rgb(30, 100, 50), C_HEDGE2 = rgb(56, 140, 70);
var C_WATER = rgb(38, 98, 170), C_WATERD = rgb(20, 56, 110), C_RIP = rgb(90, 160, 224), C_PAD = rgb(60, 170, 80);
var C_HUD = rgb(20, 20, 30);
var C_F1 = rgb(80, 214, 80), C_F2 = rgb(32, 140, 52), C_F3 = rgb(196, 244, 128);
var C_TIRE = rgb(16, 16, 20), C_GLASS = rgb(150, 214, 240), C_HEAD = rgb(255, 244, 170), C_TAIL = rgb(230, 40, 40);
var C_SPLAT = rgb(190, 30, 34), C_SPLAT2 = rgb(120, 16, 24);
var FLW = [rgb(255, 120, 170), rgb(255, 230, 90), rgb(250, 250, 250), rgb(190, 130, 255)];
var VC = [rgb(214, 48, 52), rgb(52, 112, 232), rgb(240, 200, 50), rgb(240, 132, 40), rgb(150, 72, 204), rgb(40, 182, 170), rgb(236, 236, 242), rgb(232, 92, 164)];
var VC2 = [rgb(140, 28, 34), rgb(30, 70, 160), rgb(176, 140, 28), rgb(176, 86, 20), rgb(100, 44, 150), rgb(24, 124, 116), rgb(176, 178, 190), rgb(160, 56, 112)];
var TRL = [rgb(228, 228, 234), rgb(190, 210, 230), rgb(240, 226, 190)];

/* vehicle types: 0 bike, 1 car, 2 bus, 3 truck */
var SPD = [2.4, 1.5, 0.85, 0.95];
var CNT = [3, 3, 2, 2];
var CAP = [5, 5, 4, 4];
var VW = [10, 18, 40, 34];
var LT = [3, 1, 0, 2, 1, 1, 0, 3, 1];
var TICK = 33, FRAME = 22;

var lanes = [], rowLane = [], bayFull = [false, false, false, false, false];
var lv = 1, lives = 3, score = 0, nextLife = 2500, filled = 0, tmr = 0, tmax = 900;
var evt = '', deadT = 0, ft = false, seed = 1, maxRow = 11;
var frog = { col: 10, row: 11, down: false, hopT: 0, dead: false, dirty: true, dc: -1, dr: -1 };
var hc = { lv: -1, lives: -1, score: -1, bw: -1, bc: -1 };

function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }

/* ------------------------------------------------------------------ */
/* Background                                                          */
/* ------------------------------------------------------------------ */
function roadBg(r, x, w) {
  var y0 = r * RH, k, k0, k1, sx, ex;
  if (x < 0) { w += x; x = 0; }
  if (x + w > W) w = W - x;
  if (w <= 0) return;
  fillRect(x, y0, w, RH, C_ROAD);
  if (r === 1 || r === 7) fillRect(x, y0, w, 2, C_EDGE);
  else {
    k0 = Math.floor(x / 16); k1 = Math.floor((x + w - 1) / 16);
    for (k = k0; k <= k1; k++) {
      sx = Math.max(k * 16 + 3, x); ex = Math.min(k * 16 + 13, x + w);
      if (ex > sx) fillRect(sx, y0, ex - sx, 2, C_LINE);
    }
  }
  if (r === 5 || r === 10) fillRect(x, y0 + 11, w, 2, C_EDGE);
}
function walkBg(r, x, w) {
  var y0 = r * RH, k, k0, k1;
  fillRect(x, y0, w, RH, C_SW);
  fillRect(x, y0 + 6, w, 1, C_SWJ);
  k0 = Math.floor(x / CW); k1 = Math.floor((x + w - 1) / CW);
  for (k = k0; k <= k1; k++) fillRect(k * CW, y0, 1, RH, C_SWJ);
  fillRect(x, y0, w, 1, rgb(196, 190, 200));
}
function grassBg(r, x, w) {
  var y0 = r * RH, k, k0, k1, fx, fy;
  fillRect(x, y0, w, RH, C_GR);
  fillRect(x, y0 + 10, w, 3, C_GR2);
  k0 = Math.floor(x / CW); k1 = Math.floor((x + w - 1) / CW);
  for (k = k0; k <= k1; k++) {
    fx = k * CW + 3 + ((k * 7) % 9); fy = y0 + 2 + ((k * 5) % 6);
    fillRect(fx, fy, 2, 2, FLW[k % 4]);
    fillRect(k * CW + 2 + ((k * 11) % 11), y0 + 8, 1, 2, C_GR2);
  }
}
function drawBay(i) {
  var bx = BAYS[i] * CW;
  fillRect(bx, 0, CW, RH, C_WATER);
  outRect(bx, 0, CW, RH, C_WATERD);
  fillRect(bx + 3, 3, 4, 1, C_RIP); fillRect(bx + 9, 9, 4, 1, C_RIP);
  if (bayFull[i]) {
    fillRect(bx + 1, 8, 14, 4, C_PAD);
    drawFrogS(bx + 2, 1, 1, 0, false);
  }
}
function drawTop() {
  var k, i;
  fillRect(0, 0, W, RH, C_HEDGE);
  for (k = 0; k < 40; k++) fillRect(k * 8 + ((k * 5) % 5), 2 + ((k * 3) % 7), 3, 2, C_HEDGE2);
  fillRect(0, RH - 2, W, 2, rgb(22, 78, 40));
  for (i = 0; i < 5; i++) drawBay(i);
}
function rowBg(r, x, w) {
  if (r === 0) return;
  if (r === 6) grassBg(r, x, w);
  else if (r === 11) walkBg(r, x, w);
  else roadBg(r, x, w);
}
function cellBg(r, c) { rowBg(r, c * CW, CW); }
function drawBackground() {
  var r;
  drawTop();
  for (r = 1; r <= 11; r++) rowBg(r, 0, W);
}

/* ------------------------------------------------------------------ */
/* Sprites                                                             */
/* ------------------------------------------------------------------ */
function fpr(px, py, s, ox, oy, w, h, c, dn) {
  var yy = dn ? (11 - oy - h) : oy;
  fillRect(px + ox * s, py + yy * s, w * s, h * s, c);
}
function drawFrogS(px, py, s, pose, dn) {
  if (pose === 1) {
    fpr(px, py, s, 1, 7, 2, 4, C_F2, dn); fpr(px, py, s, 9, 7, 2, 4, C_F2, dn);
    fpr(px, py, s, 0, 10, 3, 1, C_F2, dn); fpr(px, py, s, 9, 10, 3, 1, C_F2, dn);
    fpr(px, py, s, 3, 2, 6, 7, C_F1, dn);
    fpr(px, py, s, 4, 4, 4, 4, C_F3, dn);
    fpr(px, py, s, 1, 1, 2, 3, C_F2, dn); fpr(px, py, s, 9, 1, 2, 3, C_F2, dn);
  } else {
    fpr(px, py, s, 0, 6, 3, 3, C_F2, dn); fpr(px, py, s, 9, 6, 3, 3, C_F2, dn);
    fpr(px, py, s, 0, 9, 4, 2, C_F2, dn); fpr(px, py, s, 8, 9, 4, 2, C_F2, dn);
    fpr(px, py, s, 2, 3, 8, 7, C_F1, dn);
    fpr(px, py, s, 4, 5, 4, 4, C_F3, dn);
    fpr(px, py, s, 0, 3, 2, 3, C_F2, dn); fpr(px, py, s, 10, 3, 2, 3, C_F2, dn);
  }
  fpr(px, py, s, 3, 1, 6, 3, C_F1, dn);
  fpr(px, py, s, 2, 0, 3, 3, WHITE, dn); fpr(px, py, s, 7, 0, 3, 3, WHITE, dn);
  fpr(px, py, s, 3, 0, 2, 2, BLACK, dn); fpr(px, py, s, 7, 0, 2, 2, BLACK, dn);
}
function drawSplat(px, py) {
  fillRect(px + 1, py + 4, 10, 5, C_SPLAT);
  fillRect(px + 3, py + 2, 6, 9, C_SPLAT);
  fillRect(px, py + 6, 12, 2, C_SPLAT2);
  fillRect(px + 3, py + 4, 2, 1, BLACK); fillRect(px + 7, py + 4, 2, 1, BLACK);
  fillRect(px + 5, py + 8, 2, 1, C_SPLAT2);
}
function drawFrogNow() {
  var px = frog.col * CW + 2, py = frog.row * RH + 1;
  if (frog.dead) drawSplat(px, py);
  else drawFrogS(px, py, 1, frog.hopT > 0 ? 1 : 0, frog.down);
}
/* vehicle part, mirrored automatically for direction */
function vr(v, ix, off, y, wd, ht, col) {
  fillRect(v.d > 0 ? ix + off : ix + v.w - off - wd, y, wd, ht, col);
}
function drawVeh(v, ix, y) {
  var t = v.t;
  if (t === 1) {
    vr(v, ix, 4, y, 10, 3, v.c2);
    vr(v, ix, 5, y + 1, 8, 2, C_GLASS);
    vr(v, ix, 0, y + 3, 18, 4, v.c);
    vr(v, ix, 16, y + 3, 2, 2, C_HEAD);
    vr(v, ix, 0, y + 3, 1, 2, C_TAIL);
    vr(v, ix, 2, y + 6, 4, 3, C_TIRE);
    vr(v, ix, 12, y + 6, 4, 3, C_TIRE);
  } else if (t === 0) {
    vr(v, ix, 1, y + 6, 8, 1, v.c);
    vr(v, ix, 0, y + 5, 3, 3, C_TIRE);
    vr(v, ix, 7, y + 5, 3, 3, C_TIRE);
    vr(v, ix, 3, y + 2, 4, 4, v.c2);
    vr(v, ix, 4, y, 3, 2, WHITE);
    vr(v, ix, 9, y + 5, 1, 1, C_HEAD);
  } else if (t === 3) {
    vr(v, ix, 0, y, 23, 7, v.c);
    vr(v, ix, 0, y + 3, 23, 1, v.c2);
    vr(v, ix, 24, y + 2, 10, 6, v.c2);
    vr(v, ix, 29, y + 3, 4, 2, C_GLASS);
    vr(v, ix, 2, y + 6, 4, 3, C_TIRE);
    vr(v, ix, 8, y + 6, 4, 3, C_TIRE);
    vr(v, ix, 26, y + 6, 4, 3, C_TIRE);
    vr(v, ix, 32, y + 6, 2, 2, C_HEAD);
  } else {
    vr(v, ix, 0, y, 40, 8, v.c);
    vr(v, ix, 3, y + 1, 33, 3, C_GLASS);
    vr(v, ix, 0, y + 5, 40, 1, v.c2);
    vr(v, ix, 5, y + 6, 5, 3, C_TIRE);
    vr(v, ix, 28, y + 6, 5, 3, C_TIRE);
    vr(v, ix, 38, y + 4, 2, 2, C_HEAD);
    vr(v, ix, 0, y + 4, 1, 2, C_TAIL);
  }
}

/* ------------------------------------------------------------------ */
/* Level setup                                                         */
/* ------------------------------------------------------------------ */
function buildLevel(n) {
  var i, j, t, L, cnt, sp, spc, jit, extra, lm, v, ci;
  lanes = []; rowLane = [];
  for (i = 0; i < NROW; i++) rowLane.push(-1);
  seed = n * 977 + 13;
  extra = (n >= 3 ? 1 : 0) + (n >= 6 ? 1 : 0) + (n >= 9 ? 1 : 0);
  lm = Math.min(1.7, 1 + 0.07 * (n - 1));
  for (i = 0; i < ROADROWS.length; i++) {
    t = LT[i];
    L = { row: ROADROWS[i], d: (i % 2 === 0) ? 1 : -1, t: t, sp: 0, vs: [] };
    sp = SPD[t] * (0.9 + 0.25 * rnd()) * lm * DMUL[cfg.diff];
    if (sp > 4.2) sp = 4.2;
    L.sp = sp;
    cnt = Math.min(CAP[t], CNT[t] + extra);
    spc = LEN / cnt;
    jit = Math.min(14, Math.floor((spc - VW[t] - 30) / 2));
    if (jit < 0) jit = 0;
    for (j = 0; j < cnt; j++) {
      ci = (i * 3 + j * 5 + n) % VC.length;
      v = { x: -PAD + j * spc + (rnd() * 2 - 1) * jit, w: VW[t], t: t, d: L.d, c: VC[ci], c2: VC2[ci], lx: -99999 };
      if (t === 3) { v.c = TRL[(i + j) % TRL.length]; v.c2 = VC[ci]; }
      L.vs.push(v);
    }
    lanes.push(L);
    rowLane[L.row] = lanes.length - 1;
  }
}
function bayAt(c) {
  var i;
  for (i = 0; i < BAYS.length; i++) if (BAYS[i] === c) return i;
  return -1;
}
function addScore(n) {
  score += n;
  if (score >= nextLife) {
    nextLife += 2500;
    if (lives < 5) { lives++; beep(1400, 60); }
  }
}
function respawn() {
  frog.col = 10; frog.row = 11; frog.down = false; frog.hopT = 0; frog.dead = false; frog.dirty = true;
  tmr = tmax; maxRow = 11; deadT = 0;
  hc.bw = -1;
}
function kill() {
  if (frog.dead) return;
  frog.dead = true; frog.dirty = true; deadT = 22;
  sndSplat();
}
function hop(dc, dr) {
  var nc, nr, i;
  if (frog.dead || evt !== '') return;
  nc = frog.col + dc; nr = frog.row + dr;
  if (nc < 0 || nc >= NCOL || nr >= NROW) { sndErr(); return; }
  if (nr === 0) {
    i = bayAt(nc);
    if (i < 0 || bayFull[i]) { sndErr(); return; }
    bayFull[i] = true; filled++; drawBay(i);
    addScore(50 + Math.floor(tmr / 12));
    sndBay();
    if (filled >= 5) evt = 'clear'; else respawn();
    return;
  }
  frog.col = nc; frog.row = nr; frog.hopT = 3; frog.dirty = true;
  if (dr > 0) frog.down = true; else if (dr < 0) frog.down = false;
  if (nr < maxRow) { maxRow = nr; addScore(10); }
  sndHop();
}

/* ------------------------------------------------------------------ */
/* Simulation (fixed tick)                                             */
/* ------------------------------------------------------------------ */
function simTick() {
  var i, j, L, v, fl, fr, li;
  for (i = 0; i < lanes.length; i++) {
    L = lanes[i];
    for (j = 0; j < L.vs.length; j++) {
      v = L.vs[j];
      v.x += L.sp * L.d;
      if (L.d > 0) { if (v.x >= W + PAD) v.x -= LEN; }
      else { if (v.x <= -PAD) v.x += LEN; }
    }
  }
  if (frog.hopT > 0) { frog.hopT--; frog.dirty = true; }
  if (frog.dead || evt !== '') return;
  tmr--;
  if (tmr <= 0) { tmr = 0; kill(); return; }
  li = rowLane[frog.row];
  if (li >= 0) {
    L = lanes[li];
    fl = frog.col * CW + 3; fr = frog.col * CW + 13;
    for (j = 0; j < L.vs.length; j++) {
      v = L.vs[j];
      if (fr > v.x + 1 && fl < v.x + v.w - 1) { kill(); return; }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Rendering (dirty rectangles only)                                   */
/* ------------------------------------------------------------------ */
function vis(x, w) { return x < W && x + w > 0; }
function drawVehicles(forceRow) {
  var i, j, L, v, ix, ox, w, y, lo, hi, fc0 = frog.col * CW, df;
  for (i = 0; i < lanes.length; i++) {
    L = lanes[i]; y = L.row * RH + 2;
    for (j = 0; j < L.vs.length; j++) {
      v = L.vs[j]; ix = Math.round(v.x); ox = v.lx; w = v.w;
      if (ix === ox && L.row !== forceRow) continue;
      if (ix !== ox && vis(ox, w)) {
        df = ix > ox ? ix - ox : ox - ix;
        if (vis(ix, w) && df < w) { lo = ix < ox ? ix : ox; hi = (ix > ox ? ix : ox) + w; }
        else { lo = ox; hi = ox + w; }
        fillRect(lo, y, hi - lo, 9, C_ROAD);
      } else { lo = ix; hi = ix + w; }
      if (vis(ix, w)) drawVeh(v, ix, y);
      v.lx = ix;
      if (L.row === frog.row && hi > fc0 && lo < fc0 + CW) ft = true;
    }
  }
}
function hudUpdate() {
  var i, bw, bc, fr, col, bx = 208, bwid = 106;
  if (hc.lv !== lv) { fillRect(2, HUDY + 2, 40, 12, C_HUD); txt('LV ' + lv, 4, HUDY + 5, 1, GOLD); hc.lv = lv; }
  if (hc.lives !== lives) {
    fillRect(44, HUDY + 2, 76, 12, C_HUD);
    for (i = 0; i < lives && i < 5; i++) drawFrogS(44 + i * 15, HUDY + 2, 1, 0, false);
    hc.lives = lives;
  }
  if (hc.score !== score) { fillRect(124, HUDY + 2, 80, 12, C_HUD); txt('SCORE ' + score, 126, HUDY + 5, 1, WHITE); hc.score = score; }
  fr = tmax > 0 ? tmr / tmax : 0;
  if (fr < 0) fr = 0;
  bw = Math.floor((bwid - 2) * fr);
  bc = fr > 0.5 ? 0 : (fr > 0.25 ? 1 : 2);
  if (bw !== hc.bw || bc !== hc.bc) {
    col = bc === 0 ? C_F1 : (bc === 1 ? GOLD : C_SPLAT);
    fillRect(bx, HUDY + 4, bwid, 8, rgb(44, 44, 60));
    outRect(bx, HUDY + 4, bwid, 8, rgb(120, 120, 140));
    fillRect(bx + 1, HUDY + 5, bw, 6, col);
    hc.bw = bw; hc.bc = bc;
  }
}
function hudAll() {
  fillRect(0, HUDY, W, H - HUDY, C_HUD);
  fillRect(0, HUDY, W, 1, UI.trim);
  hc.lv = -1; hc.lives = -1; hc.score = -1; hc.bw = -1; hc.bc = -1;
  hudUpdate();
}
function render() {
  var fr = -1, fd = frog.dirty;
  ft = false;
  if (fd && frog.dr >= 0) { cellBg(frog.dr, frog.dc); fr = frog.dr; }
  drawVehicles(fr);
  if (fd || ft) { drawFrogNow(); frog.dc = frog.col; frog.dr = frog.row; frog.dirty = false; }
  hudUpdate();
}
function renderScene() {
  var i, j;
  drawBackground();
  for (i = 0; i < lanes.length; i++) for (j = 0; j < lanes[i].vs.length; j++) lanes[i].vs[j].lx = -99999;
  ft = false;
  drawVehicles(-1);
  hudAll();
  drawFrogNow();
  frog.dc = frog.col; frog.dr = frog.row; frog.dirty = false;
}

/* ------------------------------------------------------------------ */
/* Dialogs / menus                                                     */
/* ------------------------------------------------------------------ */
function panel(x, y, w, h) {
  fillRect(x, y, w, h, UI.dark); outRect(x, y, w, h, UI.trim); outRect(x + 2, y + 2, w - 4, h - 4, UI.trim);
}
function toast(msg, col) {
  var w = Math.max(150, tw(msg, 1) + 24), h = 28, x = Math.floor((W - w) / 2), y = Math.floor((H - h) / 2);
  panel(x, y, w, h);
  ctxt(msg, W / 2, y + 10, 1, col);
  sleep(1200);
}
function lmRow(x, y, w, i, on, opts) {
  hiBox(x, y, w, 14, on);
  ctxt(opts[i], x + w / 2, y + 3, 1, on ? UI.dark : WHITE);
  hiArrows(x, y, w, 14, on);
}
/* returns chosen index, or -1 for Back */
function listMenu(title, sub, opts) {
  var w = 184, n = opts.length, h = 30 + (sub ? 12 : 0) + n * 17 + 6;
  var x = Math.floor((W - w) / 2), y = Math.floor((H - h) / 2), sel = 0, k, old, i, ry, sz;
  panel(x, y, w, h);
  sz = (tw(title, 2) <= w - 14) ? 2 : 1;
  ctxt(title, W / 2, y + 7, sz, UI.trim);
  ry = y + 26;
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
  return listMenu(title, msg, ['NO', 'YES']) === 1;
}

/* ------------------------------------------------------------------ */
/* Save / load (only ever called from a menu choice)                   */
/* ------------------------------------------------------------------ */
function packSave() {
  return 'V=1;S=' + (cfg.sound ? 1 : 0) + ';D=' + cfg.diff + ';L=' + cfg.lives + ';H=' + prog.hi;
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
  var s = readSave(), p, i, kv, v;
  if (!s || s.indexOf('V=1') !== 0) return false;
  p = s.split(';');
  for (i = 0; i < p.length; i++) {
    kv = p[i].split('=');
    if (kv.length < 2) continue;
    v = parseInt(kv[1], 10);
    if (v !== v) continue;
    if (kv[0] === 'S') cfg.sound = (v !== 0);
    else if (kv[0] === 'D' && v >= 0 && v <= 2) cfg.diff = v;
    else if (kv[0] === 'L' && v >= 0 && v < LIVESV.length) cfg.lives = v;
    else if (kv[0] === 'H') prog.hi = cl(v, 0, 99999999);
  }
  prog.dirty = false;
  return true;
}

/* ------------------------------------------------------------------ */
/* Game flow                                                           */
/* ------------------------------------------------------------------ */
function pauseMenu() {
  var r;
  while (true) {
    r = listMenu('PAUSED', '', ['RESUME', 'NEW GAME', 'SAVE', 'QUIT TO MENU']);
    if (r === 2) { renderScene(); toast(saveGame() ? 'GAME SAVED' : 'SAVE FAILED', WHITE); renderScene(); continue; }
    if (r === 1) return 'restart';
    if (r === 3) return 'menu';
    renderScene();
    return 'resume';
  }
}
function banner(n) {
  var w = 232, h = (n <= 2) ? 62 : 40, x = Math.floor((W - w) / 2), y = 36;
  panel(x, y, w, h);
  ctxt('LEVEL ' + n, W / 2, y + 7, 2, UI.trim);
  ctxt('FILL ALL 5 PONDS!', W / 2, y + 28, 1, WHITE);
  if (n <= 2) {
    ctxt('TURN=SIDEWAYS  CLICK=FORWARD', W / 2, y + 40, 1, rgb(160, 220, 255));
    ctxt('BACK=BACKWARD  2xBACK=PAUSE', W / 2, y + 50, 1, rgb(160, 220, 255));
  }
  sleep(1700);
}
function startLevel(n) {
  lv = n;
  buildLevel(n);
  bayFull = [false, false, false, false, false]; filled = 0;
  tmax = Math.floor(cl(1000 - 25 * (n - 1), 560, 1000) * TMUL[cfg.diff]);
  evt = '';
  respawn();
  frog.dc = -1; frog.dr = -1;
  drawBackground();
  banner(n);
  renderScene();
}
function runLevel() {
  var t0, k, last, dt, acc = 0, n, res, hopBack = -1, t;
  settle();
  last = ms();
  while (true) {
    t0 = ms(); dt = t0 - last; last = t0;
    if (dt < 0) dt = 0;
    if (dt > 120) dt = 120;
    acc += dt;
    k = poll();
    if (k === 'L') hop(-1, 0);
    else if (k === 'R') hop(1, 0);
    else if (k === 'O') hop(0, -1);
    else if (k === 'B') {
      t = ms();
      if (hopBack >= 0 && t - hopBack < 420) {
        hopBack = -1;
        res = pauseMenu();
        if (res !== 'resume') return res;
        renderScene(); settle();
        last = ms(); acc = 0;
      } else { hopBack = t; }
    }
    if (hopBack >= 0 && ms() - hopBack >= 420) { hopBack = -1; hop(0, 1); }
    n = 0;
    while (acc >= TICK && n < 3) { simTick(); acc -= TICK; n++; }
    if (acc >= TICK) acc = 0;
    render();
    if (evt !== '') { sleep(300); return evt; }
    if (frog.dead) {
      deadT--;
      if (deadT <= 0) {
        lives--;
        if (lives <= 0) { lives = 0; hudUpdate(); return 'over'; }
        respawn();
      }
    }
    sleep(Math.max(1, FRAME - (ms() - t0)));
  }
}
function newGame() {
  lv = 1; lives = LIVESV[cfg.lives]; score = 0; nextLife = 2500;
}
function playGame() {
  var r, c, bonus, nh;
  BTN_GAP = BTN_GAME;
  newGame();
  while (true) {
    startLevel(lv);
    r = runLevel();
    if (r === 'menu') break;
    if (r === 'restart') { newGame(); continue; }
    if (r === 'clear') {
      bonus = 100 * lv;
      addScore(bonus);
      if (score > prog.hi) { prog.hi = score; prog.dirty = true; }
      sndWin();
      toast('LEVEL ' + lv + ' CLEAR!  +' + bonus, GOLD);
      lv++;
      continue;
    }
    nh = false;
    if (score > prog.hi) { prog.hi = score; prog.dirty = true; nh = true; }
    sndLose();
    c = listMenu('GAME OVER', 'SCORE ' + score + (nh ? '  NEW HI!' : '  HI ' + prog.hi), ['RETRY', 'MENU']);
    if (c === 0) { newGame(); continue; }
    break;
  }
  BTN_GAP = BTN_MENU;
}

/* ------------------------------------------------------------------ */
/* Menu screens                                                        */
/* ------------------------------------------------------------------ */
var SKYB = [rgb(22, 26, 70), rgb(40, 38, 98), rgb(76, 50, 118), rgb(128, 62, 122), rgb(196, 88, 104), rgb(238, 138, 92)];
var BLD = [[0, 22, 34], [22, 16, 22], [38, 26, 44], [64, 14, 30], [78, 22, 40], [100, 20, 26], [120, 28, 48], [148, 18, 32],
  [166, 24, 42], [190, 16, 28], [206, 26, 50], [232, 18, 30], [250, 24, 44], [274, 16, 26], [290, 30, 38]];
var STARS = [[12, 8], [40, 22], [70, 6], [250, 12], [290, 28], [304, 6], [24, 40], [226, 30], [60, 44]];
function bgPlain() {
  var i, y;
  for (i = 0; i < 6; i++) { y = i * 22; fillRect(0, y, W, (i === 5) ? 134 - y : 22, SKYB[i]); }
  fillRect(0, 134, W, 8, C_SW);
  fillRect(0, 134, W, 1, rgb(196, 190, 200));
  fillRect(0, 142, W, H - 142, C_ROAD);
  for (i = 6; i < W; i += 24) fillRect(i, 154, 12, 2, C_LINE);
}
function bgMenu() {
  var i, b, wx, wy;
  bgPlain();
  for (i = 0; i < STARS.length; i++) fillRect(STARS[i][0], STARS[i][1], 2, 2, rgb(230, 230, 255));
  for (i = 0; i < BLD.length; i++) {
    b = BLD[i];
    fillRect(b[0], 134 - b[2], b[1] - 1, b[2], rgb(18, 18, 40));
    for (wy = 134 - b[2] + 4; wy < 128; wy += 8) {
      for (wx = b[0] + 3; wx < b[0] + b[1] - 4; wx += 6) {
        if (((wx * 3 + wy * 5) % 7) < 4) fillRect(wx, wy, 2, 3, rgb(250, 214, 110));
      }
    }
  }
  /* lamp post */
  fillRect(300, 76, 3, 58, rgb(30, 30, 44)); fillRect(290, 74, 13, 3, rgb(30, 30, 44)); fillRect(288, 77, 10, 3, rgb(255, 236, 150));
  /* traffic on the road strip */
  drawVeh({ d: 1, w: 18, t: 1, c: VC[0], c2: VC2[0] }, 10, 144);
  drawVeh({ d: 1, w: 10, t: 0, c: VC[3], c2: VC2[3] }, 56, 144);
  drawVeh({ d: -1, w: 40, t: 2, c: VC[2], c2: VC2[2] }, 118, 144);
  drawVeh({ d: -1, w: 34, t: 3, c: TRL[0], c2: VC[1] }, 262, 144);
  drawFrogS(24, 86, 4, 0, false);
}
var MENU = ['PLAY', 'SETUP', 'SAVE', 'LOAD', 'EXIT'];
function menuRow(i, on) {
  var x = 104, w = 112, y = 62 + i * 14, h = 12;
  hiBox(x, y, w, h, on);
  ctxt(MENU[i], x + w / 2, y + 2, 1, on ? UI.dark : WHITE);
  hiArrows(x, y, w, h, on);
}
function menuRender(sel) {
  var i;
  bgMenu();
  txt('HI ' + prog.hi, 4, 4, 1, GOLD);
  stxt('FROGGER', W / 2, 6, 4, C_F1);
  stxt('by da cbm', W / 2, 41, 2, WHITE);
  for (i = 0; i < MENU.length; i++) menuRow(i, i === sel);
  ctxt('TURN = MOVE    CLICK = SELECT', W / 2, 159, 1, WHITE);
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
    else if (k === 'B') { return 4; }
  }
}
var SET_ROWS = ['SOUND', 'DIFFICULTY', 'LIVES', 'RESET HI-SCORE', 'BACK'];
function setVal(i) {
  if (i === 0) return cfg.sound ? 'ON' : 'OFF';
  if (i === 1) return ['EASY', 'NORMAL', 'HARD'][cfg.diff];
  if (i === 2) return String(LIVESV[cfg.lives]);
  return '';
}
function setRow(i, on) {
  var x = 30, y = 34 + i * 19, w = 260, h = 16;
  hiBox(x, y, w, h, on);
  txt(SET_ROWS[i], x + (on ? 16 : 8), y + 4, 1, on ? UI.dark : WHITE);
  rtxt(setVal(i), x + w - (on ? 16 : 8), y + 4, 1, on ? UI.dark : UI.trim);
  hiArrows(x, y, w, h, on);
}
function setRender(sel) {
  var i;
  bgPlain();
  stxt('SETUP', W / 2, 8, 2, C_F1);
  for (i = 0; i < SET_ROWS.length; i++) setRow(i, i === sel);
  ctxt('CLICK = CHANGE    BACK = EXIT', W / 2, 159, 1, WHITE);
}
function setup() {
  var sel = 0, k, old;
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
      else if (sel === 2) { cfg.lives = (cfg.lives + 1) % LIVESV.length; setRow(2, true); }
      else if (sel === 3) {
        if (askYesNo('RESET HI-SCORE?', 'Best score will be cleared')) { prog.hi = 0; prog.dirty = true; }
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
  var errs = 0, sel = 0, c, go = true;
  while (go) {
    try {
      c = menu(sel); sel = c;
      if (c === 0) { playGame(); }
      else if (c === 1) { setup(); }
      else if (c === 2) { toast(saveGame() ? 'GAME SAVED' : 'SAVE FAILED', WHITE); }
      else if (c === 3) { toast(loadGame() ? 'GAME LOADED' : 'NO SAVE FOUND', WHITE); }
      else { if (!prog.dirty || askYesNo('EXIT GAME?', 'Unsaved changes will be lost')) go = false; }
      errs = 0;
    } catch (e) {
      errs++;
      BTN_GAP = BTN_MENU;
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
