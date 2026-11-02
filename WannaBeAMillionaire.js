/*
 * WANNA BE A MILLIONAIRE  v1.0   -   by da cbm
 * Quiz game for Bruce firmware
 * Target: LilyGO T-Embed CC1101 (320x170, rotary encoder)
 *
 * Controls:  Turn = move   Click = select / lock answer   Back = walk away
 *
 * 15 questions per game from a pool of 75, safe havens at Q5 ($1,000) and Q10 ($32,000).
 * Progress auto-saves after every correct answer; BACK opens Resume / Save & Quit / Walk Away.
 * Lifelines: 50:50, Phone a Friend, Ask the Audience.
 *
 * Plain ES5 (no arrow functions, no let/const, no template strings,
 * no nested functions). Same stable display / input layer as Golden Ace Casino.
 */
(function () {

/* ------------------------------------------------------------------ */
/* Modules                                                             */
/* ------------------------------------------------------------------ */
var D = null, K = null, A = null, S = null;
try { D = require('display'); } catch (e1) {}
try { K = require('keyboard'); } catch (e2) {}
try { A = require('audio'); } catch (e3) {}
try { S = require('storage'); } catch (e4) {}
if (!S && typeof storage !== 'undefined') S = storage;
if (!D && typeof display !== 'undefined') D = display;
if (!K && typeof keyboard !== 'undefined') K = keyboard;
if (!A && typeof audio !== 'undefined') A = audio;
if (!D || !K) { try { console.log('display/keyboard module missing'); } catch (e5) {} return; }

var W = 320, H = 170;
try { var ww = D.width(), hh = D.height(); if (ww > 100 && hh > 100) { W = ww; H = hh; } } catch (e6) {}

var HAS_FRR = false, HAS_RR = false, HAS_C = false, HAS_FC = false, HAS_L = false;
try { HAS_FRR = typeof D.drawFillRoundRect === 'function'; } catch (e7) {}
try { HAS_RR = typeof D.drawRoundRect === 'function'; } catch (e8) {}
try { HAS_C = typeof D.drawCircle === 'function'; } catch (e9) {}
try { HAS_FC = typeof D.drawFillCircle === 'function'; } catch (e10) {}
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

var soundOn = true, lastBeep = 0;
function beep(f, d) {
  var t;
  if (!soundOn || !A) return;
  t = ms();
  if (t - lastBeep < 30) return;
  lastBeep = t;
  try { A.tone(f, d); } catch (e) {}
}
function tune(seq) {
  var i;
  if (!soundOn || !A) return;
  for (i = 0; i < seq.length; i++) { try { A.tone(seq[i][0], seq[i][1]); } catch (e) {} sleep(seq[i][1]); }
}
function sndMove() { }
function sndClick() { beep(1000, 10); }
function sndLock() { tune([[440, 90], [554, 90], [659, 140]]); }
function sndWin() { tune([[784, 70], [1047, 70], [1568, 140]]); }
function sndBig() { tune([[659, 80], [784, 80], [988, 80], [1319, 80], [1568, 80], [2093, 220], [1568, 80], [2093, 300]]); }
function sndLose() { tune([[330, 140], [294, 140], [262, 300]]); }
function sndErr() { beep(200, 80); }
function sndLife() { beep(1175, 60); }

/* ------------------------------------------------------------------ */
/* Colours                                                             */
/* ------------------------------------------------------------------ */
function rgb(r, g, b) { return ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3); }
var WHITE = rgb(255, 255, 255), BLACK = rgb(0, 0, 0);
var GOLD = rgb(255, 205, 60), ORANGE = rgb(255, 140, 0), CYAN = rgb(60, 220, 255), MAG = rgb(255, 70, 210);
var GREEN = rgb(0, 190, 70), LGREEN = rgb(120, 255, 130), RED = rgb(215, 30, 40), LRED = rgb(255, 120, 110);
var NAVY = rgb(18, 26, 120), NAVY2 = rgb(8, 6, 44), EDGE = rgb(120, 160, 255), GRAY = rgb(60, 60, 84);
var CONF = [rgb(255, 80, 80), rgb(255, 205, 60), rgb(80, 255, 120), rgb(80, 200, 255), rgb(255, 90, 220), rgb(255, 255, 255)];

function hue(t) {
  var s = Math.floor(t * 6) % 6, f = Math.floor((t * 6 - Math.floor(t * 6)) * 255);
  if (s === 0) return rgb(255, f, 0);
  if (s === 1) return rgb(255 - f, 255, 0);
  if (s === 2) return rgb(0, 255, f);
  if (s === 3) return rgb(0, 255 - f, 255);
  if (s === 4) return rgb(f, 0, 255);
  return rgb(255, 0, 255 - f);
}

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
function txt(s, x, y, sz, c) {
  try { D.setTextSize(sz); D.setTextColor(c); D.drawString(String(s), Math.floor(x), Math.floor(y)); } catch (e) {}
}
function tw(s, sz) { return String(s).length * 6 * sz; }
function ctxt(s, cx, y, sz, c) { txt(s, cx - tw(s, sz) / 2, y, sz, c); }
function rtxt(s, rx, y, sz, c) { txt(s, rx - tw(s, sz), y, sz, c); }
function fmt(n) {
  var s = String(n), o = '', i, c = 0;
  for (i = s.length - 1; i >= 0; i--) { o = s.charAt(i) + o; c++; if (c % 3 === 0 && i > 0) o = ',' + o; }
  return '$' + o;
}
function bg() {
  var y, t;
  for (y = 0; y < H; y += 6) {
    t = y / H;
    fillRect(0, y, W, 6, rgb(10 + 34 * t, 4 + 6 * t, 66 + 46 * t));
  }
}

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

/* ------------------------------------------------------------------ */
/* Questions: 'question|CORRECT|wrong|wrong|wrong'  (3 per level)      */
/* Answer order is shuffled at play time.                              */
/* ------------------------------------------------------------------ */
var PRIZE = [100, 200, 300, 500, 1000, 2000, 4000, 8000, 16000, 32000, 64000, 125000, 250000, 500000, 1000000];
var RAW = [
  'What color do you get by mixing blue and yellow?|Green|Purple|Orange|Brown',
  'How many days are in a leap year?|366|365|364|367',
  'Which animal is known as the king of the jungle?|Lion|Tiger|Bear|Wolf',
  'What is the capital of France?|Paris|Rome|Madrid|Berlin',
  'How many legs does a spider have?|Eight|Six|Ten|Twelve',
  'Which planet is known as the Red Planet?|Mars|Venus|Jupiter|Saturn',
  'Which gas do plants absorb from the air?|Carbon dioxide|Oxygen|Helium|Nitrogen',
  'How many strings does a standard guitar have?|Six|Four|Five|Eight',
  'Which ocean is the largest?|Pacific|Atlantic|Indian|Arctic',
  'Who painted the Mona Lisa?|Leonardo da Vinci|Michelangelo|Raphael|Picasso',
  'What is the chemical symbol for gold?|Au|Ag|Go|Gd',
  'How many continents are there?|Seven|Five|Six|Eight',
  'In which country is the Great Pyramid of Giza?|Egypt|Mexico|Peru|Iraq',
  'What is the hardest natural substance?|Diamond|Quartz|Steel|Granite',
  'Which element has the atomic number 1?|Hydrogen|Helium|Oxygen|Carbon',
  'Who wrote the play Romeo and Juliet?|William Shakespeare|Charles Dickens|Mark Twain|Jane Austen',
  'What is the largest mammal on Earth?|Blue whale|African elephant|Giraffe|Hippopotamus',
  'In what year did the Titanic sink?|1912|1905|1920|1931',
  'What is the smallest prime number?|2|0|1|3',
  'Which country gave the Statue of Liberty to the USA?|France|England|Spain|Italy',
  'How many players does one soccer team have on the field?|Eleven|Ten|Nine|Twelve',
  'What is the capital of Australia?|Canberra|Sydney|Melbourne|Perth',
  'Which blood type is known as the universal donor?|O negative|AB positive|A positive|B negative',
  'Who developed the theory of general relativity?|Albert Einstein|Isaac Newton|Niels Bohr|Galileo',
  'What is the longest river in South America?|Amazon|Orinoco|Parana|Magdalena',
  'Which metal is liquid at room temperature?|Mercury|Lead|Tin|Zinc',
  'Who composed The Four Seasons?|Vivaldi|Mozart|Bach|Chopin',
  'Which is the largest hot desert in the world?|Sahara|Gobi|Kalahari|Mojave',
  'In computing, what does CPU stand for?|Central Processing Unit|Core Power Unit|Computer Primary Unit|Central Program Utility',
  'Who was the first person to walk on the Moon?|Neil Armstrong|Buzz Aldrin|Yuri Gagarin|John Glenn',
  'What is the capital of Canada?|Ottawa|Toronto|Vancouver|Montreal',
  'Which scientist discovered penicillin?|Alexander Fleming|Louis Pasteur|Marie Curie|Joseph Lister',
  'How many bones are in the adult human body?|206|186|226|256',
  'Which painter cut off part of his own ear?|Vincent van Gogh|Claude Monet|Salvador Dali|Paul Cezanne',
  'What is the square root of 144?|12|14|11|13',
  'Which city hosted the 2016 Summer Olympics?|Rio de Janeiro|London|Beijing|Tokyo',
  'What is the smallest country in the world by area?|Vatican City|Monaco|San Marino|Malta',
  'Who wrote the novel 1984?|George Orwell|Aldous Huxley|Ray Bradbury|H.G. Wells',
  'About how fast is light, in km per second?|300,000|150,000|30,000|3,000,000',
  'Which element has the chemical symbol W?|Tungsten|Titanium|Zinc|Vanadium',
  'In which year did the Berlin Wall fall?|1989|1991|1985|1979',
  'Who was the first woman to win a Nobel Prize?|Marie Curie|Mother Teresa|Rosalind Franklin|Ada Lovelace',
  'What is the capital of Kazakhstan?|Astana|Almaty|Tashkent|Bishkek',
  'Which Roman emperor legalized Christianity with the Edict of Milan?|Constantine|Nero|Augustus|Hadrian',
  'Which planet has the shortest day in the solar system?|Jupiter|Mercury|Mars|Saturn'
];

var EXTRA = [
  'How many sides does a triangle have?|Three|Four|Five|Two',
  'Which fruit is used to make most wine?|Grapes|Bananas|Apples|Oranges',
  'What do we call frozen water?|Ice|Steam|Fog|Dew',
  'Which season comes after summer?|Autumn|Winter|Spring|Monsoon',
  'What is the largest planet in our solar system?|Jupiter|Saturn|Neptune|Earth',
  'Which instrument has 88 keys?|Piano|Guitar|Harp|Flute',
  'What is H2O commonly known as?|Water|Salt|Hydrogen|Peroxide',
  'Which country is home to the kangaroo?|Australia|Brazil|India|Kenya',
  'In which US state is the Grand Canyon?|Arizona|Nevada|Utah|Colorado',
  'What is the main language spoken in Brazil?|Portuguese|Spanish|English|French',
  'Which scientist is famous for the laws of motion?|Isaac Newton|Albert Einstein|Charles Darwin|Nikola Tesla',
  'What is the capital of Japan?|Tokyo|Kyoto|Osaka|Seoul',
  'How many sides does a hexagon have?|Six|Five|Seven|Eight',
  'Which organ pumps blood around the body?|Heart|Liver|Lungs|Kidney',
  'Which planet is closest to the Sun?|Mercury|Venus|Earth|Mars',
  'Who painted The Persistence of Memory?|Salvador Dali|Rene Magritte|Joan Miro|Max Ernst',
  'What is the currency of Japan?|Yen|Won|Yuan|Ringgit',
  'What is the most abundant gas in Earth\'s air?|Nitrogen|Oxygen|Argon|Carbon dioxide',
  'Which mountain is tallest above sea level?|Mount Everest|K2|Kilimanjaro|Denali',
  'In what year did World War II end?|1945|1943|1918|1950',
  'What is the largest organ of the human body?|Skin|Liver|Brain|Lungs',
  'Who is credited with writing The Odyssey?|Homer|Virgil|Sophocles|Plato',
  'What is the chemical symbol for sodium?|Na|So|Sd|S',
  'In which country is the city of Timbuktu?|Mali|Niger|Chad|Sudan',
  'Who painted the Sistine Chapel ceiling?|Michelangelo|Raphael|Leonardo da Vinci|Donatello',
  'What is the capital of Turkey?|Ankara|Istanbul|Izmir|Bursa',
  'Which planet has the moon Titan?|Saturn|Jupiter|Uranus|Neptune',
  'Who was the first Emperor of Rome?|Augustus|Julius Caesar|Nero|Caligula',
  'What is the capital of Bhutan?|Thimphu|Kathmandu|Dhaka|Paro',
  'Who proved Fermat\'s Last Theorem in the 1990s?|Andrew Wiles|Grigori Perelman|Terence Tao|John Nash'
];
var lastQ = [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1];

/* ------------------------------------------------------------------ */
/* Game state                                                          */
/* ------------------------------------------------------------------ */
var g = { lvl: 0, used: [false, false, false], rem: [false, false, false, false], cur: 0, pend: -1,
          text: '', ans: ['', '', '', ''], cor: 0 };
var LNAMES = ['50:50', 'PHONE', 'AUDIENCE', 'WALK AWAY'];
var HINT = 'TURN=MOVE  CLICK=PICK  BACK=MENU';


/* ------------------------------------------------------------------ */
/* Save / load (verified by read-back, falls back to SD card)          */
/* ------------------------------------------------------------------ */
var SAVE_PATH = '/millionaire.sav', SFS = '';
var sv = { lvl: -1, used: [false, false, false], best: 0 };
function ioWrite(str) {
  var f = ['littlefs', 'sd'], i, r;
  if (!S) return false;
  for (i = 0; i < f.length; i++) {
    if (SFS !== '' && SFS !== f[i]) continue;
    try {
      S.write({ fs: f[i], path: SAVE_PATH }, str, 'write');
      r = S.read({ fs: f[i], path: SAVE_PATH });
      if (typeof r === 'string' && r === str) { SFS = f[i]; return true; }
    } catch (e) {}
  }
  SFS = '';
  return false;
}
function ioRead() {
  var f = ['littlefs', 'sd'], i, r;
  if (!S) return '';
  for (i = 0; i < f.length; i++) {
    try {
      r = S.read({ fs: f[i], path: SAVE_PATH });
      if (typeof r === 'string' && r.length > 0) { SFS = f[i]; return r; }
    } catch (e) {}
  }
  return '';
}
function persist() {
  return ioWrite('L=' + sv.lvl + ';U=' + (sv.used[0] ? 1 : 0) + (sv.used[1] ? 1 : 0) + (sv.used[2] ? 1 : 0) + ';B=' + sv.best);
}
function loadSave() {
  var s = ioRead(), p, i, kv, v;
  if (s === '') return;
  p = s.split(';');
  for (i = 0; i < p.length; i++) {
    kv = p[i].split('=');
    if (kv[0] === 'L') { v = parseInt(kv[1], 10); if (v === v && v >= -1 && v < 15) sv.lvl = v; }
    else if (kv[0] === 'B') { v = parseInt(kv[1], 10); if (v === v && v >= 0 && v <= 1000000) sv.best = v; }
    else if (kv[0] === 'U' && kv[1] && kv[1].length === 3) {
      sv.used = [kv[1].charAt(0) === '1', kv[1].charAt(1) === '1', kv[1].charAt(2) === '1'];
    }
  }
}

function loadQ(lvl) {
  var r = rnd(5), p, o = [0, 1, 2, 3], i;
  if (r === lastQ[lvl]) r = (r + 1 + rnd(4)) % 5;
  lastQ[lvl] = r;
  p = (r < 3 ? RAW[lvl * 3 + r] : EXTRA[lvl * 2 + r - 3]).split('|');
  shuffle(o);
  g.text = p[0];
  for (i = 0; i < 4; i++) { g.ans[i] = p[1 + o[i]]; if (o[i] === 0) g.cor = i; }
  g.rem = [false, false, false, false]; g.cur = 0; g.pend = -1;
}
function wrap(s, n) {
  var w = s.split(' '), out = [], cur = '', i;
  for (i = 0; i < w.length; i++) {
    if (cur.length + w[i].length + (cur.length ? 1 : 0) > n) { out.push(cur); cur = w[i]; }
    else cur = cur.length ? cur + ' ' + w[i] : w[i];
  }
  if (cur.length) out.push(cur);
  return out;
}
function safeAmt() { if (g.lvl >= 10) return PRIZE[9]; if (g.lvl >= 5) return PRIZE[4]; return 0; }
function walkAmt() { return g.lvl > 0 ? PRIZE[g.lvl - 1] : 0; }

/* ------------------------------------------------------------------ */
/* Drawing the question screen                                         */
/* ------------------------------------------------------------------ */
function header() {
  fillRect(0, 0, W, 17, NAVY2);
  fillRect(0, 17, W, 1, GOLD);
  txt('Q' + (g.lvl + 1) + '/15', 6, 5, 1, CYAN);
  ctxt('WANNA BE A MILLIONAIRE', W / 2, 5, 1, GOLD);
  rtxt(fmt(PRIZE[g.lvl]), W - 6, 5, 1, LGREEN);
}
function qbox() {
  var L = wrap(g.text, 47), i, y0;
  rrect(6, 21, 308, 34, 9, NAVY);
  rrectO(6, 21, 308, 34, 9, EDGE);
  y0 = 21 + Math.floor((34 - L.length * 10) / 2) + 1;
  for (i = 0; i < L.length && i < 3; i++) ctxt(L[i], W / 2, y0 + i * 10, 1, WHITE);
}
/* st: 0 normal 1 cursor 2 locked 3 correct 4 wrong 5 removed */
function drawAns(i, st) {
  var x = (i % 2) * 158 + 6, y = 59 + Math.floor(i / 2) * 28, w = 150, h = 24;
  var fc = NAVY, ec = EDGE, tc = WHITE, lc = GOLD;
  if (st === 1) { fc = ORANGE; ec = WHITE; tc = BLACK; lc = NAVY2; }
  else if (st === 2) { fc = GOLD; ec = WHITE; tc = BLACK; lc = RED; }
  else if (st === 3) { fc = GREEN; ec = WHITE; tc = WHITE; lc = WHITE; }
  else if (st === 4) { fc = RED; ec = WHITE; tc = WHITE; lc = WHITE; }
  else if (st === 5) { fc = NAVY2; ec = GRAY; }
  rrect(x, y, w, h, 9, fc);
  rrectO(x, y, w, h, 9, ec);
  if (st === 5) return;
  txt(String.fromCharCode(65 + i) + ':', x + 9, y + 8, 1, lc);
  txt(g.ans[i], x + 26, y + 8, 1, tc);
}
function drawBtn(i, sel) {
  var k = i - 4, x = 6 + k * 78, y = 118, w = 74, h = 18;
  var used = (k < 3) ? g.used[k] : false;
  var fc = NAVY, ec = EDGE, tc = WHITE;
  if (k === 3) { fc = rgb(90, 20, 30); ec = LRED; }
  if (sel) { fc = ORANGE; ec = WHITE; tc = BLACK; }
  if (used) { fc = NAVY2; ec = GRAY; tc = GRAY; }
  rrect(x, y, w, h, 7, fc);
  rrectO(x, y, w, h, 7, ec);
  ctxt(LNAMES[k], x + w / 2, y + 5, 1, tc);
  if (used) line(x + 6, y + h - 4, x + w - 6, y + 4, LRED);
}
function item(i) {
  var sel = (i === g.cur), st;
  if (i < 4) {
    if (g.rem[i]) st = 5;
    else if (g.pend === i) st = 2;
    else st = sel ? 1 : 0;
    drawAns(i, st);
  } else drawBtn(i, sel);
}
function msg(s, c) {
  fillRect(0, 142, W, 28, NAVY2);
  fillRect(0, 142, W, 1, GOLD);
  ctxt(s, W / 2, 152, 1, c);
}
function render() {
  var i;
  bg(); header(); qbox();
  for (i = 0; i < 8; i++) item(i);
  msg(HINT, CYAN);
}

/* ------------------------------------------------------------------ */
/* Money ladder                                                        */
/* ------------------------------------------------------------------ */
function showLadder(lvl) {
  var i, y, safe, c;
  bg();
  fcirc(72, 62, 44, GOLD); fcirc(72, 62, 38, NAVY2); circ(72, 62, 41, ORANGE);
  ctxt('$', 72, 44, 5, GOLD);
  ctxt('QUESTION', 72, 112, 1, CYAN);
  ctxt('' + (lvl + 1), 72, 124, 3, WHITE);
  for (i = 14; i >= 0; i--) {
    y = 4 + (14 - i) * 11;
    safe = (i === 4 || i === 9);
    if (i === lvl) { rrect(148, y - 1, 168, 11, 4, ORANGE); c = BLACK; }
    else if (i < lvl) c = GRAY;
    else c = safe ? WHITE : GOLD;
    txt((i + 1 < 10 ? ' ' : '') + (i + 1), 154, y + 1, 1, c);
    rtxt(fmt(PRIZE[i]), 308, y + 1, 1, c);
  }
  if (lvl === 4 || lvl === 9) sndWin(); else beep(660, 60);
  sleep(800);
}

/* ------------------------------------------------------------------ */
/* Lifelines                                                           */
/* ------------------------------------------------------------------ */
function lifeFifty() {
  var c = [], i, a, b;
  for (i = 0; i < 4; i++) if (i !== g.cor && !g.rem[i]) c.push(i);
  shuffle(c);
  a = c[0]; b = c[1];
  g.rem[a] = true; g.rem[b] = true;
  if (g.pend === a || g.pend === b) g.pend = -1;
  drawAns(a, 5); drawAns(b, 5);
  sndLife(); msg('TWO WRONG ANSWERS REMOVED!', LGREEN);
}
function lifePhone() {
  var c = [], i, say, t;
  for (i = 0; i < 4; i++) if (i !== g.cor && !g.rem[i]) c.push(i);
  if (rnd(100) < 94 - g.lvl * 4 || c.length === 0) say = g.cor; else say = c[rnd(c.length)];
  t = g.lvl < 5 ? 'I AM SURE IT IS ' : (g.lvl < 10 ? 'I THINK IT IS ' : 'HMM... MAYBE ');
  sndLife();
  msg('FRIEND: ' + t + String.fromCharCode(65 + say), GOLD);
}
function lifeAudience() {
  var pct = [0, 0, 0, 0], w = [0, 0, 0, 0], sum = 0, i, c, left, first = -1, y, bw, k;
  c = 84 - g.lvl * 3 + rnd(10); if (c > 92) c = 92;
  for (i = 0; i < 4; i++) if (i !== g.cor && !g.rem[i]) { w[i] = 1 + rnd(9); sum += w[i]; if (first < 0) first = i; }
  if (sum === 0) { pct[g.cor] = 100; }
  else {
    pct[g.cor] = c; left = 100 - c;
    for (i = 0; i < 4; i++) if (w[i] > 0) { pct[i] = Math.floor(left * w[i] / sum); }
    k = pct[0] + pct[1] + pct[2] + pct[3];
    pct[first] += 100 - k;
  }
  sndLife();
  rrect(6, 58, 308, 54, 9, NAVY2); rrectO(6, 58, 308, 54, 9, GOLD);
  ctxt('THE AUDIENCE SAYS...', W / 2, 60, 1, GOLD);
  for (i = 0; i < 4; i++) {
    y = 71 + i * 10;
    txt(String.fromCharCode(65 + i), 16, y, 1, WHITE);
    bw = Math.floor(pct[i] * 2);
    if (bw > 0) fillRect(32, y, bw, 8, hue(i * 0.16 + 0.05));
    txt(pct[i] + '%', 238, y, 1, WHITE);
    sleep(90);
  }
  settle();
  while (true) { k = waitKey(); if (k === 'O' || k === 'B') break; }
  render();
}

/* ------------------------------------------------------------------ */
/* Confirm line / reveal / end screens                                 */
/* ------------------------------------------------------------------ */
function confirmMsg(s) {
  var k;
  msg(s, GOLD); settle();
  while (true) { k = waitKey(); if (k === 'O') return true; if (k === 'B') return false; }
}
function reveal(pick) {
  var k, ok = (pick === g.cor);
  g.pend = pick; drawAns(pick, 2);
  msg('FINAL ANSWER... ' + String.fromCharCode(65 + pick) + '!', GOLD);
  beep(330, 120); sleep(1000);
  if (ok) {
    for (k = 0; k < 6; k++) { drawAns(pick, (k % 2) ? 2 : 3); sleep(130); }
    drawAns(pick, 3);
    msg('CORRECT!  ' + fmt(PRIZE[g.lvl]), LGREEN);
    if (g.lvl === 14) sndBig(); else sndWin();
  } else {
    drawAns(pick, 4); drawAns(g.cor, 3);
    msg('WRONG!  THE ANSWER WAS ' + String.fromCharCode(65 + g.cor), LRED);
    sndLose();
  }
  sleep(700);
  return ok;
}
function endScreen(kind, amt) {
  var i, k, t1, c1;
  bg();
  if (kind === 'win') {
    for (i = 0; i < 90; i++) {
      fillRect(rnd(W), rnd(H), 4, 4, CONF[rnd(CONF.length)]);
      sleep(18);
    }
  }
  rrect(24, 30, 272, 98, 14, NAVY2); rrectO(24, 30, 272, 98, 14, GOLD); rrectO(27, 33, 266, 92, 12, EDGE);
  if (kind === 'win') { t1 = 'MILLIONAIRE!'; c1 = GOLD; }
  else if (kind === 'walk') { t1 = 'YOU WALK AWAY'; c1 = CYAN; }
  else { t1 = 'GAME OVER'; c1 = LRED; }
  ctxt(t1, W / 2, 42, 2, c1);
  ctxt('YOU LEAVE WITH', W / 2, 72, 1, WHITE);
  ctxt(fmt(amt), W / 2, 86, 3, LGREEN);
  ctxt('CLICK TO CONTINUE', W / 2, 114, 1, GOLD);
  if (kind === 'win') sndBig(); else if (kind === 'walk') sndWin(); else if (amt > 0) sndWin();
  settle();
  while (true) { k = waitKey(); if (k === 'O' || k === 'B') break; }
}

function finish(kind, amt) {
  sv.lvl = -1; sv.used = [false, false, false];
  if (amt > sv.best) sv.best = amt;
  persist();
  endScreen(kind, amt);
}
var PAUSE = ['RESUME', 'SAVE & QUIT', 'WALK AWAY'];
function pauseRow(i, on) {
  var x = 80, w = 160, y = 66 + i * 20, h = 16;
  rrect(x, y, w, h, 7, on ? ORANGE : NAVY);
  rrectO(x, y, w, h, 7, on ? WHITE : EDGE);
  ctxt(PAUSE[i], x + w / 2, y + 4, 1, on ? BLACK : WHITE);
}
function pauseMenu() {
  var sel = 0, k, old, i;
  rrect(60, 50, 200, 90, 10, NAVY2); rrectO(60, 50, 200, 90, 10, GOLD);
  ctxt('PAUSED', W / 2, 54, 1, GOLD);
  for (i = 0; i < 3; i++) pauseRow(i, i === 0);
  settle();
  while (true) {
    k = waitKey();
    if (k === 'L' || k === 'R') { old = sel; sel = (sel + (k === 'R' ? 1 : 2)) % 3; pauseRow(old, false); pauseRow(sel, true); }
    else if (k === 'O') return sel;
    else if (k === 'B') return 0;
  }
}

/* ------------------------------------------------------------------ */
/* One full game                                                       */
/* ------------------------------------------------------------------ */
function playGame(resume) {
  var k, old, i, ok, pm;
  if (resume && sv.lvl >= 0) { g.lvl = sv.lvl; g.used = [sv.used[0], sv.used[1], sv.used[2]]; }
  else { g.lvl = 0; g.used = [false, false, false]; }
  while (g.lvl < 15) {
    loadQ(g.lvl);
    showLadder(g.lvl);
    render(); settle();
    ok = false;
    while (true) {
      k = waitKey();
      if (k === 'L' || k === 'R') {
        old = g.cur;
        g.cur = (g.cur + (k === 'R' ? 1 : 7)) % 8;
        if (g.pend >= 0) { i = g.pend; g.pend = -1; item(i); msg(HINT, CYAN); }
        sndMove(); item(old); item(g.cur);
      } else if (k === 'B') {
        pm = pauseMenu();
        if (pm === 1) {
          sv.lvl = g.lvl; sv.used = [g.used[0], g.used[1], g.used[2]];
          if (persist()) { msg('GAME SAVED - SEE YOU SOON!', LGREEN); sndWin(); sleep(900); return; }
          sv.lvl = -1; msg('SAVE FAILED - NO STORAGE FOUND', LRED); sndErr(); sleep(1200);
        } else if (pm === 2) {
          if (confirmMsg('WALK AWAY WITH ' + fmt(walkAmt()) + '?  CLICK=YES  BACK=NO')) { finish('walk', walkAmt()); return; }
        }
        render(); settle();
      } else if (k === 'O' && g.cur === 7) {
        if (confirmMsg('WALK AWAY WITH ' + fmt(walkAmt()) + '?  CLICK=YES  BACK=NO')) {
          finish('walk', walkAmt()); return;
        }
        msg(HINT, CYAN); settle();
      } else if (k === 'O') {
        if (g.cur < 4) {
          if (g.rem[g.cur]) { sndErr(); }
          else if (g.pend === g.cur) { ok = reveal(g.cur); break; }
          else { g.pend = g.cur; item(g.cur); sndClick(); msg('FINAL ANSWER?  CLICK AGAIN TO LOCK IT', GOLD); }
        } else {
          i = g.cur - 4;
          if (g.used[i]) { sndErr(); msg('LIFELINE ALREADY USED', LRED); }
          else {
            g.used[i] = true;
            if (i === 0) lifeFifty(); else if (i === 1) lifePhone(); else lifeAudience();
            item(g.cur);
          }
        }
      }
    }
    if (!ok) { finish('lose', safeAmt()); return; }
    g.lvl++;
    if (g.lvl < 15) { sv.lvl = g.lvl; sv.used = [g.used[0], g.used[1], g.used[2]]; persist(); }
  }
  finish('win', 1000000);
}

/* ------------------------------------------------------------------ */
/* Boot screen and title splash                                        */
/* ------------------------------------------------------------------ */
var BOOT = ['CBM QUIZ BIOS v1.1', 'CHECKING DISPLAY', 'LOADING 75 QUESTIONS', 'CHECKING SAVE DATA', 'WARMING UP THE STUDIO', 'COUNTING THE MILLION'];
function drain(msec) { var e = ms() + msec; while (ms() < e) { poll(); sleep(10); } settle(); }
function bootScreen() {
  var i, j, y, n = BOOT.length, seg = Math.floor(276 / n);
  fillRect(0, 0, W, H, BLACK);
  outRect(20, 140, 280, 12, GOLD);
  for (i = 0; i < n; i++) {
    y = 10 + i * 18;
    txt('> ' + BOOT[i], 14, y, 1, LGREEN);
    sleep(160);
    rtxt(i === 0 ? 'READY' : 'OK', W - 14, y, 1, GOLD);
    fillRect(22 + i * seg, 142, seg, 8, hue(i / n));
    sleep(90);
  }
  beep(1319, 60);
  sleep(350);
  for (i = 0; i < W; i += 20) { fillRect(i, 0, 20, H, BLACK); sleep(10); }
  sleep(150);
}
function drawTitle() {
  var a, cx = 160, cy = 85, x, y, c;
  fillRect(0, 0, W, H, rgb(6, 2, 30));
  for (a = 0; a < 36; a++) {
    x = cx + 260 * Math.cos(a * 0.1745); y = cy + 260 * Math.sin(a * 0.1745);
    c = (a % 2) ? rgb(30, 10, 110) : rgb(70, 16, 150);
    line(cx, cy, x, y, c);
  }
  rrect(22, 30, 276, 100, 14, NAVY2); rrectO(22, 30, 276, 100, 14, GOLD); rrectO(25, 33, 270, 94, 12, EDGE);
  ctxt('WANNA BE A', W / 2 + 1, 41, 2, BLACK);
  ctxt('WANNA BE A', W / 2, 40, 2, WHITE);
  ctxt('MILLIONAIRE', W / 2 + 1, 63, 3, rgb(120, 60, 0));
  ctxt('MILLIONAIRE', W / 2, 62, 3, GOLD);
  ctxt('by da cbm', W / 2, 100, 2, MAG);
}
function titleScreen() {
  var k = '', t = 0, on = true;
  drain(300);
  drawTitle();
  tune([[523, 110], [659, 110], [784, 220]]);
  drain(400);
  ctxt('CLICK TO START', W / 2, 137, 1, GOLD);
  while (true) {
    k = poll();
    if (k === 'O' || k === 'B') break;
    t++;
    if (t % 10 === 0) {
      fillRect(80, 136, 160, 10, rgb(6, 2, 30));
      if (on) ctxt('CLICK TO START', W / 2, 137, 1, GOLD);
      on = !on;
    }
    sleep(50);
  }
  sndClick();
}

/* ------------------------------------------------------------------ */
/* Menu / how to play                                                  */
/* ------------------------------------------------------------------ */
function menuLabel(i) {
  if (i === 0) return sv.lvl >= 0 ? 'CONTINUE  Q' + (sv.lvl + 1) : 'NO SAVED GAME';
  if (i === 1) return 'NEW GAME';
  if (i === 2) return 'HOW TO PLAY';
  if (i === 3) return soundOn ? 'SOUND: ON' : 'SOUND: OFF';
  return 'EXIT';
}
function menuRow(i, on) {
  var x = 90, w = 140, y = 62 + i * 17, h = 15, dim = (i === 0 && sv.lvl < 0);
  rrect(x, y, w, h, 7, on ? ORANGE : (dim ? NAVY2 : NAVY));
  rrectO(x, y, w, h, 7, on ? WHITE : (dim ? GRAY : EDGE));
  ctxt(menuLabel(i), x + w / 2, y + 4, 1, on ? BLACK : (dim ? GRAY : WHITE));
  if (on) { txt('>', x + 7, y + 4, 1, BLACK); txt('<', x + w - 13, y + 4, 1, BLACK); }
}
function menuRender(sel) {
  var i;
  bg();
  ctxt('WANNA BE A', W / 2, 6, 2, WHITE);
  ctxt('MILLIONAIRE', W / 2 + 1, 25, 3, rgb(120, 60, 0));
  ctxt('MILLIONAIRE', W / 2, 24, 3, GOLD);
  ctxt('by da cbm', W / 2, 50, 1, MAG);
  fcirc(40, 100, 20, GOLD); fcirc(40, 100, 16, NAVY2); ctxt('$', 40, 93, 2, GOLD);
  fcirc(280, 100, 20, GOLD); fcirc(280, 100, 16, NAVY2); ctxt('$', 280, 93, 2, GOLD);
  for (i = 0; i < 5; i++) menuRow(i, i === sel);
  ctxt('BEST WIN: ' + fmt(sv.best), W / 2, 152, 1, CYAN);
}
function howTo() {
  var L = ['ANSWER 15 QUESTIONS IN A ROW', 'TO WIN $1,000,000.', '', 'TURN THE KNOB TO PICK A', 'BOX, CLICK TWICE TO LOCK IT.', '',
           'SAFE SPOTS: Q5 $1,000', 'AND Q10 $32,000.', '', 'BACK = RESUME / SAVE / WALK AWAY.', 'PROGRESS AUTO-SAVES.'], i;
  bg();
  rrect(20, 6, 280, 158, 12, NAVY2); rrectO(20, 6, 280, 158, 12, GOLD);
  ctxt('HOW TO PLAY', W / 2, 12, 1, GOLD);
  for (i = 0; i < L.length; i++) ctxt(L[i], W / 2, 28 + i * 11, 1, WHITE);
  ctxt('CLICK TO GO BACK', W / 2, 152, 1, CYAN);
  settle();
  while (true) { var k = waitKey(); if (k === 'O' || k === 'B') break; }
}
function menu(start) {
  var sel = start, k, old;
  menuRender(sel); settle();
  while (true) {
    k = waitKey();
    if (k === 'L' || k === 'R') {
      old = sel; sel = (sel + (k === 'R' ? 1 : 4)) % 5;
      menuRow(old, false); menuRow(sel, true);
    } else if (k === 'O') {
      if (sel === 0 && sv.lvl < 0) { sndErr(); }
      else if (sel === 3) { soundOn = !soundOn; sndClick(); menuRow(3, true); }
      else { sndClick(); return sel; }
    } else if (k === 'B') return 4;
  }
}
function errorScreen(e) {
  var m = '';
  try { m = String(e && e.message ? e.message : e); } catch (x) { m = 'unknown'; }
  if (m.length > 38) m = m.substring(0, 38);
  bg();
  ctxt('OOPS - RECOVERED', W / 2, 50, 2, LRED);
  ctxt(m, W / 2, 80, 1, WHITE);
  ctxt('CLICK TO RETURN TO MENU', W / 2, 110, 1, GOLD);
  settle();
  while (true) { var k = waitKey(); if (k === 'O' || k === 'B') break; }
}
function main() {
  var errs = 0, sel = 0, c, go = true;
  seedRng();
  try { loadSave(); } catch (e00) {}
  try { bootScreen(); titleScreen(); } catch (e0) {}
  sel = (sv.lvl >= 0) ? 0 : 1;
  while (go) {
    try {
      c = menu(sel); sel = c;
      if (c === 0) playGame(true);
      else if (c === 1) playGame(false);
      else if (c === 2) howTo();
      else if (c === 4) go = false;
      errs = 0;
    } catch (e) {
      errs++;
      try { errorScreen(e); } catch (e2) {}
      if (errs >= 5) go = false;
    }
  }
  fillRect(0, 0, W, H, BLACK);
  ctxt('THANKS FOR PLAYING!', W / 2, 70, 1, GOLD);
  ctxt('by da cbm', W / 2, 88, 1, MAG);
  sleep(800);
  fillRect(0, 0, W, H, BLACK);
}
main();

})();
