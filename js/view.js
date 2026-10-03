/* ============================================================
   RENDER SCHEDULING + VIEW
   ============================================================ */
var busy = false,
  dirty = false,
  dirtyFast = true,
  refineT = null,
  proxyC = document.createElement('canvas');

function putC(c, m) {
  c.width = m.w;
  c.height = m.h;
  c.getContext('2d').putImageData(new ImageData(m.d, m.w, m.h), 0, 0)
}

// schedule(true) is for continuous input (slider drags): it renders the
// small proxy image for instant feedback, then refines at preview size once
// the input settles.
function schedule(fast) {
  if (!work) return;
  clearTimeout(refineT);
  if (busy) {
    dirtyFast = dirty ? dirtyFast && !!fast : !!fast;
    dirty = true;
    // A newer edit makes a running AI upscale stale; stop it and start over.
    aiCancel();
    return
  }
  var st = vstate(),
    up = upView(),
    ai = up && isAI(st.up.k),
    useProxy = !!fast && !up && !!proxy,
    // The AI preview upscales the preview-size image; export does full resolution.
    // Phones preview a non-AI upscale on the preview-size image too; a full-size
    // upscale on every change is more memory than iPhone Safari allows.
    upFull = up && !ai && !LOWMEM,
    key = upFull ? 'full' : useProxy ? 'proxy' : 'work';
  // While cropping, show the whole straightened frame so the crop box can move anywhere.
  if (tab === 'crop') {
    st = clone(st);
    st.geo.crop = null;
    st.geo.rect = null
  }
  busy = true;
  dirty = false;
  if (useProxy) refineT = setTimeout(function() {
    schedule()
  }, 220);
  var geoKey = upFull ? 'full' : 'work';
  $('#busyT').textContent = up ? 'Upscaling ' + st.up.f + '×…' : 'Rendering…';
  $('#upProg i').style.width = '';
  var bt = setTimeout(function() {
    $('#busy').classList.add('on');
    if (up) $('#upProg').classList.add('on')
  }, 120);
  var bk = geoKey + JSON.stringify(st.geo);
  if (bk !== beforeKey) {
    beforeKey = bk;
    putC(beforeC, P.geo(geoKey === 'full' ? full : work, st.geo))
  }
  job({
    type: 'render',
    key: key,
    st: st,
    up: up && !ai
  }).then(function(r) {
    return ai ? aiUpscaleCached(r, st, 'work', function(p, label) {
      $('#busyT').textContent = label;
      $('#upProg').classList.add('on');
      $('#upProg i').style.width = Math.round(p * 100) + '%'
    }) : r
  }).then(function(r) {
    if (useProxy) {
      // Stretch the proxy to preview size so zoom, split and loupe keep working.
      putC(proxyC, r);
      afterC.width = beforeC.width;
      afterC.height = beforeC.height;
      var ax = afterC.getContext('2d');
      ax.imageSmoothingQuality = 'high';
      ax.drawImage(proxyC, 0, 0, afterC.width, afterC.height)
    } else putC(afterC, r);
    afterUp = up;
    renderHist(r);
    updDims();
    draw()
  }).catch(function(e) {
    if (isAbort(e)) return;
    console.error(e);
    toast((ai ? 'AI upscale failed: ' : 'Render failed: ') + e.message)
  }).then(function() {
    clearTimeout(bt);
    busy = false;
    if (dirty) schedule(dirtyFast);
    else {
      $('#busy').classList.remove('on');
      $('#upProg').classList.remove('on')
    }
  })
}
var view = $('#view'),
  vctx = view.getContext('2d'),
  stage = $('#stage'),
  loupe = $('#loupe'),
  lctx = loupe.getContext('2d');

function layout() {
  var r = stage.getBoundingClientRect(),
    cw = r.width,
    ch = r.height,
    iw = afterC.width,
    ih = afterC.height,
    sm = cw < 560, // phones: smaller margins so the photo gets more of the screen
    fit = Math.min((cw - (sm ? 16 : 60)) / iw, (ch - (sm ? 60 : 110)) / ih),
    s = zoom === 'fit' ? fit : zoom;
  var dw = iw * s,
    dh = ih * s;
  // Keep the photo on screen: centred when it fits, edges no further in than a small margin.
  var mx = Math.max(0, (dw - cw) / 2 + 40),
    my = Math.max(0, (dh - (ch - 40)) / 2 + 40);
  pan.x = Math.max(-mx, Math.min(mx, pan.x));
  pan.y = Math.max(-my, Math.min(my, pan.y));
  return {
    x: (cw - dw) / 2 + pan.x,
    y: (ch - 40 - dh) / 2 + pan.y,
    w: dw,
    h: dh,
    s: s,
    fit: fit,
    cw: cw,
    ch: ch
  }
}

// A stage tool (crop box, mask brush...) gets first claim on pointer input
// and draws its overlay on top of the photo. See tool() in crop.js/masks.js.
function tool() {
  return typeof stageTool === 'function' ? stageTool() : null
}

function cmpOn() {
  var T = tool();
  if (T && !T.noTool) return false;
  return showSplit && (afterUp || hasEdits(vstate()))
}

function draw() {
  var dpr = window.devicePixelRatio || 1,
    r = stage.getBoundingClientRect();
  if (view.width !== Math.round(r.width * dpr) || view.height !== Math.round(r.height * dpr)) {
    view.width = Math.round(r.width * dpr);
    view.height = Math.round(r.height * dpr)
  }
  vctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  vctx.clearRect(0, 0, r.width, r.height);
  if (!afterC.width) return;
  var R = layout();
  vctx.save();
  vctx.shadowColor = 'rgba(0,0,0,.55)';
  vctx.shadowBlur = 30;
  vctx.shadowOffsetY = 8;
  vctx.fillStyle = '#000';
  vctx.fillRect(R.x, R.y, R.w, R.h);
  vctx.restore();
  vctx.imageSmoothingEnabled = R.s < 2;
  vctx.imageSmoothingQuality = 'high';
  vctx.drawImage(afterC, R.x, R.y, R.w, R.h);
  var cmp = cmpOn(),
    tb = $('#tagB'),
    ta = $('#tagA');
  if (cmp) {
    var sx = R.x + R.w * split;
    vctx.save();
    vctx.beginPath();
    vctx.rect(R.x, R.y, Math.max(0, sx - R.x), R.h);
    vctx.clip();
    vctx.imageSmoothingEnabled = true;
    vctx.drawImage(beforeC, R.x, R.y, R.w, R.h);
    vctx.restore();
    var top = Math.max(R.y, 0),
      bot = Math.min(R.y + R.h, R.ch);
    vctx.fillStyle = '#fff';
    vctx.fillRect(sx - 1, top, 2, bot - top);
    var hy = (top + bot) / 2;
    vctx.beginPath();
    vctx.arc(sx, hy, 17, 0, 7);
    vctx.fillStyle = '#fff';
    vctx.shadowColor = 'rgba(0,0,0,.4)';
    vctx.shadowBlur = 10;
    vctx.fill();
    vctx.shadowBlur = 0;
    vctx.fillStyle = '#111';
    vctx.beginPath();
    vctx.moveTo(sx - 10, hy);
    vctx.lineTo(sx - 4, hy - 5);
    vctx.lineTo(sx - 4, hy + 5);
    vctx.fill();
    vctx.beginPath();
    vctx.moveTo(sx + 10, hy);
    vctx.lineTo(sx + 4, hy - 5);
    vctx.lineTo(sx + 4, hy + 5);
    vctx.fill();
    tb.style.display = ta.style.display = 'block';
    tb.style.left = Math.max(8, R.x + 10) + 'px';
    tb.style.top = Math.max(8, R.y + 10) + 'px';
    ta.style.left = 'auto';
    ta.style.right = Math.max(8, R.cw - (R.x + R.w) + 10) + 'px';
    ta.style.top = Math.max(8, R.y + 10) + 'px';
    tb.textContent = afterUp ? 'Original · ' + beforeC.width + '×' + beforeC.height : 'Before';
    ta.textContent = afterUp ? 'Upscaled ' + vstate().up.f + '× · ' + afterC.width + '×' + afterC.height : 'After';
    tb.style.opacity = split < .12 ? 0 : 1;
    ta.style.opacity = split > .88 ? 0 : 1
  } else tb.style.display = ta.style.display = 'none';
  var T = tool();
  if (T) T.draw(vctx, R);
  $('#zl').textContent = Math.round(R.s * 100) + '%';
  $$('.zbar [data-z]').forEach(function(b) {
    b.classList.toggle('on', b.dataset.z === 'fit' ? zoom === 'fit' : Math.abs(R.s - b.dataset.z) < .005)
  });
  $('#zOut').disabled = R.s <= zMin(R) + 1e-6;
  $('#zIn').disabled = R.s >= Z_MAX - 1e-6
}

function updDims() {
  var st = vstate(),
    el = $('#dims');
  if (!work) {
    el.textContent = '';
    return
  }
  if (afterUp) el.innerHTML = '<b>' + beforeC.width + '×' + beforeC.height + '</b> → <em>' + afterC.width + '×' + afterC.height + '</em> · ' + UPK_NAME[st.up.k] + (isAI(st.up.k) ? ' · preview' : ' + detail');
  else {
    el.innerHTML = '<b>' + afterC.width + '×' + afterC.height + '</b> preview' + (st.up.on ? ' · exports at <em>' + st.up.f + '×</em>' : '')
  }
}

/* pointer: split drag, pan, wheel zoom, loupe */
var drag = null,
  touches = {},
  pinch = null;

function pinchInfo() {
  var p = Object.keys(touches).map(function(k) {
    return touches[k]
  });
  return {
    d: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1,
    x: (p[0].x + p[1].x) / 2,
    y: (p[0].y + p[1].y) / 2
  }
}
view.addEventListener('pointerdown', function(e) {
  if (!afterC.width) return;
  // Two fingers on a touch screen: pinch to zoom, move both to pan.
  if (e.pointerType === 'touch') {
    touches[e.pointerId] = {
      x: e.offsetX,
      y: e.offsetY
    };
    if (Object.keys(touches).length === 2) {
      if (drag && drag.t === 'tool') drag.T.up(e, layout());
      drag = null;
      pinch = pinchInfo();
      view.setPointerCapture(e.pointerId);
      return
    }
  }
  var R = layout(),
    mx = e.offsetX,
    sx = R.x + R.w * split,
    T = tool();
  if (T && T.down(e, R)) {
    drag = {
      t: 'tool',
      T: T
    };
    view.setPointerCapture(e.pointerId);
    loupe.style.display = 'none';
    return
  }
  if (cmpOn() && Math.abs(mx - sx) < 18 && e.offsetY > R.y && e.offsetY < R.y + R.h) drag = {
    t: 'split'
  };
  else if (R.w > R.cw - 40 || R.h > R.ch - 60) drag = {
    t: 'pan',
    x: e.clientX,
    y: e.clientY,
    px: pan.x,
    py: pan.y
  };
  else if (cmpOn() && e.offsetX > R.x && e.offsetX < R.x + R.w) {
    drag = {
      t: 'split'
    };
    split = Math.max(0, Math.min(1, (mx - R.x) / R.w));
    draw()
  }
  if (drag) {
    view.setPointerCapture(e.pointerId);
    loupe.style.display = 'none'
  }
});
view.addEventListener('pointermove', function(e) {
  if (touches[e.pointerId]) touches[e.pointerId] = {
    x: e.offsetX,
    y: e.offsetY
  };
  if (pinch && Object.keys(touches).length === 2) {
    var q = pinchInfo(),
      R0 = layout();
    pan.x += q.x - pinch.x;
    pan.y += q.y - pinch.y;
    zoomAt(R0.s * q.d / pinch.d, q.x, q.y);
    pinch = q;
    return
  }
  var R = layout();
  if (drag && drag.t === 'tool') {
    drag.T.move(e, R);
    draw();
    return
  }
  if (drag) {
    if (drag.t === 'split') {
      split = Math.max(0, Math.min(1, (e.offsetX - R.x) / R.w))
    } else {
      pan.x = drag.px + e.clientX - drag.x;
      pan.y = drag.py + e.clientY - drag.y;
      view.style.cursor = 'grabbing'
    }
    draw();
    return
  }
  var T = tool();
  if (T && !T.noTool) {
    view.style.cursor = T.cursor(e, R);
    loupe.style.display = 'none';
    if (T.hover) {
      T.hover(e, R);
      draw()
    }
    return
  }
  var sx = R.x + R.w * split;
  view.style.cursor = cmpOn() && Math.abs(e.offsetX - sx) < 18 ? 'ew-resize' : (R.w > R.cw - 40 || R.h > R.ch - 60) ? 'grab' : 'default';
  doLoupe(e.offsetX, e.offsetY, R)
});
function pointerEnd(e) {
  delete touches[e.pointerId];
  if (pinch) {
    if (Object.keys(touches).length < 2) pinch = null;
    return
  }
  if (drag && drag.t === 'tool') drag.T.up(e, layout());
  if (drag && drag.t === 'pan') view.style.cursor = 'grab';
  drag = null
}
view.addEventListener('pointerup', pointerEnd);
view.addEventListener('pointercancel', pointerEnd);
view.addEventListener('pointerleave', function() {
  if (!drag) loupe.style.display = 'none'
});
/* ---- zoom ---- */
var Z_MAX = 8,
  Z_STOPS = [.1, .125, .167, .25, .333, .5, .667, .75, 1, 1.5, 2, 3, 4, 6, 8],
  zAnim = 0;

function zMin(R) {
  return Math.min(R.fit, Z_STOPS[0])
}

// Zoom to `ns`, keeping the photo point under (ax, ay) where it is.
function zoomAt(ns, ax, ay) {
  if (!afterC.width) return;
  var R = layout();
  ns = Math.max(zMin(R), Math.min(Z_MAX, ns));
  if (ax == null) {
    ax = R.cw / 2;
    ay = (R.ch - 40) / 2
  }
  var nx = ax - (ax - R.x) * ns / R.s,
    ny = ay - (ay - R.y) * ns / R.s;
  // Snap back to "Fit" when zooming out lands on it, so the photo re-centres.
  if (Math.abs(ns - R.fit) / R.fit < .02) {
    zoom = 'fit';
    pan = {
      x: 0,
      y: 0
    }
  } else {
    zoom = ns;
    pan.x = nx - (R.cw - afterC.width * ns) / 2;
    pan.y = ny - (R.ch - 40 - afterC.height * ns) / 2
  }
  draw();
  loupe.style.display = 'none'
}

// Animated zoom for buttons, keys and double-click.
function zoomTo(target, ax, ay) {
  if (!afterC.width) return;
  cancelAnimationFrame(zAnim);
  var R = layout(),
    s0 = R.s,
    p0 = {
      x: pan.x,
      y: pan.y
    },
    fitT = target === 'fit' || Math.abs(target - R.fit) / R.fit < .02,
    s1 = fitT ? R.fit : Math.max(zMin(R), Math.min(Z_MAX, target)),
    p1 = {
      x: 0,
      y: 0
    };
  if (!fitT) {
    zoomAt(s1, ax, ay);
    p1 = {
      x: pan.x,
      y: pan.y
    }
  }
  var t0 = performance.now();
  (function step(now) {
    var k = Math.min(1, (now - t0) / 200),
      e = 1 - Math.pow(1 - k, 3);
    zoom = s0 * Math.pow(s1 / s0, e);
    pan = {
      x: p0.x + (p1.x - p0.x) * e,
      y: p0.y + (p1.y - p0.y) * e
    };
    if (k >= 1) {
      zoom = fitT ? 'fit' : s1;
      pan = p1
    } else zAnim = requestAnimationFrame(step);
    draw()
  })(t0);
  loupe.style.display = 'none'
}

function zoomStep(dir) {
  var R = layout(),
    s = R.s,
    stops = Z_STOPS.concat([R.fit]).sort(function(a, b) {
      return a - b
    }),
    next = dir > 0 ? stops.filter(function(x) {
      return x > s * 1.01
    })[0] : stops.filter(function(x) {
      return x < s * .99
    }).pop();
  if (next != null) zoomTo(next)
}
view.addEventListener('dblclick', function(e) {
  if (!afterC.width || tool() && !tool().noTool) return;
  var R = layout();
  // Double-click zooms in on that spot; double-click again goes back to Fit.
  if (R.s <= R.fit * 1.05) zoomTo(Math.max(1, R.fit * 2.5), e.offsetX, e.offsetY);
  else zoomTo('fit')
});
view.addEventListener('wheel', function(e) {
  if (!afterC.width) return;
  e.preventDefault();
  var R = layout(),
    dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY,
    // A mouse wheel moves in big whole steps; a trackpad sends small, smooth ones.
    mouse = e.deltaMode === 1 || (Math.abs(e.deltaY) >= 50 && !e.deltaX && e.deltaY % 1 === 0),
    over = R.w > R.cw - 40 || R.h > R.ch - 60;
  if (e.ctrlKey || e.metaKey) zoomAt(R.s * Math.exp(-dy * .01), e.offsetX, e.offsetY); // trackpad pinch
  else if (mouse || !over) zoomAt(R.s * Math.exp(-dy * .0018), e.offsetX, e.offsetY);
  else {
    // Two-finger scroll moves around a zoomed-in photo.
    pan.x -= e.deltaX;
    pan.y -= dy;
    draw();
    loupe.style.display = 'none'
  }
}, {
  passive: false
});

function doLoupe(mx, my, R) {
  if (!loupeOn || !afterC.width || mx < R.x || my < R.y || mx > R.x + R.w || my > R.y + R.h) {
    loupe.style.display = 'none';
    return
  }
  var lz = afterUp ? 2 : 3;
  if (R.s >= lz * .9) {
    loupe.style.display = 'none';
    return
  }
  var S2 = 240,
    dpr = window.devicePixelRatio || 1;
  if (loupe.width !== S2 * dpr) {
    loupe.width = loupe.height = S2 * dpr
  }
  var ax = (mx - R.x) / R.s,
    ay = (my - R.y) / R.s,
    rw = S2 / lz,
    k = beforeC.width / afterC.width;
  lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  lctx.clearRect(0, 0, S2, S2);
  lctx.save();
  lctx.beginPath();
  lctx.arc(S2 / 2, S2 / 2, S2 / 2, 0, 7);
  lctx.clip();
  lctx.fillStyle = '#0b0c10';
  lctx.fillRect(0, 0, S2, S2);
  lctx.imageSmoothingEnabled = false;
  lctx.drawImage(afterC, ax - rw / 2, ay - rw / 2, rw, rw, 0, 0, S2, S2);
  var half = cmpOn();
  if (half) {
    lctx.save();
    lctx.beginPath();
    lctx.rect(0, 0, S2 / 2, S2);
    lctx.clip();
    lctx.imageSmoothingEnabled = true;
    lctx.imageSmoothingQuality = 'high';
    lctx.fillStyle = '#0b0c10';
    lctx.fillRect(0, 0, S2 / 2, S2);
    lctx.drawImage(beforeC, (ax - rw / 2) * k, (ay - rw / 2) * k, rw * k, rw * k, 0, 0, S2, S2);
    lctx.restore();
    lctx.fillStyle = 'rgba(255,255,255,.9)';
    lctx.fillRect(S2 / 2 - 1, 0, 2, S2);
    lctx.font = '700 9.5px ' + getComputedStyle(document.body).fontFamily;
    lctx.textAlign = 'center';
    [
      ['BEFORE', S2 * .3],
      ['AFTER', S2 * .7]
    ].forEach(function(t) {
      lctx.fillStyle = 'rgba(0,0,0,.6)';
      var tw = lctx.measureText(t[0]).width + 12;
      lctx.fillRect(t[1] - tw / 2, S2 - 40, tw, 17);
      lctx.fillStyle = '#fff';
      lctx.fillText(t[0], t[1], S2 - 28)
    })
  }
  lctx.restore();
  var lx = mx + 24,
    ly = my - S2 - 16;
  if (lx + S2 > R.cw - 8) lx = mx - S2 - 24;
  if (ly < 8) ly = my + 24;
  loupe.style.left = lx + 'px';
  loupe.style.top = ly + 'px';
  loupe.style.display = 'block'
}
new ResizeObserver(function() {
  draw()
}).observe(stage);
$$('.zbar [data-z]').forEach(function(b) {
  b.onclick = function() {
    zoomTo(b.dataset.z === 'fit' ? 'fit' : +b.dataset.z)
  }
});
$('#zIn').onclick = function() {
  zoomStep(1)
};
$('#zOut').onclick = function() {
  zoomStep(-1)
};
$('#zl').onclick = function() {
  zoomTo('fit')
};
$('#bSplit').onclick = function() {
  showSplit = !showSplit;
  this.classList.toggle('on', showSplit);
  draw()
};
$('#bLoupe').onclick = function() {
  loupeOn = !loupeOn;
  this.classList.toggle('on', loupeOn)
};

// Redraw when the photo area changes size: window resizes, phone rotation, the mobile layout.
if (window.ResizeObserver) new ResizeObserver(function() {
  draw()
}).observe(stage);
