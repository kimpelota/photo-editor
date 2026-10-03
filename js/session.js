/* ============================================================
   SESSION: keeps the open photo and its edits across page reloads
   ============================================================ */
// Phones reload a page when they run short of memory or when the browser is
// switched away from for a while. Without this, a reload loses every edit. The
// photo file and the edit history are kept in this browser's IndexedDB and put
// back the next time the editor opens.
var SESSION_DB = 'nuance-session',
  sessionDbP = null,
  sessionT = null,
  sessionSrc = null, // {blob} for an opened file or {sample: true}
  sessionRestoring = false;

function sessionDb() {
  if (!sessionDbP) sessionDbP = new Promise(function(res, rej) {
    var r = indexedDB.open(SESSION_DB, 1);
    r.onupgradeneeded = function() {
      r.result.createObjectStore('s')
    };
    r.onsuccess = function() {
      res(r.result)
    };
    r.onerror = function() {
      rej(r.error)
    }
  }).catch(function(e) {
    sessionDbP = null;
    throw e
  });
  return sessionDbP
}

function sessionTx(mode, fn) {
  return sessionDb().then(function(db) {
    return new Promise(function(res, rej) {
      var t = db.transaction('s', mode),
        out = fn(t.objectStore('s'));
      t.oncomplete = function() {
        res(out && out.result)
      };
      t.onerror = t.onabort = function() {
        rej(t.error)
      }
    })
  })
}

// Called when a photo is opened. `blob` is the original file, or null for the sample.
function sessionSetSource(blob) {
  if (sessionRestoring) return;
  if (!blob) {
    sessionPutSrc({
      sample: true
    });
    return
  }
  // Raw bytes rather than the File object: older iPhone Safari can't keep files in IndexedDB.
  sessionSrc = null;
  (blob.arrayBuffer ? blob.arrayBuffer() : new Response(blob).arrayBuffer()).then(function(buf) {
    sessionPutSrc({
      buf: buf,
      type: blob.type || ''
    })
  }).catch(function(e) {
    console.warn('Could not save the photo for later', e)
  })
}

function sessionPutSrc(src) {
  sessionSrc = src;
  sessionTx('readwrite', function(s) {
    s.put(src, 'src');
    s.delete('edits')
  }).then(sessionSaveSoon, function(e) {
    console.warn('Could not save the photo for later', e)
  })
}

// Called after every edit, undo and redo. Writes at most every 400 ms.
function sessionSaveSoon() {
  if (sessionRestoring || !sessionSrc) return;
  clearTimeout(sessionT);
  sessionT = setTimeout(sessionSaveNow, 400)
}

function sessionSaveNow() {
  clearTimeout(sessionT);
  if (!sessionSrc || !hist.length) return Promise.resolve();
  var rec = {
    name: fileName,
    hist: hist,
    hix: hix,
    tab: tab,
    at: Date.now()
  };
  return sessionTx('readwrite', function(s) {
    s.put(rec, 'edits')
  }).catch(function(e) {
    console.warn('Could not save edits for later', e)
  })
}

// Save straight away when the page is hidden; a phone may close it after that.
document.addEventListener('visibilitychange', function() {
  if (document.visibilityState === 'hidden' && sessionT) sessionSaveNow()
});
window.addEventListener('pagehide', function() {
  if (sessionT) sessionSaveNow()
});

function sessionRestore() {
  if (!window.indexedDB) return Promise.resolve(false);
  return Promise.all([sessionTx('readonly', function(s) {
    return s.get('src')
  }), sessionTx('readonly', function(s) {
    return s.get('edits')
  })]).then(function(r) {
    var src = r[0],
      ed = r[1];
    if (!src || !ed || !ed.hist || !ed.hist.length) return false;
    // Something to come back to only when there's more than the "Opened" step.
    if (ed.hist.length < 2) return false;
    return decodeSource(src).then(function(im) {
      sessionRestoring = true;
      try {
        setImage(im.el, im.w, im.h, ed.name || 'photo');
        hist = ed.hist;
        hix = Math.min(Math.max(0, ed.hix), hist.length - 1);
        S = JSON.parse(hist[hix].s);
        thumbsDirty = true;
        presetDirty = true;
        syncUI();
        schedule();
        refreshThumbs();
      } finally {
        sessionRestoring = false
      }
      sessionSrc = src;
      if (im.url) URL.revokeObjectURL(im.url);
      redoSeg();
      var t = ed.tab && document.querySelector('.tab[data-t="' + ed.tab + '"]');
      if (t) t.click();
      toast('Picked up where you left off');
      return true
    })
  }).catch(function(e) {
    console.warn('Could not restore the last session', e);
    return false
  })
}

function decodeSource(src) {
  if (src.sample) {
    var c = makeSample();
    return Promise.resolve({
      el: c,
      w: c.width,
      h: c.height
    })
  }
  return new Promise(function(res, rej) {
    var url = URL.createObjectURL(new Blob([src.buf], src.type ? {
        type: src.type
      } : {})),
      im = new Image();
    im.onload = function() {
      res({
        el: im,
        w: im.naturalWidth,
        h: im.naturalHeight,
        url: url
      })
    };
    im.onerror = function() {
      URL.revokeObjectURL(url);
      rej(new Error('saved photo could not be decoded'))
    };
    im.src = url
  })
}

// AI subject, background and face masks need the segmentation model again after a reload.
function redoSeg() {
  if (typeof ensureSeg !== 'function' || typeof MASK_TYPES === 'undefined') return;
  var need = {};
  hist.forEach(function(h) {
    (JSON.parse(h.s).masks || []).forEach(function(m) {
      if (MASK_TYPES[m.type] && MASK_TYPES[m.type].ai) need[m.type === 'face' ? 'face' : 'subject'] = 1
    })
  });
  Object.keys(need).reduce(function(p, k) {
    return p.then(function() {
      return ensureSeg(k)
    })
  }, Promise.resolve()).then(function() {
    if (Object.keys(need).length) {
      if (typeof renderMasks === 'function') renderMasks();
      schedule()
    }
  }, function(e) {
    console.warn(e);
    toast('Reconnect to the internet to bring back AI masks')
  })
}

sessionRestore();
