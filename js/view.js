/* ============================================================
   RENDER SCHEDULING + VIEW
   ============================================================ */
var busy = false,
  dirty = false;

function putC(c, m) {
  c.width = m.w;
  c.height = m.h;
  c.getContext('2d').putImageData(new ImageData(m.d, m.w, m.h), 0, 0)
}

function schedule() {
  if (!work) return;
  if (busy) {
    dirty = true;
    return
  }
  busy = true;
  dirty = false;
  var st = vstate(),
    up = upView(),
    key = up ? 'full' : 'work';
  $('#busyT').textContent = up ? 'Upscaling ' + st.up.f + '×…' : 'Rendering…';
  var bt = setTimeout(function() {
    $('#busy').classList.add('on');
    if (up) $('#upProg').classList.add('on')
  }, 120);
  var bk = key + JSON.stringify(st.geo);
  if (bk !== beforeKey) {
    beforeKey = bk;
    putC(beforeC, P.geo(key === 'full' ? full : work, st.geo))
  }
  job({
    type: 'render',
    key: key,
    st: st,
    up: up
  }).then(function(r) {
    putC(afterC, r);
    afterUp = up;
    updDims();
    draw()
  }).catch(function(e) {
    console.error(e);
    toast('Render failed: ' + e.message)
  }).then(function() {
    clearTimeout(bt);
    busy = false;
    if (dirty) schedule();
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
    fit = Math.min((cw - 60) / iw, (ch - 110) / ih),
    s = zoom === 'fit' ? fit : zoom;
  var dw = iw * s,
    dh = ih * s;
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

function cmpOn() {
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
  $('#zl').textContent = Math.round(R.s * 100) + '%';
  $$('.zbar [data-z]').forEach(function(b) {
    b.classList.toggle('on', String(zoom) === b.dataset.z)
  })
}

function updDims() {
  var st = vstate(),
    el = $('#dims');
  if (!work) {
    el.textContent = '';
    return
  }
  if (afterUp) el.innerHTML = '<b>' + beforeC.width + '×' + beforeC.height + '</b> → <em>' + afterC.width + '×' + afterC.height + '</em> · ' + (st.up.k === 'bicubic' ? 'Bicubic' : 'Lanczos-3') + ' + detail';
  else {
    el.innerHTML = '<b>' + afterC.width + '×' + afterC.height + '</b> preview' + (st.up.on ? ' · exports at <em>' + st.up.f + '×</em>' : '')
  }
}

/* pointer: split drag, pan, wheel zoom, loupe */
var drag = null;
view.addEventListener('pointerdown', function(e) {
  if (!afterC.width) return;
  var R = layout(),
    mx = e.offsetX,
    sx = R.x + R.w * split;
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
  var R = layout();
  if (drag) {
    if (drag.t === 'split') {
      split = Math.max(0, Math.min(1, (e.offsetX - R.x) / R.w))
    } else {
      pan.x = drag.px + e.clientX - drag.x;
      pan.y = drag.py + e.clientY - drag.y
    }
    draw();
    return
  }
  var sx = R.x + R.w * split;
  view.style.cursor = cmpOn() && Math.abs(e.offsetX - sx) < 18 ? 'ew-resize' : (R.w > R.cw - 40 || R.h > R.ch - 60) ? 'grab' : 'default';
  doLoupe(e.offsetX, e.offsetY, R)
});
view.addEventListener('pointerup', function() {
  drag = null
});
view.addEventListener('pointerleave', function() {
  if (!drag) loupe.style.display = 'none'
});
view.addEventListener('dblclick', function() {
  zoom = 'fit';
  pan = {
    x: 0,
    y: 0
  };
  draw()
});
view.addEventListener('wheel', function(e) {
  if (!afterC.width) return;
  e.preventDefault();
  var R = layout(),
    ns = Math.max(R.fit * .5, Math.min(8, R.s * Math.exp(-e.deltaY * .0018))),
    mx = e.offsetX,
    my = e.offsetY;
  var nx = mx - (mx - R.x) * ns / R.s,
    ny = my - (my - R.y) * ns / R.s;
  zoom = ns;
  pan.x = nx - (R.cw - afterC.width * ns) / 2;
  pan.y = ny - (R.ch - 40 - afterC.height * ns) / 2;
  draw();
  loupe.style.display = 'none'
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
    zoom = b.dataset.z === 'fit' ? 'fit' : +b.dataset.z;
    pan = {
      x: 0,
      y: 0
    };
    draw()
  }
});
$('#bSplit').onclick = function() {
  showSplit = !showSplit;
  this.classList.toggle('on', showSplit);
  draw()
};
$('#bLoupe').onclick = function() {
  loupeOn = !loupeOn;
  this.classList.toggle('on', loupeOn)
};
