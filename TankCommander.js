/* TANK COMMANDER - artillery game for Bruce firmware (LilyGO T-Embed CC1101)
 *
 * CONTROLS
 *   Aim phase  : turn knob = barrel angle, click = lock angle
 *   Power phase: gauge sweeps up/down, click = FIRE
 *                (turn knob while it sweeps = change shell type)
 *   ESC button : pause menu (Resume / Quit)
 *
 * 100 rounds, 10 battlefields (new one every 10 rounds).
 * After rounds 10,20,30...90 you visit the Upgrade Depot.
 * ES5 only, no Math.*, no storage - keeps to the Bruce JS API.
 */
var display = require('display');
var keyboard = require('keyboard');

/* ---------- helpers ---------- */
function rgb(r, g, b) { return ((r & 248) << 8) | ((g & 252) << 3) | (b >> 3); }
function ab(v) { if (v < 0) return -v; return v; }
function isqrt(n) {
  var s, k;
  if (n <= 0) return 0;
  s = n / 2 + 1;
  for (k = 0; k < 24; k++) { s = (s + n / s) / 2; }
  return s;
}

var W = display.width();
var H = display.height();
if (W < 200) W = 320;
if (H < 100) H = 170;
var N = (W / 2) | 0;       /* terrain strips, 2px each */
var TOP = 16;              /* top HUD height */
var BOT = H - 22;          /* bottom HUD starts here */
var G = 0.05;              /* gravity per physics step */
var VK = 0.0424;           /* power -> velocity */
var PX = 26;               /* player tank x */
var PS = 13;               /* player tank strip */
var SCENES = 25;           /* number of battlefields */
var SCENE_LEN = 4;         /* rounds per battlefield (25 x 4 = 100) */
var WHITE = 65535;
var BLACK = 0;

display.setTextSize(1);

/* ---------- state ---------- */
var hs = [];  var bg = [];
var level = 1, hp = 100, maxHP = 100, credits = 0;
var upArm = 0, upCan = 0, upAmmo = 0, upSteady = 0, upRf = 0;
var stock = [0, 0, 0, 0, 0];
var shell = 0;
var ammo = 6, enemyHP = 50, enemyMax = 50, shots = 0;
var angle = 45, power = 0, wind = 0, maxWind = 0.001;
var ES = 68, EX = 137, eb = 0;
var L = null;
var decS = [], decK = [], decB = [];
var fx = [];
var seed = 12345, frames = 0;
var quitFlag = false;
var inN = false, inP = false, inS = false, inE = false;
var SIN = [], COS = [];
var rx = 0, ry = 0, rt = 0;
var tX = 0, tY = 0;
var shownP = 0, curRng = -1;

var BL = [14, 24, 9, 12, 56];
var DM = [1, 1.3, 2, 0.8, 3.5];
var SC = [WHITE, rgb(255, 160, 50), rgb(120, 230, 255), rgb(255, 240, 90), rgb(255, 60, 200)];
var SN = ["STD", "HE", "AP", "CLUSTER", "NUKE"];

function buildTrig() {
  var d, x, x2;
  for (d = 0; d <= 90; d++) {
    x = d * 0.01745329;
    x2 = x * x;
    SIN.push(x * (1 - x2 / 6 * (1 - x2 / 20 * (1 - x2 / 42 * (1 - x2 / 72)))));
  }
  for (d = 0; d <= 90; d++) { COS.push(SIN[90 - d]); }
}

function rnd() { seed = (seed * 75 + 74) % 65537; return seed; }
function rndi(n) { return ((rnd() * n) / 65537) | 0; }

function poll() {
  frames++;
  inN = keyboard.getNextPress();
  inP = keyboard.getPrevPress();
  inS = keyboard.getSelPress();
  inE = keyboard.getEscPress();
}

/* ---------- text ---------- */
function txt(s, x, y, c) { display.setTextColor(c); display.drawString(s, x, y); }
function txtBig(s, x, y, c, size) {
  display.setTextSize(size); display.setTextColor(c); display.drawString(s, x, y); display.setTextSize(1);
}
function txtMid(s, y, c, size) {
  var w = s.length * 6 * size;
  txtBig(s, ((W - w) / 2) | 0, y, c, size);
}

/* ---------- battlefields ---------- */
function landscape(n) {
  var o = {};
  o.cap = -1; o.capy = 0; o.blk = 0; o.rough = 3; o.amp = 16; o.fx = 0;
  if (n == 0) {
    o.name = "DESERT";
    o.s1 = rgb(255, 222, 150); o.s2 = rgb(255, 196, 116); o.s3 = rgb(250, 166, 92);
    o.bgc = rgb(214, 150, 84); o.bgk = 0;
    o.gnd = rgb(196, 140, 70); o.top = rgb(232, 188, 108); o.deep = rgb(150, 100, 50);
    o.gy = 118; o.amp = 14; o.rough = 2; o.d1 = 0; o.d2 = 5; o.fx = 1;
  } else if (n == 1) {
    o.name = "MOUNTAINS";
    o.s1 = rgb(90, 140, 210); o.s2 = rgb(130, 175, 230); o.s3 = rgb(180, 210, 240);
    o.bgc = rgb(95, 105, 135); o.bgk = 1; o.cap = rgb(240, 245, 250); o.capy = 66;
    o.gnd = rgb(105, 95, 85); o.top = rgb(70, 110, 60); o.deep = rgb(80, 70, 65);
    o.gy = 110; o.amp = 28; o.rough = 5; o.d1 = 1; o.d2 = 5; o.fx = 2;
  } else if (n == 2) {
    o.name = "RUINED CITY";
    o.s1 = rgb(70, 70, 80); o.s2 = rgb(110, 105, 110); o.s3 = rgb(150, 130, 120);
    o.bgc = rgb(55, 55, 65); o.bgk = 2;
    o.gnd = rgb(95, 90, 88); o.top = rgb(125, 118, 112); o.deep = rgb(65, 62, 60);
    o.gy = 122; o.amp = 0; o.rough = 0; o.blk = 8; o.d1 = 2; o.d2 = 8; o.fx = 4;
  } else if (n == 3) {
    o.name = "RIVERLANDS";
    o.s1 = rgb(110, 170, 230); o.s2 = rgb(160, 205, 240); o.s3 = rgb(210, 230, 245);
    o.bgc = rgb(80, 140, 95); o.bgk = 3;
    o.gnd = rgb(110, 85, 55); o.top = rgb(90, 150, 60); o.deep = rgb(80, 60, 40);
    o.gy = 120; o.amp = 12; o.rough = 2; o.d1 = 3; o.d2 = 7; o.fx = 2;
  } else if (n == 4) {
    o.name = "SNOW TUNDRA";
    o.s1 = rgb(150, 175, 205); o.s2 = rgb(190, 208, 228); o.s3 = rgb(225, 235, 245);
    o.bgc = rgb(185, 200, 225); o.bgk = 1; o.cap = rgb(250, 252, 255); o.capy = 70;
    o.gnd = rgb(225, 230, 240); o.top = rgb(252, 254, 255); o.deep = rgb(170, 185, 205);
    o.gy = 118; o.amp = 18; o.rough = 3; o.d1 = 9; o.d2 = 5; o.fx = 2;
  } else if (n == 5) {
    o.name = "RED CANYON";
    o.s1 = rgb(200, 110, 80); o.s2 = rgb(235, 150, 95); o.s3 = rgb(250, 195, 120);
    o.bgc = rgb(150, 80, 52); o.bgk = 4;
    o.gnd = rgb(170, 95, 58); o.top = rgb(205, 130, 78); o.deep = rgb(120, 65, 42);
    o.gy = 112; o.amp = 0; o.rough = 0; o.blk = 10; o.d1 = 5; o.d2 = 4; o.fx = 1;
  } else if (n == 6) {
    o.name = "JUNGLE";
    o.s1 = rgb(90, 160, 130); o.s2 = rgb(130, 195, 150); o.s3 = rgb(170, 220, 170);
    o.bgc = rgb(35, 95, 55); o.bgk = 3;
    o.gnd = rgb(55, 80, 40); o.top = rgb(60, 130, 50); o.deep = rgb(40, 58, 30);
    o.gy = 115; o.amp = 22; o.rough = 4; o.d1 = 3; o.d2 = 3; o.fx = 0;
  } else if (n == 7) {
    o.name = "VOLCANO";
    o.s1 = rgb(45, 10, 15); o.s2 = rgb(95, 30, 25); o.s3 = rgb(170, 70, 30);
    o.bgc = rgb(45, 22, 22); o.bgk = 5;
    o.gnd = rgb(75, 50, 45); o.top = rgb(105, 74, 62); o.deep = rgb(45, 30, 28);
    o.gy = 112; o.amp = 30; o.rough = 5; o.d1 = 5; o.d2 = 6; o.fx = 5;
  } else if (n == 8) {
    o.name = "NIGHT WARZONE";
    o.s1 = rgb(6, 8, 25); o.s2 = rgb(14, 20, 50); o.s3 = rgb(30, 40, 70);
    o.bgc = rgb(22, 28, 46); o.bgk = 2;
    o.gnd = rgb(45, 55, 42); o.top = rgb(66, 80, 58); o.deep = rgb(30, 38, 30);
    o.gy = 120; o.amp = 20; o.rough = 3; o.d1 = 8; o.d2 = 4; o.fx = 3;
  } else if (n == 9) {
    o.name = "FORTRESS RUINS";
    o.s1 = rgb(60, 60, 85); o.s2 = rgb(95, 95, 115); o.s3 = rgb(140, 130, 130);
    o.bgc = rgb(48, 48, 62); o.bgk = 6;
    o.gnd = rgb(85, 85, 78); o.top = rgb(118, 118, 108); o.deep = rgb(58, 58, 52);
    o.gy = 118; o.amp = 0; o.rough = 0; o.blk = 6; o.d1 = 7; o.d2 = 2; o.fx = 4;
  } else if (n == 10) {
    o.name = "BEACH HEAD";
    o.s1 = rgb(100, 190, 235); o.s2 = rgb(150, 215, 240); o.s3 = rgb(210, 235, 240);
    o.bgc = rgb(70, 150, 120); o.bgk = 3;
    o.gnd = rgb(215, 195, 140); o.top = rgb(242, 228, 175); o.deep = rgb(170, 150, 100);
    o.gy = 120; o.amp = 8; o.rough = 2; o.d1 = 10; o.d2 = 15; o.fx = 1;
  } else if (n == 11) {
    o.name = "SWAMP";
    o.s1 = rgb(70, 95, 70); o.s2 = rgb(105, 130, 90); o.s3 = rgb(150, 160, 110);
    o.bgc = rgb(45, 70, 50); o.bgk = 3;
    o.gnd = rgb(70, 65, 40); o.top = rgb(80, 105, 45); o.deep = rgb(50, 45, 30);
    o.gy = 122; o.amp = 10; o.rough = 3; o.d1 = 4; o.d2 = 3; o.fx = 0;
  } else if (n == 12) {
    o.name = "SALT FLATS";
    o.s1 = rgb(170, 200, 235); o.s2 = rgb(210, 225, 240); o.s3 = rgb(240, 240, 235);
    o.bgc = rgb(190, 175, 160); o.bgk = 4;
    o.gnd = rgb(235, 232, 222); o.top = rgb(252, 252, 247); o.deep = rgb(195, 190, 180);
    o.gy = 124; o.amp = 4; o.rough = 1; o.d1 = 5; o.d2 = 8; o.fx = 1;
  } else if (n == 13) {
    o.name = "AUTUMN FOREST";
    o.s1 = rgb(130, 160, 200); o.s2 = rgb(190, 200, 205); o.s3 = rgb(235, 215, 170);
    o.bgc = rgb(150, 90, 45); o.bgk = 3;
    o.gnd = rgb(90, 65, 40); o.top = rgb(150, 110, 45); o.deep = rgb(65, 48, 30);
    o.gy = 116; o.amp = 20; o.rough = 4; o.d1 = 16; o.d2 = 1; o.fx = 2;
  } else if (n == 14) {
    o.name = "ARCTIC AURORA";
    o.s1 = rgb(8, 15, 40); o.s2 = rgb(15, 40, 70); o.s3 = rgb(60, 95, 130);
    o.bgc = rgb(110, 140, 175); o.bgk = 1; o.cap = rgb(235, 245, 255); o.capy = 74;
    o.gnd = rgb(215, 225, 240); o.top = rgb(245, 250, 255); o.deep = rgb(150, 170, 195);
    o.gy = 118; o.amp = 14; o.rough = 3; o.d1 = 12; o.d2 = 9; o.fx = 7;
  } else if (n == 15) {
    o.name = "MOON BASE";
    o.s1 = rgb(4, 4, 10); o.s2 = rgb(10, 10, 20); o.s3 = rgb(25, 25, 35);
    o.bgc = rgb(70, 70, 80); o.bgk = 1;
    o.gnd = rgb(130, 130, 135); o.top = rgb(168, 168, 172); o.deep = rgb(90, 90, 95);
    o.gy = 116; o.amp = 20; o.rough = 4; o.d1 = 5; o.d2 = 14; o.fx = 6;
  } else if (n == 16) {
    o.name = "MARS OUTPOST";
    o.s1 = rgb(130, 60, 40); o.s2 = rgb(190, 100, 60); o.s3 = rgb(230, 150, 100);
    o.bgc = rgb(150, 70, 45); o.bgk = 4;
    o.gnd = rgb(170, 85, 50); o.top = rgb(202, 112, 66); o.deep = rgb(120, 60, 40);
    o.gy = 118; o.amp = 16; o.rough = 3; o.d1 = 5; o.d2 = 11; o.fx = 1;
  } else if (n == 17) {
    o.name = "TOXIC WASTE";
    o.s1 = rgb(60, 90, 30); o.s2 = rgb(110, 140, 40); o.s3 = rgb(170, 190, 70);
    o.bgc = rgb(50, 60, 35); o.bgk = 2;
    o.gnd = rgb(70, 80, 40); o.top = rgb(115, 155, 40); o.deep = rgb(50, 58, 30);
    o.gy = 120; o.amp = 14; o.rough = 3; o.d1 = 8; o.d2 = 4; o.fx = 4;
  } else if (n == 18) {
    o.name = "FIRESTORM";
    o.s1 = rgb(60, 15, 10); o.s2 = rgb(140, 45, 15); o.s3 = rgb(220, 120, 30);
    o.bgc = rgb(40, 20, 15); o.bgk = 3;
    o.gnd = rgb(50, 35, 28); o.top = rgb(82, 56, 38); o.deep = rgb(35, 25, 20);
    o.gy = 116; o.amp = 18; o.rough = 4; o.d1 = 4; o.d2 = 6; o.fx = 9;
  } else if (n == 19) {
    o.name = "SUNSET RIDGE";
    o.s1 = rgb(90, 60, 130); o.s2 = rgb(200, 100, 110); o.s3 = rgb(250, 170, 100);
    o.bgc = rgb(60, 45, 85); o.bgk = 1;
    o.gnd = rgb(80, 60, 70); o.top = rgb(112, 92, 72); o.deep = rgb(55, 42, 50);
    o.gy = 112; o.amp = 24; o.rough = 5; o.d1 = 1; o.d2 = 5; o.fx = 9;
  } else if (n == 20) {
    o.name = "THUNDERSTORM";
    o.s1 = rgb(40, 45, 55); o.s2 = rgb(70, 78, 90); o.s3 = rgb(110, 118, 125);
    o.bgc = rgb(50, 70, 60); o.bgk = 3;
    o.gnd = rgb(60, 70, 45); o.top = rgb(70, 105, 50); o.deep = rgb(45, 52, 35);
    o.gy = 120; o.amp = 10; o.rough = 2; o.d1 = 13; o.d2 = 3; o.fx = 8;
  } else if (n == 21) {
    o.name = "CRYSTAL CAVERNS";
    o.s1 = rgb(18, 8, 35); o.s2 = rgb(35, 15, 60); o.s3 = rgb(60, 30, 95);
    o.bgc = rgb(45, 25, 75); o.bgk = 4;
    o.gnd = rgb(50, 40, 70); o.top = rgb(98, 78, 135); o.deep = rgb(32, 25, 48);
    o.gy = 116; o.amp = 14; o.rough = 3; o.d1 = 11; o.d2 = 5; o.fx = 0;
  } else if (n == 22) {
    o.name = "VILLAGE";
    o.s1 = rgb(110, 175, 235); o.s2 = rgb(165, 210, 242); o.s3 = rgb(215, 232, 245);
    o.bgc = rgb(85, 150, 90); o.bgk = 3;
    o.gnd = rgb(120, 95, 60); o.top = rgb(100, 160, 65); o.deep = rgb(85, 65, 40);
    o.gy = 120; o.amp = 10; o.rough = 2; o.d1 = 13; o.d2 = 3; o.fx = 2;
  } else if (n == 23) {
    o.name = "RADAR STATION";
    o.s1 = rgb(95, 130, 175); o.s2 = rgb(140, 170, 205); o.s3 = rgb(190, 210, 230);
    o.bgc = rgb(110, 115, 125); o.bgk = 6;
    o.gnd = rgb(120, 120, 115); o.top = rgb(152, 152, 144); o.deep = rgb(85, 85, 82);
    o.gy = 122; o.amp = 4; o.rough = 1; o.d1 = 14; o.d2 = 15; o.fx = 2;
  } else {
    o.name = "FINAL STRONGHOLD";
    o.s1 = rgb(25, 5, 10); o.s2 = rgb(70, 15, 20); o.s3 = rgb(140, 40, 25);
    o.bgc = rgb(35, 18, 22); o.bgk = 6;
    o.gnd = rgb(70, 55, 55); o.top = rgb(102, 82, 78); o.deep = rgb(45, 35, 35);
    o.gy = 118; o.amp = 0; o.rough = 0; o.blk = 6; o.d1 = 7; o.d2 = 2; o.fx = 4;
  }
  return o;
}

function smooth(a, passes) {
  var p, i;
  for (p = 0; p < passes; p++) {
    for (i = 1; i < N - 1; i++) { a[i] = ((a[i - 1] + a[i] * 2 + a[i + 1]) / 4) | 0; }
  }
}

function genBg(k) {
  var i, j, v, w, h, x, tt, y, g, cx;
  bg = [];
  for (i = 0; i < N; i++) bg.push(100);
  if (k == 0) {
    v = 92;
    for (i = 0; i < N; i++) { v += rndi(5) - 2; if (v < 80) v = 80; if (v > 102) v = 102; bg[i] = v | 0; }
    smooth(bg, 3);
  } else if (k == 1) {
    x = 0;
    while (x < N) {
      w = 10 + rndi(16); h = 34 + rndi(40);
      for (j = 0; j < w && x + j < N; j++) {
        tt = j * 2 / w; if (tt > 1) tt = 2 - tt;
        bg[x + j] = (100 - h * tt) | 0;
      }
      x += w;
    }
  } else if (k == 2) {
    x = 0;
    while (x < N) {
      w = 4 + rndi(8); h = 28 + rndi(52);
      for (j = 0; j < w && x + j < N; j++) {
        y = 100 - h;
        if (rndi(5) == 0) y += rndi(12);
        bg[x + j] = y;
      }
      x += w;
      g = rndi(3);
      for (j = 0; j < g && x < N; j++) { bg[x] = 100; x++; }
    }
  } else if (k == 3) {
    v = 88;
    for (i = 0; i < N; i++) { v += rndi(7) - 3; if (v < 62) v = 62; if (v > 100) v = 100; bg[i] = v | 0; }
    smooth(bg, 4);
  } else if (k == 4) {
    x = 0;
    while (x < N) {
      w = 8 + rndi(20); h = 30 + rndi(36);
      for (j = 0; j < w && x + j < N; j++) bg[x + j] = 100 - h;
      x += w;
      g = rndi(5);
      for (j = 0; j < g && x < N; j++) { bg[x] = 100; x++; }
    }
  } else if (k == 5) {
    cx = 100; v = 92;
    for (i = 0; i < N; i++) {
      v += rndi(5) - 2; if (v < 76) v = 76; if (v > 100) v = 100;
      y = 44 + ab(i - cx) * 1.3;
      if (ab(i - cx) < 3) y = 48;
      if (y > v) y = v;
      bg[i] = y | 0;
    }
  } else {
    for (i = 0; i < N; i++) {
      y = 72;
      if (((i / 3) | 0) % 2 == 0) y = 66;
      if ((i % 40) >= 6 && (i % 40) < 16) { y = 46; if (i % 2 == 0) y = 40; }
      bg[i] = y;
    }
    for (j = 0; j < 3; j++) {
      x = rndi(N - 16); w = 6 + rndi(8);
      for (i = x; i < x + w && i < N; i++) bg[i] = 90;
    }
  }
}

function genTerrain() {
  var i, v, j, run, hh;
  var gy = L.gy, amp = L.amp, rough = L.rough, blk = L.blk;
  hs = [];
  if (blk > 0) {
    i = 0;
    while (i < N) {
      run = 4 + rndi(9);
      hh = gy - (rndi(4) * blk);
      for (j = 0; j < run && i < N; j++) { hs.push(hh); i++; }
    }
  } else {
    v = gy;
    for (i = 0; i < N; i++) {
      v += rndi(2 * rough + 1) - rough;
      v += (gy - v) / 12;
      if (v < gy - amp) v = gy - amp;
      if (v > gy + amp / 2) v = gy + amp / 2;
      hs.push(v | 0);
    }
    smooth(hs, 2);
  }
  for (i = 0; i < N; i++) {
    if (hs[i] < 78) hs[i] = 78;
    if (hs[i] > BOT - 8) hs[i] = BOT - 8;
  }
}

function pad(s) {
  var h = hs[s], i;
  if (h < 96) h = 96;
  if (h > 134) h = 134;
  for (i = s - 5; i <= s + 5; i++) { if (i >= 0 && i < N) hs[i] = h; }
}

function setupLevel() {
  var li = ((level - 1) / SCENE_LEN) | 0;
  var k, j, s, bx, mw, av;
  L = landscape(li);
  seed = (seed + level * 131 + frames * 7 + 1) % 65537;
  genTerrain();
  ES = 66 + (((level - 1) * 85 / 99) | 0) + rndi(15) - 7;
  if (ES < 62) ES = 62;
  if (ES > 150) ES = 150;
  EX = ES * 2 + 1;
  pad(PS); pad(ES);
  genBg(L.bgk);
  decS = []; decK = []; decB = [];
  for (k = 0; k < 10; k++) {
    s = 3 + rndi(N - 6);
    if (ab(s - PS) > 8 && ab(s - ES) > 8) {
      decS.push(s);
      if (k % 2 == 0) decK.push(L.d1); else decK.push(L.d2);
      decB.push(hs[s]);
    }
  }
  fx = [];
  if (L.fx == 2) {
    for (k = 0; k < 4; k++) { fx.push(20 + rndi(280)); fx.push(24 + rndi(30)); fx.push(7 + rndi(5)); }
  } else if (L.fx == 3 || L.fx == 6) {
    for (k = 0; k < 30; k++) { fx.push(rndi(W)); fx.push(TOP + 2 + rndi(56)); }
  } else if (L.fx == 7) {
    av = 30;
    for (k = 0; k < 80; k++) { av += rndi(7) - 3; if (av < 22) av = 22; if (av > 48) av = 48; fx.push(k * 4); fx.push(av); }
  } else if (L.fx == 8) {
    for (k = 0; k < 60; k++) { fx.push(rndi(W)); fx.push(TOP + rndi(130)); }
  } else if (L.fx == 4) {
    for (k = 0; k < 3; k++) {
      bx = 40 + rndi(240);
      for (j = 0; j < 5; j++) { fx.push(bx + rndi(7) - 3 + j * 2); fx.push(86 - j * 13); fx.push(6 + j * 2); }
    }
  }
  enemyMax = 45 + level * 3;
  enemyHP = enemyMax;
  ammo = 6 + upAmmo;
  shots = 0;
  maxWind = 0.0004 + level * 0.00007;
  wind = ((rndi(2001) - 1000) / 1000) * maxWind;
  if (shell > 0 && stock[shell] <= 0) shell = 0;
}

function driftWind() {
  wind += ((rndi(201) - 100) / 100) * maxWind * 0.3;
  if (wind > maxWind) wind = maxWind;
  if (wind < -maxWind) wind = -maxWind;
}

/* ---------- drawing: terrain ---------- */
function seg(x, ya, yb, c) { if (yb > ya) display.drawFillRect(x, ya, 2, yb - ya, c); }
function cseg(x, ya, yb, c, y0, y1) {
  if (ya < y0) ya = y0;
  if (yb > y1) yb = y1;
  if (yb > ya) display.drawFillRect(x, ya, 2, yb - ya, c);
}
function skySeg(x, ya, yb) {
  var a = ya, b = yb, m;
  if (a < 52) { m = b; if (m > 52) m = 52; seg(x, a, m, L.s1); a = 52; }
  if (a < 92 && b > a) { m = b; if (m > 92) m = 92; seg(x, a, m, L.s2); a = 92; }
  if (b > a) seg(x, a, b, L.s3);
}

function drawCols(i0, i1, y0, y1, doSky, doGnd) {
  var i, x, t, b, ya, yb, mm;
  if (i0 < 0) i0 = 0;
  if (i1 >= N) i1 = N - 1;
  for (i = i0; i <= i1; i++) {
    x = i * 2; t = hs[i]; b = bg[i];
    if (b > t) b = t;
    if (doSky) {
      yb = b; if (yb > y1) yb = y1;
      if (yb > y0) skySeg(x, y0, yb);
    }
    if (doGnd) {
      ya = b; if (ya < y0) ya = y0;
      yb = t; if (yb > y1) yb = y1;
      if (yb > ya) {
        if (L.cap >= 0 && ya < L.capy) {
          mm = yb; if (mm > L.capy) mm = L.capy;
          display.drawFillRect(x, ya, 2, mm - ya, L.cap);
          ya = mm;
        }
        if (yb > ya) display.drawFillRect(x, ya, 2, yb - ya, L.bgc);
      }
      cseg(x, t, t + 3, L.top, y0, y1);
      cseg(x, t + 3, t + 16, L.gnd, y0, y1);
      cseg(x, t + 16, y1, L.deep, y0, y1);
    }
  }
}

function cloud(x, y, r) {
  var c = rgb(245, 248, 252);
  display.drawFillCircle(x, y, r, c);
  display.drawFillCircle(x + r, y + 2, r - 2, c);
  display.drawFillCircle(x - r, y + 3, r - 3, c);
}

function drawFx() {
  var i, f = L.fx;
  if (f == 1) {
    display.drawFillCircle(250, 40, 17, rgb(255, 235, 160));
    display.drawFillCircle(250, 40, 12, rgb(255, 255, 225));
  } else if (f == 2) {
    for (i = 0; i < fx.length; i += 3) cloud(fx[i], fx[i + 1], fx[i + 2]);
  } else if (f == 3) {
    for (i = 0; i < fx.length; i += 2) display.drawFillRect(fx[i], fx[i + 1], 1, 1, WHITE);
    display.drawFillCircle(60, 38, 10, rgb(235, 235, 210));
    display.drawFillCircle(64, 35, 8, L.s1);
  } else if (f == 4) {
    for (i = 0; i < fx.length; i += 3) display.drawFillCircle(fx[i], fx[i + 1], fx[i + 2], rgb(75, 75, 80));
  } else if (f == 5) {
    display.drawFillCircle(201, 42, 26, rgb(150, 40, 20));
    display.drawFillCircle(201, 42, 15, rgb(235, 115, 30));
  } else if (f == 6) {
    for (i = 0; i < fx.length; i += 2) display.drawFillRect(fx[i], fx[i + 1], 1, 1, WHITE);
    display.drawFillCircle(255, 42, 15, rgb(60, 110, 200));
    display.drawFillCircle(251, 38, 6, rgb(70, 160, 90));
    display.drawFillCircle(259, 46, 5, rgb(235, 240, 250));
  } else if (f == 7) {
    for (i = 0; i < fx.length; i += 2) {
      display.drawFillRect(fx[i], fx[i + 1], 3, 22, rgb(40, 200, 140));
      display.drawFillRect(fx[i], fx[i + 1] + 4, 3, 10, rgb(120, 255, 190));
    }
  } else if (f == 8) {
    for (i = 0; i < fx.length; i += 2) display.drawLine(fx[i], fx[i + 1], fx[i] - 3, fx[i + 1] + 8, rgb(165, 185, 210));
  } else if (f == 9) {
    display.drawFillCircle(90, 76, 22, rgb(255, 170, 70));
    display.drawFillCircle(90, 76, 14, rgb(255, 225, 130));
  }
}

function drawDeco(k, x, y) {
  var c1, c2;
  if (k == 0) {
    c1 = rgb(60, 130, 60);
    display.drawFillRect(x - 1, y - 12, 3, 12, c1);
    display.drawFillRect(x - 5, y - 8, 4, 2, c1);
    display.drawFillRect(x - 5, y - 11, 2, 4, c1);
    display.drawFillRect(x + 2, y - 6, 4, 2, c1);
    display.drawFillRect(x + 4, y - 9, 2, 4, c1);
  } else if (k == 1 || k == 9) {
    display.drawFillRect(x - 1, y - 4, 2, 4, rgb(90, 60, 35));
    if (k == 9) c1 = rgb(235, 240, 250); else c1 = rgb(30, 95, 50);
    display.drawFillRect(x - 5, y - 8, 10, 4, c1);
    display.drawFillRect(x - 4, y - 12, 8, 4, c1);
    display.drawFillRect(x - 2, y - 16, 4, 4, c1);
  } else if (k == 2) {
    c1 = rgb(112, 106, 100);
    display.drawFillRect(x - 5, y - 10, 4, 10, c1);
    display.drawFillRect(x + 1, y - 6, 5, 6, c1);
    display.drawFillRect(x - 5, y - 12, 2, 2, c1);
    display.drawFillRect(x - 4, y - 7, 1, 2, rgb(30, 30, 35));
    display.drawFillRect(x + 3, y - 4, 1, 2, rgb(30, 30, 35));
  } else if (k == 3) {
    display.drawFillRect(x - 1, y - 10, 3, 10, rgb(90, 60, 35));
    display.drawFillCircle(x, y - 13, 7, rgb(40, 120, 50));
    display.drawFillCircle(x - 4, y - 10, 5, rgb(55, 145, 60));
  } else if (k == 4) {
    c1 = rgb(80, 55, 35);
    display.drawLine(x, y, x, y - 12, c1);
    display.drawLine(x, y - 8, x - 5, y - 13, c1);
    display.drawLine(x, y - 6, x + 5, y - 11, c1);
  } else if (k == 5) {
    display.drawFillCircle(x, y - 3, 5, rgb(125, 118, 112));
    display.drawFillRect(x - 5, y - 3, 10, 3, rgb(105, 98, 92));
  } else if (k == 6) {
    display.drawFillRect(x - 6, y - 1, 12, 3, rgb(255, 120, 20));
    display.drawFillRect(x - 3, y - 2, 6, 1, rgb(255, 200, 60));
  } else if (k == 7) {
    display.drawFillRect(x - 3, y - 14, 6, 14, rgb(130, 128, 122));
    display.drawFillRect(x - 4, y - 14, 3, 2, rgb(150, 148, 142));
    display.drawFillRect(x - 1, y - 17, 2, 3, rgb(130, 128, 122));
  } else if (k == 8) {
    display.drawFillRect(x - 7, y - 5, 14, 4, rgb(52, 46, 40));
    display.drawFillRect(x - 2, y - 8, 5, 3, rgb(52, 46, 40));
    display.drawFillCircle(x - 4, y - 2, 2, rgb(25, 25, 25));
    display.drawFillCircle(x + 4, y - 2, 2, rgb(25, 25, 25));
    display.drawFillCircle(x + 2, y - 12, 3, rgb(80, 80, 85));
  } else if (k == 10) {
    c1 = rgb(95, 65, 35); c2 = rgb(40, 150, 60);
    display.drawLine(x, y, x + 2, y - 14, c1);
    display.drawLine(x + 1, y, x + 3, y - 14, c1);
    display.drawLine(x + 2, y - 14, x - 5, y - 11, c2);
    display.drawLine(x + 2, y - 14, x + 9, y - 11, c2);
    display.drawLine(x + 2, y - 14, x - 3, y - 18, c2);
    display.drawLine(x + 2, y - 14, x + 7, y - 18, c2);
  } else if (k == 11) {
    display.drawFillRect(x - 1, y - 12, 3, 12, rgb(120, 200, 255));
    display.drawFillRect(x - 4, y - 8, 3, 8, rgb(180, 120, 255));
    display.drawFillRect(x + 2, y - 7, 3, 7, rgb(150, 160, 255));
    display.drawFillRect(x - 1, y - 14, 1, 2, WHITE);
  } else if (k == 12) {
    c1 = rgb(200, 230, 255);
    display.drawFillRect(x - 3, y - 4, 6, 4, c1);
    display.drawFillRect(x - 2, y - 9, 4, 5, c1);
    display.drawFillRect(x - 1, y - 14, 2, 5, rgb(235, 248, 255));
  } else if (k == 13) {
    display.drawFillRect(x - 6, y - 8, 12, 8, rgb(125, 90, 58));
    display.drawFillRect(x - 7, y - 11, 14, 3, rgb(150, 55, 45));
    display.drawFillRect(x - 4, y - 14, 8, 3, rgb(150, 55, 45));
    display.drawFillRect(x - 1, y - 5, 3, 5, rgb(50, 35, 25));
  } else if (k == 14) {
    c1 = rgb(150, 150, 155);
    display.drawLine(x - 3, y, x, y - 20, c1);
    display.drawLine(x + 3, y, x, y - 20, c1);
    display.drawLine(x - 2, y - 7, x + 2, y - 7, c1);
    display.drawLine(x - 1, y - 14, x + 1, y - 14, c1);
    display.drawFillRect(x - 1, y - 24, 2, 4, c1);
    display.drawFillRect(x - 1, y - 26, 2, 2, rgb(255, 60, 50));
  } else if (k == 15) {
    display.drawFillRect(x - 8, y - 5, 16, 5, rgb(150, 135, 95));
    display.drawFillRect(x - 6, y - 8, 12, 3, rgb(135, 120, 82));
    display.drawFillRect(x - 3, y - 4, 6, 1, rgb(40, 35, 25));
  } else if (k == 16) {
    display.drawFillRect(x - 1, y - 10, 3, 10, rgb(90, 60, 35));
    display.drawFillCircle(x, y - 13, 7, rgb(220, 120, 30));
    display.drawFillCircle(x - 4, y - 10, 5, rgb(190, 70, 25));
    display.drawFillCircle(x + 4, y - 11, 4, rgb(235, 170, 40));
  }
}

function drawDecor(i0, i1) {
  var k, s;
  for (k = 0; k < decS.length; k++) {
    s = decS[k];
    if (s >= i0 && s <= i1 && hs[s] <= decB[k] + 3) drawDeco(decK[k], s * 2 + 1, hs[s]);
  }
}

/* ---------- drawing: tanks ---------- */
function enemyCol(t) {
  if (t == 0) return rgb(160, 62, 52);
  if (t == 1) return rgb(175, 95, 42);
  if (t == 2) return rgb(125, 125, 125);
  if (t == 3) return rgb(135, 72, 135);
  if (t == 4) return rgb(60, 92, 155);
  if (t == 5) return rgb(195, 155, 42);
  if (t == 6) return rgb(42, 135, 112);
  if (t == 7) return rgb(205, 62, 22);
  if (t == 8) return rgb(95, 95, 118);
  return rgb(28, 28, 32);
}

function tipPos() {
  var bl = 12 + upCan * 2;
  tX = PX + 2 + ((COS[angle] * bl) | 0);
  tY = hs[PS] - 11 - ((SIN[angle] * bl) | 0);
}

function drawPlayer() {
  var y = hs[PS], x = PX, c = rgb(70, 130, 60), d = rgb(45, 90, 40), bc = rgb(25, 50, 25);
  display.drawFillRect(x - 9, y - 4, 18, 4, rgb(40, 40, 40));
  display.drawFillCircle(x - 6, y - 2, 2, rgb(95, 95, 95));
  display.drawFillCircle(x, y - 2, 2, rgb(95, 95, 95));
  display.drawFillCircle(x + 6, y - 2, 2, rgb(95, 95, 95));
  display.drawFillRect(x - 8, y - 9, 16, 5, c);
  if (upArm > 0) display.drawFillRect(x + 7, y - 9, 2, 5, rgb(160, 160, 160));
  if (upArm > 2) display.drawFillRect(x - 9, y - 9, 2, 5, rgb(160, 160, 160));
  display.drawFillRect(x - 4, y - 13, 8, 4, d);
  tipPos();
  display.drawLine(x + 2, y - 11, tX, tY, bc);
  display.drawLine(x + 2, y - 12, tX, tY - 1, bc);
}

function drawEnemy(alive) {
  var y = hs[ES], x = EX, t = ((level - 1) / 10) | 0, c = enemyCol(t), bc = rgb(20, 20, 20);
  if (!alive) {
    display.drawFillRect(x - 9, y - 4, 18, 4, rgb(25, 25, 25));
    display.drawFillRect(x - 8, y - 8, 16, 4, rgb(45, 40, 38));
    display.drawFillRect(x - 3, y - 11, 6, 3, rgb(35, 32, 30));
    display.drawFillCircle(x + 1, y - 14, 4, rgb(70, 70, 75));
    display.drawFillCircle(x - 3, y - 19, 3, rgb(90, 90, 95));
    display.drawFillRect(x - 2, y - 10, 3, 2, rgb(255, 130, 30));
    return;
  }
  display.drawFillRect(x - 9, y - 4, 18, 4, rgb(40, 40, 40));
  display.drawFillCircle(x - 6, y - 2, 2, rgb(95, 95, 95));
  display.drawFillCircle(x, y - 2, 2, rgb(95, 95, 95));
  display.drawFillCircle(x + 6, y - 2, 2, rgb(95, 95, 95));
  display.drawFillRect(x - 8, y - 9, 16, 5, c);
  display.drawFillRect(x - 4, y - 13, 8, 4, rgb(((c >> 11) << 3) + 20, ((c >> 5) & 63) * 2 + 10, ((c & 31) << 3) + 20));
  display.drawLine(x - 2, y - 11, x - 15 - (t >> 1), y - 16, bc);
  display.drawLine(x - 2, y - 12, x - 15 - (t >> 1), y - 17, bc);
  if (t >= 5) display.drawLine(x - 2, y - 10, x - 12, y - 13, bc);
  if (t >= 8) display.drawFillRect(x - 3, y - 15, 6, 2, rgb(200, 40, 30));
}

function redrawPlayer() {
  var y = hs[PS], y0 = y - 38;
  if (y0 < TOP) y0 = TOP;
  drawCols(6, 28, y0, y + 2, true, true);
  drawDecor(6, 28);
  drawPlayer();
}

/* ---------- drawing: HUD ---------- */
function bar(x, y, w, h, frac, col, bgc) {
  var fw;
  display.drawFillRect(x, y, w, h, bgc);
  fw = (w * frac) | 0;
  if (fw > w) fw = w;
  if (fw > 0) display.drawFillRect(x, y, fw, h, col);
}

function drawTop() {
  display.drawFillRect(0, 0, W, TOP, rgb(18, 20, 28));
  txt("R" + level + "/100", 2, 4, WHITE);
  txt("HP", 62, 4, rgb(120, 220, 120));
  bar(76, 4, 44, 8, hp / maxHP, rgb(60, 200, 70), rgb(55, 30, 30));
  txt("EN", 126, 4, rgb(230, 120, 110));
  bar(140, 4, 44, 8, enemyHP / enemyMax, rgb(220, 60, 50), rgb(55, 30, 30));
  txt("$" + credits, 192, 4, rgb(255, 215, 80));
  txt("AM" + ammo, 256, 4, WHITE);
}

function windStr() {
  var v = (ab(wind) * 10000) | 0;
  if (wind > 0) return ">>" + v;
  if (wind < 0) return "<<" + v;
  return "0";
}

function estRange(p) {
  var v = p * VK, vx = v * COS[angle], vy = v * SIN[angle], t = 2 * vy / G, r = 2 * vx * vy / G;
  if (upRf >= 2) r += 0.5 * wind * t * t;
  return r | 0;
}

function drawRng() {
  display.drawFillRect(256, BOT + 12, W - 256, 10, rgb(14, 14, 20));
  if (upRf > 0 && curRng >= 0) txt("RNG" + curRng, 258, BOT + 13, rgb(120, 255, 160));
}

function drawBottomInfo() {
  var s = SN[shell];
  if (shell > 0) s = s + "x" + stock[shell];
  display.drawFillRect(0, BOT + 12, W, 10, rgb(14, 14, 20));
  txt("ANG " + angle, 2, BOT + 13, WHITE);
  txt(s, 52, BOT + 13, rgb(255, 200, 80));
  txt("WIND " + windStr(), 124, BOT + 13, rgb(150, 210, 255));
  txt("TGT " + (EX - PX), 206, BOT + 13, rgb(230, 230, 230));
  drawRng();
}

function gaugeSeg(s, p) {
  var on = (p >= s * 5 + 2), c;
  if (s < 8) { if (on) c = rgb(60, 200, 70); else c = rgb(25, 60, 28); }
  else if (s < 15) { if (on) c = rgb(235, 205, 50); else c = rgb(65, 58, 20); }
  else { if (on) c = rgb(230, 60, 50); else c = rgb(65, 22, 20); }
  display.drawFillRect(70 + s * 8, BOT + 2, 7, 8, c);
}

function gaugeFull(p) { var s; for (s = 0; s < 20; s++) gaugeSeg(s, p); }

function drawBottomBase() { display.drawFillRect(0, BOT, W, H - BOT, rgb(14, 14, 20)); }

function setBottom(phase) {
  drawBottomBase();
  drawBottomInfo();
  if (phase == 0) {
    txt("TURN: AIM ANGLE    CLICK: LOCK", 40, BOT + 3, rgb(180, 255, 180));
  } else {
    txt("PWR", 40, BOT + 3, WHITE);
    gaugeFull(shownP);
    txt("FIRE", 234, BOT + 3, rgb(255, 120, 100));
  }
}

function drawFull() {
  drawCols(0, N - 1, TOP, BOT, true, false);
  drawFx();
  drawCols(0, N - 1, TOP, BOT, false, true);
  drawDecor(0, N - 1);
  drawPlayer();
  drawEnemy(enemyHP > 0);
  drawTop();
  drawBottomBase();
  drawBottomInfo();
}

function showMsg(s, c, ms) {
  drawBottomBase();
  txtMid(s, BOT + 7, c, 1);
  delay(ms);
}

function showAcc(acc, label, col) {
  drawBottomBase();
  txt("ACCURACY", 8, BOT + 8, WHITE);
  bar(80, BOT + 6, 150, 10, acc / 100, col, rgb(40, 40, 40));
  txt(label, 238, BOT + 8, col);
  delay(900);
}

/* ---------- combat ---------- */
function explode(x, y, r, big) {
  var rr, n = 0, c;
  x = x | 0; y = y | 0;
  for (rr = 3; rr <= r; rr += 4) {
    if (n % 3 == 0) c = rgb(255, 230, 100);
    else if (n % 3 == 1) c = rgb(255, 150, 40);
    else c = rgb(220, 60, 30);
    display.drawFillCircle(x, y, rr, c);
    n++;
    delay(16);
  }
  if (big) { display.drawFillRect(0, TOP, W, BOT - TOP, WHITE); delay(60); }
}

function crater(cx, cy, r) {
  var i0 = ((cx - r) / 2) | 0, i1 = ((cx + r) / 2) | 0, i, dx, d, nh;
  for (i = i0; i <= i1; i++) {
    if (i >= 0 && i < N) {
      dx = i * 2 + 1 - cx;
      if (ab(dx) <= r) {
        d = isqrt(r * r - dx * dx);
        nh = (cy + (d * 7) / 10) | 0;
        if (nh > hs[i]) hs[i] = nh;
        if (hs[i] > BOT - 4) hs[i] = BOT - 4;
      }
    }
  }
}

/* player shell flight: result in rx, ry, rt (0=out, 1=ground, 2=direct hit) */
function fly(x, y, vx, vy, ax, col) {
  var s, i, steps = 0;
  rt = -1;
  while (rt < 0) {
    for (s = 0; s < 2 && rt < 0; s++) {
      x += vx; y -= vy; vy -= G; vx += ax;
      if (x < 0 || x >= W || y >= H) { rt = 0; rx = x; ry = y; }
      else if (y >= 0) {
        i = (x / 2) | 0;
        if (y >= hs[i]) { rt = 1; rx = x; ry = y; }
        else if (x >= EX - 9 && x <= EX + 9 && y >= eb - 14 && y <= eb) { rt = 2; rx = x; ry = y; }
      }
    }
    if (rt < 0) {
      if (y >= TOP) display.drawFillRect(x | 0, y | 0, 2, 2, col);
      delay(4);
    }
    steps++;
    if (steps > 2500) rt = 0;
  }
}

function enemyAttack() {
  var nShots = 1, n, chance, off, tx, ty, sx, sy, A, fr, t, x, y, dmg0, dmg, dx, spread;
  if (level >= 70) nShots = 2;
  for (n = 0; n < nShots; n++) {
    chance = 10 + ((level * 45 / 100) | 0);
    if (chance > 50) chance = 50;
    if (rndi(100) < chance) {
      off = rndi(9) - 4;
    } else {
      spread = 60 - ((level * 3 / 10) | 0);
      if (spread < 25) spread = 25;
      off = 18 + rndi(spread);
      if (rndi(2) == 0) off = -off;
    }
    tx = PX + off;
    if (tx < 3) tx = 3;
    if (tx > W - 3) tx = W - 3;
    ty = hs[(tx / 2) | 0];
    sx = EX - 6; sy = hs[ES] - 14;
    A = 36 + rndi(36);
    for (fr = 0; fr <= 26; fr++) {
      t = fr / 26;
      x = sx + (tx - sx) * t;
      y = sy + (ty - sy) * t - 4 * A * t * (1 - t);
      if (y >= TOP) display.drawFillRect(x | 0, y | 0, 2, 2, rgb(255, 240, 140));
      delay(12);
    }
    explode(tx, ty, 12, false);
    crater(tx, ty, 10);
    dmg0 = 16 + ((level * 25 / 100) | 0);
    dmg0 = (dmg0 * (100 - 8 * upArm) / 100) | 0;
    dx = ab(tx - PX);
    dmg = 0;
    if (dx <= 10) dmg = dmg0;
    else if (dx < 26) dmg = (dmg0 * 0.5 * (1 - (dx - 10) / 16)) | 0;
    hp -= dmg;
    drawFull();
    if (dmg > 0) showMsg("YOU'RE HIT!  -" + dmg + " HP", rgb(255, 90, 80), 700);
    else showMsg("ENEMY MISSED", rgb(170, 170, 170), 450);
    if (hp <= 0) return;
  }
}

/* returns 0 = continue, 1 = enemy destroyed, 2 = player destroyed */
function playerShot(p) {
  var sh = shell, cnt = 1, k, pw, v, vx, vy, base, d, dx, dy, dmg, ecy, acc, best = 0, direct = false;
  var label, col, rew, dm;
  ammo--; shots++;
  if (sh > 0) { stock[sh]--; if (stock[sh] <= 0) shell = 0; }
  if (sh == 3) cnt = 3;
  for (k = 0; k < cnt && enemyHP > 0; k++) {
    pw = p;
    if (cnt == 3) pw = p * (1 + (k - 1) * 0.08);
    v = pw * VK;
    vx = v * COS[angle]; vy = v * SIN[angle];
    tipPos();
    eb = hs[ES];
    fly(tX, tY, vx, vy, wind, SC[sh]);
    acc = 100 - ((ab(rx - EX) * 100 / 70) | 0);
    if (acc < 0) acc = 0;
    if (rt == 2) { acc = 100; direct = true; }
    if (acc > best) best = acc;
    if (rt != 0) {
      ecy = eb - 6;
      explode(rx, ry, BL[sh], sh == 4);
      crater(rx, ry, BL[sh]);
      base = 60 * (1 + 0.25 * upCan) * DM[sh];
      dx = ab(rx - EX); dy = ab(ry - ecy);
      d = isqrt(dx * dx + dy * dy);
      dmg = 0;
      if (rt == 2) dmg = base;
      else if (d < BL[sh] + 9) dmg = base * 0.65 * (1 - d / (BL[sh] + 9));
      enemyHP -= dmg;
    }
  }
  if (enemyHP <= 0) { enemyHP = 0; explode(EX, hs[ES] - 6, 30, true); }
  drawFull();
  if (enemyHP <= 0) { label = "DESTROYED"; col = rgb(90, 255, 110); }
  else if (direct) { label = "DIRECT HIT!"; col = rgb(255, 210, 60); }
  else if (best >= 60) { label = "NEAR MISS"; col = rgb(255, 160, 60); }
  else { label = "MISS"; col = rgb(220, 90, 80); }
  showAcc(best, label, col);
  if (enemyHP <= 0) {
    rew = 25 + level * 3 + ((best / 4) | 0);
    if (shots == 1) rew += 20;
    credits += rew;
    showMsg("TARGET DESTROYED   +$" + rew, rgb(90, 255, 110), 1300);
    return 1;
  }
  driftWind();
  enemyAttack();
  if (hp <= 0) return 2;
  if (ammo <= 0) {
    dm = ((25 * (100 - 8 * upArm)) / 100) | 0;
    hp -= dm;
    ammo = 3;
    drawTop();
    showMsg("OUT OF AMMO! RESUPPLY  -" + dm + " HP", rgb(255, 120, 80), 1200);
    if (hp <= 0) return 2;
  }
  return 0;
}

/* ---------- menus & screens ---------- */
function pauseMenu() {
  var sel = 0, done = false, ret = 0;
  display.drawFillRect(80, 48, 160, 76, rgb(10, 12, 10));
  display.drawRect(80, 48, 160, 76, rgb(200, 200, 120));
  txtMid("PAUSED", 56, rgb(255, 215, 80), 2);
  while (!done) {
    display.drawFillRect(90, 84, 140, 14, sel == 0 ? rgb(60, 90, 50) : rgb(10, 12, 10));
    display.drawFillRect(90, 102, 140, 14, sel == 1 ? rgb(90, 50, 50) : rgb(10, 12, 10));
    txtMid("RESUME", 88, WHITE, 1);
    txtMid("QUIT GAME", 106, WHITE, 1);
    poll();
    if (inN || inP) sel = 1 - sel;
    if (inS) { ret = sel; done = true; }
    if (inE) { ret = 0; done = true; }
    delay(40);
  }
  return ret;
}

function title() {
  var t = 0, go = false, c;
  display.drawFillRect(0, 0, W, H, rgb(18, 28, 18));
  display.drawFillRect(0, 118, W, 52, rgb(60, 80, 45));
  display.drawFillRect(0, 118, W, 3, rgb(90, 120, 60));
  /* little tank art */
  display.drawFillRect(225, 104, 60, 10, rgb(40, 40, 40));
  display.drawFillCircle(233, 109, 5, rgb(95, 95, 95));
  display.drawFillCircle(255, 109, 5, rgb(95, 95, 95));
  display.drawFillCircle(277, 109, 5, rgb(95, 95, 95));
  display.drawFillRect(229, 92, 52, 12, rgb(70, 130, 60));
  display.drawFillRect(241, 82, 28, 10, rgb(45, 90, 40));
  display.drawLine(267, 86, 309, 72, rgb(25, 50, 25));
  display.drawLine(267, 87, 309, 73, rgb(25, 50, 25));
  txtMid("TANK", 6, rgb(255, 215, 80), 3);
  txtMid("COMMANDER", 34, rgb(255, 215, 80), 2);
  txtMid("by da cbm", 54, rgb(120, 255, 160), 1);
  txtMid("100 ROUNDS - " + SCENES + " BATTLEFIELDS", 66, rgb(200, 220, 190), 1);
  txtMid("KNOB=AIM  CLICK=LOCK ANGLE, THEN FIRE", 128, WHITE, 1);
  txtMid("TURN KNOB WHILE GAUGE SWEEPS = SHELL", 140, rgb(255, 200, 80), 1);
  txtMid("ESC = PAUSE", 152, rgb(170, 170, 170), 1);
  while (!go) {
    poll();
    if (inS) go = true;
    if (inE) { quitFlag = true; go = true; }
    t++;
    c = ((t / 8) | 0) % 2 == 0 ? WHITE : rgb(18, 28, 18);
    txtMid("CLICK TO START", 82, c, 1);
    delay(40);
  }
}

function intro() {
  var li = ((level - 1) / SCENE_LEN) | 0, newMap = ((level - 1) % SCENE_LEN == 0), ms, t;
  display.drawFillRect(0, 0, W, H, L.s2);
  display.drawFillRect(0, 110, W, 60, L.gnd);
  display.drawFillRect(16, 14, W - 32, H - 28, rgb(12, 14, 12));
  display.drawRect(16, 14, W - 32, H - 28, L.top);
  if (newMap) {
    txtMid("BATTLEFIELD " + (li + 1) + " / " + SCENES, 30, WHITE, 2);
    txtMid(L.name, 64, rgb(255, 230, 120), 2);
    txtMid("ROUND " + level, 104, rgb(190, 220, 190), 2);
    ms = 1800;
  } else {
    txtMid("ROUND " + level + " / 100", 50, WHITE, 2);
    txtMid(L.name, 90, rgb(255, 230, 120), 2);
    ms = 700;
  }
  for (t = 0; t < ms / 50; t++) {
    poll();
    if (inS) t = 99999;
    delay(50);
  }
}

function gameOver() {
  var go = false;
  display.drawFillRect(0, 0, W, H, rgb(30, 8, 8));
  txtMid("TANK DESTROYED", 24, rgb(255, 80, 70), 2);
  txtMid("YOU REACHED ROUND " + level, 66, WHITE, 1);
  txtMid("CREDITS LEFT: $" + credits, 82, rgb(255, 215, 80), 1);
  txtMid("CLICK TO CONTINUE", 130, rgb(200, 200, 200), 1);
  delay(500);
  while (!go) { poll(); if (inS || inE) go = true; delay(40); }
}

function victory() {
  var go = false;
  display.drawFillRect(0, 0, W, H, rgb(10, 30, 12));
  txtMid("VICTORY!", 20, rgb(255, 215, 80), 3);
  txtMid("ALL 100 ROUNDS CLEARED", 60, WHITE, 1);
  txtMid("ALL " + SCENES + " BATTLEFIELDS CONQUERED", 76, WHITE, 1);
  txtMid("CREDITS: $" + credits, 96, rgb(255, 215, 80), 1);
  txtMid("CLICK TO CONTINUE", 130, rgb(200, 200, 200), 1);
  delay(500);
  while (!go) { poll(); if (inS || inE) go = true; delay(40); }
}

/* ---------- upgrade depot ---------- */
function itemName(i) {
  var a = ["ARMOR PLATING", "CANNON POWER", "AMMO RACK", "STEADY HAND", "RANGEFINDER", "FULL REPAIR",
           "HE SHELLS x3", "AP SHELLS x3", "CLUSTER x3", "NUKE x1", "DEPLOY >>"];
  return a[i];
}
function itemInfo(i) {
  if (i == 0) return "Lv" + upArm + "/5";
  if (i == 1) return "Lv" + upCan + "/5";
  if (i == 2) return "Lv" + upAmmo + "/5";
  if (i == 3) return "Lv" + upSteady + "/5";
  if (i == 4) return "Lv" + upRf + "/2";
  if (i == 5) return "HP" + hp + "/" + maxHP;
  if (i >= 6 && i <= 9) return "own " + stock[i - 5];
  return "";
}
function itemCost(i) {
  if (i == 0) return 50 + 40 * upArm;
  if (i == 1) return 60 + 50 * upCan;
  if (i == 2) return 40 + 35 * upAmmo;
  if (i == 3) return 45 + 40 * upSteady;
  if (i == 4) return 70 + 90 * upRf;
  if (i == 5) return 40;
  if (i == 6) return 45;
  if (i == 7) return 55;
  if (i == 8) return 70;
  if (i == 9) return 150;
  return 0;
}
function itemMax(i) {
  if (i == 0) return upArm >= 5;
  if (i == 1) return upCan >= 5;
  if (i == 2) return upAmmo >= 5;
  if (i == 3) return upSteady >= 5;
  if (i == 4) return upRf >= 2;
  if (i == 5) return hp >= maxHP;
  return false;
}
function buyItem(i) {
  var c;
  if (i == 10) return "";
  if (itemMax(i)) { if (i == 5) return "ALREADY FULL"; return "MAXED OUT"; }
  c = itemCost(i);
  if (credits < c) return "NOT ENOUGH $";
  credits -= c;
  if (i == 0) { upArm++; maxHP = 100 + 25 * upArm; hp += 25; if (hp > maxHP) hp = maxHP; }
  else if (i == 1) upCan++;
  else if (i == 2) upAmmo++;
  else if (i == 3) upSteady++;
  else if (i == 4) upRf++;
  else if (i == 5) hp = maxHP;
  else if (i == 9) stock[4] += 1;
  else stock[i - 5] += 3;
  return "PURCHASED!";
}

function drawShop(sel, off, msg) {
  var r, i, y, bgc, cc;
  display.drawFillRect(0, 0, W, H, rgb(20, 24, 18));
  txt("UPGRADE DEPOT - ROUND " + level + " CLEARED", 6, 3, rgb(255, 215, 80));
  txt("$" + credits, 270, 3, rgb(255, 215, 80));
  for (r = 0; r < 9; r++) {
    i = off + r;
    if (i <= 10) {
      y = 16 + r * 14;
      if (i == sel) display.drawFillRect(2, y, W - 4, 13, rgb(52, 74, 42));
      if (i == sel) bgc = WHITE; else bgc = rgb(190, 190, 170);
      txt(itemName(i), 8, y + 3, bgc);
      txt(itemInfo(i), 140, y + 3, rgb(150, 200, 255));
      if (i < 10) {
        if (itemMax(i)) txt("MAX", 240, y + 3, rgb(150, 150, 150));
        else {
          if (credits >= itemCost(i)) cc = rgb(110, 255, 130); else cc = rgb(210, 90, 80);
          txt("$" + itemCost(i), 240, y + 3, cc);
        }
      }
    }
  }
  display.drawFillRect(0, H - 14, W, 14, rgb(14, 14, 20));
  txt(msg, 8, H - 11, rgb(255, 230, 120));
  txt("TURN:MOVE CLICK:BUY", 168, H - 11, rgb(150, 150, 150));
}

function shop() {
  var sel = 0, off = 0, done = false, msg = "SPEND YOUR CREDITS WISELY";
  drawShop(sel, off, msg);
  while (!done) {
    poll();
    if (inN || inP) {
      if (inN && sel < 10) sel++;
      if (inP && sel > 0) sel--;
      if (sel < off) off = sel;
      if (sel > off + 8) off = sel - 8;
      drawShop(sel, off, msg);
    }
    if (inS) {
      if (sel == 10) done = true;
      else { msg = buyItem(sel); drawShop(sel, off, msg); }
    }
    if (inE) done = true;
    delay(40);
  }
}

/* ---------- level loop ---------- */
function cycleShell(d) {
  var tries = 0, s = shell;
  while (tries < 5) {
    s = (s + d + 5) % 5;
    if (s == 0 || stock[s] > 0) { shell = s; tries = 99; }
    tries++;
  }
}

function sweepSpeed() {
  var v = 1.4 + level * 0.035 - upSteady * 0.3;
  if (v < 0.6) v = 0.6;
  return v;
}

/* returns 1 = win, 2 = dead, 3 = quit */
function playLevel() {
  var phase = 0, dir = 1, pi, s, r, a;
  power = 0; shownP = 0; curRng = -1;
  drawFull();
  setBottom(0);
  while (true) {
    poll();
    if (inE) {
      r = pauseMenu();
      if (r == 1) return 3;
      drawFull();
      setBottom(phase);
    } else if (phase == 0) {
      if (inN && angle < 85) { angle++; redrawPlayer(); drawBottomInfo(); }
      if (inP && angle > 5) { angle--; redrawPlayer(); drawBottomInfo(); }
      if (inS) { phase = 1; power = 0; dir = 1; shownP = 0; curRng = -1; setBottom(1); }
    } else {
      if (inN) { cycleShell(1); drawBottomInfo(); }
      if (inP) { cycleShell(-1); drawBottomInfo(); }
      power += dir * sweepSpeed();
      if (power >= 100) { power = 100; dir = -1; }
      if (power <= 0) { power = 0; dir = 1; }
      pi = power | 0;
      if (pi > shownP) { for (s = ((shownP / 5) | 0); s <= ((pi / 5) | 0) && s < 20; s++) gaugeSeg(s, pi); }
      else if (pi < shownP) { for (s = ((pi / 5) | 0); s <= ((shownP / 5) | 0) && s < 20; s++) gaugeSeg(s, pi); }
      shownP = pi;
      if (upRf > 0) {
        a = estRange(pi);
        if (a != curRng) { curRng = a; drawRng(); }
      }
      if (inS) {
        r = playerShot(pi);
        if (r != 0) return r;
        phase = 0; power = 0; shownP = 0; curRng = -1;
        drawFull();
        setBottom(0);
      }
    }
    delay(8);
  }
}

function newGame() {
  level = 1; maxHP = 100; hp = 100; credits = 0;
  upArm = 0; upCan = 0; upAmmo = 0; upSteady = 0; upRf = 0;
  stock = [0, 0, 0, 0, 0];
  shell = 0; angle = 45;
}

function main() {
  var go, r;
  buildTrig();
  while (!quitFlag) {
    title();
    if (quitFlag) break;
    newGame();
    go = true;
    while (go && !quitFlag) {
      setupLevel();
      intro();
      r = playLevel();
      if (r == 3) { quitFlag = true; }
      else if (r == 2) { gameOver(); go = false; }
      else {
        hp += ((maxHP * 15) / 100) | 0;
        if (hp > maxHP) hp = maxHP;
        if (level >= 100) { victory(); go = false; }
        else {
          if (level % 10 == 0) shop();
          level++;
        }
      }
    }
  }
  display.drawFillRect(0, 0, W, H, BLACK);
  txtMid("TANK COMMANDER - GOODBYE", 78, WHITE, 1);
}

main();
