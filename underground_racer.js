// UNDERGROUND RACER  -  by da cbm
// Bruce firmware JavaScript (ES5) for LilyGO T-Embed CC1101
// Rotary: turn = steer | press = nitro on/off | back = pause
// v2: flicker-free renderer (rows/sprites only repaint when they change,
//     fixed HUD bars outside the road, smoothed timing, frame pacing)

function main() {
  var W = display.width();
  var H = display.height();
  var S = 3;                                  // road strip height (px)
  var BAR = 18;                               // fixed bottom HUD bar
  var RB = H - BAR;                           // road bottom
  var N = Math.floor(RB * 0.62 / S);          // road rows
  var HY = RB - N * S;                        // horizon y
  var ZK = 40;
  var CAM = ZK / 1.03;
  var HWN = W * 0.375;                        // road half width at bottom
  var clipB = H;                              // bottom clip for rect()

  // ---------- helpers ----------
  function rgb(r, g, b) {
    r = Math.floor(r); g = Math.floor(g); b = Math.floor(b);
    return ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3);
  }
  function rect(x, y, w, h, c) {
    x = Math.floor(x); y = Math.floor(y); w = Math.floor(w); h = Math.floor(h);
    if (x < 0) { w += x; x = 0; }
    if (y < 0) { h += y; y = 0; }
    if (x + w > W) w = W - x;
    if (y + h > clipB) h = clipB - y;
    if (w <= 0 || h <= 0) return;
    if (typeof display.drawFillRect === 'function') display.drawFillRect(x, y, w, h, c);
    else display.fillRect(x, y, w, h, c);
  }
  function text(s, x, y, c, sz) {
    display.setTextSize(sz || 1);
    display.setTextColor(c);
    if (typeof display.drawString === 'function') display.drawString("" + s, Math.floor(x), Math.floor(y));
    else display.drawText("" + s, Math.floor(x), Math.floor(y));
  }
  function ctext(s, y, c, sz) {
    s = "" + s;
    text(s, (W - s.length * 6 * (sz || 1)) / 2, y, c, sz);
  }
  function beep(f, d) {
    try { if (typeof speaker !== 'undefined' && speaker.tone) speaker.tone(f, d); } catch (e) {}
  }
  function rndInt(n) { return Math.floor(Math.random() * n); }

  // ---------- colors ----------
  var C_BLACK = rgb(0, 0, 0), C_WHITE = rgb(255, 255, 255), C_YEL = rgb(255, 230, 40);
  var C_CYAN = rgb(0, 230, 255), C_MAG = rgb(255, 0, 190), C_RED = rgb(255, 50, 50);
  var C_DKBAR = rgb(40, 40, 60);
  var GRASS1 = rgb(10, 44, 26), GRASS2 = rgb(14, 56, 32);
  var ROAD1 = rgb(48, 48, 58), ROAD2 = rgb(58, 58, 70);
  var RUM1 = rgb(225, 0, 165), RUM2 = rgb(165, 0, 120);   // solid magenta border, only a subtle shade change
  var EDGE = rgb(240, 240, 250);                           // solid white edge line
  var LINE = rgb(235, 235, 120);

  var PAINT = [
    ["Red", [220, 30, 40]], ["Blue", [40, 80, 230]], ["Green", [30, 190, 80]],
    ["Yellow", [240, 200, 20]], ["Purple", [150, 50, 220]], ["Orange", [250, 120, 20]],
    ["White", [235, 235, 240]], ["Pink", [250, 90, 170]]
  ];
  var NEON = [
    ["Cyan", [0, 230, 255]], ["Magenta", [255, 0, 200]], ["Green", [60, 255, 60]],
    ["Blue", [60, 100, 255]], ["White", [255, 255, 255]], ["Off", null]
  ];
  var POLE_COL = [rgb(0, 230, 255), rgb(255, 0, 200), rgb(255, 220, 40)];
  var COST = [300, 600, 1000, 1600, 2500];

  // ---------- save data ----------
  var cash = 300, rep = 0, eng = 0, nit = 0, tire = 0, paint = 0, neon = 0;
  var wins = 0, races = 0, bestS = 0, bestC = 0;
  var detail = 1;                   // 1 = Smooth (2px road rows), 0 = Fast (3px rows)
  var SAVE = "/underground_racer.sav";
  var saveIdx = -1;                 // which storage form worked

  function specFor(k) {
    if (k === 0) return SAVE;
    if (k === 1) return { fs: "littlefs", path: SAVE };
    return { fs: "sd", path: SAVE };
  }
  function tryWrite(k, d) {
    try {
      storage.write(specFor(k), d, "write");
      var s = storage.read(specFor(k));
      return (typeof s === 'string' && s.indexOf(d) === 0);
    } catch (e) { return false; }
  }
  function saveString() {
    return ["1", cash, rep, eng, nit, tire, paint, neon, wins, races, bestS, bestC, detail].join("|");
  }
  // returns true only if the data was written AND read back correctly
  function save() {
    var d = saveString();
    var k;
    if (saveIdx >= 0) return tryWrite(saveIdx, d);
    for (k = 0; k < 3; k++) {
      if (tryWrite(k, d)) { saveIdx = k; return true; }
    }
    return false;
  }
  function applySave(s) {
    var a = s.split("|");
    if (a.length < 12) return false;
    cash = parseInt(a[1], 10) || 0; rep = parseInt(a[2], 10) || 0;
    eng = parseInt(a[3], 10) || 0; nit = parseInt(a[4], 10) || 0; tire = parseInt(a[5], 10) || 0;
    paint = parseInt(a[6], 10) || 0; neon = parseInt(a[7], 10) || 0;
    wins = parseInt(a[8], 10) || 0; races = parseInt(a[9], 10) || 0;
    bestS = parseInt(a[10], 10) || 0; bestC = parseInt(a[11], 10) || 0;
    if (a.length >= 13) detail = (parseInt(a[12], 10) === 0) ? 0 : 1;
    return true;
  }
  function load() {
    var k, s;
    for (k = 0; k < 3; k++) {
      try {
        s = storage.read(specFor(k));
        if (s && typeof s === 'string' && applySave(s)) { saveIdx = k; return true; }
      } catch (e) {}
    }
    return false;
  }
  function manualSave() {
    var ok = save();
    flash(ok ? "GAME SAVED!" : "SAVE FAILED", 900);
  }

  // ---------- track ----------
  var segs = [
    [300, 0], [120, 0.35], [220, 0.8], [120, 0.35], [260, 0], [120, -0.4], [240, -0.9], [120, -0.4],
    [300, 0], [200, 0.5], [200, -0.5], [160, 0.5], [300, 0], [140, 0.4], [260, 0.85], [140, 0.4],
    [240, 0], [140, -0.35], [260, -0.8], [140, -0.35], [300, 0]
  ];
  var lapLen = 0;
  var si;
  for (si = 0; si < segs.length; si++) lapLen += segs[si][0];

  function curveAt(z) {
    z = z - Math.floor(z / lapLen) * lapLen;
    var i = 0;
    while (i < segs.length - 1 && z >= segs[i][0]) { z -= segs[i][0]; i++; }
    var c = segs[i][1];
    if (z < 70) {                                   // ease into each bend instead of snapping
      var pc = segs[(i + segs.length - 1) % segs.length][1];
      var t = z / 70;
      t = t * t * (3 - 2 * t);
      c = pc + (c - pc) * t;
    }
    return c;
  }

  // ---------- world state ----------
  var pos = 0, playerX = 0, speed = 0, steerV = 0, nitro = 0, nitroOn = false;
  var raceMs = 0, shakeT = 0;
  var traffic = [], rivals = [];
  var LANES = [-0.75, -0.25, 0.25, 0.75];

  var cxs = [], hws = [], zs = [], ps = [];
  var cPar = [], cCx = [], parN = [], cxiN = [];
  function initGeometry(strip) {
    S = strip;
    N = Math.floor(RB * 0.62 / S);
    HY = RB - N * S;
    var q;
    for (q = 0; q < N; q++) {
      ps[q] = 1 - (q + 0.5) / N;
      zs[q] = ZK / (ps[q] + 0.03);
      hws[q] = 4 + ps[q] * (HWN - 4);
      cxs[q] = W / 2;
      cPar[q] = -1; cCx[q] = -9999; parN[q] = 0; cxiN[q] = 0;
    }
    prevList = []; prevMap = {};
  }

  function nitroMax() { return 60 + nit * 20; }

  // ---------- sky ----------
  function drawSky() {
    var i, s = 7;
    function rnd() { s = (s * 16807) % 2147483647; return s / 2147483647; }
    for (i = 0; i < HY; i += 3) {
      var f = i / HY;
      rect(0, i, W, 3, rgb(8 + f * f * 120, f * 20, 28 + f * f * 100));
    }
    for (i = 0; i < 28; i++) rect(rnd() * W, rnd() * HY * 0.55, 1, 1, rgb(200, 200, 255));
    if (typeof display.drawFillCircle === 'function') display.drawFillCircle(W - 40, 26, 8, rgb(240, 230, 255));
    var x = 0;
    while (x < W) {
      var bw = 8 + Math.floor(rnd() * 18);
      var bh = 8 + Math.floor(rnd() * 28);
      rect(x, HY - bh, bw, bh, rgb(14, 8, 34));
      var wy, wx;
      for (wy = HY - bh + 3; wy < HY - 3; wy += 5) {
        for (wx = x + 2; wx < x + bw - 2; wx += 4) {
          if (rnd() < 0.3) rect(wx, wy, 2, 2, rnd() < 0.5 ? rgb(255, 220, 90) : rgb(0, 220, 255));
        }
      }
      x += bw + Math.floor(rnd() * 3);
    }
  }

  // ---------- car sprite (rear view, solid: no gaps between parts) ----------
  function box(x1, y1, x2, y2, c) {
    var a = Math.floor(x1), b = Math.floor(y1), e = Math.floor(x2), d = Math.floor(y2);
    if (e <= a || d <= b) return;
    rect(a, b, e - a, d - b, c);
  }

  function drawCar(cx, yb, w, col, glow, big) {
    if (w < 5) return;
    var h = w * 0.5;
    var body = rgb(col[0], col[1], col[2]);
    var dark = rgb(col[0] * 0.55, col[1] * 0.55, col[2] * 0.55);
    var tireC = rgb(12, 12, 14), floorC = rgb(8, 8, 12);
    var L = cx - w * 0.5, R = cx + w * 0.5;
    // underbody fills the space between the wheels
    box(cx - w * 0.46, yb - h * 0.40, cx + w * 0.46, yb, floorC);
    box(L, yb - h * 0.42, L + w * 0.18, yb, tireC);
    box(R - w * 0.18, yb - h * 0.42, R, yb, tireC);
    // body
    box(cx - w * 0.48, yb - h * 0.78, cx + w * 0.48, yb - h * 0.36, body);
    box(cx - w * 0.48, yb - h * 0.42, cx + w * 0.48, yb - h * 0.36, dark);
    // cabin + rear window
    box(cx - w * 0.34, yb - h * 1.05, cx + w * 0.34, yb - h * 0.78, dark);
    box(cx - w * 0.29, yb - h * 1.0, cx + w * 0.29, yb - h * 0.8, rgb(25, 35, 60));
    // tail lights
    box(cx - w * 0.45, yb - h * 0.7, cx - w * 0.24, yb - h * 0.52, C_RED);
    box(cx + w * 0.24, yb - h * 0.7, cx + w * 0.45, yb - h * 0.52, C_RED);
    if (big) {
      box(cx - w * 0.5, yb - h * 0.92, cx + w * 0.5, yb - h * 0.82, dark);
      box(cx - w * 0.1, yb - h * 0.58, cx + w * 0.1, yb - h * 0.46, rgb(240, 240, 240));
    }
    if (glow) box(cx - w * 0.58, yb - h * 0.1, cx + w * 0.58, yb + 1, rgb(glow[0], glow[1], glow[2]));
  }

  function glowCol() { return NEON[neon][1]; }

  // ---------- flicker-free road renderer ----------
  var prevList = [], prevMap = {};

  function invalidate() {
    var r;
    for (r = 0; r < N; r++) { cPar[r] = -1; cCx[r] = -9999; }
    prevList = []; prevMap = {};
  }

  function span(x1, x2, y, c) {
    if (x1 < 0) x1 = 0;
    if (x2 > W) x2 = W;
    if (x2 > x1) rect(x1, y, x2 - x1, S, c);
  }

  // every pixel of a row is written exactly once (no overdraw = no flicker)
  // border = solid rumble band + solid white edge line; one dashed centre line
  function drawRow(r) {
    var y = RB - (r + 1) * S;
    var par = cPar[r], cx = cCx[r], hw = hws[r];
    var ew = Math.max(1, Math.floor(hw * 0.03));
    var rw = hw * 1.10 + 2;
    var g = par ? GRASS1 : GRASS2, rm = par ? RUM1 : RUM2, rd = par ? ROAD1 : ROAD2;
    var xL = Math.floor(cx - rw), eL = Math.floor(cx - hw), rL = eL + ew;
    var eR = Math.floor(cx + hw), rR = eR - ew, xR = Math.floor(cx + rw);
    span(0, xL, y, g);
    span(xL, eL, y, rm);
    span(eL, rL, y, EDGE);
    if (par) {
      var lw = Math.max(1, Math.floor(hw * 0.03));
      var a2 = cx - Math.floor(lw / 2);
      span(rL, a2, y, rd);
      span(a2, a2 + lw, y, LINE);
      span(a2 + lw, rR, y, rd);
    } else {
      span(rL, rR, y, rd);
    }
    span(rR, eR, y, EDGE);
    span(eR, xR, y, rm);
    span(xR, W, y, g);
  }

  function boxHit(a, b) {
    return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
  }

  function drawSprite(s) {
    if (s.t === 0) {
      rect(s.xs - s.wd / 2, s.yy - s.hg, s.wd, s.hg, rgb(40, 40, 60));
      rect(s.xs - s.wd * 2, s.yy - s.hg, s.wd * 4 + 1, 2 + s.p * 3, s.pc);
    } else {
      drawCar(s.cx, s.yb, s.w, s.col, s.glow, s.big);
    }
  }

  function renderWorld(showPlayer) {
    var r, i, j, k, dxAcc = 0, shift = 0;
    for (r = 0; r < N; r++) {
      if (r > 0) { dxAcc += curveAt(pos + zs[r] - CAM) * 0.17; shift += dxAcc; }
      cxs[r] = W / 2 - playerX * hws[r] + shift;
      cxiN[r] = Math.floor(cxs[r]);
      parN[r] = (Math.floor((pos + zs[r] - CAM) / 28)) & 1;
    }

    // ---- build sprite list (far -> near) ----
    var list = [], p, idx, yy, wd, c, dz, side, xs, hg, pc, zz, dzr, cx;
    var poles = [];
    var base = Math.floor(pos / 60) * 60 + 60;
    for (k = 0; k < 9; k++) {
      zz = base + k * 60;
      dzr = zz - pos + CAM;
      p = ZK / dzr - 0.03;
      if (p < 0.08) break;
      idx = Math.floor((1 - p) * N);
      if (idx < 0) idx = 0;
      if (idx > N - 1) idx = N - 1;
      yy = HY + p * (RB - HY);
      hg = 3 + p * 42;
      wd = 1 + p * 3;
      if (yy - hg < HY) continue;
      pc = POLE_COL[Math.floor(zz / 60) % 3];
      for (side = -1; side <= 1; side += 2) {
        xs = cxs[idx] + side * hws[idx] * 1.38;
        poles.push({ id: "p" + zz + "_" + side, t: 0, xs: xs, yy: yy, hg: hg, wd: wd, p: p, pc: pc, dirty: false,
          x0: Math.floor(xs - wd * 2 - 1), x1: Math.floor(xs + wd * 2 + 2),
          y0: Math.floor(yy - hg - 1), y1: Math.floor(yy) + 1,
          sig: Math.floor(xs) + ":" + Math.floor(yy) + ":" + Math.floor(hg) });
      }
    }
    for (i = poles.length - 1; i >= 0; i--) list.push(poles[i]);

    var cars = [];
    for (i = 0; i < traffic.length; i++) {
      c = traffic[i];
      dz = c.z - pos + CAM;
      if (dz >= 34 && dz < 560) cars.push({ id: "t" + i, dz: dz, x: c.x, col: c.col, glow: null });
    }
    for (i = 0; i < rivals.length; i++) {
      c = rivals[i];
      dz = c.z - pos + CAM;
      if (dz >= 34 && dz < 560) cars.push({ id: "r" + i, dz: dz, x: c.x, col: c.col, glow: c.glow });
    }
    cars.sort(function (a, b) { return b.dz - a.dz; });
    for (i = 0; i < cars.length; i++) {
      c = cars[i];
      p = ZK / c.dz - 0.03;
      if (p < 0.06) continue;
      idx = Math.floor((1 - p) * N);
      if (idx < 0) idx = 0;
      if (idx > N - 1) idx = N - 1;
      yy = HY + p * (RB - HY);
      wd = 4 + p * 44;
      if (yy - wd * 0.52 < HY) continue;
      cx = cxs[idx] + c.x * hws[idx];
      list.push({ id: c.id, t: 1, cx: cx, yb: yy, w: wd, col: c.col, glow: c.glow, big: false, dirty: false,
        x0: Math.floor(cx - wd * 0.62 - 1), x1: Math.floor(cx + wd * 0.62 + 2),
        y0: Math.floor(yy - wd * 0.52 - 1), y1: Math.min(RB, Math.floor(yy) + 1),
        sig: Math.floor(cx) + ":" + Math.floor(yy) + ":" + Math.floor(wd) });
    }
    if (showPlayer) {
      var lean = Math.round(steerV * 22);
      if (lean > 10) lean = 10;
      if (lean < -10) lean = -10;
      var jy = shakeT > 0 ? (shakeT % 2 ? 2 : -2) : 0;
      var pcx = W / 2 + lean;
      list.push({ id: "P", t: 1, cx: pcx, yb: RB - 1 + jy, w: 48, col: PAINT[paint][1], glow: glowCol(), big: true, dirty: false,
        x0: Math.floor(pcx - 32), x1: Math.floor(pcx + 32),
        y0: RB - 31, y1: RB,
        sig: lean + ":" + jy + ":" + paint + ":" + neon });
    }

    // ---- decide which rows need repainting ----
    var rep = [];
    for (r = 0; r < N; r++) rep[r] = (cPar[r] !== parN[r] || cCx[r] !== cxiN[r]);

    function markRows(b) {
      var q, yr;
      for (q = 0; q < N; q++) {
        yr = RB - (q + 1) * S;
        if (b.y0 < yr + S && b.y1 > yr) rep[q] = true;
      }
    }

    var curMap = {}, s, pv;
    for (i = 0; i < list.length; i++) {
      s = list[i];
      curMap[s.id] = s;
      pv = prevMap[s.id];
      if (!pv || pv.sig !== s.sig) {
        s.dirty = true;
        if (pv) markRows(pv);
      }
    }
    for (i = 0; i < prevList.length; i++) {
      if (!curMap[prevList[i].id]) markRows(prevList[i]);
    }

    // sprites touching repainted rows must be redrawn
    for (i = 0; i < list.length; i++) {
      s = list[i];
      if (s.dirty) continue;
      for (r = 0; r < N; r++) {
        if (rep[r]) {
          var yr2 = RB - (r + 1) * S;
          if (s.y0 < yr2 + S && s.y1 > yr2) { s.dirty = true; break; }
        }
      }
    }
    // keep occlusion order: anything nearer that overlaps a redrawn sprite is redrawn too
    for (i = 0; i < list.length; i++) {
      if (!list[i].dirty) continue;
      for (j = i + 1; j < list.length; j++) {
        if (!list[j].dirty && boxHit(list[i], list[j])) list[j].dirty = true;
      }
    }
    // each sprite is drawn right after the last road row it touches
    for (i = 0; i < list.length; i++) {
      var rbm = Math.floor((RB - list[i].y1) / S);
      if (rbm < 0) rbm = 0;
      if (rbm > N - 1) rbm = N - 1;
      list[i].rb = rbm;
    }
    // paint far -> near; the car is put on top the moment its rows are done,
    // so the road is never left showing through it between steps
    clipB = RB;
    for (r = N - 1; r >= 0; r--) {
      if (rep[r]) {
        cPar[r] = parN[r];
        cCx[r] = cxiN[r];
        drawRow(r);
      }
      for (i = 0; i < list.length; i++) {
        if (list[i].dirty && list[i].rb === r) drawSprite(list[i]);
      }
    }
    clipB = H;

    prevList = list;
    prevMap = curMap;
  }

  // ---------- HUD (fixed bars, updated only when values change) ----------
  var hRank = -1, hMid = "", hTime = "", hProg = 0, hKmh = -1, hNFill = -1, hNOn = null, hShake = null;

  // ---------- left-side standings board (small text, positions 1-4 going down) ----------
  var BOARD_BG = rgb(6, 4, 18);
  var hBoard = ["", "", "", ""], hTick = 0;

  function boardInit() {
    rect(0, 15, 72, 40, BOARD_BG);
    hBoard = ["", "", "", ""];
    hTick = 0;
  }

  // leader shows the race clock, everyone else shows how far behind the leader (seconds)
  function updateBoard() {
    hTick++;
    if (hTick % 3 !== 1) return;                 // refresh a few times a second, not every frame
    var e = [{ n: "YOU", z: pos, sp: speed, col: PAINT[paint][1], me: true }];
    var i;
    for (i = 0; i < rivals.length; i++) {
      e.push({ n: "R" + (i + 1), z: rivals[i].z, sp: rivals[i].sp, col: rivals[i].col, me: false });
    }
    e.sort(function (a, b) { return b.z - a.z; });
    var lead = e[0];
    var ls = Math.max(lead.sp, 4);
    for (i = 0; i < e.length && i < 4; i++) {
      var g = (i === 0) ? (raceMs / 1000).toFixed(1) + "s"
                        : "+" + (((lead.z - e[i].z) / ls) * 0.066).toFixed(1) + "s";
      var key = e[i].n + g;
      if (key !== hBoard[i]) {
        hBoard[i] = key;
        var y = 17 + i * 9;
        rect(0, y, 72, 9, BOARD_BG);
        text("" + (i + 1), 2, y + 1, C_WHITE, 1);
        text(e[i].n, 10, y + 1, e[i].me ? C_YEL : rgb(e[i].col[0], e[i].col[1], e[i].col[2]), 1);
        text(g, 34, y + 1, C_WHITE, 1);
      }
    }
  }

  function hudInit() {
    rect(0, 0, W, 13, C_BLACK);
    rect(0, 13, W, 2, rgb(40, 10, 60));
    rect(0, RB, W, BAR, C_BLACK);
    rect(0, RB, W, 1, C_CYAN);
    text("km/h", 46, RB + 9, rgb(150, 150, 170), 1);
    text("N2O", W - 126, RB + 6, C_CYAN, 1);
    rect(W - 96, RB + 5, 90, 8, C_DKBAR);
    hRank = -1; hMid = ""; hTime = ""; hProg = 0; hKmh = -1; hNFill = -1; hNOn = null; hShake = null;
    boardInit();
  }

  function updateHud(rank, lapNow, lapsShown, progress) {
    if (rank !== hRank) {
      hRank = rank;
      rect(0, 0, 60, 13, C_BLACK);
      text("POS " + rank + "/4", 3, 3, C_YEL, 1);
    }
    var mid = lapsShown > 1 ? "LAP " + lapNow + "/" + lapsShown : Math.floor(progress * 100) + "%";
    if (mid !== hMid) {
      hMid = mid;
      rect(W / 2 - 40, 0, 80, 13, C_BLACK);
      ctext(mid, 3, C_CYAN, 1);
    }
    var tm = (raceMs / 1000).toFixed(1) + "s";
    if (tm !== hTime) {
      hTime = tm;
      rect(W - 64, 0, 64, 13, C_BLACK);
      text(tm, W - 60, 3, C_WHITE, 1);
    }
    var pw = Math.floor(W * Math.min(1, progress));
    if (pw > hProg) { rect(hProg, 13, pw - hProg, 2, C_MAG); hProg = pw; }
    var kmh = Math.floor(speed * 6) * 3;
    var sh = shakeT > 0;
    if (kmh !== hKmh || sh !== hShake) {
      hKmh = kmh; hShake = sh;
      rect(0, RB + 1, 44, BAR - 1, C_BLACK);
      text(kmh, 3, RB + 2, sh ? C_RED : C_WHITE, 2);
    }
    var fw = Math.floor(90 * nitro / nitroMax());
    if (fw !== hNFill || nitroOn !== hNOn) {
      hNFill = fw; hNOn = nitroOn;
      rect(W - 96, RB + 5, fw, 8, nitroOn ? C_WHITE : C_CYAN);
      rect(W - 96 + fw, RB + 5, 90 - fw, 8, C_DKBAR);
    }
    updateBoard();
  }

  function initScreen() {
    drawSky();
    hudInit();
    invalidate();
  }

  // ---------- menus ----------
  var menuSel = 0;
  function drawMenu(title, items, sel, showCar) {
    rect(0, 0, W, H, rgb(10, 6, 24));
    rect(0, 0, W, 24, rgb(60, 10, 90));
    rect(0, 24, W, 2, C_CYAN);
    text(title, 8, 5, C_WHITE, 2);
    var n = items.length;
    var lh = Math.min(22, Math.floor((H - 34) / n));
    var avail = W - 16 - (showCar ? 90 : 0);
    var maxl = 0, i;
    for (i = 0; i < n; i++) if (items[i].length > maxl) maxl = items[i].length;
    var sz = (maxl * 12 + 14 <= avail) ? 2 : 1;
    for (i = 0; i < n; i++) {
      var y = 30 + i * lh;
      if (i === sel) {
        rect(4, y - 1, W - 8 - (showCar ? 90 : 0), lh - 2, rgb(0, 90, 140));
        text("> " + items[i], 8, y + (lh - 2 - 8 * sz) / 2, C_YEL, sz);
      } else {
        text("  " + items[i], 8, y + (lh - 2 - 8 * sz) / 2, rgb(200, 200, 220), sz);
      }
    }
    if (showCar) {
      rect(W - 88, 30, 84, 120, rgb(20, 14, 40));
      drawCar(W - 46, 112, 64, PAINT[paint][1], glowCol(), true);
      text("Lv " + (eng + nit + tire), W - 66, 126, C_CYAN, 1);
    }
  }

  function drain() {
    keyboard.getNextPress(); keyboard.getPrevPress();
    keyboard.getSelPress(); keyboard.getEscPress();
  }

  function menu(title, items, sel, showCar) {
    drain();
    var dirty = true;
    while (true) {
      if (dirty) { drawMenu(title, items, sel, showCar); dirty = false; }
      delay(25);
      if (keyboard.getNextPress()) { sel = (sel + 1) % items.length; dirty = true; }
      if (keyboard.getPrevPress()) { sel = (sel + items.length - 1) % items.length; dirty = true; }
      if (keyboard.getSelPress()) { menuSel = sel; return sel; }
      if (keyboard.getEscPress()) { menuSel = sel; return -1; }
    }
  }

  function waitKey() {
    drain();
    while (true) {
      delay(30);
      if (keyboard.getSelPress() || keyboard.getEscPress() || keyboard.getNextPress() || keyboard.getPrevPress()) return;
    }
  }

  function flash(msg, ms) {
    var w = msg.length * 12 + 16;
    rect((W - w) / 2 - 2, H / 2 - 16, w + 4, 32, C_CYAN);
    rect((W - w) / 2, H / 2 - 14, w, 28, C_BLACK);
    text(msg, (W - w) / 2 + 8, H / 2 - 8, C_YEL, 2);
    delay(ms || 700);
  }

  // ---------- garage ----------
  function upLabel(name, lvl) {
    return name + " L" + lvl + (lvl >= 5 ? " MAX" : " $" + COST[lvl]);
  }
  function buy(which) {
    var lvl = which === 0 ? eng : (which === 1 ? nit : tire);
    if (lvl >= 5) { flash("MAXED OUT", 600); return; }
    if (cash < COST[lvl]) { flash("NOT ENOUGH $", 800); return; }
    cash -= COST[lvl];
    if (which === 0) eng++; else if (which === 1) nit++; else tire++;
    save();
    flash("UPGRADED!", 600);
  }
  function garage() {
    var sel = 0;
    while (true) {
      var items = [
        upLabel("Engine", eng), upLabel("Nitro", nit), upLabel("Tires", tire),
        "Paint: " + PAINT[paint][0], "Neon: " + NEON[neon][0], "Back"
      ];
      var r = menu("GARAGE $" + cash, items, sel, true);
      sel = menuSel;
      if (r === -1 || r === 5) { save(); return; }
      if (r <= 2) buy(r);
      else if (r === 3) paint = (paint + 1) % PAINT.length;
      else if (r === 4) neon = (neon + 1) % NEON.length;
    }
  }

  function fmtTime(ms) { return ms > 0 ? (ms / 1000).toFixed(1) + "s" : "--"; }
  function stats() {
    rect(0, 0, W, H, rgb(10, 6, 24));
    rect(0, 0, W, 24, rgb(60, 10, 90));
    rect(0, 24, W, 2, C_CYAN);
    text("STATS", 8, 5, C_WHITE, 2);
    text("Cash: $" + cash, 12, 36, C_YEL, 2);
    text("Rep: " + rep + "   Wins: " + wins + "/" + races, 12, 60, C_WHITE, 1);
    text("Engine L" + eng + "  Nitro L" + nit + "  Tires L" + tire, 12, 76, C_CYAN, 1);
    text("Best Sprint:  " + fmtTime(bestS), 12, 96, C_WHITE, 1);
    text("Best Circuit: " + fmtTime(bestC), 12, 110, C_WHITE, 1);
    text("by da cbm", 12, 150, C_MAG, 1);
    waitKey();
  }

  // ---------- race ----------
  function race(mode) {
    var total = (mode === 1 ? 3 : 2) * lapLen;
    var lapsShown = mode === 1 ? 3 : 1;
    var i, c;
    pos = 0; playerX = 0.65; speed = 0; steerV = 0;
    nitro = nitroMax(); nitroOn = false; raceMs = 0; shakeT = 0;

    traffic = [];
    for (i = 0; i < 8; i++) {
      traffic.push({ z: 320 + i * 140 + Math.random() * 60, x: LANES[rndInt(4)],
        sp: 3 + Math.random() * 2.5, col: PAINT[rndInt(PAINT.length)][1] });
    }
    rivals = [];
    var rt = Math.min(15, 8.6 + rep * 0.4);
    var rx = [-0.75, -0.25, 0.25], rz = [10, 4, -2];
    for (i = 0; i < 3; i++) {
      var pc = rndInt(PAINT.length);
      if (pc === paint) pc = (pc + 1) % PAINT.length;
      rivals.push({ z: rz[i], x: rx[i], tx: rx[i], sp: 0,
        top: rt * (0.92 + Math.random() * 0.08), col: PAINT[pc][1],
        glow: NEON[rndInt(5)][1] });
    }

    initScreen();
    var n;
    for (n = 3; n >= 0; n--) {
      invalidate();
      renderWorld(true);
      updateHud(4, 1, lapsShown, 0);
      if (n > 0) { text("" + n, W / 2 - 18, HY + 22, C_YEL, 6); beep(500, 120); }
      else { ctext("GO!", HY + 26, C_CYAN, 5); beep(900, 250); }
      delay(n > 0 ? 700 : 400);
    }
    invalidate();

    drain();
    var last = now();
    var dtS = 0.7;
    var finished = false;
    while (!finished) {
      var t = now();
      var rawDt = (t - last) / 66;
      last = t;
      if (rawDt > 3) rawDt = 3;
      if (rawDt < 0.05) rawDt = 0.05;
      dtS = dtS * 0.7 + rawDt * 0.3;      // smoothed step = steadier motion
      var dt = dtS;
      raceMs += rawDt * 66;

      // input
      var st = 0.16 + tire * 0.02;
      if (keyboard.getNextPress()) steerV += st;
      if (keyboard.getPrevPress()) steerV -= st;
      if (keyboard.getSelPress()) { if (nitroOn) nitroOn = false; else if (nitro > 8) nitroOn = true; }
      if (keyboard.getEscPress()) {
        var pr = menu("PAUSED", ["Resume", "Save Game", "Quit Race"], 0, false);
        while (pr === 1) { manualSave(); pr = menu("PAUSED", ["Resume", "Save Game", "Quit Race"], 1, false); }
        if (pr === 2) return;
        initScreen(); drain(); last = now();
        continue;
      }

      // player physics
      var maxSp = 9.5 + eng * 1.1;
      var acc = 0.06 + eng * 0.005;
      if (nitroOn && nitro > 0) {
        maxSp *= 1.3 + nit * 0.04;
        acc *= 2.5;
        nitro -= 1.6 * dt;
        if (nitro <= 0) { nitro = 0; nitroOn = false; }
      } else {
        nitroOn = false;
        nitro = Math.min(nitroMax(), nitro + 0.15 * dt);
      }
      var off = Math.abs(playerX) > 1.05;
      if (off) maxSp = Math.min(maxSp, 4);
      speed += (maxSp - speed) * acc * dt * 2;
      if (speed < 0) speed = 0;
      pos += speed * dt;

      playerX += steerV * 0.5 * dt;
      steerV *= Math.pow(0.8, dt);
      playerX -= curveAt(pos) * speed * 0.005 * dt * (1 - tire * 0.06);
      if (playerX > 1.6) { playerX = 1.6; steerV = 0; }
      if (playerX < -1.6) { playerX = -1.6; steerV = 0; }
      if (shakeT > 0) shakeT--;

      // traffic
      for (i = 0; i < traffic.length; i++) {
        c = traffic[i];
        c.z += c.sp * dt;
        if (c.z < pos - 60) {
          c.z = pos + 700 + Math.random() * 500;
          c.x = LANES[rndInt(4)];
          c.sp = 3 + Math.random() * 2.5;
          c.col = PAINT[rndInt(PAINT.length)][1];
        }
        var dzc = c.z - pos;
        if (dzc > -5 && dzc < 8 && Math.abs(c.x - playerX) < 0.33) {
          speed *= 0.45; shakeT = 6; nitroOn = false;
          playerX += (playerX >= c.x ? 0.25 : -0.25);
          c.z += 25;
          beep(150, 80);
        }
      }

      // rivals
      var j;
      for (i = 0; i < rivals.length; i++) {
        c = rivals[i];
        var tp = c.top;
        if (c.z > pos + 600) tp *= 0.9;
        else if (c.z < pos - 200) tp *= 1.08;
        c.sp += (tp - c.sp) * 0.05 * dt;
        c.z += c.sp * dt;
        for (j = 0; j < traffic.length; j++) {
          var dzt = traffic[j].z - c.z;
          if (dzt > 0 && dzt < 70 && Math.abs(traffic[j].x - c.x) < 0.4) {
            c.tx = traffic[j].x < 0 ? 0.75 : -0.75;
          }
        }
        if (c.tx > c.x) c.x = Math.min(c.tx, c.x + 0.03 * dt);
        else c.x = Math.max(c.tx, c.x - 0.03 * dt);
        var dzr = c.z - pos;
        if (dzr > -5 && dzr < 8 && Math.abs(c.x - playerX) < 0.33) {
          speed *= 0.55; c.sp *= 0.6; shakeT = 5; c.z += 14;
          playerX += (playerX >= c.x ? 0.2 : -0.2);
          beep(180, 60);
        }
      }

      // rank
      var rank = 1;
      for (i = 0; i < rivals.length; i++) if (rivals[i].z > pos) rank++;
      var lapNow = Math.min(lapsShown, Math.floor(pos / lapLen) + 1);

      renderWorld(true);
      updateHud(rank, lapNow, lapsShown, pos / total);

      if (pos >= total) finished = true;

      // steady frame pacing (even timing looks smoother than uneven fast/slow frames)
      var el = now() - t;
      if (el < 45) delay(45 - el);
    }

    // result
    var place = 1;
    for (i = 0; i < rivals.length; i++) if (rivals[i].z > pos) place++;
    var pay = [600, 300, 120, 0][place - 1];
    if (mode === 1) pay = Math.floor(pay * 1.6);
    if (place === 1) { pay += rep * 20; rep++; wins++; }
    races++;
    cash += pay;
    var ms = Math.floor(raceMs);
    if (place === 1) {
      if (mode === 1) { if (bestC === 0 || ms < bestC) bestC = ms; }
      else { if (bestS === 0 || ms < bestS) bestS = ms; }
    }
    var sv = save();
    beep(place === 1 ? 1200 : 400, 300);
    flash("FINISH!", 800);

    var names = ["1st", "2nd", "3rd", "4th"];
    rect(0, 0, W, H, rgb(10, 6, 24));
    rect(0, 0, W, 24, place === 1 ? rgb(20, 120, 40) : rgb(90, 20, 40));
    ctext(place === 1 ? "YOU WIN!" : "RACE OVER", 4, C_WHITE, 2);
    rect(0, 24, W, 2, C_CYAN);
    ctext("Place: " + names[place - 1], 40, C_YEL, 3);
    ctext("Time: " + (raceMs / 1000).toFixed(1) + "s", 78, C_WHITE, 2);
    ctext("Prize: $" + pay, 100, C_CYAN, 2);
    ctext("Cash: $" + cash + "   Rep: " + rep, 128, rgb(200, 200, 220), 1);
    ctext(sv ? "Progress saved" : "SAVE FAILED - use Save Game", 140, sv ? rgb(80, 255, 120) : C_RED, 1);
    ctext("by da cbm", 152, C_MAG, 1);
    waitKey();
  }

  // ---------- intro ----------
  function intro() {
    pos = 0; playerX = 0; traffic = []; rivals = [];
    drawSky();
    // title is drawn once on the static sky, so it never flickers
    text("UNDERGROUND", 63, 9, C_MAG, 3);
    text("UNDERGROUND", 61, 7, C_CYAN, 3);
    text("RACER", 117, 33, C_MAG, 3);
    text("RACER", 115, 31, C_YEL, 3);
    rect(0, RB, W, BAR, C_BLACK);
    rect(0, RB, W, 1, C_CYAN);
    text("by da cbm", 6, RB + 6, C_MAG, 1);
    invalidate();
    var f = 0, blink = -1;
    drain();
    while (true) {
      var t0 = now();
      pos += 7; f++;
      playerX = Math.sin(f * 0.05) * 0.3;
      renderWorld(false);
      var b = (Math.floor(f / 8) % 2 === 0) ? 1 : 0;
      if (b !== blink) {
        blink = b;
        rect(W - 110, RB + 1, 110, BAR - 1, C_BLACK);
        if (b) text("PRESS BUTTON", W - 90, RB + 6, C_WHITE, 1);
      }
      if (keyboard.getSelPress() || keyboard.getNextPress() || keyboard.getPrevPress() || keyboard.getEscPress()) return;
      var e0 = now() - t0;
      if (e0 < 45) delay(45 - e0);
    }
  }

  // ---------- main ----------
  load();
  initGeometry(detail ? 2 : 3);
  intro();
  var sel = 0;
  while (true) {
    var r = menu("UNDERGROUND RACER", ["Street Race (Sprint)", "Circuit Race (3 laps)", "Garage", "Stats", "Detail: " + (detail ? "Smooth" : "Fast"), "Save Game", "Exit"], sel, false);
    sel = menuSel;
    if (r === 0) race(0);
    else if (r === 1) race(1);
    else if (r === 2) garage();
    else if (r === 3) stats();
    else if (r === 4) { detail = detail ? 0 : 1; initGeometry(detail ? 2 : 3); save(); }
    else if (r === 5) manualSave();
    else break;
  }
  save();
  rect(0, 0, W, H, C_BLACK);
  ctext("Thanks for racing!", H / 2 - 12, C_CYAN, 2);
  ctext("by da cbm", H / 2 + 14, C_MAG, 1);
  delay(900);
}

main();
