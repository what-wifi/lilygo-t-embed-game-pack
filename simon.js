/* ==========================================================
   NEON CIRCUIT SIMON  -  Bruce firmware 1.16.1 | T-Embed CC1101 (ES5)
   TURN knob = pick a pad     SEL = press pad / start
   ESC = menu (Strict, Sound, Restart, Quit)
   ========================================================== */

var W = display.width();
var H = display.height();

/* ---------- random (Math.random is not reliable on Bruce) ---------- */
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
var HAS_STR = (typeof display.drawString === "function");
var HAS_CIRC = (typeof display.drawFillCircle === "function");
function iv(v) { v = Math.floor(v); return (v > -5000 && v < 5000) ? v : 0; }
function fr(x, y, w, h, c) {
  var x0 = iv(x), y0 = iv(y);
  var x1 = x0 + iv(w), y1 = y0 + iv(h);
  if (x0 < 0) { x0 = 0; }
  if (y0 < 0) { y0 = 0; }
  if (x1 > W) { x1 = W; }
  if (y1 > H) { y1 = H; }
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
function ctxt(s, y, sz, c) { txt(s, (W - String(s).length * 6 * sz) / 2, y, sz, c); }
function rtxt(s, y, sz, c, pad) { txt(s, W - String(s).length * 6 * sz - pad, y, sz, c); }
/* draw caches: only repaint what actually changed (stops flicker) */
var padSt = [-1, -1, -1, -1], lastTop = "", lastMsg = "";
function cls(c) { fr(0, 0, W, H, c); padSt = [-1, -1, -1, -1]; lastTop = ""; lastMsg = ""; }
var fc = 0;
function wait(ms) { ms = Math.floor(ms); if (ms < 1) { ms = 1; } fc += ms; delay(ms); }

/* ---------- SOUND (with on/off switch) ---------- */
var sound = true;
function beep(f, ms) { if (!sound) { return; } try { audio.tone(f, ms); } catch (e) {} }

/* ---------- input: knob turn = next/prev, SEL, ESC ---------- */
var selWas = false, escWas = false, lastEnc = -100000;
var K_NEXT = 1, K_PREV = 2, K_SEL = 3, K_ESC = 4;
function drainEnc() {
  var n = 0;
  try { while (keyboard.getNextPress() && n < 12) { n++; } } catch (e1) {}
  n = 0;
  try { while (keyboard.getPrevPress() && n < 12) { n++; } } catch (e2) {}
}
function inp(gap) {
  var s = false, e = false, nx = false, pv = false;
  try { s = !!keyboard.getSelPress(); } catch (e1) {}
  try { e = !!keyboard.getEscPress(); } catch (e2) {}
  if (s && !selWas) { selWas = true; drainEnc(); return K_SEL; }
  if (!s) { selWas = false; }
  if (e && !escWas) { escWas = true; drainEnc(); return K_ESC; }
  if (!e) { escWas = false; }
  try { nx = !!keyboard.getNextPress(); } catch (e3) {}
  try { pv = !!keyboard.getPrevPress(); } catch (e4) {}
  if (nx || pv) {
    drainEnc();
    if (fc - lastEnc < gap) { return 0; }
    lastEnc = fc;
    return nx ? K_NEXT : K_PREV;
  }
  return 0;
}
function waitKey() {
  drainEnc();
  while (true) { var k = inp(0); if (k == K_SEL || k == K_ESC) { return k; } wait(40); }
}

/* ---------- save / load (SD, else LittleFS) ---------- */
function rd1(fsn, path) {
  var d = "";
  try { d = storage.read({ fs: fsn, path: path }); } catch (e1) { d = ""; }
  return String(d || "");
}
function rdFile(path) { var d = rd1("sd", path); if (d.length < 1) { d = rd1("littlefs", path); } return d; }
function wrFile(path, s) {
  try { storage.write({ fs: "sd", path: path }, s, "write"); } catch (e1) {}
  if (rd1("sd", path).length >= s.length - 2) { return; }
  try { storage.write({ fs: "littlefs", path: path }, s, "write"); } catch (e2) {}
}

/* ---------- menu ---------- */
function menu(title, items, idx) {
  var n = items.length, i, dirty = true;
  drainEnc();
  while (true) {
    if (dirty) {
      cls(rgb(8, 18, 34));
      fr(0, 0, W, 22, rgb(25, 95, 150));
      txt(title, 8, 4, 2, rgb(255, 255, 255));
      for (i = 0; i < n; i++) {
        var y = 28 + i * 24, sel = (i == idx);
        if (sel) { fr(4, y - 3, W - 8, 22, rgb(40, 120, 190)); }
        txt(items[i], 14, y, 2, sel ? rgb(255, 255, 255) : rgb(170, 210, 240));
      }
      dirty = false;
    }
    var k = inp(3);
    if (k == K_NEXT) { idx = (idx + 1) % n; dirty = true; }
    else if (k == K_PREV) { idx = (idx + n - 1) % n; dirty = true; }
    else if (k == K_SEL) { return idx; }
    else if (k == K_ESC) { return -1; }
    wait(30);
  }
}

/* ==========================================================
   GAME
   ========================================================== */
var BG = rgb(4, 6, 14), WHITE = rgb(255, 255, 255);
var CYAN = rgb(0, 220, 255), GOLD = rgb(255, 230, 120), RED = rgb(255, 80, 80);
var TOPBG = rgb(10, 18, 38), BOTBG = rgb(8, 12, 26);
var PADC = [rgb(0, 150, 60), rgb(190, 30, 40), rgb(200, 170, 0), rgb(30, 80, 210)];
var PADL = [rgb(80, 255, 130), rgb(255, 100, 110), rgb(255, 245, 90), rgb(110, 170, 255)];
var PADD = [rgb(0, 100, 40), rgb(130, 20, 28), rgb(140, 118, 0), rgb(20, 55, 150)];
var FREQ = [330, 262, 220, 165];

/* layout: top bar 0-22, pads 25-147, bottom bar 151-170 */
var PW = 146, PH = 58;
var PX = [10, 164, 10, 164];
var PY = [25, 25, 89, 89];
var PINK = rgb(255, 120, 200);

var seq = [], sc = 0, high = 0, strict = false, cur = 0, quitNow = false;
var SETFILE = "/neon_simon.txt";

function loadSet() {
  var p = rdFile(SETFILE).split("|");
  var v = parseInt(p[0], 10);
  high = (v > 0) ? v : 0;
  strict = (p.length > 1 && p[1] == "1");
  sound = !(p.length > 2 && p[2] == "0");
}
function saveSet() { wrFile(SETFILE, String(high) + "|" + (strict ? "1" : "0") + "|" + (sound ? "1" : "0")); }

function drawPad(i, lit, cursor) {
  var st = (lit ? 2 : 0) + (cursor ? 1 : 0);
  if (padSt[i] == st) { return; }
  padSt[i] = st;
  var cx = PX[i] + PW / 2, cy = PY[i] + PH / 2;
  fr(PX[i], PY[i], PW, PH, lit ? PADL[i] : PADC[i]);
  rc(PX[i] + 5, PY[i] + 5, PW - 10, PH - 10, lit ? WHITE : PADD[i]);
  ci(cx, cy, 9, lit ? WHITE : PADD[i]);
  rc(PX[i], PY[i], PW, PH, cursor ? WHITE : rgb(20, 30, 50));
  if (cursor) {
    rc(PX[i] + 1, PY[i] + 1, PW - 2, PH - 2, WHITE);
    rc(PX[i] + 2, PY[i] + 2, PW - 4, PH - 4, GOLD);
  }
}
function drawTop() {
  var key = sc + "|" + high;
  if (key == lastTop) { return; }
  lastTop = key;
  fr(0, 0, W, 22, TOPBG);
  fr(0, 22, W, 1, rgb(0, 120, 170));
  ctxt("NEON SIMON", 3, 1, CYAN);
  ctxt("by da cbm", 13, 1, PINK);
  txt("SCORE " + sc, 6, 8, 1, WHITE);
  rtxt("BEST " + high, 8, 1, GOLD, 6);
}
function setMsg(msg) {
  var key = msg + "|" + strict + "|" + sound;
  if (key == lastMsg) { return; }
  lastMsg = key;
  fr(0, 151, W, H - 151, BOTBG);
  fr(0, 151, W, 1, rgb(0, 120, 170));
  txt(strict ? "STRICT" : "EASY", 6, 157, 1, rgb(150, 170, 200));
  rtxt(sound ? "SND ON" : "SND OFF", 157, 1, rgb(150, 170, 200), 6);
  ctxt(msg, 157, 1, WHITE);
}
function drawAll(msg, showCursor) {
  var i;
  drawTop();
  for (i = 0; i < 4; i++) { drawPad(i, false, showCursor && i == cur); }
  setMsg(msg);
}
function flash(i, ms, cursor) {
  drawPad(i, true, false);
  beep(FREQ[i], ms);
  wait(ms);
  drawPad(i, false, cursor);
}
function showSeq() {
  var i, ms = Math.max(160, 480 - seq.length * 14);
  drawAll("WATCH  round " + seq.length, false);
  wait(450);
  for (i = 0; i < seq.length; i++) { flash(seq[i], ms, false); wait(90); }
}
function wrong() {
  var i;
  beep(110, 400);
  for (i = 0; i < 4; i++) { drawPad(i, true, false); }
  wait(450);
}
function winJingle() { beep(523, 80); wait(90); beep(659, 80); wait(90); beep(784, 120); }
function loseJingle() { beep(300, 150); wait(160); beep(220, 150); wait(160); beep(150, 300); }

/* returns 1 = round passed, 0 = failed, 2 = restart, -1 = quit */
function playerTurn() {
  var step = 0, k, mi;
  drawAll("YOUR TURN  1/" + seq.length, true);
  drainEnc();
  while (true) {
    k = inp(3);
    if (k == K_NEXT) { drawPad(cur, false, false); cur = (cur + 1) % 4; drawPad(cur, false, true); }
    else if (k == K_PREV) { drawPad(cur, false, false); cur = (cur + 3) % 4; drawPad(cur, false, true); }
    else if (k == K_SEL) {
      flash(cur, 200, true);
      drainEnc();
      if (cur == seq[step]) {
        step++;
        if (step >= seq.length) { return 1; }
        setMsg("YOUR TURN  " + (step + 1) + "/" + seq.length);
      } else { return 0; }
    }
    else if (k == K_ESC) {
      mi = 0;
      while (true) {
        mi = menu("MENU", ["Resume", strict ? "Strict: ON" : "Strict: OFF", sound ? "Sound: ON" : "Sound: OFF", "Restart", "Quit"], mi < 0 ? 0 : mi);
        if (mi == 1) { strict = !strict; saveSet(); continue; }
        if (mi == 2) { sound = !sound; saveSet(); beep(660, 80); continue; }
        break;
      }
      if (mi == 3) { return 2; }
      if (mi == 4) { quitNow = true; return -1; }
      cls(BG);
      drawAll("YOUR TURN  " + (step + 1) + "/" + seq.length, true);
      drainEnc();
    }
    wait(30);
  }
}

function playGame() {
  var r;
  seq = []; sc = 0;
  cls(BG);
  drawAll("GET READY", false);
  wait(700);
  while (!quitNow) {
    seq[seq.length] = ri(0, 3);
    showSeq();
    r = playerTurn();
    while (r == 0 && !strict && !quitNow) {
      wrong();
      drawAll("WRONG - TRY AGAIN", false);
      wait(800);
      showSeq();
      r = playerTurn();
    }
    if (r == 2) { seq = []; sc = 0; drawAll("RESTART", false); wait(600); continue; }
    if (r == -1) { return; }
    if (r == 0) { wrong(); return; }
    sc = seq.length;
    if (sc > high) { high = sc; saveSet(); }
    drawAll("NICE!", false);
    winJingle();
    wait(450);
  }
}

/* ---------- intro ---------- */
function intro() {
  var i, x;
  cls(BG);
  ctxt("NEON SIMON", 14, 3, CYAN);
  ctxt("by da cbm", 42, 2, PINK);
  for (i = 0; i < 4; i++) { x = 50 + i * 60; fr(x, 62, 40, 40, PADC[i]); rc(x, 62, 40, 40, rgb(20, 30, 50)); }
  for (i = 0; i < 4; i++) {
    x = 50 + i * 60;
    fr(x, 62, 40, 40, PADL[i]); rc(x, 62, 40, 40, WHITE);
    beep(FREQ[3 - i] * 2, 110);
    wait(130);
    fr(x, 62, 40, 40, PADC[i]); rc(x, 62, 40, 40, rgb(20, 30, 50));
  }
  ctxt("TURN = pick pad    SEL = press", 114, 1, WHITE);
  ctxt("ESC = menu (strict / sound)", 126, 1, WHITE);
  ctxt("BEST " + high, 140, 1, GOLD);
  ctxt("press SEL to start", 155, 1, CYAN);
}

/* ---------- main ---------- */
loadSet();
intro();
waitKey();
seed = (seed + fc * 7919) % 2147483646 + 1;
while (true) {
  quitNow = false;
  playGame();
  if (quitNow) { break; }
  loseJingle();
  drawAll("GAME OVER", false);
  fr(50, 48, 220, 76, rgb(0, 0, 0));
  rc(50, 48, 220, 76, RED);
  rc(52, 50, 216, 72, rgb(120, 30, 30));
  ctxt("GAME OVER", 56, 2, RED);
  ctxt("score " + sc + "   best " + high, 82, 1, WHITE);
  ctxt("SEL = again    ESC = quit", 102, 1, GOLD);
  if (waitKey() == K_ESC) { break; }
}
cls(BG);
ctxt("Thanks for playing!", 80, 2, WHITE);
