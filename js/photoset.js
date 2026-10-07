/* ============================================================
   PHOTO SET: open many photos at once, edit each, sync, export all, make a reel
   ============================================================ */
// Every photo keeps its own edits, history and versions while you switch between
// them in the filmstrip. The set's order is the order photos go into a reel.
var SET = [],
  setCur = -1,
  setTok = 0;

function setIsImage(f) {
  return !f.type || /^image\//.test(f.type) || f.type === 'application/octet-stream'
}

// A small copy for the filmstrip and for quick edited thumbnails.
function setSmall(im) {
  return raster(im, im.naturalWidth, im.naturalHeight, 200)
}

// Opens or adds photos. With one photo and no set this behaves like before.
function setAdd(files) {
  var imgs = files.filter(setIsImage);
  if (!imgs.length) {
    if (files.length) toast('Those aren’t photos');
    return
  }
  var first = SET.length;
  imgs.forEach(function(f) {
    SET.push({
      file: f,
      name: f.name,
      url: '',
      s: null
    })
  });
  renderSet();
  // Thumbnails load in the background, one at a time.
  SET.slice(first).reduce(function(p, it) {
    return p.then(function() {
      return loadImg(it.file).then(function(im) {
        it.small = setSmall(im);
        var c = document.createElement('canvas');
        putC(c, {
          w: it.small.w,
          h: it.small.h,
          d: new Uint8ClampedArray(it.small.d)
        });
        it.url = c.toDataURL('image/jpeg', .8);
        renderSet()
      }, function() {
        it.bad = true;
        renderSet()
      })
    })
  }, Promise.resolve());
  setSwitch(first);
  if (imgs.length > 1) toast(imgs.length + ' photos added. Switch between them in the filmstrip');
  else if (SET.length > 1) toast('Added to your set (' + SET.length + ' photos)')
}

// Keeps the open photo's edits so they come back when you return to it.
function setStash() {
  var it = SET[setCur];
  if (!it || !work) return;
  it.s = JSON.stringify(S);
  it.hist = hist;
  it.hix = hix;
  it.ver = VERSIONS;
  if (afterC.width) {
    var k = 160 / Math.max(afterC.width, afterC.height),
      c = document.createElement('canvas');
    c.width = Math.round(afterC.width * k);
    c.height = Math.round(afterC.height * k);
    c.getContext('2d').drawImage(afterC, 0, 0, c.width, c.height);
    it.url = c.toDataURL('image/jpeg', .8)
  }
}

function setSwitch(i) {
  var it = SET[i];
  if (!it || i === setCur && work) return;
  setStash();
  var tok = ++setTok;
  setCur = i;
  renderSet();
  loadImg(it.file).then(function(im) {
    if (tok !== setTok) return;
    // Reloads bring back this photo (see session.js).
    if (typeof sessionSetSource === 'function') sessionSetSource(it.file);
    setImage(im, im.naturalWidth, im.naturalHeight, it.name);
    if (it.s) {
      S = JSON.parse(it.s);
      // Edits synced from another photo: measure the enhancer for this one.
      if (S._enh != null) {
        S.enh = analyzeFor(S);
        S.enh.amt = S._enh;
        delete S._enh
      }
      hist = it.hist || [{
        label: 'Edits from your set',
        s: JSON.stringify(S)
      }];
      hix = it.hist ? it.hix : 0;
      VERSIONS = it.ver || [];
      renderVersions();
      plan = null;
      renderPlan();
      thumbsDirty = presetDirty = true;
      syncUI();
      schedule();
      refreshThumbs();
      if (typeof sessionSaveSoon === 'function') sessionSaveSoon();
      // AI masks need the photo analysed again.
      var ai = (S.masks || []).filter(function(m) {
        return MASK_TYPES[m.type] && MASK_TYPES[m.type].ai && m.type !== 'face'
      });
      if (ai.length) ensureSeg('subject', function() {}).then(function() {
        schedule()
      }, function() {})
    }
    renderSet()
  }, function() {
    toast('Couldn’t read “' + it.name + '”');
    it.bad = true;
    renderSet()
  })
}

function setRemove(i) {
  var wasCur = i === setCur;
  SET.splice(i, 1);
  if (i < setCur) setCur--;
  if (wasCur) {
    setCur = -1;
    if (SET.length) setSwitch(Math.min(i, SET.length - 1))
  }
  renderSet()
}

// The edits to copy, like Lightroom's sync: everything except text and AI masks.
function setEdits() {
  return {
    layers: S.layers,
    enh: S.enh ? S.enh.amt : null,
    skin: S.skin,
    fx: S.fx,
    crop: S.geo.crop,
    ang: S.geo.ang,
    masks: (S.masks || []).filter(function(m) {
      return !MASK_TYPES[m.type] || !MASK_TYPES[m.type].ai
    })
  }
}

function setSync() {
  if (SET.length < 2 || setCur < 0) return;
  setStash();
  var c0 = setEdits();
  SET.forEach(function(it, i) {
    if (i === setCur) return;
    var st = it.s ? JSON.parse(it.s) : fresh();
    pasteEdits(st, c0, null);
    st.masks = clone(c0.masks);
    st._enh = c0.enh;
    it.s = JSON.stringify(st);
    it.hist = null
  });
  toast('Edits applied to all ' + SET.length + ' photos');
  setThumbs()
}

// The state for photo i, ready to render on its own (AI masks only on the open photo).
function setState(i) {
  if (i === setCur) setStash();
  var st = SET[i].s ? JSON.parse(SET[i].s) : fresh();
  if (i !== setCur) st.masks = (st.masks || []).filter(function(m) {
    return !MASK_TYPES[m.type] || !MASK_TYPES[m.type].ai
  });
  return st
}

// Renders photo i with its edits, at most `cap` pixels on the long edge.
function setRender(i, cap) {
  var it = SET[i],
    st = setState(i);
  return loadImg(it.file).then(function(im) {
    var src = raster(im, im.naturalWidth, im.naturalHeight, cap || 1e9, P.MAX_PX);
    if (st._enh != null) {
      st.enh = P.analyze(P.geo(src, st.geo));
      st.enh.amt = st._enh;
      delete st._enh
    }
    st.up.on = false;
    var key = i === setCur && (!cap || cap >= 1280) ? null : 'set';
    if (key) sendSrc(key, src);
    return job({
      type: 'render',
      key: key || 'full',
      st: st,
      cache: false
    })
  }).then(function(m) {
    return typeof textsReady === 'function' ? textsReady(st.texts || []).then(function() {
      return m
    }) : m
  }).then(function(m) {
    var c = document.createElement('canvas');
    putC(c, m);
    if (typeof paintTexts === 'function') paintTexts(c, st.texts || []);
    return c
  })
}

// Edited thumbnails for the whole set, after a sync.
function setThumbs() {
  SET.reduce(function(p, it, i) {
    return p.then(function() {
      if (!it.small || !it.s || i === setCur) return;
      var st = setState(i);
      if (st._enh != null) {
        st.enh = P.analyze(P.geo(it.small, st.geo));
        st.enh.amt = st._enh
      }
      sendSrc('setthumb', it.small);
      return job({
        type: 'render',
        key: 'setthumb',
        st: st,
        cache: false
      }).then(function(m) {
        var c = document.createElement('canvas');
        putC(c, m);
        it.url = c.toDataURL('image/jpeg', .8);
        renderSet()
      }, function() {})
    })
  }, Promise.resolve())
}

function setExportAll() {
  var b = $('#setExport'),
    n = SET.length,
    done = 0;
  b.disabled = true;
  SET.reduce(function(p, it, i) {
    return p.then(function() {
      b.textContent = 'Exporting ' + (i + 1) + ' of ' + n + '…';
      return setRender(i).then(function(c) {
        var x = c.getContext('2d');
        return saveRender({
          w: c.width,
          h: c.height,
          d: x.getImageData(0, 0, c.width, c.height).data
        }, it.name.replace(/\.[^.]+$/, '') + '-studio-de-nuance').then(function() {
          done++
        })
      }).catch(function(e) {
        console.error(e)
      })
    })
  }, Promise.resolve()).then(function() {
    b.disabled = false;
    b.textContent = 'Export all';
    toast('Exported ' + done + ' of ' + n + ' photos (' + ex.f.toUpperCase() + ')', 4000)
  })
}

// Every photo, edited, onto the end of the Reel Studio timeline.
function setToReel() {
  var b = $('#setReel'),
    n = SET.length,
    out = [];
  b.disabled = true;
  SET.reduce(function(p, it, i) {
    return p.then(function() {
      b.textContent = 'Preparing ' + (i + 1) + ' of ' + n + '…';
      return setRender(i, 1440).then(function(c) {
        out.push({
          c: c,
          name: it.name
        })
      }, function(e) {
        console.error(e)
      })
    })
  }, Promise.resolve()).then(function() {
    b.disabled = false;
    b.textContent = 'Make a reel';
    if (!out.length) return toast('Couldn’t prepare the photos');
    reOpen(function() {
      out.forEach(function(o) {
        var M = reMediaFromCanvas(o.c, o.name);
        RE.bin.push(M.id);
        reAppendClip(M)
      });
      RE.sel = null;
      reCommit('Added ' + out.length + ' photos');
      toast(out.length + ' edited photos added to your reel')
    })
  })
}

function renderSet() {
  var el = $('#strip');
  $('#vphSet').hidden = SET.length < 2;
  el.hidden = SET.length < 2;
  $('#stage').classList.toggle('has-set', SET.length > 1);
  if (SET.length < 2) return;
  $('#stripN').textContent = (setCur + 1) + ' / ' + SET.length;
  $('#stripRow').innerHTML = SET.map(function(it, i) {
    return '<div class="sth' + (i === setCur ? ' on' : '') + (it.bad ? ' bad' : '') + '" data-i="' + i + '" draggable="true" title="' + esc(it.name) + '">' + (it.url ? '<img src="' + it.url + '" alt="">' : '<i class="ld"></i>') + (it.s ? '<em title="Edited">&#10022;</em>' : '') + '<button data-x="' + i + '" aria-label="Remove from set">&times;</button></div>'
  }).join('') + '<button class="sth add" id="stripAdd" title="Add more photos"><b>+</b></button>';
  $$('#stripRow .sth[data-i]').forEach(function(t) {
    var i = +t.dataset.i;
    t.onclick = function() {
      setSwitch(i)
    };
    t.querySelector('[data-x]').onclick = function(e) {
      e.stopPropagation();
      setRemove(i)
    };
    t.ondragstart = function(e) {
      e.dataTransfer.setData('text/set', i)
    };
    t.ondragover = function(e) {
      if (e.dataTransfer.types.indexOf('text/set') >= 0) e.preventDefault()
    };
    t.ondrop = function(e) {
      var from = e.dataTransfer.getData('text/set');
      if (from === '') return;
      e.preventDefault();
      e.stopPropagation();
      var cur = SET[setCur],
        it = SET.splice(+from, 1)[0];
      SET.splice(i, 0, it);
      setCur = SET.indexOf(cur);
      renderSet()
    }
  });
  $('#stripAdd').onclick = function() {
    $('#file').click()
  };
  var on = $('#stripRow .sth.on');
  if (on && on.scrollIntoView) on.scrollIntoView({
    block: 'nearest',
    inline: 'nearest'
  })
}

$('#setSync').onclick = setSync;
$('#setExport').onclick = setExportAll;
$('#setReel').onclick = setToReel;
document.addEventListener('keydown', function(e) {
  if (SET.length < 2 || e.metaKey || e.ctrlKey || e.altKey) return;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
  if (e.key === '[' && setCur > 0) setSwitch(setCur - 1);
  if (e.key === ']' && setCur < SET.length - 1) setSwitch(setCur + 1)
});

// The sample photo isn't part of the set.
var setLoadSample = loadSample;
loadSample = function() {
  setStash();
  setCur = -1;
  renderSet();
  setLoadSample()
};

// Adds the set, edited, to the photos the example reels use.
function setToTray() {
  var b = $('#vphSet'),
    n = SET.length;
  b.disabled = true;
  SET.reduce(function(p, it, i) {
    return p.then(function() {
      b.textContent = (i + 1) + ' of ' + n + '…';
      return setRender(i, 1280).then(function(c) {
        VPH.push(vphMake(c, c.width, c.height, it.name))
      }, function() {})
    })
  }, Promise.resolve()).then(function() {
    b.disabled = false;
    b.textContent = '+ Photo set';
    vphChanged();
    toast('Added your ' + n + ' edited photos')
  })
}
$('#vphSet').onclick = setToTray;
