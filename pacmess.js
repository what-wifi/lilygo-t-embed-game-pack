/* ==========================================================
   PAC-MESS
   by da cbm
   Bruce firmware 1.16.1  |  LilyGO T-Embed CC1101 (320x170)   ES5
   ----------------------------------------------------------
   Eat every dot, dodge the 4 ghosts, grab a power pellet to
   turn the tables. 50 levels, a new random maze every level.
     TURN knob  = steer (clockwise = turn right, counter = left)
                  the turn is queued and taken at the next junction
     SEL        = U-turn right now
     ESC        = pause menu (save / quit)
   Fruit gives tokens. Spend tokens on upgrades between levels:
   speed, power time, extra life, ghost slow, shield.
   Save: /pacmess_save.txt   Hi-score: /pacmess_hi.txt
   (SD card first, else LittleFS)
   ========================================================== */

var W = display.width();
var H = display.height();

/* ---------- random ---------- */
var seed = 48271;
try { var t0 = now(); if (t0) { seed = (t0 % 2147483646) + 1; } } catch (e0) {}
function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
function ri(a, b) { return a + Math.floor(rnd() * (b - a + 1)); }
var mseed = 1;
function mrnd() { mseed = (mseed * 16807) % 2147483647; return (mseed - 1) / 2147483646; }

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
  if (x1 < 0 || x2 < 0 || y1 < 0 || y2 < 0 || x1 >= W || x2 >= W || y1 >= H || y2 >= H) { return; }
  if (HAS_LINE) { display.drawLine(x1, y1, x2, y2, c); return; }
  var n = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1);
  for (var i = 0; i <= n; i += 1) { fr(x1 + (x2 - x1) * i / n, y1 + (y2 - y1) * i / n, 1, 1, c); }
}
function ci(x, y, r, c) {
  x = iv(x); y = iv(y); r = Math.max(1, iv(r));
  if (x - r < 0 || y - r < 0 || x + r >= W || y + r >= H) {
    for (var dy = -r; dy <= r; dy++) {
      var dx = Math.floor(Math.sqrt(r * r - dy * dy));
      fr(x - dx, y + dy, dx * 2 + 1, 1, c);
    }
    return;
  }
  if (HAS_CIRC) { display.drawFillCircle(x, y, r, c); return; }
  for (var dy2 = -r; dy2 <= r; dy2++) {
    var dx2 = Math.floor(Math.sqrt(r * r - dy2 * dy2));
    fr(x - dx2, y + dy2, dx2 * 2 + 1, 1, c);
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
function beep(f, d) { if (!SOUND) { return; } try { audio.tone(f, d); } catch (e) {} }

var BLACK = rgb(0, 0, 0), WHITE = rgb(255, 255, 255), RED = rgb(230, 50, 40),
    GREEN = rgb(60, 210, 80), YEL = rgb(255, 225, 20), BLUE = rgb(40, 70, 255),
    GRAY = rgb(130, 130, 140), DARK = rgb(8, 18, 34), ORNG = rgb(255, 150, 30),
    CYAN = rgb(80, 230, 240), PINK = rgb(255, 150, 200), HDR = rgb(25, 95, 150),
    HINT = rgb(255, 230, 120), PANEL = rgb(6, 8, 24), DOTC = rgb(255, 215, 170),
    PELC = rgb(255, 245, 200);
var GCOL = [RED, PINK, CYAN, ORNG];
/* wall themes: [body, edge] */
var THEMES = [
  [rgb(0, 20, 130), rgb(60, 110, 255)],
  [rgb(0, 80, 30), rgb(60, 240, 110)],
  [rgb(90, 0, 110), rgb(220, 90, 255)],
  [rgb(120, 50, 0), rgb(255, 170, 40)],
  [rgb(110, 0, 20), rgb(255, 80, 100)],
  [rgb(0, 80, 100), rgb(70, 230, 240)]
];
var WALLD = THEMES[0][0], WALLC = THEMES[0][1];

/* ---------- input (hardened encoder debounce, from hackerz) ---------- */
var MENU_GAP = 160, MENU_REV = 300;
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
function menuMode() { ENC_GAP_MS = MENU_GAP; ENC_REV_MS = MENU_REV; SEL_HOLD_MS = 200; encOn(); }
function gameMode() { ENC_GAP_MS = 28; ENC_REV_MS = 45; SEL_HOLD_MS = 180; encOn(); }

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
function listLines(title, lines) {
  var i;
  cls(DARK); fr(0, 0, W, 18, HDR); txt(title, 6, 5, 1, WHITE);
  for (i = 0; i < lines.length && i < 12; i++) { txt(lines[i][0], 8, 24 + i * 11, 1, lines[i][1]); }
  fr(0, H - 14, W, 14, rgb(6, 12, 24)); txt("SEL / ESC: back", 4, H - 11, 1, HINT);
  waitKey();
}

/* ==========================================================
   STORAGE
   ========================================================== */
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

/* ==========================================================
   GAME STATE
   ========================================================== */
var MW = 27, MH = 19, CELL = 8, OX = 2, OY = 9, PX0 = 224, MAXLV = 50;
var DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];
var DIFFN = ["Easy", "Normal", "Hard"], DIFFM = [0.88, 1.0, 1.12], DIFFL = [5, 3, 2];
var GSPDN = ["Slow", "Normal", "Fast"], GSPDW = [14, 8, 3];
var MAP = [], DISTH = [], DISTP = [];
var LV = 1, SCORE = 0, LIVES = 3, TOK = 0, UP = [0, 0, 0, 0, 0], DIFF = 1, HI = 0;
var GSPD = 1, SOUND = true, NEXTBONUS = 10000;
var dotsLeft = 0, dotsTotal = 0, dotsEaten = 0, shields = 0;
var pac = { x: 0, y: 0, dir: 2, want: 2, acc: 0, mouth: 0, ox: 0, oy: 0, drawn: false, moved: 0 };
var ghosts = [];
var fright = 0, frightMax = 1, eatChain = 0, chasing = false, phase = 0;
var fruit = { on: false, tx: 13, ty: 11, t: 0, kind: 0, spawned: 0 };
var hudDirty = true, dirDirty = true, tickN = 0, pacTx = -1, pacTy = -1, distPacOk = false;
var QUIT = false;

/* ==========================================================
   MAZE GENERATION (symmetric, seeded by level)
   ========================================================== */
function genMaze(level) {
  var r, c, d, i, rr, cc, row;
  mseed = (level * 7919 + 104729) % 2147483646 + 1;
  MAP = [];
  for (r = 0; r < MH; r++) {
    row = [];
    for (c = 0; c < MW; c++) { row.push("#"); }
    MAP.push(row);
  }
  var vis = [];
  for (rr = 0; rr < 9; rr++) { vis.push([0, 0, 0, 0, 0, 0, 0]); }
  vis[4][5] = 1; vis[4][6] = 1;           /* ghost house cells are reserved */
  var stack = [[0, 0]];
  vis[0][0] = 1; MAP[1][1] = " ";
  while (stack.length > 0) {
    var top = stack[stack.length - 1], opts = [], ncc, nrr;
    for (d = 0; d < 4; d++) {
      ncc = top[0] + DX[d]; nrr = top[1] + DY[d];
      if (ncc >= 0 && ncc < 7 && nrr >= 0 && nrr < 9 && !vis[nrr][ncc]) { opts.push(d); }
    }
    if (opts.length == 0) { stack.pop(); continue; }
    d = opts[Math.floor(mrnd() * opts.length)];
    ncc = top[0] + DX[d]; nrr = top[1] + DY[d];
    MAP[1 + 2 * top[1] + DY[d]][1 + 2 * top[0] + DX[d]] = " ";
    MAP[1 + 2 * nrr][1 + 2 * ncc] = " ";
    vis[nrr][ncc] = 1;
    stack.push([ncc, nrr]);
  }
  for (r = 0; r < MH; r++) { for (c = 0; c < 13; c++) { MAP[r][MW - 1 - c] = MAP[r][c]; } }
  /* ghost house */
  for (c = 10; c <= 16; c++) { MAP[8][c] = "#"; MAP[10][c] = "#"; }
  MAP[8][13] = "-";
  MAP[9][10] = "#"; MAP[9][16] = "#";
  for (c = 11; c <= 15; c++) { MAP[9][c] = "H"; }
  /* braid: knock walls next to dead ends so the maze has loops */
  var pb = 0.78 + (level % 5) * 0.055;
  for (r = 1; r < MH - 1; r += 2) {
    for (c = 1; c <= 13; c += 2) {
      if (MAP[r][c] != " ") { continue; }
      var cnt = 0, cand = [], wc, wr, fc, fr2;
      for (d = 0; d < 4; d++) {
        wc = c + DX[d]; wr = r + DY[d];
        if (MAP[wr][wc] != "#" && MAP[wr][wc] != "H" && MAP[wr][wc] != "-") { cnt++; }
      }
      if (cnt != 1 || mrnd() > pb) { continue; }
      for (d = 0; d < 4; d++) {
        wc = c + DX[d]; wr = r + DY[d]; fc = c + 2 * DX[d]; fr2 = r + 2 * DY[d];
        if (MAP[wr][wc] == "#" && wc >= 1 && wc <= 25 && wr >= 1 && wr <= 17 &&
            fc >= 1 && fc <= 25 && fr2 >= 1 && fr2 <= 17 && MAP[fr2][fc] == " ") { cand.push(d); }
      }
      if (cand.length == 0) { continue; }
      d = cand[Math.floor(mrnd() * cand.length)];
      wc = c + DX[d]; wr = r + DY[d];
      MAP[wr][wc] = " "; MAP[wr][MW - 1 - wc] = " ";
    }
  }
  /* tunnel on row 9 */
  MAP[9][0] = " "; MAP[9][MW - 1] = " ";
  /* dots */
  dotsTotal = 0;
  for (r = 0; r < MH; r++) {
    for (c = 0; c < MW; c++) {
      if (MAP[r][c] == " " && c > 0 && c < MW - 1) { MAP[r][c] = "."; dotsTotal++; }
    }
  }
  MAP[13][13] = " "; dotsTotal--;
  var cr = [[1, 1], [25, 1], [1, 17], [25, 17]];
  for (i = 0; i < 4; i++) { if (MAP[cr[i][1]][cr[i][0]] == ".") { MAP[cr[i][1]][cr[i][0]] = "o"; } }
  dotsLeft = dotsTotal;
  var th = THEMES[(level - 1) % THEMES.length];
  WALLD = th[0]; WALLC = th[1];
}
function bfs(sx, sy, out) {
  var i, q = [], qi = 0, cur, cx, cy, d, nx, ny, ch;
  for (i = 0; i < MW * MH; i++) { out[i] = 999; }
  out[sy * MW + sx] = 0; q.push(sy * MW + sx);
  while (qi < q.length) {
    cur = q[qi]; qi++;
    cx = cur % MW; cy = Math.floor(cur / MW);
    for (d = 0; d < 4; d++) {
      nx = cx + DX[d]; ny = cy + DY[d];
      if (nx < 0) { nx = MW - 1; } if (nx >= MW) { nx = 0; }
      if (ny < 0 || ny >= MH) { continue; }
      ch = MAP[ny][nx];
      if (ch == "#" || ch == "H" || ch == "-") { continue; }
      if (out[ny * MW + nx] == 999) { out[ny * MW + nx] = out[cur] + 1; q.push(ny * MW + nx); }
    }
  }
}
function canMove(tx, ty, d, door) {
  var nx = tx + DX[d], ny = ty + DY[d];
  if (nx < 0) { nx = MW - 1; } if (nx >= MW) { nx = 0; }
  if (ny < 0 || ny >= MH) { return false; }
  var ch = MAP[ny][nx];
  if (ch == "#") { return false; }
  if (ch == "H" || ch == "-") { return door; }
  return true;
}

/* ==========================================================
   DRAWING
   ========================================================== */
function wl(tx, ty) {
  if (tx < 0 || tx >= MW || ty < 0 || ty >= MH) { return true; }
  return MAP[ty][tx] == "#";
}
var FRUITC = [rgb(255, 40, 40), rgb(255, 90, 120), rgb(255, 160, 30), rgb(120, 230, 60), rgb(80, 220, 120), rgb(255, 230, 40), rgb(80, 220, 255)];
function drawTile(tx, ty) {
  if (tx < 0 || tx >= MW || ty < 0 || ty >= MH) { return; }
  var x = OX + tx * CELL, y = OY + ty * CELL, ch = MAP[ty][tx];
  fr(x, y, CELL, CELL, BLACK);
  if (ch == "#") {
    fr(x + 1, y + 1, 6, 6, WALLD);
    if (wl(tx + 1, ty)) { fr(x + 7, y + 1, 1, 6, WALLD); } else { fr(x + 6, y + 1, 1, 6, WALLC); }
    if (wl(tx - 1, ty)) { fr(x, y + 1, 1, 6, WALLD); } else { fr(x + 1, y + 1, 1, 6, WALLC); }
    if (wl(tx, ty + 1)) { fr(x + 1, y + 7, 6, 1, WALLD); } else { fr(x + 1, y + 6, 6, 1, WALLC); }
    if (wl(tx, ty - 1)) { fr(x + 1, y, 6, 1, WALLD); } else { fr(x + 1, y + 1, 6, 1, WALLC); }
  } else if (ch == ".") {
    fr(x + 3, y + 3, 2, 2, DOTC);
  } else if (ch == "o") {
    ci(x + 4, y + 4, 3, PELC);
  } else if (ch == "-") {
    fr(x, y + 3, CELL, 2, PINK);
  }
  if (fruit.on && fruit.tx == tx && fruit.ty == ty) { drawFruit(x + 4, y + 4); }
}
function drawFruit(cx, cy) {
  var c = FRUITC[fruit.kind % 7];
  ci(cx - 1, cy + 1, 2, c); ci(cx + 2, cy + 1, 2, c);
  ln(cx - 1, cy - 1, cx + 1, cy - 3, GREEN); ln(cx + 2, cy - 1, cx + 1, cy - 3, GREEN);
}
function paintMaze() {
  var tx, ty;
  for (ty = 0; ty < MH; ty++) { for (tx = 0; tx < MW; tx++) { drawTile(tx, ty); } }
}
function eraseBox(x, y) {
  var tx0 = Math.floor(x / CELL), tx1 = Math.floor((x + CELL - 1) / CELL);
  var ty0 = Math.floor(y / CELL), ty1 = Math.floor((y + CELL - 1) / CELL), a, b;
  for (b = ty0; b <= ty1; b++) { for (a = tx0; a <= tx1; a++) { drawTile(a, b); } }
}
function drawPacAt(cx, cy, dir, open, col) {
  ci(cx, cy, 3, col);
  if (open > 0) {
    var dx = DX[dir], dy = DY[dir], px = -dy, py = dx, t;
    for (t = -open; t <= open; t++) { ln(cx, cy, cx + dx * 4 + px * t, cy + dy * 4 + py * t, BLACK); }
  }
}
function drawGhostAt(cx, cy, col, mode, flashOn, dir, fr1) {
  var body = col;
  if (mode == 1) { body = flashOn ? WHITE : BLUE; }
  if (mode != 2) {
    ci(cx, cy - 1, 3, body);
    fr(cx - 3, cy - 1, 7, 4, body);
    if (fr1 == 0) { fr(cx - 2, cy + 3, 1, 1, BLACK); fr(cx, cy + 3, 1, 1, BLACK); fr(cx + 2, cy + 3, 1, 1, BLACK); }
    else { fr(cx - 3, cy + 3, 1, 1, BLACK); fr(cx - 1, cy + 3, 1, 1, BLACK); fr(cx + 1, cy + 3, 1, 1, BLACK); fr(cx + 3, cy + 3, 1, 1, BLACK); }
  }
  if (mode == 1) {
    var fc = flashOn ? RED : PINK;
    fr(cx - 2, cy - 2, 1, 2, fc); fr(cx + 2, cy - 2, 1, 2, fc);
    fr(cx - 2, cy + 1, 5, 1, fc);
  } else {
    fr(cx - 2, cy - 2, 2, 3, WHITE); fr(cx + 1, cy - 2, 2, 3, WHITE);
    fr(cx - 2 + (DX[dir] > 0 ? 1 : 0), cy - 1 + DY[dir], 1, 1, BLUE);
    fr(cx + 1 + (DX[dir] > 0 ? 1 : 0), cy - 1 + DY[dir], 1, 1, BLUE);
  }
}
function drawEnts() {
  var i, g, vis;
  if (pac.drawn) { eraseBox(pac.ox, pac.oy); }
  for (i = 0; i < 4; i++) { g = ghosts[i]; if (g.drawn) { eraseBox(g.ox, g.oy); } }
  if (fruit.on) { drawTile(fruit.tx, fruit.ty); }
  for (i = 0; i < 4; i++) {
    g = ghosts[i];
    vis = (g.x >= 0 && g.x <= (MW - 1) * CELL);
    if (vis) {
      var fl = (fright < 70 && ((tickN >> 3) & 1) == 1);
      drawGhostAt(OX + g.x + 4, OY + g.y + 4, GCOL[i], g.mode, fl, g.dir, (tickN >> 3) & 1);
    }
    g.ox = g.x; g.oy = g.y; g.drawn = vis;
  }
  vis = (pac.x >= 0 && pac.x <= (MW - 1) * CELL);
  if (vis) {
    var ph = (Math.floor(pac.moved / 3)) % 6, op = ph < 4 ? ph : 6 - ph;
    drawPacAt(OX + pac.x + 4, OY + pac.y + 4, pac.dir, op, YEL);
  }
  pac.ox = pac.x; pac.oy = pac.y; pac.drawn = vis;
}

/* ---------- side panel ---------- */
function hudDir() {
  var cx = PX0 + 74, cy = 122, d = pac.want, dx = DX[d], dy = DY[d], px = -dy, py = dx;
  fr(PX0 + 56, 108, 36, 30, PANEL);
  ln(cx - dx * 8, cy - dy * 8, cx + dx * 8, cy + dy * 8, GREEN);
  ln(cx + dx * 8, cy + dy * 8, cx + dx * 3 + px * 5, cy + dy * 3 + py * 5, GREEN);
  ln(cx + dx * 8, cy + dy * 8, cx + dx * 3 - px * 5, cy + dy * 3 - py * 5, GREEN);
  dirDirty = false;
}
function hudPower() {
  fr(PX0 + 4, 102, 90, 6, PANEL);
  rc(PX0 + 4, 102, 90, 6, GRAY);
  if (fright > 0) { fr(PX0 + 5, 103, Math.floor(88 * fright / frightMax), 4, fright < 70 ? WHITE : BLUE); }
}
function hud() {
  var i;
  fr(PX0, 0, W - PX0, H, PANEL);
  txt("PAC-MESS", PX0 + 4, 2, 1, YEL);
  txt("SCORE", PX0 + 4, 14, 1, GRAY);
  txt(String(SCORE), PX0 + 4, 24, 2, WHITE);
  txt("HI " + HI, PX0 + 4, 42, 1, CYAN);
  txt("LEVEL " + LV + "/" + MAXLV, PX0 + 4, 54, 1, WHITE);
  for (i = 0; i < LIVES && i < 8; i++) { ci(PX0 + 8 + i * 11, 74, 3, YEL); }
  txt("TOKENS " + TOK, PX0 + 4, 86, 1, GREEN);
  txt("TURN", PX0 + 4, 118, 1, GRAY);
  txt("DOTS " + dotsLeft, PX0 + 4, 140, 1, GRAY);
  if (shields > 0) { txt("SHIELD x" + shields, PX0 + 4, 152, 1, CYAN); }
  else { txt("ESC pause", PX0 + 4, 152, 1, HINT); }
  txt("SEL U-turn", PX0 + 4, 161, 1, HINT);
  hudPower(); hudDir();
  hudDirty = false;
}
function addScore(n) {
  SCORE += n;
  if (SCORE > HI) { HI = SCORE; }
  while (SCORE >= NEXTBONUS) {
    NEXTBONUS += 10000;
    if (LIVES < 9) { LIVES++; beep(1500, 60); }
  }
  hudDirty = true;
}

/* ==========================================================
   LEVEL SETUP / ENTITIES
   ========================================================== */
function resetPositions() {
  var i, g, wt;
  pac.x = 13 * CELL; pac.y = 13 * CELL; pac.dir = 2; pac.want = 2; pac.acc = 0; pac.moved = 0; pac.drawn = false;
  ghosts = [];
  for (i = 0; i < 4; i++) {
    wt = Math.max(10, i * 70 - LV * 2);
    g = { x: (11 + i) * CELL, y: 9 * CELL, dir: 2, mode: 0, st: 0, acc: 0, wait: wt, ox: 0, oy: 0, drawn: false };
    if (i == 0) { g.x = 13 * CELL; g.y = 7 * CELL; g.st = 2; g.wait = 0; }
    if (i == 1) { g.x = 12 * CELL; }
    if (i == 2) { g.x = 13 * CELL; }
    if (i == 3) { g.x = 14 * CELL; }
    ghosts.push(g);
  }
  fright = 0; eatChain = 0; chasing = false; phase = 0; distPacOk = false; pacTx = -1; pacTy = -1;
}
function pacSpeed() { return Math.min(2.0, 1.45 + 0.07 * UP[0] + LV * 0.004); }
function ghostSpeed(g) {
  var s;
  if (g.mode == 2) { return 2.4; }
  if (g.mode == 1) { return 0.62; }
  s = (1.1 + LV * 0.012) * DIFFM[DIFF] * (1 - 0.04 * UP[3]);
  if (s > 1.9) { s = 1.9; }
  var tx = Math.floor(g.x / CELL), ty = Math.floor(g.y / CELL);
  if (ty == 9 && (tx < 5 || tx > 21)) { s *= 0.6; }
  return s;
}
function setupLevel() {
  var i;
  genMaze(LV);
  DISTH = []; DISTP = [];
  for (i = 0; i < MW * MH; i++) { DISTH.push(999); DISTP.push(999); }
  bfs(13, 7, DISTH);
  dotsEaten = 0; shields = UP[4];
  fruit.on = false; fruit.spawned = 0; fruit.kind = (LV - 1) % 7;
  resetPositions();
  hudDirty = true; dirDirty = true;
}

/* ==========================================================
   MOVEMENT
   ========================================================== */
function advance(e) {
  e.x += DX[e.dir]; e.y += DY[e.dir];
  if (e.x <= -CELL) { e.x += MW * CELL; } else if (e.x >= MW * CELL) { e.x -= MW * CELL; }
}
function startFright() {
  var i, g;
  frightMax = Math.max(60, Math.floor((7 - LV * 0.09) * 30) + UP[1] * 45);
  fright = frightMax; eatChain = 0;
  for (i = 0; i < 4; i++) {
    g = ghosts[i];
    if (g.mode == 0) {
      g.mode = 1;
      if (g.st == 2) { g.dir = (g.dir + 2) & 3; }
    }
  }
  hudPower();
}
function eatTile(tx, ty) {
  var ch = MAP[ty][tx];
  if (ch == ".") {
    MAP[ty][tx] = " "; dotsLeft--; dotsEaten++; addScore(10);
  } else if (ch == "o") {
    MAP[ty][tx] = " "; dotsLeft--; dotsEaten++; addScore(50); startFright(); beep(700, 25);
  }
  if (fruit.on && fruit.tx == tx && fruit.ty == ty) {
    fruit.on = false; addScore(100 * (1 + (LV - 1) % 7)); TOK += 1; hudDirty = true; beep(1200, 40);
  }
  if (fruit.spawned < 2 && !fruit.on) {
    if ((fruit.spawned == 0 && dotsEaten >= Math.floor(dotsTotal * 0.3)) ||
        (fruit.spawned == 1 && dotsEaten >= Math.floor(dotsTotal * 0.68))) {
      fruit.on = true; fruit.t = 330; fruit.spawned++;
    }
  }
}
function movePac() {
  if (pac.want == ((pac.dir + 2) & 3)) { pac.dir = pac.want; }
  if (pac.x % CELL == 0 && pac.y % CELL == 0) {
    var tx = pac.x / CELL, ty = pac.y / CELL;
    if (canMove(tx, ty, pac.want, false)) { pac.dir = pac.want; }
    if (!canMove(tx, ty, pac.dir, false)) { return; }
  }
  advance(pac);
  pac.moved++;
  if (pac.x % CELL == 0 && pac.y % CELL == 0) {
    eatTile(pac.x / CELL, pac.y / CELL);
  }
}
function ghostTarget(g, i) {
  var ptx = Math.floor(pac.x / CELL), pty = Math.floor(pac.y / CELL), tx, ty;
  if (!chasing) {
    if (i == 0) { return [25, 1]; } if (i == 1) { return [1, 1]; }
    if (i == 2) { return [25, 17]; } return [1, 17];
  }
  if (i == 0) { return [ptx, pty]; }
  if (i == 1) { return [ptx + 4 * DX[pac.dir], pty + 4 * DY[pac.dir]]; }
  if (i == 2) {
    var r = ghosts[0];
    tx = ptx + 2 * DX[pac.dir]; ty = pty + 2 * DY[pac.dir];
    return [tx * 2 - Math.floor(r.x / CELL), ty * 2 - Math.floor(r.y / CELL)];
  }
  var gx = Math.floor(g.x / CELL), gy = Math.floor(g.y / CELL);
  if ((gx - ptx) * (gx - ptx) + (gy - pty) * (gy - pty) > 64) { return [ptx, pty]; }
  return [1, 17];
}
function ghostChoose(g, i, tx, ty) {
  var rev = (g.dir + 2) & 3, d, cand = [], nx, ny, best = -1, bd = 1e9, v, tg;
  for (d = 0; d < 4; d++) { if (d != rev && canMove(tx, ty, d, false)) { cand.push(d); } }
  if (cand.length == 0) { if (canMove(tx, ty, rev, false)) { return rev; } return g.dir; }
  if (cand.length == 1) { return cand[0]; }
  if (g.mode == 1) { return cand[ri(0, cand.length - 1)]; }
  if (g.mode == 0 && rnd() < Math.max(0.0, 0.2 - LV * 0.004 - DIFF * 0.04)) { return cand[ri(0, cand.length - 1)]; }
  if (g.mode == 2) {
    for (d = 0; d < cand.length; d++) {
      nx = tx + DX[cand[d]]; ny = ty + DY[cand[d]];
      if (nx < 0) { nx = MW - 1; } if (nx >= MW) { nx = 0; }
      v = DISTH[ny * MW + nx];
      if (v < bd) { bd = v; best = cand[d]; }
    }
    return best;
  }
  if (i == 0 && chasing && distPacOk) {
    for (d = 0; d < cand.length; d++) {
      nx = tx + DX[cand[d]]; ny = ty + DY[cand[d]];
      if (nx < 0) { nx = MW - 1; } if (nx >= MW) { nx = 0; }
      v = DISTP[ny * MW + nx];
      if (v < bd) { bd = v; best = cand[d]; }
    }
    return best;
  }
  tg = ghostTarget(g, i);
  for (d = 0; d < cand.length; d++) {
    nx = tx + DX[cand[d]]; ny = ty + DY[cand[d]];
    v = (nx - tg[0]) * (nx - tg[0]) + (ny - tg[1]) * (ny - tg[1]);
    if (v < bd) { bd = v; best = cand[d]; }
  }
  return best;
}
function moveGhost(g, i) {
  var tx, ty;
  if (g.st == 0) { return; }
  if (g.st == 1) {
    if (g.x < 13 * CELL) { g.x++; }
    else if (g.x > 13 * CELL) { g.x--; }
    else if (g.y > 7 * CELL) { g.y--; }
    else { g.st = 2; g.dir = (rnd() < 0.5) ? 2 : 0; }
    return;
  }
  if (g.st == 3) {
    if (g.y < 9 * CELL) { g.y++; }
    else { g.st = 0; g.mode = 0; g.wait = 45; }
    return;
  }
  if (g.x % CELL == 0 && g.y % CELL == 0) {
    tx = g.x / CELL; ty = g.y / CELL;
    if (g.mode == 2 && tx == 13 && ty == 7) { g.st = 3; return; }
    g.dir = ghostChoose(g, i, tx, ty);
    if (!canMove(tx, ty, g.dir, false)) { return; }
  }
  advance(g);
}
function stepAll() {
  var i, g, ptx, pty;
  pac.acc += pacSpeed();
  while (pac.acc >= 1) { pac.acc -= 1; movePac(); }
  ptx = Math.floor((pac.x + 4) / CELL); pty = Math.floor((pac.y + 4) / CELL);
  if (ptx != pacTx || pty != pacTy) {
    pacTx = ptx; pacTy = pty;
    if (chasing && ptx >= 0 && ptx < MW && MAP[pty][ptx] != "#") { bfs(ptx, pty, DISTP); distPacOk = true; }
  }
  for (i = 0; i < 4; i++) {
    g = ghosts[i];
    if (g.st == 0) {
      g.wait--;
      if (g.wait <= 0) { g.st = 1; }
    }
    g.acc += ghostSpeed(g);
    while (g.acc >= 1) { g.acc -= 1; moveGhost(g, i); }
  }
  /* timers */
  if (fright > 0) {
    fright--;
    if (fright == 0) { for (i = 0; i < 4; i++) { if (ghosts[i].mode == 1) { ghosts[i].mode = 0; } } hudPower(); }
    else if ((fright & 3) == 0) { hudPower(); }
  } else {
    phase++;
    var lim = chasing ? (500 + LV * 8) : Math.max(60, 200 - LV * 4);
    if (phase >= lim) {
      phase = 0; chasing = !chasing; distPacOk = false; pacTx = -1;
      for (i = 0; i < 4; i++) { g = ghosts[i]; if (g.st == 2 && g.mode == 0) { g.dir = (g.dir + 2) & 3; } }
    }
  }
  if (fruit.on) {
    fruit.t--;
    if (fruit.t <= 0) { fruit.on = false; drawTile(fruit.tx, fruit.ty); }
  }
}

/* ==========================================================
   EVENTS: collision, death, level clear
   ========================================================== */
function ghostPopup(g, pts) {
  var sx = OX + g.x - 2, sy = OY + g.y;
  fr(sx - 1, sy - 1, 26, 10, BLACK);
  txt(String(pts), sx, sy, 1, CYAN);
  beep(900, 30);
  wait(350);
  eraseBox(g.x - 8, g.y); eraseBox(g.x + 8, g.y); eraseBox(g.x, g.y);
  eraseBox(g.x + 16, g.y);
}
/* returns 1 if pac died */
function collide() {
  var i, g, dx, dy, pts;
  for (i = 0; i < 4; i++) {
    g = ghosts[i];
    if (g.st == 0 || g.mode == 2) { continue; }
    dx = g.x - pac.x; dy = g.y - pac.y;
    if (dx < 0) { dx = -dx; } if (dy < 0) { dy = -dy; }
    if (dx < 6 && dy < 6) {
      if (g.mode == 1) {
        eatChain++;
        pts = 200; for (dx = 1; dx < eatChain && dx < 4; dx++) { pts *= 2; }
        addScore(pts);
        g.mode = 2; g.st = 2;
        ghostPopup(g, pts);
        pac.drawn = false;
      } else {
        if (shields > 0) {
          shields--; hudDirty = true; beep(300, 60);
          g.mode = 2; g.st = 2;   /* shield pops the ghost back home */
          flash("SHIELD!", CYAN);
          paintMaze(); hud(); pac.drawn = false;
          for (dx = 0; dx < 4; dx++) { ghosts[dx].drawn = false; }
          return 0;
        }
        return 1;
      }
    }
  }
  return 0;
}
function deathAnim() {
  var i, cx = OX + pac.x + 4, cy = OY + pac.y + 4;
  eraseBox(pac.x, pac.y);
  for (i = 3; i >= 0; i--) { if (ghosts[i].drawn) { eraseBox(ghosts[i].ox, ghosts[i].oy); } }
  beep(400, 40);
  for (i = 4; i >= 0; i--) {
    eraseBox(pac.x, pac.y);
    if (i > 0) { ci(cx, cy, i, YEL); }
    wait(120);
  }
  eraseBox(pac.x, pac.y);
  wait(200);
}
function readyBanner(msg) {
  fr(OX + 9 * CELL, OY + 11 * CELL, 9 * CELL, CELL, BLACK);
  stxt(msg, OX + 13 * CELL + 4 - msg.length * 3, OY + 11 * CELL, 1, YEL, rgb(80, 40, 0));
}
function clearBanner() {
  var tx;
  for (tx = 9; tx <= 17; tx++) { drawTile(tx, 11); }
}
function levelClear() {
  var i;
  wait(500);
  for (i = 0; i < 2; i++) {
    WALLD = WHITE; WALLC = WHITE; paintMaze(); wait(160);
    WALLD = THEMES[(LV - 1) % THEMES.length][0]; WALLC = THEMES[(LV - 1) % THEMES.length][1];
    paintMaze(); wait(160);
  }
  beep(1000, 40);
}

/* ==========================================================
   PLAY ONE LEVEL.  returns 1 cleared, 0 out of lives, -1 quit
   ========================================================== */
function pauseMenu() {
  var r, idx = 0, res = 0;
  menuMode();
  while (true) {
    r = menu("PAUSED", ["Resume", "Save game", "Save & quit", "Quit (no save)", "Sound: " + (SOUND ? "on" : "off")], idx,
      ["Back to the maze", "Saves at this level's start", "Save and go to main menu", "Lose this run's progress", "Toggle beeps"]);
    if (r < 0 || r == 0) { res = 0; break; }
    idx = r;
    if (r == 1) { saveGame(); flash("Saved", GREEN); }
    else if (r == 2) { saveGame(); res = 1; break; }
    else if (r == 3) { res = 2; break; }
    else if (r == 4) { SOUND = !SOUND; saveCfg(); }
  }
  return res;
}
function playLevel() {
  var k, i, res, pm;
  setupLevel();
  gameMode();
  cls(BLACK); paintMaze(); hud();
  readyBanner("READY!");
  beep(500, 30); wait(900);
  clearBanner();
  drawEnts();
  drainEnc();
  while (true) {
    k = inp();
    if (k == 1) { pac.want = (pac.want + 1) & 3; dirDirty = true; }
    else if (k == 2) { pac.want = (pac.want + 3) & 3; dirDirty = true; }
    else if (k == 3) { pac.want = (pac.dir + 2) & 3; dirDirty = true; }
    else if (k == 4) {
      pm = pauseMenu();
      if (pm == 1) { QUIT = true; return -1; }
      if (pm == 2) { QUIT = true; return -2; }
      gameMode(); cls(BLACK); paintMaze(); hud();
      pac.drawn = false;
      for (i = 0; i < 4; i++) { ghosts[i].drawn = false; }
      drawEnts(); wait(500); drainEnc();
    }
    stepAll();
    res = collide();
    if (res == 1) {
      deathAnim();
      LIVES--; hudDirty = true;
      if (LIVES <= 0) { return 0; }
      resetPositions();
      paintMaze(); hud(); readyBanner("READY!"); wait(900);
      clearBanner();
      drawEnts(); drainEnc();
      continue;
    }
    if (dotsLeft <= 0) { levelClear(); return 1; }
    drawEnts();
    if (hudDirty) { hud(); } else if (dirDirty) { hudDir(); }
    tickN++;
    wait(GSPDW[GSPD]);
  }
}

/* ==========================================================
   SAVE / LOAD / CONFIG
   ========================================================== */
function saveGame() {
  var s = "PM1," + [LV, SCORE, LIVES, TOK, UP[0], UP[1], UP[2], UP[3], UP[4], DIFF, NEXTBONUS].join(",");
  return wrFile("/pacmess_save.txt", s);
}
function clearSave() { wrFile("/pacmess_save.txt", "PM0,0"); }
function hasSave() { return rdFile("/pacmess_save.txt").indexOf("PM1,") == 0; }
function loadGame() {
  var d = rdFile("/pacmess_save.txt"), p, i;
  if (d.indexOf("PM1,") != 0) { return false; }
  p = d.split(",");
  if (p.length < 11) { return false; }
  LV = parseInt(p[1], 10) || 1; SCORE = parseInt(p[2], 10) || 0; LIVES = parseInt(p[3], 10) || 3;
  TOK = parseInt(p[4], 10) || 0;
  for (i = 0; i < 5; i++) { UP[i] = parseInt(p[5 + i], 10) || 0; }
  DIFF = parseInt(p[10], 10); if (!(DIFF >= 0 && DIFF <= 2)) { DIFF = 1; }
  NEXTBONUS = parseInt(p[11], 10) || 10000;
  if (LV < 1) { LV = 1; } if (LV > MAXLV) { LV = MAXLV; }
  return true;
}
function loadHi() { var d = rdFile("/pacmess_hi.txt"); HI = parseInt(d, 10) || 0; }
function saveHi() { wrFile("/pacmess_hi.txt", String(HI)); }
function saveCfg() { wrFile("/pacmess_cfg.txt", "CFG," + GSPD + "," + (SOUND ? 1 : 0) + "," + DIFF); }
function loadCfg() {
  var d = rdFile("/pacmess_cfg.txt"), p;
  if (d.indexOf("CFG,") != 0) { return; }
  p = d.split(",");
  GSPD = parseInt(p[1], 10); if (!(GSPD >= 0 && GSPD <= 2)) { GSPD = 1; }
  SOUND = (p[2] != "0");
  DIFF = parseInt(p[3], 10); if (!(DIFF >= 0 && DIFF <= 2)) { DIFF = 1; }
}
function newGame() {
  LV = 1; SCORE = 0; LIVES = DIFFL[DIFF]; TOK = 0; UP = [0, 0, 0, 0, 0]; NEXTBONUS = 10000;
}

/* ==========================================================
   UPGRADE SHOP
   ========================================================== */
function upCost(i) {
  if (i == 2) { return 6 + LIVES; }
  if (i == 4) { return 8 + 6 * UP[4]; }
  return 3 + 2 * UP[i];
}
function upMax(i) { if (i == 2) { return 9; } if (i == 4) { return 2; } return 5; }
function shop() {
  var r, idx = 0, items, nm = ["Speed", "Power", "Life", "Slow", "Shield"], i, have;
  menuMode();
  while (true) {
    items = [];
    for (i = 0; i < 5; i++) {
      have = (i == 2) ? LIVES : UP[i];
      if (have >= upMax(i)) { items.push(nm[i] + " " + have + " MAX"); }
      else { items.push(nm[i] + " " + have + "/" + upMax(i) + "  " + upCost(i) + "T"); }
    }
    items.push("Next level >>");
    r = menu("UPGRADES  " + TOK + "T", items, idx,
      ["Pac moves faster", "Power pellets last longer", "+1 life (max 9)", "Ghosts move slower", "Absorbs a hit each level", "Start level " + LV]);
    if (r < 0 || r == 5) { return; }
    idx = r;
    have = (r == 2) ? LIVES : UP[r];
    if (have >= upMax(r)) { flash("Maxed out", GRAY); }
    else if (TOK < upCost(r)) { flash("Not enough tokens", RED); }
    else {
      TOK -= upCost(r);
      if (r == 2) { LIVES++; } else { UP[r]++; }
      beep(1000, 30);
      flash("Bought!", GREEN);
    }
  }
}

/* ==========================================================
   SCREENS
   ========================================================== */
function gameOver() {
  saveHi(); clearSave();
  cls(BLACK);
  sctxt("GAME OVER", 30, 3, RED, rgb(60, 0, 0));
  ctxt("Score " + SCORE, 78, 2, WHITE);
  ctxt("Hi-score " + HI, 100, 2, CYAN);
  ctxt("Reached level " + LV, 124, 1, YEL);
  ctxt("Press SEL", 152, 1, HINT);
  beep(300, 120);
  waitKey();
}
function winScreen() {
  saveHi(); clearSave();
  cls(BLACK);
  sctxt("YOU CLEARED", 24, 3, YEL, rgb(70, 50, 0));
  sctxt("THE MESS!", 56, 3, YEL, rgb(70, 50, 0));
  ctxt("All 50 levels done", 100, 2, GREEN);
  ctxt("Final score " + SCORE, 124, 1, WHITE);
  ctxt("Press SEL", 152, 1, HINT);
  beep(1200, 100);
  waitKey();
}
function howTo() {
  listLines("HOW TO PLAY", [
    ["TURN knob: clockwise = turn right", WHITE],
    ["            counter    = turn left", WHITE],
    ["The turn is queued; Pac takes it", GRAY],
    ["at the next open junction.", GRAY],
    ["SEL = instant U-turn", WHITE],
    ["ESC = pause / save / quit", WHITE],
    ["Eat all dots to clear the level.", YEL],
    ["Big pellets turn ghosts blue:", CYAN],
    ["eat them for 200/400/800/1600.", CYAN],
    ["Fruit = bonus points + 1 token.", GREEN],
    ["Spend tokens on upgrades after", PINK],
    ["each level. Extra life / 10000.", PINK]
  ]);
}
function titleScreen() {
  var t = 0, x, i, pw = false, cols = [YEL, ORNG, RED, PINK], cy = 126;
  cls(BLACK);
  for (i = 0; i < 20; i++) { fr(8 + i * 16, cy + 1, 2, 2, DOTC); }
  sctxt("PAC-MESS", 24, 4, YEL, rgb(80, 40, 0));
  sctxt("by da cbm", 66, 2, WHITE, rgb(30, 30, 80));
  ctxt("a maze of 50 levels", 92, 1, GRAY);
  var x0 = -90, dirR = true;
  while (true) {
    t++;
    if (t % 6 == 0) { sctxt("PAC-MESS", 24, 4, cols[(t / 6) & 3], rgb(80, 40, 0)); }
    if (dirR) { x0 += 3; if (x0 > W + 90) { dirR = false; } }
    else { x0 -= 3; if (x0 < -90) { dirR = true; } }
    fr(0, cy - 8, W, 18, BLACK);
    for (i = 0; i < 20; i++) { fr(8 + i * 16, cy + 1, 2, 2, DOTC); }
    if (dirR) {
      drawPacAt(x0, cy + 2, 0, (t >> 1) % 4, YEL);
      for (i = 0; i < 4; i++) { drawGhostAt(x0 - 22 - i * 16, cy + 2, GCOL[i], 0, false, 0, (t >> 2) & 1); }
    } else {
      drawPacAt(x0, cy + 2, 2, (t >> 1) % 4, YEL);
      for (i = 0; i < 4; i++) { drawGhostAt(x0 + 22 + i * 16, cy + 2, GCOL[i], 1, false, 2, (t >> 2) & 1); }
    }
    if ((t >> 3) % 2 == 0) { ctxt("Press SEL to start", 154, 1, WHITE); }
    else { fr(0, 152, W, 12, BLACK); }
    if (kSel() || kEsc()) { settleInput(); return; }
    drainEnc(); wait(30);
  }
}

/* ==========================================================
   MAIN FLOW
   ========================================================== */
function playGame() {
  var res;
  QUIT = false;
  while (true) {
    res = playLevel();
    if (res == 1) {
      TOK += 3 + Math.floor(LV / 10);
      if (LV >= MAXLV) { winScreen(); return; }
      LV++;
      saveGame();
      shop();
      saveGame();
    } else if (res == 0) { gameOver(); return; }
    else if (res == -1) { saveHi(); return; }
    else { saveHi(); clearSave(); return; }
  }
}
function runGame() {
  var r, idx = 0, saved, go;
  loadHi(); loadCfg();
  titleScreen();
  menuMode();
  while (true) {
    saved = hasSave();
    r = menu("PAC-MESS" + (HI > 0 ? "  Hi " + HI : ""),
      ["Continue", "New Game", "Difficulty: " + DIFFN[DIFF], "Speed: " + GSPDN[GSPD], "How To Play", "Exit"], idx,
      [saved ? "Resume your saved run" : "No saved game yet", "Start from level 1", "SEL cycles Easy/Normal/Hard", "SEL cycles game speed", "Controls and tips", "Quit to the launcher"]);
    if (r < 0) { r = 5; }
    idx = r; go = false;
    if (r == 0) {
      if (saved && loadGame()) { go = true; } else { flash("No saved game", RED); }
    } else if (r == 1) { newGame(); go = true; }
    else if (r == 2) { DIFF = (DIFF + 1) % 3; saveCfg(); }
    else if (r == 3) { GSPD = (GSPD + 1) % 3; saveCfg(); }
    else if (r == 4) { howTo(); }
    else if (r == 5) { cls(BLACK); ctxt("BYE FROM DA CBM", 80, 2, YEL); wait(700); return; }
    if (go) { playGame(); menuMode(); }
  }
}
function errScreen(msg) {
  cls(rgb(60, 0, 0));
  txt("Recovered from an error", 6, 6, 1, WHITE);
  var m = String(msg), y = 22;
  while (m.length > 0 && y < H - 30) { txt(m.substring(0, 50), 6, y, 1, YEL); m = m.substring(50); y += 11; }
  txt("Progress saved. Press SEL", 6, H - 14, 1, WHITE);
  waitKey();
}
function main() {
  var tries = 0, again = true, msg;
  while (again) {
    again = false;
    try { calibrateClock(); runGame(); }
    catch (err) {
      msg = (err && err.message) ? err.message : String(err);
      try { saveGame(); } catch (e2) {}
      try { wrFile("/pacmess_error.txt", msg + " lv " + LV); } catch (e4) {}
      try { errScreen(msg); } catch (e3) {}
      tries++;
      if (tries < 4) { again = true; try { menuMode(); } catch (e5) {} }
    }
  }
}
main();
