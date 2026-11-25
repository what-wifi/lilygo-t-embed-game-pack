/* ==========================================================
   LEMONADE STAND  by da cbm
   Bruce firmware 1.16.1 | LilyGO T-Embed CC1101 (320x170)  ES5
   ----------------------------------------------------------
   You SIT at your stand. Customers walk up to the counter and
   ask for lemonade. Take their order and serve it just right.
   Run low? Leave the stand, WALK to the supply store, buy
   stuff, and walk back - the stand is closed while you're gone.

   AT THE STAND   SEL = take order (or stand menu)   ESC = menu
   WALKING        turn knob = walk   SEL = enter   ESC = menu
   30 days, 8 AM - 5 PM each day.

   SAVE / LOAD    Stand menu or pause menu -> Save Game
                  Title screen shows Continue when a save exists.
   ========================================================== */

var W = display.width();
var H = display.height();

/* ---------- random ---------- */
var seed = 48271;
try { var t0 = now(); if (t0) { seed = (t0 % 2147483646) + 1; } } catch (e0) {}
function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
function ri(a, b) { return a + Math.floor(rnd() * (b - a + 1)); }

/* ---------- save / load (LittleFS or SD) ---------- */
var SAVE_PATH = "/lemonade_save.json";
var _stor = null;
try { _stor = require("storage"); } catch (eS) { _stor = null; }
function savWrite(path, data) {
  try {
    if (_stor && typeof _stor.write === "function") {
      return !!_stor.write(path, data, "w");
    }
  } catch (e1) {}
  try {
    if (typeof storageWrite === "function") {
      return !!storageWrite(path, data);
    }
  } catch (e2) {}
  return false;
}
function savRead(path) {
  try {
    if (_stor && typeof _stor.read === "function") {
      return _stor.read(path);
    }
  } catch (e1) {}
  try {
    if (typeof storageRead === "function") {
      return storageRead(path);
    }
  } catch (e2) {}
  return null;
}
function savRemove(path) {
  try {
    if (_stor && typeof _stor.remove === "function") {
      return !!_stor.remove(path);
    }
  } catch (e1) {}
  return false;
}
function hasSave() {
  try {
    var d = savRead(SAVE_PATH);
    return !!(d && d.length > 10);
  } catch (e) { return false; }
}
function saveGame() {
  try {
    var obj = {
      v: 1,
      day: G.day,
      cash: G.cash,
      lemons: G.lemons,
      sugar: G.sugar,
      ice: G.ice,
      cups: G.cups,
      pitch: G.pitch,
      recipeL: G.recipeL,
      recipeS: G.recipeS,
      recipeI: G.recipeI,
      price: G.price,
      weather: G.weather,
      reputation: G.reputation,
      min: G.min,
      where: G.where,
      missAcc: G.missAcc,
      today: {
        served: G.today.served,
        cups: G.today.cups,
        earned: G.today.earned,
        lost: G.today.lost
      }
    };
    var json = JSON.stringify(obj);
    if (savWrite(SAVE_PATH, json)) {
      flash("Game saved!", GREEN);
      return true;
    }
    flash("Save failed", RED);
    return false;
  } catch (e) {
    flash("Save error", RED);
    return false;
  }
}
function loadGame() {
  try {
    var raw = savRead(SAVE_PATH);
    if (!raw || raw.length < 10) { return false; }
    var obj = JSON.parse(raw);
    if (!obj || obj.v !== 1) { return false; }
    G.day = obj.day || 1;
    G.cash = (typeof obj.cash === "number") ? obj.cash : START_CASH;
    G.lemons = obj.lemons || 0;
    G.sugar = obj.sugar || 0;
    G.ice = obj.ice || 0;
    G.cups = obj.cups || 0;
    G.pitch = obj.pitch || 0;
    G.recipeL = obj.recipeL || 2;
    G.recipeS = obj.recipeS || 2;
    G.recipeI = obj.recipeI || 3;
    G.price = (typeof obj.price === "number") ? obj.price : 0.75;
    G.weather = (typeof obj.weather === "number") ? obj.weather : 0;
    G.reputation = (typeof obj.reputation === "number") ? obj.reputation : 50;
    G.min = obj.min || DAY_START;
    G.where = obj.where || 0;
    G.missAcc = obj.missAcc || 0;
    G.over = 0;
    G.today = newToday();
    if (obj.today) {
      G.today.served = obj.today.served || 0;
      G.today.cups = obj.today.cups || 0;
      G.today.earned = obj.today.earned || 0;
      G.today.lost = obj.today.lost || 0;
    }
    CU = [null, null];
    return true;
  } catch (e) {
    return false;
  }
}
function deleteSave() {
  try { savRemove(SAVE_PATH); } catch (e) {}
}

/* ---------- draw helpers ---------- */
function rgb(r, g, b) {
  r = Math.max(0, Math.min(255, Math.floor(r)));
  g = Math.max(0, Math.min(255, Math.floor(g)));
  b = Math.max(0, Math.min(255, Math.floor(b)));
  return ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3);
}
var HAS_RECT = (typeof display.drawRect === "function");
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
var pollN = 0;
function wait(ms) { ms = Math.floor(ms); if (ms < 1) { ms = 1; } pollN += ms; delay(ms); }
function beep(f, ms) { try { audio.tone(f, ms); } catch (e) {} }

var BLACK = rgb(0, 0, 0), WHITE = rgb(255, 255, 255), RED = rgb(230, 50, 40),
    GREEN = rgb(60, 210, 80), YEL = rgb(250, 220, 40), BLUE = rgb(80, 150, 255),
    GRAY = rgb(150, 150, 160), DARK = rgb(8, 18, 34), ORNG = rgb(250, 150, 30),
    CYAN = rgb(80, 220, 230), HDR = rgb(25, 95, 150), HINT = rgb(255, 230, 120),
    LEMON = rgb(255, 235, 60), SELC = rgb(40, 120, 190), LIGHTC = rgb(170, 210, 240);

/* ---------- input (hardened encoder debounce) ---------- */
var MENU_GAP = 160, MENU_REV = 300;
var ENC_GAP_MS = MENU_GAP, ENC_REV_MS = MENU_REV, ENC_NOISE_MS = 60;
var SEL_HOLD_MS = 200, ESC_HOLD_MS = 260;
var lastDir = 0, lastEncMs = -100000, lastSelMs = -100000, lastEscMs = -100000;
var selDown = false, escDown = false, encLockUntil = 0, encDisabled = false;
function nowMs() { return pollN; }
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
function walkMode() { ENC_GAP_MS = 35; ENC_REV_MS = 90; SEL_HOLD_MS = 200; encOn(); }
function menuMode() { ENC_GAP_MS = MENU_GAP; ENC_REV_MS = MENU_REV; SEL_HOLD_MS = 200; encOn(); }

/* ---------- menus (only the changed rows are repainted) ---------- */
function mrow(items, j, top, idx) {
  var y = 26 + (j - top) * 21, sel = (j == idx);
  fr(2, y - 2, W - 4, 20, sel ? SELC : DARK);
  txt(items[j], 8, y, 2, sel ? WHITE : LIGHTC);
}
function menu(title, items, idx, hints) {
  var n = items.length, VR = 6, top = 0, ptop = -1, pidx = -1, dirty = true, k, i, hint, phint = "", bh, by2;
  if (idx < 0 || idx >= n) { idx = 0; }
  drainEnc(); lockEnc(ENC_GAP_MS);
  while (true) {
    if (dirty) {
      top = idx - 2;
      if (top > n - VR) { top = n - VR; }
      if (top < 0) { top = 0; }
      if (ptop != top) {
        cls(DARK);
        fr(0, 0, W, 22, HDR);
        txt(title, 6, 4, 2, WHITE);
        for (i = 0; i < VR && top + i < n; i++) { mrow(items, top + i, top, idx); }
        if (n > VR) {
          bh = Math.floor(126 * VR / n);
          by2 = 26 + Math.floor(126 * top / n);
          fr(W - 4, by2, 3, bh, GRAY);
        }
        phint = "";
      } else {
        if (pidx >= top && pidx < top + VR) { mrow(items, pidx, top, idx); }
        mrow(items, idx, top, idx);
      }
      hint = (hints && hints[idx]) ? hints[idx] : "Turn: move  SEL: ok  ESC: back";
      if (hint != phint) {
        fr(0, H - 14, W, 14, rgb(6, 12, 24));
        txt(hint, 4, H - 11, 1, HINT);
        phint = hint;
      }
      ptop = top; pidx = idx; dirty = false;
    }
    k = inpMenu();
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
  var i;
  fr(25, 30, W - 50, 112, BLACK);
  rc(25, 30, W - 50, 112, col);
  rc(26, 31, W - 52, 110, col);
  for (i = 0; i < lines.length; i++) {
    ctxt(lines[i][0], 38 + i * 19, lines[i][1], lines[i][2]);
  }
  ctxt("SEL to continue", 128, 1, GRAY);
  waitKey();
}

/* ==========================================================
   SCENE ENGINE
   The background is recorded ONCE as a list of rectangles, so
   any small spot can be restored instantly. People are rectangle
   lists too: only the pixels they leave are repainted, so nothing
   flickers when they walk.
   ========================================================== */
var TOPY = 24, BOTY = 158, FY = 152, SCN = 0;
var REC = false, RN = 0, RX = [], RY = [], RW = [], RH = [], RC = [], BK = [], RKEY = -1;
function R(x, y, w, h, c) {
  x = Math.floor(x); y = Math.floor(y); w = Math.floor(w); h = Math.floor(h);
  if (w <= 0 || h <= 0) { return; }
  var x1 = x + w, y1 = y + h, s, s0, s1;
  if (x < 0) { x = 0; } if (y < TOPY) { y = TOPY; }
  if (x1 > W) { x1 = W; } if (y1 > BOTY) { y1 = BOTY; }
  if (x1 <= x || y1 <= y) { return; }
  if (REC) {
    RX[RN] = x; RY[RN] = y; RW[RN] = x1 - x; RH[RN] = y1 - y; RC[RN] = c;
    s0 = Math.floor(x / 40); s1 = Math.floor((x1 - 1) / 40);
    for (s = s0; s <= s1; s++) { BK[s].push(RN); }
    RN++;
    return;
  }
  display.drawFillRect(x, y, x1 - x, y1 - y, c);
}
function hh(a, b) { return ((a * 73 + b * 151 + a * b * 31) % 97) / 97; }
function disc(cx, cy, r, c) {
  var dy, dx;
  for (dy = -r; dy <= r; dy += 2) { dx = Math.floor(Math.sqrt(r * r - dy * dy)); R(cx - dx, cy + dy, dx * 2, 2, c); }
}
function cloud(x, y, c) { R(x, y + 5, 30, 8, c); R(x + 5, y, 15, 8, c); R(x + 14, y + 3, 14, 8, c); }

/* ---------- game data ---------- */
var WEATHER = ["Sunny", "Hot", "Cloudy", "Rainy", "Perfect"];
var WMULT = [1.0, 1.3, 0.85, 0.45, 1.5];
var WCOL = [YEL, ORNG, GRAY, BLUE, GREEN];
var SKYT = [[70, 150, 240], [250, 165, 70], [140, 150, 172], [66, 74, 96], [60, 170, 255]];
var SKYB = [[170, 215, 255], [255, 225, 150], [200, 205, 216], [120, 128, 146], [190, 236, 255]];
var FARB = [[120, 150, 200], [190, 140, 110], [120, 126, 142], [80, 90, 112], [120, 165, 215]];
var DAYS = 30, START_CASH = 20.00, DAY_START = 480, DAY_END = 1020, TPM = 3;
var P_LEM = 0.50, P_SUG = 0.30, P_ICE = 0.05, P_CUP = 0.05;
var SHIRTS = [rgb(220, 60, 60), rgb(60, 120, 220), rgb(60, 180, 90), rgb(240, 150, 40), rgb(170, 80, 210), rgb(240, 240, 240), rgb(30, 170, 190)];
var HAIRS = [rgb(40, 30, 20), rgb(110, 70, 30), rgb(230, 200, 90), rgb(180, 60, 30), rgb(200, 200, 205), rgb(20, 20, 20)];
var SKINS = [rgb(235, 185, 140), rgb(200, 145, 100), rgb(140, 95, 65), rgb(250, 215, 185)];
var PANTS = [rgb(36, 50, 90), rgb(70, 70, 80), rgb(110, 80, 50), rgb(40, 100, 80)];
var WOOD = rgb(150, 100, 55), WOODD = rgb(100, 65, 35), STRP = rgb(255, 225, 60);
var HUDBG = rgb(10, 14, 36), NEON = rgb(0, 200, 255);

var G = { weather: 0, price: 0.75, day: 1 };
var CU = [null, null];
var QUIT = false;
function newToday() { return { served: 0, cups: 0, earned: 0, lost: 0 }; }
function newGame() {
  G = {
    day: 1, cash: START_CASH, lemons: 4, sugar: 4, ice: 30, cups: 24, pitch: 0,
    recipeL: 2, recipeS: 2, recipeI: 3, price: 0.75, weather: 0,
    reputation: 50, over: 0, min: DAY_START, where: 0, missAcc: 0, today: newToday()
  };
  CU = [null, null];
  rollWeather();
}
function rollWeather() {
  var r = rnd();
  if (r < 0.25) { G.weather = 0; }
  else if (r < 0.45) { G.weather = 1; }
  else if (r < 0.70) { G.weather = 2; }
  else if (r < 0.85) { G.weather = 3; }
  else { G.weather = 4; }
}
function mny(n) { n = Math.floor(n * 100 + 0.0001) / 100; return "$" + n.toFixed(2); }
function two(n) { n = Math.floor(n); return (n < 10 ? "0" : "") + n; }
function clock12(m) {
  var h = Math.floor(m / 60), mm = m % 60, ap = (h >= 12) ? "PM" : "AM";
  h = h % 12; if (h == 0) { h = 12; }
  return h + ":" + two(mm) + ap;
}
function taste() {
  var t = 1.0;
  if (G.recipeL == 2) { t += 0.15; }
  if (G.recipeS == 2) { t += 0.15; }
  if (G.recipeI >= 3) { t += 0.1; }
  return t;
}
function arrivalRate() { return ((10 + G.reputation * 0.18) * WMULT[G.weather]) / (DAY_END - DAY_START); }

/* ---------- background painting ---------- */
function recBg() {
  var key = SCN * 8 + G.weather, i;
  if (key == RKEY) { return; }
  RKEY = key; RN = 0;
  for (i = 0; i < 10; i++) { BK[i] = []; }
  REC = true;
  drawBg();
  REC = false;
}
function paintRec(x0, y0, x1, y1) {
  var s, s0, s1, sx0, sx1, lst, j, k, ax, bx, ay, by;
  x0 = Math.floor(x0); y0 = Math.floor(y0); x1 = Math.floor(x1); y1 = Math.floor(y1);
  if (x0 < 0) { x0 = 0; } if (y0 < TOPY) { y0 = TOPY; } if (x1 > W) { x1 = W; } if (y1 > BOTY) { y1 = BOTY; }
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
function paintArea(x0, y0, x1, y1) { paintRec(x0, y0, x1, y1); }

function drawBg() {
  var w = G.weather, t = SKYT[w], u = SKYB[w], i, f, x, hgt, fb = FARB[w];
  for (i = 0; i < 14; i++) {
    f = i / 13;
    R(0, TOPY + i * 9, W, 9, rgb(t[0] + (u[0] - t[0]) * f, t[1] + (u[1] - t[1]) * f, t[2] + (u[2] - t[2]) * f));
  }
  if (w == 0 || w == 4) { disc(284, 54, 15, rgb(255, 245, 150)); cloud(40, 34, rgb(255, 255, 255)); }
  if (w == 1) { disc(284, 54, 24, rgb(255, 200, 110)); disc(284, 54, 15, rgb(255, 250, 190)); }
  if (w == 4) { cloud(190, 30, rgb(255, 255, 255)); }
  if (w == 2) { cloud(24, 32, rgb(235, 238, 245)); cloud(120, 40, rgb(225, 228, 238)); cloud(210, 30, rgb(235, 238, 245)); cloud(270, 46, rgb(220, 224, 234)); }
  if (w == 3) { cloud(10, 30, rgb(90, 96, 115)); cloud(90, 36, rgb(80, 86, 104)); cloud(170, 28, rgb(92, 98, 118)); cloud(250, 38, rgb(84, 90, 108)); cloud(50, 52, rgb(96, 102, 122)); }
  for (x = 0; x < W; x += 18) {
    hgt = 22 + Math.floor(hh(x, 3) * 40);
    R(x, 138 - hgt, 16, hgt, rgb(fb[0], fb[1], fb[2]));
    R(x + 3, 138 - hgt + 4, 3, 3, rgb(fb[0] + 40, fb[1] + 40, fb[2] + 40));
    R(x + 9, 138 - hgt + 4, 3, 3, rgb(fb[0] + 40, fb[1] + 40, fb[2] + 40));
  }
  if (SCN == 0) { standBg(); } else { streetBg(); }
  R(0, 138, W, 20, rgb(152, 152, 160));
  R(0, 138, W, 2, rgb(200, 200, 208));
  R(0, 156, W, 2, rgb(110, 110, 120));
  for (x = 20; x < W; x += 40) { R(x, 140, 1, 16, rgb(128, 128, 138)); }
  if (w == 3) {
    for (i = 0; i < 70; i++) { R(Math.floor(hh(i, 7) * W), TOPY + Math.floor(hh(i, 11) * 130), 1, 6, rgb(175, 195, 230)); }
  }
}
function standBg() {
  var i;
  /* far tree + bush */
  R(268, 112, 5, 26, WOODD); R(258, 90, 26, 26, rgb(50, 150, 70)); R(262, 84, 18, 8, rgb(60, 165, 80));
  /* chalk price board (text is added later) */
  R(14, 108, 3, 30, WOODD); R(64, 108, 3, 30, WOODD);
  R(8, 82, 64, 30, WOODD); R(10, 84, 60, 26, rgb(30, 70, 45));
  /* booth */
  R(98, 60, 4, 78, WOOD); R(218, 60, 4, 78, WOOD);
  R(102, 76, 116, 46, rgb(238, 208, 152));
  R(104, 94, 112, 3, WOODD);
  for (i = 0; i < 5; i++) { R(110 + i * 12, 87, 7, 7, rgb(255, 235, 60)); R(111 + i * 12, 88, 2, 2, rgb(255, 255, 190)); }
  R(184, 82, 10, 12, rgb(235, 235, 245)); R(196, 82, 10, 12, rgb(235, 235, 245)); R(198, 84, 6, 4, rgb(255, 235, 60));
  /* you, sitting behind the counter */
  R(150, 112, 4, 10, rgb(255, 232, 70)); R(166, 112, 4, 10, rgb(255, 232, 70));
  R(153, 108, 14, 14, rgb(255, 232, 70)); R(155, 114, 10, 8, rgb(255, 255, 255));
  R(155, 99, 10, 9, rgb(235, 185, 140)); R(154, 96, 12, 4, rgb(255, 215, 40)); R(165, 99, 5, 2, rgb(250, 160, 30));
  R(158, 103, 2, 2, BLACK); R(162, 103, 2, 2, BLACK); R(158, 106, 5, 1, rgb(150, 70, 60));
  /* awning */
  R(92, 58, 136, 4, rgb(200, 60, 50));
  for (i = 0; i < 17; i++) { R(92 + i * 8, 62, 8, 10, (i % 2 == 0) ? STRP : WHITE); R(92 + i * 8, 72, 8, 4, (i % 2 == 0) ? STRP : WHITE); }
  /* name board */
  R(108, 38, 104, 20, rgb(120, 40, 30)); R(110, 40, 100, 16, rgb(60, 20, 20));
  R(114, 56, 4, 4, WOODD); R(202, 56, 4, 4, WOODD);
  /* counter */
  R(92, 122, 136, 4, WOODD); R(92, 122, 136, 1, WOOD);
  for (i = 0; i < 15; i++) { R(98 + i * 8, 126, 8, 12, (i % 2 == 0) ? STRP : WHITE); }
}
function streetBg() {
  var i;
  /* your little stand */
  R(14, 100, 3, 38, WOOD); R(84, 100, 3, 38, WOOD);
  R(17, 108, 67, 16, rgb(238, 208, 152));
  for (i = 0; i < 11; i++) { R(10 + i * 7, 96, 7, 10, (i % 2 == 0) ? STRP : WHITE); }
  R(10, 94, 77, 3, rgb(200, 60, 50));
  R(12, 122, 78, 4, WOODD);
  for (i = 0; i < 10; i++) { R(14 + i * 7, 126, 7, 12, (i % 2 == 0) ? STRP : WHITE); }
  /* shops */
  R(100, 84, 44, 54, rgb(170, 90, 70)); R(100, 82, 44, 3, rgb(120, 60, 50));
  R(106, 92, 10, 12, rgb(250, 235, 160)); R(128, 92, 10, 12, rgb(250, 235, 160)); R(118, 112, 12, 26, rgb(60, 40, 30));
  R(150, 70, 54, 68, rgb(90, 110, 165)); R(150, 68, 54, 3, rgb(60, 75, 120));
  for (i = 0; i < 3; i++) { R(156 + i * 16, 78, 10, 12, rgb(245, 235, 170)); R(156 + i * 16, 98, 10, 12, rgb(245, 235, 170)); }
  R(170, 116, 14, 22, rgb(40, 40, 60));
  /* tree and lamp */
  R(214, 112, 5, 26, WOODD); R(204, 90, 26, 26, rgb(50, 150, 70)); R(208, 84, 18, 8, rgb(60, 165, 80));
  R(194, 98, 2, 40, rgb(50, 50, 60)); R(190, 96, 10, 3, rgb(50, 50, 60));
  /* supply store */
  R(232, 66, 84, 72, rgb(225, 210, 170)); R(228, 62, 92, 6, rgb(60, 110, 70));
  R(246, 70, 56, 14, rgb(40, 90, 50)); R(248, 72, 52, 10, rgb(25, 60, 35));
  for (i = 0; i < 10; i++) { R(236 + i * 8, 92, 8, 12, (i % 2 == 0) ? rgb(60, 170, 80) : WHITE); }
  R(238, 108, 18, 18, rgb(140, 200, 235)); R(292, 108, 18, 18, rgb(140, 200, 235));
  R(264, 108, 20, 30, rgb(95, 62, 40)); R(279, 124, 3, 3, rgb(240, 210, 80));
  R(238, 128, 14, 10, rgb(255, 235, 60)); R(296, 128, 14, 10, rgb(255, 235, 60));
}
var SPX = [48, 274];
function drawTexts() {
  if (SCN == 0) {
    txt("LEMONADE", 112, 41, 2, LEMON);
    txt("FRESH", 24, 87, 1, WHITE);
    txt(mny(G.price), 14, 98, 2, YEL);
  } else {
    txt("BACK SOON", 28, 109, 1, rgb(120, 70, 30));
    txt("SUPPLIES", 252, 75, 1, WHITE);
  }
}
function drawArrow(i, on) {
  var cx = SPX[i], r, c = (i == 0) ? YEL : GREEN;
  if (!on) { return; }
  for (r = 0; r < 6; r++) { R(cx - 6 + r, 102 + r * 2, 13 - r * 2, 2, c); }
  R(cx - 2, 94, 5, 8, c);
}
function drawArrows() { var i; for (i = 0; i < 2; i++) { drawArrow(i, MB == 1); } }
var MB = 1;
function blinkMarkers() {
  var i;
  MB = 1 - MB;
  for (i = 0; i < 2; i++) { paintArea(SPX[i] - 8, 92, SPX[i] + 8, 116); drawArrow(i, MB == 1); }
}

/* ---------- people (rectangle lists so they erase exactly) ---------- */
function personRects(x, f, wk, sh, hr, sk, pn, fy) {
  var l1 = (wk == 1) ? -2 : ((wk == 3) ? 2 : 0), L = [];
  L.push([x - 4 + l1, fy - 10, 4, 8, pn]); L.push([x + 1 - l1, fy - 10, 4, 8, pn]);
  L.push([x - 5 + l1, fy - 2, 5, 2, WHITE]); L.push([x + 1 - l1, fy - 2, 5, 2, WHITE]);
  L.push([x - 6, fy - 23, 12, 14, sh]);
  L.push([x - 3, fy - 32, 7, 2, sk]); L.push([x - 4, fy - 30, 9, 3, sk]); L.push([x - 5, fy - 27, 11, 4, sk]); L.push([x - 4, fy - 23, 9, 1, sk]);
  L.push([x - 5, fy - 34, 11, 4, hr]);
  L.push([x + f * 2 - 1, fy - 29, 3, 2, BLACK]);
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

/* ---------- the player walking the street ---------- */
var PX = 70, PF = 1, PWK = 0, WACC = 0, WMIN = 0, SPRL = null;
function sprRects(x, f, wk) {
  var L = personRects(x, f, wk, rgb(255, 255, 255), rgb(255, 215, 40), rgb(235, 185, 140), rgb(40, 80, 170), FY);
  L.push([x - 6, FY - 17, 12, 4, rgb(255, 215, 40)]);
  L.push([x + f * 4 - 1, FY - 31, 4, 2, rgb(250, 160, 30)]);
  return L;
}
function plDraw() {
  var nl = sprRects(Math.floor(PX), PF, PWK);
  if (SPRL) { eraseOld(SPRL, nl); }
  drawRects(nl);
  SPRL = nl;
}
function moveP(nx) {
  PX = nx; WACC += 1;
  if (WACC >= 2) { WACC = 0; PWK = (PWK + 1) & 3; }
  plDraw();
}

/* ---------- customers ---------- */
function mkCust(side) {
  return {
    side: side, x: (side == 0) ? -14 : W + 14, f: (side == 0) ? 1 : -1, tx: (side == 0) ? 112 : 208,
    st: 0, n: 1, ice: true, tol: 9, pat: 55, wk: 0, acc: 0, L: null, B: null, bt: 0, bst: -1, key: -1,
    ba: "", bb: "", bc: 0,
    sh: SHIRTS[ri(0, SHIRTS.length - 1)], hr: HAIRS[ri(0, HAIRS.length - 1)],
    sk: SKINS[ri(0, SKINS.length - 1)], pn: PANTS[ri(0, PANTS.length - 1)]
  };
}
function drawCust(c) {
  var key = Math.floor(c.x) * 8 + c.wk * 2 + ((c.f > 0) ? 1 : 0), nl;
  if (key == c.key && c.L) { return; }
  c.key = key;
  nl = personRects(Math.floor(c.x), c.f, c.wk, c.sh, c.hr, c.sk, c.pn, FY);
  if (c.L) { eraseOld(c.L, nl); }
  drawRects(nl);
  c.L = nl;
}
function eraseBubble(c) {
  if (c.B) { paintArea(c.B[0], c.B[1], c.B[0] + c.B[2], c.B[1] + c.B[3]); c.B = null; }
}
function setBubble(c, a, b, col) {
  var w = Math.max(a.length, b.length) * 6 + 14, h = 24, y = 86, x = Math.floor(c.tx - w / 2);
  if (x < 3) { x = 3; } if (x > W - w - 3) { x = W - w - 3; }
  if (c.B && (c.B[0] != x || c.B[2] != w)) { eraseBubble(c); }
  c.ba = a; c.bb = b; c.bc = col;
  R(x, y, w, h, col); R(x + 2, y + 2, w - 4, h - 4, WHITE);
  R(c.tx - 4, y + h, 8, 3, col); R(c.tx - 2, y + h - 2, 4, 4, WHITE);
  txt(a, x + 7, y + 4, 1, rgb(20, 20, 50));
  txt(b, x + 7, y + 13, 1, rgb(90, 90, 120));
  c.B = [x, y, w, h + 3];
}
function waitingCust() {
  var i;
  for (i = 0; i < 2; i++) { if (CU[i] && CU[i].st == 1) { return CU[i]; } }
  return null;
}
function custLeaves(c, a, b, col, pen) {
  setBubble(c, a, b, col);
  c.st = 2; c.bt = 24;
  G.today.lost++;
  G.reputation = Math.max(0, G.reputation - pen);
}
function arriveCust(c) {
  if (G.price > c.tol) { custLeaves(c, "Too pricey!", "Bye...", RED, 1); return; }
  c.bst = 0;
  setBubble(c, c.n + " lemonade" + ((c.n > 1) ? "s" : ""), c.ice ? "with ice" : "no ice", GREEN);
  beep(880, 40);
}
function spawnCustomer() {
  var side = (rnd() < 0.5) ? 0 : 1, c, r;
  if (CU[side]) { side = 1 - side; if (CU[side]) { G.today.lost++; return; } }
  c = mkCust(side);
  r = rnd();
  c.n = (r < 0.55) ? 1 : ((r < 0.85) ? 2 : 3);
  c.ice = rnd() < ((G.weather == 1) ? 0.85 : ((G.weather == 3) ? 0.35 : 0.6));
  c.tol = (0.5 + rnd() * 1.2) * (taste() / 1.2) + ((G.weather == 1) ? 0.25 : 0);
  CU[side] = c;
}
function stepAnim(c) { c.acc += 3; if (c.acc >= 9) { c.acc -= 9; c.wk = (c.wk + 1) & 3; } }
function updCusts() {
  var i, c;
  for (i = 0; i < 2; i++) {
    c = CU[i];
    if (!c) { continue; }
    if (c.st == 0) {
      c.x += c.f * 3; stepAnim(c);
      if ((c.f > 0 && c.x >= c.tx) || (c.f < 0 && c.x <= c.tx)) { c.x = c.tx; c.wk = 0; c.st = 1; arriveCust(c); }
      drawCust(c);
    } else if (c.st == 2) {
      c.bt--;
      if (c.bt <= 0) { eraseBubble(c); c.ba = ""; c.st = 3; c.f = (c.side == 0) ? -1 : 1; }
    } else if (c.st == 3) {
      c.x += c.f * 3; stepAnim(c);
      drawCust(c);
      if (c.x < -16 || c.x > W + 16) { if (c.L) { eraseOld(c.L, []); } CU[i] = null; }
    }
  }
}
function minuteTick() {
  var p = arrivalRate(), i, c, stg;
  if (G.where == 1) { G.missAcc += p; return; }
  if (rnd() < p) { spawnCustomer(); }
  for (i = 0; i < 2; i++) {
    c = CU[i];
    if (c && c.st == 1) {
      c.pat--;
      if (c.pat <= 0) { custLeaves(c, "Too slow!", "Bye...", RED, 2); }
      else {
        stg = (c.pat > 33) ? 0 : ((c.pat > 16) ? 1 : 2);
        if (stg != c.bst) { c.bst = stg; setBubble(c, c.ba, c.bb, (stg == 0) ? GREEN : ((stg == 1) ? YEL : RED)); }
      }
    }
  }
}
function addMin(n) { var i; for (i = 0; i < n; i++) { G.min++; minuteTick(); } }

/* the pitcher on the counter shows how much lemonade is ready */
var pitL = null, pitKey = -1;
function pitcherRects() {
  var L = [], lv = Math.floor(G.pitch / 16 * 12);
  L.push([134, 106, 14, 16, rgb(215, 238, 248)]);
  L.push([136, 108, 10, 12, rgb(150, 190, 205)]);
  if (lv > 0) { L.push([136, 120 - lv, 10, lv, rgb(255, 235, 60)]); }
  L.push([148, 109, 3, 8, rgb(215, 238, 248)]);
  return L;
}
function drawPitcher() {
  var nl;
  if (pitKey == G.pitch && pitL) { return; }
  pitKey = G.pitch;
  nl = pitcherRects();
  if (pitL) { eraseOld(pitL, nl); }
  drawRects(nl);
  pitL = nl;
}
function repaintEntities() {
  var i, c;
  if (SCN == 0) {
    pitL = null; pitKey = -1; drawPitcher();
    for (i = 0; i < 2; i++) {
      c = CU[i];
      if (c) {
        c.L = null; c.key = -1; drawCust(c);
        if (c.ba) { c.B = null; setBubble(c, c.ba, c.bb, c.bc); }
      }
    }
  } else {
    drawArrows();
    SPRL = null; plDraw();
  }
}

/* ---------- HUD + bottom bar (only changed fields are repainted) ---------- */
var hudLast = ["", "", "", "", "", ""], barLast = "";
function hudField(i, s, x, y, w, col) {
  if (hudLast[i] == s) { return; }
  fr(x, y, w, 9, HUDBG); txt(s, x, y, 1, col); hudLast[i] = s;
}
function hud(force) {
  if (force) {
    fr(0, 0, W, TOPY, HUDBG); fr(0, TOPY - 1, W, 1, NEON);
    hudLast = ["", "", "", "", "", ""];
  }
  hudField(0, "Day " + G.day + "/" + DAYS, 4, 3, 56, YEL);
  hudField(1, clock12(Math.floor(G.min / 5) * 5), 66, 3, 50, WHITE);
  hudField(2, WEATHER[G.weather], 124, 3, 54, WCOL[G.weather]);
  hudField(5, "Rep " + G.reputation, 184, 3, 56, LIGHTC);
  hudField(3, mny(G.cash), 248, 3, 68, GREEN);
  hudField(4, "Lem " + G.lemons + "  Sug " + G.sugar + "  Ice " + G.ice + "  Cup " + G.cups + "  Pitcher " + G.pitch, 4, 13, 310, CYAN);
}
function bar(msg, col) {
  if (msg == barLast) { return; }
  barLast = msg;
  fr(0, 158, W, 12, rgb(10, 10, 24));
  msg = String(msg); if (msg.length > 52) { msg = msg.substring(0, 52); }
  txt(msg, 4, 161, 1, col);
}
function fullPaint() {
  paintArea(0, TOPY, W, BOTY);
  drawTexts();
  repaintEntities();
}
function redrawAll() { barLast = "~"; hud(true); fullPaint(); }

/* ---------- shop ---------- */
function shopMenu() {
  var r, idx = 0, cost, qty;
  while (true) {
    r = menu("SHOP  " + mny(G.cash), [
      "Lemons  " + mny(P_LEM) + " ea",
      "Sugar   " + mny(P_SUG) + " /cup",
      "Ice     " + mny(P_ICE) + " /cube",
      "Cups    " + mny(P_CUP) + " ea",
      "Back to the stand"
    ], idx, [
      "You have " + G.lemons, "You have " + G.sugar, "You have " + G.ice, "You have " + G.cups, "Walk back to your stand"
    ]);
    if (r < 0 || r == 4) { return; }
    idx = r;
    if (r == 0) {
      qty = askQty(1, Math.floor(G.cash / P_LEM), "Lemons");
      if (qty > 0) { cost = qty * P_LEM; if (G.cash >= cost) { G.cash -= cost; G.lemons += qty; flash("+" + qty + " lemons", GREEN); } else { flash("Not enough", RED); } }
    } else if (r == 1) {
      qty = askQty(1, Math.floor(G.cash / P_SUG), "Sugar");
      if (qty > 0) { cost = qty * P_SUG; if (G.cash >= cost) { G.cash -= cost; G.sugar += qty; flash("+" + qty + " sugar", GREEN); } else { flash("Not enough", RED); } }
    } else if (r == 2) {
      qty = askQty(5, Math.floor(G.cash / P_ICE), "Ice");
      if (qty > 0) { cost = qty * P_ICE; if (G.cash >= cost) { G.cash -= cost; G.ice += qty; flash("+" + qty + " ice", GREEN); } else { flash("Not enough", RED); } }
    } else if (r == 3) {
      qty = askQty(10, Math.floor(G.cash / P_CUP), "Cups");
      if (qty > 0) { cost = qty * P_CUP; if (G.cash >= cost) { G.cash -= cost; G.cups += qty; flash("+" + qty + " cups", GREEN); } else { flash("Not enough", RED); } }
    }
  }
}
function askQty(step, maxq, name) {
  var qty, items, r;
  if (maxq < 1) { flash("Can't afford any", RED); return 0; }
  qty = step;
  while (true) {
    items = ["Qty: " + qty, "Buy " + qty + " " + name, "Cancel"];
    r = menu("BUY " + name, items, 0, ["Press to add more", "Confirm", "Back"]);
    if (r < 0 || r == 2) { return 0; }
    if (r == 0) { qty += step; if (qty > maxq) { qty = step; } }
    else { return qty; }
  }
}

/* ---------- recipe & price ---------- */
function recipeMenu() {
  var r, idx = 0;
  while (true) {
    r = menu("RECIPE & PRICE", [
      "Lemons/pitcher: " + G.recipeL,
      "Sugar/pitcher:  " + G.recipeS,
      "Ice per cup:    " + G.recipeI,
      "Price/cup:      " + mny(G.price),
      "Back"
    ], idx, [
      "More lemons = tarter", "More sugar = sweeter", "Ice cubes per iced cup", "Higher price = fewer takers", ""
    ]);
    if (r < 0 || r == 4) { return; }
    idx = r;
    if (r == 0) { G.recipeL = (G.recipeL >= 5) ? 1 : G.recipeL + 1; }
    else if (r == 1) { G.recipeS = (G.recipeS >= 5) ? 1 : G.recipeS + 1; }
    else if (r == 2) { G.recipeI = (G.recipeI >= 6) ? 1 : G.recipeI + 1; }
    else if (r == 3) { G.price += 0.10; if (G.price > 2.00) { G.price = 0.25; } G.price = Math.floor(G.price * 100 + 0.5) / 100; }
  }
}

/* ---------- at the counter ---------- */
var ORDER_ITEMS = ["1 cup, ice", "2 cups, ice", "3 cups, ice", "1 cup, no ice", "2 cups, no ice", "3 cups, no ice", "Sorry, can't help"];
var ORDER_HINTS = ["Pour 1 cup over ice", "Pour 2 cups over ice", "Pour 3 cups over ice", "Pour 1 cup, no ice", "Pour 2 cups, no ice", "Pour 3 cups, no ice", "Send them away"];
function makePitcher() {
  if (G.pitch > 8) { flash("Pitcher is full", ORNG); return; }
  if (G.lemons < G.recipeL || G.sugar < G.recipeS) { flash("Need " + G.recipeL + " lem + " + G.recipeS + " sug", RED); return; }
  G.lemons -= G.recipeL; G.sugar -= G.recipeS; G.pitch += 8;
  flash("+8 cups ready", GREEN);
}
function serveCust(c) {
  var r, nn, ic, need, pay, tip, right, why;
  menuMode();
  r = menu("ORDER: " + c.n + (c.ice ? " + ice" : " no ice"), ORDER_ITEMS, 0, ORDER_HINTS);
  menuMode();
  redrawAll();
  if (r < 0) { return; }
  if (r == 6) { custLeaves(c, "Aw, ok...", "Bye", ORNG, 1); return; }
  nn = (r % 3) + 1; ic = (r < 3);
  need = ic ? nn * G.recipeI : 0;
  if (G.pitch < nn) { flash("Pitcher is low!", RED); redrawAll(); return; }
  if (G.cups < nn) { flash("Out of cups!", RED); redrawAll(); return; }
  if (G.ice < need) { flash("Out of ice!", RED); redrawAll(); return; }
  G.pitch -= nn; G.cups -= nn; G.ice -= need;
  drawPitcher();
  right = (nn == c.n && ic == c.ice);
  if (right) {
    pay = G.price * nn;
    tip = (rnd() < 0.3 + ((c.pat > 40) ? 0.25 : 0) + (taste() - 1) * 0.5) ? ri(1, 4) * 0.10 : 0;
    pay += tip;
    if (tip > 0 && G.reputation < 100) { G.reputation++; }
    setBubble(c, "Thanks!", "+" + mny(pay), GREEN);
    beep(1200, 30); beep(1600, 40);
  } else {
    pay = G.price * nn * 0.5;
    G.reputation = Math.max(0, G.reputation - 2);
    setBubble(c, "Not what I", "asked for!", RED);
    beep(200, 90);
  }
  G.cash += pay;
  G.today.served++; G.today.cups += nn; G.today.earned += pay;
  c.st = 2; c.bt = 26;
}

/* ---------- menus away from / at the counter ---------- */
function statusScreen() {
  popup([
    ["STATUS  Day " + G.day, 2, YEL],
    ["Cash " + mny(G.cash) + "  Rep " + G.reputation, 1, WHITE],
    ["Lem " + G.lemons + " Sug " + G.sugar + " Ice " + G.ice + " Cup " + G.cups, 1, CYAN],
    ["Weather today: " + WEATHER[G.weather], 1, GREEN],
    ["Pitcher: " + G.pitch + " cups ready", 1, LEMON]
  ], YEL);
}
function standMenu() {
  var r, idx = 0;
  menuMode();
  while (true) {
    r = menu("STAND  " + mny(G.cash), [
      "Make pitcher", "Recipe & Price", "Go shopping", "Status",
      "Save Game", "Close for today", "Quit"
    ], idx, [
      "Mix a pitcher: 8 cups", "Set recipe and cup price", "Leave the stand! Stand closes",
      "Cash, stock, weather", "Save progress to device", "End the day now", "Back to title"
    ]);
    if (r < 0) { break; }
    idx = r;
    if (r == 0) { makePitcher(); }
    else if (r == 1) { recipeMenu(); }
    else if (r == 2) { G.where = 1; G.missAcc = 0; break; }
    else if (r == 3) { statusScreen(); }
    else if (r == 4) { saveGame(); }
    else if (r == 5) { if (confirmBox("Close for today?")) { endDay(); break; } }
    else if (r == 6) { if (confirmBox("Quit to title?")) { QUIT = true; break; } }
  }
}
function escMenu() {
  var r = menu("PAUSED", ["Resume", "Status", "Save Game", "Quit"], 0, null);
  if (r == 1) { statusScreen(); }
  else if (r == 2) { saveGame(); }
  else if (r == 3) { if (confirmBox("Quit to title?")) { QUIT = true; } }
}
function dayEvent() {
  var r = rnd(), bonus, loss;
  if (r < 0.3) {
    bonus = ri(3, 12); G.cash += bonus;
    popup([["Street tip!", 2, GREEN], ["A kind stranger gave you " + mny(bonus), 1, WHITE]], GREEN);
  } else if (r < 0.5) {
    loss = Math.min(G.cash, ri(2, 8)); G.cash -= loss;
    popup([["Spoiled stock", 2, ORNG], ["Ice melted early. Lost " + mny(loss), 1, WHITE]], ORNG);
  } else if (r < 0.7) {
    G.reputation = Math.min(100, G.reputation + 5);
    popup([["Good review!", 2, CYAN], ["Word of mouth is spreading", 1, WHITE], ["Reputation up", 1, WHITE]], CYAN);
  } else {
    G.cups += 20;
    popup([["Found cups!", 2, YEL], ["Someone left 20 cups", 1, WHITE], ["Free inventory", 1, WHITE]], YEL);
  }
}
function endDay() {
  var t = G.today, lines;
  menuMode();
  lines = [
    ["DAY " + G.day + " RESULTS", 2, YEL],
    ["Weather: " + WEATHER[G.weather], 1, CYAN],
    ["Served " + t.served + " people, " + t.cups + " cups", 1, WHITE],
    ["Earned " + mny(t.earned) + "   Missed " + t.lost, 1, GREEN]
  ];
  if (G.pitch > 0) { lines.push(["Flat lemonade tossed: " + G.pitch + " cups", 1, ORNG]); }
  popup(lines, YEL);
  G.pitch = 0;
  G.ice = Math.floor(G.ice * 0.6);
  CU = [null, null];
  G.day++; G.where = 0; G.min = DAY_START; G.today = newToday(); G.missAcc = 0;
  if (G.day > DAYS) { G.over = 1; return; }
  rollWeather();
  if (rnd() < 0.18) { dayEvent(); }
}

/* ---------- scene loops ---------- */
function standScene() {
  var k, tick = 0, c, m;
  SCN = 0; G.where = 0; SPRL = null;
  menuMode(); redrawAll();
  if (G.missAcc >= 1) {
    m = Math.floor(G.missAcc + rnd());
    G.today.lost += m;
    G.reputation = Math.max(0, G.reputation - Math.floor(m / 3));
    flash("Missed ~" + m + " customers", ORNG);
    redrawAll();
  }
  G.missAcc = 0;
  while (!G.over && G.where == 0 && !QUIT) {
    k = inp();
    if (k == 3 || k == 4) {
      c = (k == 3) ? waitingCust() : null;
      if (c) { serveCust(c); } else { standMenu(); }
      if (G.over || QUIT || G.where != 0) { break; }
      menuMode(); redrawAll();
      continue;
    }
    tick++;
    if (tick >= TPM) {
      tick = 0; addMin(1);
      if (G.min >= DAY_END) { endDay(); break; }
    }
    updCusts();
    drawPitcher();
    hud(false);
    c = waitingCust();
    bar(c ? "SEL: take order      ESC: stand menu" : "SEL / ESC: stand menu   (go shopping there)", c ? YEL : GRAY);
    wait(30);
  }
}
function nearSpot() {
  var i;
  for (i = 0; i < 2; i++) { if (Math.abs(PX - SPX[i]) <= 20) { return i; } }
  return -1;
}
function prompt1(ns) {
  if (ns == 0) { bar("SEL: walk back into your stand", YEL); }
  else if (ns == 1) { bar("SEL: go into the supply store", GREEN); }
  else { bar("Turn knob: walk   ESC: menu", GRAY); }
}
function streetScene() {
  var k, tgt, ns, last = -2, d, s, idle = 0;
  SCN = 1; PX = 70; PF = 1; PWK = 0; WACC = 0; WMIN = 0; SPRL = null; MB = 1;
  redrawAll(); walkMode(); tgt = PX;
  while (!G.over && G.where == 1 && !QUIT) {
    k = inp();
    if (k == 1) { tgt = Math.min(W - 16, tgt + 22); } else if (k == 2) { tgt = Math.max(16, tgt - 22); }
    if (tgt > PX + 66) { tgt = PX + 66; } if (tgt < PX - 66) { tgt = PX - 66; }
    if (PX != tgt) {
      d = (tgt > PX) ? 1 : -1; PF = d; s = Math.abs(tgt - PX);
      s = Math.min(s, Math.max(3, Math.min(10, Math.ceil(s / 3))));
      moveP(PX + d * s); idle = 0;
      WMIN += s;
      while (WMIN >= 4) { WMIN -= 4; addMin(1); }
      hud(false);
      if (G.min >= DAY_END) { endDay(); break; }
    } else {
      if (PWK != 0) { PWK = 0; plDraw(); }
      idle++; if (idle % 14 == 0) { blinkMarkers(); }
    }
    ns = nearSpot();
    if (ns != last) { last = ns; prompt1(ns); }
    if (k == 3) {
      if (ns == 0) { G.where = 0; break; }
      else if (ns == 1) { menuMode(); shopMenu(); walkMode(); redrawAll(); tgt = PX; last = -2; }
    } else if (k == 4) {
      menuMode(); escMenu();
      if (QUIT) { break; }
      walkMode(); redrawAll(); tgt = PX; last = -2;
    }
    wait(8);
  }
}

/* ---------- title, how-to, game over ---------- */
function titleScreen() {
  var tt = 0, c, blink = 0, t = 0;
  G = { weather: 0, price: 0.75, day: 1 };
  CU = [null, null]; SCN = 0; RKEY = -1; pitL = null; pitKey = -1;
  cls(DARK);
  fr(0, 0, W, TOPY, HUDBG); fr(0, TOPY - 1, W, 1, NEON);
  ctxt("LEMONADE STAND", 4, 2, LEMON);
  paintArea(0, TOPY, W, BOTY);
  drawTexts();
  ctxt("by da cbm", 27, 1, WHITE);
  G.pitch = 5; drawPitcher();
  fr(0, 158, W, 12, rgb(10, 10, 24));
  menuMode();
  while (true) {
    t++;
    if (!CU[0]) { c = mkCust(0); c.tol = 99; c.n = 1 + (t % 3); c.ice = ((t >> 2) % 2 == 0); CU[0] = c; tt = 0; }
    updCusts();
    c = CU[0];
    if (c && c.st == 1) {
      tt++;
      if (tt > 60) { tt = 0; setBubble(c, "Thanks!", "Bye now", GREEN); c.st = 2; c.bt = 20; }
    }
    if (t % 16 == 0) {
      blink = 1 - blink;
      fr(0, 158, W, 12, rgb(10, 10, 24));
      if (blink) { ctxt("Press SEL to start", 161, 1, WHITE); }
    }
    if (kSel()) { settleInput(); return; }
    if (kEsc()) { settleInput(); return; }
    drainEnc(); wait(30);
  }
}
function howTo() {
  popup([["HOW TO PLAY", 2, LEMON], ["You sit at your stand.", 1, WHITE], ["Customers walk up and ask", 1, WHITE], ["for lemonade. SEL = take order", 1, WHITE], ["then pick what they asked for", 1, WHITE]], LEMON);
  popup([["RUNNING LOW?", 2, CYAN], ["ESC = stand menu: Go shopping", 1, WHITE], ["Turn knob to walk to the store", 1, WHITE], ["Stand is closed while you walk", 1, WHITE], ["Mix pitchers in the stand menu", 1, WHITE]], CYAN);
  popup([["TIPS", 2, GREEN], ["Hot + Perfect days sell more", 1, WHITE], ["Too high a price scares people", 1, WHITE], ["Be quick and be right = tips", 1, WHITE], ["Save anytime from stand / pause menu", 1, WHITE]], GREEN);
}
function gameOver() {
  var rank = (G.cash >= 300) ? "LEMONADE BARON" : ((G.cash >= 150) ? "STREET PRO" : ((G.cash >= 75) ? "SOLID STAND" : ((G.cash >= 40) ? "HUSTLER" : "NEEDS PRACTICE")));
  menuMode();
  cls(rgb(0, 12, 6));
  ctxt("SEASON OVER", 14, 2, YEL);
  ctxt("Days: " + DAYS, 44, 1, WHITE);
  ctxt("Final Cash", 66, 1, WHITE);
  ctxt(mny(G.cash), 84, 3, GREEN);
  ctxt("Reputation " + G.reputation, 122, 1, CYAN);
  ctxt(rank, 140, 1, ORNG);
  ctxt("SEL to continue", 158, 1, GRAY);
  waitKey();
}
function playGame(fromSave) {
  if (!fromSave) {
    newGame();
    popup([["WELCOME!", 2, LEMON], ["Customers will walk up.", 1, WHITE], ["SEL = take their order", 1, WHITE], ["ESC = stand menu / shopping", 1, WHITE]], LEMON);
  } else {
    popup([["WELCOME BACK!", 2, LEMON], ["Day " + G.day + "  " + mny(G.cash), 1, WHITE], ["Rep " + G.reputation, 1, CYAN], ["SEL = order  ESC = menu", 1, WHITE]], LEMON);
  }
  while (!G.over && !QUIT) {
    if (G.where == 0) { standScene(); } else { streetScene(); }
  }
  if (G.over && !QUIT) {
    deleteSave();
    gameOver();
  }
}
function run() {
  var r, items, saved;
  while (true) {
    titleScreen();
    settleInput();
    QUIT = false;
    saved = hasSave();
    if (saved) {
      items = ["Continue", "New Game", "How To Play", "Delete Save", "Exit"];
    } else {
      items = ["New Game", "How To Play", "Exit"];
    }
    r = menu("LEMONADE STAND", items, 0, null);
    if (saved) {
      if (r == 0) {
        if (loadGame()) { playGame(true); }
        else { flash("Load failed", RED); }
        QUIT = false;
      } else if (r == 1) {
        if (confirmBox("Overwrite save?")) {
          deleteSave();
          playGame(false);
        }
        QUIT = false;
      } else if (r == 2) { howTo(); }
      else if (r == 3) {
        if (confirmBox("Delete save file?")) {
          deleteSave();
          flash("Save deleted", ORNG);
        }
      } else if (r == 4 || r < 0) {
        cls(BLACK);
        ctxt("Stay sweet", 80, 2, LEMON);
        wait(600);
        return;
      }
    } else {
      if (r == 0) { playGame(false); QUIT = false; }
      else if (r == 1) { howTo(); }
      else if (r == 2 || r < 0) {
        cls(BLACK);
        ctxt("Stay sweet", 80, 2, LEMON);
        wait(600);
        return;
      }
    }
  }
}
run();
