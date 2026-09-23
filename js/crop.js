/* ============================================================
   CROP + STRAIGHTEN
   ============================================================ */
// S.geo.rect is the crop box as fractions of the straightened frame.
// S.geo.crop is a ratio like '4:5': used as the lock while dragging, and as a
// centered crop when there is no rect (that's what the AI editor sets).
// S.geo.lock is 'free' or 'orig' when no ratio string applies.
var CROPS = [
  ['Free', 'free'],
  ['Original', 'orig'],
  ['1:1', '1:1'],
  ['4:5', '4:5'],
  ['3:2', '3:2'],
  ['16:9', '16:9'],
  ['9:16', '9:16']
];

function stageTool() {
  if (tab === 'crop' && work) return CROP_TOOL;
  if (tab === 'masks' && typeof maskTool === 'function') return maskTool();
  return null
}

function cropLock() {
  return S.geo.crop || S.geo.lock || 'orig'
}

// Size of the straightened frame at preview resolution.
function cropFrame() {
  var g = S.geo;
  return P.geoMap(work.w, work.h, {
    rot: g.rot,
    fh: g.fh,
    fv: g.fv,
    ang: g.ang
  }).frame
}

// Pixel aspect ratio the box must keep, or 0 for free.
function lockRatio() {
  var l = cropLock(),
    fr = cropFrame();
  if (l === 'free') return 0;
  if (l === 'orig') return fr[0] / fr[1];
  var p = l.split(':').map(Number);
  return p[0] / p[1]
}

function cropRect() {
  if (S.geo.rect) return S.geo.rect;
  var fr = cropFrame(),
    r = lockRatio();
  if (!S.geo.crop || !r) return {
    x: 0,
    y: 0,
    w: 1,
    h: 1
  };
  var w = 1,
    h = fr[0] / r / fr[1];
  if (h > 1) {
    h = 1;
    w = fr[1] * r / fr[0]
  }
  return {
    x: (1 - w) / 2,
    y: (1 - h) / 2,
    w: w,
    h: h
  }
}

function setCropRect(r) {
  var full = r.x < .001 && r.y < .001 && r.w > .999 && r.h > .999;
  S.geo.rect = full ? null : {
    x: +r.x.toFixed(5),
    y: +r.y.toFixed(5),
    w: +r.w.toFixed(5),
    h: +r.h.toFixed(5)
  }
}

$('#cropC').innerHTML = CROPS.map(function(c) {
  return '<button data-l="' + c[1] + '">' + c[0] + '</button>'
}).join('');
$$('#cropC button').forEach(function(b) {
  b.onclick = function() {
    var l = b.dataset.l;
    if (l === 'free') {
      // Keep the current box, just unlock its shape.
      if (!S.geo.rect && S.geo.crop) setCropRect(cropRect());
      S.geo.crop = null;
      S.geo.lock = 'free'
    } else {
      S.geo.crop = l === 'orig' ? null : l;
      S.geo.lock = l === 'orig' ? 'orig' : undefined;
      S.geo.rect = null
    }
    push('Crop ' + b.textContent);
    geoChanged()
  }
});

$('#rotC').innerHTML = '<button data-r="-90">&#8634; Rotate left</button><button data-r="90">&#8635; Rotate right</button><button data-f="fh">&#8646; Flip H</button><button data-f="fv">&#8645; Flip V</button>';
$$('#rotC button').forEach(function(b) {
  b.onclick = function() {
    var r = S.geo.rect;
    if (b.dataset.r) {
      S.geo.rot = (S.geo.rot + +b.dataset.r + 360) % 360;
      // The frame changes shape, so fall back to a centered box of the same ratio.
      S.geo.rect = null;
      push('Rotate ' + b.dataset.r + '°')
    } else {
      S.geo[b.dataset.f] = !S.geo[b.dataset.f];
      // Mirror the crop box with the photo.
      if (r) {
        if (b.dataset.f === 'fh') r.x = 1 - r.x - r.w;
        else r.y = 1 - r.y - r.h
      }
      push(b.dataset.f === 'fh' ? 'Flip horizontal' : 'Flip vertical')
    }
    geoChanged()
  }
});

mkSlider($('#straightS'), {
  label: 'Straighten',
  min: -45,
  max: 45,
  step: .1,
  fmt: function(v) {
    return (v > 0 ? '+' : '') + (+v).toFixed(1) + '°'
  },
  get: function() {
    return S.geo.ang || 0
  },
  set: function(v) {
    S.geo.ang = v || 0
  },
  commit: function(v) {
    push('Straighten ' + (+v).toFixed(1) + '°');
    geoChanged()
  }
});

$('#bCropReset').onclick = function() {
  var g = S.geo;
  if (!g.rect && !g.crop && !g.ang && !g.lock) return;
  g.rect = null;
  g.crop = null;
  g.lock = undefined;
  g.ang = 0;
  push('Reset crop');
  geoChanged()
};
$('#bCropDone').onclick = function() {
  $('.tab[data-t="adjust"]').click()
};

function syncCrop() {
  var l = cropLock();
  $$('#cropC button').forEach(function(b) {
    b.classList.toggle('on', b.dataset.l === l)
  });
  var g = S.geo,
    d = work ? P.geoMap(full.w, full.h, g) : null;
  $('#cropInfo').innerHTML = d ? 'Output <b>' + d.w + ' × ' + d.h + '</b> px' + (g.ang ? ' · straightened ' + (g.ang > 0 ? '+' : '') + g.ang.toFixed(1) + '°' : '') : ''
}

/* ---------- the crop box on the stage ---------- */
var cropDrag = null;

// Crop box in screen coordinates.
function cropScreen(R) {
  var r = cropRect();
  return {
    x: R.x + r.x * R.w,
    y: R.y + r.y * R.h,
    w: r.w * R.w,
    h: r.h * R.h
  }
}

// Which part of the box is under the pointer: corner (nw/ne/sw/se), edge (n/s/e/w), inside (move) or null.
function cropHit(e, R) {
  var b = cropScreen(R),
    x = e.offsetX,
    y = e.offsetY,
    t = 14,
    nearL = Math.abs(x - b.x) < t,
    nearR = Math.abs(x - b.x - b.w) < t,
    nearT = Math.abs(y - b.y) < t,
    nearB = Math.abs(y - b.y - b.h) < t,
    inX = x > b.x - t && x < b.x + b.w + t,
    inY = y > b.y - t && y < b.y + b.h + t;
  if (!inX || !inY) return null;
  var v = nearT ? 'n' : nearB ? 's' : '',
    h = nearL ? 'w' : nearR ? 'e' : '';
  if (v || h) return v + h;
  return 'move'
}

var CURSORS = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  move: 'move'
};

var CROP_TOOL = {
  cursor: function(e, R) {
    return CURSORS[cropHit(e, R)] || 'crosshair'
  },
  down: function(e, R) {
    var h = cropHit(e, R);
    if (!h) return false;
    var r = cropRect();
    cropDrag = {
      h: h,
      r0: {
        x: r.x,
        y: r.y,
        w: r.w,
        h: r.h
      },
      x0: e.offsetX,
      y0: e.offsetY
    };
    return true
  },
  move: function(e, R) {
    if (!cropDrag) return;
    var d = cropDrag,
      r0 = d.r0,
      dx = (e.offsetX - d.x0) / R.w,
      dy = (e.offsetY - d.y0) / R.h;
    setCropRect(d.h === 'move' ? moveRect(r0, dx, dy) : resizeRect(r0, d.h, dx, dy))
  },
  up: function() {
    if (!cropDrag) return;
    cropDrag = null;
    push('Crop');
    geoChanged()
  },
  draw: function(x, R) {
    var b = cropScreen(R),
      dpr = 1;
    x.save();
    x.fillStyle = 'rgba(6,7,10,.62)';
    x.beginPath();
    x.rect(R.x, R.y, R.w, R.h);
    x.rect(b.x, b.y, b.w, b.h);
    x.fill('evenodd');
    x.strokeStyle = 'rgba(255,255,255,.35)';
    x.lineWidth = 1;
    x.beginPath();
    for (var i = 1; i < 3; i++) {
      x.moveTo(b.x + b.w * i / 3, b.y);
      x.lineTo(b.x + b.w * i / 3, b.y + b.h);
      x.moveTo(b.x, b.y + b.h * i / 3);
      x.lineTo(b.x + b.w, b.y + b.h * i / 3)
    }
    x.stroke();
    x.strokeStyle = '#fff';
    x.lineWidth = 1.5 * dpr;
    x.strokeRect(b.x, b.y, b.w, b.h);
    // Corner and edge handles.
    x.lineWidth = 4;
    x.lineCap = 'square';
    var L = Math.min(22, b.w / 3, b.h / 3);
    [
      [b.x, b.y, 1, 1],
      [b.x + b.w, b.y, -1, 1],
      [b.x, b.y + b.h, 1, -1],
      [b.x + b.w, b.y + b.h, -1, -1]
    ].forEach(function(c) {
      x.beginPath();
      x.moveTo(c[0], c[1] + c[3] * L);
      x.lineTo(c[0], c[1]);
      x.lineTo(c[0] + c[2] * L, c[1]);
      x.stroke()
    });
    x.lineWidth = 3;
    x.beginPath();
    x.moveTo(b.x + b.w / 2 - 10, b.y);
    x.lineTo(b.x + b.w / 2 + 10, b.y);
    x.moveTo(b.x + b.w / 2 - 10, b.y + b.h);
    x.lineTo(b.x + b.w / 2 + 10, b.y + b.h);
    x.moveTo(b.x, b.y + b.h / 2 - 10);
    x.lineTo(b.x, b.y + b.h / 2 + 10);
    x.moveTo(b.x + b.w, b.y + b.h / 2 - 10);
    x.lineTo(b.x + b.w, b.y + b.h / 2 + 10);
    x.stroke();
    x.restore()
  }
};

function moveRect(r, dx, dy) {
  return {
    x: Math.max(0, Math.min(1 - r.w, r.x + dx)),
    y: Math.max(0, Math.min(1 - r.h, r.y + dy)),
    w: r.w,
    h: r.h
  }
}

// Resizes from handle `h`, keeping the opposite side (or corner) fixed and the ratio locked if set.
function resizeRect(r, h, dx, dy) {
  var fr = cropFrame(),
    ratio = lockRatio(),
    k = ratio ? ratio * fr[1] / fr[0] : 0, // locked w/h in normalized units
    MIN = .04,
    L = r.x,
    T = r.y,
    Rr = r.x + r.w,
    B = r.y + r.h;
  if (h.indexOf('w') >= 0) L = Math.max(0, Math.min(Rr - MIN, L + dx));
  if (h.indexOf('e') >= 0) Rr = Math.min(1, Math.max(L + MIN, Rr + dx));
  if (h.indexOf('n') >= 0) T = Math.max(0, Math.min(B - MIN, T + dy));
  if (h.indexOf('s') >= 0) B = Math.min(1, Math.max(T + MIN, B + dy));
  var w = Rr - L,
    hh = B - T;
  if (!k) return {
    x: L,
    y: T,
    w: w,
    h: hh
  };
  var horiz = /[ew]/.test(h),
    vert = /[ns]/.test(h);
  // Corners follow whichever side moved more; edges drive the other side from the center.
  if (horiz && vert) {
    if (w / k > hh) hh = w / k;
    else w = hh * k
  } else if (horiz) hh = w / k;
  else w = hh * k;
  // Fit inside the frame, shrinking both sides together.
  var ax = h.indexOf('w') >= 0 ? r.x + r.w : h.indexOf('e') >= 0 ? r.x : r.x + r.w / 2,
    ay = h.indexOf('n') >= 0 ? r.y + r.h : h.indexOf('s') >= 0 ? r.y : r.y + r.h / 2,
    maxW = h.indexOf('w') >= 0 ? ax : h.indexOf('e') >= 0 ? 1 - ax : 2 * Math.min(ax, 1 - ax),
    maxH = h.indexOf('n') >= 0 ? ay : h.indexOf('s') >= 0 ? 1 - ay : 2 * Math.min(ay, 1 - ay),
    sc = Math.min(1, maxW / w, maxH / hh);
  w *= sc;
  hh *= sc;
  return {
    x: h.indexOf('w') >= 0 ? ax - w : h.indexOf('e') >= 0 ? ax : ax - w / 2,
    y: h.indexOf('n') >= 0 ? ay - hh : h.indexOf('s') >= 0 ? ay : ay - hh / 2,
    w: w,
    h: hh
  }
}
