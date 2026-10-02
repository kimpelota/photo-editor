/* ============================================================
   TEXT ON PHOTOS (Canva-style)
   ============================================================ */
// S.texts: [{id, s, f (font), size (fraction of photo width), x, y (centre, fractions),
//   c (colour), c2 (effect colour), b, it, up, al, fx, ls, lh, curve, rot, op}]
// Text is drawn live over the preview, and onto the image at export.
var FONTS = [
  ['Montserrat', '"Montserrat", "Helvetica Neue", Arial, sans-serif'],
  ['Poppins', '"Poppins", "Helvetica Neue", Arial, sans-serif'],
  ['Bebas Neue', '"Bebas Neue", Impact, sans-serif'],
  ['Anton', '"Anton", Impact, sans-serif'],
  ['Oswald', '"Oswald", "Arial Narrow", sans-serif'],
  ['Archivo Black', '"Archivo Black", "Arial Black", sans-serif'],
  ['Playfair Display', '"Playfair Display", Georgia, serif'],
  ['Abril Fatface', '"Abril Fatface", Georgia, serif'],
  ['Cinzel', '"Cinzel", Georgia, serif'],
  ['Pacifico', '"Pacifico", cursive'],
  ['Dancing Script', '"Dancing Script", cursive'],
  ['Great Vibes', '"Great Vibes", cursive'],
  ['Lobster', '"Lobster", cursive'],
  ['Caveat', '"Caveat", cursive'],
  ['Permanent Marker', '"Permanent Marker", cursive'],
  ['Space Mono', '"Space Mono", "Courier New", monospace'],
  ['Helvetica', '"Helvetica Neue", Helvetica, Arial, sans-serif'],
  ['Georgia', 'Georgia, serif']
];
var FONT_CSS = {};
FONTS.forEach(function(f) {
  FONT_CSS[f[0]] = f[1]
});
var TEXT_FX = [
  ['none', 'None'],
  ['shadow', 'Shadow'],
  ['lift', 'Lift'],
  ['outline', 'Outline'],
  ['hollow', 'Hollow'],
  ['box', 'Background'],
  ['retro', 'Echo'],
  ['neon', 'Neon'],
  ['glitch', 'Glitch']
];
var SWATCHES = ['#ffffff', '#000000', '#e5202e', '#ff4d8d', '#ff8a1f', '#ffd23f', '#3ddc84', '#00c2ff', '#3d5afe', '#9b5cff', '#f3e9d2', '#7a5c3e'];
var textSel = null,
  textSeq = 0;

function texts() {
  if (!S.texts) S.texts = [];
  return S.texts
}

function selText() {
  return texts().filter(function(t) {
    return t.id === textSel
  })[0] || null
}

function newText(o) {
  var t = Object.assign({
    s: 'Your text',
    f: 'Montserrat',
    size: .08,
    x: .5,
    y: .5,
    c: '#ffffff',
    c2: '#e5202e',
    b: true,
    it: false,
    up: false,
    al: 'center',
    fx: 'shadow',
    ls: 0,
    lh: 1.15,
    curve: 0,
    rot: 0,
    op: 1
  }, o || {});
  t.id = 't' + Date.now().toString(36) + (textSeq++);
  return t
}

/* ---- fonts load on demand; canvas text doesn't trigger loading by itself ---- */
var fontsAsked = {};

function fontStr(t, px) {
  return (t.it ? 'italic ' : '') + (t.b ? 700 : 400) + ' ' + Math.max(1, px).toFixed(1) + 'px ' + (FONT_CSS[t.f] || FONT_CSS.Montserrat)
}

function needFont(t) {
  var k = fontStr(t, 40);
  if (fontsAsked[k] || !document.fonts) return;
  fontsAsked[k] = 1;
  document.fonts.load(k, t.s || 'A').then(function() {
    draw()
  }, function() {})
}

function textsReady(list) {
  if (!document.fonts) return Promise.resolve();
  return Promise.all((list || texts()).map(function(t) {
    return document.fonts.load(fontStr(t, 40), t.s || 'A').catch(function() {})
  }))
}

/* ---- layout + painting (shared by the live preview and export) ---- */
var tmeas = document.createElement('canvas').getContext('2d');

function textLines(t) {
  return String(t.up ? t.s.toUpperCase() : t.s).split('\n')
}

// Measure a text at image width W. Returns sizes in pixels, centred on (0,0).
function textBox(t, W, x) {
  x = x || tmeas;
  var px = t.size * W,
    lines = textLines(t);
  x.font = fontStr(t, px);
  if ('letterSpacing' in x) x.letterSpacing = (t.ls / 100 * px) + 'px';
  var ws = lines.map(function(l) {
      return x.measureText(l).width
    }),
    bw = Math.max.apply(0, ws.concat([px * .3])),
    lh = px * t.lh,
    bh = lh * lines.length,
    cv = curveInfo(t, bw, lines.length);
  if (cv) bh = px * 1.1 + cv.sag;
  return {
    px: px,
    lines: lines,
    ws: ws,
    bw: bw,
    bh: bh,
    lh: lh,
    cv: cv,
    pad: px * (t.fx === 'box' ? .35 : .12)
  }
}

function curveInfo(t, bw, n) {
  if (!t.curve || n !== 1) return null;
  var th = Math.abs(t.curve) / 100 * Math.PI * 1.5,
    r = bw / th;
  return {
    th: th,
    r: r,
    s: t.curve > 0 ? 1 : -1,
    sag: r * (1 - Math.cos(th / 2))
  }
}

// Draw every glyph run of the text at the origin (already translated/rotated).
function glyphs(x, t, L, mode, dx, dy) {
  dx = dx || 0;
  dy = dy || 0;
  var put = function(s, gx, gy) {
    mode === 'stroke' ? x.strokeText(s, gx + dx, gy + dy) : x.fillText(s, gx + dx, gy + dy)
  };
  if (L.cv) {
    var cv = L.cv,
      s = L.lines[0],
      acc = 0,
      ls = t.ls / 100 * L.px,
      tot = L.bw;
    x.textAlign = 'center';
    for (var i = 0; i < s.length; i++) {
      var cw = x.measureText(s[i]).width + ls,
        a = (acc + cw / 2 - tot / 2) / cv.r;
      x.save();
      x.translate(cv.r * Math.sin(a), cv.s * (cv.r - cv.r * Math.cos(a)) - cv.s * cv.sag / 2);
      x.rotate(cv.s * a);
      put(s[i], 0, L.px * .35);
      x.restore();
      acc += cw
    }
    return
  }
  x.textAlign = t.al;
  var ax = t.al === 'left' ? -L.bw / 2 : t.al === 'right' ? L.bw / 2 : 0;
  L.lines.forEach(function(l, i) {
    put(l, ax, -L.bh / 2 + L.lh * (i + .5) + L.px * .35)
  })
}

function rrPath(x, X, Y, W, H, r) {
  x.beginPath();
  x.moveTo(X + r, Y);
  x.arcTo(X + W, Y, X + W, Y + H, r);
  x.arcTo(X + W, Y + H, X, Y + H, r);
  x.arcTo(X, Y + H, X, Y, r);
  x.arcTo(X, Y, X + W, Y, r);
  x.closePath()
}

function mixHex(a, b, k) {
  var p = function(h) {
    h = h.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
  };
  var A = p(a),
    B = p(b);
  return 'rgb(' + A.map(function(v, i) {
    return Math.round(v + (B[i] - v) * k)
  }).join(',') + ')'
}

// Paint one text with its centre at (cx, cy) on a photo W pixels wide.
function paintText(x, t, cx, cy, W) {
  var L = textBox(t, W, x),
    px = L.px;
  x.save();
  x.translate(cx, cy);
  x.rotate(t.rot * Math.PI / 180);
  x.globalAlpha = t.op;
  x.font = fontStr(t, px);
  if ('letterSpacing' in x) x.letterSpacing = (L.cv ? 0 : t.ls / 100 * px) + 'px';
  x.textBaseline = 'alphabetic';
  x.lineJoin = 'round';
  var fx = t.fx;
  if (fx === 'box') {
    x.fillStyle = t.c2;
    rrPath(x, -L.bw / 2 - L.pad, -L.bh / 2 - L.pad * .6, L.bw + L.pad * 2, L.bh + L.pad * 1.2, px * .18);
    x.fill()
  }
  if (fx === 'retro') {
    x.fillStyle = t.c2;
    glyphs(x, t, L, 'fill', px * .07, px * .07)
  }
  if (fx === 'glitch') {
    x.globalAlpha = t.op * .9;
    x.fillStyle = '#00e5ff';
    glyphs(x, t, L, 'fill', -px * .045, 0);
    x.fillStyle = '#ff2fa0';
    glyphs(x, t, L, 'fill', px * .045, 0);
    x.globalAlpha = t.op
  }
  if (fx === 'shadow') {
    x.shadowColor = 'rgba(0,0,0,.55)';
    x.shadowBlur = px * .14;
    x.shadowOffsetY = px * .05
  }
  if (fx === 'lift') {
    x.shadowColor = 'rgba(0,0,0,.35)';
    x.shadowBlur = px * .45;
    x.shadowOffsetY = px * .14
  }
  if (fx === 'outline') {
    x.strokeStyle = t.c2;
    x.lineWidth = px * .12;
    glyphs(x, t, L, 'stroke')
  }
  if (fx === 'hollow') {
    x.strokeStyle = t.c;
    x.lineWidth = Math.max(1, px * .045);
    glyphs(x, t, L, 'stroke');
    x.restore();
    return L
  }
  if (fx === 'neon') {
    x.shadowColor = t.c;
    x.shadowBlur = px * .55;
    x.fillStyle = t.c;
    glyphs(x, t, L, 'fill');
    glyphs(x, t, L, 'fill');
    x.shadowBlur = px * .18;
    x.fillStyle = mixHex(t.c, '#ffffff', .65);
    glyphs(x, t, L, 'fill');
    x.restore();
    return L
  }
  x.fillStyle = t.c;
  glyphs(x, t, L, 'fill');
  x.restore();
  return L
}

// All texts onto a finished canvas (export, feed tiles, story templates).
function paintTexts(c, list) {
  list = list || texts();
  if (!list.length) return c;
  var x = c.getContext('2d');
  list.forEach(function(t) {
    paintText(x, t, t.x * c.width, t.y * c.height, c.width)
  });
  return c
}

// A copy of the preview with the text on it.
function withTexts(src) {
  if (!texts().length) return src;
  var c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  c.getContext('2d').drawImage(src, 0, 0);
  return paintTexts(c)
}

/* ---- on the photo: draw, select, move, resize, rotate ---- */
function textGeom(t, R) {
  var L = textBox(t, R.w),
    a = t.rot * Math.PI / 180;
  return {
    cx: R.x + t.x * R.w,
    cy: R.y + t.y * R.h,
    hw: L.bw / 2 + L.pad,
    hh: L.bh / 2 + L.pad * .6,
    a: a,
    L: L
  }
}

// Point in the text's own (unrotated) frame.
function local(G, px, py) {
  var dx = px - G.cx,
    dy = py - G.cy,
    c = Math.cos(-G.a),
    s = Math.sin(-G.a);
  return [dx * c - dy * s, dx * s + dy * c]
}

function world(G, lx, ly) {
  var c = Math.cos(G.a),
    s = Math.sin(G.a);
  return [G.cx + lx * c - ly * s, G.cy + lx * s + ly * c]
}

function textAt(px, py, R) {
  var L = texts();
  for (var i = L.length - 1; i >= 0; i--) {
    var G = textGeom(L[i], R),
      p = local(G, px, py);
    if (Math.abs(p[0]) <= G.hw + 6 && Math.abs(p[1]) <= G.hh + 6) return L[i]
  }
  return null
}

function handleAt(t, px, py, R) {
  var G = textGeom(t, R),
    p = local(G, px, py),
    hs = 11;
  if (Math.hypot(p[0], p[1] + G.hh + 30) < hs) return 'rot';
  var cs = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1]
  ];
  for (var i = 0; i < 4; i++)
    if (Math.abs(p[0] - cs[i][0] * G.hw) < hs && Math.abs(p[1] - cs[i][1] * G.hh) < hs) return 'size';
  return null
}

// What the preview shows: an AI plan waiting for Apply can bring its own text.
function viewTexts() {
  return vstate().texts || []
}

function textsVisible() {
  return tab !== 'crop' && viewTexts().length && afterC.width
}

var tGuide = null;

function drawTextLayer(x, R) {
  if (!textsVisible()) return;
  x.save();
  x.beginPath();
  x.rect(R.x, R.y, R.w, R.h);
  x.clip();
  viewTexts().forEach(function(t) {
    needFont(t);
    paintText(x, t, R.x + t.x * R.w, R.y + t.y * R.h, R.w)
  });
  x.restore();
  var t = tab === 'text' && selText();
  if (!t) return;
  var G = textGeom(t, R);
  x.save();
  if (tGuide) {
    x.strokeStyle = '#ff2d55';
    x.lineWidth = 1;
    x.setLineDash([]);
    if (tGuide.v) {
      x.beginPath();
      x.moveTo(R.x + R.w / 2, R.y);
      x.lineTo(R.x + R.w / 2, R.y + R.h);
      x.stroke()
    }
    if (tGuide.h) {
      x.beginPath();
      x.moveTo(R.x, R.y + R.h / 2);
      x.lineTo(R.x + R.w, R.y + R.h / 2);
      x.stroke()
    }
  }
  x.translate(G.cx, G.cy);
  x.rotate(G.a);
  x.strokeStyle = cssv('--ac');
  x.lineWidth = 1.5;
  x.setLineDash([5, 4]);
  x.strokeRect(-G.hw, -G.hh, G.hw * 2, G.hh * 2);
  x.setLineDash([]);
  x.beginPath();
  x.moveTo(0, -G.hh);
  x.lineTo(0, -G.hh - 22);
  x.stroke();
  x.fillStyle = '#fff';
  x.beginPath();
  x.arc(0, -G.hh - 30, 8, 0, 7);
  x.fill();
  x.stroke();
  [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1]
  ].forEach(function(c) {
    x.fillRect(c[0] * G.hw - 5, c[1] * G.hh - 5, 10, 10);
    x.strokeRect(c[0] * G.hw - 5, c[1] * G.hh - 5, 10, 10)
  });
  x.restore()
}

var tDrag = null;
var TEXT_TOOL = {
  down: function(e, R) {
    var px = e.offsetX,
      py = e.offsetY,
      t = selText(),
      h = t && handleAt(t, px, py, R);
    if (!h) {
      t = textAt(px, py, R);
      if (!t) {
        if (textSel) {
          textSel = null;
          renderTextPane();
          draw()
        }
        return false
      }
      if (t.id !== textSel) {
        textSel = t.id;
        renderTextPane()
      }
    }
    var G = textGeom(t, R);
    tDrag = {
      t: t,
      h: h || 'move',
      x0: px,
      y0: py,
      tx: t.x,
      ty: t.y,
      size: t.size,
      rot: t.rot,
      d0: Math.hypot(px - G.cx, py - G.cy) || 1,
      moved: false
    };
    draw();
    return true
  },
  move: function(e, R) {
    var D = tDrag;
    if (!D) return;
    var t = D.t,
      px = e.offsetX,
      py = e.offsetY;
    D.moved = true;
    if (D.h === 'move') {
      var nx = D.tx + (px - D.x0) / R.w,
        ny = D.ty + (py - D.y0) / R.h;
      tGuide = {
        v: Math.abs(nx - .5) < .012,
        h: Math.abs(ny - .5) < .012
      };
      t.x = tGuide.v ? .5 : nx;
      t.y = tGuide.h ? .5 : ny
    } else {
      var G = textGeom(t, R);
      if (D.h === 'size') t.size = Math.max(.01, Math.min(.6, D.size * Math.hypot(px - G.cx, py - G.cy) / D.d0));
      else {
        var a = Math.atan2(py - G.cy, px - G.cx) * 180 / Math.PI + 90;
        a = ((a + 540) % 360) - 180;
        // snap to straight and quarter turns
        [0, 90, -90, 180, -180].forEach(function(s) {
          if (Math.abs(a - s) < 4) a = s
        });
        t.rot = Math.round(a)
      }
    }
    syncTextControls()
  },
  up: function() {
    if (tDrag && tDrag.moved) push(tDrag.h === 'move' ? 'Move text' : tDrag.h === 'size' ? 'Resize text' : 'Rotate text');
    tDrag = null;
    tGuide = null;
    draw()
  },
  cursor: function(e, R) {
    var t = selText(),
      h = t && handleAt(t, e.offsetX, e.offsetY, R);
    if (h === 'rot') return 'grab';
    if (h === 'size') return 'nwse-resize';
    if (textAt(e.offsetX, e.offsetY, R)) return 'move';
    return R.w > R.cw - 40 || R.h > R.ch - 60 ? 'grab' : 'default'
  },
  draw: function() {}
};

var _stageTool = stageTool;
stageTool = function() {
  if (tab === 'text' && work) return TEXT_TOOL;
  return _stageTool()
};
var _drawT = draw;
draw = function() {
  _drawT();
  if (!afterC.width) return;
  var dpr = window.devicePixelRatio || 1;
  vctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawTextLayer(vctx, layout())
};
view.addEventListener('dblclick', function(e) {
  if (tab !== 'text' || !afterC.width) return;
  var t = textAt(e.offsetX, e.offsetY, layout());
  if (!t) return;
  textSel = t.id;
  renderTextPane();
  var ta = $('#txS');
  ta.focus();
  ta.select()
});

/* ---- the Text pane ---- */
var TEXT_STYLES = [
  ['Heading', {
    s: 'Add a heading',
    f: 'Montserrat',
    size: .1,
    b: true
  }],
  ['Subheading', {
    s: 'Add a subheading',
    f: 'Montserrat',
    size: .055,
    b: true,
    y: .6
  }],
  ['Body', {
    s: 'Add a little bit of body text',
    f: 'Poppins',
    size: .035,
    b: false,
    y: .68
  }],
  ['SUMMER', {
    s: 'SUMMER',
    f: 'Anton',
    size: .16,
    b: false,
    fx: 'outline',
    c: '#ffd23f',
    c2: '#e5202e',
    ls: 4
  }],
  ['Hello', {
    s: 'Hello there',
    f: 'Pacifico',
    size: .1,
    b: false,
    fx: 'lift'
  }],
  ['The Edit', {
    s: 'The Edit',
    f: 'Playfair Display',
    size: .12,
    b: false,
    it: true,
    fx: 'none'
  }],
  ['NEON', {
    s: 'NEON NIGHTS',
    f: 'Bebas Neue',
    size: .12,
    b: false,
    fx: 'neon',
    c: '#ff4d8d',
    ls: 6
  }],
  ['RETRO', {
    s: 'RETRO',
    f: 'Abril Fatface',
    size: .14,
    b: false,
    fx: 'retro',
    c: '#ffd23f',
    c2: '#e5202e'
  }],
  ['Label', {
    s: 'NEW DROP',
    f: 'Archivo Black',
    size: .05,
    b: false,
    fx: 'box',
    c: '#ffffff',
    c2: '#e5202e',
    ls: 8
  }],
  ['Curved', {
    s: 'GOOD VIBES ONLY',
    f: 'Bebas Neue',
    size: .08,
    b: false,
    fx: 'shadow',
    curve: 45,
    ls: 6
  }],
  ['Glitch', {
    s: 'GLITCH',
    f: 'Space Mono',
    size: .1,
    b: true,
    fx: 'glitch'
  }],
  ['Note', {
    s: 'little moments',
    f: 'Caveat',
    size: .09,
    b: true,
    fx: 'shadow',
    c: '#fff7e0',
    rot: -6
  }]
];

(function buildTextPane() {
  $('#txAdd').innerHTML = TEXT_STYLES.slice(0, 3).map(function(p, i) {
    var o = p[1];
    return '<button class="txadd" data-i="' + i + '" style="font:' + (o.b ? 700 : 400) + ' ' + [22, 16, 12][i] + 'px ' + FONT_CSS[o.f] + '">' + esc(o.s) + '</button>'
  }).join('');
  $('#txStyles').innerHTML = TEXT_STYLES.slice(3).map(function(p, i) {
    var o = p[1];
    return '<button class="txst" data-i="' + (i + 3) + '"><canvas width="150" height="80"></canvas></button>'
  }).join('');
  $$('#txAdd button,#txStyles button').forEach(function(b) {
    b.onclick = function() {
      addText(TEXT_STYLES[+b.dataset.i][1])
    }
  });
  $('#txFont').innerHTML = FONTS.map(function(f) {
    return '<option value="' + esc(f[0]) + '" style="font-family:' + esc(f[1]) + '">' + esc(f[0]) + '</option>'
  }).join('');
  $('#txFx').innerHTML = TEXT_FX.map(function(f) {
    return '<button data-v="' + f[0] + '">' + f[1] + '</button>'
  }).join('');
  $('#txSw').innerHTML = SWATCHES.map(function(c) {
    return '<button data-c="' + c + '" style="background:' + c + '" title="' + c + '"></button>'
  }).join('') + '<label class="swc" title="Any color"><input type="color" id="txCol"></label>';
  $('#txSw2').innerHTML = SWATCHES.map(function(c) {
    return '<button data-c="' + c + '" style="background:' + c + '" title="' + c + '"></button>'
  }).join('') + '<label class="swc" title="Any color"><input type="color" id="txCol2"></label>';
  var sl = $('#txSliders');
  [
    ['Size', 'size', 1, 60, function(v) {
      return v / 100
    }, function(t) {
      return Math.round(t.size * 100)
    }],
    ['Letter spacing', 'ls', -10, 60, null, null],
    ['Line height', 'lh', 70, 250, function(v) {
      return v / 100
    }, function(t) {
      return Math.round(t.lh * 100)
    }],
    ['Curve', 'curve', -100, 100, null, null],
    ['Rotate', 'rot', -180, 180, null, null],
    ['Opacity', 'op', 0, 100, function(v) {
      return v / 100
    }, function(t) {
      return Math.round(t.op * 100)
    }]
  ].forEach(function(d) {
    mkSlider(sl, {
      label: d[0],
      min: d[2],
      max: d[3],
      def: d[1] === 'op' ? 100 : d[1] === 'lh' ? 115 : d[1] === 'size' ? 8 : 0,
      live: false,
      get: function() {
        var t = selText();
        return t ? (d[5] ? d[5](t) : t[d[1]]) : 0
      },
      set: function(v) {
        var t = selText();
        if (!t) return;
        t[d[1]] = d[4] ? d[4](v) : v;
        draw()
      },
      commit: function() {
        if (selText()) push('Text ' + d[0].toLowerCase())
      }
    })
  })
})();

function drawStyleCards() {
  $$('#txStyles .txst').forEach(function(b) {
    var o = newText(TEXT_STYLES[+b.dataset.i][1]),
      c = b.querySelector('canvas'),
      x = c.getContext('2d');
    needFont(o);
    x.clearRect(0, 0, c.width, c.height);
    x.fillStyle = '#1b1b1b';
    x.fillRect(0, 0, c.width, c.height);
    // fit the sample in the card
    var W = 150,
      L = textBox(o, W);
    while ((L.bw + L.pad * 2 > 136 || L.bh + L.pad * 2 > 66) && o.size > .02) {
      o.size *= .9;
      L = textBox(o, W)
    }
    paintText(x, o, 75, 40, W)
  })
}

function addText(preset) {
  if (!work) return toast('Upload a photo first');
  var t = newText(clone(preset));
  // stagger new texts so they don't land exactly on top of each other
  var n = texts().length;
  if (preset.y == null) t.y = Math.min(.85, .4 + n * .07);
  texts().push(t);
  textSel = t.id;
  needFont(t);
  push('Add text');
  renderTextPane();
  draw();
  var ta = $('#txS');
  ta.focus();
  ta.select()
}

function syncTextControls() {
  var t = selText();
  SLIDERS.forEach(function(s) {
    if (s.closest && s.closest('#txSliders')) s.sync()
  });
  if (!t) return;
  if (document.activeElement !== $('#txS')) $('#txS').value = t.s;
  $('#txFont').value = t.f;
  $('#txB').classList.toggle('on', t.b);
  $('#txI').classList.toggle('on', t.it);
  $('#txU').classList.toggle('on', t.up);
  $$('#txAl button').forEach(function(b) {
    b.classList.toggle('on', b.dataset.v === t.al)
  });
  $$('#txFx button').forEach(function(b) {
    b.classList.toggle('on', b.dataset.v === t.fx)
  });
  $$('#txSw button').forEach(function(b) {
    b.classList.toggle('on', b.dataset.c.toLowerCase() === t.c.toLowerCase())
  });
  $$('#txSw2 button').forEach(function(b) {
    b.classList.toggle('on', b.dataset.c.toLowerCase() === t.c2.toLowerCase())
  });
  $('#txCol').value = /^#[0-9a-f]{6}$/i.test(t.c) ? t.c : '#ffffff';
  $('#txCol2').value = /^#[0-9a-f]{6}$/i.test(t.c2) ? t.c2 : '#e5202e';
  $('#txC2Row').hidden = !/^(outline|box|retro)$/.test(t.fx)
}

function renderTextPane() {
  if (textSel && !selText()) textSel = null;
  var t = selText(),
    L = texts();
  $('#txEdit').hidden = !t;
  $('#txHint').hidden = !!t;
  $('#txList').innerHTML = L.map(function(x) {
    return '<li class="' + (x.id === textSel ? 'on' : '') + '" data-id="' + x.id + '"><span style="font-family:' + esc(FONT_CSS[x.f]) + '">' + esc(x.s.split('\n')[0] || ' ') + '</span></li>'
  }).reverse().join('');
  $$('#txList li').forEach(function(li) {
    li.onclick = function() {
      textSel = li.dataset.id;
      renderTextPane();
      draw()
    }
  });
  $('#txListH').hidden = !L.length;
  syncTextControls()
}

function editText(fn, label) {
  var t = selText();
  if (!t) return;
  fn(t);
  needFont(t);
  push(label);
  syncTextControls();
  draw()
}
var txT;
$('#txS').oninput = function() {
  var t = selText();
  if (!t) return;
  t.s = this.value;
  needFont(t);
  draw();
  clearTimeout(txT);
  txT = setTimeout(function() {
    push('Edit text');
    renderTextPane()
  }, 500)
};
$('#txFont').onchange = function() {
  var v = this.value;
  editText(function(t) {
    t.f = v
  }, 'Font: ' + v)
};
$('#txB').onclick = function() {
  editText(function(t) {
    t.b = !t.b
  }, 'Bold')
};
$('#txI').onclick = function() {
  editText(function(t) {
    t.it = !t.it
  }, 'Italic')
};
$('#txU').onclick = function() {
  editText(function(t) {
    t.up = !t.up
  }, 'Uppercase')
};
$$('#txAl button').forEach(function(b) {
  b.onclick = function() {
    editText(function(t) {
      t.al = b.dataset.v
    }, 'Align ' + b.dataset.v)
  }
});
$('#txFx').onclick = function(e) {
  var b = e.target.closest('button');
  if (b) editText(function(t) {
    t.fx = b.dataset.v
  }, 'Text effect: ' + b.textContent)
};
$('#txSw').onclick = function(e) {
  var b = e.target.closest('button');
  if (b) editText(function(t) {
    t.c = b.dataset.c
  }, 'Text color')
};
$('#txSw2').onclick = function(e) {
  var b = e.target.closest('button');
  if (b) editText(function(t) {
    t.c2 = b.dataset.c
  }, 'Effect color')
};
$('#txCol').oninput = function() {
  var t = selText();
  if (!t) return;
  t.c = this.value;
  draw()
};
$('#txCol').onchange = function() {
  if (selText()) push('Text color');
  syncTextControls()
};
$('#txCol2').oninput = function() {
  var t = selText();
  if (!t) return;
  t.c2 = this.value;
  draw()
};
$('#txCol2').onchange = function() {
  if (selText()) push('Effect color');
  syncTextControls()
};
$('#txDup').onclick = function() {
  var t = selText();
  if (!t) return;
  var n = newText(clone(t));
  n.x = Math.min(.95, t.x + .04);
  n.y = Math.min(.95, t.y + .04);
  texts().push(n);
  textSel = n.id;
  push('Duplicate text');
  renderTextPane();
  draw()
};
$('#txDel').onclick = function() {
  var L = texts(),
    i = L.indexOf(selText());
  if (i < 0) return;
  L.splice(i, 1);
  textSel = null;
  push('Delete text');
  renderTextPane();
  draw()
};

function moveLayer(d) {
  var L = texts(),
    i = L.indexOf(selText()),
    j = i + d;
  if (i < 0 || j < 0 || j >= L.length) return;
  L.splice(j, 0, L.splice(i, 1)[0]);
  push(d > 0 ? 'Bring text forward' : 'Send text back');
  renderTextPane();
  draw()
}
$('#txUp').onclick = function() {
  moveLayer(1)
};
$('#txDown').onclick = function() {
  moveLayer(-1)
};
$('#txCenter').onclick = function() {
  editText(function(t) {
    t.x = .5
  }, 'Center text')
};

document.addEventListener('keydown', function(e) {
  if (tab !== 'text' || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
  var t = selText();
  if (!t) return;
  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    $('#txDel').click()
  } else if (/^Arrow/.test(e.key)) {
    e.preventDefault();
    var st = e.shiftKey ? .02 : .004;
    if (e.key === 'ArrowLeft') t.x -= st;
    if (e.key === 'ArrowRight') t.x += st;
    if (e.key === 'ArrowUp') t.y -= st;
    if (e.key === 'ArrowDown') t.y += st;
    draw();
    clearTimeout(txT);
    txT = setTimeout(function() {
      push('Nudge text')
    }, 400)
  }
});

/* ---- hooks ---- */
$$('.tab').forEach(function(b) {
  b.addEventListener('click', function() {
    if (tab === 'text') {
      renderTextPane();
      drawStyleCards()
    }
    draw()
  })
});
var _syncUIT = syncUI;
syncUI = function() {
  _syncUIT();
  if (tab === 'text') renderTextPane();
  draw()
};
if (document.fonts) document.fonts.addEventListener('loadingdone', function() {
  draw();
  if (tab === 'text') drawStyleCards()
});
