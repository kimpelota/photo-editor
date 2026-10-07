/* ============================================================
   SCOPES: histogram, waveform, RGB parade, vectorscope
   ============================================================ */
// Drawn over the photo from the latest render (HIST and SCOPE_M in curves.js).
var scopeMode = 'hist',
  SCOPE_SIZE = {
    hist: [200, 80],
    wave: [256, 128],
    parade: [256, 128],
    vec: [150, 150]
  };
try {
  scopeMode = SCOPE_SIZE[localStorage.getItem('nuance.scope')] ? localStorage.getItem('nuance.scope') : 'hist'
} catch (e) {}

var syncScopeM = seg('#scopeM', 's', function() {
  return scopeMode
}, function(v) {
  scopeMode = v;
  try {
    localStorage.setItem('nuance.scope', v)
  } catch (e) {}
  drawHisto()
});

function hexRGB(s) {
  var m = /^#([0-9a-f]{6})$/i.exec(s);
  return m ? [0, 2, 4].map(function(i) {
    return parseInt(m[1].substr(i, 2), 16)
  }) : [242, 242, 242]
}

// Visits about 160k pixels of the photo, evenly spread.
function scopeEach(m, f) {
  var s = Math.max(1, Math.round(Math.sqrt(m.w * m.h / 160000))),
    d = m.d,
    n = 0;
  for (var y = 0; y < m.h; y += s)
    for (var x = 0; x < m.w; x += s, n++) {
      var i = (y * m.w + x) * 4;
      f(x, d[i], d[i + 1], d[i + 2])
    }
  return n
}

// Paints counts as a glow: soft where few pixels land, solid where many do.
function scopeImg(W, H, cells, k) {
  var c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  var x = c.getContext('2d'),
    id = x.createImageData(W, H),
    d = id.data;
  cells(function(p, n, col) {
    if (!n) return;
    var o = p * 4;
    d[o] = col[0];
    d[o + 1] = col[1];
    d[o + 2] = col[2];
    d[o + 3] = (1 - Math.exp(-n / k)) * 255
  });
  x.putImageData(id, 0, 0);
  return c
}

function graticule(x, w, h, left, right) {
  x.strokeStyle = cssv('--line2');
  x.lineWidth = 1;
  x.beginPath();
  for (var q = 0; q <= 4; q++) {
    var y = Math.round(4 + (h - 8) * q / 4) + .5;
    x.moveTo(left, y);
    x.lineTo(right, y)
  }
  x.stroke()
}

// Waveform (luma) or parade (R, G, B side by side): x is the photo's x, y is brightness.
function drawWave(x, m, w, h, parade) {
  var np = parade ? 3 : 1,
    gap = parade ? 4 : 0,
    pw = Math.floor((w - gap * (np - 1)) / np),
    H = h - 8,
    G = [],
    p;
  for (p = 0; p < np; p++) G.push(new Float32Array(pw * H));
  var n = scopeEach(m, function(px, r, g, b) {
    var col = Math.min(pw - 1, px * pw / m.w | 0);
    if (parade) {
      G[0][(H - 1 - (r * (H - 1) / 255 | 0)) * pw + col]++;
      G[1][(H - 1 - (g * (H - 1) / 255 | 0)) * pw + col]++;
      G[2][(H - 1 - (b * (H - 1) / 255 | 0)) * pw + col]++
    } else G[0][(H - 1 - ((.2126 * r + .7152 * g + .0722 * b) * (H - 1) / 255 | 0)) * pw + col]++
  });
  var cols = parade ? [
      [255, 80, 80],
      [80, 220, 100],
      [90, 130, 255]
    ] : [hexRGB(cssv('--tx'))],
    k = n / (pw * H) * 1.2;
  for (p = 0; p < np; p++) {
    var left = p * (pw + gap);
    graticule(x, h, h, left, left + pw);
    x.drawImage(scopeImg(pw, H, function(put) {
      for (var i = 0; i < G[p].length; i++) put(i, G[p][i], cols[p])
    }, k), left, 4)
  }
}

// Vectorscope: hue is the angle, saturation the distance from the centre.
// Laid out like a broadcast scope: red up and a little left, blue right.
function drawVec(x, m, S) {
  var R = S / 2,
    sc = S * .95,
    N = new Float32Array(S * S),
    CR = new Float32Array(S * S),
    CG = new Float32Array(S * S),
    CB = new Float32Array(S * S),
    pos = function(r, g, b) {
      var y = .2126 * r + .7152 * g + .0722 * b;
      return [R + (b - y) / 1.8556 / 255 * sc, R - (r - y) / 1.5748 / 255 * sc]
    };
  var n = scopeEach(m, function(px, r, g, b) {
    var q = pos(r, g, b),
      i = Math.min(S - 1, q[1] | 0) * S + Math.min(S - 1, q[0] | 0);
    N[i]++;
    CR[i] += r;
    CG[i] += g;
    CB[i] += b
  });
  x.strokeStyle = cssv('--line2');
  x.lineWidth = 1;
  x.beginPath();
  x.arc(R, R, R - 2, 0, 7);
  x.moveTo(R, 4);
  x.lineTo(R, S - 4);
  x.moveTo(4, R);
  x.lineTo(S - 4, R);
  x.stroke();
  // Skin tones of every complexion sit along this line.
  x.strokeStyle = 'rgba(255,170,120,.6)';
  x.setLineDash([3, 3]);
  x.beginPath();
  x.moveTo(R, R);
  x.lineTo(R + Math.cos(123 * Math.PI / 180) * (R - 4), R - Math.sin(123 * Math.PI / 180) * (R - 4));
  x.stroke();
  x.setLineDash([]);
  // Targets for the 75% primaries and secondaries.
  x.font = '600 8px ' + cssv('--sans');
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  [
    ['R', 191, 0, 0],
    ['Yl', 191, 191, 0],
    ['G', 0, 191, 0],
    ['Cy', 0, 191, 191],
    ['B', 0, 0, 191],
    ['Mg', 191, 0, 191]
  ].forEach(function(t) {
    var q = pos(t[1], t[2], t[3]),
      o = [q[0] - R, q[1] - R],
      l = Math.hypot(o[0], o[1]);
    x.strokeStyle = 'rgb(' + t.slice(1).join(',') + ')';
    x.strokeRect(q[0] - 3.5, q[1] - 3.5, 7, 7);
    x.fillStyle = cssv('--mut');
    x.fillText(t[0], q[0] + o[0] / l * 10, q[1] + o[1] / l * 10)
  });
  x.drawImage(scopeImg(S, S, function(put) {
    for (var i = 0; i < N.length; i++) {
      var c = N[i];
      if (!c) continue;
      // Each dot in its own colour, pushed to full brightness so it reads on the scope.
      var r = CR[i] / c,
        g = CG[i] / c,
        b = CB[i] / c,
        mx = Math.max(r, g, b, 1),
        f = 235 / mx;
      put(i, c, [r * f + 20, g * f + 20, b * f + 20])
    }
  }, n / (S * S) * 2.5), 0, 0)
}

function drawHisto() {
  var box = $('#scope'),
    c = $('#histC');
  box.style.display = showHisto && HIST && work ? 'block' : 'none';
  syncScopeM();
  if (!showHisto || !HIST) return;
  var sz = SCOPE_SIZE[scopeMode],
    w = sz[0],
    h = sz[1],
    dpr = window.devicePixelRatio || 1;
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    c.style.width = w + 'px';
    c.style.height = h + 'px'
  }
  var x = c.getContext('2d');
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  x.clearRect(0, 0, w, h);
  x.imageSmoothingEnabled = true;
  if (scopeMode === 'hist' || !SCOPE_M) {
    x.globalCompositeOperation = 'lighter';
    plotHist(x, HIST.r, w, h, 'rgba(255,70,70,.75)');
    plotHist(x, HIST.g, w, h, 'rgba(70,220,90,.7)');
    plotHist(x, HIST.b, w, h, 'rgba(80,120,255,.8)');
    x.globalCompositeOperation = 'source-over'
  } else if (scopeMode === 'vec') drawVec(x, SCOPE_M, w);
  else drawWave(x, SCOPE_M, w, h, scopeMode === 'parade')
}

$('#bHisto').onclick = function() {
  showHisto = !showHisto;
  this.classList.toggle('on', showHisto);
  drawHisto()
};
