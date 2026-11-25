// =====================================================================
//  PINBALL MASHER  -  by da cbm
//  Bruce firmware  |  LilyGO T-Embed CC1101  |  ES5
//
//  Table geometry, bumper layout, flipper pivots, drain and scoring are
//  ported from PinballGame.js (Phaser/Box2D). Physics is a small custom
//  engine so it runs on the ESP32.
//
//  The T-Embed screen is landscape, so the game draws a PORTRAIT table by
//  rotating everything in software. Turn the device 90 degrees clockwise
//  (or pick FLIP SCREEN in the menu for the other way).
//
//  CONTROLS (encoder)
//   FLICK LEFT  (turn CCW)  : left flipper snaps up and HOLDS ~0.4s
//                             (keep flicking to keep it up)
//   FLICK RIGHT (turn CW)   : right flipper snaps up and HOLDS
//   HOLD BUTTON             : both flippers locked UP while held
//   AT THE PLUNGER          : HOLD button to pull the plunger back,
//                             RELEASE to launch (longer hold = harder)
//   BACK / ESC              : pause menu
// =====================================================================

// ---------------------------------------------------------------- hardware
var PW = 320, PH = 170;
try { PW = display.width(); PH = display.height(); } catch (e0) {}
var NATIVE_PORTRAIT = PH > PW;
var LW, LH;
if (NATIVE_PORTRAIT) { LW = PW; LH = PH; } else { LW = PH; LH = PW; }
var rotMode = NATIVE_PORTRAIT ? 0 : 1;   // 0 none, 1 device turned CW, 2 device turned CCW

var SOUND = true;
var SWAPLR = false;

function beep(f, ms) { try { audio.tone(f, ms); } catch (e) {} }
function snd(f, ms) { if (SOUND) { beep(f, ms); } }

function tnow() {
  try { if (typeof now === 'function') { return now(); } } catch (e) {}
  return new Date().getTime();
}
function nap(ms) { try { if (typeof delay === 'function') { delay(ms); } } catch (e) {} }

function kb(name) {
  try { return keyboard[name]() ? true : false; } catch (e) { return false; }
}

// ---------------------------------------------------------------- drawing
function rgb(r, g, b) {
  r = r < 0 ? 0 : (r > 255 ? 255 : r | 0);
  g = g < 0 ? 0 : (g > 255 ? 255 : g | 0);
  b = b < 0 ? 0 : (b > 255 ? 255 : b | 0);
  return ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3);
}
function lerp(a, b, t) { return a + (b - a) * t; }

function mapX(x, y) { return rotMode === 0 ? x : (rotMode === 1 ? y : PW - 1 - y); }
function mapY(x, y) { return rotMode === 0 ? y : (rotMode === 1 ? PH - 1 - x : x); }

function fRect(x, y, w, h, c) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  if (w <= 0 || h <= 0) { return; }
  if (rotMode === 0) { display.drawFillRect(x, y, w, h, c); }
  else if (rotMode === 1) { display.drawFillRect(y, PH - x - w, h, w, c); }
  else { display.drawFillRect(PW - y - h, x, h, w, c); }
}
function pix(x, y, c) {
  x = Math.round(x); y = Math.round(y);
  display.drawPixel(mapX(x, y), mapY(x, y), c);
}
function line(x0, y0, x1, y1, c) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  display.drawLine(mapX(x0, y0), mapY(x0, y0), mapX(x1, y1), mapY(x1, y1), c);
}
function circ(x, y, r, c) {
  x = Math.round(x); y = Math.round(y); r = Math.round(r);
  if (r < 1) { pix(x, y, c); return; }
  display.drawFillCircle(mapX(x, y), mapY(x, y), r, c);
}
function ring(x, y, r, c) {
  x = Math.round(x); y = Math.round(y); r = Math.round(r);
  display.drawCircle(mapX(x, y), mapY(x, y), r, c);
}
function clearAll(c) {
  try {
    if (typeof display.fillScreen === 'function') { display.fillScreen(c); return; }
    if (typeof display.fill === 'function') { display.fill(c); return; }
  } catch (e) {}
  display.drawFillRect(0, 0, PW, PH, c);
}

// 5x7 font (columns, bit0 = top row)
var FONT = {
  ' ': [0, 0, 0, 0, 0], '!': [0, 0, 0x5F, 0, 0], '-': [8, 8, 8, 8, 8], ':': [0, 0, 0x14, 0, 0],
  '.': [0, 0, 0x60, 0x60, 0], '/': [0x20, 0x10, 8, 4, 2], '+': [8, 8, 0x3E, 8, 8],
  '>': [0, 0x41, 0x22, 0x14, 8], '<': [8, 0x14, 0x22, 0x41, 0], '?': [2, 1, 0x59, 9, 6],
  '0': [0x3E, 0x51, 0x49, 0x45, 0x3E], '1': [0, 0x42, 0x7F, 0x40, 0], '2': [0x72, 0x49, 0x49, 0x49, 0x46],
  '3': [0x21, 0x41, 0x49, 0x4D, 0x33], '4': [0x18, 0x14, 0x12, 0x7F, 0x10], '5': [0x27, 0x45, 0x45, 0x45, 0x39],
  '6': [0x3C, 0x4A, 0x49, 0x49, 0x31], '7': [0x41, 0x21, 0x11, 9, 7], '8': [0x36, 0x49, 0x49, 0x49, 0x36],
  '9': [0x46, 0x49, 0x49, 0x29, 0x1E],
  'A': [0x7C, 0x12, 0x11, 0x12, 0x7C], 'B': [0x7F, 0x49, 0x49, 0x49, 0x36], 'C': [0x3E, 0x41, 0x41, 0x41, 0x22],
  'D': [0x7F, 0x41, 0x41, 0x41, 0x3E], 'E': [0x7F, 0x49, 0x49, 0x49, 0x41], 'F': [0x7F, 9, 9, 9, 1],
  'G': [0x3E, 0x41, 0x41, 0x51, 0x73], 'H': [0x7F, 8, 8, 8, 0x7F], 'I': [0, 0x41, 0x7F, 0x41, 0],
  'J': [0x20, 0x40, 0x41, 0x3F, 1], 'K': [0x7F, 8, 0x14, 0x22, 0x41], 'L': [0x7F, 0x40, 0x40, 0x40, 0x40],
  'M': [0x7F, 2, 0x1C, 2, 0x7F], 'N': [0x7F, 4, 8, 0x10, 0x7F], 'O': [0x3E, 0x41, 0x41, 0x41, 0x3E],
  'P': [0x7F, 9, 9, 9, 6], 'Q': [0x3E, 0x41, 0x51, 0x21, 0x5E], 'R': [0x7F, 9, 0x19, 0x29, 0x46],
  'S': [0x26, 0x49, 0x49, 0x49, 0x32], 'T': [3, 1, 0x7F, 1, 3], 'U': [0x3F, 0x40, 0x40, 0x40, 0x3F],
  'V': [0x1F, 0x20, 0x40, 0x20, 0x1F], 'W': [0x3F, 0x40, 0x38, 0x40, 0x3F], 'X': [0x63, 0x14, 8, 0x14, 0x63],
  'Y': [3, 4, 0x78, 4, 3], 'Z': [0x61, 0x59, 0x49, 0x4D, 0x43]
};

function txtW(s, sc) { return s.length * 6 * sc - sc; }
function txt(s, x, y, sc, c) {
  s = ('' + s).toUpperCase();
  for (var i = 0; i < s.length; i++) {
    var g = FONT[s.charAt(i)];
    if (!g) { g = FONT['?']; }
    for (var col = 0; col < 5; col++) {
      var bits = g[col];
      var r = 0;
      while (r < 7) {
        if (bits & (1 << r)) {
          var r0 = r;
          while (r < 7 && (bits & (1 << r))) { r++; }
          fRect(x + (i * 6 + col) * sc, y + r0 * sc, sc, (r - r0) * sc, c);
        } else { r++; }
      }
    }
  }
}
function txtC(s, cx, y, sc, c) { txt(s, cx - Math.floor(txtW(('' + s), sc) / 2), y, sc, c); }
function txtR(s, rx, y, sc, c) { txt(s, rx - txtW(('' + s), sc), y, sc, c); }

// ---------------------------------------------------------------- colours
var C_BOARD = rgb(8, 10, 42);
var C_WALL = rgb(0, 235, 255), C_WALL2 = rgb(0, 70, 130);
var C_GUIDE = rgb(255, 70, 225), C_GUIDE2 = rgb(110, 20, 100), C_GUIDEFILL = rgb(60, 8, 95);
var C_BALL1 = rgb(170, 180, 210), C_BALL2 = rgb(245, 245, 255);

function extCol(y) {
  var bi = Math.floor(y / 16);
  var t = bi / 19;
  if (t < 0) { t = 0; } if (t > 1) { t = 1; }
  return rgb(lerp(70, 10, t), lerp(0, 4, t), lerp(110, 40, t));
}

// ---------------------------------------------------------------- table geometry (ported)
var S = 0.52, OFFX = 7, OFFY = 29, XMIN = -146.3, YMIN = -460.4;
// takes RAW vertex values from the original arrays (original scales x0.95, draws at x0.1 = x0.095)
function TX(vx) { return OFFX + (vx * 0.095 - XMIN) * S; }
function TY(vy) { return OFFY + (vy * 0.095 - YMIN) * S; }
function PX(px) { return OFFX + (px - XMIN) * S; }
function PY(py) { return OFFY + (py - YMIN) * S; }

var outlineV = [1440, -3687, 1023, -2194, 1365, -1961, 1365, -663, 638, -480, 160, -154, 150, 971, -330, 970, -335, -153, -800, -480, -1540, -619, -1540, -1988, -1147, -2175, -1429, -3152, -1500, -3195, -1492, -3399, -1438, -3867, -1309, -4132, -1112, -4351, -787, -4540, -389, -4670, 139, -4778, 655, -4846, 872, -4837, 1067, -4792, 1236, -4700, 1374, -4584, 1480, -4440, 1557, -4271, 1601, -3992, 1601, -3712, 1600, -171, 1442, -169, 1440, -3687];
var guide1V = [-825, -746, -771, -853, -1280, -1120, -1280, -1759, -1360, -1759, -1360, -959, -825, -746];
var guide2V = [663, -743, 614, -855, 1119, -1121, 1123, -1760, 1200, -1759, 1200, -959, 663, -743];
var guide3V = [-1116, -1753, -1118, -1277, -838, -1110, -1116, -1753];
var guide4V = [671, -1110, 956, -1282, 956, -1762, 671, -1110];
var smallC = [-1320, -1759, 1160, -1759];
var mediumC = [-1500, -3132, -866, -3163, -290, -3074, 187, -3415, 614, -3074, -451, -2232, 396, -2242];
var largeC = [-446, -3704, 309, -4133, 990, -3750];

function polyPts(arr) {
  var p = [];
  for (var i = 0; i < arr.length; i += 2) { p.push([TX(arr[i]), TY(arr[i + 1])]); }
  return p;
}
var outlinePts = polyPts(outlineV);
var guide1Pts = polyPts(guide1V), guide2Pts = polyPts(guide2V);
var guide3Pts = polyPts(guide3V), guide4Pts = polyPts(guide4V);

var walls = [];
function addChain(pts, c, c2) {
  for (var i = 0; i < pts.length - 1; i++) {
    walls.push({ x0: pts[i][0], y0: pts[i][1], x1: pts[i + 1][0], y1: pts[i + 1][1], c: c, c2: c2 });
  }
}
addChain(outlinePts, C_WALL, C_WALL2);
addChain(guide1Pts, C_GUIDE, C_GUIDE2);
addChain(guide2Pts, C_GUIDE, C_GUIDE2);
addChain(guide3Pts, C_GUIDE, C_GUIDE2);
addChain(guide4Pts, C_GUIDE, C_GUIDE2);

// uniform grid so the ball only tests nearby walls
var CELL = 16;
var GW = Math.ceil(LW / CELL) + 1, GH = Math.ceil(LH / CELL) + 1;
var cells = [];
(function buildGrid() {
  var i, j, k;
  for (i = 0; i < GW * GH; i++) { cells.push([]); }
  var m = 7;
  for (i = 0; i < walls.length; i++) {
    var w = walls[i];
    var minx = Math.min(w.x0, w.x1) - m, maxx = Math.max(w.x0, w.x1) + m;
    var miny = Math.min(w.y0, w.y1) - m, maxy = Math.max(w.y0, w.y1) + m;
    var cx0 = Math.max(0, Math.floor(minx / CELL)), cx1 = Math.min(GW - 1, Math.floor(maxx / CELL));
    var cy0 = Math.max(0, Math.floor(miny / CELL)), cy1 = Math.min(GH - 1, Math.floor(maxy / CELL));
    for (j = cy0; j <= cy1; j++) { for (k = cx0; k <= cx1; k++) { cells[j * GW + k].push(i); } }
  }
})();
var wstamp = [];
(function () { for (var i = 0; i < walls.length; i++) { wstamp.push(0); } })();
var stampN = 0;

// bumpers: small posts (5), medium (10), large (20)
var bumpers = [];
(function buildBumpers() {
  var i;
  for (i = 0; i < smallC.length; i += 2) {
    bumpers.push({ x: TX(smallC[i]), y: TY(smallC[i + 1]), R: 3.5 * S + 0.6, pts: 5, kind: 0, flash: 0, dirty: false, kick: 40 });
  }
  for (i = 0; i < mediumC.length; i += 2) {
    bumpers.push({ x: TX(mediumC[i]), y: TY(mediumC[i + 1]), R: 10 * S, pts: 10, kind: 1, flash: 0, dirty: false, kick: 90 });
  }
  for (i = 0; i < largeC.length; i += 2) {
    bumpers.push({ x: TX(largeC[i]), y: TY(largeC[i + 1]), R: 28 * S, pts: 20, kind: 2, flash: 0, dirty: false, kick: 70 });
  }
})();

// lane / plunger / drain
var laneL = PX(137.0), laneR = PX(152.1), laneCx = PX(144.55);
var plateY = PY(-47.5);
var laneBottom = PY(-16.2);
var Y_GUTTER = PY(61.75);
var PULL_MAX = 11;
var ballStartY = PY(-285);

// physics constants (orig px/s -> logical)
var G = 500 * S;
var BR = 6.4 * S;
var VCAP = 700;
var VLO = 640 * S, VHI = 1000 * S;   // launch speed range
var FSPEED = 15;                     // flipper angular speed, rad/s
var HOLD_MS = 420;
var HOLD_GRACE = 260;
var RF = 2.3;                        // flipper half thickness

// flippers (unified angle phi: axis = (cos phi, sin phi))
function mkFlipper(pxo, pyo, rest, up, tapered) {
  return {
    px: PX(pxo), py: PY(pyo), len: 53.2 * S,
    ph: rest, restPh: rest, upPh: up, w: 0,
    tx: 0, ty: 0, holdUntil: 0, locked: false, dirty: true, drawnPh: rest, up: false
  };
}
var D25 = 25 * Math.PI / 180;
var flippers = [
  mkFlipper(-80, -79.9956, D25, -D25),
  mkFlipper(64, -79.9956, Math.PI - D25, Math.PI + D25)
];
function flipTip(f) {
  f.tx = f.px + f.len * Math.cos(f.ph);
  f.ty = f.py + f.len * Math.sin(f.ph);
}
flipTip(flippers[0]); flipTip(flippers[1]);

// walls that intersect each flipper's swept area (redrawn when it moves)
var flipWalls = [[], []];
(function () {
  for (var fi = 0; fi < 2; fi++) {
    var f = flippers[fi];
    var a1 = f.restPh, a2 = f.upPh;
    var xs = [f.px, f.px + f.len * Math.cos(a1), f.px + f.len * Math.cos(a2)];
    var ys = [f.py, f.py + f.len * Math.sin(a1), f.py + f.len * Math.sin(a2)];
    var minx = Math.min(xs[0], xs[1], xs[2]) - 8, maxx = Math.max(xs[0], xs[1], xs[2]) + 8;
    var miny = Math.min(ys[0], ys[1], ys[2]) - 8, maxy = Math.max(ys[0], ys[1], ys[2]) + 8;
    for (var i = 0; i < walls.length; i++) {
      var w = walls[i];
      if (Math.max(w.x0, w.x1) < minx || Math.min(w.x0, w.x1) > maxx) { continue; }
      if (Math.max(w.y0, w.y1) < miny || Math.min(w.y0, w.y1) > maxy) { continue; }
      flipWalls[fi].push(i);
    }
  }
})();

// point in board (even-odd) for sparkles
function inBoard(x, y) {
  var inside = false;
  var n = outlinePts.length;
  for (var i = 0, j = n - 1; i < n; j = i++) {
    var xi = outlinePts[i][0], yi = outlinePts[i][1], xj = outlinePts[j][0], yj = outlinePts[j][1];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) { inside = !inside; }
  }
  return inside;
}

function fillPoly(pts, c) {
  var minY = 1e9, maxY = -1e9, i;
  for (i = 0; i < pts.length; i++) { if (pts[i][1] < minY) { minY = pts[i][1]; } if (pts[i][1] > maxY) { maxY = pts[i][1]; } }
  var n = pts.length;
  for (var y = Math.ceil(minY); y <= Math.floor(maxY); y++) {
    var yc = y + 0.5, xs = [];
    for (i = 0; i < n; i++) {
      var a = pts[i], b = pts[(i + 1) % n];
      if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) {
        xs.push(a[0] + (yc - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
      }
    }
    xs.sort(function (p, q) { return p - q; });
    for (i = 0; i + 1 < xs.length; i += 2) {
      var xa = Math.round(xs[i]), xb = Math.round(xs[i + 1]);
      if (xb > xa) { fRect(xa, y, xb - xa, 1, c); }
    }
  }
}

// ---------------------------------------------------------------- draw pieces
function drawWall(w) {
  var steep = Math.abs(w.y1 - w.y0) > Math.abs(w.x1 - w.x0);
  if (steep) {
    line(w.x0 - 1, w.y0, w.x1 - 1, w.y1, w.c2);
    line(w.x0 + 1, w.y0, w.x1 + 1, w.y1, w.c2);
  } else {
    line(w.x0, w.y0 - 1, w.x1, w.y1 - 1, w.c2);
    line(w.x0, w.y0 + 1, w.x1, w.y1 + 1, w.c2);
  }
  line(w.x0, w.y0, w.x1, w.y1, w.c);
}

var phase = 0;
function drawBumper(b) {
  var R = b.R, x = b.x, y = b.y;
  var hot = b.flash > 0;
  var pulse = (Math.sin(phase * 3 + x * 0.1 + y * 0.07) + 1) * 0.5;
  if (b.kind === 0) {
    circ(x, y, R, hot ? rgb(255, 255, 255) : rgb(255, 200, 40));
    circ(x, y, R - 1.2, hot ? rgb(255, 255, 140) : rgb(255, 120, 20));
    return;
  }
  var steps = b.kind === 2 ? 6 : 4;
  for (var k = 0; k < steps; k++) {
    var t = k / (steps - 1);
    var r = R * (1 - k / steps);
    var col;
    if (hot) { col = rgb(lerp(255, 255, t), lerp(200, 255, t), lerp(40, 200, t)); }
    else if (b.kind === 2) { col = rgb(lerp(110, 255, t) + pulse * 30, lerp(0, 190, t), lerp(40, 30, t)); }
    else { col = rgb(lerp(0, 120, t), lerp(100 + pulse * 40, 255, t), lerp(180, 255, t)); }
    circ(x, y, r, col);
  }
  circ(x, y, Math.max(1, R * 0.12), rgb(255, 255, 255));
}

function drawFlipper(f, ph, erase) {
  var N = 7;
  var ax = Math.cos(ph), ay = Math.sin(ph);
  for (var k = 0; k <= N; k++) {
    var t = k / N;
    var r = lerp(3.4, 2.1, t) + (erase ? 1.2 : 0);
    var col = erase ? C_BOARD : rgb(lerp(255, 255, t), lerp(235, 110, t), lerp(130, 30, t));
    circ(f.px + ax * f.len * t, f.py + ay * f.len * t, r, col);
  }
  if (!erase) { circ(f.px, f.py, 1.4, rgb(90, 30, 10)); }
}

var plungePull = 0;
var plungeDrawn = -1;
function drawPlunger() {
  fRect(laneL + 2, plateY - 1, laneR - laneL - 3, laneBottom - plateY - 1, C_BOARD);
  var hy = plateY + plungePull;
  fRect(laneCx - 1, hy, 3, laneBottom - 2 - hy, rgb(120, 120, 150));
  // spring
  var yy = hy + 2;
  var flip = 0;
  while (yy < laneBottom - 3) {
    line(laneCx - 3 + flip * 6, yy, laneCx + 3 - flip * 6, yy + 2, rgb(255, 120, 30));
    yy += 2; flip = 1 - flip;
  }
  fRect(laneL + 2, hy - 1, laneR - laneL - 3, 2, rgb(255, 60, 120));
  plungeDrawn = plungePull;
}

// ---------------------------------------------------------------- game state
var ball = { x: 0, y: 0, vx: 0, vy: 0 };
var ballDrawn = false, bdx = 0, bdy = 0;
var score = 0, hiScore = 0, balls = 3, bonusGiven = false;
var ST_READY = 0, ST_PLAY = 1, ST_LOST = 2;
var state = ST_READY;
var lostUntil = 0;
var hudDirty = true;
var slowT = 0;
var pendF = 0, pendMs = 0, pendPri = 0;

function queueSnd(f, ms, pri) {
  if (pri >= pendPri) { pendF = f; pendMs = ms; pendPri = pri; }
}
function flushSnd() {
  if (pendF > 0) { snd(pendF, pendMs); }
  pendF = 0; pendMs = 0; pendPri = 0;
}

function addScore(n) {
  score += n;
  if (score > hiScore) { hiScore = score; }
  if (!bonusGiven && score >= 1500) { bonusGiven = true; balls++; queueSnd(1400, 60, 5); }
  hudDirty = true;
}

// ---------------------------------------------------------------- restore (erase + redraw nearby statics)
function redrawNear(cx, cy, r) {
  var x0 = Math.max(0, Math.floor((cx - r - 2) / CELL)), x1 = Math.min(GW - 1, Math.floor((cx + r + 2) / CELL));
  var y0 = Math.max(0, Math.floor((cy - r - 2) / CELL)), y1 = Math.min(GH - 1, Math.floor((cy + r + 2) / CELL));
  stampN++;
  var i, j, k;
  for (j = y0; j <= y1; j++) {
    for (k = x0; k <= x1; k++) {
      var lst = cells[j * GW + k];
      for (i = 0; i < lst.length; i++) {
        var id = lst[i];
        if (wstamp[id] !== stampN) { wstamp[id] = stampN; drawWall(walls[id]); }
      }
    }
  }
  for (i = 0; i < bumpers.length; i++) {
    var b = bumpers[i];
    var dx = b.x - cx, dy = b.y - cy, rr = b.R + r + 2;
    if (dx * dx + dy * dy < rr * rr) { drawBumper(b); }
  }
  for (i = 0; i < 2; i++) {
    var f = flippers[i];
    var fx = f.px - cx, fy = f.py - cy, fr = f.len + r + 4;
    if (fx * fx + fy * fy < fr * fr) { drawFlipper(f, f.drawnPh, false); }
  }
  if (cx > laneL - 4 && cy > plateY - 6) { drawPlunger(); }
}
function restoreCircle(cx, cy, r) {
  circ(cx, cy, r, C_BOARD);
  redrawNear(cx, cy, r);
}

// ---------------------------------------------------------------- static scene
function drawExterior() {
  for (var y = 0; y < LH; y += 16) { fRect(0, y, LW, Math.min(16, LH - y), extCol(y)); }
}

function drawStrip(power, chase) {
  for (var i = 0; i < 17; i++) {
    var col;
    if (power >= 0) {
      if (i < Math.round(power * 17)) { col = rgb(lerp(60, 255, i / 16), lerp(255, 40, i / 16), 30); }
      else { col = rgb(30, 20, 60); }
    } else {
      col = ((i + chase) % 4 === 0) ? ((i & 1) ? rgb(255, 80, 230) : rgb(60, 230, 255)) : rgb(34, 14, 70);
    }
    fRect(i * 10, 25, 9, 3, col);
  }
}

function drawHUD() {
  fRect(0, 0, LW, 24, rgb(26, 4, 58));
  fRect(0, 0, LW, 1, rgb(255, 80, 230));
  fRect(0, 23, LW, 1, rgb(0, 200, 255));
  txt('SCORE', 4, 3, 1, rgb(255, 110, 235));
  txt('' + score, 4, 12, 2, rgb(255, 240, 120));
  txt('HI', 112, 3, 1, rgb(110, 220, 255));
  txtR('' + hiScore, 166, 3, 1, rgb(110, 220, 255));
  for (var i = 0; i < balls && i < 5; i++) {
    circ(114 + i * 10, 17, 3, C_BALL1);
    circ(114 + i * 10, 17, 2, C_BALL2);
  }
  hudDirty = false;
}

function drawTable() {
  drawExterior();
  fillPoly(outlinePts, C_BOARD);
  fillPoly(guide1Pts, C_GUIDEFILL);
  fillPoly(guide2Pts, C_GUIDEFILL);
  fillPoly(guide3Pts, C_GUIDEFILL);
  fillPoly(guide4Pts, C_GUIDEFILL);
  var i;
  for (i = 0; i < walls.length; i++) { drawWall(walls[i]); }
  for (i = 0; i < bumpers.length; i++) { drawBumper(bumpers[i]); }
  drawPlunger();
  for (i = 0; i < 2; i++) { drawFlipper(flippers[i], flippers[i].ph, false); flippers[i].drawnPh = flippers[i].ph; flippers[i].dirty = false; }
  drawHUD();
  drawStrip(-1, 0);
  ballDrawn = false;
}

// ---------------------------------------------------------------- sparkles (moving background)
var sparks = [];
(function () {
  for (var i = 0; i < 10; i++) { sparks.push({ x: -1, y: -1, vy: 0, ph: i, drawn: false }); }
})();
function sparkSpawn(s) {
  for (var tries = 0; tries < 12; tries++) {
    var x = OFFX + 4 + Math.random() * (LW - 2 * OFFX - 8);
    var y = OFFY + 4 + Math.random() * (LH - OFFY - 30);
    if (inBoard(x, y) && inBoard(x - 3, y) && inBoard(x + 3, y)) { s.x = x; s.y = y; s.vy = 4 + Math.random() * 10; return; }
  }
  s.x = -10; s.y = -10; s.vy = 0;
}
var sparkRR = 0;
function stepSparks(dt) {
  for (var n = 0; n < 2; n++) {
    var s = sparks[sparkRR]; sparkRR = (sparkRR + 1) % sparks.length;
    if (s.drawn) { restoreCircle(s.x, s.y, 1.5); s.drawn = false; }
    if (s.x < 0 || !inBoard(s.x, s.y + 4)) { sparkSpawn(s); }
    else { s.y += s.vy * dt * 3; }
    s.ph++;
    if (s.x >= 0) {
      var c = (s.ph & 1) ? rgb(120, 140, 255) : rgb(70, 60, 170);
      pix(s.x, s.y, c);
      if (s.ph & 2) { pix(s.x + 1, s.y, c); }
      s.drawn = true;
    }
  }
}

// ---------------------------------------------------------------- physics
function hitSeg(x0, y0, x1, y1, e) {
  var dx = x1 - x0, dy = y1 - y0;
  var l2 = dx * dx + dy * dy;
  var t = ((ball.x - x0) * dx + (ball.y - y0) * dy) / l2;
  if (t < 0) { t = 0; } else if (t > 1) { t = 1; }
  var px = x0 + t * dx, py = y0 + t * dy;
  var ex = ball.x - px, ey = ball.y - py;
  var d2 = ex * ex + ey * ey;
  if (d2 >= BR * BR) { return 0; }
  var d = Math.sqrt(d2), nx, ny;
  if (d < 1e-6) {
    var len = Math.sqrt(l2);
    nx = -dy / len; ny = dx / len;
    if (nx * ball.vx + ny * ball.vy > 0) { nx = -nx; ny = -ny; }
    d = 0;
  } else { nx = ex / d; ny = ey / d; }
  ball.x += nx * (BR - d); ball.y += ny * (BR - d);
  var vn = ball.vx * nx + ball.vy * ny;
  if (vn < 0) {
    ball.vx -= (1 + e) * vn * nx; ball.vy -= (1 + e) * vn * ny;
    return -vn;
  }
  return 0;
}

function stepFlippers(h, t) {
  for (var i = 0; i < 2; i++) {
    var f = flippers[i];
    var active = f.locked || t < f.holdUntil;
    var target = active ? f.upPh : f.restPh;
    var diff = target - f.ph;
    if (Math.abs(diff) < 1e-4) { f.w = 0; f.up = active; continue; }
    var step = FSPEED * h;
    var dir = diff > 0 ? 1 : -1;
    if (Math.abs(diff) <= step) { f.ph = target; f.w = 0; }
    else { f.ph += dir * step; f.w = dir * FSPEED; }
    f.up = active;
    flipTip(f);
    f.dirty = true;
  }
}

function hitFlipper(f) {
  var dx = f.tx - f.px, dy = f.ty - f.py;
  var l2 = dx * dx + dy * dy;
  var t = ((ball.x - f.px) * dx + (ball.y - f.py) * dy) / l2;
  if (t < 0) { t = 0; } else if (t > 1) { t = 1; }
  var cx = f.px + t * dx, cy = f.py + t * dy;
  var ex = ball.x - cx, ey = ball.y - cy;
  var rr = BR + RF * (1.15 - 0.5 * t);
  var d2 = ex * ex + ey * ey;
  if (d2 >= rr * rr) { return; }
  var d = Math.sqrt(d2), nx, ny;
  if (d < 1e-6) { nx = 0; ny = -1; d = 0; } else { nx = ex / d; ny = ey / d; }
  ball.x += nx * (rr - d); ball.y += ny * (rr - d);
  var vsx = -f.w * (cy - f.py), vsy = f.w * (cx - f.px);
  var rvx = ball.vx - vsx, rvy = ball.vy - vsy;
  var vn = rvx * nx + rvy * ny;
  if (vn < 0) {
    var j = -(1.25) * vn;
    ball.vx += j * nx; ball.vy += j * ny;
    if (f.w !== 0 && -vn > 40) { queueSnd(520, 6, 2); }
  }
}

function hitBumper(b, t) {
  var dx = ball.x - b.x, dy = ball.y - b.y;
  var rr = b.R + BR;
  var d2 = dx * dx + dy * dy;
  if (d2 >= rr * rr) { return; }
  var d = Math.sqrt(d2), nx, ny;
  if (d < 1e-6) { nx = 0; ny = -1; d = 0; } else { nx = dx / d; ny = dy / d; }
  ball.x += nx * (rr - d); ball.y += ny * (rr - d);
  var vn = ball.vx * nx + ball.vy * ny;
  if (vn < 0) {
    ball.vx -= 2 * vn * nx; ball.vy -= 2 * vn * ny;
    var out = -vn;
    if (out < b.kick) { ball.vx += nx * (b.kick - out); ball.vy += ny * (b.kick - out); }
    b.flash = t + 130; b.dirty = true;
    addScore(b.pts);
    if (b.kind === 2) { queueSnd(330, 22, 4); }
    else if (b.kind === 1) { queueSnd(720, 16, 3); }
    else { queueSnd(1000, 10, 3); }
  }
}

function stepBall(h, t) {
  ball.vy += G * h;
  ball.x += ball.vx * h; ball.y += ball.vy * h;
  var cx = Math.floor(ball.x / CELL), cy = Math.floor(ball.y / CELL);
  var i;
  if (cx >= 0 && cx < GW && cy >= 0 && cy < GH) {
    var lst = cells[cy * GW + cx];
    for (i = 0; i < lst.length; i++) {
      var w = walls[lst[i]];
      var imp = hitSeg(w.x0, w.y0, w.x1, w.y1, 0.1);
      if (imp > 260) { queueSnd(150, 6, 1); }
    }
  }
  for (i = 0; i < bumpers.length; i++) { hitBumper(bumpers[i], t); }
  hitFlipper(flippers[0]); hitFlipper(flippers[1]);
  // plunger plate (floor of the lane)
  if (ball.x > laneL && ball.x < laneR && ball.y > plateY - BR) {
    ball.y = plateY - BR;
    if (ball.vy > 0) { ball.vy = -ball.vy * 0.1; }
  }
  var sp2 = ball.vx * ball.vx + ball.vy * ball.vy;
  if (sp2 > VCAP * VCAP) { var k = VCAP / Math.sqrt(sp2); ball.vx *= k; ball.vy *= k; }
}

// ---------------------------------------------------------------- ball / state helpers
function readyBall() {
  state = ST_READY;
  ball.x = laneCx; ball.y = plateY - BR; ball.vx = 0; ball.vy = 0;
  plungePull = 0; slowT = 0;
}
function drainBall() {
  state = ST_LOST;
  balls--;
  lostUntil = tnow() + 1100;
  hudDirty = true;
  if (SOUND) { beep(300, 70); beep(220, 80); beep(150, 120); }
}

// ---------------------------------------------------------------- frame
var selHeld = false, selStart = 0, selLast = 0, selBlockUntil = 0;

function readInput(t) {
  var prv = kb('getPrevPress'), nxt = kb('getNextPress');
  var sel = kb('getSelPress'), esc = kb('getEscPress');
  var left = SWAPLR ? nxt : prv, right = SWAPLR ? prv : nxt;
  var r = { esc: esc, selDown: false, selUp: false };
  if (left) { flick(0, 1, t); }
  if (right) { flick(1, 0, t); }
  if (sel && t >= selBlockUntil) {
    selLast = t;
    if (!selHeld) { selHeld = true; selStart = t; r.selDown = true; }
  } else if (selHeld && t - selLast > HOLD_GRACE) {
    selHeld = false; r.selUp = true;
  }
  return r;
}
function flick(i, other, t) {
  var f = flippers[i];
  if (!f.up && !f.locked) { queueSnd(260, 6, 2); }
  f.holdUntil = t + HOLD_MS;
  flippers[other].holdUntil = 0;
}

function renderFrame(t, frame) {
  var i;
  // 1. erase ball
  if (ballDrawn) { restoreCircle(bdx, bdy, BR + 1); ballDrawn = false; }
  // 2. flippers
  for (i = 0; i < 2; i++) {
    var f = flippers[i];
    if (f.dirty) {
      drawFlipper(f, f.drawnPh, true);
      for (var k = 0; k < flipWalls[i].length; k++) { drawWall(walls[flipWalls[i][k]]); }
      drawFlipper(f, f.ph, false);
      f.drawnPh = f.ph; f.dirty = false;
    }
  }
  // 3. plunger
  if (plungeDrawn !== plungePull) { drawPlunger(); }
  // 4. bumpers (flash end + one slow pulse per frame)
  for (i = 0; i < bumpers.length; i++) {
    var b = bumpers[i];
    if (b.flash > 0 && t >= b.flash) { b.flash = 0; b.dirty = true; }
    if (b.dirty) { drawBumper(b); b.dirty = false; }
  }
  var pb = bumpers[frame % bumpers.length];
  if (pb.kind > 0 && pb.flash === 0) { drawBumper(pb); }
  // 5. sparkles
  stepSparks(0.03);
  // 6. ball
  var bx = Math.round(ball.x), by = Math.round(ball.y);
  circ(bx, by, BR, C_BALL1);
  circ(bx, by, BR - 1, C_BALL2);
  pix(bx - 1, by - 1, rgb(255, 255, 255));
  bdx = bx; bdy = by; ballDrawn = true;
  // 7. hud
  if (hudDirty) { drawHUD(); }
}

// ---------------------------------------------------------------- screens
function overlayBox(lines, colors, scales) {
  var h = 8;
  var i;
  for (i = 0; i < lines.length; i++) { h += 7 * scales[i] + 5; }
  var y0 = Math.floor((LH - h) / 2), x0 = 12, w = LW - 24;
  fRect(x0 - 2, y0 - 2, w + 4, h + 4, rgb(255, 80, 230));
  fRect(x0, y0, w, h, rgb(16, 4, 40));
  var y = y0 + 6;
  for (i = 0; i < lines.length; i++) {
    txtC(lines[i], LW / 2, y, scales[i], colors[i]);
    y += 7 * scales[i] + 5;
  }
}

function waitKeys() {
  // returns 'sel', 'esc'
  while (true) {
    if (kb('getEscPress')) { return 'esc'; }
    if (kb('getSelPress')) { return 'sel'; }
    nap(30);
  }
}

function pauseMenu() {
  overlayBox(['PAUSED', 'BTN: RESUME', 'BACK: MENU'], [rgb(255, 240, 120), rgb(110, 255, 160), rgb(255, 140, 140)], [2, 1, 1]);
  nap(300);
  var r = waitKeys();
  return r === 'sel';
}

var STAR_N = 30, stars = [];
function initStars() {
  stars = [];
  for (var i = 0; i < STAR_N; i++) { stars.push({ x: Math.random() * LW, y: Math.random() * LH, p: Math.random() * 6 }); }
}
function stepStars(n, skipTop, skipBot) {
  for (var k = 0; k < n; k++) {
    var s = stars[Math.floor(Math.random() * stars.length)];
    if (s.y < skipTop || s.y > skipBot) { continue; }
    var bg = extCol(s.y);
    fRect(s.x, s.y, 2, 2, bg);
    s.x += (Math.random() - 0.3) * 3; s.y += 1 + Math.random() * 3;
    if (s.y > LH - 2) { s.y = 2; s.x = Math.random() * LW; }
    if (s.x < 0 || s.x > LW - 2) { s.x = Math.random() * LW; }
    if (s.y < skipTop || s.y > skipBot) { continue; }
    var v = 100 + Math.floor(Math.random() * 155);
    fRect(s.x, s.y, 2, 2, rgb(v, v, 255));
  }
}

function titleScreen() {
  var sel = 0, items = ['START', 'SOUND', 'SWAP L/R', 'FLIP SCREEN', 'QUIT'];
  var redraw = true, t0 = tnow(), cyc = 0;
  initStars();
  while (true) {
    if (redraw) {
      drawExterior();
      var i;
      for (i = 0; i < 13; i++) { fRect(0, 22 + i * 3, LW, 3, rgb(lerp(255, 120, i / 12), lerp(40, 0, i / 12), lerp(200, 255, i / 12))); }
      txtC('PINBALL', LW / 2, 26, 3, rgb(255, 255, 255));
      txtC('MASHER', LW / 2, 52, 3, rgb(255, 235, 90));
      txtC('BY DA CBM', LW / 2, 80, 1, rgb(120, 230, 255));
      for (i = 0; i < items.length; i++) {
        var lab = items[i];
        if (i === 1) { lab = 'SOUND ' + (SOUND ? 'ON' : 'OFF'); }
        if (i === 2) { lab = 'SWAP L/R ' + (SWAPLR ? 'YES' : 'NO'); }
        if (i === 3) { lab = 'FLIP SCREEN ' + (rotMode === 2 ? 'B' : 'A'); }
        var y = 108 + i * 22;
        if (i === sel) {
          fRect(14, y - 4, LW - 28, 17, rgb(255, 70, 200));
          fRect(16, y - 2, LW - 32, 13, rgb(30, 6, 70));
          txtC(lab, LW / 2, y + 1, 1, rgb(255, 255, 120));
        } else { txtC(lab, LW / 2, y + 1, 1, rgb(180, 200, 255)); }
      }
      txtC('TURN: PICK  BTN: GO', LW / 2, 224, 1, rgb(150, 150, 210));
      txtC('FLICK L/R = FLIPPERS', LW / 2, 242, 1, rgb(110, 255, 160));
      txtC('HOLD BTN = BOTH UP', LW / 2, 254, 1, rgb(110, 255, 160));
      txtC('HOLD + RELEASE = PLUNGER', LW / 2, 266, 1, rgb(110, 255, 160));
      txtC('BACK = PAUSE', LW / 2, 278, 1, rgb(255, 160, 160));
      redraw = false;
    }
    stepStars(3, 0, 20);
    var up = kb('getPrevPress'), dn = kb('getNextPress');
    if (up) { sel = (sel + items.length - 1) % items.length; redraw = true; }
    if (dn) { sel = (sel + 1) % items.length; redraw = true; }
    if (kb('getEscPress')) { return 'quit'; }
    if (kb('getSelPress')) {
      if (sel === 0) { return 'start'; }
      if (sel === 1) { SOUND = !SOUND; redraw = true; snd(880, 30); }
      if (sel === 2) { SWAPLR = !SWAPLR; redraw = true; }
      if (sel === 3) { if (!NATIVE_PORTRAIT) { rotMode = (rotMode === 1) ? 2 : 1; } redraw = true; }
      if (sel === 4) { return 'quit'; }
      nap(150);
    }
    nap(25);
  }
}

// ---------------------------------------------------------------- one full game
function playGame() {
  score = 0; balls = 3; bonusGiven = false;
  var i;
  for (i = 0; i < 2; i++) { flippers[i].ph = flippers[i].restPh; flippers[i].w = 0; flippers[i].holdUntil = 0; flippers[i].locked = false; flipTip(flippers[i]); flippers[i].up = false; }
  for (i = 0; i < bumpers.length; i++) { bumpers[i].flash = 0; bumpers[i].dirty = false; }
  for (i = 0; i < sparks.length; i++) { sparks[i].drawn = false; sparks[i].x = -1; }
  readyBall();
  drawTable();
  selHeld = false; selBlockUntil = tnow() + 400;
  var last = tnow(), frame = 0, chase = 0, chaseT = last;
  var lastPower = -2;
  while (true) {
    var t = tnow();
    var dt = (t - last) / 1000; last = t;
    if (!(dt > 0)) { dt = 0.03; }
    if (dt > 0.05) { dt = 0.05; }
    frame++;

    var inp = readInput(t);
    if (inp.esc) {
      if (!pauseMenu()) { return 'menu'; }
      drawTable(); last = tnow(); selHeld = false; selBlockUntil = last + 400;
      continue;
    }

    // flipper lock while button held (play only)
    flippers[0].locked = flippers[1].locked = (state === ST_PLAY && selHeld);
    if (state === ST_PLAY && inp.selDown) { queueSnd(260, 6, 2); }

    if (state === ST_READY) {
      stepFlippers(dt, t);
      if (selHeld) {
        var pw = (t - selStart) / 1100; if (pw > 1) { pw = 1; }
        plungePull = pw * PULL_MAX;
        ball.y = plateY + plungePull - BR;
        if (pw !== lastPower) { drawStrip(pw, 0); lastPower = pw; }
      } else { lastPower = -2; }
      if (inp.selUp) {
        var p2 = (selLast - selStart) / 1100; if (p2 > 1) { p2 = 1; } if (p2 < 0.3) { p2 = 0.3; }
        plungePull = 0;
        ball.y = plateY - BR;
        ball.vx = 0; ball.vy = -(VLO + (VHI - VLO) * p2);
        state = ST_PLAY; slowT = 0;
        if (SOUND) { beep(300, 20); beep(500, 20); beep(800, 25); }
        drawStrip(-1, chase);
      }
    } else if (state === ST_PLAY) {
      var rem = dt, guard = 0;
      while (rem > 1e-5 && guard < 48) {
        guard++;
        var sp = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        var h = sp > 1 ? Math.min(rem, Math.max(0.0008, 2.0 / sp), 0.006) : Math.min(rem, 0.006);
        stepFlippers(h, t);
        stepBall(h, t);
        rem -= h;
        if (ball.y > Y_GUTTER) { drainBall(); break; }
      }
      // back in the lane at rest -> ready to plunge again
      var spd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
      if (state === ST_PLAY) {
        if (ball.x > laneL && ball.x < laneR && ball.y > plateY - BR - 2 && spd < 25) {
          readyBall(); selHeld = false; selBlockUntil = t + 500;
        } else if (spd < 12 && !(ball.x > laneL && ball.x < laneR)) {
          slowT += dt;
          if (slowT > 2.2) { ball.vy -= 140; ball.vx += (Math.random() - 0.5) * 120; slowT = 0; queueSnd(200, 8, 2); }
        } else { slowT = 0; }
      }
    } else {
      stepFlippers(dt, t);
      if (t >= lostUntil) {
        if (balls <= 0) {
          renderFrame(t, frame);
          flushSnd();
          return 'over';
        }
        readyBall(); selHeld = false; selBlockUntil = t + 500;
        drawStrip(-1, chase);
      }
    }

    renderFrame(t, frame);
    if (state !== ST_READY || !selHeld) {
      if (t - chaseT > 140) { chase = (chase + 1) & 3; chaseT = t; if (!(state === ST_READY && selHeld)) { drawStrip(-1, chase); } }
    }
    phase += dt;
    flushSnd();
  }
}

function gameOverScreen() {
  var hs = hiScore;
  overlayBox(['GAME OVER', 'SCORE ' + score, 'HI ' + hs, 'BTN: AGAIN', 'BACK: MENU'],
    [rgb(255, 90, 90), rgb(255, 240, 120), rgb(110, 220, 255), rgb(110, 255, 160), rgb(255, 160, 160)], [2, 1, 1, 1, 1]);
  if (SOUND) { beep(500, 80); beep(400, 80); beep(300, 140); }
  nap(500);
  return waitKeys() === 'sel';
}

// ---------------------------------------------------------------- main
function main() {
  var running = true;
  while (running) {
    var r = titleScreen();
    if (r === 'quit') { break; }
    var again = true;
    while (again) {
      var res = playGame();
      if (res === 'over') { again = gameOverScreen(); }
      else { again = false; }
    }
  }
  clearAll(0);
}
main();
