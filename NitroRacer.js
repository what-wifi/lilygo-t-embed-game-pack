/*
 * NITRO RACER  v1.0   by da cbm
 * Top-down race car game for Bruce firmware
 * Target: LilyGO T-Embed CC1101 (320x170, rotary encoder)
 *
 * 25 levels in 5 scenic themes. Beat the rival car to the finish line.
 * Every first win earns an UPGRADE POINT (+1 more for a clean 3-star run).
 * Spend points on ENGINE / TIRES / NITRO / ARMOR.  Paint your car in the GARAGE.
 *
 * Controls
 *   Race:   turn = change lane, click = nitro on/off, Back = pause menu
 *   Menus:  turn = move, click = select, Back = back
 *
 * Plain ES5 (no arrow functions, let/const, template strings or nested
 * functions) so it runs on the Bruce interpreter.
 *
 * Stability notes
 *  - Nothing is ever cleared during a race. Every sprite is opaque and is
 *    redrawn over itself; only the strip a sprite just left is repainted.
 *  - Time-based physics with clamped frame time (slow PC / slow frame can
 *    never teleport you), NaN guards, entity caps, passable-traffic spawner.
 *  - Every frame and every screen runs inside a crash guard.
 *  - Storage is touched ONLY when you pick SAVE or LOAD.
 */
(function () {

var SAVE_PATH = '/nr.sav';

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

var HAS_FC = false;
try { HAS_FC = typeof D.drawFillCircle === 'function'; } catch (e7) {}

var vclock = 0;
function ms() {
  try { if (typeof now === 'function') { var v0 = now(); if (typeof v0 === 'number' && v0 === v0) return v0; } } catch (e) {}
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

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */
var NL = 25, LANES = 5, LANE_H = 24, UP_MAX = 10;
var HUD_H = 14, VT_Y = 14, VT_H = 20, ROAD_Y = 34, ROAD_H = 120, VB_Y = 154;
var PXM = 4;                 /* screen pixels per metre */
var PX0 = 56;                /* player car left edge */
var CAR_W = 30, CAR_H = 13, TRK_W = 46, TRK_H = 15;
var SP = 56, LEN = 28;       /* lane dash period / length */
var BAR_X = 12, BAR_W = 296, BAR_Y = 159;
var DIV_Y = [0, ROAD_Y + 23, ROAD_Y + 47, ROAD_Y + 71, ROAD_Y + 95];
var LANE_F = [0.40, 0.50, 0.60, 0.70, 0.80];

var WHITE = rgb(255, 255, 255), BLACK = rgb(0, 0, 0), GOLD = rgb(255, 196, 40);
var TIRE = rgb(18, 18, 22), GLASS = rgb(130, 205, 245), GLASSD = rgb(46, 84, 124);
var HL = rgb(255, 250, 180), TL = rgb(255, 40, 40);
var FLA = rgb(255, 140, 20), FLB = rgb(255, 235, 90);
var HUDBG = rgb(12, 14, 24), TRACK = rgb(50, 52, 64), TRUNK = rgb(92, 60, 30);
var TRAILER = rgb(206, 206, 214), GREY = rgb(120, 126, 146), GREEN = rgb(80, 230, 110), REDC = rgb(255, 80, 80);
var UI = { trim: GOLD, dark: rgb(16, 20, 36), mid: rgb(34, 42, 70) };

var CARC = [[220, 32, 32], [245, 120, 20], [245, 210, 30], [120, 220, 40], [20, 160, 76], [30, 200, 224],
            [44, 96, 236], [140, 64, 214], [244, 96, 172], [240, 240, 244], [170, 176, 188], [44, 44, 52]];
var CC = [], CD = [], ci;
for (ci = 0; ci < CARC.length; ci++) {
  CC.push(rgb(CARC[ci][0], CARC[ci][1], CARC[ci][2]));
  CD.push(rgb(Math.floor(CARC[ci][0] * 0.6), Math.floor(CARC[ci][1] * 0.6), Math.floor(CARC[ci][2] * 0.6)));
}
var NCOL = CARC.length;

var THEMES = [
  ['COUNTRY ROAD', [34, 120, 50], [66, 66, 74], [20, 90, 34], [40, 140, 56], [232, 232, 232], [244, 244, 214]],
  ['DESERT HIGHWAY', [216, 180, 106], [86, 80, 76], [96, 112, 44], [128, 148, 64], [232, 232, 232], [244, 240, 210]],
  ['AUTUMN PASS', [100, 110, 38], [70, 66, 66], [184, 76, 22], [230, 150, 40], [232, 232, 232], [244, 244, 214]],
  ['SNOW RUN', [226, 234, 246], [90, 94, 106], [22, 84, 62], [244, 250, 255], [232, 232, 232], [244, 244, 214]],
  ['NIGHT CITY', [14, 34, 28], [38, 38, 50], [8, 58, 42], [20, 92, 66], [200, 200, 210], [250, 220, 80]]
];
var T_G = 0, T_R = 0, T_T1 = 0, T_T2 = 0, T_E = 0, T_D = 0, T_NAME = '';
function applyTheme(L) {
  var t = THEMES[cl(Math.floor((L - 1) / 5), 0, 4)];
  T_NAME = t[0];
  T_G = rgb(t[1][0], t[1][1], t[1][2]); T_R = rgb(t[2][0], t[2][1], t[2][2]);
  T_T1 = rgb(t[3][0], t[3][1], t[3][2]); T_T2 = rgb(t[4][0], t[4][1], t[4][2]);
  T_E = rgb(t[5][0], t[5][1], t[5][2]); T_D = rgb(t[6][0], t[6][1], t[6][2]);
}
applyTheme(1);

/* settings (changed in SETUP) */
var cfg = { sound: true, diff: 1, inv: 0 };
/* progress (written only by SAVE) */
var prog = { unlocked: 1, stars: [], pts: 0, ups: [0, 0, 0, 0], body: 0, acc: 9, dirty: false };
var si;
for (si = 0; si < NL; si++) prog.stars.push(0);

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
function fcirc(x, y, r, c) {
  x = Math.floor(x); y = Math.floor(y); r = Math.floor(r);
  if (r < 1) { fillRect(x, y, 1, 1, c); return; }
  if (HAS_FC) { try { D.drawFillCircle(x, y, r, c); return; } catch (e) {} }
  var dy, dx;
  for (dy = -r; dy <= r; dy++) { dx = Math.floor(Math.sqrt(r * r - dy * dy)); fillRect(x - dx, y + dy, dx * 2 + 1, 1, c); }
}
function txt(s, x, y, sz, c) {
  try { D.setTextSize(sz); D.setTextColor(c); D.drawString(String(s), Math.floor(x), Math.floor(y)); } catch (e) {}
}
function tw(s, sz) { return String(s).length * 6 * sz; }
function ctxt(s, cx, y, sz, c) { txt(s, cx - tw(s, sz) / 2, y, sz, c); }
function rtxt(s, rx, y, sz, c) { txt(s, rx - tw(s, sz), y, sz, c); }
function stxt(s, cx, y, sz, c) { ctxt(s, cx + 1, y + 1, sz, BLACK); ctxt(s, cx, y, sz, c); }
function panel(x, y, w, h) {
  fillRect(x, y, w, h, UI.dark); outRect(x, y, w, h, UI.trim); outRect(x + 2, y + 2, w - 4, h - 4, UI.trim);
}

/* ------------------------------------------------------------------ */
/* Input: debounced, direction filtered, always drained                */
/* ------------------------------------------------------------------ */
var ROT_GAP = 55, REV_GAP = 140, BTN_GAP = 240;
var lastRot = 0, lastBtn = 0, lastDir = 0;
function setGaps(race) {
  if (race) { ROT_GAP = 40; REV_GAP = 75; BTN_GAP = 220; }
  else { ROT_GAP = 55; REV_GAP = 140; BTN_GAP = 240; }
}
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
function sndWin() { tune([[784, 70], [988, 70], [1175, 70], [1568, 160]]); }
function sndLose() { tune([[330, 120], [262, 120], [196, 220]]); }

/* ------------------------------------------------------------------ */
/* UI widgets                                                          */
/* ------------------------------------------------------------------ */
function hiBox(x, y, w, h, sel) {
  fillRect(x, y, w, h, sel ? UI.trim : UI.mid);
  outRect(x, y, w, h, sel ? WHITE : UI.trim);
  if (sel) outRect(x + 2, y + 2, w - 4, h - 4, UI.dark);
}
function bgPlain() {
  var x;
  fillRect(0, 0, W, H, UI.dark);
  for (x = 0; x < W; x += 8) {
    fillRect(x, 0, 4, 4, WHITE); fillRect(x + 4, 4, 4, 4, WHITE);
    fillRect(x + 4, H - 8, 4, 4, WHITE); fillRect(x, H - 4, 4, 4, WHITE);
  }
}
function lbRow(x, y, w, h, label, on) {
  hiBox(x, y, w, h, on);
  ctxt(label, x + w / 2, y + Math.floor((h - 8) / 2), 1, on ? UI.dark : WHITE);
}
function lbRun(x, y, w, h, gap, items, start) {
  var sel = cl(start, 0, items.length - 1), i, k, old;
  for (i = 0; i < items.length; i++) lbRow(x, y + i * (h + gap), w, h, items[i], i === sel);
  settle();
  while (true) {
    k = waitKey();
    if (k === 'L' || k === 'R') {
      old = sel; sel = (sel + (k === 'R' ? 1 : items.length - 1)) % items.length;
      sndMove();
      lbRow(x, y + old * (h + gap), w, h, items[old], false);
      lbRow(x, y + sel * (h + gap), w, h, items[sel], true);
    } else if (k === 'O') { sndSel(); return sel; }
    else if (k === 'B') { return -1; }
  }
}
function listPanel(title, msg, items, start) {
  var w = 190, ph = 40 + items.length * 22, x = Math.floor((W - w) / 2), y = Math.floor((H - ph) / 2);
  panel(x, y, w, ph);
  ctxt(title, W / 2, y + 8, 1, GOLD);
  if (msg !== '') ctxt(msg, W / 2, y + 20, 1, WHITE);
  return lbRun(x + 20, y + 32, w - 40, 20, 2, items, start);
}
function confirmBox(title, msg) { return listPanel(title, msg, ['NO', 'YES'], 0) === 1; }
function toast(msg, col) {
  var w = Math.max(150, tw(msg, 1) + 24), h = 28, x = Math.floor((W - w) / 2), y = Math.floor((H - h) / 2);
  panel(x, y, w, h);
  ctxt(msg, W / 2, y + 10, 1, col);
  drain(1000);
}

/* ------------------------------------------------------------------ */
/* Car sprites                                                         */
/* ------------------------------------------------------------------ */
function pr(x, y, s, rx, ry, rw, rh, c) { fillRect(x + rx * s, y + ry * s, rw * s, rh * s, c); }
function drawCar(x, y, s, bi, ai, flash) {
  var b = flash ? WHITE : CC[bi], d = flash ? rgb(205, 205, 215) : CD[bi], a = flash ? rgb(235, 235, 245) : CC[ai];
  pr(x, y, s, 0, 3, 30, 7, b);
  pr(x, y, s, 7, 2, 16, 9, b);
  pr(x, y, s, 0, 3, 2, 7, d);
  pr(x, y, s, 2, 5, 9, 3, a);
  pr(x, y, s, 24, 5, 6, 3, a);
  pr(x, y, s, 11, 3, 10, 7, d);
  pr(x, y, s, 21, 3, 3, 7, GLASS);
  pr(x, y, s, 10, 4, 1, 5, GLASSD);
  pr(x, y, s, 13, 4, 6, 5, b);
  pr(x, y, s, 0, 0, 7, 3, TIRE); pr(x, y, s, 23, 0, 7, 3, TIRE);
  pr(x, y, s, 0, 10, 7, 3, TIRE); pr(x, y, s, 23, 10, 7, 3, TIRE);
  pr(x, y, s, 28, 3, 2, 2, HL); pr(x, y, s, 28, 8, 2, 2, HL);
  pr(x, y, s, 0, 4, 1, 2, TL); pr(x, y, s, 0, 7, 1, 2, TL);
}
function drawTruck(x, y, bi) {
  pr(x, y, 1, 0, 0, 33, 15, TRAILER);
  pr(x, y, 1, 0, 0, 33, 1, GREY); pr(x, y, 1, 0, 14, 33, 1, GREY);
  pr(x, y, 1, 0, 6, 33, 3, CC[bi]);
  pr(x, y, 1, 3, 0, 7, 2, TIRE); pr(x, y, 1, 13, 0, 7, 2, TIRE);
  pr(x, y, 1, 3, 13, 7, 2, TIRE); pr(x, y, 1, 13, 13, 7, 2, TIRE);
  pr(x, y, 1, 33, 1, 13, 13, CC[bi]);
  pr(x, y, 1, 35, 3, 5, 9, CD[bi]);
  pr(x, y, 1, 41, 3, 3, 9, GLASS);
  pr(x, y, 1, 44, 3, 2, 2, HL); pr(x, y, 1, 44, 10, 2, 2, HL);
  pr(x, y, 1, 0, 3, 1, 2, TL); pr(x, y, 1, 0, 10, 1, 2, TL);
}
function drawCone(x, y) {
  fillRect(x, y, 8, 8, rgb(255, 120, 0));
  fillRect(x + 2, y + 2, 4, 4, WHITE);
  fillRect(x + 3, y + 3, 2, 2, rgb(255, 120, 0));
}
function drawPick(x, y) {
  fillRect(x, y, 12, 12, rgb(30, 110, 255));
  outRect(x, y, 12, 12, WHITE);
  if (x >= 0 && x + 12 <= W) txt('N', x + 3, y + 2, 1, WHITE);
}
function drawTree(x, y, d) {
  if (d > 0) {
    fillRect(x + 8, y + 14, d, 4, T_G); fillRect(x + 13, y + 9, d, 5, T_G);
    fillRect(x + 11, y + 4, d, 5, T_G); fillRect(x + 9, y, d, 4, T_G);
  }
  fillRect(x + 5, y + 14, 3, 4, TRUNK);
  fillRect(x, y + 9, 13, 5, T_T1);
  fillRect(x + 2, y + 4, 9, 5, T_T1);
  fillRect(x + 4, y, 5, 4, T_T2);
}

/* ------------------------------------------------------------------ */
/* Race state                                                          */
/* ------------------------------------------------------------------ */
var LV = 1, RDIST = 2000, EN = 0, TI = 0, NI = 0, AR = 0, VMAX = 52;
var pd = 0, rd = 0, v = 0, rvv = 0, rb = 40, nit = 100, nitOn = false, lane = 2, py = 0;
var crashes = 0, invul = 0, msgT = 0, tClock = 0, frameNo = 0, spawnT = 1, pickT = 6, hudT = 0;
var dOff = 0, dAcc = 0, flameWas = false;
var OBJ = [], EFX = [], LSP = [0, 0, 0, 0, 0];
var PL = null, RV = null, rl = 1, ry = 0, rlT = 0, rCol = 4, rAcc = 9;
var NT = 6, TX = [], TO = [], TYS = [];
var hSpd = -1, hNit = -1, hOn = false, hGap = '', hGapC = 0, mP = -1, mR = -1;
var RS_T = 0, RS_CR = 0, RS_GAP = 0;
var EDX = [1, 0, -1, 0, 0.7, 0.7, -0.7, -0.7], EDY = [0, 1, 0, -1, 0.7, -0.7, 0.7, -0.7];

function lvDist(L) { return 1800 + 140 * L; }
function laneTop(l, h) { return ROAD_Y + l * LANE_H + Math.floor((LANE_H - h) / 2); }
function diffMul() { return cfg.diff === 0 ? 0.92 : (cfg.diff === 2 ? 1.08 : 1); }

function mkObj(k, ln, x, spd, col, acc) {
  var w = CAR_W, h = CAR_H;
  if (k === 1) { w = TRK_W; h = TRK_H; } else if (k === 2) { w = 8; h = 8; } else if (k === 3) { w = 12; h = 12; }
  return { k: k, ln: ln, x: x, y: laneTop(ln, h), w: w, h: h, s: spd, c: col, a: acc,
           ox: 0, oy: 0, ow: 0, oh: 0, dr: false, dead: false, hit: false };
}

/* repaint a road rectangle (asphalt + lane dashes) */
function restoreRect(x, y, w, h) {
  var x2, y2, i, yy, k, k0, ds, de, ya, yb, a, b;
  x = Math.floor(x); y = Math.floor(y); x2 = x + Math.floor(w); y2 = y + Math.floor(h);
  if (x < 0) x = 0;
  if (x2 > W) x2 = W;
  if (y < ROAD_Y + 2) y = ROAD_Y + 2;
  if (y2 > ROAD_Y + ROAD_H - 2) y2 = ROAD_Y + ROAD_H - 2;
  if (x2 <= x || y2 <= y) return;
  fillRect(x, y, x2 - x, y2 - y, T_R);
  for (i = 1; i < LANES; i++) {
    yy = DIV_Y[i];
    if (y < yy + 2 && y2 > yy) {
      ya = yy > y ? yy : y; yb = (yy + 2 < y2) ? yy + 2 : y2;
      k0 = Math.floor((x + dOff) / SP) - 1;
      for (k = k0; k < k0 + 14; k++) {
        ds = k * SP - dOff;
        if (ds >= x2) break;
        de = ds + LEN;
        if (de > x) { a = ds < x ? x : ds; b = de > x2 ? x2 : de; fillRect(a, ya, b - a, yb - ya, T_D); }
      }
    }
  }
}
function roadRect(x, y, w, h, c) {
  var y2 = y + h;
  if (y < ROAD_Y + 2) y = ROAD_Y + 2;
  if (y2 > ROAD_Y + ROAD_H - 2) y2 = ROAD_Y + ROAD_H - 2;
  if (y2 <= y) return;
  fillRect(x, y, w, y2 - y, c);
}
function diffRestore(ox, oy, ow, oh, nx, ny, nw, nh) {
  var ox2 = ox + ow, oy2 = oy + oh, nx2 = nx + nw, ny2 = ny + nh, ix1, ix2;
  if (nx >= ox2 || nx2 <= ox || ny >= oy2 || ny2 <= oy) { restoreRect(ox, oy, ow, oh); return; }
  if (nx > ox) restoreRect(ox, oy, nx - ox, oh);
  if (nx2 < ox2) restoreRect(nx2, oy, ox2 - nx2, oh);
  ix1 = ox > nx ? ox : nx; ix2 = ox2 < nx2 ? ox2 : nx2;
  if (ny > oy) restoreRect(ix1, oy, ix2 - ix1, ny - oy);
  if (ny2 < oy2) restoreRect(ix1, ny2, ix2 - ix1, oy2 - ny2);
}
function syncSprite(o, show) {
  var nx = Math.floor(o.x), ny = Math.floor(o.y);
  if (o.dr) {
    if (!show) { restoreRect(o.ox, o.oy, o.ow, o.oh); o.dr = false; return; }
    diffRestore(o.ox, o.oy, o.ow, o.oh, nx, ny, o.w, o.h);
  }
  if (show) { o.ox = nx; o.oy = ny; o.ow = o.w; o.oh = o.h; o.dr = true; }
}
function paintPlayer() {
  var bx = PL.ox, by = PL.oy, len;
  var flash = invul > 0 && (Math.floor(invul * 8) % 2 === 0);
  if (nitOn) {
    len = 5 + (frameNo & 1) * 4;
    if (len < 9) restoreRect(bx, by + 4, 9 - len, 5);
    fillRect(bx + 9 - len, by + 4, len, 5, FLA);
    fillRect(bx + 11 - len, by + 5, len - 2, 3, FLB);
    flameWas = true;
  } else if (flameWas) {
    restoreRect(bx, by + 4, 9, 5); flameWas = false;
  }
  drawCar(bx + 9, by, 1, prog.body, prog.acc, flash);
}
function gapSprite(o) {
  if (!o.dr) return;
  if (o.k === 0 || o.k === 4) { restoreRect(o.ox + 7, o.oy, 16, 2); restoreRect(o.ox + 7, o.oy + 11, 16, 2); }
  else if (o.k === 1) { restoreRect(o.ox + 33, o.oy, 13, 1); restoreRect(o.ox + 33, o.oy + 14, 13, 1); }
  else if (o.k === 5) {
    restoreRect(o.ox + 16, o.oy, 16, 2); restoreRect(o.ox + 16, o.oy + 11, 16, 2);
    if (nitOn || flameWas) { restoreRect(o.ox, o.oy, 9, 4); restoreRect(o.ox, o.oy + 9, 9, 4); }
  }
}
function paintSprite(o) {
  if (!o.dr) return;
  if (o.k === 0) drawCar(o.ox, o.oy, 1, o.c, o.a, false);
  else if (o.k === 1) drawTruck(o.ox, o.oy, o.c);
  else if (o.k === 2) drawCone(o.ox, o.oy);
  else if (o.k === 3) drawPick(o.ox, o.oy);
  else if (o.k === 4) drawCar(o.ox, o.oy, 1, rCol, rAcc, false);
  else if (o.k === 5) paintPlayer();
}
function efxDraw(e, clear) {
  var j, r = e.r, px, qy, c = (e.f & 1) ? FLB : FLA;
  if (r < 0) return;
  for (j = 0; j < 8; j++) {
    px = e.x + Math.floor(EDX[j] * r) - 1; qy = e.y + Math.floor(EDY[j] * r) - 1;
    if (clear) restoreRect(px, qy, 3, 3); else roadRect(px, qy, 3, 3, c);
  }
  if (e.f < 3) { if (clear) restoreRect(e.x - 2, e.y - 2, 4, 4); else roadRect(e.x - 2, e.y - 2, 4, 4, WHITE); }
}

/* ------------------------------------------------------------------ */
/* HUD + progress bar                                                  */
/* ------------------------------------------------------------------ */
function hudStatic() {
  fillRect(0, 0, W, HUD_H, HUDBG);
  txt('LV' + LV, 4, 3, 1, GOLD);
  txt('NIT', 116, 3, 1, WHITE);
}
function hudUpdate(force) {
  var kmh = Math.floor(v * 3.6 / 5 + 0.5) * 5, nw, nc, g, gs, gc;
  if (force || kmh !== hSpd) { hSpd = kmh; fillRect(44, 0, 66, HUD_H, HUDBG); txt(kmh + ' KMH', 44, 3, 1, WHITE); }
  nw = Math.floor(nit * 0.58 / 2) * 2;
  if (force || nw !== hNit || nitOn !== hOn) {
    hNit = nw; hOn = nitOn; nc = nitOn ? FLB : rgb(40, 170, 255);
    outRect(140, 3, 62, 8, GREY); fillRect(141, 4, 60, 6, rgb(26, 30, 46));
    if (nw > 0) fillRect(141, 4, nw, 6, nc);
  }
  if (msgT > 0) { gs = 'CRASH!'; gc = TL; }
  else {
    g = Math.floor(pd - rd); if (g > 9999) g = 9999; if (g < -9999) g = -9999;
    gs = 'GAP ' + (g >= 0 ? '+' : '') + g + 'M'; gc = g >= 0 ? GREEN : REDC;
  }
  if (force || gs !== hGap || gc !== hGapC) {
    hGap = gs; hGapC = gc; fillRect(206, 0, W - 206, HUD_H, HUDBG); rtxt(gs, W - 4, 3, 1, gc);
  }
}
function progUpdate(force) {
  var pp = BAR_X + Math.floor(cl(pd / RDIST, 0, 1) * (BAR_W - 6));
  var rp = BAR_X + Math.floor(cl(rd / RDIST, 0, 1) * (BAR_W - 6));
  if (!force && pp === mP && rp === mR) return;
  if (!force) { fillRect(mR, BAR_Y, 6, 6, TRACK); fillRect(mP, BAR_Y, 6, 6, TRACK); }
  mP = pp; mR = rp;
  fillRect(rp, BAR_Y, 6, 6, CC[rCol]); outRect(rp, BAR_Y, 6, 6, BLACK);
  fillRect(pp, BAR_Y, 6, 6, CC[prog.body]); outRect(pp, BAR_Y, 6, 6, WHITE);
}

/* ------------------------------------------------------------------ */
/* Race: setup, full draw, per-frame update                            */
/* ------------------------------------------------------------------ */
function raceInit(L) {
  var i;
  LV = L; applyTheme(L); RDIST = lvDist(L);
  EN = prog.ups[0]; TI = prog.ups[1]; NI = prog.ups[2]; AR = prog.ups[3];
  VMAX = 52 + 2.6 * EN;
  pd = 0; rd = 0; v = 0; rvv = 0; nit = 100; nitOn = false; lane = 2; py = laneTop(2, CAR_H);
  crashes = 0; invul = 0; msgT = 0; tClock = 0; frameNo = 0; spawnT = 1.4; pickT = 6; hudT = 0;
  dOff = 0; dAcc = 0; flameWas = false;
  rb = (36 + 1.25 * L) * diffMul();
  for (i = 0; i < LANES; i++) LSP[i] = (17 + 0.8 * L) * LANE_F[i];
  OBJ = []; EFX = [];
  rCol = (prog.body + 4) % NCOL; rAcc = (prog.acc + 3) % NCOL;
  PL = mkObj(5, 2, PX0 - 9, 0, 0, 0); PL.w = 39; PL.h = CAR_H; PL.y = py;
  rl = 1; ry = laneTop(1, CAR_H); rlT = 0.5;
  RV = mkObj(4, 1, W + 80, 0, 0, 0); RV.y = ry;
  TX = []; TO = []; TYS = [];
  for (i = 0; i < NT; i++) { TX.push(14 + i * 56 + Math.random() * 28); TO.push(Math.floor(TX[i])); TYS.push(VT_Y + 1 + (i % 2)); }
  hSpd = -1; hNit = -1; hOn = false; hGap = ''; hGapC = 0; mP = -1; mR = -1;
}
function paintAll() {
  var i;
  for (i = 0; i < OBJ.length; i++) gapSprite(OBJ[i]);
  gapSprite(RV); gapSprite(PL);
  for (i = 0; i < OBJ.length; i++) paintSprite(OBJ[i]);
  paintSprite(RV);
  paintSprite(PL);
}
function raceDrawAll() {
  var i, k, ds;
  hudStatic();
  fillRect(0, VT_Y, W, VT_H, T_G); fillRect(0, VB_Y, W, H - VB_Y, T_G);
  fillRect(0, ROAD_Y, W, ROAD_H, T_R);
  fillRect(0, ROAD_Y, W, 2, T_E); fillRect(0, ROAD_Y + ROAD_H - 2, W, 2, T_E);
  for (i = 1; i < LANES; i++) {
    for (k = -1; k < 7; k++) { ds = k * SP - dOff; fillRect(ds, DIV_Y[i], LEN, 2, T_D); }
  }
  for (i = 0; i < NT; i++) { TO[i] = Math.floor(TX[i]); drawTree(TO[i], TYS[i], 0); }
  fillRect(BAR_X, BAR_Y, BAR_W, 6, TRACK);
  fillRect(BAR_X + BAR_W, BAR_Y, 4, 3, WHITE); fillRect(BAR_X + BAR_W + 4, BAR_Y, 4, 3, BLACK);
  fillRect(BAR_X + BAR_W, BAR_Y + 3, 4, 3, BLACK); fillRect(BAR_X + BAR_W + 4, BAR_Y + 3, 4, 3, WHITE);
  for (i = 0; i < OBJ.length; i++) OBJ[i].dr = false;
  RV.dr = false; PL.dr = false; flameWas = false;
  for (i = 0; i < OBJ.length; i++) syncSprite(OBJ[i], true);
  RV.x = PX0 + (rd - pd) * PXM; RV.y = ry;
  syncSprite(RV, RV.x > -CAR_W && RV.x < W);
  PL.y = py; syncSprite(PL, true);
  paintAll();
  hudUpdate(true); progUpdate(true);
}
function countdown() {
  var n;
  panel(98, 56, 124, 48);
  ctxt('LEVEL ' + LV, W / 2, 62, 2, GOLD);
  ctxt(T_NAME, W / 2, 84, 1, WHITE);
  drain(900);
  restoreRect(94, 52, 132, 56);
  for (n = 3; n >= 1; n--) {
    panel(130, 58, 60, 48);
    ctxt('' + n, W / 2, 64, 4, WHITE);
    beep(600, 60); drain(520);
  }
  panel(130, 58, 60, 48);
  ctxt('GO', W / 2, 70, 3, GREEN);
  beep(1200, 120); drain(350);
  restoreRect(126, 54, 68, 56);
}
function laneBlocked(ln, x) {
  var i, o, c;
  for (i = 0; i < OBJ.length; i++) {
    o = OBJ[i];
    if (o.k > 2 || o.ln !== ln) continue;
    c = (o.x + o.w / 2) - (x + CAR_W / 2);
    if (c < 0) c = -c;
    if (c < o.w / 2 + CAR_W / 2 + 10) return true;
  }
  return false;
}
function pickRivalLane(rx) {
  var d, a, b;
  if (!laneBlocked(rl, rx)) return;
  for (d = 1; d < LANES; d++) {
    a = rl - d; b = rl + d;
    if (a >= 0 && !laneBlocked(a, rx)) { rl = a; return; }
    if (b < LANES && !laneBlocked(b, rx)) { rl = b; return; }
  }
}
function relSpd(s) { var vr = v > VMAX * 0.8 ? v : VMAX * 0.8; return vr - s; }
function spawnTraffic() {
  var ln, k, r, i, o, ta, rel, sp, ox, bl = [false, false, false, false, false], cnt = 0;
  if (OBJ.length >= 14) return false;
  ln = Math.floor(Math.random() * LANES); if (ln >= LANES) ln = LANES - 1;
  k = 0; r = Math.random();
  if (LV >= 3 && r < 0.22) k = 1; else if (LV >= 6 && r > 0.87) k = 2;
  sp = (k === 2) ? 0 : LSP[ln];
  rel = relSpd(sp); if (rel < 6) return false;
  ta = (W + 4 - PX0) / (rel * PXM);
  for (i = 0; i < OBJ.length; i++) {
    o = OBJ[i];
    if (o.k === 3) continue;
    if (o.ln === ln) { if (o.x > W - 150) return false; continue; }
    ox = o.x - relSpd(o.s) * PXM * ta;
    if (ox > PX0 - 80 && ox < PX0 + 80) bl[o.ln] = true;
  }
  for (i = 0; i < LANES; i++) { if (bl[i]) cnt++; }
  if (cnt >= 2) return false;
  OBJ.push(mkObj(k, ln, W + 4, sp, Math.floor(Math.random() * NCOL), Math.floor(Math.random() * NCOL)));
  return true;
}
function spawnPickup() {
  var ln, i, o;
  if (OBJ.length >= 14) return;
  ln = Math.floor(Math.random() * LANES); if (ln >= LANES) ln = LANES - 1;
  for (i = 0; i < OBJ.length; i++) { o = OBJ[i]; if (o.ln === ln && o.x > W - 120) return; }
  OBJ.push(mkObj(3, ln, W + 4, 0, 0, 0));
}
function spawnGap() {
  var base = Math.max(0.5, 1.5 - 0.04 * LV);
  if (cfg.diff === 0) base *= 1.25; else if (cfg.diff === 2) base *= 0.85;
  return base * (0.75 + Math.random() * 0.5);
}
function crashHit(o) {
  var f;
  if (o.k === 3) { nit = Math.min(100, nit + 40); o.dead = true; beep(1300, 12); return; }
  if (o.k === 2) {
    o.dead = true;
    if (invul <= 0) {
      v = v * (0.76 + 0.02 * AR); if (v < 24) v = 24;
      invul = 0.5; crashes++; msgT = 0.7; beep(260, 20);
      if (EFX.length < 3) EFX.push({ x: PX0 + 28, y: Math.floor(py) + 6, f: 0, r: -1 });
    }
    return;
  }
  o.hit = true;
  if (invul <= 0) {
    f = 0.42 + 0.04 * AR;
    v = v * f; if (v < 24) v = 24;
    invul = 1.2 + 0.06 * AR; nitOn = false; crashes++; msgT = 0.9; beep(140, 40);
    if (EFX.length < 3) EFX.push({ x: PX0 + 26, y: Math.floor(py) + 6, f: 0, r: -1 });
  }
}

/* returns -1 running, 1 win, 2 lose */
function raceFrame(dt) {
  var i, o, tgt, rate, ty, stp, rt, gm, rx, show, sc, px1, px2, py1, py2, ins, e, res = -1, d, ds, k, ns, nx, vw, mx;
  tClock += dt; frameNo++;
  /* player speed (exponential approach: cannot overshoot) */
  tgt = VMAX + (nitOn ? 14 + 1.8 * NI : 0);
  rate = (0.8 + 0.06 * EN) * (nitOn ? 1.6 : 1);
  v += (tgt - v) * Math.min(1, rate * dt);
  if (!(v >= 0)) v = 30;
  if (v > 150) v = 150;
  /* nitro */
  if (nitOn) { nit -= dt * 100 / (3 + 0.5 * NI); if (nit <= 0) { nit = 0; nitOn = false; } }
  else { nit += dt * 100 / (14 - 0.8 * NI); if (nit > 100) nit = 100; }
  if (!(nit >= 0)) nit = 0;
  /* lane slide */
  ty = laneTop(lane, CAR_H); stp = (140 + 30 * TI) * dt;
  if (py < ty) { py += stp; if (py > ty) py = ty; } else if (py > ty) { py -= stp; if (py < ty) py = ty; }
  PL.y = py;
  pd += v * dt;
  if (invul > 0) invul -= dt;
  if (msgT > 0) msgT -= dt;
  /* rival */
  rt = rb * (1 + 0.05 * Math.sin(tClock * 0.6 + LV));
  gm = pd - rd; if (gm > 350) rt *= 1.06; else if (gm < -350) rt *= 0.96;
  rvv += (rt - rvv) * Math.min(1, 0.8 * dt);
  rd += rvv * dt;
  rx = PX0 + (rd - pd) * PXM;
  rlT -= dt; if (rlT <= 0) { rlT = 0.5; pickRivalLane(rx); }
  ty = laneTop(rl, CAR_H); stp = 70 * dt;
  if (ry < ty) { ry += stp; if (ry > ty) ry = ty; } else if (ry > ty) { ry -= stp; if (ry < ty) ry = ty; }
  /* spawns */
  spawnT -= dt;
  if (spawnT <= 0) { if (spawnTraffic()) spawnT = spawnGap(); else spawnT = 0.12; }
  pickT -= dt;
  if (pickT <= 0) { spawnPickup(); pickT = 7 + Math.random() * 6; }
  /* traffic move + collisions */
  px1 = PX0 + 2; px2 = PX0 + CAR_W - 2; py1 = py + 2; py2 = py + CAR_H - 2;
  for (i = 0; i < OBJ.length; i++) {
    o = OBJ[i];
    o.x -= (v - o.s) * PXM * dt;
    if (o.x < -70 || o.x > W + 90) { o.dead = true; continue; }
    if (o.hit || o.dead) continue;
    ins = (o.k < 2) ? 2 : 0;
    if (px1 < o.x + o.w - ins && px2 > o.x + ins && py1 < o.y + o.h - ins && py2 > o.y + ins) crashHit(o);
  }
  /* finish */
  if (rd >= RDIST && pd < RDIST) res = 2;
  else if (pd >= RDIST) res = 1;

  /* ---------------- render (no clears, no flicker) ---------------- */
  sc = v * PXM * dt;
  /* lane dashes: only the sliver that changed */
  dAcc += sc; d = Math.floor(dAcc); dAcc -= d; if (d > 24) d = 24;
  if (d > 0) {
    dOff = (dOff + d) % SP;
    for (i = 1; i < LANES; i++) {
      for (k = -1; k < 7; k++) {
        ns = k * SP - dOff;
        fillRect(ns, DIV_Y[i], d, 2, T_D);
        fillRect(ns + LEN, DIV_Y[i], d, 2, T_R);
      }
    }
  }
  /* trees (trailing grass strip erases what each band leaves behind) */
  for (i = 0; i < NT; i++) {
    TX[i] -= sc; nx = Math.floor(TX[i]);
    if (nx + 13 <= 0) {
      fillRect(TO[i], TYS[i], 13, 18, T_G);
      mx = W + 4;
      for (k = 0; k < NT; k++) {
        if (k === i) continue;
        vw = TX[k] + 58 + Math.random() * 60;
        if (vw > mx) mx = vw;
      }
      TX[i] = mx; TO[i] = Math.floor(mx);
      continue;
    }
    vw = TO[i] - nx; if (vw > 24) vw = 24;
    drawTree(nx, TYS[i], vw); TO[i] = nx;
  }
  /* effects: clear old squares */
  for (i = 0; i < EFX.length; i++) efxDraw(EFX[i], true);
  /* sprite sync: repaint only what each sprite vacated */
  for (i = OBJ.length - 1; i >= 0; i--) {
    o = OBJ[i];
    if (o.dead) { syncSprite(o, false); OBJ.splice(i, 1); }
    else syncSprite(o, true);
  }
  RV.x = rx; RV.y = ry;
  syncSprite(RV, rx > -CAR_W && rx < W);
  syncSprite(PL, true);
  /* paint opaque sprites over themselves */
  paintAll();
  /* effects */
  for (i = EFX.length - 1; i >= 0; i--) {
    e = EFX[i]; e.f++;
    if (e.f > 6) { EFX.splice(i, 1); continue; }
    e.r = 2 + e.f * 2; efxDraw(e, false);
  }
  /* HUD */
  hudT -= dt;
  if (hudT <= 0) { hudT = 0.12; hudUpdate(false); progUpdate(false); }
  return res;
}

/* returns 0 quit, 1 win, 2 lose, 3 restart */
function raceRun(L) {
  var last, t0, t1, dt, k, res = -1, errs = 0, c, dir;
  raceInit(L);
  raceDrawAll();
  countdown();
  setGaps(true); settle();
  last = ms();
  while (res < 0) {
    t0 = ms(); dt = (t0 - last) / 1000; last = t0;
    if (!(dt > 0.008)) dt = 0.008;
    if (dt > 0.05) dt = 0.05;
    k = poll();
    if (k === 'R' || k === 'L') {
      dir = (k === 'R') ? 1 : -1; if (cfg.inv) dir = -dir;
      lane = cl(lane + dir, 0, LANES - 1); beep(600, 4);
    } else if (k === 'O') {
      if (nitOn) nitOn = false;
      else if (nit > 5) { nitOn = true; beep(900, 10); }
    } else if (k === 'B') {
      setGaps(false);
      c = listPanel('PAUSED', 'Lv ' + LV + '  ' + T_NAME, ['RESUME', 'RESTART', 'QUIT RACE'], 0);
      if (c === 1) return 3;
      if (c === 2) { if (confirmBox('QUIT RACE?', 'Progress in this race is lost')) return 0; }
      raceDrawAll(); setGaps(true); settle(); last = ms(); continue;
    }
    try { res = raceFrame(dt); } catch (e) { errs++; if (errs > 25) { setGaps(false); throw e; } }
    t1 = ms();
    if (t1 - t0 < 22) sleep(22 - (t1 - t0));
  }
  setGaps(false);
  RS_T = tClock; RS_CR = crashes;
  RS_GAP = Math.floor(res === 1 ? RDIST - rd : RDIST - pd); if (RS_GAP < 0) RS_GAP = 0;
  if (res === 1) { stxt('FINISH!', W / 2, 74, 3, GOLD); sndWin(); }
  else { stxt('RIVAL WINS', W / 2, 74, 3, REDC); sndLose(); }
  drain(900);
  return res;
}

/* ------------------------------------------------------------------ */
/* Save / load (only ever called from a menu choice)                   */
/* ------------------------------------------------------------------ */
function packSave() {
  return 'V=1;S=' + (cfg.sound ? 1 : 0) + ';D=' + cfg.diff + ';I=' + cfg.inv + ';U=' + prog.unlocked + ';P=' + prog.pts +
         ';B=' + prog.body + ';C=' + prog.acc + ';A=' + prog.ups.join(',') + ';K=' + prog.stars.join('');
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
  var s = readSave(), p, i, kv, v2, ks, u;
  if (!s || s.indexOf('V=1') !== 0) return false;
  p = s.split(';');
  for (i = 0; i < p.length; i++) {
    kv = p[i].split('=');
    if (kv.length < 2) continue;
    if (kv[0] === 'A') {
      ks = kv[1].split(',');
      for (v2 = 0; v2 < 4 && v2 < ks.length; v2++) { u = parseInt(ks[v2], 10); prog.ups[v2] = (u >= 0 && u <= UP_MAX) ? u : 0; }
      continue;
    }
    if (kv[0] === 'K') {
      for (v2 = 0; v2 < NL && v2 < kv[1].length; v2++) { u = parseInt(kv[1].charAt(v2), 10); prog.stars[v2] = (u >= 0 && u <= 3) ? u : 0; }
      continue;
    }
    v2 = parseInt(kv[1], 10);
    if (v2 !== v2) continue;
    if (kv[0] === 'S') cfg.sound = (v2 !== 0);
    else if (kv[0] === 'D' && v2 >= 0 && v2 <= 2) cfg.diff = v2;
    else if (kv[0] === 'I' && v2 >= 0 && v2 <= 1) cfg.inv = v2;
    else if (kv[0] === 'U') prog.unlocked = cl(v2, 1, NL);
    else if (kv[0] === 'P') prog.pts = cl(v2, 0, 999);
    else if (kv[0] === 'B') prog.body = cl(v2, 0, NCOL - 1);
    else if (kv[0] === 'C') prog.acc = cl(v2, 0, NCOL - 1);
  }
  prog.dirty = false;
  return true;
}

/* ------------------------------------------------------------------ */
/* Menu screens                                                        */
/* ------------------------------------------------------------------ */
var MENU_ITEMS = ['DRIVE', 'LEVELS', 'GARAGE', 'UPGRADES', 'SETUP', 'SAVE', 'LOAD', 'QUIT'];
function menuLabel(i) {
  if (i === 0) return 'DRIVE  LV ' + cl(prog.unlocked, 1, NL);
  if (i === 3) return prog.pts > 0 ? 'UPGRADES (' + prog.pts + ')' : 'UPGRADES';
  return MENU_ITEMS[i];
}
function menuRow(i, on) {
  var x = 6 + (i % 2) * 158, y = 58 + Math.floor(i / 2) * 25;
  hiBox(x, y, 150, 22, on);
  ctxt(menuLabel(i), x + 75, y + 7, 1, on ? UI.dark : WHITE);
}
function menuRender(sel) {
  var i;
  bgPlain();
  drawCar(12, 16, 2, prog.body, prog.acc, false);
  stxt('NITRO RACER', 208, 14, 2, GOLD);
  stxt('by da cbm', 208, 34, 1, WHITE);
  for (i = 0; i < 8; i++) menuRow(i, i === sel);
}
function menu(start) {
  var sel = cl(start, 0, 7), k, old;
  menuRender(sel); settle();
  while (true) {
    k = waitKey();
    if (k === 'L' || k === 'R') {
      old = sel; sel = (sel + (k === 'R' ? 1 : 7)) % 8;
      sndMove(); menuRow(old, false); menuRow(sel, true);
    } else if (k === 'O') { sndSel(); return sel; }
    else if (k === 'B') { return 7; }
  }
}

function starCells(n, x, y) {
  var i, st = prog.stars[n - 1];
  for (i = 0; i < 3; i++) fillRect(x + i * 8, y, 6, 5, i < st ? GOLD : rgb(70, 74, 96));
}
function lvCell(n, on) {
  var c = (n - 1) % 5, r = Math.floor((n - 1) / 5), x = 14 + c * 60, y = 28 + r * 26;
  var lock = n > prog.unlocked;
  hiBox(x, y, 56, 22, on);
  ctxt('' + n, x + 28, y + 3, 1, lock ? GREY : (on ? UI.dark : WHITE));
  if (lock) fillRect(x + 20, y + 14, 16, 4, GREY); else starCells(n, x + 16, y + 13);
}
function lvHeader(n) {
  fillRect(0, 10, W, 14, UI.dark);
  txt('SELECT LEVEL', 14, 12, 1, GOLD);
  rtxt(THEMES[cl(Math.floor((n - 1) / 5), 0, 4)][0], W - 14, 12, 1, WHITE);
}
function levelSelect() {
  var sel = cl(prog.unlocked, 1, NL), k, old, i;
  bgPlain(); lvHeader(sel);
  for (i = 1; i <= NL; i++) lvCell(i, i === sel);
  settle();
  while (true) {
    k = waitKey();
    if (k === 'L' || k === 'R') {
      old = sel;
      if (k === 'R') sel = sel >= prog.unlocked ? 1 : sel + 1; else sel = sel <= 1 ? prog.unlocked : sel - 1;
      sndMove(); lvCell(old, false); lvCell(sel, true); lvHeader(sel);
    } else if (k === 'O') { sndSel(); return sel; }
    else if (k === 'B') { return 0; }
  }
}

function swRow(row, active) {
  var y = row === 0 ? 88 : 118, cur = row === 0 ? prog.body : prog.acc, i, x;
  for (i = 0; i < NCOL; i++) {
    x = 16 + i * 24;
    outRect(x - 2, y - 2, 24, 18, (i === cur) ? WHITE : UI.dark);
    fillRect(x, y, 20, 14, CC[i]);
  }
  txt(row === 0 ? 'BODY' : 'STRIPE', 16, y - 12, 1, active ? GOLD : GREY);
}
function garageDone(on) { lbRow(100, 140, 120, 18, 'DONE', on); }
function garage() {
  var row = 0, k, d;
  bgPlain();
  ctxt('GARAGE', W / 2, 11, 1, GOLD);
  fillRect(80, 22, 160, 46, rgb(60, 60, 70));
  drawCar(115, 28, 3, prog.body, prog.acc, false);
  swRow(0, true); swRow(1, false); garageDone(false);
  settle();
  while (true) {
    k = waitKey();
    if (k === 'L' || k === 'R') {
      if (row < 2) {
        d = (k === 'R') ? 1 : NCOL - 1;
        if (row === 0) prog.body = (prog.body + d) % NCOL; else prog.acc = (prog.acc + d) % NCOL;
        prog.dirty = true; sndMove();
        swRow(row, true); drawCar(115, 28, 3, prog.body, prog.acc, false);
      }
    } else if (k === 'O') {
      sndSel();
      if (row >= 2) return;
      swRow(row, false); row++;
      if (row < 2) swRow(row, true); else garageDone(true);
    } else if (k === 'B') { return; }
  }
}

var UP_NAME = ['ENGINE', 'TIRES', 'NITRO', 'ARMOR'];
var UP_DESC = ['TOP SPEED + PICKUP', 'LANE GRIP + SPEED', 'BOOST POWER + TIME', 'CRASH DAMAGE CUT'];
function upRow(i, on) {
  var y = 28 + i * 26, j, lv = prog.ups[i];
  hiBox(6, y, 308, 24, on);
  txt(UP_NAME[i], 14, y + 3, 1, on ? UI.dark : WHITE);
  txt(UP_DESC[i], 14, y + 13, 1, on ? UI.dark : GREY);
  for (j = 0; j < UP_MAX; j++) fillRect(150 + j * 14, y + 7, 12, 10, j < lv ? (on ? UI.dark : GOLD) : (on ? rgb(200, 150, 30) : rgb(70, 74, 96)));
  rtxt('' + lv, 308, y + 8, 1, on ? UI.dark : WHITE);
}
function upHeader() {
  fillRect(0, 10, W, 14, UI.dark);
  txt('UPGRADES', 14, 12, 1, GOLD);
  rtxt('POINTS ' + prog.pts, W - 14, 12, 1, prog.pts > 0 ? GREEN : GREY);
}
function upgrades() {
  var sel = 0, k, old, i;
  bgPlain(); upHeader();
  for (i = 0; i < 4; i++) upRow(i, i === sel);
  lbRow(100, 136, 120, 18, 'DONE', sel === 4);
  settle();
  while (true) {
    k = waitKey();
    if (k === 'L' || k === 'R') {
      old = sel; sel = (sel + (k === 'R' ? 1 : 4)) % 5; sndMove();
      if (old < 4) upRow(old, false); else lbRow(100, 136, 120, 18, 'DONE', false);
      if (sel < 4) upRow(sel, true); else lbRow(100, 136, 120, 18, 'DONE', true);
    } else if (k === 'O') {
      if (sel === 4) { sndSel(); return; }
      if (prog.pts > 0 && prog.ups[sel] < UP_MAX) {
        prog.ups[sel]++; prog.pts--; prog.dirty = true; sndSel(); beep(1400, 20);
        upHeader(); upRow(sel, true);
      } else sndErr();
    } else if (k === 'B') { return; }
  }
}

var SET_ROWS = ['SOUND', 'DIFFICULTY', 'STEERING', 'RESET PROGRESS', 'BACK'];
function setVal(i) {
  if (i === 0) return cfg.sound ? 'ON' : 'OFF';
  if (i === 1) return cfg.diff === 0 ? 'EASY' : (cfg.diff === 1 ? 'NORMAL' : 'HARD');
  if (i === 2) return cfg.inv ? 'INVERTED' : 'NORMAL';
  return '';
}
function setRow(i, on) {
  var y = 28 + i * 25;
  hiBox(14, y, 292, 22, on);
  txt(SET_ROWS[i], 24, y + 7, 1, on ? UI.dark : WHITE);
  rtxt(setVal(i), 296, y + 7, 1, on ? UI.dark : GOLD);
}
function setRender(sel) {
  var i;
  bgPlain(); ctxt('SETUP', W / 2, 12, 1, GOLD);
  for (i = 0; i < SET_ROWS.length; i++) setRow(i, i === sel);
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
      else if (sel === 2) { cfg.inv = cfg.inv ? 0 : 1; setRow(2, true); }
      else if (sel === 3) {
        if (confirmBox('RESET PROGRESS?', 'Levels, stars, upgrades cleared')) {
          prog.unlocked = 1; prog.pts = 0; prog.ups = [0, 0, 0, 0];
          for (i = 0; i < NL; i++) prog.stars[i] = 0;
          prog.dirty = true;
        }
        setRender(sel); settle();
      } else { return; }
    } else if (k === 'B') { return; }
  }
}

/* ------------------------------------------------------------------ */
/* Result screens + level flow                                         */
/* ------------------------------------------------------------------ */
function starsFor(cr) { return cr === 0 ? 3 : (cr <= 2 ? 2 : 1); }
function fmtTime(t) { var t10 = Math.floor(t * 10); return Math.floor(t10 / 10) + '.' + (t10 % 10); }
function runResult(win, n, tm, cr, st, gain) {
  var items, k, lab, i;
  while (true) {
    bgPlain();
    if (win) stxt(n >= NL ? 'CHAMPION!' : 'LEVEL ' + n + ' CLEAR!', W / 2, 12, 2, GOLD);
    else stxt('RIVAL WINS', W / 2, 12, 2, REDC);
    for (i = 0; i < 3; i++) fcirc(W / 2 - 30 + i * 30, 42, 8, (win && i < st) ? GOLD : rgb(70, 74, 96));
    if (win) {
      ctxt('TIME ' + fmtTime(tm) + 'S   CRASHES ' + cr + '   LEAD ' + RS_GAP + 'M', W / 2, 56, 1, WHITE);
      ctxt(gain > 0 ? '+' + gain + ' UPGRADE POINT' + (gain > 1 ? 'S' : '') + '!' : 'REPLAY - NO NEW UPGRADE', W / 2, 67, 1, gain > 0 ? GREEN : GREY);
    } else {
      ctxt('RIVAL AHEAD BY ' + RS_GAP + 'M', W / 2, 56, 1, WHITE);
      ctxt('UPGRADE YOUR CAR AND TRY AGAIN', W / 2, 67, 1, GREY);
    }
    items = [];
    if (!win) items.push('RETRY');
    if (prog.pts > 0) items.push('UPGRADES (' + prog.pts + ')');
    if (win && n < NL) items.push('NEXT LEVEL');
    if (win) items.push('SAVE');
    items.push('MENU');
    k = lbRun(90, 80, 140, 18, 2, items, 0);
    lab = (k < 0) ? 'MENU' : items[k];
    if (lab === 'NEXT LEVEL') return 'next';
    if (lab === 'RETRY') return 'retry';
    if (lab === 'MENU') return 'menu';
    if (lab === 'SAVE') { toast(saveGame() ? 'GAME SAVED' : 'SAVE FAILED', WHITE); continue; }
    if (lab.indexOf('UPGRADES') === 0) { upgrades(); continue; }
  }
}
function playLevel(L) {
  var n = L, res, act, st, gain, old;
  while (n >= 1 && n <= NL) {
    res = raceRun(n);
    if (res === 0) return;
    if (res === 3) continue;
    if (res === 1) {
      st = starsFor(RS_CR); old = prog.stars[n - 1]; gain = 0;
      if (old === 0) gain++;
      if (st === 3 && old < 3) gain++;
      if (st > old) prog.stars[n - 1] = st;
      prog.pts += gain;
      if (n < NL && prog.unlocked < n + 1) prog.unlocked = n + 1;
      prog.dirty = true;
      act = runResult(true, n, RS_T, RS_CR, st, gain);
    } else {
      act = runResult(false, n, RS_T, RS_CR, 0, 0);
    }
    if (act === 'next') n++;
    else if (act === 'retry') { }
    else return;
  }
}

function introCar(x, roadC) {
  fillRect(x - 12, 90, 12, 26, roadC);
  fillRect(x + 14, 90, 32, 4, roadC);
  fillRect(x + 14, 112, 32, 4, roadC);
  drawCar(x, 90, 2, prog.body, prog.acc, false);
}
function intro() {
  var x = -64, roadC = rgb(60, 60, 70), i, skip = false, on = true, t, nt, k;
  bgPlain();
  fillRect(0, 82, W, 58, roadC);
  fillRect(0, 82, W, 2, WHITE); fillRect(0, 138, W, 2, WHITE);
  for (i = 0; i < W; i += 40) fillRect(i, 126, 24, 3, rgb(240, 240, 200));
  beep(200, 40);
  while (x < 130) {
    introCar(x, roadC);
    x += 8;
    if (poll() !== '') { skip = true; break; }
    sleep(14);
  }
  x = 130; introCar(x, roadC);
  stxt('NITRO RACER', W / 2, 14, 3, GOLD);
  stxt('by da cbm', W / 2, 44, 2, WHITE);
  if (!skip) tune([[600, 50], [800, 50], [1000, 50], [1400, 120]]);
  settle();
  t = ms(); nt = t;
  while (!skip) {
    if (ms() >= nt) {
      on = !on; nt = ms() + 450;
      fillRect(60, 146, 200, 10, UI.dark);
      if (on) ctxt('PRESS CLICK TO START', W / 2, 147, 1, GREEN);
    }
    k = poll();
    if (k !== '') break;
    sleep(10);
  }
  beep(900, 40);
  settle();
}

function errorScreen(e) {
  var m = '', k;
  try { m = String(e && e.message ? e.message : e); } catch (x) { m = 'unknown'; }
  if (m.length > 38) m = m.substring(0, 38);
  setGaps(false);
  bgPlain();
  stxt('OOPS - RECOVERED', W / 2, 50, 2, WHITE);
  ctxt(m, W / 2, 84, 1, WHITE);
  ctxt('CLICK TO RETURN TO MENU', W / 2, 110, 1, WHITE);
  settle();
  while (true) { k = waitKey(); if (k === 'O' || k === 'B') break; }
}
function main() {
  var errs = 0, sel = 0, c, go = true, n;
  try { intro(); } catch (e0) {}
  while (go) {
    try {
      c = menu(sel); sel = c;
      if (c === 0) { playLevel(cl(prog.unlocked, 1, NL)); }
      else if (c === 1) { n = levelSelect(); if (n > 0) playLevel(n); }
      else if (c === 2) { garage(); }
      else if (c === 3) { upgrades(); }
      else if (c === 4) { setup(); }
      else if (c === 5) { toast(saveGame() ? 'GAME SAVED' : 'SAVE FAILED', WHITE); }
      else if (c === 6) { toast(loadGame() ? 'GAME LOADED' : 'NO SAVE FOUND', WHITE); }
      else { if (!prog.dirty || confirmBox('EXIT GAME?', 'Unsaved progress will be lost')) go = false; }
      errs = 0;
    } catch (e) {
      errs++;
      try { errorScreen(e); } catch (e2) {}
      if (errs >= 5) go = false;
    }
  }
  fillRect(0, 0, W, H, BLACK);
  ctxt('THANKS FOR RACING!', W / 2, 78, 1, GOLD);
  sleep(700);
  fillRect(0, 0, W, H, BLACK);
}
main();

})();
