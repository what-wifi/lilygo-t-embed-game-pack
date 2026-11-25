/*
 * CONNECT 5 - ES5 for Bruce (LilyGO T-Embed CC1101)
 * -------------------------------------------------
 * Connect-4 rules on a 7 column x 6 row board.
 * Discs drop to the lowest free slot. First to line up 4 wins.
 *
 * Controls (rotary encoder):
 *   Rotate        -> move left / right
 *   Press         -> drop disc / confirm
 *   Esc           -> back to menu / quit
 *
 * You = RED (you go first, then it alternates each round)
 * CPU = YELLOW  (Easy / Normal / Hard)
 */

var display = require("display");
var keyboard = require("keyboard");

var W = display.width();
var H = display.height();

/* ---------- colours ---------- */
function rgb(r, g, b) { return display.color(r, g, b); }

var BLACK      = rgb(0, 0, 0);
var WHITE      = rgb(255, 255, 255);
var CYAN       = rgb(40, 210, 255);
var YELLOW     = rgb(255, 230, 40);
var DIM        = rgb(140, 140, 170);
var HEADER_BG  = rgb(16, 8, 40);
var SEL_BG     = rgb(30, 20, 70);
var BOARD_BLUE = rgb(20, 70, 210);
var BOARD_DARK = rgb(8, 30, 120);
var HOLE       = rgb(5, 5, 20);

var P1    = rgb(255, 40, 50);
var P1HI  = rgb(255, 170, 170);
var P1DK  = rgb(160, 15, 25);
var P2    = rgb(255, 215, 30);
var P2HI  = rgb(255, 255, 170);
var P2DK  = rgb(190, 140, 10);

var RED = rgb(255, 30, 30);
var RAINBOW = [RED, RED, RED, RED, RED, RED, RED];   /* solid red everywhere */

/* ---------- board geometry ---------- */
var COLS = 7;
var ROWS = 6;
var WIN_LEN = 4;
var TOTAL = COLS * ROWS;

var CELL = Math.floor(Math.min((W * 0.56) / COLS, (H - 44) / ROWS));
if (CELL > 26) CELL = 26;
if (CELL < 14) CELL = 14;

var BW = COLS * CELL;
var BH = ROWS * CELL;
var BOARD_OX = 8;
var BOARD_OY = H - BH - 6;
var RAD = Math.floor(CELL / 2) - 2;
var HOVER_Y = 28;

var PX = BOARD_OX + BW + 12;     /* side panel */
var PW = W - PX - 6;

/* ---------- game state ---------- */
var board = [];
var cursor = 3;
var myTurn = true;
var busy = false;
var gameOver = false;
var winner = 0;                  /* 1 = you, 2 = cpu, 3 = draw */
var winCells = null;
var state = "menu";
var menuSel = 0;
var tick = 0;
var scoreYou = 0;
var scoreCpu = 0;
var level = 1;
var playerFirst = true;

var LEVELS = ["EASY", "NORMAL", "HARD"];
var DEPTHS = [1, 3, 4];
var COL_ORDER = [3, 2, 4, 1, 5, 0, 6];

/* ---------- helpers ---------- */
function rnd(n) { return Math.floor(Math.random() * n); }

function flush() {
  keyboard.getPrevPress();
  keyboard.getNextPress();
  keyboard.getSelPress();
  keyboard.getEscPress();
}

function pcol(p) { return p === 1 ? P1 : P2; }
function phi(p)  { return p === 1 ? P1HI : P2HI; }
function pdk(p)  { return p === 1 ? P1DK : P2DK; }

function inB(r, c) { return r >= 0 && r < ROWS && c >= 0 && c < COLS; }

function resetBoard() {
  var i;
  board = [];
  for (i = 0; i < TOTAL; i++) board[i] = 0;
  cursor = 3;
  gameOver = false;
  winner = 0;
  winCells = null;
}

function dropRow(c) {
  var r;
  for (r = ROWS - 1; r >= 0; r--) {
    if (board[r * COLS + c] === 0) return r;
  }
  return -1;
}

function isFull() {
  var c;
  for (c = 0; c < COLS; c++) {
    if (board[c] === 0) return false;
  }
  return true;
}

function firstOpenCol() {
  var c;
  for (c = 0; c < COLS; c++) {
    if (dropRow(c) >= 0) return c;
  }
  return 0;
}

/* ---------- win detection ---------- */
var WINS = [];

function buildWins() {
  var dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  var d, r, c, k, nr, nc, cells, ok;
  for (d = 0; d < 4; d++) {
    for (r = 0; r < ROWS; r++) {
      for (c = 0; c < COLS; c++) {
        cells = [];
        ok = true;
        for (k = 0; k < WIN_LEN; k++) {
          nr = r + k * dirs[d][0];
          nc = c + k * dirs[d][1];
          if (!inB(nr, nc)) { ok = false; break; }
          cells.push(nr * COLS + nc);
        }
        if (ok) WINS.push(cells);
      }
    }
  }
}

function countDir(r, c, dr, dc, p) {
  var n = 0;
  r += dr;
  c += dc;
  while (inB(r, c) && board[r * COLS + c] === p) {
    n++;
    r += dr;
    c += dc;
  }
  return n;
}

/* does the disc just placed at (r,c) complete a line? */
function winAt(r, c, p) {
  var dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  var i;
  for (i = 0; i < 4; i++) {
    if (1 + countDir(r, c, dirs[i][0], dirs[i][1], p) +
            countDir(r, c, -dirs[i][0], -dirs[i][1], p) >= WIN_LEN) return true;
  }
  return false;
}

/* returns the 4 winning cells for player p, or null */
function findWinner(p) {
  var w, k, ok;
  for (w = 0; w < WINS.length; w++) {
    ok = true;
    for (k = 0; k < WIN_LEN; k++) {
      if (board[WINS[w][k]] !== p) { ok = false; break; }
    }
    if (ok) return WINS[w];
  }
  return null;
}

/* ---------- AI ---------- */
function evalBoard() {
  var s = 0, w, k, a, p, v, cells, r;
  for (w = 0; w < WINS.length; w++) {
    cells = WINS[w];
    a = 0;
    p = 0;
    for (k = 0; k < WIN_LEN; k++) {
      v = board[cells[k]];
      if (v === 2) a++;
      else if (v === 1) p++;
    }
    if (a > 0 && p > 0) continue;
    if (a === 3) s += 50;
    else if (a === 2) s += 10;
    if (p === 3) s -= 60;
    else if (p === 2) s -= 10;
  }
  for (r = 0; r < ROWS; r++) {
    v = board[r * COLS + 3];
    if (v === 2) s += 4;
    else if (v === 1) s -= 4;
  }
  return s;
}

function search(depth, alpha, beta, maxing) {
  var i, c, r, v, best, pl, any;
  if (depth === 0) return evalBoard();
  best = maxing ? -999999 : 999999;
  pl = maxing ? 2 : 1;
  any = false;
  for (i = 0; i < COLS; i++) {
    c = COL_ORDER[i];
    r = dropRow(c);
    if (r < 0) continue;
    any = true;
    board[r * COLS + c] = pl;
    if (winAt(r, c, pl)) {
      v = maxing ? (100000 + depth) : -(100000 + depth);
    } else {
      v = search(depth - 1, alpha, beta, !maxing);
    }
    board[r * COLS + c] = 0;
    if (maxing) {
      if (v > best) best = v;
      if (best > alpha) alpha = best;
    } else {
      if (v < best) best = v;
      if (best < beta) beta = best;
    }
    if (alpha >= beta) break;
  }
  if (!any) return 0;
  return best;
}

function aiPickColumn() {
  var i, c, r, v, best, ties, hit;

  /* 1. win now */
  for (i = 0; i < COLS; i++) {
    c = COL_ORDER[i];
    r = dropRow(c);
    if (r < 0) continue;
    board[r * COLS + c] = 2;
    hit = winAt(r, c, 2);
    board[r * COLS + c] = 0;
    if (hit) return c;
  }

  /* easy mode sometimes just plays randomly */
  if (level === 0 && rnd(100) < 30) {
    do { c = rnd(COLS); } while (dropRow(c) < 0);
    return c;
  }

  /* 2. block the player */
  for (i = 0; i < COLS; i++) {
    c = COL_ORDER[i];
    r = dropRow(c);
    if (r < 0) continue;
    board[r * COLS + c] = 1;
    hit = winAt(r, c, 1);
    board[r * COLS + c] = 0;
    if (hit) return c;
  }

  /* 3. look ahead */
  best = -9999999;
  ties = [];
  for (i = 0; i < COLS; i++) {
    c = COL_ORDER[i];
    r = dropRow(c);
    if (r < 0) continue;
    board[r * COLS + c] = 2;
    v = search(DEPTHS[level] - 1, -9999999, 9999999, false);
    board[r * COLS + c] = 0;
    if (v > best) {
      best = v;
      ties = [c];
    } else if (v === best) {
      ties.push(c);
    }
  }
  if (ties.length === 0) return firstOpenCol();
  if (level === 0) return ties[0];
  return ties[rnd(ties.length)];
}

/* ---------- drawing: shared ---------- */
function drawDisc(cx, cy, rad, p) {
  var h = Math.floor(rad / 3);
  if (h < 1) h = 1;
  display.drawFillCircle(cx, cy, rad, pcol(p));
  display.drawCircle(cx, cy, rad, pdk(p));
  display.drawFillCircle(cx - h, cy - h, h, phi(p));
}

function drawHeaderBase() {
  var i, sw = Math.floor(W / 7) + 1;
  display.drawFillRect(0, 0, W, 20, HEADER_BG);
  for (i = 0; i < 7; i++) {
    display.drawFillRect(i * Math.floor(W / 7), 19, sw, 1, RAINBOW[(i + (tick >> 2)) % 7]);
  }
}

function drawHeaderTitle() {
  var t = "CONNECT 5", i, tx = Math.floor((W - t.length * 12) / 2);
  display.setTextSize(2);
  for (i = 0; i < t.length; i++) {
    display.setTextColor(RAINBOW[(i + (tick >> 2)) % 7]);
    display.drawString(t.charAt(i), tx + i * 12, 2);
  }
}

function animateHeader() {
  var i, sw = Math.floor(W / 7) + 1;
  for (i = 0; i < 7; i++) {
    display.drawFillRect(i * Math.floor(W / 7), 19, sw, 1, RAINBOW[(i + (tick >> 2)) % 7]);
  }
  drawHeaderTitle();
}

/* ---------- drawing: board ---------- */
function drawCell(r, c) {
  var x0 = BOARD_OX + c * CELL;
  var y0 = BOARD_OY + r * CELL;
  var cx = x0 + (CELL >> 1);
  var cy = y0 + (CELL >> 1);
  var v = board[r * COLS + c];
  display.drawFillRect(x0, y0, CELL, CELL, BOARD_BLUE);
  display.drawCircle(cx, cy, RAD + 1, BOARD_DARK);
  if (v === 0) {
    display.drawFillCircle(cx, cy, RAD, HOLE);
  } else {
    drawDisc(cx, cy, RAD, v);
  }
}

function drawColumn(c) {
  var r, x0 = BOARD_OX + c * CELL, row, cx;
  display.drawFillRect(x0, BOARD_OY - 3, CELL, 3, BOARD_DARK);
  display.drawFillRect(x0, BOARD_OY + BH, CELL, 3, BOARD_DARK);
  for (r = 0; r < ROWS; r++) drawCell(r, c);
  if (c === cursor && state === "play" && myTurn && !gameOver && !busy) {
    display.drawRect(x0, BOARD_OY, CELL, BH, RAINBOW[(tick >> 1) % 7]);
    row = dropRow(c);
    if (row >= 0) {
      cx = x0 + (CELL >> 1);
      display.drawCircle(cx, BOARD_OY + row * CELL + (CELL >> 1), RAD - 2, P1);
    }
  }
}

function drawBoardAll() {
  var c;
  display.drawFillRoundRect(BOARD_OX - 3, BOARD_OY - 3, BW + 6, BH + 6, 6, BOARD_DARK);
  for (c = 0; c < COLS; c++) drawColumn(c);
}

function drawHover() {
  display.drawFillRect(BOARD_OX - 3, 21, BW + 6, BOARD_OY - 3 - 21, BLACK);
  if (state === "play" && myTurn && !gameOver && !busy) {
    drawDisc(BOARD_OX + cursor * CELL + (CELL >> 1), HOVER_Y, 6, 1);
  }
}

function cellCenter(i) {
  var r = Math.floor(i / COLS);
  var c = i % COLS;
  return { x: BOARD_OX + c * CELL + (CELL >> 1), y: BOARD_OY + r * CELL + (CELL >> 1) };
}

function drawWinLine() {
  var p1, p2, i, off = [[0, 0], [1, 0], [0, 1]];
  if (!winCells) return;
  p1 = cellCenter(winCells[0]);
  p2 = cellCenter(winCells[winCells.length - 1]);
  for (i = 0; i < 3; i++) {
    display.drawLine(p1.x + off[i][0], p1.y + off[i][1], p2.x + off[i][0], p2.y + off[i][1], WHITE);
  }
  display.drawFillCircle(p1.x, p1.y, 3, CYAN);
  display.drawFillCircle(p2.x, p2.y, 3, CYAN);
}

/* ---------- drawing: side panel ---------- */
function clearPanel() {
  display.drawFillRect(PX - 3, 21, W - (PX - 3), H - 21, BLACK);
}

function drawScoreBox(y, p, label, score) {
  var s = "" + score;
  display.drawRoundRect(PX, y, PW, 26, 5, pdk(p));
  drawDisc(PX + 14, y + 13, 8, p);
  display.setTextSize(1);
  display.setTextColor(WHITE);
  display.drawString(label, PX + 28, y + 9);
  display.setTextSize(2);
  display.setTextColor(pcol(p));
  display.drawString(s, PX + PW - 8 - s.length * 12, y + 5);
}

function drawHints() {
  display.setTextSize(1);
  display.setTextColor(DIM);
  if (state === "over") {
    display.drawString("Press = rematch", PX, H - 30);
  } else {
    display.drawString("Turn = move  Press = drop", PX, H - 30);
  }
  display.drawString("Esc = menu", PX, H - 18);
}

function drawStatus(full) {
  var msg, col, tw;
  if (state === "over") {
    if (winner === 1) {
      msg = "YOU WIN!";
      col = RAINBOW[(tick >> 2) % 7];
    } else if (winner === 2) {
      msg = "YOU LOSE";
      col = ((tick >> 2) & 1) ? P2 : WHITE;
    } else {
      msg = "DRAW GAME";
      col = CYAN;
    }
  } else if (myTurn) {
    msg = "YOUR TURN";
    col = P1;
  } else {
    msg = "CPU THINKS";
    col = P2;
  }
  if (full) display.drawFillRect(PX, 98, PW, 36, BLACK);
  display.drawRoundRect(PX, 98, PW, 36, 6, col);
  display.setTextSize(2);
  display.setTextColor(col);
  tw = msg.length * 12;
  display.drawString(msg, PX + ((PW - tw) >> 1), 107);
}

function drawPanel() {
  clearPanel();
  drawScoreBox(24, 1, "YOU", scoreYou);
  drawScoreBox(54, 2, "CPU", scoreCpu);
  display.setTextSize(1);
  display.setTextColor(CYAN);
  display.drawString("LEVEL: " + LEVELS[level], PX, 84);
  drawStatus(true);
  drawHints();
}

function drawPlayScreen() {
  display.fill(BLACK);
  drawHeaderBase();
  drawHeaderTitle();
  drawBoardAll();
  drawHover();
  drawPanel();
}

/* ---------- confetti ---------- */
var CN = 30;
var cfx = [], cfy = [], cfvx = [], cfvy = [], cfc = [];

function spawnConfetti() {
  var i;
  for (i = 0; i < CN; i++) {
    cfx[i] = PX + rnd(PW - 2);
    cfy[i] = 21 + rnd(H - 25);
    cfvx[i] = rnd(3) - 1;
    cfvy[i] = 1 + rnd(3);
    cfc[i] = RAINBOW[rnd(7)];
  }
}

function updateConfetti() {
  var i;
  for (i = 0; i < CN; i++) {
    display.drawFillRect(cfx[i], cfy[i], 2, 2, BLACK);
    cfx[i] += cfvx[i];
    cfy[i] += cfvy[i];
    if (cfx[i] < PX) cfx[i] = PX;
    if (cfx[i] > PX + PW - 2) cfx[i] = PX + PW - 2;
    if (cfy[i] >= H - 3) {
      cfy[i] = 21;
      cfx[i] = PX + rnd(PW - 2);
    }
    display.drawFillRect(cfx[i], cfy[i], 2, 2, cfc[i]);
  }
}

/* ---------- animations ---------- */
function animateDrop(c, tr, p) {
  var x0 = BOARD_OX + c * CELL;
  var cx = x0 + (CELL >> 1);
  var ty = BOARD_OY + tr * CELL + (CELL >> 1);
  var y = HOVER_Y, vy = 1, bounce = 0, n = 0, landed = false;

  busy = true;
  while (n < 150 && !landed) {
    n++;
    vy += 1.6;
    y += vy;
    if (y >= ty) {
      y = ty;
      if (bounce >= 2 || Math.abs(vy) < 2.5) {
        landed = true;
      } else {
        vy = -vy * 0.38;
        bounce++;
      }
    }
    display.drawFillRect(x0, 21, CELL, BOARD_OY - 21, BLACK);
    drawColumn(c);
    drawDisc(cx, Math.floor(y), RAD, p);
    delay(10);
  }
}

function celebrate(win) {
  var f, i, on, r, c, cx, cy;
  clearPanel();
  if (win) spawnConfetti();
  for (f = 0; f < 24; f++) {
    on = ((f & 1) === 0);
    for (i = 0; i < WIN_LEN; i++) {
      r = Math.floor(winCells[i] / COLS);
      c = winCells[i] % COLS;
      drawCell(r, c);
      if (on) {
        cx = BOARD_OX + c * CELL + (CELL >> 1);
        cy = BOARD_OY + r * CELL + (CELL >> 1);
        display.drawFillCircle(cx, cy, RAD, WHITE);
      }
    }
    if (win) updateConfetti();
    tick += 2;
    animateHeader();
    delay(55);
  }
  for (i = 0; i < WIN_LEN; i++) {
    r = Math.floor(winCells[i] / COLS);
    c = winCells[i] % COLS;
    drawCell(r, c);
  }
}

/* ---------- game flow ---------- */
function finish() {
  gameOver = true;
  busy = false;
  state = "over";
  if (winner === 1) scoreYou++;
  else if (winner === 2) scoreCpu++;
  if (winCells) {
    celebrate(winner === 1);
    drawWinLine();
  }
  drawHover();
  drawPanel();
  playerFirst = !playerFirst;
  flush();
}

/* returns true if the game ended */
function doMove(c, p) {
  var r = dropRow(c);
  animateDrop(c, r, p);
  board[r * COLS + c] = p;
  drawColumn(c);
  if (winAt(r, c, p)) {
    winner = p;
    winCells = findWinner(p);
    return true;
  }
  if (isFull()) {
    winner = 3;
    return true;
  }
  return false;
}

function cpuMove() {
  var c;
  busy = true;
  myTurn = false;
  drawColumn(cursor);
  drawHover();
  drawStatus(true);
  delay(250);
  c = aiPickColumn();
  if (doMove(c, 2)) {
    finish();
    return;
  }
  myTurn = true;
  busy = false;
  if (dropRow(cursor) < 0) cursor = firstOpenCol();
  drawColumn(cursor);
  drawHover();
  drawStatus(true);
  flush();
}

function playerMove() {
  if (!myTurn || busy || gameOver) return;
  if (dropRow(cursor) < 0) return;
  busy = true;
  myTurn = false;
  drawHover();
  if (doMove(cursor, 1)) {
    finish();
    return;
  }
  cpuMove();
}

function startGame(fromMenu) {
  if (fromMenu) {
    scoreYou = 0;
    scoreCpu = 0;
    playerFirst = true;
  }
  resetBoard();
  state = "play";
  busy = false;
  myTurn = playerFirst;
  drawPlayScreen();
  if (!playerFirst) {
    cpuMove();
  } else {
    flush();
  }
}

function moveCursor(dir) {
  var old = cursor, tries = 0;
  if (state !== "play" || !myTurn || busy || gameOver) return;
  do {
    cursor = (cursor + dir + COLS) % COLS;
    tries++;
  } while (dropRow(cursor) < 0 && tries < COLS);
  drawColumn(old);
  drawColumn(cursor);
  drawHover();
}

/* ---------- menu ---------- */
var MENU_N = 3;
var decX = [], decY = [], decV = [], decP = [];
var DEC_N = 6;

function initDecor() {
  var xs = [12, 30, 48, W - 12, W - 30, W - 48], i;
  for (i = 0; i < DEC_N; i++) {
    decX[i] = xs[i];
    decY[i] = rnd(H);
    decV[i] = 2 + (i % 3);
    decP[i] = (i % 2) + 1;
  }
}

function updateDecor() {
  var i;
  for (i = 0; i < DEC_N; i++) {
    if (decY[i] >= 7 && decY[i] <= H - 7) {
      display.drawFillCircle(decX[i], decY[i], 7, BLACK);
    }
    decY[i] += decV[i];
    if (decY[i] > H + 10) decY[i] = -10;
    if (decY[i] >= 7 && decY[i] <= H - 7) {
      drawDisc(decX[i], decY[i], 6, decP[i]);
    }
  }
}

function menuLabel(i) {
  if (i === 0) return "PLAY";
  if (i === 1) return "LEVEL: " + LEVELS[level];
  return "QUIT";
}

function drawMenuItems() {
  var i, y, x = 60, w = W - 120, sel, label;
  for (i = 0; i < MENU_N; i++) {
    y = 74 + i * 28;
    sel = (i === menuSel);
    label = menuLabel(i);
    display.drawFillRect(x - 3, y - 3, w + 6, 28, BLACK);
    if (sel) {
      display.drawFillRoundRect(x, y, w, 24, 6, SEL_BG);
      display.drawRoundRect(x, y, w, 24, 6, RAINBOW[(tick >> 2) % 7]);
      display.setTextColor(YELLOW);
    } else {
      display.setTextColor(DIM);
    }
    display.setTextSize(2);
    display.drawString(label, x + ((w - label.length * 12) >> 1), y + 4);
  }
}

function drawMenuTitle() {
  var t = "CONNECT 5", i, tx = Math.floor((W - t.length * 18) / 2);
  display.setTextSize(3);
  for (i = 0; i < t.length; i++) {
    display.setTextColor(RAINBOW[(i + (tick >> 2)) % 7]);
    display.drawString(t.charAt(i), tx + i * 18, 8);
  }
}

function drawMenu() {
  var i, sw = Math.floor(W / 7) + 1;
  display.fill(BLACK);
  initDecor();
  drawMenuTitle();
  for (i = 0; i < 7; i++) {
    display.drawFillRect(i * Math.floor(W / 7), 38, sw, 2, RAINBOW[i]);
  }
  display.setTextSize(1);
  display.setTextColor(CYAN);
  display.drawString("Drop discs - get 4 in a row!", Math.floor((W - 28 * 6) / 2), 46);
  display.setTextColor(RED);
  display.drawString("by da cbm", Math.floor((W - 9 * 6) / 2), 58);
  drawMenuItems();
  display.setTextColor(DIM);
  display.drawString("Turn = select   Press = OK", Math.floor((W - 26 * 6) / 2), H - 12);
}

function goMenu() {
  state = "menu";
  menuSel = 0;
  busy = false;
  drawMenu();
}

function moveMenu(dir) {
  menuSel = (menuSel + dir + MENU_N) % MENU_N;
  drawMenuItems();
}

/* returns true to quit */
function onSelect() {
  if (state === "menu") {
    if (menuSel === 0) {
      startGame(true);
    } else if (menuSel === 1) {
      level = (level + 1) % 3;
      drawMenuItems();
    } else {
      return true;
    }
  } else if (state === "play") {
    playerMove();
  } else if (state === "over") {
    startGame(false);
  }
  return false;
}

function bye() {
  var t = "BYE!", i;
  display.fill(BLACK);
  display.setTextSize(3);
  for (i = 0; i < t.length; i++) {
    display.setTextColor(RAINBOW[(i * 2) % 7]);
    display.drawString(t.charAt(i), Math.floor(W / 2) - 36 + i * 18, Math.floor(H / 2) - 12);
  }
  delay(600);
}

/* ---------- main ---------- */
buildWins();
resetBoard();
drawMenu();

while (true) {
  tick++;

  if (keyboard.getEscPress()) {
    if (state === "play" || state === "over") {
      goMenu();
    } else {
      break;
    }
  }

  if (keyboard.getPrevPress()) {
    if (state === "menu") moveMenu(-1);
    else moveCursor(-1);
  }
  if (keyboard.getNextPress()) {
    if (state === "menu") moveMenu(1);
    else moveCursor(1);
  }
  if (keyboard.getSelPress()) {
    if (onSelect()) break;
  }

  if (state === "menu") {
    if ((tick & 1) === 0) updateDecor();
    if ((tick & 3) === 0) {
      drawMenuTitle();
      drawMenuItems();
    }
  } else if (state === "play") {
    if ((tick & 3) === 0) {
      animateHeader();
      if (myTurn && !busy && !gameOver) drawColumn(cursor);
    }
  } else if (state === "over") {
    if ((tick & 3) === 0) {
      animateHeader();
      drawStatus(false);
    }
  }

  delay(30);
}

bye();
