/* ==========================================================
   HACKERZ  (Enhanced)
   by da cbm  + community extensions
   Bruce firmware 1.16.1  |  LilyGO T-Embed CC1101 (320x170)   ES5
   ----------------------------------------------------------
   A pure-fiction hacker game. Nothing in here is real.
   TURN the knob = walk the street     SEL = act     ESC = menu
   Walk to a glowing arrow:
     GREEN  = shop / cafe / library     YELLOW = your safehouse
     PINK   = hack target (breach mini-game)
     CYAN   = bus stop (travel between 6 districts)
   Buy parts, solder devices at your workbench, then breach all
   8 targets (school to power grid) + bonus targets (no day limit).
   Difficulty (Easy/Normal/Hard/NewGame+), Skill points, Trophies,
   Assembly mini-game, AI crew missions, Crew, Informants, Street life,
   Autosave on sleep, Daily summary.
   Targets close 10 PM-6 AM: pick the lock (lock picks) to hack
   them after hours for +50% pay. Sleep until 12 PM added.
   Cafes are open 24/7. 12 extra side targets (they count
   toward the win) are scattered across the new districts.
   Two big hacks per day. No day limit; win = all targets, all upgrades, one night break-in.
   12/24 hr clock (toggle in menus). 3 named save slots:
   /hackerz_slot1..3.txt (SD card, else LittleFS)
   ========================================================== */

var W = display.width();
var H = display.height();

/* ---------- random ---------- */
var seed = 48271;
try { var t0 = now(); if (t0) { seed = (t0 % 2147483646) + 1; } } catch (e0) {}
function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
function ri(a, b) { return a + Math.floor(rnd() * (b - a + 1)); }

/* ---------- draw helpers ---------- */
function rgb(r, g, b) {
  r = Math.max(0, Math.min(255, Math.floor(r)));
  g = Math.max(0, Math.min(255, Math.floor(g)));
  b = Math.max(0, Math.min(255, Math.floor(b)));
  return ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3);
}
var HAS_RECT = (typeof display.drawRect === "function");
var HAS_LINE = (typeof display.drawLine === "function");
var HAS_CIRC = (typeof display.drawFillCircle === "function");
var HAS_STR = (typeof display.drawString === "function");
var HAS_CIRCO = (typeof display.drawCircle === "function");
function iv(v) { v = Math.floor(v); return (v > -5000 && v < 5000) ? v : 0; }
function fr(x, y, w, h, c) {
  var x0 = iv(x), y0 = iv(y);
  var x1 = x0 + iv(w), y1 = y0 + iv(h);
  if (x0 < 0) { x0 = 0; } if (y0 < 0) { y0 = 0; }
  if (x1 > W) { x1 = W; } if (y1 > H) { y1 = H; }
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
  if (HAS_LINE) { display.drawLine(x1, y1, x2, y2, c); return; }
  var n = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1);
  for (var i = 0; i <= n; i += 1) { fr(x1 + (x2 - x1) * i / n, y1 + (y2 - y1) * i / n, 1, 1, c); }
}
function ci(x, y, r, c) {
  x = iv(x); y = iv(y); r = Math.max(1, iv(r));
  if (HAS_CIRC) { display.drawFillCircle(x, y, r, c); return; }
  for (var dy = -r; dy <= r; dy++) {
    var dx = Math.floor(Math.sqrt(r * r - dy * dy));
    fr(x - dx, y + dy, dx * 2 + 1, 1, c);
  }
}
/* line clipped to the screen (never sends off-screen coordinates to the display) */
function lnc(x1, y1, x2, y2, c) {
  var dx = x2 - x1, dy = y2 - y1, t0 = 0, t1 = 1, p, q, r, i;
  var P = [-dx, dx, -dy, dy], Q = [x1, W - 1 - x1, y1, H - 1 - y1];
  for (i = 0; i < 4; i++) {
    p = P[i]; q = Q[i];
    if (p == 0) { if (q < 0) { return; } }
    else {
      r = q / p;
      if (p < 0) { if (r > t1) { return; } if (r > t0) { t0 = r; } }
      else { if (r < t0) { return; } if (r < t1) { t1 = r; } }
    }
  }
  ln(x1 + t0 * dx, y1 + t0 * dy, x1 + t1 * dx, y1 + t1 * dy, c);
}
/* solid disc + outline ring. The fill is painted first and the ring on top,
   so no pixel flashes dark while the bird is redrawn (no flicker) */
function discO(cx, cy, r, fc, oc) {
  if (HAS_CIRCO) {
    ci(cx, cy, r, fc);
    display.drawCircle(iv(cx), iv(cy), r + 1, oc);
    display.drawCircle(iv(cx), iv(cy), r, oc);
  } else { ci(cx, cy, r + 1, oc); ci(cx, cy, r, fc); }
}
/* thick line made of circles (step follows the radius) */
function tl2(x1, y1, x2, y2, r, c) {
  var n = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1);
  var st = Math.max(1, Math.floor(r * 0.7));
  var i;
  for (i = 0; i <= n; i += st) { ci(x1 + (x2 - x1) * i / n, y1 + (y2 - y1) * i / n, r, c); }
  ci(x2, y2, r, c);
}
/* filled ellipse, rows 2px tall */
function ell(cx, cy, rx, ry, c) {
  var dy, t, dx;
  cx = iv(cx); cy = iv(cy); rx = iv(rx); ry = Math.max(1, iv(ry));
  for (dy = -ry; dy <= ry; dy += 2) {
    t = dy / ry;
    dx = Math.floor(rx * Math.sqrt(Math.max(0, 1 - t * t)));
    fr(cx - dx, cy + dy, dx * 2 + 1, 2, c);
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
var BLACK = rgb(0, 0, 0), WHITE = rgb(255, 255, 255), RED = rgb(230, 50, 40),
    GREEN = rgb(60, 210, 80), YEL = rgb(250, 220, 40), BLUE = rgb(60, 140, 255),
    GRAY = rgb(130, 130, 140), DARK = rgb(8, 18, 34), ORNG = rgb(250, 150, 30),
    CYAN = rgb(80, 220, 230), TAN = rgb(235, 205, 140), CREAM = rgb(250, 245, 225),
    HDR = rgb(25, 95, 150), HINT = rgb(255, 230, 120);

/* ---------- input (hardened encoder debounce) ---------- */
var MENU_GAP = 160, MENU_REV = 300, GAME_GAP = 45, GAME_REV = 70;
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
function confirmBox(msg) {
  fr(20, 50, W - 40, 70, BLACK);
  rc(20, 50, W - 40, 70, YEL);
  ctxt(msg, 60, 2, WHITE);
  ctxt("SEL = Yes    ESC = No", 98, 1, YEL);
  return waitKey() == 3;
}
function popup(lines, col) {
  fr(25, 30, W - 50, 112, BLACK);
  rc(25, 30, W - 50, 112, col);
  rc(26, 31, W - 52, 110, col);
  for (var i = 0; i < lines.length; i++) {
    ctxt(lines[i][0], 38 + i * 19, lines[i][1], lines[i][2]);
  }
  ctxt("SEL to continue", 128, 1, GRAY);
  waitKey();
}

/* ---------- scenery palette + pieces (clipped redraw) ---------- */
var PHM = [[1.0, 0.86, 0.8], [1, 1, 1], [0.32, 0.34, 0.55]];
var SKYT = [[80, 110, 200], [60, 140, 235], [6, 8, 30]];
var SKYB = [[255, 175, 110], [190, 230, 255], [40, 45, 95]];
var STX = [], STY = [];
(function () {
  var i, s = 7;
  for (i = 0; i < 26; i++) {
    s = (s * 16807) % 2147483647; STX[i] = s % W;
    s = (s * 16807) % 2147483647; STY[i] = 16 + (s % 90);
  }
})();
function hh(a, b) { return ((a * 73 + b * 151 + a * b * 31) % 97) / 97; }
function K(r, g, b) { var m = PHM[PH]; return rgb(r * m[0], g * m[1], b * m[2]); }
function KG(r, g, b) { var m = PHM[PH]; return rgb(r * (0.55 + 0.45 * m[0]), g * (0.55 + 0.45 * m[1]), b * (0.55 + 0.45 * m[2])); }
function Cc(cx, cy, r, c) {
  var dy, dx;
  for (dy = -r; dy <= r; dy++) {
    dx = Math.floor(Math.sqrt(r * r - dy * dy) + 0.4);
    R(cx - dx, cy + dy, dx * 2 + 1, 1, c);
  }
}
function E(cx, cy, rx, ry, c) {
  var dy, t, dx;
  for (dy = -ry; dy <= ry; dy += 2) {
    t = dy / ry; dx = Math.floor(rx * Math.sqrt(Math.max(0, 1 - t * t)));
    R(cx - dx, cy + dy, dx * 2 + 1, 2, c);
  }
}
function sky() {
  var i, t, T = SKYT[PH], B = SKYB[PH];
  for (i = 0; i < 9; i++) {
    t = i / 8;
    R(0, 14 + i * 14, W, 15, rgb(T[0] + (B[0] - T[0]) * t, T[1] + (B[1] - T[1]) * t, T[2] + (B[2] - T[2]) * t));
  }
  if (PH == 2) {
    for (i = 0; i < 26; i++) { R(STX[i], STY[i], (i % 3 == 0) ? 2 : 1, (i % 3 == 0) ? 2 : 1, rgb(230, 230, 255)); }
    Cc(252, 40, 11, rgb(235, 235, 210)); Cc(257, 37, 10, rgb(12, 14, 45));
  } else if (PH == 1) {
    Cc(170, 38, 18, rgb(255, 245, 190)); Cc(170, 38, 12, rgb(255, 236, 90));
    cloud(40, 50, 255); cloud(220, 70, 255);
  } else {
    Cc(256, 100, 20, rgb(255, 190, 120)); Cc(256, 100, 12, rgb(255, 225, 130));
    cloud(60, 52, 250); cloud(150, 38, 235);
  }
}
function cloud(x, y, v) {
  var c = rgb(v, v, v);
  Cc(x, y, 6, c); Cc(x + 9, y - 4, 8, c); Cc(x + 19, y, 6, c); R(x - 4, y, 28, 6, c);
}
function skyline(r, g, b, sd) {
  var x, h;
  for (x = 0; x < W; x += 22) { h = 30 + Math.floor(hh(x, sd) * 62); R(x, GR - h, 21, h, K(r, g, b)); }
}
function bld(x, w, h, r, g, b, st) {
  var top = GR - h, cols = Math.floor((w - 4) / 10), rows = Math.floor((h - 12) / 16), i, j, wx, wy, v, wc;
  R(x, top, w, h, K(r, g, b));
  if (st == 4) {
    R(x + 4, top - 6, w - 8, 6, K(r, g, b)); R(x + 8, top - 11, w - 16, 5, K(r, g, b));
    R(x + w / 2 - 2, top - 16, 4, 5, K(r * 0.8, g * 0.8, b * 0.8));
  } else { R(x - 1, top - 3, w + 2, 4, K(r * 0.65, g * 0.65, b * 0.65)); }
  wc = (PH == 1) ? K(150, 195, 230) : ((PH == 0) ? rgb(255, 190, 130) : rgb(30, 40, 70));
  for (j = 0; j < rows; j++) {
    for (i = 0; i < cols; i++) {
      wx = x + 4 + i * 10; wy = top + 8 + j * 16; v = hh(i * 7 + x, j * 13 + 3);
      if (st == 1 && v > 0.78) { R(wx, wy, 7, 10, K(95, 65, 35)); R(wx, wy + 4, 7, 1, K(60, 40, 20)); }
      else if (PH == 2 && v < 0.5) { R(wx, wy, 7, 10, rgb(255, 215, 110)); }
      else if (st == 1 && v < 0.25) { R(wx, wy, 7, 10, K(12, 12, 18)); }
      else { R(wx, wy, 7, 10, wc); }
      if (st == 4) { R(wx - 1, wy - 1, 9, 1, K(240, 235, 225)); }
    }
  }
}
function tree(x, h, r, g, b) {
  R(x - 2, GR - h, 5, h, K(90, 60, 35));
  Cc(x, GR - h - 6, 12, K(r, g, b)); Cc(x - 8, GR - h + 2, 8, K(r * 0.9, g * 0.9, b * 0.9)); Cc(x + 8, GR - h + 2, 8, K(r * 0.9, g * 0.9, b * 0.9));
}
function ground(r, g, b, cr, cg, cb) {
  R(0, GR, W, 22, K(r, g, b)); R(0, GR, W, 3, K(cr, cg, cb)); R(0, GR + 3, W, 1, K(r * 0.6, g * 0.6, b * 0.6));
}
function lamp(x) {
  R(x, 90, 3, 46, K(60, 60, 70)); R(x - 6, 86, 16, 5, K(60, 60, 70));
  if (PH == 2) { R(x - 5, 91, 14, 2, rgb(255, 235, 150)); E(x + 1, 112, 14, 22, rgb(40, 38, 30)); }
}
function busStop(x) {
  R(x - 18, 110, 38, 3, K(70, 80, 90)); R(x - 18, 112, 2, 24, K(70, 80, 90)); R(x + 18, 112, 2, 24, K(70, 80, 90));
  R(x - 16, 128, 32, 3, K(120, 75, 40)); R(x - 14, 114, 28, 12, (PH == 2) ? rgb(70, 90, 120) : K(160, 200, 230));
  R(x + 24, 98, 3, 38, K(80, 80, 90)); R(x + 17, 90, 18, 13, rgb(40, 110, 200)); R(x + 20, 95, 12, 4, rgb(255, 255, 255));
}

/* ==========================================================
   SCENE ENGINE - the scene is redrawn only inside a small
   clip box around whatever moved (no full-screen flicker)
   ========================================================== */
var GR = 136, FY = 150;
var CL0 = 0, CL1 = 14, CL2 = W, CL3 = 158;
var PH = 1, MB = 0, SHOWSP = true;
var PX = 90, PF = 1, PWK = 0, WACC = 0, WMIN = 0, WALKMIN = 0, EVT = false;
var LEAVE = false, TR = "", QUITALL = false;
var PINK = rgb(255, 100, 180), VIOL = rgb(190, 90, 255), DONEG = rgb(90, 200, 110), MATG = rgb(120, 255, 150);

/* the background is recorded ONCE per district/phase into a rectangle list
   (bucketed into 40px strips) so any small spot can be restored instantly */
var REC = false, RN = 0, RX = [], RY = [], RW = [], RH = [], RC = [], BK = [[], [], [], [], [], [], [], []], RKEY = -1;
var SPRL = null;
function R(x, y, w, h, c) {
  x = Math.floor(x); y = Math.floor(y); w = Math.floor(w); h = Math.floor(h);
  if (w <= 0 || h <= 0) { return; }
  var x1 = x + w, y1 = y + h, s, s0, s1;
  if (REC) {
    if (x < 0) { x = 0; } if (y < 14) { y = 14; }
    if (x1 > W) { x1 = W; } if (y1 > 158) { y1 = 158; }
    if (x1 <= x || y1 <= y) { return; }
    RX[RN] = x; RY[RN] = y; RW[RN] = x1 - x; RH[RN] = y1 - y; RC[RN] = c;
    s0 = Math.floor(x / 40); s1 = Math.floor((x1 - 1) / 40);
    for (s = s0; s <= s1; s++) { BK[s].push(RN); }
    RN++;
    return;
  }
  if (x < CL0) { x = CL0; } if (y < CL1) { y = CL1; }
  if (x1 > CL2) { x1 = CL2; } if (y1 > CL3) { y1 = CL3; }
  if (x1 <= x || y1 <= y) { return; }
  display.drawFillRect(x, y, x1 - x, y1 - y, c);
}

/* ---------- world data ---------- */
var T_HOME = 0, T_BANK = 1, T_TGT = 2, T_TRAVEL = 3, T_ELEC = 4, T_PAWN = 5, T_LIB = 6, T_CAFE = 7, T_HARD = 8, T_SCRAP = 9, T_BM = 10, T_GARAGE = 11, T_BOOTH = 12, T_SUPPLY = 13, T_ROBOT = 14, T_LOCK = 15, T_CORNER = 16;
var LOCN = ["Downtown", "Tech Row", "Industrial", "Campus", "Harbor", "Suburbs",
  "Midtown", "Old Town", "Airport Dist", "U Heights", "Warehouse", "Chinatown", "Financial", "Riverfront", "Market Sq", "Neon Alley"];
/* spot = [x, type, arg] — 4 activity spots + bus; booth on several */
var SP = [
  [[40, 0, 0], [100, 1, 0], [160, 2, 3], [220, 2, 6], [285, 3, 0]],
  [[40, 4, 0], [100, 5, 0], [160, 6, 0], [220, 7, 0], [285, 3, 0]],
  [[40, 8, 0], [100, 9, 0], [160, 2, 4], [220, 2, 7], [285, 3, 0]],
  [[50, 2, 0], [120, 2, 1], [190, 7, 1], [240, 12, 0], [285, 3, 0]],
  [[50, 10, 0], [130, 2, 5], [210, 9, 1], [250, 12, 0], [285, 3, 0]],
  [[50, 2, 2], [120, 11, 0], [200, 16, 0], [245, 12, 0], [285, 3, 0]],
  /* 10 new districts — 4 spots + bus */
  [[40, 13, 0], [110, 4, 0], [180, 2, 19], [250, 16, 0], [285, 3, 0]],
  [[40, 8, 0], [110, 14, 0], [180, 5, 0], [250, 2, 11], [285, 3, 0]],
  [[40, 15, 0], [110, 4, 0], [180, 2, 21], [250, 2, 22], [285, 3, 0]],
  [[40, 6, 0], [110, 7, 0], [180, 2, 17], [250, 16, 0], [285, 3, 0]],
  [[40, 9, 0], [110, 8, 0], [180, 10, 0], [250, 2, 15], [285, 3, 0]],
  [[40, 7, 0], [110, 5, 0], [180, 16, 0], [250, 2, 14], [285, 3, 0]],
  [[40, 1, 0], [110, 4, 0], [180, 15, 0], [250, 2, 20], [285, 3, 0]],
  [[40, 2, 16], [110, 11, 0], [180, 7, 0], [250, 16, 0], [285, 3, 0]],
  [[40, 13, 0], [110, 8, 0], [180, 2, 13], [250, 2, 12], [285, 3, 0]],
  [[40, 10, 0], [110, 14, 0], [180, 2, 18], [250, 16, 0], [285, 3, 0]]
];
var SCB = [YEL, GREEN, PINK, CYAN, GREEN, GREEN, GREEN, GREEN, GREEN, GREEN, VIOL, GREEN, ORNG, GREEN, CYAN, ORNG, GREEN];
var SNAME = ["Safehouse", "Bank", "Target", "Bus stop", "Electronics store", "Pawn shop", "Library", "Cafe", "Hardware store", "Scrap yard", "Black market", "Garage sale", "Phone booth", "Supply store", "Robot shop", "Lock service", "Corner store"];

/* targets - all fictional (0-7 main, 8-10 bonus unlocked after Power Grid) */
var NTG = 8;
var NBT = 3;
var NSD = 12;                 /* side targets 11..22 (not needed to win) */
var NALL = NTG + NBT + NSD;
var TN = ["Lincoln High", "State Univ", "Metro Mall", "Mega Bank", "Water Works", "Port Authority", "Data Center", "Power Grid", "Airport Hub", "Stadium Net", "Casino Vault", "Corner Diner", "Farmers Co-op", "Cinema Box Office", "Dragon Telecom", "Freight Depot", "Riverboat Arcade", "Tuition Office", "Club Neon VIP", "Skyline Tower", "Crypto Exchange", "Airport Radar", "Satellite Farm"];
var TPAY = [250, 700, 1800, 5000, 12000, 25000, 50000, 100000, 180000, 250000, 400000, 150, 150, 400, 400, 1100, 1100, 3000, 3000, 7000, 15000, 30000, 60000];
var TFLV = ["Grades got shuffled. Teachers are confused.", "Campus network now plays your playlist.", "Every store sign says HACKERZ.", "Vault numbers did a little dance.", "Fountains ran backwards for a minute.", "Cranes spelled out your name.", "The servers sent you a thank-you note.", "Whole city blinked. Nobody saw you.", "Flight boards all say HACKERZ.", "The jumbotron played your anthem.", "Every slot machine paid out once.", "The daily special is now HACKERZ soup.", "Every melon got a free price drop.", "All tickets say ADMIT ONE LEGEND.", "Every phone rang with a 8-bit tune.", "Forklifts did a little conga line.", "The paddle boat pays out in tokens.", "Tuition bills now say THANK YOU.", "The VIP list is just your name.", "The tower lights spell your tag.", "All the coins blinked. None were stolen.", "The radar draws a smiley face.", "Every dish points right at you."];
var TREQ = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 1, 1, 2, 2, 3, 3, 4, 4, 5, 6, 7, 8]; /* power needed */
/* art style of each target from 8 up: 0 shop, 1 tower, 2 dome, 3 factory */
var TSTY = [1, 2, 2, 0, 0, 0, 1, 3, 2, 0, 2, 1, 1, 1, 2];
/* a target shows in lists if it is a main target, a side target, or an unlocked bonus */
function tgtClosed() { var h = hourOf(); return h >= 22 || h < 6; }   /* hack targets close 10 PM - 6 AM */
function visT(i) { return i < NTG || i >= NTG + NBT; }   /* bonus 8-10 are not on the map */

/* parts */
var NIT = 45;
var IN = ["ESP32 Board", "nRF24 Module", "CC1101 Module", "H4W Board", "Hackberry Pi", "Raspberry Pi", "Pico W", "TFT Screen", "LiPo Battery", "Antenna", "SD Card", "GPS Module", "Encoder", "Solder", "Flux", "Capacitors", "Resistors", "LEDs", "Breadboard", "Jumper Wires", "Heat Shrink", "Enclosure", "Header Pins", "SDR Dongle", "Amp Module", "Secure Chip", "VPN Stick", "Wifi Pineapple", "Halehund", "Lilygud T-Embed", "BLE Dolphin Nano", "Generic Router", "Gryphon OS", "Laptop", "ESP32 C5 Chips", "Switches", "Wire", "Buttons", "Filament", "Lock Picks", "Solder Plate", "Dolphin Zero", "Drone", "Mil Drone", "Hack Drone"];
var IL = [10, 5, 9, 38, 70, 55, 5, 12, 8, 4, 6, 12, 3, 5, 3, 2, 2, 1, 4, 3, 2, 6, 1, 90, 60, 100, 50, 85, 40, 30, 25, 25, 60, 180, 8, 2, 3, 1, 12, 25, 40, 120, 90, 400, 250];
var IH = [18, 9, 15, 55, 95, 75, 8, 20, 12, 8, 10, 18, 6, 8, 5, 4, 4, 3, 7, 5, 4, 10, 3, 140, 90, 150, 80, 120, 60, 45, 40, 45, 110, 260, 14, 4, 6, 3, 18, 40, 70, 180, 140, 600, 380];
var IDS = ["Wi-Fi + BT microcontroller", "2.4GHz radio chip", "Sub-GHz radio chip", "H4W multi-radio board", "Tiny powerful handheld computer", "Single board computer", "Small dual-core board", "Little color display", "Rechargeable battery (1 per breach)", "Radio antenna", "Storage card", "Location module", "Rotary knob", "Soldering wire", "Makes solder flow", "Smooths the power", "Limits the current", "Tiny lights", "Prototype board", "Wires to connect stuff", "Neat insulation", "Protective case", "Pin strips", "Wide-band radio dongle", "Signal booster", "Encrypted chip", "Hides your trail", "Wi-Fi gadget box", "ESP32 radio toolkit board", "Knob + screen dev board", "Bluetooth LE gadget", "Basic home router", "Gryphon OS phone: call a cab at 75%+ heat", "A real computer: breach zone +6 if owned", "Newer dual-band ESP32 chip", "Clicky toggles", "Hookup wire", "Push buttons", "Prints 3 cases at your safehouse", "For lockpicking jobs", "Heated plate: +8% build success", "BLE Dolphin Zero kit", "Civilian quadcopter", "Hardened military drone", "Wi-Fi/BT hacking drone"];

/* devices */
var DN = ["ESP32 Probe", "nRF Sniffer", "CC1101 Radio", "H4W Handheld", "Hackberry Deck", "Pi Cyberdeck", "SDR Rig", "Ghost Kit", "C5 Node", "Dolphin Nano Kit", "Halehund Deck", "Lilygud Pocket", "Pineapple Rig", "Laptop Rig"];
var DV = [80, 200, 450, 1100, 2200, 4500, 9000, 20000, 150, 300, 900, 1800, 3500, 8000];
var NDEV = 14;
var DP = [1, 2, 3, 4, 5, 6, 7, 8, 2, 3, 4, 5, 6, 7];
var ORD = [];
(function () { var q, d; for (q = 1; q <= 8; q++) { for (d = 0; d < NDEV; d++) { if (DP[d] == q) { ORD.push(d); } } } })();
var DR = [
  [[0, 1], [8, 1], [16, 1], [15, 1], [13, 1], [22, 1]],
  [[1, 1], [6, 1], [9, 1], [15, 1], [16, 1], [13, 1], [19, 1]],
  [[2, 1], [0, 1], [9, 1], [10, 1], [8, 1], [13, 1], [14, 1], [15, 1]],
  [[3, 1], [7, 1], [8, 1], [21, 1], [10, 1], [12, 1], [13, 1], [20, 1]],
  [[4, 1], [7, 1], [8, 1], [21, 1], [10, 1], [9, 1], [11, 1], [13, 1]],
  [[5, 1], [7, 1], [8, 2], [21, 1], [10, 1], [9, 1], [12, 1], [13, 1], [14, 1]],
  [[23, 1], [5, 1], [9, 2], [24, 1], [8, 1], [21, 1], [10, 1], [13, 1], [14, 1]],
  [[25, 1], [4, 1], [26, 1], [24, 1], [0, 1], [8, 2], [21, 1], [13, 2], [14, 1]],
  [[34, 1], [8, 1], [37, 1], [35, 1], [36, 1], [13, 1], [22, 1]],
  [[30, 1], [8, 1], [21, 1], [35, 1], [37, 2], [13, 1]],
  [[28, 1], [8, 1], [10, 1], [21, 1], [37, 1], [36, 1], [13, 1]],
  [[29, 1], [34, 1], [8, 1], [21, 1], [9, 1], [10, 1], [13, 1]],
  [[27, 1], [31, 1], [32, 1], [36, 2], [35, 1], [8, 1], [21, 1], [13, 1]],
  [[33, 1], [27, 1], [9, 2], [36, 2], [8, 1], [13, 1]]
];
var PHN = ["MORN", "DAY", "NITE"];
var DAYS = 100;

/* ---------- difficulty ---------- */
/* 0=Easy 1=Normal 2=Hard 3=NewGame+ */
var DIFF = 1;
var DIFFN = ["Easy", "Normal", "Hard", "New Game+"];
var DIFF_CASH = [600, 400, 250, 350];
var DIFF_DAYS = [120, 100, 80, 90];
var DIFF_HEAT = [0.7, 1.0, 1.35, 1.5];
var DIFF_RIVAL = [0.08, 0.15, 0.28, 0.35];
var NGPLUS_UNLOCKED = false;

/* ---------- skills ---------- */
/* points earned on level-up; spend on Stealth/Speed/Luck/Charm */
var SKN = ["Stealth", "Speed", "Luck", "Charm"];
var SKD = ["Less heat from everything", "Faster builds & less energy cost", "Better scrap, contracts, finds", "Cheaper bribes & better deals"];
function skillLevel(i) { return (G.sk && G.sk[i]) ? G.sk[i] : 0; }
function heatMul() { return DIFF_HEAT[DIFF] * Math.max(0.1, 1 - skillLevel(0) * 0.05); }
function buildTimeMul() { return Math.max(0.45, 1 - skillLevel(1) * 0.055); }
function luckBonus() { return Math.min(0.4, skillLevel(2) * 0.035); }
function charmMul() { return Math.max(0.45, 1 - skillLevel(3) * 0.06); }

/* ---------- trophies ---------- */
var TRN = ["Clean Record", "Grid Cracker", "All Targets", "Big Money", "Cool Head", "Fast Hands", "Full Crew", "AI Foreman", "First Build", "Night Owl"];
var TRD = ["Hack 10 targets, 3 or fewer arrests", "Hack the Power Grid", "Hack every main + side target", "Reach $250,000 cash+bank", "Hack 5 targets, heat never over 60%", "Hack 10 targets by day 30", "Hire a crew member", "AI robot delivers a build batch", "Build your first device", "Hack 2 targets at night"];
function hasTrophy(i) { return (G.tr & (1 << i)) != 0; }
function checkTrophies() {
  var done = nDone() + nSideDone(), i, anyDev = false;
  for (i = 0; i < NDEV; i++) { if (G.dev[i] > 0) { anyDev = true; } }
  if (done >= 10 && (G.arrests || 0) <= 3) { unlockTrophy(0); }
  if (G.tg[7]) { unlockTrophy(1); }
  if (targetsAll()) { unlockTrophy(2); }
  if (G.cash + G.bank >= 250000) { unlockTrophy(3); }
  if (done >= 5 && (G.maxheat || 0) <= 60) { unlockTrophy(4); }
  if (done >= 10 && dayOf() <= 30) { unlockTrophy(5); }
  if (G.crew) { unlockTrophy(6); }
  if (anyDev) { unlockTrophy(8); }
  if ((G.nightHacks || 0) >= 2) { unlockTrophy(9); }
}
function unlockTrophy(i) {
  if (hasTrophy(i)) { return; }
  G.tr |= (1 << i);
  flash("TROPHY: " + TRN[i], YEL);
}

/* ---------- AI crew missions (robots build, crew collects and sells) ---------- */
var CREWMSG = [], CREWTROPHY = false;
var CB_BATCH = 10, CB_MIN = 480, CS_PERDAY = 10, SMODE = ["Off", "Spare devices", "Spare parts", "Devices + parts"];
var RB_PRICE = [25000, 40000, 60000], RB_UP = [8000, 20000, 45000, 90000], RB_MAXL = 5;
function newRobot() { return { sel: 0, rep: 0, end: 0, q: "", lvl: 1, cond: 100 }; }
function ensureRobots() { var n = G.robot || 0; if (!G.rb) { G.rb = []; } while (G.rb.length < n) { G.rb.push(newRobot()); } }
function fmtLeft(m) { m = Math.max(0, Math.ceil(m)); return Math.floor(m / 60) + "h " + two(m % 60) + "m"; }
function loyVal() { return (G.loy == null) ? 50 : G.loy; }
function loyName() { var l = loyVal(); return l >= 75 ? "Devoted" : (l >= 50 ? "Loyal" : (l >= 25 ? "Steady" : "Restless")); }
function rbMin(r) { return CB_MIN - (G.rb[r].lvl - 1) * 60; }
function rbChance(r) {
  var o = G.rb[r], c = buildChance() + 10 + (o.lvl - 1) * 3;
  if (G.crew && loyVal() >= 75) { c += 5; }
  if (o.cond < 60) { c -= Math.floor((60 - o.cond) / 2); }
  return Math.max(20, Math.min(98, c));
}
function rbServiceCost(r) { var o = G.rb[r]; return 100 + (100 - o.cond) * 12 * o.lvl; }
function cbHas(r, d) { return (G.rb[r].sel & (1 << d)) != 0; }
function cbSelCount(r) { var d, n = 0; for (d = 0; d < NDEV; d++) { if (cbHas(r, d)) { n++; } } return n; }
function partsReady(d) { var i, r = DR[d]; for (i = 0; i < r.length; i++) { if ((G.inv[r[i][0]] || 0) < r[i][1]) { return false; } } return true; }
/* the crew never sells a part that any robot's build list needs; otherwise it keeps 2 of each */
function cbKeep(p) {
  var k, d, i, r;
  for (k = 0; k < (G.robot || 0); k++) {
    for (d = 0; d < NDEV; d++) { if (cbHas(k, d)) { r = DR[d]; for (i = 0; i < r.length; i++) { if (r[i][0] == p) { return 99999; } } } }
  }
  return 2;
}
function stockCount(mode) {
  var n = 0, d, i;
  ensureRobots();
  if (mode == 1 || mode == 3) { for (d = 0; d < NDEV; d++) { if (G.dev[d] > 1) { n += G.dev[d] - 1; } } }
  if (mode == 2 || mode == 3) { for (i = 0; i < NIT; i++) { if ((G.inv[i] || 0) > cbKeep(i)) { n += G.inv[i] - cbKeep(i); } } }
  return n;
}
/* robot r takes parts for up to 10 devices from its list (round robin); the batch ends rbMin(r) minutes after startMin */
function cbPick(r, startMin) {
  var o = G.rb[r], q = [], d, k, i, rc, got;
  while (q.length < CB_BATCH) {
    got = false;
    for (k = 0; k < NDEV && q.length < CB_BATCH; k++) {
      d = ORD[k];
      if (cbHas(r, d) && partsReady(d)) {
        rc = DR[d];
        for (i = 0; i < rc.length; i++) { G.inv[rc[i][0]] -= rc[i][1]; }
        q.push(d); got = true;
      }
    }
    if (!got) { break; }
  }
  if (q.length == 0) { return 0; }
  o.q = q.join(";"); o.end = startMin + rbMin(r);
  return q.length;
}
function finishBuild(r) {
  var o = G.rb[r], q = (o.q || "").split(";"), i, j, d, rc, lost, ok = 0, bad = 0, n = 0, endMin = o.end, ch = rbChance(r);
  for (i = 0; i < q.length; i++) {
    d = parseInt(q[i], 10);
    if (!(d >= 0 && d < NDEV)) { continue; }
    n++;
    if (rnd() * 100 < ch) { G.dev[d] = Math.min(99, G.dev[d] + 1); G.sx += 15 + 5 * DP[d]; ok++; }
    else {
      rc = DR[d]; lost = ri(0, rc.length - 1); bad++; G.sx += 6;
      for (j = 0; j < rc.length; j++) {
        if (j != lost) { G.inv[rc[j][0]] += rc[j][1]; } else if (rc[j][1] > 1) { G.inv[rc[j][0]] += rc[j][1] - 1; }
      }
    }
  }
  o.q = ""; o.end = 0; o.cond = Math.max(0, o.cond - 10);
  CREWMSG.push("Robot " + (r + 1) + " built " + ok + "/" + n + (bad ? " (" + bad + " botched)" : "") + (o.cond < 40 ? "  NEEDS SERVICE" : ""));
  if (n >= 1) { CREWTROPHY = true; }
  if (o.rep && o.cond > 0 && cbPick(r, endMin) == 0) { CREWMSG.push("Robot " + (r + 1) + " idle: out of parts"); }
}
function crewSellDay() {
  var left = CS_PERDAY, sold = 0, gain = 0, d, i, n, p;
  if (G.csMode == 1 || G.csMode == 3) {
    for (d = 0; d < NDEV && left > 0; d++) {
      n = Math.min(left, G.dev[d] - 1);
      if (n > 0) { p = Math.floor(DV[d] * 0.6); G.dev[d] -= n; gain += p * n; left -= n; sold += n; }
    }
  }
  if (G.csMode == 2 || G.csMode == 3) {
    for (i = 0; i < NIT && left > 0; i++) {
      n = Math.min(left, (G.inv[i] || 0) - cbKeep(i));
      if (n > 0) { p = Math.max(1, Math.floor(G.pr[i] * 0.5)); G.inv[i] -= n; gain += p * n; left -= n; sold += n; }
    }
  }
  if (gain > 0) { G.cash += gain; G.dayEarn = (G.dayEarn || 0) + gain; }
  return [sold, gain];
}
/* runs whenever game time moves: robots finish batches, the haul arrives, the crew sells 10 items per game day */
function crewTick() {
  var guard = 0, tot = 0, gain = 0, s2, dy, fin = false, r;
  ensureRobots();
  for (r = 0; r < (G.robot || 0); r++) {
    guard = 0;
    while (G.rb[r].end > 0 && G.min >= G.rb[r].end && guard < 12) { finishBuild(r); guard++; }
  }
  if (G.ccEnd > 0 && G.min >= G.ccEnd) {
    var pl = (G.ccL || "").split(";"), pk, kv, pid, pq, cnt = 0, kinds = 0;
    for (pk = 0; pk < pl.length; pk++) {
      kv = pl[pk].split(":"); pid = parseInt(kv[0], 10); pq = parseInt(kv[1], 10);
      if (pid >= 0 && pid < NIT && pq > 0) { G.inv[pid] = Math.min(9999, (G.inv[pid] || 0) + pq); cnt += pq; kinds++; }
    }
    CREWMSG.push("Crew hauled " + cnt + " items (" + kinds + " kinds)");
    G.ccEnd = 0; G.ccQty = 0; G.ccL = "";
  }
  if (G.csMode > 0) {
    dy = dayOf(); guard = 0;
    while (G.csDay < dy && G.csMode > 0 && guard < 60) {
      G.csDay++; guard++;
      s2 = crewSellDay(); tot += s2[0]; gain += s2[1];
      if (stockCount(G.csMode) == 0) { G.csMode = 0; fin = true; }
    }
    if (tot > 0) { CREWMSG.push("Crew sold " + tot + " items +" + mny(gain)); }
    if (fin) { CREWMSG.push("Crew: nothing left to sell"); }
  }
}
/* once per sleep: helper loyalty fades, pay and heat cooling depend on it, a disloyal helper quits */
function crewDaily() {
  var l, inc;
  if (!G.crew) { return; }
  G.loy = Math.max(0, loyVal() - 4); l = G.loy;
  if (l <= 0) { G.crew = 0; G.csMode = 0; CREWMSG.push("Your helper quit: no loyalty. Tip them!"); return; }
  inc = (l >= 75) ? 70 : ((l >= 25) ? 35 : 0);
  if (inc > 0) { G.cash += inc; G.dayEarn = (G.dayEarn || 0) + inc; }
  if (G.heat > 5) { addHeat(l >= 75 ? -14 : -8); }
  if (l < 25) { CREWMSG.push("Helper is restless: no pay. Tip them!"); }
}
function crewNotify() {
  if (CREWMSG.length > 0) { pop("CREW REPORT", CREWMSG.shift(), CREWMSG.length > 0 ? "More reports waiting" : "", GREEN); }
  if (CREWTROPHY) { CREWTROPHY = false; unlockTrophy(7); }
}
/* ---------- crew ---------- */
var CREW_FEE = 45;

/* ---------- time ---------- */
var CLK12 = true;
function hourOf() { return Math.floor((G.min % 1440) / 60); }
function dayOf() { return Math.floor(G.min / 1440) + 1; }
/* pacing: two successful big hacks per game day */
function hacksToday() { var i, d = dayOf(), n = 0; for (i = 0; i < NALL; i++) { if (G.tgT[i] >= 0 && Math.floor(G.tgT[i] / 1440) + 1 == d) { n++; } } return n; }
function two(n) { n = Math.floor(n); return (n < 10 ? "0" : "") + n; }
function clockStr() {
  var m = G.min % 1440, h = Math.floor(m / 60), mi = m % 60, h2;
  if (CLK12) { h2 = h % 12; if (h2 == 0) { h2 = 12; } return h2 + ":" + two(mi) + (h >= 12 ? "p" : "a"); }
  return two(h) + ":" + two(mi);
}
function hourStr(h) {
  var h2;
  if (CLK12) { h2 = h % 12; if (h2 == 0) { h2 = 12; } return h2 + (h >= 12 ? "pm" : "am"); }
  return two(h) + ":00";
}
function phaseNow() {
  var h = hourOf();
  if (h >= 6 && h < 10) { return 0; }
  if (h >= 10 && h < 17) { return 1; }
  if (h >= 17 && h < 20) { return 0; }
  return 2;
}

/* ---------- scenery per district ---------- */
function drawBg(loc) {
  var i;
  sky();
  if (loc == 0) {
    skyline(40, 50, 80, 5); ground(60, 62, 70, 120, 120, 128);
    for (i = 0; i < 6; i++) { R(i * 56 + 10, 147, 28, 3, K(230, 230, 230)); }
    lamp(70); lamp(190);
  } else if (loc == 1) {
    skyline(45, 40, 85, 9); ground(55, 60, 75, 100, 110, 130);
    R(0, GR + 8, W, 1, K(60, 200, 255)); R(0, GR + 16, W, 1, K(255, 80, 200));
    lamp(70); lamp(250);
  } else if (loc == 2) {
    skyline(60, 55, 50, 2);
    R(14, 46, 10, 90, K(85, 72, 66)); R(12, 44, 14, 4, K(40, 35, 32)); Cc(20, 36, 7, K(150, 150, 150)); Cc(28, 28, 6, K(170, 170, 170));
    R(300, 56, 9, 80, K(85, 72, 66)); R(298, 54, 13, 4, K(40, 35, 32)); Cc(304, 46, 6, K(150, 150, 150));
    ground(80, 72, 60, 110, 100, 85);
    R(0, 147, W, 1, K(50, 45, 40)); lamp(70);
  } else if (loc == 3) {
    skyline(70, 90, 110, 4); E(160, GR, 150, 30, K(100, 180, 110));
    tree(14, 36, 50, 150, 60); tree(88, 42, 60, 160, 70); tree(156, 38, 50, 150, 60); tree(252, 40, 60, 160, 70);
    ground(70, 150, 80, 200, 200, 190);
    R(0, 144, W, 6, K(190, 185, 170)); lamp(85);
  } else if (loc == 4) {
    R(0, 98, W, 40, K(30, 90, 150)); R(0, 98, W, 3, K(120, 170, 210));
    for (i = 0; i < 9; i++) { R(i * 38 + (i & 1) * 12, 110 + (i % 3) * 8, 18, 1, K(150, 200, 235)); }
    R(8, 52, 4, 84, K(190, 140, 40)); R(8, 52, 40, 4, K(190, 140, 40));
    R(250, 60, 4, 76, K(190, 140, 40)); R(210, 60, 46, 4, K(190, 140, 40));
    ground(125, 90, 55, 90, 60, 35);
    for (i = 0; i < 4; i++) { R(0, 140 + i * 6, W, 1, K(80, 55, 30)); }
    lamp(90); lamp(255);
  } else {
    E(80, GR, 110, 44, K(110, 190, 120)); E(250, GR, 120, 38, K(90, 175, 100));
    tree(14, 34, 50, 150, 60); tree(86, 38, 60, 160, 70); tree(158, 36, 50, 150, 60); tree(252, 40, 60, 160, 70);
    ground(80, 170, 90, 200, 200, 190);
    R(0, 142, W, 8, K(150, 150, 150));
    for (i = 0; i < 40; i++) { R(i * 8, GR - 12, 4, 12, K(250, 250, 250)); }
    R(0, GR - 8, W, 2, K(250, 250, 250));
  }
}
function winC(i, j, x) { return (PH == 2 && hh(i + x, j * 3 + 1) < 0.6) ? rgb(255, 215, 110) : ((PH == 2) ? rgb(30, 40, 70) : K(150, 195, 230)); }
function sBld(x, w, h, r, g, b) {
  var top = GR - h, i, j, cols = Math.floor((w - 6) / 10), rows = Math.floor((h - 24) / 14);
  R(x - w / 2, top, w, h, K(r, g, b));
  R(x - w / 2 - 1, top - 3, w + 2, 4, K(r * 0.6, g * 0.6, b * 0.6));
  for (j = 0; j < rows; j++) {
    for (i = 0; i < cols; i++) { R(x - w / 2 + 4 + i * 10, top + 6 + j * 14, 6, 8, winC(i, j, x)); }
  }
  R(x - 5, GR - 18, 10, 18, K(90, 60, 35)); R(x + 2, GR - 9, 2, 2, rgb(240, 200, 60));
}
function awning(x, w, y, c1, c2) {
  var i, n = Math.floor(w / 8);
  for (i = 0; i < n; i++) { R(x - w / 2 + i * 8, y, 8, 7, (i & 1) ? c2 : c1); }
}
function drawSpot(s) {
  var x = s[0], t = s[1], a = s[2], i, gold = rgb(250, 215, 80), gr = K(110, 115, 125);
  if (t == 0) {
    sBld(x, 44, 46, 150, 110, 90); R(x - 5, GR - 18, 10, 18, rgb(250, 210, 60)); R(x + 10, GR - 62, 2, 16, gr); R(x + 6, GR - 60, 10, 1, gr);
  } else if (t == 1) {
    R(x - 25, GR - 46, 50, 46, K(225, 215, 190)); R(x - 28, GR - 52, 56, 6, K(190, 180, 160)); R(x - 25, GR - 52, 50, 2, gold);
    for (i = 0; i < 4; i++) { R(x - 21 + i * 12, GR - 42, 5, 38, K(250, 245, 230)); }
    R(x - 5, GR - 22, 10, 22, K(70, 55, 40));
  } else if (t == 2) {
    if (a == 0) { sBld(x, 50, 40, 170, 70, 60); R(x + 16, GR - 62, 2, 24, gr); R(x + 18, GR - 62, 8, 5, RED); }
    else if (a == 1) { sBld(x, 44, 50, 205, 185, 140); R(x - 5, GR - 76, 10, 28, K(205, 185, 140)); Cc(x, GR - 66, 4, K(250, 250, 245)); R(x - 1, GR - 70, 1, 4, BLACK); }
    else if (a == 2) { sBld(x, 54, 44, 190, 120, 170); R(x - 24, GR - 50, 48, 8, PINK); }
    else if (a == 3) {
      R(x - 18, GR - 76, 36, 76, K(60, 80, 110));
      for (i = 0; i < 5; i++) { R(x - 14, GR - 70 + i * 13, 28, 8, winC(i, 2, x)); }
      R(x - 1, GR - 88, 2, 12, gr); R(x - 5, GR - 18, 10, 18, K(40, 40, 50));
    }
    else if (a == 4) {
      R(x - 14, GR - 30, 3, 30, gr); R(x + 11, GR - 30, 3, 30, gr);
      R(x - 20, GR - 58, 40, 28, K(120, 170, 210)); E(x, GR - 58, 20, 5, K(160, 205, 235)); R(x - 20, GR - 44, 40, 2, K(80, 120, 160));
      R(x - 5, GR - 16, 10, 16, K(70, 70, 80));
    }
    else if (a == 5) {
      sBld(x, 40, 34, 120, 70, 60); R(x - 4, GR - 76, 4, 42, gold); R(x - 30, GR - 76, 60, 4, gold); R(x + 22, GR - 72, 2, 16, gold);
    }
    else if (a == 6) {
      R(x - 26, GR - 44, 52, 44, K(50, 55, 65));
      for (i = 0; i < 5; i++) { R(x - 22, GR - 40 + i * 8, 44, 2, K(20, 22, 28)); R(x - 20 + ((i * 11) % 36), GR - 41 + i * 8, 3, 2, (i & 1) ? rgb(80, 255, 120) : rgb(255, 70, 60)); }
      R(x - 5, GR - 18, 10, 18, K(20, 22, 28));
    }
    else if (a >= 8) {
      i = TSTY[a - 8] || 0;
      if (i == 0) { sBld(x, 46, 38, 140 + (a * 17) % 90, 100 + (a * 29) % 90, 90 + (a * 41) % 100); awning(x, 48, GR - 30, PINK, K(250, 250, 250)); R(x - 14, GR - 50, 28, 8, PINK); R(x - 10, GR - 48, 20, 2, K(250, 250, 250)); }
      else if (i == 1) { R(x - 12, GR - 40, 24, 40, K(60, 70, 100)); R(x - 2, GR - 82, 4, 42, gr); R(x - 9, GR - 72, 18, 2, gr); R(x - 6, GR - 62, 12, 2, gr); Cc(x, GR - 84, 3, RED); R(x - 4, GR - 14, 8, 14, K(30, 30, 40)); for (i = 0; i < 3; i++) { R(x - 8 + i * 6, GR - 36, 4, 6, winC(i, 1, x)); } }
      else if (i == 2) { R(x - 24, GR - 26, 48, 26, K(150, 150, 170)); E(x, GR - 26, 24, 12, K(190, 190, 210)); R(x - 24, GR - 21, 48, 2, rgb(190, 60, 255)); R(x - 4, GR - 16, 8, 16, K(50, 50, 60)); Cc(x, GR - 40, 2, gold); }
      else { R(x - 26, GR - 34, 52, 34, K(110, 90, 80)); R(x + 14, GR - 62, 8, 28, K(85, 72, 66)); R(x + 12, GR - 64, 12, 3, K(40, 35, 32)); Cc(x + 18, GR - 70, 5, K(160, 160, 160)); R(x - 14, GR - 24, 22, 24, K(60, 60, 70)); }
    }
    else {
      R(x - 1, GR - 76, 3, 76, gr); R(x - 16, GR - 70, 32, 2, gr); R(x - 12, GR - 56, 24, 2, gr); R(x - 20, GR - 70, 3, 5, K(200, 200, 190)); R(x + 18, GR - 70, 3, 5, K(200, 200, 190));
      R(x - 34, GR - 70, 16, 1, gr); R(x + 18, GR - 70, 16, 1, gr); R(x + 8, GR - 16, 16, 16, K(90, 100, 90)); R(x + 10, GR - 12, 12, 2, K(240, 200, 60));
    }
  } else if (t == 3) {
    busStop(x);
  } else if (t == 4) {
    sBld(x, 46, 40, 70, 90, 140); awning(x, 48, GR - 32, K(60, 140, 255), K(250, 250, 250));
    R(x - 10, GR - 54, 20, 12, K(40, 160, 90)); for (i = 0; i < 4; i++) { R(x - 12, GR - 52 + i * 3, 2, 1, gold); R(x + 10, GR - 52 + i * 3, 2, 1, gold); }
  } else if (t == 5) {
    sBld(x, 46, 38, 150, 120, 80); awning(x, 48, GR - 30, K(150, 90, 40), K(250, 230, 200));
    Cc(x - 8, GR - 48, 3, gold); Cc(x, GR - 48, 3, gold); Cc(x + 8, GR - 48, 3, gold);
  } else if (t == 6) {
    R(x - 25, GR - 44, 50, 44, K(175, 155, 125)); R(x - 28, GR - 50, 56, 6, K(140, 120, 95)); R(x - 25, GR - 4, 50, 4, K(150, 150, 150));
    for (i = 0; i < 4; i++) { R(x - 21 + i * 12, GR - 40, 5, 34, K(230, 220, 200)); }
    R(x - 5, GR - 20, 10, 20, K(80, 55, 35)); R(x - 8, GR - 58, 16, 6, K(80, 140, 220));
  } else if (t == 7) {
    sBld(x, 44, 36, 130, 85, 60); awning(x, 48, GR - 30, K(120, 70, 40), K(250, 240, 220));
    R(x - 4, GR - 52, 9, 8, K(250, 250, 250)); R(x + 5, GR - 50, 3, 4, K(250, 250, 250));
  } else if (t == 8) {
    R(x - 26, GR - 38, 52, 38, K(150, 110, 70)); R(x - 28, GR - 42, 56, 5, K(110, 80, 50));
    R(x - 13, GR - 26, 26, 26, K(70, 70, 80)); for (i = 0; i < 4; i++) { R(x - 13, GR - 24 + i * 6, 26, 1, K(50, 50, 60)); }
    R(x - 20, GR - 52, 40, 8, rgb(250, 150, 30));
  } else if (t == 9) {
    E(x, GR - 6, 26, 12, K(95, 85, 75)); R(x - 12, GR - 24, 6, 18, K(120, 65, 55)); Cc(x + 9, GR - 8, 6, K(18, 18, 20)); R(x - 30, GR - 22, 60, 1, gr);
    R(x - 30, GR - 24, 2, 24, gr); R(x + 28, GR - 24, 2, 24, gr);
  } else if (t == 10) {
    R(x - 22, GR - 44, 44, 44, K(32, 26, 46)); R(x - 24, GR - 48, 48, 5, K(20, 16, 30)); R(x - 6, GR - 24, 12, 24, BLACK);
    R(x - 3, GR - 56, 6, 6, rgb(190, 60, 255)); R(x - 20, GR - 36, 40, 1, rgb(190, 60, 255));
  } else if (t == 12) {
    R(x - 10, GR - 42, 20, 5, rgb(40, 90, 200)); R(x - 5, GR - 41, 10, 3, K(250, 250, 250));
    R(x - 9, GR - 37, 18, 37, K(60, 70, 90)); R(x - 7, GR - 33, 14, 29, (PH == 2) ? rgb(255, 215, 110) : K(110, 150, 180));
    R(x - 3, GR - 26, 6, 9, K(30, 30, 34)); R(x - 2, GR - 15, 4, 1, K(180, 180, 190));
  } else {
    sBld(x, 44, 34, 235, 220, 170); R(x - 30, GR - 12, 16, 2, K(130, 90, 55)); R(x - 28, GR - 18, 5, 6, rgb(230, 80, 80)); R(x - 21, GR - 17, 5, 5, rgb(80, 150, 230));
    R(x + 14, GR - 12, 16, 2, K(130, 90, 55)); R(x + 17, GR - 18, 6, 6, rgb(240, 200, 60));
  }
}
function markCol(s) {
  var c = SCB[s[1]];
  if (s[1] == 2 && G.tg[s[2]]) { c = DONEG; }
  return MB ? WHITE : c;
}
function drawMarker(s) {
  var x = s[0], c = markCol(s), i;
  R(x - 2, 38, 5, 8, c);
  for (i = 0; i < 6; i++) { R(x - 6 + i, 46 + i, 13 - 2 * i, 1, c); }
}

/* ---------- recorded background painter ---------- */
function recBg() {
  var key = (G.loc * 3 + PH) * 2 + (SHOWSP ? 1 : 0), i, sp;
  if (key == RKEY) { return; }
  RKEY = key; RN = 0;
  for (i = 0; i < 8; i++) { BK[i] = []; }
  REC = true;
  drawBg(G.loc);
  if (SHOWSP) { sp = SP[G.loc]; for (i = 0; i < sp.length; i++) { drawSpot(sp[i]); } }
  REC = false;
}
function paintRec(x0, y0, x1, y1) {
  var s, s0, s1, sx0, sx1, lst, j, k, ax, bx, ay, by;
  x0 = Math.floor(x0); y0 = Math.floor(y0); x1 = Math.floor(x1); y1 = Math.floor(y1);
  if (x0 < 0) { x0 = 0; } if (y0 < 14) { y0 = 14; } if (x1 > W) { x1 = W; } if (y1 > 158) { y1 = 158; }
  if (x1 <= x0 || y1 <= y0) { return; }
  recBg();
  s0 = Math.floor(x0 / 40); s1 = Math.floor((x1 - 1) / 40);
  for (s = s0; s <= s1; s++) {
    sx0 = Math.max(x0, s * 40); sx1 = Math.min(x1, s * 40 + 40);
    lst = BK[s];
    for (j = 0; j < lst.length; j++) {
      k = lst[j];
      ax = Math.max(RX[k], sx0); bx = Math.min(RX[k] + RW[k], sx1);
      ay = Math.max(RY[k], y0); by = Math.min(RY[k] + RH[k], y1);
      if (bx > ax && by > ay) { display.drawFillRect(ax, ay, bx - ax, by - ay, RC[k]); }
    }
  }
}
function paintArea(x0, y0, x1, y1) {
  var sp, i;
  paintRec(x0, y0, x1, y1);
  if (SHOWSP) {
    sp = SP[G.loc];
    for (i = 0; i < sp.length; i++) {
      if (sp[i][0] + 8 > x0 && sp[i][0] - 8 < x1 && 58 > y0 && 36 < y1) {
        CL0 = Math.max(0, Math.floor(x0)); CL1 = Math.max(14, Math.floor(y0)); CL2 = Math.min(W, Math.floor(x1)); CL3 = Math.min(158, Math.floor(y1));
        drawMarker(sp[i]);
        CL0 = 0; CL1 = 14; CL2 = W; CL3 = 158;
      }
    }
  }
}

/* ---------- the hacker (rectangles, so it can be erased exactly) ---------- */
function sprRects(x, f, wk) {
  var fy = FY, l1 = (wk == 1) ? -2 : ((wk == 3) ? 2 : 0), bx = (f > 0) ? x - 10 : x + 5, L = [];
  var hood = rgb(34, 44, 40), jean = rgb(36, 50, 90), skin = rgb(235, 185, 140);
  L.push([bx, fy - 21, 5, 11, rgb(70, 70, 95)]);
  L.push([x - 4 + l1, fy - 10, 4, 8, jean]); L.push([x + 1 - l1, fy - 10, 4, 8, jean]);
  L.push([x - 5 + l1, fy - 2, 5, 2, WHITE]); L.push([x + 1 - l1, fy - 2, 5, 2, WHITE]);
  L.push([x - 6, fy - 23, 12, 14, hood]); L.push([x - 2, fy - 12, 4, 3, rgb(20, 28, 26)]);
  L.push([x - 3, fy - 32, 7, 2, skin]); L.push([x - 4, fy - 30, 9, 3, skin]); L.push([x - 5, fy - 27, 11, 4, skin]); L.push([x - 4, fy - 23, 9, 1, skin]);
  L.push([x - 6, fy - 34, 12, 5, hood]); L.push([x - 6, fy - 30, 2, 5, hood]); L.push([x + 4, fy - 30, 2, 5, hood]);
  L.push([x + f * 2 - 2, fy - 29, 5, 2, MATG]);
  return L;
}
function subRect(p, n, out) {
  var px = p[0], py = p[1], pr = px + p[2], pb = py + p[3], nx = n[0], ny = n[1], nr = nx + n[2], nb = ny + n[3], t, b;
  if (nx >= pr || nr <= px || ny >= pb || nb <= py) { out.push(p); return; }
  if (ny > py) { out.push([px, py, p[2], ny - py]); }
  if (nb < pb) { out.push([px, nb, p[2], pb - nb]); }
  t = Math.max(py, ny); b = Math.min(pb, nb);
  if (nx > px) { out.push([px, t, nx - px, b - t]); }
  if (nr < pr) { out.push([nr, t, pr - nr, b - t]); }
}
function appendList(dst, src) { var i; for (i = 0; i < src.length; i++) { dst.push(src[i]); } }
function drawRects(L) { var i; for (i = 0; i < L.length; i++) { R(L[i][0], L[i][1], L[i][2], L[i][3], L[i][4]); } }
/* repaint ONLY old pixels that no new rectangle covers: no flash, no ghost */
function eraseOld(oldRects, newAll) {
  var i, j, k, pcs, nxt, o;
  for (i = 0; i < oldRects.length; i++) {
    pcs = [oldRects[i]];
    for (j = 0; j < newAll.length && pcs.length > 0; j++) {
      nxt = [];
      for (k = 0; k < pcs.length; k++) { subRect(pcs[k], newAll[j], nxt); }
      pcs = nxt;
    }
    for (k = 0; k < pcs.length; k++) { o = pcs[k]; paintArea(o[0], o[1], o[0] + o[2], o[1] + o[3]); }
  }
}
function plDraw() {
  var nl = sprRects(Math.floor(PX), PF, PWK);
  if (SPRL) { eraseOld(SPRL, nl); }
  drawRects(nl);
  SPRL = nl;
}
function plDrawOnTop() {
  var nl = sprRects(Math.floor(PX), PF, PWK);
  drawRects(nl);
  SPRL = nl;
}
function fullPaint() {
  SPRL = null; STRL = null;
  paintArea(0, 14, W, 158);
  if (ST_ON) { stBlit(); }
  plDraw();
}
function moveP(nx) {
  var ox = PX;
  PX = nx; WACC += Math.abs(nx - ox);
  if (WACC >= 9) { WACC -= 9; PWK = (PWK + 1) & 3; }
  plDraw();
  if (ST_ON && STRL) { drawRects(STRL); plDrawOnTop(); }
}
function updPlayer() {
  plDraw();
  if (ST_ON && STRL) { drawRects(STRL); plDrawOnTop(); }
}
function walkTo(tx, sp) {
  var d, s;
  while (PX != tx) { d = (tx > PX) ? 1 : -1; PF = d; s = Math.min(sp, Math.abs(tx - PX)); moveP(PX + d * s); wait(10); }
  PWK = 0; updPlayer();
}
function blinkMarkers() {
  var sp = SP[G.loc], i;
  MB = 1 - MB;
  for (i = 0; i < sp.length; i++) { paintArea(sp[i][0] - 10, 36, sp[i][0] + 10, 58); }
  if (ST_ON && STRL) { drawRects(STRL); }
  plDrawOnTop();
}

/* ==========================================================
   STREET TRAFFIC
   Exact-pixel erase via eraseOld — only uncovered pixels are
   restored, so no rectangular box flash around the sprite.
   ========================================================== */
var ST_ON = false, STX2 = -80, STDIR = 1, STKIND = 0;
var STRL = null;
var ST_STEP = 3;
var ST_COOL = 0;

function trafficRects(x, kind, dir) {
  var L = [], y = FY, f = (dir > 0) ? 1 : -1;
  var body, roof, win, shirt, pants, skin, shoe;
  x = Math.floor(x);
  if (kind == 0) {
    body = rgb(210, 55, 45);
    roof = rgb(160, 40, 35);
    win = rgb(120, 190, 230);
    L.push([x + 3, y - 7, 9, 6, BLACK]);
    L.push([x + 26, y - 7, 9, 6, BLACK]);
    L.push([x, y - 17, 40, 12, body]);
    L.push([x, y - 8, 40, 3, rgb(90, 25, 20)]);
    L.push([x + 7, y - 26, 24, 10, roof]);
    L.push([x + 10, y - 24, 8, 7, win]);
    L.push([x + 21, y - 24, 8, 7, win]);
    L.push([x, y - 17, 40, 2, rgb(230, 230, 235)]);
    L.push([x + (f > 0 ? 38 : 0), y - 14, 2, 4, rgb(255, 240, 150)]);
    L.push([x + (f > 0 ? 0 : 38), y - 14, 2, 4, rgb(200, 30, 30)]);
  } else {
    skin = rgb(240, 195, 150);
    shirt = rgb(50, 140, 200);
    pants = rgb(35, 45, 70);
    shoe = rgb(20, 20, 24);
    L.push([x, y - 10, 4, 9, pants]);
    L.push([x + 6, y - 10, 4, 9, pants]);
    L.push([x - 1, y - 2, 5, 2, shoe]);
    L.push([x + 5, y - 2, 5, 2, shoe]);
    L.push([x + 1, y - 22, 8, 13, shirt]);
    L.push([x - 1, y - 20, 3, 8, shirt]);
    L.push([x + 8, y - 20, 3, 8, shirt]);
    L.push([x + 1, y - 30, 8, 8, skin]);
    L.push([x + 1, y - 33, 8, 4, rgb(40, 28, 18)]);
  }
  return L;
}
function stBlit() {
  if (!ST_ON) { return; }
  STRL = trafficRects(STX2, STKIND, STDIR);
  drawRects(STRL);
}
function stPad(L) {
  /* expand each rect 1px so tiny bleed is cleaned */
  var i, o, out = [];
  if (!L) { return out; }
  for (i = 0; i < L.length; i++) {
    o = L[i];
    out.push([o[0] - 1, o[1] - 1, o[2] + 2, o[3] + 2, o[4]]);
  }
  return out;
}
var ST_SAY = "", ST_SAY_T = 0, ST_PSAY = "", ST_PSAY_T = 0;
var ST_BUB = null, ST_PBUB = null; /* last bubble rects [x0,y0,x1,y1] for clean erase */
var ST_SAY_LIFE = 85; /* ~3 sec at street tick rate */

var PROFANE = false;
var PROFANE_LINES = [
  "Fuck you punk",
  "Don't touch me",
  "Imma fuck you up punk",
  "Don't rob me",
  "Piece of shit",
  "Go hack someone else",
  "Go hack somewhere else",
  "Hack the planet",
  "Fuck off",
  "Kiss my ass",
  "Eat shit",
  "Dumbass",
  "Asshole",
  "Screw you",
  "Get fucked",
  "You little shit",
  "Piss off",
  "Fuck around and find out",
  "Don't fuck with me",
  "I'll mess you up",
  "Back the fuck up",
  "Who the fuck are you?",
  "Get the hell out",
  "You're dead punk",
  "Shut the fuck up",
  "Move bitch",
  "Try me motherfucker"
];
function pickProfane() {
  return PROFANE_LINES[ri(0, PROFANE_LINES.length - 1)];
}
function pedPhrase() {
  var ph = phaseNow(), r = rnd();
  if (PROFANE) { return pickProfane(); }
  if (ph == 2) { return r < 0.5 ? "Good night!" : "Stay safe!"; }
  if (ph == 0) { return "Morning!"; }
  return r < 0.5 ? "Hi!" : "Beautiful day!";
}
function playerPhrase(pedMsg) {
  var ph = phaseNow(), r = rnd();
  if (PROFANE) { return pickProfane(); }
  if (pedMsg == "Good night!" || pedMsg == "Stay safe!") {
    return r < 0.5 ? "You too!" : "Night!";
  }
  if (ph == 0) { return "Morning!"; }
  return r < 0.5 ? "Hey!" : "Yeah!";
}
function swearPhrase() {
  if (PROFANE) { return pickProfane(); }
  return rnd() < 0.5 ? "Hey, knock it off!" : "Leave me alone!";
}
function streetFight() {
  var r, dmg, pay;
  menuMode();
  r = menu("FIGHT PEDESTRIAN", ["Attack & rob", "Just swing", "Back off"], 0,
    ["Fight them and take their cash", "Fight only, no loot", "Walk away - small heat"]);
  if (r == 2 || r < 0) {
    addHeat(5); addMin(3); useEn(3);
    flash("You backed off", ORNG);
    walkMode(); return;
  }
  useEn(12); addMin(8);
  if (rnd() < 0.55 + luckBonus()) {
    if (r == 0) {
      pay = ri(40, 140) + skillLevel(2) * 10;
      G.cash += pay; G.dayEarn = (G.dayEarn || 0) + pay;
      addHeat(14);
      flash("Robbed them +" + mny(pay), GREEN);
    } else {
      pay = ri(10, 40);
      G.cash += pay; G.dayEarn = (G.dayEarn || 0) + pay;
      addHeat(10);
      flash("You dropped them +" + mny(pay), GREEN);
    }
  } else {
    dmg = ri(20, 45); G.cash = Math.max(0, G.cash - dmg);
    G.en = Math.max(0, G.en - 22); addHeat(20);
    flash("They wrecked you -$" + dmg, RED);
  }
  /* clear that pedestrian after a fight */
  if (STRL) { eraseOld(stPad(STRL), []); }
  ST_ON = false; STRL = null; STX2 = -80; ST_COOL = 25;
  clearAllBubbles();
  walkMode();
}
/* Aggressive mode: when a ped is talking, SEL opens fight menu */
function fightPedestrian() {
  if (!PROFANE) { flash("Turn on Aggressive mode first", GRAY); return; }
  if (!ST_ON || STKIND == 0) { flash("No pedestrian here", GRAY); return; }
  if (Math.abs(Math.floor(STX2) - PX) > 52) { flash("Too far away", GRAY); return; }
  eraseBubble(ST_PBUB);
  ST_PSAY = swearPhrase();
  ST_PSAY_T = ST_SAY_LIFE;
  ST_PBUB = bubbleBox(Math.floor(PX), ST_PSAY, FY - 82);
  drawBubbleAt(ST_PBUB, ST_PSAY, ORNG);
  eraseBubble(ST_BUB);
  ST_SAY = pickProfane();
  ST_SAY_T = 30;
  ST_BUB = bubbleBox(Math.floor(STX2) + 4, ST_SAY, FY - 66);
  drawBubbleAt(ST_BUB, ST_SAY, RED);
  plDrawOnTop();
  wait(350);
  clearAllBubbles();
  streetFight();
}
function swearAtPed() {
  /* kept for compatibility — routes to fight flow in aggressive mode */
  if (PROFANE) { fightPedestrian(); return; }
  if (!ST_ON || STKIND == 0) { flash("Nobody nearby", GRAY); return; }
  if (Math.abs(Math.floor(STX2) - PX) > 48) { flash("Too far away", GRAY); return; }
  eraseBubble(ST_PBUB);
  ST_PSAY = swearPhrase();
  ST_PSAY_T = ST_SAY_LIFE;
  ST_PBUB = bubbleBox(Math.floor(PX), ST_PSAY, FY - 82);
  drawBubbleAt(ST_PBUB, ST_PSAY, ORNG);
  plDrawOnTop();
}
function bubbleBox(x, msg, by) {
  var w = String(msg).length * 6 + 8, bx;
  if (w > 140) { w = 140; }
  bx = Math.floor(x) - Math.floor(w / 2);
  if (bx < 2) { bx = 2; }
  if (bx + w > W - 2) { bx = W - 2 - w; }
  if (by < 16) { by = 16; }
  return [bx, by, bx + w, by + 12];
}
function eraseBubble(b) {
  if (!b) { return; }
  paintArea(b[0] - 1, b[1] - 1, b[2] + 1, b[3] + 1);
}
function drawBubbleAt(b, msg, col) {
  if (!b || !msg) { return; }
  fr(b[0], b[1], b[2] - b[0], b[3] - b[1], rgb(20, 24, 36));
  rc(b[0], b[1], b[2] - b[0], b[3] - b[1], col || WHITE);
  txt(msg, b[0] + 4, b[1] + 2, 1, WHITE);
}
function clearAllBubbles() {
  if (ST_BUB) { eraseBubble(ST_BUB); ST_BUB = null; }
  if (ST_PBUB) { eraseBubble(ST_PBUB); ST_PBUB = null; }
  ST_SAY = ""; ST_SAY_T = 0;
  ST_PSAY = ""; ST_PSAY_T = 0;
}
function streetLifeTick() {
  var nl, empty, px, near;
  try {
    if (ST_COOL > 0) { ST_COOL--; }

    /* expire bubbles at 3s — erase completely, no trail */
    if (ST_SAY_T > 0) {
      ST_SAY_T--;
      if (ST_SAY_T <= 0) {
        eraseBubble(ST_BUB); ST_BUB = null; ST_SAY = "";
      }
    }
    if (ST_PSAY_T > 0) {
      ST_PSAY_T--;
      if (ST_PSAY_T <= 0) {
        eraseBubble(ST_PBUB); ST_PBUB = null; ST_PSAY = "";
      }
    }

    if (!ST_ON || STX2 < -55 || STX2 > W + 55) {
      if (ST_ON) {
        empty = [];
        if (STRL) { eraseOld(stPad(STRL), empty); }
        STRL = null;
        ST_ON = false;
        STX2 = -80;
        clearAllBubbles();
        plDrawOnTop();
        ST_COOL = 18;
      }
      if (ST_COOL > 0) { return; }
      if (rnd() > 0.5) { return; }
      STDIR = rnd() < 0.5 ? 1 : -1;
      STX2 = STDIR > 0 ? -34 : W + 34;
      STKIND = (rnd() < 0.42) ? 0 : 1;
      ST_ON = true;
      STRL = null;
      clearAllBubbles();
    } else {
      STX2 += STDIR * ST_STEP;
    }
    if (!ST_ON) { return; }
    nl = trafficRects(STX2, STKIND, STDIR);
    if (STRL) { eraseOld(stPad(STRL), stPad(nl)); }
    drawRects(nl);
    STRL = nl;

    /* pedestrian + player chat */
    if (STKIND != 0) {
      px = Math.floor(STX2);
      near = Math.abs(px - PX) < 40;
      if (near) {
        if (!ST_SAY && ST_SAY_T <= 0 && rnd() < 0.22) {
          ST_SAY = pedPhrase();
          ST_SAY_T = ST_SAY_LIFE;
          ST_PSAY = playerPhrase(ST_SAY);
          ST_PSAY_T = ST_SAY_LIFE;
        }
        /* erase previous bubble pixels before redraw (stops trails while moving) */
        if (ST_BUB) { eraseBubble(ST_BUB); ST_BUB = null; }
        if (ST_PBUB) { eraseBubble(ST_PBUB); ST_PBUB = null; }
        if (ST_SAY_T > 0 && ST_SAY) {
          ST_BUB = bubbleBox(px + 4, ST_SAY, FY - 66);
          drawBubbleAt(ST_BUB, ST_SAY, WHITE);
        }
        if (ST_PSAY_T > 0 && ST_PSAY) {
          /* player bubble higher so they don't overlap */
          ST_PBUB = bubbleBox(Math.floor(PX), ST_PSAY, FY - 82);
          drawBubbleAt(ST_PBUB, ST_PSAY, CYAN);
        }
      } else {
        clearAllBubbles();
      }
    } else {
      clearAllBubbles();
    }
    plDrawOnTop();
  } catch (eSt) {
    ST_ON = false; STRL = null; STX2 = -80;
    clearAllBubbles();
  }
}

/* ----- colors + hack screen layout ----- */
var SKINC = rgb(235, 185, 140), HOODC = rgb(34, 44, 40);
var LBX = 40, LBW = 240, LBY = 84, LTY = 58, LAY = 74, LAS = 5, LAX = 100, LAYR = 70, LAW = 120, LAH = 44, LCX = 0, LCY = 54, LCW = W, LCH = 70, LPY = 96, LPX = 70, LPS = 24, LPW = 18, LPH = 8, LFW = 180, LBG = rgb(0, 8, 2);

/* ==========================================================
   ACTORS  (exact erase of whatever moved - no ghosts)
   ========================================================== */
var ACT = [], ACTZ = [], ACTBG = null;
function actInit(n, bgFn) {
  var i;
  ACT = []; ACTZ = []; ACTBG = bgFn;
  for (i = 0; i < n; i++) { ACT.push({ o: null, n: null, d: false }); ACTZ.push(i); }
}
function actSet(i, list) { ACT[i].n = list; ACT[i].d = true; }
function lBox(l) {
  var i, x0 = 9999, y0 = 9999, x1 = -9999, y1 = -9999, r;
  for (i = 0; i < l.length; i++) {
    r = l[i];
    if (r[0] < x0) { x0 = r[0]; } if (r[1] < y0) { y0 = r[1]; }
    if (r[0] + r[2] > x1) { x1 = r[0] + r[2]; } if (r[1] + r[3] > y1) { y1 = r[1] + r[3]; }
  }
  return [x0, y0, x1, y1];
}
function actFrame() {
  var i, j, k, m, z, a, pcs, nxt, o, boxes = [], hit, b;
  for (i = 0; i < ACT.length; i++) {
    a = ACT[i];
    if (!a.d) { continue; }
    if (a.o) {
      for (j = 0; j < a.o.length; j++) {
        pcs = [a.o[j]];
        if (a.n) {
          for (k = 0; k < a.n.length && pcs.length > 0; k++) {
            nxt = [];
            for (m = 0; m < pcs.length; m++) { subRect(pcs[m], a.n[k], nxt); }
            pcs = nxt;
          }
        }
        for (m = 0; m < pcs.length; m++) { o = pcs[m]; ACTBG(o[0], o[1], o[0] + o[2], o[1] + o[3]); }
      }
      boxes.push(lBox(a.o));
    }
    if (a.n) { boxes.push(lBox(a.n)); }
  }
  for (z = 0; z < ACTZ.length; z++) {
    a = ACT[ACTZ[z]];
    if (!a.n) { continue; }
    hit = a.d;
    if (!hit) {
      b = lBox(a.n);
      for (k = 0; k < boxes.length; k++) {
        if (b[0] < boxes[k][2] && b[2] > boxes[k][0] && b[1] < boxes[k][3] && b[3] > boxes[k][1]) { hit = true; break; }
      }
    }
    if (hit) { for (j = 0; j < a.n.length; j++) { R(a.n[j][0], a.n[j][1], a.n[j][2], a.n[j][3], a.n[j][4]); } }
  }
  for (i = 0; i < ACT.length; i++) { ACT[i].o = ACT[i].n; ACT[i].d = false; }
}

/* ---------- police car, cops, hacker poses ---------- */
function carRects(x, dir, ph, op) {
  var L = [], f = (dir > 0) ? 1 : -1, c1 = ph ? RED : rgb(60, 110, 255), c2 = ph ? rgb(60, 110, 255) : RED;
  L.push([x + 5, FY - 6, 9, 6, BLACK]); L.push([x + 30, FY - 6, 9, 6, BLACK]);
  L.push([x, FY - 17, 44, 12, rgb(235, 238, 245)]);
  L.push([x, FY - 10, 44, 5, rgb(24, 44, 120)]);
  L.push([x + 10, FY - 26, 24, 9, rgb(225, 230, 240)]);
  L.push([x + 13, FY - 25, 8, 6, rgb(60, 90, 130)]); L.push([x + 24, FY - 25, 8, 6, rgb(60, 90, 130)]);
  L.push([x + 14, FY - 29, 7, 3, c1]); L.push([x + 23, FY - 29, 7, 3, c2]);
  L.push([x + (f > 0 ? 42 : 0), FY - 14, 2, 3, rgb(255, 240, 160)]);
  L.push([x + (f > 0 ? 0 : 42), FY - 14, 2, 3, rgb(220, 40, 40)]);
  if (op) { L.push([x + (f > 0 ? 24 : 14), FY - 22, 6, 12, rgb(210, 215, 225)]); }
  return L;
}
function copRects(x, f, wk, pose) {
  var fy = FY, l1 = (wk == 1) ? -2 : ((wk == 3) ? 2 : 0), L = [], navy = rgb(24, 44, 120), dk = rgb(20, 30, 70);
  L.push([x - 4 + l1, fy - 10, 4, 8, dk]); L.push([x + 1 - l1, fy - 10, 4, 8, dk]);
  L.push([x - 5 + l1, fy - 2, 5, 2, BLACK]); L.push([x + 1 - l1, fy - 2, 5, 2, BLACK]);
  L.push([x - 6, fy - 23, 12, 14, navy]); L.push([x - 6, fy - 13, 12, 2, rgb(20, 20, 24)]);
  L.push([x + f * 2 - 1, fy - 20, 3, 3, rgb(250, 215, 80)]);
  L.push([x - 4, fy - 31, 9, 8, SKINC]);
  L.push([x - 6, fy - 36, 12, 5, rgb(20, 30, 90)]); L.push([x + (f > 0 ? 1 : -8), fy - 32, 7, 2, rgb(15, 20, 60)]);
  if (pose == 1) {
    L.push([f > 0 ? x + 6 : x - 15, fy - 20, 9, 3, navy]);
    L.push([f > 0 ? x + 15 : x - 22, fy - 22, 7, 4, rgb(30, 30, 34)]);
  } else if (pose == 2) {
    L.push([f > 0 ? x + 6 : x - 14, fy - 20, 8, 3, navy]);
    L.push([f > 0 ? x + 14 : x - 17, fy - 20, 3, 3, SKINC]);
  }
  return L;
}
function plRects(x, mode) {
  var L = sprRects(x, 1, 0), fy = FY;
  if (mode == 1) {
    L.push([x - 9, fy - 36, 3, 14, rgb(34, 44, 40)]); L.push([x + 6, fy - 36, 3, 14, rgb(34, 44, 40)]);
    L.push([x - 9, fy - 39, 3, 3, SKINC]); L.push([x + 6, fy - 39, 3, 3, SKINC]);
  } else if (mode == 2) {
    L.push([x - 3, fy - 14, 6, 2, rgb(190, 190, 200)]); L.push([x - 7, fy - 15, 2, 4, rgb(190, 190, 200)]); L.push([x + 5, fy - 15, 2, 4, rgb(190, 190, 200)]);
  }
  return L;
}

/* ==========================================================
   ARREST: two cruisers roll in, 2 cops cuff you, 2 more aim
   ========================================================== */
function arrestScene() {
  var lx = -52, rx = 324, ph = 0, k, ax = 88, bx = 232, cx = 88, dx = 230, wk = 0;
  menuMode();
  PF = (PX < 160) ? 1 : -1; walkTo(160, 6); PF = 1; PWK = 0; updPlayer();
  actInit(7, paintArea);
  ACTZ = [0, 1, 4, 5, 2, 3, 6];
  ACT[6].o = SPRL; ACT[6].n = SPRL; ACT[6].d = false;
  bar("POLICE! POLICE!", RED);
  while (lx < 62 || rx > 214) {
    ph = 1 - ph;
    if (lx < 62) { lx = Math.min(62, lx + 8); }
    if (rx > 214) { rx = Math.max(214, rx - 8); }
    actSet(0, carRects(lx, 1, ph, false)); actSet(1, carRects(rx, -1, ph, false));
    actFrame(); wait(20);
  }
  for (k = 0; k < 6; k++) { ph = 1 - ph; actSet(0, carRects(lx, 1, ph, k > 1)); actSet(1, carRects(rx, -1, ph, k > 1)); actFrame(); wait(70); }
  bar("STOP RIGHT THERE!", RED);
  while (ax < 142 || bx > 178) {
    ph = 1 - ph; wk = (wk + 1) & 3;
    if (ax < 142) { ax = Math.min(142, ax + 4); }
    if (bx > 178) { bx = Math.max(178, bx - 4); }
    actSet(0, carRects(lx, 1, ph, true)); actSet(1, carRects(rx, -1, ph, true));
    actSet(2, copRects(ax, 1, wk, 0)); actSet(3, copRects(bx, -1, wk, 0));
    actFrame(); wait(30);
  }
  bar("ARRESTED!", RED);
  for (k = 0; k < 6; k++) {
    ph = 1 - ph;
    actSet(0, carRects(lx, 1, ph, true)); actSet(1, carRects(rx, -1, ph, true));
    actSet(2, copRects(142, 1, 0, 2)); actSet(3, copRects(178, -1, 0, 2));
    actSet(6, plRects(160, k < 3 ? 1 : 2));
    actFrame(); wait(110);
  }
  bar("MORE UNITS ON SCENE!", ORNG);
  while (cx < 112 || dx > 208) {
    ph = 1 - ph; wk = (wk + 1) & 3;
    if (cx < 112) { cx = Math.min(112, cx + 4); }
    if (dx > 208) { dx = Math.max(208, dx - 4); }
    actSet(0, carRects(lx, 1, ph, true)); actSet(1, carRects(rx, -1, ph, true));
    actSet(4, copRects(cx, 1, wk, (cx >= 112) ? 1 : 0)); actSet(5, copRects(dx, -1, wk, (dx <= 208) ? 1 : 0));
    actFrame(); wait(30);
  }
  bar("FREEZE! HANDS WHERE WE CAN SEE THEM!", RED);
  for (k = 0; k < 10; k++) {
    ph = 1 - ph;
    actSet(0, carRects(lx, 1, ph, true)); actSet(1, carRects(rx, -1, ph, true));
    actSet(4, copRects(112, 1, 0, 1)); actSet(5, copRects(208, -1, 0, 1));
    actFrame(); wait(110);
  }
  sctxt("BUSTED!", 30, 3, RED, rgb(40, 0, 0));
  wait(900);
}

/* ==========================================================
   CAB: escape the heat (heat resets on the next screen)
   ========================================================== */
var CBL = [];
/* scene time of day from game time: 0 night, 1 day, 2 dawn, 3 dusk */
function sceneTone() {
  var h = hourOf();
  if (h >= 10 && h < 17) { return 1; }
  if (h >= 6 && h < 10) { return 2; }
  if (h >= 17 && h < 20) { return 3; }
  return 0;
}
function cabBuild() {
  var i, j, tn = sceneTone(), sk, bld, lit, dark;
  CBL = [];
  for (i = 0; i < 5; i++) {
    if (tn == 1) { sk = rgb(96 + i * 10, 160 + i * 8, 232 - i * 2); }
    else if (tn == 2) { sk = rgb(120 + i * 24, 110 + i * 16, 170 - i * 8); }
    else if (tn == 3) { sk = rgb(70 + i * 38, 50 + i * 20, 110 - i * 14); }
    else { sk = rgb(6 + i * 3, 8 + i * 4, 28 + i * 9); }
    CBL.push([0, 16 + i * 19, W, 20, sk]);
  }
  if (tn == 1) {
    CBL.push([262, 22, 14, 14, rgb(255, 235, 110)]); CBL.push([259, 25, 20, 8, rgb(255, 235, 110)]);
    CBL.push([40, 30, 34, 7, rgb(245, 248, 252)]); CBL.push([48, 26, 20, 5, rgb(245, 248, 252)]);
    CBL.push([170, 42, 40, 7, rgb(245, 248, 252)]); CBL.push([180, 38, 22, 5, rgb(245, 248, 252)]);
  } else if (tn == 2) {
    CBL.push([40, 70, 14, 14, rgb(255, 210, 120)]); CBL.push([37, 73, 20, 8, rgb(255, 210, 120)]);
  } else if (tn == 3) {
    CBL.push([262, 72, 14, 14, rgb(255, 150, 60)]); CBL.push([259, 75, 20, 8, rgb(255, 150, 60)]);
  } else {
    CBL.push([262, 24, 12, 12, rgb(225, 230, 245)]); CBL.push([266, 24, 8, 12, rgb(8, 10, 28)]);
  }
  for (i = 0; i < 16; i++) {
    if (tn == 1) { bld = rgb(122 + (i * 7) % 24, 128 + (i * 5) % 20, 146 + (i * 9) % 20); }
    else if (tn == 2) { bld = rgb(84 + (i * 7) % 20, 80 + (i * 5) % 16, 112 + (i * 9) % 16); }
    else if (tn == 3) { bld = rgb(58 + (i * 7) % 16, 44 + (i * 5) % 12, 78 + (i * 9) % 14); }
    else { bld = rgb(14 + (i * 7) % 12, 18 + (i * 5) % 10, 40 + (i * 9) % 16); }
    CBL.push([i * 21 - 4, 56 - (i * 13) % 32, 20, 80, bld]);
    for (j = 0; j < 4; j++) {
      lit = (tn == 1) ? rgb(170, 210, 235) : ((tn == 0) ? rgb(255, 215, 110) : rgb(255, 205, 120));
      dark = (tn == 1) ? rgb(96, 110, 134) : rgb(24, 30, 56);
      CBL.push([i * 21 + 2, 64 - (i * 13) % 32 + j * 14, 5, 6, (tn == 1 || hh(i, j) < ((tn == 0) ? 0.5 : 0.35)) ? ((tn == 1) ? ((hh(i, j) < 0.5) ? lit : dark) : lit) : dark]);
    }
  }
  CBL.push([0, 120, W, 38, (tn == 1) ? rgb(84, 86, 94) : rgb(36, 38, 46)]);
  CBL.push([0, 120, W, 3, (tn == 1) ? rgb(170, 172, 180) : rgb(90, 92, 100)]);
  CBL.push([0, 138, W, 1, rgb(210, 190, 90)]);
}
function cabBg(x0, y0, x1, y1) {
  var i, r, ax, ay, bx, by;
  x0 = Math.floor(x0); y0 = Math.floor(y0); x1 = Math.floor(x1); y1 = Math.floor(y1);
  if (x0 < 0) { x0 = 0; } if (y0 < 16) { y0 = 16; } if (x1 > W) { x1 = W; } if (y1 > 158) { y1 = 158; }
  if (x1 <= x0 || y1 <= y0) { return; }
  for (i = 0; i < CBL.length; i++) {
    r = CBL[i];
    ax = Math.max(r[0], x0); bx = Math.min(r[0] + r[2], x1); ay = Math.max(r[1], y0); by = Math.min(r[1] + r[3], y1);
    if (bx > ax && by > ay) { display.drawFillRect(ax, ay, bx - ax, by - ay, r[4]); }
  }
}
function cabRects(x) {
  var L = [];
  L.push([x + 5, FY - 22, 9, 6, BLACK]); L.push([x + 32, FY - 22, 9, 6, BLACK]);
  L.push([x, FY - 33, 46, 12, rgb(250, 205, 40)]);
  L.push([x + 12, FY - 42, 24, 10, rgb(250, 205, 40)]);
  L.push([x + 15, FY - 41, 8, 7, rgb(60, 90, 130)]); L.push([x + 25, FY - 41, 8, 7, rgb(60, 90, 130)]);
  L.push([x + 16, FY - 40, 5, 3, rgb(34, 44, 40)]);
  L.push([x + 18, FY - 46, 10, 4, WHITE]);
  L.push([x + 44, FY - 29, 2, 3, rgb(255, 240, 160)]);
  L.push([x, FY - 26, 46, 2, rgb(30, 30, 34)]);
  return L;
}
function cabAnim(to) {
  var cx, copx, ph = 0;
  menuMode(); cabBuild();
  cls(BLACK); cabBg(0, 16, W, 158);
  fr(0, 0, W, 16, rgb(70, 50, 0)); txt("CAB TO " + LOCN[to].toUpperCase(), 6, 4, 1, YEL);
  ctxt("Losing the cops...", 26, 1, (sceneTone() == 1) ? BLACK : WHITE);
  actInit(2, cabBg);
  for (cx = -50; cx < 340; cx += 7) {
    ph = 1 - ph;
    copx = cx - 70 - Math.max(0, cx - 110) * 1.6;
    actSet(0, cabRects(cx));
    actSet(1, (copx > -50 && copx < W) ? carRects(copx, 1, ph, false) : null);
    actFrame(); wait(24);
  }
}
function callCab() {
  var fare = fareNow(), items = [], hints = [], map = [], i, r;
  if (G.cash < fare) { pop("No fare!", "A cab costs " + mny(fare), "Earn some cash first", ORNG); return false; }
  for (i = 0; i < LOCN.length; i++) {
    if (i == G.loc) { continue; }
    map.push(i);
    items.push(LOCN[i]);
    hints.push(mny(fare) + " · " + locShops(i));
  }
  r = menu("CAB " + mnyS(G.cash), items, 0, hints);
  if (r < 0) { return false; }
  G.cash -= fare;
  cabAnim(map[r]);
  addMin(15); G.heat = 0;
  enterTown(map[r]);
  return true;
}
/* hail a street car when one is on screen — cheaper, no heat gate */
function hailStreetCar() {
  var fare;
  if (!ST_ON || STKIND != 0) { flash("No car nearby", GRAY); return false; }
  fare = Math.max(15, Math.floor(fareNow() * 0.6));
  if (G.cash < fare) { flash("Need " + mny(fare), RED); return false; }
  return callCab();
}

/* ==========================================================
   PHONE BOOTH: no task, no game - the keypad does the work
   ========================================================== */
var KPX = 104, KPY = 58, KW = 34, KH = 21, KSX = 38, KSY = 25;
var KL = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];
function drawKey(i, lit) {
  var x = KPX + (i % 3) * KSX, y = KPY + Math.floor(i / 3) * KSY;
  fr(x, y, KW, KH, lit ? rgb(255, 200, 80) : rgb(112, 118, 130));
  rc(x, y, KW, KH, lit ? rgb(255, 240, 160) : rgb(50, 54, 62));
  txt(KL[i], x + 11, y + 3, 2, lit ? BLACK : WHITE);
}
function lcdStatus(msg) {
  fr(98, 40, 124, 10, rgb(6, 24, 8)); txt(msg, 102, 41, 1, MATG);
}
function boothBg() {
  var i;
  cls(rgb(22, 16, 12));
  fr(0, 0, W, 16, rgb(70, 36, 0)); txt("PAYPHONE", 6, 4, 1, YEL);
  fr(80, 18, 160, 144, rgb(70, 74, 86)); rc(80, 18, 160, 144, rgb(130, 136, 150));
  fr(96, 22, 128, 30, rgb(6, 24, 8)); rc(96, 22, 128, 30, rgb(0, 140, 60));
  fr(28, 44, 26, 100, rgb(30, 30, 34)); fr(24, 36, 34, 14, rgb(30, 30, 34)); fr(24, 140, 34, 14, rgb(30, 30, 34));
  fr(262, 56, 30, 54, rgb(90, 94, 106)); fr(272, 70, 10, 3, BLACK); fr(272, 90, 10, 14, rgb(60, 60, 68));
  for (i = 0; i < 12; i++) { drawKey(i, false); }
}
function phreak() {
  var i, k, last = -1, num = "", d;
  menuMode(); boothBg();
  lcdStatus("DIALING...");
  for (i = 0; i < 9; i++) {
    k = ri(0, 11); if (k == last) { k = (k + 1) % 12; } last = k;
    drawKey(k, true); wait(130); drawKey(k, false);
    if (k != 9 && k != 11) { num += KL[k]; }
    fr(100, 24, 120, 16, rgb(6, 24, 8)); txt(num + "_", 102, 25, 2, MATG);
    wait(40);
  }
  lcdStatus("SEIZING LINE");
  for (i = 0; i < 14; i++) { k = ri(0, 11); drawKey(k, true); wait(70); drawKey(k, false); if (i == 6) { lcdStatus("ROUTING..."); } }
  lcdStatus("CREDIT ACCEPTED");
  for (i = 0; i < 6; i++) { drawKey(i * 2 % 12, true); wait(60); drawKey(i * 2 % 12, false); }
  fr(70, 70, 180, 50, BLACK); rc(70, 70, 180, 50, GREEN); rc(71, 71, 178, 48, GREEN);
  if (G.phday != dayOf()) { G.phday = dayOf(); G.phreaks = 0; }
  G.phreaks++;
  ctxt("+$1,500", 84, 3, GREEN); ctxt("Calls left today: " + phLeft(), 108, 1, MATG);
  G.cash += 1500; addMin(20); useEn(3); addHeat(6);
  wait(1000);
}
var MAXPH = 3;
function phLeft() { if (G.phday != dayOf()) { return MAXPH; } return Math.max(0, MAXPH - G.phreaks); }
function phoneBooth() {
  var r;
  menuMode();
  r = menu("PHONE BOOTH", ["Phreak the line", "Call a cab", "Leave"], 0,
    ["+$1,500, little heat (" + phLeft() + " left today)", "Travel any district: " + mny(fareNow()), "Hang up"]);
  if (r < 0 || r == 2) { return; }
  if (r == 1) { callCab(); return; }
  if (phLeft() <= 0) { pop("Line is dead", "Phone company is watching", "3 calls a day - try tomorrow", ORNG); return; }
  phreak();
}

/* ==========================================================
   3D PRINTER: print your own cases
   ========================================================== */
function print3d() {
  var nPr, filNeed, cases, mins;
  menuMode();
  nPr = G.printer || 0;
  if (nPr < 1) { pop("No 3D printer", "Buy one at the hardware store", "Up to 3 printers ($150 each)", ORNG); return; }
  /* each printer runs one batch of 3 cases per filament spool in parallel */
  filNeed = nPr;
  if (G.inv[38] < filNeed) {
    pop("Need more filament", "Have " + G.inv[38] + " spool(s), need " + filNeed, "1 spool per printer per run", ORNG);
    return;
  }
  if (G.en < 3) { flash("Too tired!", RED); return; }
  cases = 3 * nPr;
  mins = Math.max(20, 50 - nPr * 8);
  G.inv[38] -= filNeed;
  G.inv[21] += cases;
  addMin(mins); useEn(3);
  pop("Printed " + cases + " cases!", nPr + " printer" + (nPr > 1 ? "s" : "") + " ran in parallel", "Enclosures in your bag", GREEN);
}

/* ==========================================================
   QUANTITIES  (buy and sell amounts)
   ========================================================== */
var QTYS = [1, 5, 10, 20, 25, 30, 40, 50];
function nextQty(q) {
  var i;
  for (i = 0; i < QTYS.length; i++) { if (QTYS[i] == q) { return QTYS[(i + 1) % QTYS.length]; } }
  return 1;
}
function sellPart(id, qty) {
  var n = Math.min(qty, G.inv[id]), p = Math.max(1, Math.floor(G.pr[id] * 0.5));
  if (n <= 0) { return 0; }
  G.inv[id] -= n; G.cash += p * n; addMin(1 + Math.floor(n / 3));
  return p * n;
}
function sellDev(id, qty) {
  var n = Math.min(qty, G.dev[id]), p = Math.floor(DV[id] * 0.6);
  if (n <= 0) { return 0; }
  G.dev[id] -= n; G.cash += p * n; addMin(5 + n);
  return p * n;
}
function pawn() {
  var idx = 0, r, i, items, hints, ent, id, qty = 1, n, tot;
  while (true) {
    items = ["Sell qty: " + qty]; hints = ["SEL cycles 1/5/10/20/25/30/40/50"]; ent = [-1];
    for (i = 0; i < NIT; i++) { if (G.inv[i] > 0) { ent.push(i); items.push(IN[i] + " " + mnyS(Math.max(1, Math.floor(G.pr[i] * 0.5))) + " x" + G.inv[i]); hints.push("SEL: sell " + qty + ". Parts sell for half price"); } }
    for (i = 0; i < NDEV; i++) { if (G.dev[i] > 0) { ent.push(100 + i); items.push(DN[i] + " " + mnyS(Math.floor(DV[i] * 0.6)) + " x" + G.dev[i]); hints.push("SEL: sell " + qty + ". Devices fetch 60% of value"); } }
    if (ent.length == 1) { flash("Nothing to sell", GRAY); return; }
    if (idx >= ent.length) { idx = ent.length - 1; }
    r = menu("PAWN " + mnyS(G.cash), items, idx, hints);
    if (r < 0) { return; }
    idx = r;
    if (r == 0) { qty = nextQty(qty); continue; }
    id = ent[r];
    if (id >= 100) {
      id -= 100; n = Math.min(qty, G.dev[id]); tot = n * Math.floor(DV[id] * 0.6);
      if (confirm2("Sell " + n + " " + DN[id].substring(0, 10) + "?", "You get " + mny(tot), YEL)) { sellDev(id, qty); flash("Sold " + n + "!", GREEN); }
    } else {
      tot = sellPart(id, qty); flash("Sold +" + mny(tot), GREEN);
    }
  }
}

/* ==========================================================
   UPGRADES  (safehouse)
   ========================================================== */
var UPN = ["Antenna Mk2", "Battery Bank", "Heat Shield", "Solder Station", "Night Rig", "Cab Pass"];
var UPC = [300, 500, 800, 700, 1500, 1000];
var UPP = [[[9, 2], [36, 1]], [[8, 2], [35, 1]], [[21, 2], [20, 2]], [[14, 2], [13, 2]], [[25, 1], [7, 1]], [[32, 1]]];
var UPD = ["Breach zone +4", "30% chance a breach keeps its battery", "Breach heat gain -30%", "Device build success +8%", "Extra +6 breach zone at night", "Cab fare drops to $60"];
function hasUp(i) { return (G.up & (1 << i)) != 0; }
function heatAdj(n) {
  n = Math.floor(n * heatMul());
  if (hasUp(2)) { n = Math.floor(n * 0.7); }
  return Math.max(0, n);
}
function buildChance() { return Math.min(98, 60 + lv(G.sx) * 4 + (G.meter ? 10 : 0) + (hasUp(3) ? 8 : 0) + skillLevel(1) * 3 + ((G.inv[40] || 0) > 0 ? 8 : 0)); }
function fareNow() { return hasUp(5) ? 60 : 100; }
function upParts(i) {
  var s = "", k;
  for (k = 0; k < UPP[i].length; k++) { s += (k ? ", " : "") + IN[UPP[i][k][0]] + " x" + UPP[i][k][1]; }
  return s;
}
function buyUpgrade(i) {
  var k, need = UPP[i];
  if (hasUp(i)) { return "owned"; }
  if (G.cash < UPC[i]) { return "cash"; }
  for (k = 0; k < need.length; k++) { if (G.inv[need[k][0]] < need[k][1]) { return "parts"; } }
  G.cash -= UPC[i];
  for (k = 0; k < need.length; k++) { G.inv[need[k][0]] -= need[k][1]; }
  G.up |= (1 << i); addMin(90); useEn(5);
  return "ok";
}
function upgradesMenu() {
  var idx = 0, r, i, items, hints, res;
  while (true) {
    items = []; hints = [];
    for (i = 0; i < UPN.length; i++) {
      items.push(UPN[i] + (hasUp(i) ? " OWNED" : " " + mnyS(UPC[i])));
      hints.push(UPD[i]);
    }
    r = menu("UPGRADES " + mnyS(G.cash), items, idx, hints);
    if (r < 0) { return; }
    idx = r;
    if (hasUp(r)) { flash("Already installed", GRAY); continue; }
    if (!confirm2("Install " + UPN[r].substring(0, 14) + "?", mny(UPC[r]) + " + " + upParts(r), YEL)) { continue; }
    res = buyUpgrade(r);
    if (res == "ok") { pop("INSTALLED!", UPN[r], UPD[r], GREEN); }
    else if (res == "cash") { flash("Not enough cash", RED); }
    else { flash("Missing parts", RED); }
  }
}

/* ==========================================================
   CONTRACTS  (cafe board)
   ========================================================== */
var CPARTS = [0, 1, 2, 6, 9, 10, 12, 34, 31, 28, 29, 30];
function ctOffer(slot) {
  var day = dayOf(), o = {}, allowed = [], i, d;
  if (hh(day, slot * 5 + 1) < 0.55) {
    for (i = 0; i < NDEV; i++) { if (DP[i] <= 2 + nDone()) { allowed.push(i); } }
    d = allowed[Math.floor(hh(day, slot * 5 + 2) * allowed.length)];
    o.k = 1; o.id = d; o.n = 1; o.pay = Math.floor(DV[d] * (1.5 + hh(day, slot * 5 + 3) * 0.6));
    o.due = day + 3 + Math.floor(hh(day, slot * 5 + 4) * 4);
  } else {
    d = CPARTS[Math.floor(hh(day, slot * 5 + 2) * CPARTS.length)];
    o.k = 2; o.id = d; o.n = 3 + Math.floor(hh(day, slot * 5 + 3) * 4);
    o.pay = Math.floor((IL[d] + IH[d]) / 2 * o.n * 1.8) + 40;
    o.due = day + 2 + Math.floor(hh(day, slot * 5 + 4) * 3);
  }
  return o;
}
function ctText(k, id, n) { return ((k == 1) ? DN[id] : IN[id]) + " x" + n; }
function ctSlotFree(s) { return !(G.ctmday == dayOf() && (G.ctmask & (1 << s))); }
function ctAccept(slot) {
  var o = ctOffer(slot);
  if (G.ctmday != dayOf()) { G.ctmday = dayOf(); G.ctmask = 0; }
  G.ctmask |= (1 << slot);
  G.ctk = o.k; G.ctid = o.id; G.ctn = o.n; G.ctdue = o.due; G.ctpay = o.pay;
}
function ctDeliver() {
  var have = (G.ctk == 1) ? G.dev[G.ctid] : G.inv[G.ctid];
  if (G.ctk == 0 || have < G.ctn) { return false; }
  if (G.ctk == 1) { G.dev[G.ctid] -= G.ctn; } else { G.inv[G.ctid] -= G.ctn; }
  G.cash += G.ctpay; G.hx += 20; G.ctk = 0; addMin(10);
  return true;
}
function contractBoard() {
  var r, items, hints, slots, i, o;
  if (G.ctk && dayOf() > G.ctdue) { pop("Contract expired", ctText(G.ctk, G.ctid, G.ctn), "Too slow - the client walked", RED); G.ctk = 0; }
  while (true) {
    if (G.ctk) {
      r = menu("CONTRACT", ["Deliver now", "Abandon it"], 0, [ctText(G.ctk, G.ctid, G.ctn) + " for " + mny(G.ctpay) + " by day " + G.ctdue, "Drop it, no penalty"]);
      if (r < 0) { return; }
      if (r == 0) { if (ctDeliver()) { pop("DEAL DONE!", "+" + mny(G.ctpay), "Hack XP +20", GREEN); } else { flash("You don't have it yet", RED); } }
      else { G.ctk = 0; flash("Dropped", GRAY); }
      continue;
    }
    items = []; hints = []; slots = [];
    for (i = 0; i < 5; i++) {
      if (ctSlotFree(i)) { o = ctOffer(i); slots.push(i); items.push(ctText(o.k, o.id, o.n) + " " + mnyS(o.pay)); hints.push("Due day " + o.due + "  SEL: accept"); }
    }
    if (slots.length == 0) { flash("No contracts left today", GRAY); return; }
    r = menu("CONTRACTS D" + dayOf(), items, 0, hints);
    if (r < 0) { return; }
    ctAccept(slots[r]); flash("Accepted!", GREEN);
  }
}

/* ==========================================================
   RIVAL HACKER: NULLBYTE
   ========================================================== */
function nRival() { var i, n = 0; for (i = 0; i < NALL; i++) { if (visT(i) && G.rv[i] && !G.tg[i]) { n++; } } return n; }
function targetPay(t) {
  var p = G.tg[t] ? Math.floor(TPAY[t] * 0.35) : TPAY[t];
  if (!G.tg[t] && G.rv[t]) { p = Math.floor(p * 0.6); }
  return p;
}
function rivalDay() {
  var t, chance = DIFF_RIVAL[DIFF] || 0.15;
  if (rnd() < chance) {
    for (t = 0; t < NALL; t++) { if (visT(t) && !G.tg[t] && !G.rv[t]) { G.rv[t] = 1; G.rvmsg = "NULLBYTE hit " + TN[t]; return; } }
  }
}
function nDone() { var i, n = 0; for (i = 0; i < NTG + NBT; i++) { if (G.tg[i]) { n++; } } return n; }
function nSideDone() { var i, n = 0; for (i = NTG + NBT; i < NALL; i++) { if (G.tg[i]) { n++; } } return n; }
function nMainDone() { var i, n = 0; for (i = 0; i < NTG; i++) { if (G.tg[i]) { n++; } } return n; }
function bonusUnlocked() { return nMainDone() >= NTG; }
function targetsAll() { return nMainDone() >= NTG && nSideDone() >= NSD; }
function allWon() { return targetsAll() && G.up == ((1 << UPN.length) - 1) && (G.bi || 0) >= 1; }
function rivalEvent() {
  var n = nRival(), r, ch, amt, pay, id, loss;
  ch = Math.max(20, Math.min(85, 40 + lv(G.hx) * 5 - n * 4));
  amt = ri(60, 140) + n * 40; pay = 60 + n * 40;
  r = menu("NULLBYTE!", ["Fight him", "Pay " + mny(pay), "Run for it"], 0, ["Hacker duel: " + ch + "% to win", "He leaves you alone", "50% he grabs a part"]);
  if (r == 0) {
    if (rnd() * 100 < ch) { G.cash += amt; G.hx += 25; pop("You won!", "Took " + mny(amt) + " off NULLBYTE", "Hack XP +25", GREEN); }
    else { loss = Math.min(G.cash, amt); G.cash -= loss; G.en = Math.max(0, G.en - 10); pop("You lost!", "NULLBYTE took " + mny(loss), "Energy -10", RED); }
  } else if (r == 1 && G.cash >= pay) {
    G.cash -= pay; flash("He backs off", GRAY);
  } else {
    id = pickCheap();
    if (rnd() < 0.5 && G.inv[id] > 0) { G.inv[id]--; pop("Got jumped!", "He grabbed 1 " + IN[id], "Run faster next time", RED); }
    else { flash("You got away", GREEN); }
  }
}

/* ==========================================================
   GAME STATE
   ========================================================== */
var G = {}, HI = 0, ARRESTS = 0, DAYSUM = null;
function newGame() {
  var i, startCash = DIFF_CASH[DIFF] || 400;
  DAYS = DIFF_DAYS[DIFF] || 100;
  G = { cash: startCash, bank: 0, min: 480, en: 100, heat: 0, hung: 20, tired: 15, loc: 0, hx: 0, sx: 0, iron: 0, meter: 0, over: 0, pday: 1, printer: 0, robot: 0, phreaks: 0, phday: 0, up: 0, ctk: 0, ctid: 0, ctn: 0, ctdue: 0, ctpay: 0, ctmask: 0, ctmday: 0, rvmsg: "", rv: [], inv: [], dev: [], tg: [], tgT: [], rc: [], pr: [], gs: [0, 1, 2],
    sk: [0, 0, 0, 0], sp: 0, lastHx: 0, lastSx: 0, loan: 0, crew: 0, crewday: 0, rb: [], loy: 50, bi: 0, ccEnd: 0, ccId: 0, ccQty: 0, ccL: "", csMode: 0, csDay: 0, tr: 0, arrests: 0, maxheat: 0, nightHacks: 0, tip: [-1, -1, -1], tipday: 0, dayEarn: 0, daySpend: 0, lastDay: 1 };
  for (i = 0; i < NIT; i++) { G.inv.push(0); G.pr.push(IL[i]); }
  for (i = 0; i < NDEV; i++) { G.dev.push(0); }
  for (i = 0; i < NALL; i++) { G.tg.push(0); G.tgT.push(-99999); G.rc.push(0); G.rv.push(0); }
  ARRESTS = 0; DAYSUM = null;
  newPrices();
}
function mny(n) {
  n = Math.floor(n); var s = String(Math.abs(n)), o = "";
  while (s.length > 3) { o = "," + s.substring(s.length - 3) + o; s = s.substring(0, s.length - 3); }
  return (n < 0 ? "-$" : "$") + s + o;
}
function mnyS(n) {
  n = Math.floor(n);
  if (n >= 1000000) { return "$" + (Math.floor(n / 100000) / 10) + "M"; }
  if (n >= 100000) { return "$" + Math.floor(n / 1000) + "k"; }
  return mny(n);
}
function pint(v, lo, hi, d) { v = parseInt(v, 10); return (v >= lo && v <= hi) ? v : d; }
function lv(xp) { return Math.min(10, 1 + Math.floor(xp / 100)); }
function bestPower() { var i, b = 0; for (i = 0; i < NDEV; i++) { if (G.dev[i] > 0 && DP[i] > b) { b = DP[i]; } } return b; }
function price(i, mult) { return Math.max(1, Math.floor(G.pr[i] * mult)); }
function newPrices() {
  var i, r, pickA = [0, 1, 2, 6, 9, 10, 12, 17, 13, 15, 16, 19, 34, 35, 36, 37];
  for (i = 0; i < NIT; i++) {
    G.pr[i] = ri(IL[i], IH[i]);
    r = rnd();
    if (r < 0.08) { G.pr[i] = Math.max(1, Math.floor(G.pr[i] * 0.7)); } else if (r > 0.94) { G.pr[i] = Math.floor(G.pr[i] * 1.4) + 1; }
  }
  for (i = 0; i < 3; i++) { G.gs[i] = pickA[ri(0, pickA.length - 1)]; }
}
function pickCheap() { var a = [13, 14, 15, 16, 17, 18, 19, 20, 22, 9, 10, 12, 35, 36, 37]; return a[ri(0, a.length - 1)]; }
function pickGood() { var a = [0, 1, 2, 3, 6, 7, 8, 11, 34, 30]; return a[ri(0, a.length - 1)]; }

/* time passes: energy drains, heat cools, prices change at midnight */
function addMin(n) {
  var d;
  if (n <= 0) { return; }
  G.min += n;
  G.en -= n / 36;
  if (G.en < 0) { G.en = 0; }
  G.heat -= n / 60 * 1.5;
  if (G.heat < 0) { G.heat = 0; }
  /* hunger & tiredness build over time */
  G.hung = Math.min(100, (G.hung || 0) + n / 25);
  G.tired = Math.min(100, (G.tired || 0) + n / 30);
  if ((G.hung || 0) > 85) { G.en = Math.max(0, G.en - n / 80); }
  if ((G.tired || 0) > 85) { G.en = Math.max(0, G.en - n / 70); }
  d = dayOf();
  if (d > G.pday) {
    while (G.pday < d) { G.pday++; G.bank += Math.floor(G.bank * 0.01); rivalDay(); }
    newPrices();
  }
  crewTick();
}
function addHeat(n) {
  G.heat += n;
  if (G.heat > 100) { G.heat = 100; }
  if (G.heat < 0) { G.heat = 0; }
  if (G.heat > (G.maxheat || 0)) { G.maxheat = G.heat; }
}
function useEn(n) { G.en -= n; if (G.en < 0) { G.en = 0; } }
function isOpen(t) {
  var h = hourOf();
  if (t == T_BANK) { return h >= 9 && h < 17; }
  if (t == T_ELEC || t == T_PAWN || t == T_HARD || t == T_GARAGE || t == T_SUPPLY || t == T_ROBOT) { return h >= 8 && h < 21; }
  if (t == T_LIB) { return h >= 9 && h < 20; }
  if (t == T_CAFE) { return true; }   /* cafes never close */
  if (t == T_CORNER) { return h >= 6 && h < 24; }
  if (t == T_BM) { return h >= 20 || h < 5; }
  if (t == T_LOCK) { return h >= 10 && h < 22; }
  return true;
}
function lockText(t) {
  var nm = SNAME[t] || "Building";
  if (t == T_BANK) { return nm + " CLOSED - open " + hourStr(9) + "-" + hourStr(17); }
  if (t == T_ELEC || t == T_PAWN || t == T_HARD || t == T_GARAGE || t == T_SUPPLY || t == T_ROBOT) { return nm + " CLOSED - open " + hourStr(8) + "-" + hourStr(21); }
  if (t == T_LIB) { return nm + " CLOSED - open " + hourStr(9) + "-" + hourStr(20); }
  if (t == T_CAFE) { return nm + " open 24/7"; }
  if (t == T_CORNER) { return nm + " CLOSED - open " + hourStr(6) + "-midnight"; }
  if (t == T_BM) { return nm + " only after dark " + hourStr(20) + "-" + hourStr(5); }
  if (t == T_LOCK) { return nm + " CLOSED - open " + hourStr(10) + "-" + hourStr(22); }
  return nm + " CLOSED";
}
/* short list of shops/spots in a district for travel hints */
function locShops(loc) {
  var sp = SP[loc], i, t, seen = {}, parts = [], nm;
  if (!sp) { return ""; }
  for (i = 0; i < sp.length; i++) {
    t = sp[i][1];
    if (t == T_TRAVEL || t == T_TGT) { continue; }
    if (seen[t]) { continue; }
    seen[t] = 1;
    nm = SNAME[t] || "?";
    /* keep short for menu hint line */
    if (nm.length > 12) { nm = nm.substring(0, 12); }
    parts.push(nm);
    if (parts.length >= 3) { break; }
  }
  return parts.length ? parts.join(", ") : "street only";
}

/* ==========================================================
   SAVE / LOAD  (3 named slots on SD, else LittleFS)
   ========================================================== */
var NSLOT = 3, CUR = -1, CURNAME = "";
function slotPath(i) { return "/hackerz_slot" + (i + 1) + ".txt"; }
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
function cleanName(n) {
  var o = "", i, c, j, UC = "ABCDEFGHIJKLMNOPQRSTUVWXYZ", LC = "abcdefghijklmnopqrstuvwxyz";
  n = String(n || "");
  for (i = 0; i < n.length && o.length < 10; i++) {
    c = n.substring(i, i + 1); j = LC.indexOf(c);
    if (j >= 0) { c = UC.substring(j, j + 1); }
    if ("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .".indexOf(c) >= 0) { o += c; }
  }
  while (o.length > 0 && o.substring(o.length - 1) == " ") { o = o.substring(0, o.length - 1); }
  return o;
}
function rbSave() {
  var i, o, out = [];
  ensureRobots();
  for (i = 0; i < (G.robot || 0); i++) { o = G.rb[i]; out.push([o.sel, o.rep, o.end, o.q, o.lvl, o.cond].join(":")); }
  return out.join("~");
}
function gameStr() {
  return [G.cash, G.bank, G.min, Math.floor(G.en), Math.floor(G.heat), G.loc, G.hx, G.sx, G.iron, G.meter, CLK12 ? 1 : 0, HI, G.pday, 1, G.printer, G.phreaks, G.phday, G.up, G.ctk, G.ctid, G.ctn, G.ctdue, G.ctpay, G.ctmask, G.ctmday, (G.robot || 0),
    DIFF, G.sp || 0, (G.sk || [0,0,0,0]).join(";"), G.loan || 0, G.crew || 0, G.crewday || 0, G.tr || 0, G.arrests || 0, G.maxheat || 0, G.nightHacks || 0, (G.tip || [-1,-1,-1]).join(";"), G.tipday || 0, (G.rb && G.rb[0] && G.robot) ? G.rb[0].sel : 0, (G.rb && G.rb[0] && G.robot) ? G.rb[0].rep : 0, (G.rb && G.rb[0] && G.robot) ? G.rb[0].end : 0, (G.rb && G.rb[0] && G.robot) ? G.rb[0].q : "", G.ccEnd || 0, G.ccId || 0, G.ccQty || 0, G.csMode || 0, G.csDay || 0, (G.ccL || ""), loyVal(), G.bi || 0, rbSave()].join(",") + "|" +
    G.inv.join(",") + "|" + G.dev.join(",") + "|" + G.tg.join(",") + "|" + G.tgT.join(",") + "|" + G.rc.join(",") + "|" + G.pr.join(",") + "|" + G.gs.join(",") + "|" + G.rv.join(",");
}
function loadData(d) {
  var p, a, q, i, sks, tips, l0, rbs, rj, ro;
  try {
    p = d.split("|"); a = p[0].split(",");
    newGame();
    G.cash = pint(a[0], 0, 2000000000, 400); G.bank = pint(a[1], 0, 2000000000, 0); G.min = pint(a[2], 0, 100000000, 480);
    G.en = pint(a[3], 0, 100, 100); G.heat = pint(a[4], 0, 100, 0); G.loc = pint(a[5], 0, LOCN.length - 1, 0);
    G.hx = pint(a[6], 0, 100000, 0); G.sx = pint(a[7], 0, 100000, 0); G.iron = pint(a[8], 0, 1, 0); G.meter = pint(a[9], 0, 1, 0);
    CLK12 = (a[10] != "0");
    i = pint(a[11], 0, 2000000000, 0); if (i > HI) { HI = i; }
    G.pday = pint(a[12], 1, 100000, dayOf()); G.printer = pint(a[14], 0, 3, 0); G.phreaks = pint(a[15], 0, 99, 0); G.phday = pint(a[16], 0, 100000, 0); G.up = pint(a[17], 0, 255, 0); G.ctk = pint(a[18], 0, 2, 0); G.ctid = pint(a[19], 0, 99, 0); G.ctn = pint(a[20], 0, 99, 0); G.ctdue = pint(a[21], 0, 100000, 0); G.ctpay = pint(a[22], 0, 2000000000, 0); G.ctmask = pint(a[23], 0, 31, 0); G.ctmday = pint(a[24], 0, 100000, 0);
    G.robot = 0;
    if (a.length > 25) {
      /* a[25] may be robot (new) or DIFF (old saves) */
      if (a.length > 37) {
        G.robot = pint(a[25], 0, 3, 0);
        DIFF = pint(a[26], 0, 3, 1); DAYS = DIFF_DAYS[DIFF] || 100;
        G.sp = pint(a[27], 0, 9999, 0);
        sks = (a[28] || "0;0;0;0").split(";"); for (i = 0; i < 4; i++) { G.sk[i] = pint(sks[i], 0, 999, 0); }
        G.loan = pint(a[29], 0, 2000000000, 0); G.crew = pint(a[30], 0, 1, 0); G.crewday = pint(a[31], 0, 100000, 0);
        G.tr = pint(a[32], 0, 2047, 0); G.arrests = pint(a[33], 0, 999, 0); G.maxheat = pint(a[34], 0, 100, 0); G.nightHacks = pint(a[35], 0, 99, 0);
        tips = (a[36] || "-1;-1;-1").split(";"); for (i = 0; i < 3; i++) { G.tip[i] = pint(tips[i], -1, NALL - 1, -1); }
        G.tipday = pint(a[37], 0, 100000, 0);
        if (a.length > 46) {
          l0 = { sel: pint(a[38], 0, 16383, 0), rep: pint(a[39], 0, 1, 0), end: pint(a[40], 0, 100000000, 0), q: /^[0-9;]*$/.test(a[41] || "") ? (a[41] || "") : "" };
          if (l0.end > 0 && l0.q == "") { l0.end = 0; }
          ensureRobots();
          if (G.robot > 0) { G.rb[0].sel = l0.sel; G.rb[0].rep = l0.rep; G.rb[0].end = l0.end; G.rb[0].q = l0.q; }
          G.ccEnd = pint(a[42], 0, 100000000, 0); G.ccId = pint(a[43], 0, NIT - 1, 0); G.ccQty = pint(a[44], 0, 50, 0);
          G.csMode = pint(a[45], 0, 3, 0); G.csDay = pint(a[46], 0, 100000, 0);
          G.ccL = (a.length > 47 && /^[0-9:;]*$/.test(a[47] || "")) ? (a[47] || "") : "";
          if (G.ccL == "" && G.ccQty > 0) { G.ccL = G.ccId + ":" + G.ccQty; }
          if (G.ccL == "") { G.ccEnd = 0; }
          if (a.length > 48) { G.loy = pint(a[48], 0, 100, 50); }
          if (a.length > 49) { G.bi = pint(a[49], 0, 999, 0); }
          if (a.length > 50 && a[50]) {
            rbs = a[50].split("~");
            for (i = 0; i < rbs.length && i < G.robot; i++) {
              rj = rbs[i].split(":");
              if (rj.length >= 6) {
                ro = G.rb[i];
                ro.sel = pint(rj[0], 0, 16383, 0); ro.rep = pint(rj[1], 0, 1, 0); ro.end = pint(rj[2], 0, 100000000, 0);
                ro.q = /^[0-9;]*$/.test(rj[3] || "") ? (rj[3] || "") : ""; if (ro.end > 0 && ro.q == "") { ro.end = 0; }
                ro.lvl = pint(rj[4], 1, RB_MAXL, 1); ro.cond = pint(rj[5], 0, 100, 100);
              }
            }
          }
        }
      } else {
        DIFF = pint(a[25], 0, 3, 1); DAYS = DIFF_DAYS[DIFF] || 100;
        G.sp = pint(a[26], 0, 9999, 0);
        sks = (a[27] || "0;0;0;0").split(";"); for (i = 0; i < 4; i++) { G.sk[i] = pint(sks[i], 0, 999, 0); }
        G.loan = pint(a[28], 0, 2000000000, 0); G.crew = pint(a[29], 0, 1, 0); G.crewday = pint(a[30], 0, 100000, 0);
        G.tr = pint(a[31], 0, 2047, 0); G.arrests = pint(a[32], 0, 999, 0); G.maxheat = pint(a[33], 0, 100, 0); G.nightHacks = pint(a[34], 0, 99, 0);
        tips = (a[35] || "-1;-1;-1").split(";"); for (i = 0; i < 3; i++) { G.tip[i] = pint(tips[i], -1, NALL - 1, -1); }
        G.tipday = pint(a[36], 0, 100000, 0);
      }
    }
    ensureRobots();
    q = (p[1] || "").split(","); for (i = 0; i < NIT; i++) { G.inv[i] = pint(q[i], 0, 9999, 0); }
    q = (p[2] || "").split(","); for (i = 0; i < NDEV; i++) { G.dev[i] = pint(q[i], 0, 99, 0); }
    q = (p[3] || "").split(","); for (i = 0; i < NALL; i++) { G.tg[i] = pint(q[i], 0, 1, 0); }
    q = (p[4] || "").split(","); for (i = 0; i < NALL; i++) { G.tgT[i] = parseInt(q[i], 10); if (!(G.tgT[i] > -100000)) { G.tgT[i] = -99999; } }
    q = (p[5] || "").split(","); for (i = 0; i < NALL; i++) { G.rc[i] = pint(q[i], 0, 1, 0); }
    q = (p[6] || "").split(","); for (i = 0; i < NIT; i++) { G.pr[i] = pint(q[i], 1, 99999, IL[i]); }
    q = (p[7] || "").split(","); for (i = 0; i < 3; i++) { G.gs[i] = pint(q[i], 0, NIT - 1, 0); }
    q = (p[8] || "").split(","); for (i = 0; i < NALL; i++) { G.rv[i] = pint(q[i], 0, 1, 0); }
    return true;
  } catch (e3) { newGame(); return false; }
}
function slotRead(i) {
  var d = rdFile(slotPath(i)), h;
  if (d.length >= 3) {
    h = d.indexOf("#");
    if (h >= 0 && d.indexOf("|") > h) { return { name: d.substring(0, h) || ("SLOT " + (i + 1)), data: d.substring(h + 1) }; }
  }
  return null;
}
function slotLabel(i, info) {
  var a;
  if (!info) { return (i + 1) + "  - empty -"; }
  a = info.data.split("|")[0].split(",");
  return (i + 1) + " " + info.name + " D" + (Math.floor(pint(a[2], 0, 100000000, 480) / 1440) + 1) + " " + mnyS(pint(a[0], 0, 2000000000, 0));
}
function wrSlot(i, name) { return wrFile(slotPath(i), cleanName(name) + "#" + gameStr()); }
function saveGame() { if (CUR < 0) { return ""; } return wrSlot(CUR, CURNAME); }
function saveHi() { wrFile("/hackerz_hi.txt", "HI," + HI); }
function loadHi() {
  var d = rdFile("/hackerz_hi.txt");
  if (d.substring(0, 3) == "HI,") { HI = pint(d.substring(3), 0, 2000000000, 0); }
}
function saveCfg() { wrFile("/hackerz_cfg.txt", "CLK," + (CLK12 ? 1 : 0) + ",PRF," + (PROFANE ? 1 : 0)); }
function loadCfg() {
  var d = rdFile("/hackerz_cfg.txt");
  var q;
  if (d.substring(0, 4) == "CLK,") { CLK12 = (d.substring(4, 5) != "0"); }
  q = d.indexOf("PRF,");
  if (q >= 0) { PROFANE = (d.substring(q + 4, q + 5) != "0"); }
}
function anySaved() { var i; for (i = 0; i < NSLOT; i++) { if (slotRead(i)) { return true; } } return false; }
function slotMenu(title, idx, saving) {
  var items = [], hints = [], i, inf;
  for (i = 0; i < NSLOT; i++) {
    inf = slotRead(i); items[i] = slotLabel(i, inf);
    hints[i] = inf ? (saving ? "Used - you will confirm first" : "Load this saved game") : (saving ? "Empty slot - safe to use" : "Nothing saved here");
  }
  return menu(title, items, idx, hints);
}
var NCH = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z",
  "0","1","2","3","4","5","6","7","8","9"," ","."," < DEL "," OK >"];
function askName(title, init) {
  var nm = cleanName(init), cx = 0, dirty = true, k, n = NCH.length, c0, c1, c2;
  menuMode(); drainEnc(); lockEnc(ENC_GAP_MS);
  while (true) {
    if (dirty) {
      cls(DARK); fr(0, 0, W, 22, HDR); txt(title, 6, 4, 2, WHITE);
      txt("Name:", 8, 36, 2, rgb(170, 210, 240));
      fr(8, 56, W - 16, 26, BLACK); rc(8, 56, W - 16, 26, GRAY);
      txt(nm + "_", 14, 61, 2, YEL);
      c0 = NCH[(cx + n - 1) % n]; c1 = NCH[cx]; c2 = NCH[(cx + 1) % n];
      fr(60, 100, W - 120, 32, rgb(40, 120, 190));
      ctxt(c1, 107, 2, WHITE);
      txt(c0, 20, 110, 1, GRAY); txt(c2, W - 70, 110, 1, GRAY);
      fr(0, H - 14, W, 14, rgb(6, 12, 24));
      txt("Turn: pick  SEL: add/ok  ESC: cancel", 4, H - 11, 1, HINT);
      dirty = false;
    }
    k = inpMenu();
    if (k == 1) { cx = (cx + 1) % n; dirty = true; settleInput(); continue; }
    else if (k == 2) { cx = (cx + n - 1) % n; dirty = true; settleInput(); continue; }
    else if (k == 3) {
      settleInput();
      if (cx == n - 1) { return nm; }
      if (cx == n - 2) { if (nm.length > 0) { nm = nm.substring(0, nm.length - 1); } }
      else if (nm.length < 10) { nm += NCH[cx]; }
      dirty = true; continue;
    }
    else if (k == 4) { settleInput(); return null; }
    wait(55);
  }
}
function confirm2(l1, l2, col) {
  fr(10, 40, W - 20, 90, BLACK); rc(10, 40, W - 20, 90, col); rc(11, 41, W - 22, 88, col);
  ctxt(l1, 52, 2, WHITE); ctxt(l2, 78, 1, col);
  ctxt("SEL = Yes    ESC = No", 108, 1, YEL);
  return waitKey() == 3;
}
function saveFlow() {
  var idx = (CUR >= 0) ? CUR : 0, r, inf, nm, wh, def;
  menuMode();
  while (true) {
    r = slotMenu("SAVE - PICK SLOT", idx, true);
    if (r < 0) { return false; }
    idx = r; inf = slotRead(r);
    def = inf ? inf.name : ((r == CUR && CURNAME) ? CURNAME : "");
    nm = askName("NAME SLOT " + (r + 1), def);
    if (nm === null) { continue; }
    if (nm.length == 0) { nm = "SLOT " + (r + 1); }
    if (!confirm2("Save to slot " + (r + 1) + "?", inf ? ("REPLACES: " + inf.name) : ("New save: " + nm), inf ? RED : GREEN)) { continue; }
    wh = wrSlot(r, nm);
    if (wh == "") { flash("SAVE FAILED!", RED); continue; }
    CUR = r; CURNAME = cleanName(nm);
    flash("Saved to " + (wh == "sd" ? "SD card" : "flash mem"), GREEN);
    return true;
  }
}
function loadFlow() {
  var idx = 0, r, inf;
  menuMode();
  while (true) {
    r = slotMenu("LOAD - PICK SLOT", idx, false);
    if (r < 0) { return false; }
    idx = r; inf = slotRead(r);
    if (!inf) { flash("Slot is empty", RED); continue; }
    if (loadData(inf.data)) { CUR = r; CURNAME = inf.name; return true; }
    flash("Save is damaged", RED);
  }
}

/* ==========================================================
   HUD + helpers
   ========================================================== */
function hud() {
  var hu = Math.floor(G.hung || 0), sl = Math.floor(G.tired || 0);
  fr(0, 0, W, 14, rgb(10, 10, 24));
  txt(mnyS(G.cash), 2, 3, 1, GREEN);
  txt(clockStr(), 48, 3, 1, WHITE);
  txt("D" + dayOf(), 90, 3, 1, YEL);
  txt("E" + Math.floor(G.en), 116, 3, 1, G.en > 25 ? CYAN : RED);
  /* Hunger bar F — full left = not hungry */
  txt("F", 146, 3, 1, hu > 70 ? RED : ORNG);
  rc(154, 3, 22, 8, GRAY); fr(155, 4, Math.floor(20 * Math.max(0, 100 - hu) / 100), 6, hu > 70 ? RED : rgb(80, 200, 60));
  /* Sleep/tired bar S — full left = rested */
  txt("S", 180, 3, 1, sl > 70 ? RED : CYAN);
  rc(188, 3, 22, 8, GRAY); fr(189, 4, Math.floor(20 * Math.max(0, 100 - sl) / 100), 6, sl > 70 ? RED : rgb(80, 160, 255));
  txt("H", 214, 3, 1, ORNG); rc(222, 3, 24, 8, GRAY); fr(223, 4, Math.floor(22 * G.heat / 100), 6, G.heat > 66 ? RED : ORNG);
  txt(LOCN[G.loc].substring(0, 8), 250, 3, 1, CYAN);
  txt("P" + bestPower(), 302, 3, 1, MATG);
}
function hudKey() {
  return mnyS(G.cash) + "|" + G.min + "|" + Math.floor(G.en) + "|" + Math.floor(G.heat) + "|" + G.loc + "|" + bestPower() + "|" + (CLK12 ? 1 : 0) + "|" + Math.floor(G.hung || 0) + "|" + Math.floor(G.tired || 0);
}
function bar(msg, col) {
  fr(0, 158, W, 12, rgb(10, 10, 24));
  msg = String(msg); if (msg.length > 52) { msg = msg.substring(0, 52); }
  txt(msg, 4, 161, 1, col);
}
function redrawAll() { hud(); fullPaint(); }
function walkMode() { ENC_GAP_MS = 35; ENC_REV_MS = 90; SEL_HOLD_MS = 200; encOn(); }
function menuMode() { ENC_GAP_MS = MENU_GAP; ENC_REV_MS = MENU_REV; SEL_HOLD_MS = 200; encOn(); }
function pop(a, b, c, col) { popup([[a, 2, col], [b, 1, WHITE], [c, 1, WHITE]], col); }
function listLines(title, lines, col) {
  var i;
  cls(rgb(0, 12, 6)); fr(0, 0, W, 18, rgb(0, 70, 30)); txt(title, 6, 5, 1, MATG);
  for (i = 0; i < lines.length && i < 11; i++) { txt(lines[i][0], 8, 24 + i * 12, 1, lines[i][1]); }
  fr(0, H - 14, W, 14, rgb(6, 12, 24)); txt("SEL / ESC: back", 4, H - 11, 1, HINT);
  waitKey();
}

/* ==========================================================
   SHOPS
   ========================================================== */
/* ids: part ids; -1 = soldering iron, -2 = multimeter; mult = price multiplier */
function shopBuy(title, ids, mult) {
  var idx = 0, r, i, items, hints, qty = 1, id, p, n, e;
  while (true) {
    items = ["Buy qty: " + qty]; hints = ["SEL cycles 1/5/10/20/25/30/40/50"];
    for (i = 0; i < ids.length; i++) {
      id = ids[i];
      if (id >= 0) { items.push(IN[id] + " " + mnyS(price(id, mult)) + " x" + G.inv[id]); hints.push(IDS[id]); }
      else if (id == -1) { items.push("Solder Iron " + (G.iron ? "OWNED" : "$25")); hints.push("Needed to build anything"); }
      else if (id == -2) { items.push("Multimeter " + (G.meter ? "OWNED" : "$20")); hints.push("+10% build success"); }
      else { items.push("3D Printer " + ((G.printer || 0) >= 3 ? "MAX 3" : "$150 (" + (G.printer || 0) + "/3)")); hints.push("Up to 3 printers: print parallel batches"); }
    }
    r = menu(title + " " + mnyS(G.cash), items, idx, hints);
    if (r < 0) { return; }
    idx = r;
    if (r == 0) { qty = nextQty(qty); continue; }
    id = ids[r - 1];
    if (id < 0) {
      p = (id == -1) ? 25 : ((id == -2) ? 20 : 150);
      if (id == -1 && G.iron) { flash("Already owned", GRAY); }
      else if (id == -2 && G.meter) { flash("Already owned", GRAY); }
      else if (id == -3 && (G.printer || 0) >= 3) { flash("Max 3 printers", GRAY); }
      else if (G.cash < p) { flash("Not enough cash", RED); }
      else {
        G.cash -= p;
        if (id == -1) { G.iron = 1; }
        else if (id == -2) { G.meter = 1; }
        else { G.printer = (G.printer || 0) + 1; }
        addMin(2); flash("Bought!", GREEN);
      }
      continue;
    }
    p = price(id, mult); n = qty;
    if (G.cash < p) { flash("Not enough cash", RED); continue; }
    if (G.cash < p * n) { n = Math.floor(G.cash / p); }
    G.cash -= p * n; G.inv[id] += n; addMin(1 + Math.floor(n / 3));
    flash("Bought " + n + " x " + IN[id].substring(0, 9), GREEN);
  }
}
function bankLog(msg) {
  if (!G.bh) { G.bh = []; }
  G.bh.unshift("D" + dayOf() + " " + msg);
  if (G.bh.length > 10) { G.bh.pop(); }
}
function bankHistory() {
  var items = [], i;
  if (!G.bh || G.bh.length == 0) { flash("No transactions yet", GRAY); return; }
  for (i = 0; i < G.bh.length; i++) { items.push(G.bh[i]); }
  menu("TX HISTORY", items, 0, null);
}
function bank() {
  var r, idx = 0, amt;
  while (true) {
    r = menu("BANK " + mnyS(G.bank), [
      "Deposit $100", "Deposit $1000", "Deposit all cash",
      "Withdraw $100", "Withdraw $1000", "Withdraw $10000", "Withdraw all",
      "Transaction history"
    ], idx, [
      "Safe money earns 1% a day (pocket " + mnyS(G.cash) + ")", "Larger deposit", "Move everything in",
      "Take $100 out", "Take $1,000 out", "Take $10,000 out", "Empty the account",
      "Recent deposits and withdrawals"
    ]);
    if (r < 0) { return; }
    idx = r;
    if (r == 0) {
      if (G.cash >= 100) { G.cash -= 100; G.bank += 100; bankLog("DEP +$100"); }
      else { flash("Need $100 cash", RED); }
    } else if (r == 1) {
      if (G.cash >= 1000) { G.cash -= 1000; G.bank += 1000; bankLog("DEP +$1,000"); }
      else { flash("Need $1,000 cash", RED); }
    } else if (r == 2) {
      amt = G.cash; if (amt > 0) { G.bank += amt; G.cash = 0; bankLog("DEP +" + mny(amt)); }
      else { flash("No cash", GRAY); }
    } else if (r == 3) {
      if (G.bank >= 100) { G.bank -= 100; G.cash += 100; bankLog("WDR -$100"); }
      else { flash("Not enough saved", RED); }
    } else if (r == 4) {
      if (G.bank >= 1000) { G.bank -= 1000; G.cash += 1000; bankLog("WDR -$1,000"); }
      else { flash("Not enough saved", RED); }
    } else if (r == 5) {
      if (G.bank >= 10000) { G.bank -= 10000; G.cash += 10000; bankLog("WDR -$10,000"); }
      else { flash("Not enough saved", RED); }
    } else if (r == 6) {
      amt = G.bank; if (amt > 0) { G.cash += amt; G.bank = 0; bankLog("WDR -" + mny(amt)); }
      else { flash("Account empty", GRAY); }
    } else {
      bankHistory();
    }
    addMin(2);
  }
}
function library() {
  var r, idx = 0;
  while (true) {
    r = menu("LIBRARY", ["Study hacking (3h)", "Study electronics (3h)"], idx, ["Hack LV " + lv(G.hx) + "  +45 xp  -10 energy", "Solder LV " + lv(G.sx) + "  +45 xp  -10 energy"]);
    if (r < 0) { return; }
    idx = r;
    if (G.en < 10) { flash("Too tired!", RED); continue; }
    addMin(180); useEn(10);
    if (r == 0) { G.hx += 45; flash("Hack LV " + lv(G.hx), GREEN); } else { G.sx += 45; flash("Solder LV " + lv(G.sx), GREEN); }
  }
}
function feed(cost, enAdd, hungCut, tiredCut, mins, msg) {
  if (G.cash < cost) { flash("Need " + mny(cost), RED); return false; }
  G.cash -= cost; G.daySpend = (G.daySpend || 0) + cost;
  G.en = Math.min(100, G.en + enAdd);
  G.hung = Math.max(0, (G.hung || 0) - hungCut);
  G.tired = Math.max(0, (G.tired || 0) - tiredCut);
  addMin(mins);
  flash(msg, GREEN);
  return true;
}
function cafe() {
  var r, idx = 0, p;
  while (true) {
    r = menu("CAFE " + mnyS(G.cash), [
      "Coffee $4", "Espresso $6", "Sandwich $9", "Hot meal $12", "Soup $8", "Dessert $5",
      "Freelance gig (4h)", "Contract board"
    ], idx, [
      "+12 energy, -hunger", "+18 energy, wake up a bit", "+25 energy, fills you", "+40 energy, big meal",
      "+20 energy, warm", "+10 energy, sweet", "Website job for cash", G.ctk ? "Active contract" : "5 jobs a day"
    ]);
    if (r < 0) { return; }
    idx = r;
    if (r == 0) { feed(4, 12, 8, 4, 10, "Coffee +12"); }
    else if (r == 1) { feed(6, 18, 6, 10, 8, "Espresso +18"); }
    else if (r == 2) { feed(9, 25, 35, 5, 15, "Sandwich +25"); }
    else if (r == 3) { feed(12, 40, 50, 8, 30, "Hot meal +40"); }
    else if (r == 4) { feed(8, 20, 30, 6, 20, "Soup +20"); }
    else if (r == 5) { feed(5, 10, 12, 2, 10, "Dessert +10"); }
    else if (r == 7) { contractBoard(); }
    else {
      if (G.en < 20) { flash("Too tired!", RED); continue; }
      p = ri(45, 95) + lv(G.hx) * 5; addMin(240); useEn(15); G.cash += p; G.hung = Math.min(100, (G.hung || 0) + 12); flash("Paid " + mny(p), GREEN);
    }
  }
}
function cornerStore() {
  var r, idx = 0;
  while (true) {
    r = menu("CORNER STORE " + mnyS(G.cash), [
      "Coffee $3", "Tea $3", "Slurpee $4", "Chips $2", "Hot dog $5",
      "Candy $1", "Energy drink $5", "Water $1", "Leave"
    ], idx, [
      "Quick caffeine", "Calm sip", "Sugar rush", "Salty snack", "Street food",
      "Sugar hit", "+energy, less tired", "Hydrate", "Walk out"
    ]);
    if (r < 0 || r == 8) { return; }
    idx = r;
    if (r == 0) { feed(3, 10, 5, 3, 5, "Coffee"); }
    else if (r == 1) { feed(3, 8, 4, 6, 5, "Tea"); }
    else if (r == 2) { feed(4, 12, 10, 2, 5, "Slurpee"); }
    else if (r == 3) { feed(2, 6, 15, 0, 3, "Chips"); }
    else if (r == 4) { feed(5, 18, 28, 2, 8, "Hot dog"); }
    else if (r == 5) { feed(1, 4, 8, 0, 2, "Candy"); }
    else if (r == 6) { feed(5, 20, 5, 12, 5, "Energy drink"); }
    else if (r == 7) { feed(1, 5, 2, 1, 2, "Water"); }
  }
}
function scrap(arg) {
  var r, id, n, i, p, lb = luckBonus();
  if (G.en < 8) { flash("Too tired!", RED); return; }
  if (!confirm2(arg ? "Dig the salvage?" : "Dig the scrap pile?", "1 hour, -8 energy. Who knows?", YEL)) { return; }
  addMin(60); useEn(8); r = rnd();
  if (r < 0.55 + lb) {
    n = ri(1, 3 + (lb > 0.08 ? 1 : 0)); for (i = 0; i < n; i++) { id = pickCheap(); G.inv[id]++; }
    pop("Found parts!", "You pulled " + n + " cheap parts out of it", "Check your inventory", GREEN);
  } else if (r < 0.68 + lb * 1.5) {
    id = pickGood(); G.inv[id]++; pop("JACKPOT!", "A working " + IN[id], "Somebody threw this away?!", YEL);
  } else if (r < 0.92) { flash("Just junk...", GRAY); }
  else { p = Math.min(G.cash, 20); G.cash -= p; pop("Yard guard!", "He fined you " + mny(p), "Move along", RED); }
}
function garage() {
  var ids = [G.gs[0], G.gs[1], G.gs[2]];
  shopBuy("GARAGE", ids, 0.4);
}
function blackMarket() {
  shopBuy("BLACK MKT", [23, 24, 25, 26, 27, 3, 4, 5, 42, 43, 44], 1.15);
}

/* ==========================================================
   WORKBENCH
   ========================================================== */
function canBuild(d) {
  var i, r = DR[d];
  if (!G.iron) { return false; }
  for (i = 0; i < r.length; i++) { if (G.inv[r[i][0]] < r[i][1]) { return false; } }
  return true;
}
function recipeShow(d) {
  var i, r = DR[d], have, c;
  cls(rgb(0, 12, 6)); fr(0, 0, W, 18, rgb(0, 70, 30));
  txt(DN[d] + "  (PWR " + DP[d] + ")", 6, 5, 1, MATG);
  for (i = 0; i < r.length; i++) {
    have = G.inv[r[i][0]]; c = (have >= r[i][1]) ? GREEN : RED;
    txt(IN[r[i][0]], 10, 24 + i * 11, 1, c);
    txt(have + "/" + r[i][1], 150, 24 + i * 11, 1, c);
  }
  txt("Built: " + G.dev[d], 220, 24, 1, CYAN);
  txt(G.iron ? "Iron OK" : "NO IRON!", 220, 36, 1, G.iron ? GREEN : RED);
  txt(G.meter ? "Meter OK" : "no meter", 220, 48, 1, G.meter ? GREEN : GRAY);
  txt("Success " + buildChance() + "%", 220, 60, 1, YEL);
  fr(0, H - 14, W, 14, rgb(6, 12, 24));
  txt(canBuild(d) ? "SEL: build it   ESC: back" : "Missing stuff   ESC: back", 4, H - 11, 1, HINT);
}
function buildDevice(d) {
  var i, r = DR[d], ch = buildChance(), lost, okb, timeMul;
  for (i = 0; i < r.length; i++) { G.inv[r[i][0]] -= r[i][1]; }
  timeMul = buildTimeMul();
  addMin(Math.floor((60 + 30 * DP[d]) * timeMul)); useEn(Math.max(4, Math.floor(8 * timeMul)));
  okb = (rnd() * 100 < ch);
  checkLevelUps();
  if (okb) {
    G.dev[d]++; G.sx += 25 + 10 * DP[d];
    pop("BUILT!", DN[d] + " is alive", "Solder LV " + lv(G.sx) + "   Best power " + bestPower(), GREEN);
  } else {
    lost = r[ri(0, r.length - 1)][0];
    for (i = 0; i < r.length; i++) { if (r[i][0] != lost) { G.inv[r[i][0]] += r[i][1]; } else if (r[i][1] > 1) { G.inv[r[i][0]] += r[i][1] - 1; } }
    G.sx += 12;
    pop("Cold joint!", "It fried: lost 1 " + IN[lost], "Other parts saved. Try again!", RED);
  }
}
function recipeFlow(d) {
  var k, dirty = true;
  menuMode();
  while (true) {
    if (dirty) { recipeShow(d); dirty = false; }
    k = inpMenu();
    if (k == 4) { settleInput(); return; }
    if (k == 3) {
      settleInput();
      if (!G.iron) { flash("Need a soldering iron", RED); }
      else if (!canBuild(d)) { flash("Missing parts", RED); }
      else if (G.en < 8) { flash("Too tired!", RED); }
      else { buildDevice(d); }
      dirty = true; continue;
    }
    wait(55);
  }
}
function crewBuildOnce() {
  var d, i, r, missing, best = -1;
  if (!G.crew) { flash("No helper hired", GRAY); return; }
  if (G.en < 5) { flash("Too tired to supervise", RED); return; }
  for (d = 0; d < NDEV; d++) {
    if (!canBuild(d)) { continue; }
    r = DR[d]; missing = false;
    for (i = 0; i < r.length; i++) {
      if ((G.inv[r[i][0]] || 0) < r[i][1]) { missing = true; break; }
    }
    if (!missing && (best < 0 || DP[d] > DP[best])) { best = d; }
  }
  if (best < 0) { flash("Helper: no parts ready", ORNG); return; }
  r = DR[best];
  for (i = 0; i < r.length; i++) { G.inv[r[i][0]] -= r[i][1]; }
  useEn(5); addMin(Math.floor(40 * buildTimeMul()));
  if (rnd() * 100 < buildChance() + 10) {
    G.dev[best]++; G.sx += 15 + 5 * DP[best];
    flash("Helper built " + DN[best], GREEN);
  } else {
    G.sx += 6;
    flash("Helper botched a joint", RED);
  }
  checkLevelUps();
}
function workbench() {
  var r, idx = 0, items, hints, k, d;
  while (true) {
    items = []; hints = [];
    for (k = 0; k < NDEV; k++) { d = ORD[k]; items.push((canBuild(d) ? "+ " : "- ") + DN[d]); hints.push("Power " + DP[d] + "   you own x" + G.dev[d] + "   SEL: see parts"); }
    if (G.crew) { items.push("Helper: build one"); hints.push("Crew builds best available device"); }
    r = menu("WORKBENCH", items, idx, hints);
    if (r < 0) { return; }
    idx = r;
    if (G.crew && r == items.length - 1) { crewBuildOnce(); continue; }
    recipeFlow(ORD[r]);
  }
}
function checkLevelUps() {
  var lh = lv(G.lastHx || 0), ls = lv(G.lastSx || 0), nh = lv(G.hx), ns = lv(G.sx), pts = 0;
  if (nh > lh) { pts += (nh - lh); }
  if (ns > ls) { pts += (ns - ls); }
  if (pts > 0) { G.sp = (G.sp || 0) + pts; flash("+" + pts + " skill point" + (pts > 1 ? "s" : "") + "!", CYAN); }
  G.lastHx = G.hx; G.lastSx = G.sx;
  checkTrophies();
}
function skillsMenu() {
  var r, idx = 0, items, hints, i;
  while (true) {
    items = []; hints = [];
    for (i = 0; i < 4; i++) {
      items.push(SKN[i] + " Lv" + skillLevel(i) + (G.sp > 0 ? "  [+]" : ""));
      hints.push(SKD[i] + "  Points left: " + (G.sp || 0));
    }
    r = menu("SKILLS  pts:" + (G.sp || 0), items, idx, hints);
    if (r < 0) { return; }
    idx = r;
    if ((G.sp || 0) <= 0) { flash("No points left", GRAY); continue; }
    G.sk[r]++; G.sp--; flash(SKN[r] + " -> " + skillLevel(r), GREEN);
  }
}
function nextGoalText() {
  var i;
  if (nMainDone() < NTG) {
    for (i = 0; i < NTG; i++) { if (!G.tg[i] && bestPower() >= (i + 1)) { return "Breach " + TN[i]; } }
    return "Build stronger device (need P" + (nMainDone() + 1) + ")";
  }
  for (i = NTG + NBT; i < NALL; i++) { if (!G.tg[i]) { return "Side: " + TN[i]; } }
  for (i = 0; i < UPN.length; i++) { if (!hasUp(i)) { return "Buy upgrade: " + UPN[i]; } }
  if (!(G.bi || 0)) { return "Break in + hack at night"; }
  return "All set. Finish it!";
}
function trophiesMenu() {
  var items = [], hints = [], i;
  for (i = 0; i < TRN.length; i++) {
    items.push((hasTrophy(i) ? "OK " : "-- ") + TRN[i]);
    hints.push(TRD[i]);
  }
  menu("TROPHIES", items, 0, hints);
}
function dailySummary() {
  if (!DAYSUM) { return; }
  popup([["DAY " + (DAYSUM.day) + " SUMMARY", 2, YEL],
    ["Earned  " + mny(DAYSUM.earn), 1, GREEN],
    ["Spent   " + mny(DAYSUM.spend), 1, ORNG],
    ["Heat " + Math.floor(G.heat) + "%   Energy " + Math.floor(G.en), 1, WHITE]], YEL);
  DAYSUM = null;
}
function sleepUntil(hour) {
  var m = G.min % 1440, add;
  add = (hour * 60 - m); if (add <= 0) { add += 1440; }
  if (G.dayEarn || G.daySpend) {
    DAYSUM = { day: dayOf(), earn: G.dayEarn || 0, spend: G.daySpend || 0 };
    G.dayEarn = 0; G.daySpend = 0;
  }
  addMin(add); G.en = 100; addHeat(-20);
  G.tired = 0; G.hung = Math.max(0, (G.hung || 0) - 25);
  crewDaily();
  checkLevelUps();
  dailySummary();
  if (CUR >= 0) {
    var wh = saveGame();
    flash(wh ? "Slept + autosaved" : "Slept. Fresh!", GREEN);
  } else {
    flash("Slept. Fresh!", GREEN);
  }
}
function sleepNow() { sleepUntil(7); }
function sleepMenu() {
  var r = menu("SLEEP", ["Sleep until " + hourStr(7), "Sleep until " + hourStr(12), "Sleep until " + hourStr(20), "Cancel"], 0,
    ["Morning rest (full energy)", "Wake up at noon", "Wake at 8 PM", "Stay up"]);
  if (r == 0) { sleepUntil(7); }
  else if (r == 1) { sleepUntil(12); }
  else if (r == 2) { sleepUntil(20); }
}
function robotShop() {
  var r, idx = 0, p, id;
  while (true) {
    r = menu("ROBOT SHOP " + mnyS(G.cash), [
      (G.robot >= 3) ? "AI Robots 3/3 OWNED" : ("Buy AI Robot #" + (G.robot + 1) + " " + mny(RB_PRICE[G.robot])),
      "Drone $" + price(42, 1),
      "Military Drone $" + price(43, 1),
      "Hacking Drone $" + price(44, 1),
      "Leave"
    ], idx, [
      (G.robot >= 3) ? "Max of 3 robots" : "Each robot has its own build list",
      "Civilian quadcopter", "Hardened combat-style drone", "Wi-Fi/BT recon drone", "Walk out"
    ]);
    if (r < 0 || r == 4) { return; }
    idx = r;
    if (r == 0) {
      if (G.robot >= 3) { flash("You own all 3", GRAY); continue; }
      p = RB_PRICE[G.robot];
      if (G.cash < p) { flash("Need " + mny(p), RED); continue; }
      G.cash -= p; G.robot++; ensureRobots(); G.daySpend = (G.daySpend || 0) + p;
      flash("Robot " + G.robot + " acquired!", GREEN);
    } else {
      id = 41 + r; /* 42,43,44 */
      p = price(id, 1);
      if (G.cash < p) { flash("Not enough cash", RED); continue; }
      G.cash -= p; G.inv[id] = (G.inv[id] || 0) + 1; G.daySpend = (G.daySpend || 0) + p;
      flash("Bought " + IN[id], GREEN);
    }
  }
}
function buildListMenu(k) {
  var r, idx = 0, items, hints, i, d;
  while (true) {
    items = ["Select all", "Clear list"]; hints = ["Robot may build every device", "Robot builds nothing"];
    for (i = 0; i < NDEV; i++) { d = ORD[i]; items.push((cbHas(k, d) ? "[x] " : "[ ] ") + DN[d]); hints.push("Power " + DP[d] + "   own x" + G.dev[d] + "   SEL: toggle"); }
    r = menu("ROBOT " + (k + 1) + " LIST " + cbSelCount(k) + "/" + NDEV, items, idx, hints);
    if (r < 0) { return; }
    idx = r;
    if (r == 0) { G.rb[k].sel = (1 << NDEV) - 1; }
    else if (r == 1) { G.rb[k].sel = 0; }
    else { G.rb[k].sel ^= (1 << ORD[r - 2]); }
  }
}
function robotMenu(k) {
  var r, idx = 0, items, hints, o, n, uc;
  while (true) {
    o = G.rb[k];
    uc = (o.lvl < RB_MAXL) ? RB_UP[o.lvl - 1] : 0;
    items = ["Build list " + cbSelCount(k) + "/" + NDEV,
      o.end > 0 ? ("Building: " + fmtLeft(o.end - G.min) + " left") : "Start build batch (10)",
      "Repeat batches: " + (o.rep ? "ON" : "OFF"),
      (o.lvl < RB_MAXL) ? ("Upgrade to L" + (o.lvl + 1) + " " + mnyS(uc)) : "Fully upgraded (L5)",
      (o.cond < 100) ? ("Service " + o.cond + "% " + mnyS(rbServiceCost(k))) : "Condition 100%", "Back"];
    hints = ["Pick what this robot may build",
      o.end > 0 ? (((o.q || "").split(";").length) + " devices in the oven") : ("Uses your parts. " + fmtLeft(rbMin(k)) + " per batch"),
      "Start the next batch by itself",
      (o.lvl < RB_MAXL) ? "Faster batches, +3% build chance" : "Maxed out",
      "Worn robots botch more builds", ""];
    r = menu("ROBOT " + (k + 1) + "  L" + o.lvl, items, idx, hints);
    if (r < 0 || r == 5) { return; }
    idx = r;
    if (r == 0) { buildListMenu(k); }
    else if (r == 1) {
      if (o.end > 0) { flash("Building: " + fmtLeft(o.end - G.min) + " left", ORNG); }
      else if (cbSelCount(k) == 0) { flash("Pick devices on the build list", ORNG); }
      else if (o.cond <= 0) { flash("Robot is broken: service it", RED); }
      else {
        n = cbPick(k, G.min);
        if (n == 0) { flash("Not enough parts for the list", RED); }
        else { flash("Robot " + (k + 1) + " building " + n + ": " + fmtLeft(rbMin(k)), GREEN); }
      }
    }
    else if (r == 2) { o.rep = o.rep ? 0 : 1; }
    else if (r == 3) {
      if (o.lvl >= RB_MAXL) { flash("Already level 5", GRAY); }
      else if (G.cash < uc) { flash("Need " + mny(uc), RED); }
      else if (confirm2("Upgrade robot " + (k + 1) + "?", "L" + (o.lvl + 1) + " for " + mny(uc), YEL)) {
        G.cash -= uc; G.daySpend = (G.daySpend || 0) + uc; o.lvl++; flash("Robot " + (k + 1) + " is now L" + o.lvl, GREEN);
      }
    }
    else {
      if (o.cond >= 100) { flash("Already in top shape", GRAY); }
      else if (G.cash < rbServiceCost(k)) { flash("Need " + mny(rbServiceCost(k)), RED); }
      else { G.cash -= rbServiceCost(k); G.daySpend = (G.daySpend || 0) + rbServiceCost(k); o.cond = 100; flash("Robot serviced", GREEN); }
    }
  }
}
function robotsMenu() {
  var r, k, items, hints, idx = 0, o;
  if (!G.robot) { flash("Buy a robot at the Robot shop ($25k)", ORNG); return; }
  ensureRobots();
  while (true) {
    items = []; hints = [];
    for (k = 0; k < G.robot; k++) {
      o = G.rb[k];
      items.push("Robot " + (k + 1) + "  L" + o.lvl + "  " + o.cond + "%");
      hints.push(o.end > 0 ? ("Building: " + fmtLeft(o.end - G.min) + " left") : ("Idle. List " + cbSelCount(k) + "/" + NDEV + (o.cond < 40 ? "  NEEDS SERVICE" : "")));
    }
    items.push("Back"); hints.push("");
    r = menu("AI ROBOTS " + G.robot + "/3", items, idx, hints);
    if (r < 0 || r == G.robot) { return; }
    idx = r; robotMenu(r);
  }
}
function haulCost(sel, qty) {
  var i, t = 0, n = 0;
  for (i = 0; i < NIT; i++) { if (sel[i]) { t += Math.max(1, Math.ceil(G.pr[i] * 0.5)) * qty; n += qty; } }
  return [t, n];
}
function haulMenu() {
  var r, i, items, hints, map, qty = 5, idx = 0, sel = [], tc, each, secs, pl;
  if (G.ccEnd > 0) { flash("Crew out: back in " + fmtLeft(G.ccEnd - G.min), ORNG); return; }
  for (i = 0; i < NIT; i++) { sel.push(false); }
  while (true) {
    tc = haulCost(sel, qty); secs = Math.min(4320, 36 * tc[1]);
    if (loyVal() >= 75) { secs = Math.floor(secs * 0.75); }
    items = ["Amount each: " + qty, "SEND CREW (" + tc[1] + " items)", "Clear marks"];
    hints = ["SEL cycles 1/5/10/20/25/30/40/50", tc[1] ? (mny(tc[0]) + ", gone " + fmtLeft(secs)) : "Mark parts below first", "Unmark everything"];
    map = [-1, -2, -3];
    for (i = 0; i < NIT; i++) {
      each = Math.max(1, Math.ceil(G.pr[i] * 0.5));
      items.push((sel[i] ? "[x] " : "[ ] ") + IN[i] + " " + mnyS(each)); hints.push("SEL marks it: " + mny(each * qty) + " for " + qty); map.push(i);
    }
    r = menu("HAUL " + mnyS(tc[0]) + "/" + mnyS(G.cash), items, idx, hints);
    if (r < 0) { return; }
    idx = r;
    if (r == 0) { qty = nextQty(qty); }
    else if (r == 1) {
      if (tc[1] == 0) { flash("Mark some parts first", ORNG); continue; }
      if (tc[0] > G.cash) { flash("Need " + mny(tc[0]), RED); continue; }
      if (confirm2("Send crew? " + tc[1] + " items", mny(tc[0]) + ", back in " + fmtLeft(secs), YEL)) {
        pl = [];
        for (i = 0; i < NIT; i++) { if (sel[i]) { pl.push(i + ":" + qty); } }
        G.cash -= tc[0]; G.daySpend = (G.daySpend || 0) + tc[0];
        G.ccL = pl.join(";"); G.ccQty = tc[1]; G.ccEnd = G.min + secs;
        flash("Crew is out on the haul", GREEN); return;
      }
    }
    else if (r == 2) { for (i = 0; i < NIT; i++) { sel[i] = false; } }
    else {
      i = map[r];
      if (!sel[i]) { sel[i] = true; if (haulCost(sel, qty)[0] > G.cash) { sel[i] = false; flash("Over budget", RED); } }
      else { sel[i] = false; }
    }
  }
}
function sellOrderMenu() {
  var r, n;
  r = menu("SELL STOCKPILE", SMODE, G.csMode,
    ["Stop selling", "Keeps 1 of each device", "Keeps 2 of each part (not build-list parts)", "Both, 10 items a game day"]);
  if (r < 0) { return; }
  if (r == 0) { G.csMode = 0; flash("Selling stopped", GRAY); return; }
  n = stockCount(r);
  if (n == 0) { flash("Nothing spare to sell", GRAY); return; }
  G.csMode = r; G.csDay = dayOf();
  flash(n + " items: about " + Math.ceil(n / CS_PERDAY) + " game days", GREEN);
}
function tipMenu() {
  var r, amt, gain, tips = [50, 200, 500], gains = [10, 30, 60];
  r = menu("TIP HELPER " + mnyS(G.cash), ["Tip $50 (+10)", "Tip $200 (+30)", "Tip $500 (+60)", "Back"], 0,
    ["Loyalty " + loyVal() + "/100 " + loyName(), "Loyal helpers work faster", "Devoted at 75+: double pay", ""]);
  if (r < 0 || r >= 3) { return; }
  amt = tips[r]; gain = gains[r];
  if (loyVal() >= 100) { flash("Already fully loyal", GRAY); return; }
  if (G.cash < amt) { flash("Need " + mny(amt), RED); return; }
  G.cash -= amt; G.daySpend = (G.daySpend || 0) + amt; G.loy = Math.min(100, loyVal() + gain);
  flash("Loyalty " + G.loy + " - " + loyName(), GREEN);
}
function crewMenu() {
  var r, idx = 0, items, hints;
  if (!G.crew) {
    r = menu("HIRE CREW", ["Hire helper $" + CREW_FEE + "/day", "Not now"], 0,
      ["Passive cash + heat cool, plus crew missions", "Maybe later"]);
    if (r == 0) {
      if (G.cash < CREW_FEE) { flash("Need " + mny(CREW_FEE), RED); return; }
      G.cash -= CREW_FEE; G.crew = 1; G.loy = 50; G.crewday = dayOf(); G.daySpend = (G.daySpend || 0) + CREW_FEE;
      unlockTrophy(6); flash("Crew hired!", GREEN);
    }
    if (!G.crew) { return; }
  }
  while (true) {
    items = ["AI robots " + (G.robot || 0) + "/3",
      G.ccEnd > 0 ? ("Out hauling: " + fmtLeft(G.ccEnd - G.min) + " left") : "Collect: big haul",
      "Sell: " + SMODE[G.csMode || 0], "Tip helper: " + loyName(), "Fire the helper", "Back"];
    hints = [(G.robot || 0) ? "Build lists, upgrades, service" : "Buy robots at the Robot shop ($25k)",
      G.ccEnd > 0 ? (G.ccQty + " items on the way") : "Mark parts, crew buys at half price",
      "10 items per game day", "Loyalty " + loyVal() + "/100. Falls 4 a day", "", ""];
    r = menu("CREW MISSIONS", items, idx, hints);
    if (r < 0 || r == 5) { return; }
    idx = r;
    if (r == 0) { robotsMenu(); }
    else if (r == 1) { haulMenu(); }
    else if (r == 2) { sellOrderMenu(); }
    else if (r == 3) { tipMenu(); }
    else if (confirm2("Fire the helper?", "Stops the sell order", ORNG)) { G.crew = 0; G.csMode = 0; flash("Crew dismissed", GRAY); return; }
  }
}
/* ---- lock pick screen: static art is drawn once, only tiny areas update (no flicker) ---- */
var LP_BR = rgb(176, 140, 60), LP_BRD = rgb(110, 84, 30), LP_STL = rgb(205, 208, 220), LP_PX = [160, 216, 272], LP_PK = 0;
function lpTile(x0, x1, bx, bw, by, zx, zone, bgc) {
  var a, b;
  if (x0 < 0) { x0 = 0; }
  if (x1 > W) { x1 = W; }
  if (x1 <= x0) { return; }
  fr(x0, by - 4, x1 - x0, 26, bgc);
  if (x0 < bx) { x0 = bx; }
  if (x1 > bx + bw) { x1 = bx + bw; }
  if (x1 <= x0) { return; }
  fr(x0, by, x1 - x0, 16, rgb(30, 30, 40));
  a = Math.max(x0, zx); b = Math.min(x1, zx + zone);
  if (b > a) { fr(a, by, b - a, 16, rgb(40, 170, 80)); }
  fr(x0, by, x1 - x0, 1, GRAY); fr(x0, by + 15, x1 - x0, 1, GRAY);
  if (x0 == bx) { fr(bx, by, 1, 16, GRAY); }
  if (x1 == bx + bw) { fr(bx + bw - 1, by, 1, 16, GRAY); }
}
function lpFace(open) {
  fr(14, 34, 92, 56, LP_BR); rc(14, 34, 92, 56, LP_BRD); rc(15, 35, 90, 54, rgb(214, 180, 96));
  ci(21, 41, 2, LP_BRD); ci(99, 41, 2, LP_BRD); ci(21, 83, 2, LP_BRD); ci(99, 83, 2, LP_BRD);
  ci(60, 58, 12, LP_BRD);
  if (open) {
    ci(52, 58, 5, BLACK); fr(52, 56, 18, 5, BLACK);
  } else {
    ci(60, 52, 5, BLACK); fr(58, 54, 5, 17, BLACK);
    fr(48, 70, 16, 3, LP_STL); fr(48, 70, 3, 10, LP_STL);
    fr(64, 52, 8, 2, LP_STL);
  }
}
function lpFacePick(w) {
  var k, sl = w ? 1 : 2, ye;
  fr(72, 36, 32, 28, LP_BR);
  ci(99, 41, 2, LP_BRD);
  for (k = 0; k < 7; k++) { fr(72 + k * 4, 52 - k * sl, 4, 2, LP_STL); }
  ye = 52 - 7 * sl;
  fr(98, ye - 2, 5, 5, rgb(90, 60, 40));
}
function lpCol(j, st, wig, cur) {
  var cx = LP_PX[j], x0 = cx - 9, dy, dcol;
  fr(x0, 34, 18, 23, rgb(70, 74, 86));
  fr(x0, 57, 18, 33, rgb(110, 114, 128));
  fr(x0, 57, 18, 1, rgb(230, 200, 60));
  fr(x0, 70, 18, 8, rgb(8, 8, 12));
  dy = (st == 1) ? 0 : 6;
  if (cur && st == 0 && wig) { dy = 4; }
  dcol = (st == 1) ? rgb(60, 200, 100) : ((st == 2) ? rgb(220, 70, 60) : rgb(214, 180, 96));
  fr(cx - 1, 36, 2, 45 + dy - 36, rgb(150, 150, 160));
  fr(cx - 6, 45 + dy, 12, 12, dcol);
  fr(cx - 5, 57 + dy, 10, 11, LP_STL);
  if (LP_PK > x0) { fr(x0, 75, Math.min(x0 + 18, LP_PK) - x0, 2, LP_STL); }
  if (cur) { fr(cx + 2, 71, 3, 6, LP_STL); fr(cx - 3, 84, 6, 2, YEL); }
}
function lpCutaway() {
  fr(122, 34, 190, 23, rgb(70, 74, 86));
  fr(122, 57, 190, 33, rgb(110, 114, 128));
  fr(122, 57, 190, 1, rgb(230, 200, 60));
  fr(122, 70, 190, 8, rgb(8, 8, 12));
  rc(122, 34, 190, 56, rgb(30, 32, 40));
  fr(124, 79, 26, 3, LP_STL); fr(124, 79, 3, 9, LP_STL);
}
function lockpickGame(title) {
  var hits = 0, pins = 3, j, i, pos, dir, zone, zx, bx = 40, bw = 240, by = 98, ox, oox, k, hit, sp, frames, bgc, st = [0, 0, 0], wig, hb = rgb(40, 50, 70), bail = false;
  bgc = rgb(12, 14, 20);
  title = title || "LOCK JOB";
  menuMode();
  settleInput();
  cls(bgc);
  fr(0, 0, W, 18, hb); txt(title, 6, 5, 1, CYAN);
  txt("SEL = set the pin     ESC = bail", 6, 22, 1, WHITE);
  lpFace(false); lpCutaway();
  LP_PK = 0;
  for (j = 0; j < pins && !bail; j++) {
    fr(236, 2, 80, 14, hb); txt("PIN " + (j + 1) + "/" + pins, 262, 5, 1, YEL);
    fr(60, 118, 200, 24, bgc);
    LP_PK = LP_PX[j] + 4;
    for (i = 0; i < pins; i++) { lpCol(i, st[i], false, i == j); }
    lpFacePick(false);
    zone = 28 + skillLevel(2) * 3; if (zone > 56) { zone = 56; }
    zx = bx + ri(20, bw - zone - 20);
    lpTile(bx - 2, bx + bw + 3, bx, bw, by, zx, zone, bgc);
    pos = 0; dir = 1; sp = 3; hit = false; ox = bx; frames = 0; wig = false;
    fr(ox - 1, by - 3, 3, 22, WHITE);
    while (!hit && frames < 600) {
      frames++;
      pos += dir * sp;
      if (pos >= bw) { pos = bw; dir = -1; } else if (pos <= 0) { pos = 0; dir = 1; }
      oox = ox; ox = bx + pos;
      if (ox != oox) { lpTile(oox - 2, oox + 3, bx, bw, by, zx, zone, bgc); }
      fr(ox - 1, by - 3, 3, 22, WHITE);
      if (frames % 5 == 0) { wig = !wig; lpCol(j, 0, wig, true); lpFacePick(wig); }
      k = inp();
      if (k == 3) {
        hit = true;
        if (ox >= zx && ox <= zx + zone) {
          hits++; st[j] = 1;
          fr(ox - 1, by - 3, 3, 22, GREEN);
          lpCol(j, 1, false, false);
          txt("CLICK", 140, 120, 2, GREEN);
        } else {
          st[j] = 2;
          fr(ox - 1, by - 3, 3, 22, RED);
          lpCol(j, 2, false, false);
          txt("MISS", 145, 120, 2, RED);
        }
      } else if (k == 4) {
        hit = true; bail = true;
        txt("BAILED", 140, 120, 2, ORNG);
      }
      wait(14);
    }
    if (!hit) {
      st[j] = 2; lpCol(j, 2, false, false);
      txt("TOO SLOW", 120, 120, 2, ORNG);
    }
    wait(350);
    settleInput();
  }
  if (hits >= pins) {
    lpFace(true);
    fr(60, 118, 200, 24, bgc); txt("OPEN!", 130, 120, 2, GREEN);
    wait(600);
  }
  menuMode();
  return hits;
}
function lockService() {
  var r, pay, hits;
  r = menu("LOCK SERVICE", ["Buy lock picks $30", "Take a lock job", "Leave"], 0,
    ["Needed for lock jobs", "Timing mini-game, cash reward", ""]);
  if (r < 0 || r == 2) { return; }
  if (r == 0) {
    if (G.cash < 30) { flash("Need $30", RED); return; }
    G.cash -= 30; G.inv[39] = (G.inv[39] || 0) + 1; G.daySpend = (G.daySpend || 0) + 30;
    flash("Got lock picks", GREEN);
    return;
  }
  if ((G.inv[39] || 0) < 1) { flash("Need lock picks", ORNG); return; }
  if (G.en < 8) { flash("Too tired", RED); return; }
  G.inv[39]--; useEn(8); addMin(20);
  hits = lockpickGame("LOCK JOB");
  if (hits >= 3) {
    pay = 120 + ri(0, 80) + skillLevel(2) * 20;
    G.cash += pay; G.dayEarn = (G.dayEarn || 0) + pay;
    flash("Picked! +" + mny(pay), GREEN);
  } else if (hits == 2) {
    pay = 40 + ri(0, 30);
    G.cash += pay; G.dayEarn = (G.dayEarn || 0) + pay;
    flash("Almost... +" + mny(pay), YEL);
  } else {
    addHeat(6);
    flash("Broken pick. Heat up.", RED);
  }
}
function informantMenu() {
  var r, t, cost = 80 - skillLevel(3) * 8, items = [], hints = [], map = [], i;
  if (G.tipday == dayOf() && G.tip) {
    for (i = 0; i < 3; i++) { if (G.tip[i] >= 0) { flash("Already have tips today", GRAY); return; } }
  }
  for (i = 0; i < NALL; i++) {
    if (visT(i) && !G.tg[i] && !G.rc[i]) { map.push(i); items.push(TN[i]); hints.push("Widen zone for " + mny(cost)); }
  }
  if (items.length == 0) { flash("No targets need tips", GRAY); return; }
  r = menu("INFORMANT " + mnyS(G.cash), items, 0, hints);
  if (r < 0) { return; }
  if (G.cash < cost) { flash("Need " + mny(cost), RED); return; }
  t = map[r]; G.cash -= cost; G.daySpend = (G.daySpend || 0) + cost;
  G.rc[t] = 1; G.tipday = dayOf();
  if (!G.tip) { G.tip = [-1, -1, -1]; }
  G.tip[0] = t;
  flash("Tip received: " + TN[t], GREEN);
}
function homeMenu() {
  var r, idx = 0, items, hints, wh;
  while (true) {
    items = ["Workbench", "3D print cases", "Upgrades", "Skills" + ((G.sp || 0) > 0 ? " (" + G.sp + ")" : ""), "Sleep...",
      "Crew missions", "Inventory", "Trophies",
      "Save game", "Save and exit", "Quit, no save",
      "Clock: " + (CLK12 ? "12 hr" : "24 hr")];
    hints = ["Build pentest devices", (G.printer || 0) ? ((G.printer || 0) + " printer(s): 3 cases each per run") : "Needs a 3D printer from hardware", "Install permanent boosts",
      "Spend skill points (no cap)", "Sleep until morning, noon or 8 PM",
      "Helper, robots, hauls, selling, tips",
      "What you carry", "Your achievements",
      "Pick a slot and name it", "Save, then close the game", "Leave without saving",
      "SEL toggles 12 / 24 hour clock"];
    r = menu("SAFEHOUSE", items, idx, hints);
    if (r < 0) { return; }
    idx = r;
    if (r == 0) { workbench(); }
    else if (r == 1) { print3d(); }
    else if (r == 2) { upgradesMenu(); }
    else if (r == 3) { skillsMenu(); }
    else if (r == 4) { sleepMenu(); }
    else if (r == 5) { crewMenu(); }
    else if (r == 6) { invMenu(); }
    else if (r == 7) { trophiesMenu(); }
    else if (r == 8) { saveFlow(); menuMode(); }
    else if (r == 9) {
      if (CUR < 0) { if (!saveFlow()) { continue; } }
      else {
        wh = saveGame();
        flash(wh == "" ? "SAVE FAILED!" : ("Saved: " + CURNAME), wh == "" ? RED : GREEN);
        if (wh == "") { continue; }
      }
      QUITALL = true; LEAVE = true; return;
    }
    else if (r == 10) {
      if (confirm2("Quit without saving?", "Progress since last save is lost", RED)) { LEAVE = true; return; }
    }
    else { CLK12 = !CLK12; saveCfg(); }
  }
}

/* ==========================================================
   INVENTORY / STATS / TARGETS
   ========================================================== */
function invMenu() {
  var r, idx = 0, items, hints, i;
  while (true) {
    r = menu("INVENTORY", ["Parts", "Devices", "Tools"], idx, ["Everything in your bag", "Pentest gear you built", "Iron and meter"]);
    if (r < 0) { return; }
    idx = r;
    items = []; hints = [];
    if (r == 0) {
      for (i = 0; i < NIT; i++) { if (G.inv[i] > 0) { items.push(IN[i] + " x" + G.inv[i]); hints.push(IDS[i]); } }
      if (items.length == 0) { flash("No parts yet", GRAY); } else { menu("PARTS", items, 0, hints); }
    } else if (r == 1) {
      for (i = 0; i < NDEV; i++) { if (G.dev[i] > 0) { items.push(DN[i] + " x" + G.dev[i]); hints.push("Power " + DP[i]); } }
      if (items.length == 0) { flash("Nothing built yet", GRAY); } else { menu("DEVICES", items, 0, hints); }
    } else {
      popup([["TOOLS", 2, YEL], ["Soldering iron: " + (G.iron ? "YES" : "no"), 1, G.iron ? GREEN : RED], ["Multimeter: " + (G.meter ? "YES" : "no"), 1, G.meter ? GREEN : GRAY]], YEL);
    }
  }
}
function statsScreen() {
  popup([["STATS", 2, YEL], ["Hack LV " + lv(G.hx) + "   Solder LV " + lv(G.sx), 1, WHITE], ["Best device power: " + bestPower() + "   Targets: " + nDone() + "/" + NTG + "  Side: " + nSideDone() + "/" + NSD, 1, WHITE], ["Bank " + mny(G.bank) + "   Heat " + Math.floor(G.heat) + "%", 1, ORNG]], YEL);
}
function targetList() {
  var items = [], hints = [], i, cnt = 0;
  for (i = 0; i < NALL; i++) {
    if (!visT(i)) { continue; }
    cnt++;
    items.push((G.tg[i] ? "OK " : "-- ") + TN[i] + ((G.rv[i] && !G.tg[i]) ? " *" : "") + (i >= NTG + NBT ? " [S]" : (i >= NTG ? " [B]" : "")));
    hints.push("Needs power " + TREQ[i] + "  pays " + mnyS(targetPay(i)) + (G.tg[i] ? " (repeat 35%)" : ((G.rv[i]) ? " *rival tagged" : "")));
  }
  menu("TARGETS " + (nDone() + nSideDone()) + "/" + cnt, items, 0, hints);
}

/* ==========================================================
   BREACH MINI-GAME  (pure arcade - nothing real in here)
   ========================================================== */
function hackBg(title, stage, trace) {
  cls(rgb(0, 8, 2)); fr(0, 0, W, 18, rgb(0, 70, 30));
  txt(title, 6, 5, 1, MATG); txt("TRACE " + trace + "%", 244, 5, 1, trace > 55 ? RED : YEL);
  ctxt(stage, 26, 2, GREEN);
}
function noise(y0) {
  var i, s;
  for (i = 0; i < 4; i++) {
    s = "";
    while (s.length < 38) { s += String(ri(0, 9)) + (rnd() < 0.5 ? "A" : "F"); }
    txt(s, 8, y0 + i * 10, 1, rgb(0, 70 + i * 15, 30));
  }
}
function barCol(bx, by, bw, zx, zw, ox) {
  var a = ox - 2, b = ox + 3, za, zb;
  if (a < bx) { a = bx; } if (b > bx + bw) { b = bx + bw; }
  fr(ox - 2, by - 4, 5, 4, LBG); fr(ox - 2, by + 22, 5, 4, LBG);
  if (b > a) {
    fr(a, by, b - a, 22, rgb(10, 40, 10));
    za = Math.max(a, zx); zb = Math.min(b, zx + zw);
    if (zb > za) { fr(za, by, zb - za, 22, rgb(30, 160, 60)); }
  }
}
function timingBar(title, stage, trace, zw, sp) {
  var bx = LBX, bw = LBW, by = LBY, pos = 0, dir = 1, zx, k, fr2 = 0, ox, hit = false, res = false;
  ox = bx;
  zx = bx + ri(12, bw - zw - 12);
  hackBg(title, stage, trace); noise(116);
  fr(bx, by, bw, 22, rgb(10, 40, 10)); fr(zx, by, zw, 22, rgb(30, 160, 60)); rc(bx - 1, by - 1, bw + 2, 24, GREEN);
  ctxt("SEL when the line is in the zone", LTY, 1, MATG);
  settleInput(); walkMode();
  while (!hit) {
    barCol(bx, by, bw, zx, zw, ox);
    pos += dir * sp;
    if (pos >= bw) { pos = bw; dir = -1; } else if (pos <= 0) { pos = 0; dir = 1; }
    ox = bx + pos;
    fr(ox - 1, by - 4, 3, 30, WHITE);
    k = inp();
    if (k == 3) { hit = true; res = (ox >= zx && ox <= zx + zw); }
    else if (k == 4) { hit = true; res = false; }
    fr2++; if (fr2 > 700) { hit = true; res = false; }
    wait(14);
  }
  fr(ox - 1, by - 4, 3, 30, res ? GREEN : RED);
  wait(450);
  return res;
}
function seqGame(title, stage, trace, n, showMs) {
  var seq = [], i, k, ok = true;
  for (i = 0; i < n; i++) { seq.push(ri(0, 1)); }
  hackBg(title, stage, trace); noise(116);
  ctxt("Memorize the knob turns!", LTY, 1, MATG);
  settleInput(); wait(500);
  for (i = 0; i < n; i++) {
    fr(LAX, LAYR, LAW, LAH, LBG);
    ctxt(seq[i] == 0 ? ">" : "<", LAY, LAS, GREEN);
    wait(showMs);
    fr(LAX, LAYR, LAW, LAH, LBG); wait(140);
  }
  fr(LCX, LCY, LCW, LCH, LBG);
  ctxt("NOW REPEAT: turn the knob", LTY, 1, YEL);
  walkMode(); drainEnc();
  for (i = 0; i < n && ok; i++) {
    k = 0;
    while (k != 1 && k != 2 && k != 4) { k = inp(); wait(12); }
    if (k == 4 || k - 1 != seq[i]) { ok = false; }
    else { fr(LPX + i * LPS, LPY, LPW, LPH, GREEN); }
  }
  if (!ok) { fr(LPX, LPY, LFW, LPH, RED); }
  wait(500);
  return ok;
}
function breach(t) {
  var dif = TREQ[t] || (t + 1), skill = lv(G.hx), pw = bestPower(), passes = 0, zone, trace = 5, ok, title = "BREACH: " + TN[t], n;
  zone = 38 - dif * 2 + skill * 2 + (pw - dif) * 3 + (G.rc[t] ? 10 : 0) + (PH == 2 ? 6 : 0) + (G.inv[33] > 0 ? 6 : 0) + (hasUp(0) ? 4 : 0) + ((hasUp(4) && PH == 2) ? 6 : 0) - (G.en < 25 ? 10 : 0);
  if (zone < 14) { zone = 14; } if (zone > 72) { zone = 72; }
  ok = timingBar(title, "1/3  SCAN", trace, zone, 3 + Math.floor(dif / 2));
  if (ok) { passes++; } else { trace += 30; }
  n = 3 + Math.floor(dif / 2); if (n > 8) { n = 8; }
  ok = seqGame(title, "2/3  CRACK", trace, n, Math.max(260, 520 - dif * 25));
  if (ok) { passes++; } else { trace += 30; }
  ok = timingBar(title, "3/3  COVER TRACKS", trace, Math.max(12, zone - 6), 4 + Math.floor(dif / 2));
  if (ok) { passes++; } else { trace += 30; }
  return passes;
}
function arrest() {
  var loss = Math.floor(G.cash * 0.3);
  redrawAll(); arrestScene(); menuMode();
  G.cash -= loss; addMin(1440); G.heat = 30; G.en = Math.max(G.en, 40);
  G.arrests = (G.arrests || 0) + 1;
  pop("BUSTED!", "Questioned all night. Fined " + mny(loss), "You are out, heat cooled to 30%", RED);
}
function breakIn(t) {
  var r, hits;
  r = menu(TN[t] + " CLOSED", ["Pick the lock", "Leave"], 0,
    ["Needs 1 lock pick. Hack inside: +50% pay", "Open again at " + hourStr(6)]);
  if (r != 0) { return false; }
  if ((G.inv[39] || 0) < 1) { pop("No lock picks", "Buy picks at the Lock Service", "Needed to break in after hours", ORNG); return false; }
  if (G.en < 8) { flash("Too tired", RED); return false; }
  G.inv[39]--; useEn(8); addMin(20);
  hits = lockpickGame("BREAK IN: " + TN[t]);
  if (hits >= 3) { addHeat(3); flash("You are in!", GREEN); return true; }
  addHeat(hits == 2 ? 6 : 10);
  pop(hits == 2 ? "Lock jammed" : "Pick snapped", hits == 2 ? "So close. The pick is stuck" : "An alarm clicked on. Heat up", "Try again with a fresh pick", RED);
  return false;
}
function doTarget(t) {
  var r, pw = bestPower(), dif = TREQ[t] || (t + 1), cool, pay, passes, brk = 0;
  menuMode();
  if (t >= NTG && t < NTG + NBT && !bonusUnlocked()) { pop("LOCKED", "Clear the Power Grid first", "Bonus targets unlock after", ORNG); return; }
  if (pw < dif) { pop(TN[t], "Needs a device of power " + dif + "+", "Best you own: power " + pw, ORNG); return; }
  cool = G.tg[t] && (G.min - G.tgT[t] < 2880);
  r = menu(TN[t], ["Launch breach", "Recon (1h)", "Target info"], 0, ["1 LiPo, 1-2h, -15 energy. 2 hacks a day", G.rc[t] ? "Recon done: wider zone" : "Study it first: wider timing zone", "Pays " + mnyS(targetPay(t)) + (cool ? "  (on alert)" : "") + ((G.rv[t] && !G.tg[t]) ? "  (rival tagged)" : "")]);
  if (r < 0) { return; }
  if (r == 2) { pop(TN[t], "Difficulty " + dif + "   Pays " + mny(targetPay(t)), G.tg[t] ? "Already hacked - repeat pays 35%" : (G.rv[t] ? "NULLBYTE tagged it: payout cut to 60%" : "Not hacked yet"), MATG); return; }
  if (r == 1) {
    if (G.en < 10) { flash("Too tired!", RED); return; }
    addMin(60); useEn(5); G.rc[t] = 1; flash("Recon done!", GREEN); return;
  }
  if (cool) { pop("ON HIGH ALERT", "Wait 2 days after the last hack", "Come back later", ORNG); return; }
  if (hacksToday() >= 2) { pop("LAYING LOW", "Two big hacks per day", "Sleep, then try tomorrow", ORNG); return; }
  if (G.inv[8] < 1) { pop("No battery!", "You need 1 LiPo Battery per breach", "Buy one at Byte Barn", ORNG); return; }
  if (G.en < 15) { pop("Too tired", "Eat or sleep before a breach", "Energy under 15", ORNG); return; }
  if (!confirm2("Start the breach?", "Fail = heat. Too much heat = busted", YEL)) { return; }
  if (tgtClosed()) { if (!breakIn(t)) { return; } brk = 1; }
  if (!(hasUp(1) && rnd() < 0.3)) { G.inv[8]--; }
  addMin(60 + dif * 8); useEn(15);
  passes = breach(t);
  G.rc[t] = 0; menuMode();
  pay = targetPay(t);
  if (brk) { pay = Math.floor(pay * 1.5); }
  if (PH == 2) { G.nightHacks = (G.nightHacks || 0) + 1; }
  if (brk && passes >= 2) { G.bi = (G.bi || 0) + 1; }
  checkLevelUps();
  if (passes == 3) {
    G.cash += pay; G.dayEarn = (G.dayEarn || 0) + pay; addHeat(heatAdj(6)); G.hx += 30 + dif * 10;
    if (!G.tg[t]) { G.tg[t] = 1; }
    G.tgT[t] = G.min;
    pop("CLEAN HACK!", "+" + mny(pay) + (brk ? "  B&E bonus" : ""), TFLV[t] || "Systems owned.", GREEN);
  } else if (passes == 2) {
    pay = Math.floor(pay * 0.6); G.cash += pay; G.dayEarn = (G.dayEarn || 0) + pay; addHeat(heatAdj(20)); G.hx += 15 + dif * 5;
    if (!G.tg[t]) { G.tg[t] = 1; }
    G.tgT[t] = G.min;
    pop("SLOPPY HACK", "In and out: +" + mny(pay) + (brk ? " (B&E)" : ""), "Heat rising...", YEL);
  } else {
    addHeat(heatAdj(passes == 1 ? 25 : 35)); G.hx += 8;
    pop("BREACH FAILED", "They noticed you!", "Heat " + Math.floor(G.heat) + "%", RED);
    if (rnd() * 100 < G.heat) { arrest(); }
  }
  if (allWon()) { G.over = 1; }
}

/* ==========================================================
   STREET LIFE
   ========================================================== */
function patrol() {
  var cost = Math.max(40, Math.floor(G.cash * 0.1 * charmMul())), r, fine;
  r = menu("PATROL!", ["Bribe " + mny(cost), "Run for it", "Stay calm"], 0, ["Pay them off: heat -25", "50% - fail = fined, heat up", "Works better with low heat"]);
  if (r == 0 && G.cash >= cost) { G.cash -= cost; G.daySpend = (G.daySpend || 0) + cost; addHeat(-25); flash("They walk away", GREEN); }
  else if (r == 1 || r == 0) {
    if (rnd() < 0.5 + luckBonus()) { addHeat(-10); flash("You lost them!", GREEN); }
    else { fine = Math.floor(G.cash * 0.15); G.cash -= fine; addHeat(10); pop("Caught!", "Fined " + mny(fine), "Heat up", RED); }
  } else {
    if (rnd() * 100 < 70 - G.heat / 2 + skillLevel(3) * 5) { flash("Nothing to see here", GREEN); }
    else { fine = Math.floor(G.cash * 0.05); G.cash -= fine; addMin(180); pop("Questioned", "3 hours lost, fined " + mny(fine), "", ORNG); }
  }
}
function streetEvent() {
  var r = rnd(), id, p, loss;
  menuMode();
  if (G.heat > 60 && r < 0.35) { patrol(); }
  else if (r < 0.22) { p = ri(5, 45); G.cash += p; flash("Found " + mny(p), GREEN); }
  else if (r < 0.36) { id = pickCheap(); G.inv[id]++; pop("Dumpster find!", "You grabbed a " + IN[id], "Free part added to your bag", GREEN); }
  else if (r < 0.46) {
    id = pickGood(); p = Math.max(1, Math.floor(G.pr[id] * 0.4));
    if (confirm2("Swap meet deal!", IN[id] + " for " + mny(p) + " (60% off)", YEL)) {
      if (G.cash >= p) { G.cash -= p; G.inv[id]++; flash("Deal!", GREEN); } else { flash("Not enough cash", RED); }
    }
  }
  else if (r < 0.52 && G.cash > 150) { loss = Math.floor(G.cash * 0.05); G.cash -= loss; pop("Pickpocket!", "Lost " + mny(loss), "Keep your hand on the wallet", RED); }
  else if (r < 0.58) { G.en = Math.min(100, G.en + 10); flash("Free coffee +10", GREEN); }
  else if (r < 0.68 && nRival() > 0) { rivalEvent(); }
  walkMode();
}
function passOut() {
  var loss = Math.min(G.cash, Math.floor(G.cash * 0.05));
  menuMode(); G.cash -= loss; addMin(480); G.en = 60;
  pop("You collapsed!", "Slept on a bench 8 hours", "Lost " + mny(loss) + " - eat and sleep!", RED);
  walkMode();
}

/* ==========================================================
   TRAVEL
   ========================================================== */
function busAnim(to) {
  var i;
  var tn = sceneTone();
  menuMode(); cls(tn == 1 ? rgb(96, 160, 232) : (tn == 2 ? rgb(130, 112, 170) : (tn == 3 ? rgb(110, 60, 100) : rgb(8, 10, 30))));
  ctxt("Heading to " + LOCN[to], 40, 2, tn == 1 ? BLACK : WHITE);
  fr(60, 90, 200, 6, rgb(30, 30, 50));
  for (i = 0; i < 20; i++) { fr(60, 90, i * 10 + 10, 6, CYAN); wait(40); }
}
function travelMenu() {
  var items = [], hints = [], map = [], i, r, cost, mins, shops;
  cost = (G.cash >= 3) ? 3 : 0; mins = cost ? 25 : 90;
  for (i = 0; i < LOCN.length; i++) {
    if (i == G.loc) { continue; }
    map.push(i);
    items.push(LOCN[i]);
    shops = locShops(i);
    hints.push((cost ? "$3 bus · " : "walk · ") + shops);
  }
  r = menu("TRAVEL", items, 0, hints);
  if (r < 0) { return; }
  busAnim(map[r]);
  G.cash -= cost; addMin(mins);
  enterTown(map[r]);
}
function enterTown(loc) {
  G.loc = loc; PH = phaseNow(); PX = 22; PF = 1; PWK = 0; WACC = 0; SHOWSP = true; MB = 0;
  ST_ON = false; STX2 = -80; STRL = null; ST_COOL = 30;
}

/* ==========================================================
   SPOTS
   ========================================================== */
function nearSpot() {
  var sp = SP[G.loc], i;
  for (i = 0; i < sp.length; i++) { if (Math.abs(PX - sp[i][0]) <= 20) { return i; } }
  return -1;
}
function prompt(ns) {
  var s, t;
  if (ns < 0) {
    if (ST_ON && STKIND == 0 && Math.abs(Math.floor(STX2) - PX) < 50) { bar("SEL: Hail this car for a ride", CYAN); }
    else if (PROFANE && ST_ON && STKIND != 0 && Math.abs(Math.floor(STX2) - PX) < 48) { bar("SEL: Fight pedestrian (attack & rob)", ORNG); }
    else if (ST_ON && STKIND != 0 && Math.abs(Math.floor(STX2) - PX) < 48) { bar("SEL: Talk to pedestrian", GRAY); }
    else { bar("Turn knob: walk   SEL: act   ESC: menu", GRAY); }
    return;
  }
  s = SP[G.loc][ns]; t = s[1];
  if (!isOpen(t)) { bar(lockText(t), ORNG); return; }
  if (t == T_TGT) { bar("SEL: " + TN[s[2]] + (G.tg[s[2]] ? " (done)" : "") + (tgtClosed() ? " [CLOSED]" : ""), PINK); }
  else if (t == T_BOOTH) { bar("SEL: Phone booth (" + phLeft() + " calls left today)", SCB[t]); }
  else if (t == T_CAFE) { bar("SEL: Cafe (open 24/7)", SCB[t]); }
  else { bar("SEL: " + SNAME[t], SCB[t]); }
}
function doSpot(ns) {
  var s = SP[G.loc][ns], t = s[1];
  menuMode();
  if (!isOpen(t)) { flash(lockText(t), ORNG); walkMode(); return; }
  if (t == T_HOME) { homeMenu(); }
  else if (t == T_BANK) { bank(); }
  else if (t == T_TGT) { doTarget(s[2]); }
  else if (t == T_TRAVEL) { travelMenu(); }
  else if (t == T_ELEC) { shopBuy("ELECTRONICS", [0, 34, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 28, 29, 30, 31, 32, 33, 41], 1.0); }
  else if (t == T_PAWN) { pawn(); }
  else if (t == T_LIB) { library(); }
  else if (t == T_CAFE) { cafe(); }
  else if (t == T_HARD) { shopBuy("HARDWARE", [-1, -2, -3, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 35, 36, 37, 38, 40], 1.0); }
  else if (t == T_SCRAP) { scrap(s[2]); }
  else if (t == T_BM) { blackMarket(); }
  else if (t == T_GARAGE) { garage(); }
  else if (t == T_BOOTH) { phoneBooth(); }
  else if (t == T_SUPPLY) { shopBuy("SUPPLY STORE", [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 35, 36, 37, 38, 39, 40, 41], 0.95); }
  else if (t == T_ROBOT) { robotShop(); }
  else if (t == T_LOCK) { lockService(); }
  else if (t == T_CORNER) { cornerStore(); }
  walkMode();
}

/* ==========================================================
   MENUS + LOOP
   ========================================================== */
function howTo() {
  popup([["HOW TO PLAY", 2, MATG], ["Turn knob = walk  SEL = act", 1, WHITE], ["Green arrow shop, pink target", 1, WHITE], ["cyan bus, yellow safehouse", 1, WHITE]], MATG);
  popup([["THE PLAN", 2, MATG], ["Buy parts, solder devices", 1, WHITE], ["at your safehouse workbench", 1, WHITE], ["Better device = harder target", 1, WHITE]], MATG);
  popup([["BREACH GAME", 2, MATG], ["Stop the line in the zone,", 1, WHITE], ["repeat knob turns, stop again", 1, WHITE], ["Mess up = heat. Heat = busted", 1, WHITE]], MATG);
  popup([["PHONE BOOTH", 2, ORNG], ["Orange arrow: payphone", 1, WHITE], ["SEL = free $1,500 (3 calls a day)", 1, WHITE], ["If you have heat call a cab $100", 1, WHITE]], ORNG);
  popup([["CITY HUSTLE", 2, YEL], ["Cafe: contract board, 3 a day", 1, WHITE], ["Safehouse: permanent upgrades", 1, WHITE], ["* = NULLBYTE tagged: 60% pay", 1, WHITE]], YEL);
  popup([["AFTER HOURS", 2, ORNG], ["Targets close 10 PM-6 AM.", 1, WHITE], ["Pick the lock, then hack it", 1, WHITE], ["inside for +50% pay!", 1, WHITE]], ORNG);
  popup([["MORE HACKS", 2, PINK], ["12 side targets in the outer", 1, WHITE], ["districts. They count for the", 1, WHITE], ["win! Two big hacks a day", 1, WHITE]], PINK);
  popup([["WIN", 2, MATG], ["All 20 targets + all upgrades", 1, WHITE], ["+ 1 night break-in. No day limit!", 1, YEL], ["Save any time from the menu", 1, WHITE]], MATG);
}
function escMenu() {
  var r, idx = 0, wh, items, hints, ids, id, ph, goal;
  menuMode();
  while (true) {
    ph = G.inv[32] > 0;
    goal = nextGoalText();
    items = ["Resume", "Next: " + goal.substring(0, 22), "Inventory", "Skills & stats", "Skills spend", "Targets", "Trophies", "Informant",
      "Clock: " + (CLK12 ? "12 hr" : "24 hr"),
      "Aggressive mode: " + (PROFANE ? "ON" : "OFF"), "Call a cab"];
    hints = ["Back to the street", "Your current objective", "Parts and devices", "Levels and heat", "Spend skill points", "Your hit list", "Achievements",
      "Pay for a tip (wider zone)", "SEL toggles 12 / 24 hour clock",
      "Profanity + fight/rob pedestrians", "Travel any time for a fare"];
    ids = [0, 10, 1, 2, 11, 3, 12, 13, 4, 14, 6];
    items.push("Save game", "Save and exit", "Exit (no save)");
    hints.push("Pick a slot and name it", "Save, then close the game", "Quit to title without saving");
    ids.push(7, 8, 9);
    r = menu("PAUSED  Day " + dayOf(), items, idx, hints);
    if (r < 0) { break; }
    id = ids[r];
    if (id == 0 || id == 10) { break; }
    idx = r;
    if (id == 1) { invMenu(); }
    else if (id == 2) { statsScreen(); }
    else if (id == 11) { skillsMenu(); }
    else if (id == 3) { targetList(); }
    else if (id == 12) { trophiesMenu(); }
    else if (id == 13) { informantMenu(); }
    else if (id == 4) { CLK12 = !CLK12; saveCfg(); }
    else if (id == 14) { PROFANE = !PROFANE; saveCfg(); flash("Aggressive mode " + (PROFANE ? "ON" : "OFF"), YEL); }
    else if (id == 6) { if (callCab()) { break; } }
    else if (id == 7) { saveFlow(); menuMode(); }
    else if (id == 8) {
      if (CUR < 0) { if (!saveFlow()) { continue; } }
      else { wh = saveGame(); flash(wh == "" ? "SAVE FAILED!" : ("Saved: " + CURNAME), wh == "" ? RED : GREEN); if (wh == "") { continue; } }
      QUITALL = true; LEAVE = true; break;
    }
    else if (id == 9) {
      if (confirm2("Quit without saving?", "Progress since last save is lost", RED)) { LEAVE = true; break; }
    }
  }
  walkMode();
  if (!LEAVE) { redrawAll(); }
}
var GLITCHES = 0;
function townGlitch(e) {
  var msg = (e && e.message) ? e.message : String(e);
  GLITCHES++;
  try { wrFile("/hackerz_error.txt", msg + " @" + TR + " day " + dayOf() + " loc " + G.loc); } catch (e1) {}
  try { walkMode(); if (PX < 16 || PX > W - 16) { PX = 90; } redrawAll(); bar("Recovered from a glitch", ORNG); wait(400); } catch (e2) {}
}
function town() {
  var k, tgt = PX, last = -2, ns, idle = 0, d, s, errs = 0, hk = "", nk, bl = 0, stFrame = 0;
  walkMode(); PH = phaseNow(); redrawAll(); hk = hudKey();
  while (G.over == 0 && !LEAVE) {
    try {
      if (phaseNow() != PH) { PH = phaseNow(); redrawAll(); }
      nk = hudKey(); if (nk != hk) { hk = nk; hud(); }
      if (G.en <= 0) { passOut(); redrawAll(); tgt = PX; last = -2; }
      if (EVT) { EVT = false; streetEvent(); redrawAll(); tgt = PX; last = -2; }
      if (G.rvmsg != "") { menuMode(); pop("RIVAL MOVE!", G.rvmsg, "Payout there drops to 60%", ORNG); G.rvmsg = ""; walkMode(); redrawAll(); tgt = PX; last = -2; }
      if (CREWMSG.length > 0 || CREWTROPHY) { menuMode(); crewNotify(); walkMode(); redrawAll(); tgt = PX; last = -2; }
      if (allWon()) { G.over = 1; break; }
      k = inp();
      if (k == 1) { tgt = Math.min(W - 16, tgt + 22); } else if (k == 2) { tgt = Math.max(16, tgt - 22); }
      if (tgt > PX + 66) { tgt = PX + 66; } if (tgt < PX - 66) { tgt = PX - 66; }
      if (PX != tgt) {
        d = (tgt > PX) ? 1 : -1; PF = d; s = Math.abs(tgt - PX);
        s = Math.min(s, Math.max(3, Math.min(10, Math.ceil(s / 3)))); moveP(PX + d * s); idle = 0;
        WMIN += s; if (WMIN >= 12) { WMIN -= 12; addMin(1); WALKMIN++; if (WALKMIN >= 20) { WALKMIN = 0; EVT = true; } }
      } else {
        if (PWK != 0) { PWK = 0; updPlayer(); }
        idle++; if (idle % 14 == 0) { blinkMarkers(); }
      }
      /* traffic keeps moving whether the player is walking or standing */
      stFrame++;
      if (stFrame >= 6) { stFrame = 0; streetLifeTick(); }
      ns = nearSpot();
      if (ns != last) { last = ns; prompt(ns); }
      if (k == 3) {
        if (ns >= 0) { doSpot(ns); tgt = PX; last = -2; redrawAll(); hk = hudKey(); }
        else if (ST_ON && STKIND == 0 && Math.abs(Math.floor(STX2) - PX) < 50) {
          menuMode(); hailStreetCar(); walkMode(); redrawAll(); tgt = PX; last = -2; hk = hudKey();
        } else if (ST_ON && STKIND != 0 && Math.abs(Math.floor(STX2) - PX) < 48) {
          swearAtPed(); redrawAll(); tgt = PX; last = -2; hk = hudKey();
        }
      } else if (k == 4) { escMenu(); tgt = PX; last = -2; hk = hudKey(); }
      wait(6);
    } catch (eT) {
      errs++;
      if (errs > 6) { throw eT; }
      townGlitch(eT); tgt = PX; last = -2;
    }
  }
}
function gameOver() {
  var sc = G.cash + G.bank + nDone() * 5000 + nSideDone() * 1500, i, rk, nh = false, won = (G.over == 1);
  for (i = 0; i < NDEV; i++) { sc += G.dev[i] * Math.floor(DV[i] / 2); }
  if (won) { sc += Math.max(0, 200 - dayOf()) * 500; }
  /* trophies */
  checkTrophies();
  if (won) {
    NGPLUS_UNLOCKED = true;
    try { wrFile("/hackerz_cfg.txt", "CLK," + (CLK12 ? 1 : 0) + ",NGP,1"); } catch (e) {}
  }
  rk = sc >= 300000 ? "LEGEND OF THE NET" : (sc >= 100000 ? "ELITE HACKERZ" : (sc >= 30000 ? "SCRIPT WIZARD" : (sc >= 5000 ? "GARAGE TINKERER" : "NEWBIE")));
  if (sc > HI) { HI = sc; nh = true; }
  saveHi();
  menuMode(); cls(rgb(0, 10, 4));
  sctxt(won ? "ALL SYSTEMS OWNED" : "TIME IS UP", 8, 2, won ? GREEN : RED, rgb(0, 40, 0));
  ctxt("Targets " + nDone() + "/" + NTG + "  Side " + nSideDone() + "/" + NSD + "   Day " + dayOf(), 40, 1, MATG);
  ctxt("Cash " + mny(G.cash) + "  Bank " + mny(G.bank) + "  Diff " + DIFFN[DIFF], 54, 1, GREEN);
  ctxt("Score  " + mny(sc), 76, 2, YEL); ctxt(rk, 102, 2, ORNG);
  ctxt(nh ? "NEW HIGH SCORE!" : "High score " + mny(HI), 130, 1, CYAN);
  if (won) { ctxt("New Game+ unlocked!", 144, 1, MATG); }
  ctxt("SEL to continue", 156, 1, GRAY);
  waitKey();
}
function titleScreen() {
  var on = 1, t = 0, want, ci2 = 0, cols = [rgb(60, 255, 120), rgb(120, 255, 170), rgb(40, 200, 90), rgb(180, 255, 200)];
  G.loc = 0; PH = 2; SHOWSP = false; PX = -24; PF = 1; PWK = 0;
  cls(BLACK); fullPaint();
  fr(0, 0, W, 14, rgb(6, 8, 30)); fr(0, 158, W, 12, rgb(10, 10, 24));
  sctxt("HACKERZ", 22, 4, cols[0], rgb(0, 40, 0)); sctxt("by da cbm", 62, 1, WHITE, rgb(0, 0, 0));
  ctxt("a pure fiction game", 80, 1, GRAY);
  walkMode(); walkTo(110, 6);
  while (true) {
    t++;
    if (t % 6 == 0) { ci2 = (ci2 + 1) & 3; sctxt("HACKERZ", 22, 4, cols[ci2], rgb(0, 40, 0)); }
    if (t % 5 == 0) { PWK = 0; }
    want = ((t >> 3) % 2 == 0) ? 1 : 0;
    if (want != on) {
      on = want;
      fr(0, 158, W, 12, rgb(10, 10, 24));
      if (on) { ctxt("Press SEL to start", 161, 1, WHITE); }
    }
    if (kSel()) { settleInput(); SHOWSP = true; return; }
    drainEnc(); wait(40);
  }
}
function pickDifficulty() {
  var items = ["Easy  ($600, 120d, slow rival)", "Normal ($400, 100d)", "Hard  ($250, 80d, fast rival)"], hints = [
    "Forgiving heat & rival", "Classic experience", "Tough heat & aggressive NULLBYTE"
  ], r;
  if (NGPLUS_UNLOCKED) {
    items.push("New Game+ ($350, 90d, brutal)");
    hints.push("Unlocked by winning. Highest pressure");
  }
  r = menu("DIFFICULTY", items, 1, hints);
  if (r < 0) { return false; }
  DIFF = r;
  DAYS = DIFF_DAYS[DIFF];
  return true;
}
function runGame() {
  var r, idx = 0, saved, go;
  newGame(); loadHi(); loadCfg();
  try {
    var d = rdFile("/hackerz_cfg.txt");
    if (d.indexOf("NGP,1") >= 0) { NGPLUS_UNLOCKED = true; }
  } catch (e) {}
  titleScreen();
  while (true) {
    saved = anySaved();
    r = menu("HACKERZ" + (HI > 0 ? "  Hi " + mnyS(HI) : ""),
      ["New Game", "Continue", "How To Play", "Clock: " + (CLK12 ? "12 hr" : "24 hr"), "Exit"], idx,
      ["Choose difficulty & start", saved ? "Pick one of your 3 save slots" : "No saved games yet", "Controls and tips", "SEL toggles 12 / 24 hour clock", "Quit to the launcher"]);
    if (r < 0) { r = 4; }
    idx = r; go = false;
    if (r == 0) {
      if (!pickDifficulty()) { continue; }
      newGame(); CUR = -1; CURNAME = "";
      go = saveFlow();
    } else if (r == 1) {
      if (saved) { go = loadFlow(); } else { flash("No saved games", RED); }
    }
    if (go) {
      LEAVE = false; QUITALL = false; G.over = 0;
      enterTown(G.loc);
      town();
      if (G.over) { gameOver(); }
      if (QUITALL) { cls(BLACK); ctxt("HACK THE PLANET", 80, 2, MATG); wait(700); return; }
    }
    else if (r == 2) { howTo(); }
    else if (r == 3) { CLK12 = !CLK12; saveCfg(); }
    else if (r == 4) { if (confirmBox("Exit game?")) { cls(BLACK); ctxt("HACK THE PLANET", 80, 2, MATG); wait(600); return; } }
  }
}
function errScreen(msg) {
  cls(rgb(60, 0, 0));
  txt("Recovered from an error", 6, 6, 1, WHITE);
  var m = String(msg) + " @" + TR, y = 22;
  while (m.length > 0 && y < H - 30) { txt(m.substring(0, 50), 6, y, 1, YEL); m = m.substring(50); y += 11; }
  txt("Progress saved. Press SEL", 6, H - 14, 1, WHITE);
  waitKey();
}
function resetAfterError() {
  LEAVE = false; EVT = false; SHOWSP = true;
  newGame(); CUR = -1; CURNAME = ""; menuMode();
}
function main() {
  var tries = 0, again = true, msg;
  while (again) {
    again = false;
    try { calibrateClock(); runGame(); }
    catch (err) {
      msg = (err && err.message) ? err.message : String(err);
      try { saveGame(); } catch (e2) {}
      try { wrFile("/hackerz_error.txt", msg + " @" + TR + " day " + dayOf() + " loc " + G.loc); } catch (e4) {}
      try { errScreen(msg); } catch (e3) {}
      tries++;
      if (tries < 4) { again = true; try { resetAfterError(); } catch (e5) {} }
    }
  }
}
main();
