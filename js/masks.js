/* ============================================================
   MASKS PANE — local adjustments
   ============================================================ */
var MASK_TYPES = {
    brush: {
      name: 'Brush',
      tip: 'Paint where the edit should go. Hold Alt (Option) to erase.'
    },
    linear: {
      name: 'Linear gradient',
      tip: 'Drag the handles: full effect at the solid line, fading out by the dashed line. Drag anywhere else to draw a new gradient.'
    },
    radial: {
      name: 'Radial',
      tip: 'Drag the centre to move, the edge dots to resize. Drag anywhere else to draw a new circle.'
    },
    subject: {
      name: 'Subject',
      ai: true,
      tip: 'AI-selected people, animals and objects in front.'
    },
    background: {
      name: 'Background',
      ai: true,
      tip: 'Everything except the AI-selected subject.'
    },
    face: {
      name: 'Face',
      ai: true,
      tip: 'AI-selected faces (up to 8).'
    }
  },
  MASK_ADJ = [
    ['exposure', 'Exposure'],
    ['contrast', 'Contrast'],
    ['highlights', 'Highlights'],
    ['shadows', 'Shadows'],
    ['warmth', 'Warmth'],
    ['tint', 'Tint'],
    ['saturation', 'Saturation'],
    ['clarity', 'Clarity'],
    ['sharpen', 'Sharpen'],
    ['blur', 'Blur', 0]
  ],
  MASK_QUICK = {
    background: [
      ['Blur background', {
        blur: 55
      }],
      ['Darken background', {
        exposure: -35,
        saturation: -20
      }]
    ],
    subject: [
      ['Make subject pop', {
        exposure: 12,
        clarity: 25,
        saturation: 12
      }]
    ],
    face: [
      ['Brighten face', {
        exposure: 22,
        shadows: 20,
        clarity: -10
      }],
      ['Soften skin', {
        clarity: -45,
        sharpen: -20
      }]
    ]
  },
  mSel = 0,
  showOv = false,
  ovFlash = 0,
  brush = {
    size: 12,
    soft: 50,
    erase: false
  };

function masks() {
  return S.masks || (S.masks = [])
}

function selMask() {
  var ms = masks();
  if (mSel >= ms.length) mSel = ms.length - 1;
  return ms[mSel] || null
}

function geoNow() {
  return P.geoMap(work.w, work.h, vstate().geo)
}

// Screen point -> source-image fractions, and back.
function toSrc(e, R) {
  var A = geoNow().m,
    ox = (e.offsetX - R.x) / R.s,
    oy = (e.offsetY - R.y) / R.s;
  return [(A[0] * ox + A[2] * oy + A[4]) / work.w, (A[1] * ox + A[3] * oy + A[5]) / work.h]
}

function toScreen(u, v, R) {
  var A = geoNow().m,
    sx = u * work.w - A[4],
    sy = v * work.h - A[5],
    det = A[0] * A[3] - A[2] * A[1];
  return [R.x + (A[3] * sx - A[2] * sy) / det * R.s, R.y + (-A[1] * sx + A[0] * sy) / det * R.s]
}

function addMask(type) {
  if (!work) return;
  var n = masks().filter(function(m) {
      return m.type === type
    }).length + 1,
    mk = {
      type: type,
      name: MASK_TYPES[type].name + (MASK_TYPES[type].ai || n < 2 ? '' : ' ' + n),
      inv: false,
      amt: 1,
      v: {}
    },
    R = layout();
  if (type === 'radial') {
    var c = toSrc({
      offsetX: R.x + R.w / 2,
      offsetY: R.y + R.h / 2
    }, R);
    mk.cx = c[0];
    mk.cy = c[1];
    mk.rx = .22;
    mk.ry = .22 * work.w / work.h;
    mk.feather = .5
  } else if (type === 'linear') {
    var a = toSrc({
        offsetX: R.x + R.w / 2,
        offsetY: R.y + R.h * .12
      }, R),
      b = toSrc({
        offsetX: R.x + R.w / 2,
        offsetY: R.y + R.h * .5
      }, R);
    mk.x1 = a[0];
    mk.y1 = a[1];
    mk.x2 = b[0];
    mk.y2 = b[1]
  } else if (type === 'brush') mk.strokes = [];
  masks().push(mk);
  mSel = masks().length - 1;
  if (MASK_TYPES[type].ai) {
    mk.pending = true;
    renderMasks();
    runSeg(type === 'face' ? 'face' : 'subject', mk)
  } else {
    push('Added ' + mk.name + ' mask');
    flashOverlay();
    renderMasks();
    schedule()
  }
}

function runSeg(need, mk) {
  var st = $('#segStatus');
  st.hidden = false;
  ensureSeg(need, function(t) {
    st.textContent = t
  }).then(function(sg) {
    st.hidden = true;
    delete mk.pending;
    if (need === 'face' && !sg.faces) {
      // Nothing found (a visor or mask can hide a face completely): hand over a
      // circle the user can drag onto the face instead.
      mk.type = 'radial';
      mk.name = 'Face (placed by hand)';
      mk.cx = .5;
      mk.cy = .3;
      mk.rx = .08;
      mk.ry = .08 * work.w / work.h * 1.25;
      mk.feather = .45;
      toast('I couldn’t find a face. Drag on the face in the photo to place the mask.', 5000)
    } else if (need === 'subject' && !sg.found) toast('No clear subject found. Try a brush or radial mask');
    else toast(need === 'face' ? 'Found ' + sg.faces + ' face' + (sg.faces > 1 ? 's' : '') + (sg.facesEstimated ? ' (' + sg.facesEstimated + ' estimated from the body, e.g. under a helmet)' : '') : 'Subject selected');
    push('Added ' + mk.name + ' mask');
    flashOverlay();
    renderMasks();
    schedule()
  }).catch(function(e) {
    console.error(e);
    st.hidden = true;
    masks().splice(masks().indexOf(mk), 1);
    renderMasks();
    toast('Couldn’t load the AI model. Check your internet connection.')
  })
}

// Shows the red overlay for a moment so you can see what got selected.
function flashOverlay() {
  ovFlash = Date.now() + 1400;
  draw();
  setTimeout(draw, 1450)
}

function ovOn() {
  return showOv || Date.now() < ovFlash || (mDrag && mDrag.t === 'paint')
}

$$('#maskAdd button').forEach(function(b) {
  b.onclick = function() {
    addMask(b.dataset.m)
  }
});
$('#ovSw').onclick = function() {
  showOv = !showOv;
  this.classList.toggle('on', showOv);
  draw()
};

function renderMasks() {
  var ms = masks(),
    el = $('#maskList'),
    sel = selMask();
  $('#maskEmpty').hidden = ms.length > 0;
  el.innerHTML = ms.map(function(m, i) {
    return '<li class="mk' + (m === sel ? ' on' : '') + (m.off ? ' off' : '') + '" data-i="' + i + '"><span class="mt">' + (MASK_TYPES[m.type].ai ? '<i class="ai">AI</i>' : '') + esc(m.name) + (m.pending ? ' <em>finding…</em>' : '') + (m.inv ? ' <em>inverted</em>' : '') + '</span>' +
      '<button class="eye" title="Hide/show">' + (m.off ? '&#9675;' : '&#9679;') + '</button><button class="del" title="Delete">&times;</button></li>'
  }).join('');
  $$('#maskList .mk').forEach(function(li) {
    var i = +li.dataset.i;
    li.onclick = function(e) {
      var m = ms[i];
      if (e.target.classList.contains('del')) {
        ms.splice(i, 1);
        push('Deleted ' + m.name + ' mask')
      } else if (e.target.classList.contains('eye')) {
        m.off = !m.off;
        push((m.off ? 'Hid ' : 'Showed ') + m.name + ' mask')
      } else mSel = i;
      renderMasks();
      schedule()
    }
  });
  var box = $('#maskEdit');
  box.innerHTML = '';
  box.hidden = !sel || !!sel.pending;
  if (!sel || sel.pending) return draw();
  var h = '<p class="mtip">' + esc(MASK_TYPES[sel.type].tip) + '</p>';
  if (sel.type === 'brush') h += '<div class="seg" id="brMode"><button data-b="paint"' + (brush.erase ? '' : ' class="on"') + '>Paint</button><button data-b="erase"' + (brush.erase ? ' class="on"' : '') + '>Erase</button></div><div id="brS"></div>';
  if (MASK_QUICK[sel.type]) h += '<div class="chips mq">' + MASK_QUICK[sel.type].map(function(q, i) {
    return '<button data-q="' + i + '">' + q[0] + '</button>'
  }).join('') + '</div>';
  h += '<div id="mkS"></div><div class="row" style="margin-top:10px"><button class="btn" id="bInv">' + (sel.inv ? 'Un-invert' : 'Invert') + '</button><button class="btn" id="bMkReset">Reset sliders</button>' + (sel.type === 'brush' ? '<button class="btn" id="bBrClear">Clear paint</button>' : '') + '</div>';
  box.innerHTML = h;
  if (sel.type === 'brush') {
    $$('#brMode button').forEach(function(b) {
      b.onclick = function() {
        brush.erase = b.dataset.b === 'erase';
        renderMasks()
      }
    });
    mkSlider($('#brS'), {
      label: 'Brush size',
      min: 1,
      max: 100,
      def: 12,
      get: function() {
        return brush.size
      },
      set: function(v) {
        brush.size = v;
        draw()
      },
      commit: function() {},
      live: false
    }).sync();
    mkSlider($('#brS'), {
      label: 'Softness',
      min: 0,
      max: 100,
      def: 50,
      get: function() {
        return brush.soft
      },
      set: function(v) {
        brush.soft = v
      },
      commit: function() {},
      live: false
    }).sync();
    $('#bBrClear').onclick = function() {
      sel.strokes = [];
      push('Cleared brush');
      schedule()
    }
  }
  if (sel.type === 'radial') mkSlider($('#brS') || $('#mkS'), {
    label: 'Feather',
    min: 0,
    max: 100,
    def: 50,
    get: function() {
      return Math.round((sel.feather == null ? .5 : sel.feather) * 100)
    },
    set: function(v) {
      sel.feather = v / 100
    },
    commit: function(v) {
      push('Mask feather ' + v)
    }
  }).sync();
  mkSlider($('#mkS'), {
    label: 'Mask amount',
    min: 0,
    max: 100,
    def: 100,
    fmt: function(v) {
      return v + '%'
    },
    get: function() {
      return Math.round((sel.amt == null ? 1 : sel.amt) * 100)
    },
    set: function(v) {
      sel.amt = v / 100
    },
    commit: function(v) {
      push('Mask amount ' + v + '%')
    }
  }).sync();
  MASK_ADJ.forEach(function(k) {
    mkSlider($('#mkS'), {
      label: k[1],
      min: k[2] === 0 ? 0 : -100,
      max: 100,
      get: function() {
        return sel.v[k[0]] || 0
      },
      set: function(v) {
        if (v) sel.v[k[0]] = v;
        else delete sel.v[k[0]]
      },
      commit: function(v) {
        push(sel.name + ' ' + k[1].toLowerCase() + ' ' + (v > 0 ? '+' : '') + v)
      }
    }).sync()
  });
  $$('#maskEdit .mq button').forEach(function(b) {
    b.onclick = function() {
      var q = MASK_QUICK[sel.type][+b.dataset.q];
      Object.keys(q[1]).forEach(function(k) {
        sel.v[k] = q[1][k]
      });
      push(q[0]);
      renderMasks();
      schedule()
    }
  });
  $('#bInv').onclick = function() {
    sel.inv = !sel.inv;
    push((sel.inv ? 'Inverted ' : 'Un-inverted ') + sel.name);
    renderMasks();
    schedule();
    flashOverlay()
  };
  $('#bMkReset').onclick = function() {
    sel.v = {};
    push('Reset ' + sel.name + ' sliders');
    renderMasks();
    schedule()
  };
  draw()
}

/* ---------- on-photo tools ---------- */
var mDrag = null,
  hoverPt = null,
  ovCache = {
    key: '',
    c: document.createElement('canvas')
  };

function maskTool() {
  var m = selMask();
  if (!m || m.pending || !work || m.off) return MASK_VIEW;
  return m.type === 'brush' ? BRUSH_TOOL : m.type === 'radial' ? RADIAL_TOOL : m.type === 'linear' ? LINEAR_TOOL : MASK_VIEW
}

// Overlay of the selected mask as a red tint, cached until the mask or crop changes.
function drawOverlay(x, R) {
  var m = selMask();
  if (!m || m.pending || !ovOn()) return;
  var G = geoNow(),
    key = JSON.stringify([m, vstate().geo, SEG && SEG.key, SEG && SEG.done]);
  if (ovCache.key !== key) {
    var al = P.maskAlpha(Object.assign({}, m, {
        amt: 1
      }), G, work.w, work.h, {
        seg: SEG
      }),
      c = ovCache.c;
    if (!al) return;
    c.width = G.w;
    c.height = G.h;
    var id = c.getContext('2d').createImageData(G.w, G.h),
      d = id.data;
    for (var p = 0; p < al.length; p++) {
      d[p * 4] = 255;
      d[p * 4 + 1] = 40;
      d[p * 4 + 2] = 90;
      d[p * 4 + 3] = al[p] * 150
    }
    c.getContext('2d').putImageData(id, 0, 0);
    ovCache.key = key
  }
  x.drawImage(ovCache.c, R.x, R.y, R.w, R.h)
}

function handle(x, p, r, fill) {
  x.beginPath();
  x.arc(p[0], p[1], r, 0, 7);
  x.fillStyle = fill || '#fff';
  x.fill();
  x.lineWidth = 2;
  x.strokeStyle = 'rgba(0,0,0,.6)';
  x.stroke()
}

// AI masks: no on-photo handles, just the overlay; the split slider stays usable.
var MASK_VIEW = {
  noTool: true,
  cursor: function() {
    return 'default'
  },
  down: function() {
    return false
  },
  move: function() {},
  up: function() {},
  draw: drawOverlay
};

var BRUSH_TOOL = {
  cursor: function() {
    return 'none'
  },
  hover: function(e) {
    hoverPt = [e.offsetX, e.offsetY]
  },
  down: function(e, R) {
    var m = selMask(),
      p = toSrc(e, R);
    m.strokes = m.strokes || [];
    m.strokes.push({
      p: [
        [+p[0].toFixed(4), +p[1].toFixed(4)]
      ],
      r: +(brush.size / 100 * .18).toFixed(4),
      soft: brush.soft / 100,
      erase: brush.erase || e.altKey
    });
    mDrag = {
      t: 'paint'
    };
    schedule(true);
    return true
  },
  move: function(e, R) {
    hoverPt = [e.offsetX, e.offsetY];
    var m = selMask(),
      st = m.strokes[m.strokes.length - 1],
      p = toSrc(e, R),
      last = st.p[st.p.length - 1];
    if (Math.hypot((p[0] - last[0]) * work.w, (p[1] - last[1]) * work.h) * R.s < 3) return;
    st.p.push([+p[0].toFixed(4), +p[1].toFixed(4)]);
    schedule(true)
  },
  up: function() {
    mDrag = null;
    push((selMask().strokes.slice(-1)[0].erase ? 'Erased' : 'Painted') + ' ' + selMask().name);
    schedule();
    draw()
  },
  draw: function(x, R) {
    drawOverlay(x, R);
    if (!hoverPt) return;
    var rad = brush.size / 100 * .18 * Math.max(work.w, work.h) * R.s;
    x.save();
    x.lineWidth = 1.5;
    x.strokeStyle = 'rgba(0,0,0,.6)';
    x.beginPath();
    x.arc(hoverPt[0], hoverPt[1], rad + 1, 0, 7);
    x.stroke();
    x.strokeStyle = brush.erase ? '#ff9aa9' : '#fff';
    x.beginPath();
    x.arc(hoverPt[0], hoverPt[1], rad, 0, 7);
    x.stroke();
    x.setLineDash([3, 3]);
    x.beginPath();
    x.arc(hoverPt[0], hoverPt[1], rad * (1 - brush.soft / 100), 0, 7);
    x.stroke();
    x.restore()
  }
};
view.addEventListener('pointerleave', function() {
  if (hoverPt) {
    hoverPt = null;
    draw()
  }
});

function ellipsePts(m, R, k) {
  var pts = [];
  for (var i = 0; i <= 72; i++) {
    var t = i / 72 * Math.PI * 2;
    pts.push(toScreen(m.cx + m.rx * k * Math.cos(t), m.cy + m.ry * k * Math.sin(t), R))
  }
  return pts
}

function strokePath(x, pts) {
  x.beginPath();
  pts.forEach(function(p, i) {
    i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])
  });
  x.stroke()
}

var RADIAL_TOOL = {
  handles: function(m, R) {
    return {
      c: toScreen(m.cx, m.cy, R),
      rx: toScreen(m.cx + m.rx, m.cy, R),
      ry: toScreen(m.cx, m.cy + m.ry, R)
    }
  },
  hit: function(e, R) {
    var H = this.handles(selMask(), R),
      best = null;
    ['rx', 'ry', 'c'].forEach(function(k) {
      if (!best && Math.hypot(e.offsetX - H[k][0], e.offsetY - H[k][1]) < 12) best = k
    });
    return best
  },
  cursor: function(e, R) {
    var h = this.hit(e, R);
    return h === 'c' ? 'move' : h ? 'pointer' : 'crosshair'
  },
  down: function(e, R) {
    var m = selMask(),
      h = this.hit(e, R),
      p = toSrc(e, R);
    mDrag = {
      t: 'radial',
      h: h || 'new',
      p0: p,
      m0: {
        cx: m.cx,
        cy: m.cy
      }
    };
    if (!h) {
      m.cx = p[0];
      m.cy = p[1];
      m.rx = .01;
      m.ry = .01 * work.w / work.h
    }
    return true
  },
  move: function(e, R) {
    var m = selMask(),
      d = mDrag,
      p = toSrc(e, R);
    if (d.h === 'c') {
      m.cx = d.m0.cx + p[0] - d.p0[0];
      m.cy = d.m0.cy + p[1] - d.p0[1]
    } else if (d.h === 'rx') m.rx = Math.max(.01, Math.hypot(p[0] - m.cx, (p[1] - m.cy) * work.h / work.w));
    else if (d.h === 'ry') m.ry = Math.max(.01, Math.hypot((p[0] - m.cx) * work.w / work.h, p[1] - m.cy));
    else {
      var r = Math.max(.01, Math.hypot(p[0] - m.cx, (p[1] - m.cy) * work.h / work.w));
      m.rx = r;
      m.ry = r * work.w / work.h
    }
    schedule(true)
  },
  up: function() {
    mDrag = null;
    push('Moved ' + selMask().name);
    schedule()
  },
  draw: function(x, R) {
    var m = selMask();
    drawOverlay(x, R);
    x.save();
    x.strokeStyle = 'rgba(0,0,0,.5)';
    x.lineWidth = 3;
    strokePath(x, ellipsePts(m, R, 1));
    x.strokeStyle = '#fff';
    x.lineWidth = 1.5;
    strokePath(x, ellipsePts(m, R, 1));
    x.setLineDash([4, 4]);
    strokePath(x, ellipsePts(m, R, 1 - (m.feather == null ? .5 : m.feather)));
    x.setLineDash([]);
    var H = this.handles(m, R);
    handle(x, H.c, 6, '#ff6b3d');
    handle(x, H.rx, 5);
    handle(x, H.ry, 5);
    x.restore()
  }
};

var LINEAR_TOOL = {
  hit: function(e, R) {
    var m = selMask(),
      a = toScreen(m.x1, m.y1, R),
      b = toScreen(m.x2, m.y2, R);
    if (Math.hypot(e.offsetX - a[0], e.offsetY - a[1]) < 12) return 'a';
    if (Math.hypot(e.offsetX - b[0], e.offsetY - b[1]) < 12) return 'b';
    var mx = (a[0] + b[0]) / 2,
      my = (a[1] + b[1]) / 2;
    if (Math.hypot(e.offsetX - mx, e.offsetY - my) < 12) return 'mid';
    return null
  },
  cursor: function(e, R) {
    var h = this.hit(e, R);
    return h === 'mid' ? 'move' : h ? 'pointer' : 'crosshair'
  },
  down: function(e, R) {
    var m = selMask(),
      h = this.hit(e, R),
      p = toSrc(e, R);
    mDrag = {
      t: 'linear',
      h: h || 'new',
      p0: p,
      m0: {
        x1: m.x1,
        y1: m.y1,
        x2: m.x2,
        y2: m.y2
      }
    };
    if (!h) {
      m.x1 = m.x2 = p[0];
      m.y1 = m.y2 = p[1]
    }
    return true
  },
  move: function(e, R) {
    var m = selMask(),
      d = mDrag,
      p = toSrc(e, R),
      dx = p[0] - d.p0[0],
      dy = p[1] - d.p0[1];
    if (d.h === 'a') {
      m.x1 = p[0];
      m.y1 = p[1]
    } else if (d.h === 'mid') {
      m.x1 = d.m0.x1 + dx;
      m.y1 = d.m0.y1 + dy;
      m.x2 = d.m0.x2 + dx;
      m.y2 = d.m0.y2 + dy
    } else {
      m.x2 = p[0];
      m.y2 = p[1]
    }
    schedule(true)
  },
  up: function() {
    var m = selMask();
    // A click without a drag leaves a zero-length gradient; give it a sensible length.
    if (Math.hypot(m.x2 - m.x1, m.y2 - m.y1) < .01) m.y2 = m.y1 + .2;
    mDrag = null;
    push('Moved ' + m.name);
    schedule()
  },
  draw: function(x, R) {
    var m = selMask(),
      a = toScreen(m.x1, m.y1, R),
      b = toScreen(m.x2, m.y2, R),
      dx = b[0] - a[0],
      dy = b[1] - a[1],
      L = Math.hypot(dx, dy) || 1,
      nx = -dy / L * 3000,
      ny = dx / L * 3000;
    drawOverlay(x, R);
    x.save();
    x.beginPath();
    x.rect(R.x, R.y, R.w, R.h);
    x.clip();
    [
      [a, []],
      [b, [6, 5]],
      [
        [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
        [2, 6]
      ]
    ].forEach(function(l) {
      x.setLineDash(l[1]);
      x.strokeStyle = 'rgba(0,0,0,.5)';
      x.lineWidth = 3;
      strokePath(x, [
        [l[0][0] - nx, l[0][1] - ny],
        [l[0][0] + nx, l[0][1] + ny]
      ]);
      x.strokeStyle = '#fff';
      x.lineWidth = 1.5;
      strokePath(x, [
        [l[0][0] - nx, l[0][1] - ny],
        [l[0][0] + nx, l[0][1] + ny]
      ])
    });
    x.restore();
    handle(x, a, 6, '#ff6b3d');
    handle(x, b, 5);
    handle(x, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], 4)
  }
};
