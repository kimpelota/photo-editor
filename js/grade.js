/* ============================================================
   COLOR WHEELS + LUTS (Adjust tab)
   ============================================================ */
/* ---------- lift / gamma / gain wheels ---------- */
// base().wh = {lift, gamma, gain}, each [x, y, master]. x/y is the puck on the
// wheel (-1..1, laid out like the vectorscope), master is the slider under it.
var WHEELS = [
    ['lift', 'Lift', 'shadows'],
    ['gamma', 'Gamma', 'midtones'],
    ['gain', 'Gain', 'highlights']
  ],
  wDrag = null,
  wDisc = {};

function wheelVal(k) {
  var wh = base().wh;
  return wh && wh[k] ? wh[k] : [0, 0, 0]
}

// Stores a wheel, dropping wheels that are back at neutral.
function setWheel(k, a) {
  var v = base();
  v.wh = v.wh || {};
  if (!a[0] && !a[1] && !a[2]) delete v.wh[k];
  else v.wh[k] = a;
  if (!Object.keys(v.wh).length) delete v.wh;
  presetOn = null
}

(function() {
  var box = $('#wheels');
  box.innerHTML = WHEELS.map(function(w) {
    return '<div class="wheel"><canvas data-w="' + w[0] + '" title="' + w[1] + ' (' + w[2] + '): drag to tint, double-click to reset"></canvas><b>' + w[1] + '</b><span>' + w[2] + '</span></div>'
  }).join('');
  WHEELS.forEach(function(w) {
    mkSlider($('#wheelSl'), {
      label: w[1] + ' <em>' + w[2] + '</em>',
      get: function() {
        return wheelVal(w[0])[2]
      },
      set: function(v) {
        var a = wheelVal(w[0]).slice();
        a[2] = v;
        setWheel(w[0], a)
      },
      commit: function(v) {
        push(w[1] + ' ' + (v > 0 ? '+' : '') + v);
        presetDirty = true
      }
    })
  });
  $$('#wheels canvas').forEach(function(c) {
    var k = c.dataset.w;
    c.addEventListener('pointerdown', function(e) {
      if (!work) return;
      var a = wheelVal(k);
      wDrag = {
        k: k,
        x: e.clientX,
        y: e.clientY,
        a: a.slice(),
        moved: false
      };
      this.setPointerCapture(e.pointerId)
    });
    c.addEventListener('pointermove', function(e) {
      if (!wDrag || wDrag.k !== k) return;
      // Relative drags, so the puck never jumps; Shift for fine control.
      var r = c.clientWidth / 2 * .86,
        f = e.shiftKey ? .2 : 1,
        x = wDrag.a[0] + (e.clientX - wDrag.x) / r * f,
        y = wDrag.a[1] - (e.clientY - wDrag.y) / r * f,
        len = Math.hypot(x, y);
      if (len > 1) {
        x /= len;
        y /= len
      }
      wDrag.moved = true;
      setWheel(k, [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000, wDrag.a[2]]);
      drawWheels();
      schedule(true)
    });
    c.addEventListener('pointerup', function() {
      if (!wDrag) return;
      var moved = wDrag.moved;
      wDrag = null;
      if (!moved) return;
      schedule();
      push('Color wheel: ' + k);
      presetDirty = true
    });
    c.addEventListener('dblclick', function() {
      var a = wheelVal(k);
      if (!a[0] && !a[1]) return;
      setWheel(k, [0, 0, a[2]]);
      push('Reset ' + k + ' wheel');
      schedule()
    })
  })
})();

// The colour disc, cached per pixel size.
function wheelDisc(px) {
  if (wDisc[px]) return wDisc[px];
  var c = document.createElement('canvas');
  c.width = c.height = px;
  var x = c.getContext('2d'),
    id = x.createImageData(px, px),
    d = id.data,
    h = px / 2;
  for (var j = 0; j < px; j++)
    for (var i = 0; i < px; i++) {
      var cb = (i + .5 - h) / h,
        cr = (h - j - .5) / h,
        rr = Math.hypot(cb, cr),
        o = (j * px + i) * 4;
      if (rr > 1) continue;
      cb *= .3;
      cr *= .3;
      d[o] = (.5 + 1.5748 * cr) * 255;
      d[o + 1] = (.5 - .1873 * cb - .4681 * cr) * 255;
      d[o + 2] = (.5 + 1.8556 * cb) * 255;
      d[o + 3] = Math.min(1, (1 - rr) * h) * 255
    }
  x.putImageData(id, 0, 0);
  return wDisc[px] = c
}

function drawWheels() {
  $$('#wheels canvas').forEach(function(c) {
    if (!c.offsetParent) return;
    var dpr = window.devicePixelRatio || 1,
      w = c.clientWidth,
      px = Math.round(w * dpr);
    if (c.width !== px) c.width = c.height = px;
    var x = c.getContext('2d'),
      h = w / 2,
      r = h * .86,
      a = wheelVal(c.dataset.w);
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.clearRect(0, 0, w, w);
    x.drawImage(wheelDisc(Math.round(r * 2 * dpr)), h - r, h - r, r * 2, r * 2);
    x.strokeStyle = cssv('--line2');
    x.lineWidth = 1;
    x.beginPath();
    x.arc(h, h, r + 3, 0, 7);
    x.stroke();
    x.strokeStyle = 'rgba(0,0,0,.25)';
    x.beginPath();
    x.moveTo(h - r, h);
    x.lineTo(h + r, h);
    x.moveTo(h, h - r);
    x.lineTo(h, h + r);
    x.stroke();
    var px2 = h + a[0] * r,
      py = h - a[1] * r;
    x.beginPath();
    x.arc(px2, py, 6, 0, 7);
    x.fillStyle = a[0] || a[1] ? cssv('--ac') : '#fff';
    x.fill();
    x.strokeStyle = '#000';
    x.lineWidth = 1.5;
    x.stroke()
  })
}

$('#bWheelReset').onclick = function() {
  if (!base().wh) return;
  delete base().wh;
  push('Reset color wheels');
  schedule()
};

/* ---------- LUTs (.cube) ---------- */
// The library lives in IndexedDB so imported LUTs stay between visits; the
// edit itself only stores base().lut = {id, name, amt}.
var LUTLIB = [],
  lutDBp = null;

function lutDB() {
  if (!lutDBp) lutDBp = new Promise(function(res, rej) {
    var q = indexedDB.open('nuance', 1);
    q.onupgradeneeded = function() {
      q.result.createObjectStore('luts', {
        keyPath: 'id'
      })
    };
    q.onsuccess = function() {
      res(q.result)
    };
    q.onerror = function() {
      rej(q.error)
    }
  });
  return lutDBp
}

function lutStore(mode, f) {
  return lutDB().then(function(db) {
    return new Promise(function(res, rej) {
      var tx = db.transaction('luts', mode),
        q = f(tx.objectStore('luts'));
      tx.oncomplete = function() {
        res(q && q.result)
      };
      tx.onerror = function() {
        rej(tx.error)
      }
    })
  })
}

// Parses a .cube file (3D, or 1D which is expanded to a 33³ cube).
function parseCube(txt) {
  var n3 = 0,
    n1 = 0,
    title = '',
    lo = [0, 0, 0],
    hi = [1, 1, 1],
    rows = [];
  txt.split(/\r?\n/).forEach(function(ln) {
    ln = ln.trim();
    if (!ln || ln[0] === '#') return;
    var w = ln.split(/\s+/);
    if (w[0] === 'TITLE') title = ln.replace(/^TITLE\s+"?|"?$/g, '');
    else if (w[0] === 'LUT_3D_SIZE') n3 = +w[1];
    else if (w[0] === 'LUT_1D_SIZE') n1 = +w[1];
    else if (w[0] === 'DOMAIN_MIN') lo = w.slice(1, 4).map(Number);
    else if (w[0] === 'DOMAIN_MAX') hi = w.slice(1, 4).map(Number);
    else if (/^[-+.\d]/.test(w[0]) && w.length >= 3) rows.push(+w[0], +w[1], +w[2])
  });
  var n = n3 || n1;
  if (!n || n < 2 || n > 128) throw new Error('no LUT size in the file');
  if (rows.length !== (n3 ? n * n * n : n) * 3) throw new Error('expected ' + (n3 ? n * n * n : n) + ' rows, found ' + rows.length / 3);
  for (var i = 0; i < rows.length; i++) rows[i] = (rows[i] - lo[i % 3]) / ((hi[i % 3] - lo[i % 3]) || 1);
  if (n3) return {
    title: title,
    n: n,
    d: new Float32Array(rows)
  };
  var N = 33,
    d = new Float32Array(N * N * N * 3),
    at = function(c, t) {
      var p = t * (n - 1),
        i0 = Math.min(n - 2, Math.floor(p)),
        f = p - i0;
      return rows[i0 * 3 + c] + (rows[(i0 + 1) * 3 + c] - rows[i0 * 3 + c]) * f
    };
  for (var b = 0, o = 0; b < N; b++)
    for (var g = 0; g < N; g++)
      for (var r = 0; r < N; r++, o += 3) {
        d[o] = at(0, r / (N - 1));
        d[o + 1] = at(1, g / (N - 1));
        d[o + 2] = at(2, b / (N - 1))
      }
  return {
    title: title,
    n: N,
    d: d
  }
}

// Same file, same id, so importing a LUT twice doesn't duplicate it.
function lutId(txt) {
  var h = 2166136261;
  for (var i = 0; i < txt.length; i++) h = Math.imul(h ^ txt.charCodeAt(i), 16777619);
  return 'cube-' + (h >>> 0).toString(36) + '-' + txt.length.toString(36)
}

function addLut(e) {
  sendLut(e.id, {
    n: e.n,
    d: e.d
  });
  LUTLIB = LUTLIB.filter(function(l) {
    return l.id !== e.id
  });
  LUTLIB.push({
    id: e.id,
    name: e.name,
    n: e.n
  });
  LUTLIB.sort(function(a, b) {
    return a.name.localeCompare(b.name)
  })
}

function useLut(l) {
  var cur = base().lut;
  base().lut = {
    id: l.id,
    name: l.name,
    amt: cur ? cur.amt : 1
  };
  presetOn = null;
  push('LUT: ' + l.name);
  presetDirty = thumbsDirty = true;
  schedule()
}

function importCubes(files) {
  var last = null;
  return files.reduce(function(p, f) {
    return p.then(function() {
      return f.text()
    }).then(function(txt) {
      var L = parseCube(txt),
        e = {
          id: lutId(txt),
          name: (L.title || f.name.replace(/\.cube$/i, '')).slice(0, 60),
          n: L.n,
          d: L.d
        };
      addLut(e);
      last = e;
      return lutStore('readwrite', function(s) {
        return s.put(e)
      }).catch(function(err) {
        console.warn('LUT not saved for next time', err)
      })
    }).catch(function(err) {
      toast('Couldn’t read “' + f.name + '”: ' + err.message, 4000)
    })
  }, Promise.resolve()).then(function() {
    renderLuts();
    if (!last) return;
    if (work) useLut(last);
    toast(files.length > 1 ? 'Imported ' + LUTLIB.length + ' LUTs' : 'Imported LUT “' + last.name + '”')
  })
}

function isCube(f) {
  return f && /\.cube$/i.test(f.name)
}

mkSlider($('#lutSl'), {
  label: 'LUT strength',
  min: 0,
  max: 100,
  def: 100,
  get: function() {
    var l = base().lut;
    return l ? Math.round(l.amt * 100) : 100
  },
  set: function(v) {
    if (base().lut) base().lut.amt = v / 100
  },
  commit: function(v) {
    if (base().lut) push('LUT strength ' + v)
  }
});

function renderLuts() {
  var cur = base().lut,
    missing = cur && !LUTLIB.some(function(l) {
      return l.id === cur.id
    });
  $('#lutC').innerHTML = '<button data-id="" class="' + (cur ? '' : 'on') + '">None</button>' + LUTLIB.map(function(l) {
    return '<button data-id="' + l.id + '" class="' + (cur && cur.id === l.id ? 'on' : '') + '" title="' + l.n + '³ cube">' + esc(l.name) + '</button>'
  }).join('') + (missing ? '<button class="on miss" disabled title="This LUT isn’t in the library on this device. Import the .cube file again.">' + esc(cur.name) + ' (missing)</button>' : '');
  $$('#lutC button[data-id]').forEach(function(b) {
    b.onclick = function() {
      var id = b.dataset.id;
      if (!id) {
        if (!base().lut) return;
        delete base().lut;
        push('Removed LUT');
        schedule();
        return
      }
      if (cur && cur.id === id) return;
      useLut(LUTLIB.filter(function(l) {
        return l.id === id
      })[0])
    }
  });
  $('#lutSl').style.display = cur ? '' : 'none';
  $('#bLutDel').hidden = !cur || missing
}

$('#bLutImp').onclick = function() {
  $('#lutFile').click()
};
$('#lutFile').onchange = function() {
  var fs = Array.prototype.slice.call(this.files);
  this.value = '';
  if (fs.length) importCubes(fs)
};
$('#bLutDel').onclick = function() {
  var cur = base().lut;
  if (!cur || !confirm('Remove “' + cur.name + '” from your LUT library?')) return;
  sendLut(cur.id, null);
  LUTLIB = LUTLIB.filter(function(l) {
    return l.id !== cur.id
  });
  lutStore('readwrite', function(s) {
    return s.delete(cur.id)
  }).catch(function() {});
  delete base().lut;
  push('Removed LUT');
  schedule()
};

function syncGrade() {
  drawWheels();
  renderLuts()
}

renderLuts();

// Load the saved library, then re-render in case the open edit uses one of them.
try {
  lutStore('readonly', function(s) {
    return s.getAll()
  }).then(function(all) {
    (all || []).forEach(addLut);
    renderLuts();
    if (all && all.length && base().lut) schedule()
  }).catch(function(e) {
    console.warn('LUT library unavailable', e)
  })
} catch (e) {}
