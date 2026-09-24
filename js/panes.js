/* ============================================================
   UI HELPERS
   ============================================================ */
var SLIDERS = [];

function esc(s) {
  return String(s).replace(/[&<>"']/g, function(c) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    } [c]
  })
}
var tt;

function toast(m) {
  var t = $('#toast');
  t.textContent = m;
  t.classList.add('on');
  clearTimeout(tt);
  tt = setTimeout(function() {
    t.classList.remove('on')
  }, 2400)
}

function mkSlider(host, o) {
  var min = o.min == null ? -100 : o.min,
    max = o.max == null ? 100 : o.max,
    def = o.def || 0,
    row = document.createElement('div');
  row.className = 'sl';
  row.innerHTML = '<label>' + o.label + '</label><output></output><input type="range" min="' + min + '" max="' + max + '" step="' + (o.step || 1) + '">';
  var inp = row.querySelector('input'),
    out = row.querySelector('output');

  function paint() {
    var v = +inp.value;
    out.textContent = o.fmt ? o.fmt(v) : (v > 0 && min < 0 ? '+' : '') + v;
    var p = (v - min) / (max - min) * 100,
      z = min < 0 ? (-min) / (max - min) * 100 : 0;
    inp.style.setProperty('--a', Math.min(p, z) + '%');
    inp.style.setProperty('--b', Math.max(p, z) + '%');
    row.classList.toggle('mod', v !== def)
  }
  inp.oninput = function() {
    o.set(+inp.value);
    paint();
    o.live !== false && schedule(true)
  };
  inp.onchange = function() {
    o.commit(+inp.value)
  };
  inp.ondblclick = function() {
    inp.value = def;
    o.set(def);
    paint();
    schedule();
    o.commit(def)
  };
  row.sync = function() {
    inp.value = o.get();
    paint()
  };
  host.appendChild(row);
  SLIDERS.push(row);
  return row
}

function seg(el, attr, get, set) {
  $$(el + ' button').forEach(function(b) {
    b.onclick = function() {
      set(b.dataset[attr])
    }
  });
  return function() {
    var v = String(get());
    $$(el + ' button').forEach(function(b) {
      b.classList.toggle('on', b.dataset[attr] === v)
    })
  }
}

/* ---------- ENHANCE / UPSCALE PANE ---------- */
var UPK_NAME = {
    'ai-medium': 'AI Quality',
    'ai-slim': 'AI Fast',
    lanczos: 'Lanczos-3',
    bicubic: 'Bicubic'
  },
  UPK_NOTE = {
    'ai-medium': 'A neural network (ESRGAN) redraws fine detail. Runs on this computer; the preview upscales the on-screen copy and Export does the full photo.',
    'ai-slim': 'A smaller, quicker ESRGAN model. Good for big photos or slower computers.',
    lanczos: 'Classic resampling plus sharpening. Instant, but it can’t invent detail.',
    bicubic: 'Smooth classic resampling. Instant, softer than Lanczos.'
  };
var syncUpF = seg('#upF', 'f', function() {
  return S.up.f
}, function(v) {
  S.up.f = +v;
  push('Upscale factor ' + v + '×');
  if (S.up.on) schedule()
});
var syncUpK = seg('#upK', 'k', function() {
  return S.up.k
}, function(v) {
  S.up.k = v;
  push('Resampler: ' + v);
  if (S.up.on) schedule()
});
mkSlider($('#upSliders'), {
  label: 'Detail recovery',
  min: 0,
  max: 100,
  get: function() {
    return S.up.sharp
  },
  set: function(v) {
    S.up.sharp = v
  },
  commit: function(v) {
    push('Upscale detail ' + v)
  },
  live: false
});
mkSlider($('#upSliders'), {
  label: 'Noise reduction',
  min: 0,
  max: 100,
  get: function() {
    return S.up.dn
  },
  set: function(v) {
    S.up.dn = v
  },
  commit: function(v) {
    push('Upscale denoise ' + v)
  },
  live: false
});
$$('#upSliders input').forEach(function(i) {
  i.addEventListener('change', function() {
    if (S.up.on) schedule()
  })
});

function renderUpAct() {
  var el = $('#upAct');
  if (!full) {
    el.innerHTML = '';
    return
  }
  var gd = geoDims(full.w, full.h, S.geo),
    w = gd[0],
    h = gd[1];
  var sz = P.upSize(w, h, S.up.f);
  $('#resIn').textContent = w + '×' + h;
  $('#resOut').textContent = sz[0] + '×' + sz[1] + (sz[0] < Math.round(w * S.up.f) ? ' (capped)' : '');
  $('#upNote').textContent = UPK_NOTE[S.up.k] || '';
  el.innerHTML = S.up.on ? '<div class="row"><div class="done"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12l5 5 9-10"/></svg>Upscaled ' + S.up.f + '×</div><button class="btn" id="bUpOff" style="flex:0">Remove</button></div>' : '<button class="btn pri big" id="bUp">Upscale ' + S.up.f + '&times;</button>';
  var b = $('#bUp');
  if (b) b.onclick = function() {
    S.up.on = true;
    push('Upscaled ' + S.up.f + '×');
    schedule()
  };
  var o = $('#bUpOff');
  if (o) o.onclick = function() {
    S.up.on = false;
    push('Removed upscale');
    schedule()
  }
}

function renderEnh() {
  var el = $('#enhBox');
  if (!S.enh) {
    el.innerHTML = '<button class="btn big" id="bEnh" style="background:#232733"><svg viewBox="0 0 24 24" fill="none" stroke="#ffb03d" stroke-width="2" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/></svg>Enhance photo</button>';
    $('#bEnh').onclick = doEnhance;
    return
  }
  el.innerHTML = '<div class="done"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12l5 5 9-10"/></svg>Enhanced</div><ul class="notes">' + S.enh.notes.map(function(n) {
    return '<li>' + esc(n) + '</li>'
  }).join('') + '</ul><div id="enhS"></div><div class="row" style="margin-top:6px"><button class="btn" id="bEnhRe">Re-analyze</button><button class="btn" id="bEnhOff">Remove</button></div>';
  mkSlider($('#enhS'), {
    label: 'Strength',
    min: 0,
    max: 100,
    fmt: function(v) {
      return v + '%'
    },
    get: function() {
      return Math.round(S.enh.amt * 100)
    },
    set: function(v) {
      S.enh.amt = v / 100
    },
    commit: function(v) {
      push('Enhance strength ' + v + '%')
    }
  }).sync();
  $('#bEnhOff').onclick = function() {
    S.enh = null;
    push('Removed enhance');
    schedule();
    syncUI()
  };
  $('#bEnhRe').onclick = doEnhance
}

function analyzeFor(st) {
  return P.analyze(P.geo(work, st.geo))
}

function doEnhance() {
  if (!work) return;
  var a = S.enh ? S.enh.amt : .85;
  S.enh = analyzeFor(S);
  S.enh.amt = a;
  push('Auto enhance');
  schedule();
  syncUI();
  toast('Enhanced · levels, white balance, clarity, vibrance, sharpen')
}

/* ---------- ADJUST PANE ---------- */
var ADJ = [
  ['Light', [
    ['exposure', 'Exposure'],
    ['brightness', 'Brightness'],
    ['contrast', 'Contrast'],
    ['highlights', 'Highlights'],
    ['shadows', 'Shadows']
  ]],
  ['Color', [
    ['warmth', 'Warmth'],
    ['tint', 'Tint'],
    ['saturation', 'Saturation'],
    ['vibrance', 'Vibrance']
  ]],
  ['Detail', [
    ['clarity', 'Clarity'],
    ['sharpen', 'Sharpen'],
    ['denoise', 'Noise reduction', 0]
  ]],
  ['Effects', [
    ['fade', 'Fade', 0],
    ['glow', 'Glow', 0],
    ['vignette', 'Vignette'],
    ['grain', 'Grain', 0]
  ]]
];
var LBL = {};
ADJ.forEach(function(g) {
  g[1].forEach(function(k) {
    LBL[k[0]] = k[1]
  })
});
(function() {
  var box = $('#adjBox');
  ADJ.forEach(function(g) {
    var h = document.createElement('div');
    h.className = 'grp';
    h.textContent = g[0];
    box.appendChild(h);
    g[1].forEach(function(k) {
      mkSlider(box, {
        label: k[1],
        min: k[2] === 0 ? 0 : -100,
        max: 100,
        get: function() {
          return base()[k[0]] || 0
        },
        set: function(v) {
          base()[k[0]] = v;
          presetOn = null
        },
        commit: function(v) {
          push(k[1] + ' ' + (v > 0 ? '+' : '') + v);
          presetDirty = true
        }
      })
    })
  })
})();
function geoChanged() {
  thumbsDirty = true;
  presetDirty = true;
  if (S.enh) {
    var a = S.enh.amt;
    S.enh = analyzeFor(S);
    S.enh.amt = a
  }
  schedule();
  refreshThumbs();
  syncUI()
}
$('#skinSw').onclick = function() {
  S.skin = !S.skin;
  push(S.skin ? 'Protect skin tones' : 'Unprotect skin tones');
  schedule()
};
$('#bResetAll').onclick = function() {
  var up = S.up;
  S = fresh();
  S.up.f = up.f;
  push('Reset all');
  thumbsDirty = presetDirty = true;
  schedule();
  refreshThumbs()
};

function fname(id) {
  var f = P.FL.filter(function(x) {
    return x[0] === id
  })[0];
  return f ? f[1] : id
}

function renderStack() {
  var el = $('#stack'),
    li = [];
  if (S.enh) li.push('<li><span>Photo Enhancer</span><i>' + Math.round(S.enh.amt * 100) + '%</i><button data-e="1">&times;</button></li>');
  S.layers.forEach(function(L, i) {
    if (L.t === 'adj') {
      var ks = Object.keys(L.v).filter(function(k) {
          return k !== 'hsl' && L.v[k]
        }),
        hs = L.v.hsl ? Object.keys(L.v.hsl).length : 0;
      if (i === 0 && !ks.length && !hs) return;
      li.push('<li><span>' + (i === 0 ? 'Adjustments' : 'Adjustments (after filter)') + '</span><i>' + (ks.length + hs) + ' set</i>' + (i ? '<button data-i="' + i + '">&times;</button>' : '<button data-i="0">&times;</button>') + '</li>')
    } else li.push('<li><span>' + esc(fname(L.id)) + '</span><i>' + Math.round(L.s * 100) + '%</i><button data-i="' + i + '">&times;</button></li>')
  });
  var g = S.geo;
  if (g.crop || g.rect || g.ang || g.rot || g.fh || g.fv) li.push('<li><span>Crop / rotate</span><i>' + [g.rect ? 'custom' : g.crop, g.ang ? (g.ang > 0 ? '+' : '') + g.ang.toFixed(1) + '° level' : '', g.rot ? g.rot + '°' : '', g.fh ? 'flipH' : '', g.fv ? 'flipV' : ''].filter(Boolean).join(' ') + '</i><button data-g="1">&times;</button></li>');
  var nm = masks().length;
  if (nm) li.push('<li><span>Masks</span><i>' + nm + ' local edit' + (nm > 1 ? 's' : '') + '</i><button data-m="1">&times;</button></li>');
  if (S.up.on) li.push('<li><span>Upscale</span><i>' + S.up.f + '×</i><button data-u="1">&times;</button></li>');
  el.innerHTML = li.join('') || '<li style="color:var(--dim)"><span>No edits yet</span></li>';
  $('#stackN').textContent = li.length ? li.length + ' layer' + (li.length > 1 ? 's' : '') : '';
  $$('#stack button').forEach(function(b) {
    b.onclick = function() {
      if (b.dataset.e) S.enh = null;
      else if (b.dataset.g) {
        S.geo = fresh().geo;
        thumbsDirty = presetDirty = true;
        refreshThumbs()
      } else if (b.dataset.u) S.up.on = false;
      else if (b.dataset.m) S.masks = [];
      else {
        var i = +b.dataset.i;
        if (i === 0) S.layers[0].v = {};
        else S.layers.splice(i, 1)
      }
      push('Removed layer');
      schedule()
    }
  })
}

/* ---------- FILTERS PANE ---------- */
var CATS = ['All', 'Film', 'B&W', 'Cinematic', 'Vintage', 'Color Pop', 'Artistic'],
  cat = 'All',
  thumbCanvases = {};
$('#cats').innerHTML = CATS.map(function(c) {
  return '<button data-c="' + c + '">' + c + '</button>'
}).join('');
$$('#cats button').forEach(function(b) {
  b.onclick = function() {
    cat = b.dataset.c;
    renderFilterGrid()
  }
});

// Filters stack: several filter layers can be applied in order. `fPos` is the
// filter being edited (its position among filter layers), or fCount() when
// the next pick should add a new filter on top.
var fPos = 0;

function fLayers() {
  return S.layers.filter(function(l) {
    return l.t === 'flt'
  })
}

function fCount() {
  return fLayers().length
}

function selFilter() {
  var fl = fLayers();
  if (fPos > fl.length) fPos = fl.length;
  return fl[fPos] || null
}

function lastFilter() {
  var fl = fLayers();
  return fl[fl.length - 1] || null
}

(function() {
  var g = $('#fgrid'),
    h = '<button class="ft" data-id=""><div class="none">&#8856;</div><span>None</span></button>';
  P.FL.forEach(function(f) {
    h += '<button class="ft" data-id="' + f[0] + '" data-c="' + f[2] + '"><canvas width="96" height="96"></canvas><span>' + esc(f[1]) + '</span></button>'
  });
  g.innerHTML = h;
  $$('#fgrid .ft').forEach(function(b) {
    if (b.dataset.id) thumbCanvases[b.dataset.id] = b.querySelector('canvas');
    b.onclick = function() {
      pickFilter(b.dataset.id)
    }
  })
})();

function pickFilter(id) {
  var sf = selFilter();
  if (!id) {
    if (!sf) return;
    removeFilter(sf);
    push('Removed filter')
  } else if (sf) {
    if (sf.id === id) return;
    sf.id = id;
    push('Filter: ' + fname(id))
  } else {
    S.layers.push({
      t: 'flt',
      id: id,
      s: .85
    });
    fPos = fCount() - 1;
    push((fCount() > 1 ? 'Stacked filter: ' : 'Filter: ') + fname(id))
  }
  schedule();
  renderFilterGrid()
}

function removeFilter(layer) {
  S.layers.splice(S.layers.indexOf(layer), 1);
  if (!fCount() && S.layers.length > 1) {
    // No filters left: fold any "after filter" adjustments back into the base layer.
    var extra = S.layers.splice(1);
    extra.forEach(function(l) {
      Object.keys(l.v).forEach(function(k) {
        if (k !== 'hsl' && k !== 'curve') S.layers[0].v[k] = (S.layers[0].v[k] || 0) + l.v[k]
      })
    })
  }
  fPos = Math.max(0, Math.min(fPos, fCount() - 1))
}

function renderFilterGrid() {
  $$('#cats button').forEach(function(b) {
    b.classList.toggle('on', b.dataset.c === cat)
  });
  var sf = selFilter(),
    fl = fLayers();
  $$('#fgrid .ft').forEach(function(b) {
    b.style.display = !b.dataset.id || cat === 'All' || b.dataset.c === cat ? '' : 'none';
    b.classList.toggle('on', sf ? b.dataset.id === sf.id : !fl.length && !b.dataset.id)
  });
  var fs = $('#fsel');
  if (!fl.length) {
    fs.innerHTML = '<div class="row"><b>No filter</b><small style="text-align:right">' + P.FL.length + ' filters · tap one to preview</small></div>';
    return
  }
  var chips = fl.map(function(l, i) {
    return '<button class="fchip' + (l === sf ? ' on' : '') + '" data-i="' + i + '">' + esc(fname(l.id)) + ' <i>' + Math.round(l.s * 100) + '%</i><span class="x" title="Remove">&times;</span></button>'
  }).join('') + '<button class="fchip add' + (sf ? '' : ' on') + '" data-i="' + fl.length + '">+ Add filter</button>';
  fs.innerHTML = '<div class="fchips">' + chips + '</div>' + (sf ? '<div id="fsS"></div>' : '<small class="fhint">Pick a filter below to stack it on top of ' + (fl.length > 1 ? 'the others' : esc(fname(fl[0].id))) + '.</small>');
  $$('#fsel .fchip').forEach(function(b) {
    b.onclick = function(e) {
      var i = +b.dataset.i;
      if (e.target.classList.contains('x')) {
        removeFilter(fl[i]);
        push('Removed filter');
        schedule()
      } else fPos = i;
      renderFilterGrid()
    }
  });
  if (!sf) return;
  mkSlider($('#fsS'), {
    label: fname(sf.id) + ' strength',
    min: 0,
    max: 100,
    fmt: function(v) {
      return v + '%'
    },
    get: function() {
      var l = selFilter();
      return l ? Math.round(l.s * 100) : 0
    },
    set: function(v) {
      var l = selFilter();
      if (l) l.s = v / 100
    },
    commit: function(v) {
      push('Filter strength ' + v + '%');
      renderFilterGrid()
    }
  }).sync()
}
var thumbJob = 0;

function refreshThumbs() {
  if (!small) return;
  if (tab === 'filters' && thumbsDirty) {
    thumbsDirty = false;
    genThumbs(P.FL.map(function(f) {
      return {
        c: thumbCanvases[f[0]],
        st: {
          geo: {},
          enh: S.enh,
          layers: [{
            t: 'adj',
            v: S.layers[0].v
          }, {
            t: 'flt',
            id: f[0],
            s: 1
          }],
          skin: false
        }
      }
    }), 96)
  }
  if (tab === 'presets' && presetDirty) {
    presetDirty = false;
    var it = [];
    $$('#pgrid .pc,#mygrid .pc').forEach(function(el) {
      var p = el._p;
      if (p) it.push({
        c: el.querySelector('canvas'),
        st: {
          geo: {},
          enh: S.enh,
          layers: [{
            t: 'adj',
            v: p
          }],
          skin: false
        },
        wide: 1
      })
    });
    genThumbs(it)
  }
}

function genThumbs(items) {
  var my = ++thumbJob,
    b0 = P.geo(small, S.geo),
    i = 0;
  (function step() {
    if (my !== thumbJob) return;
    var t0 = performance.now();
    while (i < items.length && performance.now() - t0 < 14) {
      var it = items[i++];
      if (!it.c) continue;
      var m = P.render(b0, it.st),
        c = it.c,
        x = c.getContext('2d');
      var tmp = document.createElement('canvas');
      putC(tmp, m);
      var cw = it.wide ? 150 : 96,
        ch = it.wide ? 100 : 96;
      c.width = cw;
      c.height = ch;
      var s = Math.max(cw / m.w, ch / m.h);
      x.imageSmoothingQuality = 'high';
      x.drawImage(tmp, (cw - m.w * s) / 2, (ch - m.h * s) / 2, m.w * s, m.h * s)
    }
    if (i < items.length) setTimeout(step, 0)
  })()
}

/* ---------- PRESETS PANE ---------- */
var PRESETS = [
  ['Bright & Airy', {
    exposure: 12,
    brightness: 15,
    contrast: -12,
    highlights: -20,
    shadows: 30,
    saturation: -10,
    warmth: 4,
    fade: 8
  }],
  ['Moody', {
    exposure: -10,
    contrast: 20,
    highlights: -25,
    shadows: -15,
    saturation: -25,
    warmth: -8,
    clarity: 15,
    vignette: 35
  }],
  ['Punchy', {
    contrast: 30,
    saturation: 18,
    vibrance: 25,
    clarity: 25,
    sharpen: 25
  }],
  ['Soft Portrait', {
    brightness: 8,
    contrast: -10,
    highlights: -15,
    shadows: 15,
    clarity: -25,
    warmth: 8,
    glow: 15
  }],
  ['Golden', {
    warmth: 35,
    tint: 6,
    exposure: 5,
    saturation: 10,
    glow: 20,
    vignette: 15
  }],
  ['Cool & Crisp', {
    warmth: -25,
    contrast: 15,
    clarity: 30,
    sharpen: 30,
    saturation: -5
  }],
  ['Matte', {
    contrast: -15,
    fade: 35,
    saturation: -15,
    shadows: 10
  }],
  ['High Key', {
    exposure: 30,
    brightness: 15,
    contrast: -20,
    highlights: -10,
    shadows: 40
  }],
  ['Low Key', {
    exposure: -25,
    contrast: 35,
    shadows: -35,
    highlights: -10,
    vignette: 40
  }],
  ['Drama', {
    contrast: 40,
    clarity: 55,
    highlights: -40,
    shadows: 25,
    saturation: -15,
    vignette: 30
  }],
  ['Food Pop', {
    warmth: 12,
    vibrance: 40,
    contrast: 12,
    clarity: 20,
    brightness: 8
  }],
  ['Landscape', {
    vibrance: 35,
    clarity: 35,
    highlights: -30,
    shadows: 20,
    contrast: 10,
    sharpen: 20
  }],
  ['Night Fix', {
    exposure: 35,
    shadows: 45,
    highlights: -25,
    denoise: 45,
    warmth: -5
  }],
  ['Backlit Fix', {
    shadows: 60,
    highlights: -45,
    contrast: -5,
    vibrance: 15
  }],
  ['Vintage Fade', {
    fade: 30,
    warmth: 18,
    saturation: -20,
    contrast: -10,
    grain: 30,
    vignette: 25
  }],
  ['Film Grain', {
    grain: 45,
    contrast: 10,
    fade: 10
  }]
];
var SHORT = {
  exposure: 'Exp',
  brightness: 'Bri',
  contrast: 'Con',
  highlights: 'Hi',
  shadows: 'Sh',
  warmth: 'Warm',
  tint: 'Tint',
  saturation: 'Sat',
  vibrance: 'Vib',
  clarity: 'Clar',
  sharpen: 'Shp',
  denoise: 'NR',
  fade: 'Fade',
  glow: 'Glow',
  vignette: 'Vig',
  grain: 'Grain'
};
var presetOn = null;

function loadMine() {
  try {
    return JSON.parse(localStorage.getItem('lumen.presets') || '[]')
  } catch (e) {
    return []
  }
}

function saveMine(a) {
  try {
    localStorage.setItem('lumen.presets', JSON.stringify(a));
    return true
  } catch (e) {
    toast('Couldn’t save: storage is blocked in this browser');
    return false
  }
}

function presetCard(name, v, mine, idx) {
  var el = document.createElement('button');
  el.className = 'pc';
  el._p = v;
  var ks = Object.keys(v).filter(function(k) {
    return v[k] && SHORT[k]
  }).sort(function(a, b) {
    return Math.abs(v[b]) - Math.abs(v[a])
  }).slice(0, 4);
  el.innerHTML = '<canvas width="150" height="100"></canvas><div class="pn">' + esc(name) + '</div><div class="pv">' + ks.map(function(k) {
    return '<i>' + SHORT[k] + ' ' + (v[k] > 0 ? '+' : '') + v[k] + '</i>'
  }).join('') + '</div>' + (mine ? '<span class="del" title="Delete">&times;</span>' : '');
  el.onclick = function(e) {
    if (e.target.classList.contains('del')) {
      var a = loadMine();
      a.splice(idx, 1);
      saveMine(a);
      renderMine();
      return
    }
    // Presets set the sliders; HSL and curves the user made stay unless the preset has its own.
    var keepH = base().hsl,
      keepC = base().curve;
    S.layers[0].v = clone(v);
    if (keepH && !v.hsl) S.layers[0].v.hsl = keepH;
    if (keepC && !v.curve) S.layers[0].v.curve = keepC;
    presetOn = name;
    push('Preset: ' + name);
    schedule();
    thumbsDirty = true;
    markPreset()
  };
  return el
}

function markPreset() {
  $$('.pc').forEach(function(p) {
    p.classList.toggle('on', p.querySelector('.pn').textContent === presetOn)
  })
}
(function() {
  var g = $('#pgrid');
  PRESETS.forEach(function(p) {
    g.appendChild(presetCard(p[0], p[1]))
  })
})();

function renderMine() {
  var g = $('#mygrid'),
    a = loadMine();
  g.innerHTML = '';
  if (!a.length) {
    g.style.display = 'block';
    g.innerHTML = '<div class="empty">Dial in sliders in Adjust, then save them here as your own preset.</div>';
    return
  }
  g.style.display = '';
  a.forEach(function(p, i) {
    g.appendChild(presetCard(p.name, p.v, true, i))
  });
  presetDirty = true;
  refreshThumbs()
}
$('#bSave').onclick = function() {
  var n = $('#pname').value.trim() || 'My preset ' + (loadMine().length + 1),
    v = {};
  Object.keys(base()).forEach(function(k) {
    if (k !== 'hsl' && base()[k]) v[k] = base()[k]
  });
  if (!Object.keys(v).length) {
    toast('Move some sliders in Adjust first');
    return
  }
  var a = loadMine();
  a.unshift({
    name: n,
    v: v
  });
  if (saveMine(a)) {
    $('#pname').value = '';
    renderMine();
    toast('Saved preset “' + n + '”')
  }
};
$('#pname').onkeydown = function(e) {
  if (e.key === 'Enter') $('#bSave').click()
};
