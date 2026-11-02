/* ==========================================================
   TIGHT LINES - North American Fishing Game
   Bruce firmware 1.16.1  |  LilyGO T-Embed CC1101 (320x170)
   ----------------------------------------------------------
   Encoder TURN  = scroll menus / change lure / REEL in fight
   Encoder PRESS = confirm / cast / set hook / ease line (SEL)
   ESC button    = back / quit
   Hardened: debounced encoder, flicker-free partial redraw,
   frame-rate independent physics, crash guards.
   ----------------------------------------------------------
   25 scenes x 4 levels = 100 levels, 70 fish species (US and Canada),
   boat or land fishing, tackle shop, rod/reel upgrades.
   Progress auto-saves to /fishing_save.txt (SD or LittleFS)
   ========================================================== */

var W = display.width();
var H = display.height();
var SURF = Math.floor(H * 0.47);
var tick = 0;

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
/* ---------- safe drawing primitives (fallbacks if an API call is missing) ---------- */
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
function padR(s, n) { s = String(s); while (s.length < n) { s += " "; } return s; }
var SOUND = true;
var pollN = 0;
function wait(ms) { pollN += ms; delay(ms); }
var useNow = false;
function nowMs() {
  if (useNow) { try { var t = now(); if (t > 0) { return t; } } catch (e) {} }
  return pollN;
}
/* use the device clock only if it really counts milliseconds */
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
    GRAY = rgb(130, 130, 140), DARK = rgb(12, 24, 44), ORNG = rgb(250, 150, 30),
    CYAN = rgb(80, 220, 230);

/* ---------- input ---------- */
/* Hardened debounce for the T-Embed CC1101 mechanical encoder (Bruce 1.16.x).
   - every accepted step locks the encoder for ENC_GAP_MS and drains any
     queued bounce events
   - a direction reversal inside ENC_REV_MS is treated as contact bounce
   - any rejected event extends the lock a little (kills burst noise)
   - SEL / ESC are pure edges: one action per physical press
   - during timing phases (power meter, waiting, bite) the encoder is
     switched off completely so it cannot fire stray events */
var MENU_GAP = 160, MENU_REV = 300, FIGHT_GAP = 110, FIGHT_REV = 240;
var ENC_GAP_MS = MENU_GAP, ENC_REV_MS = MENU_REV, ENC_NOISE_MS = 80;
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
function encOff() { encDisabled = true; drainEnc(); }
function encOn() { encDisabled = false; lockEnc(0); drainEnc(); }

function encAccept(d) {
  if (encDisabled) { drainEnc(); return false; }
  var t = nowMs();
  if (t < encLockUntil || t - lastEncMs < ENC_GAP_MS ||
      (lastDir != 0 && lastDir != d && (t - lastEncMs) < ENC_REV_MS)) {
    /* rejected = bounce/noise: extend the lock a little, but never beyond
       one gap + noise window after the last accepted step, so a hand that
       keeps turning still gets a click through every ~200-250ms */
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

/* Lures: name, cost  (ids used by fish favourites) */
var LURES = [
  ["Worm", 0], ["Cricket", 15], ["Minnow", 40], ["Jig", 60], ["Spinner", 80],
  ["Spoon", 110], ["Crankbait", 150], ["Popper", 200], ["Soft Plastic", 250],
  ["Swimbait", 450], ["Fly Set", 600], ["Cut Bait", 120], ["Squid", 300],
  ["Live Eel", 900], ["Deep Diver", 1200]
];

/* Rods: name, cost, power(lb), hook window(frames) */
var RODS = [
  ["Cane Pole", 0, 8, 20], ["Spincast Combo", 120, 15, 24], ["Ultralight", 300, 12, 28],
  ["Med Spinning", 700, 30, 26], ["Baitcaster", 1500, 50, 26], ["Fly Rod", 2500, 40, 30],
  ["Heavy Surf Rod", 5000, 120, 22], ["Pro Graphite", 12000, 200, 34]
];

/* Reels: name, cost, speed, tension-per-click */
var REELS = [
  ["Basic Reel", 0, 2.0, 7.0], ["Spincast Reel", 100, 2.4, 6.5], ["Open-Face Reel", 300, 3.0, 6.0],
  ["Baitcast Reel", 800, 3.6, 5.5], ["Ball Bearing", 1800, 4.2, 5.0], ["Saltwater Reel", 4000, 5.0, 4.5],
  ["Big Game Reel", 8000, 6.0, 4.0], ["Pro Titanium", 16000, 7.0, 3.5]
];

/* Lines: name, cost, pull multiplier */
var LINES = [
  ["Mono 4lb", 0, 1.0], ["Mono 10lb", 60, 0.9], ["Braid 20lb", 200, 0.8],
  ["Fluoro 30lb", 500, 0.7], ["Braid 50lb", 1200, 0.6], ["Wire Braid 80lb", 3000, 0.5]
];

var SONAR_COST = [0, 500, 1800, 5000];

/* Fish: name, minLb, maxLb, rarity(1-5), $/lb, pull(1-10), zone(0 shallow,1 mid,2 deep), lureA, lureB */
var FISH = [
  ["Bluegill", 0.3, 2, 1, 6, 2, 0, 0, 1],
  ["Pumpkinseed", 0.2, 1.2, 1, 6, 2, 0, 1, 0],
  ["Redear Sunfish", 0.5, 3, 2, 7, 3, 0, 0, 1],
  ["Green Sunfish", 0.2, 1, 1, 6, 2, 0, 1, 10],
  ["Black Crappie", 0.5, 3, 2, 8, 3, 1, 2, 3],
  ["White Crappie", 0.5, 3, 2, 8, 3, 1, 2, 3],
  ["Yellow Perch", 0.3, 3, 1, 8, 3, 1, 2, 0],
  ["Rock Bass", 0.3, 1.5, 1, 7, 3, 0, 2, 4],
  ["Largemouth Bass", 1, 14, 3, 12, 5, 1, 8, 6],
  ["Smallmouth Bass", 1, 8, 3, 13, 6, 1, 3, 4],
  ["Spotted Bass", 1, 6, 2, 11, 5, 1, 8, 3],
  ["White Bass", 0.5, 4, 2, 9, 5, 1, 4, 2],
  ["Striped Bass", 5, 60, 4, 10, 8, 2, 9, 13],
  ["Walleye", 1, 14, 3, 14, 5, 2, 2, 3],
  ["Northern Pike", 3, 30, 3, 11, 7, 1, 5, 9],
  ["Muskellunge", 8, 50, 5, 16, 9, 2, 9, 13],
  ["Chain Pickerel", 1, 6, 2, 8, 5, 1, 5, 4],
  ["Channel Catfish", 2, 30, 2, 7, 5, 2, 11, 0],
  ["Blue Catfish", 10, 80, 4, 8, 8, 2, 11, 13],
  ["Flathead Catfish", 10, 60, 4, 8, 8, 2, 2, 11],
  ["Black Bullhead", 0.5, 3, 1, 5, 3, 1, 0, 11],
  ["Common Carp", 3, 35, 2, 5, 6, 1, 0, 11],
  ["Rainbow Trout", 1, 12, 2, 12, 5, 1, 10, 4],
  ["Brown Trout", 1, 20, 3, 13, 6, 1, 10, 5],
  ["Brook Trout", 0.5, 6, 3, 14, 4, 0, 10, 0],
  ["Lake Trout", 5, 40, 4, 12, 7, 2, 14, 5],
  ["Cutthroat Trout", 1, 10, 3, 14, 5, 1, 10, 4],
  ["Golden Trout", 0.5, 4, 5, 25, 4, 0, 10, 3],
  ["Atlantic Salmon", 5, 30, 4, 14, 8, 1, 10, 4],
  ["Chinook Salmon", 10, 60, 4, 12, 9, 2, 5, 9],
  ["Coho Salmon", 4, 20, 3, 11, 8, 1, 4, 5],
  ["Sockeye Salmon", 3, 12, 3, 12, 7, 1, 4, 10],
  ["Steelhead", 4, 25, 4, 13, 8, 1, 3, 10],
  ["Arctic Grayling", 0.5, 4, 3, 15, 4, 0, 10, 4],
  ["Dolly Varden", 1, 12, 3, 12, 5, 1, 5, 10],
  ["Lake Sturgeon", 20, 150, 5, 9, 10, 2, 11, 0],
  ["White Sturgeon", 30, 300, 5, 9, 10, 2, 11, 0],
  ["Longnose Gar", 2, 30, 2, 4, 6, 0, 2, 13],
  ["Alligator Gar", 30, 200, 5, 8, 10, 2, 13, 11],
  ["Bowfin", 2, 15, 3, 5, 7, 1, 2, 7],
  ["Freshwater Drum", 1, 30, 2, 5, 5, 2, 0, 2],
  ["Redfish", 3, 40, 3, 10, 7, 1, 8, 5],
  ["Spotted Seatrout", 1, 10, 2, 11, 5, 0, 8, 7],
  ["Snook", 2, 35, 3, 14, 8, 1, 9, 2],
  ["Tarpon", 20, 200, 5, 15, 10, 2, 2, 9],
  ["Florida Pompano", 1, 6, 3, 15, 5, 0, 3, 12],
  ["Sheepshead", 1, 15, 2, 9, 4, 0, 12, 1],
  ["Bluefish", 2, 20, 2, 7, 7, 1, 5, 9],
  ["Summer Flounder", 1, 15, 3, 14, 4, 0, 2, 8],
  ["Pacific Halibut", 20, 300, 5, 12, 10, 2, 12, 9],
  ["Atlantic Cod", 3, 60, 3, 8, 6, 2, 12, 3],
  ["Black Sea Bass", 1, 8, 2, 11, 4, 1, 12, 3],
  ["Cobia", 10, 80, 4, 11, 9, 2, 13, 9],
  ["Lingcod", 5, 50, 3, 10, 7, 2, 9, 12],
  ["Tautog", 2, 20, 3, 10, 6, 0, 12, 0],
  ["Red Snapper", 2, 30, 3, 12, 6, 2, 12, 2],
  ["Arctic Char", 1, 20, 4, 15, 6, 1, 4, 5],
  ["Lake Whitefish", 1, 12, 2, 9, 4, 2, 3, 2],
  ["Burbot", 1, 15, 3, 9, 5, 2, 11, 2],
  ["Sauger", 0.5, 8, 2, 12, 4, 1, 3, 2],
  ["Kokanee", 0.5, 4, 3, 13, 4, 1, 4, 10],
  ["Bull Trout", 2, 30, 4, 13, 7, 1, 5, 9],
  ["Pink Salmon", 2, 12, 2, 9, 6, 1, 4, 5],
  ["Chum Salmon", 5, 30, 3, 9, 8, 1, 4, 3],
  ["Yelloweye Rockfish", 2, 30, 4, 16, 5, 2, 12, 9],
  ["Goldeye", 0.3, 2, 2, 8, 3, 0, 10, 1],
  ["Inconnu", 5, 50, 4, 12, 8, 1, 9, 5],
  ["Atlantic Halibut", 20, 300, 5, 13, 10, 2, 12, 9],
  ["Haddock", 1, 15, 2, 8, 4, 2, 12, 3],
  ["Atlantic Mackerel", 0.5, 3, 1, 6, 4, 0, 5, 4]
];
var RW = [0, 10, 6, 3, 1.4, 0.5];

/* Scenes: name, region, mode(0 land,1 boat,2 either), deco, [fish ids]
   deco: 0 forest, 1 mountains, 2 swamp, 3 sea/pier, 4 snow peaks, 5 rocky coast, 6 farm */
var SC = [
  ["Farm Pond", "Midwest", 0, 6, [0, 1, 3, 8, 20, 21, 6]],
  ["Bow River", "Alberta", 0, 1, [22, 23, 61, 57, 65, 24, 26]],
  ["Ozark Lake", "Missouri", 2, 0, [0, 2, 4, 7, 8, 9, 10, 17, 13]],
  ["Cypress Swamp", "Georgia", 1, 2, [0, 2, 8, 16, 20, 39, 37, 17]],
  ["Louisiana Bayou", "Louisiana", 2, 2, [8, 17, 18, 21, 37, 38, 41, 40, 39]],
  ["Mississippi River", "Tennessee", 2, 0, [17, 18, 19, 21, 40, 13, 11, 35, 38]],
  ["Lake Erie", "Ohio", 2, 0, [13, 9, 6, 11, 40, 12, 22, 14]],
  ["Lake Michigan", "Michigan", 1, 0, [29, 30, 25, 23, 22, 6, 14, 13]],
  ["Lake Superior", "Minnesota", 1, 1, [25, 24, 29, 30, 14, 13, 35]],
  ["Lake of the Woods", "Ontario", 2, 0, [13, 59, 14, 15, 9, 57, 5, 6]],
  ["Gaspe Salmon River", "Quebec", 0, 0, [28, 24, 22, 23, 34]],
  ["Great Slave Lake", "N.W.T.", 1, 4, [25, 56, 57, 58, 66, 14, 33]],
  ["Everglades", "Florida", 1, 2, [8, 43, 44, 37, 41, 39, 0]],
  ["Florida Keys", "Florida", 1, 3, [44, 43, 45, 46, 41, 42, 55, 52]],
  ["Gulf Coast Pier", "Texas", 0, 3, [41, 42, 45, 46, 55, 47, 52]],
  ["Outer Banks Pier", "N Carolina", 0, 3, [47, 48, 41, 46, 51, 54, 45]],
  ["Bay of Fundy", "Nova Scotia", 2, 3, [12, 50, 68, 67, 69, 48, 51]],
  ["Cape Cod", "Mass.", 2, 5, [12, 47, 50, 51, 54, 48]],
  ["Maine Coast", "Maine", 1, 5, [50, 12, 54, 51, 28, 47, 69, 68]],
  ["Columbia River", "Oregon", 2, 0, [32, 29, 36, 35, 23, 9, 21]],
  ["Kenai River", "Alaska", 0, 4, [29, 31, 30, 62, 34, 22, 33, 49]],
  ["Bristol Bay", "Alaska", 2, 4, [31, 30, 62, 22, 34, 33, 49, 56]],
  ["Fraser River", "B.C.", 2, 1, [36, 29, 63, 30, 61, 22, 64, 53]],
  ["Colorado Lake", "Colorado", 2, 1, [22, 23, 26, 24, 27, 25, 60]],
  ["Yellowstone River", "Wyoming", 0, 1, [26, 23, 22, 24, 33, 34]]
];

var SKY = [[120, 190, 240], [235, 165, 115], [175, 160, 225], [28, 36, 85]];
var WATC = [[40, 120, 150], [30, 100, 175], [70, 95, 50], [20, 95, 165], [60, 145, 175], [45, 95, 135], [50, 125, 95]];

/* ==========================================================
   SAVE DATA
   ========================================================== */
var S = {
  coins: 0, maxLvl: 1, rod: 0, rodMax: 0, reel: 0, reelMax: 0, line: 0, lineMax: 0,
  sonar: 0, lure: 0, owned: [], rodUp: [], reelUp: [], rec: []
};
function resetSave() {
  S.coins = 0; S.maxLvl = 1; S.rod = 0; S.rodMax = 0; S.reel = 0; S.reelMax = 0;
  S.line = 0; S.lineMax = 0; S.sonar = 0; S.lure = 0;
  S.owned = []; S.rodUp = []; S.reelUp = []; S.rec = [];
  var i;
  for (i = 0; i < LURES.length; i++) { S.owned[i] = 0; }
  S.owned[0] = 1; S.owned[1] = 1;
  for (i = 0; i < RODS.length; i++) { S.rodUp[i] = 0; }
  for (i = 0; i < REELS.length; i++) { S.reelUp[i] = 0; }
  for (i = 0; i < FISH.length; i++) { S.rec[i] = 0; }
}
function saveGame() {
  var s = [S.coins, S.maxLvl, S.rod, S.rodMax, S.reel, S.reelMax, S.line, S.lineMax, S.sonar, S.lure].join(",") +
    "|" + S.owned.join("") + "|" + S.rodUp.join("") + "|" + S.reelUp.join("") + "|" + S.rec.join(",");
  var ok = false;
  try { storage.write({ fs: "sd", path: "/fishing_save.txt" }, s, "write"); ok = true; } catch (e1) {}
  if (!ok) {
    try { storage.write({ fs: "littlefs", path: "/fishing_save.txt" }, s, "write"); } catch (e2) {}
  }
}
function ci2(v, lo, hi, dflt) { v = parseInt(v, 10); return (v >= lo && v <= hi) ? v : dflt; }
function sanitizeSave() {
  var i;
  S.coins = ci2(S.coins, 0, 999999999, 0);
  S.maxLvl = ci2(S.maxLvl, 1, 100, 1);
  S.rod = ci2(S.rod, 0, RODS.length - 1, 0); S.rodMax = ci2(S.rodMax, 0, RODS.length - 1, 0);
  S.reel = ci2(S.reel, 0, REELS.length - 1, 0); S.reelMax = ci2(S.reelMax, 0, REELS.length - 1, 0);
  S.line = ci2(S.line, 0, LINES.length - 1, 0); S.lineMax = ci2(S.lineMax, 0, LINES.length - 1, 0);
  if (S.rodMax < S.rod) { S.rodMax = S.rod; }
  if (S.reelMax < S.reel) { S.reelMax = S.reel; }
  if (S.lineMax < S.line) { S.lineMax = S.line; }
  S.sonar = ci2(S.sonar, 0, 3, 0);
  S.lure = ci2(S.lure, 0, LURES.length - 1, 0);
  S.owned[0] = 1; S.owned[1] = 1;
  if (!S.owned[S.lure]) { S.lure = 0; }
  for (i = 0; i < RODS.length; i++) { S.rodUp[i] = ci2(S.rodUp[i], 0, 5, 0); }
  for (i = 0; i < REELS.length; i++) { S.reelUp[i] = ci2(S.reelUp[i], 0, 5, 0); }
  for (i = 0; i < FISH.length; i++) { S.rec[i] = ci2(S.rec[i], 0, 99999, 0); }
}
function loadGame() {
  var d = "";
  try { d = storage.read({ fs: "sd", path: "/fishing_save.txt" }); } catch (e1) { d = ""; }
  if (!d || String(d).indexOf("|") < 0) {
    try { d = storage.read({ fs: "littlefs", path: "/fishing_save.txt" }); } catch (e2) { d = ""; }
  }
  if (!d || String(d).indexOf("|") < 0) { return false; }
  try {
    var p = String(d).split("|");
    var a = p[0].split(",");
    var i;
    S.coins = parseInt(a[0], 10); S.maxLvl = parseInt(a[1], 10);
    S.rod = parseInt(a[2], 10); S.rodMax = parseInt(a[3], 10);
    S.reel = parseInt(a[4], 10); S.reelMax = parseInt(a[5], 10);
    S.line = parseInt(a[6], 10); S.lineMax = parseInt(a[7], 10);
    S.sonar = parseInt(a[8], 10); S.lure = parseInt(a[9], 10);
    for (i = 0; i < LURES.length; i++) { S.owned[i] = (p[1].charAt(i) == "1") ? 1 : 0; }
    for (i = 0; i < RODS.length; i++) { S.rodUp[i] = parseInt(p[2].charAt(i), 10) || 0; }
    for (i = 0; i < REELS.length; i++) { S.reelUp[i] = parseInt(p[3].charAt(i), 10) || 0; }
    var r = p[4].split(",");
    for (i = 0; i < FISH.length; i++) { S.rec[i] = parseInt(r[i], 10) || 0; }
    sanitizeSave();
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
      fr(0, 0, W, 22, rgb(20, 70, 120));
      txt(title, 6, 4, 2, WHITE);
      var top = idx - 2;
      if (top > n - VR) { top = n - VR; }
      if (top < 0) { top = 0; }
      for (var i = 0; i < VR && top + i < n; i++) {
        var y = 26 + i * 21;
        var sel = (top + i == idx);
        if (sel) { fr(2, y - 2, W - 4, 20, rgb(40, 110, 190)); }
        txt(items[top + i], 8, y, 2, sel ? WHITE : rgb(170, 190, 220));
      }
      if (n > VR) {
        var bh = Math.floor(126 * VR / n);
        var by = 26 + Math.floor(126 * top / n);
        fr(W - 4, by, 3, bh, GRAY);
      }
      fr(0, H - 14, W, 14, rgb(8, 14, 26));
      var hint = (hints && hints[idx]) ? hints[idx] : "Turn: move  SEL: ok  ESC: back";
      txt(hint, 4, H - 11, 1, rgb(255, 230, 120));
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

/* ==========================================================
   SHOP
   ========================================================== */
function rodStat(i) { return RODS[i][2] * (1 + 0.12 * S.rodUp[i]); }
function reelStat(i) { return REELS[i][2] * (1 + 0.08 * S.reelUp[i]); }

function shopLures() {
  var idx = 0;
  while (true) {
    var items = [], hints = [];
    for (var i = 0; i < LURES.length; i++) {
      var st = S.owned[i] ? (S.lure == i ? "[USING]" : "owned") : "$" + LURES[i][1];
      items.push(padR(LURES[i][0], 14) + st);
      hints.push(S.owned[i] ? "SEL: use this lure" : "SEL: buy  (you have $" + S.coins + ")");
    }
    var r = menu("LURES  $" + S.coins, items, idx, hints);
    if (r < 0) { return; }
    idx = r;
    if (S.owned[r]) { S.lure = r; flash("Using " + LURES[r][0], GREEN); }
    else if (S.coins >= LURES[r][1]) {
      S.coins -= LURES[r][1]; S.owned[r] = 1; S.lure = r;
      saveGame(); beep(1200, 80); flash("Bought " + LURES[r][0], GREEN);
    } else { flash("Not enough coins", RED); }
  }
}
function shopRods() {
  var idx = S.rod;
  while (true) {
    var items = [], hints = [];
    for (var i = 0; i < RODS.length; i++) {
      var own = (i <= S.rodMax);
      var st = own ? (S.rod == i ? "[USING]" : "owned") : "$" + RODS[i][1];
      items.push(padR(RODS[i][0], 16) + st);
      hints.push("Power " + Math.floor(rodStat(i)) + "lb  Hook time " + RODS[i][3] + "  Up +" + S.rodUp[i]);
    }
    var r = menu("RODS  $" + S.coins, items, idx, hints);
    if (r < 0) { return; }
    idx = r;
    if (r <= S.rodMax) { S.rod = r; flash("Using " + RODS[r][0], GREEN); }
    else if (S.coins >= RODS[r][1]) {
      S.coins -= RODS[r][1]; S.rodMax = r; S.rod = r;
      saveGame(); beep(1200, 80); flash("Bought " + RODS[r][0], GREEN);
    } else { flash("Not enough coins", RED); }
  }
}
function shopReels() {
  var idx = S.reel;
  while (true) {
    var items = [], hints = [];
    for (var i = 0; i < REELS.length; i++) {
      var own = (i <= S.reelMax);
      var st = own ? (S.reel == i ? "[USING]" : "owned") : "$" + REELS[i][1];
      items.push(padR(REELS[i][0], 16) + st);
      hints.push("Speed " + (Math.floor(reelStat(i) * 10) / 10) + "  Strain/click " + REELS[i][3] + "  Up +" + S.reelUp[i]);
    }
    var r = menu("REELS  $" + S.coins, items, idx, hints);
    if (r < 0) { return; }
    idx = r;
    if (r <= S.reelMax) { S.reel = r; flash("Using " + REELS[r][0], GREEN); }
    else if (S.coins >= REELS[r][1]) {
      S.coins -= REELS[r][1]; S.reelMax = r; S.reel = r;
      saveGame(); beep(1200, 80); flash("Bought " + REELS[r][0], GREEN);
    } else { flash("Not enough coins", RED); }
  }
}
function shopLines() {
  var idx = S.line;
  while (true) {
    var items = [], hints = [];
    for (var i = 0; i < LINES.length; i++) {
      var own = (i <= S.lineMax);
      var st = own ? (S.line == i ? "[USING]" : "owned") : "$" + LINES[i][1];
      items.push(padR(LINES[i][0], 16) + st);
      hints.push("Fish pull x" + LINES[i][2] + "  (lower is stronger)");
    }
    var r = menu("LINES  $" + S.coins, items, idx, hints);
    if (r < 0) { return; }
    idx = r;
    if (r <= S.lineMax) { S.line = r; flash("Using " + LINES[r][0], GREEN); }
    else if (S.coins >= LINES[r][1]) {
      S.coins -= LINES[r][1]; S.lineMax = r; S.line = r;
      saveGame(); beep(1200, 80); flash("Bought " + LINES[r][0], GREEN);
    } else { flash("Not enough coins", RED); }
  }
}
function shopSonar() {
  while (true) {
    var nxt = S.sonar + 1;
    var items = [];
    if (nxt <= 3) { items.push("Buy Fish Finder Lv" + nxt + " $" + SONAR_COST[nxt]); }
    else { items.push("Fish Finder MAX"); }
    var r = menu("FISH FINDER Lv" + S.sonar, items, 0,
      ["More rare + bigger fish. You have $" + S.coins]);
    if (r < 0) { return; }
    if (nxt <= 3) {
      if (S.coins >= SONAR_COST[nxt]) {
        S.coins -= SONAR_COST[nxt]; S.sonar = nxt; saveGame(); beep(1200, 80); flash("Fish Finder upgraded", GREEN);
      } else { flash("Not enough coins", RED); }
    }
  }
}
function shopUpgrade(isRod) {
  while (true) {
    var cur = isRod ? S.rod : S.reel;
    var up = isRod ? S.rodUp[cur] : S.reelUp[cur];
    var base = isRod ? RODS[cur][1] : REELS[cur][1];
    var name = isRod ? RODS[cur][0] : REELS[cur][0];
    var cost = Math.floor((base + 150) * 0.3 * (up + 1));
    var items = [];
    if (up < 5) { items.push("Upgrade +" + (up + 1) + "  $" + cost); } else { items.push("Fully upgraded +5"); }
    var r = menu(name + " +" + up, items, 0,
      [isRod ? "Each level: +12% rod power" : "Each level: +8% reel speed"]);
    if (r < 0) { return; }
    if (up < 5) {
      if (S.coins >= cost) {
        S.coins -= cost;
        if (isRod) { S.rodUp[cur] = up + 1; } else { S.reelUp[cur] = up + 1; }
        saveGame(); beep(1300, 80); flash("Upgraded!", GREEN);
      } else { flash("Not enough coins", RED); }
    }
  }
}
function shop() {
  var idx = 0;
  while (true) {
    var r = menu("TACKLE SHOP  $" + S.coins,
      ["Lures", "Rods", "Reels", "Lines", "Fish Finder", "Upgrade Rod", "Upgrade Reel"], idx,
      ["Bait, jigs and flies", "Buy and swap rods", "Buy and swap reels", "Stronger line", "Find rarer fish", "Boost current rod", "Boost current reel"]);
    if (r < 0) { return; }
    idx = r;
    if (r == 0) { shopLures(); }
    else if (r == 1) { shopRods(); }
    else if (r == 2) { shopReels(); }
    else if (r == 3) { shopLines(); }
    else if (r == 4) { shopSonar(); }
    else if (r == 5) { shopUpgrade(true); }
    else if (r == 6) { shopUpgrade(false); }
  }
}

function fishdex() {
  var idx = 0;
  while (true) {
    var items = [], got = 0;
    for (var i = 0; i < FISH.length; i++) {
      if (S.rec[i] > 0) { got++; items.push(padR(FISH[i][0], 17) + (S.rec[i] / 10) + "lb"); }
      else { items.push(padR("??? " + (i + 1), 17) + "--"); }
    }
    var r = menu("FISHDEX " + got + "/" + FISH.length, items, idx, ["Your record weight for each species"]);
    if (r < 0) { return; }
    idx = r;
  }
}
function gearScreen() {
  cls(DARK);
  fr(0, 0, W, 22, rgb(20, 70, 120));
  txt("MY GEAR", 6, 4, 2, WHITE);
  var got = 0, lu = 0, i;
  for (i = 0; i < FISH.length; i++) { if (S.rec[i] > 0) { got++; } }
  for (i = 0; i < LURES.length; i++) { if (S.owned[i]) { lu++; } }
  txt("Coins : $" + S.coins, 8, 30, 2, YEL);
  txt("Rod   : " + RODS[S.rod][0] + " +" + S.rodUp[S.rod], 8, 50, 1, WHITE);
  txt("Reel  : " + REELS[S.reel][0] + " +" + S.reelUp[S.reel], 8, 62, 1, WHITE);
  txt("Line  : " + LINES[S.line][0], 8, 74, 1, WHITE);
  txt("Finder: Lv" + S.sonar, 8, 86, 1, WHITE);
  txt("Lures : " + lu + "/" + LURES.length + " (using " + LURES[S.lure][0] + ")", 8, 98, 1, WHITE);
  txt("Fish  : " + got + "/" + FISH.length + " species", 8, 110, 1, WHITE);
  txt("Level : " + S.maxLvl + "/100 unlocked", 8, 122, 1, WHITE);
  txt("Press any key", 8, H - 14, 1, GRAY);
  waitKey();
}

/* ==========================================================
   FISHING SCENE DRAWING
   ========================================================== */
var G = {
  si: 0, lvl: 1, mode: 0, score: 0, goal: 0, casts: 0, caught: 0,
  tipX: 0, tipY: 0, fx: 0, fy: 0, bx: 100, bobY: 0, bobX: 100, lureY: 0,
  phase: "ready", tens: 0, distF: 1, power: 0, lastTipY: -999, banner: "", bannerCol: 0,
  fpx: 0, fpy: 0, fpr: 0, fcol: 0, run: false
};

/* ---- clip-aware background primitives ----
   The scene background is painted ONCE per phase. After that only the small
   boxes where the line / bobber / fish / rod moved are repainted, so the
   screen no longer flickers. */
var CX0 = 0, CY0 = 0, CX1 = W, CY1 = H;
var prevR = [];
var hudKey = "";

function bfr(x, y, w, h, c) {
  var x0 = Math.floor(x), y0 = Math.floor(y);
  var x1 = Math.floor(x + w), y1 = Math.floor(y + h);
  if (x0 < CX0) { x0 = CX0; } if (y0 < CY0) { y0 = CY0; }
  if (x1 > CX1) { x1 = CX1; } if (y1 > CY1) { y1 = CY1; }
  if (x1 <= x0 || y1 <= y0) { return; }
  display.drawFillRect(x0, y0, x1 - x0, y1 - y0, c);
}
function bci(x, y, r, c) {
  if (x + r < CX0 || x - r > CX1 || y + r < CY0 || y - r > CY1) { return; }
  x = Math.floor(x); y = Math.floor(y); r = Math.max(1, Math.floor(r));
  for (var dy = -r; dy <= r; dy++) {
    var dx = Math.floor(Math.sqrt(r * r - dy * dy));
    bfr(x - dx, y + dy, dx * 2 + 1, 1, c);
  }
}

function xStart(step, off) {
  var k = Math.floor((CX0 - 16 - off) / step);
  return off + (k < 0 ? 0 : k) * step;
}
function bedY(x) { return SURF + 36 + Math.floor((x / W) * (H - SURF - 54)); }

function mount(cx, hw, h, c, cap) {
  if (cx + hw < CX0 || cx - hw > CX1 || SURF < CY0 || SURF - h > CY1) { return; }
  for (var r = 0; r < h; r += 2) {
    var w = Math.floor(hw * (r + 2) / h);
    var col = (cap && r < h * 0.3) ? WHITE : c;
    bfr(cx - w, SURF - h + r, w * 2, 2, col);
  }
}

function bgSky() {
  var sk = SKY[G.si % 4];
  var skc = rgb(sk[0], sk[1], sk[2]);
  bfr(0, 14, W, SURF - 14, skc);
  var night = (G.si % 4 == 3);
  var cc = night ? rgb(60, 70, 120) : rgb(sk[0] + 70, sk[1] + 50, sk[2] + 20);
  if (night) {
    bci(265, 34, 9, rgb(240, 240, 200));
    bci(269, 31, 8, skc);
    for (var s = 0; s < 8; s++) { bfr((s * 53 + 17) % W, 18 + (s * 29) % 40, 1, 1, WHITE); }
  } else {
    bci(268, 34, 10, rgb(255, 235, 120));
  }
  bci(40, 36, 8, cc); bci(50, 33, 10, cc); bci(62, 37, 8, cc);
  bci(190, 50, 6, cc); bci(199, 47, 8, cc); bci(208, 51, 6, cc);
}

function bgDeco() {
  var d = SC[G.si][3], x;
  if (d == 0) {
    for (x = xStart(17, 0); x < Math.min(W + 10, CX1 + 16); x += 17) {
      var hgt = 10 + ((x * 13) % 9);
      bfr(x - 1, SURF - 8, 3, 8, rgb(70, 45, 25));
      bci(x, SURF - hgt - 2, 9, rgb(30, 110 + ((x * 7) % 40), 50));
    }
  } else if (d == 1) {
    mount(70, 64, 46, rgb(95, 110, 130), true);
    mount(160, 70, 52, rgb(80, 95, 120), true);
    mount(260, 62, 40, rgb(100, 115, 135), true);
    for (x = xStart(14, 0); x < Math.min(W + 10, CX1 + 16); x += 14) { bci(x, SURF - 4, 6, rgb(25, 90, 45)); }
  } else if (d == 2) {
    for (x = xStart(34, 6); x < Math.min(W, CX1 + 16); x += 34) {
      var hh = 28 + ((x * 11) % 14);
      bfr(x, SURF - hh, 5, hh, rgb(75, 60, 40));
      bci(x + 2, SURF - hh, 11, rgb(55, 85, 55));
      bfr(x - 7, SURF - hh + 6, 1, 14, rgb(150, 160, 120));
      bfr(x + 11, SURF - hh + 6, 1, 16, rgb(150, 160, 120));
    }
  } else if (d == 3) {
    bfr(256, SURF - 36, 10, 36, WHITE);
    bfr(256, SURF - 30, 10, 6, RED);
    bfr(255, SURF - 40, 12, 4, rgb(60, 60, 60));
    bci(310, SURF - 3, 14, rgb(60, 120, 70));
    bfr(0, SURF - 2, W, 2, rgb(240, 240, 255));
  } else if (d == 4) {
    mount(50, 70, 56, WHITE, true);
    mount(150, 80, 64, rgb(150, 170, 200), true);
    mount(270, 70, 50, WHITE, true);
    for (x = xStart(16, 0); x < Math.min(W + 10, CX1 + 16); x += 16) { bci(x, SURF - 3, 6, rgb(20, 80, 60)); }
  } else if (d == 5) {
    for (x = xStart(22, 180); x < Math.min(W + 16, CX1 + 16); x += 22) { bci(x, SURF - 4 - ((x * 5) % 12), 12, rgb(105, 105, 115)); }
    bfr(150, SURF - 30, 6, 30, WHITE); bfr(150, SURF - 20, 6, 5, RED);
  } else if (d == 6) {
    bfr(215, SURF - 30, 44, 30, rgb(170, 40, 35));
    bfr(210, SURF - 38, 54, 10, rgb(90, 50, 40));
    bfr(232, SURF - 16, 10, 16, rgb(240, 230, 210));
    for (x = xStart(22, 100); x < Math.min(W, CX1 + 16); x += 22) { bfr(x, SURF - 14, 3, 14, rgb(200, 180, 140)); }
    bfr(100, SURF - 11, W - 100, 2, rgb(200, 180, 140));
    bci(40, SURF - 12, 12, rgb(40, 130, 50));
  }
}

function bgWater() {
  var wc = WATC[SC[G.si][3]];
  var cols = 16, cw = Math.ceil(W / cols), i;
  for (i = Math.max(0, Math.floor(CX0 / cw) - 1); i <= Math.min(cols - 1, Math.floor(CX1 / cw) + 1); i++) {
    var sh = 1 - i * 0.032;
    bfr(i * cw, SURF, cw + 1, H - SURF, rgb(wc[0] * sh, wc[1] * sh, wc[2] * sh));
  }
  var rip = rgb(wc[0] + 70, wc[1] + 70, wc[2] + 70);
  for (i = 0; i < 6; i++) { bfr((i * 61 + 25) % (W - 10), SURF + 3 + (i % 3) * 3, 8, 1, rip); }
  bfr(0, SURF, W, 2, rgb(wc[0] + 90, wc[1] + 90, wc[2] + 90));
  var sand = rgb(wc[0] + 70, wc[1] + 30, wc[2] - 20);
  if (SC[G.si][3] == 2) { sand = rgb(70, 60, 40); }
  var x;
  for (x = (CX0 >> 3) << 3; x < Math.min(W, CX1 + 8); x += 8) {
    var by = bedY(x);
    bfr(x, by, 9, H - by, sand);
    if ((x * 7) % 5 == 0) { bfr(x + 2, by - 8, 1, 8, rgb(40, 130, 60)); }
  }
  var dk = rgb(wc[0] * 0.55, wc[1] * 0.55, wc[2] * 0.55);
  for (i = 0; i < 4; i++) {
    var fx = 150 + i * 42 + (i * 37) % 23;
    var fy = SURF + 56 + (i % 2) * 18 - (i >> 1) * 8;
    bfr(fx, fy, 8, 3, dk);
    bfr(fx + 8, fy - 1, 2, 5, dk);
  }
}

function placeAngler() {
  var d = SC[G.si][3];
  if (G.mode == 0) {
    G.fx = (d == 3 && SC[G.si][2] != 1) ? 40 : 28;
    G.fy = SURF - 7;
  } else { G.fx = 82; G.fy = SURF - 9; }
  G.tipX = G.fx + 28;
  G.tipY = G.fy - 40 + Math.floor(G.tens / 9);
}

function bgBank() {
  var d = SC[G.si][3];
  if (G.mode == 0) {
    if (d == 3 && SC[G.si][2] != 1) {
      bfr(0, SURF - 6, 120, 5, rgb(150, 105, 60));
      for (var p = 8; p < 120; p += 24) { bfr(p, SURF - 1, 4, 56, rgb(100, 70, 40)); }
    } else {
      bfr(0, SURF - 6, 56, H - SURF + 6, rgb(70, 130, 60));
      bfr(0, SURF + 6, 56, H - SURF, rgb(110, 85, 55));
      bfr(56, SURF + 10, 10, H - SURF, rgb(110, 85, 55));
      bfr(66, SURF + 24, 10, H - SURF, rgb(110, 85, 55));
    }
  } else {
    bfr(48, SURF - 8, 74, 6, rgb(130, 80, 40));
    bfr(54, SURF - 2, 62, 4, rgb(95, 55, 30));
    bfr(48, SURF - 12, 4, 4, rgb(130, 80, 40));
    bfr(118, SURF - 12, 4, 4, rgb(130, 80, 40));
  }
}

function drawAngler() {
  var x = G.fx, y = G.fy;
  fr(x - 4, y - 12, 3, 12, rgb(50, 60, 110));
  fr(x + 1, y - 12, 3, 12, rgb(50, 60, 110));
  fr(x - 5, y - 24, 10, 13, rgb(210, 60, 50));
  ci(x, y - 29, 5, rgb(235, 190, 150));
  fr(x - 6, y - 35, 12, 3, rgb(60, 50, 40));
  fr(x - 4, y - 38, 8, 4, rgb(60, 50, 40));
  var bx0 = x + 5, by0 = y - 18;
  var mx = (bx0 + G.tipX) / 2, my = (by0 + G.tipY) / 2 - 2 + Math.floor(G.tens / 14);
  ln(bx0, by0, mx, my, rgb(60, 40, 20));
  ln(bx0, by0 + 1, mx, my + 1, rgb(60, 40, 20));
  ln(mx, my, G.tipX, G.tipY, rgb(60, 40, 20));
  ci(bx0 - 1, by0 + 1, 3, GRAY);
}

function drawFishShape(x, y, r, col) {
  fr(x - r, y - r / 2, r * 2, r, col);
  ci(x - r, y, r / 2 + 1, col);
  ci(x + r, y, r / 2, col);
  ln(x + r + 2, y, x + r + 8, y - 5, col);
  ln(x + r + 2, y, x + r + 8, y + 5, col);
  ln(x + r + 8, y - 5, x + r + 8, y + 5, col);
  ci(x - r - 1, y - 1, 1, BLACK);
}

function fishColor(i) { return rgb(90 + ((i * 53) % 140), 90 + ((i * 97) % 140), 70 + ((i * 29) % 140)); }
function LURECOL(i) { return rgb(100 + ((i * 47) % 150), 80 + ((i * 83) % 170), 60 + ((i * 61) % 180)); }

function drawHUD() {
  var key = G.lvl + "|" + G.score + "|" + G.casts + "|" + S.lure + "|" + G.goal;
  if (key == hudKey) { return; }
  hudKey = key;
  fr(0, 0, W, 14, BLACK);
  txt("L" + G.lvl + " " + SC[G.si][0], 3, 3, 1, WHITE);
  txt("$" + G.score + "/" + G.goal, 176, 3, 1, G.score >= G.goal ? GREEN : YEL);
  txt("Casts " + G.casts, 232, 3, 1, CYAN);
  txt(LURES[S.lure][0], 282 - (LURES[S.lure][0].length > 6 ? 18 : 0), 3, 1, ORNG);
}

/* paint the whole scene once (phase start / after a popup) */
function sceneFull() {
  placeAngler();
  CX0 = 0; CY0 = 0; CX1 = W; CY1 = H;
  bgSky(); bgDeco(); bgWater(); bgBank();
  prevR = []; G.lastTipY = -999; hudKey = ""; dynKey = "";
  drawHUD();
  drawAngler();
}
/* repaint only a small box of background */
function restoreBG(r) {
  var x0 = Math.max(0, Math.floor(r[0])), y0 = Math.max(14, Math.floor(r[1]));
  var x1 = Math.min(W, Math.ceil(r[0] + r[2])), y1 = Math.min(H - 38, Math.ceil(r[1] + r[3]));
  if (x1 <= x0 || y1 <= y0) { return; }
  CX0 = x0; CY0 = y0; CX1 = x1; CY1 = y1;
  if (y0 < SURF) { bgSky(); bgDeco(); }
  if (y1 > SURF) { bgWater(); }
  if (x0 < 126) { bgBank(); }
  CX0 = 0; CY0 = 0; CX1 = W; CY1 = H;
}
function lineRects(x1, y1, x2, y2) {
  var out = [];
  var d = Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
  var n = Math.max(1, Math.min(8, Math.ceil(d / 36)));
  for (var i = 0; i < n; i++) {
    var ax = x1 + (x2 - x1) * i / n, ay = y1 + (y2 - y1) * i / n;
    var bx = x1 + (x2 - x1) * (i + 1) / n, by = y1 + (y2 - y1) * (i + 1) / n;
    out.push([Math.min(ax, bx) - 2, Math.min(ay, by) - 2, Math.abs(bx - ax) + 5, Math.abs(by - ay) + 5]);
  }
  return out;
}
function phaseRects() {
  var r = [];
  placeAngler();
  var rodKey = G.tipY + "|" + Math.floor(G.tens / 14);   /* tip height + bend */
  if (rodKey !== G.lastTipY) {
    r.push([G.fx, G.tipY - 8, G.tipX - G.fx + 8, (G.fy - 10) - (G.tipY - 8)]);
    G.lastTipY = rodKey;
  }
  if (G.phase == "fight") {
    r = r.concat(lineRects(G.tipX, G.tipY, G.fpx, G.fpy));
    r.push([G.fpx - 2 * G.fpr - 4, G.fpy - G.fpr - 16, 3 * G.fpr + 22, 2 * G.fpr + 24]);
  } else {
    r = r.concat(lineRects(G.tipX, G.tipY, G.bobX, G.bobY - 3));
    r.push([G.bobX - 6, G.bobY - 7, 13, 14]);
    if (G.phase == "wait" || G.phase == "bite") { r.push([G.bobX - 4, G.bobY, 9, G.lureY - G.bobY + 6]); }
  }
  if (G.banner != "") { r.push([56, 18, 210, 20]); }
  return r;
}
function drawDyn() {
  var p = G.phase;
  if (p == "fight") {
    ln(G.tipX, G.tipY, G.fpx, G.fpy, rgb(235, 235, 235));
    drawFishShape(G.fpx, G.fpy, G.fpr, G.fcol);
    if (G.run) { txt("RUN!", G.fpx - 12, G.fpy - G.fpr - 14, 1, RED); }
  } else {
    var bx = G.bobX, by = G.bobY;
    ln(G.tipX, G.tipY, bx, by - 3, rgb(235, 235, 235));
    if (p == "wait" || p == "bite") {
      ln(bx, by + 3, bx, G.lureY, rgb(210, 210, 210));
      ci(bx, G.lureY, 2, LURECOL(S.lure));
    }
    ci(bx, by, 3, WHITE);
    fr(bx - 2, by - 3, 4, 3, RED);
  }
  if (G.banner != "") { ctxt(G.banner, 20, 2, G.bannerCol); }
}
/* one animation frame: erase old + new boxes, redraw moving things */
var dynKey = "";
function dynFrame() {
  placeAngler();
  var key = G.phase + "|" + G.tipY + "|" + Math.floor(G.tens / 14) + "|" + G.bobX + "|" + G.bobY + "|" + G.lureY + "|" + G.fpx + "|" + G.fpy +
            "|" + G.fpr + "|" + G.run + "|" + G.banner + "|" + G.bannerCol;
  if (key == dynKey) { return; }          /* nothing moved: leave the screen alone */
  dynKey = key;
  var rects = phaseRects();
  var all = prevR.concat(rects);
  var seen = {};
  for (var i = 0; i < all.length; i++) {
    var rk = all[i].join(",");
    if (seen[rk]) { continue; }           /* same box already repainted this frame */
    seen[rk] = 1;
    restoreBG(all[i]);
  }
  drawAngler();
  drawDyn();
  prevR = rects;
}

/* ==========================================================
   FISH LOGIC
   ========================================================== */
function lureFit(si, lure) {
  var pool = SC[si][4], n = 0;
  for (var i = 0; i < pool.length; i++) {
    var f = FISH[pool[i]];
    if (f[7] == lure || f[8] == lure) { n++; }
  }
  return n;
}
function pickFish(zone, lure) {
  var pool = SC[G.si][4], tot = 0, w = [], i;
  for (i = 0; i < pool.length; i++) {
    var f = FISH[pool[i]];
    var v = RW[f[3]];
    var dz = Math.abs(f[6] - zone);
    v *= (dz == 0) ? 3 : ((dz == 1) ? 1 : 0.2);
    if (f[7] == lure) { v *= 3.2; } else if (f[8] == lure) { v *= 2.2; } else { v *= 0.45; }
    if (f[3] >= 3) { v *= (1 + 0.25 * S.sonar); }
    w[i] = v; tot += v;
  }
  var r = rnd() * tot;
  for (i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) { return pool[i]; } }
  return pool[pool.length - 1];
}
function rollWeight(f) {
  var e = 2.5 - G.lvl * 0.012 - S.sonar * 0.12;
  if (e < 1.1) { e = 1.1; }
  var w = f[1] + (f[2] - f[1]) * Math.pow(rnd(), e);
  w = Math.round(w * 10) / 10;
  if (w < 0.1) { w = 0.1; }
  return w;
}
function levelGoal(l) {
  var si = Math.floor((l - 1) / 4), sub = (l - 1) % 4;
  var pool = SC[si][4], s = 0;
  for (var i = 0; i < pool.length; i++) {
    var f = FISH[pool[i]];
    s += Math.sqrt(f[1] * f[2]) * f[4];
  }
  s /= pool.length;
  return Math.max(20, Math.floor(s * (1.3 + sub * 0.4 + l * 0.004)));
}

/* ---------- the fight ---------- */
var fbKey = "";
function fightPanel(name) {
  fr(0, H - 38, W, 38, BLACK);
  txt(name, 6, H - 36, 1, WHITE);
  txt("TENSION", 6, H - 24, 1, GRAY);
  rc(56, H - 25, 120, 9, WHITE);
  txt("DIST", 184, H - 24, 1, GRAY);
  rc(212, H - 25, 100, 9, WHITE);
  txt("Stamina", 6, H - 11, 1, GRAY);
  txt("Turn=reel  SEL=ease", 160, H - 11, 1, rgb(255, 230, 120));
  fbKey = "";
}
function fightBars(tens, f, stam) {
  var tw = Math.min(118, Math.floor(tens * 1.18));
  var dw = Math.floor(98 * f);
  var sw = Math.floor(stam * 0.9);
  var tc = tens < 55 ? GREEN : (tens < 80 ? YEL : RED);
  var key = tw + "|" + dw + "|" + sw + "|" + tc;
  if (key == fbKey) { return; }
  fbKey = key;
  fr(57, H - 24, tw, 7, tc);
  fr(57 + tw, H - 24, 118 - tw, 7, BLACK);
  fr(57 + 94, H - 24, 1, 7, RED);
  fr(213, H - 24, dw, 7, BLUE);
  fr(213 + dw, H - 24, 98 - dw, 7, BLACK);
  fr(56, H - 10, sw, 5, ORNG);
  fr(56 + sw, H - 10, 90 - sw, 5, BLACK);
}

function fight(fi, w) {
  var F = FISH[fi];
  var rodPow = rodStat(S.rod);
  var spd = reelStat(S.reel);
  var tpc = REELS[S.reel][3];
  var lineMul = LINES[S.line][2];
  var heavy = w / rodPow;
  if (!(heavy >= 0.25)) { heavy = 0.25; }
  if (heavy > 3) { heavy = 3; }
  var maxD = 28 + Math.sqrt(w) * 3;
  if (maxD > 80) { maxD = 80; }
  var dist = maxD * 0.9;
  var fb = (F[5] * 0.10 + 0.4) * (0.5 + heavy * 0.7) * (1 + G.lvl * 0.006) * lineMul;
  var tens = 28, stam = 100, surgeT = 0, slack = 0;
  var startX = G.bobX, lureY0 = G.lureY;
  var fr0 = 3 + Math.min(7, Math.floor(Math.sqrt(w) * 0.9));
  var nm = F[0] + " " + w + "lb";
  G.phase = "fight"; G.banner = ""; G.lastTipY = -999;
  G.fcol = fishColor(fi); G.fpr = fr0; G.fpx = startX; G.fpy = lureY0; G.run = false;
  fightPanel(nm);
  var tl = nowMs();
  while (true) {
    /* frame-rate independent physics: 1.0 == one 45ms frame */
    var dtf = 1;
    if (useNow) {
      var tn = nowMs();
      dtf = (tn - tl) / 45; tl = tn;
      if (!(dtf > 0.4)) { dtf = 0.4; }
      if (dtf > 2.2) { dtf = 2.2; }
    }
    var clicks = 0, ease = false;
    var cA = kNext(), cB = kPrev();
    if (cA || cB) { clicks = 1; }
    if (kSel()) { ease = true; }
    if (kEsc()) {
      if (confirmBox("Cut the line?")) { return "cut"; }
      sceneFull(); fightPanel(nm); dynFrame(); settleInput(); tl = nowMs();
    }

    var mul = 1;
    if (surgeT > 0) { surgeT -= dtf; mul = 3; }
    else if (rnd() < 0.03 * dtf) { surgeT = 8 + Math.floor(rnd() * 14); }
    var sf = 0.35 + 0.65 * stam / 100;
    var pull = fb * mul * sf * (0.6 + rnd() * 0.8);

    tens += (pull - 1.3) * dtf;
    dist += pull * 0.35 * dtf;
    if (clicks > 0) {
      tens += tpc * clicks;
      dist -= spd * clicks;
      stam -= (tens > 25 ? 1.4 : 0.5) * clicks;
      if (stam < 5) { stam = 5; }
    }
    if (ease) { tens -= 12; dist += 0.8; }
    if (!(tens >= 0)) { tens = 0; }
    if (!(dist > -1000)) { dist = maxD; }
    if (tens < 4) { slack += dtf; } else { slack = 0; }

    G.tens = tens;
    G.distF = dist / maxD;
    if (!(G.distF <= 1)) { G.distF = 1; }
    if (!(G.distF >= 0)) { G.distF = 0; }

    var f = G.distF;
    G.fpx = Math.floor(G.tipX + (startX - G.tipX) * f);
    var fy = SURF + 6 + (lureY0 - SURF - 6) * f + Math.sin(tick * 0.7) * (2 + F[5] * 0.4) * (mul > 1 ? 2 : 1);
    var lim = H - 38 - fr0 - 10;
    if (fy > lim) { fy = lim; }
    G.fpy = Math.floor(fy);
    G.run = (mul > 1);
    tick++;
    dynFrame();
    fightBars(tens, f, stam);

    if (tens >= 100) { G.tens = 0; beep(200, 250); return "snap"; }
    if (dist <= 0) { G.tens = 0; return "win"; }
    if (dist > maxD * 1.4) { G.tens = 0; return "gone"; }
    if (slack > 60) { G.tens = 0; return "slack"; }
    wait(18);
  }
}

/* ---------- popups ---------- */
function popup(lines, col) {
  fr(25, 40, W - 50, 96, BLACK);
  rc(25, 40, W - 50, 96, col);
  rc(26, 41, W - 52, 94, col);
  for (var i = 0; i < lines.length; i++) {
    ctxt(lines[i][0], 48 + i * 17, lines[i][1], lines[i][2]);
  }
  ctxt("SEL to continue", 122, 1, GRAY);
  waitKey();
}

/* ==========================================================
   ONE CAST
   returns false if player quit the level
   ========================================================== */
function readyStrip() {
  var fit = lureFit(G.si, S.lure);
  fr(0, H - 28, W, 28, BLACK);
  txt("Lure: " + LURES[S.lure][0] + "  (favoured by " + fit + " fish here)", 4, H - 26, 1, fit > 0 ? GREEN : GRAY);
  txt("Turn: change lure   SEL: cast   ESC: quit level", 4, H - 12, 1, rgb(255, 230, 120));
}
function meterColAt(ox, mx0, mw, b1, b2) {
  var u = (ox - mx0) / mw;
  return u < b1 ? rgb(60, 200, 90) : (u < b2 ? rgb(240, 200, 40) : rgb(230, 60, 50));
}
function drawMeter(mx0, mw, b1, b2) {
  fr(0, H - 28, W, 28, BLACK);
  fr(mx0, H - 22, mw * b1, 10, rgb(60, 200, 90));
  fr(mx0 + mw * b1, H - 22, mw * (b2 - b1), 10, rgb(240, 200, 40));
  if (b2 < 1) { fr(mx0 + mw * b2, H - 22, mw * (1 - b2), 10, rgb(230, 60, 50)); }
  rc(mx0 - 1, H - 23, mw + 2, 12, WHITE);
  txt("shallow", mx0 + 4, H - 10, 1, GRAY);
  txt("mid", mx0 + mw * (b1 + b2) / 2 - 8, H - 10, 1, GRAY);
  if (b2 < 1) { txt("deep", mx0 + mw * (b2 + 1) / 2 - 10, H - 10, 1, GRAY); }
}
function eraseNeedle(ox, mx0, mw, b1, b2) {
  fr(ox - 2, H - 25, 5, 14, BLACK);
  fr(ox - 2, H - 22, 5, 10, meterColAt(ox, mx0, mw, b1, b2));
  rc(mx0 - 1, H - 23, mw + 2, 12, WHITE);
}
function waitMsg(s, c) { fr(0, H - 14, W, 14, BLACK); txt(s, 4, H - 11, 1, c); }

function oneCast() {
  var k, p, i, zone = 0, eff = 0;
  var d = SC[G.si][3];
  var cap = 1.0;
  if (G.mode == 0 && !(d == 3)) { cap = 0.78; }
  var startX = (G.mode == 1) ? 140 : 75;
  var mx0 = 20, mw = W - 40;

  /* READY: choose lure (encoder = lure, SEL = cast) */
  G.phase = "ready"; G.tens = 0; G.banner = "";
  sceneFull();
  G.bobX = G.tipX + 8; G.bobY = SURF - 3; G.lureY = SURF;
  dynFrame();
  encOn(); lockEnc(ENC_GAP_MS);
  var dirty = true;
  while (true) {
    if (dirty) { readyStrip(); drawHUD(); dirty = false; }
    k = inpMenu();
    if (k == 1) { chooseLure(1); dirty = true; settleInput(); continue; }
    else if (k == 2) { chooseLure(-1); dirty = true; settleInput(); continue; }
    else if (k == 3) { settleInput(); break; }
    else if (k == 4) {
      if (confirmBox("Quit this level?")) { return false; }
      sceneFull(); dynFrame(); dirty = true; settleInput();
    }
    wait(55);
  }

  /* POWER: encoder fully off, only SEL / ESC */
  G.phase = "power";
  p = 0; var dir = 1; var ox = -100;
  var b1 = 0.38 / cap, b2 = 0.72 / cap;
  if (b1 > 1) { b1 = 1; } if (b2 > 1) { b2 = 1; }
  drawMeter(mx0, mw, b1, b2);
  encOff();
  var tl = nowMs();
  while (true) {
    var tn = nowMs();
    var dt = tn - tl; tl = tn;
    if (!(dt > 0)) { dt = 28; }
    if (dt > 80) { dt = 80; }
    p += dir * 0.0007 * dt;
    if (p >= 1) { p = 1; dir = -1; }
    if (p <= 0) { p = 0; dir = 1; }
    if (ox >= 0) { eraseNeedle(ox, mx0, mw, b1, b2); }
    ox = Math.floor(mx0 + mw * p);
    fr(ox - 1, H - 25, 3, 14, WHITE);
    if (kSel()) { break; }
    if (kEsc()) {
      if (confirmBox("Quit this level?")) { encOn(); return false; }
      sceneFull(); dynFrame(); drawMeter(mx0, mw, b1, b2); ox = -100; tl = nowMs();
    }
    drainEnc();
    wait(28);
  }
  encOn();
  eff = p * cap;
  zone = (eff < 0.38) ? 0 : ((eff < 0.72) ? 1 : 2);
  G.bx = startX + eff * (W - startX - 16);
  var sink = (zone == 0) ? 12 : ((zone == 1) ? 26 : 40);
  G.lureY = Math.min(SURF + sink, bedY(G.bx) - 8);
  G.casts--;
  drawHUD();
  fr(0, H - 28, W, 28, BLACK);
  beep(600, 40);

  /* CAST ANIMATION */
  G.phase = "cast";
  for (i = 0; i <= 12; i++) {
    var t = i / 12;
    G.bobX = G.tipX + (G.bx - G.tipX) * t;
    G.bobY = G.tipY + ((SURF - 3) - G.tipY) * t - Math.sin(Math.PI * t) * 34;
    dynFrame();
    wait(16);
  }

  /* WAIT FOR BITE: encoder off; SEL too early / ESC reel in */
  G.phase = "wait"; G.bobX = G.bx; G.bobY = SURF - 3;
  dynFrame();
  var junk = (rnd() < 0.07);
  var fi = junk ? -1 : pickFish(zone, S.lure);
  var matched = (fi >= 0 && (FISH[fi][7] == S.lure || FISH[fi][8] == S.lure));
  var biteMs = ri(35, 130) * 35;
  if (matched) { biteMs = Math.floor(biteMs * 0.6); }
  var tStart = nowMs(), lastNib = -1;
  encOff();
  while (true) {
    var te = nowMs() - tStart;
    var nib = (te > biteMs - 800);
    if (lastNib != (nib ? 1 : 0)) {
      lastNib = nib ? 1 : 0;
      waitMsg(nib ? "Something is nibbling... wait for it!" : "Waiting...  (ESC reel in)", nib ? YEL : GRAY);
    }
    var ny = SURF - 3 + (nib ? Math.floor(Math.abs(Math.sin(te / 45)) * 3) : 0);
    if (ny != G.bobY) { G.bobY = ny; dynFrame(); }
    if (kSel()) {
      if (te < biteMs) { encOn(); flash("Too early! Reeled in", GRAY); return true; }
    }
    if (kEsc()) { encOn(); return true; }
    drainEnc();
    if (te >= biteMs) { break; }
    wait(35);
  }

  /* BITE: set the hook (SEL only) */
  G.phase = "bite";
  var winMs = RODS[S.rod][3] * 30;
  var hooked = false, lastSt = -1;
  beep(1800, 90);
  waitMsg("Set the hook NOW!", RED);
  encOff();
  var tb = nowMs();
  while (true) {
    var el = nowMs() - tb;
    if (el >= winMs) { break; }
    var fl = Math.floor(el / 120) % 2, jt = Math.floor(el / 70) % 2;
    var st = fl * 2 + jt;
    if (st != lastSt) {
      lastSt = st;
      G.bobY = SURF + 2 + jt * 3;
      G.banner = "BITE!  Press SEL!";
      G.bannerCol = fl ? WHITE : RED;
      dynFrame();
    }
    if (kSel()) { hooked = true; break; }
    drainEnc();
    wait(20);
  }
  encOn();
  G.banner = "";
  dynFrame();
  if (!hooked) { flash("It got away...", GRAY); return true; }

  if (junk) {
    var jn = ["Old Boot", "Tin Can", "Seaweed", "Driftwood"];
    var jv = ri(1, 3);
    S.coins += jv; G.score += jv;
    G.phase = "ready";
    popup([["Reeled in junk!", 2, GRAY], [jn[ri(0, 3)], 2, WHITE], ["Sold for $" + jv, 1, YEL]], GRAY);
    return true;
  }

  /* FIGHT: encoder reels (a little faster gap than menus) */
  var w = rollWeight(FISH[fi]);
  G.fishW = w; G.fishI = fi;
  ENC_GAP_MS = FIGHT_GAP; ENC_REV_MS = FIGHT_REV;
  encOn();
  var res = fight(fi, w);
  ENC_GAP_MS = MENU_GAP; ENC_REV_MS = MENU_REV;
  encOn();
  G.phase = "ready"; G.tens = 0;
  if (res == "win") {
    var val = Math.max(1, Math.round(w * FISH[fi][4]));
    var rec = Math.round(w * 10);
    var isNew = (S.rec[fi] == 0);
    var isBig = (rec > S.rec[fi] && S.rec[fi] > 0);
    if (rec > S.rec[fi]) { S.rec[fi] = rec; }
    S.coins += val; G.score += val; G.caught++;
    beep(1700, 70); beep(2100, 90);
    var ls = [[FISH[fi][0], 2, GREEN], [w + " lb   $" + val, 2, YEL]];
    if (isNew) { ls.push(["NEW SPECIES!", 2, CYAN]); }
    else if (isBig) { ls.push(["NEW PERSONAL BEST!", 1, CYAN]); }
    popup(ls, GREEN);
  } else if (res == "snap") { popup([["LINE SNAPPED!", 2, RED], ["Too much strain", 1, WHITE]], RED); }
  else if (res == "slack") { popup([["Hook came loose", 2, ORNG], ["Keep the line tight", 1, WHITE]], ORNG); }
  else if (res == "gone") { popup([["It swam away", 2, ORNG]], ORNG); }
  else { flash("Line cut", GRAY); }
  return true;
}

function chooseLure(dir) {
  var i = S.lure;
  for (var k = 0; k < LURES.length; k++) {
    i = (i + dir + LURES.length) % LURES.length;
    if (S.owned[i]) { S.lure = i; return; }
  }
}

/* ==========================================================
   PLAY A LEVEL
   ========================================================== */
function playLevel(lvl) {
  var si = Math.floor((lvl - 1) / 4);
  var sc = SC[si];
  var mode = sc[2];
  if (mode == 2) {
    var c = menu("L" + lvl + " " + sc[0], ["Fish from the shore", "Fish from a boat"], 0,
      ["Land: short casts, harder to reach deep fish", "Boat: full casting range, deep fish"]);
    if (c < 0) { return; }
    mode = c;
  }
  G.si = si; G.lvl = lvl; G.mode = mode; G.score = 0; G.caught = 0;
  G.goal = levelGoal(lvl); G.casts = 12; G.tens = 0; G.phase = "ready";
  /* intro card */
  cls(DARK);
  fr(0, 0, W, 24, rgb(20, 70, 120));
  txt("LEVEL " + lvl, 6, 4, 2, WHITE);
  ctxt(sc[0], 36, 2, YEL);
  ctxt(sc[1] + "  -  " + (mode == 1 ? "BOAT" : "LAND"), 58, 1, CYAN);
  ctxt("Goal: earn $" + G.goal + " in 12 casts", 76, 1, WHITE);
  var names = "";
  for (var i = 0; i < sc[4].length && i < 5; i++) { names += FISH[sc[4][i]][0] + (i < 4 && i < sc[4].length - 1 ? ", " : ""); }
  ctxt("Fish: " + names.substring(0, 44), 94, 1, GRAY);
  ctxt("Turn = reel, SEL = ease line", 112, 1, rgb(255, 230, 120));
  ctxt("Keep tension in the green!", 124, 1, rgb(255, 230, 120));
  ctxt("Press SEL to start", H - 16, 1, WHITE);
  if (waitKey() == 4) { return; }

  while (G.casts > 0) {
    if (!oneCast()) { saveGame(); return; }
  }

  /* summary */
  var ratio = G.score / G.goal;
  var stars = ratio >= 2.4 ? 3 : (ratio >= 1.6 ? 2 : (ratio >= 1 ? 1 : 0));
  cls(DARK);
  fr(0, 0, W, 24, rgb(20, 70, 120));
  txt("LEVEL " + lvl + (stars > 0 ? " COMPLETE" : " FAILED"), 6, 4, 2, stars > 0 ? GREEN : RED);
  ctxt("Fish caught: " + G.caught, 36, 2, WHITE);
  ctxt("Earned $" + G.score + " / goal $" + G.goal, 58, 1, YEL);
  var st = "";
  for (var s = 0; s < 3; s++) { st += (s < stars ? "*" : "-") + " "; }
  ctxt(st, 76, 3, YEL);
  if (stars > 0) {
    var bonus = Math.floor(G.goal * 0.3) + lvl * 5;
    S.coins += bonus;
    ctxt("Bonus +$" + bonus, 106, 2, GREEN);
    if (lvl == S.maxLvl && lvl < 100) { S.maxLvl = lvl + 1; ctxt("Level " + S.maxLvl + " unlocked!", 128, 1, CYAN); }
    if (lvl == 100) { ctxt("MASTER ANGLER OF NORTH AMERICA!", 128, 1, CYAN); }
    beep(1500, 80); beep(1900, 80); beep(2300, 120);
  } else {
    ctxt("Visit the shop and try again", 110, 1, GRAY);
  }
  ctxt("Press SEL", H - 14, 1, WHITE);
  saveGame();
  waitKey();
}

function levelSelect() {
  var l = S.maxLvl;
  var dirty = true;
  drainEnc(); lockEnc(ENC_GAP_MS);
  while (true) {
    if (dirty) {
      var si = Math.floor((l - 1) / 4);
      cls(DARK);
      fr(0, 0, W, 24, rgb(20, 70, 120));
      txt("SELECT LEVEL", 6, 4, 2, WHITE);
      ctxt("Level " + l + " / " + S.maxLvl + " unlocked", 36, 2, YEL);
      ctxt(SC[si][0] + " (" + SC[si][1] + ")", 62, 2, WHITE);
      var m = SC[si][2];
      ctxt(m == 0 ? "Shore fishing" : (m == 1 ? "Boat fishing" : "Shore or boat"), 86, 1, CYAN);
      ctxt("Goal $" + levelGoal(l) + "   Scene " + (si + 1) + "/25", 102, 1, GRAY);
      ctxt("Turn: change   SEL: play   ESC: back", H - 14, 1, rgb(255, 230, 120));
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
   TITLE + MAIN
   ========================================================== */
function title() {
  var t = 0, i;
  var WC = rgb(20, 90, 150);
  cls(rgb(15, 60, 110));
  fr(0, 95, W, H - 95, WC);
  ctxt("TIGHT LINES", 16, 3, WHITE);
  ctxt("by da cbm", 42, 1, ORNG);
  ctxt("US & Canadian Fishing", 56, 1, CYAN);
  ctxt("25 water bodies - 100 levels - " + FISH.length + " fish species", 72, 1, YEL);
  var prev = [], on = -1;
  for (i = 0; i < 8; i++) { prev[i] = null; }
  drainEnc(); lockEnc(ENC_GAP_MS);
  while (true) {
    t++;
    for (i = 0; i < 8; i++) { if (prev[i]) { fr(prev[i][0], prev[i][1], prev[i][2], prev[i][3], WC); } }
    for (i = 0; i < 8; i++) {
      var x = ((t * (1 + i % 3) + i * 47) % (W + 40)) - 20;
      var r = 5 + (i % 3) * 2;
      var y = 108 + (i % 4) * 10 + Math.floor(Math.sin((t + i * 9) / 8) * 3);
      drawFishShape(x, y, r, fishColor(i * 5));
      var rx = Math.max(0, x - r * 2 - 4), ry = Math.max(95, y - r - 8);
      prev[i] = [rx, ry, r * 3 + 22, r * 2 + 18];
    }
    var want = ((t >> 3) % 2 == 0) ? 1 : 0;
    if (want != on) {
      on = want;
      fr(0, H - 16, W, 16, rgb(15, 60, 110));
      if (on) { ctxt("Press SEL to start", H - 14, 1, WHITE); }
    }
    if (kSel()) { settleInput(); return; }
    drainEnc();
    wait(50);
  }
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
    G.banner = ""; G.phase = "ready"; G.tens = 0;
    try { encOn(); } catch (e1) {}
    try { saveGame(); } catch (e2) {}
    errScreen((e && e.message) ? e.message : String(e));
  }
}

function runGame() {
  resetSave();
  var had = loadGame();
  title();
  if (had) { flash("Save loaded", GREEN); }
  var idx = 0;
  while (true) {
    var r = menu("TIGHT LINES  $" + S.coins,
      ["Play Level " + S.maxLvl, "Level Select", "Tackle Shop", "My Gear", "Fishdex", "Save & Exit"], idx,
      ["Go fishing!", "Replay any unlocked level", "Buy lures, rods, reels, line", "Check your equipment", "Your catch records", "Save progress and quit"]);
    if (r < 0) { r = 5; }
    idx = r;
    if (r == 0) { safePlay(S.maxLvl); }
    else if (r == 1) { levelSelect(); }
    else if (r == 2) { shop(); }
    else if (r == 3) { gearScreen(); }
    else if (r == 4) { fishdex(); }
    else if (r == 5) {
      if (confirmBox("Save and exit?")) { saveGame(); cls(BLACK); ctxt("Tight lines! Progress saved.", 80, 1, WHITE); wait(600); return; }
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
