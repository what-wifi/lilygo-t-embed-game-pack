/* ==========================================================
   RATTLE SNAKE - the classic Snake game, wild edition
   by da cbm
   Bruce firmware 1.16.1  |  LilyGO T-Embed CC1101 (320x170)
   ----------------------------------------------------------
   Encoder TURN right  = snake turns RIGHT (clockwise)
   Encoder TURN left   = snake turns LEFT
   Encoder PRESS / ESC = pause menu (save, sound, quit)
   ----------------------------------------------------------
   75 levels in 15 areas. Eat apples, bananas, mice, chickens,
   frogs and eggs. Mice, chickens and frogs run away!
   Earn coins, buy upgrades and snake skins.
   Progress saves to /rattle_save.txt (SD or LittleFS)
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
/* thick line made of circles */
function tl(x1, y1, x2, y2, r, c) {
  var n = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1);
  var st = (r > 1) ? 2 : 1;
  for (var i = 0; i <= n; i += st) { ci(x1 + (x2 - x1) * i / n, y1 + (y2 - y1) * i / n, r, c); }
  ci(x2, y2, r, c);
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
function cls(c) { fr(0, 0, W, H, c); }
var SOUND = true;
var pollN = 0;
function wait(ms) { pollN += ms; delay(ms); }
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
function rattleBeep() {
  for (var i = 0; i < 6; i++) { beep(3600 + (i % 2) * 500, 12); wait(14); }
}

var BLACK = rgb(0, 0, 0), WHITE = rgb(255, 255, 255), RED = rgb(230, 50, 40),
    GREEN = rgb(60, 210, 80), YEL = rgb(250, 220, 40), BLUE = rgb(60, 140, 255),
    GRAY = rgb(130, 130, 140), DARK = rgb(10, 26, 16), ORNG = rgb(250, 150, 30),
    CYAN = rgb(80, 220, 230), TAN = rgb(235, 205, 140), CREAM = rgb(250, 245, 225),
    HDR = rgb(20, 100, 40), HINT = rgb(255, 230, 120);

/* ---------- input (hardened encoder debounce) ---------- */
var MENU_GAP = 160, MENU_REV = 300, GAME_GAP = 75, GAME_REV = 110;
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

/* food: name, points, growth, moves every N ticks (0 = still), spawn weight */
var FOODS = [
  ["Apple",   10, 1, 0, 30],
  ["Banana",  15, 1, 0, 20],
  ["Mouse",   20, 1, 3, 18],
  ["Chicken", 30, 2, 4, 14],
  ["Frog",    25, 1, 2, 10],
  ["Egg",     12, 1, 0, 8]
];
var FOODNOTE = ["sits still", "sits still", "scurries", "runs & flaps", "hops away", "sits still"];

/* 15 areas x 5 levels: name, tile1, tile2, rock, wall */
var ST = [
  ["Meadow",          rgb(22, 58, 28),  rgb(26, 66, 32),  rgb(125, 125, 120), rgb(120, 220, 100)],
  ["Desert Dunes",    rgb(92, 72, 34),  rgb(100, 80, 38), rgb(150, 95, 50),   rgb(240, 200, 100)],
  ["Jungle",          rgb(14, 52, 34),  rgb(18, 60, 40),  rgb(95, 70, 50),    rgb(60, 230, 140)],
  ["Swamp",           rgb(36, 52, 30),  rgb(42, 60, 34),  rgb(75, 95, 60),    rgb(170, 210, 80)],
  ["Red Canyon",      rgb(110, 52, 34), rgb(118, 58, 38), rgb(175, 85, 50),   rgb(255, 150, 80)],
  ["Pine Forest",     rgb(18, 48, 36),  rgb(22, 56, 42),  rgb(70, 50, 32),    rgb(100, 200, 120)],
  ["Crystal Cave",    rgb(34, 36, 48),  rgb(40, 42, 56),  rgb(110, 110, 135), rgb(150, 160, 230)],
  ["Mountain Pass",   rgb(62, 66, 74),  rgb(70, 74, 82),  rgb(150, 155, 165), rgb(220, 230, 255)],
  ["Frozen Tundra",   rgb(60, 90, 120), rgb(68, 100, 130), rgb(210, 235, 250), rgb(255, 255, 255)],
  ["Volcano",         rgb(60, 22, 16),  rgb(70, 26, 18),  rgb(45, 32, 32),    rgb(255, 110, 30)],
  ["Sandy Beach",     rgb(150, 125, 70), rgb(160, 134, 76), rgb(90, 120, 140), rgb(60, 180, 230)],
  ["Farmyard",        rgb(74, 92, 36),  rgb(82, 102, 40), rgb(135, 85, 45),   rgb(240, 200, 80)],
  ["Ancient Ruins",   rgb(92, 84, 64),  rgb(100, 92, 70), rgb(170, 160, 130), rgb(230, 210, 150)],
  ["Midnight Desert", rgb(22, 22, 56),  rgb(28, 28, 66),  rgb(95, 85, 115),   rgb(120, 120, 255)],
  ["Rattler's Den",   rgb(40, 12, 52),  rgb(48, 16, 62),  rgb(145, 45, 95),   rgb(255, 60, 160)]
];

/* skins: name, head, body, mark, cost */
var SK = [
  ["Emerald",     rgb(30, 150, 40),  rgb(60, 215, 70),   rgb(20, 110, 35), 0],
  ["Diamondback", rgb(150, 110, 50), rgb(205, 165, 90),  rgb(90, 55, 25),  150],
  ["Cobalt",      rgb(30, 90, 200),  rgb(70, 150, 255),  rgb(20, 60, 150), 250],
  ["Crimson",     rgb(170, 25, 40),  rgb(235, 60, 70),   rgb(110, 10, 25), 350],
  ["Golden",      rgb(210, 160, 20), rgb(255, 220, 60),  rgb(160, 100, 10), 500],
  ["Violet",      rgb(120, 50, 180), rgb(180, 90, 235),  rgb(80, 25, 130), 700]
];

/* upgrades: name, max rank, base cost, description */
var UN = ["Calm Venom", "Shed Skin", "Golden Fang", "Magnet Tongue", "Wrap Scales"];
var UM = [5, 3, 5, 3, 1];
var UC = [80, 200, 100, 150, 500];
var UD = [
  "Snake moves 6% slower per rank",
  "Extra life each level, per rank",
  "+20% points & coins per rank",
  "Eat food from 1 more cell away",
  "Walls wrap around - no wall crashes"
];

/* ---------- save ---------- */
var S = { coins: 0, maxLvl: 1, skin: 0, sound: 1, hi: 0, up: [0, 0, 0, 0, 0], own: [1, 0, 0, 0, 0, 0] };
function resetSave() {
  S.coins = 0; S.maxLvl = 1; S.skin = 0; S.sound = 1; S.hi = 0;
  S.up = [0, 0, 0, 0, 0]; S.own = [1, 0, 0, 0, 0, 0];
}
function saveGame() {
  var s = [S.coins, S.maxLvl, S.skin, S.sound, S.hi].join(",") + "|" + S.up.join("") + "|" + S.own.join("");
  var ok = false;
  try { storage.write({ fs: "sd", path: "/rattle_save.txt" }, s, "write"); ok = true; } catch (e1) {}
  if (!ok) {
    try { storage.write({ fs: "littlefs", path: "/rattle_save.txt" }, s, "write"); } catch (e2) {}
  }
}
function ci2(v, lo, hi, dflt) { v = parseInt(v, 10); return (v >= lo && v <= hi) ? v : dflt; }
function loadGame() {
  var d = "";
  try { d = storage.read({ fs: "sd", path: "/rattle_save.txt" }); } catch (e1) { d = ""; }
  if (!d || String(d).indexOf("|") < 0) {
    try { d = storage.read({ fs: "littlefs", path: "/rattle_save.txt" }); } catch (e2) { d = ""; }
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
    for (i = 0; i < UN.length; i++) { S.up[i] = ci2(p[1].charAt(i), 0, UM[i], 0); }
    for (i = 0; i < SK.length; i++) { S.own[i] = (p[2].charAt(i) == "1") ? 1 : 0; }
    S.own[0] = 1;
    if (!S.own[S.skin]) { S.skin = 0; }
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
        if (sel) { fr(2, y - 2, W - 4, 20, rgb(40, 150, 70)); }
        txt(items[top + i], 8, y, 2, sel ? WHITE : rgb(170, 220, 180));
      }
      if (n > VR) {
        var bh = Math.floor(126 * VR / n);
        var by = 26 + Math.floor(126 * top / n);
        fr(W - 4, by, 3, bh, GRAY);
      }
      fr(0, H - 14, W, 14, rgb(6, 16, 10));
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
   SPRITES  (20x20 pixel food, drawn at pixel x,y)
   ========================================================== */
function sprApple(x, y) {
  ci(x + 10, y + 11, 8, RED);
  ci(x + 6, y + 10, 5, RED);
  ci(x + 14, y + 10, 5, RED);
  ci(x + 10, y + 16, 3, rgb(165, 25, 25));
  ci(x + 6, y + 8, 2, rgb(255, 170, 160));
  fr(x + 9, y, 2, 4, rgb(110, 70, 30));
  ci(x + 14, y + 3, 3, GREEN);
  ci(x + 15, y + 3, 1, rgb(30, 140, 40));
}
function sprBanana(x, y) {
  var YL = rgb(250, 220, 40), HL = rgb(255, 248, 160), BR = rgb(110, 70, 30);
  tl(x + 3, y + 5, x + 5, y + 10, 3, YL);
  tl(x + 5, y + 10, x + 8, y + 14, 3, YL);
  tl(x + 8, y + 14, x + 12, y + 16, 3, YL);
  tl(x + 12, y + 16, x + 16, y + 13, 3, YL);
  tl(x + 3, y + 4, x + 5, y + 9, 1, HL);
  tl(x + 5, y + 9, x + 8, y + 13, 1, HL);
  ci(x + 3, y + 3, 2, BR);
  ci(x + 17, y + 12, 2, BR);
}
function sprChicken(x, y) {
  var OUT = rgb(150, 150, 140);
  ci(x + 8, y + 11, 7, OUT);
  ci(x + 8, y + 11, 6, CREAM);
  ci(x + 3, y + 7, 3, CREAM);
  ci(x + 2, y + 8, 2, rgb(225, 215, 190));
  ci(x + 8, y + 12, 3, rgb(225, 215, 190));
  ci(x + 14, y + 6, 4, OUT);
  ci(x + 14, y + 6, 3, CREAM);
  ci(x + 13, y + 2, 2, RED);
  ci(x + 16, y + 2, 1, RED);
  ci(x + 16, y + 10, 1, RED);
  fr(x + 17, y + 5, 3, 3, ORNG);
  fr(x + 15, y + 5, 1, 2, BLACK);
  fr(x + 6, y + 17, 1, 3, ORNG); fr(x + 10, y + 17, 1, 3, ORNG);
  fr(x + 4, y + 19, 3, 1, ORNG); fr(x + 9, y + 19, 3, 1, ORNG);
}
function sprMouse(x, y) {
  var G1 = rgb(150, 150, 160), G2 = rgb(190, 190, 200), PK = rgb(255, 150, 170);
  tl(x + 4, y + 14, x + 1, y + 15, 1, PK);
  tl(x + 1, y + 15, x + 1, y + 10, 1, PK);
  ci(x + 10, y + 13, 6, G1);
  ci(x + 15, y + 12, 4, G2);
  ci(x + 12, y + 6, 3, G2);
  ci(x + 12, y + 6, 2, PK);
  ci(x + 18, y + 13, 1, PK);
  fr(x + 15, y + 10, 2, 2, BLACK);
  ln(x + 17, y + 15, x + 19, y + 17, WHITE);
  fr(x + 7, y + 18, 2, 2, PK); fr(x + 12, y + 18, 2, 2, PK);
}
function sprFrog(x, y) {
  var FG = rgb(70, 190, 70), FL = rgb(150, 230, 120), FD = rgb(30, 110, 40);
  ci(x + 3, y + 16, 3, FG);
  ci(x + 16, y + 16, 3, FG);
  ci(x + 10, y + 12, 7, FG);
  ci(x + 10, y + 15, 4, FL);
  ci(x + 6, y + 5, 3, FG); ci(x + 14, y + 5, 3, FG);
  ci(x + 6, y + 5, 2, WHITE); ci(x + 14, y + 5, 2, WHITE);
  fr(x + 6, y + 4, 1, 3, BLACK); fr(x + 14, y + 4, 1, 3, BLACK);
  ln(x + 5, y + 12, x + 15, y + 12, FD);
  fr(x + 8, y + 9, 1, 1, FD); fr(x + 11, y + 9, 1, 1, FD);
}
function sprEgg(x, y) {
  var ES = rgb(225, 215, 185), BR = rgb(160, 120, 70);
  ci(x + 10, y + 12, 6, CREAM);
  ci(x + 10, y + 8, 5, CREAM);
  ci(x + 12, y + 15, 3, ES);
  ci(x + 8, y + 13, 1, BR); ci(x + 12, y + 11, 1, BR); ci(x + 9, y + 8, 1, BR);
  ci(x + 8, y + 6, 1, WHITE);
}
function drawSprite(t, x, y) {
  if (t == 0) { sprApple(x, y); }
  else if (t == 1) { sprBanana(x, y); }
  else if (t == 2) { sprMouse(x, y); }
  else if (t == 3) { sprChicken(x, y); }
  else if (t == 4) { sprFrog(x, y); }
  else { sprEgg(x, y); }
}

/* ==========================================================
   PLAYFIELD
   ========================================================== */
var COLS = 32, ROWS = 15, CS = 10, OY = 20, NCELL = 480, MAXLEN = 160;
var DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];
var occ = [], reach = [], qq = [], rx = [], ry = [], rs = [];
(function () {
  var i;
  for (i = 0; i < NCELL; i++) { occ[i] = 0; reach[i] = 0; qq[i] = 0; }
  for (i = 0; i < MAXLEN; i++) { rx[i] = 0; ry[i] = 0; rs[i] = 0; }
})();

var lvl = 1, si = 0, score = 0, eaten = 0, goal = 6, lives = 1, lost = 0;
var grow = 0, dir = 0, len = 4, hI = 3, segCtr = 0, tickN = 0;
var fx = -1, fy = 0, ft = 0, tq0 = 0, tq1 = 0;
var T1 = 0, T2 = 0, ROCK = 0, WALL = 0;
var lseed = 1;

function lr() { lseed = (lseed * 16807) % 2147483647; return (lseed - 1) / 2147483646; }
function segIdx(k) { return (hI - k + MAXLEN) % MAXLEN; }
function tileCol(cx, cy) { return (((cx + cy) & 1) == 0) ? T1 : T2; }
function eraseCell(cx, cy) { fr(cx * CS, OY + cy * CS, CS, CS, tileCol(cx, cy)); }

function drawRock(cx, cy) {
  var px = cx * CS, py = OY + cy * CS;
  var r = ROCK;
  fr(px, py, CS, CS, rgb(20, 20, 20));
  fr(px + 1, py + 1, CS - 2, CS - 2, r);
  fr(px + 2, py + 2, 3, 3, rgb(215, 215, 215));
  fr(px + 6, py + 6, 3, 3, rgb(40, 40, 40));
}
function drawBody(cx, cy, id) {
  var px = cx * CS, py = OY + cy * CS;
  var col = SK[S.skin][2], mk = SK[S.skin][3];
  fr(px, py, CS, CS, col);
  if ((id & 1) == 0) {
    fr(px + 4, py + 2, 2, 6, mk);
    fr(px + 2, py + 4, 6, 2, mk);
    fr(px + 3, py + 3, 4, 4, mk);
  } else {
    fr(px, py, CS, 1, mk);
    fr(px, py + CS - 1, CS, 1, mk);
  }
}
function drawHead(cx, cy, d, flick) {
  var px = cx * CS, py = OY + cy * CS;
  var hc = SK[S.skin][1];
  fr(px, py, CS, CS, hc);
  fr(px + 1, py + 1, CS - 2, CS - 2, SK[S.skin][2]);
  fr(px + 2, py + 2, CS - 4, CS - 4, hc);
  var e1x, e1y, e2x, e2y, horiz = true;
  if (d == 0) { e1x = px + 5; e1y = py + 1; e2x = px + 5; e2y = py + 6; }
  else if (d == 2) { e1x = px + 2; e1y = py + 1; e2x = px + 2; e2y = py + 6; }
  else if (d == 1) { e1x = px + 1; e1y = py + 5; e2x = px + 6; e2y = py + 5; horiz = false; }
  else { e1x = px + 1; e1y = py + 2; e2x = px + 6; e2y = py + 2; horiz = false; }
  fr(e1x, e1y, 3, 3, YEL); fr(e2x, e2y, 3, 3, YEL);
  if (horiz) { fr(e1x + 1, e1y, 1, 3, BLACK); fr(e2x + 1, e2y, 1, 3, BLACK); }
  else { fr(e1x, e1y + 1, 3, 1, BLACK); fr(e2x, e2y + 1, 3, 1, BLACK); }
  if (flick) {
    if (d == 0) { fr(px + 8, py + 4, 2, 2, RED); }
    else if (d == 2) { fr(px, py + 4, 2, 2, RED); }
    else if (d == 1) { fr(px + 4, py + 8, 2, 2, RED); }
    else { fr(px + 4, py, 2, 2, RED); }
  }
}
/* tail with a little rattle on the end */
function drawTailAt() {
  var tI = segIdx(len - 1), nI = segIdx(len - 2);
  var cx = rx[tI], cy = ry[tI];
  var ax = cx - rx[nI], ay = cy - ry[nI];
  if (ax > 1) { ax = -1; } else if (ax < -1) { ax = 1; }
  if (ay > 1) { ay = -1; } else if (ay < -1) { ay = 1; }
  var px = cx * CS, py = OY + cy * CS;
  var col = SK[S.skin][2];
  eraseCell(cx, cy);
  if (ax != 0) { fr(ax > 0 ? px : px + 5, py + 2, 5, 6, col); }
  else { fr(px + 2, ay > 0 ? py : py + 5, 6, 5, col); }
  ci(px + 5, py + 5, 3, col);
  ci(px + 5 + ax * 3, py + 5 + ay * 3, 2, TAN);
  fr(px + 5 + ax * 3, py + 5 + ay * 3, 1, 1, WHITE);
}
function drawFood() {
  if (fx < 0) { return; }
  drawSprite(ft, fx * CS, OY + fy * CS);
}
function eraseFood() {
  if (fx < 0) { return; }
  eraseCell(fx, fy); eraseCell(fx + 1, fy); eraseCell(fx, fy + 1); eraseCell(fx + 1, fy + 1);
}
function drawHUD() {
  fr(0, 0, W, OY, rgb(6, 14, 8));
  txt("L" + lvl + " " + ST[si][0], 3, 2, 1, YEL);
  var s = "Score " + score;
  txt(s, W - s.length * 6 - 3, 2, 1, WHITE);
  txt("Eat " + eaten + "/" + goal, 3, 11, 1, CYAN);
  txt("Lives", 96, 11, 1, GRAY);
  for (var i = 0; i < lives && i < 6; i++) { ci(138 + i * 9, 14, 3, RED); }
  var c = "$" + S.coins;
  txt(c, W - c.length * 6 - 3, 11, 1, GREEN);
}
function drawScene() {
  var cx, cy;
  fr(0, OY, W, ROWS * CS, T1);
  for (cy = 0; cy < ROWS; cy++) {
    for (cx = 0; cx < COLS; cx++) {
      if (((cx + cy) & 1) == 1) { fr(cx * CS, OY + cy * CS, CS, CS, T2); }
    }
  }
  for (cy = 0; cy < ROWS; cy++) {
    for (cx = 0; cx < COLS; cx++) {
      if (occ[cy * COLS + cx] == 2) { drawRock(cx, cy); }
    }
  }
  if (S.up[4] == 0) {
    rc(0, OY, W, ROWS * CS, WALL);
    rc(1, OY + 1, W - 2, ROWS * CS - 2, WALL);
  }
  drawHUD();
  drawFood();
  var k;
  for (k = len - 1; k >= 1; k--) {
    var i = segIdx(k);
    drawBody(rx[i], ry[i], rs[i]);
  }
  drawTailAt();
  drawHead(rx[hI], ry[hI], dir, true);
}

/* ---------- level construction ---------- */
function inZone(cx, cy) { return (cx <= 11 && cy >= 4 && cy <= 10); }
function buildLevel(l) {
  var i, s, k;
  for (i = 0; i < NCELL; i++) { occ[i] = 0; reach[i] = 0; }
  lseed = l * 7919 + 13;
  if (l >= 3) {
    var nseg = Math.min(16, 2 + Math.floor(l / 5));
    for (s = 0; s < nseg; s++) {
      var sl = 2 + Math.floor(lr() * (3 + l / 20));
      var horiz = (lr() < 0.5);
      var sx = Math.floor(lr() * (COLS - (horiz ? sl : 1)));
      var sy = Math.floor(lr() * (ROWS - (horiz ? 1 : sl)));
      for (k = 0; k < sl; k++) {
        var cx = sx + (horiz ? k : 0), cy = sy + (horiz ? 0 : k);
        if (!inZone(cx, cy) && cx < COLS && cy < ROWS) { occ[cy * COLS + cx] = 2; }
      }
    }
    var nr = Math.min(20, Math.floor(l / 3));
    for (s = 0; s < nr; s++) {
      var ex = Math.floor(lr() * COLS), ey = Math.floor(lr() * ROWS);
      if (!inZone(ex, ey)) { occ[ey * COLS + ex] = 2; }
    }
  }
  /* flood fill from the start so food never lands in a sealed pocket */
  var qh = 0, qt = 0;
  var start = 7 * COLS + 5;
  qq[qt++] = start; reach[start] = 1;
  while (qh < qt) {
    var c = qq[qh++];
    var ccx = c % COLS, ccy = Math.floor(c / COLS);
    for (var d = 0; d < 4; d++) {
      var nx = ccx + DX[d], ny = ccy + DY[d];
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) { continue; }
      var ni = ny * COLS + nx;
      if (occ[ni] == 0 && reach[ni] == 0) { reach[ni] = 1; qq[qt++] = ni; }
    }
  }
}
function resetSnake() {
  var i;
  for (i = 0; i < NCELL; i++) { if (occ[i] == 1) { occ[i] = 0; } }
  len = 4; hI = 3; dir = 0; grow = 0; tq0 = 0; tq1 = 0;
  for (i = 0; i < 4; i++) {
    rx[i] = 2 + i; ry[i] = 7; segCtr++; rs[i] = segCtr;
    occ[7 * COLS + 2 + i] = 1;
  }
}
function foodFits(x, y) {
  if (x < 0 || y < 0 || x + 1 >= COLS || y + 1 >= ROWS) { return false; }
  var a = y * COLS + x, b = a + COLS;
  if (occ[a] != 0 || occ[a + 1] != 0 || occ[b] != 0 || occ[b + 1] != 0) { return false; }
  if (reach[a] != 1 || reach[a + 1] != 1 || reach[b] != 1 || reach[b + 1] != 1) { return false; }
  return true;
}
function pickFood() {
  var r = ri(1, 100), acc = 0;
  for (var i = 0; i < FOODS.length; i++) {
    acc += FOODS[i][4];
    if (r <= acc) { return i; }
  }
  return 0;
}
function placeFood(t) {
  var hx = rx[hI], hy = ry[hI];
  var tries, x, y;
  ft = t;
  for (tries = 0; tries < 300; tries++) {
    x = ri(0, COLS - 2); y = ri(0, ROWS - 2);
    if (foodFits(x, y) && (Math.abs(x - hx) + Math.abs(y - hy)) >= 5) { fx = x; fy = y; return; }
  }
  for (y = 0; y < ROWS - 1; y++) {
    for (x = 0; x < COLS - 1; x++) {
      if (foodFits(x, y)) { fx = x; fy = y; return; }
    }
  }
  fx = -1;
}
function moveFood() {
  if (fx < 0) { return; }
  var hx = rx[hI], hy = ry[hI];
  var cand = [], nc = 0, best = -1, bd = -1, d, nx, ny, dist;
  for (d = 0; d < 4; d++) {
    nx = fx + DX[d]; ny = fy + DY[d];
    if (foodFits(nx, ny)) {
      cand[nc] = d; nc++;
      dist = Math.abs(nx - hx) + Math.abs(ny - hy);
      if (dist > bd) { bd = dist; best = d; }
    }
  }
  if (nc == 0) { return; }
  d = (rnd() < 0.6) ? best : cand[ri(0, nc - 1)];
  eraseFood();
  fx += DX[d]; fy += DY[d];
  drawFood();
}

/* ---------- one game tick: 0 ok, 1 crash, 2 level won ---------- */
function step() {
  tickN++;
  if (tq0 != 0) {
    dir = (tq0 > 0) ? (dir + 1) % 4 : (dir + 3) % 4;
    tq0 = tq1; tq1 = 0;
  }
  var hx = rx[hI], hy = ry[hI];
  var nx = hx + DX[dir], ny = hy + DY[dir];
  if (S.up[4] > 0) { nx = (nx + COLS) % COLS; ny = (ny + ROWS) % ROWS; }
  else if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) { return 1; }
  var o = occ[ny * COLS + nx];
  var tI = segIdx(len - 1);
  if (o == 2) { return 1; }
  if (o == 1) {
    if (!(grow == 0 && nx == rx[tI] && ny == ry[tI])) { return 1; }
  }
  drawBody(hx, hy, rs[hI]);
  var growing = (grow > 0 && len < MAXLEN - 2);
  if (growing) { grow--; len++; }
  else {
    grow = 0;
    occ[ry[tI] * COLS + rx[tI]] = 0;
    eraseCell(rx[tI], ry[tI]);
  }
  hI = (hI + 1) % MAXLEN;
  rx[hI] = nx; ry[hI] = ny; segCtr++; rs[hI] = segCtr;
  occ[ny * COLS + nx] = 1;
  drawHead(nx, ny, dir, (tickN & 3) == 0);
  if (!growing) { drawTailAt(); }

  if (fx >= 0) {
    var ddx = 0, ddy = 0, rch = S.up[3];
    if (nx < fx) { ddx = fx - nx; } else if (nx > fx + 1) { ddx = nx - fx - 1; }
    if (ny < fy) { ddy = fy - ny; } else if (ny > fy + 1) { ddy = ny - fy - 1; }
    if (ddx <= rch && ddy <= rch) {
      var pts = Math.floor(FOODS[ft][1] * (1 + 0.2 * S.up[2]));
      score += pts; S.coins += pts;
      grow += FOODS[ft][2]; eaten++;
      eraseFood();
      beep(1400, 40); beep(1900, 50);
      if (eaten >= goal) { fx = -1; drawHUD(); return 2; }
      placeFood(pickFood());
      drawFood();
      drawHUD();
    }
  }
  if (fx >= 0 && FOODS[ft][3] > 0 && (tickN % FOODS[ft][3]) == 0) { moveFood(); }
  return 0;
}

function tickMs() {
  var t = 210 - lvl * 1.4;
  t = t * (1 + 0.06 * S.up[0]);
  return Math.max(90, Math.floor(t));
}
function crashFx() {
  var i;
  for (i = 0; i < 3; i++) {
    rc(0, OY, W, ROWS * CS, RED); rc(1, OY + 1, W - 2, ROWS * CS - 2, RED);
    rc(2, OY + 2, W - 4, ROWS * CS - 4, RED);
    beep(500 - i * 120, 90);
    wait(110);
  }
  fr(70, 70, 180, 40, BLACK);
  rc(70, 70, 180, 40, RED);
  ctxt(lives > 1 ? "OUCH!" : "SNAKE DOWN!", 84, 2, RED);
  wait(500);
}
function respawn() {
  resetSnake();
  if (fx >= 0) {
    var a = fy * COLS + fx;
    if (occ[a] != 0 || occ[a + 1] != 0 || occ[a + COLS] != 0 || occ[a + COLS + 1] != 0) { placeFood(ft); }
  }
  drawScene();
  ctxt("GET READY", 80, 2, WHITE);
  wait(650);
  drawScene();
  encOn();
}
function pauseMenu() {
  ENC_GAP_MS = MENU_GAP; ENC_REV_MS = MENU_REV;
  encOn();
  var idx = 0, res = 0;
  while (true) {
    var r = menu("PAUSED", ["Resume", "Save Game", "Sound: " + (SOUND ? "ON" : "OFF"), "Quit Level"], idx,
      ["Back to the game", "Save coins, upgrades & level", "Toggle sound effects", "Give up this level"]);
    if (r <= 0) { res = 0; break; }
    idx = r;
    if (r == 1) { saveGame(); flash("Game saved", GREEN); }
    else if (r == 2) { SOUND = !SOUND; S.sound = SOUND ? 1 : 0; }
    else if (r == 3) { if (confirmBox("Quit level?")) { res = 3; break; } }
  }
  ENC_GAP_MS = GAME_GAP; ENC_REV_MS = GAME_REV;
  return res;
}
function qTurn(t) {
  if (tq0 == 0) { tq0 = t; }
  else if (tq1 == 0) { tq1 = t; }
}
/* returns "win", "dead" or "quit" */
function runLoop() {
  while (true) {
    var n = Math.ceil(tickMs() / 15), i;
    for (i = 0; i < n; i++) {
      if (kNext()) { qTurn(1); }
      else if (kPrev()) { qTurn(-1); }
      if (kSel() || kEsc()) {
        if (pauseMenu() == 3) { return "quit"; }
        drawScene();
        ctxt("GET READY", 80, 2, WHITE);
        wait(500);
        drawScene();
        encOn();
      }
      wait(15);
    }
    var r = step();
    if (r == 1) {
      lost++; lives--;
      crashFx();
      if (lives <= 0) { return "dead"; }
      respawn();
    } else if (r == 2) { return "win"; }
  }
}

/* ---------- play one level ---------- */
function playLevel(l) {
  lvl = l; si = Math.floor((l - 1) / 5);
  T1 = ST[si][1]; T2 = ST[si][2]; ROCK = ST[si][3]; WALL = ST[si][4];
  goal = 6 + Math.floor(l / 5);
  lives = 1 + S.up[1]; lost = 0; score = 0; eaten = 0; tickN = 0;

  /* intro card */
  cls(DARK);
  fr(0, 0, W, 24, HDR);
  txt("LEVEL " + l, 6, 4, 2, WHITE);
  ctxt(ST[si][0], 34, 3, YEL);
  if ((l - 1) % 5 == 0) { ctxt("* NEW AREA *", 62, 2, CYAN); }
  else { ctxt("Area " + (si + 1) + " of " + ST.length + "  -  stage " + (((l - 1) % 5) + 1) + "/5", 66, 1, CYAN); }
  ctxt("Eat " + goal + " critters to clear it", 86, 1, WHITE);
  ctxt("Turn the knob to steer. SEL = pause", 102, 1, HINT);
  ctxt((S.up[4] > 0 ? "Walls wrap around!" : "Don't hit walls, rocks or yourself!"), 116, 1, ORNG);
  ctxt("Press SEL to start", H - 14, 1, WHITE);
  if (waitKey() == 4) { return; }

  buildLevel(l);
  resetSnake();
  placeFood(pickFood());
  drawScene();
  ctxt("GET READY", 80, 2, WHITE);
  wait(700);
  drawScene();
  ENC_GAP_MS = GAME_GAP; ENC_REV_MS = GAME_REV;
  encOn();
  var res = runLoop();
  ENC_GAP_MS = MENU_GAP; ENC_REV_MS = MENU_REV;
  encOn();

  if (res == "quit") { saveGame(); return; }
  if (res == "dead") {
    beep(300, 200); beep(200, 300);
    popup([["SNAKE DOWN", 3, RED], ["Score " + score, 2, WHITE], ["Coins kept: $" + score, 1, YEL], ["Visit upgrades & retry", 1, GRAY]], RED);
    saveGame();
    return;
  }
  /* level won */
  var stars = (lost == 0) ? 3 : ((lost == 1) ? 2 : 1);
  var bonus = 25 + l * 3 + stars * 15;
  S.coins += bonus;
  var isBest = (score > S.hi);
  if (isBest) { S.hi = score; }
  var st = "";
  for (var s = 0; s < 3; s++) { st += (s < stars ? "*" : "-") + " "; }
  beep(1500, 80); beep(1900, 80); beep(2300, 120);
  var ls = [["LEVEL " + l + " CLEAR", 2, GREEN], [st, 3, YEL], ["Score " + score + "  Bonus $" + bonus, 1, WHITE]];
  if (l == S.maxLvl && l < MAXLVL) { S.maxLvl = l + 1; ls.push(["Level " + S.maxLvl + " unlocked!", 1, CYAN]); }
  if (l == MAXLVL) { ls.push(["RATTLE SNAKE KING!", 2, ORNG]); }
  else if (isBest) { ls.push(["NEW BEST SCORE!", 1, ORNG]); }
  popup(ls, GREEN);
  saveGame();
}

/* ==========================================================
   SHOP / SKINS / HOW TO PLAY / LEVEL SELECT
   ========================================================== */
function upCost(i) { return UC[i] * (S.up[i] + 1); }
function shop() {
  var idx = 0;
  while (true) {
    var items = [], hints = [], i;
    for (i = 0; i < UN.length; i++) {
      items.push(UN[i] + " " + S.up[i] + "/" + UM[i]);
      hints.push(S.up[i] >= UM[i] ? "MAXED OUT" : (UD[i] + " $" + upCost(i)));
    }
    items.push("Back"); hints.push("Return to the main menu");
    var r = menu("UPGRADES $" + S.coins, items, idx, hints);
    if (r < 0 || r == UN.length) { return; }
    idx = r;
    if (S.up[r] >= UM[r]) { flash("Maxed out!", YEL); continue; }
    var cost = upCost(r);
    if (S.coins < cost) { flash("Need $" + cost, RED); continue; }
    if (confirmBox("Buy $" + cost + "?")) {
      S.coins -= cost; S.up[r]++;
      beep(1700, 60); beep(2200, 80);
      flash(UN[r] + "!", GREEN);
      saveGame();
    }
  }
}
function skinMenu() {
  var idx = S.skin;
  while (true) {
    var items = [], hints = [], i;
    for (i = 0; i < SK.length; i++) {
      items.push((S.skin == i ? ">" : " ") + SK[i][0] + (S.own[i] ? "" : " $" + SK[i][4]));
      hints.push(S.own[i] ? (S.skin == i ? "Equipped" : "SEL to equip") : "SEL to buy for $" + SK[i][4]);
    }
    items.push(" Back"); hints.push("Return to the main menu");
    var r = menu("SKINS $" + S.coins, items, idx, hints);
    if (r < 0 || r == SK.length) { return; }
    idx = r;
    if (!S.own[r]) {
      if (S.coins < SK[r][4]) { flash("Need $" + SK[r][4], RED); continue; }
      if (!confirmBox("Buy $" + SK[r][4] + "?")) { continue; }
      S.coins -= SK[r][4]; S.own[r] = 1;
      beep(1700, 60); beep(2200, 80);
    }
    S.skin = r;
    /* preview */
    cls(DARK);
    ctxt(SK[r][0], 12, 3, WHITE);
    for (i = 0; i < 9; i++) { drawPrevBody(70 + i * 20, 70, i); }
    saveGame();
    ctxt("Press SEL", H - 14, 1, WHITE);
    waitKey();
  }
}
function drawPrevBody(x, y, id) {
  var col = SK[S.skin][2], mk = SK[S.skin][3];
  fr(x, y, 20, 20, col);
  if ((id & 1) == 0) { fr(x + 8, y + 4, 4, 12, mk); fr(x + 4, y + 8, 12, 4, mk); fr(x + 6, y + 6, 8, 8, mk); }
  if (id == 8) {
    fr(x, y, 20, 20, SK[S.skin][1]);
    fr(x + 10, y + 3, 6, 6, YEL); fr(x + 10, y + 11, 6, 6, YEL);
    fr(x + 12, y + 3, 2, 6, BLACK); fr(x + 12, y + 11, 2, 6, BLACK);
  }
}
function howTo() {
  cls(DARK);
  fr(0, 0, W, 20, HDR);
  txt("HOW TO PLAY", 6, 3, 2, WHITE);
  for (var i = 0; i < FOODS.length; i++) {
    var cx = (i % 2) * 160, cy = 24 + Math.floor(i / 2) * 42;
    rc(cx + 2, cy, 156, 40, rgb(40, 110, 60));
    drawSprite(i, cx + 8, cy + 10);
    txt(FOODS[i][0], cx + 34, cy + 4, 1, WHITE);
    txt("+" + FOODS[i][1] + " pts  grows " + FOODS[i][2], cx + 34, cy + 16, 1, YEL);
    txt(FOODNOTE[i], cx + 34, cy + 28, 1, CYAN);
  }
  ctxt("Turn knob = steer   SEL = pause", H - 22, 1, HINT);
  ctxt("Press SEL", H - 11, 1, WHITE);
  waitKey();
}
function levelSelect() {
  var l = S.maxLvl, dirty = true;
  drainEnc(); lockEnc(ENC_GAP_MS);
  while (true) {
    if (dirty) {
      var s2 = Math.floor((l - 1) / 5);
      cls(DARK);
      fr(0, 0, W, 24, HDR);
      txt("SELECT LEVEL", 6, 4, 2, WHITE);
      ctxt("Level " + l + " / " + S.maxLvl + " unlocked", 36, 2, YEL);
      ctxt(ST[s2][0], 64, 2, WHITE);
      ctxt("Eat " + (6 + Math.floor(l / 5)) + " critters   Area " + (s2 + 1) + "/" + ST.length, 90, 1, CYAN);
      fr(40, 108, 240, 14, ST[s2][1]); rc(40, 108, 240, 14, ST[s2][4]);
      ctxt("Turn: change   SEL: play   ESC: back", H - 14, 1, HINT);
      dirty = false;
    }
    var k = inpMenu();
    if (k == 1) { l++; if (l > S.maxLvl) { l = 1; } dirty = true; settleInput(); continue; }
    else if (k == 2) { l--; if (l < 1) { l = S.maxLvl; } dirty = true; settleInput(); continue; }
    else if (k == 3) { settleInput(); safePlay(l); return; }
    else if (k == 4) { settleInput(); return; }
    wait(55);
  }
}

/* ==========================================================
   INTRO: snake slithers out of the far distance, then
   lunges at the screen, then the title appears
   ========================================================== */
var IBY = [0, 20, 40, 60, 78, 92, 105, 125, 150, 170];
var IBC = [rgb(20, 10, 45), rgb(60, 20, 70), rgb(120, 40, 80), rgb(200, 80, 60), rgb(250, 150, 50),
           rgb(72, 52, 26), rgb(58, 42, 21), rgb(44, 31, 16), rgb(30, 22, 10)];
function introBg(x0, y0, x1, y1) {
  x0 = Math.floor(x0) - 1; y0 = Math.floor(y0) - 1; x1 = Math.ceil(x1) + 1; y1 = Math.ceil(y1) + 1;
  if (x0 < 0) { x0 = 0; } if (y0 < 0) { y0 = 0; }
  if (x1 > W) { x1 = W; } if (y1 > H) { y1 = H; }
  for (var b = 0; b < 9; b++) {
    var ya = Math.max(y0, IBY[b]), yb = Math.min(y1, IBY[b + 1]);
    if (yb > ya && x1 > x0) { fr(x0, ya, x1 - x0, yb - ya, IBC[b]); }
  }
  ci(250, 72, 16, rgb(255, 220, 110));
  ci(250, 72, 11, rgb(255, 242, 175));
}
function ipx(p) { return 160 + Math.sin(p * 10.5 - 1.075) * (6 + p * 66); }
function ipy(p) { return 95 + p * 66; }
function ipr(p) { return 1.5 + p * 13; }

function introApproach() {
  var f, k, bb = null;
  introBg(0, 0, W, H);
  for (f = 0; f <= 46; f++) {
    var pH = f / 46;
    if (bb) { introBg(bb[0], bb[1], bb[2], bb[3]); }
    bb = [W, H, 0, 0];
    for (k = 15; k >= 0; k--) {
      var p = pH - k * 0.03;
      if (p < 0) { continue; }
      var x = ipx(p), y = ipy(p), r = ipr(p);
      var base = (k & 1) ? rgb(60, 185, 60) : rgb(45, 160, 50);
      if (k == 0) { ci(x, y, r + 2, rgb(30, 125, 40)); }
      else { ci(x, y, r, base); if ((k & 1) == 0 && r > 4) { ci(x, y, r * 0.45, rgb(25, 95, 35)); } }
      if (k == 15 && r > 3) { ci(x, y + r, 1 + r * 0.25, TAN); }
      if (k == 0 && r > 3) {
        var ex = r * 0.7, ey = y - r * 0.2, er = Math.max(1, r * 0.33);
        ci(x - ex, ey, er, YEL); ci(x + ex, ey, er, YEL);
        fr(x - ex, ey - er, 1, er * 2, BLACK); fr(x + ex, ey - er, 1, er * 2, BLACK);
        ln(x, y + r + 2, x, y + r + 2 + r * 0.9, RED);
        ln(x, y + r + 2 + r * 0.9, x - 2, y + r + 4 + r * 0.9, RED);
        ln(x, y + r + 2 + r * 0.9, x + 2, y + r + 4 + r * 0.9, RED);
      }
      if (x - r - 4 < bb[0]) { bb[0] = x - r - 4; }
      if (y - r - 4 < bb[1]) { bb[1] = y - r - 4; }
      if (x + r + 4 > bb[2]) { bb[2] = x + r + 4; }
      if (y + r * 2 + 8 > bb[3]) { bb[3] = y + r * 2 + 8; }
    }
    if (f % 4 == 0) { beep(3800 + (f % 8) * 80, 14); }
    if (kSel() || kEsc()) { return false; }
    wait(50);
  }
  return true;
}
function bigHead(cx, cy, r, u) {
  ci(cx, cy, r, rgb(30, 115, 40));
  ci(cx, cy - r * 0.06, r * 0.9, rgb(55, 175, 60));
  ci(cx, cy - r * 0.55, r * 0.17, rgb(25, 100, 35));
  ci(cx - r * 0.3, cy - r * 0.6, r * 0.1, rgb(25, 100, 35));
  ci(cx + r * 0.3, cy - r * 0.6, r * 0.1, rgb(25, 100, 35));
  var ex = r * 0.45, ey = cy - r * 0.25, er = Math.max(2, r * 0.2);
  ci(cx - ex, ey, er, YEL); ci(cx + ex, ey, er, YEL);
  var sw = Math.max(1, er * 0.3);
  fr(cx - ex - sw / 2, ey - er * 0.8, sw, er * 1.6, BLACK);
  fr(cx + ex - sw / 2, ey - er * 0.8, sw, er * 1.6, BLACK);
  ci(cx - r * 0.12, cy + r * 0.05, Math.max(1, r * 0.04), rgb(15, 60, 20));
  ci(cx + r * 0.12, cy + r * 0.05, Math.max(1, r * 0.04), rgb(15, 60, 20));
  if (u > 0.3) {
    var mr = r * 0.38 * Math.min(1, (u - 0.3) / 0.4);
    ci(cx, cy + r * 0.45, mr, rgb(185, 15, 40));
    fr(cx - mr * 0.7, cy + r * 0.45 - mr * 0.9, Math.max(2, r * 0.07), mr * 1.2, WHITE);
    fr(cx + mr * 0.7 - Math.max(2, r * 0.07), cy + r * 0.45 - mr * 0.9, Math.max(2, r * 0.07), mr * 1.2, WHITE);
    ln(cx, cy + r * 0.45, cx, cy + r * 0.45 + mr * 0.8, rgb(255, 90, 110));
  }
}
function introJump() {
  var j;
  for (j = 0; j <= 10; j++) {
    var u = j / 10;
    var r = 20 + u * u * 115;
    var cx = 160 + Math.sin(u * 4) * 8;
    var cy = 150 - u * 78;
    introBg(0, 0, W, H);
    bigHead(cx, cy, r, u);
    beep(300 + j * 130, 25);
    wait(30);
    if (kSel() || kEsc()) { break; }
  }
  cls(WHITE); beep(2600, 60); wait(70);
  cls(rgb(255, 230, 150)); wait(50);
  cls(rgb(8, 30, 14));
}
function drawSlither(t, y, x0) {
  var k;
  for (k = 16; k >= 0; k--) {
    var sx = x0 - k * 9;
    var sy = y + Math.sin((t + k * 2) / 3) * 8;
    var rr = (k == 0) ? 7 : 6;
    if (k == 16) { ci(sx - 3, sy, 3, TAN); }
    ci(sx, sy, rr, (k & 1) ? rgb(60, 215, 70) : rgb(45, 185, 55));
    if ((k & 1) == 0 && k > 0) { ci(sx, sy, 2, rgb(20, 110, 35)); }
    if (k == 0) {
      ci(sx, sy, 7, rgb(30, 150, 40));
      fr(sx + 1, sy - 5, 3, 3, YEL); fr(sx + 1, sy + 2, 3, 3, YEL);
      fr(sx + 2, sy - 5, 1, 3, BLACK); fr(sx + 2, sy + 2, 1, 3, BLACK);
      if ((t & 3) < 2) { fr(sx + 7, sy - 1, 5, 2, RED); fr(sx + 11, sy - 2, 2, 1, RED); fr(sx + 11, sy + 1, 2, 1, RED); }
    }
  }
}
function title() {
  var BG = rgb(8, 30, 14);
  var t = 0, i, on = -1;
  cls(BG);
  var s1 = "RATTLE SNAKE";
  txt(s1, 18, 14, 4, rgb(90, 20, 0));
  txt(s1, 16, 12, 4, rgb(255, 200, 40));
  ctxt("by da cbm", 52, 2, rgb(255, 150, 40));
  for (i = 0; i < 6; i++) { drawSprite(i, 58 + i * 34, 78); }
  rattleBeep();
  drainEnc(); lockEnc(ENC_GAP_MS);
  while (true) {
    t++;
    fr(0, 104, W, 46, BG);
    drawSlither(t, 126, ((t * 4) % (W + 200)) - 20);
    var want = ((t >> 3) % 2 == 0) ? 1 : 0;
    if (want != on) {
      on = want;
      fr(0, H - 16, W, 16, BG);
      if (on) { ctxt("Press SEL to start", H - 14, 1, WHITE); }
    }
    if (t % 40 == 0) { rattleBeep(); }
    if (kSel()) { settleInput(); return; }
    drainEnc();
    wait(45);
  }
}
function intro() {
  var ok = introApproach();
  if (ok) { introJump(); }
  else { cls(rgb(8, 30, 14)); }
}

/* ---------- crash guards ---------- */
function errScreen(msg) {
  cls(rgb(60, 0, 0));
  txt("Recovered from an error", 6, 6, 1, WHITE);
  var m = String(msg), y = 22;
  while (m.length > 0 && y < H - 30) { txt(m.substring(0, 50), 6, y, 1, YEL); m = m.substring(50); y += 11; }
  txt("Progress saved. Press SEL", 6, H - 14, 1, WHITE);
  waitKey();
}
function safePlay(l) {
  try { playLevel(l); }
  catch (e) {
    ENC_GAP_MS = MENU_GAP; ENC_REV_MS = MENU_REV;
    try { encOn(); } catch (e1) {}
    try { saveGame(); } catch (e2) {}
    errScreen((e && e.message) ? e.message : String(e));
  }
}

function runGame() {
  resetSave();
  var had = loadGame();
  intro();
  title();
  if (had) { flash("Save loaded", GREEN); }
  var idx = 0;
  while (true) {
    var r = menu("RATTLE SNAKE $" + S.coins,
      ["Play Level " + S.maxLvl, "Level Select", "Upgrades", "Snake Skins", "How To Play",
       "Sound: " + (SOUND ? "ON" : "OFF"), "Save Game", "Save & Exit"], idx,
      ["Slither on!", "Replay any unlocked level", "Spend coins on power-ups", "Change your snake's look",
       "Foods, points & controls", "Toggle sound effects", "Save your progress now", "Save progress and quit"]);
    if (r < 0) { r = 7; }
    idx = r;
    if (r == 0) { safePlay(S.maxLvl); }
    else if (r == 1) { levelSelect(); }
    else if (r == 2) { shop(); }
    else if (r == 3) { skinMenu(); }
    else if (r == 4) { howTo(); }
    else if (r == 5) { SOUND = !SOUND; S.sound = SOUND ? 1 : 0; }
    else if (r == 6) { saveGame(); flash("Game saved", GREEN); }
    else if (r == 7) {
      if (confirmBox("Save and exit?")) {
        saveGame(); cls(BLACK);
        ctxt("Sssee you later!  Saved.", 80, 1, WHITE);
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
