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
    window: {
      name: 'B&W Window',
      tip: 'A black and white window with the picture inside shifted out of line, on top of the colour photo.'
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
      tip: 'The AI puts an oval on each face. Drag an oval to move it, drag its dots to make it wider, narrower, taller or shorter. Drag on an empty spot to add a face it missed; click one and press Delete to remove it.'
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
  // B&W window: what dragging on the photo does, and its sliders [key, label, min, max, default].
  WIN_MODES = {
    box: ['Box', 'Drag the corner dots to resize the window, or drag inside it to move it. Drag anywhere else to draw a new window.'],
    picture: ['Picture', 'Drag on the photo to slide the picture inside the window and pick what shows in it.'],
    paint: ['Paint', 'Paint to add more of the photo to the window, e.g. let the subject break out of the box.'],
    erase: ['Erase', 'Paint to cut parts out of the window.']
  },
  WIN_SL = [
    ['x', 'Shift left / right', -100, 100, 15],
    ['y', 'Shift up / down', -100, 100, -10],
    ['zoom', 'Zoom', 0, 100, 10],
    ['round', 'Rounded corners', 0, 100, 45],
    ['shadow', 'Shadow', 0, 100, 35],
    ['bw', 'Black & white', 0, 100, 100]
  ],
  winMode = 'box',
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
  else if (type === 'window') {
    var wc = toSrc({
      offsetX: R.x + R.w / 2,
      offsetY: R.y + R.h / 2
    }, R);
    mk.cx = wc[0];
    mk.cy = wc[1];
    mk.bw = .445;
    mk.bh = .33;
    mk.win = {};
    mk.strokes = [];
    winMode = 'box'
  }
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
    if (need === 'face') {
      // Each face becomes an oval the user can move and resize.
      mk.faces = clone(sg.faceShapes || []);
      mk.feather = mk.feather == null ? .35 : mk.feather;
      faceSel = mk.faces.length ? 0 : -1
    }
    if (need === 'face' && !sg.faces)
      // A visor or cage can hide a face completely; the user can draw it instead.
      toast('I couldn’t find a face. Drag across the face in the photo to add it.', 5000);
    else if (need === 'subject' && !sg.found) toast('No clear subject found. Try a brush or radial mask');
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
  var isWin = sel.type === 'window',
    winBrush = isWin && (winMode === 'paint' || winMode === 'erase'),
    h = '<p class="mtip">' + esc(isWin ? WIN_MODES[winMode][1] : MASK_TYPES[sel.type].tip) + '</p>';
  if (isWin) h += '<div class="seg" id="winMode">' + Object.keys(WIN_MODES).map(function(k) {
    return '<button data-w="' + k + '"' + (k === winMode ? ' class="on"' : '') + '>' + WIN_MODES[k][0] + '</button>'
  }).join('') + '</div>' + (winBrush ? '<div id="brS"></div>' : '') + '<div id="winS"></div>';
  if (sel.type === 'brush') h += '<div class="seg" id="brMode"><button data-b="paint"' + (brush.erase ? '' : ' class="on"') + '>Paint</button><button data-b="erase"' + (brush.erase ? ' class="on"' : '') + '>Erase</button></div><div id="brS"></div>';
  if (MASK_QUICK[sel.type]) h += '<div class="chips mq">' + MASK_QUICK[sel.type].map(function(q, i) {
    return '<button data-q="' + i + '">' + q[0] + '</button>'
  }).join('') + '</div>';
  h += '<div id="mkS"></div><div class="row" style="margin-top:10px"><button class="btn" id="bInv">' + (sel.inv ? 'Un-invert' : 'Invert') + '</button><button class="btn" id="bMkReset">Reset sliders</button>' + (sel.type === 'brush' || isWin && sel.strokes && sel.strokes.length ? '<button class="btn" id="bBrClear">Clear paint</button>' : '') + '</div>';
  box.innerHTML = h;
  if (isWin) {
    $$('#winMode button').forEach(function(b) {
      b.onclick = function() {
        winMode = b.dataset.w;
        brush.erase = winMode === 'erase';
        renderMasks()
      }
    });
    mkSlider($('#winS'), {
      label: 'Width',
      min: 5,
      max: 100,
      def: 89,
      fmt: function(v) {
        return v + '%'
      },
      get: function() {
        return Math.round(sel.bw * 200)
      },
      set: function(v) {
        sel.bw = v / 200
      },
      commit: function(v) {
        push('Window width ' + v + '%')
      }
    }).sync();
    mkSlider($('#winS'), {
      label: 'Height',
      min: 5,
      max: 100,
      def: 66,
      fmt: function(v) {
        return v + '%'
      },
      get: function() {
        return Math.round(sel.bh * 200)
      },
      set: function(v) {
        sel.bh = v / 200
      },
      commit: function(v) {
        push('Window height ' + v + '%')
      }
    }).sync();
    WIN_SL.forEach(function(o) {
      mkSlider($('#winS'), {
        label: o[1],
        min: o[2],
        max: o[3],
        def: o[4],
        get: function() {
          var w = sel.win || {};
          return w[o[0]] == null ? o[4] : w[o[0]]
        },
        set: function(v) {
          (sel.win = sel.win || {})[o[0]] = v
        },
        commit: function(v) {
          push('Window ' + o[1].toLowerCase() + ' ' + v)
        }
      }).sync()
    })
  }
  if (sel.type === 'brush' || winBrush) {
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
  }
  if ($('#bBrClear')) $('#bBrClear').onclick = function() {
    sel.strokes = [];
    push('Cleared brush');
    renderMasks();
    schedule()
  };
  if (sel.type === 'face' && sel.faces) {
    var fb = document.createElement('div');
    fb.className = 'row';
    fb.style.margin = '0 0 10px';
    fb.innerHTML = '<button class="btn" id="bFaceDel"' + (faceSel >= 0 && sel.faces[faceSel] ? '' : ' disabled') + '>Remove selected face</button><button class="btn" id="bFaceAgain">Find faces again</button>';
    $('#mkS').appendChild(fb);
    $('#bFaceDel').onclick = removeFace;
    $('#bFaceAgain').onclick = function() {
      sel.faces = clone(SEG && SEG.faceShapes || []);
      faceSel = sel.faces.length ? 0 : -1;
      push('Reset face ovals');
      renderMasks();
      schedule()
    }
  }
  if (sel.type === 'radial' || sel.type === 'face' && sel.faces) mkSlider($('#brS') || $('#mkS'), {
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
  return m.type === 'brush' ? BRUSH_TOOL : m.type === 'radial' ? RADIAL_TOOL : m.type === 'linear' ? LINEAR_TOOL : m.type === 'window' ? WINDOW_TOOL : m.type === 'face' && m.faces ? FACE_TOOL : MASK_VIEW
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
    handle(x, H.c, 6, cssv('--ac'));
    handle(x, H.rx, 5);
    handle(x, H.ry, 5);
    x.restore()
  }
};

// B&W window: Box mode moves and resizes the box, Picture mode slides the picture inside it,
// Paint and Erase use the brush to add to or cut from the window.
var WINDOW_TOOL = {
  brush: function() {
    return winMode === 'paint' || winMode === 'erase'
  },
  corners: function(m, R) {
    return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(function(k) {
      return toScreen(m.cx + k[0] * m.bw, m.cy + k[1] * m.bh, R)
    })
  },
  hit: function(e, R) {
    var m = selMask(),
      C = this.corners(m, R),
      p = toSrc(e, R);
    for (var i = 0; i < 4; i++)
      if (Math.hypot(e.offsetX - C[i][0], e.offsetY - C[i][1]) < 12) return 'corner';
    return Math.abs(p[0] - m.cx) < m.bw && Math.abs(p[1] - m.cy) < m.bh ? 'move' : null
  },
  cursor: function(e, R) {
    if (this.brush()) return 'none';
    if (winMode === 'picture') return mDrag ? 'grabbing' : 'grab';
    var h = this.hit(e, R);
    return h === 'move' ? 'move' : h ? 'nwse-resize' : 'crosshair'
  },
  hover: function(e, R) {
    if (this.brush()) BRUSH_TOOL.hover(e, R);
    else hoverPt = null
  },
  down: function(e, R) {
    if (this.brush()) {
      brush.erase = winMode === 'erase';
      return BRUSH_TOOL.down(e, R)
    }
    var m = selMask(),
      w = m.win = m.win || {};
    if (winMode === 'picture') {
      mDrag = {
        t: 'pic',
        s0: [e.offsetX, e.offsetY],
        o0: [w.x == null ? 15 : w.x, w.y == null ? -10 : w.y]
      };
      return true
    }
    var h = this.hit(e, R),
      p = toSrc(e, R);
    mDrag = {
      t: 'win',
      h: h || 'new',
      p0: p,
      m0: [m.cx, m.cy]
    };
    return true
  },
  move: function(e, R) {
    if (this.brush()) return BRUSH_TOOL.move(e, R);
    var m = selMask(),
      d = mDrag,
      p = toSrc(e, R);
    if (d.t === 'pic') {
      // slider units: 100 = a fifth of the photo's short side
      var G = geoNow(),
        u = .2 * Math.min(G.w, G.h) * R.s / 100,
        cl = function(v) {
          return Math.round(Math.max(-100, Math.min(100, v)))
        };
      m.win.x = cl(d.o0[0] + (e.offsetX - d.s0[0]) / u);
      m.win.y = cl(d.o0[1] + (e.offsetY - d.s0[1]) / u)
    } else if (d.h === 'move') {
      m.cx = d.m0[0] + p[0] - d.p0[0];
      m.cy = d.m0[1] + p[1] - d.p0[1]
    } else if (d.h === 'corner') {
      m.bw = Math.max(.01, Math.abs(p[0] - m.cx));
      m.bh = Math.max(.01, Math.abs(p[1] - m.cy))
    } else {
      m.cx = (d.p0[0] + p[0]) / 2;
      m.cy = (d.p0[1] + p[1]) / 2;
      m.bw = Math.max(.01, Math.abs(p[0] - d.p0[0]) / 2);
      m.bh = Math.max(.01, Math.abs(p[1] - d.p0[1]) / 2)
    }
    schedule(true)
  },
  up: function() {
    if (this.brush()) {
      BRUSH_TOOL.up();
      return renderMasks()
    }
    var d = mDrag;
    mDrag = null;
    push(d.t === 'pic' ? 'Moved picture in window' : d.h === 'move' ? 'Moved window' : 'Resized window');
    renderMasks();
    schedule()
  },
  draw: function(x, R) {
    var m = selMask();
    if (this.brush()) BRUSH_TOOL.draw(x, R);
    else drawOverlay(x, R);
    if (winMode !== 'box') return;
    var C = this.corners(m, R);
    x.save();
    x.strokeStyle = 'rgba(0,0,0,.5)';
    x.lineWidth = 3;
    strokePath(x, C.concat([C[0]]));
    x.strokeStyle = '#fff';
    x.lineWidth = 1.5;
    strokePath(x, C.concat([C[0]]));
    C.forEach(function(c) {
      handle(x, c, 5)
    });
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
    handle(x, a, 6, cssv('--ac'));
    handle(x, b, 5);
    handle(x, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], 4)
  }
};

/* ---------- editable face ovals ---------- */
var faceSel = -1;

// A point on a face oval: lx, ly in oval units (1 = the edge) -> photo fractions.
function facePt(f, lx, ly) {
  var W = work.w,
    H = work.h,
    c = Math.cos(f.ang || 0),
    s = Math.sin(f.ang || 0),
    x = lx * f.rx * W,
    y = ly * f.ry * W;
  return [f.cx + (x * c - y * s) / W, f.cy + (x * s + y * c) / H]
}

// Where a photo point sits relative to an oval (1 = on the edge).
function faceDist(f, p) {
  var W = work.w,
    H = work.h,
    c = Math.cos(f.ang || 0),
    s = Math.sin(f.ang || 0),
    px = (p[0] - f.cx) * W,
    py = (p[1] - f.cy) * H;
  return Math.hypot((px * c + py * s) / (f.rx * W), (-px * s + py * c) / (f.ry * W))
}

function removeFace() {
  var m = selMask();
  if (!m || !m.faces || !m.faces[faceSel]) return;
  m.faces.splice(faceSel, 1);
  faceSel = Math.min(faceSel, m.faces.length - 1);
  push('Removed a face');
  renderMasks();
  schedule()
}
document.addEventListener('keydown', function(e) {
  var m = selMask(),
    typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && document.activeElement.type !== 'range';
  if (tab === 'masks' && !typing && m && m.faces && (e.key === 'Delete' || e.key === 'Backspace') && m.faces[faceSel]) {
    e.preventDefault();
    removeFace()
  }
});

var FACE_TOOL = {
  // Handles of face i: its centre, the side dot (width) and the bottom dot (height).
  handles: function(f, R) {
    var sc = function(p) {
      return toScreen(p[0], p[1], R)
    };
    return {
      c: sc([f.cx, f.cy]),
      w: sc(facePt(f, 1, 0)),
      h: sc(facePt(f, 0, 1))
    }
  },
  hit: function(e, R) {
    var m = selMask(),
      p = toSrc(e, R),
      best = null;
    // The selected face's dots first, then any face's inside.
    var order = m.faces.map(function(f, i) {
      return i
    }).sort(function(a, b) {
      return (b === faceSel) - (a === faceSel)
    });
    order.some(function(i) {
      var H = FACE_TOOL.handles(m.faces[i], R);
      ['w', 'h'].some(function(k) {
        if (Math.hypot(e.offsetX - H[k][0], e.offsetY - H[k][1]) < 11) best = {
          i: i,
          k: k
        };
        return best
      });
      return best
    });
    if (best) return best;
    order.some(function(i) {
      if (faceDist(m.faces[i], p) < 1) best = {
        i: i,
        k: 'move'
      };
      return best
    });
    return best
  },
  cursor: function(e, R) {
    var h = this.hit(e, R);
    return !h ? 'crosshair' : h.k === 'move' ? 'move' : 'pointer'
  },
  down: function(e, R) {
    var m = selMask(),
      h = this.hit(e, R),
      p = toSrc(e, R);
    if (!h) {
      // Draw a new face oval from here.
      m.faces.push({
        cx: p[0],
        cy: p[1],
        rx: .01,
        ry: .013,
        ang: 0
      });
      h = {
        i: m.faces.length - 1,
        k: 'new'
      }
    }
    faceSel = h.i;
    var f = m.faces[h.i];
    mDrag = {
      t: 'face',
      h: h,
      p0: p,
      f0: clone(f)
    };
    renderMasks();
    return true
  },
  move: function(e, R) {
    var m = selMask(),
      d = mDrag,
      f = m.faces[d.h.i],
      p = toSrc(e, R),
      W = work.w,
      H = work.h;
    if (d.h.k === 'move') {
      f.cx = d.f0.cx + p[0] - d.p0[0];
      f.cy = d.f0.cy + p[1] - d.p0[1]
    } else if (d.h.k === 'new') {
      var r = Math.hypot((p[0] - f.cx) * W, (p[1] - f.cy) * H) / W;
      f.rx = Math.max(.005, r * .8);
      f.ry = Math.max(.006, r)
    } else {
      // Distance from the centre along the dragged axis sets that radius.
      var c = Math.cos(f.ang || 0),
        s = Math.sin(f.ang || 0),
        px = (p[0] - f.cx) * W,
        py = (p[1] - f.cy) * H,
        along = d.h.k === 'w' ? px * c + py * s : -px * s + py * c;
      if (d.h.k === 'w') f.rx = Math.max(.005, Math.abs(along) / W);
      else f.ry = Math.max(.005, Math.abs(along) / W)
    }
    schedule(true)
  },
  up: function() {
    var d = mDrag;
    mDrag = null;
    push(d.h.k === 'new' ? 'Added a face' : d.h.k === 'move' ? 'Moved a face' : 'Resized a face');
    renderMasks();
    schedule()
  },
  draw: function(x, R) {
    var m = selMask();
    drawOverlay(x, R);
    x.save();
    m.faces.forEach(function(f, i) {
      var pts = [];
      for (var k = 0; k <= 64; k++) {
        var t = k / 64 * Math.PI * 2,
          q = facePt(f, Math.cos(t), Math.sin(t));
        pts.push(toScreen(q[0], q[1], R))
      }
      x.setLineDash([]);
      x.strokeStyle = 'rgba(0,0,0,.5)';
      x.lineWidth = 3;
      strokePath(x, pts);
      x.strokeStyle = i === faceSel ? '#fff' : 'rgba(255,255,255,.6)';
      x.lineWidth = i === faceSel ? 1.8 : 1.2;
      strokePath(x, pts);
      if (i !== faceSel) return;
      var H = FACE_TOOL.handles(f, R);
      handle(x, H.c, 5, cssv('--ac'));
      handle(x, H.w, 5);
      handle(x, H.h, 5)
    });
    x.restore()
  }
};
