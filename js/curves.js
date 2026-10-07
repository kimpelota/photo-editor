/* ============================================================
   HISTOGRAM + CURVES
   ============================================================ */
// Latest histogram of the rendered photo: 256 bins each for r, g, b and luma.
// SCOPE_M is the rendered photo itself, for the other scopes (scopes.js).
var HIST = null,
  SCOPE_M = null,
  showHisto = true;

function renderHist(m) {
  var H = {
      r: new Float32Array(256),
      g: new Float32Array(256),
      b: new Float32Array(256),
      l: new Float32Array(256)
    },
    d = m.d,
    n = m.w * m.h,
    step = Math.max(1, Math.floor(n / 120000));
  for (var p = 0; p < n; p += step) {
    var i = p * 4,
      r = d[i],
      g = d[i + 1],
      b = d[i + 2];
    H.r[r]++;
    H.g[g]++;
    H.b[b]++;
    H.l[Math.round(.2126 * r + .7152 * g + .0722 * b)]++
  }
  HIST = H;
  SCOPE_M = m;
  drawHisto();
  drawCurve()
}

// Plots a histogram channel into a w×h box, scaled so a single spike can't flatten the rest.
function plotHist(x, bins, w, h, fill) {
  var sorted = Array.prototype.slice.call(bins).sort(function(a, b) {
      return a - b
    }),
    top = Math.max(1, sorted[250] * 1.15);
  x.fillStyle = fill;
  x.beginPath();
  x.moveTo(0, h);
  for (var i = 0; i < 256; i++) x.lineTo(i / 255 * w, h - Math.min(1, bins[i] / top) * h);
  x.lineTo(w, h);
  x.closePath();
  x.fill()
}

/* ---------- curve editor ---------- */
var curveCh = 'rgb',
  CURVE_ID = [
    [0, 0],
    [255, 255]
  ],
  CURVE_COL = {
    rgb: '#f2f2f2',
    r: '#ff5a5a',
    g: '#5ad76a',
    b: '#6a8cff'
  },
  cDrag = null;

function curvePts() {
  var cv = base().curve;
  return cv && cv[curveCh] ? cv[curveCh] : CURVE_ID
}

// Stores points for the active channel, dropping channels that are back to a straight line.
function setCurvePts(pts) {
  var v = base(),
    ident = pts.length === 2 && pts[0][0] === 0 && pts[0][1] === 0 && pts[1][0] === 255 && pts[1][1] === 255;
  v.curve = v.curve || {};
  if (ident) delete v.curve[curveCh];
  else v.curve[curveCh] = pts;
  if (!Object.keys(v.curve).length) delete v.curve;
  presetOn = null
}

var syncCurveCh = seg('#curveCh', 'c', function() {
  return curveCh
}, function(v) {
  curveCh = v;
  syncCurveCh();
  drawCurve()
});

function curveBox() {
  var c = $('#curveC'),
    dpr = window.devicePixelRatio || 1,
    w = c.clientWidth || 280;
  if (c.width !== Math.round(w * dpr)) {
    c.width = Math.round(w * dpr);
    c.height = Math.round(w * dpr)
  }
  return {
    c: c,
    w: w,
    pad: 8,
    dpr: dpr
  }
}

function drawCurve() {
  CURVE_COL.rgb = cssv('--tx');
  var B = curveBox(),
    c = B.c,
    x = c.getContext('2d'),
    w = B.w,
    pad = B.pad,
    s = w - pad * 2;
  if (!c.offsetParent) return;
  x.setTransform(B.dpr, 0, 0, B.dpr, 0, 0);
  x.clearRect(0, 0, w, w);
  x.fillStyle = cssv('--inp');
  x.fillRect(pad, pad, s, s);
  if (HIST) {
    x.save();
    x.translate(pad, pad);
    plotHist(x, HIST[curveCh === 'rgb' ? 'l' : curveCh], s, s, cssv('--sur3'));
    x.restore()
  }
  x.strokeStyle = cssv('--line');
  x.lineWidth = 1;
  for (var i = 1; i < 4; i++) {
    x.beginPath();
    x.moveTo(pad + s * i / 4, pad);
    x.lineTo(pad + s * i / 4, pad + s);
    x.moveTo(pad, pad + s * i / 4);
    x.lineTo(pad + s, pad + s * i / 4);
    x.stroke()
  }
  x.strokeStyle = cssv('--line2');
  x.beginPath();
  x.moveTo(pad, pad + s);
  x.lineTo(pad + s, pad);
  x.stroke();
  // Other channels' curves, faintly, so you can see everything that's set.
  var cv = base().curve || {};
  Object.keys(cv).forEach(function(k) {
    if (k !== curveCh) strokeCurve(x, cv[k], pad, s, CURVE_COL[k], .35)
  });
  var pts = curvePts();
  strokeCurve(x, pts, pad, s, CURVE_COL[curveCh], 1);
  pts.forEach(function(p, i) {
    x.beginPath();
    x.arc(pad + p[0] / 255 * s, pad + s - p[1] / 255 * s, cDrag && cDrag.i === i ? 6 : 4.5, 0, 7);
    x.fillStyle = cDrag && cDrag.i === i && cDrag.out ? '#ff5a6e' : CURVE_COL[curveCh];
    x.fill();
    x.strokeStyle = cssv('--bg');
    x.lineWidth = 1.5;
    x.stroke()
  })
}

function strokeCurve(x, pts, pad, s, col, alpha) {
  var lut = P.curve(pts);
  x.globalAlpha = alpha;
  x.strokeStyle = col;
  x.lineWidth = 2;
  x.beginPath();
  for (var i = 0; i < 256; i++) {
    var px = pad + i / 255 * s,
      py = pad + s - lut[i] / 255 * s;
    i ? x.lineTo(px, py) : x.moveTo(px, py)
  }
  x.stroke();
  x.globalAlpha = 1
}

function curveAt(e) {
  var B = curveBox(),
    r = B.c.getBoundingClientRect(),
    s = B.w - B.pad * 2;
  return {
    x: (e.clientX - r.left - B.pad) / s * 255,
    y: (1 - (e.clientY - r.top - B.pad) / s) * 255,
    s: s
  }
}

$('#curveC').addEventListener('pointerdown', function(e) {
  if (!work) return;
  var q = curveAt(e),
    pts = curvePts().map(function(p) {
      return p.slice()
    }),
    hit = -1,
    best = 12 / q.s * 255;
  pts.forEach(function(p, i) {
    var dd = Math.hypot(p[0] - q.x, p[1] - q.y);
    if (dd < best) {
      best = dd;
      hit = i
    }
  });
  if (hit < 0) {
    var nx = Math.round(Math.max(1, Math.min(254, q.x)));
    if (pts.some(function(p) {
        return Math.abs(p[0] - nx) < 3
      })) return;
    pts.push([nx, Math.round(P.curve(pts)[nx])]);
    pts.sort(function(a, b) {
      return a[0] - b[0]
    });
    hit = pts.findIndex(function(p) {
      return p[0] === nx
    })
  }
  cDrag = {
    i: hit,
    pts: pts,
    out: false
  };
  this.setPointerCapture(e.pointerId);
  setCurvePts(pts);
  drawCurve()
});
$('#curveC').addEventListener('pointermove', function(e) {
  if (!cDrag) return;
  var q = curveAt(e),
    pts = cDrag.pts,
    i = cDrag.i,
    end = i === 0 || i === pts.length - 1;
  // Interior points dragged well outside the box get removed on release.
  cDrag.out = !end && (q.y < -30 || q.y > 285 || q.x < -30 || q.x > 285);
  var lo = end ? pts[i][0] : pts[i - 1][0] + 2,
    hi = end ? pts[i][0] : pts[i + 1][0] - 2;
  pts[i] = [Math.round(Math.max(lo, Math.min(hi, q.x))), Math.round(Math.max(0, Math.min(255, q.y)))];
  setCurvePts(cDrag.out ? pts.filter(function(p, j) {
    return j !== i
  }) : pts);
  drawCurve();
  schedule(true)
});
$('#curveC').addEventListener('pointerup', function() {
  if (!cDrag) return;
  var removed = cDrag.out;
  cDrag = null;
  drawCurve();
  schedule();
  push(removed ? 'Curve point removed' : 'Curve ' + (curveCh === 'rgb' ? 'RGB' : curveCh.toUpperCase()));
  presetDirty = true
});
$('#curveC').addEventListener('dblclick', function(e) {
  var q = curveAt(e),
    pts = curvePts(),
    best = 12 / q.s * 255,
    hit = -1;
  pts.forEach(function(p, i) {
    var dd = Math.hypot(p[0] - q.x, p[1] - q.y);
    if (i && i < pts.length - 1 && dd < best) {
      best = dd;
      hit = i
    }
  });
  if (hit < 0) return;
  setCurvePts(pts.filter(function(p, j) {
    return j !== hit
  }));
  push('Curve point removed');
  schedule();
  drawCurve()
});
$('#bCurveReset').onclick = function() {
  if (!base().curve) return;
  delete base().curve;
  push('Reset curves');
  schedule();
  drawCurve()
};

function syncCurves() {
  syncCurveCh();
  drawCurve()
}
