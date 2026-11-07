/* ==========================================================
   DOPE WARZ - CROOKED CITY
   by da cbm
   Bruce firmware 1.16.1  |  LilyGO T-Embed CC1101 (320x170)   ES5
   ----------------------------------------------------------
   TURN the knob = walk the street     SEL = act     ESC = menu
   Walk to a glowing arrow:
     GREEN = dealer (buy / sell)   PINK = lab / bank / heist
     CYAN  = travel (bus, boat to the pier, plane from airport)
   Make drugs in your labs, rob joints, bribe cops and guards,
   talk your way out with trivia. Clear the shark before day 20.
   3 named save slots: /dopewars_slot1..3.txt (SD card, else LittleFS)
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


/* ==========================================================
   SCENE ENGINE
   Each scene is recorded ONCE into a list of rectangles that is
   bucketed into 40px strips. Moving things (characters, fire,
   plane, boat) only repaint the small box they move through:
   scenery for that box first, then the actors, in one quick pass.
   ========================================================== */
var GR = 136;            /* ground line */
var FY = 150;            /* feet line of every character */
var RECD = false, RN = 0, RX = [], RY = [], RW = [], RH = [], RC = [];
var REC = false, NI = 0, IX = [], IY = [], IW = [], IH = [], IC = [], SI = [];
var CL0 = 0, CL1 = 14, CL2 = W, CL3 = 158;
var PH = 0, SCN = 0, MODE = 1;
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
function R(x, y, w, h, c) {
  x = Math.floor(x); y = Math.floor(y); w = Math.floor(w); h = Math.floor(h);
  var x1, y1, s, s0, s1;
  if (w <= 0 || h <= 0) { return; }
  if (RECD) {
    x1 = x + w; y1 = y + h;
    if (x < 0) { x = 0; } if (y < 14) { y = 14; }
    if (x1 > W) { x1 = W; } if (y1 > 158) { y1 = 158; }
    if (x1 <= x || y1 <= y) { return; }
    RX[RN] = x; RY[RN] = y; RW[RN] = x1 - x; RH[RN] = y1 - y; RC[RN] = c; RN++;
    return;
  }
  if (REC) {
    x1 = x + w; y1 = y + h;
    if (x < 0) { x = 0; } if (y < 14) { y = 14; }
    if (x1 > W) { x1 = W; } if (y1 > 158) { y1 = 158; }
    if (x1 <= x || y1 <= y) { return; }
    IX[NI] = x; IY[NI] = y; IW[NI] = x1 - x; IH[NI] = y1 - y; IC[NI] = c;
    s0 = Math.floor(x / 40); s1 = Math.floor((x1 - 1) / 40);
    for (s = s0; s <= s1; s++) { SI[s].push(NI); }
    NI++;
    return;
  }
  x1 = x + w; y1 = y + h;
  if (x < CL0) { x = CL0; } if (y < CL1) { y = CL1; }
  if (x1 > CL2) { x1 = CL2; } if (y1 > CL3) { y1 = CL3; }
  if (x1 <= x || y1 <= y) { return; }
  display.drawFillRect(x, y, x1 - x, y1 - y, c);
}
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
var LY0 = 98, BYA = [], BRA = [], BRB = [], BRC = [], NBD = 0;
/* The street lane (y 98..158) is flattened once per scene into bands of
   non-overlapping runs, so a repaint writes each pixel ONCE (no flicker). */
function flatten() {
  var ys = [LY0, 158], seen = {}, i, a, b, k, ya, yb, ra, rb, rc2, j, x0, x1, na, nb, nc, s0, st, n;
  seen[LY0] = 1; seen[158] = 1;
  for (i = 0; i < NI; i++) {
    a = IY[i]; b = IY[i] + IH[i]; if (a < LY0) { a = LY0; } if (b > 158) { b = 158; }
    if (a < b) {
      if (!seen[a]) { seen[a] = 1; ys.push(a); }
      if (!seen[b]) { seen[b] = 1; ys.push(b); }
    }
  }
  ys.sort(function (p, q) { return p - q; });
  NBD = ys.length - 1;
  for (k = 0; k < NBD; k++) {
    ya = ys[k]; yb = ys[k + 1]; s0 = 0;
    for (i = NI - 1; i >= 0; i--) {
      if (IX[i] == 0 && IW[i] == W && IY[i] <= ya && IY[i] + IH[i] >= yb) { s0 = i; break; }
    }
    ra = [0]; rb = [W]; rc2 = [BLACK];
    for (i = s0; i < NI; i++) {
      if (IY[i] <= ya && IY[i] + IH[i] >= yb) {
        x0 = IX[i]; x1 = IX[i] + IW[i]; na = []; nb = []; nc = []; n = 0;
        for (j = 0; j < ra.length; j++) {
          if (rb[j] <= x0 || ra[j] >= x1) { na[n] = ra[j]; nb[n] = rb[j]; nc[n] = rc2[j]; n++; }
          else {
            if (ra[j] < x0) { na[n] = ra[j]; nb[n] = x0; nc[n] = rc2[j]; n++; }
            if (rb[j] > x1) { na[n] = x1; nb[n] = rb[j]; nc[n] = rc2[j]; n++; }
          }
        }
        na[n] = x0; nb[n] = x1; nc[n] = IC[i];
        ra = na; rb = nb; rc2 = nc;
      }
    }
    BYA[k] = ya; BRA[k] = ra; BRB[k] = rb; BRC[k] = rc2;
  }
  BYA[NBD] = 158;
}
function paintItems(x0, y0, x1, y1) {
  var s, s0 = Math.floor(x0 / 40), s1 = Math.floor((x1 - 1) / 40), a, b, L, j, id, xa, xb, ya, yb;
  for (s = s0; s <= s1; s++) {
    a = Math.max(x0, s * 40); b = Math.min(x1, s * 40 + 40); L = SI[s];
    for (j = 0; j < L.length; j++) {
      id = L[j];
      xa = IX[id]; if (xa < a) { xa = a; }
      xb = IX[id] + IW[id]; if (xb > b) { xb = b; }
      ya = IY[id]; if (ya < y0) { ya = y0; }
      yb = IY[id] + IH[id]; if (yb > y1) { yb = y1; }
      if (xb > xa && yb > ya) { display.drawFillRect(xa, ya, xb - xa, yb - ya, IC[id]); }
    }
  }
}
function paintBands(x0, y0, x1, y1) {
  var k, j, ya, yb, xa, xb, ra, rb, rc2;
  for (k = 0; k < NBD; k++) {
    if (BYA[k + 1] <= y0) { continue; }
    if (BYA[k] >= y1) { break; }
    ya = Math.max(BYA[k], y0); yb = Math.min(BYA[k + 1], y1);
    ra = BRA[k]; rb = BRB[k]; rc2 = BRC[k];
    for (j = 0; j < ra.length; j++) {
      xa = ra[j] > x0 ? ra[j] : x0; xb = rb[j] < x1 ? rb[j] : x1;
      if (xb > xa) { display.drawFillRect(xa, ya, xb - xa, yb - ya, rc2[j]); }
    }
  }
}
function bgBox(x0, y0, x1, y1) {
  if (y0 < LY0) { paintItems(x0, y0, x1, Math.min(y1, LY0)); }
  if (y1 > LY0) { paintBands(x0, Math.max(y0, LY0), x1, y1); }
}

/* ---------- sprites ---------- */
var PP = [], PD = [], PC = [], PJ = [];
function mkPal(sh, pa, sk, hat, shoe, kind) {
  return [KG(sh[0], sh[1], sh[2]), KG(pa[0], pa[1], pa[2]), KG(sk[0], sk[1], sk[2]),
    hat ? KG(hat[0], hat[1], hat[2]) : -1, KG(shoe[0], shoe[1], shoe[2]), kind];
}
function setPals() {
  PP = outfitPal(outfitIdx());   /* default 'Classic': red top, light jeans, red cap - readable on every background */
  PD = mkPal([75, 62, 50], [35, 35, 40], [150, 100, 70], [20, 20, 22], [15, 15, 15], 3);
  PC = mkPal([35, 70, 175], [25, 40, 115], [230, 180, 140], [20, 30, 90], [10, 10, 10], 1);
  PJ = mkPal([245, 125, 20], [245, 125, 20], [235, 185, 140], null, [90, 60, 40], 0);
}
/* small round shape in 5 rects (cheap to record and redraw) */
function disc(cx, cy, r, c) {
  R(cx - r + 2, cy - r, 2 * r - 3, 1, c); R(cx - r + 1, cy - r + 1, 2 * r - 1, 1, c);
  R(cx - r, cy - r + 2, 2 * r + 1, 2 * r - 3, c);
  R(cx - r + 1, cy + r - 1, 2 * r - 1, 1, c); R(cx - r + 2, cy + r, 2 * r - 3, 1, c);
}
function head(cx, cy, c) {
  R(cx - 3, cy - 7, 7, 1, c); R(cx - 5, cy - 6, 11, 1, c); R(cx - 6, cy - 5, 13, 1, c); R(cx - 7, cy - 4, 15, 9, c);
  R(cx - 6, cy + 5, 13, 1, c); R(cx - 5, cy + 6, 11, 1, c); R(cx - 3, cy + 7, 7, 1, c);
}
/* a big character: 22px body, 48px tall (about 1.4x the bird).
   BODY (shadow, torso, head, hat) is rigid; LIMBS change with the walk pose */
function manBody(x, fy, f, wk, P) {
  var bob = (wk & 1) ? 1 : 0, sh = rgb(18, 18, 24), dk = rgb(10, 10, 14), hx;
  R(x - 11, fy - 1, 22, 3, sh); R(x - 8, fy - 2, 16, 1, sh);
  if ((P[5] == 0 || P[5] == 10) && G.pack && MODE != 4) { R(f > 0 ? x - 15 : x + 7, fy - 31 - bob, 8, 17, rgb(150, 90, 40)); R(f > 0 ? x - 14 : x + 8, fy - 22 - bob, 6, 5, rgb(105, 58, 24)); }
  if (P[5] == 3) { R(x - 10, fy - 32 - bob, 20, 26, P[0]); R(x - 2, fy - 32 - bob, 4, 26, dk); }
  else { R(x - 8, fy - 32 - bob, 16, 18, P[0]); R(x - 8, fy - 16 - bob, 16, 3, dk); }
  if ((P[5] == 0 || P[5] == 10) && G.pack && MODE != 4) { R(x - 5, fy - 32 - bob, 2, 15, rgb(105, 58, 24)); }
  head(x, fy - 39 - bob, P[2]);
  if ((P[5] == 0 || P[5] == 10) && G.mask) {                     /* SKI MASK: knit over the whole head, eye slit left open */
    head(x, fy - 39 - bob, rgb(28, 28, 36)); R(x - 6, fy - 42 - bob, 13, 4, P[2]);
    R(x - 5, fy - 37 - bob, 11, 1, rgb(66, 66, 78)); R(x - 5, fy - 34 - bob, 11, 1, rgb(66, 66, 78)); R(x - 3, fy - 45 - bob, 7, 1, rgb(66, 66, 78));
  }
  /* Rasta King: red / yellow / green shirt bands */
  if (P[5] == 10 && !G.mask) {
    R(x - 8, fy - 32 - bob, 16, 5, rgb(25, 150, 60));
    R(x - 8, fy - 27 - bob, 16, 5, rgb(250, 210, 40));
    R(x - 8, fy - 22 - bob, 16, 5, rgb(215, 40, 45));
    R(x - 8, fy - 17 - bob, 16, 1, dk);
  }
  hx = (f > 0) ? x + 3 : x - 5;
  R(hx, fy - 41 - bob, 2, 2, dk); R(hx + 2 * f, fy - 36 - bob, 3, 1, dk);
  if (P[5] == 2 || P[5] == 3) { R(f > 0 ? x : x - 8, fy - 42 - bob, 8, 3, dk); }
  if (P[3] >= 0) {
    R(x - 8, fy - 48 - bob, 16, 6, P[3]);
    R(f > 0 ? x + 2 : x - 14, fy - 43 - bob, 12, 2, P[3]);
  } else if (P[5] == 10 && !G.mask) {
    /* dreadlocks, no hat */
    var hr = rgb(28, 20, 14);
    R(x - 7, fy - 47 - bob, 14, 4, hr);
    R(x - 10, fy - 46 - bob, 2, 18, hr); R(x - 8, fy - 47 - bob, 2, 20, hr);
    R(x + 7, fy - 46 - bob, 2, 14, hr); R(x + 9, fy - 44 - bob, 2, 12, hr);
    R(x - 12, fy - 44 - bob, 2, 14, hr);
    R(x - 10, fy - 28 - bob, 2, 2, rgb(215, 40, 45));
    R(x - 8, fy - 27 - bob, 2, 2, rgb(250, 210, 40));
    R(x - 12, fy - 31 - bob, 2, 2, rgb(25, 150, 60));
    R(x + 7, fy - 36 - bob, 2, 2, rgb(25, 150, 60));
    R(x + 9, fy - 36 - bob, 2, 2, rgb(215, 40, 45));
  } else { R(x - 7, fy - 47 - bob, 14, 4, dk); }
  if (P[5] == 1) { R(f > 0 ? x + 1 : x - 7, fy - 27 - bob, 5, 5, rgb(255, 210, 60)); }
}
function manLimbs(x, fy, f, wk, P) {
  var sw = (wk == 1) ? 1 : ((wk == 3) ? -1 : 0), bob = (wk & 1) ? 1 : 0, l1, l2, ax1, ax2, bx;
  l1 = x - 7 + sw * 4 * f; l2 = x + 1 - sw * 4 * f;
  R(l1, fy - 14, 6, 10, P[1]); R(l2, fy - 14, 6, 10, P[1]);
  R(f > 0 ? l1 : l1 - 3, fy - 4, 9, 4, P[4]); R(f > 0 ? l2 : l2 - 3, fy - 4, 9, 4, P[4]);
  ax1 = x - 12 - sw * 2 * f; ax2 = x + 8 + sw * 2 * f;
  R(ax1, fy - 31 - bob, 4, 13, P[0]); R(ax1, fy - 19 - bob, 4, 3, P[2]);
  R(ax2, fy - 31 - bob, 4, 13, P[0]); R(ax2, fy - 19 - bob, 4, 3, P[2]);
  if ((P[5] == 0 || P[5] == 10) && G.duf && MODE != 4) {
    bx = (f > 0) ? ax2 - 1 : ax1 - 7;
    R(bx, fy - 16 - bob, 12, 9, rgb(60, 105, 60)); R(bx, fy - 13 - bob, 12, 2, rgb(35, 70, 35)); R(bx + 4, fy - 19 - bob, 4, 3, rgb(35, 70, 35));
  }
}
function man(x, fy, f, wk, P, part) {
  x = Math.floor(x);
  if (part == 1) { manBody(x, fy, f, wk, P); }
  else if (part == 2) { manLimbs(x, fy, f, wk, P); }
  else if (P[5] == 3) { manLimbs(x, fy, f, wk, P); manBody(x, fy, f, wk, P); }
  else { manBody(x, fy, f, wk, P); manLimbs(x, fy, f, wk, P); }
}

/* ---------- scenery pieces ---------- */
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
function house(x, w, h, wr, wg, wb, rr, rg, rb) {
  var top = GR - h, i, half, cx = x + w / 2;
  R(x, top, w, h, K(wr, wg, wb));
  for (i = 0; i < 8; i++) { half = Math.floor((w + 8) / 2 * (1 - i / 8)); R(cx - half, top - 2 - i * 2, half * 2, 2, K(rr, rg, rb)); }
  R(x + 6, top + 8, 10, 11, (PH == 2) ? rgb(255, 215, 110) : K(150, 195, 230));
  R(x + w - 16, top + 8, 10, 11, (PH == 2) ? rgb(255, 215, 110) : K(150, 195, 230));
  R(cx - 4, GR - 18, 9, 18, K(100, 60, 35)); R(cx + 2, GR - 9, 2, 2, rgb(240, 200, 60));
}
function tree(x, h, r, g, b) {
  R(x - 2, GR - h, 5, h, K(90, 60, 35));
  Cc(x, GR - h - 6, 12, K(r, g, b)); Cc(x - 8, GR - h + 2, 8, K(r * 0.9, g * 0.9, b * 0.9)); Cc(x + 8, GR - h + 2, 8, K(r * 0.9, g * 0.9, b * 0.9));
}
function palm(x, h) {
  var i, tx = x;
  for (i = 0; i < h; i += 4) { tx = x + Math.floor(Math.sin(i / 30) * 6); R(tx - 2, GR - i - 4, 5, 5, K(130, 95, 55)); }
  E(tx - 10, GR - h, 12, 3, K(40, 150, 60)); E(tx + 10, GR - h, 12, 3, K(40, 150, 60));
  E(tx - 6, GR - h - 5, 8, 4, K(50, 170, 70)); E(tx + 6, GR - h - 5, 8, 4, K(50, 170, 70));
  Cc(tx, GR - h + 1, 3, K(110, 70, 30));
}
function ground(r, g, b, cr, cg, cb) {
  R(0, GR, W, 22, K(r, g, b)); R(0, GR, W, 3, K(cr, cg, cb)); R(0, GR + 3, W, 1, K(r * 0.6, g * 0.6, b * 0.6));
}
function spray(x, y, c1, c2) {
  R(x + 1, y + 5, 5, 12, c2); R(x + 6, y + 1, 5, 6, c2); R(x + 11, y + 5, 5, 12, c2); R(x + 6, y + 11, 5, 6, c2);
  R(x, y + 4, 5, 12, c1); R(x + 5, y, 5, 6, c1); R(x + 10, y + 4, 5, 12, c1); R(x + 5, y + 10, 5, 6, c1);
  R(x + 2, y + 16, 1, 6, c1); R(x + 12, y + 16, 1, 9, c1);
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
function pierGate(x) {
  R(x - 20, 124, 4, 12, K(80, 55, 30)); R(x + 18, 124, 4, 12, K(80, 55, 30)); R(x - 20, 122, 42, 3, K(110, 80, 45));
  R(x - 14, 96, 30, 20, rgb(30, 90, 180)); R(x - 10, 102, 22, 3, rgb(255, 255, 255)); R(x - 4, 108, 10, 3, rgb(255, 255, 255));
  R(x - 1, 116, 3, 8, K(80, 55, 30));
}
function airSign(x) {
  R(x - 1, 100, 3, 36, K(80, 80, 90)); R(x - 16, 84, 34, 18, rgb(30, 90, 180));
  R(x - 10, 92, 22, 3, rgb(255, 255, 255)); R(x - 2, 87, 4, 13, rgb(255, 255, 255)); R(x - 12, 88, 5, 2, rgb(255, 255, 255));
}
function door(x, w, h, r, g, b, sr, sg, sb) {
  R(x - w / 2 - 3, GR - h - 3, w + 6, h + 3, K(r * 0.5, g * 0.5, b * 0.5));
  R(x - w / 2, GR - h, w, h, K(r, g, b));
  R(x - w / 2 + 2, GR - h + 4, w - 4, 6, rgb(sr, sg, sb));
  R(x + w / 2 - 6, GR - h / 2, 3, 3, rgb(240, 200, 60));
}
function shop(x, ar, ag, ab) {
  var i;
  R(x - 24, 92, 48, 44, K(200, 190, 170)); R(x - 20, 112, 40, 24, (PH == 2) ? rgb(255, 215, 110) : K(120, 170, 210));
  for (i = 0; i < 6; i++) { R(x - 26 + i * 9, 104, 9, 8, (i & 1) ? K(255, 255, 255) : K(ar, ag, ab)); }
  R(x - 4, 118, 9, 18, K(90, 60, 35));
}

/* ---------- the eight places ---------- */
function sceneGhetto() {
  var B = [[0, 58, 92, 125, 62, 52, 1], [62, 40, 66, 98, 86, 72, 1], [106, 56, 104, 112, 72, 62, 1],
    [166, 46, 78, 88, 72, 84, 1], [216, 44, 102, 102, 66, 56, 1], [264, 56, 86, 92, 84, 78, 1]], i;
  skyline(55, 50, 70, 3);
  for (i = 0; i < B.length; i++) { bld(B[i][0], B[i][1], B[i][2], B[i][3], B[i][4], B[i][5], B[i][6]); }
  spray(8, 100, KG(255, 60, 160), KG(40, 20, 60)); spray(66, 108, KG(60, 255, 120), KG(20, 50, 30));
  spray(118, 104, KG(60, 220, 255), KG(20, 40, 70)); spray(222, 108, KG(255, 230, 60), KG(60, 40, 20));
  spray(272, 104, KG(255, 120, 40), KG(60, 30, 20));
  ground(70, 70, 78, 105, 105, 112);
  R(40, 146, 30, 1, K(40, 40, 46)); R(120, 150, 24, 1, K(40, 40, 46)); R(230, 148, 28, 1, K(40, 40, 46));
  if (PH != 1) { E(214, 126, 30, 24, (PH == 2) ? rgb(52, 32, 24) : rgb(110, 76, 60)); E(214, 128, 18, 14, (PH == 2) ? rgb(80, 44, 26) : rgb(130, 90, 66)); }
  R(207, 122, 14, 16, K(75, 62, 58)); R(207, 127, 14, 2, K(40, 40, 46)); R(207, 133, 14, 2, K(40, 40, 46)); R(206, 120, 16, 3, K(55, 50, 50));
  Cc(180, 132, 5, K(20, 20, 24)); Cc(188, 134, 4, K(30, 30, 34)); Cc(110, 133, 5, K(20, 20, 24));
  lamp(300);
  door(160, 26, 28, 90, 90, 100, 250, 220, 40);
}
function sceneDowntown() {
  var B = [[0, 38, 112, 60, 80, 120, 0], [40, 36, 84, 90, 100, 125, 0], [80, 52, 120, 70, 90, 135, 0],
    [200, 42, 100, 100, 110, 135, 0], [244, 34, 124, 70, 85, 125, 0], [280, 40, 90, 95, 105, 130, 0]], i;
  skyline(40, 50, 80, 5);
  for (i = 0; i < B.length; i++) { bld(B[i][0], B[i][1], B[i][2], B[i][3], B[i][4], B[i][5], B[i][6]); }
  R(134, 84, 52, 52, K(220, 210, 185)); R(130, 78, 60, 7, K(190, 180, 160));
  for (i = 0; i < 4; i++) { R(138 + i * 13, 90, 5, 40, K(245, 240, 225)); }
  R(130, 78, 60, 2, rgb(250, 215, 80)); R(150, 100, 20, 36, K(80, 60, 40)); R(156, 66, 8, 12, rgb(250, 215, 80));
  ground(60, 62, 70, 120, 120, 128);
  for (i = 0; i < 6; i++) { R(i * 56 + 10, 147, 28, 3, K(230, 230, 230)); }
  lamp(120); lamp(236);
  R(100, 126, 7, 10, K(200, 40, 40)); busStop(280);
}
function sceneSuburbs() {
  var i;
  E(80, GR, 110, 44, K(110, 190, 120)); E(250, GR, 120, 38, K(90, 175, 100));
  house(4, 50, 36, 235, 220, 170, 160, 70, 60); house(70, 46, 40, 170, 200, 235, 90, 90, 110);
  house(126, 66, 46, 150, 120, 175, 70, 50, 90); house(214, 50, 38, 245, 200, 200, 120, 80, 70);
  tree(58, 34, 50, 150, 60); tree(200, 38, 60, 160, 70); tree(276, 40, 50, 150, 60);
  R(138, GR - 38, 12, 12, (PH == 2) ? rgb(220, 90, 255) : rgb(190, 80, 230)); R(164, GR - 38, 12, 12, (PH == 2) ? rgb(220, 90, 255) : rgb(190, 80, 230));
  ground(80, 170, 90, 200, 200, 190);
  R(0, 142, W, 8, K(150, 150, 150));
  for (i = 0; i < 40; i++) { R(i * 8, GR - 12, 4, 12, K(250, 250, 250)); }
  R(0, GR - 8, W, 2, K(250, 250, 250));
  R(100, 124, 3, 12, K(90, 60, 35)); R(96, 120, 12, 6, K(40, 80, 200));
  busStop(280);
}
function sceneDocks() {
  var i;
  R(0, 98, W, 40, K(30, 90, 150)); R(0, 98, W, 3, K(120, 170, 210));
  for (i = 0; i < 9; i++) { R(i * 38 + (i & 1) * 12, 110 + (i % 3) * 8, 18, 1, K(150, 200, 235)); }
  R(10, 80, 90, 20, K(150, 50, 50)); R(30, 70, 30, 10, K(230, 230, 230)); R(80, 74, 4, 6, K(60, 60, 60));
  R(60, 40, 4, 96, K(210, 160, 40)); R(60, 40, 70, 4, K(210, 160, 40)); R(126, 40, 3, 22, K(210, 160, 40)); R(40, 60, 24, 3, K(210, 160, 40));
  R(230, 56, 4, 80, K(210, 160, 40)); R(190, 56, 50, 4, K(210, 160, 40)); R(192, 56, 3, 18, K(210, 160, 40));
  R(76, 92, 40, 44, K(180, 60, 40)); R(76, 92, 40, 4, K(120, 40, 30)); R(80, 100, 16, 36, K(40, 110, 170)); R(98, 100, 16, 36, K(230, 170, 40));
  R(118, 112, 34, 24, K(60, 120, 70)); R(122, 100, 34, 12, K(190, 190, 60));
  R(196, 92, 56, 44, K(120, 130, 140)); R(196, 88, 56, 5, K(90, 100, 110));
  for (i = 0; i < 14; i++) { R(196 + i * 4, 93, 1, 43, K(100, 110, 120)); }
  ground(125, 90, 55, 90, 60, 35);
  for (i = 0; i < 4; i++) { R(0, 140 + i * 6, W, 1, K(80, 55, 30)); }
  door(160, 28, 30, 70, 90, 80, 230, 80, 60);
  lamp(30); lamp(236); pierGate(278);
}
function sceneIsland() {
  var i;
  R(0, 98, W, 40, K(20, 150, 190)); R(0, 98, W, 3, K(140, 220, 235));
  for (i = 0; i < 9; i++) { R(i * 38 + (i & 1) * 14, 112 + (i % 3) * 8, 20, 1, K(190, 240, 250)); }
  E(70, 100, 60, 34, K(80, 100, 90)); E(70, 100, 20, 36, K(60, 75, 70)); R(66, 68, 8, 6, rgb(255, 120, 30));
  palm(20, 70); palm(110, 62); palm(240, 76);
  R(196, 100, 50, 36, K(130, 120, 100)); R(194, 96, 54, 6, K(80, 110, 70)); R(225, 70, 2, 28, K(60, 60, 60)); R(220, 78, 12, 2, K(60, 60, 60));
  R(46, 112, 34, 24, K(200, 160, 90)); for (i = 0; i < 6; i++) { R(40 + i * 8, 104 + (i % 2) * 2, 14, 10, K(190, 150, 60)); }
  ground(230, 205, 140, 245, 225, 170);
  R(150, 118, 20, 18, K(100, 100, 100)); R(140, 120, 40, 4, K(90, 130, 80));
  door(160, 24, 26, 60, 70, 60, 255, 80, 60);
  if (PH != 1) { R(100, 120, 3, 16, K(90, 60, 35)); }
  pierGate(278);
}
function sceneAmsterdam() {
  var B = [[0, 30, 96, 150, 60, 50, 4], [32, 28, 108, 190, 170, 120, 4], [62, 32, 90, 120, 70, 60, 4],
    [96, 28, 104, 210, 190, 150, 4], [190, 32, 100, 140, 70, 55, 4], [224, 28, 112, 170, 150, 110, 4], [254, 34, 94, 110, 60, 50, 4], [290, 30, 104, 190, 100, 80, 4]], i;
  E(250, GR - 24, 40, 28, K(150, 190, 120));
  R(240, 76, 3, 40, K(120, 80, 50)); R(228, 82, 28, 2, K(235, 235, 235)); R(240, 66, 3, 30, K(235, 235, 235));
  for (i = 0; i < B.length; i++) { bld(B[i][0], B[i][1], B[i][2], B[i][3], B[i][4], B[i][5], B[i][6]); }
  R(128, 76, 58, 60, K(60, 120, 70)); R(124, 72, 66, 6, K(40, 90, 50)); R(152, 100, 20, 36, K(30, 60, 40));
  R(136, 86, 14, 12, (PH == 2) ? rgb(120, 255, 140) : K(150, 220, 160)); R(166, 86, 14, 12, (PH == 2) ? rgb(120, 255, 140) : K(150, 220, 160));
  ground(120, 110, 105, 150, 140, 130);
  for (i = 0; i < 30; i++) { R(i * 11, 142 + (i % 3) * 4, 8, 2, K(90, 85, 80)); }
  Cc(30, 132, 6, K(30, 30, 30)); Cc(30, 132, 4, K(120, 110, 105)); Cc(48, 132, 6, K(30, 30, 30)); Cc(48, 132, 4, K(120, 110, 105)); R(30, 122, 18, 2, K(200, 40, 40));
  R(100, 130, 8, 6, K(240, 90, 120)); R(110, 130, 8, 6, K(250, 210, 60)); R(300, 130, 8, 6, K(240, 90, 120));
  lamp(214); airSign(278);
}
function sceneBogota() {
  var B = [[0, 34, 40, 240, 200, 60], [36, 30, 52, 230, 90, 100], [68, 36, 44, 90, 190, 230], [106, 28, 56, 120, 210, 120],
    [194, 34, 50, 240, 140, 60], [230, 34, 42, 200, 100, 220], [266, 36, 56, 240, 220, 120], [304, 20, 46, 90, 190, 230]], i;
  E(50, GR - 6, 110, 74, K(120, 130, 150)); E(60, GR - 40, 40, 20, K(240, 245, 255));
  E(250, GR - 6, 90, 52, K(100, 120, 100));
  for (i = 0; i < B.length; i++) { house(B[i][0], B[i][1], B[i][2], B[i][3], B[i][4], B[i][5], 190, 80, 60); }
  R(214, GR - 70, 14, 70, K(230, 225, 205)); R(210, GR - 76, 22, 8, K(190, 80, 60)); R(220, GR - 90, 2, 14, K(240, 240, 240)); R(216, GR - 86, 10, 2, K(240, 240, 240));
  shop(160, 220, 60, 60);
  ground(200, 170, 120, 230, 205, 160);
  R(60, 146, 30, 2, K(160, 130, 90)); R(220, 150, 30, 2, K(160, 130, 90));
  Cc(100, 132, 5, K(60, 140, 60)); Cc(300, 132, 5, K(60, 140, 60));
  airSign(278);
}
function sceneBangkok() {
  var i;
  skyline(70, 70, 110, 11);
  for (i = 0; i < 9; i++) { R(48 - i * 3, GR - 40 - i * 6, 6 + i * 6, 6, K(250, 200, 60)); }
  R(48, GR - 106, 2, 8, K(250, 200, 60)); R(34, GR - 40, 30, 40, K(230, 190, 60)); R(30, GR - 4, 38, 4, K(190, 140, 40));
  for (i = 0; i < 6; i++) { R(76 + i * 10, 108, 6, 28, K(190, 120, 70)); }
  R(92, 84, 50, 40, K(60, 40, 90)); R(98, 90, 38, 14, (PH == 2) ? rgb(255, 60, 200) : K(200, 120, 190)); R(98, 108, 38, 8, (PH == 2) ? rgb(60, 240, 255) : K(120, 180, 190));
  R(190, 78, 60, 58, K(100, 80, 120)); R(194, 84, 52, 12, (PH == 2) ? rgb(255, 230, 40) : K(220, 200, 90));
  for (i = 0; i < 5; i++) { R(190 + i * 12, 112, 12, 10, (i & 1) ? K(240, 240, 240) : K(220, 50, 60)); }
  R(280, 70, 22, 66, K(70, 80, 130)); R(284, 76, 14, 8, (PH == 2) ? rgb(60, 255, 120) : K(120, 190, 140));
  shop(160, 40, 140, 220);
  ground(60, 62, 72, 110, 110, 120);
  R(110, 148, 30, 4, (PH == 2) ? rgb(50, 60, 120) : K(40, 80, 140));
  R(206, 122, 24, 14, K(250, 200, 40)); R(208, 124, 20, 8, K(60, 150, 70)); Cc(210, 136, 4, K(20, 20, 20)); Cc(226, 136, 4, K(20, 20, 20));
  airSign(278);
}
function sceneTokyo() {
  var i, nz, c = K(205, 45, 45);
  skyline(45, 40, 85, 13);
  for (i = 0; i < 7; i++) {
    nz = (i * 37) % 40;
    R(8 + i * 44, 40 + nz, 22, 96 - nz, K(50 + i * 6, 50, 90));
    R(12 + i * 44, 50 + nz, 14, 6, (PH == 2) ? rgb(255, 60 + i * 25, 200 - i * 20) : K(160, 120, 170));
    R(12 + i * 44, 64 + nz, 14, 4, (PH == 2) ? rgb(60, 240 - i * 20, 255) : K(120, 170, 190));
  }
  R(30, 92, 4, 44, c); R(58, 92, 4, 44, c); R(26, 86, 40, 5, c); R(30, 95, 32, 3, c);
  R(122, 78, 76, 58, K(70, 40, 100)); R(126, 82, 68, 18, (PH == 2) ? rgb(255, 50, 170) : K(210, 90, 170));
  for (i = 0; i < 8; i++) { R(128 + i * 8, 102, 4, 3, (PH == 2) ? rgb(255, 230, 80) : K(230, 200, 90)); }
  R(130, 108, 60, 20, (PH == 2) ? rgb(255, 215, 110) : K(130, 175, 215)); R(155, 114, 10, 22, K(60, 40, 30));
  R(206, 118, 16, 18, K(60, 140, 220)); R(208, 121, 12, 6, (PH == 2) ? rgb(255, 255, 160) : K(170, 210, 235));
  ground(50, 52, 68, 95, 95, 112);
  airSign(278);
}
function sceneDubai() {
  var i, wl = (PH == 2) ? rgb(255, 215, 110) : K(120, 170, 210);
  skyline(185, 170, 145, 17);
  R(44, 44, 8, 92, K(200, 215, 235)); R(46, 26, 4, 20, K(200, 215, 235)); R(47, 8, 2, 20, K(225, 235, 248)); R(38, 104, 20, 32, K(180, 195, 220));
  R(86, 70, 18, 66, K(170, 190, 215)); R(236, 58, 22, 78, K(165, 185, 212)); R(240, 64, 14, 6, wl); R(90, 78, 10, 6, wl);
  palm(106, 66); palm(214, 72);
  R(118, 80, 84, 7, K(200, 150, 40)); E(160, 80, 14, 10, K(250, 215, 90)); R(122, 86, 76, 50, K(235, 190, 70));
  for (i = 0; i < 4; i++) { R(130 + i * 18, 104, 10, 32, K(110, 60, 30)); R(131 + i * 18, 108, 8, 6, wl); }
  ground(215, 190, 145, 238, 218, 172);
  airSign(278);
}
function sceneSF() {
  var i, y, B = [K(255, 80, 120), K(255, 200, 60), K(80, 220, 140), K(80, 170, 255), K(220, 90, 255)];
  skyline(90, 100, 125, 19);
  R(0, 98, W, 14, K(205, 210, 222));
  R(0, 118, W, 4, K(200, 55, 40)); R(54, 64, 6, 72, K(190, 50, 40)); R(244, 64, 6, 72, K(190, 50, 40));
  for (i = 0; i < 10; i++) {
    y = 70 + Math.floor((1 - ((i - 4.5) / 4.5) * ((i - 4.5) / 4.5)) * 30);
    R(60 + i * 18, y, 19, 2, K(200, 55, 40)); R(68 + i * 18, y, 1, 118 - y, K(200, 55, 40));
  }
  R(128, 84, 64, 52, K(120, 50, 170)); R(124, 78, 72, 7, K(60, 20, 90));
  for (i = 0; i < 5; i++) { R(128, 90 + i * 9, 64, 4, B[i]); }
  R(152, 108, 16, 28, K(40, 20, 60));
  ground(70, 80, 70, 110, 120, 105);
  for (i = 0; i < 6; i++) { Cc(24 + i * 30, 142, 2, B[i % 5]); }
  airSign(278);
}
function sceneMexico() {
  var i, wl = (PH == 2) ? rgb(255, 215, 110) : K(120, 170, 210), C = [K(230, 120, 90), K(240, 200, 90), K(110, 190, 170), K(220, 110, 150), K(120, 150, 220)];
  skyline(190, 120, 80, 21);
  Cc(280, 40, 12, K(255, 220, 90));
  for (i = 0; i < 5; i++) { R(6 + i * 54, 94 + (i & 1) * 6, 46, 42 - (i & 1) * 6, C[i]); R(14 + i * 54, 104 + (i & 1) * 6, 10, 10, wl); R(30 + i * 54, 104 + (i & 1) * 6, 10, 10, wl); }
  R(224, 108, 6, 28, K(50, 140, 60)); R(217, 116, 7, 3, K(50, 140, 60)); R(217, 112, 3, 7, K(50, 140, 60)); R(230, 112, 7, 3, K(50, 140, 60)); R(234, 108, 3, 7, K(50, 140, 60));
  R(126, 82, 68, 54, K(235, 235, 240)); R(122, 76, 76, 7, K(120, 120, 135)); R(182, 56, 8, 22, K(130, 120, 120)); E(186, 52, 8, 5, K(200, 200, 205));
  R(156, 90, 8, 24, K(215, 40, 40)); R(148, 98, 24, 8, K(215, 40, 40)); R(152, 114, 16, 22, K(80, 90, 110));
  ground(100, 80, 65, 140, 115, 90);
  airSign(278);
}
function sceneMarseille() {
  var i, wl = (PH == 2) ? rgb(255, 215, 110) : K(120, 170, 210);
  skyline(110, 120, 150, 23);
  E(40, 96, 50, 26, K(150, 170, 110)); R(34, 64, 12, 30, K(230, 220, 190)); R(36, 56, 8, 10, K(220, 190, 90));
  R(0, 96, W, 16, K(220, 190, 150));
  for (i = 0; i < 16; i++) { R(6 + i * 20, 99, 8, 8, wl); }
  R(0, 112, W, 24, K(40, 110, 160));
  for (i = 0; i < 5; i++) { R(14 + i * 62, 82, 2, 34, K(80, 60, 40)); R(17 + i * 62, 86, 16, 22, K(240, 235, 225)); R(8 + i * 62, 114, 34, 6, K(140, 60, 40)); }
  R(118, 82, 84, 7, K(80, 50, 45)); R(122, 88, 76, 48, K(120, 72, 62)); R(184, 56, 10, 28, K(70, 45, 40));
  R(132, 98, 16, 12, wl); R(172, 98, 16, 12, wl); R(152, 112, 16, 24, K(50, 35, 30));
  ground(80, 82, 88, 120, 120, 126);
  for (i = 0; i < 8; i++) { Cc(20 + i * 38, 142, 2, K(220, 40, 50)); }
  airSign(278);
}
/* a special-ops guard (static, part of the scenery) */
function guard(x) {
  var b = K(24, 27, 33), v = K(46, 54, 42), bl = K(12, 12, 14);
  R(x - 4, GR - 4, 3, 4, bl); R(x + 1, GR - 4, 3, 4, bl); R(x - 4, GR - 14, 8, 10, b); R(x - 5, GR - 26, 10, 12, v); R(x - 1, GR - 26, 2, 12, b);
  R(x - 7, GR - 25, 2, 10, b); R(x + 5, GR - 25, 2, 10, b); R(x - 3, GR - 31, 6, 5, K(215, 175, 140)); R(x - 4, GR - 34, 8, 4, b); R(x - 3, GR - 30, 6, 2, bl);
  R(x + 2, GR - 22, 11, 2, bl); R(x + 10, GR - 25, 2, 5, bl);
}
function sceneFarm() {
  var i, wl = (PH == 2) ? rgb(255, 215, 110) : K(120, 170, 210);
  E(60, 102, 90, 30, K(70, 140, 70)); E(250, 106, 100, 28, K(85, 150, 80));
  for (i = 0; i < 6; i++) { R(i * 54, 114, 52, 22, (i & 1) ? K(150, 170, 60) : K(120, 150, 50)); R(i * 54, 122, 52, 1, K(95, 120, 40)); R(i * 54, 129, 52, 1, K(95, 120, 40)); }
  for (i = 0; i < 8; i++) { R(4 + i * 12, 120, 2, 16, K(170, 130, 80)); }
  R(4, 124, 96, 2, K(170, 130, 80)); R(4, 130, 96, 2, K(170, 130, 80));
  R(206, 66, 18, 70, K(190, 195, 200)); E(215, 66, 9, 6, K(160, 165, 175)); R(206, 82, 18, 2, K(150, 155, 165)); R(206, 100, 18, 2, K(150, 155, 165));
  R(122, 84, 76, 52, K(170, 40, 35)); R(118, 76, 84, 9, K(95, 30, 28)); R(134, 68, 52, 8, K(110, 34, 30)); R(146, 62, 28, 7, K(120, 38, 32));
  R(146, 104, 28, 32, K(235, 230, 220)); R(146, 104, 28, 3, K(120, 40, 35)); R(158, 104, 4, 32, K(170, 40, 35)); R(146, 118, 28, 3, K(170, 40, 35));
  R(128, 94, 12, 10, wl); R(180, 94, 12, 10, wl);
  guard(108); guard(238);
  R(268, 96, 3, 40, K(90, 90, 100)); R(260, 90, 20, 10, K(40, 120, 200)); R(264, 93, 12, 4, K(240, 240, 240));
  ground(100, 140, 70, 150, 170, 100);
}
function scenePort() {
  var i, C = [K(210, 60, 50), K(60, 120, 200), K(230, 190, 50), K(70, 160, 90)];
  skyline(95, 105, 130, 29);
  R(0, 108, W, 28, K(30, 100, 150));
  R(14, 100, 118, 16, K(60, 70, 90)); R(10, 112, 126, 6, K(150, 50, 45));
  for (i = 0; i < 6; i++) { R(20 + i * 18, 86, 16, 14, C[i & 3]); R(20 + i * 18, 100 - 1, 16, 1, K(30, 30, 30)); }
  R(100, 76, 20, 10, K(230, 230, 235));
  R(206, 40, 5, 96, K(230, 190, 40)); R(168, 40, 70, 5, K(230, 190, 40)); R(168, 40, 4, 26, K(230, 190, 40)); R(190, 45, 2, 22, K(60, 60, 60));
  for (i = 0; i < 3; i++) { R(222 + i * 24, 112, 22, 24, C[(i + 1) & 3]); R(222 + i * 24, 112, 22, 2, K(30, 30, 30)); }
  R(130, 88, 50, 48, K(200, 200, 205)); R(126, 82, 58, 7, K(120, 125, 140)); R(148, 108, 14, 28, K(70, 80, 100)); R(136, 96, 12, 10, K(120, 170, 210)); R(164, 96, 12, 10, K(120, 170, 210));
  R(268, 96, 3, 40, K(90, 90, 100)); R(256, 90, 26, 10, K(30, 100, 160)); R(260, 93, 18, 4, K(240, 240, 240));
  ground(75, 80, 90, 115, 118, 128);
}
function sceneAir() {
  var i, wl = (PH == 2) ? rgb(255, 215, 110) : K(120, 170, 210);
  skyline(95, 105, 130, 31);
  E(62, 114, 46, 10, K(235, 235, 240)); R(100, 94, 6, 24, K(235, 235, 240)); R(98, 94, 12, 4, K(200, 60, 50)); R(46, 114, 40, 4, K(190, 195, 205));
  for (i = 0; i < 7; i++) { R(38 + i * 7, 110, 3, 3, wl); }
  R(118, 88, 84, 48, K(110, 120, 135)); E(160, 88, 42, 12, K(130, 140, 155)); R(142, 106, 36, 30, K(40, 45, 55));
  for (i = 0; i < 4; i++) { R(144 + i * 9, 106, 1, 30, K(60, 66, 78)); }
  R(236, 68, 12, 68, K(170, 175, 185)); R(230, 58, 24, 12, K(80, 160, 200)); R(232, 60, 20, 6, wl);
  ground(70, 72, 78, 110, 110, 118);
  for (i = 0; i < 8; i++) { R(i * 40 + 8, 147, 22, 3, K(240, 240, 240)); }
  airSign(278);
}
function sceneCompound() {
  var i, wl = (PH == 2) ? rgb(255, 215, 110) : K(120, 170, 210), gd = K(235, 200, 70);
  skyline(60, 75, 70, 37);
  R(0, 96, W, 40, K(120, 122, 128)); for (i = 0; i < 10; i++) { R(i * 34 + 4, 96, 2, 40, K(100, 102, 108)); }
  R(0, 92, W, 5, K(80, 84, 92));
  R(8, 118, 70, 18, K(40, 110, 60)); R(240, 118, 14, 18, K(40, 110, 60)); R(30, 56, 2, 62, K(200, 200, 205)); R(32, 58, 18, 11, K(210, 50, 50));
  R(112, 66, 96, 70, K(60, 70, 85)); R(108, 58, 104, 9, K(40, 46, 58)); R(140, 50, 40, 9, K(48, 55, 68));
  for (i = 0; i < 5; i++) { R(120 + i * 18, 74, 8, 10, wl); R(120 + i * 18, 92, 8, 10, wl); }
  R(147, 104, 26, 32, K(25, 28, 35)); R(150, 118, 2, 5, gd); R(168, 118, 2, 5, gd); R(144, 100, 32, 4, gd);
  guard(122); guard(135); guard(185); guard(198);
  R(252, 90, 56, 46, K(90, 96, 112)); R(248, 84, 64, 7, K(60, 66, 80)); R(270, 74, 20, 10, K(230, 230, 235)); R(278, 76, 4, 6, K(210, 50, 50));
  ground(55, 60, 55, 95, 100, 95);
  airSign(278);
}
function sceneJamaica() {
  var i, wl = (PH == 2) ? rgb(255, 215, 110) : K(120, 170, 210);
  R(0, 92, W, 46, K(20, 165, 205)); R(0, 92, W, 3, K(175, 238, 246));
  for (i = 0; i < 9; i++) { R(i * 38 + (i & 1) * 14, 104 + (i % 3) * 8, 20, 1, K(195, 245, 252)); }
  E(30, 96, 80, 34, K(40, 125, 70)); E(105, 98, 55, 24, K(55, 145, 80)); E(300, 98, 60, 20, K(45, 130, 75));
  palm(16, 74); palm(112, 66); palm(226, 76);
  R(136, 92, 48, 15, K(25, 150, 60)); R(136, 107, 48, 15, K(250, 210, 40)); R(136, 122, 48, 14, K(215, 40, 45)); R(132, 84, 56, 8, K(70, 50, 35));
  R(142, 104, 12, 10, wl); R(166, 104, 12, 10, wl); R(156, 116, 9, 20, K(90, 60, 35));
  R(148, 70, 24, 12, K(215, 40, 40)); R(150, 72, 20, 8, K(250, 215, 50)); R(156, 74, 8, 4, K(25, 140, 55));
  R(138, 128, 14, 8, K(150, 100, 55)); R(188, 126, 3, 10, K(90, 60, 35)); R(196, 126, 3, 10, K(90, 60, 35)); R(186, 122, 14, 4, K(215, 40, 40));
  ground(238, 212, 152, 252, 232, 178);
  R(60, 148, 30, 2, K(205, 180, 125)); R(230, 150, 26, 2, K(205, 180, 125));
  airSign(278);
}
function scenePier() {
  var i;
  R(0, 98, W, 62, K(30, 90, 150)); R(0, 98, W, 3, K(120, 170, 210));
  for (i = 0; i < 10; i++) { R(i * 34 + (i & 1) * 12, 108 + (i % 4) * 10, 20, 1, K(150, 200, 235)); }
  E(290, 100, 40, 12, K(70, 120, 90)); R(0, 128, 196, 2, K(90, 60, 35));
  for (i = 0; i < 8; i++) { R(i * 28 + 4, 122, 3, 16, K(90, 60, 35)); }
  R(0, 136, 200, 22, K(125, 90, 55)); R(0, 136, 200, 3, K(160, 120, 75));
  for (i = 0; i < 4; i++) { R(0, 141 + i * 5, 200, 1, K(85, 58, 35)); }
  R(196, 134, 8, 24, K(80, 55, 30)); lamp(20);
}
function scenePlane() {
  var i;
  E(60, GR - 10, 100, 30, K(90, 130, 100)); E(260, GR - 10, 90, 24, K(80, 120, 95));
  R(0, 88, 130, 48, K(175, 185, 195)); R(0, 84, 130, 5, K(120, 130, 140));
  for (i = 0; i < 9; i++) { R(6 + i * 14, 96, 10, 14, (PH == 2) ? rgb(255, 215, 110) : K(110, 160, 200)); }
  R(46, 114, 26, 22, K(80, 90, 100)); R(110, 40, 12, 96, K(190, 190, 200)); R(104, 30, 24, 14, (PH == 2) ? rgb(255, 215, 110) : K(110, 160, 200)); R(102, 26, 28, 5, K(120, 130, 140));
  R(0, GR, W, 22, K(62, 62, 68)); R(0, GR, W, 3, K(110, 110, 115));
  for (i = 0; i < 9; i++) { R(i * 40 + 6, 148, 24, 3, K(240, 240, 240)); }
  for (i = 0; i < 20; i++) { R(i * 16 + 4, 138 + (i & 1) * 4, 1, 1, rgb(255, 210, 60)); }
}
function sceneJail() {
  var i, j, wc = (PH == 2) ? rgb(10, 12, 40) : ((PH == 0) ? rgb(255, 180, 120) : rgb(130, 190, 240));
  R(0, 14, W, 144, rgb(70, 72, 80));
  for (j = 0; j < 9; j++) { R(0, 14 + j * 16, W, 1, rgb(50, 52, 58)); for (i = 0; i < 9; i++) { R(i * 36 + (j & 1) * 18, 14 + j * 16, 1, 16, rgb(50, 52, 58)); } }
  R(0, 138, W, 20, rgb(48, 48, 54)); R(0, 138, W, 2, rgb(30, 30, 34));
  R(40, 36, 46, 34, rgb(30, 30, 34)); R(43, 39, 40, 28, wc);
  for (i = 0; i < 4; i++) { R(48 + i * 10, 39, 3, 28, rgb(30, 30, 34)); }
  R(14, 108, 74, 7, rgb(120, 90, 60)); R(14, 115, 4, 23, rgb(60, 60, 66)); R(84, 115, 4, 23, rgb(60, 60, 66)); R(14, 100, 74, 8, rgb(170, 190, 230));
  R(150, 118, 22, 20, rgb(190, 190, 200)); R(154, 112, 14, 6, rgb(210, 210, 220));
  R(246, 14, W - 246, 144, rgb(40, 42, 50));
  R(252, 20, 4, 4, rgb(250, 240, 120));
}

/* ---------- scene registry ---------- */
function build(scn, ph) {
  var i;
  TR = "build";
  SCN = scn; PH = ph; setPals();
  REC = true; NI = 0;
  for (i = 0; i < 8; i++) { SI[i] = []; }
  sky();
  if (scn == 0) { sceneGhetto(); } else if (scn == 1) { sceneDowntown(); } else if (scn == 2) { sceneSuburbs(); }
  else if (scn == 3) { sceneDocks(); } else if (scn == 4) { sceneIsland(); } else if (scn == 5) { sceneAmsterdam(); }
  else if (scn == 6) { sceneBogota(); } else if (scn == 7) { sceneBangkok(); } else if (scn == 8) { sceneJamaica(); } else if (scn == 9) { sceneTokyo(); } else if (scn == 10) { sceneDubai(); }
  else if (scn == 11) { sceneSF(); } else if (scn == 12) { sceneMexico(); } else if (scn == 13) { sceneMarseille(); } else if (scn == 14) { sceneFarm(); }
  else if (scn == 15) { scenePort(); } else if (scn == 16) { sceneAir(); } else if (scn == 17) { sceneCompound(); } else if (scn == 20) { scenePier(); }
  else if (scn == 21) { scenePlane(); } else if (scn == 30) { sceneJail(); }
  REC = false;
  flatten();
}

/* ==========================================================
   ACTORS
   ========================================================== */
var PX = 90, PF = 1, PWK = 0, FR = 0, MB = 0, SHOWM = true, SHOWD = true, PVIS = true;
var COPX = -999, COPF = -1, COPW = 0, JD = 0, JG = false, ENV = -1;
var BXP = 330, BOB = 0, BSP = 0, ONB = false;
var PLX = 170, PLY = 135, TILT = 0, PLON = true, STAIRS = false;
var SPX = [70, 160, 270];
var MKC = [rgb(80, 255, 120), rgb(255, 80, 220), rgb(80, 220, 255)];
var HOOKX = 200, HOOKC = rgb(255, 120, 180);
var RED2 = rgb(235, 50, 20), OR2 = rgb(255, 150, 20), YL2 = rgb(255, 235, 90);

function marker(x, c) {
  var y = 84 + ((MB & 1) ? 3 : 0);
  R(x - 5, y, 11, 2, c); R(x - 4, y + 2, 9, 2, c); R(x - 3, y + 4, 7, 2, c); R(x - 2, y + 6, 5, 2, c); R(x - 1, y + 8, 3, 2, c);
}
function fire(x, y) {
  var h = [20, 25, 18, 23][FR & 3], o = [0, 2, -2, 1][FR & 3];
  R(x - 7, y - 7, 14, 7, RED2); R(x - 5, y - 14, 10, 8, RED2); R(x - 3 + o, y - h, 6, h - 12, RED2);
  R(x - 5, y - 5, 10, 5, OR2); R(x - 3, y - 11, 6, 7, OR2); R(x - 1 + o, y - h + 5, 3, h - 15, OR2);
  R(x - 2, y - 4, 5, 4, YL2);
}
function boat(bx, by) {
  var k, W2 = rgb(255, 255, 255);
  if (BSP > 2) {
    for (k = 0; k < 4; k++) { R(bx - 14 - k * 14, by + 7 + (k & 1) * 2, 12 - k, 2, W2); }
    R(bx - 8, by - 4, 3, 3, W2); R(bx - 16, by - 9, 2, 2, W2); R(bx - 26, by - 5, 2, 2, W2);
  }
  R(bx, by, 92, 10, rgb(235, 235, 240)); R(bx + 2, by + 6, 88, 4, rgb(200, 40, 40)); R(bx + 92, by, 5, 5, rgb(235, 235, 240));
  R(bx - 6, by - 6, 7, 12, rgb(40, 40, 50));
  R(bx + 52, by - 26, 34, 26, rgb(240, 240, 245)); R(bx + 50, by - 30, 38, 5, rgb(200, 40, 40));
  R(bx + 56, by - 20, 10, 8, rgb(80, 160, 220)); R(bx + 70, by - 20, 10, 8, rgb(80, 160, 220));
  R(bx + 30, by - 34, 2, 34, rgb(200, 200, 200)); R(bx + 32, by - 34, 12, 6, rgb(250, 200, 40));
}
function plane(x, y, t) {
  var i, W2 = rgb(250, 250, 255), G2 = rgb(150, 155, 170), bl = rgb(70, 140, 220);
  x = Math.floor(x); y = Math.floor(y);
  R(x, y, 22, 12, W2); R(x + 22, y - t, 22, 12, W2); R(x + 44, y - 2 * t, 22, 12, W2);
  Cc(x + 66, y - 2 * t + 5, 5, W2); R(x + 62, y - 2 * t + 2, 6, 3, bl);
  R(x, y + 8, 66, 3, rgb(200, 40, 40));
  R(x - 2, y - 14, 12, 15, W2); R(x, y - 12, 8, 3, rgb(200, 40, 40));
  R(x + 20, y + 9 - t, 30, 4, G2); R(x + 28, y + 12 - t, 12, 6, rgb(60, 60, 70));
  for (i = 0; i < 6; i++) { R(x + 12 + i * 7, y + 3 - Math.floor(t * (12 + i * 7) / 40), 3, 3, bl); }
  R(x - 3, y - 15, 3, 3, (FR & 1) ? rgb(255, 40, 40) : rgb(255, 255, 255));
  if (y > 130) { R(x + 18, y + 12, 3, 6, rgb(40, 40, 46)); Cc(x + 19, y + 17, 3, rgb(20, 20, 24)); Cc(x + 56, y + 14, 3, rgb(20, 20, 24)); }
}
/* ==========================================================
   MOVING-THING ENGINE
   Every mover (player body, player limbs, cop, bus, boat, plane,
   fire, arrows...) is a GROUP. A group's pieces are recorded as a
   rect list ("footprint"). When a group moves it only erases the
   thin strip it just left (or its old footprint when its pose
   changes), then redraws itself over its own pixels. Scenery is
   never repainted under a sprite, so nothing flashes.
   ========================================================== */
var G_MARK = 0, G_FIRE = 1, G_DEAL = 2, G_BUS = 3, G_COP = 4, G_CLIM = 5, G_VEH = 6, G_JAIL = 7, G_PLAY = 8, G_PLIM = 9, G_ENV = 10, NG = 11;
var FT = [], SKIP = -1;
function gOrg(id) {
  var vis = PVIS && !(MODE == 2 && ONB), pk = (MODE == 4) ? 10 : 0;
  if (id == G_MARK) { return [0, G.hookVis ? 1 : 0, (MODE == 1 && SHOWM) ? (MB & 1) + (G.hookVis ? 10 : 0) : -1]; }
  if (id == G_FIRE) { return [0, 0, (MODE == 1 && SCN == 0) ? (FR & 3) : -1]; }
  if (id == G_DEAL) { return [0, 0, (MODE == 1 && SHOWD) ? 1 : ((MODE == 4 && JG) ? 2 : -1)]; }
  if (id == G_BUS) { return [BUSX, 0, (MODE == 1 && BUSX > -500) ? 1 : -1]; }
  if (id == G_COP) { return [COPX, -(COPW & 1), (MODE == 1 && COPX > -100) ? COPF + 1 : -1]; }
  if (id == G_CLIM) { return [COPX, 0, (MODE == 1 && COPX > -100) ? (COPF + 1) * 10 + COPW : -1]; }
  if (id == G_VEH) {
    if (MODE == 2) { return [BXP, BOB, 2000 + ((ONB && PVIS) ? 100 : 0) + (BSP > 2 ? 10 : 0) + (PF + 1)]; }
    if (MODE == 3) { return [PLX, PLY, 3000 + TILT * 10 + (STAIRS ? 1 : 0) + (PLY > 130 ? 20 : 0)]; }
    return [0, 0, -1];
  }
  if (id == G_JAIL) { return [0, 0, (MODE == 4) ? 4000 + JD : -1]; }
  if (id == G_PLAY) { return [PX, -(PWK & 1), vis ? (PF + 1) + pk + (G.mask ? 20 : 0) + (G.pack ? 40 : 0) : -1]; }
  if (id == G_PLIM) { return [PX, 0, vis ? (PF + 1) * 100 + PWK * 10 + pk + (G.duf ? 1000 : 0) : -1]; }
  return [ENV, 0, ENV >= 0 ? 1 : -1];
}
function gDraw(id) {
  var i;
  if (id == G_MARK) {
    for (i = (SHOWD ? 0 : 1); i < 3; i++) { marker(SPX[i], MKC[i]); }
    if (MODE == 1 && G.loc == 0 && G.hookVis) {
      marker(HOOKX, HOOKC);
      drawHooker(HOOKX);
    }
  }
  else if (id == G_FIRE) { fire(214, 121); }
  else if (id == G_DEAL) { if (MODE == 4) { man(282, FY, -1, 0, PC, 0); } else if (SCN == 8) { dealerJam(46); } else if (SCN == 9) { dealerTriad(46); } else if (SCN == 11) { dealerSF(46); }
    else if (SCN < FARM || SCN == PORT || SCN == AIRP) { dealerGen(46, SCN); }
    else { man(46, FY, 1, 0, PD, 0); if (SCN == FARM) { farmer(46); } } }
  else if (id == G_BUS) { bus(BUSX); }
  else if (id == G_COP) { man(COPX, FY, COPF, COPW, PC, 1); }
  else if (id == G_CLIM) { man(COPX, FY, COPF, COPW, PC, 2); }
  else if (id == G_VEH) {
    if (MODE == 2) { boat(BXP, 148 + BOB); if (ONB && PVIS) { man(PX, 148 + BOB, PF, PWK, PP, 0); } }
    else {
      plane(PLX, PLY, TILT);
      if (STAIRS) { for (i = 0; i < 5; i++) { R(PLX + 34 + i * 3, 138 + i * 3, 3, 15 - i * 3, rgb(160, 160, 170)); } R(PLX + 30, 136, 10, 2, rgb(200, 200, 210)); }
    }
  }
  else if (id == G_JAIL) {
    for (i = 0; i < 4; i++) { R(214 + i * 9, 14, 3, 144 - JD, rgb(150, 155, 168)); }
    if (JD < 100) { R(214, 60, 30, 3, rgb(150, 155, 168)); R(214, 110, 30, 3, rgb(150, 155, 168)); }
  }
  else if (id == G_PLAY) { man(PX, FY, PF, PWK, (MODE == 4) ? PJ : PP, 1); }
  else if (id == G_PLIM) { man(PX, FY, PF, PWK, (MODE == 4) ? PJ : PP, 2); }
  else { R(ENV, FY - 26, 9, 5, rgb(60, 220, 90)); }
}
function clipDraw(f, cx0, cy0, cx1, cy1) {
  var k, xa, xb, ya, yb;
  for (k = 0; k < f.n; k++) {
    xa = f.x[k]; if (xa < cx0) { xa = cx0; } xb = f.x[k] + f.w[k]; if (xb > cx1) { xb = cx1; }
    ya = f.y[k]; if (ya < cy0) { ya = cy0; } yb = f.y[k] + f.h[k]; if (yb > cy1) { yb = cy1; }
    if (xb > xa && yb > ya) { display.drawFillRect(xa, ya, xb - xa, yb - ya, f.c[k]); }
  }
}
/* scenery for a small rect, then any OTHER mover that overlaps it */
function restore(x, y, w, h) {
  var x1 = Math.min(W, Math.ceil(x + w)), y1 = Math.min(158, Math.ceil(y + h)), i, f;
  x = Math.max(0, Math.floor(x)); y = Math.max(14, Math.floor(y));
  if (x1 <= x || y1 <= y) { return; }
  bgBox(x, y, x1, y1);
  for (i = 0; i < NG; i++) {
    f = FT[i];
    if (i == SKIP || !f || f.n == 0) { continue; }
    if (f.x1 <= x || f.x0 >= x1 || f.y1 <= y || f.y0 >= y1) { continue; }
    clipDraw(f, x, y, x1, y1);
  }
}
/* ---- sprite erase/draw WITHOUT allocating anything per frame ----
   The device has little RAM, so these use fixed scratch arrays (made once at load)
   instead of creating thousands of tiny temporary arrays on every step. */
var SCAP = 192, SL0 = [], SL1 = [], SL2 = [], SL3 = [], SM0 = [], SM1 = [], SM2 = [], SM3 = [], SQN = 0, OVI = [], OVN = 0, SPRFB = false, si0;
for (si0 = 0; si0 < SCAP; si0++) { SL0.push(0); SL1.push(0); SL2.push(0); SL3.push(0); SM0.push(0); SM1.push(0); SM2.push(0); SM3.push(0); }
for (si0 = 0; si0 < 12; si0++) { OVI.push(0); }
function sNew(x0, y0, x1, y1) { SL0[0] = x0; SL1[0] = y0; SL2[0] = x1; SL3[0] = y1; SQN = 1; }
/* take one rect (a,b)-(c,d) out of every piece in the list */
function sSub(a, b, c, d) {
  var i, m = 0, q0, q1, q2, q3, ya, yb, t;
  for (i = 0; i < SQN; i++) {
    q0 = SL0[i]; q1 = SL1[i]; q2 = SL2[i]; q3 = SL3[i];
    if (c <= q0 || a >= q2 || d <= q1 || b >= q3 || m + 4 > SCAP) { SM0[m] = q0; SM1[m] = q1; SM2[m] = q2; SM3[m] = q3; m++; continue; }
    if (q1 < b) { SM0[m] = q0; SM1[m] = q1; SM2[m] = q2; SM3[m] = b; m++; }
    if (q3 > d) { SM0[m] = q0; SM1[m] = d; SM2[m] = q2; SM3[m] = q3; m++; }
    ya = (q1 > b) ? q1 : b; yb = (q3 < d) ? q3 : d;
    if (q0 < a) { SM0[m] = q0; SM1[m] = ya; SM2[m] = a; SM3[m] = yb; m++; }
    if (q2 > c) { SM0[m] = c; SM1[m] = ya; SM2[m] = q2; SM3[m] = yb; m++; }
  }
  t = SL0; SL0 = SM0; SM0 = t; t = SL1; SL1 = SM1; SM1 = t; t = SL2; SL2 = SM2; SM2 = t; t = SL3; SL3 = SM3; SM3 = t;
  SQN = m;
}
function sSubF(f) {
  var k, i, a, b, c, d, x0 = 9999, y0 = 9999, x1 = -1, y1 = -1;
  for (i = 0; i < SQN; i++) { if (SL0[i] < x0) { x0 = SL0[i]; } if (SL2[i] > x1) { x1 = SL2[i]; } if (SL1[i] < y0) { y0 = SL1[i]; } if (SL3[i] > y1) { y1 = SL3[i]; } }
  for (k = 0; k < f.n && SQN > 0; k++) {
    a = f.x[k]; b = f.y[k]; c = a + f.w[k]; d = b + f.h[k];
    if (c <= x0 || a >= x1 || d <= y0 || b >= y1) { continue; }
    sSub(a, b, c, d);
  }
}
/* Erase a rect of the OLD sprite, but leave alone every pixel the NEW sprite (or any
   other sprite standing there) will show - those go straight to their final color, so
   the character never flashes / looks see-through while it walks. */
function restoreMinus(x, y, w, h, nf) {
  var x1 = Math.min(W, Math.ceil(x + w)), y1 = Math.min(158, Math.ceil(y + h)), i, j, f;
  x = Math.max(0, Math.floor(x)); y = Math.max(14, Math.floor(y));
  if (x1 <= x || y1 <= y) { return; }
  if (SPRFB) { restore(x, y, x1 - x, y1 - y); return; }
  try {
    sNew(x, y, x1, y1); sSubF(nf); if (PEND) { sSubF(PEND); }
    OVN = 0;
    for (i = 0; i < NG; i++) {
      f = FT[i];
      if (i == SKIP || !f || f.n == 0) { continue; }
      if (f.x1 <= x || f.x0 >= x1 || f.y1 <= y || f.y0 >= y1) { continue; }
      if (OVN < 12) { sSubF(f); OVI[OVN] = i; OVN++; }
    }
    for (i = 0; i < SQN; i++) { restore(SL0[i], SL1[i], SL2[i] - SL0[i], SL3[i] - SL1[i]); }
    if (OVN > 0) {
      sNew(x, y, x1, y1); sSubF(nf); if (PEND) { sSubF(PEND); }
      for (i = 0; i < SQN; i++) { for (j = 0; j < OVN; j++) { clipDraw(FT[OVI[j]], SL0[i], SL1[i], SL2[i], SL3[i]); } }
    }
  } catch (eS) { SPRFB = true; restore(x, y, x1 - x, y1 - y); }
}
/* draw a sprite so every pixel is written exactly ONCE (topmost rect wins) */
function drawNF(nf, usePend) {
  var k, j, i, xa, ya, xb, yb;
  if (SPRFB) { for (k = 0; k < nf.n; k++) { display.drawFillRect(nf.x[k], nf.y[k], nf.w[k], nf.h[k], nf.c[k]); } return; }
  try {
    for (k = 0; k < nf.n; k++) {
      xa = nf.x[k]; ya = nf.y[k]; xb = xa + nf.w[k]; yb = ya + nf.h[k];
      sNew(xa, ya, xb, yb);
      for (j = k + 1; j < nf.n && SQN > 0; j++) {
        if (nf.x[j] >= xb || nf.x[j] + nf.w[j] <= xa || nf.y[j] >= yb || nf.y[j] + nf.h[j] <= ya) { continue; }
        sSub(nf.x[j], nf.y[j], nf.x[j] + nf.w[j], nf.y[j] + nf.h[j]);
      }
      if (usePend && SQN > 0) { sSubF(PEND); }
      for (i = 0; i < SQN; i++) { display.drawFillRect(SL0[i], SL1[i], SL2[i] - SL0[i], SL3[i] - SL1[i], nf.c[k]); }
    }
  } catch (eD) { SPRFB = true; for (k = 0; k < nf.n; k++) { display.drawFillRect(nf.x[k], nf.y[k], nf.w[k], nf.h[k], nf.c[k]); } }
}
function isMan(id) { return id == G_PLAY || id == G_PLIM || id == G_COP || id == G_CLIM; }
function upd(id) {
  var o = gOrg(id), f = FT[id], nf, k, full, dx, dy, s, i, mn;
  if (f && f.ox == o[0] && f.oy == o[1] && f.sg == o[2]) { return; }
  RECD = true; RN = 0;
  if (o[2] >= 0) { gDraw(id); }
  RECD = false;
  nf = { n: RN, x: RX.slice(0, RN), y: RY.slice(0, RN), w: RW.slice(0, RN), h: RH.slice(0, RN), c: RC.slice(0, RN),
    ox: o[0], oy: o[1], sg: o[2], x0: 9999, x1: -1, y0: 9999, y1: -1 };
  for (k = 0; k < RN; k++) {
    if (nf.x[k] < nf.x0) { nf.x0 = nf.x[k]; } if (nf.x[k] + nf.w[k] > nf.x1) { nf.x1 = nf.x[k] + nf.w[k]; }
    if (nf.y[k] < nf.y0) { nf.y0 = nf.y[k]; } if (nf.y[k] + nf.h[k] > nf.y1) { nf.y1 = nf.y[k] + nf.h[k]; }
  }
  if (f && f.n > 0) {
    SKIP = id; full = (f.sg != o[2]); dx = o[0] - f.ox; dy = o[1] - f.oy;
    mn = isMan(id);
    for (k = 0; k < f.n; k++) {
      if (full) {
        if (mn) { restoreMinus(f.x[k], f.y[k], f.w[k], f.h[k], nf); } else { restore(f.x[k], f.y[k], f.w[k], f.h[k]); }
        continue;
      }
      if (dx != 0) {
        s = Math.min(f.w[k], Math.ceil(Math.abs(dx)) + 1);
        if (dx > 0) {
          if (mn) { restoreMinus(f.x[k], f.y[k], s, f.h[k], nf); } else { restore(f.x[k], f.y[k], s, f.h[k]); }
        } else {
          if (mn) { restoreMinus(f.x[k] + f.w[k] - s, f.y[k], s, f.h[k], nf); } else { restore(f.x[k] + f.w[k] - s, f.y[k], s, f.h[k]); }
        }
      }
      if (dy != 0) {
        s = Math.min(f.h[k], Math.ceil(Math.abs(dy)) + 1);
        if (dy > 0) {
          if (mn) { restoreMinus(f.x[k], f.y[k], f.w[k], s, nf); } else { restore(f.x[k], f.y[k], f.w[k], s); }
        } else {
          if (mn) { restoreMinus(f.x[k], f.y[k] + f.h[k] - s, f.w[k], s, nf); } else { restore(f.x[k], f.y[k] + f.h[k] - s, f.w[k], s); }
        }
      }
    }
    SKIP = -1;
  }
  if (isMan(id)) { drawNF(nf, PEND && (id == G_PLAY || id == G_COP)); }
  else { for (k = 0; k < nf.n; k++) { display.drawFillRect(nf.x[k], nf.y[k], nf.w[k], nf.h[k], nf.c[k]); } }
  FT[id] = nf;
  for (i = id + 1; i < NG; i++) {
    if (NOHI == i) { continue; }
    if (FT[i] && FT[i].n > 0 && !(FT[i].x1 <= nf.x0 || FT[i].x0 >= nf.x1 || FT[i].y1 <= nf.y0 || FT[i].y0 >= nf.y1)) { clipDraw(FT[i], nf.x0, nf.y0, nf.x1, nf.y1); }
  }
}
var PEND = null, NOHI = -1;
/* footprint a group WILL have after the move, recorded without drawing */
var PNX = [], PNY = [], PNW = [], PNH = [], PNC = [], PENDO = { n: 0, x: PNX, y: PNY, w: PNW, h: PNH, c: PNC };
for (si0 = 0; si0 < 64; si0++) { PNX.push(0); PNY.push(0); PNW.push(0); PNH.push(0); PNC.push(0); }
function pendFoot(id) {
  var o = gOrg(id), k, n;
  RECD = true; RN = 0;
  if (o[2] >= 0) { gDraw(id); }
  RECD = false;
  n = (RN > 64) ? 64 : RN;
  for (k = 0; k < n; k++) { PNX[k] = RX[k]; PNY[k] = RY[k]; PNW[k] = RW[k]; PNH[k] = RH[k]; PNC[k] = RC[k]; }
  PENDO.n = n;
  return PENDO;
}
/* body and limbs move together: when the body erases its old pixels it must
   not wipe pixels the limbs are about to occupy (and vice versa) */
function updPlayer() {
  var o = gOrg(G_PLIM), f = FT[G_PLIM];
  var will = !(f && f.ox == o[0] && f.oy == o[1] && f.sg == o[2]);
  PEND = will ? pendFoot(G_PLIM) : null; NOHI = will ? G_PLIM : -1; upd(G_PLAY);
  PEND = null; NOHI = -1; upd(G_PLIM);
}
/* the cop is two sprites too (body + limbs): move them together so he doesn't flicker */
function updCop() {
  var o = gOrg(G_CLIM), f = FT[G_CLIM];
  var will = !(f && f.ox == o[0] && f.oy == o[1] && f.sg == o[2]);
  PEND = will ? pendFoot(G_CLIM) : null; NOHI = will ? G_CLIM : -1; upd(G_COP);
  PEND = null; NOHI = -1; upd(G_CLIM);
}
function fullPaint() {
  var i;
  TR = "paint";
  bgBox(0, 14, W, 158); FT = [];
  for (i = 0; i < NG; i++) { upd(i); }
}

/* ---------- state ---------- */
var DAYS = 300, SHARK = 0.01, SHARK_TXT = "1%", UNL_BANK = 1000000, WORLD0 = 9, G = {}, HI = 0, MSGS = [], LEAVE = false, QU = [];
function qReset() { var i; QU = []; for (i = 0; i < 64; i++) { QU.push(0); } }
qReset();
var NDRUG = 9;
var DRUG = ["Weed", "Pills", "Acid", "Meth", "Heroin", "Cocaine", "Hash", "Peyote", "Shrooms"];
var DLO = [40, 150, 600, 1500, 4000, 8000, 90, 250, 500], DHI = [140, 450, 1500, 3500, 9000, 17000, 300, 800, 2200];
var LOCN = ["Ghetto", "Downtown", "Suburbs", "Docks", "Smuggler Isle", "Amsterdam", "Bogota", "Bangkok", "Jamaica", "Tokyo", "Dubai", "San Francisco", "Mexico City", "Marseille", "Farm", "Shipping Port", "Air Cargo", "Compound"];
var LS = ["Ghetto", "Downtown", "Suburbs", "Docks", "Island", "Amsterdam", "Bogota", "Bangkok", "Jamaica", "Tokyo", "Dubai", "San Fran", "Mexico", "Marseille", "Farm", "Port", "Air Cargo", "Compound"];
var CC = ["GHT", "DWN", "SUB", "DCK", "ISL", "AMS", "BOG", "BKK", "JAM", "TYO", "DXB", "SFO", "MEX", "MRS"];
var PHN = ["MORN", "DAY", "NITE"];
var ZN = [0, 0, 0, 0, 1, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 5, 3, 3];
var FARM = 14, PORT = 15, AIRP = 16, COMP = 17, UNL_PORT = 25000000, UNL_AIR = 35000000, UNL_COMP = 50000000;
var LM = [[100, 100, 100, 90, 100, 100], [90, 110, 110, 110, 120, 125], [120, 110, 100, 100, 100, 100], [100, 100, 100, 100, 110, 110],
  [80, 100, 100, 100, 80, 70], [45, 60, 100, 120, 130, 140], [90, 100, 90, 100, 100, 45], [100, 90, 100, 100, 50, 100], [35, 80, 100, 110, 120, 130],
  [150, 120, 110, 100, 140, 140], [160, 130, 120, 130, 150, 160], [110, 90, 60, 100, 100, 110], [90, 50, 100, 90, 100, 70], [120, 100, 100, 100, 50, 100],
  [100, 100, 100, 100, 100, 100], [100, 100, 100, 100, 100, 100], [100, 100, 100, 100, 100, 100], [100, 100, 100, 100, 100, 100]];
var lmi;
for (lmi = 0; lmi < LM.length; lmi++) { LM[lmi].push(100); LM[lmi].push(100); LM[lmi].push(100); }
LM[14][6] = 55; LM[14][7] = 60; LM[5][6] = 60; LM[8][6] = 70; LM[12][7] = 50; LM[6][7] = 80;
LM[5][8] = 140; LM[8][8] = 160; LM[4][8] = 130; LM[12][8] = 110; LM[9][8] = 90;
var FD = [{ name: "METH LAB", drug: 3, cost: 15000, rate: 2 }, { name: "GROW HOUSE", drug: 0, cost: 3000, rate: 6 }, { name: "COKE LAB", drug: 5, cost: 40000, rate: 1 },
  { name: "ACID LAB", drug: 2, cost: 30000, rate: 4 }, { name: "PILL PRESS", drug: 1, cost: 12000, rate: 8 }, { name: "HEROIN LAB", drug: 4, cost: 150000, rate: 2 },
  { name: "MUSHROOM FARM", drug: 8, cost: 45000, rate: 5 }];
var FACI = [0, -1, 1, -1, 2, -1, -1, -1, 6, -1, -1, 3, 4, 5, -1, -1, -1, -1];
var SPT = ["SEL: Enter the METH LAB", "SEL: Enter the BANK", "SEL: Enter the GROW HOUSE", "SEL: HEIST - rob the warehouse",
  "SEL: Enter the COKE LAB", "SEL: HEIST - rob the coffee shop", "SEL: HEIST - rob the market", "SEL: HEIST - rob the night shop", "SEL: Enter the MUSHROOM FARM",
  "SEL: HEIST - rob the pachinko hall", "SEL: HEIST - rob the gold souk", "SEL: Enter the ACID LAB", "SEL: Enter the PILL PRESS", "SEL: Enter the HEROIN LAB",
  "SEL: Enter the FARM", "SEL: Enter the SHIPPING PORT", "SEL: Enter AIR CARGO", "SEL: Enter the COMPOUND"];
var TRN = ["SEL: Take the bus out of town", "SEL: Take the bus out of town", "SEL: Take the bus out of town", "SEL: Go to the pier - boat or bus",
  "SEL: Go to the pier - boat", "SEL: Go to the airport", "SEL: Go to the airport", "SEL: Go to the airport", "SEL: Go to the airport", "SEL: Go to the airport", "SEL: Go to the airport", "SEL: Go to the airport", "SEL: Go to the airport", "SEL: Go to the airport", "SEL: Catch the bus to town", "SEL: Board a boat", "SEL: Go to the airport", "SEL: Enter the travel building"];

TRN[14] = "SEL: Take the bus back to town"; TRN[15] = "SEL: Board the cargo ship"; TRN[16] = "SEL: Go to the airstrip"; TRN[17] = "SEL: Take the helicopter";
function newGame() {
  G.cash = 2500; G.debt = 5000; G.day = 1; G.ph = 0; G.loc = 0; G.hp = 100; G.heat = 0; G.prot = 0; G.cap = 500; G.priors = 0; G.over = 0; G.bank = 0; G.mask = 0; G.closet = 0; G.outfit = 0; G.unl = 0; G.pack = 0; G.duf = 0; G.runner = 0; G.tx = [];
  G.brothel = 0; G.hookN = 0; G.brothCash = 0; G.runnerGone = 0; G.runnerGoneAt = 0; G.hookVis = 0;
  G.unp = 0; G.una = 0; G.unc = 0; G.farm = [0, 1, 0, 0]; G.dem = [];
  G.port = [0, 0, 0, 0, 0, 0, 0, 0, 0]; G.airh = [0, 0, 0, 0, 0, 0, 0, 0, 0]; G.comp = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  G.inv = [0, 0, 0, 0, 0, 0, 0, 0, 0]; G.pr = [0, 0, 0, 0, 0, 0, 0, 0, 0]; G.fac = [[0, 1, 0], [0, 1, 0], [0, 1, 0], [0, 1, 0], [0, 1, 0], [0, 1, 0], [0, 1, 0]];
  MSGS = []; qReset();
  newPrices(); MSGS = [];
}
newGame();
function used() { var i, s = 0; for (i = 0; i < NDRUG; i++) { s += G.inv[i]; } return s; }
function capTot() { return Math.min(1000, G.cap + (G.pack ? 150 : 0) + (G.duf ? 250 : 0)); }   /* hard limit: 1000 units in total */
function freeSp() { return capTot() - used(); }
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
function newPrices() {
  var i, m;
  for (i = 0; i < NDRUG; i++) {
    m = LM[G.loc][i] / 100;
    if (rnd() < 0.1) { G.pr[i] = 0; } else { G.pr[i] = Math.max(2, Math.floor((DLO[i] + rnd() * (DHI[i] - DLO[i])) * m)); }
  }
  if (rnd() < 0.25) {
    i = ri(0, NDRUG - 1);
    if (rnd() < 0.5) { G.pr[i] = Math.floor(DHI[i] * ri(16, 28) / 10); MSGS.push("Cops busted " + DRUG[i] + " dealers! Prices way up"); }
    else { G.pr[i] = Math.max(2, Math.floor(DLO[i] * ri(3, 6) / 10)); MSGS.push("Junkies dumping " + DRUG[i] + " cheap!"); }
  }
}
function advancePhase() {
  var i, f, d, p;
  G.ph++;
  if (G.ph > 2) { G.ph = 0; G.day++; if (G.day % 2 == 0) { genDemand(); } if (G.cash > 2000000000) { G.cash = 2000000000; } if (G.bank > 2000000000) { G.bank = 2000000000; } if (G.debt > 0) { G.debt = Math.floor(G.debt * (1 + SHARK)); } }
  G.hp = Math.min(100, G.hp + 3); if (G.prot > 0) { G.prot--; } if (G.heat > 0) { G.heat = Math.max(0, G.heat - 3); }
  if (G.brothel) {
    p = ri(800, 2500) + G.day * 15;
    G.brothCash += p;
    if (G.runner && !G.runnerGone) { MSGS.push("Brothel earned " + mny(p) + " (runner will collect)"); }
    else { MSGS.push("Brothel earned " + mny(p) + " - waiting for pickup"); }
  }
  for (i = 0; i < 7; i++) {
    f = G.fac[i];
    if (f[0]) {
      d = FD[i]; p = d.rate * f[1]; f[2] = Math.min(p * 8, f[2] + p);
      if (G.ph == 2 && f[2] > 0 && rnd() < 0.08 + G.heat / 500) { f[2] = 0; G.heat = Math.min(100, G.heat + 8); MSGS.push("Cops raided your " + d.name + "!"); }
    }
  }
  if (G.farm[0]) { G.farm[2] = Math.min(96 * G.farm[1], G.farm[2] + 12 * G.farm[1]); G.farm[3] = Math.min(64 * G.farm[1], G.farm[3] + 8 * G.farm[1]); }
  return G.day > DAYS;
}

/* ---------- save / load : 3 named slots ---------- */
function pint(v, lo, hi, d) { v = parseInt(v, 10); return (v >= lo && v <= hi) ? v : d; }
var NSLOT = 3, CUR = -1, CURNAME = "";
function slotPath(i) { return "/dopewars_slot" + (i + 1) + ".txt"; }
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
/* writes, then READS IT BACK. returns "sd", "littlefs" or "" (failed) */
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
function txStr() {
  var o = [], i;
  for (i = 0; i < G.tx.length; i++) { o.push(G.tx[i].t + ":" + G.tx[i].a + ":" + G.tx[i].d); }
  return o.join(";");
}
function txLoad(str) {
  var parts, q, i, n = [];
  if (!str) { return n; }
  parts = str.split(";");
  for (i = 0; i < parts.length && n.length < 10; i++) {
    q = parts[i].split(":");
    if ((q[0] == "D" || q[0] == "W") && pint(q[1], 1, 2000000000, 0) > 0) { n.push({ t: q[0], a: pint(q[1], 1, 2000000000, 0), d: pint(q[2], 1, DAYS, 1) }); }
  }
  return n;
}
function gameStr() {
  return [G.cash, G.debt, G.day, G.ph, G.loc, G.hp, G.heat, G.prot, G.cap, G.priors, HI, 0, G.bank, G.mask ? 1 : 0, G.unl ? 1 : 0, G.pack ? 1 : 0, G.duf ? 1 : 0, G.runner ? 1 : 0, (G.brothel ? 1 : 0), G.closet ? 1 : 0, G.outfit].join(",") + "|" + G.inv.join(",") + "|" +
    G.fac[0].join(",") + "," + G.fac[1].join(",") + "," + G.fac[2].join(",") + "," + G.fac[3].join(",") + "," + G.fac[4].join(",") + "," + G.fac[5].join(",") + "," + G.fac[6].join(",") + "|" + G.pr.join(",") + "|" + txStr() + "|" +
    [G.unp, G.una, G.unc, G.farm[0], G.farm[1], G.farm[2], G.farm[3], G.hookN, G.brothCash, G.runnerGone].join(",") + "|" + G.port.join(",") + "|" + G.airh.join(",") + "|" + G.comp.join(",") + "|" + demStr();
}
/* returns null for an empty slot, else {name, data} */
function slotRead(i) {
  var d = rdFile(slotPath(i)), h;
  if (d.length >= 3) {
    h = d.indexOf("#");
    if (h >= 0 && d.indexOf("|") > h) { return { name: d.substring(0, h) || ("SLOT " + (i + 1)), data: d.substring(h + 1) }; }
  }
  if (i == 0) {                                   /* old single-save file from earlier versions */
    d = rdFile("/dopewars_save.txt");
    if (d.indexOf("|") > 0 && d.substring(0, 3) != "HI,") { return { name: "OLD SAVE", data: d }; }
  }
  return null;
}
function slotLabel(i, info) {
  var a;
  if (!info) { return (i + 1) + "  - empty -"; }
  a = info.data.split("|")[0].split(",");
  return (i + 1) + " " + info.name + " D" + pint(a[2], 1, 99, 1) + " " + mnyS(pint(a[0], 0, 2000000000, 0));
}
function wrSlot(i, name) { return wrFile(slotPath(i), cleanName(name) + "#" + gameStr()); }
/* silent save into the slot you are playing (autosave / save & quit) */
function saveGame() { if (CUR < 0) { return ""; } return wrSlot(CUR, CURNAME); }
function saveHi() { wrFile("/dopewars_hi.txt", "HI," + HI); }
function loadHi() {
  var d = rdFile("/dopewars_hi.txt");
  if (d.substring(0, 3) != "HI,") { d = rdFile("/dopewars_save.txt"); }
  if (d.substring(0, 3) == "HI,") { HI = pint(d.substring(3), 0, 2000000000, 0); }
}
function loadData(d) {
  var p, a, b, c, e, i, q;
  try {
    p = d.split("|"); a = p[0].split(","); b = p[1].split(","); c = p[2].split(","); e = p[3].split(",");
    newGame();
    G.cash = pint(a[0], 0, 2000000000, 2500); G.debt = pint(a[1], 0, 2000000000, 5000); G.day = pint(a[2], 1, DAYS, 1);
    G.ph = pint(a[3], 0, 2, 0); G.loc = pint(a[4], 0, LOCN.length - 1, 0); G.hp = pint(a[5], 1, 100, 100); G.heat = pint(a[6], 0, 100, 0);
    G.prot = pint(a[7], 0, 9, 0); G.cap = parseInt(a[8], 10); if (!(G.cap >= 500)) { G.cap = 500; } if (G.cap > 600) { G.cap = 600; } G.priors = pint(a[9], 0, 99, 0);
    i = pint(a[10], 0, 2000000000, 0); if (i > HI) { HI = i; }
    G.bank = pint(a[12], 0, 2000000000, 0); G.mask = (a[13] == "1") ? 1 : 0;
    G.unl = (a[14] == "1") ? 1 : 0; G.pack = (a[15] == "1") ? 1 : 0; G.duf = (a[16] == "1") ? 1 : 0; G.runner = (a[17] == "1") ? 1 : 0;
    G.brothel = (a[18] == "1") ? 1 : 0;
    G.closet = (a[19] == "1") ? 1 : 0; G.outfit = pint(a[20], 0, OUT.length - 1, 0); setPals();
    G.tx = txLoad(p[4]); if (G.bank >= UNL_BANK) { G.unl = 1; }
    for (i = 0; i < NDRUG; i++) { G.inv[i] = pint(b[i], 0, 99999, 0); G.pr[i] = pint(e[i], 0, 99999999, 0); }
    if (p[5]) {
      q = p[5].split(","); G.unp = (q[0] == "1") ? 1 : 0; G.una = (q[1] == "1") ? 1 : 0; G.unc = (q[2] == "1") ? 1 : 0;
      G.farm = [pint(q[3], 0, 1, 0), pint(q[4], 1, 5, 1), pint(q[5], 0, 480, 0), pint(q[6], 0, 320, 0)];
      G.hookN = pint(q[7], 0, 99, 0); G.brothCash = pint(q[8], 0, 2000000000, 0); G.runnerGone = pint(q[9], 0, 1, 0);
      if (G.runnerGone) { G.runnerGoneAt = pollN; }
      q = (p[6] || "").split(","); for (i = 0; i < NDRUG; i++) { G.port[i] = pint(q[i], 0, 99999999, 0); }
      q = (p[7] || "").split(","); for (i = 0; i < NDRUG; i++) { G.airh[i] = pint(q[i], 0, 99999999, 0); }
      q = (p[8] || "").split(","); for (i = 0; i < NDRUG; i++) { G.comp[i] = pint(q[i], 0, 99999999, 0); }
      G.dem = demLoad(p[9]);
    }
    if (G.bank >= UNL_PORT) { G.unp = 1; } if (G.bank >= UNL_AIR) { G.una = 1; } if (G.bank >= UNL_COMP) { G.unc = 1; }
    for (i = 0; i < 7; i++) { if (c.length >= i * 3 + 3) { G.fac[i] = [pint(c[i * 3], 0, 1, 0), pint(c[i * 3 + 1], 1, 10, 1), pint(c[i * 3 + 2], 0, 9999, 0)]; } }
    return true;
  } catch (e3) { newGame(); return false; }
}
function anySaved() { var i; for (i = 0; i < NSLOT; i++) { if (slotRead(i)) { return true; } } return false; }

/* slot picker: returns 0..2 or -1 (ESC) */
function slotMenu(title, idx, saving) {
  var items = [], hints = [], i, inf;
  for (i = 0; i < NSLOT; i++) {
    inf = slotRead(i); items[i] = slotLabel(i, inf);
    hints[i] = inf ? (saving ? "Used - you will confirm first" : "Load this saved game") : (saving ? "Empty slot - safe to use" : "Nothing saved here");
  }
  return menu(title, items, idx, hints);
}
/* knob name entry. returns the name, "" if left blank, or null if cancelled */
var NCH = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z",
  "0","1","2","3","4","5","6","7","8","9"," ","."," < DEL "," OK >"];
function askName(title, init) {
  var nm = cleanName(init), ci = 0, dirty = true, k, n = NCH.length, c0, c1, c2;
  menuMode(); drainEnc(); lockEnc(ENC_GAP_MS);
  while (true) {
    if (dirty) {
      cls(DARK); fr(0, 0, W, 22, HDR); txt(title, 6, 4, 2, WHITE);
      txt("Name:", 8, 36, 2, rgb(170, 210, 240));
      fr(8, 56, W - 16, 26, BLACK); rc(8, 56, W - 16, 26, GRAY);
      txt(nm + "_", 14, 61, 2, YEL);
      c0 = NCH[(ci + n - 1) % n]; c1 = NCH[ci]; c2 = NCH[(ci + 1) % n];
      fr(60, 100, W - 120, 32, rgb(40, 120, 190));
      ctxt(c1, 107, 2, WHITE);
      txt(c0, 20, 110, 1, GRAY); txt(c2, W - 70, 110, 1, GRAY);
      fr(0, H - 14, W, 14, rgb(6, 12, 24));
      txt("Turn: pick  SEL: add/ok  ESC: cancel", 4, H - 11, 1, HINT);
      dirty = false;
    }
    k = inpMenu();
    if (k == 1) { ci = (ci + 1) % n; dirty = true; settleInput(); continue; }
    else if (k == 2) { ci = (ci + n - 1) % n; dirty = true; settleInput(); continue; }
    else if (k == 3) {
      settleInput();
      if (ci == n - 1) { return nm; }
      if (ci == n - 2) { if (nm.length > 0) { nm = nm.substring(0, nm.length - 1); } }
      else if (nm.length < 10) { nm += NCH[ci]; }
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
/* SAVE: pick a slot, name it, confirm, write, then tell where it went */
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
/* LOAD: returns true if a game was loaded */
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

/* ---------- HUD ---------- */
function hud() {
  fr(0, 0, W, 14, rgb(10, 10, 24));
  txt(mnyS(G.cash), 3, 3, 1, GREEN); txt("B" + mnyS(G.bank), 54, 3, 1, CYAN);
  txt("D" + G.day + " " + PHN[G.ph], 108, 3, 1, YEL);
  txt("HP" + G.hp, 164, 3, 1, G.hp > 40 ? WHITE : RED); txt("H", 196, 3, 1, ORNG);
  rc(204, 3, 32, 8, GRAY); fr(205, 4, Math.floor(30 * G.heat / 100), 6, G.heat > 66 ? RED : ORNG);
  txt(LS[G.loc], 242, 3, 1, G.mask ? RED : CYAN);
}
function bar(msg, col) {
  fr(0, 158, W, 12, rgb(10, 10, 24));
  msg = String(msg); if (msg.length > 38) { msg = msg.substring(0, 38); }
  txt(msg, 4, 161, 1, col);
  txt("SPC " + used() + "/" + capTot(), 240, 161, 1, GRAY);
}
function redrawAll() { hud(); fullPaint(); }
function walkMode() { ENC_GAP_MS = 35; ENC_REV_MS = 90; SEL_HOLD_MS = 200; encOn(); }
function menuMode() { ENC_GAP_MS = MENU_GAP; ENC_REV_MS = MENU_REV; SEL_HOLD_MS = 200; encOn(); }
var WACC = 0;
/* the walk cycle advances with DISTANCE (every 9px), not every frame,
   so legs and body don't jitter however fast the knob is turned */
function moveP(nx) {
  var ox = PX; PX = nx; WACC += Math.abs(nx - ox);
  if (WACC >= 9) { WACC -= 9; PWK = (PWK + 1) & 3; }
  updPlayer();
}
function walkTo(tx, sp) {
  var d, s;
  while (PX != tx) { d = (tx > PX) ? 1 : -1; PF = d; s = Math.min(sp, Math.abs(tx - PX)); moveP(PX + d * s); wait(10); }
  PWK = 0; updPlayer();
}
function pop(a, b, c, col) { popup([[a, 2, col], [b, 1, WHITE], [c, 1, WHITE]], col); }

/* ==========================================================
   TRIVIA  (Wanna Be A Millionaire style)
   ========================================================== */
var QP = [
  'What is the capital of Japan?|Tokyo|Kyoto|Osaka|Seoul', 'Which planet is closest to the Sun?|Mercury|Venus|Mars|Earth',
  'How many sides does a hexagon have?|Six|Five|Seven|Eight', 'Who painted the Mona Lisa?|Da Vinci|Picasso|Van Gogh|Monet',
  'What is H2O commonly known as?|Water|Salt|Hydrogen|Acid', 'Which country is home to the kangaroo?|Australia|Brazil|India|Canada',
  'What is the largest mammal?|Blue whale|Elephant|Giraffe|Shark', 'In what year did the Titanic sink?|1912|1905|1920|1898',
  'How many players are on a soccer team?|Eleven|Nine|Ten|Twelve', 'What is the currency of the UK?|Pound|Euro|Dollar|Franc',
  'Which metal is liquid at room temp?|Mercury|Iron|Gold|Copper', 'Who was the first US president?|Washington|Lincoln|Adams|Jefferson',
  'What is the hardest natural substance?|Diamond|Gold|Quartz|Steel', 'Which ocean is the largest?|Pacific|Atlantic|Indian|Arctic',
  'How many continents are there?|Seven|Five|Six|Eight', 'What language is spoken in Brazil?|Portuguese|Spanish|French|English',
  'What gas do we breathe in to live?|Oxygen|Helium|Nitrogen|Neon', 'Which animal is fastest on land?|Cheetah|Lion|Horse|Greyhound',
  'How many minutes are in two hours?|120|90|100|140', 'What is the capital of Colombia?|Bogota|Lima|Quito|Caracas',
  'What is the capital of Thailand?|Bangkok|Hanoi|Manila|Jakarta', 'What is the capital of Jamaica?|Kingston|Nassau|Havana|Port-au-Prince', 'Amsterdam is the capital of which country?|Netherlands|Belgium|Denmark|Germany',
  'What is the chemical symbol for gold?|Au|Ag|Gd|Go', 'Which planet has famous rings?|Saturn|Mars|Venus|Mercury',
  'Who wrote Romeo and Juliet?|Shakespeare|Dickens|Twain|Homer', 'What is 12 multiplied by 12?|144|124|132|154',
  'What do bees make?|Honey|Silk|Milk|Sugar', 'Which is the longest river in Africa?|Nile|Congo|Niger|Zambezi',
  'What is the tallest mountain on Earth?|Everest|K2|Denali|Kilimanjaro', 'How many strings on a standard guitar?|Six|Four|Five|Eight',
  'Mixing red and blue makes what color?|Purple|Green|Orange|Brown', 'Which country gave the Statue of Liberty?|France|Spain|England|Italy',
  'What is the freezing point of water in C?|0|10|32|-10', 'Which bird is a symbol of peace?|Dove|Eagle|Owl|Hawk',
  'What is the square root of 81?|9|8|7|11', 'Who is linked to the falling apple?|Newton|Einstein|Galileo|Tesla',
  'Which sport uses a puck?|Hockey|Golf|Tennis|Baseball', 'How many days are in a leap year?|366|365|364|367',
  'Which organ pumps blood?|Heart|Liver|Lungs|Kidney', 'Main ingredient in guacamole?|Avocado|Tomato|Lime|Onion',
  'Largest planet in our solar system?|Jupiter|Saturn|Neptune|Earth', 'Rio de Janeiro is in which country?|Brazil|Mexico|Peru|Chile'
];
var QBX = [6, 164, 6, 164], QBY = [84, 84, 124, 124];
var QNAVY = rgb(10, 20, 110), QEDGE = rgb(120, 160, 255), QGOLD = rgb(255, 195, 50);
function wrapT(s, n) {
  var out = [], cur = "", w = s.split(" "), i;
  for (i = 0; i < w.length; i++) {
    if (cur.length > 0 && cur.length + w[i].length + 1 > n) { out.push(cur); cur = w[i]; }
    else { cur = (cur.length > 0) ? cur + " " + w[i] : w[i]; }
  }
  out.push(cur);
  return out;
}
function qBox(i, st, a) {
  var fill = QNAVY, bd = QEDGE, tc = WHITE;
  if (st == 1) { fill = QGOLD; bd = WHITE; tc = BLACK; }
  else if (st == 2) { fill = rgb(255, 120, 0); bd = WHITE; tc = WHITE; }
  else if (st == 3) { fill = rgb(0, 170, 60); bd = WHITE; tc = WHITE; }
  else if (st == 4) { fill = rgb(210, 30, 40); bd = WHITE; tc = WHITE; }
  fr(QBX[i], QBY[i], 150, 34, fill); rc(QBX[i], QBY[i], 150, 34, bd);
  txt(String.fromCharCode(65 + i) + ": " + a, QBX[i] + 8, QBY[i] + 13, 1, tc);
}
function quiz(title, sub) {
  var qi = ri(0, QP.length - 1), tries = 0, p, a, c0, i, j, t, sel = 0, k, L, sz;
  while (QU[qi] && tries < 90) { qi = ri(0, QP.length - 1); tries++; }
  if (tries >= 90) { qReset(); }
  QU[qi] = 1;
  p = QP[qi].split("|"); a = [p[1], p[2], p[3], p[4]];
  for (i = 3; i > 0; i--) { j = ri(0, i); t = a[i]; a[i] = a[j]; a[j] = t; }
  for (i = 0; i < 4; i++) { if (a[i] == p[1]) { c0 = i; } }
  menuMode();
  cls(rgb(8, 6, 44));
  fr(0, 0, W, 16, rgb(80, 0, 100)); txt(title, 6, 4, 1, QGOLD); txt(sub, W - 6 * sub.length - 6, 4, 1, WHITE);
  fr(6, 22, 308, 56, QNAVY); rc(6, 22, 308, 56, QEDGE); rc(7, 23, 306, 54, QGOLD);
  L = wrapT(p[0], 24); sz = 2;
  if (L.length > 3) { L = wrapT(p[0], 48); sz = 1; }
  for (i = 0; i < L.length; i++) { ctxt(L[i], (sz == 2) ? 30 + i * 17 : 34 + i * 12, sz, WHITE); }
  for (i = 0; i < 4; i++) { qBox(i, i == sel ? 1 : 0, a[i]); }
  txt("Turn: pick   SEL: lock answer", 62, 161, 1, GRAY);
  while (true) {
    k = inp();
    if (k == 1 || k == 2) {
      qBox(sel, 0, a[sel]); sel = (k == 1) ? (sel + 1) & 3 : (sel + 3) & 3; qBox(sel, 1, a[sel]); settleInput();
    } else if (k == 3) { drainEnc(); break; }
    wait(45);
  }
  qBox(sel, 2, a[sel]); wait(800);
  qBox(c0, 3, a[c0]);
  if (sel != c0) { qBox(sel, 4, a[sel]); } else { }
  wait(1300); settleInput();
  return sel == c0;
}

/* ==========================================================
   DEALING
   ========================================================== */
function trade(i) {
  var idx = 0, r, q, mx, items = ["Buy 1", "Buy 10", "Buy 100", "Buy Max", "Sell 1", "Sell 10", "Sell 100", "Sell All", "Back"], h, g;
  while (true) {
    h = "Have " + G.inv[i] + "  Cash " + mnyS(G.cash) + "  Space " + freeSp();
    r = menu(DRUG[i] + " " + mny(G.pr[i]), items, idx, [h, h, h, h, h, h, h, h, h]);
    if (r < 0 || r == 8) { return; }
    idx = r; q = [1, 10, 100, 99999][r % 4];
    if (r < 4) {
      mx = Math.min(q, Math.floor(G.cash / G.pr[i]), freeSp());
      if (mx <= 0) { flash(freeSp() <= 0 ? "No room in coat!" : "Not enough cash", RED); }
      else { G.cash -= mx * G.pr[i]; G.inv[i] += mx; }
    } else {
      mx = Math.min(q, G.inv[i]);
      if (mx <= 0) { flash("None to sell", RED); }
      else {
        g = mx * G.pr[i]; G.cash += g; G.inv[i] -= mx; if (g >= 4000) { G.heat = Math.min(100, G.heat + 2); }
        flash("+" + mny(g), GREEN);
      }
    }
  }
}
function market() {
  var idx = 0, r, items, hints, i, ex, a, sellAll = false, total = 0, sold = 0, g;
  while (true) {
    items = []; hints = [];
    for (i = 0; i < NDRUG; i++) {
      items.push(DRUG[i] + (G.pr[i] > 0 ? " " + mny(G.pr[i]) : " --") + " x" + G.inv[i]);
      hints.push(G.pr[i] > 0 ? "Street price " + mny(G.pr[i]) + " each - you hold " + G.inv[i] : "Nobody is dealing this here today");
    }
    /* Sell ALL from person only (not warehouse) — unlocked when World Tour + Farm + Runner */
    sellAll = (G.unl && G.farm[0] && G.runner);
    if (sellAll) {
      total = 0;
      for (i = 0; i < NDRUG; i++) { if (G.pr[i] > 0 && G.inv[i] > 0) { total += G.inv[i] * G.pr[i]; } }
      items.push("Sell ALL supplies " + (total > 0 ? mnyS(total) : ""));
      hints.push("Dump everything you are carrying (person only, no warehouse)");
    }
    ex = [];
    if (G.cap < 600) { items.push("Bigger coat +50 $1500"); hints.push("More pockets. Coat holds " + G.cap); ex.push(0); }
    if (!G.pack) { items.push("BACKPACK +150 $5,000"); hints.push("Carry more. Space now " + capTot()); ex.push(1); }
    if (!G.duf) { items.push("DUFFLE BAG +250 $20,000"); hints.push("Huge bag. Space now " + capTot()); ex.push(2); }
    items.push("Leave"); hints.push("Back to the street");
    r = menu(mnyS(G.cash) + "  SPC " + freeSp(), items, idx, hints);
    if (r < 0 || r == items.length - 1) { return; }
    idx = r;
    if (r < NDRUG) { if (G.pr[r] <= 0) { flash("Not available", RED); } else { trade(r); } }
    else if (sellAll && r == NDRUG) {
      sold = 0; g = 0;
      for (i = 0; i < NDRUG; i++) {
        if (G.pr[i] > 0 && G.inv[i] > 0) {
          g += G.inv[i] * G.pr[i];
          sold += G.inv[i];
          G.inv[i] = 0;
        }
      }
      if (sold <= 0) { flash("Nothing to sell", RED); }
      else {
        G.cash += g;
        if (g >= 4000) { G.heat = Math.min(100, G.heat + Math.min(15, Math.floor(g / 8000))); }
        flash("Sold all: +" + mny(g), GREEN);
      }
    }
    else {
      a = ex[r - NDRUG - (sellAll ? 1 : 0)];
      if (a == 0) { if (G.cash >= 1500) { G.cash -= 1500; G.cap += 50; flash("Coat holds " + G.cap, GREEN); } else { flash("Need $1500", RED); } }
      else if (a == 1) { if (G.cash >= 5000) { G.cash -= 5000; G.pack = 1; flash("Backpack! Space " + capTot(), GREEN); } else { flash("Need $5,000", RED); } }
      else { if (G.cash >= 20000) { G.cash -= 20000; G.duf = 1; flash("Duffle! Space " + capTot(), GREEN); } else { flash("Need $20,000", RED); } }
    }
  }
}
function sharkMenu() {
  var idx = 0, r, a;
  while (true) {
    r = menu("DEBT " + mny(G.debt), ["Pay $500", "Pay $5,000", "Pay ALL", "Borrow $2,000", "Leave"], idx,
      ["Cash " + mny(G.cash) + "  Shark charges " + SHARK_TXT + " a day", "Cash " + mny(G.cash), "Clear the whole debt", "Easy money, hard interest", "Back to the street"]);
    if (r < 0 || r == 4) { return; }
    idx = r;
    if (r < 3) {
      a = Math.min([500, 5000, 9999999999][r], G.cash, G.debt);
      if (a <= 0) { flash(G.debt <= 0 ? "You owe nothing" : "No cash", RED); } else { G.cash -= a; G.debt -= a; flash("Paid " + mny(a), GREEN); }
    } else if (G.debt > 40000) { flash("Shark says no", RED); }
    else { G.cash += 2000; G.debt += 2000; flash("+$2,000 borrowed", YEL); }
  }
}
function txAdd(t, amt) {
  var n = [{ t: t, a: amt, d: G.day }], i;
  for (i = 0; i < G.tx.length && n.length < 10; i++) { n.push(G.tx[i]); }
  G.tx = n;
}
function checkUnlock(announce) {
  if (!G.unl && G.bank >= UNL_BANK) {
    G.unl = 1;
    if (announce) { pop("WORLD TOUR UNLOCKED!", "$1,000,000 in the bank!", "5 new cities are open. Fly there!", GREEN); }
  }
  if (!G.unp && G.bank >= UNL_PORT) { G.unp = 1; if (announce) { pop("SHIPPING PORT OPEN!", "$25,000,000 in the bank!", "Ship product to any city worldwide.", GREEN); } }
  if (!G.una && G.bank >= UNL_AIR) { G.una = 1; if (announce) { pop("AIR CARGO OPEN!", "$35,000,000 in the bank!", "Smuggle product by air. Less risk.", GREEN); } }
  if (!G.unc && G.bank >= UNL_COMP) { G.unc = 1; if (announce) { pop("COMPOUND UNLOCKED!", "$50,000,000 in the bank!", "A secure fortress. Cops stay out.", GREEN); } }
}
function txScreen() {
  var i, y, e;
  cls(rgb(12, 12, 28)); txt("TRANSACTIONS", 6, 4, 2, YEL);
  txt("Balance " + mny(G.bank), 6, 24, 1, CYAN); txt("Last 10", 262, 24, 1, GRAY);
  if (G.tx.length == 0) { ctxt("No deposits or withdrawals yet", 80, 1, GRAY); }
  for (i = 0; i < G.tx.length; i++) {
    e = G.tx[i]; y = 38 + i * 11;
    txt("Day " + e.d, 6, y, 1, GRAY);
    txt(e.t == "D" ? "Deposit" : "Withdraw", 70, y, 1, e.t == "D" ? GREEN : ORNG);
    txt((e.t == "D" ? "+" : "-") + mny(e.a), 160, y, 1, e.t == "D" ? GREEN : ORNG);
  }
  txt("SEL to go back", 6, 154, 1, GRAY);
  waitKey();
}
function depositMenu() {
  var idx = 0, r, a, AM = [25000, 100000, 500000, 1000000, 10000000];
  while (true) {
    r = menu("DEPOSIT " + mnyS(G.bank), ["Deposit $25,000", "Deposit $100,000", "Deposit $500,000", "Deposit $1,000,000", "Deposit $10,000,000", "Deposit ALL cash", "Back"], idx,
      ["Cash " + mny(G.cash) + "  Bank " + mny(G.bank), "Safe from muggers and thieves", "Safe from muggers and thieves", "Safe from muggers and thieves", "Safe from muggers and thieves", "Minimum deposit is $25,000", "Back to the bank"]);
    if (r < 0 || r == 6) { return; }
    idx = r;
    a = (r < 5) ? AM[r] : G.cash;
    if (a < 25000) { flash(r < 5 ? "Not enough cash" : "Min deposit $25,000", RED); }
    else if (G.cash < a) { flash("Need " + mny(a) + " cash", RED); }
    else { G.cash -= a; G.bank += a; txAdd("D", a); flash("Deposited " + mnyS(a), GREEN); checkUnlock(true); }
  }
}
function withdrawMenu() {
  var idx = 0, r, a, AM = [25000, 100000, 1000000];
  while (true) {
    r = menu("WITHDRAW " + mnyS(G.bank), ["Withdraw $25,000", "Withdraw $100,000", "Withdraw $1,000,000", "Withdraw ALL", "Back"], idx,
      ["Balance " + mny(G.bank), "Balance " + mny(G.bank), "Balance " + mny(G.bank), "Take it all out", "Back to the bank"]);
    if (r < 0 || r == 4) { return; }
    idx = r;
    a = (r < 3) ? AM[r] : G.bank;
    if (G.bank <= 0) { flash("Bank is empty", RED); }
    else if (G.bank < a) { flash("Balance too low", RED); }
    else { G.bank -= a; G.cash += a; txAdd("W", a); flash("Withdrew " + mnyS(a), YEL); }
  }
}
/* returns true when the player should leave the bank */
function robBank() {
  var ch, loot, i;
  if (!confirm2("Rob the bank?", "Huge score - but the cops WILL hunt you", RED)) { return false; }
  for (i = 0; i < 4; i++) { }
  wait(500);
  ch = Math.max(35, 70 - G.heat / 5);
  if (rnd() * 100 < ch) {
    loot = ri(15000, 50000); G.cash += loot; G.heat = Math.min(100, G.heat + 30); G.mask = 1;
    
    pop("BANK JOB!", "You grabbed " + mny(loot), "Ski mask ON. Fly out to lose the cops!", GREEN);
  } else {
    G.heat = Math.min(100, G.heat + 15);
    copEncounter("ALARM! Bank cops are on you!");
  }
  return true;
}
function bank() {
  var idx = 0, r;
  while (true) {
    r = menu("BANK  " + mnyS(G.bank), ["Deposit", "Withdraw", "Transactions", "Loan shark", "ROB THE BANK!", "Leave"], idx,
      ["Cash " + mny(G.cash) + "  Balance " + mny(G.bank), "Balance " + mny(G.bank), "Your last 10 deposits and withdrawals", "Debt " + mny(G.debt), "Grab $15k-$50k. Risky!", G.unl ? "World tour unlocked" : "$1M in bank unlocks the world"]);
    if (r < 0 || r == 5) { return; }
    idx = r;
    if (r == 0) { depositMenu(); } else if (r == 1) { withdrawMenu(); } else if (r == 2) { txScreen(); } else if (r == 3) { sharkMenu(); }
    else { if (robBank()) { return; } }
  }
}
function factoryMenu(fi) {
  var idx = 0, r, f = G.fac[fi], d = FD[fi], items, hints, ucost, pr, q;
  while (true) {
    pr = d.rate * f[1]; ucost = Math.floor(d.cost * 0.6 * f[1]);
    if (!f[0]) {
      items = ["Buy " + d.name + " " + mny(d.cost), "Back"]; hints = ["Makes " + DRUG[d.drug] + " every part of the day", "Leave"];
    } else {
      items = ["Collect " + f[2] + " " + DRUG[d.drug], f[1] < 10 ? "Upgrade L" + f[1] + " " + mny(ucost) : "Lab is MAX level", "Makes " + pr + " per part of day", "Back"];
      hints = ["Stock holds up to " + (pr * 8) + ". Cops may raid at night", "Level " + f[1] + " of 10 - more output", "Level " + f[1] + " output (cap " + (pr * 8) + ")", "Leave"];
    }
    r = menu(d.name + " " + mnyS(G.cash), items, idx, hints);
    if (r < 0 || r == items.length - 1) { return; }
    idx = r;
    if (!f[0]) {
      if (G.cash >= d.cost) { G.cash -= d.cost; f[0] = 1; f[1] = 1; f[2] = 0; G.heat = Math.min(100, G.heat + 6); flash("You own it now!", GREEN); }
      else { flash("Need " + mnyS(d.cost), RED); }
    } else if (r == 0) {
      q = Math.min(f[2], freeSp());
      if (q <= 0) { flash(f[2] <= 0 ? "Nothing cooked yet" : "No room in coat!", RED); }
      else { f[2] -= q; G.inv[d.drug] += q; G.heat = Math.min(100, G.heat + 2); flash("Took " + q + " " + DRUG[d.drug], GREEN); }
    } else if (r == 1 && f[1] < 10) {
      if (G.cash >= ucost) { G.cash -= ucost; f[1]++; flash("Lab upgraded!", GREEN); } else { flash("Need " + mnyS(ucost), RED); }
    }
  }
}
function hospital() {
  var fee = Math.min(G.cash, 600);
  G.hp = 60; G.cash -= fee;
  pop("HOSPITAL", "You were beat half to death.", "Bill " + mny(fee) + ". Two parts of the day lost.", RED);
  if (advancePhase() || advancePhase()) { G.over = 1; }
}
function heist() {
  var ch, loot;
  if (!confirmBox("Rob this joint?")) { return; }
  wait(600);
  ch = 60 - G.heat / 4;
  if (rnd() * 100 < ch) {
    loot = ri(400, 1000) + G.day * 50; G.cash += loot; G.heat = Math.min(100, G.heat + 8);
    pop("SCORE!", "You grabbed " + mny(loot), "Now get out of there!", GREEN);
  } else { G.heat = Math.min(100, G.heat + 12); copEncounter("ALARM! The cops are on you!"); }
}
function doSpot(i) {
  var fi = FACI[G.loc];
  TR = "spot";
  menuMode();
  if (i == 0) { market(); }
  else if (i == 1) {
    /* Mushroom farm (fi==6) only appears after World Tour unlock */
    if (fi == 6 && !G.unl) { heist(); }
    else if (fi >= 0) { factoryMenu(fi); } else if (G.loc == 1) { bank(); } else if (G.loc == FARM) { farmMenu(); } else if (G.loc == PORT) { hubMenu(0); }
    else if (G.loc == AIRP) { hubMenu(1); } else if (G.loc == COMP) { compoundMenu(); } else { heist(); }
  }
  else { travelMenu(); }
  walkMode();
  if (G.over == 0 && MODE == 1) { redrawAll(); }
}

/* ==========================================================
   COPS AND JAIL
   ========================================================== */
function bribeCost() {
  var i, v = 0;
  for (i = 0; i < NDRUG; i++) { v += G.inv[i] * (DLO[i] + DHI[i]) / 2; }
  return Math.floor(250 + v * 0.04 + G.heat * 10);
}
function copLeave() {
  restore(25, 30, W - 50, 112);               /* wipe ONLY the message box (no full-screen repaint), then he walks off */
  bar("", GRAY);
  COPF = 1; while (COPX < W + 30) { COPX += 8; COPW = (COPW + 1) & 3; updCop(); wait(24); }
  COPX = -999; updCop(); SHOWM = true; upd(G_MARK);
}
function jailEscape(bribed) {
  var e;
  redrawAll();
  if (bribed) {
    walkTo(196, 6); wait(200);
    for (e = PX + 12; e < 270; e += 12) { ENV = e; upd(G_ENV); wait(25); }
    ENV = -1; upd(G_ENV); 
  } else { walkTo(196, 6); wait(200); }
  for (JD = 0; JD <= 144; JD += 24) { upd(G_JAIL); wait(40); }
  JD = 144; JG = true; walkTo(W + 24, 6);
  pop("FREE!", bribed ? "The corrupt guard took the cash" : "You did your time", "and let you walk. Don't get caught again.", GREEN);
}
function jail() {
  var n, bc, r, idx = 0, qd = 0, i, lost = 0, c, q;
  
  G.priors++;
  for (i = 0; i < NDRUG; i++) { lost += G.inv[i]; G.inv[i] = 0; }
  G.heat = Math.max(0, G.heat - 20);
  n = Math.min(9, 3 + Math.floor(G.heat / 25) + (G.priors > 2 ? 1 : 0));
  MODE = 4; SHOWM = false; COPX = -999; JD = 0; JG = true; ENV = -1; PF = 1; PX = 110; PWK = 0; PVIS = true;
  build(30, G.ph); hud(); fullPaint();
  menuMode();
  popup([["BUSTED!", 3, RED], ["Thrown in jail", 2, YEL], ["Stash seized: " + lost + " units", 1, WHITE], ["Sentence: " + n + " parts of the day", 1, WHITE]], RED);
  while (true) {
    bc = 500 + G.heat * 25 + G.priors * 200;
    r = menu("JAIL  sentence " + n, ["Bribe guard " + mny(bc), "Parole quiz (3 Qs)", "Do the time"], idx,
      ["Cash " + mny(G.cash) + " - crooked guards take cash", "Each right answer cuts the sentence", "Lose " + n + " parts of a day"]);
    if (r < 0) { continue; }
    idx = r;
    if (r == 0) {
      if (G.cash < bc) { flash("Can't afford it!", RED); continue; }
      G.cash -= bc; walkMode(); jailEscape(true); break;
    } else if (r == 1) {
      if (qd) { flash("Already tried", RED); continue; }
      qd = 1; c = 0;
      for (q = 0; q < 3; q++) { if (quiz("PAROLE BOARD", "Q" + (q + 1) + "/3")) { c++; } }
      n = Math.max(0, n - c);
      if (n == 0) { walkMode(); jailEscape(false); break; }
      pop("PAROLE DENIED", "Sentence cut to " + n, "Do the time or bribe the guard.", ORNG);
    } else {
      for (i = 0; i < n; i++) {
        bar("Doing time...  " + (i + 1) + " / " + n, YEL); wait(600);
        if (advancePhase()) { G.over = 1; break; }
      }
      if (G.over) { return; }
      walkMode(); jailEscape(false); break;
    }
  }
  if (G.over) { return; }
  G.loc = 1; newPrices(); enterTown(1, true); flushMsgs();
}
function shootCopAnim() {
  var i, gx, gy, cx, cy;
  walkMode(); redrawAll();
  gx = PX + (PF > 0 ? 12 : -18); gy = FY - 28;
  /* gun in hand */
  fr(gx, gy, 14, 4, rgb(40, 40, 48));
  fr(gx + (PF > 0 ? 12 : -2), gy - 1, 6, 6, rgb(60, 60, 70));
  wait(180);
  /* muzzle flash */
  for (i = 0; i < 4; i++) {
    fr(gx + (PF > 0 ? 16 : -8) - i, gy - 2 - i, 8 + i * 2, 8 + i, rgb(255, 220 - i * 40, 40));
    wait(30);
  }
  /* bullet streak toward cop */
  cx = COPX; cy = FY - 30;
  for (i = 0; i < 6; i++) {
    fr(gx + (PF > 0 ? 20 : -10) + (cx - gx) * i / 6, gy + (cy - gy) * i / 6, 3, 2, rgb(255, 240, 120));
    wait(18);
  }
  /* impact */
  for (i = 0; i < 5; i++) {
    fr(cx - 6 + i, cy - 8 + (i & 1) * 4, 4, 4, rgb(255, 40, 30));
    fr(cx + 4 - i, cy - 4, 3, 3, rgb(200, 20, 20));
    wait(25);
  }
  /* cop drops */
  COPX = -999; updCop();
  fr(cx - 10, FY - 8, 22, 6, rgb(30, 30, 40));
  wait(400);
}
function copEncounter(msg) {
  var r, bc, idx = 0, i, c, q, done = 0;
  MODE = 1; SHOWM = false; PX = 80; PF = 1; PWK = 0; COPX = 345; COPF = -1; COPW = 0;
  redrawAll(); walkMode();
  while (COPX > 185) { COPX -= 8; COPW = (COPW + 1) & 3; updCop(); wait(20); }
  for (i = 0; i < 6; i++) {
    fr(0, 14, 4, 144, (i & 1) ? RED : BLUE); fr(W - 4, 14, 4, 144, (i & 1) ? BLUE : RED); wait(20);
  }
  bar(msg, RED); wait(500);
  menuMode();
  while (!done) {
    bc = bribeCost();
    r = menu("BUSTED!  " + mnyS(G.cash), ["Run!", "Fight the cop", "Bribe cop " + mny(bc), "Talk it out (quiz)", "Shoot the cop!", "Surrender"], idx,
      ["Fast legs or a bad idea?", "He is armed. You are not.", "Crooked cops love cash", "2 right answers = you walk", "Heat +50%. Fly out to cool off!", "Go quietly to jail"]);
    if (r < 0) { continue; }
    idx = r;
    redrawAll();
    if (r == 0) {
      if (rnd() < 0.42 + (G.hp > 60 ? 0.1 : 0)) {
        PF = -1; walkMode(); walkTo(-30, 9); COPX = -999; G.heat = Math.min(100, G.heat + 10);
        enterTown(G.loc, true); done = 1; bar("You lost him in the alleys!", GREEN);
      } else { G.hp = Math.max(5, G.hp - 15); pop("TACKLED!", "The cop caught you. Ouch.", "HP -15", RED); jail(); done = 1; }
    } else if (r == 1) {
      if (rnd() < 0.3) { G.heat = Math.min(100, G.heat + 25); pop("KO!", "You knocked the cop out cold!", "Heat +25. Better disappear.", GREEN); walkMode(); copLeave(); done = 1; }
      else { G.hp = Math.max(5, G.hp - 25); pop("BEATEN DOWN", "The cop clubbed you.", "HP -25", RED); jail(); done = 1; }
    } else if (r == 2) {
      if (G.cash < bc) { pop("NO CASH", "The cop wants " + mny(bc), "You can't cover it.", ORNG); }
      else if (rnd() < 0.85) { G.cash -= bc; G.heat = Math.max(0, G.heat - 5); pop("CROOKED COP", "He pockets " + mny(bc), "and looks the other way.", GREEN); walkMode(); copLeave(); done = 1; }
      else { G.cash -= bc; pop("DOUBLE CROSS", "He took the cash AND", "slapped the cuffs on you!", RED); jail(); done = 1; }
    } else if (r == 3) {
      c = 0; for (q = 0; q < 2; q++) { if (quiz("TALK YOUR WAY OUT", "Q" + (q + 1) + "/2")) { c++; } }
      redrawAll();
      if (c == 2) { pop("SMOOTH TALKER", "The cop buys your story.", "You walk free.", GREEN); walkMode(); copLeave(); done = 1; }
      else if (c == 1) { q = Math.min(G.cash, Math.floor(bc / 2)); G.cash -= q; pop("HALF CONVINCED", "He fines you " + mny(q), "and lets you go.", ORNG); walkMode(); copLeave(); done = 1; }
      else { pop("BUSTED", "He is not buying it.", "", RED); jail(); done = 1; }
    } else if (r == 4) {
      /* SHOOT THE COP — dramatic, heat jumps 50%, must fly out */
      shootCopAnim();
      G.heat = Math.min(100, Math.floor(G.heat * 1.5) + 20);
      if (G.heat < 50) { G.heat = 50; }
      G.mask = 1;
      pop("COP DOWN!", "Heat up 50%! You are WANTED.", "Catch a PLANE overseas to lose the heat.", RED);
      walkMode(); done = 1;
      bar("Get to an airport. Fly out!", ORNG);
    } else { jail(); done = 1; }
  }
  walkMode();
}

/* ---------- the bus ---------- */
var BUSX = -999;
function bus(bx) {
  var i, w = (PH == 2) ? rgb(255, 225, 120) : K(150, 195, 230);
  bx = Math.floor(bx);
  R(bx - 54, FY - 2, 108, 3, rgb(18, 18, 24));
  R(bx - 52, FY - 40, 104, 36, K(235, 190, 30)); R(bx - 52, FY - 22, 104, 4, K(200, 60, 40)); R(bx - 52, FY - 8, 104, 4, K(120, 95, 15));
  for (i = 0; i < 5; i++) { R(bx - 28 + i * 15, FY - 36, 12, 12, w); }
  R(bx - 51, FY - 36, 8, 14, w); R(bx - 44, FY - 32, 13, 28, K(60, 60, 72)); R(bx - 42, FY - 30, 9, 14, w);
  R(bx - 52, FY - 16, 3, 5, rgb(255, 245, 160)); R(bx + 49, FY - 16, 3, 5, rgb(220, 40, 40)); R(bx - 50, FY - 44, 22, 4, rgb(255, 130, 40));
  Cc(bx - 32, FY - 3, 7, rgb(20, 20, 24)); Cc(bx + 30, FY - 3, 7, rgb(20, 20, 24)); Cc(bx - 32, FY - 3, 3, rgb(150, 150, 155)); Cc(bx + 30, FY - 3, 3, rgb(150, 150, 155));
}
function busAnim() {
  var ob, sp = 14, tx;
  SHOWM = false; PF = -1; PWK = 0; tx = PX + 40; BUSX = W + 140;
  fullPaint(); bar("Here comes the bus...", CYAN);
  while (BUSX > tx) {
    ob = BUSX; sp = Math.max(2, (BUSX - tx) / 6); BUSX -= sp;
    upd(G_BUS); wait(8);
  }
  wait(200); wait(60); wait(200);
  walkTo(PX - 10, 4); PVIS = false; updPlayer(); wait(350);
  sp = 1;
  while (BUSX > -140) {
    ob = BUSX; BUSX -= sp; sp = Math.min(16, sp + 1.2);
    upd(G_BUS); wait(8);
  }
  BUSX = -999; PVIS = true;
}

/* ==========================================================
   TRAVEL
   ========================================================== */
function boatAnim(dir) {
  var ob, sp, tgt;
  MODE = 2; SHOWM = false; JG = false; build(20, G.ph); hud(); BSP = 0; BOB = 0; ONB = false; PVIS = true; PWK = 0;
  if (dir == 0) {
    BXP = 214; PX = -24; PF = 1; fullPaint(); bar("Heading for the pier...", CYAN);
    walkTo(244, 7); ONB = true; upd(G_VEH); updPlayer(); wait(150); wait(200);
    sp = 2;
    while (BXP < W + 100) {
      ob = BXP; BXP += sp; sp = Math.min(15, sp + 1.3); BSP = sp; BOB = (BOB == 0) ? 1 : 0; PX = BXP + 30;
      upd(G_VEH); wait(8);
    }
  } else {
    BXP = W + 40; ONB = true; PX = BXP + 30; PF = 1; BSP = 6; fullPaint(); bar("Land ahoy!", CYAN); 
    while (BXP > 206) {
      ob = BXP; sp = Math.max(2, (BXP - 206) / 7); BXP -= sp; BSP = sp; BOB = (BOB == 0) ? 1 : 0; PX = BXP + 30;
      upd(G_VEH); wait(10);
    }
    BXP = 206; BSP = 0; PX = 236; upd(G_VEH); wait(300);
    ONB = false; PF = -1; upd(G_VEH); updPlayer(); walkTo(-24, 7);
  }
}
function planeAnim(dir) {
  var ox, oy, v, t;
  MODE = 3; SHOWM = false; JG = false; build(21, G.ph); hud(); PLON = true; TILT = 0; STAIRS = false; PVIS = true; PWK = 0;
  if (dir == 0) {
    PLX = 170; PLY = 135; PX = -24; PF = 1; STAIRS = true; fullPaint(); bar("Boarding... have a nice flight!", CYAN);
    walkTo(PLX + 38, 7); PVIS = false; STAIRS = false; upd(G_VEH); updPlayer(); wait(400);
    v = 1;
    while (PLX < 236) { ox = PLX; PLX += v; v += 0.7; FR++; upd(G_VEH); wait(8); }
    v = 0; 
    while (PLX < W + 10 && PLY > -30) {
      ox = PLX; oy = PLY; PLX += 5; v += 1.0; PLY -= v; TILT = Math.min(3, TILT + 1); FR++;
      upd(G_VEH); wait(8);
    }
  } else {
    PLX = W + 10; PLY = 20; TILT = 0; PX = -50; PVIS = false; STAIRS = false; fullPaint(); bar("Touchdown ahead...", CYAN);
    t = 0; 
    while (t < 1) {
      ox = PLX; oy = PLY; t += 0.04; PLX = W + 10 - 190 * t; PLY = 20 + 115 * t; FR++;
      upd(G_VEH); wait(8);
    }
    PLX = W - 180; PLY = 135; v = 6;
    
    while (v > 0.5) { ox = PLX; PLX -= v; v *= 0.86; upd(G_VEH); wait(8); }
    STAIRS = true; PVIS = true; PX = PLX + 38; PF = 1; upd(G_VEH); updPlayer(); wait(300);
    walkTo(W + 24, 7);
  }
}
function route(a, b) {
  var za = ZN[a], zb = ZN[b];
  if (za == 0 && zb == 0) { return [0, 0]; }
  if (za == 4 || zb == 4) { return [0, 500]; }
  if (za == 5 || zb == 5) { return [1, 1500]; }
  if (za == 3 || zb == 3) { return [2, 1500]; }
  if (za == 2 || zb == 2) { return [2, 600]; }
  return [1, 150];
}
function enterTown(loc, walkIn) {
  TR = "enter";
  MODE = 1; G.loc = loc; SHOWM = true; SHOWD = true; PVIS = true; JG = false; COPX = -999; PF = 1; PWK = 0; FR = 0; MB = 0;
  SHOWD = (loc != COMP);
  if (loc == FARM || loc == COMP) { G.heat = 0; }          /* armed guards: the heat bar drops to nothing */
  /* woman on the street ~50% when you travel into the Ghetto */
  if (loc == 0) { G.hookVis = (rnd() < 0.5) ? 1 : 0; }
  else { G.hookVis = 0; }
  build(loc, G.ph); hud();
  if (walkIn) { PX = -24; fullPaint(); bar("Welcome to " + LOCN[loc], YEL); walkTo(90, 7); }
  else { PX = 90; fullPaint(); }
}
function travelMenu() {
  var items = [], dest = [], hints = [], t, rt, r, lab, lk;
  checkUnlock(true);
  for (t = 0; t < LOCN.length; t++) {
    if (t == G.loc) { continue; }
    rt = route(G.loc, t); lab = (rt[0] == 0) ? (rt[1] ? "BUS" : "WALK") : ((rt[0] == 1) ? "BOAT" : "PLANE"); lk = isLocked(t);
    items.push(LOCN[t] + (lk ? " LOCKED" : " " + lab + (rt[1] ? " $" + rt[1] : ""))); dest.push(t);
    hints.push(lk ? lockText(t) : "Every trip uses a part of the day. Cash " + mnyS(G.cash));
  }
  r = menu("TRAVEL " + mnyS(G.cash), items, 0, hints);
  if (r < 0) { return; }
  if (isLocked(dest[r])) { flash(dest[r] >= WORLD0 && dest[r] <= 13 ? "Need $1M in the bank" : "Locked - more in the bank", RED); return; }
  rt = route(G.loc, dest[r]);
  if (G.cash < rt[1]) { flash("Can't afford ticket", RED); return; }
  G.cash -= rt[1];
  doTravel(dest[r], rt[0]);
}
function doTravel(t, mode) {
  var i, p, c;
  TR = "travel";
  walkMode();
  if (mode == 0) { busAnim(); }
  else if (mode == 1) { boatAnim(0); } else { planeAnim(0); }
  if (advancePhase()) { G.over = 1; return; }
  G.loc = t; newPrices();
  if (t == FARM || t == COMP) { G.heat = 0; }
  if (mode == 2 && G.mask) { G.mask = 0; G.heat = 0; MSGS.push("Cops lost your trail overseas. Mask off!"); }
  if (mode == 0) { }
  if (mode == 1) { boatAnim(1); } else if (mode == 2) { planeAnim(1); }
  enterTown(t, true);
  saveGame();
  walkMode();
  flushMsgs();
  if (G.over) { return; }
  if (t == FARM || t == COMP) { if (MODE == 1) { redrawAll(); } return; }       /* guarded: no cops, no street trouble */
  /* heat from the cops */
  c = 6 + G.heat * 0.35 + used() * 0.12;
  if (G.ph == 2) { c += 6; } if (t == 0 || t == 3) { c += 4; } if (mode == 2) { c += 10; }
  if (used() == 0) { c *= 0.4; }
  if (G.prot > 0) { c = 0; }
  if (G.mask) { c = Math.max(c + 30, 50); }          /* bank robber: cops are on your trail */
  if (isSafe(t)) { c = 0; }                          /* farm + compound: nobody touches you */
  if (rnd() * 100 < Math.min(c, G.mask ? 85 : 60)) { copEncounter(mode == 2 ? "CUSTOMS! Open your bags!" : "HALT! POLICE! Freeze!"); if (G.over) { return; } }
  p = rnd();
  if (isSafe(t) && p >= 0.18 && p < 0.34) { p = 1; }
  if (p < 0.18) { streetQuiz(); } else if (p < 0.26) { mugging(); } else if (p < 0.34) { dirtyCop(); } else if (p < 0.40) { findStash(); }
  if (G.over == 0 && G.hp <= 5) { hospital(); }
  if (G.over == 0 && MODE == 1) { redrawAll(); }
}
function flushMsgs() {
  var i;
  menuMode();
  for (i = 0; i < MSGS.length; i++) { popup([["NEWS", 2, YEL], [MSGS[i], 1, WHITE]], ORNG); }
  MSGS = [];
  walkMode(); redrawAll();
}

/* ---------- random street events ---------- */
function streetQuiz() {
  var rw = 400 + G.day * 80, lose;
  menuMode();
  pop("STREET SMARTS", "A kingpin quizzes you.", "Right answer pays " + mny(rw), YEL);
  if (quiz("KINGPIN'S QUESTION", "WIN " + mny(rw))) { G.cash += rw; pop("RESPECT!", "+" + mny(rw), "The kingpin is impressed.", GREEN); }
  else { lose = Math.min(G.cash, 200 + G.day * 20); G.cash -= lose; pop("WRONG!", "His boys shake you down", "-" + mny(lose), RED); }
  walkMode(); redrawAll();
}
function mugging() {
  var r, lose;
  menuMode();
  pop("MUGGERS!", "Three punks jump you", "in the " + (G.ph == 2 ? "dark" : "alley") + "!", RED);
  r = menu("MUGGED!", ["Fight back", "Run for it", "Hand over cash"], 0, ["50/50 and it hurts", "Fast feet maybe", "Lose 15% of your cash"]);
  if (r == 0 || r < 0) {
    if (rnd() < 0.5) { lose = ri(100, 500); G.cash += lose; pop("YOU WIN", "Took their cash: " + mny(lose), "", GREEN); }
    else { lose = Math.floor(G.cash * 0.2); G.cash -= lose; G.hp = Math.max(5, G.hp - 20); pop("BEATEN", "Lost " + mny(lose) + "  HP -20", "", RED); }
  } else if (r == 1) {
    if (rnd() < 0.55) { pop("ESCAPED", "You ran like hell.", "", GREEN); }
    else { lose = Math.floor(G.cash * 0.1); G.cash -= lose; G.hp = Math.max(5, G.hp - 10); pop("CAUGHT", "Lost " + mny(lose) + "  HP -10", "", RED); }
  } else { lose = Math.floor(G.cash * 0.15); G.cash -= lose; pop("ROBBED", "Lost " + mny(lose), "", RED); }
  walkMode(); redrawAll();
}
function dirtyCop() {
  var cost = 400 + G.day * 40, r;
  menuMode();
  pop("DIRTY COP", "A crooked cop offers PROTECTION", "for " + mny(cost) + " - no heat for a while.", YEL);
  r = menu("PROTECTION?", ["Pay " + mny(cost), "No thanks"], 0, ["Four parts of a day, heat -25", "Walk away"]);
  if (r == 0) {
    if (G.cash >= cost) { G.cash -= cost; G.prot = 4; G.heat = Math.max(0, G.heat - 25); flash("Cops look away", GREEN); }
    else { flash("Not enough cash", RED); }
  }
  walkMode(); redrawAll();
}
function findStash() {
  var d = ri(0, NDRUG - 1), q = ri(2, 8);
  menuMode();
  if (freeSp() >= q) { G.inv[d] += q; pop("FOUND A STASH!", "Dead dealer's bag:", q + " " + DRUG[d], GREEN); }
  else { q = ri(200, 700); G.cash += q; pop("FOUND CASH!", "A fat envelope: " + mny(q), "", GREEN); }
  walkMode(); redrawAll();
}

/* ==========================================================
   TOWN LOOP, MENUS, TITLE
   ========================================================== */
function nearSpot() {
  var i;
  for (i = (SHOWD ? 0 : 1); i < 3; i++) { if (Math.abs(PX - SPX[i]) <= 18) { return i; } }
  return -1;
}
function prompt(ns) {
  if (ns < 0) {
    if (G.loc == 0 && G.brothel && Math.abs(PX - 200) <= 22) { bar("SEL: Enter the BROTHEL", rgb(255, 120, 180)); }
    else if (G.loc == 0 && G.hookVis && Math.abs(PX - HOOKX) <= 22) { bar("SEL: Talk to the woman", HOOKC); }
    else { bar("Turn: walk   SEL: act   ESC: menu", GRAY); }
  }
  else if (ns == 0) { bar("SEL: Talk to the dealer (buy / sell)", YEL); }
  else if (ns == 1) {
    if (FACI[G.loc] == 6 && !G.unl) { bar("SEL: HEIST - rob the rum shop", MKC[1]); }
    else { bar(SPT[G.loc], MKC[1]); }
  }
  else { bar(TRN[G.loc], CYAN); }
}
function tick() {
  var i;
  FR = (FR + 1) & 3;
  if (SCN == 0) { upd(G_FIRE); }
  if ((FR & 1) == 0) { MB++; upd(G_MARK); }
}
function labTag(i) { return G.fac[i][0] ? "L" + G.fac[i][1] : "-"; }
function stashScreen() {
  var i;
  cls(rgb(12, 12, 28)); txt("STASH & STATS", 6, 4, 2, YEL);
  for (i = 0; i < NDRUG; i++) { txt(DRUG[i] + ": " + G.inv[i], 6, 24 + i * 10, 1, WHITE); }
  txt("Coat " + G.cap + (G.pack ? " +PACK" : "") + (G.duf ? " +DUFFLE" : ""), 6, 106, 1, GRAY);
  txt("Runner: " + (G.runner ? "hired" : "none") + "  Farm: " + (G.farm[0] ? "L" + G.farm[1] : "-"), 6, 116, 1, GRAY);
  txt("Space " + used() + "/" + capTot(), 160, 24, 1, WHITE); txt("Cash " + mny(G.cash), 160, 34, 1, GREEN); txt("Debt " + mny(G.debt), 160, 44, 1, RED);
  txt("Bank " + mny(G.bank), 160, 54, 1, CYAN); txt("HP " + G.hp + "  Heat " + G.heat + "%", 160, 64, 1, ORNG);
  txt("Day " + G.day + " of " + DAYS, 160, 74, 1, YEL); txt("Times jailed: " + G.priors, 160, 84, 1, WHITE);
  txt("Protection: " + (G.prot > 0 ? G.prot + " left" : "none"), 160, 94, 1, WHITE);
  if (G.mask) { txt("WANTED: ski mask on!", 160, 104, 1, RED); } else { txt(G.unl ? "World tour: UNLOCKED" : "World tour: needs $1M bank", 160, 104, 1, G.unl ? GREEN : GRAY); }
  txt("Port " + (G.unp ? "OK" : "$25M") + " Air " + (G.una ? "OK" : "$35M") + " Cmp " + (G.unc ? "OK" : "$50M"), 156, 114, 1, G.unc ? GREEN : GRAY);
  txt("Labs: METH " + labTag(0) + "  GROW " + labTag(1) + "  COKE " + labTag(2), 6, 128, 1, CYAN);
  txt("      ACID " + labTag(3) + "  PILLS " + labTag(4) + "  HEROIN " + labTag(5), 6, 138, 1, CYAN);
  txt("      SHROOMS " + labTag(6), 6, 148, 1, CYAN);
  txt("Farm stock: Hash " + G.farm[2] + "  Peyote " + G.farm[3], 160, 148, 1, CYAN);
  txt("SEL: back", 262, 148, 1, GRAY);
  waitKey();
}
function howTo() {
  var P = [
    ["HOW TO PLAY", "Turn knob = walk the street. SEL = act.", "Walk to the glowing arrows:", " GREEN  dealer - buy low, sell high",
     " PINK   lab / bank / heist spot", " CYAN   travel (bus, boat, plane)", "Make drugs in labs, sell them for cash.", "Cops can bust you: run, fight,",
     "BRIBE them, or quiz your way out.", "Jail: bribe the guard or do time.", "Pay the shark before day " + DAYS + "!", "SEL: next page"],
    ["BANK, BAGS & RUNNER", "Downtown BANK: deposits are safe from", "muggers. TRANSACTIONS shows your last 10.", "ROB THE BANK for $15k-$50k: you wear a ski", "mask and the cops hunt you until you fly out.",
     "Space grows to 1000 units in total: dealers", "sell a bigger coat, BACKPACK +150, DUFFLE +250.", "Pause menu: hire a RUNNER ($25k). He collects", "from ALL your labs and the farm. A wild card:", "he may skim, get tailed, or run off!",
     "CLOSET ($100k, pause menu): new clothes = heat 0.", "Ghetto nights: a lady may wave you over.", "3 visits + World Tour + Runner + Closet", "unlocks a BROTHEL that pays every phase.", "SEL: next page"],
    ["UNLOCKS - THE MORE YOU BANK...", "$1,000,000   WORLD TOUR: Tokyo, Dubai,", "              San Francisco, Mexico City,", "              Marseille. Flights cost $1,500.",
     "              New labs: ACID, PILLS, HEROIN, SHROOMS", "$25,000,000  SHIPPING PORT", "$35,000,000  AIR CARGO SMUGGLING", "$50,000,000  THE COMPOUND",
     "Locked places show LOCKED in the travel menu.", "Once open they stay open, even if you", "withdraw. Deposit at the Downtown bank.", "SEL: next page"],
    ["FARM, PORT, AIR & COMPOUND", "FARM: a $500 bus ride from anywhere. Buy it", "for $420,000, then 4 upgrades at $42,000.", "Grows HASH and PEYOTE. Armed guards: no heat", "bar, no cops.",
     "PORT / AIR: see what every city pays, load", "product and ship orders worldwide. Air is", "safer (1% seizure) than sea (4%).", "COMPOUND: unlimited storage, never robbed,", "cops stay away. The runner can deliver there.",
     "", "SEL to go back"]], pg, i, k;
  for (pg = 0; pg < P.length; pg++) {
    cls(rgb(12, 12, 28));
    for (i = 0; i < P[pg].length; i++) { txt(P[pg][i], 6, 6 + i * 13, 1, i == 0 ? YEL : WHITE); }
    k = waitKey();
    if (k == 4) { return; }
  }
}
/* ---------- the farm, the export hubs and the compound ---------- */
var FARM_COST = 420000, FARM_UP = 42000;
function farmMenu() {
  var idx = 0, r, f = G.farm, items, hints, lv, q, dg;
  TR = "farm";
  while (true) {
    lv = f[1];
    if (!f[0]) { items = ["Buy the FARM " + mny(FARM_COST), "Back"]; hints = ["Armed guards. Hash + Peyote. 4 upgrades of $42,000", "Leave"]; }
    else {
      items = ["Collect " + f[2] + " Hash", "Collect " + f[3] + " Peyote", lv < 5 ? "Upgrade L" + lv + " " + mny(FARM_UP) : "Farm is MAX level", "Back"];
      hints = ["Makes " + (12 * lv) + " per part of day. Stock cap " + (96 * lv), "Makes " + (8 * lv) + " per part of day. Stock cap " + (64 * lv), "Level " + lv + " of 5 - more output", "Leave"];
    }
    r = menu("THE FARM " + mnyS(G.cash), items, idx, hints);
    if (r < 0 || r == items.length - 1) { return; }
    idx = r;
    if (!f[0]) {
      if (G.cash >= FARM_COST) { G.cash -= FARM_COST; f[0] = 1; f[1] = 1; f[2] = 0; f[3] = 0; flash("The farm is yours!", GREEN); }
      else { flash("Need " + mny(FARM_COST), RED); }
    } else if (r < 2) {
      dg = 6 + r; q = Math.min(f[2 + r], freeSp());
      if (q <= 0) { flash(f[2 + r] <= 0 ? "Nothing grown yet" : "No room in your bags!", RED); }
      else { f[2 + r] -= q; G.inv[dg] += q; flash("Took " + q + " " + DRUG[dg], GREEN); }
    } else if (lv < 5) {
      if (G.cash >= FARM_UP) { G.cash -= FARM_UP; f[1]++; flash("Farm upgraded!", GREEN); } else { flash("Need " + mny(FARM_UP), RED); }
    }
  }
}
/* what every city will pay right now (refreshes every other day) */
function genDemand() {
  var c, d, avg;
  G.dem = [];
  for (c = 0; c < 14; c++) {
    d = ri(0, NDRUG - 1); avg = (DLO[d] + DHI[d]) / 2;
    G.dem.push([d, ri(40, 260), Math.floor(avg * ri(170, 340) / 100)]);
  }
}
function holdTotal(arr) { var i, t = 0; for (i = 0; i < NDRUG; i++) { t += arr[i]; } return t; }
/* move product between your bags and a storage array. cap 0 = unlimited */
function cargoMenu(arr, cap, nm) {
  var idx = 0, r, i, items, hints, t, k, q;
  while (true) {
    items = []; hints = []; t = holdTotal(arr);
    for (i = 0; i < NDRUG; i++) { items.push(DRUG[i] + " bag " + G.inv[i] + " hold " + arr[i]); hints.push("SEL: store or take this product"); }
    items.push("Store EVERYTHING"); hints.push("Move all product from your bags into storage");
    items.push("Back"); hints.push("Leave the cargo hold");
    r = menu(nm + " " + t + (cap > 0 ? "/" + cap : ""), items, idx, hints);
    if (r < 0 || r == NDRUG + 1) { return; }
    idx = r;
    if (r == NDRUG) {
      for (i = 0; i < NDRUG; i++) { q = G.inv[i]; if (cap > 0 && q > cap - holdTotal(arr)) { q = cap - holdTotal(arr); } if (q > 0) { G.inv[i] -= q; arr[i] += q; } }
      flash("Everything stored", GREEN);
    } else {
      k = menu(DRUG[r], ["Store ALL " + G.inv[r], "Take ALL " + arr[r], "Back"], 0, ["Bags to storage", "Storage to bags (space " + freeSp() + ")", "Cancel"]);
      if (k == 0) { q = G.inv[r]; if (cap > 0 && q > cap - holdTotal(arr)) { q = cap - holdTotal(arr); } if (q <= 0) { flash(G.inv[r] <= 0 ? "None in your bags" : "Hold is full", RED); } else { G.inv[r] -= q; arr[r] += q; flash("Stored " + q, GREEN); } }
      else if (k == 1) { q = Math.min(arr[r], freeSp()); if (q <= 0) { flash(arr[r] <= 0 ? "None in storage" : "No room in bags", RED); } else { arr[r] -= q; G.inv[r] += q; flash("Took " + q, GREEN); } }
    }
  }
}
function shipOrder(c, arr, kind) {
  var e = G.dem[c], d = e[0], av, n, r, tk, pay;
  if (e[1] <= 0) { flash("Order already filled", RED); return; }
  av = arr[d] + G.inv[d];
  if (av <= 0) { flash("You have no " + DRUG[d], RED); return; }
  r = menu("SHIP " + DRUG[d] + " > " + CC[c], ["Ship ALL (" + Math.min(e[1], av) + ")", "Ship HALF", "Ship 10", "Back"], 0,
    ["Pays " + mny(e[2]) + " each. Hold " + arr[d] + " + bags " + G.inv[d], "Half of what you can send", "A test shipment", "Cancel"]);
  if (r < 0 || r == 3) { return; }
  n = (r == 0) ? Math.min(e[1], av) : ((r == 1) ? Math.floor(Math.min(e[1], av) / 2) : Math.min(10, e[1], av));
  if (n <= 0) { flash("Nothing to ship", RED); return; }
  tk = Math.min(n, arr[d]); arr[d] -= tk; G.inv[d] -= (n - tk); e[1] -= n;
  if (rnd() * 100 < (kind ? 1 : 4)) {
    G.heat = Math.min(100, G.heat + 20); 
    pop("SEIZED!", "Customs caught the " + DRUG[d] + " shipment", "Lost " + n + " units. Heat is up.", RED);
  } else {
    pay = n * e[2]; G.cash += pay; 
    pop("SHIPPED!", n + " " + DRUG[d] + " to " + LOCN[c], "Paid " + mny(pay), GREEN);
  }
}
function ordersMenu(arr, kind) {
  var idx = 0, r, c, items, hints, e;
  while (true) {
    items = []; hints = [];
    for (c = 0; c < 14; c++) {
      e = G.dem[c];
      items.push(e[1] > 0 ? CC[c] + " " + DRUG[e[0]] + " " + e[1] + " " + mnyS(e[2]) : CC[c] + " - filled -");
      hints.push(e[1] > 0 ? LOCN[c] + " pays " + mny(e[2]) + " each for " + e[1] + " " + DRUG[e[0]] : "No order here right now");
    }
    items.push("Back"); hints.push("Leave");
    r = menu("WORLD ORDERS", items, idx, hints);
    if (r < 0 || r == 14) { return; }
    idx = r; shipOrder(r, arr, kind);
  }
}
function hubMenu(kind) {
  var idx = 0, r, arr = kind ? G.airh : G.port, cap = kind ? 8000 : 3000, nm = kind ? "AIR CARGO" : "PORT", t;
  TR = "hub";
  if (G.dem.length < 14) { genDemand(); }
  while (true) {
    t = holdTotal(arr);
    r = menu(nm + " HOLD " + t, ["Worldwide orders", "Load / unload cargo", "Leave"], idx,
      ["See what each city pays and ship it there", "Hold " + t + "/" + cap + " units. Bags " + used() + "/" + capTot(), "Back to the street"]);
    if (r < 0 || r == 2) { return; }
    idx = r;
    if (r == 0) { ordersMenu(arr, kind); } else { cargoMenu(arr, cap, nm); }
  }
}
function storageScreen() {
  var i;
  cls(rgb(12, 12, 28)); txt("COMPOUND STORAGE", 6, 4, 2, YEL);
  for (i = 0; i < NDRUG; i++) { txt(DRUG[i] + ": " + G.comp[i], 6 + (i & 1) * 160, 34 + (i >> 1) * 16, 1, WHITE); }
  txt("Total " + holdTotal(G.comp) + " units", 6, 108, 1, CYAN);
  txt("Never robbed. Cops stay away.", 6, 124, 1, GREEN);
  txt("SEL to go back", 6, 154, 1, GRAY);
  waitKey();
}
function compoundMenu() {
  var idx = 0, r;
  TR = "compound";
  while (true) {
    r = menu("COMPOUND " + holdTotal(G.comp), ["Store / take product", "View storage", "Leave"], idx, ["Unlimited. Never robbed. Cops stay out", "Everything you have stored here", "Back to the street"]);
    if (r < 0 || r == 2) { return; }
    idx = r;
    if (r == 0) { cargoMenu(G.comp, 0, "COMPOUND"); } else { storageScreen(); }
  }
}
function demStr() {
  var o = [], i, e;
  for (i = 0; i < G.dem.length; i++) { e = G.dem[i]; o.push(e[0] + ":" + e[1] + ":" + e[2]); }
  return o.join(";");
}
function demLoad(str) {
  var parts, q, i, n = [];
  if (!str) { return n; }
  parts = str.split(";");
  for (i = 0; i < parts.length && n.length < 14; i++) { q = parts[i].split(":"); n.push([pint(q[0], 0, NDRUG - 1, 0), pint(q[1], 0, 9999, 0), pint(q[2], 1, 999999999, 100)]); }
  return (n.length == 14) ? n : [];
}
function isSafe(t) { return t == FARM || t == COMP; }
function isLocked(t) {
  if (t >= WORLD0 && t <= 13) { return !G.unl; }
  if (t == PORT) { return !G.unp; }
  if (t == AIRP) { return !G.una; }
  if (t == COMP) { return !G.unc; }
  return false;
}
function lockText(t) {
  if (t == PORT) { return "Needs " + mny(UNL_PORT) + " in the bank"; }
  if (t == AIRP) { return "Needs " + mny(UNL_AIR) + " in the bank"; }
  if (t == COMP) { return "Needs " + mny(UNL_COMP) + " in the bank"; }
  return "Needs " + mny(UNL_BANK) + " in the bank";
}
/* ---- local dealers ---- */
function dealerJam(x) {                       /* Jamaica: dreadlocks, no hat, rasta tank top, long shorts */
  var fy = FY, sk = K(112, 70, 44), hr = K(28, 20, 14), gr = K(25, 150, 60), ye = K(250, 210, 40), rd = K(215, 40, 45), sho = K(30, 30, 38), dk = rgb(10, 10, 14);
  R(x - 11, fy - 1, 22, 3, rgb(18, 18, 24));
  R(x - 7, fy - 14, 6, 10, sk); R(x + 1, fy - 14, 6, 10, sk);
  R(x - 7, fy - 14, 6, 8, sho); R(x + 1, fy - 14, 6, 8, sho);
  R(x - 7, fy - 4, 9, 4, K(90, 60, 40)); R(x + 1, fy - 4, 9, 4, K(90, 60, 40));
  R(x - 12, fy - 31, 4, 15, sk); R(x + 8, fy - 31, 4, 15, sk);
  R(x - 8, fy - 32, 16, 5, gr); R(x - 8, fy - 27, 16, 5, ye); R(x - 8, fy - 22, 16, 5, rd); R(x - 8, fy - 17, 16, 3, sho);
  head(x, fy - 39, sk);
  R(x + 3, fy - 41, 2, 2, dk); R(x + 5, fy - 36, 3, 1, dk);
  R(x - 7, fy - 47, 14, 4, hr);
  R(x - 10, fy - 46, 2, 20, hr); R(x - 8, fy - 47, 2, 21, hr); R(x + 7, fy - 46, 2, 12, hr); R(x + 9, fy - 44, 2, 10, hr); R(x - 12, fy - 44, 2, 14, hr);
  R(x - 10, fy - 28, 2, 2, rd); R(x - 8, fy - 27, 2, 2, ye); R(x - 12, fy - 31, 2, 2, gr); R(x + 7, fy - 36, 2, 2, gr); R(x + 9, fy - 36, 2, 2, rd);
}
function dealerTriad(x) {                     /* Tokyo: black suit, tie, slick hair, sunglasses */
  var fy = FY, sk = K(225, 185, 140), su = K(28, 28, 36), bk = K(10, 10, 14), wh = K(235, 235, 240), dk = rgb(10, 10, 14);
  R(x - 11, fy - 1, 22, 3, rgb(18, 18, 24));
  R(x - 7, fy - 14, 6, 10, su); R(x + 1, fy - 14, 6, 10, su);
  R(x - 7, fy - 4, 9, 4, bk); R(x + 1, fy - 4, 9, 4, bk); R(x - 5, fy - 4, 3, 1, K(90, 90, 105)); R(x + 3, fy - 4, 3, 1, K(90, 90, 105));
  R(x - 12, fy - 31, 4, 13, su); R(x - 12, fy - 19, 4, 3, sk); R(x - 12, fy - 20, 4, 1, wh);
  R(x + 8, fy - 31, 4, 13, su); R(x + 8, fy - 19, 4, 3, sk); R(x + 8, fy - 20, 4, 1, wh);
  R(x - 8, fy - 32, 16, 18, su); R(x - 8, fy - 16, 16, 3, bk);
  R(x - 5, fy - 32, 3, 12, bk); R(x + 3, fy - 32, 3, 12, bk);
  R(x - 2, fy - 32, 6, 12, wh); R(x, fy - 31, 2, 12, K(170, 20, 30)); R(x - 2, fy - 33, 6, 1, K(230, 190, 60));
  head(x, fy - 39, sk);
  R(x - 7, fy - 47, 14, 5, bk); R(x - 7, fy - 44, 2, 4, bk);
  R(x - 7, fy - 42, 6, 1, dk); R(x - 1, fy - 42, 9, 3, K(8, 8, 12)); R(x + 1, fy - 42, 2, 1, K(110, 120, 150));
  R(x + 5, fy - 36, 3, 1, dk); R(x + 8, fy - 36, 4, 1, wh); R(x + 12, fy - 36, 1, 1, rgb(255, 120, 30));
}
function dealerSF(x) {                        /* San Francisco: white guy, short shorts, rainbow tee */
  var fy = FY, sk = K(245, 210, 185), bl = K(235, 200, 90), jn = K(60, 120, 210), wh = K(240, 240, 245), dk = rgb(10, 10, 14), i, RB = [K(225, 40, 50), K(245, 140, 30), K(250, 220, 50), K(50, 180, 80), K(50, 110, 220), K(150, 70, 200)];
  R(x - 11, fy - 1, 22, 3, rgb(18, 18, 24));
  R(x - 7, fy - 14, 6, 10, sk); R(x + 1, fy - 14, 6, 10, sk);
  R(x - 8, fy - 17, 16, 3, jn); R(x - 7, fy - 14, 6, 4, jn); R(x + 1, fy - 14, 6, 4, jn);
  R(x - 6, fy - 7, 5, 3, wh); R(x + 2, fy - 7, 5, 3, wh);
  R(x - 7, fy - 4, 9, 4, wh); R(x + 1, fy - 4, 9, 4, wh); R(x - 7, fy - 2, 9, 1, K(210, 60, 90)); R(x + 1, fy - 2, 9, 1, K(210, 60, 90));
  R(x - 12, fy - 31, 4, 15, sk); R(x + 8, fy - 31, 4, 15, sk);
  for (i = 0; i < 6; i++) { R(x - 8, fy - 32 + i * 3, 16, (i == 5) ? 2 : 3, RB[i]); }
  R(x - 12, fy - 31, 4, 3, RB[0]); R(x - 12, fy - 28, 4, 3, RB[1]); R(x + 8, fy - 31, 4, 3, RB[0]); R(x + 8, fy - 28, 4, 3, RB[1]);
  head(x, fy - 39, sk);
  R(x + 3, fy - 41, 2, 2, K(40, 90, 170)); R(x + 5, fy - 36, 3, 1, K(190, 70, 80));
  R(x - 7, fy - 47, 14, 5, bl); R(x - 8, fy - 45, 2, 6, bl); R(x + 2, fy - 49, 7, 3, bl);
}
/* ---- the rest of the dealers dress for their region ---- */
function dBase(x, sh, sl, sLen, pa, pLen, shoe, sk, belt) {
  var fy = FY, dk = rgb(10, 10, 14);
  R(x - 11, fy - 1, 22, 3, rgb(18, 18, 24));
  R(x - 7, fy - 14, 6, 10, sk); R(x + 1, fy - 14, 6, 10, sk);
  R(x - 7, fy - 14, 6, pLen, pa); R(x + 1, fy - 14, 6, pLen, pa);
  R(x - 7, fy - 4, 9, 4, shoe); R(x + 1, fy - 4, 9, 4, shoe);
  R(x - 12, fy - 31, 4, 15, sk); R(x + 8, fy - 31, 4, 15, sk);
  R(x - 12, fy - 31, 4, sLen, sl); R(x + 8, fy - 31, 4, sLen, sl);
  R(x - 8, fy - 32, 16, 15, sh); R(x - 8, fy - 17, 16, 3, belt);
  head(x, fy - 39, sk);
  R(x + 3, fy - 41, 2, 2, dk); R(x + 5, fy - 36, 3, 1, dk);
}
function dealerGen(x, sc) {
  var fy = FY, i, WT = K(240, 240, 245), BK = K(10, 10, 14), GD = K(235, 195, 60);
  if (sc == 0) {                                /* Ghetto: black hoodie, hood up, chain, baggy jeans */
    dBase(x, K(35, 35, 42), K(35, 35, 42), 13, K(55, 85, 150), 10, K(240, 240, 240), K(110, 70, 45), K(30, 30, 38));
    R(x - 10, fy - 49, 20, 7, K(35, 35, 42)); R(x - 10, fy - 44, 4, 14, K(35, 35, 42)); R(x + 7, fy - 44, 3, 10, K(35, 35, 42));
    R(x - 4, fy - 31, 8, 1, GD); R(x - 1, fy - 30, 3, 3, GD); R(x - 5, fy - 24, 10, 4, K(25, 25, 30));
  } else if (sc == 1) {                         /* Downtown: pinstripe suit, tie, briefcase */
    dBase(x, K(60, 62, 78), K(60, 62, 78), 13, K(60, 62, 78), 10, BK, K(225, 185, 140), BK);
    for (i = 0; i < 4; i++) { R(x - 6 + i * 4, fy - 32, 1, 15, K(100, 104, 125)); }
    R(x - 2, fy - 32, 5, 10, WT); R(x, fy - 31, 2, 10, K(25, 130, 70));
    R(x - 7, fy - 47, 14, 5, K(40, 30, 25));
    R(x + 9, fy - 14, 14, 10, K(130, 85, 45)); R(x + 13, fy - 17, 6, 3, K(70, 45, 25)); R(x + 15, fy - 11, 2, 2, GD); R(x + 8, fy - 19, 4, 1, GD);
  } else if (sc == 2) {                         /* Suburbs: white preppy jock - letterman jacket, popped collar, football */
    dBase(x, K(150, 25, 40), K(240, 235, 215), 13, K(205, 185, 135), 6, K(130, 85, 50), K(245, 205, 175), K(205, 185, 135));
    R(x - 6, fy - 7, 5, 3, WT); R(x + 2, fy - 7, 5, 3, WT);
    R(x - 6, fy - 28, 6, 7, GD); R(x - 4, fy - 26, 2, 3, K(150, 25, 40));
    R(x - 5, fy - 34, 4, 3, K(245, 150, 170)); R(x + 1, fy - 34, 4, 3, K(245, 150, 170));
    R(x - 9, fy - 33, 18, 3, K(120, 190, 230)); R(x - 1, fy - 32, 3, 5, K(120, 190, 230));
    R(x - 7, fy - 47, 14, 5, K(120, 80, 40)); R(x + 2, fy - 49, 6, 3, K(120, 80, 40));
    R(x + 9, fy - 24, 9, 5, K(130, 75, 35)); R(x + 11, fy - 23, 5, 1, WT);
  } else if (sc == 3) {                         /* Docks: hi-vis vest, beanie, work boots */
    dBase(x, K(90, 90, 100), K(90, 90, 100), 8, K(40, 60, 100), 10, K(100, 65, 35), K(205, 160, 120), K(50, 40, 30));
    R(x - 8, fy - 32, 5, 15, K(255, 135, 20)); R(x + 3, fy - 32, 5, 15, K(255, 135, 20)); R(x - 8, fy - 25, 16, 2, K(235, 235, 160));
    R(x - 7, fy - 50, 14, 7, K(25, 40, 80)); R(x - 8, fy - 44, 16, 2, K(40, 60, 110));
  } else if (sc == 4) {                         /* Smuggler Isle: pirate smuggler - bandana, eyepatch, striped shirt */
    dBase(x, WT, WT, 13, K(70, 45, 30), 10, BK, K(205, 150, 100), K(190, 40, 45));
    for (i = 0; i < 5; i++) { R(x - 8, fy - 31 + i * 3, 16, 1, K(30, 45, 90)); }
    R(x - 8, fy - 47, 16, 4, K(200, 40, 45)); R(x - 12, fy - 45, 4, 3, K(200, 40, 45)); R(x - 13, fy - 43, 2, 3, K(200, 40, 45));
    R(x + 2, fy - 43, 5, 4, BK); R(x - 7, fy - 44, 14, 1, BK); R(x - 8, fy - 38, 2, 2, GD);
  } else if (sc == 5) {                         /* Amsterdam: orange jersey, flat cap, clogs, tulip */
    dBase(x, K(255, 125, 20), K(255, 125, 20), 8, K(50, 75, 130), 10, K(235, 190, 60), K(235, 195, 160), K(30, 40, 70));
    R(x - 8, fy - 26, 16, 2, WT);
    R(x - 8, fy - 47, 16, 4, K(80, 80, 90)); R(x + 2, fy - 44, 9, 2, K(60, 60, 70));
    R(x + 10, fy - 26, 1, 10, K(40, 160, 60)); R(x + 9, fy - 30, 3, 4, K(220, 40, 70));
  } else if (sc == 6) {                         /* Bogota: ruana poncho and sombrero vueltiao */
    dBase(x, K(235, 230, 215), K(120, 80, 50), 13, K(35, 35, 45), 10, K(70, 45, 25), K(195, 145, 105), K(35, 35, 45));
    R(x - 11, fy - 32, 22, 12, K(125, 85, 55)); R(x - 11, fy - 26, 22, 3, K(200, 50, 45)); R(x - 11, fy - 22, 22, 1, K(240, 200, 80)); R(x - 2, fy - 32, 5, 5, K(235, 230, 215));
    R(x - 13, fy - 46, 26, 3, K(235, 225, 185)); R(x - 6, fy - 54, 12, 9, K(235, 225, 185));
    R(x - 6, fy - 50, 12, 1, BK); R(x - 6, fy - 52, 12, 1, BK); R(x - 13, fy - 46, 26, 1, BK);
    R(x + 1, fy - 37, 7, 2, BK);
  } else if (sc == 7) {                         /* Bangkok: conical straw hat, teal shirt, fisherman pants */
    dBase(x, K(30, 150, 150), K(30, 150, 150), 6, K(235, 225, 190), 10, K(140, 90, 50), K(215, 170, 120), K(235, 225, 190));
    R(x - 9, fy - 15, 9, 11, K(235, 225, 190)); R(x, fy - 15, 9, 11, K(235, 225, 190));
    R(x - 5, fy - 28, 2, 2, K(250, 150, 190)); R(x + 2, fy - 24, 2, 2, K(250, 150, 190)); R(x - 3, fy - 21, 2, 2, K(250, 220, 90));
    R(x - 13, fy - 45, 26, 2, K(225, 200, 120)); R(x - 11, fy - 47, 22, 2, K(225, 200, 120)); R(x - 9, fy - 49, 18, 2, K(225, 200, 120));
    R(x - 7, fy - 51, 14, 2, K(225, 200, 120)); R(x - 5, fy - 53, 10, 2, K(225, 200, 120)); R(x - 3, fy - 55, 6, 2, K(225, 200, 120)); R(x - 1, fy - 57, 2, 2, K(225, 200, 120));
  } else if (sc == 10) {                        /* Dubai: white kandura, ghutra and agal, sunglasses */
    dBase(x, WT, WT, 13, WT, 10, K(130, 95, 55), K(205, 160, 115), WT);
    R(x - 9, fy - 32, 18, 28, WT); R(x, fy - 28, 1, 20, K(215, 215, 225));
    R(x - 9, fy - 49, 18, 7, WT); R(x - 10, fy - 44, 4, 13, WT); R(x + 7, fy - 44, 4, 12, WT); R(x - 8, fy - 47, 16, 2, BK);
    R(x + 1, fy - 37, 7, 3, K(40, 28, 20)); R(x - 1, fy - 42, 9, 3, BK); R(x + 1, fy - 42, 2, 1, K(110, 120, 150)); R(x + 8, fy - 19, 4, 1, GD);
  } else if (sc == 12) {                        /* Mexico: sombrero, guayabera shirt, mustache */
    dBase(x, K(245, 240, 215), K(245, 240, 215), 6, K(45, 45, 60), 10, K(110, 70, 40), K(190, 140, 100), K(100, 60, 30));
    R(x - 5, fy - 32, 1, 15, K(215, 205, 175)); R(x + 4, fy - 32, 1, 15, K(215, 205, 175)); R(x - 7, fy - 26, 4, 4, K(225, 215, 185)); R(x + 3, fy - 26, 4, 4, K(225, 215, 185));
    R(x - 1, fy - 17, 3, 3, GD);
    R(x - 7, fy - 46, 14, 2, BK); R(x + 1, fy - 37, 7, 2, BK);
    R(x - 17, fy - 46, 34, 3, K(225, 185, 90)); R(x - 17, fy - 44, 34, 1, K(200, 40, 45));
    R(x - 7, fy - 57, 14, 11, K(225, 185, 90)); R(x - 4, fy - 60, 8, 3, K(225, 185, 90)); R(x - 7, fy - 49, 14, 3, K(200, 40, 45)); R(x - 4, fy - 48, 2, 1, GD); R(x + 2, fy - 48, 2, 1, GD);
  } else if (sc == 13) {                        /* Marseille: breton stripes, beret, red scarf, baguette */
    dBase(x, WT, WT, 13, K(40, 45, 70), 10, BK, K(225, 185, 150), K(30, 30, 40));
    for (i = 0; i < 6; i++) { R(x - 8, fy - 31 + i * 3, 16, 1, K(30, 50, 110)); }
    R(x - 12, fy - 28, 4, 1, K(30, 50, 110)); R(x - 12, fy - 24, 4, 1, K(30, 50, 110)); R(x + 8, fy - 28, 4, 1, K(30, 50, 110)); R(x + 8, fy - 24, 4, 1, K(30, 50, 110));
    R(x - 8, fy - 47, 16, 3, BK); R(x - 5, fy - 50, 12, 4, BK); R(x + 2, fy - 52, 2, 2, BK);
    R(x - 5, fy - 33, 10, 2, K(200, 40, 45)); R(x + 2, fy - 37, 6, 1, BK);
    R(x + 8, fy - 36, 4, 1, WT); R(x + 12, fy - 36, 1, 1, rgb(255, 120, 30)); R(x + 10, fy - 34, 3, 18, K(215, 170, 90));
  } else if (sc == 15) {                        /* Shipping Port: sea captain - navy coat, white cap, grey beard, pipe */
    dBase(x, K(30, 45, 95), K(30, 45, 95), 13, K(30, 45, 95), 10, BK, K(215, 170, 125), K(15, 20, 40));
    for (i = 0; i < 4; i++) { R(x - 4, fy - 30 + i * 4, 2, 2, GD); R(x + 3, fy - 30 + i * 4, 2, 2, GD); }
    R(x - 12, fy - 22, 4, 1, GD); R(x + 8, fy - 22, 4, 1, GD);
    R(x - 8, fy - 50, 16, 4, WT); R(x - 9, fy - 46, 18, 2, K(20, 30, 60)); R(x + 2, fy - 44, 10, 2, BK); R(x - 1, fy - 49, 3, 2, GD);
    R(x - 5, fy - 36, 12, 5, K(200, 200, 205)); R(x + 7, fy - 35, 6, 1, K(100, 60, 30)); R(x + 12, fy - 37, 3, 3, K(100, 60, 30));
  } else if (sc == 16) {                        /* Air Cargo: bomber jacket, aviator cap, goggles, clipboard */
    dBase(x, K(115, 72, 40), K(115, 72, 40), 13, K(170, 150, 110), 10, K(55, 38, 25), K(225, 185, 150), K(60, 45, 30));
    R(x - 8, fy - 33, 16, 3, K(240, 235, 220)); R(x, fy - 30, 1, 13, K(70, 45, 25));
    R(x - 8, fy - 48, 16, 5, K(95, 60, 35)); R(x - 9, fy - 44, 3, 8, K(95, 60, 35)); R(x + 6, fy - 44, 3, 7, K(95, 60, 35));
    R(x - 6, fy - 47, 5, 3, K(60, 60, 70)); R(x + 1, fy - 47, 5, 3, K(60, 60, 70)); R(x - 5, fy - 46, 3, 1, K(120, 220, 240)); R(x + 2, fy - 46, 3, 1, K(120, 220, 240));
    R(x - 1, fy - 42, 9, 3, K(20, 20, 25)); R(x - 1, fy - 43, 9, 1, GD);
    R(x + 9, fy - 26, 7, 9, K(190, 190, 200)); R(x + 10, fy - 24, 5, 1, K(90, 90, 100)); R(x + 10, fy - 22, 5, 1, K(90, 90, 100));
  } else {
    man(x, FY, 1, 0, PD, 0);
  }
}
/* a pitchfork and straw hat for the farm dealer */
function farmer(x) {
  var st = rgb(235, 205, 110), wd = rgb(130, 90, 50), mt = rgb(190, 195, 205);
  R(x - 12, FY - 46, 24, 3, st); R(x - 7, FY - 52, 14, 7, st); R(x - 7, FY - 47, 14, 1, rgb(190, 150, 60));
  R(x + 10, FY - 58, 2, 60, wd); R(x + 7, FY - 62, 9, 2, mt); R(x + 7, FY - 70, 2, 9, mt); R(x + 11, FY - 70, 2, 9, mt); R(x + 15, FY - 70, 2, 9, mt);
}
/* THE RUNNER - a wild card. Collects from ALL your labs, anywhere in the world. */
/* itemized runner report: every product he moved, hash and peyote included */
function popList(title, arr, foot, col) {
  var i, c = 0, x, y;
  fr(25, 30, W - 50, 112, BLACK); rc(25, 30, W - 50, 112, col); rc(26, 31, W - 52, 110, col);
  ctxt(title, 38, 2, col);
  for (i = 0; i < NDRUG; i++) {
    if (arr[i] <= 0) { continue; }
    x = 36 + (c & 1) * 128; y = 62 + (c >> 1) * 11;
    txt(DRUG[i] + " " + arr[i], x, y, 1, (i >= 6) ? GREEN : WHITE); c++;
  }
  if (c == 0) { ctxt("Nothing moved", 70, 1, GRAY); }
  ctxt(foot, 112, 1, YEL);
  ctxt("SEL to continue", 128, 1, GRAY);
  waitKey();
}
function runnerRun(toComp) {
  var j, s0, dg, roll, pct, msg, col, n = 0, k = 0, tot = 0, lost = 0, dl, took, owned = 0, rg = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (j = 0; j < 7; j++) { if (G.fac[j][0]) { owned++; tot += G.fac[j][2]; } }
  if (G.farm[0]) { owned++; tot += G.farm[2] + G.farm[3]; }
  if (owned == 0) { flash("You own no labs yet", RED); return; }
  if (tot <= 0) { flash("Nothing cooked yet", RED); return; }
  if (!toComp && freeSp() <= 0) { flash("No room in your bags!", RED); return; }
  wait(300);
  roll = rnd();
  if (roll < 0.15) { pct = 1; msg = "He's in a good mood - FULL load!"; col = GREEN; }
  else if (roll < 0.75) { pct = 0.85; msg = "Clean run. He kept his 15% cut."; col = GREEN; }
  else if (roll < 0.87) { pct = 0.6; msg = "He skimmed extra off the top!"; col = ORNG; }
  else if (roll < 0.95) { pct = 0.5; G.heat = Math.min(100, G.heat + 10); msg = "Cops tailed him. Half the load is gone."; col = ORNG; }
  else { pct = 0; msg = "He RAN OFF with the whole load!"; col = RED; }
  for (j = 0; j < 9; j++) {
    if (j < 7) { if (!G.fac[j][0]) { continue; } s0 = G.fac[j][2]; dg = FD[j].drug; }
    else { if (!G.farm[0]) { continue; } s0 = G.farm[j - 5]; dg = j - 1; }
    if (s0 <= 0) { continue; }
    if (pct == 0) { lost += s0; rg[dg] += s0; if (j < 7) { G.fac[j][2] = 0; } else { G.farm[j - 5] = 0; } k++; continue; }
    dl = Math.floor(s0 * pct); if (!toComp && dl > freeSp()) { dl = freeSp(); }
    if (dl <= 0) { continue; }
    took = Math.min(s0, Math.ceil(dl / pct));
    if (j < 7) { G.fac[j][2] = s0 - took; } else { G.farm[j - 5] = s0 - took; }
    if (toComp) { G.comp[dg] += dl; } else { G.inv[dg] += dl; }
    n += dl; k++; rg[dg] += dl;
  }
  if (pct == 0) {
    G.runner = 0; G.runnerGone = 1; G.runnerGoneAt = pollN;
    popList("RUNNER VANISHED", rg, msg, col);
    pop("HENCHMEN ARE HUNTING", "Your boys are looking for him.", "Check back in a few minutes...", ORNG);
  } else {
    if (G.brothel && G.brothCash > 0) {
      G.cash += G.brothCash;
      pop("RUNNER + BROTHEL", "He also brought house cash: " + mny(G.brothCash), msg, GREEN);
      G.brothCash = 0;
    }
    popList(toComp ? "STORED AT COMPOUND" : "RUNNER BACK", rg, msg, col);
  }
}

/* ==========================================================
   RUNNER JUSTICE + NIGHT LIFE
   ========================================================== */
function checkRunnerFound() {
  if (!G.runnerGone) { return; }
  if (pollN - G.runnerGoneAt < 300000) { return; }   /* ~5 real minutes of play */
  G.runnerGone = 0;
  menuMode();
  var r = menu("HENCHMEN FOUND HIM", ["Let him go (rehire later)", "Kill the runner", "Deal with it later"], 0,
    ["He lives. You can hire a new one for $25k", "No heat. He never talks again.", "He stays locked up for now"]);
  if (r == 1) { killRunnerScene(); }
  else if (r == 0) {
    G.runner = 0;
    pop("SPARED", "Your boys dump him outside town.", "Hire a new runner when you need one.", GREEN);
  } else {
    G.runnerGone = 1; G.runnerGoneAt = pollN;  /* push another 5 min */
    flash("Locked up for now", YEL);
  }
  walkMode(); if (MODE == 1) { redrawAll(); }
}
function killRunnerScene() {
  var i;
  /* --- interrogation room --- */
  cls(rgb(28, 24, 22));
  fr(0, 0, W, 14, rgb(40, 30, 28));
  txt("BASEMENT", 6, 3, 1, GRAY);
  /* walls / floor */
  fr(0, 120, W, 50, rgb(35, 30, 28));
  fr(20, 40, W - 40, 90, rgb(50, 42, 38));
  /* chair */
  fr(140, 100, 40, 8, rgb(80, 55, 35));
  fr(145, 108, 6, 20, rgb(60, 40, 25)); fr(170, 108, 6, 20, rgb(60, 40, 25));
  /* beaten runner (simple figure) */
  fr(150, 70, 20, 28, rgb(90, 70, 55));          /* torso */
  fr(154, 58, 12, 12, rgb(200, 160, 120));        /* head */
  fr(148, 98, 8, 18, rgb(50, 45, 40));            /* legs */
  fr(164, 98, 8, 18, rgb(50, 45, 40));
  fr(156, 62, 3, 3, rgb(180, 40, 40));            /* bruise */
  fr(162, 66, 4, 2, rgb(120, 30, 30));
  txt("The runner is tied to the chair.", 30, 145, 1, WHITE);
  txt("SEL: finish it", 100, 158, 1, RED);
  waitKey();
  /* muzzle flash + shot */
  for (i = 0; i < 5; i++) {
    fr(100 + i * 8, 78, 10, 4, rgb(255, 220 - i * 30, 40));
    wait(40);
  }
  fr(154, 58, 12, 12, rgb(160, 40, 40));
  fr(150, 70, 20, 28, rgb(70, 50, 45));
  wait(500);
  pop("DONE", "He won't steal from you again.", "No heat. No witnesses.", RED);
  /* --- burial scene --- */
  cls(rgb(18, 28, 18));
  fr(0, 100, W, 70, rgb(40, 55, 30));
  /* hole */
  fr(110, 110, 100, 40, rgb(25, 20, 12));
  fr(115, 115, 90, 30, rgb(20, 15, 8));
  /* dirt piles */
  fr(80, 105, 30, 12, rgb(55, 45, 25));
  fr(210, 108, 35, 10, rgb(55, 45, 25));
  /* henchman with shovel */
  fr(70, 70, 14, 28, rgb(50, 50, 55));
  fr(72, 58, 10, 12, rgb(210, 170, 130));
  fr(84, 78, 4, 28, rgb(120, 120, 130));  /* shovel handle */
  fr(80, 74, 14, 6, rgb(90, 90, 100));
  /* body bag outline in hole */
  fr(130, 125, 60, 12, rgb(30, 30, 35));
  txt("Your henchman digs...", 80, 20, 1, GRAY);
  wait(900);
  for (i = 0; i < 6; i++) {
    fr(115, 115 + i * 2, 90, 4, rgb(40 + i * 3, 50, 28));
    wait(180);
  }
  txt("...and covers the hole.", 90, 40, 1, GRAY);
  wait(700);
  pop("BURIED", "Problem solved.", "You can hire a new runner anytime.", GREEN);
  G.runner = 0; G.runnerGone = 0;
}

function drawHooker(x) {
  var fy = FY, sk = rgb(220, 175, 145), dr = rgb(200, 40, 90), hr = rgb(40, 25, 20), lg = rgb(30, 30, 38);
  x = Math.floor(x);
  /* shadow */
  R(x - 9, fy - 1, 18, 3, rgb(18, 18, 24));
  /* legs / heels */
  R(x - 5, fy - 14, 4, 12, sk); R(x + 2, fy - 14, 4, 12, sk);
  R(x - 6, fy - 4, 6, 3, lg); R(x + 1, fy - 4, 6, 3, lg);
  /* short dress */
  R(x - 8, fy - 28, 16, 16, dr);
  R(x - 9, fy - 14, 18, 3, dr);
  /* torso / arms */
  R(x - 6, fy - 36, 12, 10, sk);
  R(x - 10, fy - 34, 3, 12, sk); R(x + 7, fy - 34, 3, 12, sk);
  /* head + hair */
  head(x, fy - 42, sk);
  R(x - 7, fy - 50, 14, 6, hr);
  R(x - 8, fy - 48, 3, 14, hr); R(x + 6, fy - 48, 3, 14, hr);
  R(x - 5, fy - 52, 10, 3, hr);
  /* lips */
  R(x - 1, fy - 39, 3, 1, rgb(200, 40, 60));
}
function bedroomScene() {
  var i, j;
  /* dim hallway flash then room */
  for (i = 0; i < 3; i++) {
    cls(rgb(10 + i * 8, 8, 12));
    wait(80);
  }
  /* bedroom - night, lamp on */
  cls(rgb(28, 18, 32));
  /* back wall */
  fr(0, 14, W, 100, rgb(55, 35, 50));
  /* window + night sky */
  fr(220, 28, 70, 50, rgb(20, 25, 45));
  fr(225, 32, 60, 42, rgb(12, 14, 30));
  for (i = 0; i < 6; i++) { fr(230 + (i * 11) % 55, 36 + (i * 7) % 35, 2, 2, rgb(200, 200, 230)); }
  fr(252, 38, 8, 8, rgb(230, 230, 200)); /* moon bit */
  /* curtains */
  fr(218, 28, 6, 55, rgb(90, 40, 60)); fr(286, 28, 6, 55, rgb(90, 40, 60));
  /* bed frame + mattress + sheets */
  fr(30, 95, 200, 12, rgb(70, 45, 35));
  fr(40, 78, 180, 22, rgb(180, 160, 170));
  fr(40, 70, 180, 12, rgb(220, 200, 210));
  fr(40, 68, 180, 4, rgb(240, 230, 235));
  /* pillows */
  fr(48, 62, 36, 12, rgb(245, 240, 245));
  fr(90, 64, 32, 10, rgb(240, 235, 240));
  /* nightstand + lamp */
  fr(220, 100, 36, 28, rgb(60, 40, 30));
  fr(230, 48, 6, 52, rgb(50, 40, 35));
  fr(222, 40, 22, 12, rgb(255, 230, 140));
  fr(226, 36, 14, 6, rgb(255, 245, 180));
  /* lamp glow on wall */
  fr(200, 30, 50, 70, rgb(50, 35, 40));
  /* rug */
  fr(60, 120, 140, 18, rgb(80, 30, 45));
  /* clothes on floor */
  fr(50, 125, 28, 6, rgb(40, 40, 50));
  fr(200, 128, 24, 5, rgb(180, 40, 80));
  txt("Her place...", 8, 4, 1, rgb(255, 180, 200));
  wait(700);
  /* she sits on the bed */
  fr(110, 72, 22, 16, rgb(220, 175, 145)); /* shoulders */
  fr(112, 60, 14, 12, rgb(220, 175, 145)); /* head */
  fr(110, 58, 16, 5, rgb(35, 22, 18));     /* hair */
  fr(108, 56, 4, 12, rgb(35, 22, 18));
  fr(124, 56, 4, 12, rgb(35, 22, 18));
  fr(105, 85, 40, 18, rgb(200, 40, 90));    /* dress on bed */
  wait(500);
  /* player silhouette approaches */
  fr(55, 70, 18, 28, rgb(45, 45, 55));
  fr(57, 58, 12, 12, rgb(210, 170, 130));
  wait(400);
  /* lights lower */
  for (j = 0; j < 5; j++) {
    fr(0, 14, W, H - 14, rgb(20 - j * 2, 12 - j, 18 - j));
    /* keep bed shape dim */
    fr(40, 78, 180, 22, rgb(100 - j * 8, 80 - j * 5, 90 - j * 5));
    fr(40, 70, 180, 12, rgb(140 - j * 10, 120 - j * 8, 130 - j * 8));
    fr(110 - j, 72, 28, 18, rgb(180 - j * 10, 140 - j * 8, 120 - j * 5));
    fr(100, 85, 50, 20, rgb(40, 30, 38));
    wait(180);
  }
  /* intimate beats - silhouettes under sheets, motion */
  for (i = 0; i < 10; i++) {
    cls(rgb(12, 8, 14));
    fr(40, 85, 180, 30, rgb(55, 40, 50));
    fr(50, 78, 160, 14, rgb(90, 75, 85));
    /* two forms under covers */
    fr(90 + (i & 1), 82, 36, 16, rgb(70, 55, 65));
    fr(130 - (i & 1), 84, 40, 18, rgb(65, 50, 60));
    fr(100, 76, 14, 10, rgb(160, 130, 110));
    fr(140, 78, 12, 8, rgb(150, 120, 100));
    if (i % 3 == 0) { ctxt("...", 100, 1, rgb(180, 140, 160)); }
    wait(200);
  }
  /* afterglow */
  cls(rgb(30, 20, 28));
  fr(40, 78, 180, 35, rgb(100, 80, 90));
  fr(40, 70, 180, 12, rgb(200, 185, 195));
  fr(100, 72, 20, 14, rgb(210, 165, 135));
  fr(130, 74, 18, 12, rgb(50, 45, 55));
  fr(220, 40, 22, 12, rgb(255, 220, 130));
  ctxt("...", 80, 2, rgb(255, 190, 210));
  wait(900);
  cls(rgb(28, 18, 32));
  ctxt("Worth every dollar.", 70, 2, rgb(255, 180, 200));
  ctxt("SEL to get dressed", 110, 1, GRAY);
  waitKey();
}
function hookerEvent() {
  var r;
  menuMode();
  r = menu("HER PLACE", ["Pay $1,000", "Not now"], 0,
    ["Go upstairs with her", "Walk away"]);
  if (r != 0) { walkMode(); if (MODE == 1) { redrawAll(); } return; }
  if (G.cash < 1000) { flash("Need $1,000", RED); walkMode(); if (MODE == 1) { redrawAll(); } return; }
  G.cash -= 1000;
  bedroomScene();
  G.hookN++;
  if (!G.brothel && G.hookN >= 3 && G.unl && G.runner && G.closet) {
    G.brothel = 1;
    pop("BROTHEL UNLOCKED!", "She introduces you to the house.", "World Tour + Runner + Closet sealed the deal.", GREEN);
    pop("INCOME", "The house pays every part of the day.", "Your runner can collect the cash.", CYAN);
  } else if (!G.brothel) {
    flash("Visits " + G.hookN + "/3", YEL);
  } else {
    flash("Always a pleasure", GREEN);
  }
  /* she may still be on the street later; clear for now */
  G.hookVis = 0;
  walkMode(); if (MODE == 1) { redrawAll(); }
}
function brothelMenu() {
  var r, idx = 0;
  if (!G.brothel) { flash("No brothel yet", RED); return; }
  while (true) {
    r = menu("BROTHEL  hold " + mnyS(G.brothCash), ["Collect cash", "How it works", "Leave"], idx,
      ["Take what the house has earned", "Earns every part of the day. Runner can grab it too", "Back"]);
    if (r < 0 || r == 2) { return; }
    idx = r;
    if (r == 0) {
      if (G.brothCash <= 0) { flash("Nothing to collect", RED); }
      else { G.cash += G.brothCash; flash("+" + mny(G.brothCash), GREEN); G.brothCash = 0; }
    } else {
      pop("THE HOUSE", "Pays $800-$2500 each part of the day.", "Runner auto-collects when you send him.", CYAN);
    }
  }
}
function tryGhettoHook() {
  if (G.loc != 0 || !G.hookVis) { return false; }
  if (Math.abs(PX - HOOKX) > 20) { return false; }
  hookerEvent();
  return true;
}

function runnerMenu() {
  var r;
  if (G.runnerGone) { flash("Runner is missing - henchmen hunting", ORNG); return; }
  if (!G.runner) {
    if (!confirm2("Hire a runner?", "$25,000 - ALL labs + FARM (hash, peyote)", YEL)) { return; }
    if (G.cash < 25000) { flash("Need $25,000", RED); return; }
    G.cash -= 25000; G.runner = 1; G.runnerGone = 0; flash("Runner hired!", GREEN);
    return;
  }
  if (G.unc) {
    r = menu("RUNNER", ["Bring to my bags", "Bring to the compound", "Back"], 0, ["Labs + farm. Limited by bag space", "Labs + farm. Unlimited, never robbed", "Cancel"]);
    if (r == 0) { runnerRun(false); } else if (r == 1) { runnerRun(true); }
    return;
  }
  runnerRun(false);
}
/* ---- the closet: $100,000, change clothes, heat drops to nothing ---- */
var OUT = [
  ["Classic",       [215, 40, 45],  [100, 150, 240], [215, 40, 45],  [240, 240, 240]],
  ["Street Black",  [35, 35, 42],   [45, 55, 90],    [30, 30, 38],   [200, 200, 205]],
  ["Prep Boy",      [245, 150, 170],[205, 185, 135], [240, 240, 245],[130, 85, 50]],
  ["Neon Runner",   [150, 235, 60], [140, 80, 210],  [250, 215, 40], [240, 240, 240]],
  ["Camo",          [90, 105, 60],  [70, 85, 45],    [75, 90, 50],   [40, 35, 30]],
  ["Tropical",      [30, 170, 170], [240, 240, 235], [235, 205, 110],[150, 100, 60]],
  ["Suit & Tie",    [55, 55, 70],   [45, 45, 60],    [30, 30, 38],   [15, 15, 18]],
  ["Golden Boy",    [250, 205, 50], [30, 30, 38],    [240, 240, 245],[240, 240, 240]],
  ["Hi-Vis Worker", [255, 130, 20], [35, 50, 100],   [250, 215, 40], [100, 65, 35]],
  ["Rasta King",    [25, 150, 60],  [40, 40, 50],    null,           [40, 30, 25]],
  ["Mafia Don",     [20, 20, 28],   [25, 25, 35],    [15, 15, 20],   [10, 10, 12]],
  ["Cyber Punk",    [200, 40, 255], [40, 220, 255],  [255, 50, 180], [240, 240, 250]],
  ["Desert Fox",    [210, 170, 90], [180, 140, 70],  [160, 120, 50], [90, 60, 35]],
  ["Ice King",      [180, 220, 255],[140, 180, 230], [220, 240, 255],[200, 210, 220]],
  ["Blood Red",     [180, 20, 30],  [200, 25, 35],   [120, 15, 20],  [180, 20, 30]],
  ["Forest Ghost",  [40, 90, 50],   [30, 70, 40],    [50, 110, 60],  [25, 35, 20]],
  ["Royal Purple",  [120, 40, 180], [60, 20, 100],   [160, 60, 220], [30, 15, 40]],
  ["Sunset Hustler",[255, 100, 40], [40, 40, 60],    [255, 180, 50], [240, 240, 245]]];
function outfitIdx() { var i = G.outfit | 0; if (i < 0 || i >= OUT.length) { i = 0; } return i; }
function outfitPal(i) { var o = OUT[i]; return mkPal(o[1], o[2], [235, 185, 140], o[3], o[4], i == 9 ? 10 : 0); }
function closetShow(i) {
  cls(rgb(22, 16, 30)); fr(0, 0, W, 22, rgb(80, 45, 120)); txt("CLOSET", 6, 4, 2, WHITE); txt((i + 1) + "/" + OUT.length, 276, 7, 1, rgb(220, 200, 250));
  fr(30, 34, 260, 3, rgb(160, 125, 70)); fr(0, 128, W, 30, rgb(44, 32, 50));
  man(160, 122, 1, 0, outfitPal(i), 0);
  ctxt(OUT[i][0], 132, 2, YEL);
  if (i == outfitIdx()) { txt("wearing", 6, 28, 1, GREEN); }
  fr(0, H - 14, W, 14, rgb(6, 12, 24)); txt("Turn: browse  SEL: wear (heat 0)  ESC: back", 4, H - 11, 1, HINT);
}
function closetMenu() {
  var i, k, dirty = true;
  if (!G.closet) {
    if (!confirm2("Buy a closet?", "$100,000 - new clothes wipe your heat", YEL)) { return; }
    if (G.cash < 100000) { flash("Need $100,000", RED); return; }
    G.cash -= 100000; G.closet = 1; flash("Closet bought!", GREEN);
  }
  i = outfitIdx(); menuMode(); drainEnc(); lockEnc(ENC_GAP_MS);
  while (true) {
    if (dirty) { closetShow(i); dirty = false; }
    k = inpMenu();
    if (k == 1) { i = (i + 1) % OUT.length; dirty = true; settleInput(); continue; }
    else if (k == 2) { i = (i + OUT.length - 1) % OUT.length; dirty = true; settleInput(); continue; }
    else if (k == 3) {
      settleInput();
      G.outfit = i; setPals(); G.heat = 0; 
      flash("New look! Heat is 0", GREEN); dirty = true; continue;
    }
    else if (k == 4) { settleInput(); return; }
    wait(55);
  }
}
function escMenu() {
  var r, idx = 0, wh;
  menuMode();
  while (true) {
    r = menu("PAUSED", ["Resume", "Stash & stats", G.runner ? "Runner: collect all" : "Hire a runner $25k", G.closet ? "Closet: change clothes" : "Buy a closet $100k", "Save game", "Save & quit", "Quit, no save"], idx,
      ["Back to the street", "What you carry", G.runner ? "Labs + farm hash & peyote. Wild card!" : "Collects every lab AND the farm", G.closet ? "New clothes drop your heat to 0" : "Change clothes, heat drops to 0", "Pick a slot and name it", "Save to this slot, then title", "Leave without saving"]);
    if (r < 0 || r == 0) { break; }
    idx = r;
    if (r == 1) { stashScreen(); }
    else if (r == 2) { runnerMenu(); }
    else if (r == 3) { closetMenu(); menuMode(); }
    else if (r == 4) { saveFlow(); menuMode(); }
    else if (r == 5) {
      if (CUR < 0) { if (!saveFlow()) { continue; } }
      else { wh = saveGame(); flash(wh == "" ? "SAVE FAILED!" : ("Saved: " + CURNAME), wh == "" ? RED : GREEN); if (wh == "") { continue; } }
      LEAVE = true; break;
    }
    else if (r == 6) {
      if (confirm2("Quit without saving?", "Progress since your last save is lost", RED)) { LEAVE = true; break; }
    }
  }
  walkMode();
  if (!LEAVE) { redrawAll(); }
}
/* a hiccup on the device must never kick you out: repaint the street and carry on */
var GLITCHES = 0;
function townGlitch(e) {
  var msg = (e && e.message) ? e.message : String(e);
  GLITCHES++;
  try { wrFile("/dopewars_error.txt", msg + " @" + TR + " day " + G.day + " loc " + G.loc); } catch (e1) {}
  SPRFB = true; PEND = null; NOHI = -1; SKIP = -1; RECD = false; REC = false; FT = []; MODE = 1; LEAVE = false;
  try { walkMode(); build(G.loc, G.ph); if (PX < 16 || PX > W - 16) { PX = 90; } redrawAll(); bar("Recovered from a glitch", ORNG); wait(400); } catch (e2) {}
}
function town() {
  var k, tgt = PX, last = -2, ns, idle = 0, d, s, errs = 0;
  walkMode(); redrawAll();
  while (G.over == 0 && !LEAVE) {
    try {
      if (MODE != 1) { enterTown(G.loc, false); tgt = PX; last = -2; }
      checkRunnerFound();
      k = inp();
      if (k == 1) { tgt = Math.min(W - 16, tgt + 22); } else if (k == 2) { tgt = Math.max(16, tgt - 22); }
      if (tgt > PX + 66) { tgt = PX + 66; } if (tgt < PX - 66) { tgt = PX - 66; }
      if (PX != tgt) {
        d = (tgt > PX) ? 1 : -1; PF = d; s = Math.abs(tgt - PX);
        s = Math.min(s, Math.max(3, Math.min(10, Math.ceil(s / 3)))); moveP(PX + d * s); idle = 0;
        if (tryGhettoHook()) { tgt = PX; last = -2; }
      } else {
        if (PWK != 0) { PWK = 0; updPlayer(); }
        idle++; if (idle % 22 == 0) { tick(); }
      }
      ns = nearSpot();
      if (ns != last) { last = ns; prompt(ns); }
      if (k == 3) {
        if (ns >= 0) { doSpot(ns); tgt = PX; last = -2; }
        else if (G.loc == 0 && G.brothel && Math.abs(PX - HOOKX) <= 22) { menuMode(); brothelMenu(); walkMode(); redrawAll(); tgt = PX; last = -2; }
        else if (tryGhettoHook()) { tgt = PX; last = -2; }
      } else if (k == 4) { escMenu(); tgt = PX; last = -2; }
      wait(6);
    } catch (eT) {
      errs++;
      if (errs > 6) { throw eT; }
      townGlitch(eT); tgt = PX; last = -2;
    }
  }
}
function gameOver() {
  var sc = G.cash + G.bank - G.debt, i, rk, nh = false;
  for (i = 0; i < 6; i++) { if (G.fac[i][0]) { sc += Math.floor(FD[i].cost / 2); } }
  rk = sc >= 500000 ? "KINGPIN OF THE CITY" : (sc >= 100000 ? "CRIME BOSS" : (sc >= 20000 ? "STREET HUSTLER" : (sc >= 0 ? "STREET RAT" : "BROKE AND BUSTED")));
  if (sc > HI) { HI = sc; nh = true; }
  saveHi();
  menuMode(); cls(rgb(20, 0, 30));
  sctxt("GAME OVER", 10, 3, RED, rgb(60, 0, 0));
  ctxt("Cash  " + mny(G.cash) + "   Bank  " + mny(G.bank), 50, 1, GREEN); ctxt("Debt  " + mny(G.debt), 62, 1, RED);
  ctxt("Final score  " + mny(sc), 80, 2, YEL); ctxt(rk, 104, 2, ORNG);
  ctxt(nh ? "NEW HIGH SCORE!" : "High score " + mny(HI), 130, 1, CYAN); ctxt("SEL to continue", 152, 1, GRAY);
  
  waitKey();
}
function titleScreen() {
  var on = 1, t = 0, want;
  MODE = 1; SHOWM = false; SHOWD = true; PVIS = true; JG = false; COPX = -999; PF = 1; PWK = 0; FR = 0;
  G.loc = 0; build(0, 2); cls(BLACK); fullPaint();
  fr(0, 0, W, 14, rgb(6, 8, 30)); fr(0, 158, W, 12, rgb(10, 10, 24));
  sctxt("DOPE WARZ", 20, 4, rgb(255, 60, 60), rgb(0, 0, 0)); sctxt("CROOKED CITY", 58, 2, rgb(255, 210, 60), rgb(0, 0, 0));
  sctxt("by da cbm", 80, 1, WHITE, rgb(0, 0, 0));
  txt("18+", W - 28, 160, 1, rgb(200, 60, 60));
  walkMode(); PX = -24; walkTo(110, 6);
  while (true) {
    t++;
    if (t % 5 == 0) { tick(); }
    want = ((t >> 3) % 2 == 0) ? 1 : 0;
    if (want != on) {
      on = want;
      fr(0, 158, W, 12, rgb(10, 10, 24));
      if (on) { ctxt("Press SEL to start", 161, 1, WHITE); }
      txt("18+", W - 28, 160, 1, rgb(200, 60, 60));
    }
    if (kSel()) { settleInput(); return; }
    drainEnc(); wait(40);
  }
}
function runGame() {
  var r, idx = 0, saved, go;
  newGame(); loadHi();
  titleScreen();
  while (true) {
    saved = anySaved();
    r = menu("DOPE WARZ" + (HI > 0 ? "  Hi " + mnyS(HI) : ""),
      ["New Game", "Continue", "How To Play", "Exit"], idx,
      ["Start fresh: " + DAYS + " days, $5,000 in debt", saved ? "Pick one of your 3 save slots" : "No saved games yet", "Controls and tips", "Quit to the launcher"]);
    if (r < 0) { r = 3; }
    idx = r; go = false;
    if (r == 0) {
      newGame(); G.loc = 0; newPrices(); MSGS = []; CUR = -1; CURNAME = "";
      go = saveFlow();                      /* choose + name the slot BEFORE starting */
    } else if (r == 1) {
      if (saved) { go = loadFlow(); } else { flash("No saved games", RED); }
    }
    if (go) {
      LEAVE = false; G.over = 0;
      enterTown(G.loc, false);
      town();
      if (G.over) { gameOver(); }
    }
    else if (r == 2) { howTo(); }
    else if (r == 3) { if (confirmBox("Exit game?")) { cls(BLACK); ctxt("See ya, boss.", 80, 2, WHITE); wait(600); return; } }
  }
}
var TR = "";
function errScreen(msg) {
  cls(rgb(60, 0, 0));
  txt("Recovered from an error", 6, 6, 1, WHITE);
  var m = String(msg) + " @" + TR, y = 22;
  while (m.length > 0 && y < H - 30) { txt(m.substring(0, 50), 6, y, 1, YEL); m = m.substring(50); y += 11; }
  txt("Progress saved. Press SEL", 6, H - 14, 1, WHITE);
  waitKey();
}
function resetAfterError() {
  LEAVE = false; MODE = 1; PEND = null; NOHI = -1; SKIP = -1; RECD = false; REC = false; FT = [];
  newGame(); qReset(); MSGS = []; CUR = -1; CURNAME = ""; menuMode();
}
function main() {
  var tries = 0, again = true, msg;
  while (again) {
    again = false;
    try { calibrateClock(); runGame(); }
    catch (err) {
      msg = (err && err.message) ? err.message : String(err);
      try { saveGame(); } catch (e2) {}
      try { wrFile("/dopewars_error.txt", msg + " @" + TR + " day " + G.day + " loc " + G.loc); } catch (e4) {}
      try { errScreen(msg); } catch (e3) {}
      tries++;
      if (tries < 4) { again = true; try { resetAfterError(); } catch (e5) {} }
    }
  }
}
main();
