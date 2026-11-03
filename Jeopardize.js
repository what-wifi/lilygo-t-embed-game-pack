/* ============================================================
   JEOPARDIZE  -  by da cbm
   Bruce firmware  |  LilyGO T-Embed CC1101 (320x170)  ES5
   ----------------------------------------------------------
   Built on the Wheel of Misfortune / Price Is Wrong engine:
   same hardened encoder debounce, in-place redraws (no flicker),
   small character sprites, proper ESC / pause / exit / sound.
   Turn knob = move / pick        SEL = confirm
   ESC = back / pause / exit   (HOLD ESC 3 sec = quit anywhere)

   MULTI-PLAYER: You + CPU1 + CPU2  (turn-based, shared board)
   YOU always selects answers. CPU1 / CPU2 answer AUTOMATICALLY
   (no button press required for computer players).
   Pick category + value → see clue → choose answer
   Correct = +value    Wrong = -value + lose turn
   Daily Double + Final Jeopardy
   All-time leaderboard (Storage if available, else session)
   Expanded question bank (100+ clues)
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
var HOLD_QUIT_MS = 3000;
var escHoldStart = -1, escHoldShown = -1;
function holdCheck() {
  var down = false, held, left;
  try { down = !!keyboard.getEscPress(); } catch (e) { down = false; }
  if (!down) { escHoldStart = -1; escHoldShown = -1; return; }
  if (escHoldStart < 0) { escHoldStart = nowMs(); return; }
  held = nowMs() - escHoldStart;
  if (held >= HOLD_QUIT_MS) { throw "HOLD_QUIT"; }
  if (held >= 800) {
    left = Math.ceil((HOLD_QUIT_MS - held) / 1000);
    if (left !== escHoldShown) {
      escHoldShown = left;
      fr(0, H - 14, W, 14, rgb(120, 10, 20));
      txt("Hold ESC to quit...  " + left, 6, H - 11, 1, WHITE);
    }
  }
}
function wait(ms) {
  var left, sl;
  ms = Math.floor(ms); if (ms < 1) { ms = 1; }
  left = ms;
  while (left > 0) {
    sl = (left > 25) ? 25 : left;
    pollN += sl; delay(sl); left -= sl;
    holdCheck();
  }
}
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
    STAGE = rgb(12, 28, 70), CURTAIN = rgb(160, 20, 40), FLOOR = rgb(30, 40, 80),
    JEOP = rgb(10, 40, 110), TILE = rgb(20, 60, 140);

/* ---------- input (hardened) ---------- */
var MENU_GAP = 70, MENU_REV = 120;
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

/* ---------- Leaderboard ---------- */
var LEADERBOARD = [];
var bestScore = 0;

function loadLeaderboard() {
  LEADERBOARD = [];
  bestScore = 0;
  try {
    var st = require("Storage");
    if (st && typeof st.readJSON === "function") {
      var data = st.readJSON("jeopardize_lb", true);
      if (data && data.scores && data.scores.length) {
        LEADERBOARD = data.scores;
        var i;
        for (i = 0; i < LEADERBOARD.length; i++) {
          if (LEADERBOARD[i].score > bestScore) bestScore = LEADERBOARD[i].score;
        }
      }
    }
  } catch (e) {}
  LEADERBOARD.sort(function(a, b) { return b.score - a.score; });
  if (LEADERBOARD.length > 8) LEADERBOARD.length = 8;
}

function saveLeaderboard() {
  try {
    var st = require("Storage");
    if (st && typeof st.writeJSON === "function") {
      st.writeJSON("jeopardize_lb", { scores: LEADERBOARD });
    }
  } catch (e) {}
}

function addToLeaderboard(name, score) {
  if (score <= 0) return;
  LEADERBOARD.push({ name: name, score: score });
  LEADERBOARD.sort(function(a, b) { return b.score - a.score; });
  if (LEADERBOARD.length > 8) LEADERBOARD.length = 8;
  if (score > bestScore) bestScore = score;
  saveLeaderboard();
}

/* ---------- LARGE QUESTION BANK ---------- */
var CATS = [
  {name:"SCIENCE",clues:[
    {v:200,q:"This planet is known as the Red Planet",a:"What is Mars?",wrong:["What is Venus?","What is Jupiter?","What is Saturn?"]},
    {v:400,q:"H2O is the chemical formula for this",a:"What is water?",wrong:["What is hydrogen?","What is oxygen?","What is salt?"]},
    {v:600,q:"This force keeps planets in orbit",a:"What is gravity?",wrong:["What is magnetism?","What is friction?","What is inertia?"]},
    {v:800,q:"DNA stands for this long name",a:"What is deoxyribonucleic acid?",wrong:["What is dynamite?","What is diode?","What is density?"]}
  ]},
  {name:"HISTORY",clues:[
    {v:200,q:"This year the Titanic sank",a:"What is 1912?",wrong:["What is 1905?","What is 1920?","What is 1898?"]},
    {v:400,q:"He was the first US President",a:"What is George Washington?",wrong:["What is Lincoln?","What is Jefferson?","What is Adams?"]},
    {v:600,q:"This wall fell in 1989",a:"What is the Berlin Wall?",wrong:["What is China Wall?","What is Hadrian?","What is Iron Curtain?"]},
    {v:800,q:"Ancient Egyptian writing system",a:"What is hieroglyphics?",wrong:["What is cuneiform?","What is Latin?","What is runes?"]}
  ]},
  {name:"MOVIES",clues:[
    {v:200,q:"This 1997 film sank a ship",a:"What is Titanic?",wrong:["What is Poseidon?","What is Jaws?","What is Waterworld?"]},
    {v:400,q:"Luke's father in Star Wars",a:"Who is Darth Vader?",wrong:["Who is Yoda?","Who is Obi-Wan?","Who is Han Solo?"]},
    {v:600,q:"This wizard lives in Hogwarts",a:"Who is Harry Potter?",wrong:["Who is Gandalf?","Who is Merlin?","Who is Dumbledore?"]},
    {v:800,q:"Inception director",a:"Who is Christopher Nolan?",wrong:["Who is Spielberg?","Who is Cameron?","Who is Tarantino?"]}
  ]},
  {name:"GEOGRAPHY",clues:[
    {v:200,q:"Capital of France",a:"What is Paris?",wrong:["What is Lyon?","What is Rome?","What is Berlin?"]},
    {v:400,q:"Largest ocean on Earth",a:"What is the Pacific?",wrong:["What is Atlantic?","What is Indian?","What is Arctic?"]},
    {v:600,q:"This river is the longest",a:"What is the Nile?",wrong:["What is Amazon?","What is Mississippi?","What is Yangtze?"]},
    {v:800,q:"Country shaped like a boot",a:"What is Italy?",wrong:["What is Spain?","What is Greece?","What is Portugal?"]}
  ]},
  {name:"ANIMALS",clues:[
    {v:200,q:"This mammal can fly",a:"What is a bat?",wrong:["What is a bird?","What is a squirrel?","What is a penguin?"]},
    {v:400,q:"Largest living land animal",a:"What is an elephant?",wrong:["What is a rhino?","What is a hippo?","What is a giraffe?"]},
    {v:600,q:"A group of lions is called",a:"What is a pride?",wrong:["What is a pack?","What is a herd?","What is a flock?"]},
    {v:800,q:"This shark is the largest fish",a:"What is a whale shark?",wrong:["What is a great white?","What is a hammerhead?","What is a tiger shark?"]}
  ]},
  {name:"SPORTS",clues:[
    {v:200,q:"How many players on a soccer team",a:"What is 11?",wrong:["What is 9?","What is 10?","What is 12?"]},
    {v:400,q:"This sport uses a shuttlecock",a:"What is badminton?",wrong:["What is tennis?","What is squash?","What is volleyball?"]},
    {v:600,q:"Olympic Games are held every",a:"What is 4 years?",wrong:["What is 2 years?","What is 3 years?","What is 5 years?"]},
    {v:800,q:"Michael Jordan played this sport",a:"What is basketball?",wrong:["What is baseball?","What is football?","What is hockey?"]}
  ]},
  {name:"MUSIC",clues:[
    {v:200,q:"This instrument has 88 keys",a:"What is a piano?",wrong:["What is an organ?","What is a harpsichord?","What is a synth?"]},
    {v:400,q:"The Beatles were from this city",a:"What is Liverpool?",wrong:["What is London?","What is Manchester?","What is Birmingham?"]},
    {v:600,q:"This note is also called C",a:"What is do?",wrong:["What is re?","What is mi?","What is fa?"]},
    {v:800,q:"Beethoven's famous 5th starts with",a:"What is da-da-da-dum?",wrong:["What is la-la-la?","What is do-re-mi?","What is ta-ta-ta?"]}
  ]},
  {name:"FOOD",clues:[
    {v:200,q:"This fruit keeps the doctor away",a:"What is an apple?",wrong:["What is a banana?","What is an orange?","What is a pear?"]},
    {v:400,q:"Sushi is traditionally from",a:"What is Japan?",wrong:["What is China?","What is Korea?","What is Thailand?"]},
    {v:600,q:"This pasta is shaped like tubes",a:"What is penne?",wrong:["What is spaghetti?","What is fettuccine?","What is farfalle?"]},
    {v:800,q:"The main ingredient in guacamole",a:"What is avocado?",wrong:["What is tomato?","What is onion?","What is lime?"]}
  ]},
  {name:"SPACE",clues:[
    {v:200,q:"Our galaxy is called the",a:"What is the Milky Way?",wrong:["What is Andromeda?","What is Orion?","What is Cosmos?"]},
    {v:400,q:"First human on the Moon",a:"Who is Neil Armstrong?",wrong:["Who is Buzz Aldrin?","Who is Yuri Gagarin?","Who is John Glenn?"]},
    {v:600,q:"This planet has famous rings",a:"What is Saturn?",wrong:["What is Jupiter?","What is Uranus?","What is Neptune?"]},
    {v:800,q:"A light-year measures this",a:"What is distance?",wrong:["What is time?","What is speed?","What is brightness?"]}
  ]},
  {name:"LITERATURE",clues:[
    {v:200,q:"Author of Romeo and Juliet",a:"Who is Shakespeare?",wrong:["Who is Dickens?","Who is Austen?","Who is Twain?"]},
    {v:400,q:"Harry Potter's best friends",a:"Who are Ron and Hermione?",wrong:["Who are Draco and Neville?","Who are Fred and George?","Who are Luna and Ginny?"]},
    {v:600,q:"This novel features a white whale",a:"What is Moby Dick?",wrong:["What is 20,000 Leagues?","What is Old Man and Sea?","What is Jaws?"]},
    {v:800,q:"George Orwell wrote this dystopia",a:"What is 1984?",wrong:["What is Brave New World?","What is Fahrenheit 451?","What is Animal Farm?"]}
  ]},
  {name:"TECH",clues:[
    {v:200,q:"This company makes the iPhone",a:"What is Apple?",wrong:["What is Samsung?","What is Google?","What is Microsoft?"]},
    {v:400,q:"WWW stands for",a:"What is World Wide Web?",wrong:["What is World Web Wide?","What is Wide World Web?","What is Web World Wide?"]},
    {v:600,q:"This coding language uses snakes",a:"What is Python?",wrong:["What is Java?","What is Cobra?","What is Ruby?"]},
    {v:800,q:"Binary uses only these digits",a:"What are 0 and 1?",wrong:["What are 1 and 2?","What are A and B?","What are X and Y?"]}
  ]},
  {name:"MYTHOLOGY",clues:[
    {v:200,q:"Greek god of the sea",a:"Who is Poseidon?",wrong:["Who is Zeus?","Who is Hades?","Who is Apollo?"]},
    {v:400,q:"Norse god of thunder",a:"Who is Thor?",wrong:["Who is Odin?","Who is Loki?","Who is Freyr?"]},
    {v:600,q:"This hero killed the Minotaur",a:"Who is Theseus?",wrong:["Who is Hercules?","Who is Perseus?","Who is Odysseus?"]},
    {v:800,q:"Egyptian god of the underworld",a:"Who is Osiris?",wrong:["Who is Anubis?","Who is Ra?","Who is Horus?"]}
  ]},
  {name:"NATURE",clues:[
    {v:200,q:"This tree produces acorns",a:"What is an oak?",wrong:["What is a maple?","What is a pine?","What is a birch?"]},
    {v:400,q:"The process plants use for food",a:"What is photosynthesis?",wrong:["What is respiration?","What is germination?","What is pollination?"]},
    {v:600,q:"This is the hardest natural substance",a:"What is diamond?",wrong:["What is quartz?","What is gold?","What is steel?"]},
    {v:800,q:"A group of wolves is called",a:"What is a pack?",wrong:["What is a herd?","What is a flock?","What is a pride?"]}
  ]},
  {name:"TV SHOWS",clues:[
    {v:200,q:"This show has a throne of swords",a:"What is Game of Thrones?",wrong:["What is The Crown?","What is Vikings?","What is The Witcher?"]},
    {v:400,q:"Friends coffee shop name",a:"What is Central Perk?",wrong:["What is Central Park?","What is Coffee Bean?","What is Monk's?"]},
    {v:600,q:"This doctor travels in a TARDIS",a:"Who is Doctor Who?",wrong:["Who is House?","Who is Strange?","Who is Watson?"]},
    {v:800,q:"Breaking Bad main character",a:"Who is Walter White?",wrong:["Who is Jesse Pinkman?","Who is Saul Goodman?","Who is Hank Schrader?"]}
  ]},
  {name:"ART",clues:[
    {v:200,q:"Painter of the Mona Lisa",a:"Who is Leonardo da Vinci?",wrong:["Who is Michelangelo?","Who is Raphael?","Who is Donatello?"]},
    {v:400,q:"This artist cut off his ear",a:"Who is Van Gogh?",wrong:["Who is Picasso?","Who is Monet?","Who is Dali?"]},
    {v:600,q:"The Scream was painted by",a:"Who is Edvard Munch?",wrong:["Who is Klimt?","Who is Schiele?","Who is Kandinsky?"]},
    {v:800,q:"This style means 'rebirth'",a:"What is Renaissance?",wrong:["What is Baroque?","What is Gothic?","What is Rococo?"]}
  ]},
  {name:"MATH",clues:[
    {v:200,q:"A shape with 3 sides",a:"What is a triangle?",wrong:["What is a square?","What is a pentagon?","What is a hexagon?"]},
    {v:400,q:"Pi is approximately this",a:"What is 3.14?",wrong:["What is 2.72?","What is 1.41?","What is 1.62?"]},
    {v:600,q:"This is the square root of 81",a:"What is 9?",wrong:["What is 8?","What is 7?","What is 10?"]},
    {v:800,q:"A right angle measures",a:"What is 90 degrees?",wrong:["What is 45 degrees?","What is 180 degrees?","What is 360 degrees?"]}
  ]},
  {name:"INVENTIONS",clues:[
    {v:200,q:"Alexander Graham Bell invented",a:"What is the telephone?",wrong:["What is the radio?","What is the TV?","What is the light bulb?"]},
    {v:400,q:"This person invented the light bulb",a:"Who is Thomas Edison?",wrong:["Who is Tesla?","Who is Franklin?","Who is Faraday?"]},
    {v:600,q:"The Wright brothers invented",a:"What is the airplane?",wrong:["What is the helicopter?","What is the car?","What is the train?"]},
    {v:800,q:"This machine was invented by Gutenberg",a:"What is the printing press?",wrong:["What is the typewriter?","What is the computer?","What is the camera?"]}
  ]},
  {name:"OCEANS",clues:[
    {v:200,q:"This is the deepest ocean trench",a:"What is Mariana Trench?",wrong:["What is Puerto Rico?","What is Java Trench?","What is Tonga?"]},
    {v:400,q:"Coral reefs are made by these",a:"What are coral polyps?",wrong:["What are fish?","What are algae?","What are shells?"]},
    {v:600,q:"This mammal is the largest animal",a:"What is the blue whale?",wrong:["What is the sperm whale?","What is the elephant?","What is the orca?"]},
    {v:800,q:"Tsunamis are usually caused by",a:"What are earthquakes?",wrong:["What are hurricanes?","What are volcanoes?","What are tides?"]}
  ]},
  {name:"FAMOUS",clues:[
    {v:200,q:"This scientist developed relativity",a:"Who is Einstein?",wrong:["Who is Newton?","Who is Hawking?","Who is Galileo?"]},
    {v:400,q:"She was the first woman in space",a:"Who is Valentina Tereshkova?",wrong:["Who is Sally Ride?","Who is Mae Jemison?","Who is Amelia Earhart?"]},
    {v:600,q:"This leader said 'I have a dream'",a:"Who is Martin Luther King Jr.?",wrong:["Who is Malcolm X?","Who is Obama?","Who is Mandela?"]},
    {v:800,q:"This queen ruled for 63 years",a:"Who is Queen Victoria?",wrong:["Who is Elizabeth I?","Who is Elizabeth II?","Who is Mary?"]}
  ]},
  {name:"WEATHER",clues:[
    {v:200,q:"This scale measures tornadoes",a:"What is Fujita?",wrong:["What is Richter?","What is Beaufort?","What is Saffir?"]},
    {v:400,q:"Lightning is a form of this",a:"What is electricity?",wrong:["What is fire?","What is plasma?","What is heat?"]},
    {v:600,q:"This cloud type brings thunderstorms",a:"What is cumulonimbus?",wrong:["What is cirrus?","What is stratus?","What is cumulus?"]},
    {v:800,q:"The calm center of a hurricane",a:"What is the eye?",wrong:["What is the wall?","What is the spiral?","What is the core?"]}
  ]},
  {name:"GAMES",clues:[
    {v:200,q:"In chess the king moves this many",a:"What is one square?",wrong:["What is two squares?","What is any number?","What is three?"]},
    {v:400,q:"This card game has a joker",a:"What is poker?",wrong:["What is bridge?","What is hearts?","What is spades?"]},
    {v:600,q:"Monopoly property after Go",a:"What is Mediterranean Ave?",wrong:["What is Boardwalk?","What is Park Place?","What is Baltic?"]},
    {v:800,q:"This video game features Mario",a:"What is Super Mario?",wrong:["What is Zelda?","What is Sonic?","What is Pokemon?"]}
  ]},
  {name:"BODY",clues:[
    {v:200,q:"This organ pumps blood",a:"What is the heart?",wrong:["What is the liver?","What is the lung?","What is the brain?"]},
    {v:400,q:"Humans have this many bones",a:"What is 206?",wrong:["What is 186?","What is 226?","What is 300?"]},
    {v:600,q:"This is the largest organ",a:"What is the skin?",wrong:["What is the liver?","What is the brain?","What is the intestine?"]},
    {v:800,q:"Red blood cells carry this",a:"What is oxygen?",wrong:["What is carbon dioxide?","What is nitrogen?","What is iron?"]}
  ]},
  {name:"CARS",clues:[
    {v:200,q:"This company makes the Mustang",a:"What is Ford?",wrong:["What is Chevy?","What is Dodge?","What is Tesla?"]},
    {v:400,q:"This German brand means people's car",a:"What is Volkswagen?",wrong:["What is BMW?","What is Mercedes?","What is Audi?"]},
    {v:600,q:"Hybrid cars use gas and this",a:"What is electricity?",wrong:["What is diesel?","What is solar?","What is hydrogen?"]},
    {v:800,q:"This electric car company is led by Musk",a:"What is Tesla?",wrong:["What is Rivian?","What is Lucid?","What is Faraday?"]}
  ]},
  {name:"FLAGS",clues:[
    {v:200,q:"This country has a red maple leaf",a:"What is Canada?",wrong:["What is USA?","What is UK?","What is Australia?"]},
    {v:400,q:"The Union Jack is the flag of",a:"What is the United Kingdom?",wrong:["What is England?","What is Australia?","What is New Zealand?"]},
    {v:600,q:"This flag has a white cross on red",a:"What is Switzerland?",wrong:["What is Denmark?","What is Norway?","What is Sweden?"]},
    {v:800,q:"Japan's flag is a red circle on",a:"What is white?",wrong:["What is blue?","What is green?","What is yellow?"]}
  ]},
  {name:"CURRENCY",clues:[
    {v:200,q:"The currency of Japan is the",a:"What is the yen?",wrong:["What is the won?","What is the yuan?","What is the ringgit?"]},
    {v:400,q:"This is the currency of the UK",a:"What is the pound?",wrong:["What is the euro?","What is the dollar?","What is the franc?"]},
    {v:600,q:"The euro is used by how many countries",a:"What is about 20?",wrong:["What is 10?","What is 50?","What is 5?"]},
    {v:800,q:"This metal was once used for coins",a:"What is gold?",wrong:["What is iron?","What is copper?","What is tin?"]}
  ]}
];

var FINAL_CLUES = [
  {q:"This element has the atomic number 1",a:"What is hydrogen?",wrong:["What is helium?","What is oxygen?","What is carbon?"]},
  {q:"The year WWII ended in Europe",a:"What is 1945?",wrong:["What is 1944?","What is 1946?","What is 1939?"]},
  {q:"This city hosts the Eiffel Tower",a:"What is Paris?",wrong:["What is London?","What is Rome?","What is Berlin?"]},
  {q:"Shakespeare's tragic Danish prince",a:"Who is Hamlet?",wrong:["Who is Macbeth?","Who is Othello?","Who is Lear?"]},
  {q:"This planet is closest to the Sun",a:"What is Mercury?",wrong:["What is Venus?","What is Earth?","What is Mars?"]},
  {q:"The capital of Australia is",a:"What is Canberra?",wrong:["What is Sydney?","What is Melbourne?","What is Brisbane?"]},
  {q:"This is the chemical symbol for gold",a:"What is Au?",wrong:["What is Ag?","What is Fe?","What is Go?"]},
  {q:"Mount Everest is in this range",a:"What is the Himalayas?",wrong:["What is the Alps?","What is the Andes?","What is the Rockies?"]}
];

/* ---------- game state ---------- */
var STATE_MENU = 0, STATE_BOARD = 1, STATE_CLUE = 2, STATE_FINAL = 3, STATE_GAMEOVER = 4, STATE_HOWTO = 5, STATE_LB = 6;
var state = STATE_MENU;
var menuSel = 0, hostWk = 0, contWk = 0, LEAVE = false;
var players = [];
var curPlayer = 0;
var lastWinner = -1;
var board = [];
var selCat = 0, selVal = 0;
var curClue = null;
var isDailyDouble = false;
var isFinal = false;
var finalWager = [0, 0, 0];
var remaining = 0;
var activeCats = [];

function makePlayer(name, isHuman, pal) {
  return { name: name, isHuman: isHuman, score: 0, pal: pal };
}
function resetPlayers() {
  players = [
    makePlayer("YOU",  true,  PCT),
    makePlayer("CPU1", false, PCPU1),
    makePlayer("CPU2", false, PCPU2)
  ];
  curPlayer = 0;
  lastWinner = -1;
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

/* ---------- stage & logo ---------- */
function drawStage() {
  fr(0, 0, W, H, STAGE);
  fr(0, 0, 14, H, CURTAIN);
  fr(W - 14, 0, 14, H, CURTAIN);
  var i;
  for (i = 0; i < 5; i++) {
    fr(2 + i * 2, 0, 1, H, rgb(120, 10, 30));
    fr(W - 13 + i * 2, 0, 1, H, rgb(120, 10, 30));
  }
  fr(14, 0, W - 28, 6, GOLD);
  fr(14, H - 22, W - 28, 22, FLOOR);
  fr(14, H - 22, W - 28, 2, rgb(80, 100, 160));
  for (i = 0; i < 10; i++) {
    audience(22 + i * 28 + ((i & 1) ? 3 : 0), H - 6);
  }
}
function drawLogoBox() {
  fr(50, 10, W - 100, 36, RED);
  rc(50, 10, W - 100, 36, GOLD);
  rc(51, 11, W - 102, 34, rgb(200, 160, 20));
}
function drawLogo() {
  drawLogoBox();
  sctxt("JEOPARDIZE", 16, 2, WHITE, BLACK);
  sctxt("by da cbm", 34, 1, GOLD, BLACK);
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
  fr(14, 84, Math.max(1, hx + 16 - 14), 54, STAGE);
  fr(W - hx - 16, 84, Math.max(1, W - 14 - (W - hx - 16)), 54, STAGE);
  man(hx, H - 30, 1, wk, PHST);
  man(W - hx, H - 30, -1, wk, PCT);
}
function intro() {
  var f, hx, wk = 0, k, tn, lastAnim, blink = 0;
  introSkip = false;
  ENC_GAP_MS = MENU_GAP; ENC_REV_MS = MENU_REV;
  settleInput();

  cls(BLACK);
  if (introFade([["da cbm", 62, 2, 255, 210, 40], ["presents", 88, 1, 150, 150, 165]], 6)) { return; }
  if (ipause(500)) { return; }
  cls(BLACK);
  if (ipause(200)) { return; }

  drawStage();
  beep(400, 50); beep(600, 50); beep(900, 80);
  if (ipause(250)) { return; }
  drawLogoBox();
  sctxt("JEOPARDIZE", 16, 2, WHITE, BLACK);
  beep(700, 80);
  if (ipause(400)) { return; }
  sctxt("by da cbm", 34, 1, GOLD, BLACK);
  beep(300, 100); beep(180, 140);
  if (ipause(200)) { return; }

  fr(0, 0, W, H, WHITE);
  beep(90, 160);
  if (ipause(60)) { return; }
  drawStage();
  drawLogo();
  ctxt("This is... Jeopardize!", 58, 1, CYAN);
  if (ipause(400)) { return; }

  for (f = 0; f < 18; f++) {
    hx = 22 + f * 2;
    wk = (f >> 1) & 3;
    introMen(hx, wk);
    if (ipause(30)) { return; }
  }
  foot("SEL: start    ESC: skip");

  lastAnim = nowMs(); wk = 0;
  while (true) {
    k = inp();
    if (k === 3 || k === 4) { break; }
    tn = nowMs();
    if (tn - lastAnim > 450) {
      lastAnim = tn;
      wk = (wk + 1) & 3;
      blink = 1 - blink;
      introMen(60, wk);
      fr(0, H - 14, W, 14, rgb(6, 12, 24));
      if (blink) { ctxt("PRESS SEL TO PLAY", H - 11, 1, YEL); }
      else { ctxt("PRESS SEL TO PLAY", H - 11, 1, GRAY); }
    }
    wait(30);
  }
  settleInput();
}

/* ---------- menu / how-to / leaderboard ---------- */
function drawMenuChars() {
  fr(50, 84, 34, 54, STAGE);
  fr(W - 70 - 16, 84, 34, 54, STAGE);
  man(66, H - 30, 1, hostWk, PHST);
  man(W - 66, H - 30, -1, contWk, PCT);
}
function drawMenuButtons() {
  var opts = ["PLAY GAME", "HOW TO PLAY", "LEADERBOARD", "SOUND: " + (SOUND ? "ON" : "OFF"), "EXIT"];
  var i, by, sel;
  for (i = 0; i < 5; i++) {
    by = 72 + i * 14;
    sel = (i === menuSel);
    fr(88, by - 2, W - 176, 12, sel ? GOLD : rgb(20, 30, 70));
    rc(88, by - 2, W - 176, 12, sel ? GOLD : GRAY);
    txt(opts[i], 98, by, 1, sel ? BLACK : WHITE);
  }
}
function drawMenu() {
  ENC_GAP_MS = MENU_GAP; ENC_REV_MS = MENU_REV;
  drawStage();
  drawLogo();
  ctxt("Best: $" + bestScore, 50, 1, YEL);
  man(66, H - 30, 1, hostWk, PHST);
  man(W - 66, H - 30, -1, contWk, PCT);
  drawMenuButtons();
  foot("Turn: select   SEL: ok   ESC: quit");
}
function drawHowTo() {
  cls(DARK);
  fr(0, 0, W, 20, HDR);
  ctxt("HOW TO PLAY", 4, 2, WHITE);
  var lines = [
    "3 players: YOU + CPU1 + CPU2",
    "YOU always choose the answers.",
    "CPU1 and CPU2 answer AUTOMATICALLY",
    "(no button press needed for them).",
    "Turn knob to move, SEL to confirm.",
    "Pick a CATEGORY and VALUE on board.",
    "Read the clue, then pick the answer.",
    "Answers are in the form of a question.",
    "Correct = +$value   Wrong = -$value",
    "Wrong answer loses your turn.",
    "Daily Double = higher risk/reward!",
    "Clear the board for FINAL JEOPARDIZE.",
    "Highest score wins. ESC = pause.",
    "HOLD ESC for 3 seconds = quit game."
  ];
  var i;
  for (i = 0; i < lines.length; i++) {
    txt(lines[i], 6, 24 + i * 10, 1, (i >= lines.length - 2) ? YEL : WHITE);
  }
}
function drawLeaderboard() {
  cls(DARK);
  fr(0, 0, W, 20, HDR);
  ctxt("ALL-TIME LEADERBOARD", 4, 2, WHITE);
  if (LEADERBOARD.length === 0) {
    ctxt("No scores yet", 70, 2, GRAY);
    ctxt("Play a game!", 95, 1, YEL);
  } else {
    var i, y, entry, col;
    for (i = 0; i < LEADERBOARD.length && i < 8; i++) {
      entry = LEADERBOARD[i];
      y = 28 + i * 14;
      col = (i === 0) ? GOLD : WHITE;
      txt((i + 1) + ". " + entry.name, 20, y, 1, col);
      txt("$" + entry.score, 200, y, 1, col);
    }
  }
  foot("SEL / ESC: back");
}

/* ---------- HUD ---------- */
function drawHUD() {
  fr(14, 6, W - 28, 18, rgb(8, 12, 30));
  var i, px, p, col;
  for (i = 0; i < 3; i++) {
    p = players[i];
    px = 18 + i * 96;
    col = (i === curPlayer) ? GOLD : WHITE;
    txt(p.name, px, 7, 1, col);
    txt("$" + p.score, px, 16, 1, col);
  }
}

/* ---------- BOARD ---------- */
function initBoard() {
  var allIdx = shuffleIndex(CATS.length);
  activeCats = [];
  var i;
  for (i = 0; i < 5; i++) { activeCats.push(allIdx[i]); }

  board = [];
  remaining = 0;
  var c, v, ddCat, ddVal;
  ddCat = ri(0, 4);
  ddVal = ri(2, 3);
  for (c = 0; c < 5; c++) {
    board[c] = [];
    for (v = 0; v < 4; v++) {
      board[c][v] = { taken: false, dd: (c === ddCat && v === ddVal) };
      remaining++;
    }
  }
  selCat = 0; selVal = 0;
}

function catName(c) {
  return CATS[activeCats[c]].name;
}
function getClue(c, v) {
  return CATS[activeCats[c]].clues[v];
}

function drawBoard() {
  ENC_GAP_MS = MENU_GAP; ENC_REV_MS = MENU_REV;
  drawStage();
  drawHUD();

  var c, v, x, y, cell, col, valStr;
  for (c = 0; c < 5; c++) {
    x = 16 + c * 58;
    fr(x, 26, 56, 14, JEOP);
    rc(x, 26, 56, 14, GOLD);
    txt(catName(c).substring(0, 8), x + 2, 29, 1, WHITE);
  }

  for (c = 0; c < 5; c++) {
    for (v = 0; v < 4; v++) {
      x = 16 + c * 58;
      y = 42 + v * 22;
      cell = board[c][v];
      if (cell.taken) {
        fr(x, y, 56, 20, rgb(15, 20, 40));
        rc(x, y, 56, 20, GRAY);
      } else {
        col = (c === selCat && v === selVal) ? GOLD : TILE;
        fr(x, y, 56, 20, col);
        rc(x, y, 56, 20, (c === selCat && v === selVal) ? WHITE : CYAN);
        valStr = "$" + getClue(c, v).v;
        if (cell.dd) { valStr = "DD"; }
        txt(valStr, x + 14, y + 4, 1, (c === selCat && v === selVal) ? BLACK : WHITE);
      }
    }
  }

  man(20, H - 28, 1, 0, PHST);
  man(W - 20, H - 28, -1, 0, players[curPlayer].pal);

  if (players[curPlayer].isHuman) {
    setStatus(players[curPlayer].name + " - pick a clue!", WHITE);
    foot("Turn: move   SEL: choose   ESC: pause");
  } else {
    fr(40, 132, 240, 12, rgb(15, 20, 45));
    ctxt(players[curPlayer].name + " is choosing...", 134, 1, YEL);
    foot("Please wait...");
  }
}

function setStatus(msg, col) {
  fr(40, 132, 240, 12, STAGE);
  ctxt(msg, 134, 1, col);
}

/* ---------- CLUE display ---------- */
/* autoContinue = true → timed, no button (CPU) */
function showClueScreen(autoContinue) {
  drawStage();
  drawHUD();
  fr(20, 28, W - 40, 100, BLACK);
  rc(20, 28, W - 40, 100, GOLD);

  var title = isDailyDouble ? "DAILY DOUBLE!" : (isFinal ? "FINAL JEOPARDIZE" : catName(selCat) + "  $" + curClue.v);
  ctxt(title, 34, 1, isDailyDouble ? GOLD : CYAN);

  var words = curClue.q.split(" "), line = "", lines = [], i;
  for (i = 0; i < words.length; i++) {
    if (line.length === 0) { line = words[i]; }
    else if (line.length + 1 + words[i].length <= 28) { line += " " + words[i]; }
    else { lines.push(line); line = words[i]; }
  }
  if (line.length > 0) { lines.push(line); }
  for (i = 0; i < lines.length && i < 4; i++) {
    ctxt(lines[i], 52 + i * 14, 1, WHITE);
  }

  if (autoContinue) {
    foot(players[curPlayer].name + " answering...");
    wait(1400);
  } else {
    foot("SEL: continue");
    waitKey();
    settleInput();
  }
}

/* Word-wrap helper for the clue text */
function wrapText(str, maxc) {
  var words = String(str).split(" "), line = "", out = [], i;
  for (i = 0; i < words.length; i++) {
    if (line.length === 0) { line = words[i]; }
    else if (line.length + 1 + words[i].length <= maxc) { line += " " + words[i]; }
    else { out.push(line); line = words[i]; }
  }
  if (line.length > 0) { out.push(line); }
  return out;
}

/* Answer picker that keeps the clue on screen while you choose */
function answerMenu(items) {
  var n = items.length, idx = 0, full = true, rows = true;
  var i, y, sel, k, len, qlines, hdr;
  qlines = wrapText(curClue.q, 50);
  hdr = isDailyDouble ? "DAILY DOUBLE!" : (isFinal ? "FINAL JEOPARDIZE" : catName(selCat) + "  $" + curClue.v);
  ENC_GAP_MS = MENU_GAP; ENC_REV_MS = MENU_REV;
  drainEnc();
  while (true) {
    if (full) {
      cls(DARK);
      fr(0, 0, W, 14, HDR);
      txt(hdr, 6, 3, 1, isDailyDouble ? GOLD : WHITE);
      txt(players[curPlayer].name + "  $" + players[curPlayer].score, W - 6 - (players[curPlayer].name.length + String(players[curPlayer].score).length + 3) * 6, 3, 1, YEL);
      fr(2, 16, W - 4, 40, BLACK);
      rc(2, 16, W - 4, 40, GOLD);
      for (i = 0; i < qlines.length && i < 3; i++) {
        txt(qlines[i], 8, 20 + i * 11, 1, CREAM);
      }
      foot("Turn: move  SEL: answer");
      full = false; rows = true;
    }
    if (rows) {
      for (i = 0; i < n; i++) {
        y = 59 + i * 23;
        sel = (i === idx);
        fr(2, y - 2, W - 4, 21, sel ? rgb(40, 120, 190) : DARK);
        len = String(items[i]).length;
        if (len <= 25) {
          txt(items[i], 8, y + 1, 2, sel ? WHITE : rgb(170, 210, 240));
        } else {
          txt(items[i], 8, y + 5, 1, sel ? WHITE : rgb(170, 210, 240));
        }
      }
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

function pickAnswerForHuman() {
  var opts = [curClue.a];
  var i, r, order;
  for (i = 0; i < 3; i++) { opts.push(curClue.wrong[i]); }
  order = shuffleIndex(4);
  var shuffled = [];
  for (i = 0; i < 4; i++) { shuffled.push(opts[order[i]]); }
  var correctIdx = -1;
  for (i = 0; i < 4; i++) {
    if (shuffled[i] === curClue.a) { correctIdx = i; break; }
  }

  r = answerMenu(shuffled);
  if (r < 0) { return -1; }
  return (r === correctIdx) ? 1 : 0;
}

function cpuAnswerCorrect() {
  var chance = 0.58 - (curClue.v / 2200) + (rnd() * 0.22);
  if (isFinal) { chance = 0.42 + rnd() * 0.28; }
  if (isDailyDouble) { chance -= 0.08; }
  return (rnd() < chance);
}

/* ---------- game flow ---------- */
function startGame() {
  resetPlayers();
  initBoard();
  isFinal = false;
  isDailyDouble = false;
  finalWager = [0, 0, 0];
  curPlayer = ri(0, 2);
  state = STATE_BOARD;
  drawBoard();
  if (!players[curPlayer].isHuman) {
    wait(500);
    doCpuTurn();
  }
}

function nextPlayer() {
  curPlayer = (curPlayer + 1) % 3;
}

/* Track who has already tried the current clue (for steals) */
var attempted = [false, false, false];
var clueController = 0; /* who selected the clue / who keeps control */

function clueValue() {
  if (isFinal) return finalWager[curPlayer];
  return isDailyDouble ? (curClue.v * 2) : curClue.v;
}

function markClueTaken() {
  if (!isFinal) {
    board[selCat][selVal].taken = true;
    remaining--;
  }
}

function finishClueAndContinue() {
  /* Board control stays with curPlayer (the one who got it right, or next after all miss) */
  state = STATE_BOARD;
  drawBoard();

  if (remaining <= 0) {
    popup([["BOARD CLEARED!", 2, CYAN], ["Time for FINAL JEOPARDIZE", 1, WHITE], ["Good luck!", 1, GOLD]], CYAN);
    startFinal();
    return;
  }

  if (!players[curPlayer].isHuman) {
    wait(450);
    doCpuTurn();
  }
}

/* Offer the same clue to the next eligible player who has not yet attempted it */
function offerSteal() {
  var tries = 0;
  while (tries < 3) {
    nextPlayer();
    tries++;
    if (!attempted[curPlayer]) {
      attempted[curPlayer] = true;
      return true; /* found someone who can still try */
    }
  }
  return false; /* everyone already tried */
}

/* CPU got it right: show the correct answer on screen for 2 seconds */
function showCpuWinAnswer(p) {
  var lines = wrapText(curClue.a, 40), i, big = (curClue.a.length <= 22);
  fr(25, 30, W - 50, 100, BLACK);
  rc(25, 30, W - 50, 100, GREEN);
  rc(26, 31, W - 52, 98, GREEN);
  ctxt(p.name + " got it!", 38, 2, GREEN);
  ctxt("Correct answer:", 62, 1, YEL);
  if (big) {
    ctxt(curClue.a, 82, 2, WHITE);
  } else {
    for (i = 0; i < lines.length && i < 3; i++) {
      ctxt(lines[i], 80 + i * 12, 1, WHITE);
    }
  }
  foot(p.name + " answered correctly");
  wait(2000);
}

function resolveAnswer(correct) {
  var p = players[curPlayer];
  var val = clueValue();

  if (correct) {
    p.score += val;
    beep(784, 60); beep(1047, 60); beep(1319, 100);
    if (!p.isHuman) { showCpuWinAnswer(p); }
    flash("CORRECT!  +$" + val, GREEN);
    markClueTaken();
    /* correct player keeps board control */
    finishClueAndContinue();
    return;
  }

  /* Wrong */
  p.score -= val;
  if (p.score < 0) p.score = 0;
  beep(200, 180); beep(150, 220);
  flash("WRONG!  -$" + val, RED);

  if (isFinal) {
    return; /* Final handled separately */
  }

  /* Give other players a chance to steal the same clue */
  if (offerSteal()) {
    /* Someone else gets a shot at the same clue */
    doAnswerAttempt();
  } else {
    /* All three missed – reveal the correct answer, then move on */
    markClueTaken();
    popup([
      ["NO ONE GOT IT!", 2, RED],
      ["Correct answer:", 1, YEL],
      [curClue.a, 1, WHITE],
      ["Moving on...", 1, GRAY]
    ], RED);
    curPlayer = nextPlayerAfter(clueController);
    finishClueAndContinue();
  }
}

function nextPlayerAfter(from) {
  return (from + 1) % 3;
}

/* One player attempts the current clue (human menu or CPU auto) */
function doAnswerAttempt() {
  var p = players[curPlayer];

  if (p.isHuman) {
    /* Human gets to see the clue again (or first time) and pick answer */
    showClueScreen(false);
    var result = pickAnswerForHuman();
    if (result < 0) result = 0; /* cancel = wrong */
    resolveAnswer(result === 1);
  } else {
    /* CPU automatic */
    showClueScreen(true);
    wait(300);
    var ok = cpuAnswerCorrect();
    resolveAnswer(ok);
  }
}

function startFinal() {
  isFinal = true;
  state = STATE_FINAL;
  var fi = ri(0, FINAL_CLUES.length - 1);
  curClue = FINAL_CLUES[fi];
  curClue.v = 0;

  if (players[0].score > 0) {
    var maxW = players[0].score;
    var choices = ["Wager $0", "Wager $" + Math.floor(maxW * 0.25),
                   "Wager $" + Math.floor(maxW * 0.5), "Wager all $" + maxW];
    var amounts = [0, Math.floor(maxW * 0.25), Math.floor(maxW * 0.5), maxW];
    var r = menu("FINAL WAGER (YOU)", choices, 2, null);
    if (r < 0) r = 0;
    finalWager[0] = amounts[r];
  } else {
    finalWager[0] = 0;
  }

  for (var i = 1; i < 3; i++) {
    if (players[i].score > 0) {
      finalWager[i] = Math.floor(players[i].score * (0.25 + rnd() * 0.75));
    } else {
      finalWager[i] = 0;
    }
  }

  showClueScreen(false);

  /* Human answers first if eligible */
  if (players[0].score > 0 || finalWager[0] > 0) {
    curPlayer = 0;
    var humanResult = pickAnswerForHuman();
    if (humanResult < 0) humanResult = 0;
    resolveAnswer(humanResult === 1);
  }

  /* CPUs answer automatically */
  for (var c = 1; c < 3; c++) {
    if (players[c].score > 0 || finalWager[c] > 0) {
      curPlayer = c;
      drawStage();
      drawHUD();
      fr(40, 60, W - 80, 40, BLACK);
      rc(40, 60, W - 80, 40, YEL);
      ctxt(players[c].name + " answering...", 78, 1, YEL);
      wait(900);
      var cpuOk = cpuAnswerCorrect();
      resolveAnswer(cpuOk);
    }
  }

  endGame();
}

function doCpuTurn() {
  if (state !== STATE_BOARD) { return; }
  if (players[curPlayer].isHuman) { return; }

  var tries = 0, c, v, found = false;
  while (tries < 40 && !found) {
    c = ri(0, 4);
    v = ri(0, 3);
    if (!board[c][v].taken) {
      if (rnd() < 0.35 || v >= 2) { found = true; }
    }
    tries++;
  }
  if (!found) {
    for (c = 0; c < 5 && !found; c++) {
      for (v = 0; v < 4; v++) {
        if (!board[c][v].taken) { found = true; break; }
      }
    }
  }
  if (!found) { return; }

  selCat = c; selVal = v;
  drawBoard();
  wait(600);
  selectClue();
}

function selectClue() {
  if (board[selCat][selVal].taken) { return; }
  curClue = getClue(selCat, selVal);
  isDailyDouble = board[selCat][selVal].dd;
  state = STATE_CLUE;

  /* Reset attempt tracking for this clue */
  attempted = [false, false, false];
  clueController = curPlayer;
  attempted[curPlayer] = true;

  if (isDailyDouble) {
    beep(600, 80); beep(900, 120);
    popup([["DAILY DOUBLE!", 2, GOLD], ["Values are DOUBLED", 1, WHITE], ["Risk it!", 1, YEL]], GOLD);
  }

  /* First attempt by the player who selected the clue */
  doAnswerAttempt();
}

function endGame() {
  var bestP = 0, i;
  for (i = 1; i < 3; i++) {
    if (players[i].score > players[bestP].score) { bestP = i; }
  }
  lastWinner = bestP;

  addToLeaderboard("YOU", players[0].score);
  if (players[1].score > 0) addToLeaderboard("CPU1", players[1].score);
  if (players[2].score > 0) addToLeaderboard("CPU2", players[2].score);

  state = STATE_GAMEOVER;
  drawGameOver();
}

function drawGameOver() {
  ENC_GAP_MS = MENU_GAP; ENC_REV_MS = MENU_REV;
  drawStage();
  fr(40, 8, W - 80, 22, RED);
  rc(40, 8, W - 80, 22, GOLD);
  sctxt(lastWinner === 0 ? "YOU WIN!" : "GAME OVER", 12, 2, GOLD, BLACK);

  var i, y0 = 38;
  for (i = 0; i < 3; i++) {
    var col = (i === lastWinner) ? GOLD : WHITE;
    txt(players[i].name + "  $" + players[i].score, 70, y0 + i * 14, 1, col);
    if (i === lastWinner) { txt("WINNER", 210, y0 + i * 14, 1, GREEN); }
  }

  var grade, gcol, sc = players[0].score;
  if (sc >= 6000)      { grade = "JEOPARDY CHAMP!"; gcol = GOLD; }
  else if (sc >= 4000) { grade = "DOUBLE CHAMPION"; gcol = GREEN; }
  else if (sc >= 2000) { grade = "SOLID PLAYER";    gcol = BLUE; }
  else if (sc >= 800)  { grade = "NEEDS PRACTICE";  gcol = ORNG; }
  else                 { grade = "TOTAL BUZZ-OUT";  gcol = VIOLET; }
  ctxt(grade, 92, 1, gcol);

  if (LEADERBOARD.length > 0) {
    ctxt("All-time best: $" + bestScore, 108, 1, YEL);
  }

  man(36, H - 28, 1, 0, PHST);
  man(W - 36, H - 28, -1, 0, players[0].pal);
  fr(W / 2 - 60, 122, 120, 16, GOLD);
  ctxt("PLAY AGAIN", 126, 1, BLACK);
  foot("SEL: menu   ESC: exit game");
}

/* ---------- Pause menu ---------- */
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
  loadLeaderboard();
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
      if (k === 1) { menuSel = (menuSel + 1) % 5; drawMenuButtons(); }
      else if (k === 2) { menuSel = (menuSel + 4) % 5; drawMenuButtons(); }
      else if (k === 3) {
        settleInput();
        if (menuSel === 0) { startGame(); }
        else if (menuSel === 1) { state = STATE_HOWTO; drawHowTo(); }
        else if (menuSel === 2) { state = STATE_LB; drawLeaderboard(); }
        else if (menuSel === 3) { SOUND = !SOUND; drawMenuButtons(); }
        else if (menuSel === 4) {
          if (confirmBox("Exit the game?")) { LEAVE = true; }
          else { drawMenu(); }
        }
      } else if (k === 4) {
        if (confirmBox("Exit the game?")) { LEAVE = true; }
        else { drawMenu(); }
      }
    }
    else if (state === STATE_HOWTO || state === STATE_LB) {
      if (k === 3 || k === 4) {
        settleInput();
        state = STATE_MENU;
        drawMenu();
      }
    }
    else if (state === STATE_BOARD) {
      if (players[curPlayer].isHuman) {
        if (k === 1) {
          if (selVal < 3) { selVal++; }
          else { selVal = 0; selCat = (selCat + 1) % 5; }
          var guard = 0;
          while (board[selCat][selVal].taken && guard < 20) {
            if (selVal < 3) { selVal++; }
            else { selVal = 0; selCat = (selCat + 1) % 5; }
            guard++;
          }
          drawBoard();
        }
        else if (k === 2) {
          if (selVal > 0) { selVal--; }
          else { selVal = 3; selCat = (selCat + 4) % 5; }
          var guard2 = 0;
          while (board[selCat][selVal].taken && guard2 < 20) {
            if (selVal > 0) { selVal--; }
            else { selVal = 3; selCat = (selCat + 4) % 5; }
            guard2++;
          }
          drawBoard();
        }
        else if (k === 3) {
          settleInput();
          if (!board[selCat][selVal].taken) {
            selectClue();
          }
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
  ctxt("Thanks for playing!", 58, 2, WHITE);
  ctxt("Jeopardize", 86, 1, GOLD);
  ctxt("by da cbm", 100, 1, CYAN);
  wait(1000);
}

/* boot */
try {
  run();
} catch (err) {
  if (err === "HOLD_QUIT") {
    try {
      cls(BLACK);
      ctxt("Thanks for playing!", 58, 2, WHITE);
      ctxt("Jeopardize", 86, 1, GOLD);
      ctxt("by da cbm", 100, 1, CYAN);
      delay(1000);
    } catch (e3) {}
  } else try {
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
