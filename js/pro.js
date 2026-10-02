/* ============================================================
   PRO TOOLS: overlays & frames, copy/paste + batch edits,
   story templates, feed planner
   ============================================================ */
function fxState() {
  if (!S.fx) S.fx = {
    ov: [],
    fr: null
  };
  return S.fx
}

/* ---------- OVERLAYS & FRAMES PANE ---------- */
var ovThumbs = {},
  frThumbs = {},
  ovDirty = true;
(function() {
  $('#ovGrid').innerHTML = P.OV.map(function(o) {
    return '<button class="ft" data-id="' + o[0] + '"><canvas width="96" height="96"></canvas><span>' + esc(o[1]) + '</span></button>'
  }).join('');
  $('#frGrid').innerHTML = '<button class="ft" data-id=""><div class="none">&#8856;</div><span>No frame</span></button>' + P.FR.map(function(f) {
    return '<button class="ft" data-id="' + f[0] + '"><canvas width="96" height="96"></canvas><span>' + esc(f[1]) + '</span></button>'
  }).join('');
  $$('#ovGrid .ft').forEach(function(b) {
    ovThumbs[b.dataset.id] = b.querySelector('canvas');
    b.onclick = function() {
      if (!work) return toast('Upload a photo first');
      var fx = fxState();
      fx.ov.push({
        id: b.dataset.id,
        a: .7,
        sd: 1 + Math.floor(Math.random() * 999)
      });
      push('Overlay: ' + b.querySelector('span').textContent);
      schedule();
      renderOverlays()
    }
  });
  $$('#frGrid .ft').forEach(function(b) {
    if (b.dataset.id) frThumbs[b.dataset.id] = b.querySelector('canvas');
    b.onclick = function() {
      if (!work) return toast('Upload a photo first');
      fxState().fr = b.dataset.id || null;
      push(b.dataset.id ? 'Frame: ' + b.querySelector('span').textContent : 'No frame');
      schedule();
      renderOverlays()
    }
  })
})();

function ovName(id) {
  return (P.OV.filter(function(o) {
    return o[0] === id
  })[0] || [id, id])[1]
}

function renderOverlays() {
  var fx = S.fx || {
      ov: [],
      fr: null
    },
    ul = $('#ovList');
  $('#ovEmpty').hidden = fx.ov.length > 0;
  ul.innerHTML = '';
  fx.ov.forEach(function(o, i) {
    var li = document.createElement('li');
    li.innerHTML = '<div class="ovh"><b>' + esc(ovName(o.id)) + '</b><button class="btn ghost" data-a="shuf" title="Try a different random variation">Shuffle</button><button class="x" data-a="rm" title="Remove">&times;</button></div>';
    mkSlider(li, {
      label: 'Strength',
      min: 0,
      max: 100,
      def: 70,
      get: function() {
        return Math.round(o.a * 100)
      },
      set: function(v) {
        o.a = v / 100
      },
      commit: function() {
        push(ovName(o.id) + ' strength')
      }
    }).sync();
    li.querySelector('[data-a="shuf"]').onclick = function() {
      o.sd = 1 + Math.floor(Math.random() * 9999);
      push('Shuffle ' + ovName(o.id));
      schedule()
    };
    li.querySelector('[data-a="rm"]').onclick = function() {
      fx.ov.splice(i, 1);
      push('Removed ' + ovName(o.id));
      schedule();
      renderOverlays()
    };
    ul.appendChild(li)
  });
  $$('#frGrid .ft').forEach(function(b) {
    b.classList.toggle('on', (b.dataset.id || null) === (fx.fr || null))
  })
}

function refreshOverlayThumbs() {
  if (!small || tab !== 'overlays' || !ovDirty) return;
  ovDirty = false;
  var base = function(fx) {
    return {
      geo: {},
      enh: S.enh,
      layers: S.layers,
      skin: false,
      fx: fx
    }
  };
  genThumbs(P.OV.map(function(o) {
    return {
      c: ovThumbs[o[0]],
      st: base({
        ov: [{
          id: o[0],
          a: .85,
          sd: 3
        }]
      })
    }
  }).concat(P.FR.map(function(f) {
    return {
      c: frThumbs[f[0]],
      st: base({
        ov: [],
        fr: f[0]
      })
    }
  })))
}

/* ---------- COPY / PASTE EDITS ---------- */
var CLIP_KEY = 'kiss.copiedEdits';
$('#bCopyE').onclick = function() {
  if (!work) return toast('Upload a photo first');
  var c = {
    layers: S.layers,
    enh: S.enh ? S.enh.amt : null,
    skin: S.skin,
    fx: S.fx,
    crop: S.geo.crop,
    ang: S.geo.ang
  };
  try {
    localStorage.setItem(CLIP_KEY, JSON.stringify(c))
  } catch (e) {}
  window.__clip = c;
  toast('Edits copied. Open another photo and press Paste edits')
};
$('#bPasteE').onclick = function() {
  if (!work) return toast('Upload a photo first');
  var c = window.__clip;
  if (!c) try {
    c = JSON.parse(localStorage.getItem(CLIP_KEY) || 'null')
  } catch (e) {}
  if (!c) return toast('Nothing copied yet. Press Copy edits on a photo you like');
  pasteEdits(S, c, work);
  push('Paste edits');
  thumbsDirty = presetDirty = ovDirty = true;
  schedule();
  syncUI();
  renderOverlays();
  refreshThumbs();
  toast('Edits pasted')
};

// Copied edits onto a state; the enhancer is re-measured for the new photo.
function pasteEdits(st, c, src) {
  st.layers = clone(c.layers);
  st.skin = !!c.skin;
  st.fx = clone(c.fx || {
    ov: [],
    fr: null
  });
  st.geo.crop = c.crop || null;
  st.geo.rect = null;
  st.geo.ang = c.ang || 0;
  st.enh = null;
  if (c.enh != null && src) {
    st.enh = P.analyze(P.geo(src, st.geo));
    st.enh.amt = c.enh
  }
  return st
}

/* ---------- BATCH EXPORT ---------- */
$('#exBatch').onclick = function() {
  if (!work) return toast('Upload and edit a photo first');
  $('#batchFile').click()
};
$('#batchFile').onchange = function() {
  var files = Array.prototype.slice.call(this.files);
  this.value = '';
  if (!files.length) return;
  var b = $('#exBatch'),
    c0 = {
      layers: S.layers,
      enh: S.enh ? S.enh.amt : null,
      skin: S.skin,
      fx: S.fx,
      crop: S.geo.crop,
      ang: S.geo.ang
    },
    masks = (S.masks || []).filter(function(m) {
      return !MASK_TYPES[m.type] || !MASK_TYPES[m.type].ai
    }),
    done = 0,
    fail = 0;
  b.disabled = true;
  files.reduce(function(chain, f, n) {
    return chain.then(function() {
      b.textContent = 'Exporting ' + (n + 1) + ' of ' + files.length + '…';
      return loadImg(f).then(function(im) {
        var src = raster(im, im.naturalWidth, im.naturalHeight, 1e9, P.MAX_PX),
          sm = raster(im, im.naturalWidth, im.naturalHeight, 1280),
          st = pasteEdits(fresh(), c0, sm);
        st.masks = clone(masks);
        if (ex.s > 1) {
          st.up = clone(S.up);
          st.up.f = ex.s;
          st.up.k = isAI(st.up.k) ? 'lanczos' : st.up.k
        }
        sendSrc('batch', src);
        return job({
          type: 'render',
          key: 'batch',
          st: st,
          up: ex.s > 1,
          cache: false
        })
      }).then(function(m) {
        return saveRender(m, f.name.replace(/\.[^.]+$/, '') + '-studio-de-nuance').then(function() {
          done++
        })
      }).catch(function(e) {
        console.error(e);
        fail++
      })
    })
  }, Promise.resolve()).then(function() {
    b.disabled = false;
    b.textContent = 'Choose photos…';
    toast('Batch done: ' + done + ' exported' + (fail ? ', ' + fail + ' failed' : ''), 4000)
  })
};

function loadImg(f) {
  return new Promise(function(res, rej) {
    var u = URL.createObjectURL(f),
      im = new Image();
    im.onload = function() {
      res(im);
      URL.revokeObjectURL(u)
    };
    im.onerror = function() {
      rej(new Error('Couldn’t read ' + f.name));
      URL.revokeObjectURL(u)
    };
    im.src = u
  })
}

function saveRender(m, base) {
  return new Promise(function(res) {
    var c = document.createElement('canvas');
    putC(c, m);
    c.toBlob(function(blob) {
      var a = document.createElement('a'),
        u = URL.createObjectURL(blob);
      a.href = u;
      a.download = base + '.' + (ex.f === 'png' ? 'png' : 'jpg');
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function() {
        URL.revokeObjectURL(u);
        res()
      }, 400)
    }, 'image/' + ex.f, ex.q / 100)
  })
}

/* ---------- STORY TEMPLATES ---------- */
var TW = 1080,
  TH = 1920,
  SERIF = 'Didot, "Bodoni 72", "Playfair Display", Georgia, serif',
  HAND = '"Marker Felt", "Bradley Hand", "Segoe Print", "Comic Sans MS", cursive',
  TSANS = '"Helvetica Neue", Helvetica, Arial, sans-serif',
  TMONO = '"Courier New", Courier, monospace';

// Draw `img` to fill the box (cropping the overflow), with optional zoom and focus.
function cover(x, img, bx, by, bw, bh, zoom, fx, fy) {
  zoom = zoom || 1;
  var s = Math.max(bw / img.width, bh / img.height) * zoom,
    sw = bw / s,
    sh = bh / s,
    sx = (img.width - sw) * (fx == null ? .5 : fx),
    sy = (img.height - sh) * (fy == null ? .5 : fy);
  x.drawImage(img, sx, sy, sw, sh, bx, by, bw, bh)
}

function rr(x, X, Y, W, H, r) {
  x.beginPath();
  x.moveTo(X + r, Y);
  x.arcTo(X + W, Y, X + W, Y + H, r);
  x.arcTo(X + W, Y + H, X, Y + H, r);
  x.arcTo(X, Y + H, X, Y, r);
  x.arcTo(X, Y, X + W, Y, r);
  x.closePath()
}

function noiseBg(x, col, amt) {
  x.fillStyle = col;
  x.fillRect(0, 0, TW, TH);
  var id = x.getImageData(0, 0, TW, TH),
    d = id.data;
  for (var i = 0; i < d.length; i += 4) {
    var n = (Math.random() - .5) * amt;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n
  }
  x.putImageData(id, 0, 0)
}

function fitFont(x, txt, font, size, maxW) {
  do {
    x.font = font.replace('{s}', size);
    size -= 4
  } while (x.measureText(txt).width > maxW && size > 20);
  return size + 4
}

function star(x, cx, cy, r, col) {
  x.save();
  x.fillStyle = col;
  x.beginPath();
  for (var i = 0; i < 8; i++) {
    var a = i * Math.PI / 4,
      rad = i % 2 ? r * .28 : r;
    x.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad)
  }
  x.closePath();
  x.fill();
  x.restore()
}

// A few colours that sum up the photo, for the moodboard.
function palette(img, k) {
  var c = document.createElement('canvas');
  c.width = c.height = 40;
  var x = c.getContext('2d');
  x.drawImage(img, 0, 0, 40, 40);
  var d = x.getImageData(0, 0, 40, 40).data,
    px = [];
  for (var i = 0; i < d.length; i += 4) px.push([d[i], d[i + 1], d[i + 2]]);
  var C = [];
  for (i = 0; i < k; i++) C.push(px[Math.floor((i + .5) / k * px.length)].slice());
  for (var it = 0; it < 8; it++) {
    var S2 = C.map(function() {
      return [0, 0, 0, 0]
    });
    px.forEach(function(p) {
      var b = 0,
        bd = 1e9;
      C.forEach(function(q, j) {
        var dd = (p[0] - q[0]) * (p[0] - q[0]) + (p[1] - q[1]) * (p[1] - q[1]) + (p[2] - q[2]) * (p[2] - q[2]);
        if (dd < bd) {
          bd = dd;
          b = j
        }
      });
      S2[b][0] += p[0];
      S2[b][1] += p[1];
      S2[b][2] += p[2];
      S2[b][3]++
    });
    C = S2.map(function(s, j) {
      return s[3] ? [s[0] / s[3], s[1] / s[3], s[2] / s[3]] : C[j]
    })
  }
  return C.sort(function(a, b) {
    return (a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2])
  }).map(function(c) {
    return '#' + c.map(function(v) {
      return ('0' + Math.round(v).toString(16)).slice(-2)
    }).join('')
  })
}

var TEMPLATES = [
  ['film', 'Film Strip', function(x, img, T) {
    x.fillStyle = '#0d0d0d';
    x.fillRect(0, 0, TW, TH);
    x.fillStyle = '#1a1a1a';
    x.fillRect(130, 0, 820, TH);
    x.fillStyle = '#e8e2d6';
    for (var y = 20; y < TH; y += 64) {
      rr(x, 158, y, 34, 40, 6);
      x.fill();
      rr(x, 888, y, 34, 40, 6);
      x.fill()
    }
    [
      [150, 1.25, .2],
      [700, 1, .5],
      [1250, 1.35, .8]
    ].forEach(function(f, i) {
      x.save();
      cover(x, img, 220, f[0], 640, 500, f[1], f[2], .5);
      if (i !== 1) {
        x.fillStyle = 'rgba(0,0,0,.35)';
        x.fillRect(220, f[0], 640, 500)
      }
      x.restore()
    });
    x.save();
    x.translate(205, 960);
    x.rotate(-Math.PI / 2);
    x.fillStyle = '#f0a030';
    x.font = 'bold 26px ' + TSANS;
    x.textAlign = 'center';
    x.fillText('NUANCE 400   ▸ 12   ▸ 12A   NUANCE 400', 0, 0);
    x.restore();
    x.fillStyle = '#f2f2f2';
    x.textAlign = 'center';
    x.font = 'bold 60px ' + TMONO;
    x.fillText(T.title.toUpperCase(), TW / 2, 1830);
    x.font = '30px ' + TMONO;
    x.fillStyle = '#9a9a9a';
    x.fillText(T.sub, TW / 2, 1880)
  }],
  ['polaroid', 'Polaroid', function(x, img, T) {
    noiseBg(x, '#e8e2d6', 14);
    x.save();
    x.translate(540, 880);
    x.rotate(-.06);
    x.shadowColor = 'rgba(0,0,0,.28)';
    x.shadowBlur = 40;
    x.shadowOffsetY = 18;
    x.fillStyle = '#fbfaf6';
    x.fillRect(-390, -470, 780, 960);
    x.shadowColor = 'transparent';
    cover(x, img, -350, -430, 700, 700);
    x.fillStyle = '#2b2b2b';
    x.textAlign = 'center';
    fitFont(x, T.title, '{s}px ' + HAND, 76, 680);
    x.fillText(T.title, 0, 390);
    x.fillStyle = 'rgba(214,196,150,.75)';
    x.rotate(.12);
    x.fillRect(-120, -520, 240, 80);
    x.restore();
    x.fillStyle = '#5a5248';
    x.textAlign = 'center';
    x.font = '40px ' + HAND;
    x.fillText(T.sub, TW / 2, 1560)
  }],
  ['magazine', 'Magazine', function(x, img, T) {
    cover(x, img, 0, 0, TW, TH);
    var g = x.createLinearGradient(0, 0, 0, 700);
    g.addColorStop(0, 'rgba(0,0,0,.55)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, TW, 700);
    var g2 = x.createLinearGradient(0, TH - 700, 0, TH);
    g2.addColorStop(0, 'rgba(0,0,0,0)');
    g2.addColorStop(1, 'rgba(0,0,0,.6)');
    x.fillStyle = g2;
    x.fillRect(0, TH - 700, TW, 700);
    x.fillStyle = '#fff';
    x.textAlign = 'center';
    fitFont(x, T.title.toUpperCase(), 'bold {s}px ' + SERIF, 230, 1000);
    x.fillText(T.title.toUpperCase(), TW / 2, 290);
    x.font = '600 28px ' + TSANS;
    x.textAlign = 'left';
    x.fillText('ISSUE 07  ·  ' + new Date().toLocaleString('en', {
      month: 'long'
    }).toUpperCase(), 60, 360);
    x.font = 'bold 54px ' + TSANS;
    x.fillText(T.sub.toUpperCase().slice(0, 22), 60, 1560);
    x.font = '34px ' + SERIF;
    x.fillText('the edit everyone is talking about', 60, 1620);
    x.fillStyle = '#e5202e';
    x.font = 'bold 34px ' + TSANS;
    x.fillText('EXCLUSIVE', 60, 1500);
    x.fillStyle = '#fff';
    x.fillRect(880, 1690, 150, 150);
    x.fillStyle = '#000';
    for (var i = 0, bx = 892; bx < 1018; i++) {
      var bw = 2 + (i * 7 % 5);
      x.fillRect(bx, 1702, bw, 104);
      bx += bw + 2 + (i * 3 % 3)
    }
    x.font = '16px ' + TMONO;
    x.fillText('0 72 1081 9', 892, 1828)
  }],
  ['editorial', 'Editorial', function(x, img, T) {
    x.fillStyle = '#f3efe7';
    x.fillRect(0, 0, TW, TH);
    x.fillStyle = '#1b1b1b';
    x.font = '600 24px ' + TSANS;
    x.textAlign = 'left';
    x.fillText('VOL. 01 — THE EDITORIAL', 80, 120);
    x.fillRect(80, 145, 920, 2);
    cover(x, img, 80, 190, 920, 1120);
    x.font = 'italic 112px ' + SERIF;
    fitFont(x, T.title, 'italic {s}px ' + SERIF, 112, 920);
    x.fillText(T.title, 80, 1460);
    x.fillRect(80, 1510, 920, 2);
    x.font = '34px ' + TSANS;
    x.fillStyle = '#555';
    x.fillText(T.sub, 80, 1580);
    x.font = '24px ' + TSANS;
    x.fillText('Photographed & edited with Studio de Nuance', 80, 1800)
  }],
  ['y2k', 'Y2K', function(x, img, T) {
    var g = x.createLinearGradient(0, 0, TW, TH);
    g.addColorStop(0, '#ff9de2');
    g.addColorStop(.5, '#b9c6ff');
    g.addColorStop(1, '#a8f0d0');
    x.fillStyle = g;
    x.fillRect(0, 0, TW, TH);
    [
      [140, 220, 50],
      [930, 330, 70],
      [880, 1640, 44],
      [170, 1500, 64],
      [560, 140, 30],
      [980, 1100, 34]
    ].forEach(function(s) {
      star(x, s[0], s[1], s[2], '#fff')
    });
    x.save();
    x.shadowColor = 'rgba(80,0,120,.35)';
    x.shadowBlur = 30;
    x.shadowOffsetY = 14;
    rr(x, 110, 420, 860, 980, 26);
    x.fillStyle = '#f7f7fb';
    x.fill();
    x.restore();
    var tb = x.createLinearGradient(0, 420, 0, 490);
    tb.addColorStop(0, '#e9e9f2');
    tb.addColorStop(1, '#c9c9d8');
    x.fillStyle = tb;
    rr(x, 110, 420, 860, 70, 26);
    x.fill();
    ['#ff5f57', '#febc2e', '#28c840'].forEach(function(c, i) {
      x.fillStyle = c;
      x.beginPath();
      x.arc(160 + i * 40, 455, 13, 0, 7);
      x.fill()
    });
    cover(x, img, 140, 510, 800, 860);
    x.textAlign = 'center';
    x.font = '900 120px "Arial Rounded MT Bold", ' + TSANS;
    fitFont(x, T.title, '900 {s}px "Arial Rounded MT Bold", ' + TSANS, 120, 960);
    x.lineWidth = 14;
    x.strokeStyle = '#fff';
    x.strokeText(T.title, TW / 2, 1600);
    x.fillStyle = '#ff3fa4';
    x.fillText(T.title, TW / 2, 1600);
    x.font = 'bold 38px ' + TSANS;
    x.fillStyle = '#5a3b8c';
    x.fillText(T.sub, TW / 2, 1690)
  }],
  ['minimal', 'Minimal', function(x, img, T) {
    x.fillStyle = '#ffffff';
    x.fillRect(0, 0, TW, TH);
    var w = 840,
      h = Math.min(1200, w * img.height / img.width);
    cover(x, img, (TW - w) / 2, (TH - h) / 2 - 80, w, h);
    x.fillStyle = '#111';
    x.textAlign = 'center';
    x.font = '500 30px ' + TSANS;
    if (x.letterSpacing !== undefined) x.letterSpacing = '10px';
    x.fillText(T.title.toUpperCase(), TW / 2, (TH + h) / 2 + 20);
    if (x.letterSpacing !== undefined) x.letterSpacing = '2px';
    x.font = '24px ' + TSANS;
    x.fillStyle = '#888';
    x.fillText(T.sub, TW / 2, (TH + h) / 2 + 70);
    if (x.letterSpacing !== undefined) x.letterSpacing = '0px'
  }],
  ['moodboard', 'Moodboard', function(x, img, T) {
    x.fillStyle = '#f6f3ee';
    x.fillRect(0, 0, TW, TH);
    cover(x, img, 60, 60, 960, 820);
    [
      [60, 900, 1.8, .2, .3],
      [550, 900, 2.2, .8, .4],
      [60, 1290, 2.6, .5, .8],
      [550, 1290, 1.5, .3, .6]
    ].forEach(function(t) {
      cover(x, img, t[0], t[1], 470, 370, t[2], t[3], t[4])
    });
    var pal = palette(img, 5);
    pal.forEach(function(c, i) {
      x.fillStyle = c;
      x.fillRect(60 + i * 196, 1690, 176, 110);
      x.fillStyle = '#444';
      x.font = '22px ' + TMONO;
      x.textAlign = 'left';
      x.fillText(c.toUpperCase(), 60 + i * 196, 1830)
    });
    x.fillStyle = '#1b1b1b';
    x.font = 'italic 54px ' + SERIF;
    x.fillText(T.title, 60, 1900 - 20)
  }],
  ['scrapbook', 'Scrapbook', function(x, img, T) {
    noiseBg(x, '#c9a87c', 22);
    x.save();
    x.translate(380, 620);
    x.rotate(-.1);
    x.shadowColor = 'rgba(0,0,0,.3)';
    x.shadowBlur = 24;
    x.fillStyle = '#fff';
    x.fillRect(-250, -300, 500, 600);
    x.shadowColor = 'transparent';
    cover(x, img, -225, -275, 450, 550, 1.6, .2, .4);
    x.restore();
    x.save();
    x.translate(600, 1050);
    x.rotate(.06);
    x.shadowColor = 'rgba(0,0,0,.35)';
    x.shadowBlur = 30;
    x.fillStyle = '#fff';
    x.fillRect(-400, -360, 800, 720);
    x.shadowColor = 'transparent';
    cover(x, img, -370, -330, 740, 660);
    x.fillStyle = 'rgba(240,230,190,.8)';
    x.rotate(-.3);
    x.fillRect(-470, -330, 200, 60);
    x.rotate(.55);
    x.fillRect(260, -480, 200, 60);
    x.restore();
    x.strokeStyle = '#7a1f2b';
    x.lineWidth = 6;
    x.lineCap = 'round';
    [
      [880, 260],
      [170, 1580],
      [930, 1650]
    ].forEach(function(p) {
      x.beginPath();
      x.moveTo(p[0], p[1] + 20);
      x.bezierCurveTo(p[0] - 40, p[1] - 20, p[0] - 10, p[1] - 45, p[0], p[1] - 15);
      x.bezierCurveTo(p[0] + 10, p[1] - 45, p[0] + 40, p[1] - 20, p[0], p[1] + 20);
      x.stroke()
    });
    x.fillStyle = '#2a1a10';
    x.textAlign = 'center';
    fitFont(x, T.title, '{s}px ' + HAND, 96, 920);
    x.fillText(T.title, TW / 2, 1620);
    x.font = '40px ' + HAND;
    x.fillText(T.sub, TW / 2, 1700)
  }],
  ['nineties', '90s', function(x, img, T) {
    x.fillStyle = '#111';
    x.fillRect(0, 0, TW, TH);
    for (var r = 0; r < 2; r++)
      for (var c = 0; c < 18; c++) {
        x.fillStyle = (r + c) % 2 ? '#fff' : '#111';
        x.fillRect(c * 60, r * 60, 60, 60);
        x.fillRect(c * 60, TH - 120 + r * 60, 60, 60)
      }
    x.fillStyle = '#000';
    x.fillRect(90, 380, 900, 1060);
    cover(x, img, 120, 410, 840, 1000);
    x.fillStyle = '#ff8a1f';
    x.font = 'bold 44px ' + TMONO;
    x.textAlign = 'right';
    x.shadowColor = '#ff6a00';
    x.shadowBlur = 12;
    x.fillText("'98 7 14", 930, 1380);
    x.shadowBlur = 0;
    x.textAlign = 'center';
    fitFont(x, T.title.toUpperCase(), 'italic 900 {s}px Impact, "Arial Black", ' + TSANS, 150, 980);
    x.fillStyle = '#00e5ff';
    x.fillText(T.title.toUpperCase(), TW / 2 + 8, 300 + 8);
    x.fillStyle = '#ff2fa0';
    x.fillText(T.title.toUpperCase(), TW / 2, 300);
    x.font = 'bold 40px ' + TMONO;
    x.fillStyle = '#f2f2f2';
    x.fillText(T.sub, TW / 2, 1580)
  }],
  ['sketch', 'Sketch', function(x, img, T) {
    x.fillStyle = '#fdfcf8';
    x.fillRect(0, 0, TW, TH);
    x.strokeStyle = 'rgba(80,120,200,.12)';
    x.lineWidth = 2;
    for (var g = 0; g < TH; g += 48) {
      x.beginPath();
      x.moveTo(0, g);
      x.lineTo(TW, g);
      x.stroke()
    }
    cover(x, img, 150, 360, 780, 960);
    x.strokeStyle = '#222';
    x.lineWidth = 4;
    x.lineCap = 'round';
    // wobbly hand-drawn frame, drawn twice
    for (var k = 0; k < 2; k++) {
      x.beginPath();
      var pts = [
        [130, 340],
        [950, 335],
        [955, 1340],
        [128, 1345],
        [132, 332]
      ];
      pts.forEach(function(p, i) {
        var j = (k * 13 + i * 7) % 9 - 4;
        i ? x.lineTo(p[0] + j, p[1] - j) : x.moveTo(p[0] + j, p[1] + j)
      });
      x.stroke()
    }
    x.beginPath();
    x.moveTo(820, 260);
    x.quadraticCurveTo(900, 200, 860, 320);
    x.stroke();
    x.beginPath();
    x.moveTo(845, 300);
    x.lineTo(862, 325);
    x.lineTo(885, 302);
    x.stroke();
    x.fillStyle = '#222';
    x.textAlign = 'left';
    fitFont(x, T.title, '{s}px ' + HAND, 84, 660);
    x.fillText(T.title, 140, 270);
    x.font = '42px ' + HAND;
    x.fillText(T.sub, 150, 1440);
    x.beginPath();
    for (var s = 0; s < 14; s++) x.lineTo(150 + s * 40, 1480 + (s % 2 ? 10 : -10));
    x.stroke()
  }]
];
var tSel = 'film',
  tThumbsDone = '';
$('#tGrid').innerHTML = TEMPLATES.map(function(t) {
  return '<button class="tt" data-id="' + t[0] + '"><canvas width="90" height="160"></canvas><span>' + esc(t[1]) + '</span></button>'
}).join('');
$$('#tGrid .tt').forEach(function(b) {
  b.onclick = function() {
    tSel = b.dataset.id;
    renderTemplates(true)
  }
});

function tText() {
  return {
    title: $('#tTitle').value || ' ',
    sub: $('#tSub').value || ' '
  }
}

function drawTemplate(id) {
  var c = document.createElement('canvas');
  c.width = TW;
  c.height = TH;
  var t = TEMPLATES.filter(function(t) {
    return t[0] === id
  })[0];
  t[2](c.getContext('2d'), typeof withTexts === 'function' ? withTexts(afterC) : afterC, tText());
  return c
}

function renderTemplates(onlyPrev) {
  if (!work || !afterC.width) return;
  $$('#tGrid .tt').forEach(function(b) {
    b.classList.toggle('on', b.dataset.id === tSel)
  });
  var pv = $('#tPrev');
  pv.getContext('2d').drawImage(drawTemplate(tSel), 0, 0, pv.width, pv.height);
  // thumbnails only when the photo or the words changed
  var key = afterC.width + 'x' + afterC.height + ':' + hix + ':' + JSON.stringify(tText());
  if (onlyPrev || key === tThumbsDone) return;
  tThumbsDone = key;
  var i = 0,
    list = $$('#tGrid .tt');
  (function step() {
    if (i >= list.length || tab !== 'templates') return;
    var b = list[i++],
      cv = b.querySelector('canvas');
    cv.getContext('2d').drawImage(drawTemplate(b.dataset.id), 0, 0, cv.width, cv.height);
    setTimeout(step, 0)
  })()
}
var tT;
$('#tTitle').oninput = $('#tSub').oninput = function() {
  clearTimeout(tT);
  tT = setTimeout(function() {
    renderTemplates(true)
  }, 120)
};
$('#tTitle').onchange = $('#tSub').onchange = function() {
  renderTemplates()
};
$('#tDl').onclick = function() {
  if (!work) return toast('Upload a photo first');
  drawTemplate(tSel).toBlob(function(blob) {
    var a = document.createElement('a'),
      u = URL.createObjectURL(blob);
    a.href = u;
    a.download = (fileName.replace(/\.[^.]+$/, '') || 'photo') + '-story-' + tSel + '.png';
    a.click();
    setTimeout(function() {
      URL.revokeObjectURL(u)
    }, 1000)
  }, 'image/png')
};

/* ---------- FEED PLANNER ---------- */
var FEED_KEY = 'kiss.feed',
  feed = (function() {
    try {
      var f = JSON.parse(localStorage.getItem(FEED_KEY) || 'null');
      if (f && f.acc) return f
    } catch (e) {}
    return {
      acc: {
        'My account': []
      },
      cur: 'My account',
      shape: '34'
    }
  })();

function saveFeed() {
  try {
    localStorage.setItem(FEED_KEY, JSON.stringify(feed))
  } catch (e) {
    toast('Your browser is out of space for the feed planner. Remove a few tiles.')
  }
}

function tileFrom(src) {
  var w = src.naturalWidth || src.width,
    h = src.naturalHeight || src.height,
    k = Math.min(1, 480 / Math.max(w, h)),
    c = document.createElement('canvas');
  c.width = Math.round(w * k);
  c.height = Math.round(h * k);
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', .82)
}

function renderFeed() {
  var sel = $('#fdAcc');
  sel.innerHTML = Object.keys(feed.acc).map(function(a) {
    return '<option' + (a === feed.cur ? ' selected' : '') + '>' + esc(a) + '</option>'
  }).join('');
  $$('#fdShape button').forEach(function(b) {
    b.classList.toggle('on', b.dataset.v === feed.shape)
  });
  var g = $('#fdGrid'),
    items = feed.acc[feed.cur] || [];
  g.className = 'feedgrid s' + feed.shape;
  g.innerHTML = items.length ? items.map(function(u, i) {
    return '<div class="fd" draggable="true" data-i="' + i + '"><img src="' + u + '" alt=""><button title="Remove">&times;</button></div>'
  }).join('') : '<div class="empty" style="grid-column:1/-1">No posts yet. Add this edit or a few photos to see how your grid looks.</div>';
  var from = null;
  $$('#fdGrid .fd').forEach(function(el) {
    var i = +el.dataset.i;
    el.querySelector('button').onclick = function() {
      items.splice(i, 1);
      saveFeed();
      renderFeed()
    };
    el.ondragstart = function(e) {
      from = i;
      el.classList.add('drag');
      e.dataTransfer.effectAllowed = 'move'
    };
    el.ondragend = function() {
      el.classList.remove('drag')
    };
    el.ondragover = function(e) {
      e.preventDefault();
      el.classList.add('over')
    };
    el.ondragleave = function() {
      el.classList.remove('over')
    };
    el.ondrop = function(e) {
      e.preventDefault();
      e.stopPropagation();
      if (from == null || from === i) return;
      var it = items.splice(from, 1)[0];
      items.splice(i, 0, it);
      saveFeed();
      renderFeed()
    }
  })
}
$('#fdAcc').onchange = function() {
  feed.cur = this.value;
  saveFeed();
  renderFeed()
};
$('#fdNewAcc').onclick = function() {
  var n = (window.prompt('Name for the new account (e.g. @yourname)') || '').trim();
  if (!n) return;
  if (!feed.acc[n]) feed.acc[n] = [];
  feed.cur = n;
  saveFeed();
  renderFeed()
};
$$('#fdShape button').forEach(function(b) {
  b.onclick = function() {
    feed.shape = b.dataset.v;
    saveFeed();
    renderFeed()
  }
});
$('#fdAddCur').onclick = function() {
  if (!work || !afterC.width) return toast('Upload a photo first');
  feed.acc[feed.cur].unshift(tileFrom(typeof withTexts === 'function' ? withTexts(afterC) : afterC));
  saveFeed();
  renderFeed();
  toast('Added to the top of your grid')
};
$('#fdAddFiles').onclick = function() {
  $('#fdFile').click()
};
$('#fdFile').onchange = function() {
  var files = Array.prototype.slice.call(this.files);
  this.value = '';
  Promise.all(files.map(function(f) {
    return loadImg(f).then(tileFrom, function() {
      return null
    })
  })).then(function(urls) {
    urls.filter(Boolean).reverse().forEach(function(u) {
      feed.acc[feed.cur].unshift(u)
    });
    saveFeed();
    renderFeed()
  })
};

/* ---------- hooks into the rest of the app ---------- */
$$('.tab').forEach(function(b) {
  b.addEventListener('click', function() {
    if (tab === 'overlays') {
      renderOverlays();
      refreshOverlayThumbs()
    }
    if (tab === 'templates') renderTemplates();
    if (tab === 'feed') renderFeed()
  })
});
// Keep the new panes in step with undo/redo, new photos and finished renders.
var _syncUI = syncUI;
syncUI = function() {
  _syncUI();
  if (tab === 'overlays') renderOverlays()
};
var _refreshThumbs = refreshThumbs;
refreshThumbs = function() {
  _refreshThumbs();
  ovDirty = ovDirty || thumbsDirty;
  refreshOverlayThumbs()
};
var _draw = draw;
draw = function() {
  _draw();
  if (tab === 'templates' && !busy) {
    clearTimeout(draw._t);
    draw._t = setTimeout(renderTemplates, 250)
  }
};
