/*
 * GOLDEN ACE CASINO  v1.0
 * Blackjack / Roulette / Video Poker for Bruce firmware
 * Target: LilyGO T-Embed CC1101 (320x170, rotary encoder)
 *
 * Controls:  Turn = move / change   Click = select   Back = back / quit prompt
 *
 * Written in plain ES5 (no arrow functions, no let/const, no template strings,
 * no nested functions) so it runs on the Bruce interpreter.
 *
 * Stability notes:
 *  - Every screen is drawn once; only small regions are redrawn afterwards.
 *  - Roulette ball animation touches two tiny pockets per step, never a full
 *    screen clear, so there is no flicker.
 *  - All draw / sound / storage calls are wrapped, input is debounced and
 *    direction-filtered, and every game runs inside a crash guard.
 */
(function () {

var PERSIST = false;         // storage calls are unverified on some firmware; leave false unless you want to test saving
var CFG_PATH = '/casino.cfg';

/* ------------------------------------------------------------------ */
/* Modules                                                             */
/* ------------------------------------------------------------------ */
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

/* ------------------------------------------------------------------ */
/* Time, random, sound                                                 */
/* ------------------------------------------------------------------ */
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
var lcg = 123456789;
function rnd(n) {
  var v = Math.random();
  if (!(v >= 0 && v < 1)) { lcg = (lcg * 1103515245 + 12345) % 2147483648; v = lcg / 2147483648; }
  var r = Math.floor(v * n);
  if (r < 0) r = 0; if (r >= n) r = n - 1;
  return r;
}
function seedRng() { var i, c = ms() % 61; for (i = 0; i < c; i++) Math.random(); lcg = (ms() % 2147483647) + 1; }
function shuffle(a) { var i, j, t; for (i = a.length - 1; i > 0; i--) { j = rnd(i + 1); t = a[i]; a[i] = a[j]; a[j] = t; } }

/* ------------------------------------------------------------------ */
/* Colours, themes, card styles, config                                */
/* ------------------------------------------------------------------ */
function rgb(r, g, b) { return ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3); }
var WHITE = rgb(255, 255, 255), BLACK = rgb(0, 0, 0);
var C_WIN = rgb(120, 255, 130), C_LOSE = rgb(255, 120, 110);

var THEMES = [
  { n: 'VEGAS GREEN', felt: rgb(0, 92, 44),  rail: rgb(58, 28, 10), trim: rgb(238, 196, 72), lamp: rgb(255, 250, 220), dark: rgb(0, 46, 22) },
  { n: 'ROYAL BLUE',  felt: rgb(12, 44, 118), rail: rgb(14, 14, 34), trim: rgb(205, 215, 235), lamp: rgb(120, 200, 255), dark: rgb(6, 22, 64) },
  { n: 'RUBY RED',    felt: rgb(112, 16, 28), rail: rgb(36, 8, 10),  trim: rgb(240, 200, 100), lamp: rgb(255, 230, 200), dark: rgb(58, 6, 14) },
  { n: 'NEON NIGHT',  felt: rgb(14, 10, 36),  rail: rgb(0, 0, 0),    trim: rgb(0, 230, 255),   lamp: rgb(255, 50, 200),  dark: rgb(6, 4, 20) }
];
var STYLES = [
  { n: 'CLASSIC', face: rgb(250, 250, 250), edge: rgb(60, 60, 60),   red: rgb(210, 20, 30),  blk: rgb(15, 15, 15),   back: rgb(30, 60, 170), bacc: rgb(240, 240, 240) },
  { n: 'GOLD',    face: rgb(250, 240, 205), edge: rgb(190, 150, 40), red: rgb(150, 10, 30),  blk: rgb(30, 20, 10),   back: rgb(110, 15, 30), bacc: rgb(230, 190, 70) },
  { n: 'NEON',    face: rgb(10, 10, 25),    edge: rgb(0, 255, 230),  red: rgb(255, 40, 200), blk: rgb(60, 255, 120), back: rgb(15, 0, 40),   bacc: rgb(255, 40, 200) },
  { n: 'RETRO',   face: rgb(235, 225, 190), edge: rgb(90, 60, 30),   red: rgb(190, 60, 20),  blk: rgb(40, 50, 90),   back: rgb(30, 100, 60), bacc: rgb(230, 210, 150) }
];
var MAXBANK = 999999;
var cfg = { sound: true, style: 0, theme: 0, bank: 1000 };
function th() { return THEMES[cfg.theme]; }

function clampBank(v) { if (!(v >= 0)) v = 0; if (v > MAXBANK) v = MAXBANK; return Math.floor(v); }

function saveCfg() {
  if (!PERSIST || !S) return;
  try {
    S.write({ fs: 'littlefs', path: CFG_PATH },
      'S=' + (cfg.sound ? 1 : 0) + ';C=' + cfg.style + ';T=' + cfg.theme + ';B=' + cfg.bank, 'write');
  } catch (e) {}
}
function loadCfg() {
  if (!PERSIST || !S) return;
  try {
    var s = S.read({ fs: 'littlefs', path: CFG_PATH });
    if (typeof s !== 'string') return;
    var p = s.split(';'), i, kv, v;
    for (i = 0; i < p.length; i++) {
      kv = p[i].split('='); v = parseInt(kv[1], 10);
      if (v !== v) continue;
      if (kv[0] === 'S') cfg.sound = (v !== 0);
      else if (kv[0] === 'C' && v >= 0 && v < STYLES.length) cfg.style = v;
      else if (kv[0] === 'T' && v >= 0 && v < THEMES.length) cfg.theme = v;
      else if (kv[0] === 'B' && v >= 0 && v <= MAXBANK) cfg.bank = v;
    }
  } catch (e) {}
}

var lastBeep = 0;
function beep(f, d) {
  var t;
  if (!cfg.sound || !A) return;
  t = ms();
  if (t - lastBeep < 30) return;          // never hammer the speaker driver
  lastBeep = t;
  try { A.tone(f, d); } catch (e) {}
}
function tune(seq) {
  var i;
  if (!cfg.sound || !A) return;
  for (i = 0; i < seq.length; i++) { try { A.tone(seq[i][0], seq[i][1]); } catch (e) {} sleep(seq[i][1]); }
}
function sndDeal() { beep(1400, 10); }
function sndChip() { beep(900, 8); }
function sndMove() { beep(700, 4); }
function sndWin() { tune([[784, 70], [988, 70], [1175, 70], [1568, 140]]); }
function sndBig() { tune([[659, 80], [784, 80], [988, 80], [1319, 80], [1568, 80], [2093, 200]]); }
function sndLose() { tune([[330, 120], [262, 220]]); }
function sndPush() { tune([[600, 90], [600, 90]]); }
function sndErr() { beep(200, 80); }

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
/* Casino background and suit / card drawing                           */
/* ------------------------------------------------------------------ */
function frame() {
  var t = th(), i, c;
  fillRect(0, 0, W, H, t.rail);
  rrect(7, 7, W - 14, H - 14, 8, t.felt);
  rrectO(6, 6, W - 12, H - 12, 9, t.trim);
  for (i = 0; i * 12 + 12 < W - 8; i++) {
    c = (i % 2) ? t.trim : t.lamp;
    fcirc(12 + i * 12, 2, 1, c); fcirc(12 + i * 12, H - 3, 1, c);
  }
  for (i = 0; i * 12 + 12 < H - 8; i++) {
    c = (i % 2) ? t.lamp : t.trim;
    fcirc(2, 12 + i * 12, 1, c); fcirc(W - 3, 12 + i * 12, 1, c);
  }
}
function chip(x, y, r, c) {
  var k, a;
  fcirc(x, y, r, c);
  circ(x, y, r, WHITE);
  for (k = 0; k < 8; k++) {
    a = k * 0.7854;
    fcirc(x + (r - 2) * Math.cos(a), y + (r - 2) * Math.sin(a), 1, WHITE);
  }
  circ(x, y, Math.max(2, r - 5), WHITE);
}
/* s: 0 spade 1 heart 2 diamond 3 club, r = half height */
function suit(s, cx, cy, r, c) {
  var a, w, y0, b;
  if (r < 3) r = 3;
  if (s === 1) {
    a = Math.floor(r * 0.5 + 0.5);
    fcirc(cx - a, cy - a, a, c); fcirc(cx + a, cy - a, a, c);
    tri(cx - 2 * a, cy - a + 1, cx + 2 * a, cy - a + 1, cx, cy + r, c);
  } else if (s === 2) {
    w = Math.floor(r * 0.7 + 0.5);
    tri(cx, cy - r, cx - w, cy, cx + w, cy, c);
    tri(cx - w, cy, cx + w, cy, cx, cy + r, c);
  } else if (s === 0) {
    a = Math.floor(r * 0.5 + 0.5); y0 = cy + Math.floor(r * 0.25);
    fcirc(cx - a, y0, a, c); fcirc(cx + a, y0, a, c);
    tri(cx - 2 * a, y0, cx + 2 * a, y0, cx, cy - r, c);
    tri(cx, y0, cx - a, cy + r, cx + a, cy + r, c);
  } else {
    b = Math.floor(r * 0.42 + 0.5);
    fcirc(cx, cy - r + b, b, c);
    fcirc(cx - b, cy + Math.floor(r * 0.1), b, c);
    fcirc(cx + b, cy + Math.floor(r * 0.1), b, c);
    fcirc(cx, cy - Math.floor(r * 0.1), b, c);
    tri(cx, cy, cx - b, cy + r, cx + b, cy + r, c);
  }
}
var RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
function drawCard(x, y, w, h, c, up) {
  var st = STYLES[cfg.style], r, s, col, sz, dm;
  x = Math.floor(x); y = Math.floor(y);
  if (!up || c < 0 || c > 51) {
    rrect(x, y, w, h, 3, st.bacc);
    rrect(x + 1, y + 1, w - 2, h - 2, 3, st.back);
    rrectO(x + 3, y + 3, w - 6, h - 6, 2, st.bacc);
    dm = Math.floor(Math.min(w, h) / 4);
    tri(x + w / 2, y + h / 2 - dm, x + w / 2 - dm * 0.7, y + h / 2, x + w / 2 + dm * 0.7, y + h / 2, st.bacc);
    tri(x + w / 2 - dm * 0.7, y + h / 2, x + w / 2 + dm * 0.7, y + h / 2, x + w / 2, y + h / 2 + dm, st.bacc);
    return;
  }
  r = c % 13; s = Math.floor(c / 13);
  col = (s === 1 || s === 2) ? st.red : st.blk;
  sz = (w >= 44) ? 2 : 1;
  rrect(x, y, w, h, 3, st.edge);
  rrect(x + 1, y + 1, w - 2, h - 2, 3, st.face);
  txt(RANKS[r], x + 3, y + 3, sz, col);
  txt(RANKS[r], x + w - 3 - tw(RANKS[r], sz), y + h - 3 - 8 * sz, sz, col);
  if (sz === 2) suit(s, x + 8, y + 3 + 16 + 7, 5, col);
  suit(s, x + w / 2, y + h / 2 + (sz === 2 ? 2 : 1), Math.floor(h * 0.2), col);
}

/* ------------------------------------------------------------------ */
/* Shared dialogs                                                      */
/* ------------------------------------------------------------------ */
function bankLabel(x, y, w) {
  var t = th();
  fillRect(x, y, w, 9, t.felt);
  rtxt('BANK ' + money(cfg.bank), x + w, y, 1, t.trim);
}
function qDraw(x, y, w, h, sel, msg) {
  var t = th();
  rrect(x, y, w, h, 6, t.dark);
  rrectO(x, y, w, h, 6, t.trim);
  rrectO(x + 2, y + 2, w - 4, h - 4, 5, t.trim);
  ctxt('QUIT GAME?', x + w / 2, y + 8, 2, t.trim);
  if (msg) ctxt(msg, x + w / 2, y + 27, 1, WHITE);
  hiBox(x + 22, y + h - 25, 74, 18, sel === 0);
  hiBox(x + w - 96, y + h - 25, 74, 18, sel === 1);
  ctxt('YES', x + 59, y + h - 20, 1, sel === 0 ? t.dark : WHITE);
  ctxt('NO', x + w - 59, y + h - 20, 1, sel === 1 ? t.dark : WHITE);
  hiArrows(x + 22, y + h - 25, 74, 18, sel === 0);
  hiArrows(x + w - 96, y + h - 25, 74, 18, sel === 1);
}
/* returns true if the player really wants to leave */
function confirmQuit(redraw, msg) {
  var w = 216, h = 78, x = Math.floor((W - w) / 2), y = Math.floor((H - h) / 2), sel = 1, k;
  qDraw(x, y, w, h, sel, msg);
  settle();
  while (true) {
    k = waitKey();
    if (k === 'L' || k === 'R') { sel = 1 - sel; sndMove(); qDraw(x, y, w, h, sel, msg); }
    else if (k === 'O') {
      if (sel === 0) return true;
      redraw(); settle(); return false;
    } else if (k === 'B') { redraw(); settle(); return false; }
  }
}
var LADDER = [10, 20, 30, 40, 50, 75, 100, 150, 200, 300, 400, 500, 750, 1000, 1500, 2000, 3000, 5000, 7500, 10000, 25000, 50000, 100000];
var lastIdx = { bj: 3, rl: 1, pk: 3 };
function ladderMax() { var i, m = -1; for (i = 0; i < LADDER.length; i++) if (LADDER[i] <= cfg.bank) m = i; return m; }
function toast(msg, col) {
  var t = th(), w = Math.max(160, tw(msg, 1) + 24), h = 30, x = Math.floor((W - w) / 2), y = Math.floor((H - h) / 2);
  rrect(x, y, w, h, 6, t.dark); rrectO(x, y, w, h, 6, t.trim);
  ctxt(msg, W / 2, y + 11, 1, col);
  sleep(1300);
}
function refillIfBroke(redraw) {
  if (cfg.bank < 10) {
    cfg.bank = 500;
    toast('HOUSE LOAN: $500 IN CHIPS', th().trim);
    redraw(); settle();
  }
}
function betPanel(idx, lines, full) {
  var t = th(), n = lines ? lines.length : 0, w = 244, h = 66 + 9 * n;
  var x = Math.floor((W - w) / 2), y = Math.floor((H - h) / 2), i;
  if (full) {
    rrect(x, y, w, h, 7, t.dark); rrectO(x, y, w, h, 7, t.trim);
    ctxt('PLACE YOUR BET', W / 2, y + 6, 1, t.trim);
    ctxt('TURN = AMOUNT   CLICK = OK', W / 2, y + 54, 1, WHITE);
    for (i = 0; i < n; i++) txt(lines[i], x + 40, y + 64 + 9 * i, 1, WHITE);
  }
  fillRect(x + 10, y + 16, w - 20, 24, t.dark);
  ctxt(money(LADDER[idx]), W / 2, y + 17, 3, WHITE);
  fillRect(x + 10, y + 42, w - 20, 9, t.dark);
  ctxt('BANK ' + money(cfg.bank), W / 2, y + 42, 1, t.trim);
}
/* returns the bet or -1 if the player quit */
function askBet(key, redraw, lines) {
  var maxI, idx, k;
  maxI = ladderMax();
  if (maxI < 0) { refillIfBroke(redraw); maxI = ladderMax(); if (maxI < 0) return -1; }
  idx = Math.min(lastIdx[key], maxI);
  betPanel(idx, lines, true);
  settle();
  while (true) {
    k = waitKey();
    if (k === 'R') { if (idx < maxI) { idx++; sndChip(); betPanel(idx, lines, false); } }
    else if (k === 'L') { if (idx > 0) { idx--; sndChip(); betPanel(idx, lines, false); } }
    else if (k === 'O') { lastIdx[key] = idx; sndChip(); return LADDER[idx]; }
    else if (k === 'B') {
      if (confirmQuit(redraw, '')) return -1;
      betPanel(idx, lines, true); settle();
    }
  }
}

/* ------------------------------------------------------------------ */
/* BLACKJACK                                                           */
/* ------------------------------------------------------------------ */
var BJW = 34, BJH = 46, BJSP = 24, BJX0 = 30, BJDY = 31, BJPY = 90, BJROW = 142;
var bj = { shoe: [], dealer: [], player: [], hide: true, bet: 0, phase: 'bet', opts: [], sel: 0, msg: '', mcol: 0 };
function bjNewShoe() { var d = [], i; for (i = 0; i < 208; i++) d.push(i % 52); shuffle(d); bj.shoe = d; }
function bjDrawCard() { if (bj.shoe.length < 1) bjNewShoe(); return bj.shoe.pop(); }
function bjVal(h) {
  var t = 0, a = 0, i, r;
  for (i = 0; i < h.length; i++) {
    r = h[i] % 13;
    if (r === 12) { a++; t += 11; } else if (r >= 8) t += 10; else t += r + 2;
  }
  while (t > 21 && a > 0) { t -= 10; a--; }
  return t;
}
function bjLabels() {
  var t = th(), dv = bj.hide ? (bj.dealer.length ? '?' : '') : bjVal(bj.dealer);
  fillRect(BJX0, 21, 180, 9, t.felt);
  txt('DEALER  ' + dv, BJX0, 21, 1, WHITE);
  fillRect(BJX0, 80, 180, 9, t.felt);
  txt('YOU  ' + (bj.player.length ? bjVal(bj.player) : ''), BJX0, 80, 1, t.trim);
}
function bjChipDraw() {
  var t = th();
  fillRect(262, 92, 46, 46, t.felt);
  if (bj.bet > 0) {
    chip(285, 106, 13, rgb(170, 20, 30));
    ctxt(money(bj.bet), 285, 124, 1, WHITE);
  }
}
function bjCardAt(hand, i, y) { drawCard(BJX0 + i * BJSP, y, BJW, BJH, hand[i], !(y === BJDY && i === 1 && bj.hide)); }
function bjBtn(i, n, label, sel) {
  var t = th(), w = 88, g = 8, tot = n * w + (n - 1) * g, x = Math.floor((W - tot) / 2) + i * (w + g), y = BJROW;
  hiBox(x, y, w, 16, sel);
  ctxt(label, x + w / 2, y + 4, 1, sel ? t.dark : WHITE);
  hiArrows(x, y, w, 16, sel);
}
function bjButtons(old) {
  var i, n = bj.opts.length;
  if (old < 0) { fillRect(10, BJROW - 2, W - 20, 20, th().felt); for (i = 0; i < n; i++) bjBtn(i, n, bj.opts[i], i === bj.sel); }
  else { bjBtn(old, n, bj.opts[old], false); bjBtn(bj.sel, n, bj.opts[bj.sel], true); }
}
function bjMsgRow() {
  var t = th();
  fillRect(10, BJROW - 2, W - 20, 20, t.felt);
  ctxt(bj.msg, W / 2, BJROW, 2, bj.mcol);
  rtxt('CLICK', W - 14, BJROW + 4, 1, t.trim);
}
function bjRender() {
  var i, t = th();
  frame();
  txt('BLACKJACK', 16, 11, 1, t.trim);
  bankLabel(190, 11, 122);
  bjLabels();
  for (i = 0; i < bj.dealer.length; i++) bjCardAt(bj.dealer, i, BJDY);
  for (i = 0; i < bj.player.length; i++) bjCardAt(bj.player, i, BJPY);
  bjChipDraw();
  if (bj.phase === 'play') bjButtons(-1);
  else if (bj.phase === 'result') bjMsgRow();
}
function bjAdd(toDealer) {
  var hand = toDealer ? bj.dealer : bj.player, c = bjDrawCard();
  hand.push(c);
  bjCardAt(hand, hand.length - 1, toDealer ? BJDY : BJPY);
  bjLabels();
  sndDeal();
}
function bjOpts() {
  var o = ['HIT', 'STAND'];
  if (bj.player.length === 2 && cfg.bank >= bj.bet) o.push('DOUBLE');
  return o;
}
function bjPlayerTurn() {
  var k, a, v, old;
  bj.phase = 'play'; bj.opts = bjOpts(); bj.sel = 0; bjButtons(-1);
  settle();
  while (true) {
    k = waitKey();
    if (k === 'L' || k === 'R') {
      old = bj.sel; bj.sel = (bj.sel + (k === 'R' ? 1 : bj.opts.length - 1)) % bj.opts.length;
      sndMove(); bjButtons(old);
    } else if (k === 'O') {
      a = bj.opts[bj.sel];
      if (a === 'HIT') {
        bjAdd(false); v = bjVal(bj.player);
        if (v > 21) return 'bust';
        if (v === 21) return 'stand';
        bj.opts = bjOpts(); bj.sel = 0; bjButtons(-1);
      } else if (a === 'STAND') { return 'stand'; }
      else if (a === 'DOUBLE') {
        cfg.bank = clampBank(cfg.bank - bj.bet); bj.bet = bj.bet * 2;
        bankLabel(190, 11, 122); bjChipDraw();
        bjAdd(false);
        return (bjVal(bj.player) > 21) ? 'bust' : 'stand';
      }
    } else if (k === 'B') {
      if (confirmQuit(bjRender, 'Your bet is forfeited')) return 'quit';
      settle();
    }
  }
}
function playBlackjack() {
  var bet, res, pv, dv, win, k, net;
  bjNewShoe();
  while (true) {
    if (bj.shoe.length < 60) bjNewShoe();
    bj.dealer = []; bj.player = []; bj.hide = true; bj.bet = 0; bj.phase = 'bet'; bj.msg = '';
    bjRender();
    bet = askBet('bj', bjRender, []);
    if (bet < 0) return;
    cfg.bank = clampBank(cfg.bank - bet); bj.bet = bet;
    bjRender(); sleep(200);
    bjAdd(false); sleep(180); bjAdd(true); sleep(180); bjAdd(false); sleep(180); bjAdd(true); sleep(250);
    pv = bjVal(bj.player); dv = bjVal(bj.dealer);
    res = '';
    if (pv === 21 || dv === 21) {
      bj.hide = false; bjCardAt(bj.dealer, 1, BJDY); bjLabels(); sleep(500);
      res = (pv === 21 && dv === 21) ? 'push' : (pv === 21 ? 'bj' : 'lose');
    } else {
      res = bjPlayerTurn();
      if (res === 'quit') return;
      if (res === 'stand') {
        bj.hide = false; bjCardAt(bj.dealer, 1, BJDY); bjLabels(); sleep(550);
        while (bjVal(bj.dealer) < 17) { bjAdd(true); sleep(550); }
        dv = bjVal(bj.dealer); pv = bjVal(bj.player);
        if (dv > 21 || pv > dv) res = 'win'; else if (pv === dv) res = 'push'; else res = 'lose';
      } else { res = 'lose'; }
    }
    if (res === 'bj') { win = bj.bet + Math.floor(bj.bet * 1.5); cfg.bank = clampBank(cfg.bank + bj.bet + win); net = win; bj.msg = 'BLACKJACK! +' + money(net); bj.mcol = C_WIN; }
    else if (res === 'win') { cfg.bank = clampBank(cfg.bank + bj.bet * 2); net = bj.bet; bj.msg = 'YOU WIN +' + money(net); bj.mcol = C_WIN; }
    else if (res === 'push') { cfg.bank = clampBank(cfg.bank + bj.bet); bj.msg = 'PUSH'; bj.mcol = WHITE; }
    else { bj.msg = (bjVal(bj.player) > 21) ? 'BUST -' + money(bj.bet) : 'DEALER WINS -' + money(bj.bet); bj.mcol = C_LOSE; }
    bj.phase = 'result';
    bankLabel(190, 11, 122); bjMsgRow();
    if (res === 'bj') sndBig(); else if (res === 'win') sndWin(); else if (res === 'push') sndPush(); else sndLose();
    settle();
    while (true) {
      k = waitKey();
      if (k === 'O') break;
      if (k === 'B') { if (confirmQuit(bjRender, '')) return; settle(); }
    }
  }
}

/* ------------------------------------------------------------------ */
/* ROULETTE (European, single zero)                                    */
/* ------------------------------------------------------------------ */
var WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
var REDS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
var isRed = [];
(function () { var i; for (i = 0; i < 37; i++) isRed.push(false); for (i = 0; i < REDS.length; i++) isRed[REDS[i]] = true; })();
var C_RED = rgb(200, 20, 30), C_BLK = rgb(24, 24, 24), C_GRN = rgb(0, 140, 60), C_WOOD = rgb(96, 54, 22), C_BED = rgb(40, 22, 8);
function pocketCol(n) { if (n === 0) return C_GRN; return isRed[n] ? C_RED : C_BLK; }
var RCX = 76, RCY = 88, RPR = 54;
var RPX = [], RPY = [];
(function () { var i, a; for (i = 0; i < 37; i++) { a = -1.5708 + i * 6.28318 / 37; RPX.push(Math.floor(RCX + RPR * Math.cos(a) + 0.5)); RPY.push(Math.floor(RCY + RPR * Math.sin(a) + 0.5)); } })();
var RL_OPTS = [
  { n: 'RED', t: 'red' }, { n: 'BLACK', t: 'black' }, { n: 'ODD', t: 'odd' }, { n: 'EVEN', t: 'even' },
  { n: '1-18', t: 'low' }, { n: '19-36', t: 'high' }, { n: '1ST 12', t: 'd1' }, { n: '2ND 12', t: 'd2' }, { n: '3RD 12', t: 'd3' },
  { n: 'COL 1', t: 'c1' }, { n: 'COL 2', t: 'c2' }, { n: 'COL 3', t: 'c3' }, { n: 'NUMBER', t: 'num' },
  { n: 'REBET', t: 'rebet' }, { n: 'CLEAR', t: 'clear' }, { n: 'SPIN!', t: 'spin' }
];
var PX = 150, PW = 162;
var rl = { bets: [], last: [], mode: 'menu', optI: 0, num: 0, amtI: 1, ball: 0, shown: -1, msg: '', mcol: 0 };

function rlName(b) {
  var i;
  if (b.t === 'num') return '#' + b.n;
  for (i = 0; i < RL_OPTS.length; i++) if (RL_OPTS[i].t === b.t) return RL_OPTS[i].n;
  return '?';
}
function rlStake() { var i, s = 0; for (i = 0; i < rl.bets.length; i++) s += rl.bets[i].amt; return s; }
function rlWins(b, n) {
  var t = b.t;
  if (t === 'num') return n === b.n;
  if (n === 0) return false;
  if (t === 'red') return isRed[n];
  if (t === 'black') return !isRed[n];
  if (t === 'odd') return n % 2 === 1;
  if (t === 'even') return n % 2 === 0;
  if (t === 'low') return n <= 18;
  if (t === 'high') return n >= 19;
  if (t === 'd1') return n <= 12;
  if (t === 'd2') return n >= 13 && n <= 24;
  if (t === 'd3') return n >= 25;
  if (t === 'c1') return n % 3 === 1;
  if (t === 'c2') return n % 3 === 2;
  if (t === 'c3') return n % 3 === 0;
  return false;
}
function rlPay(t) { if (t === 'num') return 35; if (t.charAt(0) === 'd' || t.charAt(0) === 'c') return 2; return 1; }
function rlPocket(i, ball) {
  fcirc(RPX[i], RPY[i], 4, pocketCol(WHEEL[i]));
  if (ball) fcirc(RPX[i], RPY[i], 2, WHITE);
}
function rlHub() {
  var t = th();
  fcirc(RCX, RCY, 44, rgb(10, 50, 25));
  circ(RCX, RCY, 44, t.trim);
  fcirc(RCX, RCY, 7, t.trim); fcirc(RCX, RCY, 3, C_WOOD);
}
function rlCenter(n) {
  var col = pocketCol(n);
  fcirc(RCX, RCY, 26, col); circ(RCX, RCY, 26, WHITE); circ(RCX, RCY, 25, WHITE);
  ctxt(String(n), RCX, RCY - 11, 3, WHITE);
}
function rlWheel() {
  var t = th(), i;
  fcirc(RCX, RCY, 66, C_WOOD); circ(RCX, RCY, 66, t.trim); circ(RCX, RCY, 65, t.trim);
  fcirc(RCX, RCY, 61, C_BED);
  for (i = 0; i < 37; i++) rlPocket(i, i === rl.ball);
  rlHub();
  if (rl.shown >= 0) rlCenter(rl.shown);
}
function rlHeader() {
  var t = th();
  fillRect(PX, 10, PW, 10, t.felt);
  txt('ROULETTE', PX, 11, 1, t.trim);
  rtxt('BANK ' + money(cfg.bank), PX + PW, 11, 1, t.trim);
  fillRect(PX, 24, PW, 9, t.felt);
  txt('BETS ' + rl.bets.length + '   STAKE ' + money(rlStake()), PX, 24, 1, WHITE);
}
function rlSelector() {
  var t = th(), x = PX, y = 38, w = PW, h = 30, s = '', bg = t.dark, fg = WHITE;
  if (rl.mode === 'menu') { s = '< ' + RL_OPTS[rl.optI].n + ' >'; }
  else if (rl.mode === 'num') { s = 'NO. ' + rl.num; bg = pocketCol(rl.num); }
  else if (rl.mode === 'amt') { s = money(LADDER[rl.amtI]); bg = t.dark; fg = t.trim; }
  else { s = 'NO MORE BETS'; }
  fillRect(x, y, w, h, t.felt);
  rrect(x, y, w, h, 5, bg); rrectO(x, y, w, h, 5, t.trim);
  ctxt(s, x + w / 2, y + 8, 2, fg);
}
function rlHint() {
  var t = th(), a = '', b = '';
  if (rl.mode === 'menu') { a = 'TURN: CHOOSE BET'; b = 'CLICK: SELECT  BACK: QUIT'; }
  else if (rl.mode === 'num') { a = 'TURN: PICK NUMBER'; b = 'CLICK: OK  BACK: CANCEL'; }
  else if (rl.mode === 'amt') { a = 'TURN: CHIP SIZE'; b = 'CLICK: PLACE  BACK: CANCEL'; }
  else { a = 'WHEEL IS SPINNING...'; }
  fillRect(PX, 72, PW, 20, t.felt);
  txt(a, PX, 73, 1, t.trim); txt(b, PX, 83, 1, WHITE);
}
function rlSlip() {
  var t = th(), n = rl.bets.length, i, start = 0, rows = 5, y;
  fillRect(PX, 95, PW, 48, t.felt);
  if (n === 0) { txt('NO BETS PLACED', PX, 97, 1, rgb(150, 150, 150)); return; }
  if (n > rows) { start = n - (rows - 1); txt('+' + start + ' MORE...', PX, 95, 1, rgb(150, 150, 150)); rows = rows - 1; }
  for (i = 0; i < rows && start + i < n; i++) {
    y = 95 + (n > 5 ? 9 : 0) + i * 9;
    txt(rlName(rl.bets[start + i]), PX, y, 1, WHITE);
    rtxt(money(rl.bets[start + i].amt), PX + PW - 4, y, 1, t.trim);
  }
}
function rlResult() {
  var t = th();
  fillRect(PX, 146, PW, 14, t.felt);
  if (rl.msg) txt(rl.msg, PX, 149, 1, rl.mcol);
}
function rlRender() {
  frame();
  rlWheel(); rlHeader(); rlSelector(); rlHint(); rlSlip(); rlResult();
}
function rlPlace(t, n, amt) {
  var i, b;
  if (amt > cfg.bank) return false;
  for (i = 0; i < rl.bets.length; i++) {
    b = rl.bets[i];
    if (b.t === t && b.n === n) { if (b.amt + amt > 100000) return false; b.amt += amt; cfg.bank = clampBank(cfg.bank - amt); return true; }
  }
  if (rl.bets.length >= 12) return false;
  rl.bets.push({ t: t, n: n, amt: amt });
  cfg.bank = clampBank(cfg.bank - amt);
  return true;
}
function rlRefresh() { rlHeader(); rlSelector(); rlHint(); rlSlip(); rlResult(); }
function rlNote(s, col) { rl.msg = s; rl.mcol = col; rlResult(); }
function rlSpin() {
  var target = rnd(37), s = rl.ball, total, k, rem, d, prev, pos, f;
  total = (2 + rnd(2)) * 37 + ((target - s + 37) % 37);
  if (total < 40) total += 37;
  rl.shown = -1; rl.mode = 'spin';
  rlHub(); rlHint(); rlSelector();
  prev = s;
  for (k = 1; k <= total; k++) {
    pos = (s + k) % 37;
    rlPocket(prev, false);
    rlPocket(pos, true);
    prev = pos;
    rem = total - k;
    if (rem < 22 && rem % 2 === 0) beep(1500, 8);
    d = (rem > 30) ? 10 : 10 + Math.floor((30 - rem) * (30 - rem) * 0.26);
    sleep(d);
    poll();
  }
  rl.ball = prev;
  for (f = 0; f < 3; f++) { fcirc(RPX[prev], RPY[prev], 4, th().trim); sleep(130); rlPocket(prev, true); sleep(130); }
  rl.shown = WHEEL[prev];
  rlCenter(rl.shown);
  return WHEEL[prev];
}
function rlResolve(n) {
  var i, b, stake = 0, ret = 0, net;
  for (i = 0; i < rl.bets.length; i++) {
    b = rl.bets[i]; stake += b.amt;
    if (rlWins(b, n)) ret += b.amt * (1 + rlPay(b.t));
  }
  cfg.bank = clampBank(cfg.bank + ret);
  net = ret - stake;
  var cn = (n === 0) ? 'GREEN' : (isRed[n] ? 'RED' : 'BLACK');
  if (net > 0) { rl.msg = n + ' ' + cn + '  WIN +' + money(net); rl.mcol = C_WIN; if (net >= stake * 5) sndBig(); else sndWin(); }
  else if (net === 0) { rl.msg = n + ' ' + cn + '  EVEN'; rl.mcol = WHITE; sndPush(); }
  else { rl.msg = n + ' ' + cn + '  LOSE -' + money(-net); rl.mcol = C_LOSE; sndLose(); }
  rl.last = rl.bets; rl.bets = [];
}
function playRoulette() {
  var k, act, o, maxI, i, tot, ok;
  rl.bets = []; rl.last = []; rl.mode = 'menu'; rl.msg = ''; rl.shown = -1; rl.ball = 0; rl.optI = 0;
  if (cfg.bank < 10) { cfg.bank = 500; rl.msg = 'HOUSE LOAN $500'; rl.mcol = th().trim; }
  rlRender();
  settle();
  while (true) {
    k = waitKey();
    if (rl.mode === 'menu') {
      if (k === 'R' || k === 'L') {
        rl.optI = (rl.optI + (k === 'R' ? 1 : RL_OPTS.length - 1)) % RL_OPTS.length;
        sndMove(); rlSelector();
      } else if (k === 'O') {
        act = RL_OPTS[rl.optI].t;
        if (act === 'spin') {
          if (rl.bets.length === 0) { sndErr(); rlNote('PLACE A BET FIRST', C_LOSE); }
          else {
            rl.msg = ''; rlResult();
            o = rlSpin(); rlResolve(o);
            rl.mode = 'menu';
            if (cfg.bank < 10 && rl.bets.length === 0) { /* loan offered on next bet */ }
            rlRefresh(); settle();
          }
        } else if (act === 'clear') {
          if (rl.bets.length) { cfg.bank = clampBank(cfg.bank + rlStake()); rl.bets = []; sndChip(); rlNote('', 0); rlHeader(); rlSlip(); }
          else sndErr();
        } else if (act === 'rebet') {
          tot = 0; for (i = 0; i < rl.last.length; i++) tot += rl.last[i].amt;
          if (!rl.last.length) { sndErr(); rlNote('NOTHING TO REPEAT', C_LOSE); }
          else if (tot > cfg.bank) { sndErr(); rlNote('NOT ENOUGH CHIPS', C_LOSE); }
          else {
            ok = true;
            for (i = 0; i < rl.last.length; i++) if (!rlPlace(rl.last[i].t, rl.last[i].n, rl.last[i].amt)) ok = false;
            sndChip(); rlNote(ok ? 'LAST BETS REPEATED' : 'SOME BETS SKIPPED', ok ? C_WIN : C_LOSE); rlHeader(); rlSlip();
          }
        } else {
          maxI = ladderMax();
          if (maxI < 0) {
            if (rl.bets.length === 0) { cfg.bank = 500; rlNote('HOUSE LOAN $500', th().trim); rlHeader(); }
            else { sndErr(); rlNote('NO CHIPS LEFT - SPIN!', C_LOSE); }
          } else {
            rl.msg = ''; rlResult();
            rl.mode = (act === 'num') ? 'num' : 'amt';
            rl.amtI = Math.min(lastIdx.rl, maxI);
            sndChip(); rlSelector(); rlHint();
          }
        }
      } else if (k === 'B') {
        if (confirmQuit(rlRender, 'Unspun bets are refunded')) {
          cfg.bank = clampBank(cfg.bank + rlStake()); rl.bets = [];
          return;
        }
        settle();
      }
    } else if (rl.mode === 'num') {
      if (k === 'R') { rl.num = (rl.num + 1) % 37; sndMove(); rlSelector(); }
      else if (k === 'L') { rl.num = (rl.num + 36) % 37; sndMove(); rlSelector(); }
      else if (k === 'O') { rl.mode = 'amt'; rl.amtI = Math.min(rl.amtI, Math.max(0, ladderMax())); sndChip(); rlSelector(); rlHint(); }
      else if (k === 'B') { rl.mode = 'menu'; rlSelector(); rlHint(); }
    } else if (rl.mode === 'amt') {
      maxI = ladderMax();
      if (k === 'R') { if (rl.amtI < maxI) { rl.amtI++; sndChip(); rlSelector(); } }
      else if (k === 'L') { if (rl.amtI > 0) { rl.amtI--; sndChip(); rlSelector(); } }
      else if (k === 'O') {
        act = RL_OPTS[rl.optI].t;
        if (maxI >= 0 && rlPlace(act, act === 'num' ? rl.num : 0, LADDER[Math.min(rl.amtI, maxI)])) {
          lastIdx.rl = Math.min(rl.amtI, maxI); sndChip(); rl.mode = 'menu';
          rlHeader(); rlSelector(); rlHint(); rlSlip();
        } else { sndErr(); rl.mode = 'menu'; rlNote('BET NOT ACCEPTED', C_LOSE); rlSelector(); rlHint(); }
      } else if (k === 'B') { rl.mode = 'menu'; rlSelector(); rlHint(); }
    } else { rl.mode = 'menu'; rlRefresh(); }
  }
}

/* ------------------------------------------------------------------ */
/* VIDEO POKER (Jacks or Better, 5 card draw)                          */
/* ------------------------------------------------------------------ */
var PCW = 48, PCH = 66, PGAP = 8, PX0 = 24, PY = 44;
var pk = { deck: [], hand: [], held: [false, false, false, false, false], cur: 0, phase: 'bet', msg: '', mcol: 0, bet: 0 };
var PK_LINES = [
  'ROYAL FLUSH      x250', 'STRAIGHT FLUSH   x50', 'FOUR OF A KIND   x25', 'FULL HOUSE        x9',
  'FLUSH             x6', 'STRAIGHT          x4', 'THREE OF A KIND  x3', 'TWO PAIR          x2', 'JACKS OR BETTER  x1'
];
function pkX(i) { return PX0 + i * (PCW + PGAP); }
function pkEval(h) {
  var cnt = [], i, r, s0 = Math.floor(h[0] / 13), flush = true, pairs = 0, three = false, four = false, hiPair = false;
  var mn = 99, mx = -1, distinct = true, straight = false;
  for (i = 0; i < 13; i++) cnt.push(0);
  for (i = 0; i < 5; i++) {
    r = h[i] % 13; cnt[r]++;
    if (r < mn) mn = r; if (r > mx) mx = r;
    if (Math.floor(h[i] / 13) !== s0) flush = false;
  }
  for (i = 0; i < 13; i++) {
    if (cnt[i] > 1) distinct = false;
    if (cnt[i] === 4) four = true; else if (cnt[i] === 3) three = true;
    else if (cnt[i] === 2) { pairs++; if (i >= 9) hiPair = true; }
  }
  if (distinct) { if (mx - mn === 4) straight = true; else if (cnt[12] && cnt[0] && cnt[1] && cnt[2] && cnt[3]) straight = true; }
  if (straight && flush && mn === 8 && mx === 12) return { n: 'ROYAL FLUSH', m: 250 };
  if (straight && flush) return { n: 'STRAIGHT FLUSH', m: 50 };
  if (four) return { n: 'FOUR OF A KIND', m: 25 };
  if (three && pairs === 1) return { n: 'FULL HOUSE', m: 9 };
  if (flush) return { n: 'FLUSH', m: 6 };
  if (straight) return { n: 'STRAIGHT', m: 4 };
  if (three) return { n: 'THREE OF A KIND', m: 3 };
  if (pairs === 2) return { n: 'TWO PAIR', m: 2 };
  if (pairs === 1 && hiPair) return { n: 'JACKS OR BETTER', m: 1 };
  return { n: 'NO WIN', m: 0 };
}
function pkMsg() {
  var t = th();
  fillRect(12, 18, W - 24, 16, t.felt);
  if (pk.msg) ctxt(pk.msg, W / 2, 18, 2, pk.mcol);
}
function pkHeld(i) {
  var t = th();
  fillRect(pkX(i), 34, PCW, 9, t.felt);
  if (pk.held[i] && pk.phase === 'hold') ctxt('HELD', pkX(i) + PCW / 2, 35, 1, t.trim);
}
function pkCursor(i) {
  var t = th(), on = (pk.cur === i && pk.phase === 'hold');
  if (i < 5) { fillRect(pkX(i), 113, PCW, 6, on ? WHITE : t.felt); if (on) fillRect(pkX(i) + 2, 114, PCW - 4, 4, t.trim); }
  else {
    var x = Math.floor((W - 150) / 2);
    fillRect(x - 2, 126, 154, 24, t.felt);
    if (pk.phase === 'hold') {
      hiBox(x, 128, 150, 20, on);
      ctxt('DRAW', W / 2, 131, 2, on ? t.dark : WHITE);
      hiArrows(x, 128, 150, 20, on);
    } else if (pk.phase === 'result') {
      ctxt('CLICK TO CONTINUE', W / 2, 134, 1, t.trim);
    }
  }
}
function pkCard(i, up) { drawCard(pkX(i), PY, PCW, PCH, pk.hand[i], up); }
function pkRender() {
  var i, t = th();
  frame();
  txt('VIDEO POKER', 16, 11, 1, t.trim);
  txt('JACKS OR BETTER', 100, 11, 1, WHITE);
  bankLabel(190, 11, 122);
  pkMsg();
  if (pk.hand.length === 5) {
    for (i = 0; i < 5; i++) { pkCard(i, true); pkHeld(i); pkCursor(i); }
    pkCursor(5);
  }
  if (pk.phase === 'hold') txt('CLICK A CARD TO HOLD IT', 80, 153, 1, WHITE);
}
function pkDealAnim(list) {
  var i;
  for (i = 0; i < list.length; i++) {
    pkCard(list[i], false); sleep(70);
    pkCard(list[i], true); sndDeal(); sleep(110);
  }
}
function playPoker() {
  var bet, i, k, ev, old, repl, all = [0, 1, 2, 3, 4];
  while (true) {
    pk.hand = []; pk.held = [false, false, false, false, false]; pk.cur = 0; pk.phase = 'bet'; pk.msg = ''; pk.bet = 0;
    pkRender();
    bet = askBet('pk', pkRender, PK_LINES);
    if (bet < 0) return;
    cfg.bank = clampBank(cfg.bank - bet); pk.bet = bet;
    pk.deck = []; for (i = 0; i < 52; i++) pk.deck.push(i); shuffle(pk.deck);
    pk.phase = 'hold'; pk.msg = '';
    pkRender();
    bankLabel(190, 11, 122);
    for (i = 0; i < 5; i++) pk.hand.push(pk.deck.pop());
    for (i = 0; i < 5; i++) pkCard(i, false);
    sleep(150); pkDealAnim(all);
    pk.cur = 0; pkCursor(0); pkCursor(5);
    txt('CLICK A CARD TO HOLD IT', 80, 153, 1, WHITE);
    settle();
    while (true) {
      k = waitKey();
      if (k === 'L' || k === 'R') {
        old = pk.cur; pk.cur = (pk.cur + (k === 'R' ? 1 : 5)) % 6;
        sndMove(); pkCursor(old); pkCursor(pk.cur);
      } else if (k === 'O') {
        if (pk.cur === 5) break;
        pk.held[pk.cur] = !pk.held[pk.cur]; sndChip(); pkHeld(pk.cur);
      } else if (k === 'B') {
        if (confirmQuit(pkRender, 'Your bet is forfeited')) return;
        settle();
      }
    }
    repl = [];
    for (i = 0; i < 5; i++) if (!pk.held[i]) { pk.hand[i] = pk.deck.pop(); repl.push(i); }
    pk.phase = 'result';
    for (i = 0; i < 5; i++) pkHeld(i);
    pkCursor(5); for (i = 0; i < 5; i++) pkCursor(i);
    fillRect(60, 150, 200, 11, th().felt);
    pkDealAnim(repl);
    ev = pkEval(pk.hand);
    if (ev.m > 0) {
      cfg.bank = clampBank(cfg.bank + pk.bet * ev.m);
      pk.msg = ev.n; pk.mcol = C_WIN;
    } else { pk.msg = 'NO WIN'; pk.mcol = C_LOSE; }
    pkMsg(); bankLabel(190, 11, 122);
    if (ev.m >= 25) sndBig(); else if (ev.m > 0) sndWin(); else sndLose();
    if (ev.m > 0) { toast('PAYS ' + money(pk.bet * ev.m) + '  (x' + ev.m + ')', C_WIN); pkRender(); }
    settle();
    while (true) {
      k = waitKey();
      if (k === 'O') break;
      if (k === 'B') { if (confirmQuit(pkRender, '')) return; settle(); }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */
var SET_ROWS = ['CARD STYLE', 'THEME', 'RESET BANK', 'BACK'];
function setVal(i) {
  if (i === 0) return STYLES[cfg.style].n;
  if (i === 1) return THEMES[cfg.theme].n;
  if (i === 2) return '$1000';
  return '';
}
function setRow(i, sel) {
  var t = th(), x = 12, y = 34 + i * 18, w = 196, h = 16;
  hiBox(x, y, w, h, sel);
  txt(SET_ROWS[i], x + (sel ? 16 : 7), y + 4, 1, sel ? t.dark : WHITE);
  rtxt(setVal(i), x + w - (sel ? 16 : 7), y + 4, 1, sel ? t.dark : t.trim);
  hiArrows(x, y, w, h, sel);
}
function setPreview() {
  var t = th();
  fillRect(212, 28, 98, 84, t.felt);
  ctxt('PREVIEW', 261, 29, 1, t.trim);
  drawCard(216, 44, 44, 60, 12, true);
  drawCard(262, 44, 44, 60, 0, false);
}
function setHint(s) {
  var t = th();
  fillRect(12, 146, W - 24, 10, t.felt);
  ctxt(s, W / 2, 147, 1, WHITE);
}
function setRender(sel) {
  var i, t = th();
  frame();
  ctxt('SETTINGS', W / 2, 11, 2, t.trim);
  for (i = 0; i < SET_ROWS.length; i++) setRow(i, i === sel);
  setPreview();
  setHint('CLICK: CHANGE   BACK: SAVE + EXIT');
}
function settingsMenu() {
  var sel = 0, k, old;
  setRender(sel); settle();
  while (true) {
    k = waitKey();
    if (k === 'L' || k === 'R') {
      old = sel; sel = (sel + (k === 'R' ? 1 : SET_ROWS.length - 1)) % SET_ROWS.length;
      sndMove(); setRow(old, false); setRow(sel, true);
    } else if (k === 'O') {
      if (sel === 0) { cfg.style = (cfg.style + 1) % STYLES.length; setRow(0, true); setPreview(); sndDeal(); }
      else if (sel === 1) { cfg.theme = (cfg.theme + 1) % THEMES.length; setRender(sel); sndDeal(); settle(); }
      else if (sel === 2) { cfg.bank = 1000; sndChip(); setHint('BANK RESET TO $1000'); }
      else { saveCfg(); return; }
    } else if (k === 'B') { saveCfg(); return; }
  }
}

/* ------------------------------------------------------------------ */
/* Main menu                                                           */
/* ------------------------------------------------------------------ */
var MENU = ['BLACKJACK', 'ROULETTE', 'VIDEO POKER', 'SETTINGS', 'EXIT'];
function menuRow(i, on) {
  var t = th(), x = 92, w = 136, y = 54 + i * 17, h = 15;
  hiBox(x, y, w, h, on);
  ctxt(MENU[i], x + w / 2, y + 4, 1, on ? t.dark : WHITE);
  hiArrows(x, y, w, h, on);
}
function menuRender(sel) {
  var t = th(), i;
  frame();
  ctxt('GOLDEN ACE CASINO', W / 2 + 1, 15, 2, BLACK);
  ctxt('GOLDEN ACE CASINO', W / 2, 14, 2, t.trim);
  ctxt('by da cbm', W / 2, 32, 1, WHITE);
  ctxt('BANK ' + money(cfg.bank), W / 2, 43, 1, t.trim);
  suit(0, 28, 30, 6, WHITE); suit(1, 292, 30, 6, rgb(255, 80, 80));
  drawCard(20, 62, BJW, BJH, 12, true);
  drawCard(36, 70, BJW, BJH, 11 + 13, true);
  drawCard(250, 62, BJW, BJH, 0, false);
  drawCard(266, 70, BJW, BJH, 9 + 26, true);
  chip(38, 143, 12, rgb(170, 20, 30)); chip(60, 150, 9, rgb(20, 20, 20));
  chip(282, 143, 12, rgb(20, 80, 170)); chip(260, 150, 9, rgb(230, 190, 70));
  for (i = 0; i < MENU.length; i++) menuRow(i, i === sel);
  ctxt('TURN = MOVE   CLICK = SELECT', W / 2, 142, 1, t.trim);
}
function menu(start) {
  var sel = start, k, old;
  menuRender(sel); settle();
  while (true) {
    k = waitKey();
    if (k === 'L' || k === 'R') {
      old = sel; sel = (sel + (k === 'R' ? 1 : MENU.length - 1)) % MENU.length;
      sndMove(); menuRow(old, false); menuRow(sel, true);
    } else if (k === 'O') { sndChip(); return sel; }
    else if (k === 'B') { return 4; }
  }
}
function errorScreen(e) {
  var m = '', t = th();
  try { m = String(e && e.message ? e.message : e); } catch (x) { m = 'unknown'; }
  if (m.length > 38) m = m.substring(0, 38);
  frame();
  ctxt('OOPS - RECOVERED', W / 2, 50, 2, C_LOSE);
  ctxt(m, W / 2, 80, 1, WHITE);
  ctxt('CLICK TO RETURN TO LOBBY', W / 2, 110, 1, t.trim);
  settle();
  while (true) { var k = waitKey(); if (k === 'O' || k === 'B') break; }
}
function main() {
  var errs = 0, sel = 0, c, go = true;
  loadCfg(); cfg.sound = true; seedRng();
  if (!(cfg.bank >= 10)) cfg.bank = 1000;
  while (go) {
    try {
      c = menu(sel); sel = c;
      if (c === 0) { playBlackjack(); saveCfg(); }
      else if (c === 1) { playRoulette(); saveCfg(); }
      else if (c === 2) { playPoker(); saveCfg(); }
      else if (c === 3) { settingsMenu(); }
      else { go = false; }
      errs = 0;
    } catch (e) {
      errs++;
      try { errorScreen(e); } catch (e2) {}
      if (errs >= 5) go = false;
    }
  }
  saveCfg();
  fillRect(0, 0, W, H, BLACK);
  ctxt('THANKS FOR PLAYING!', W / 2, 78, 1, rgb(238, 196, 72));
  sleep(700);
  fillRect(0, 0, W, H, BLACK);
}
main();

})();
