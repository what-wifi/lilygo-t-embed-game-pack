/* ==========================================================
   DA FLAPPY BIRD - the classic Flappy Bird, wild edition
   by da cbm
   Bruce firmware 1.16.1  |  LilyGO T-Embed CC1101 (320x170)
   ----------------------------------------------------------
   SEL press OR turn the knob = FLAP
   ESC = pause menu (save, sound, controls, quit)
   (Controls menu: switch to "turn only" if you want SEL to
    pause instead of flap)
   ----------------------------------------------------------
   75 levels in 15 areas. Fly through the pipe gaps.
   3 hearts per level. Later levels: faster, tighter gaps,
   and pipes that slide up and down!
   Earn coins, unlock new bird colors.
   Progress saves to /flappy_save.txt (SD or LittleFS)
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
var SOUND = true;
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
function beep(f, d) { if (!SOUND) { return; } try { if (typeof tone === "function") { tone(f, d); } } catch (e) {} }

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

/* ==========================================================
   GAME DATA
   ========================================================== */
var MAXLVL = 75;
var PT = 14, GY = H - 20, BX = 80, PW = 30, CAPH = 9, NPIPE = 6;
var FRAME_MS = 40, GRAV = 0.6, FLAPV = -4.7, VMAX = 8;
var WY = [-4, 0, 4, 0];

function c3(a) { return rgb(a[0], a[1], a[2]); }
function cc(a, f) { return rgb(a[0] * f, a[1] * f, a[2] * f); }
function mt(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

/* 15 areas x 5 levels (+ intro sunset at index 15)
   0 name, 1 skyTop, 2 skyBottom, 3 sun(1)/moon(2)/none(0), 4 sun color,
   5 scenery type, 6 far hills, 7 near hills, 8 scenery color A, 9 scenery color B,
   10 pipe color, 11 grass A, 12 grass B, 13 dirt, 14 stars, 15 clouds, 16 cloud color */
var TH = [
["Sunny Meadow",[60,150,235],[200,240,255],1,[255,240,130],0,[120,200,140],[80,170,90],[110,70,40],[50,150,60],[70,190,50],[100,210,70],[80,180,55],[200,160,90],0,5,[255,255,255]],
["Desert Noon",[245,170,90],[255,235,170],1,[255,250,200],3,[225,170,100],[210,150,80],[60,140,60],[40,110,50],[190,110,50],[230,200,120],[215,180,100],[190,140,80],0,2,[255,245,220]],
["Misty Pines",[120,150,160],[200,220,215],0,[255,255,255],1,[100,130,125],[60,100,90],[70,50,30],[30,100,60],[60,150,90],[70,140,80],[55,120,65],[90,70,50],0,6,[225,235,235]],
["City Dusk",[90,50,130],[255,160,90],1,[255,210,120],2,[100,70,130],[60,45,90],[50,40,80],[255,220,120],[90,200,110],[90,90,110],[75,75,95],[60,55,70],0,3,[250,180,150]],
["Palm Beach",[40,170,230],[190,240,250],1,[255,245,160],4,[40,130,200],[240,220,160],[130,90,50],[40,170,70],[240,120,90],[245,225,160],[230,205,140],[210,180,120],0,4,[255,255,255]],
["Autumn Hills",[250,170,90],[255,225,160],1,[255,240,170],0,[190,120,70],[150,90,40],[90,55,30],[230,120,30],[170,110,40],[200,140,50],[170,110,40],[120,80,40],0,3,[255,240,210]],
["Snow Peaks",[150,200,245],[235,248,255],1,[255,255,230],5,[170,190,220],[235,245,255],[120,140,175],[250,252,255],[90,170,210],[245,250,255],[220,232,245],[170,190,215],0,4,[255,255,255]],
["Starry Night",[8,10,40],[40,50,110],2,[250,250,220],2,[30,35,80],[18,22,55],[20,22,50],[255,220,100],[60,160,90],[40,50,80],[30,38,65],[20,25,45],1,2,[60,70,120]],
["Candy Land",[255,150,200],[255,230,245],1,[255,255,200],8,[255,190,220],[200,240,230],[255,255,255],[255,70,130],[255,120,170],[180,255,220],[150,235,200],[255,200,220],0,5,[255,255,255]],
["Volcano Rim",[60,10,10],[255,110,30],0,[255,255,255],9,[70,30,30],[45,22,22],[60,35,35],[255,120,20],[110,110,125],[70,50,50],[55,40,40],[35,22,22],0,4,[90,60,60]],
["Murky Swamp",[140,170,90],[220,230,160],1,[255,250,190],10,[90,120,70],[60,95,50],[110,80,40],[40,120,50],[110,150,60],[80,120,50],[65,100,40],[60,50,30],0,3,[220,230,190]],
["Deep Space",[0,0,12],[25,10,60],0,[255,255,255],11,[30,20,70],[20,15,50],[220,120,70],[250,220,150],[80,200,230],[90,90,120],[70,70,100],[40,40,60],1,0,[255,255,255]],
["Crystal Caves",[25,10,50],[60,40,110],0,[255,255,255],6,[50,35,95],[35,25,70],[110,220,240],[230,150,250],[120,200,230],[70,55,120],[55,42,100],[30,22,60],1,0,[255,255,255]],
["Sunset Ruins",[120,40,90],[255,150,70],1,[255,200,110],7,[150,70,90],[110,50,70],[225,190,140],[180,140,100],[200,150,80],[190,130,90],[170,110,75],[110,70,60],0,3,[255,170,130]],
["Cloud Kingdom",[90,170,255],[255,255,255],1,[255,230,100],7,[200,225,255],[235,245,255],[255,250,235],[240,200,80],[255,205,60],[255,255,255],[235,240,255],[200,215,245],0,9,[255,255,255]],
["Intro",[40,30,100],[255,150,80],1,[255,220,130],5,[110,60,120],[70,40,90],[90,60,130],[255,180,130],[80,200,60],[60,100,50],[50,85,40],[40,60,30],0,4,[255,190,150]]
];
var NAREA = 15;

/* bird colors: name, body, belly, wing, beak, cost */
var SK = [
  ["Sunny",    rgb(255, 215, 40),  rgb(255, 245, 170), rgb(235, 150, 20), rgb(255, 120, 30), 0],
  ["Cardinal", rgb(225, 45, 50),   rgb(255, 170, 160), rgb(150, 20, 30),  rgb(255, 180, 40), 100],
  ["Blue Jay", rgb(60, 130, 240),  rgb(200, 225, 255), rgb(30, 70, 170),  rgb(255, 200, 60), 200],
  ["Parrot",   rgb(60, 200, 80),   rgb(190, 250, 150), rgb(20, 120, 50),  rgb(255, 90, 60),  300],
  ["Violet",   rgb(160, 80, 230),  rgb(225, 190, 255), rgb(100, 40, 160), rgb(255, 200, 40), 450],
  ["Midnight", rgb(50, 55, 85),    rgb(150, 160, 200), rgb(25, 28, 50),   rgb(255, 160, 40), 600]
];

/* ---------- save ---------- */
var S = { coins: 0, maxLvl: 1, skin: 0, sound: 1, hi: 0, ctl: 0, own: [1, 0, 0, 0, 0, 0], stars: [] };
function resetSave() {
  var i;
  S.coins = 0; S.maxLvl = 1; S.skin = 0; S.sound = 1; S.hi = 0; S.ctl = 0;
  S.own = [1, 0, 0, 0, 0, 0];
  S.stars = [];
  for (i = 0; i < MAXLVL; i++) { S.stars[i] = 0; }
}
function saveGame() {
  var s = [S.coins, S.maxLvl, S.skin, S.sound, S.hi, S.ctl].join(",") + "|" + S.own.join("") + "|" + S.stars.join("");
  var ok = false;
  try { storage.write({ fs: "sd", path: "/flappy_save.txt" }, s, "write"); ok = true; } catch (e1) {}
  if (!ok) {
    try { storage.write({ fs: "littlefs", path: "/flappy_save.txt" }, s, "write"); } catch (e2) {}
  }
}
function ci2(v, lo, hi, dflt) { v = parseInt(v, 10); return (v >= lo && v <= hi) ? v : dflt; }
function loadGame() {
  var d = "";
  try { d = storage.read({ fs: "sd", path: "/flappy_save.txt" }); } catch (e1) { d = ""; }
  if (!d || String(d).indexOf("|") < 0) {
    try { d = storage.read({ fs: "littlefs", path: "/flappy_save.txt" }); } catch (e2) { d = ""; }
  }
  if (!d || String(d).indexOf("|") < 0) { return false; }
  try {
    var p = String(d).split("|");
    var a = p[0].split(",");
    var i;
    S.coins = ci2(a[0], 0, 999999999, 0);
    S.maxLvl = ci2(a[1], 1, MAXLVL, 1);
    S.skin = ci2(a[2], 0, SK.length - 1, 0);
    S.sound = ci2(a[3], 0, 1, 1);
    S.hi = ci2(a[4], 0, 999999999, 0);
    S.ctl = ci2(a[5], 0, 1, 0);
    for (i = 0; i < SK.length; i++) { S.own[i] = (p[1].charAt(i) == "1") ? 1 : 0; }
    S.own[0] = 1;
    if (!S.own[S.skin]) { S.skin = 0; }
    if (p.length > 2) {
      for (i = 0; i < MAXLVL; i++) { S.stars[i] = ci2(p[2].charAt(i), 0, 3, 0); }
    }
    SOUND = (S.sound == 1);
    return true;
  } catch (e3) { resetSave(); return false; }
}

/* ==========================================================
   MENUS
   ========================================================== */
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
   BACKGROUND ENGINE
   Everything is built from clipped rectangles / circle spans,
   so any rectangle of the scenery can be repainted quickly.
   ========================================================== */
var NB = 14, MAXD = 24;
var CX0 = 0, CY0 = 0, CX1 = W, CY1 = H;
var bandC = [], farH = [], nearH = [];
var dT = [], dX = [], dW = [], dH = [], dV = [], nD = 0;
var stX = [], stY = [], stS = [], clX = [], clY = [], clS = [];
var starsOn = 0, nCl = 0, celT = 0, celX = 0, celY = 0, celR = 13;
var celC = 0, celG1 = 0, celG2 = 0, celW = 0;
var clC = 0, clD = 0, farC = 0, farL = 0, nearC = 0, nearL = 0;
var DCA = 0, DCAd = 0, DCAl = 0, DCB = 0, DCBd = 0, DCBl = 0;
var PM = 0, PL = 0, PD = 0, PE = 0;
var GGA = 0, GGB = 0, GLT = 0, GSH = 0, GDIRT = 0, GPB = 0;
var STAR1 = rgb(255, 255, 255), STAR2 = rgb(255, 240, 160);
var lseed = 1;
(function () {
  var i;
  for (i = 0; i < 100; i++) { farH[i] = 10; nearH[i] = 6; }
  for (i = 0; i < NB; i++) { bandC[i] = 0; }
  for (i = 0; i < 40; i++) { stX[i] = 0; stY[i] = 0; stS[i] = 1; }
  for (i = 0; i < 12; i++) { clX[i] = 0; clY[i] = 0; clS[i] = 5; }
  for (i = 0; i < MAXD; i++) { dT[i] = 0; dX[i] = 0; dW[i] = 10; dH[i] = 10; dV[i] = 0; }
})();
function lr() { lseed = (lseed * 16807) % 2147483647; return (lseed - 1) / 2147483646; }
function lri(a, b) { return a + Math.floor(lr() * (b - a + 1)); }

function cfr(x, y, w, h, c) {
  var a = Math.floor(x), b = Math.floor(y);
  var e = a + Math.floor(w), f = b + Math.floor(h);
  if (a < CX0) { a = CX0; } if (b < CY0) { b = CY0; }
  if (e > CX1) { e = CX1; } if (f > CY1) { f = CY1; }
  if (e <= a || f <= b) { return; }
  emit(a, b, e - a, f - b, c);
}
function ccirc(cx, cy, r, c) {
  var dy, dy0, dy1, dx, a, b, rA = 0, rB = 0, rY = 0, rH = 0;
  cx = Math.floor(cx); cy = Math.floor(cy); r = Math.floor(r);
  if (r < 1) { r = 1; }
  if (cx + r < CX0 || cx - r >= CX1 || cy + r < CY0 || cy - r >= CY1) { return; }
  dy0 = CY0 - cy; if (dy0 < -r) { dy0 = -r; }
  dy1 = CY1 - 1 - cy; if (dy1 > r) { dy1 = r; }
  /* rows with the same clipped span are merged into one rectangle */
  for (dy = dy0; dy <= dy1; dy++) {
    dx = Math.floor(Math.sqrt(r * r - dy * dy));
    a = cx - dx; b = cx + dx + 1;
    if (a < CX0) { a = CX0; } if (b > CX1) { b = CX1; }
    if (b <= a) { continue; }
    if (rH > 0 && a == rA && b == rB) { rH++; }
    else {
      if (rH > 0) { emit(rA, rY, rB - rA, rH, c); }
      rA = a; rB = b; rY = cy + dy; rH = 1;
    }
  }
  if (rH > 0) { emit(rA, rY, rB - rA, rH, c); }
}

/* outline ring of a disc (the pixels between radius r and r+1). Painted AFTER
   the fill, never over it, so no pixel is written twice */
function cring(cx, cy, r, c) {
  var dy, dy0, dy1, dO, dI;
  cx = Math.floor(cx); cy = Math.floor(cy); r = Math.floor(r);
  if (r < 1) { r = 1; }
  if (cx + r + 1 < CX0 || cx - r - 1 >= CX1 || cy + r + 1 < CY0 || cy - r - 1 >= CY1) { return; }
  dy0 = CY0 - cy; if (dy0 < -r - 1) { dy0 = -r - 1; }
  dy1 = CY1 - 1 - cy; if (dy1 > r + 1) { dy1 = r + 1; }
  for (dy = dy0; dy <= dy1; dy++) {
    dO = Math.floor(Math.sqrt((r + 1) * (r + 1) - dy * dy));
    if (dy >= -r && dy <= r) {
      dI = Math.floor(Math.sqrt(r * r - dy * dy));
      cfr(cx - dO, cy + dy, dO - dI, 1, c);
      cfr(cx + dI + 1, cy + dy, dO - dI, 1, c);
    } else { cfr(cx - dO, cy + dy, dO * 2 + 1, 1, c); }
  }
}
function cdisc(cx, cy, r, fc, oc) { ccirc(cx, cy, r, fc); cring(cx, cy, r, oc); }
function ctl2(x1, y1, x2, y2, r, c) {
  var n = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1);
  var st = Math.max(1, Math.floor(r * 0.3)), i, ym, rr, xa, xb;
  if (Math.abs(y2 - y1) < 3) {
    /* nearly flat stroke: a clean capsule (rectangle + two round ends) */
    ym = Math.floor((y1 + y2) / 2); rr = Math.max(1, Math.floor(r));
    xa = Math.floor(Math.min(x1, x2)); xb = Math.floor(Math.max(x1, x2));
    cfr(xa, ym - rr, xb - xa + 1, rr * 2 + 1, c);
    ccirc(xa, ym, rr, c); ccirc(xb, ym, rr, c);
    return;
  }
  for (i = 0; i <= n; i += st) { ccirc(x1 + (x2 - x1) * i / n, y1 + (y2 - y1) * i / n, r, c); }
  ccirc(x2, y2, r, c);
}
function setClip(x0, y0, x1, y1) {
  CX0 = Math.max(0, Math.floor(x0)); CY0 = Math.max(0, Math.floor(y0));
  CX1 = Math.min(W, Math.ceil(x1)); CY1 = Math.min(H, Math.ceil(y1));
}

function buildBg(t) {
  var T = TH[t], i, p1, p2, p3, h, x, w, ty, sm;
  lseed = t * 977 + 31;
  bgId++;
  for (i = 0; i < NB; i++) { bandC[i] = c3(mt(T[1], T[2], i / (NB - 1))); }
  celT = T[3]; celC = c3(T[4]);
  sm = mt(T[1], T[2], 0.55);
  celG1 = c3(mt(sm, T[4], 0.22)); celG2 = c3(mt(sm, T[4], 0.5));
  celW = c3(mt(T[4], [255, 255, 255], 0.6));
  celR = 13;
  celX = 205 + lri(0, 80);
  celY = (t == 3 || t == 13 || t == 15) ? 96 : (30 + lri(0, 16));
  starsOn = T[14];
  for (i = 0; i < 40; i++) { stX[i] = lri(0, W - 1); stY[i] = lri(2, GY - 50); stS[i] = (lri(0, 4) == 0) ? 2 : 1; }
  nCl = T[15];
  for (i = 0; i < nCl; i++) {
    clX[i] = Math.floor((i + lr() * 0.8) * W / nCl);
    clY[i] = lri(16, 80);
    clS[i] = lri(5, 9);
  }
  clC = c3(T[16]); clD = cc(T[16], 0.84);
  p1 = lr() * 6; p2 = lr() * 6; p3 = lr() * 6;
  for (i = 0; i < 100; i++) {
    h = 24 + 12 * Math.sin(i * 0.17 + p1) + 8 * Math.sin(i * 0.41 + p2) + 3 * Math.sin(i * 0.93 + p3);
    if (t == 4) { h = 16 + 2 * Math.sin(i * 0.9 + p1); }
    if (h < 6) { h = 6; }
    farH[i] = Math.floor(h);
    h = 9 + 5 * Math.sin(i * 0.23 + p2) + 3 * Math.sin(i * 0.57 + p3);
    if (h < 4) { h = 4; }
    nearH[i] = Math.floor(h);
  }
  farC = c3(T[6]); farL = cc(T[6], 1.25); nearC = c3(T[7]); nearL = cc(T[7], 1.2);
  DCA = c3(T[8]); DCAd = cc(T[8], 0.65); DCAl = cc(T[8], 1.3);
  DCB = c3(T[9]); DCBd = cc(T[9], 0.65); DCBl = cc(T[9], 1.3);
  nD = 0; ty = T[5];
  if (ty == 11) {
    for (i = 0; i < 3; i++) {
      dT[nD] = 11; dX[nD] = 30 + i * 100 + lri(0, 40); dW[nD] = lri(9, 20); dH[nD] = lri(26, 110); dV[nD] = i; nD++;
    }
  } else {
    x = -6;
    while (x < W && nD < MAXD) {
      w = 16; h = 30;
      if (ty == 0) { w = lri(18, 26); h = lri(30, 46); }
      else if (ty == 1) { w = lri(14, 20); h = lri(34, 52); }
      else if (ty == 2) { w = lri(18, 28); h = lri(36, 76); }
      else if (ty == 3) { w = lri(14, 18); h = lri(24, 40); }
      else if (ty == 4) { w = lri(20, 28); h = lri(38, 56); }
      else if (ty == 5) { w = lri(50, 80); h = lri(40, 68); }
      else if (ty == 6) { w = lri(10, 16); h = lri(26, 50); }
      else if (ty == 7) { w = lri(12, 16); h = lri(30, 56); }
      else if (ty == 8) { w = lri(16, 22); h = lri(34, 50); }
      else if (ty == 9) { w = lri(70, 100); h = lri(46, 70); }
      else if (ty == 10) { w = lri(12, 18); h = lri(22, 38); }
      dT[nD] = ty; dX[nD] = x; dW[nD] = w; dH[nD] = h; dV[nD] = lri(0, 1); nD++;
      if (ty == 5) { x += Math.floor(w * 0.7); }
      else if (ty == 9) { x += Math.floor(w * 0.55); }
      else if (ty == 2) { x += w + lri(1, 6); }
      else { x += w + lri(8, 26); }
    }
  }
  PM = c3(T[10]); PL = cc(T[10], 1.4); PD = cc(T[10], 0.6); PE = cc(T[10], 0.3);
  GGA = c3(T[11]); GGB = c3(T[12]); GLT = cc(T[11], 1.3);
  GDIRT = c3(T[13]); GSH = cc(T[13], 0.6); GPB = cc(T[13], 0.7);
}

function drawCel() {
  var r = celR;
  if (celT == 0) { return; }
  if (celX + r + 12 < CX0 || celX - r - 12 > CX1 || celY + r + 12 < CY0 || celY - r - 12 > CY1) { return; }
  if (celT == 1) {
    ccirc(celX, celY, r + 10, celG1);
    ccirc(celX, celY, r + 5, celG2);
    ccirc(celX, celY, r, celC);
    ccirc(celX, celY, r - 5, celW);
  } else {
    ccirc(celX, celY, r + 6, celG1);
    ccirc(celX, celY, r, celC);
    ccirc(celX - 4, celY - 3, 3, celG2);
    ccirc(celX + 5, celY + 4, 4, celG2);
    ccirc(celX + 4, celY - 6, 2, celG2);
  }
}
function drawCloud(i) {
  var u = clS[i], x = clX[i], y = clY[i];
  if (x + u * 3 < CX0 || x - u * 3 > CX1 || y + u * 2 < CY0 || y - u * 2 > CY1) { return; }
  ccirc(x - u * 1.2, y + u * 0.2, u * 0.8, clC);
  ccirc(x + u * 1.2, y + u * 0.2, u * 0.8, clC);
  ccirc(x, y - u * 0.3, u, clC);
  ccirc(x + u * 0.5, y - u * 0.7, u * 0.6, clC);
  cfr(x - u * 1.2, y + u * 0.2, u * 2.4, u * 0.8, clC);
  cfr(x - u * 1.5, y + u * 0.8, u * 3.0, 2, clD);
}
function drawDeco(i) {
  var t = dT[i], x = dX[i], w = dW[i], h = dH[i], v = dV[i];
  var by = GY - 4, cx = x + Math.floor(w / 2);
  var k, r, ww, hw, th, ty0, wx, wy, sx, sy, tx, ty, rh;
  if (t == 11) {
    if (cx + w * 2 < CX0 || cx - w * 2 > CX1 || h + w < CY0 || h - w > CY1) { return; }
    ccirc(cx, h, w, DCA);
    ccirc(cx - w * 0.25, h - w * 0.25, w * 0.6, DCAl);
    ccirc(cx + w * 0.35, h + w * 0.3, w * 0.35, DCAd);
    if (v != 1) {
      cfr(cx - w * 1.7, h - 1, w * 3.4, 3, DCB);
      cfr(cx - w * 1.4, h + 2, w * 2.8, 1, DCBd);
    }
    return;
  }
  if (x - 12 > CX1 || x + w + 12 < CX0 || by < CY0 || by - h - 14 > CY1) { return; }
  if (t == 0) {
    cfr(cx - 1, by - h * 0.55, 3, h * 0.55 + 4, DCA);
    r = w * 0.5;
    ccirc(cx, by - h * 0.62, r, DCBd);
    ccirc(cx - 1, by - h * 0.66, r * 0.8, DCB);
    ccirc(cx - r * 0.3, by - h * 0.74, r * 0.35, DCBl);
    if (v == 1) { ccirc(cx + r * 0.35, by - h * 0.55, 2, rgb(230, 60, 50)); }
  } else if (t == 1) {
    cfr(cx - 1, by - 5, 3, 8, DCA);
    th = Math.floor(h * 0.36);
    for (k = 0; k < 3; k++) {
      hw = Math.floor(w * (0.5 - k * 0.12));
      ty0 = by - 4 - k * Math.floor(h * 0.27) - th;
      for (r = 0; r < th; r += 3) {
        ww = Math.floor(hw * (r + 3) / th);
        cfr(cx - ww, ty0 + r, ww * 2, 3, (k == 1) ? DCBd : DCB);
      }
      cfr(cx - 1, ty0 + 2, 2, th - 4, DCBl);
    }
  } else if (t == 2) {
    cfr(x, by - h, w, h + 6, DCA);
    cfr(x, by - h, w, 2, DCAl);
    cfr(x + w - 3, by - h, 3, h + 6, DCAd);
    if (v == 1) { cfr(cx, by - h - 7, 1, 7, GRAY); cfr(cx - 1, by - h - 8, 3, 2, RED); }
    for (wy = by - h + 5; wy < by - 3; wy += 6) {
      if (wy + 3 < CY0 || wy > CY1) { continue; }
      for (wx = x + 3; wx < x + w - 5; wx += 5) {
        if (wx > CX1 || wx + 3 < CX0) { continue; }
        k = ((wx * 7 + wy * 13 + i * 5) % 7);
        cfr(wx, wy, 3, 3, (k < 4) ? DCB : DCAd);
      }
    }
  } else if (t == 3) {
    cfr(cx - 3, by - h, 6, h + 6, DCA);
    cfr(cx - 3, by - h, 2, h + 6, DCAl);
    cfr(cx + 1, by - h, 2, h + 6, DCAd);
    cfr(cx - 10, by - h * 0.55, 8, 3, DCA);
    cfr(cx - 10, by - h * 0.55 - 8, 3, 9, DCA);
    cfr(cx + 3, by - h * 0.4, 8, 3, DCA);
    cfr(cx + 9, by - h * 0.4 - 7, 3, 8, DCA);
    if (v == 1) { cfr(cx - 1, by - h - 3, 3, 3, rgb(250, 110, 160)); }
  } else if (t == 4) {
    for (k = 0; k < 6; k++) {
      sy = by + 2 - (k + 1) * h / 6;
      cfr(cx - 1 + Math.floor(k * 0.5), sy, 3, h / 6 + 1, (k % 2 == 0) ? DCA : DCAd);
    }
    tx = cx + 2; ty = by - h;
    cfr(tx - 12, ty + 1, 10, 2, DCBd);
    cfr(tx - 9, ty - 2, 8, 2, DCB);
    cfr(tx + 1, ty - 2, 9, 2, DCB);
    cfr(tx + 2, ty + 1, 11, 2, DCBd);
    cfr(tx - 3, ty - 5, 6, 2, DCBl);
    ccirc(tx - 1, ty + 3, 2, DCAd);
    ccirc(tx + 2, ty + 3, 2, DCAd);
  } else if (t == 5) {
    hw = Math.floor(w / 2);
    for (r = 0; r < h; r += 3) {
      ww = Math.floor(hw * (r + 3) / h);
      cfr(cx - ww, by - h + r, ww, 3, (r < h * 0.28) ? DCB : DCA);
      cfr(cx, by - h + r, ww, 3, (r < h * 0.28) ? DCBd : DCAd);
    }
  } else if (t == 6) {
    hw = Math.floor(w / 2);
    for (r = 0; r < h; r += 2) {
      ww = Math.floor(hw * Math.min(1, (r + 3) / (h * 0.4)));
      cfr(cx - ww, by - h + r, ww, 2, (v == 1) ? DCB : DCA);
      cfr(cx, by - h + r, ww, 2, (v == 1) ? DCBd : DCAd);
    }
    cfr(cx - 2, by - h * 0.8, 1, h * 0.45, WHITE);
  } else if (t == 7) {
    cfr(x + 2, by - h, w - 4, h + 6, DCA);
    cfr(x + 2, by - h, 2, h + 6, DCAl);
    cfr(x + w - 5, by - h, 3, h + 6, DCAd);
    cfr(x + 5, by - h, 1, h + 6, DCAd);
    cfr(x, by - 1, w, 7, DCB);
    if (v == 1) {
      cfr(x + 1, by - h - 2, 5, 3, DCA);
      cfr(x + w - 7, by - h - 4, 4, 5, DCA);
    } else {
      cfr(x, by - h - 3, w, 4, DCB);
    }
  } else if (t == 8) {
    cfr(cx - 1, by - h * 0.62, 3, h * 0.62 + 6, DCA);
    r = w * 0.5 + 2;
    sy = by - h * 0.72;
    ccirc(cx, sy, r, DCB);
    ccirc(cx, sy, r * 0.72, DCA);
    ccirc(cx, sy, r * 0.44, DCB);
    ccirc(cx, sy, r * 0.18, DCA);
    ccirc(cx - r * 0.45, sy - r * 0.5, 2, DCBl);
  } else if (t == 9) {
    hw = Math.floor(w / 2);
    for (r = 0; r < h; r += 2) {
      ww = 6 + Math.floor((hw - 6) * r / h);
      cfr(cx - ww, by - h + r, ww, 2, (r < h * 0.12) ? DCB : DCA);
      cfr(cx, by - h + r, ww, 2, (r < h * 0.12) ? DCBl : DCAd);
    }
    cfr(cx - 2, by - h + 4, 2, h * 0.4, DCB);
    cfr(cx + 4, by - h + 3, 2, h * 0.3, DCB);
    if (v == 1) {
      ccirc(cx, by - h - 6, 6, rgb(90, 60, 60));
      ccirc(cx + 5, by - h - 12, 5, rgb(70, 50, 50));
    }
  } else if (t == 10) {
    for (k = 0; k < 4; k++) {
      wx = x + k * 4;
      rh = Math.floor(h * (0.6 + 0.1 * ((k + v) % 4)));
      cfr(wx, by - rh, 1, rh + 6, DCB);
      cfr(wx - 1, by - rh, 3, 6, DCA);
    }
    ccirc(cx - 4, by - 1, 6, DCBd);
    ccirc(cx + 4, by, 5, DCBd);
  }
}
function drawBgAll() {
  var i, y0, y1, c0, c1, cI, xa, xb, sb, ya, yb, top, bot, sy1;
  /* narrow rectangles (restores while playing) are painted without overdraw:
     sky only above the hills, far hills only above the near hills, so no
     pixel flashes through an intermediate colour. Wide rectangles use the
     simple layered paint (only used for full redraws). */
  var careful = ((CX1 - CX0) <= 64);
  c0 = Math.floor(CX0 / 4); c1 = Math.floor((CX1 - 1) / 4);
  if (careful) {
    for (cI = c0; cI <= c1; cI++) {
      xa = Math.max(CX0, cI * 4); xb = Math.min(CX1, cI * 4 + 4);
      sb = GY - Math.max(farH[cI], nearH[cI]);
      if (sb > CY1) { sb = CY1; }
      if (sb <= CY0) { continue; }
      for (i = 0; i < NB; i++) {
        y0 = Math.floor(i * GY / NB); y1 = Math.floor((i + 1) * GY / NB);
        if (y1 <= CY0) { continue; }
        if (y0 >= sb) { break; }
        ya = Math.max(y0, CY0); yb = Math.min(y1, sb);
        if (yb > ya) { emit(xa, ya, xb - xa, yb - ya, bandC[i]); }
      }
    }
  } else {
    for (i = 0; i < NB; i++) {
      y0 = Math.floor(i * GY / NB); y1 = Math.floor((i + 1) * GY / NB);
      if (y1 <= CY0) { continue; }
      if (y0 >= CY1) { break; }
      cfr(0, y0, W, y1 - y0, bandC[i]);
    }
  }
  drawCel();
  if (starsOn) {
    for (i = 0; i < 40; i++) {
      if (stX[i] + 3 < CX0 || stX[i] - 3 > CX1 || stY[i] + 3 < CY0 || stY[i] - 3 > CY1) { continue; }
      if (stS[i] == 2) {
        cfr(stX[i], stY[i], 2, 2, STAR2); cfr(stX[i] - 1, stY[i], 4, 1, STAR2); cfr(stX[i], stY[i] - 1, 1, 4, STAR2);
      } else { cfr(stX[i], stY[i], 1, 1, STAR1); }
    }
  }
  for (i = 0; i < nCl; i++) { drawCloud(i); }
  for (i = 0; i < nD; i++) { if (dT[i] == 11) { drawDeco(i); } }
  for (i = c0; i <= c1; i++) {
    top = GY - farH[i];
    if (careful) {
      bot = GY - nearH[i];
      if (bot > top) {
        cfr(i * 4, top, 4, 1, farL);
        if (bot > top + 1) { cfr(i * 4, top + 1, 4, bot - top - 1, farC); }
      }
    } else {
      cfr(i * 4, top, 4, farH[i], farC);
      cfr(i * 4, top, 4, 1, farL);
    }
  }
  sy1 = CY1;
  if (CY1 > GY - 4) { CY1 = GY - 4; }
  for (i = 0; i < nD; i++) { if (dT[i] != 11) { drawDeco(i); } }
  CY1 = sy1;
  for (i = c0; i <= c1; i++) {
    cfr(i * 4, GY - nearH[i], 4, nearH[i], nearC);
    cfr(i * 4, GY - nearH[i], 4, 1, nearL);
  }
}
function bgRaw(x0, y0, x1, y1) {
  x0 = Math.floor(x0); y0 = Math.floor(y0); x1 = Math.ceil(x1); y1 = Math.ceil(y1);
  if (x0 < 0) { x0 = 0; } if (y0 < 0) { y0 = 0; }
  if (x1 > W) { x1 = W; } if (y1 > GY) { y1 = GY; }
  if (x1 <= x0 || y1 <= y0) { return; }
  CX0 = x0; CY0 = y0; CX1 = x1; CY1 = y1;
  drawBgAll();
}
function bgRect(x0, y0, x1, y1) {
  var ya, yb;
  x0 = Math.floor(x0); y0 = Math.floor(y0); x1 = Math.ceil(x1); y1 = Math.ceil(y1);
  if (!EXON || x0 >= EX1 || x1 <= EX0 || y0 >= EY1 || y1 <= EY0) { bgRaw(x0, y0, x1, y1); return; }
  if (y0 < EY0) { bgRaw(x0, y0, x1, EY0); }
  if (y1 > EY1) { bgRaw(x0, EY1, x1, y1); }
  ya = Math.max(y0, EY0); yb = Math.min(y1, EY1);
  if (x0 < EX0) { bgRaw(x0, ya, EX0, yb); }
  if (x1 > EX1) { bgRaw(EX1, ya, x1, yb); }
}
var pbX = [];
(function () { var i; for (i = 0; i < 9; i++) { pbX[i] = 0; } })();
function pebblePos(i, o) { return (((i * 47 - o) % W) + W) % W; }
/* stripes are tiled (every pixel painted once, final colour) -> no flicker */
function groundStripes(o) {
  var m = o % 32, sp = Math.floor(o / 32) & 1, k, x;
  fr(0, GY, W, 1, GLT);
  for (x = -m, k = 0; x < W; x += 32, k++) { fr(x, GY + 1, 32, 5, ((k + sp) & 1) ? GGB : GGA); }
  fr(0, GY + 6, W, 1, GSH);
}
/* full ground (dirt + stripes + pebbles) */
function drawGround(off) {
  var o = Math.floor(off), i, p;
  fr(0, GY + 7, W, H - GY - 7, GDIRT);
  groundStripes(o);
  for (i = 0; i < 9; i++) { p = pebblePos(i, o); pbX[i] = p; fr(p, GY + 9 + (i % 3) * 4, 4, 2, GPB); }
}
/* per-frame scroll: only stripes + moved pebbles are touched */
function drawGroundAnim(off) {
  var o = Math.floor(off), i, p, q, y;
  groundStripes(o);
  for (i = 0; i < 9; i++) {
    p = pebblePos(i, o); q = pbX[i];
    if (p == q) { continue; }
    y = GY + 9 + (i % 3) * 4;
    if (p < q && q - p < 4) {
      fr(p, y, 4, 2, GPB);
      fr(p + 4, y, q - p, 2, GDIRT);
    } else {
      fr(q, y, 4, 2, GDIRT);
      fr(p, y, 4, 2, GPB);
    }
    pbX[i] = p;
  }
}

/* ==========================================================
   BIRD + PIPES
   ========================================================== */
var OUTL = rgb(60, 35, 20), BEAKD = rgb(200, 90, 20), CHEEK = rgb(255, 150, 150);
function birdParts(cx, cy, vy, wp, sk) {
  var tilt, ty, bty, wyv, wcy, K, body, belly, wing, beak;
  tilt = vy * 1.1;
  if (tilt > 6) { tilt = 6; } if (tilt < -5) { tilt = -5; }
  tilt = Math.floor(tilt);
  K = SK[sk];
  body = K[1]; belly = K[2]; wing = K[3]; beak = K[4];
  wyv = WY[wp & 3];
  ty = cy - Math.floor(tilt / 2);
  wcy = cy + 2 + Math.floor(wyv / 2);
  cfr(cx - 14, ty - 3, 7, 3, wing);
  cfr(cx - 15, ty, 8, 2, wing);
  cfr(cx - 15, ty + 2, 8, 1, OUTL);
  cfr(cx - 14, ty + 3, 7, 3, wing);
  ccirc(cx, cy, 8, body);
  ccirc(cx + 2, cy + 3, 4, belly);
  ccirc(cx - 3, cy - 4, 2, belly);
  ccirc(cx - 3, wcy, 5, wing);
  cfr(cx - 10, cy + 1 + wyv, 5, 3, wing);
  cfr(cx - 10, cy + 1 + wyv, 5, 1, belly);
  ccirc(cx + 4, cy - 3, 3, WHITE);
  ccirc(cx + 5, cy - 3, 1, BLACK);
  cfr(cx + 5, cy - 4, 1, 1, WHITE);
  bty = cy + Math.floor(tilt * 0.4);
  cfr(cx + 8, bty - 2, 7, 3, beak);
  cfr(cx + 8, bty + 1, 6, 2, BEAKD);
  cfr(cx + 15, bty - 1, 1, 3, OUTL);
  ccirc(cx + 1, cy + 1, 2, CHEEK);
  cfr(cx - 1, cy - 11, 2, 3, wing);
  cfr(cx + 1, cy - 10, 2, 2, wing);
  cfr(cx - 3, cy - 10, 2, 2, wing);
}
/* outline rings: one call each, drawn after the fills. They sit inside the
   never-erased body zone, so the old pixels are simply painted over. */
function birdRings(cx, cy, wp) {
  var wcy = cy + 2 + Math.floor(WY[wp & 3] / 2);
  ringAt(cx, cy, 8); ringAt(cx - 3, wcy, 5); ringAt(cx + 4, cy - 3, 3);
}
function ringAt(cx, cy, r) {
  if (HAS_CIRCO) { display.drawCircle(cx, cy, r + 1, OUTL); display.drawCircle(cx, cy, r, OUTL); }
  else { setClip(cx - r - 2, cy - r - 2, cx + r + 3, cy + r + 3); cring(cx, cy, r, OUTL); }
}
/* whole bird */
function drawBird(cx, cy, vy, wp, sk) {
  cx = Math.floor(cx); cy = Math.floor(cy);
  if (stripOK(cx)) { birdFrame(cx, cy, cy, vy, wp, sk); return; }
  drawBirdOld(cx, cy, vy, wp, sk);
}
function drawBirdOld(cx, cy, vy, wp, sk) {
  setClip(cx - 17, cy - 13, cx + 18, cy + 14);
  birdParts(cx, cy, vy, wp, sk);
  birdRings(cx, cy, wp);
}
/* Move the bird from oy to ny. The picture is rebuilt in horizontal slices:
   each slice is erased and redrawn straight away, so no part of the bird is
   missing for long. The new body disc is never erased - it is only painted
   over - and its outline is added last. */
function birdStep(cx, oy, ny, vy, wp, sk) {
  var bx0 = cx - 16, bx1 = cx + 18, top = Math.min(oy, ny) - 12, bot = Math.max(oy, ny) + 14;
  var a, b, ea, eb, ya, yb, y, hm, h, dd;
  for (a = top; a < bot; a += 10) {
    b = Math.min(a + 10, bot);
    ea = Math.max(a, oy - 12); eb = Math.min(b, oy + 14);
    if (eb > ea) {
      ya = Math.max(ea, ny - 9); yb = Math.min(eb, ny + 10);
      if (yb <= ya) { bgNoPipes(bx0, ea, bx1, eb); }
      else {
        if (ea < ya) { bgNoPipes(bx0, ea, bx1, ya); }
        if (yb < eb) { bgNoPipes(bx0, yb, bx1, eb); }
        hm = 99;
        for (y = ya; y < yb; y++) { dd = y - ny; h = Math.floor(Math.sqrt(81 - dd * dd)); if (h < hm) { hm = h; } }
        bgNoPipes(bx0, ya, cx - hm, yb);
        bgNoPipes(cx + hm + 1, ya, bx1, yb);
      }
    }
    setClip(bx0 - 1, a, bx1, b);
    birdParts(cx, ny, vy, wp, sk);
  }
  birdRings(cx, ny, wp);
}


/* ==========================================================
   FLICKER-FREE BIRD
   The scenery behind the bird's flight column is flattened once per
   level into rows of coloured runs (rowS). Every frame the bird, the
   pipes and the scenery inside the bird's box are composed in memory and
   sent to the screen as ONE pass: each pixel is written once, with its
   final colour. Nothing is erased first, so nothing can flicker.
   ========================================================== */
var REC = false, rowS = [], SX0 = -1000, SX1 = -1000, bgId = 0, stripId = -1;
var EXON = false, EX0 = 0, EY0 = 0, EX1 = 0, EY1 = 0;
var TA = [], TB = [], CA = TA, CB = TB, Cn = 0;
var BRW = [], BRN = [], bY0 = 0, bY1 = 0, bZX0 = 0, bZX1 = 0;
var mA = [], mB = [], mC = [], mY = [], mL = [], mn = 0;
(function () {
  var i;
  for (i = 0; i < 300; i++) { TA[i] = 0; TB[i] = 0; }
  for (i = 0; i < 64; i++) { BRW[i] = []; BRN[i] = 0; }
  for (i = 0; i < 40; i++) { mA[i] = 0; mB[i] = 0; mC[i] = 0; mY[i] = 0; mL[i] = 0; }
})();
function emit(x, y, w, h, c) {
  var yy;
  if (REC) { for (yy = y; yy < y + h; yy++) { if (yy >= 0 && yy < GY) { rowS[yy] = spOver(rowS[yy], x, x + w, c); } } }
  else { display.drawFillRect(x, y, w, h, c); }
}
function pushT(N, a, b, c) {
  var n = N.length;
  if (b <= a) { return; }
  if (n >= 3 && N[n - 1] == c && N[n - 2] == a) { N[n - 2] = b; return; }
  N.push(a); N.push(b); N.push(c);
}
/* paint span [a,b) over a row's run list (build time only) */
function spOver(L, a, b, c) {
  var N = [], i, n = L.length, A, B, K, ins = false;
  for (i = 0; i < n; i += 3) {
    A = L[i]; B = L[i + 1]; K = L[i + 2];
    if (B <= a) { pushT(N, A, B, K); continue; }
    if (A >= b) { if (!ins) { pushT(N, a, b, c); ins = true; } pushT(N, A, B, K); continue; }
    if (A < a) { pushT(N, A, a, K); }
    if (!ins) { pushT(N, a, b, c); ins = true; }
    if (B > b) { pushT(N, b, B, K); }
  }
  if (!ins) { pushT(N, a, b, c); }
  return N;
}
function buildStrip(x0, x1) {
  var y;
  stripId = -1;
  SX0 = x0; SX1 = x1;
  for (y = 0; y < GY; y++) { rowS[y] = []; }
  REC = true;
  try { setClip(x0, 0, x1, GY); drawBgAll(); } catch (e) { REC = false; return; }
  REC = false;
  stripId = bgId;
}
/* allocation-free versions used every frame (two ping-pong buffers) */
function pt(D, dn, a, b, c) {
  if (b <= a) { return dn; }
  if (dn >= 3 && D[dn - 1] == c && D[dn - 2] == a) { D[dn - 2] = b; return dn; }
  D[dn] = a; D[dn + 1] = b; D[dn + 2] = c;
  return dn + 3;
}
function clipInto(D, L, a, b) {
  var i, dn = 0, A, B;
  for (i = 0; i < L.length; i += 3) {
    A = L[i]; B = L[i + 1];
    if (B <= a || A >= b) { continue; }
    dn = pt(D, dn, (A < a) ? a : A, (B > b) ? b : B, L[i + 2]);
  }
  return dn;
}
function spo(S, sn, D, a, b, c) {
  var i, dn = 0, A, B, K, ins = false;
  for (i = 0; i < sn; i += 3) {
    A = S[i]; B = S[i + 1]; K = S[i + 2];
    if (B <= a) { dn = pt(D, dn, A, B, K); continue; }
    if (A >= b) { if (!ins) { dn = pt(D, dn, a, b, c); ins = true; } dn = pt(D, dn, A, B, K); continue; }
    if (A < a) { dn = pt(D, dn, A, a, K); }
    if (!ins) { dn = pt(D, dn, a, b, c); ins = true; }
    if (B > b) { dn = pt(D, dn, b, B, K); }
  }
  if (!ins) { dn = pt(D, dn, a, b, c); }
  return dn;
}
function ovr(a, b, c) {
  var t;
  if (a < bZX0) { a = bZX0; } if (b > bZX1) { b = bZX1; }
  if (b <= a) { return; }
  Cn = spo(CA, Cn, CB, a, b, c);
  t = CA; CA = CB; CB = t;
}
function bodyRow(x) {
  ovr(x, x + 2, PE); ovr(x + 2, x + 6, PL); ovr(x + 6, x + 22, PM); ovr(x + 22, x + 28, PD); ovr(x + 28, x + 30, PE);
}
function capRow(x, r) {
  if (r == 0 || r == CAPH - 1) { ovr(x, x + 36, PE); return; }
  ovr(x, x + 1, PE); ovr(x + 1, x + 5, PM); ovr(x + 5, x + 9, PL); ovr(x + 9, x + 25, PM);
  ovr(x + 25, x + 31, PD); ovr(x + 31, x + 35, PM); ovr(x + 35, x + 36, PE);
}
function pipesInto(y) {
  var i, px, gt, gb;
  if (y < PT || y >= GY) { return; }
  for (i = 0; i < NPIPE; i++) {
    if (!pOn[i]) { continue; }
    px = Math.floor(pX[i]);
    if (px - 3 >= bZX1 || px + PW + 3 <= bZX0) { continue; }
    gt = pGT[i]; gb = pGB[i];
    if (y < gt - CAPH || y >= gb + CAPH) { bodyRow(px); }
    else if (y < gt) { capRow(px - 3, y - (gt - CAPH)); }
    else if (y >= gb) { capRow(px - 3, y - gb); }
  }
}
function brs(y, a, b, c) {
  var r, n;
  if (y < bY0 || y >= bY1) { return; }
  if (a < bZX0) { a = bZX0; } if (b > bZX1) { b = bZX1; }
  if (b <= a) { return; }
  r = y - bY0; n = BRN[r];
  BRW[r][n] = a; BRW[r][n + 1] = b; BRW[r][n + 2] = c; BRN[r] = n + 3;
}
function brR(x, y, w, h, c) { var yy; for (yy = y; yy < y + h; yy++) { brs(yy, x, x + w, c); } }
function brD(cx, cy, r, c) {
  var dy, dx;
  for (dy = -r; dy <= r; dy++) { dx = Math.floor(Math.sqrt(r * r - dy * dy)); brs(cy + dy, cx - dx, cx + dx + 1, c); }
}
/* the bird as horizontal spans, back to front */
function birdRec(cx, cy, vy, wp, sk) {
  var tilt, ty, bty, wyv, wcy, K, body, belly, wing, beak;
  tilt = vy * 1.1;
  if (tilt > 6) { tilt = 6; } if (tilt < -5) { tilt = -5; }
  tilt = Math.floor(tilt);
  K = SK[sk]; body = K[1]; belly = K[2]; wing = K[3]; beak = K[4];
  wyv = WY[wp & 3];
  ty = cy - Math.floor(tilt / 2);
  wcy = cy + 2 + Math.floor(wyv / 2);
  bty = cy + Math.floor(tilt * 0.4);
  brR(cx - 14, ty - 3, 7, 3, wing); brR(cx - 15, ty, 8, 3, wing); brR(cx - 14, ty + 3, 7, 3, wing); brR(cx - 15, ty + 2, 8, 1, OUTL);
  brD(cx, cy, 9, OUTL); brD(cx, cy, 8, body); brD(cx + 2, cy + 3, 4, belly); brD(cx - 3, cy - 4, 2, belly);
  brD(cx - 3, wcy, 6, OUTL); brD(cx - 3, wcy, 5, wing);
  brR(cx - 10, cy + 1 + wyv, 5, 3, wing); brR(cx - 10, cy + 1 + wyv, 5, 1, belly);
  brD(cx + 4, cy - 3, 4, OUTL); brD(cx + 4, cy - 3, 3, WHITE); brD(cx + 5, cy - 3, 1, BLACK); brR(cx + 5, cy - 4, 1, 1, WHITE);
  brR(cx + 8, bty - 2, 7, 3, beak); brR(cx + 8, bty + 1, 6, 2, BEAKD); brR(cx + 15, bty - 1, 1, 3, OUTL);
  brD(cx + 1, cy + 1, 2, CHEEK);
  brR(cx - 1, cy - 11, 2, 3, wing); brR(cx + 1, cy - 10, 2, 2, wing); brR(cx - 3, cy - 10, 2, 2, wing);
}
function runsRow(y) {
  var i, j, a, b, c, f;
  for (i = 0; i < Cn; i += 3) {
    a = CA[i]; b = CA[i + 1]; c = CA[i + 2]; f = -1;
    for (j = 0; j < mn; j++) { if (mL[j] == y - 1 && mA[j] == a && mB[j] == b && mC[j] == c) { f = j; break; } }
    if (f >= 0) { mL[f] = y; }
    else { mA[mn] = a; mB[mn] = b; mC[mn] = c; mY[mn] = y; mL[mn] = y; mn++; }
  }
  j = 0;
  while (j < mn) {
    if (mL[j] != y) {
      display.drawFillRect(mA[j], mY[j], mB[j] - mA[j], mL[j] - mY[j] + 1, mC[j]);
      mn--;
      mA[j] = mA[mn]; mB[j] = mB[mn]; mC[j] = mC[mn]; mY[j] = mY[mn]; mL[j] = mL[mn];
    } else { j++; }
  }
}
function flushRuns() {
  var j;
  for (j = 0; j < mn; j++) { display.drawFillRect(mA[j], mY[j], mB[j] - mA[j], mL[j] - mY[j] + 1, mC[j]); }
  mn = 0;
}
function stripOK(cx) { return (stripId == bgId && SX0 == cx - 18); }
/* keep other painters out of the box the bird is about to be composed in */
function exZone(cx, oy, ny) {
  if (!stripOK(cx)) { EXON = false; return; }
  EX0 = cx - 16; EX1 = cx + 18;
  EY0 = Math.max(PT, Math.min(oy, ny) - 12); EY1 = Math.min(GY, Math.max(oy, ny) + 12);
  if (EY1 > EY0 + 63) { EY1 = EY0 + 63; }
  EXON = (EY1 > EY0);
}
function frx(x, y, w, h, c) {
  var x1 = x + w, y1 = y + h, ya, yb;
  if (!EXON || x >= EX1 || x1 <= EX0 || y >= EY1 || y1 <= EY0) { fr(x, y, w, h, c); return; }
  if (y < EY0) { fr(x, y, w, EY0 - y, c); }
  if (y1 > EY1) { fr(x, EY1, w, y1 - EY1, c); }
  ya = Math.max(y, EY0); yb = Math.min(y1, EY1);
  if (x < EX0) { fr(x, ya, EX0 - x, yb - ya, c); }
  if (x1 > EX1) { fr(EX1, ya, x1 - EX1, yb - ya, c); }
}
/* move the bird from oy to ny: one pass, every pixel painted once */
function birdFrame(cx, oy, ny, vy, wp, sk) {
  var y, r, i, L;
  if (!stripOK(cx)) { birdStep(cx, oy, ny, vy, wp, sk); return; }
  bZX0 = cx - 16; bZX1 = cx + 18;
  bY0 = Math.max(PT, Math.min(oy, ny) - 12); bY1 = Math.min(GY, Math.max(oy, ny) + 12);
  if (bY1 > bY0 + 63) { bY1 = bY0 + 63; }
  if (bY1 <= bY0) { return; }
  for (r = 0; r < bY1 - bY0; r++) { BRN[r] = 0; }
  birdRec(cx, ny, vy, wp, sk);
  mn = 0;
  for (y = bY0; y < bY1; y++) {
    Cn = clipInto(CA, rowS[y], bZX0, bZX1);
    pipesInto(y);
    r = y - bY0; L = BRW[r];
    for (i = 0; i < BRN[r]; i += 3) { ovr(L[i], L[i + 1], L[i + 2]); }
    runsRow(y);
  }
  flushRuns();
}

function pfr(x, y, w, h, c) {
  x = iv(x); y = iv(y); w = iv(w); h = iv(h);
  if (y < PT) { h -= (PT - y); y = PT; }
  if (y + h > GY) { h = GY - y; }
  if (h <= 0 || w <= 0) { return; }
  frx(x, y, w, h, c);
}
/* pipes are tiled from non-overlapping stripes: each pixel is written once
   with its final colour, so redrawing a pipe every frame cannot flicker */
function pbody(x, y, h) {
  pfr(x, y, 2, h, PE); pfr(x + 2, y, 4, h, PL); pfr(x + 6, y, 16, h, PM);
  pfr(x + 22, y, 6, h, PD); pfr(x + 28, y, 2, h, PE);
}
function pcap(x, y) {
  var h = CAPH - 2, yy = y + 1;
  pfr(x, y, 36, 1, PE); pfr(x, y + CAPH - 1, 36, 1, PE);
  pfr(x, yy, 1, h, PE); pfr(x + 1, yy, 4, h, PM); pfr(x + 5, yy, 4, h, PL);
  pfr(x + 9, yy, 16, h, PM); pfr(x + 25, yy, 6, h, PD); pfr(x + 31, yy, 4, h, PM);
  pfr(x + 35, yy, 1, h, PE);
}
function drawPipe(x, gt, gb) {
  var h1, y2;
  x = Math.floor(x);
  h1 = gt - CAPH - PT;
  if (h1 > 0) { pbody(x, PT, h1); }
  pcap(x - 3, gt - CAPH);
  pcap(x - 3, gb);
  y2 = gb + CAPH;
  if (GY - y2 > 0) { pbody(x, y2, GY - y2); }
}

/* ==========================================================
   GAME STATE
   ========================================================== */
var lvl = 1, ti = 0, lives = 3, passed = 0, goal = 6, spawned = 0, lost = 0, score = 0;
var by = 82, bv = 0, wingT = 0, gOff = 0, drawnBY = 82, hudDirty = true;
var spd = 2.2, gapH = 66, spacing = 100, amp = 0, maxD = 46, lastSX = -1000, lastC = -1, firstP = true;
var pX = [], pB = [], pP = [], pOn = [], pSc = [], pGT = [], pGB = [];
var gFlap = false, gPause = false;
var IA = [], IB = [], YS = [], oXs = [], oGTs = [], oGBs = [], oOn = [];
(function () {
  var i;
  for (i = 0; i < NPIPE + 2; i++) { IA[i] = 0; IB[i] = 0; }
  for (i = 0; i < NPIPE * 4 + 4; i++) { YS[i] = 0; }
  for (i = 0; i < NPIPE; i++) { oXs[i] = 0; oGTs[i] = 0; oGBs[i] = 0; oOn[i] = 0; }
})();
function clearPipes() { var i; for (i = 0; i < NPIPE; i++) { pOn[i] = 0; pSc[i] = 0; } }
/* repaint the scenery in a rectangle but leave the pipes alone (they are
   already drawn there) - splits the rectangle around the pipe shapes */
function bgNoPipes(x0, y0, x1, y1) {
  var i, j, n, t, any = false, ya, yb, nI, cur, a, b, gt, gb, px, v, q;
  x0 = Math.floor(x0); y0 = Math.floor(y0); x1 = Math.ceil(x1); y1 = Math.ceil(y1);
  if (x0 < 0) { x0 = 0; } if (y0 < PT) { y0 = PT; }
  if (x1 > W) { x1 = W; } if (y1 > GY) { y1 = GY; }
  if (x1 <= x0 || y1 <= y0) { return; }
  YS[0] = y0; n = 1;
  for (i = 0; i < NPIPE; i++) {
    if (!pOn[i]) { continue; }
    px = Math.floor(pX[i]);
    if (px - 3 >= x1 || px + PW + 3 <= x0) { continue; }
    any = true; gt = pGT[i]; gb = pGB[i];
    for (q = 0; q < 4; q++) {
      v = (q == 0) ? gt - CAPH : ((q == 1) ? gt : ((q == 2) ? gb : gb + CAPH));
      if (v > y0 && v < y1) { YS[n] = v; n++; }
    }
  }
  if (!any) { bgRect(x0, y0, x1, y1); return; }
  YS[n] = y1; n++;
  for (i = 1; i < n; i++) { t = YS[i]; j = i - 1; while (j >= 0 && YS[j] > t) { YS[j + 1] = YS[j]; j--; } YS[j + 1] = t; }
  for (i = 0; i < n - 1; i++) {
    ya = YS[i]; yb = YS[i + 1];
    if (yb <= ya) { continue; }
    nI = 0;
    for (j = 0; j < NPIPE; j++) {
      if (!pOn[j]) { continue; }
      px = Math.floor(pX[j]); gt = pGT[j]; gb = pGB[j];
      if (ya < gt - CAPH || ya >= gb + CAPH) { a = px; b = px + PW; }
      else if ((ya >= gt - CAPH && ya < gt) || (ya >= gb && ya < gb + CAPH)) { a = px - 3; b = px + PW + 3; }
      else { continue; }
      if (b <= x0 || a >= x1) { continue; }
      IA[nI] = Math.max(a, x0); IB[nI] = Math.min(b, x1); nI++;
    }
    for (q = 1; q < nI; q++) {
      a = IA[q]; b = IB[q]; j = q - 1;
      while (j >= 0 && IA[j] > a) { IA[j + 1] = IA[j]; IB[j + 1] = IB[j]; j--; }
      IA[j + 1] = a; IB[j + 1] = b;
    }
    cur = x0;
    for (j = 0; j < nI; j++) {
      if (IA[j] > cur) { bgRect(cur, ya, IA[j], yb); }
      if (IB[j] > cur) { cur = IB[j]; }
    }
    if (cur < x1) { bgRect(cur, ya, x1, yb); }
  }
}
(function () {
  var i;
  for (i = 0; i < NPIPE; i++) { pX[i] = 0; pB[i] = 80; pP[i] = 0; pOn[i] = 0; pSc[i] = 0; pGT[i] = 60; pGB[i] = 100; }
})();

function drawHeart(x, y, c) {
  ci(x - 2, y, 2, c); ci(x + 2, y, 2, c);
  fr(x - 3, y + 1, 7, 1, c); fr(x - 2, y + 2, 5, 1, c); fr(x - 1, y + 3, 3, 1, c); fr(x, y + 4, 1, 1, c);
}
function drawHUD() {
  var i, c;
  fr(0, 0, W, PT, rgb(8, 20, 36));
  fr(0, PT - 1, W, 1, rgb(40, 80, 120));
  txt("L" + lvl + " " + TH[ti][0], 3, 3, 1, YEL);
  txt("Pipes " + passed + "/" + goal, 124, 3, 1, WHITE);
  for (i = 0; i < 3; i++) { drawHeart(214 + i * 11, 3, (i < lives) ? RED : rgb(60, 40, 40)); }
  c = "$" + S.coins;
  txt(c, W - c.length * 6 - 3, 3, 1, GREEN);
}
function hudCounts() {
  var c = "$" + S.coins;
  fr(120, 1, 90, PT - 2, rgb(8, 20, 36));
  txt("Pipes " + passed + "/" + goal, 124, 3, 1, WHITE);
  fr(W - 66, 1, 66, PT - 2, rgb(8, 20, 36));
  txt(c, W - c.length * 6 - 3, 3, 1, GREEN);
}
function drawPipesAll() {
  var i;
  for (i = 0; i < NPIPE; i++) { if (pOn[i]) { drawPipe(pX[i], pGT[i], pGB[i]); } }
}
function drawFull() {
  bgRect(0, PT, W, GY);
  drawPipesAll();
  drawGround(gOff);
  drawHUD();
  hudDirty = false;
  drawBird(BX, by, bv, Math.floor(wingT) & 3, S.skin);
  drawnBY = Math.floor(by);
}
function pipeC(i) {
  var c = pB[i], lo, hi;
  if (amp > 0) { c += Math.sin(pP[i]) * amp; }
  lo = PT + CAPH + 4 + gapH / 2; hi = GY - CAPH - 4 - gapH / 2;
  if (c < lo) { c = lo; } if (c > hi) { c = hi; }
  return c;
}
function spawnPipe() {
  var i, f = -1, lo, hi, a, b, c;
  for (i = 0; i < NPIPE; i++) { if (!pOn[i]) { f = i; break; } }
  if (f < 0) { return; }
  lo = PT + CAPH + 6 + Math.floor(gapH / 2) + amp;
  hi = GY - CAPH - 6 - Math.floor(gapH / 2) - amp;
  if (hi < lo) { hi = lo; }
  if (lastC < 0) { c = ri(lo, hi); }
  else {
    a = Math.max(lo, lastC - maxD); b = Math.min(hi, lastC + maxD);
    if (b < a) { b = a; }
    c = ri(a, b);
  }
  lastC = c;
  pX[f] = firstP ? 240 : (W + 6);
  firstP = false;
  pB[f] = c; pP[f] = rnd() * 6.28; pOn[f] = 1; pSc[f] = 0;
  c = pipeC(f);
  pGT[f] = Math.floor(c - gapH / 2); pGB[f] = pGT[f] + gapH;
  lastSX = pX[f];
  spawned++;
}
function initRound() {
  var i;
  for (i = 0; i < NPIPE; i++) { pOn[i] = 0; pSc[i] = 0; }
  spawned = passed; lastSX = -1000; lastC = -1; firstP = true;
  by = 82; bv = 0; drawnBY = 82; wingT = 0;
  hudDirty = true;
}
function cr(cx, cy, r, x, y, w, h) {
  var nx = (cx < x) ? x : ((cx > x + w) ? x + w : cx);
  var ny = (cy < y) ? y : ((cy > y + h) ? y + h : cy);
  var dx = cx - nx, dy = cy - ny;
  return (dx * dx + dy * dy) < r * r;
}
function hitTest() {
  var i, x, gt, gb, r = 6;
  if (by + r >= GY) { return true; }
  for (i = 0; i < NPIPE; i++) {
    if (!pOn[i]) { continue; }
    x = pX[i];
    if (x - 3 > BX + r + 1 || x + PW + 3 < BX - r - 1) { continue; }
    gt = pGT[i]; gb = pGB[i];
    if (cr(BX, by, r, x, -200, PW, gt - CAPH + 200)) { return true; }
    if (cr(BX, by, r, x - 3, gt - CAPH, PW + 6, CAPH)) { return true; }
    if (cr(BX, by, r, x - 3, gb, PW + 6, CAPH)) { return true; }
    if (cr(BX, by, r, x, gb + CAPH, PW, 300)) { return true; }
  }
  return false;
}

/* one frame: 0 ok, 1 hit, 2 level won
   order matters for flicker: old pixels are only restored where nothing new
   is painted, pipes + ground are tiled, the bird is erased/drawn last and
   back to back */
function frame(dt) {
  var i, mvx = spd * dt, gc, hit, wp, oy, ny, nX, oX, oGT, oGB, nGT, nGB;
  bv += GRAV * dt; if (bv > VMAX) { bv = VMAX; }
  by += bv * dt;
  if (by < PT + 11) { by = PT + 11; if (bv < 0) { bv = 0; } }
  ny = Math.floor(by);
  exZone(BX, drawnBY, ny);
  gOff += mvx;
  lastSX -= mvx;
  for (i = 0; i < NPIPE; i++) {
    oOn[i] = 0;
    if (!pOn[i]) { continue; }
    oOn[i] = 1; oXs[i] = Math.floor(pX[i]); oGTs[i] = pGT[i]; oGBs[i] = pGB[i];
    pX[i] -= mvx;
    if (amp > 0) {
      pP[i] += 0.07 * dt;
      gc = pipeC(i);
      pGT[i] = Math.floor(gc - gapH / 2); pGB[i] = pGT[i] + gapH;
    }
  }
  if (spawned < goal && lastSX <= W - spacing) { spawnPipe(); }
  for (i = 0; i < NPIPE; i++) {
    if (!oOn[i]) { continue; }
    oX = oXs[i]; oGT = oGTs[i]; oGB = oGBs[i];
    nX = Math.floor(pX[i]); nGT = pGT[i]; nGB = pGB[i];
    bgNoPipes(nX + PW, PT, oX + PW, oGT - CAPH);
    bgNoPipes(nX + PW + 3, oGT - CAPH, oX + PW + 3, oGT);
    bgNoPipes(nX + PW + 3, oGB, oX + PW + 3, oGB + CAPH);
    bgNoPipes(nX + PW, oGB + CAPH, oX + PW, GY);
    if (nGT != oGT) { bgNoPipes(oX - 3, Math.min(nGT, oGT) - CAPH, oX + PW + 4, Math.max(nGT, oGT)); }
    if (nGB != oGB) { bgNoPipes(oX - 3, Math.min(nGB, oGB), oX + PW + 4, Math.max(nGB, oGB) + CAPH); }
    if (nX + PW + 4 <= 0) { pOn[i] = 0; }
  }
  for (i = 0; i < NPIPE; i++) {
    if (pOn[i] && !pSc[i] && pX[i] + PW + 3 < BX - 6) {
      pSc[i] = 1; passed++; score++; S.coins++; S.hi++; hudDirty = true;
      beep(1900, 20);
    }
  }
  hit = hitTest();
  drawPipesAll();
  drawGroundAnim(gOff);
  wingT += 0.45 * dt;
  wp = Math.floor(wingT) & 3;
  if (bv > 4) { wp = 1; }
  oy = drawnBY;
  birdFrame(BX, oy, ny, bv, wp, S.skin);
  EXON = false;
  drawnBY = ny;
  if (hudDirty) { hudCounts(); hudDirty = false; }
  if (hit) { return 1; }
  if (passed >= goal) { return 2; }
  return 0;
}

function readIn() {
  var sp = kSel(), nx = kNext(), pv = kPrev(), es = kEsc();
  gFlap = (nx || pv);
  gPause = es;
  if (S.ctl == 0) { if (sp) { gFlap = true; } }
  else { if (sp) { gPause = true; } }
}
function doFlap() { bv = FLAPV; wingT = 0; beep(1300, 10); }

function pauseMenu() {
  ENC_GAP_MS = MENU_GAP; ENC_REV_MS = MENU_REV; SEL_HOLD_MS = 200;
  encOn();
  var idx = 0, res = 0, r;
  while (true) {
    r = menu("PAUSED", ["Resume", "Save Game", "Sound: " + (SOUND ? "ON" : "OFF"),
      "Controls: " + (S.ctl == 0 ? "SEL=FLAP" : "TURN only"), "Quit Level"], idx,
      ["Back to the game", "Save coins, birds & level", "Toggle sound effects",
       "SEL flaps  /  turn-only (SEL pauses)", "Give up this level"]);
    if (r <= 0) { res = 0; break; }
    idx = r;
    if (r == 1) { saveGame(); flash("Game saved", GREEN); }
    else if (r == 2) { SOUND = !SOUND; S.sound = SOUND ? 1 : 0; }
    else if (r == 3) { S.ctl = 1 - S.ctl; }
    else if (r == 4) { if (confirmBox("Quit level?")) { res = 3; break; } }
  }
  ENC_GAP_MS = GAME_GAP; ENC_REV_MS = GAME_REV; SEL_HOLD_MS = 60;
  return res;
}
function readyText() {
  sctxt("GET READY", 24, 2, WHITE, rgb(0, 40, 80));
  sctxt(S.ctl == 0 ? "SEL or TURN knob = FLAP" : "TURN knob = FLAP", 46, 1, YEL, rgb(0, 40, 80));
}
/* bird bobs until the first flap. returns 0 = go, 3 = quit */
function readyLoop() {
  var t = 0, oy;
  encOn();
  readyText();
  while (true) {
    t++;
    oy = drawnBY;
    by = 82 + Math.sin(t * 0.35) * 5;
    wingT += 0.5;
    birdFrame(BX, oy, Math.floor(by), Math.cos(t * 0.35) * 1.5, Math.floor(wingT) & 3, S.skin);
    drawnBY = Math.floor(by);
    readIn();
    if (gPause) {
      if (pauseMenu() == 3) { return 3; }
      drawFull(); readyText(); encOn();
    } else if (gFlap) {
      bgRect(0, 20, W, 60);
      doFlap();
      return 0;
    }
    wait(40);
  }
}
function hitFx() {
  beep(400, 80); beep(250, 120);
  fr(0, PT, W, 3, RED); fr(0, GY - 3, W, 3, RED); fr(0, PT, 3, GY - PT, RED); fr(W - 3, PT, 3, GY - PT, RED);
  fr(100, 60, 120, 34, BLACK);
  rc(100, 60, 120, 34, RED);
  ctxt("OUCH!", 69, 2, RED);
  wait(700);
}
function deathFall() {
  var v = -2.5, y = by, n, oy, ny;
  beep(300, 120); beep(200, 200);
  oy = Math.floor(y);
  for (n = 0; n < 60; n++) {
    v += 0.7; y += v;
    if (y > GY - 6) { y = GY - 6; }
    ny = Math.floor(y);
    birdStep(BX, oy, ny, 7, 1, S.skin);
    oy = ny;
    if (y >= GY - 6) { break; }
    wait(25);
  }
  wait(250);
}
/* returns "win", "dead" or "quit" */
function runLevel() {
  var last, t0, dt, r, el, rem;
  initRound();
  drawFull();
  if (readyLoop() == 3) { return "quit"; }
  last = nowMs() - FRAME_MS;
  while (true) {
    t0 = nowMs();
    dt = (t0 - last) / FRAME_MS;
    last = t0;
    if (dt < 0.5) { dt = 0.5; } if (dt > 2.2) { dt = 2.2; }
    readIn();
    if (gPause) {
      if (pauseMenu() == 3) { return "quit"; }
      drawFull(); encOn();
      last = nowMs() - FRAME_MS;
      continue;
    }
    if (gFlap) { doFlap(); }
    r = frame(dt);
    if (r == 1) {
      lost++; lives--; hudDirty = true;
      if (lives <= 0) { drawHUD(); deathFall(); return "dead"; }
      drawHUD();
      hitFx();
      initRound(); drawFull();
      if (readyLoop() == 3) { return "quit"; }
      last = nowMs() - FRAME_MS;
      continue;
    } else if (r == 2) { return "win"; }
    el = nowMs() - t0;
    rem = FRAME_MS - el;
    if (rem < 3) { rem = 3; }
    wait(rem);
  }
}

/* ---------- play one level ---------- */
function playLevel(l) {
  var res, T, b, stars, bonus, ls, isBest;
  lvl = l; ti = Math.floor((l - 1) / 5);
  T = TH[ti];
  goal = 6 + Math.floor(l / 5);
  lives = 3; lost = 0; score = 0; passed = 0; spawned = 0; gOff = 0;
  spd = Math.min(3.6, 2.0 + l * 0.022);
  gapH = 66 - Math.floor(l * 0.3);
  spacing = 100 + Math.floor(l / 4);
  amp = (l >= 26) ? Math.min(18, Math.floor((l - 20) / 3)) : 0;
  maxD = 46 - Math.floor(l / 12) * 2;

  /* intro card */
  cls(DARK);
  fr(0, 0, W, 24, HDR);
  txt("LEVEL " + l, 6, 4, 2, WHITE);
  ctxt(T[0], 32, 3, YEL);
  if ((l - 1) % 5 == 0) { ctxt("* NEW AREA *", 62, 2, CYAN); }
  else { ctxt("Area " + (ti + 1) + " of " + NAREA + "  -  stage " + (((l - 1) % 5) + 1) + "/5", 66, 1, CYAN); }
  ctxt("Clear " + goal + " pipes. You have 3 hearts.", 86, 1, WHITE);
  ctxt(S.ctl == 0 ? "SEL or turn = flap.  ESC = pause" : "Turn = flap.  SEL / ESC = pause", 100, 1, HINT);
  ctxt(amp > 0 ? "Watch out: the pipes MOVE!" : "Dodge the pipes. Don't hit the ground!", 114, 1, ORNG);
  for (b = 0; b < 16; b++) { fr(40 + b * 15, 130, 15, 8, c3(mt(T[1], T[2], b / 15))); }
  ctxt("Press SEL to start", H - 14, 1, WHITE);
  if (waitKey() == 4) { return "quit"; }

  buildBg(ti);
  buildStrip(BX - 18, BX + 20);
  ENC_GAP_MS = GAME_GAP; ENC_REV_MS = GAME_REV; SEL_HOLD_MS = 60;
  res = runLevel();
  ENC_GAP_MS = MENU_GAP; ENC_REV_MS = MENU_REV; SEL_HOLD_MS = 200;
  encOn();

  if (res == "quit") { saveGame(); return "quit"; }
  if (res == "dead") {
    popup([["GAME OVER", 3, RED], ["Pipes " + passed + " / " + goal, 2, WHITE], ["Coins kept: $" + S.coins, 1, YEL], ["Give it another flap!", 1, GRAY]], RED);
    saveGame();
    return "dead";
  }
  /* level won */
  stars = (lost == 0) ? 3 : ((lost == 1) ? 2 : 1);
  bonus = 20 + l * 2 + stars * 10;
  S.coins += bonus;
  if (stars > S.stars[l - 1]) { S.stars[l - 1] = stars; }
  var st = "";
  for (b = 0; b < 3; b++) { st += (b < stars ? "*" : "-") + " "; }
  beep(1500, 80); beep(1900, 80); beep(2300, 120);
  ls = [["LEVEL " + l + " CLEAR", 2, GREEN], [st, 3, YEL], ["Pipes " + passed + "  Bonus $" + bonus, 1, WHITE]];
  if (l == S.maxLvl && l < MAXLVL) { S.maxLvl = l + 1; ls.push(["Level " + S.maxLvl + " unlocked!", 1, CYAN]); }
  if (l == MAXLVL) { ls.push(["DA FLAPPY KING!", 2, ORNG]); }
  popup(ls, GREEN);
  saveGame();
  return "win";
}

/* ==========================================================
   CRASH GUARDS + SESSION
   ========================================================== */
function errScreen(msg) {
  cls(rgb(60, 0, 0));
  txt("Recovered from an error", 6, 6, 1, WHITE);
  var m = String(msg), y = 22;
  while (m.length > 0 && y < H - 30) { txt(m.substring(0, 50), 6, y, 1, YEL); m = m.substring(50); y += 11; }
  txt("Progress saved. Press SEL", 6, H - 14, 1, WHITE);
  waitKey();
}
function safePlay(l) {
  var r = "err";
  try { r = playLevel(l); }
  catch (e) {
    ENC_GAP_MS = MENU_GAP; ENC_REV_MS = MENU_REV; SEL_HOLD_MS = 200;
    try { encOn(); } catch (e1) {}
    try { saveGame(); } catch (e2) {}
    errScreen((e && e.message) ? e.message : String(e));
  }
  return r;
}
function session(l0) {
  var l = l0, r, opts, c, c2;
  while (true) {
    r = safePlay(l);
    if (r == "win") {
      opts = (l < MAXLVL) ? ["Next Level", "Replay Level", "Main Menu"] : ["Replay Level", "Main Menu"];
      c = menu("LEVEL " + l + " CLEAR", opts, 0, null);
      if (c < 0) { return; }
      if (l < MAXLVL) {
        if (c == 0) { l++; }
        else if (c == 2) { return; }
      } else {
        if (c == 1) { return; }
      }
    } else if (r == "dead") {
      c2 = menu("GAME OVER", ["Retry Level", "Main Menu"], 0, null);
      if (c2 != 0) { return; }
    } else { return; }
  }
}

/* ==========================================================
   BIRD COLORS / HOW TO PLAY / LEVEL SELECT
   ========================================================== */
function skinMenu() {
  var idx = S.skin, items, hints, i, r, n, wp;
  while (true) {
    items = []; hints = [];
    for (i = 0; i < SK.length; i++) {
      items.push((S.skin == i ? ">" : " ") + SK[i][0] + (S.own[i] ? "" : " $" + SK[i][5]));
      hints.push(S.own[i] ? (S.skin == i ? "Equipped" : "SEL to equip") : "SEL to buy for $" + SK[i][5]);
    }
    items.push(" Back"); hints.push("Return to the main menu");
    r = menu("BIRDS $" + S.coins, items, idx, hints);
    if (r < 0 || r == SK.length) { return; }
    idx = r;
    if (!S.own[r]) {
      if (S.coins < SK[r][5]) { flash("Need $" + SK[r][5], RED); continue; }
      if (!confirmBox("Buy $" + SK[r][5] + "?")) { continue; }
      S.coins -= SK[r][5]; S.own[r] = 1;
      beep(1700, 60); beep(2200, 80);
    }
    S.skin = r;
    buildBg(0);
    bgRect(0, 0, W, GY); drawGround(0);
    sctxt(SK[r][0], 12, 3, WHITE, BLACK);
    for (n = 0; n < 4; n++) { drawBird(70 + n * 60, 80, 0, n, r); }
    saveGame();
    sctxt("Press SEL", H - 38, 1, WHITE, BLACK);
    waitKey();
  }
}
function howTo() {
  var i, ln2;
  buildBg(0);
  cls(DARK);
  drawPipe(285, 100, 50);
  fr(0, 0, W, 20, HDR);
  txt("HOW TO PLAY", 6, 3, 2, WHITE);
  ln2 = ["SEL press or TURN knob = FLAP", "ESC = pause (save / sound / quit)",
         "Fly through the gaps in the pipes", "Clear every pipe to finish a level",
         "3 hearts per level, 75 levels", "Later: faster, tighter, moving pipes",
         "Coins unlock new bird colors"];
  for (i = 0; i < ln2.length; i++) { txt(ln2[i], 6, 28 + i * 14, 1, (i == 0) ? YEL : WHITE); }
  drawBird(250, 60, 0, 1, S.skin);
  ctxt("Press SEL", H - 11, 1, WHITE);
  waitKey();
}
function levelSelect() {
  var l = S.maxLvl, dirty = true, s2, T, b, st, k, stl;
  drainEnc(); lockEnc(ENC_GAP_MS);
  while (true) {
    if (dirty) {
      s2 = Math.floor((l - 1) / 5);
      T = TH[s2];
      cls(DARK);
      fr(0, 0, W, 24, HDR);
      txt("SELECT LEVEL", 6, 4, 2, WHITE);
      ctxt("Level " + l + " / " + S.maxLvl + " unlocked", 30, 1, YEL);
      ctxt(T[0], 46, 2, WHITE);
      stl = S.stars[l - 1];
      st = "";
      for (k = 0; k < 3; k++) { st += (k < stl ? "*" : "-") + " "; }
      ctxt(st, 70, 3, YEL);
      ctxt("Clear " + (6 + Math.floor(l / 5)) + " pipes   Area " + (s2 + 1) + "/" + NAREA, 102, 1, CYAN);
      for (b = 0; b < 16; b++) { fr(40 + b * 15, 118, 15, 12, c3(mt(T[1], T[2], b / 15))); }
      ctxt("Turn: change   SEL: play   ESC: back", H - 14, 1, HINT);
      dirty = false;
    }
    k = inpMenu();
    if (k == 1) { l++; if (l > S.maxLvl) { l = 1; } dirty = true; settleInput(); continue; }
    else if (k == 2) { l--; if (l < 1) { l = S.maxLvl; } dirty = true; settleInput(); continue; }
    else if (k == 3) { settleInput(); session(l); return; }
    else if (k == 4) { settleInput(); return; }
    wait(55);
  }
}

/* ==========================================================
   INTRO: a bird flies out of the distance, straight at the
   screen, smacks into the glass - the glass cracks and
   shatters to reveal the main screen
   ========================================================== */
/* front view of the flying bird, drawn into the current clip rectangle */
function bigBird(cx, cy, r, ph, amp2) {
  var K = SK[S.skin], body = K[1], belly = K[2], wing = K[3], beak = K[4];
  var s = Math.sin(ph), tipY = cy - s * r * 0.9 * amp2, mid = Math.max(1, r * 0.35), side, sx, sy, ex, er, mw;
  for (side = -1; side <= 1; side += 2) {
    sx = cx + side * r * 0.7; sy = cy + r * 0.05;
    ex = cx + side * r * 2.0;
    ctl2(sx, sy, ex, tipY, mid + 1, OUTL);
    ctl2(sx, sy, ex, tipY, mid, wing);
    ctl2(cx + side * r * 1.5, sy + (tipY - sy) * 0.6, ex, tipY, Math.max(1, mid * 0.55), belly);
  }
  cdisc(cx, cy, r, body, OUTL);
  ccirc(cx, cy + r * 0.3, r * 0.6, belly);
  ccirc(cx, cy - r * 0.8, r * 0.14, wing);
  ccirc(cx - r * 0.2, cy - r * 0.74, r * 0.1, wing);
  ccirc(cx + r * 0.2, cy - r * 0.74, r * 0.1, wing);
  er = r * 0.27;
  ccirc(cx - r * 0.4, cy - r * 0.2, er + 1, OUTL); ccirc(cx + r * 0.4, cy - r * 0.2, er + 1, OUTL);
  ccirc(cx - r * 0.4, cy - r * 0.2, er, WHITE); ccirc(cx + r * 0.4, cy - r * 0.2, er, WHITE);
  ccirc(cx - r * 0.4, cy - r * 0.16, er * 0.5, BLACK); ccirc(cx + r * 0.4, cy - r * 0.16, er * 0.5, BLACK);
  ccirc(cx - r * 0.44, cy - r * 0.22, Math.max(1, er * 0.18), WHITE); ccirc(cx + r * 0.36, cy - r * 0.22, Math.max(1, er * 0.18), WHITE);
  ccirc(cx, cy + r * 0.2, r * 0.3, OUTL);
  ccirc(cx, cy + r * 0.2, r * 0.26, beak);
  mw = r * 0.24;
  cfr(cx - mw, cy + r * 0.22, mw * 2, 1, BEAKD);
  ccirc(cx - r * 0.08, cy + r * 0.12, Math.max(1, r * 0.07), rgb(255, 220, 160));
}
function squashBird(cx, cy, r) {
  var K = SK[S.skin], body = K[1], belly = K[2], wing = K[3], beak = K[4], side, xs, ys, a, d;
  for (side = -1; side <= 1; side += 2) {
    tl2(cx + side * r * 0.9, cy + r * 0.1, cx + side * r * 2.2, cy + r * 0.3, r * 0.3 + 1, OUTL);
    tl2(cx + side * r * 0.9, cy + r * 0.1, cx + side * r * 2.2, cy + r * 0.3, r * 0.3, wing);
  }
  ell(cx, cy, r * 1.3 + 2, r * 0.8 + 2, OUTL);
  ell(cx, cy, r * 1.3, r * 0.8, body);
  ell(cx, cy + r * 0.3, r * 0.8, r * 0.4, belly);
  d = Math.max(2, r * 0.16);
  for (side = -1; side <= 1; side += 2) {
    xs = cx + side * r * 0.45; ys = cy - r * 0.2;
    ln(xs - d, ys - d, xs + d, ys + d, BLACK); ln(xs - d, ys + d, xs + d, ys - d, BLACK);
    ln(xs - d, ys - d + 1, xs + d, ys + d + 1, BLACK); ln(xs - d, ys + d + 1, xs + d, ys - d + 1, BLACK);
  }
  ell(cx, cy + r * 0.28, r * 0.4, r * 0.16, beak);
  ln(cx - r * 0.35, cy + r * 0.28, cx + r * 0.35, cy + r * 0.28, BEAKD);
  for (a = 0; a < 3; a++) {
    xs = cx - r * 0.6 + a * r * 0.6; ys = cy - r * 1.0;
    ln(xs - 4, ys, xs + 4, ys, YEL); ln(xs, ys - 4, xs, ys + 4, YEL);
    ln(xs - 3, ys - 3, xs + 3, ys + 3, YEL); ln(xs - 3, ys + 3, xs + 3, ys - 3, YEL);
  }
}
function introRestore(x0, y0, x1, y1) {
  bgRect(x0, y0, x1, y1);
  if (y1 > GY) { drawGround(0); }
}
/* ignore the SEL/ESC press that launched the script, and block skipping
   for the first half second so the intro always starts cleanly */
function introGuard() {
  var n = 0;
  drainEnc();
  try { while (keyboard.getSelPress() && n < 40) { wait(50); n++; } } catch (e1) {}
  n = 0;
  try { while (keyboard.getEscPress() && n < 40) { wait(50); n++; } } catch (e2) {}
  selDown = false; escDown = false;
  lastSelMs = nowMs() + 500; lastEscMs = nowMs() + 500;
  drainEnc();
}
function introApproach() {
  var N = 34, f, p, q, pq = 0, cx, cy, r, ph, have = false, ox0 = 0, oy0 = 0, ox1 = 0, oy1 = 0;
  var nx0, ny0, nx1, ny1, top, bot, a, b, ea, eb;
  buildBg(15);
  bgRect(0, 0, W, GY); drawGround(0);
  for (f = 0; f <= N; f++) {
    p = f / N;
    q = p / 0.7; if (q > 1) { q = 1; }
    r = 2 + p * p * p * 52;
    cx = 160 + Math.sin(q * 9) * (1 - q) * 70 + (1 - q) * 30;
    cy = 92 - q * 6 + Math.sin(q * 12) * (1 - q) * 6;
    ph = f * 0.9;
    nx0 = cx - r * 2.4 - 6; nx1 = cx + r * 2.4 + 6; ny0 = cy - r * 2 - 6; ny1 = cy + r * 1.3 + 6;
    if (q >= 1 && pq >= 1) {
      /* locked on the glass: the bird only grows, every frame fully covers
         the last one, so NOTHING is erased and nothing can flicker */
      setClip(0, 0, W, H);
      bigBird(cx, cy, r, ph, 0);
    } else if (!have) {
      setClip(nx0, ny0, nx1, ny1);
      bigBird(cx, cy, r, ph, 1 - q);
    } else {
      /* far away: erase + redraw in thin slices so no part is missing for long */
      top = Math.floor(Math.min(ny0, oy0)); bot = Math.ceil(Math.max(ny1, oy1));
      if (top < 0) { top = 0; } if (bot > H) { bot = H; }
      for (a = top; a < bot; a += 12) {
        b = Math.min(a + 12, bot);
        ea = Math.max(a, oy0); eb = Math.min(b, oy1);
        if (eb > ea) { introRestore(ox0, ea, ox1, eb); }
        if (b > ny0 && a < ny1) { setClip(nx0, a, nx1, b); bigBird(cx, cy, r, ph, 1 - q); }
      }
    }
    ox0 = nx0; ox1 = nx1; oy0 = ny0; oy1 = ny1;
    have = true; pq = q;
    if (f % 5 == 0) { beep(500 + f * 40, 20); }
    if (kSel() || kEsc()) { return false; }
    wait(35);
  }
  return true;
}
function introImpact() {
  var cx = 160, cy = 86, r = 54, k, s, ang = [], px = [], py = [], nx, ny;
  cls(WHITE); beep(160, 90); wait(70);
  bgRect(0, 0, W, GY); drawGround(0);
  squashBird(cx, cy, r);
  sctxt("THUD!", 4, 3, RED, BLACK);
  for (k = 0; k < 9; k++) {
    ang[k] = k * 0.7 + rnd() * 0.5;
    px[k] = cx + Math.cos(ang[k]) * 22; py[k] = cy + Math.sin(ang[k]) * 22;
  }
  for (s = 0; s < 10; s++) {
    for (k = 0; k < 9; k++) {
      nx = px[k] + Math.cos(ang[k]) * 16; ny = py[k] + Math.sin(ang[k]) * 16;
      lnc(px[k], py[k], nx, ny, WHITE);
      lnc(px[k] + 1, py[k] + 1, nx + 1, ny + 1, GRAY);
      px[k] = nx; py[k] = ny;
      ang[k] += (rnd() - 0.5) * 0.7;
    }
    beep(900 - s * 50, 12);
    if (kSel() || kEsc()) { return false; }
    wait(40);
  }
  wait(450);
  return true;
}
function introShatter() {
  var TW = 40, TH2 = 34, cols = Math.ceil(W / TW), rows = Math.ceil(H / TH2), nt = cols * rows;
  var order = [], i, j, tmp, tx, ty, gnd = false;
  buildBg(0);
  for (i = 0; i < nt; i++) { order[i] = i; }
  for (i = nt - 1; i > 0; i--) { j = ri(0, i); tmp = order[i]; order[i] = order[j]; order[j] = tmp; }
  for (i = 0; i < nt; i++) {
    tx = (order[i] % cols) * TW; ty = Math.floor(order[i] / cols) * TH2;
    bgRect(tx, ty, tx + TW, ty + TH2);
    if (ty + TH2 > GY && !gnd) { drawGround(0); gnd = true; }
    if (i % 3 == 2) { beep(1800 + ri(0, 900), 12); wait(30); }
    if (kSel() || kEsc()) { break; }
  }
}
function intro() {
  introGuard();
  if (introApproach()) {
    if (introImpact()) { introShatter(); }
  }
}

function title() {
  var s = "Da Flappy Bird", x = Math.floor((W - s.length * 18) / 2);
  var t = 0, on = -1, want, oy, ny, off = 0, cx = Math.floor(W / 2);
  clearPipes();
  buildBg(0);
  bgRect(0, 0, W, GY); drawGround(0);
  buildStrip(cx - 18, cx + 20);
  txt(s, x + 3, 12, 3, rgb(10, 30, 50));
  txt(s, x - 1, 9, 3, rgb(120, 50, 0)); txt(s, x + 1, 9, 3, rgb(120, 50, 0));
  txt(s, x, 8, 3, rgb(120, 50, 0)); txt(s, x, 10, 3, rgb(120, 50, 0));
  txt(s, x, 9, 3, YEL);
  sctxt("by da cbm", 42, 2, WHITE, rgb(10, 30, 50));
  oy = 98;
  fr(96, 121, 128, 15, rgb(10, 30, 50)); rc(96, 121, 128, 15, YEL);
  drawBird(cx, oy, 0, 0, S.skin);
  drainEnc(); lockEnc(ENC_GAP_MS);
  while (true) {
    t++;
    ny = Math.floor(98 + Math.sin(t * 0.18) * 9);
    off += 3;
    drawGroundAnim(off);
    birdFrame(cx, oy, ny, Math.cos(t * 0.18) * 2.2, Math.floor(t / 2) & 3, S.skin);
    oy = ny;
    want = ((t >> 3) % 2 == 0) ? 1 : 0;
    if (want != on) {
      on = want;
      ctxt("Press SEL to start", 125, 1, on ? WHITE : rgb(10, 30, 50));
    }
    if (t % 40 == 0) { beep(2400, 20); beep(3000, 20); }
    if (kSel()) { settleInput(); return; }
    drainEnc();
    wait(45);
  }
}

function runGame() {
  resetSave();
  var had = loadGame();
  try { intro(); } catch (eI) {}
  try { title(); } catch (eT) { settleInput(); }
  if (had) { flash("Save loaded", GREEN); }
  var idx = 0, r;
  while (true) {
    r = menu("DA FLAPPY BIRD $" + S.coins,
      ["Play Level " + S.maxLvl, "Level Select", "Bird Colors", "How To Play",
       "Sound: " + (SOUND ? "ON" : "OFF"), "Controls: " + (S.ctl == 0 ? "SEL=FLAP" : "TURN only"),
       "Save Game", "Save & Exit"], idx,
      ["Flap on!", "Replay any unlocked level", "Unlock new bird colors", "Controls & tips",
       "Toggle sound effects", "SEL flaps  /  turn-only (SEL pauses)", "Save your progress now", "Save progress and quit"]);
    if (r < 0) { r = 7; }
    idx = r;
    if (r == 0) { session(S.maxLvl); }
    else if (r == 1) { levelSelect(); }
    else if (r == 2) { skinMenu(); }
    else if (r == 3) { howTo(); }
    else if (r == 4) { SOUND = !SOUND; S.sound = SOUND ? 1 : 0; }
    else if (r == 5) { S.ctl = 1 - S.ctl; }
    else if (r == 6) { saveGame(); flash("Game saved", GREEN); }
    else if (r == 7) {
      if (confirmBox("Save and exit?")) {
        saveGame(); cls(BLACK);
        ctxt("See you later!  Saved.", 80, 1, WHITE);
        wait(600);
        return;
      }
    }
  }
}

function main() {
  try { calibrateClock(); runGame(); }
  catch (err) {
    try { saveGame(); } catch (e2) {}
    try { errScreen((err && err.message) ? err.message : String(err)); } catch (e3) {}
  }
}

main();
