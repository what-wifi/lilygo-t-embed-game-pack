/* ==========================================================
   DONNIE KONG
   by da cbm
   Bruce firmware 1.16.1  |  LilyGO T-Embed CC1101 (320x170)   ES5
   ----------------------------------------------------------
   Climb the girders, jump the barrels, grab the hammer and
   rescue Pauline. 50 levels, upgrades between levels.
     TURN knob  = run: each click steps  left / stop / right
                  (on a ladder: clockwise = up, counter = down)
     SEL        = jump (running) / grab ladder (standing at it, or mid-jump)
     ESC        = pause menu (save / quit)
   Save: /donniekong_save.txt   Hi-score: /donniekong_hi.txt
   (SD card first, else LittleFS)
   ========================================================== */

var W = display.width();
var H = display.height();

/* ---------- random ---------- */
var seed = 48271;
try { var t0 = now(); if (t0) { seed = (t0 % 2147483646) + 1; } } catch (e0) {}
function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
function ri(a, b) { return a + Math.floor(rnd() * (b - a + 1)); }
var mseed = 1;
function mrnd() { mseed = (mseed * 16807) % 2147483647; return (mseed - 1) / 2147483646; }

/* ---------- draw helpers ---------- */
function rgb(r, g, b) {
  r = Math.max(0, Math.min(255, Math.floor(r)));
  g = Math.max(0, Math.min(255, Math.floor(g)));
  b = Math.max(0, Math.min(255, Math.floor(b)));
  return ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3);
}
var CX0 = 0, CY0 = 0, CX1 = 0, CY1 = 0, CLIP = false, SOUND = true;
var HAS_RECT = (typeof display.drawRect === "function");
var HAS_LINE = (typeof display.drawLine === "function");
var HAS_CIRC = (typeof display.drawFillCircle === "function");
var HAS_STR = (typeof display.drawString === "function");
function iv(v) { v = Math.floor(v); return (v > -5000 && v < 5000) ? v : 0; }
function fr(x, y, w, h, c) {
  var x0 = iv(x), y0 = iv(y);
  var x1 = x0 + iv(w), y1 = y0 + iv(h);
  if (x0 < 0) { x0 = 0; } if (y0 < 0) { y0 = 0; }
  if (x1 > W) { x1 = W; } if (y1 > H) { y1 = H; }
  if (CLIP) { if (x0 < CX0) { x0 = CX0; } if (y0 < CY0) { y0 = CY0; } if (x1 > CX1) { x1 = CX1; } if (y1 > CY1) { y1 = CY1; } }
  if (x1 <= x0 || y1 <= y0) { return; }
  display.drawFillRect(x0, y0, x1 - x0, y1 - y0, c);
}
function rc(x, y, w, h, c) {
  x = iv(x); y = iv(y); w = iv(w); h = iv(h);
  if (HAS_RECT) { display.drawRect(x, y, w, h, c); return; }
  fr(x, y, w, 1, c); fr(x, y + h - 1, w, 1, c); fr(x, y, 1, h, c); fr(x + w - 1, y, 1, h, c);
}
function ln(x1, y1, x2, y2, c) {
  x1 = iv(x1); y1 = iv(y1); x2 = iv(x2); y2 = iv(y2);
  if (x1 < 0 || x2 < 0 || y1 < 0 || y2 < 0 || x1 >= W || x2 >= W || y1 >= H || y2 >= H) { return; }
  if (HAS_LINE) { display.drawLine(x1, y1, x2, y2, c); return; }
  var n = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1);
  for (var i = 0; i <= n; i += 1) { fr(x1 + (x2 - x1) * i / n, y1 + (y2 - y1) * i / n, 1, 1, c); }
}
function ci(x, y, r, c) {
  x = iv(x); y = iv(y); r = Math.max(1, iv(r));
  if (x - r < 0 || y - r < 0 || x + r >= W || y + r >= H) {
    for (var dy = -r; dy <= r; dy++) {
      var dx = Math.floor(Math.sqrt(r * r - dy * dy));
      fr(x - dx, y + dy, dx * 2 + 1, 1, c);
    }
    return;
  }
  if (HAS_CIRC) { display.drawFillCircle(x, y, r, c); return; }
  for (var dy2 = -r; dy2 <= r; dy2++) {
    var dx2 = Math.floor(Math.sqrt(r * r - dy2 * dy2));
    fr(x - dx2, y + dy2, dx2 * 2 + 1, 1, c);
  }
}
function txt(s, x, y, sz, c) {
  x = iv(x); y = iv(y);
  display.setTextSize(sz);
  display.setTextColor(c);
  if (HAS_STR) { display.drawString(String(s), x, y); }
  else { display.setCursor(x, y); display.print(String(s)); }
}
function ctxt(s, y, sz, c) {
  var w = String(s).length * 6 * sz;
  txt(s, (W - w) / 2, y, sz, c);
}
function stxt(s, x, y, sz, c, sc) { txt(s, x + 1, y + 1, sz, sc); txt(s, x, y, sz, c); }
function sctxt(s, y, sz, c, sc) {
  var w = String(s).length * 6 * sz;
  stxt(s, (W - w) / 2, y, sz, c, sc);
}
function cls(c) { fr(0, 0, W, H, c); }
var pollN = 0;
function wait(ms) { ms = Math.floor(ms); if (ms < 1) { ms = 1; } pollN += ms; delay(ms); }
var useNow = false;
function nowMs() {
  if (useNow) { try { var t = now(); if (t > 0) { return t; } } catch (e) {} }
  return pollN;
}
function calibrateClock() {
  try {
    var t1 = now(); wait(60); var t2 = now();
    var dd = t2 - t1;
    useNow = (dd >= 40 && dd <= 600);
  } catch (e) { useNow = false; }
}
function beep(f, d) { if (!SOUND) { return; } try { audio.tone(f, d); } catch (e) {} }

var BLACK = rgb(0, 0, 0), WHITE = rgb(255, 255, 255), RED = rgb(230, 50, 40),
    GREEN = rgb(60, 210, 80), YEL = rgb(255, 225, 20), BLUE = rgb(40, 70, 255),
    GRAY = rgb(130, 130, 140), DARK = rgb(8, 18, 34), ORNG = rgb(255, 150, 30),
    CYAN = rgb(80, 230, 240), PINK = rgb(255, 150, 200), HDR = rgb(25, 95, 150),
    HINT = rgb(255, 230, 120), PANEL = rgb(6, 8, 24), DOTC = rgb(255, 215, 170),
    PELC = rgb(255, 245, 200);
var GCOL = [RED, PINK, CYAN, ORNG];
/* wall themes: [body, edge] */
var THEMES = [
  [rgb(0, 20, 130), rgb(60, 110, 255)],
  [rgb(0, 80, 30), rgb(60, 240, 110)],
  [rgb(90, 0, 110), rgb(220, 90, 255)],
  [rgb(120, 50, 0), rgb(255, 170, 40)],
  [rgb(110, 0, 20), rgb(255, 80, 100)],
  [rgb(0, 80, 100), rgb(70, 230, 240)]
];
var WALLD = THEMES[0][0], WALLC = THEMES[0][1];

/* ---------- input (hardened encoder debounce, from hackerz) ---------- */
var MENU_GAP = 160, MENU_REV = 300;
var ENC_GAP_MS = MENU_GAP, ENC_REV_MS = MENU_REV, ENC_NOISE_MS = 60;
var SEL_HOLD_MS = 200, ESC_HOLD_MS = 260;
var lastDir = 0, lastEncMs = -100000, lastSelMs = -100000, lastEscMs = -100000;
var selDown = false, escDown = false, encLockUntil = 0, encDisabled = false;

function drainEnc() {
  var n = 0;
  try { while (keyboard.getNextPress() && n < 12) { n++; } } catch (e1) {}
  n = 0;
  try { while (keyboard.getPrevPress() && n < 12) { n++; } } catch (e2) {}
}
function lockEnc(ms) {
  var t = nowMs();
  if (ms <= 0) { encLockUntil = t; return; }
  if (t + ms > encLockUntil) { encLockUntil = t + ms; }
}
function encOn() { encDisabled = false; lockEnc(0); drainEnc(); }
function encAccept(d) {
  if (encDisabled) { drainEnc(); return false; }
  var t = nowMs();
  if (t < encLockUntil || t - lastEncMs < ENC_GAP_MS ||
      (lastDir != 0 && lastDir != d && (t - lastEncMs) < ENC_REV_MS)) {
    var cap = lastEncMs + ENC_GAP_MS + ENC_NOISE_MS;
    var want = t + ENC_NOISE_MS;
    if (want > cap) { want = cap; }
    if (want > encLockUntil) { encLockUntil = want; }
    drainEnc();
    return false;
  }
  lastDir = d; lastEncMs = t;
  encLockUntil = t + ENC_GAP_MS;
  drainEnc();
  return true;
}
function kSel() {
  var down = false;
  try { down = !!keyboard.getSelPress(); } catch (e) { return false; }
  var t = nowMs();
  if (down) {
    if (selDown || t - lastSelMs < SEL_HOLD_MS) { return false; }
    selDown = true; lastSelMs = t;
    drainEnc();
    return true;
  }
  selDown = false;
  return false;
}
function kEsc() {
  var down = false;
  try { down = !!keyboard.getEscPress(); } catch (e) { return false; }
  var t = nowMs();
  if (down) {
    if (escDown || t - lastEscMs < ESC_HOLD_MS) { return false; }
    escDown = true; lastEscMs = t;
    drainEnc();
    return true;
  }
  escDown = false;
  return false;
}
function kNext() {
  var hit = false;
  try { hit = !!keyboard.getNextPress(); } catch (e) { return false; }
  return hit ? encAccept(1) : false;
}
function kPrev() {
  var hit = false;
  try { hit = !!keyboard.getPrevPress(); } catch (e) { return false; }
  return hit ? encAccept(2) : false;
}
function inp() {
  if (kSel()) { return 3; }
  if (kEsc()) { return 4; }
  if (kNext()) { return 1; }
  if (kPrev()) { return 2; }
  return 0;
}
function inpMenu() {
  var k = inp();
  if (k != 0) { drainEnc(); }
  return k;
}
function settleInput() {
  drainEnc();
  lockEnc(ENC_GAP_MS);
  wait(90);
  drainEnc();
}
function waitKey() {
  drainEnc();
  while (true) {
    var k = inp();
    if (k == 3 || k == 4) { drainEnc(); return k; }
    wait(55);
  }
}
function menuMode() { ENC_GAP_MS = MENU_GAP; ENC_REV_MS = MENU_REV; SEL_HOLD_MS = 200; encOn(); }
function gameMode() { ENC_GAP_MS = 28; ENC_REV_MS = 45; SEL_HOLD_MS = 180; encOn(); }

function menu(title, items, idx, hints) {
  var n = items.length;
  if (idx < 0 || idx >= n) { idx = 0; }
  var dirty = true;
  var VR = 6;
  drainEnc(); lockEnc(ENC_GAP_MS);
  while (true) {
    if (dirty) {
      cls(DARK);
      fr(0, 0, W, 22, HDR);
      txt(title, 6, 4, 2, WHITE);
      var top = idx - 2;
      if (top > n - VR) { top = n - VR; }
      if (top < 0) { top = 0; }
      for (var i = 0; i < VR && top + i < n; i++) {
        var y = 26 + i * 21;
        var sel = (top + i == idx);
        if (sel) { fr(2, y - 2, W - 4, 20, rgb(40, 120, 190)); }
        txt(items[top + i], 8, y, 2, sel ? WHITE : rgb(170, 210, 240));
      }
      if (n > VR) {
        var bh = Math.floor(126 * VR / n);
        var by2 = 26 + Math.floor(126 * top / n);
        fr(W - 4, by2, 3, bh, GRAY);
      }
      fr(0, H - 14, W, 14, rgb(6, 12, 24));
      var hint = (hints && hints[idx]) ? hints[idx] : "Turn: move  SEL: ok  ESC: back";
      txt(hint, 4, H - 11, 1, HINT);
      dirty = false;
    }
    var k = inpMenu();
    if (k == 1) { idx = (idx + 1) % n; dirty = true; settleInput(); continue; }
    else if (k == 2) { idx = (idx + n - 1) % n; dirty = true; settleInput(); continue; }
    else if (k == 3) { settleInput(); return idx; }
    else if (k == 4) { settleInput(); return -1; }
    wait(55);
  }
}
function flash(msg, col) {
  fr(30, 60, W - 60, 50, BLACK);
  rc(30, 60, W - 60, 50, col);
  rc(31, 61, W - 62, 48, col);
  ctxt(msg, 78, 2, col);
  wait(750);
}
function listLines(title, lines) {
  var i;
  cls(DARK); fr(0, 0, W, 18, HDR); txt(title, 6, 5, 1, WHITE);
  for (i = 0; i < lines.length && i < 12; i++) { txt(lines[i][0], 8, 24 + i * 11, 1, lines[i][1]); }
  fr(0, H - 14, W, 14, rgb(6, 12, 24)); txt("SEL / ESC: back", 4, H - 11, 1, HINT);
  waitKey();
}

/* ==========================================================
   STORAGE
   ========================================================== */
function rd1(fsn, path) {
  var d = "";
  try { d = storage.read({ fs: fsn, path: path }); } catch (e1) { d = ""; }
  return String(d || "");
}
function rdFile(path) {
  var d = rd1("sd", path);
  if (d.length < 3) { d = rd1("littlefs", path); }
  return d;
}
function okBack(fsn, path, s) {
  var rb = rd1(fsn, path);
  return rb.length >= s.length - 2 && rb.indexOf(s.substring(0, Math.min(s.length, 40))) == 0;
}
function wrFile(path, s) {
  try { storage.write({ fs: "sd", path: path }, s, "write"); } catch (e1) {}
  if (okBack("sd", path, s)) { return "sd"; }
  try { storage.write({ fs: "littlefs", path: path }, s, "write"); } catch (e2) {}
  if (okBack("littlefs", path, s)) { return "littlefs"; }
  return "";
}


var TAN = rgb(240, 200, 150), BRN = rgb(150, 90, 40), DBRN = rgb(85, 45, 20), BRL = rgb(200, 105, 30),
    GIRC = rgb(190, 55, 40), GIRH = rgb(255, 130, 90), GIRD = rgb(100, 25, 20), LADC = rgb(80, 230, 240),
    DRUMC = rgb(30, 70, 210), PGRAY = rgb(190, 190, 200), DPINK = rgb(255, 90, 160);

/* ==========================================================
   GAME STATE
   ========================================================== */
var MAXLV = 50, LV = 1, SCORE = 0, LIVES = 3, TOK = 0, UP = [0, 0, 0, 0], DIFF = 1, HI = 0;
var GSPD = 1, NEXTBONUS = 10000;
var DIFFN = ["Easy", "Normal", "Hard"], DIFFM = [0.85, 1.0, 1.15], DIFFL = [5, 3, 2];
var GSPDN = ["Slow", "Normal", "Fast"], GSPDW = [14, 8, 3];
var SLP = 5, GRAV = 0.28;
var G = [], LAD = [], HAMS = [], MIR = false;
var KX = 20, DRUMX = 297, PAULX = 160;
var pl = { x: 14, y: 156, gi: 0, st: 0, vy: 0, vx: 0, hv: 0, cv: 0, face: 1, walk: 0, lad: 0, minY: 0, ham: 0, hamF: 0, ox: 0, oy: 0, dr: false };
var barrels = [], fires = [], eq = [];
var tickN = 0, bonus = 3000, throwT = 60, kongAnim = 0, kongBeat = 0, hudDirty = true, fireT = 0, QUIT = false;

function girderY(i, x) { var g = G[i]; return g.yc + g.dd * SLP * (x - 160) / 156; }
function onG(i, x) { return x >= G[i].xl && x <= G[i].xr; }
function buildLevel() {
  var base = [[156, 1, 4, 316], [130, -1, 24, 316], [104, 1, 4, 296], [78, -1, 24, 316], [52, 1, 4, 296], [28, 0, 128, 192]];
  var lads = [[0, 72], [0, 252], [1, 120], [1, 284], [2, 60], [2, 214], [3, 130], [3, 290], [4, 150]];
  var hs = [[1, 200], [3, 90]], i, b;
  MIR = (((LV - 1) % 2) == 1);
  G = []; LAD = []; HAMS = [];
  for (i = 0; i < 6; i++) {
    b = base[i];
    if (MIR) { G.push({ yc: b[0], dd: -b[1], xl: 319 - b[3], xr: 319 - b[2] }); }
    else { G.push({ yc: b[0], dd: b[1], xl: b[2], xr: b[3] }); }
  }
  for (i = 0; i < lads.length; i++) { LAD.push({ i: lads[i][0], x: MIR ? 319 - lads[i][1] : lads[i][1] }); }
  for (i = 0; i < hs.length; i++) { HAMS.push({ gi: hs[i][0], x: MIR ? 319 - hs[i][1] : hs[i][1], on: true }); }
  KX = MIR ? 299 : 20;
  DRUMX = MIR ? 22 : 297;
}

/* ==========================================================
   DRAWING
   ========================================================== */
/* girders are drawn column-exact (no 4px chunks): a continuous solid ramp */
function drawGirderRange(i, xs, xe) {
  var x = xs, y, x2, len, rx;
  while (x <= xe) {
    y = Math.floor(girderY(i, x));
    x2 = x;
    while (x2 < xe && Math.floor(girderY(i, x2 + 1)) == y) { x2++; }
    len = x2 - x + 1;
    fr(x, y, len, 1, GIRH); fr(x, y + 1, len, 3, GIRC); fr(x, y + 4, len, 1, GIRD);
    for (rx = x + ((8 - (x % 8)) % 8); rx <= x2; rx += 8) { fr(rx, y + 2, 1, 1, GIRD); }
    x = x2 + 1;
  }
}
function drawLadder(l) {
  var top = Math.floor(girderY(l.i + 1, l.x)), bot = Math.floor(girderY(l.i, l.x)), yy;
  fr(l.x - 3, top, 1, bot - top, LADC); fr(l.x + 3, top, 1, bot - top, LADC);
  for (yy = top + 2; yy < bot; yy += 4) { fr(l.x - 3, yy, 7, 1, LADC); }
}
function drawPauline(blink, px, py) {
  var x = PAULX, y;
  if (px === undefined) { y = Math.floor(girderY(5, x)); } else { x = px; y = py; }
  fr(x - 2, y - 12, 4, 3, DBRN); fr(x - 2, y - 10, 4, 2, TAN); fr(x - 3, y - 8, 6, 6, DPINK);
  fr(x - 4, y - 7, 1, 3, TAN); fr(x + 3, y - 7, 1, 3, TAN); fr(x - 2, y - 2, 2, 2, TAN); fr(x, y - 2, 2, 2, TAN);
  if (blink) { txt("HELP!", x + 8, y - 11, 1, WHITE); }
}
function drawDrum(f) {
  var y = Math.floor(girderY(0, DRUMX));
  fr(DRUMX - 7, y - 14, 14, 14, DRUMC); fr(DRUMX - 7, y - 11, 14, 1, BLUE); fr(DRUMX - 7, y - 4, 14, 1, BLUE);
  fr(DRUMX - 4, y - 9, 8, 3, WHITE);
  fr(DRUMX - 3, y - 8, 6, 1, DRUMC);
  ci(DRUMX, y - 17, 4, RED); ci(DRUMX, y - 17, 2, ORNG);
  fr(DRUMX - 2 + ((f & 1) * 3), y - 23, 2, 4, YEL);
}
function drawHamPickup(h) {
  var y = Math.floor(girderY(h.gi, h.x));
  fr(h.x, y - 8, 2, 8, BRN); fr(h.x - 3, y - 11, 8, 4, PGRAY); fr(h.x - 3, y - 11, 8, 1, WHITE);
}
function paintRegion(x, y, w, h) {
  var x1 = x + w, y1 = y + h, i, g, cx, xs, xe, k, l;
  if (y < 10) { y = 10; } if (x < 0) { x = 0; } if (x1 > W) { x1 = W; } if (y1 > H) { y1 = H; }
  if (x1 <= x || y1 <= y) { return; }
  CLIP = true; CX0 = x; CY0 = y; CX1 = x1; CY1 = y1;
  fr(x, y, x1 - x, y1 - y, BLACK);
  for (i = 0; i < 6; i++) {
    g = G[i];
    if (y1 < g.yc - 7 || y > g.yc + 12) { continue; }
    xs = Math.max(x, g.xl); xe = Math.min(x1 - 1, g.xr);
    if (xe < xs) { continue; }
    drawGirderRange(i, xs, xe);
  }
  for (k = 0; k < LAD.length; k++) {
    l = LAD[k];
    if (x1 < l.x - 4 || x > l.x + 4) { continue; }
    drawLadder(l);
  }
  CLIP = false;
}
function paintAll() {
  var i;
  dKey = -1; pKey = -1; drawAll = true;
  kong.rt = null; kong.sig = -1; pl.rt = null; pl.sig = -1;
  for (i = 0; i < barrels.length; i++) { barrels[i].rt = null; barrels[i].sig = -1; }
  for (i = 0; i < fires.length; i++) { fires[i].rt = null; fires[i].sig = -1; }
  cls(BLACK);
  paintRegion(0, 10, W, H - 10);
}
function drawRects(L) { var i, r; for (i = 0; i < L.length; i++) { r = L[i]; fr(r[0], r[1], r[2], r[3], r[4]); } }
function donnieRects(x, y, face, st, walk, ham, hamF) {
  var lg = (st == 0 && ((walk >> 2) & 1) == 1) ? 1 : 0, f = (face > 0) ? 1 : -1, L = [], up;
  x = Math.floor(x); y = Math.floor(y);
  L.push([x - 3, y - 12, 6, 2, RED]); L.push([x - 4 + (f > 0 ? 2 : 0), y - 11, 6, 1, RED]);
  L.push([x - 3, y - 10, 6, 3, TAN]); L.push([x + (f > 0 ? 1 : -2), y - 9, 1, 1, BLACK]);
  L.push([x - 3, y - 7, 6, 3, RED]);
  L.push([x - 3, y - 4, 6, 3, BLUE]);
  if (st == 2) {
    up = ((walk >> 2) & 1) == 1;
    L.push([x - 5, y - (up ? 12 : 10), 2, 4, TAN]); L.push([x + 3, y - (up ? 10 : 12), 2, 4, TAN]);
    L.push([x - 3, y - 1, 2, 1, BRN]); L.push([x + 1, y - 1 - lg, 2, 1, BRN]);
  } else {
    L.push([x - 5, y - 7, 2, 3, TAN]); L.push([x + 3, y - 7, 2, 3, TAN]);
    L.push([x - 3, y - 1, 2, 1 + lg, BRN]); L.push([x + 1, y - 1, 2, 1 + (1 - lg), BRN]);
  }
  if (ham > 0) {
    if (hamF) { L.push([x + f * 4 - (f < 0 ? 4 : 0), y - 8, 5, 1, BRN]); L.push([x + f * 8 - (f < 0 ? 3 : 0), y - 11, 3, 7, PGRAY]); }
    else { L.push([x + f * 3 - 1, y - 18, 2, 7, BRN]); L.push([x + f * 3 - 4, y - 21, 8, 4, PGRAY]); L.push([x + f * 3 - 4, y - 21, 8, 1, WHITE]); }
  }
  return L;
}
/* ---------- sprites are rectangle templates (built once, drawn at an offset) ---------- */
function discRects(L, cx, cy) {
  L.push([cx - 2, cy - 3, 5, 1]); L.push([cx - 3, cy - 2, 7, 2]); L.push([cx - 4, cy, 9, 1]);
  L.push([cx - 3, cy + 1, 7, 2]); L.push([cx - 2, cy + 3, 5, 1]);
}
function colorize(L, c, from) {
  var i;
  for (i = from; i < L.length; i++) { if (L[i].length < 5) { L[i].push(c); } }
}
function donnieRects(x, y, face, st, walk, ham, hamF) {
  var lg = (st == 0 && ((walk >> 2) & 1) == 1) ? 1 : 0, f = (face > 0) ? 1 : -1, L = [], up;
  x = Math.floor(x); y = Math.floor(y);
  L.push([x - 3, y - 12, 6, 2, RED]); L.push([x - 4 + (f > 0 ? 2 : 0), y - 11, 6, 1, RED]);
  L.push([x - 3, y - 10, 6, 3, TAN]); L.push([x + (f > 0 ? 1 : -2), y - 9, 1, 1, BLACK]);
  L.push([x - 3, y - 7, 6, 3, RED]);
  L.push([x - 3, y - 4, 6, 3, BLUE]);
  if (st == 2) {
    up = ((walk >> 2) & 1) == 1;
    L.push([x - 5, y - (up ? 12 : 10), 2, 4, TAN]); L.push([x + 3, y - (up ? 10 : 12), 2, 4, TAN]);
    L.push([x - 3, y - 1, 2, 1, BRN]); L.push([x + 1, y - 1 - lg, 2, 1, BRN]);
  } else {
    L.push([x - 5, y - 7, 2, 3, TAN]); L.push([x + 3, y - 7, 2, 3, TAN]);
    L.push([x - 3, y - 1, 2, 1 + lg, BRN]); L.push([x + 1, y - 1, 2, 1 + (1 - lg), BRN]);
  }
  if (ham > 0) {
    if (hamF) { L.push([x + f * 4 - (f < 0 ? 4 : 0), y - 8, 5, 1, BRN]); L.push([x + f * 8 - (f < 0 ? 3 : 0), y - 11, 3, 7, PGRAY]); }
    else { L.push([x + f * 3 - 1, y - 18, 2, 7, BRN]); L.push([x + f * 3 - 4, y - 21, 8, 4, PGRAY]); L.push([x + f * 3 - 4, y - 21, 8, 1, WHITE]); }
  }
  return L;
}
function barrelRects(x, y, f) {
  var L = [], n;
  x = Math.floor(x); y = Math.floor(y);
  discRects(L, x, y - 4); colorize(L, BRL, 0);
  if (((f >> 2) & 1) == 0) { L.push([x - 4, y - 5, 8, 1, DBRN]); L.push([x - 3, y - 2, 6, 1, DBRN]); }
  else { L.push([x - 1, y - 8, 2, 8, DBRN]); }
  return L;
}
function fireRects(x, y, f) {
  var L = [];
  x = Math.floor(x); y = Math.floor(y);
  discRects(L, x, y - 4); colorize(L, ORNG, 0);
  L.push([x - 1, y - 5, 3, 1, YEL]); L.push([x - 2, y - 4, 5, 3, YEL]); L.push([x - 1, y - 1, 3, 1, YEL]);
  L.push([x - 1 + ((f >> 1) & 1) * 2, y - 9, 2, 3, ORNG]);
  L.push([x - 2, y - 5, 1, 1, BLACK]); L.push([x + 1, y - 5, 1, 1, BLACK]);
  return L;
}
function kongRects(cx, cy, f, beat) {
  var L = [], n;
  L.push([cx - 9, cy - 5, 6, 5, DBRN]); L.push([cx + 3, cy - 5, 6, 5, DBRN]);
  L.push([cx - 11, cy - 16, 22, 12, BRN]);
  L.push([cx - 6, cy - 14, 12, 7, TAN]);
  L.push([cx - 6, cy - 23, 12, 8, BRN]); L.push([cx - 4, cy - 21, 8, 5, TAN]);
  L.push([cx - 3, cy - 20, 2, 2, BLACK]); L.push([cx + 1, cy - 20, 2, 2, BLACK]);
  L.push([cx - 2, cy - 17, 4, 1, RED]);
  if (f == 1) {
    L.push([cx - 15, cy - 26, 5, 13, BRN]); L.push([cx + 10, cy - 26, 5, 13, BRN]);
    n = L.length; discRects(L, cx, cy - 29); colorize(L, BRL, n); L.push([cx - 4, cy - 30, 8, 1, DBRN]);
  } else {
    L.push([cx - 15, cy - 14, 5, 13, BRN]); L.push([cx + 10, cy - 14, 5, 13, BRN]);
    if (beat) { L.push([cx - 12, cy - 12, 4, 4, BRN]); L.push([cx + 8, cy - 12, 4, 4, BRN]); }
  }
  return L;
}
function drawRects(L) { var i, r; for (i = 0; i < L.length; i++) { r = L[i]; fr(r[0], r[1], r[2], r[3], r[4]); } }
function eqAdd(e) { if (e && e.rt) { eq.push([e.rt, e.rx, e.ry]); } }
/* wrappers used by the title screen */
function drawDonnieAt(x, y, face, st, walk, ham, hamF, dead) { drawRects(donnieRects(x, y, face, st, walk, ham, hamF)); }
function drawKongAt(cx, cy, f, beat) { drawRects(kongRects(cx, cy, f, beat)); }
function drawBarrelAt(x, y, f) { drawRects(barrelRects(x, y, f)); }
function drawFireAt(x, y, f) { drawRects(fireRects(x, y, f)); }

/* template cache: every sprite variant is built once, then only drawn at an x/y offset */
function mkTpl(L) {
  var i, r, x0 = 9999, y0 = 9999, x1 = -9999, y1 = -9999;
  for (i = 0; i < L.length; i++) {
    r = L[i];
    if (r[0] < x0) { x0 = r[0]; } if (r[1] < y0) { y0 = r[1]; }
    if (r[0] + r[2] > x1) { x1 = r[0] + r[2]; } if (r[1] + r[3] > y1) { y1 = r[1] + r[3]; }
  }
  return { r: L, bx: x0, by: y0, bw: x1 - x0, bh: y1 - y0 };
}
var TD = [], TB = [null, null], TFI = [null, null], TK = [null, null, null, null], EMPTYT = { r: [], bx: 0, by: 0, bw: 0, bh: 0 };
(function () { var i; for (i = 0; i < 40; i++) { TD.push(null); } })();
function donnieTpl(face, st, lgb, hm) {
  var k = ((((face > 0) ? 1 : 0) * 3 + st) * 2 + lgb) * 3 + hm;
  if (!TD[k]) { TD[k] = mkTpl(donnieRects(0, 0, face, st, lgb << 2, hm > 0 ? 1 : 0, hm == 2)); }
  return TD[k];
}
function barrelTpl(bit) { if (!TB[bit]) { TB[bit] = mkTpl(barrelRects(0, 0, bit << 2)); } return TB[bit]; }
function fireTpl(bit) { if (!TFI[bit]) { TFI[bit] = mkTpl(fireRects(0, 0, bit << 1)); } return TFI[bit]; }
function kongTpl(k) { if (!TK[k]) { TK[k] = mkTpl(kongRects(0, 0, k & 1, (k & 2) != 0)); } return TK[k]; }
function drawT(t, x, y) {
  var rr = t.r, i, r;
  for (i = 0; i < rr.length; i++) { r = rr[i]; fr(r[0] + x, r[1] + y, r[2], r[3], r[4]); }
}
/* dirty list: pixels that were repainted this frame (so overlapped sprites get redrawn) */
var DR = [], DRN = 0, SA = [], SB = [], drawAll = true, ERASEFN = null;
(function () { var i; for (i = 0; i < 128; i++) { DR.push(0); } for (i = 0; i < 1600; i++) { SA.push(0); SB.push(0); } })();
function dirty(x, y, w, h) {
  if (DRN < 30) { DR[DRN * 4] = x; DR[DRN * 4 + 1] = y; DR[DRN * 4 + 2] = w; DR[DRN * 4 + 3] = h; DRN++; }
  else { drawAll = true; }
}
function hit(x, y, w, h) {
  var i, k;
  for (i = 0; i < DRN; i++) {
    k = i * 4;
    if (x < DR[k] + DR[k + 2] && x + w > DR[k] && y < DR[k + 1] + DR[k + 3] && y + h > DR[k + 1]) { return true; }
  }
  return false;
}
/* repaint ONLY the old pixels no new rectangle covers (no black box, no flash); allocation-free */
function eraseOldT(ot, ox, oy, nt, nx, ny) {
  var orr = ot.r, nrr = nt.r, i, j, k, o, r, a, b, tmp, n, m, q, px, py, pw, ph, pr, pb, nxx, nyy, nr, nb, t, bt;
  for (i = 0; i < orr.length; i++) {
    o = orr[i]; a = SA; b = SB; n = 1;
    a[0] = o[0] + ox; a[1] = o[1] + oy; a[2] = o[2]; a[3] = o[3];
    for (j = 0; j < nrr.length && n > 0; j++) {
      r = nrr[j]; nxx = r[0] + nx; nyy = r[1] + ny; nr = nxx + r[2]; nb = nyy + r[3];
      m = 0;
      for (k = 0; k < n; k++) {
        q = k * 4; px = a[q]; py = a[q + 1]; pw = a[q + 2]; ph = a[q + 3]; pr = px + pw; pb = py + ph;
        if (m > 380) { break; }
        if (nxx >= pr || nr <= px || nyy >= pb || nb <= py) {
          b[m * 4] = px; b[m * 4 + 1] = py; b[m * 4 + 2] = pw; b[m * 4 + 3] = ph; m++; continue;
        }
        if (nyy > py) { b[m * 4] = px; b[m * 4 + 1] = py; b[m * 4 + 2] = pw; b[m * 4 + 3] = nyy - py; m++; }
        if (nb < pb) { b[m * 4] = px; b[m * 4 + 1] = nb; b[m * 4 + 2] = pw; b[m * 4 + 3] = pb - nb; m++; }
        t = (py > nyy) ? py : nyy; bt = (pb < nb) ? pb : nb;
        if (nxx > px) { b[m * 4] = px; b[m * 4 + 1] = t; b[m * 4 + 2] = nxx - px; b[m * 4 + 3] = bt - t; m++; }
        if (nr < pr) { b[m * 4] = nr; b[m * 4 + 1] = t; b[m * 4 + 2] = pr - nr; b[m * 4 + 3] = bt - t; m++; }
      }
      tmp = a; a = b; b = tmp; n = m;
    }
    for (k = 0; k < n; k++) {
      q = k * 4;
      if (ERASEFN) { ERASEFN(a[q], a[q + 1], a[q + 2], a[q + 3]); } else { paintRegion(a[q], a[q + 1], a[q + 2], a[q + 3]); }
      dirty(a[q], a[q + 1], a[q + 2], a[q + 3]);
    }
  }
}
var hc = [];
function hf(i, str, x, w, col) {
  if (hc[i] === str) { return; }
  hc[i] = str;
  fr(x, 0, w, 10, BLACK);
  txt(str, x, 1, 1, col);
}
function hud(force) {
  var i;
  if (force) { hc = []; fr(0, 0, W, 10, BLACK); }
  hf(0, "SC " + SCORE, 2, 72, WHITE);
  hf(1, "HI " + HI, 76, 66, CYAN);
  hf(2, "BON " + bonus + (bonus < 600 ? "!" : ""), 146, 66, bonus < 600 ? RED : YEL);
  hf(3, "L" + LV, 214, 28, GREEN);
  hf(4, "T" + TOK, 244, 28, ORNG);
  if (hc[5] !== LIVES) {
    hc[5] = LIVES;
    fr(274, 0, 46, 10, BLACK);
    for (i = 0; i < LIVES && i < 8; i++) { fr(274 + i * 6, 3, 4, 3, RED); fr(274 + i * 6, 6, 4, 2, TAN); }
  }
  hudDirty = false;
}
function addScore(n) {
  SCORE += n;
  if (SCORE > HI) { HI = SCORE; }
  while (SCORE >= NEXTBONUS) { NEXTBONUS += 10000; if (LIVES < 9) { LIVES++; beep(1500, 60); } }
  hudDirty = true;
}
var dKey = -1, pKey = -1;
var kong = { rt: null, nt: null, sig: -1, ch: true, rx: 0, ry: 0, nx: 0, ny: 0 };
function plSig() {
  return ((Math.floor(pl.x) * 256 + Math.floor(pl.y)) * 16) + ((pl.walk >> 2) & 1) * 8 + (pl.hamF ? 4 : 0) + (pl.st << 1) + (pl.ham > 0 ? 1 : 0) + (pl.face > 0 ? 65536 * 16 * 256 : 0);
}
function bSig(b) { return (Math.floor(b.x) * 256 + Math.floor(b.y)) * 2 + ((b.f >> 2) & 1); }
function fSig(f) { return (Math.floor(f.x) * 256 + Math.floor(f.y)) * 2 + ((f.f >> 1) & 1); }
function refreshEnt(e, sg, tpl, x, y) {
  if (e.nt && e.sig === sg) { return; }
  e.nt = tpl; e.nx = x; e.ny = y; e.ch = true;
  if (e.rt) { eraseOldT(e.rt, e.rx, e.ry, tpl, x, y); }
  e.sig = sg;
}
function refreshAll() {
  var i, b, f, ky = Math.floor(girderY(4, KX)), kk = (kongAnim > 0 ? 1 : 0) + (((tickN >> 4) & 1) << 1);
  refreshEnt(kong, kk, kongTpl(kk), KX, ky);
  for (i = 0; i < fires.length; i++) { f = fires[i]; refreshEnt(f, fSig(f), fireTpl((f.f >> 1) & 1), Math.floor(f.x), Math.floor(f.y)); }
  for (i = 0; i < barrels.length; i++) { b = barrels[i]; refreshEnt(b, bSig(b), barrelTpl((b.f >> 2) & 1), Math.floor(b.x), Math.floor(b.y)); }
  refreshEnt(pl, plSig(), donnieTpl(pl.face, pl.st, (pl.walk >> 2) & 1, pl.ham > 0 ? (pl.hamF ? 2 : 1) : 0), Math.floor(pl.x), Math.floor(pl.y));
}
function eraseEntities() {
  var i, k, e, dy = Math.floor(girderY(0, DRUMX));
  DRN = 0;
  for (i = 0; i < eq.length; i++) { e = eq[i]; eraseOldT(e[0], e[1], e[2], EMPTYT, 0, 0); }
  eq = [];
  k = tickN >> 2;
  if (k != dKey) { dKey = k; paintRegion(DRUMX - 9, dy - 26, 18, 10); dirty(DRUMX - 9, dy - 26, 18, 10); }
  k = (tickN >> 4) & 1;
  if (k != pKey) { pKey = k; paintRegion(PAULX + 6, 14, 48, 12); dirty(PAULX + 6, 14, 48, 12); }
  refreshAll();
}
function drawEntities() {
  var i, b, f, h, hy, dy = Math.floor(girderY(0, DRUMX)), py = Math.floor(girderY(5, PAULX));
  refreshAll();
  for (i = 0; i < HAMS.length; i++) {
    h = HAMS[i];
    if (h.on) { hy = Math.floor(girderY(h.gi, h.x)); if (drawAll || hit(h.x - 4, hy - 12, 10, 13)) { drawHamPickup(h); } }
  }
  if (drawAll || hit(PAULX - 6, py - 14, 60, 16)) { drawPauline(((tickN >> 4) & 1) == 0); }
  if (drawAll || hit(DRUMX - 9, dy - 26, 18, 27)) { drawDrum(tickN >> 2); }
  if (kong.ch || drawAll || hit(kong.nx + kong.nt.bx, kong.ny + kong.nt.by, kong.nt.bw, kong.nt.bh)) { drawT(kong.nt, kong.nx, kong.ny); kong.rt = kong.nt; kong.rx = kong.nx; kong.ry = kong.ny; kong.ch = false; }
  for (i = 0; i < fires.length; i++) {
    f = fires[i];
    if (f.ch || drawAll || hit(f.nx + f.nt.bx, f.ny + f.nt.by, f.nt.bw, f.nt.bh)) { drawT(f.nt, f.nx, f.ny); f.rt = f.nt; f.rx = f.nx; f.ry = f.ny; f.ch = false; }
  }
  for (i = 0; i < barrels.length; i++) {
    b = barrels[i];
    if (b.ch || drawAll || hit(b.nx + b.nt.bx, b.ny + b.nt.by, b.nt.bw, b.nt.bh)) { drawT(b.nt, b.nx, b.ny); b.rt = b.nt; b.rx = b.nx; b.ry = b.ny; b.ch = false; }
  }
  if (pl.ch || drawAll || hit(pl.nx + pl.nt.bx, pl.ny + pl.nt.by, pl.nt.bw, pl.nt.bh)) { drawT(pl.nt, pl.nx, pl.ny); pl.rt = pl.nt; pl.rx = pl.nx; pl.ry = pl.ny; pl.ch = false; }
  drawAll = false;
}

/* ==========================================================
   LOGIC
   ========================================================== */
/* Donnie's run speed (faster = fewer knob clicks needed) */
function pspd() { return 1.45 + 0.06 * UP[0]; }
function bspd() { var s = (1.0 + LV * 0.012) * DIFFM[DIFF] * (1 - 0.05 * UP[3]); return Math.min(s, 1.8); }
function nearLadder() {
  var k, l;
  for (k = 0; k < LAD.length; k++) {
    l = LAD[k];
    if (Math.abs(pl.x - l.x) <= 6 && (pl.gi == l.i || pl.gi == l.i + 1)) { return k; }
  }
  return -1;
}
/* a ladder you can grab while jumping / falling past it */
function airLadder() {
  var k, l, top, bot;
  for (k = 0; k < LAD.length; k++) {
    l = LAD[k];
    if (Math.abs(pl.x - l.x) <= 8) {
      top = girderY(l.i + 1, l.x); bot = girderY(l.i, l.x);
      if (pl.y >= top - 2 && pl.y <= bot + 3) { return k; }
    }
  }
  return -1;
}
function resetPlayer() {
  pl.x = MIR ? 305 : 14; pl.gi = 0; pl.y = girderY(0, pl.x); pl.st = 0; pl.vy = 0; pl.vx = 0;
  pl.hv = 0; pl.cv = 0; pl.ham = 0; pl.face = MIR ? -1 : 1; pl.dr = false;
}
function setupLevel() {
  buildLevel();
  barrels = []; fires = []; eq = [];
  resetPlayer();
  bonus = Math.max(2000, 3600 - LV * 25);
  throwT = 70; kongAnim = 0; fireT = 500;
  hudDirty = true;
}
function killPlayer() { return 1; }
function landTest(oldY, x, y, below) {
  var j, gy;
  for (j = 0; j < 6; j++) {
    if (j >= below) { continue; }
    if (!onG(j, x)) { continue; }
    gy = girderY(j, x);
    if (oldY <= gy + 2 && y >= gy) { return j; }
  }
  return -1;
}
/* returns 1 if player died this tick */
function updatePlayer() {
  var spd = pspd(), old, j, l, top, bot, dist;
  if (pl.ham > 0) { pl.ham--; pl.hamF = ((tickN >> 3) & 1) == 1; }
  if (pl.st == 0) {
    if (pl.hv != 0) { pl.x += pl.hv * spd; pl.face = pl.hv; pl.walk++; }
    if (pl.x < 3) { pl.x = 3; } if (pl.x > 316) { pl.x = 316; }
    if (!onG(pl.gi, pl.x)) { pl.st = 1; pl.vy = 0; pl.vx = pl.hv * spd * 0.5; pl.minY = pl.y; }
    else { pl.y = girderY(pl.gi, pl.x); }
  } else if (pl.st == 1) {
    old = pl.y;
    pl.vy += GRAV; pl.y += pl.vy; pl.x += pl.vx;
    if (pl.x < 3) { pl.x = 3; } if (pl.x > 316) { pl.x = 316; }
    if (pl.y < pl.minY) { pl.minY = pl.y; }
    if (pl.vy > 0) {
      j = landTest(old, pl.x, pl.y, 6);
      if (j >= 0) {
        dist = girderY(j, pl.x) - pl.minY;
        pl.y = girderY(j, pl.x); pl.gi = j; pl.st = 0;
        if (dist > 44) { return 1; }
      }
    }
    if (pl.y > 174) { return 1; }
  } else if (pl.st == 2) {
    l = LAD[pl.lad];
    pl.x = l.x; pl.y -= pl.cv * (pspd() * 0.82);
    if (pl.cv != 0) { pl.walk++; }
    top = girderY(l.i + 1, l.x); bot = girderY(l.i, l.x);
    if (pl.y <= top) { pl.y = top; pl.gi = l.i + 1; pl.st = 0; pl.cv = 0; pl.hv = 0; }
    else if (pl.y >= bot) { pl.y = bot; pl.gi = l.i; pl.st = 0; pl.cv = 0; pl.hv = 0; }
  }
  return 0;
}
function spawnBarrel() {
  var x = KX + (MIR ? -22 : 22);
  barrels.push({ st: 0, x: x, y: girderY(4, x), gi: 4, vx: 0, vy: 0, f: 0, sc: 0, lastLad: -1, lad: 0, ox: x, oy: girderY(4, x) });
}
function spawnFire() {
  var x = DRUMX + (MIR ? 14 : -14);
  fires.push({ x: x, y: girderY(0, x), gi: 0, dir: MIR ? 1 : -1, st: 0, f: 0, lastLad: -1, lad: 0, cd: 1, ox: x, oy: girderY(0, x) });
}
function updateBarrels() {
  var i, b, dir, k, l, j, old;
  for (i = barrels.length - 1; i >= 0; i--) {
    b = barrels[i]; b.f++;
    if (b.st == 0) {
      dir = G[b.gi].dd;
      b.x += dir * bspd(); b.y = girderY(b.gi, b.x);
      if (b.gi == 0 && Math.abs(b.x - DRUMX) < 9) {
        eqAdd(b); barrels.splice(i, 1);
        if (LV >= 2 && fires.length < Math.min(1 + Math.floor(LV / 6), 4) && rnd() < 0.3) { spawnFire(); }
        continue;
      }
      if (!onG(b.gi, b.x)) { b.st = 1; b.vy = 0; b.vx = dir * bspd() * 0.7; continue; }
      for (k = 0; k < LAD.length; k++) {
        l = LAD[k];
        if (l.i + 1 == b.gi && Math.abs(b.x - l.x) < 1.2 && b.lastLad != k) {
          b.lastLad = k;
          if (rnd() < 0.2 + LV * 0.004) { b.st = 2; b.lad = k; b.x = l.x; }
        }
      }
    } else if (b.st == 1) {
      old = b.y;
      b.vy += GRAV; b.y += b.vy; b.x += b.vx;
      j = landTest(old, b.x, b.y, b.gi);
      if (j >= 0) { b.gi = j; b.y = girderY(j, b.x); b.st = 0; b.lastLad = -1; }
      else if (b.y > 176 || b.x < 0 || b.x > 319) { eqAdd(b); barrels.splice(i, 1); }
    } else {
      l = LAD[b.lad];
      b.y += 1.0;
      if (b.y >= girderY(l.i, l.x)) { b.y = girderY(l.i, l.x); b.gi = l.i; b.st = 0; b.lastLad = -1; }
    }
  }
}
function updateFires() {
  var i, f, k, l, spd, wantUp, wantDown, top, bot;
  spd = 0.42 + LV * 0.008;
  for (i = 0; i < fires.length; i++) {
    f = fires[i]; f.f++;
    if (f.st == 0) {
      f.x += f.dir * spd;
      if (!onG(f.gi, f.x)) { f.dir = -f.dir; f.x += f.dir * spd * 2; }
      f.y = girderY(f.gi, f.x);
      if (rnd() < 0.008) { f.dir = (pl.x > f.x) ? 1 : -1; }
      wantUp = pl.y < f.y - 8; wantDown = pl.y > f.y + 8;
      for (k = 0; k < LAD.length; k++) {
        l = LAD[k];
        if (Math.abs(f.x - l.x) < 1 && f.lastLad != k && (l.i == f.gi || l.i + 1 == f.gi)) {
          f.lastLad = k;
          if (l.i == f.gi && wantUp && rnd() < 0.7) { f.st = 1; f.lad = k; f.cd = -1; f.x = l.x; }
          else if (l.i + 1 == f.gi && wantDown && rnd() < 0.7) { f.st = 1; f.lad = k; f.cd = 1; f.x = l.x; }
        }
      }
    } else {
      l = LAD[f.lad];
      f.y += f.cd * 0.7;
      top = girderY(l.i + 1, l.x); bot = girderY(l.i, l.x);
      if (f.y <= top) { f.y = top; f.gi = l.i + 1; f.st = 0; f.lastLad = f.lad; }
      else if (f.y >= bot) { f.y = bot; f.gi = l.i; f.st = 0; f.lastLad = f.lad; }
    }
  }
}
function kongLogic() {
  throwT--;
  if (kongAnim > 0) { kongAnim--; }
  if (throwT == 16) { kongAnim = 16; }
  if (throwT <= 0) {
    spawnBarrel();
    if (LV > 8 && rnd() < 0.18) { throwT = 20; kongAnim = 18; }
    else { throwT = Math.max(38, Math.floor(110 - LV * 1.3)) + ri(0, 28); }
    beep(220, 15);
  }
  if (LV >= 3) {
    fireT--;
    if (fireT <= 0) {
      fireT = 700;
      if (fires.length < Math.min(1 + Math.floor(LV / 6), 4)) { spawnFire(); }
    }
  }
}
/* 1 = player killed */
function collisions() {
  var i, b, f, dx, cyb, cyp = pl.y - 6, reach;
  for (i = barrels.length - 1; i >= 0; i--) {
    b = barrels[i];
    dx = Math.abs(b.x - pl.x); cyb = b.y - 4;
    reach = (pl.ham > 0) ? 13 : 6;
    if (dx < reach && Math.abs(cyb - cyp) < 9) {
      if (pl.ham > 0) {
        eqAdd(b); barrels.splice(i, 1); addScore(300); beep(900, 20); continue;
      }
      return 1;
    }
    if (pl.st == 1 && b.sc == 0 && dx < 9 && pl.y < b.y - 7 && pl.y > b.y - 26) { b.sc = 1; addScore(100); beep(1100, 10); }
  }
  for (i = fires.length - 1; i >= 0; i--) {
    f = fires[i];
    dx = Math.abs(f.x - pl.x);
    reach = (pl.ham > 0) ? 13 : 6;
    if (dx < reach && Math.abs((f.y - 4) - cyp) < 9) {
      if (pl.ham > 0) { eqAdd(f); fires.splice(i, 1); addScore(500); beep(900, 20); continue; }
      return 1;
    }
  }
  for (i = 0; i < HAMS.length; i++) {
    if (HAMS[i].on && pl.st != 2 && Math.abs(HAMS[i].x - pl.x) < 7 && Math.abs(girderY(HAMS[i].gi, HAMS[i].x) - pl.y) < 6) {
      HAMS[i].on = false; pl.ham = 330 + UP[1] * 90; pl.hv = 0;
      paintRegion(HAMS[i].x - 6, girderY(HAMS[i].gi, HAMS[i].x) - 14, 14, 16);
      addScore(100); beep(1300, 30);
    }
  }
  return 0;
}
function deathAnim() {
  var i, y0 = pl.y, yy, pt = pl.rt, px = pl.rx, py = pl.ry, nt, fc, ny;
  beep(300, 40);
  for (i = 0; i < 28; i++) {
    yy = y0 - (i < 10 ? i * 1.4 : 14 - (i - 10) * 1.0);
    if (i % 2 == 0) { fc = (i & 4) ? 1 : -1; } else { fc = (i & 4) ? -1 : 1; }
    nt = donnieTpl(fc, 1, 0, 0); ny = Math.floor(yy);
    if (pt) { eraseOldT(pt, px, py, nt, Math.floor(pl.x), ny); }
    drawT(nt, Math.floor(pl.x), ny);
    pt = nt; px = Math.floor(pl.x); py = ny;
    wait(45);
  }
  if (pt) { eraseOldT(pt, px, py, EMPTYT, 0, 0); }
  pl.rt = null; pl.sig = -1;
}
function banner(msg, col) {
  fr(60, 70, 200, 30, BLACK); rc(60, 70, 200, 30, col); rc(61, 71, 198, 28, col);
  ctxt(msg, 79, 2, col);
}
function rescueAnim() {
  var i;
  beep(1000, 40);
  for (i = 0; i < 8; i++) {
    ci(PAULX + 3, 16 - (i & 1), 3, DPINK); ci(PAULX - 3, 17, 2, RED);
    wait(120);
    paintRegion(PAULX - 8, 10, 24, 12);
    drawPauline(false);
  }
  banner("RESCUED!", GREEN);
  wait(900);
}

/* ==========================================================
   PLAY ONE LEVEL.  returns 1 rescued, 0 out of lives, -1/-2 quit
   ========================================================== */
function pauseMenu() {
  var r, idx = 0, res = 0;
  menuMode();
  while (true) {
    r = menu("PAUSED", ["Resume", "Save game", "Save & quit", "Quit (no save)", "Sound: " + (SOUND ? "on" : "off")], idx,
      ["Back to the girders", "Saves your run", "Save and go to main menu", "Lose this run's progress", "Toggle beeps"]);
    if (r < 0 || r == 0) { res = 0; break; }
    idx = r;
    if (r == 1) { saveGame(); flash("Saved", GREEN); }
    else if (r == 2) { saveGame(); res = 1; break; }
    else if (r == 3) { res = 2; break; }
    else if (r == 4) { SOUND = !SOUND; saveCfg(); }
  }
  return res;
}
function startScreen() {
  paintAll(); hud(true);
  drawEntities();
  banner("LEVEL " + LV, YEL);
  wait(1000);
  paintAll(); hud(true); drawEntities(); drainEnc();
}
function playLevel() {
  var k, l, died, pm, res, near;
  setupLevel();
  gameMode();
  startScreen();
  while (true) {
    k = inp();
    if (k == 1) {
      if (pl.st == 2) { if (pl.cv < 1) { pl.cv++; } }
      else if (pl.hv < 1) { pl.hv++; }
    } else if (k == 2) {
      if (pl.st == 2) { if (pl.cv > -1) { pl.cv--; } }
      else if (pl.hv > -1) { pl.hv--; }
    } else if (k == 3) {
      if (pl.st == 2) { pl.cv = 0; }
      else if (pl.st == 1 && pl.ham <= 0) {
        near = airLadder();
        if (near >= 0) {
          l = LAD[near];
          pl.st = 2; pl.lad = near; pl.x = l.x; pl.cv = 1; pl.hv = 0; pl.vy = 0; pl.vx = 0;
          if (pl.y < girderY(l.i + 1, l.x)) { pl.y = girderY(l.i + 1, l.x); }
          if (pl.y > girderY(l.i, l.x)) { pl.y = girderY(l.i, l.x); }
          beep(900, 10);
        }
      }
      else if (pl.st == 0 && pl.ham <= 0) {
        near = (pl.hv == 0) ? nearLadder() : -1;
        if (near >= 0) {
          l = LAD[near];
          pl.st = 2; pl.lad = near; pl.x = l.x; pl.cv = (pl.gi == l.i) ? 1 : -1; pl.hv = 0;
        } else {
          pl.st = 1; pl.vy = -(3.2 + 0.15 * UP[2]); pl.vx = pl.hv * pspd(); pl.minY = pl.y; beep(700, 8);
        }
      }
    } else if (k == 4) {
      pm = pauseMenu();
      if (pm == 1) { QUIT = true; return -1; }
      if (pm == 2) { QUIT = true; return -2; }
      gameMode(); paintAll(); hud(true); drawEntities(); drainEnc();
    }
    died = updatePlayer();
    kongLogic(); updateBarrels(); updateFires();
    if (!died) { died = collisions(); }
    tickN++;
    if ((tickN & 7) == 0) { bonus -= 10; hudDirty = true; }
    if (bonus <= 0) { died = 1; }
    if (died) {
      deathAnim();
      LIVES--; hudDirty = true;
      if (LIVES <= 0) { return 0; }
      barrels = []; fires = []; eq = [];
      resetPlayer(); throwT = 70; bonus = Math.max(1500, bonus);
      paintAll(); hud(true); drawEntities(); wait(500); drainEnc();
      continue;
    }
    if (pl.gi == 5 && pl.st == 0 && Math.abs(pl.x - PAULX) < 16) {
      addScore(bonus);
      eraseEntities(); drawEntities();
      rescueAnim();
      return 1;
    }
    eraseEntities();
    drawEntities();
    if (hudDirty) { hud(false); }
    wait(GSPDW[GSPD]);
  }
}

/* ==========================================================
   SAVE / LOAD / CONFIG
   ========================================================== */
function saveGame() {
  var s = "DK1," + [LV, SCORE, LIVES, TOK, UP[0], UP[1], UP[2], UP[3], DIFF, NEXTBONUS].join(",");
  return wrFile("/donniekong_save.txt", s);
}
function clearSave() { wrFile("/donniekong_save.txt", "DK0,0"); }
function hasSave() { return rdFile("/donniekong_save.txt").indexOf("DK1,") == 0; }
function loadGame() {
  var d = rdFile("/donniekong_save.txt"), p, i;
  if (d.indexOf("DK1,") != 0) { return false; }
  p = d.split(",");
  if (p.length < 10) { return false; }
  LV = parseInt(p[1], 10) || 1; SCORE = parseInt(p[2], 10) || 0; LIVES = parseInt(p[3], 10) || 3;
  TOK = parseInt(p[4], 10) || 0;
  for (i = 0; i < 4; i++) { UP[i] = parseInt(p[5 + i], 10) || 0; }
  DIFF = parseInt(p[9], 10); if (!(DIFF >= 0 && DIFF <= 2)) { DIFF = 1; }
  NEXTBONUS = parseInt(p[10], 10) || 10000;
  if (LV < 1) { LV = 1; } if (LV > MAXLV) { LV = MAXLV; }
  return true;
}
function loadHi() { var d = rdFile("/donniekong_hi.txt"); HI = parseInt(d, 10) || 0; }
function saveHi() { wrFile("/donniekong_hi.txt", String(HI)); }
function saveCfg() { wrFile("/donniekong_cfg.txt", "CFG," + GSPD + "," + (SOUND ? 1 : 0) + "," + DIFF); }
function loadCfg() {
  var d = rdFile("/donniekong_cfg.txt"), p;
  if (d.indexOf("CFG,") != 0) { return; }
  p = d.split(",");
  GSPD = parseInt(p[1], 10); if (!(GSPD >= 0 && GSPD <= 2)) { GSPD = 1; }
  SOUND = (p[2] != "0");
  DIFF = parseInt(p[3], 10); if (!(DIFF >= 0 && DIFF <= 2)) { DIFF = 1; }
}
function newGame() {
  LV = 1; SCORE = 0; LIVES = DIFFL[DIFF]; TOK = 0; UP = [0, 0, 0, 0]; NEXTBONUS = 10000;
}

/* ==========================================================
   UPGRADE SHOP
   ========================================================== */
function upCost(i) { if (i == 4) { return 6 + LIVES; } return 3 + 2 * UP[i]; }
function upMax(i) { return (i == 4) ? 9 : 5; }
function shop() {
  var r, idx = 0, items, nm = ["Run speed", "Hammer", "Jump", "Slow barrel", "Life"], i, have;
  menuMode();
  while (true) {
    items = [];
    for (i = 0; i < 5; i++) {
      have = (i == 4) ? LIVES : UP[i];
      if (have >= upMax(i)) { items.push(nm[i] + " " + have + " MAX"); }
      else { items.push(nm[i] + " " + have + "/" + upMax(i) + " " + upCost(i) + "T"); }
    }
    items.push("Next level >>");
    r = menu("UPGRADES  " + TOK + "T", items, idx,
      ["Donnie runs faster", "Hammer lasts longer", "Jump higher", "Barrels roll slower", "+1 life (max 9)", "Start level " + LV]);
    if (r < 0 || r == 5) { return; }
    idx = r;
    have = (r == 4) ? LIVES : UP[r];
    if (have >= upMax(r)) { flash("Maxed out", GRAY); }
    else if (TOK < upCost(r)) { flash("Not enough tokens", RED); }
    else {
      TOK -= upCost(r);
      if (r == 4) { LIVES++; } else { UP[r]++; }
      beep(1000, 30);
      flash("Bought!", GREEN);
    }
  }
}

/* ==========================================================
   SCREENS
   ========================================================== */
function gameOver() {
  saveHi(); clearSave();
  cls(BLACK);
  sctxt("GAME OVER", 30, 3, RED, rgb(60, 0, 0));
  ctxt("Score " + SCORE, 78, 2, WHITE);
  ctxt("Hi-score " + HI, 100, 2, CYAN);
  ctxt("Reached level " + LV, 124, 1, YEL);
  ctxt("Press SEL", 152, 1, HINT);
  beep(300, 120);
  waitKey();
}
function winScreen() {
  saveHi(); clearSave();
  cls(BLACK);
  sctxt("DONNIE WINS!", 24, 3, YEL, rgb(70, 50, 0));
  ctxt("All 50 levels cleared", 70, 2, GREEN);
  ctxt("Final score " + SCORE, 104, 1, WHITE);
  ctxt("Press SEL", 152, 1, HINT);
  beep(1200, 100);
  waitKey();
}
function howTo() {
  listLines("HOW TO PLAY", [
    ["Reach Pauline at the top!", YEL],
    ["TURN knob: clockwise = run right,", WHITE],
    ["  counter = run left. Each click", WHITE],
    ["  steps: left / stop / right.", GRAY],
    ["SEL while running = JUMP barrels", WHITE],
    ["SEL standing at a ladder = climb;", WHITE],
    ["SEL in mid-jump at a ladder = grab", WHITE],
    ["  it. Knob cw = up, ccw = down,", GRAY],
    ["  SEL = pause the climb.", GRAY],
    ["Hammer smashes barrels/fireballs", CYAN],
    ["Jump a barrel = 100 points.", GREEN],
    ["ESC = pause / save / quit", HINT]
  ]);
}
/* ---------- big title-screen characters (design units, drawn 3x) ---------- */
var DRED = rgb(140, 20, 25), HAIRC = rgb(105, 58, 25), DTAN2 = rgb(200, 150, 100), DBLUE = rgb(20, 40, 150),
    KBRN = rgb(140, 85, 40), KDBRN = rgb(88, 48, 24), KLT = rgb(180, 112, 60), KTAN = rgb(228, 178, 122),
    PINKL = rgb(255, 175, 215), DPINK2 = rgb(205, 55, 125);
function bigDonnie(f) {
  var L = [];
  L.push([-4, -21, 7, 1, RED]); L.push([-5, -20, 9, 2, RED]); L.push([-1, -20, 2, 1, WHITE]); L.push([2, -19, 6, 1, DRED]);
  L.push([-5, -18, 2, 3, HAIRC]);
  L.push([-3, -18, 7, 5, TAN]); L.push([-3, -16, 1, 2, DTAN2]);
  L.push([4, -16, 3, 2, TAN]); L.push([5, -15, 1, 1, DTAN2]);
  L.push([1, -17, 3, 1, HAIRC]);
  L.push([2, -16, 2, 2, WHITE]); L.push([3, -16, 1, 2, BLACK]);
  L.push([1, -14, 6, 1, HAIRC]); L.push([0, -13, 4, 1, DTAN2]);
  L.push([-4, -12, 8, 4, RED]);
  L.push([-3, -12, 2, 3, BLUE]); L.push([1, -12, 2, 3, BLUE]);
  L.push([-3, -9, 6, 4, BLUE]); L.push([-3, -6, 6, 1, DBLUE]);
  L.push([-2, -11, 1, 1, YEL]); L.push([2, -11, 1, 1, YEL]);
  if (f == 0) {
    L.push([3, -11, 4, 2, RED]); L.push([7, -11, 2, 2, WHITE]);
    L.push([-7, -10, 3, 2, RED]); L.push([-9, -10, 2, 2, WHITE]);
    L.push([-4, -5, 3, 3, BLUE]); L.push([-6, -2, 5, 2, KBRN]);
    L.push([1, -5, 3, 2, BLUE]); L.push([3, -4, 2, 2, BLUE]); L.push([3, -2, 5, 2, KBRN]);
  } else if (f == 1) {
    L.push([3, -10, 2, 4, RED]); L.push([3, -6, 2, 2, WHITE]);
    L.push([-5, -10, 2, 4, RED]); L.push([-5, -6, 2, 2, WHITE]);
    L.push([-3, -5, 2, 4, BLUE]); L.push([1, -5, 2, 4, BLUE]);
    L.push([-4, -2, 4, 2, KBRN]); L.push([0, -2, 5, 2, KBRN]);
  } else {
    L.push([4, -17, 2, 6, RED]); L.push([4, -19, 2, 2, WHITE]);
    L.push([-6, -17, 2, 6, RED]); L.push([-6, -19, 2, 2, WHITE]);
    L.push([-3, -5, 3, 2, BLUE]); L.push([1, -5, 3, 2, BLUE]);
    L.push([-4, -3, 4, 2, KBRN]); L.push([1, -4, 5, 2, KBRN]);
  }
  return L;
}
function bigKong(f) {
  var L = [];
  L.push([-8, -5, 6, 5, KBRN]); L.push([2, -5, 6, 5, KBRN]);
  L.push([-9, -2, 7, 2, KDBRN]); L.push([2, -2, 7, 2, KDBRN]);
  L.push([-10, -15, 20, 11, KBRN]); L.push([-9, -15, 18, 1, KLT]);
  L.push([-6, -14, 12, 8, KTAN]); L.push([-1, -14, 1, 8, DTAN2]); L.push([-5, -9, 10, 1, DTAN2]);
  L.push([-6, -23, 12, 9, KBRN]); L.push([-5, -24, 10, 1, KDBRN]); L.push([-3, -25, 6, 1, KDBRN]);
  L.push([-7, -20, 1, 3, KBRN]); L.push([6, -20, 1, 3, KBRN]);
  L.push([-4, -21, 8, 6, KTAN]); L.push([-4, -21, 8, 1, KDBRN]);
  L.push([-3, -20, 2, 2, WHITE]); L.push([1, -20, 2, 2, WHITE]); L.push([-2, -19, 1, 1, BLACK]); L.push([2, -19, 1, 1, BLACK]);
  L.push([-1, -18, 2, 1, DTAN2]);
  L.push([-3, -17, 6, 2, BLACK]); L.push([-2, -17, 1, 1, WHITE]); L.push([0, -17, 1, 1, WHITE]); L.push([2, -17, 1, 1, WHITE]);
  if (f == 0) {
    L.push([-14, -14, 4, 12, KBRN]); L.push([10, -14, 4, 12, KBRN]);
    L.push([-15, -3, 5, 4, KDBRN]); L.push([10, -3, 5, 4, KDBRN]);
  } else if (f == 1) {
    L.push([-14, -14, 4, 5, KBRN]); L.push([-10, -11, 5, 3, KBRN]); L.push([-6, -12, 3, 3, KDBRN]);
    L.push([10, -14, 4, 12, KBRN]); L.push([10, -3, 5, 4, KDBRN]);
  } else if (f == 3) {
    L.push([10, -14, 4, 5, KBRN]); L.push([5, -11, 5, 3, KBRN]); L.push([3, -12, 3, 3, KDBRN]);
    L.push([-14, -14, 4, 12, KBRN]); L.push([-15, -3, 5, 4, KDBRN]);
  } else {
    L.push([-14, -22, 4, 10, KBRN]); L.push([10, -22, 4, 10, KBRN]);
    L.push([-15, -25, 5, 3, KDBRN]); L.push([10, -25, 5, 3, KDBRN]);
  }
  return L;
}
function bigPauline(f) {
  var L = [];
  L.push([-4, -20, 8, 2, HAIRC]); L.push([-5, -18, 2, 7, HAIRC]); L.push([3, -18, 2, 7, HAIRC]);
  L.push([-3, -18, 6, 5, TAN]);
  L.push([-2, -16, 1, 1, BLACK]); L.push([1, -16, 1, 1, BLACK]);
  L.push([-3, -15, 1, 1, PINKL]); L.push([2, -15, 1, 1, PINKL]); L.push([-1, -14, 2, 1, RED]);
  L.push([-1, -13, 2, 1, TAN]);
  L.push([-3, -12, 6, 4, DPINK]); L.push([-1, -11, 2, 1, WHITE]);
  L.push([-4, -8, 8, 3, DPINK]); L.push([-5, -5, 10, 3, DPINK]); L.push([-5, -3, 10, 1, DPINK2]);
  L.push([-2, -2, 1, 2, TAN]); L.push([1, -2, 1, 2, TAN]);
  L.push([-3, -1, 2, 1, RED]); L.push([1, -1, 2, 1, RED]);
  if (f == 0) { L.push([-5, -11, 1, 5, TAN]); L.push([4, -11, 1, 5, TAN]); }
  else { L.push([-5, -11, 1, 5, TAN]); L.push([4, -20, 1, 9, TAN]); L.push([4, -22, 1, 2, TAN]); }
  return L;
}
function scaleTpl(L, k) {
  var i, r, M = [];
  for (i = 0; i < L.length; i++) { r = L[i]; M.push([r[0] * k, r[1] * k, r[2] * k, r[3] * k, r[4]]); }
  return mkTpl(M);
}
var TBD = [null, null, null], TBK = [null, null, null, null], TBP = [null, null], TBB = [null, null], TGY = 150;
function tplDonnieBig(f) { if (!TBD[f]) { TBD[f] = scaleTpl(bigDonnie(f), 3); } return TBD[f]; }
function tplKongBig(f) { if (!TBK[f]) { TBK[f] = scaleTpl(bigKong(f), 3); } return TBK[f]; }
function tplPaulBig(f) { if (!TBP[f]) { TBP[f] = scaleTpl(bigPauline(f), 3); } return TBP[f]; }
function tplBarrelBig(b) { if (!TBB[b]) { TBB[b] = scaleTpl(barrelRects(0, 0, b << 2), 2); } return TBB[b]; }
function titleGirder() {
  var rx;
  fr(0, TGY, W, 1, GIRH); fr(0, TGY + 1, W, 3, GIRC); fr(0, TGY + 4, W, 1, GIRD);
  for (rx = 4; rx < W; rx += 8) { fr(rx, TGY + 2, 1, 1, GIRD); }
}
/* background painter for the title screen: plain black + the girder (never a black box over sprites) */
function tpaint(x, y, w, h) {
  var x1 = Math.min(W, x + w), y1 = Math.min(H, y + h);
  x = Math.max(0, x); y = Math.max(0, y);
  if (x1 <= x || y1 <= y) { return; }
  CLIP = true; CX0 = x; CY0 = y; CX1 = x1; CY1 = y1;
  fr(x, y, x1 - x, y1 - y, BLACK);
  if (y1 > TGY && y < TGY + 5) { titleGirder(); }
  CLIP = false;
}
function newEnt() { return { rt: null, rx: 0, ry: 0, sig: -1 }; }
function tShow(e, sg, tpl, x, y) {
  if (e.rt && e.sig === sg) { return; }
  if (e.rt) { eraseOldT(e.rt, e.rx, e.ry, tpl, x, y); }
  drawT(tpl, x, y);
  e.rt = tpl; e.rx = x; e.ry = y; e.sig = sg;
}
function tRedraw(e) { if (e.rt) { drawT(e.rt, e.rx, e.ry); } }
function titleScreen() {
  var t = 0, i, cols = [YEL, ORNG, RED, PINK], lc = -1, eK = newEnt(), eD = newEnt(), eP = newEnt(), eB = newEnt();
  var bx = 96, jt = 0, donX = 168, kseq = [0, 1, 0, 3], k, pf, bit, jy, df, sb = -1, hl = -1, GY = 150, hx = 200, hy = 92;
  TGY = GY; ERASEFN = tpaint;
  cls(BLACK); titleGirder();
  sctxt("by da cbm", 36, 2, WHITE, rgb(30, 30, 90));
  while (true) {
    t++;
    i = (t >> 3) & 3;
    if (i != lc) { lc = i; sctxt("DONNIE KONG", 6, 3, cols[i], rgb(90, 30, 0)); }
    k = kseq[(t >> 3) & 3]; if (((t >> 5) & 3) == 3) { k = 2; }
    tShow(eK, k, tplKongBig(k), 46, GY);
    pf = (t >> 4) & 1;
    tShow(eP, pf, tplPaulBig(pf), 286, GY);
    bx += 2.2; if (bx > W + 24) { bx = 96; }
    bit = Math.floor(bx / 6) & 1;
    tShow(eB, Math.floor(bx) * 4 + bit, tplBarrelBig(bit), Math.floor(bx), GY);
    if (jt == 0 && bx > donX - 66 && bx < donX - 50) { jt = 1; }
    if (jt > 0) { jt++; if (jt > 46) { jt = 0; } }
    jy = (jt > 0) ? Math.floor(Math.sin(Math.PI * jt / 46) * 36) : 0;
    df = (jt > 0) ? 2 : ((t >> 2) & 1);
    tShow(eD, df * 1000 + jy, tplDonnieBig(df), donX, GY - jy);
    tRedraw(eK); tRedraw(eP); tRedraw(eB); tRedraw(eD);
    if (pf != hl) { hl = pf; txt("HELP!", hx, hy, 2, pf == 1 ? WHITE : BLACK); }
    i = ((t >> 4) & 1);
    if (i != sb) { sb = i; txt("Press SEL to start", 52, 156, 2, i == 0 ? WHITE : BLACK); }
    if (kSel() || kEsc()) { ERASEFN = null; settleInput(); return; }
    drainEnc(); wait(30);
  }
}

/* ==========================================================
   MAIN FLOW
   ========================================================== */
function playGame() {
  var res;
  QUIT = false;
  while (true) {
    res = playLevel();
    if (res == 1) {
      TOK += 2 + Math.floor(LV / 10);
      if (LV >= MAXLV) { winScreen(); return; }
      LV++;
      saveGame();
      shop();
      saveGame();
    } else if (res == 0) { gameOver(); return; }
    else if (res == -1) { saveHi(); return; }
    else { saveHi(); clearSave(); return; }
  }
}
function runGame() {
  var r, idx = 0, saved, go;
  loadHi(); loadCfg();
  titleScreen();
  menuMode();
  while (true) {
    saved = hasSave();
    r = menu("DONNIE KONG" + (HI > 0 ? " " + HI : ""),
      ["Continue", "New Game", "Difficulty: " + DIFFN[DIFF], "Speed: " + GSPDN[GSPD], "How To Play", "Exit"], idx,
      [saved ? "Resume your saved run" : "No saved game yet", "Start from level 1", "SEL cycles Easy/Normal/Hard", "SEL cycles game speed", "Controls and tips", "Quit to the launcher"]);
    if (r < 0) { r = 5; }
    idx = r; go = false;
    if (r == 0) {
      if (saved && loadGame()) { go = true; } else { flash("No saved game", RED); }
    } else if (r == 1) { newGame(); go = true; }
    else if (r == 2) { DIFF = (DIFF + 1) % 3; saveCfg(); }
    else if (r == 3) { GSPD = (GSPD + 1) % 3; saveCfg(); }
    else if (r == 4) { howTo(); }
    else if (r == 5) { cls(BLACK); ctxt("BYE FROM DA CBM", 80, 2, YEL); wait(700); return; }
    if (go) { playGame(); menuMode(); }
  }
}
function errScreen(msg) {
  cls(rgb(60, 0, 0));
  txt("Recovered from an error", 6, 6, 1, WHITE);
  var m = String(msg), y = 22;
  while (m.length > 0 && y < H - 30) { txt(m.substring(0, 50), 6, y, 1, YEL); m = m.substring(50); y += 11; }
  txt("Progress saved. Press SEL", 6, H - 14, 1, WHITE);
  waitKey();
}
function main() {
  var tries = 0, again = true, msg;
  while (again) {
    again = false;
    try { calibrateClock(); runGame(); }
    catch (err) {
      msg = (err && err.message) ? err.message : String(err);
      try { saveGame(); } catch (e2) {}
      try { wrFile("/donniekong_error.txt", msg + " lv " + LV); } catch (e4) {}
      try { errScreen(msg); } catch (e3) {}
      tries++;
      if (tries < 4) { again = true; try { menuMode(); } catch (e5) {} }
    }
  }
}
main();
