/* ============================================================
   WHEEL OF MISFORTUNE  -  by da cbm
   Bruce firmware  |  LilyGO T-Embed CC1101 (320x170)  ES5
   ----------------------------------------------------------
   Built on the Price Is Wrong engine: same hardened encoder
   debounce, in-place redraws (no flicker), small character
   sprites, proper ESC / pause / exit / sound settings.
   Turn knob = move / pick        SEL = confirm
   ESC = back / pause / exit

   MULTI-PLAYER: You + CPU1 + CPU2  (turn-based, shared board)
   3 regular rounds, then bonus round (RSTLNE free) for human
   No lives / no "three strikes" - play until solved each round
   ============================================================ */

var display  = require("display");
var keyboard = require("keyboard");

var W = (typeof display.width  === "function") ? display.width()  : 320;
var H = (typeof display.height === "function") ? display.height() : 170;

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
var HAS_CIRC = (typeof display.drawFillCircle === "function");
var HAS_STR  = (typeof display.drawString === "function");
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

/* Colours */
var BLACK = rgb(0, 0, 0), WHITE = rgb(255, 255, 255), RED = rgb(230, 50, 40),
    GREEN = rgb(60, 210, 80), YEL = rgb(250, 220, 40), BLUE = rgb(60, 140, 255),
    GRAY = rgb(130, 130, 140), DARK = rgb(8, 18, 34), ORNG = rgb(250, 150, 30),
    CYAN = rgb(80, 220, 230), CREAM = rgb(250, 245, 225),
    HDR = rgb(25, 95, 150), GOLD = rgb(255, 210, 40), PURPLE = rgb(120, 40, 160),
    VIOLET = rgb(200, 80, 255),
    STAGE = rgb(40, 20, 80), CURTAIN = rgb(160, 20, 40), FLOOR = rgb(70, 50, 90);

/* ---------- input (hardened) ---------- */
var MENU_GAP = 70, MENU_REV = 120, LET_GAP = 48, LET_REV = 100;
var ENC_GAP_MS = MENU_GAP, ENC_REV_MS = MENU_REV;
var SEL_HOLD_MS = 200, ESC_HOLD_MS = 260;
var lastDir = 0, lastEncMs = -100000, lastSelMs = -100000, lastEscMs = -100000;
var selDown = false, escDown = false;

function drainEnc() {
  var n = 0;
  try { while (keyboard.getNextPress() && n < 12) { n++; } } catch (e1) {}
  n = 0;
  try { while (keyboard.getPrevPress() && n < 12) { n++; } } catch (e2) {}
}
function encAccept(d) {
  var t = nowMs(), dt = t - lastEncMs;
  if (lastDir == d) { if (dt < ENC_GAP_MS) { return false; } }
  else if (lastDir != 0 && dt < ENC_REV_MS) { return false; }
  lastDir = d; lastEncMs = t;
  return true;
}
function kSel() {
  var down = false;
  try { down = !!keyboard.getSelPress(); } catch (e) { return false; }
  var t = nowMs();
  if (down) {
    if (selDown || t - lastSelMs < SEL_HOLD_MS) { return false; }
    selDown = true; lastSelMs = t;
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
function settleInput() {
  drainEnc();
  wait(30);
  drainEnc();
  lastDir = 0;
}
function waitKey() {
  drainEnc();
  while (true) {
    var k = inp();
    if (k == 3 || k == 4) { drainEnc(); return k; }
    wait(25);
  }
}

/* ---------- simple menu ---------- */
function menu(title, items, idx, hints) {
  var n = items.length;
  if (idx < 0 || idx >= n) { idx = 0; }
  var full = true, rows = false;
  var VR = 6, top = 0, i, y, sel, bh, by2, hint, k;
  ENC_GAP_MS = MENU_GAP; ENC_REV_MS = MENU_REV;
  drainEnc();
  while (true) {
    if (full) {
      cls(DARK);
      fr(0, 0, W, 22, HDR);
      txt(title, 6, 4, 2, WHITE);
      full = false; rows = true;
    }
    if (rows) {
      top = idx - 2;
      if (top > n - VR) { top = n - VR; }
      if (top < 0) { top = 0; }
      for (i = 0; i < VR; i++) {
        y = 26 + i * 21;
        if (top + i < n) {
          sel = (top + i == idx);
          fr(2, y - 2, W - 8, 20, sel ? rgb(40, 120, 190) : DARK);
          txt(items[top + i], 8, y, 2, sel ? WHITE : rgb(170, 210, 240));
        } else {
          fr(2, y - 2, W - 8, 20, DARK);
        }
      }
      fr(W - 5, 24, 5, 128, DARK);
      if (n > VR) {
        bh = Math.floor(126 * VR / n);
        by2 = 26 + Math.floor(126 * top / n);
        fr(W - 4, by2, 3, bh, GRAY);
      }
      fr(0, H - 14, W, 14, rgb(6, 12, 24));
      hint = (hints && hints[idx]) ? hints[idx] : "Turn: move  SEL: ok  ESC: back";
      txt(hint, 4, H - 11, 1, YEL);
      rows = false;
    }
    k = inp();
    if (k == 1) { idx = (idx + 1) % n; rows = true; continue; }
    else if (k == 2) { idx = (idx + n - 1) % n; rows = true; continue; }
    else if (k == 3) { settleInput(); return idx; }
    else if (k == 4) { settleInput(); return -1; }
    wait(12);
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
function foot(msg) {
  fr(0, H - 14, W, 14, rgb(6, 12, 24));
  txt(msg, 6, H - 11, 1, YEL);
}

/* ---------- small characters ---------- */
function mkPal(sh, pa, sk, hat, shoe, kind) {
  return [rgb(sh[0], sh[1], sh[2]), rgb(pa[0], pa[1], pa[2]), rgb(sk[0], sk[1], sk[2]),
    hat ? rgb(hat[0], hat[1], hat[2]) : -1, rgb(shoe[0], shoe[1], shoe[2]), kind];
}
var PHST = mkPal([140, 40, 180], [40, 30, 70], [235, 185, 140], [30, 20, 50], [20, 20, 30], 0);
var PCT  = mkPal([40, 160, 220], [30, 50, 90], [235, 185, 140], null, [40, 40, 50], 0);
var PCPU1 = mkPal([220, 80, 40], [50, 30, 20], [235, 185, 140], [80, 40, 20], [30, 20, 10], 0);
var PCPU2 = mkPal([40, 180, 100], [20, 50, 40], [235, 185, 140], [20, 60, 40], [20, 30, 20], 0);
function head(cx, cy, c) {
  fr(cx - 3, cy - 7, 7, 1, c); fr(cx - 5, cy - 6, 11, 1, c); fr(cx - 6, cy - 5, 13, 1, c);
  fr(cx - 7, cy - 4, 15, 9, c); fr(cx - 6, cy + 5, 13, 1, c); fr(cx - 5, cy + 6, 11, 1, c); fr(cx - 3, cy + 7, 7, 1, c);
}
function manBody(x, fy, f, wk, P) {
  var bob = (wk & 1) ? 1 : 0, sh = rgb(18, 18, 24), dk = rgb(10, 10, 14), hx;
  fr(x - 11, fy - 1, 22, 3, sh); fr(x - 8, fy - 2, 16, 1, sh);
  fr(x - 8, fy - 32 - bob, 16, 18, P[0]); fr(x - 8, fy - 16 - bob, 16, 3, dk);
  head(x, fy - 39 - bob, P[2]);
  hx = (f > 0) ? x + 3 : x - 5;
  fr(hx, fy - 41 - bob, 2, 2, dk); fr(hx + 2 * f, fy - 36 - bob, 3, 1, dk);
  if (P[3] >= 0) {
    fr(x - 8, fy - 48 - bob, 16, 6, P[3]);
    fr(f > 0 ? x + 2 : x - 14, fy - 43 - bob, 12, 2, P[3]);
  } else { fr(x - 7, fy - 47 - bob, 14, 4, dk); }
}
function manLimbs(x, fy, f, wk, P) {
  var sw = (wk == 1) ? 1 : ((wk == 3) ? -1 : 0), bob = (wk & 1) ? 1 : 0, l1, l2, ax1, ax2;
  l1 = x - 7 + sw * 4 * f; l2 = x + 1 - sw * 4 * f;
  fr(l1, fy - 14, 6, 10, P[1]); fr(l2, fy - 14, 6, 10, P[1]);
  fr(f > 0 ? l1 : l1 - 3, fy - 4, 9, 4, P[4]); fr(f > 0 ? l2 : l2 - 3, fy - 4, 9, 4, P[4]);
  ax1 = x - 12 - sw * 2 * f; ax2 = x + 8 + sw * 2 * f;
  fr(ax1, fy - 31 - bob, 4, 13, P[0]); fr(ax1, fy - 19 - bob, 4, 3, P[2]);
  fr(ax2, fy - 31 - bob, 4, 13, P[0]); fr(ax2, fy - 19 - bob, 4, 3, P[2]);
}
function man(x, fy, f, wk, P) {
  x = Math.floor(x);
  manBody(x, fy, f, wk, P);
  manLimbs(x, fy, f, wk, P);
}
function audience(x, y) {
  var c = rgb(20, 20, 40);
  ci(x, y, 4, c);
  fr(x - 6, y + 3, 12, 8, c);
}

/* ---------- trig tables ---------- */
var COS = [], SIN = [];
function mySin(x) {
  var tp = 6.283185307;
  x = x - tp * Math.floor(x / tp + 0.5);
  var x2 = x * x;
  return x * (1 - x2 / 6 * (1 - x2 / 20 * (1 - x2 / 42 * (1 - x2 / 72 * (1 - x2 / 110)))));
}
function buildTrig() {
  var i, a;
  for (i = 0; i < 360; i++) {
    a = i * 0.017453293;
    SIN.push(mySin(a));
    COS.push(mySin(a + 1.570796327));
  }
}

/* ---------- the wheel: 24 wedges ---------- */
var NW = 24;
var WEDGES = [
  [0, 500], [1, 0], [0, 300], [0, 700], [2, 0], [0, 400],
  [0, 900], [3, 1500], [0, 350], [4, 0], [0, 600], [1, 0],
  [0, 250], [0, 800], [2, 0], [0, 450], [0, 1000], [4, 0],
  [0, 200], [0, 550], [1, 0], [0, 650], [2, 0], [0, 750]
];
var WCOL = [], WOUT = [];
function buildWedgeColors() {
  var i, t, v;
  for (i = 0; i < NW; i++) {
    t = WEDGES[i][0]; v = WEDGES[i][1];
    if (t === 0) {
      WCOL.push(v < 400 ? BLUE : (v < 700 ? GREEN : ORNG));
      WOUT.push(WHITE);
    } else if (t === 1) { WCOL.push(BLACK); WOUT.push(RED); }
    else if (t === 2)   { WCOL.push(VIOLET); WOUT.push(WHITE); }
    else if (t === 3)   { WCOL.push(GOLD); WOUT.push(WHITE); }
    else                { WCOL.push(rgb(210, 210, 220)); WOUT.push(RED); }
  }
}

function ringDraw(cx, cy, R, br, pos, px, py, outline) {
  var i, a, x, y;
  for (i = 0; i < NW; i++) {
    if (px[i] > -900) { ci(px[i], py[i], br + 1, STAGE); }
  }
  for (i = 0; i < NW; i++) {
    a = ((Math.round((i - pos) * 15) + 270) % 360 + 360) % 360;
    x = Math.round(cx + COS[a] * R);
    y = Math.round(cy + SIN[a] * R);
    px[i] = x; py[i] = y;
    if (outline) { ci(x, y, br, WOUT[i]); ci(x, y, br - 2, WCOL[i]); }
    else { ci(x, y, br, WCOL[i]); }
  }
}
function drawPointer(cx, ty, n) {
  var j;
  for (j = 0; j < n; j++) {
    fr(cx - (n - 1 - j), ty + j, (n - 1 - j) * 2 + 1, 1, GOLD);
  }
}

/* ---------- puzzles ---------- */
var PUZZLES = [
  ["BAD LUCK", "BLACK CAT"],
  ["BAD LUCK", "BROKEN MIRROR"],
  ["BAD LUCK", "FRIDAY THE THIRTEENTH"],
  ["BAD LUCK", "WALKING UNDER A LADDER"],
  ["BAD LUCK", "SPILLED SALT"],
  ["BAD LUCK", "BAD LUCK STREAK"],
  ["BAD DAY", "FLAT TIRE"],
  ["BAD DAY", "SPILLED COFFEE"],
  ["BAD DAY", "LOST KEYS"],
  ["BAD DAY", "DEAD PHONE BATTERY"],
  ["BAD DAY", "STUBBED TOE"],
  ["BAD DAY", "WET SOCKS"],
  ["BAD DAY", "SLOW INTERNET"],
  ["PHRASE", "WHEN IT RAINS IT POURS"],
  ["PHRASE", "OUT OF LUCK"],
  ["PHRASE", "BACK TO SQUARE ONE"],
  ["PHRASE", "CURSE OF THE MUMMY"],
  ["PHRASE", "SINKING SHIP"],
  ["PHRASE", "DOWN THE DRAIN"],
  ["PHRASE", "CRASH AND BURN"],
  ["PHRASE", "MURPHYS LAW"],
  ["PHRASE", "OH NO NOT AGAIN"],
  ["PLACE", "HAUNTED HOUSE"],
  ["PLACE", "BERMUDA TRIANGLE"],
  ["PLACE", "DEAD END STREET"],
  ["PLACE", "ABANDONED MINE"],
  ["PLACE", "SPOOKY GRAVEYARD"],
  ["FOOD", "BURNT TOAST"],
  ["FOOD", "SOGGY CEREAL"],
  ["FOOD", "SOUR GRAPES"],
  ["FOOD", "MOLDY CHEESE"],
  ["FOOD", "COLD PIZZA"],
  ["THING", "BROKEN UMBRELLA"],
  ["THING", "LEAKY BOAT"],
  ["THING", "CURSED CROWN"],
  ["THING", "RUSTY BUCKET"]
];
/* Bonus-round friendly puzzles (a bit longer / classic style) */
var BONUS_PUZZLES = [
  ["PHRASE", "BETTER LATE THAN NEVER"],
  ["PHRASE", "EVERY CLOUD HAS A SILVER LINING"],
  ["PHRASE", "THE EARLY BIRD CATCHES THE WORM"],
  ["PHRASE", "A BLESSING IN DISGUISE"],
  ["PLACE", "THE TWILIGHT ZONE"],
  ["THING", "A ROLL OF THE DICE"],
  ["PHRASE", "LUCK OF THE DRAW"],
  ["PHRASE", "AGAINST ALL ODDS"]
];
var LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
/* common letter order for AI */
var AI_CONS = [19, 13, 17, 18, 11, 3, 2, 12, 15, 6, 1, 5, 21, 22, 24, 10, 7, 9, 16, 23, 25, 14, 20, 4, 8, 0];
var AI_VOW  = [0, 4, 8, 14, 20];
/* free letters for bonus round (R S T L N E) */
var BONUS_FREE = [17, 18, 19, 11, 13, 4]; /* R S T L N E */

function isV(i) { return (i === 0 || i === 4 || i === 8 || i === 14 || i === 20); }
function letterIndex(ch) {
  var i;
  for (i = 0; i < 26; i++) { if (LETTERS.substring(i, i + 1) === ch) { return i; } }
  return -1;
}
function wrapPhrase(str) {
  var words = [], cur = "", i, ch, ls = [], line = "";
  for (i = 0; i < str.length; i++) {
    ch = str.substring(i, i + 1);
    if (ch === " ") { if (cur.length > 0) { words.push(cur); cur = ""; } }
    else { cur += ch; }
  }
  if (cur.length > 0) { words.push(cur); }
  for (i = 0; i < words.length; i++) {
    if (line.length === 0) { line = words[i]; }
    else if (line.length + 1 + words[i].length <= 10) { line += " " + words[i]; }
    else { ls.push(line); line = words[i]; }
  }
  if (line.length > 0) { ls.push(line); }
  return ls;
}

/* ---------- game vars / multi-player ---------- */
var STATE_MENU = 0, STATE_BOARD = 1, STATE_GAMEOVER = 2, STATE_HOWTO = 3, STATE_BONUS = 4;
var state = STATE_MENU;
var bestScore = 0;
var menuSel = 0, actSel = 0, hostWk = 0, contWk = 0, LEAVE = false, survived = false;
var curPuz = 0, cells = [], guessed = [], allShown = false, yOff = 0, catName = "", answer = "";
var puzOrder = [], puzPtr = 0, solveOpts = [], solveCorrect = 0, wpos = 0;
var totalRounds = 3, round = 0;
var isBonus = false;
var humanFinished = false; /* true after human completes the 3 regular games */

/* players: 0 = human, 1 = CPU1, 2 = CPU2 */
var NUM_PLAYERS = 3;
var players = [];
var curPlayer = 0;
var lastWinner = -1;

function makePlayer(name, isHuman, pal) {
  return {
    name: name,
    isHuman: isHuman,
    score: 0,
    bank: 0,
    pal: pal
  };
}

function resetPlayers() {
  players = [
    makePlayer("YOU",  true,  PCT),
    makePlayer("CPU1", false, PCPU1),
    makePlayer("CPU2", false, PCPU2)
  ];
  curPlayer = 0;
  lastWinner = -1;
  humanFinished = false;
  isBonus = false;
}

function nextPlayer(from) {
  return (from + 1) % NUM_PLAYERS;
}

function shuffleIndex(len) {
  var idx = [], i, j, r, tmp;
  for (i = 0; i < len; i++) { idx.push(i); }
  for (j = len - 1; j > 0; j--) {
    r = Math.floor(rnd() * (j + 1));
    tmp = idx[j]; idx[j] = idx[r]; idx[r] = tmp;
  }
  return idx;
}

function layoutPuzzle(p) {
  var ls = wrapPhrase(p[1]), r, c, s, sc, ch, i;
  cells = [];
  for (i = 0; i < 30; i++) { cells.push(-1); }
  for (r = 0; r < ls.length && r < 3; r++) {
    s = ls[r];
    sc = Math.floor((10 - s.length) / 2);
    for (c = 0; c < s.length; c++) {
      ch = s.substring(c, c + 1);
      if (ch !== " ") { cells[r * 10 + sc + c] = letterIndex(ch); }
    }
  }
  yOff = (3 - ls.length) * 11;
  catName = p[0];
  answer = p[1];
  guessed = [];
  for (i = 0; i < 26; i++) { guessed.push(false); }
  allShown = false;
}
function countLetter(id) {
  var n = 0, i;
  for (i = 0; i < 30; i++) { if (cells[i] === id) { n++; } }
  return n;
}
function consLeft() {
  var i, id;
  for (i = 0; i < 30; i++) { id = cells[i]; if (id >= 0 && !guessed[id] && !isV(id)) { return true; } }
  return false;
}
function vowLeft() {
  var i, id;
  for (i = 0; i < 30; i++) { id = cells[i]; if (id >= 0 && !guessed[id] && isV(id)) { return true; } }
  return false;
}
function solved() {
  var i, id;
  if (allShown) { return true; }
  for (i = 0; i < 30; i++) { id = cells[i]; if (id >= 0 && !guessed[id]) { return false; } }
  return true;
}
function lettersRevealed() {
  var tot = 0, shown = 0, i, id;
  for (i = 0; i < 30; i++) {
    id = cells[i];
    if (id >= 0) {
      tot++;
      if (guessed[id]) { shown++; }
    }
  }
  return tot === 0 ? 1 : (shown / tot);
}

/* ---------- TV stage background ---------- */
function drawStage() {
  fr(0, 0, W, H, STAGE);
  fr(0, 0, 18, H, CURTAIN);
  fr(W - 18, 0, 18, H, CURTAIN);
  var i;
  for (i = 0; i < 6; i++) {
    fr(2 + i * 3, 0, 1, H, rgb(120, 10, 30));
    fr(W - 17 + i * 3, 0, 1, H, rgb(120, 10, 30));
  }
  fr(18, 0, W - 36, 8, GOLD);
  fr(18, 8, W - 36, 2, rgb(200, 160, 20));
  fr(18, H - 28, W - 36, 28, FLOOR);
  fr(18, H - 28, W - 36, 2, rgb(100, 70, 120));
  for (i = 0; i < 8; i++) {
    ci(30 + i * 36, H - 22, 3, YEL);
    fr(28 + i * 36, H - 20, 5, 2, rgb(255, 240, 150));
  }
  for (i = 0; i < 12; i++) {
    audience(28 + i * 24 + ((i & 1) ? 4 : 0), H - 8);
  }
}

/* ---------- logo ---------- */
function drawLogoBox() {
  fr(40, 12, W - 80, 40, RED);
  rc(40, 12, W - 80, 40, GOLD);
  rc(41, 13, W - 82, 38, rgb(200, 160, 20));
}
function drawLogo() {
  drawLogoBox();
  sctxt("WHEEL OF", 16, 2, WHITE, BLACK);
  sctxt("MISFORTUNE", 33, 2, GOLD, BLACK);
}

/* ---------- INTRO ---------- */
var introSkip = false;
function ipause(ms) {
  var t = 0, k;
  while (t < ms) {
    k = inp();
    if (k === 3 || k === 4) { introSkip = true; return true; }
    wait(20); t += 20;
  }
  return false;
}
function introFade(ls, steps) {
  var s, i, f, L;
  for (s = 1; s <= steps; s++) {
    f = s / steps;
    for (i = 0; i < ls.length; i++) {
      L = ls[i];
      ctxt(L[0], L[1], L[2], rgb(L[3] * f, L[4] * f, L[5] * f));
    }
    if (ipause(55)) { return true; }
  }
  return false;
}
function introMen(hx, wk) {
  fr(18, 84, Math.max(1, hx + 16 - 18), 54, STAGE);
  fr(W - hx - 16, 84, Math.max(1, W - 18 - (W - hx - 16)), 54, STAGE);
  man(hx, H - 36, 1, wk, PHST);
  man(W - hx, H - 36, -1, wk, PCT);
}
function intro() {
  var f, hx, wk = 0, pos = 0, px = [], py = [], i, k, tn, lastAnim, blink = 0;
  introSkip = false;
  ENC_GAP_MS = MENU_GAP; ENC_REV_MS = MENU_REV;
  settleInput();
  for (i = 0; i < NW; i++) { px.push(-999); py.push(-999); }

  cls(BLACK);
  if (introFade([["da cbm", 62, 2, 255, 210, 40], ["presents", 88, 1, 150, 150, 165]], 6)) { return; }
  if (ipause(600)) { return; }
  cls(BLACK);
  if (ipause(250)) { return; }

  drawStage();
  beep(300, 50); beep(500, 50); beep(800, 80);
  if (ipause(300)) { return; }
  drawLogoBox();
  sctxt("WHEEL OF", 16, 2, WHITE, BLACK);
  beep(600, 80);
  if (ipause(500)) { return; }
  sctxt("MISFORTUNE", 33, 2, GOLD, BLACK);
  beep(300, 100); beep(180, 140);
  if (ipause(200)) { return; }

  fr(0, 0, W, H, WHITE);
  beep(90, 160);
  if (ipause(70)) { return; }
  drawStage();
  drawLogo();
  fr(0, 0, 0, 0, BLACK);
  if (ipause(120)) { return; }
  fr(0, 0, W, H, rgb(200, 200, 255));
  if (ipause(40)) { return; }
  drawStage();
  drawLogo();
  ctxt("by da cbm", 56, 1, CYAN);
  if (ipause(300)) { return; }

  for (f = 0; f < 22; f++) {
    hx = 24 + f * 2;
    wk = (f >> 1) & 3;
    pos += 0.8;
    ringDraw(W / 2, 106, 26, 4, pos, px, py, false);
    drawPointer(W / 2, 66, 8);
    introMen(hx, wk);
    if (ipause(35)) { return; }
  }
  foot("SEL: start    ESC: skip");

  lastAnim = nowMs(); wk = 0;
  while (true) {
    k = inp();
    if (k === 3 || k === 4) { break; }
    pos += 0.3;
    ringDraw(W / 2, 106, 26, 4, pos, px, py, false);
    drawPointer(W / 2, 66, 8);
    tn = nowMs();
    if (tn - lastAnim > 450) {
      lastAnim = tn;
      wk = (wk + 1) & 3;
      blink = 1 - blink;
      introMen(66, wk);
      fr(0, H - 14, W, 14, rgb(6, 12, 24));
      if (blink) { ctxt("PRESS SEL TO PLAY", H - 11, 1, YEL); }
      else { ctxt("PRESS SEL TO PLAY", H - 11, 1, GRAY); }
    }
    wait(30);
  }
  settleInput();
}

/* ---------- menu / how-to ---------- */
function drawMenuChars() {
  fr(54, 84, 34, 54, STAGE);
  fr(W - 70 - 16, 84, 34, 54, STAGE);
  man(70, H - 36, 1, hostWk, PHST);
  man(W - 70, H - 36, -1, contWk, PCT);
}
function drawMenuButtons() {
  var opts = ["PLAY GAME", "HOW TO PLAY", "SOUND: " + (SOUND ? "ON" : "OFF"), "EXIT"];
  var i, by, sel;
  for (i = 0; i < 4; i++) {
    by = 80 + i * 15;
    sel = (i === menuSel);
    fr(90, by - 2, W - 180, 13, sel ? GOLD : rgb(30, 20, 60));
    rc(90, by - 2, W - 180, 13, sel ? GOLD : GRAY);
    txt(opts[i], 100, by, 1, sel ? BLACK : WHITE);
  }
}
function drawMenu() {
  ENC_GAP_MS = MENU_GAP; ENC_REV_MS = MENU_REV;
  drawStage();
  drawLogo();
  ctxt("by da cbm", 56, 1, CYAN);
  ctxt("Best Score: $" + bestScore, 68, 1, YEL);
  man(70, H - 36, 1, hostWk, PHST);
  man(W - 70, H - 36, -1, contWk, PCT);
  drawMenuButtons();
  foot("Turn: select   SEL: ok   ESC: quit");
}
function drawHowTo() {
  cls(DARK);
  fr(0, 0, W, 20, HDR);
  ctxt("HOW TO PLAY", 4, 2, WHITE);
  var lines = [
    "3 players: YOU + CPU1 + CPU2",
    "Turn knob to move, SEL to confirm.",
    "SPIN the wheel, then pick a consonant.",
    "Each hit pays the wedge value x count.",
    "VOWEL costs $250 from your bank.",
    "SOLVE = pick the right answer.",
    "",
    "No lives - play until each puzzle is solved.",
    "BANKRUPT = your bank wiped to $0",
    "HALF LOSS = lose half your bank",
    "CURSED = lose your turn",
    "Wrong letter / answer = lose turn.",
    "3 regular rounds, then BONUS for YOU!",
    "Bonus: R S T L N E are free, then solve.",
    "ESC = back / pause     SEL = continue"
  ];
  var i;
  for (i = 0; i < lines.length; i++) {
    txt(lines[i], 8, 24 + i * 9, 1, (i === lines.length - 1) ? YEL : WHITE);
  }
}

/* ---------- board / HUD ---------- */
var BX0 = 50, BY0 = 43;
function drawHUD() {
  fr(18, 8, W - 36, 20, rgb(10, 10, 30));
  var i, px, p, col;
  for (i = 0; i < NUM_PLAYERS; i++) {
    p = players[i];
    px = 22 + i * 94;
    col = (i === curPlayer) ? GOLD : WHITE;
    txt(p.name, px, 9, 1, col);
    txt("$" + p.score, px, 18, 1, col);
  }
  if (isBonus) {
    fr(18, 8, W - 36, 20, rgb(40, 10, 40));
    ctxt("BONUS ROUND  -  YOU", 13, 1, GOLD);
  }
}
function drawBoardTiles(flashId) {
  var r, c, id, x, y, show;
  for (r = 0; r < 3; r++) {
    for (c = 0; c < 10; c++) {
      id = cells[r * 10 + c];
      if (id < 0) { continue; }
      x = BX0 + c * 22; y = BY0 + yOff + r * 22;
      show = (allShown || guessed[id]);
      if (show) {
        fr(x, y, 20, 20, (id === flashId) ? GOLD : CREAM);
        rc(x, y, 20, 20, GRAY);
        txt(LETTERS.substring(id, id + 1), x + 4, y + 3, 2, BLACK);
      } else {
        fr(x, y, 20, 20, rgb(40, 100, 200));
        rc(x, y, 20, 20, CYAN);
      }
    }
  }
}
function setStatus(msg, col) {
  fr(48, 129, 226, 11, STAGE);
  ctxt(msg, 131, 1, col);
}
function drawActions() {
  var labels = ["SPIN", "VOWEL $250", "SOLVE"], i, bx, sel, tw, col;
  var p = players[curPlayer];
  for (i = 0; i < 3; i++) {
    bx = 50 + i * 76; sel = (i === actSel);
    fr(bx, 113, 72, 15, sel ? GOLD : rgb(30, 20, 60));
    rc(bx, 113, 72, 15, sel ? GOLD : GRAY);
    col = sel ? BLACK : WHITE;
    if (i === 1 && p.bank < 250) { col = sel ? rgb(110, 80, 0) : GRAY; }
    tw = labels[i].length * 6;
    txt(labels[i], bx + (72 - tw) / 2, 117, 1, col);
  }
}
function drawBoard() {
  ENC_GAP_MS = MENU_GAP; ENC_REV_MS = MENU_REV;
  drawStage();
  drawHUD();
  fr(50, 28, 220, 11, rgb(20, 15, 50));
  rc(50, 28, 220, 11, GOLD);
  if (isBonus) {
    ctxt("BONUS  " + catName, 30, 1, GOLD);
  } else {
    ctxt("R" + round + "/" + totalRounds + "  " + catName, 30, 1, CYAN);
  }
  fr(46, 41, 228, 70, rgb(10, 8, 30));
  rc(46, 41, 228, 70, GOLD);
  drawBoardTiles(-1);

  man(28, H - 36, 1, 0, PHST);
  var pal = players[curPlayer].pal;
  man(W - 28, H - 36, -1, 0, pal);

  if (players[curPlayer].isHuman) {
    drawActions();
    if (isBonus) {
      setStatus("Bonus: RSTLNE free - spin or solve!", WHITE);
    } else {
      setStatus(players[curPlayer].name + " - spin, buy or solve!", WHITE);
    }
    foot("Turn: choose   SEL: ok   ESC: pause");
  } else {
    fr(48, 113, 228, 15, rgb(20, 15, 40));
    ctxt(players[curPlayer].name + " is thinking...", 117, 1, YEL);
    setStatus("CPU turn", GRAY);
    foot("Please wait...");
  }
}

/* letter picker strip */
function drawLetterStrip(av, sel) {
  var n = av.length, cnt = (n < 7) ? n : 7, half = Math.floor(cnt / 2), j, id, x, on;
  fr(48, 111, 228, 19, STAGE);
  for (j = 0; j < cnt; j++) {
    id = av[(sel + (j - half) + n * 2) % n];
    x = 50 + Math.floor((7 - cnt) * 16) + j * 32;
    on = (j === half);
    fr(x, 112, 30, 17, on ? GOLD : rgb(30, 20, 60));
    rc(x, 112, 30, 17, on ? WHITE : GRAY);
    txt(LETTERS.substring(id, id + 1), x + 9, 114, 2, on ? BLACK : CYAN);
  }
}
function pickLetter(vowel, val) {
  var av = [], i, sel = 0, k;
  for (i = 0; i < 26; i++) {
    if (!guessed[i] && (isV(i) === vowel)) { av.push(i); }
  }
  if (av.length === 0) { return -1; }
  ENC_GAP_MS = LET_GAP; ENC_REV_MS = LET_REV;
  settleInput();
  setStatus(vowel ? "Pick a VOWEL  (-$250)" : "Pick a consonant for $" + val + " each", YEL);
  foot("Turn: letter   SEL: pick   ESC: cancel");
  drawLetterStrip(av, sel);
  while (true) {
    k = inp();
    if (k === 1) { sel = (sel + 1) % av.length; drawLetterStrip(av, sel); }
    else if (k === 2) { sel = (sel + av.length - 1) % av.length; drawLetterStrip(av, sel); }
    else if (k === 3) { settleInput(); ENC_GAP_MS = MENU_GAP; ENC_REV_MS = MENU_REV; return av[sel]; }
    else if (k === 4) { settleInput(); ENC_GAP_MS = MENU_GAP; ENC_REV_MS = MENU_REV; return -1; }
    wait(10);
  }
}

/* ---------- AI helpers ---------- */
function aiPickLetter(vowel) {
  var order = vowel ? AI_VOW : AI_CONS;
  var i, id, avail = [];
  for (i = 0; i < order.length; i++) {
    id = order[i];
    if (!guessed[id] && (isV(id) === vowel)) { avail.push(id); }
  }
  if (avail.length === 0) {
    for (i = 0; i < 26; i++) {
      if (!guessed[i] && (isV(i) === vowel)) { avail.push(i); }
    }
  }
  if (avail.length === 0) { return -1; }
  if (rnd() < 0.18) { return avail[ri(0, avail.length - 1)]; }
  return avail[0];
}

function aiDecideAction() {
  var p = players[curPlayer];
  var rev = lettersRevealed();
  var canCons = consLeft();
  var canVow  = vowLeft() && p.bank >= 250;

  if (rev >= 0.72 && rnd() < 0.55) { return 2; }
  if (rev >= 0.55 && rnd() < 0.28) { return 2; }

  if (!canCons) {
    if (canVow && rnd() < 0.7) { return 1; }
    return 2;
  }

  if (canVow && rev > 0.35 && p.bank >= 500 && rnd() < 0.22) { return 1; }

  return 0;
}

/* ---------- wheel screen ---------- */
function drawHub(idx) {
  var t = WEDGES[idx][0], v = WEDGES[idx][1], cx = W / 2, cy = 84;
  ci(cx, cy, 35, GOLD);
  ci(cx, cy, 33, BLACK);
  if (t === 0)      { ctxt("$" + v, cy - 7, 2, YEL); }
  else if (t === 3) { ctxt("JACKPOT", cy - 9, 1, GOLD); ctxt("$" + v, cy + 3, 1, YEL); }
  else if (t === 1) { ctxt("BANKRUPT", cy - 4, 1, RED); }
  else if (t === 2) { ctxt("CURSED", cy - 9, 1, VIOLET); ctxt("LOSE TURN", cy + 3, 1, WHITE); }
  else              { ctxt("HALF", cy - 9, 1, ORNG); ctxt("LOSS", cy + 3, 1, WHITE); }
}
function drawSideChars(wk) {
  fr(18, 84, 28, 54, STAGE);
  fr(W - 46, 84, 28, 54, STAGE);
  man(30, H - 36, 1, wk, PHST);
  man(W - 30, H - 36, -1, wk, players[curPlayer].pal);
}
function spinWheel() {
  var px = [], py = [], i, f, N = 56, start = wpos, target, dist, t, p, idx, lastIdx = -1, wk = 0;
  var t0v, msg, col;
  for (i = 0; i < NW; i++) { px.push(-999); py.push(-999); }
  target = ri(0, NW - 1);
  dist = ((target - start) % NW + NW) % NW + NW * ri(2, 3);
  drawStage();
  drawHUD();
  drawSideChars(0);
  foot(players[curPlayer].name + " spinning...");
  beep(500, 40);
  for (f = 0; f <= N; f++) {
    t = f / N;
    p = start + dist * (1 - (1 - t) * (1 - t) * (1 - t));
    ringDraw(W / 2, 84, 46, 7, p, px, py, true);
    drawPointer(W / 2, 27, 12);
    idx = ((Math.round(p) % NW) + NW) % NW;
    if (idx !== lastIdx) {
      drawHub(idx);
      if (f > 24) { beep(1100, 5); }
      lastIdx = idx;
    }
    if (f % 6 === 0) { wk = (wk + 1) & 3; drawSideChars(wk); }
    wait(28);
  }
  wpos = target;
  drawHub(target);
  t0v = WEDGES[target][0];
  if (t0v === 0)      { msg = "$" + WEDGES[target][1] + "!  PICK A CONSONANT"; col = GREEN; }
  else if (t0v === 3) { msg = "JACKPOT! $" + WEDGES[target][1] + " A LETTER"; col = GOLD; }
  else if (t0v === 1) { msg = "BANKRUPT!  BANK WIPED"; col = RED; }
  else if (t0v === 2) { msg = "CURSED!  LOSE TURN"; col = VIOLET; }
  else                { msg = "HALF LOSS!  BANK HALVED"; col = ORNG; }
  fr(44, 139, W - 88, 13, BLACK);
  rc(44, 139, W - 88, 13, col);
  ctxt(msg, 142, 1, col);
  if (t0v === 0 || t0v === 3) { beep(880, 80); beep(1175, 120); }
  else { beep(220, 200); beep(150, 260); }
  wait(1000);
  settleInput();
  return target;
}

/* ---------- game logic ---------- */
function startGame() {
  resetPlayers();
  round = 0;
  survived = false;
  puzOrder = shuffleIndex(PUZZLES.length);
  puzPtr = 0;
  startRound();
}
function startRound() {
  round++;
  isBonus = false;
  if (puzPtr >= puzOrder.length) { puzOrder = shuffleIndex(PUZZLES.length); puzPtr = 0; }
  curPuz = puzOrder[puzPtr]; puzPtr++;
  layoutPuzzle(PUZZLES[curPuz]);
  var i;
  for (i = 0; i < NUM_PLAYERS; i++) {
    players[i].bank = 0;
  }
  curPlayer = (rnd() < 0.45) ? 0 : ri(0, NUM_PLAYERS - 1);
  actSel = 0;
  state = STATE_BOARD;
  drawBoard();
  if (!players[curPlayer].isHuman) {
    wait(400);
    doCpuTurn();
  }
}
function startBonusRound() {
  isBonus = true;
  humanFinished = true;
  /* pick a bonus puzzle */
  var bi = ri(0, BONUS_PUZZLES.length - 1);
  layoutPuzzle(BONUS_PUZZLES[bi]);
  /* free letters RSTLNE */
  var i;
  for (i = 0; i < BONUS_FREE.length; i++) {
    guessed[BONUS_FREE[i]] = true;
  }
  players[0].bank = 0;
  curPlayer = 0; /* human only */
  actSel = 0;
  state = STATE_BOARD;
  drawBoard();
  setStatus("R S T L N E are free!", GOLD);
  wait(900);
  drawBoard();
}
function endGame() {
  var bestP = 0, i;
  for (i = 1; i < NUM_PLAYERS; i++) {
    if (players[i].score > players[bestP].score) { bestP = i; }
  }
  lastWinner = bestP;
  if (players[0].score > bestScore) { bestScore = players[0].score; }
  survived = (bestP === 0);
  state = STATE_GAMEOVER;
  drawGameOver();
}
function drawGameOver() {
  ENC_GAP_MS = MENU_GAP; ENC_REV_MS = MENU_REV;
  drawStage();
  fr(40, 10, W - 80, 24, RED);
  rc(40, 10, W - 80, 24, GOLD);
  sctxt(survived ? "YOU WIN!" : "GAME OVER", 14, 2, GOLD, BLACK);

  var i, y0 = 42;
  for (i = 0; i < NUM_PLAYERS; i++) {
    var col = (i === lastWinner) ? GOLD : WHITE;
    txt(players[i].name + "  $" + players[i].score, 70, y0 + i * 14, 1, col);
    if (i === lastWinner) { txt("WINNER", 210, y0 + i * 14, 1, GREEN); }
  }

  var grade, gcol, sc = players[0].score;
  if (sc >= 5000)      { grade = "LUCKY DEVIL!";    gcol = GOLD; }
  else if (sc >= 3500) { grade = "FORTUNES FAVE";   gcol = GREEN; }
  else if (sc >= 2000) { grade = "NOT SO BAD";      gcol = BLUE; }
  else if (sc >= 800)  { grade = "UNLUCKY";         gcol = ORNG; }
  else                 { grade = "TOTALLY CURSED!"; gcol = VIOLET; }
  ctxt(grade, 92, 1, gcol);

  if (!isBonus) { ctxt("Answer was: " + answer, 106, 1, GRAY); }

  man(40, H - 36, 1, 0, PHST);
  man(W - 40, H - 36, -1, 0, players[0].pal);
  fr(W / 2 - 60, 120, 120, 18, GOLD);
  ctxt("PLAY AGAIN", 125, 1, BLACK);
  foot("SEL: menu   ESC: exit game");
}
function roundWin(winnerIdx) {
  var p = players[winnerIdx];
  var gain = p.bank + 250;
  allShown = true;
  drawBoard();
  beep(784, 80); beep(1047, 80); beep(1319, 80); beep(1568, 160);
  wait(700);
  p.score += gain;
  if (isBonus) {
    /* big bonus prize */
    var bonusPrize = 2500 + ri(0, 5) * 500;
    p.score += bonusPrize;
    popup([
      ["BONUS SOLVED!", 2, GOLD],
      [answer, 1, WHITE],
      ["Bank +$" + p.bank, 1, CYAN],
      ["Bonus prize +$" + bonusPrize, 1, YEL],
      ["Total $" + p.score, 1, GOLD]
    ], GOLD);
    endGame();
    return;
  }
  popup([
    ["SOLVED by " + p.name + "!", 2, GREEN],
    [answer, 1, WHITE],
    ["Bank +$" + p.bank, 1, CYAN],
    ["Solve bonus +$250", 1, YEL],
    [p.name + " total $" + p.score, 1, GOLD]
  ], GREEN);
  if (round >= totalRounds) {
    /* human completed the 3 games -> bonus round for YOU */
    humanFinished = true;
    popup([
      ["3 ROUNDS COMPLETE!", 2, CYAN],
      ["Time for the BONUS ROUND", 1, WHITE],
      ["R S T L N E are free", 1, YEL],
      ["Good luck!", 1, GOLD]
    ], CYAN);
    startBonusRound();
  } else {
    startRound();
  }
}
function afterAction() {
  if (state !== STATE_BOARD) { return; }

  if (solved()) {
    roundWin(curPlayer);
    return;
  }

  /* pass turn (no lives, just next player) */
  if (!isBonus) {
    curPlayer = nextPlayer(curPlayer);
  }
  /* in bonus only human plays, so stay on 0 */
  actSel = 0;
  drawBoard();

  if (!players[curPlayer].isHuman) {
    wait(500);
    doCpuTurn();
  }
}
function applyLetter(id, perVal, vowelBuy) {
  var cnt = countLetter(id), L = LETTERS.substring(id, id + 1);
  var p = players[curPlayer];
  guessed[id] = true;
  if (cnt > 0) {
    if (!vowelBuy) { p.bank += perVal * cnt; }
    drawBoardTiles(id);
    drawHUD();
    setStatus(cnt + " x " + L + (vowelBuy ? "" : "   +$" + (perVal * cnt)), GREEN);
    foot("Nice one!");
    beep(784, 60); beep(1047, 60); beep(1319, 90);
    wait(700);
    /* correct letter keeps the turn */
    if (players[curPlayer].isHuman) {
      drawBoard();
    } else {
      wait(300);
      doCpuTurn();
    }
  } else {
    /* wrong letter - just lose the turn, no lives */
    beep(200, 180); beep(150, 240);
    flash("NO " + L + "!  LOSE TURN", RED);
    afterAction();
  }
}
function doSpin() {
  var idx, t, v, id;
  var p = players[curPlayer];
  if (!consLeft()) {
    flash("ONLY VOWELS LEFT!", ORNG);
    afterAction();
    return;
  }
  idx = spinWheel();
  t = WEDGES[idx][0]; v = WEDGES[idx][1];
  if (t === 0 || t === 3) {
    drawBoard();
    if (p.isHuman) {
      id = pickLetter(false, v);
      if (id >= 0) { applyLetter(id, v, false); }
      else { afterAction(); }
    } else {
      wait(400);
      id = aiPickLetter(false);
      if (id >= 0) {
        setStatus(p.name + " picks " + LETTERS.substring(id, id + 1), YEL);
        wait(600);
        applyLetter(id, v, false);
      } else {
        afterAction();
      }
    }
  } else if (t === 1) {
    p.bank = 0;
    afterAction();
  } else if (t === 2) {
    /* CURSED = lose turn only */
    afterAction();
  } else if (t === 4) {
    p.bank = Math.floor(p.bank / 2);
    afterAction();
  }
}
function doVowel() {
  var id;
  var p = players[curPlayer];
  if (p.bank < 250) {
    flash("NEED $250 IN BANK", ORNG);
    afterAction();
    return;
  }
  if (!vowLeft()) {
    flash("NO VOWELS LEFT!", ORNG);
    afterAction();
    return;
  }
  if (p.isHuman) {
    id = pickLetter(true, 0);
    if (id >= 0) {
      p.bank -= 250;
      applyLetter(id, 0, true);
    } else {
      afterAction();
    }
  } else {
    wait(400);
    id = aiPickLetter(true);
    if (id >= 0) {
      p.bank -= 250;
      setStatus(p.name + " buys " + LETTERS.substring(id, id + 1), YEL);
      wait(600);
      applyLetter(id, 0, true);
    } else {
      afterAction();
    }
  }
}
function doSolve() {
  var order, picks = [], i, j, r, pool;
  if (isBonus) {
    pool = BONUS_PUZZLES;
  } else {
    pool = PUZZLES;
  }
  order = shuffleIndex(pool.length);
  for (i = 0; i < order.length && picks.length < 3; i++) {
    if (pool[order[i]][1] !== answer) { picks.push(order[i]); }
  }
  solveCorrect = ri(0, 3);
  solveOpts = [];
  j = 0;
  for (i = 0; i < 4; i++) {
    if (i === solveCorrect) { solveOpts.push(answer); }
    else { solveOpts.push(pool[picks[j]][1]); j++; }
  }

  var p = players[curPlayer];
  if (p.isHuman) {
    r = menu("SOLVE IT!", solveOpts, 0, null);
    if (r < 0) { afterAction(); return; }
    if (r === solveCorrect) {
      allShown = true;
      roundWin(curPlayer);
    } else {
      beep(200, 180); beep(150, 240);
      flash("WRONG ANSWER! LOSE TURN", RED);
      afterAction();
    }
  } else {
    var chance = 0.25 + lettersRevealed() * 0.55;
    wait(600);
    if (rnd() < chance) {
      allShown = true;
      setStatus(p.name + " SOLVES!", GREEN);
      wait(500);
      roundWin(curPlayer);
    } else {
      beep(200, 180); beep(150, 240);
      flash(p.name + " WRONG! LOSE TURN", RED);
      afterAction();
    }
  }
}
function doAction() {
  if (actSel === 0) { doSpin(); }
  else if (actSel === 1) { doVowel(); }
  else { doSolve(); }
}

function doCpuTurn() {
  if (state !== STATE_BOARD) { return; }
  if (players[curPlayer].isHuman) { return; }

  actSel = aiDecideAction();
  drawBoard();
  wait(450);
  doAction();
}

/* ---------- Pause / ESC menu ---------- */
function pauseMenu() {
  var idx = 0, r;
  ENC_GAP_MS = MENU_GAP; ENC_REV_MS = MENU_REV;
  while (true) {
    r = menu("PAUSED", [
      "Resume",
      "Sound: " + (SOUND ? "ON" : "OFF"),
      "How To Play",
      "Quit to Title",
      "Exit Game"
    ], idx, [
      "Back to the show",
      "Toggle sound effects",
      "Controls & rules",
      "Return to main menu",
      "Quit completely"
    ]);
    if (r < 0 || r === 0) { return false; }
    idx = r;
    if (r === 1) { SOUND = !SOUND; }
    else if (r === 2) {
      drawHowTo();
      waitKey();
    } else if (r === 3) {
      if (confirmBox("Quit to title screen?")) {
        state = STATE_MENU;
        menuSel = 0;
        return true;
      }
    } else if (r === 4) {
      if (confirmBox("Exit the game?")) {
        LEAVE = true;
        return true;
      }
    }
  }
}

/* ---------- Main loop ---------- */
function run() {
  var k, lastAnim = 0, tn;
  calibrateClock();
  buildTrig();
  buildWedgeColors();
  intro();
  state = STATE_MENU; menuSel = 0;
  drawMenu();

  while (!LEAVE) {
    k = inp();

    if (state === STATE_MENU) {
      tn = nowMs();
      if (tn - lastAnim > 450) {
        lastAnim = tn;
        hostWk = (hostWk + 1) & 3;
        contWk = (contWk + 1) & 3;
        drawMenuChars();
      }
    }

    if (state === STATE_MENU) {
      if (k === 1) { menuSel = (menuSel + 1) % 4; drawMenuButtons(); }
      else if (k === 2) { menuSel = (menuSel + 3) % 4; drawMenuButtons(); }
      else if (k === 3) {
        settleInput();
        if (menuSel === 0) { startGame(); }
        else if (menuSel === 1) { state = STATE_HOWTO; drawHowTo(); }
        else if (menuSel === 2) { SOUND = !SOUND; drawMenuButtons(); }
        else if (menuSel === 3) {
          if (confirmBox("Exit the game?")) { LEAVE = true; }
          else { drawMenu(); }
        }
      } else if (k === 4) {
        if (confirmBox("Exit the game?")) { LEAVE = true; }
        else { drawMenu(); }
      }
    }
    else if (state === STATE_HOWTO) {
      if (k === 3 || k === 4) {
        settleInput();
        state = STATE_MENU;
        drawMenu();
      }
    }
    else if (state === STATE_BOARD) {
      if (players[curPlayer].isHuman) {
        if (k === 1) { actSel = (actSel + 1) % 3; drawActions(); }
        else if (k === 2) { actSel = (actSel + 2) % 3; drawActions(); }
        else if (k === 3) {
          settleInput();
          doAction();
        } else if (k === 4) {
          settleInput();
          if (pauseMenu()) {
            if (LEAVE) { break; }
            if (state === STATE_MENU) { drawMenu(); }
          } else {
            drawBoard();
          }
        }
      } else {
        if (k === 4) {
          settleInput();
          if (pauseMenu()) {
            if (LEAVE) { break; }
            if (state === STATE_MENU) { drawMenu(); }
          } else {
            drawBoard();
            if (!players[curPlayer].isHuman) {
              wait(300);
              doCpuTurn();
            }
          }
        }
      }
    }
    else if (state === STATE_GAMEOVER) {
      if (k === 3) {
        settleInput();
        state = STATE_MENU; menuSel = 0;
        drawMenu();
      } else if (k === 4) {
        if (confirmBox("Exit the game?")) { LEAVE = true; }
        else { drawGameOver(); }
      }
    }

    wait(10);
  }

  cls(BLACK);
  ctxt("Thanks for playing!", 62, 2, WHITE);
  ctxt("Wheel of Misfortune", 90, 1, GOLD);
  ctxt("by da cbm", 104, 1, CYAN);
  wait(1000);
}

/* boot */
try {
  run();
} catch (err) {
  try {
    cls(rgb(60, 0, 0));
    txt("Error recovered", 6, 6, 1, WHITE);
    var m = String((err && err.message) ? err.message : err);
    var y = 22;
    while (m.length > 0 && y < H - 20) {
      txt(m.substring(0, 48), 6, y, 1, YEL);
      m = m.substring(48); y += 12;
    }
    txt("Press SEL", 6, H - 14, 1, WHITE);
    waitKey();
  } catch (e2) {}
}
