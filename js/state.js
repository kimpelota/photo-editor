/* ============================================================
   STATE + HISTORY
   ============================================================ */
var $ = function(s) {
    return document.querySelector(s)
  },
  $$ = function(s) {
    return Array.prototype.slice.call(document.querySelectorAll(s))
  };

function fresh() {
  return {
    geo: {
      rot: 0,
      fh: false,
      fv: false,
      ang: 0,
      crop: null,
      rect: null
    },
    enh: null,
    layers: [{
      t: 'adj',
      v: {}
    }],
    skin: false,
    up: {
      on: false,
      f: 2,
      sharp: 60,
      dn: 35,
      k: 'lanczos'
    }
  }
}

function clone(o) {
  return JSON.parse(JSON.stringify(o))
}
var S = fresh(),
  hist = [],
  hix = -1,
  plan = null,
  full = null,
  work = null,
  proxy = null,
  small = null,
  fileName = '';
var tab = 'enhance',
  split = .5,
  showSplit = true,
  loupeOn = true,
  zoom = 'fit',
  pan = {
    x: 0,
    y: 0
  };
var afterC = document.createElement('canvas'),
  beforeC = document.createElement('canvas'),
  afterUp = false,
  beforeKey = '',
  thumbsDirty = true,
  presetDirty = true;

function push(label) {
  hist.length = hix + 1;
  hist.push({
    label: label,
    s: JSON.stringify(S)
  });
  if (hist.length > 100) hist.shift();
  hix = hist.length - 1;
  if (plan && label.indexOf('AI:') !== 0) {
    plan = null;
    renderPlan()
  }
  syncUI()
}

function goto(i) {
  if (i < 0 || i >= hist.length) return;
  hix = i;
  S = JSON.parse(hist[i].s);
  plan = null;
  renderPlan();
  thumbsDirty = true;
  presetDirty = true;
  syncUI();
  schedule();
  refreshThumbs()
}

function undo() {
  goto(hix - 1)
}

function redo() {
  goto(hix + 1)
}

function base() {
  return S.layers[0].v
}

function vstate() {
  return plan ? plan.st : S
}

function upView() {
  return tab === 'enhance' && vstate().up.on
}

function hasEdits(st) {
  var f = fresh();
  return JSON.stringify([st.geo.crop, st.enh, st.layers, st.skin]) !== JSON.stringify([null, null, f.layers, false]) && !(st.layers.length === 1 && !Object.keys(st.layers[0].v).some(function(k) {
    return st.layers[0].v[k]
  }) && !st.enh && !st.skin)
}

/* ============================================================
   IMAGE LOADING + SAMPLE
   ============================================================ */
// Draws the image at most `cap` pixels on its long edge (or `maxPx` in area).
function raster(src, w, h, cap, maxPx) {
  var k = Math.min(1, cap / Math.max(w, h));
  if (maxPx && w * h * k * k > maxPx) k = Math.sqrt(maxPx / (w * h));
  var c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * k));
  c.height = Math.max(1, Math.round(h * k));
  var x = c.getContext('2d');
  x.imageSmoothingQuality = 'high';
  x.drawImage(src, 0, 0, c.width, c.height);
  var id = x.getImageData(0, 0, c.width, c.height);
  return {
    w: c.width,
    h: c.height,
    d: id.data
  }
}

function setImage(src, w, h, name) {
  full = raster(src, w, h, 1e9, P.MAX_PX);
  work = raster(src, w, h, 1280);
  proxy = raster(src, w, h, 640);
  small = raster(src, w, h, 200);
  sendSrc('full', full);
  sendSrc('work', work);
  sendSrc('proxy', proxy);
  fileName = name;
  $('#fname').textContent = name + '  ·  ' + w + '×' + h + (full.w < w ? '  (editing at ' + full.w + '×' + full.h + ')' : '');
  S = fresh();
  hist = [];
  hix = -1;
  plan = null;
  renderPlan();
  push('Opened ' + name);
  zoom = 'fit';
  pan = {
    x: 0,
    y: 0
  };
  beforeKey = '';
  thumbsDirty = true;
  presetDirty = true;
  afterC.width = 0;
  schedule();
  refreshThumbs()
}

function makeSample() {
  var w = 900,
    h = 560,
    c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  var x = c.getContext('2d'),
    sd = 7,
    rnd = function() {
      sd = (sd * 16807) % 2147483647;
      return sd / 2147483647
    };
  var g = x.createLinearGradient(0, 0, 0, h * .64);
  g.addColorStop(0, '#1b2350');
  g.addColorStop(.38, '#5b3f86');
  g.addColorStop(.72, '#d9707a');
  g.addColorStop(1, '#ffc27a');
  x.fillStyle = g;
  x.fillRect(0, 0, w, h);
  for (var i = 0; i < 140; i++) {
    x.fillStyle = 'rgba(255,255,255,' + (rnd() * .8) + ')';
    x.fillRect(rnd() * w, rnd() * h * .3, 1.2, 1.2)
  }
  var sx = w * .66,
    sy = h * .56;
  g = x.createRadialGradient(sx, sy, 0, sx, sy, w * .35);
  g.addColorStop(0, 'rgba(255,220,150,.9)');
  g.addColorStop(.15, 'rgba(255,170,110,.45)');
  g.addColorStop(1, 'rgba(255,120,90,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, w, h);
  x.fillStyle = '#fff1cf';
  x.beginPath();
  x.arc(sx, sy, 30, 0, 7);
  x.fill();
  for (i = 0; i < 16; i++) {
    x.fillStyle = 'rgba(255,' + (150 + rnd() * 60 | 0) + ',' + (150 + rnd() * 40 | 0) + ',' + (.12 + rnd() * .2) + ')';
    x.beginPath();
    x.ellipse(rnd() * w, h * (.1 + rnd() * .36), 120 + rnd() * 240, 5 + rnd() * 9, 0, 0, 7);
    x.fill()
  }

  function ridge(b, amp, col, seed, rough) {
    x.fillStyle = col;
    x.beginPath();
    x.moveTo(0, h);
    for (var X = 0; X <= w; X += 2) {
      var y = b,
        a = amp,
        f = 1 / 260;
      for (var o = 0; o < 6; o++) {
        y -= Math.abs(Math.sin(X * f + seed * (o + 1) * 1.7)) * a;
        a *= rough;
        f *= 2.13
      }
      x.lineTo(X, y)
    }
    x.lineTo(w, h);
    x.fill()
  }
  ridge(h * .62, 78, '#7c5b90', 1.3, .5);
  ridge(h * .645, 58, '#4d3a6d', 2.7, .55);
  ridge(h * .665, 36, '#2c2445', 4.1, .52);
  var ly = h * .66;
  g = x.createLinearGradient(0, ly, 0, h);
  g.addColorStop(0, '#e89c84');
  g.addColorStop(.3, '#8a5b86');
  g.addColorStop(1, '#1d1d3a');
  x.fillStyle = g;
  x.fillRect(0, ly, w, h - ly);
  for (var y = ly; y < h; y += 2) {
    var t = (y - ly) / (h - ly),
      ww = (20 + t * 110) * (.6 + rnd() * .8);
    x.fillStyle = 'rgba(255,210,150,' + (.55 * (1 - t)) + ')';
    x.fillRect(sx - ww / 2 + (rnd() - .5) * 12, y, ww, 1)
  }
  for (i = 0; i < 300; i++) {
    x.fillStyle = 'rgba(255,255,255,' + (.05 + rnd() * .12) + ')';
    x.fillRect(rnd() * w, ly + Math.pow(rnd(), 1.6) * (h - ly), 8 + rnd() * 40, 1)
  }
  x.fillStyle = '#17142a';
  x.beginPath();
  x.moveTo(0, ly - 6);
  x.quadraticCurveTo(w * .2, ly - 20, w * .44, ly + 4);
  x.lineTo(w * .44, ly + 10);
  x.lineTo(0, ly + 16);
  x.fill();
  var bx = w * .24,
    by = ly - 46;
  x.fillStyle = '#2a2138';
  x.fillRect(bx, by, 74, 40);
  x.fillStyle = '#1d1729';
  x.beginPath();
  x.moveTo(bx - 8, by + 2);
  x.lineTo(bx + 37, by - 26);
  x.lineTo(bx + 82, by + 2);
  x.fill();
  x.fillStyle = '#ffcf7a';
  [
    [10, 10],
    [48, 10]
  ].forEach(function(p) {
    x.fillRect(bx + p[0], by + p[1], 16, 13)
  });
  x.fillStyle = '#2a2138';
  [
    [10, 10],
    [48, 10]
  ].forEach(function(p) {
    x.fillRect(bx + p[0] + 7.3, by + p[1], 1.4, 13);
    x.fillRect(bx + p[0], by + p[1] + 6, 16, 1.2)
  });
  x.fillStyle = '#ffcf7a';
  x.fillRect(bx + 30, by + 22, 12, 18);
  x.fillStyle = '#d9c8a3';
  x.fillRect(bx - 46, by + 18, 40, 14);
  x.fillStyle = '#2a2238';
  x.font = 'bold 8px sans-serif';
  x.fillText('LODGE', bx - 41, by + 28.5);
  x.fillRect(bx - 27, by + 32, 2, 10);
  x.fillStyle = 'rgba(255,207,122,.35)';
  x.fillRect(bx + 10, ly + 8, 16, 3);
  x.fillRect(bx + 48, ly + 8, 16, 3);

  function pine(px, py, s) {
    x.fillStyle = '#0e0c1a';
    x.fillRect(px - 1.5 * s, py - 4 * s, 3 * s, 6 * s);
    for (var k = 0; k < 6; k++) {
      var yy = py - 8 * s - k * 8 * s,
        wd = (17 - k * 2.6) * s;
      x.beginPath();
      x.moveTo(px - wd, yy + 10 * s);
      x.lineTo(px, yy - 7 * s);
      x.lineTo(px + wd, yy + 10 * s);
      x.fill()
    }
  }
  for (i = 0; i < 9; i++) pine(12 + i * 21 + rnd() * 8, ly + 10, .9 + rnd() * .8);
  for (i = 0; i < 6; i++) pine(w - 18 - i * 25 - rnd() * 10, ly + 12, 1 + rnd() * .9);
  x.fillStyle = '#3a2a30';
  x.fillRect(w * .3, ly + 44, w * .22, 5);
  for (i = 0; i < 10; i++) x.fillRect(w * .3 + i * w * .0244, ly + 44, 2.2, 26);
  x.strokeStyle = '#1a1530';
  x.lineWidth = 1.4;
  for (i = 0; i < 7; i++) {
    var bx2 = w * .42 + rnd() * w * .32,
      by2 = h * .18 + rnd() * h * .16,
      s = 4 + rnd() * 4;
    x.beginPath();
    x.moveTo(bx2 - s, by2);
    x.quadraticCurveTo(bx2 - s / 2, by2 - s / 2, bx2, by2);
    x.quadraticCurveTo(bx2 + s / 2, by2 - s / 2, bx2 + s, by2);
    x.stroke()
  }
  var o = document.createElement('canvas');
  o.width = 640;
  o.height = Math.round(640 * h / w);
  var ox = o.getContext('2d');
  ox.imageSmoothingQuality = 'high';
  ox.drawImage(c, 0, 0, o.width, o.height);
  var id = ox.getImageData(0, 0, o.width, o.height),
    d = id.data;
  for (i = 0; i < d.length; i += 4) {
    var n = (rnd() - .5) * 7;
    d[i] = d[i] * .8 + 24 + n;
    d[i + 1] = d[i + 1] * .82 + 24 + n;
    d[i + 2] = d[i + 2] * .84 + 38 + n
  }
  ox.putImageData(id, 0, 0);
  return o
}

function loadSample() {
  var c = makeSample();
  setImage(c, c.width, c.height, 'lakeside-sunset.png')
}

function loadFile(f) {
  if (!f || !/^image\//.test(f.type)) {
    toast('That file isn’t an image');
    return
  }
  var url = URL.createObjectURL(f),
    im = new Image();
  im.onload = function() {
    setImage(im, im.naturalWidth, im.naturalHeight, f.name);
    URL.revokeObjectURL(url);
    toast('Loaded ' + f.name)
  };
  im.onerror = function() {
    toast('Couldn’t read that image');
    URL.revokeObjectURL(url)
  };
  im.src = url
}
