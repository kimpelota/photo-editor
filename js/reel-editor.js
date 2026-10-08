/* ============================================================
   REEL STUDIO: a full reel editor, modelled on Instagram's Reels / Edits tools
   ============================================================ */
// Timeline of photo and video clips (trim, split, slip, reorder, speed, volume,
// filters, adjust, mirror, transitions), text with Instagram-style fonts and
// animations, word-by-word captions, music (built-in beats or your own song),
// voiceover with live auto-captions, beat sync, templates, cover, drafts and export.
// Drawing reuses the example-reel engine in reels.js.
var RE = null,
  REM = {},
  reSeq = 0,
  RE_W = 1080,
  RE_H = 1920,
  RE_MAX = 180,
  RE_FONTS = {
    classic: ['Classic', '700 {s}px Montserrat', 0],
    modern: ['Modern', '700 {s}px Poppins', 0],
    strong: ['Strong', '{s}px Anton', 1],
    poster: ['Poster', '{s}px "Bebas Neue"', 1],
    typewriter: ['Typewriter', '700 {s}px "Space Mono"', 0],
    elegant: ['Elegant', 'italic 700 {s}px "Playfair Display"', 0],
    neon: ['Neon', '{s}px Pacifico', 0],
    script: ['Script', '700 {s}px "Dancing Script"', 0]
  },
  RE_COLORS = ['#ffffff', '#000000', '#3897f0', '#70c050', '#fdcb5c', '#fd8d32', '#ed4956', '#d10869', '#a307ba', '#ffe14d'],
  RE_BG = {
    none: 'None',
    box: 'Color box',
    invert: 'White box',
    outline: 'Outline'
  },
  RE_ANIM = {
    none: 'None',
    pop: 'Pop',
    fade: 'Fade',
    slide: 'Slide up',
    type: 'Typewriter',
    words: 'Word by word'
  },
  RE_TR = {
    none: 'None',
    fade: 'Fade',
    punch: 'Zoom punch',
    whip: 'Whip',
    swipe: 'Swipe',
    zoomblend: 'Zoom blend',
    glitch: 'Glitch',
    flash: 'Flash',
    shake: 'Shake',
    blur: 'Blur'
  },
  RE_SPEEDS = [.3, .5, 1, 2, 3],
  RE_BEATS = {
    hype: 'Hype',
    travel: 'Travel',
    clean: 'Pop',
    cinema: 'Cinematic',
    talk: 'Chill'
  };

function reId() {
  return 'r' + Date.now().toString(36) + (++reSeq).toString(36)
}

function reBlank() {
  return {
    clips: [],
    texts: [],
    caps: {
      words: [],
      style: 'pop',
      y: .6
    },
    music: null,
    musicVol: .8,
    origVol: 1,
    vo: [],
    sfx: true,
    cover: {
      t: 0,
      title: ''
    }
  }
}

/* ---------- media ---------- */
// REM[id] = {id, type: photo|video|audio, name, blob, el, w, h, dur, th (thumb canvas), url, buf}
function reThumb(src, w, h) {
  var c = document.createElement('canvas'),
    k = 160 / Math.max(w, h);
  c.width = Math.max(1, Math.round(w * k));
  c.height = Math.max(1, Math.round(h * k));
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  return c
}

function reMediaFromCanvas(c, name, blob, id) {
  var M = {
    id: id || reId(),
    type: 'photo',
    name: name,
    blob: blob,
    el: c,
    w: c.width,
    h: c.height,
    fc: {}
  };
  M.th = reThumb(c, c.width, c.height);
  M.url = M.th.toDataURL('image/jpeg', .8);
  // Photos made in the app (templates, the Reels tray) need a file to be saved in the draft.
  if (!blob && c.toBlob) c.toBlob(function(b) {
    M.blob = b;
    reSaveSoon()
  }, 'image/jpeg', .92);
  REM[M.id] = M;
  return M
}

function rePhoto(blob, name, id) {
  return loadImg(blob).then(function(im) {
    var k = Math.min(1, 1440 / Math.max(im.naturalWidth, im.naturalHeight)),
      c = document.createElement('canvas');
    c.width = Math.round(im.naturalWidth * k);
    c.height = Math.round(im.naturalHeight * k);
    var x = c.getContext('2d');
    x.imageSmoothingQuality = 'high';
    x.drawImage(im, 0, 0, c.width, c.height);
    return reMediaFromCanvas(c, name, blob, id)
  })
}

function reVideo(blob, name, id) {
  return new Promise(function(res, rej) {
    var v = document.createElement('video');
    v.preload = 'auto';
    v.playsInline = true;
    v.setAttribute('playsinline', '');
    v.muted = false;
    v.src = URL.createObjectURL(blob);
    v.onloadedmetadata = function() {
      v.currentTime = Math.min(.1, v.duration / 2)
    };
    v.onseeked = function() {
      v.onseeked = null;
      var M = {
        id: id || reId(),
        type: 'video',
        name: name,
        blob: blob,
        el: v,
        w: v.videoWidth,
        h: v.videoHeight,
        dur: v.duration,
        fc: {}
      };
      M.th = reThumb(v, M.w, M.h);
      M.url = M.th.toDataURL('image/jpeg', .8);
      v.addEventListener('seeked', function() {
        if (RE && !RE.on) reDraw()
      });
      REM[M.id] = M;
      res(M)
    };
    v.onerror = function() {
      rej(new Error('Couldn’t play ' + name + ' in this browser'))
    }
  })
}

function reAudioMedia(blob, name, id) {
  if (!reelAudio()) return Promise.reject(new Error('No audio support in this browser'));
  return blob.arrayBuffer().then(function(ab) {
    return new Promise(function(res, rej) {
      RA.ac.decodeAudioData(ab, res, rej)
    })
  }).then(function(buf) {
    var M = {
      id: id || reId(),
      type: 'audio',
      name: name,
      blob: blob,
      buf: buf,
      dur: buf.duration
    };
    REM[M.id] = M;
    return M
  })
}

function reKind(f) {
  if (/^video\//.test(f.type) || /\.(mp4|mov|m4v|webm)$/i.test(f.name)) return 'video';
  if (/^audio\//.test(f.type) || /\.(mp3|m4a|wav|aac|ogg)$/i.test(f.name)) return 'audio';
  return 'photo'
}

// Adds files to the media bin; photos and videos also go on the end of the timeline.
function reAddFiles(files, toTimeline) {
  var added = [],
    bad = 0;
  return files.reduce(function(p, f) {
    return p.then(function() {
      var k = reKind(f);
      return (k === 'video' ? reVideo(f, f.name) : k === 'audio' ? reAudioMedia(f, f.name) : rePhoto(f, f.name)).then(function(M) {
        added.push(M)
      }, function(e) {
        console.warn(e);
        bad++
      })
    })
  }, Promise.resolve()).then(function() {
    var song = added.filter(function(M) {
      return M.type === 'audio'
    })[0];
    if (song) reSetMusic({
      kind: 'file',
      m: song.id,
      off: 0
    }, true);
    added.forEach(function(M) {
      if (M.type === 'audio') return;
      if (RE.bin.indexOf(M.id) < 0) RE.bin.push(M.id);
      if (toTimeline !== false) reAppendClip(M)
    });
    reRenderBin();
    reCommit('Add media');
    if (bad) toast(bad + ' file' + (bad > 1 ? 's' : '') + ' couldn’t be opened', 3500);
    return added
  })
}

function reAppendClip(M, at) {
  var cl = {
    id: reId(),
    m: M.id,
    dur: M.type === 'video' ? Math.min(M.dur, 60) : 3,
    in: 0,
    speed: 1,
    vol: 1,
    flt: '',
    fs: .85,
    adj: {
      br: 0,
      co: 0,
      sa: 0,
      wa: 0
    },
    mirror: false,
    motion: M.type === 'photo',
    tr: 'none'
  };
  if (at == null) RE.proj.clips.push(cl);
  else RE.proj.clips.splice(at, 0, cl);
  return cl
}

/* ---------- project timing ---------- */
function reDur() {
  return RE.proj.clips.reduce(function(s, c) {
    return s + c.dur
  }, 0)
}

function reStarts() {
  var t = 0;
  return RE.proj.clips.map(function(c) {
    var a = t;
    t += c.dur;
    return a
  })
}

// The clip under time t: {i, c, a (its start), l (time into it)}.
function reAt(t) {
  var C = RE.proj.clips,
    a = 0;
  for (var i = 0; i < C.length; i++) {
    if (t < a + C[i].dur || i === C.length - 1) return {
      i: i,
      c: C[i],
      a: a,
      l: Math.max(0, Math.min(C[i].dur, t - a))
    };
    a += C[i].dur
  }
  return null
}

// Longest a video clip can run from its in-point at its speed.
function reMaxDur(c) {
  var M = REM[c.m];
  return M && M.type === 'video' ? (M.dur - c.in) / c.speed : 600
}

function reFind(kind, id) {
  var L = kind === 'clip' ? RE.proj.clips : kind === 'text' ? RE.proj.texts : kind === 'vo' ? RE.proj.vo : [];
  return L.filter(function(o) {
    return o.id === id
  })[0] || null
}

function reSelObj() {
  return RE.sel ? reFind(RE.sel.k, RE.sel.id) : null
}

/* ---------- history + drafts ---------- */
function reCommit(label) {
  RE.hist.length = RE.hix + 1;
  RE.hist.push(JSON.stringify(RE.proj));
  if (RE.hist.length > 80) RE.hist.shift();
  RE.hix = RE.hist.length - 1;
  reRenderAll();
  reSaveSoon()
}

function reUndo(d) {
  var i = RE.hix + d;
  if (i < 0 || i >= RE.hist.length) return;
  RE.hix = i;
  RE.proj = JSON.parse(RE.hist[i]);
  if (RE.sel && !reSelObj()) RE.sel = null;
  RE.t = Math.min(RE.t, reDur());
  reRenderAll();
  reSaveSoon()
}

var reDBp = null,
  reSaveT = null;

function reDB() {
  if (!reDBp) reDBp = new Promise(function(res, rej) {
    var q = indexedDB.open('nuance-reels', 1);
    q.onupgradeneeded = function() {
      q.result.createObjectStore('drafts')
    };
    q.onsuccess = function() {
      res(q.result)
    };
    q.onerror = function() {
      rej(q.error)
    }
  });
  return reDBp
}

function reIDB(mode, f) {
  return reDB().then(function(db) {
    return new Promise(function(res, rej) {
      var tx = db.transaction('drafts', mode),
        q = f(tx.objectStore('drafts'));
      tx.oncomplete = function() {
        res(q && q.result)
      };
      tx.onerror = function() {
        rej(tx.error)
      }
    })
  })
}

// Media the project still uses, so deleted media isn't saved forever.
function reUsedMedia() {
  var P = RE.proj,
    ids = {};
  P.clips.forEach(function(c) {
    ids[c.m] = 1
  });
  P.vo.forEach(function(v) {
    ids[v.m] = 1
  });
  if (P.music && P.music.m) ids[P.music.m] = 1;
  RE.bin.forEach(function(id) {
    ids[id] = 1
  });
  return Object.keys(ids).filter(function(id) {
    return REM[id] && REM[id].blob
  })
}

function reSaveSoon() {
  clearTimeout(reSaveT);
  reSaveT = setTimeout(reSave, 1200)
}

function reSave() {
  if (!RE) return;
  var media = reUsedMedia().map(function(id) {
    var M = REM[id];
    return {
      id: id,
      type: M.type,
      name: M.name,
      blob: M.blob
    }
  });
  reIDB('readwrite', function(s) {
    return s.put({
      proj: RE.proj,
      bin: RE.bin,
      media: media,
      at: Date.now()
    }, 'draft')
  }).then(function() {
    $('#reSaved').textContent = 'Draft saved'
  }, function(e) {
    console.warn('draft not saved', e);
    $('#reSaved').textContent = 'Draft not saved'
  })
}

function reLoadDraft() {
  return reIDB('readonly', function(s) {
    return s.get('draft')
  }).then(function(d) {
    if (!d || !d.proj) return false;
    return Promise.all(d.media.map(function(m) {
      if (REM[m.id]) return null;
      var f = m.type === 'video' ? reVideo : m.type === 'audio' ? reAudioMedia : rePhoto;
      return f(m.blob, m.name, m.id).catch(function(e) {
        console.warn('draft media lost', m.name, e)
      })
    })).then(function() {
      RE.proj = Object.assign(reBlank(), d.proj);
      RE.bin = (d.bin || []).filter(function(id) {
        return REM[id]
      });
      return true
    })
  }).catch(function(e) {
    console.warn('no draft', e);
    return false
  })
}

/* ---------- looks: filters + adjust ---------- */
function reLookKey(c) {
  return c.flt || c.adj.br || c.adj.co || c.adj.sa || c.adj.wa ? JSON.stringify([c.flt, c.fs, c.adj]) : ''
}

function reLookState(c) {
  var st = fresh();
  st.layers = [{
    t: 'adj',
    v: {
      brightness: c.adj.br,
      contrast: c.adj.co,
      saturation: c.adj.sa,
      warmth: c.adj.wa
    }
  }];
  if (c.flt) st.layers.push({
    t: 'flt',
    id: c.flt,
    s: c.fs
  });
  return st
}

// Photos get the app's real filter pipeline; the result is cached per look.
function reFiltered(c) {
  var M = REM[c.m],
    k = reLookKey(c);
  if (!k) return M.el;
  if (M.fc[k] && M.fc[k].getContext) return M.fc[k];
  if (!M.fc[k]) {
    M.fc[k] = 'pending';
    if (!M.sent) {
      var x = M.el.getContext('2d');
      sendSrc('rm-' + M.id, {
        w: M.el.width,
        h: M.el.height,
        d: x.getImageData(0, 0, M.el.width, M.el.height).data
      });
      M.sent = true
    }
    job({
      type: 'render',
      key: 'rm-' + M.id,
      st: reLookState(c),
      cache: false
    }).then(function(m) {
      var o = document.createElement('canvas');
      putC(o, m);
      M.fc[k] = o;
      M.th2 = null;
      if (RE && !RE.on) reDraw()
    }, function(e) {
      console.warn(e);
      delete M.fc[k]
    })
  }
  return M.el
}

// Videos get the same look as a 17³ colour cube, made by running the pipeline
// over an identity image, then applied to each frame.
var reLutSent = false,
  reLuts = {};

function reLut(c) {
  var k = reLookKey(c);
  if (!k) return null;
  if (reLuts[k] && reLuts[k].d) return reLuts[k];
  if (!reLuts[k]) {
    reLuts[k] = {};
    if (!reLutSent) {
      var n = 17,
        d = new Uint8ClampedArray(n * n * n * 4);
      for (var b = 0, i = 0; b < n; b++)
        for (var g = 0; g < n; g++)
          for (var r = 0; r < n; r++, i += 4) {
            d[i] = Math.round(r * 255 / (n - 1));
            d[i + 1] = Math.round(g * 255 / (n - 1));
            d[i + 2] = Math.round(b * 255 / (n - 1));
            d[i + 3] = 255
          }
      sendSrc('re-lut', {
        w: n * n,
        h: n,
        d: d
      });
      reLutSent = true
    }
    var st = reLookState(c);
    job({
      type: 'render',
      key: 're-lut',
      st: st,
      cache: false
    }).then(function(m) {
      var f = new Float32Array(17 * 17 * 17 * 3);
      for (var p = 0, q = 0; p < f.length; p += 3, q += 4) {
        f[p] = m.d[q] / 255;
        f[p + 1] = m.d[q + 1] / 255;
        f[p + 2] = m.d[q + 2] / 255
      }
      reLuts[k] = {
        n: 17,
        d: f
      }
    }, function() {
      delete reLuts[k]
    })
  }
  return null
}

function reCube(id, L) {
  var n = L.n,
    t = L.d,
    I = new Int32Array(256),
    F = new Float32Array(256),
    d = id.data,
    n2 = n * n;
  for (var v = 0; v < 256; v++) {
    var p = v / 255 * (n - 1),
      i0 = Math.min(n - 2, Math.floor(p));
    I[v] = i0;
    F[v] = p - i0
  }
  for (var i = 0; i < d.length; i += 4) {
    var r = d[i],
      g = d[i + 1],
      b = d[i + 2],
      fr = F[r],
      fg = F[g],
      fb = F[b],
      o = (I[r] + I[g] * n + I[b] * n2) * 3;
    for (var c = 0; c < 3; c++) {
      var k = o + c,
        c00 = t[k] + (t[k + 3] - t[k]) * fr,
        c10 = t[k + n * 3] + (t[k + n * 3 + 3] - t[k + n * 3]) * fr,
        c01 = t[k + n2 * 3] + (t[k + n2 * 3 + 3] - t[k + n2 * 3]) * fr,
        c11 = t[k + (n2 + n) * 3] + (t[k + (n2 + n) * 3 + 3] - t[k + (n2 + n) * 3]) * fr,
        c0 = c00 + (c10 - c00) * fg;
      d[i + c] = (c0 + (c01 + (c11 - c01) * fg - c0) * fb) * 255
    }
  }
}

/* ---------- drawing ---------- */
var reWork = document.createElement('canvas');

function reHash(s) {
  var h = 7;
  for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 2147483647;
  return h || 1
}

// Gentle push/pan for photo clips, fixed per clip so it looks the same every play.
function reKB(c) {
  if (c._kb) return c._kb;
  var r = vidRnd(reHash(c.id));
  return c._kb = {
    z0: 1.02 + r() * .06,
    z1: 1.1 + r() * .12,
    x0: .35 + r() * .3,
    y0: .35 + r() * .3,
    x1: .35 + r() * .3,
    y1: .35 + r() * .3
  }
}

function reSrcOf(c) {
  var M = REM[c.m];
  if (!M) return null;
  if (M.type === 'photo') return reFiltered(c);
  return M.el
}

// Draws clip c at l seconds in. o: {dx, dy, s, a} extra move, scale, opacity; end: use its last frame.
function reDrawClip(x, c, l, o, W, H) {
  var M = REM[c.m];
  o = o || {};
  if (!M) {
    x.fillStyle = '#222';
    x.fillRect(0, 0, W, H);
    return
  }
  var src = reSrcOf(c),
    iw = M.type === 'video' ? M.w : src.width,
    ih = M.type === 'video' ? M.h : src.height;
  if (M.type === 'video' && (!M.el.readyState || M.el.readyState < 2)) src = M.th;
  if (M.type === 'video' && src === M.el) {
    var L = reLut(c);
    if (L) {
      // Grade the frame at half size, then scale it up.
      var ww = Math.round(W / 2),
        hh = Math.round(H / 2);
      if (reWork.width !== ww || reWork.height !== hh) {
        reWork.width = ww;
        reWork.height = hh
      }
      var wx = reWork.getContext('2d', {
        willReadFrequently: true
      });
      reCoverDraw(wx, M.el, iw, ih, ww, hh, null, 0, c.mirror);
      var id = wx.getImageData(0, 0, ww, hh);
      reCube(id, L);
      wx.putImageData(id, 0, 0);
      x.save();
      x.globalAlpha = o.a == null ? 1 : o.a;
      x.translate(W / 2 + (o.dx || 0), H / 2 + (o.dy || 0));
      x.scale(o.s || 1, o.s || 1);
      x.drawImage(reWork, -W / 2, -H / 2, W, H);
      x.restore();
      return
    }
  }
  x.save();
  x.globalAlpha = o.a == null ? 1 : o.a;
  x.translate(W / 2 + (o.dx || 0), H / 2 + (o.dy || 0));
  x.scale(o.s || 1, o.s || 1);
  x.translate(-W / 2, -H / 2);
  reCoverDraw(x, src, src === M.th ? src.width : iw, src === M.th ? src.height : ih, W, H, c.motion ? reKB(c) : null, Math.min(1, l / Math.max(.01, c.dur)), c.mirror);
  x.restore()
}

function reCoverDraw(x, img, iw, ih, W, H, kb, p, mirror) {
  var z = kb ? kb.z0 + (kb.z1 - kb.z0) * p : 1,
    cx = kb ? kb.x0 + (kb.x1 - kb.x0) * p : .5,
    cy = kb ? kb.y0 + (kb.y1 - kb.y0) * p : .5,
    k = Math.max(W / iw, H / ih) * z,
    sw = Math.min(iw, W / k),
    sh = Math.min(ih, H / k);
  if (mirror) {
    x.save();
    x.translate(W, 0);
    x.scale(-1, 1)
  }
  x.drawImage(img, (iw - sw) * cx, (ih - sh) * cy, sw, sh, 0, 0, W, H);
  if (mirror) x.restore()
}

// The frame at time t, transitions included.
function reFrame(x, t, W, H) {
  x.globalCompositeOperation = 'source-over';
  x.globalAlpha = 1;
  x.fillStyle = '#000';
  x.fillRect(0, 0, W, H);
  var A = RE.proj.clips.length ? reAt(t) : null;
  if (A) {
    var c = A.c,
      l = A.l,
      pv = A.i ? RE.proj.clips[A.i - 1] : null,
      tr = c.tr || 'none',
      e;
    if ((tr === 'whip' || tr === 'swipe') && l < .26 && pv) {
      e = ease(l / .26);
      var hz = tr === 'whip',
        ox = hz ? W : 0,
        oy = hz ? 0 : H;
      for (var s = 3; s >= 0; s--) {
        var k = 1 + s * .12;
        reDrawClip(x, pv, pv.dur, {
          dx: -ox * e * k,
          dy: -oy * e * k,
          a: s ? .3 : 1
        }, W, H);
        reDrawClip(x, c, l, {
          dx: ox * (1 - e) * k,
          dy: oy * (1 - e) * k,
          a: s ? .3 : 1
        }, W, H)
      }
    } else if (tr === 'zoomblend' && l < .45 && pv) {
      e = ease(l / .45);
      reDrawClip(x, c, l, null, W, H);
      reDrawClip(x, pv, pv.dur, {
        s: 1 + e * .35,
        a: 1 - e
      }, W, H)
    } else if (tr === 'fade' && l < .4 && pv) {
      reDrawClip(x, pv, pv.dur, null, W, H);
      reDrawClip(x, c, l, {
        a: l / .4
      }, W, H)
    } else if (tr === 'blur' && l < .35) {
      var bl = 1 - l / .35;
      for (var q = 0; q < 5; q++) reDrawClip(x, c, l, {
        dx: (q - 2) * W * .012 * bl,
        dy: (q % 2 - .5) * H * .008 * bl,
        a: q ? .25 * bl : 1
      }, W, H)
    } else {
      var o = {};
      if (tr === 'punch' && l < .22) o.s = 1 + .24 * (1 - easeOut(l / .22));
      if (tr === 'shake' && l < .35) {
        var am = (1 - l / .35) * W * .03;
        o.dx = (Math.random() - .5) * am * 2;
        o.dy = (Math.random() - .5) * am * 2;
        o.s = 1.08
      }
      reDrawClip(x, c, l, o, W, H);
      if (tr === 'glitch' && l < .22) {
        var gd = W * .03 * (1 - l / .22);
        x.globalCompositeOperation = 'lighter';
        x.globalAlpha = .35;
        x.drawImage(x.canvas, -gd, 0);
        x.drawImage(x.canvas, gd, 0);
        x.globalAlpha = 1;
        x.globalCompositeOperation = 'source-over';
        for (var g = 0; g < 5; g++) {
          var y = Math.random() * H,
            hh = H * (.02 + Math.random() * .06);
          x.drawImage(x.canvas, 0, y, W, hh, (Math.random() - .5) * W * .08, y, W, hh)
        }
      }
    }
    if (tr === 'flash' && l < .25) {
      x.fillStyle = 'rgba(255,255,255,' + (1 - l / .25) + ')';
      x.fillRect(0, 0, W, H)
    }
  } else {
    x.fillStyle = '#888';
    x.font = '600 ' + W * .04 + 'px ' + cssv('--sans');
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText('Add photos or videos to start', W / 2, H / 2)
  }
  RE.hit = [];
  RE.proj.texts.forEach(function(T) {
    if (t >= T.a && t < T.b) reDrawText(x, T, t - T.a, W, H)
  });
  reDrawCaps(x, t, W, H)
}

function reFont(T, s) {
  return RE_FONTS[T.font][1].replace('{s}', Math.round(s)) + ', ' + cssv('--sans')
}

function reLum(hex) {
  var c = hexRGB(hex);
  return (.2126 * c[0] + .7152 * c[1] + .0722 * c[2]) / 255
}

function reWrap(x, txt, maxW) {
  var out = [];
  txt.split('\n').forEach(function(para) {
    var ln = '';
    para.split(' ').forEach(function(w) {
      var t2 = ln ? ln + ' ' + w : w;
      if (ln && x.measureText(t2).width > maxW) {
        out.push(ln);
        ln = w
      } else ln = t2
    });
    out.push(ln)
  });
  return out
}

// Text overlay with Instagram-style fonts, colour boxes and animations.
function reDrawText(x, T, l, W, H) {
  var s = T.size * W,
    len = T.b - T.a,
    txt = RE_FONTS[T.font][2] ? T.txt.toUpperCase() : T.txt,
    al = 1,
    sc = 1,
    dy = 0,
    an = T.anim;
  if (an !== 'none') {
    if (l > len - .2) al = Math.max(0, (len - l) / .2);
    if (an === 'pop') sc = l < .3 ? 1 + .3 * Math.sin(Math.min(1, l / .3) * Math.PI) * (1 - l / .3) + (l < .1 ? -.3 * (1 - l / .1) : 0) : 1;
    if (an === 'fade') al *= Math.min(1, l / .35);
    if (an === 'slide') {
      var sp = easeOut(Math.min(1, l / .35));
      dy = (1 - sp) * s * 1.2;
      al *= sp
    }
    if (an === 'type') txt = txt.slice(0, Math.floor(l * 22));
    if (an === 'words') txt = txt.split(' ').slice(0, 1 + Math.floor(l / .14)).join(' ')
  }
  if (!txt) return;
  x.save();
  x.font = reFont(T, s);
  x.textBaseline = 'middle';
  var lines = reWrap(x, txt, W * .82),
    full = reWrap(x, RE_FONTS[T.font][2] ? T.txt.toUpperCase() : T.txt, W * .82),
    lh = s * 1.22,
    cx = T.x * W,
    cy = T.y * H + dy,
    widths = full.map(function(t2) {
      return x.measureText(t2).width
    }),
    bw = Math.max.apply(null, widths.concat([10])),
    top = cy - full.length * lh / 2;
  RE.hit.push({
    id: T.id,
    x: cx - bw / 2 - s * .4,
    y: top - s * .3,
    w: bw + s * .8,
    h: full.length * lh + s * .6
  });
  x.globalAlpha = al;
  x.translate(cx, cy);
  x.scale(sc, sc);
  x.translate(-cx, -cy);
  var dark = reLum(T.color) > .6;
  lines.forEach(function(t2, i) {
    var w = x.measureText(t2).width,
      lx = T.align === 'left' ? cx - bw / 2 : T.align === 'right' ? cx + bw / 2 - w : cx - w / 2,
      ly = top + lh * (i + .5);
    if (T.bg === 'box' || T.bg === 'invert') {
      x.fillStyle = T.bg === 'box' ? T.color : '#fff';
      rr(x, lx - s * .3, ly - lh / 2, w + s * .6, lh, s * .22);
      x.fill()
    }
    x.textAlign = 'left';
    if (T.bg === 'outline') {
      x.lineWidth = s * .14;
      x.lineJoin = 'round';
      x.strokeStyle = dark ? '#000' : '#fff';
      x.strokeText(t2, lx, ly)
    }
    if (T.font === 'neon' && T.bg === 'none') {
      x.shadowColor = T.color;
      x.shadowBlur = s * .6;
      x.fillStyle = '#fff'
    } else if (T.bg === 'box') x.fillStyle = dark ? '#000' : '#fff';
    else {
      x.fillStyle = T.color;
      if (T.bg === 'none') {
        x.shadowColor = 'rgba(0,0,0,.35)';
        x.shadowBlur = s * .15
      }
    }
    x.fillText(t2, lx, ly);
    x.shadowBlur = 0
  });
  x.restore()
}

// Word-by-word captions, a few words at a time, the current word highlighted.
function reCapGroups() {
  var W2 = RE.proj.caps.words,
    key = W2.length + ':' + (W2[0] ? W2[0].a : 0) + ':' + (W2.length ? W2[W2.length - 1].b : 0);
  if (RE.cgKey === key) return RE.cg;
  var G = [],
    g = [];
  W2.forEach(function(w, i) {
    var gap = i && w.a - W2[i - 1].b > .4;
    if (g.length && (gap || g.length >= 3 || g.map(function(q) {
        return q.w
      }).join(' ').length > 16)) {
      G.push(g);
      g = []
    }
    g.push(w);
    if (/[,.!?:;]$/.test(w.w)) {
      G.push(g);
      g = []
    }
  });
  if (g.length) G.push(g);
  RE.cgKey = key;
  return RE.cg = G
}

function reDrawCaps(x, t, W, H) {
  var C = RE.proj.caps;
  if (!C.words.length || C.style === 'off') return;
  var G = reCapGroups(),
    g = G.filter(function(q) {
      return t >= q[0].a && t < q[q.length - 1].b + .15
    })[0];
  if (!g) return;
  var cs = W * .056,
    st = C.style,
    words = g.map(function(w) {
      return st === 'clean' ? w.w : w.w.toUpperCase()
    }),
    pop = Math.min(1, (t - g[0].a) / .1),
    sc = .85 + .15 * easeOut(pop);
  x.save();
  x.font = '700 ' + cs + 'px Montserrat, ' + cssv('--sans');
  x.textAlign = 'left';
  x.textBaseline = 'middle';
  var its = reelLayout(x, words, 0, 0, W * .8 / sc, cs * 1.25);
  x.translate(W * .47, C.y * H);
  x.scale(sc, sc);
  its.forEach(function(it, k) {
    reelWord(x, it, cs, st, t >= g[k].a && t < g[k].b + (k === g.length - 1 ? .15 : 0), 1)
  });
  x.restore()
}

function reDraw() {
  if (!RE) return;
  var c = $('#reC');
  reFrame(c.getContext('2d'), RE.t, c.width, c.height);
  reSyncTime()
}

/* ---------- playback ---------- */
// Video elements follow the timeline clock: the one under the playhead plays at
// its clip's speed and is nudged back if it drifts; the rest stay paused.
function reSyncVideos() {
  var A = RE.proj.clips.length ? reAt(RE.t) : null,
    cur = A && REM[A.c.m] && REM[A.c.m].type === 'video' ? REM[A.c.m] : null;
  Object.keys(REM).forEach(function(id) {
    var M = REM[id];
    if (M.type === 'video' && M !== cur && !M.el.paused) M.el.pause()
  });
  if (!cur) return;
  var c = A.c,
    want = c.in + A.l * c.speed,
    v = cur.el;
  if (cur.g) cur.g.gain.value = c.vol * RE.proj.origVol;
  if (RE.on) {
    v.playbackRate = c.speed;
    if (Math.abs(v.currentTime - want) > .25) v.currentTime = want;
    if (v.paused) {
      var p = v.play();
      if (p && p.catch) p.catch(function() {})
    }
  } else {
    if (!v.paused) v.pause();
    if (Math.abs(v.currentTime - want) > .03) v.currentTime = want
  }
}

// Mixer: everything goes to a bus that feeds the speakers (unless muted) and the recorder.
function reMix() {
  if (!reelAudio()) return null;
  if (!RE.bus) {
    RE.bus = RA.ac.createGain();
    RE.mon = RA.ac.createGain();
    RE.bus.connect(RE.mon).connect(RA.ac.destination);
    if (RA.dest) RE.bus.connect(RA.dest)
  }
  RE.mon.gain.value = RE.mute ? 0 : 1;
  Object.keys(REM).forEach(function(id) {
    var M = REM[id];
    if (M.type === 'video' && !M.g) {
      try {
        M.src = RA.ac.createMediaElementSource(M.el);
        M.g = RA.ac.createGain();
        M.src.connect(M.g).connect(RE.bus)
      } catch (e) {
        console.warn('video audio not routed', e)
      }
    }
  });
  return RE.bus
}

function reBpm() {
  var mu = RE.proj.music;
  if (!mu) return null;
  if (mu.kind === 'beat') return {
    spb: 60 / REEL_STYLES[mu.style].bpm,
    off: 0
  };
  var M = REM[mu.m];
  if (!M || !M.buf) return null;
  if (!M.tempo) M.tempo = reDetectTempo(M.buf);
  // Beat times in reel time, given the part of the song that's used.
  var spb = 60 / M.tempo.bpm,
    off = ((M.tempo.t0 - mu.off) % spb + spb) % spb;
  return {
    spb: spb,
    off: off,
    bpm: M.tempo.bpm
  }
}

// Starts (or stops) music, voiceovers and transition sounds from the playhead.
function reSound(on) {
  if (RE.sg) {
    RE.sg.disconnect();
    RE.sg = null
  }
  if (!on || !reMix()) return;
  if (RA.ac.state === 'suspended') RA.ac.resume();
  var ac = RA.ac,
    now = ac.currentTime + .03,
    t = RE.t,
    P = RE.proj;
  RE.sg = ac.createGain();
  RE.sg.connect(RE.bus);
  RE.mg = ac.createGain();
  RE.mg.gain.value = P.musicVol;
  RE.mg.connect(RE.sg);
  var mu = P.music;
  if (mu && mu.kind === 'file' && REM[mu.m]) {
    var b = REM[mu.m].buf,
      at = mu.off + t;
    if (at < b.duration) {
      var s = ac.createBufferSource();
      s.buffer = b;
      s.connect(RE.mg);
      s.start(now, at)
    }
  }
  P.vo.forEach(function(v) {
    var M = REM[v.m];
    if (!M || !M.buf || t >= v.a + M.dur) return;
    var s2 = ac.createBufferSource(),
      g = ac.createGain();
    s2.buffer = M.buf;
    g.gain.value = v.vol;
    s2.connect(g).connect(RE.sg);
    s2.start(now + Math.max(0, v.a - t), Math.max(0, t - v.a))
  });
  RE.fake = mu && mu.kind === 'beat' ? {
    sg: RE.mg,
    plan: {
      sk: mu.style,
      spb: 60 / REEL_STYLES[mu.style].bpm
    }
  } : null;
  RE.nb = RE.fake ? Math.ceil((t - 1e-6) / RE.fake.plan.spb) : 0;
  RE.ne = 0;
  RE.t0 = t;
  RE.c0 = now
}

// Beats and transition whooshes are scheduled a moment ahead, like the example reels.
function reSchedule() {
  if (!RE.sg) return;
  var ac = RA.ac,
    hz = RE.t + .25,
    D = reDur(),
    at = function(tt) {
      return ac.currentTime + Math.max(0, tt - RE.t)
    };
  if (RE.fake) {
    var spb = RE.fake.plan.spb;
    while (RE.nb * spb < hz && RE.nb * spb < D - .01) {
      reelBeat(RE.fake, RE.nb, at(RE.nb * spb));
      RE.nb++
    }
  }
  if (RE.proj.sfx) {
    var S2 = reStarts();
    while (RE.ne < S2.length && S2[RE.ne] < hz) {
      var c = RE.proj.clips[RE.ne];
      if (S2[RE.ne] >= RE.t - .01 && c.tr !== 'none') reelFx({
        sg: RE.sg
      }, {
        s: /whip|swipe|zoomblend|blur|fade/.test(c.tr) ? 'whoosh' : 'impact'
      }, at(S2[RE.ne]));
      RE.ne++
    }
  }
}

function rePlay(on) {
  if (!RE) return;
  var D = reDur();
  if (!D) return;
  if (on && RE.t >= D - .02) RE.t = 0;
  RE.on = on;
  RE.last = 0;
  reMix();
  reSound(on);
  reSyncVideos();
  $('#rePlay').innerHTML = on ? '&#10074;&#10074;' : '&#9654;'
}

function reSeek(t) {
  RE.t = Math.max(0, Math.min(reDur(), t));
  if (RE.on) reSound(true);
  reSyncVideos();
  reDraw()
}

function reTick(now) {
  if (!RE || !RE.open) return;
  if (RE.on) {
    RE.t += Math.min(.1, (now - (RE.last || now)) / 1000);
    var D = reDur();
    if (RE.t >= D) {
      if (RE.rec) {
        RE.t = D;
        RE.rec.stop();
        rePlay(false)
      } else {
        // Loops like the Reels preview.
        RE.t = 0;
        reSound(true)
      }
    }
    reSchedule();
    reSyncVideos();
    if (RE.voRec) reVoTick()
  }
  RE.last = now;
  reDraw();
  RE.raf = requestAnimationFrame(reTick)
}

function reFmt(s, tenths) {
  s = Math.max(0, s);
  var m = Math.floor(s / 60),
    r = s - m * 60;
  return m + ':' + (r < 10 ? '0' : '') + (tenths ? r.toFixed(1) : Math.floor(r))
}

function reSyncTime() {
  var D = reDur();
  $('#reTime').textContent = reFmt(RE.t, 1) + ' / ' + reFmt(D, 1);
  var ph = $('#rePH');
  ph.style.left = RE.t * RE.pps + 'px';
  if (RE.on) {
    var sc = $('#reScroll'),
      px = RE.t * RE.pps;
    if (px < sc.scrollLeft || px > sc.scrollLeft + sc.clientWidth - 40) sc.scrollLeft = px - 40
  }
}

/* ---------- beat sync ---------- */
// Rough tempo of a song: an onset envelope at 100 Hz, autocorrelated over 70-180 BPM,
// then the phase that lines up best with the onsets.
function reDetectTempo(buf) {
  var sr = buf.sampleRate,
    d = buf.getChannelData(0),
    hop = Math.round(sr / 100),
    n = Math.min(Math.floor(d.length / hop), 100 * 90),
    env = new Float32Array(n),
    prev = 0;
  for (var i = 0; i < n; i++) {
    var e = 0;
    for (var j = i * hop, J = j + hop; j < J; j += 4) e += d[j] * d[j];
    e = Math.sqrt(e);
    env[i] = Math.max(0, e - prev);
    prev = e
  }
  var best = 0,
    lag = 50;
  for (var L = Math.round(6000 / 180); L <= Math.round(6000 / 70); L++) {
    var s = 0;
    for (i = 0; i + L < n; i++) s += env[i] * env[i + L];
    // Slight preference for tempos near 120.
    s *= 1 - Math.abs(6000 / L - 120) / 400;
    if (s > best) {
      best = s;
      lag = L
    }
  }
  var bp = 0,
    ph0 = 0;
  for (var p = 0; p < lag; p++) {
    var sum = 0;
    for (i = p; i < n; i += lag) sum += env[i];
    if (sum > bp) {
      bp = sum;
      ph0 = p
    }
  }
  return {
    bpm: 6000 / lag,
    t0: ph0 / 100
  }
}

// Snaps every cut to the nearest beat of the music, like Reels' "sync to beat".
function reSyncBeat() {
  var B = reBpm();
  if (!B) return toast('Pick music first, then sync to its beat');
  if (!RE.proj.clips.length) return;
  var t = 0;
  RE.proj.clips.forEach(function(c) {
    var end = t + c.dur,
      k = Math.round((end - B.off) / B.spb),
      snapped = B.off + k * B.spb;
    while (snapped - t < B.spb * .99) snapped += B.spb;
    while (snapped - t > reMaxDur(c) + 1e-6 && snapped - B.spb - t >= B.spb * .99) snapped -= B.spb;
    c.dur = Math.max(.2, Math.min(reMaxDur(c), snapped - t));
    t += c.dur
  });
  reCommit('Sync to beat');
  toast('Cuts synced to ' + Math.round(60 / B.spb) + ' BPM')
}

function reSetMusic(mu, quiet) {
  RE.proj.music = mu;
  if (RE.on) reSound(true);
  if (!quiet) reCommit(mu ? 'Music' : 'Remove music')
}

/* ---------- voiceover + auto captions ---------- */
// Records the mic while the reel plays from the playhead. Where the browser has
// speech recognition, the words become timed captions as you speak.
function reVoStart() {
  if (!navigator.mediaDevices || !window.MediaRecorder) return toast('Recording isn’t supported in this browser');
  if (!reDur()) return toast('Add some clips first');
  navigator.mediaDevices.getUserMedia({
    audio: true
  }).then(function(stream) {
    var chunks = [],
      rec = new MediaRecorder(stream),
      a = RE.t;
    RE.voRec = {
      rec: rec,
      a: a,
      words: [],
      stream: stream
    };
    rec.ondataavailable = function(e) {
      if (e.data.size) chunks.push(e.data)
    };
    rec.onstop = function() {
      stream.getTracks().forEach(function(tr) {
        tr.stop()
      });
      var V = RE.voRec;
      RE.voRec = null;
      reRenderInsp();
      reAudioMedia(new Blob(chunks, {
        type: rec.mimeType || 'audio/webm'
      }), 'Voiceover ' + (RE.proj.vo.length + 1)).then(function(M) {
        RE.proj.vo.push({
          id: reId(),
          m: M.id,
          a: a,
          vol: 1
        });
        if (V.words.length) {
          RE.proj.caps.words = RE.proj.caps.words.filter(function(w) {
            return w.b < a || w.a > a + M.dur
          }).concat(V.words).sort(function(p, q) {
            return p.a - q.a
          })
        }
        reCommit('Voiceover');
        toast(V.words.length ? 'Voiceover added with ' + V.words.length + ' caption words' : 'Voiceover added')
      }, function(e) {
        toast('Couldn’t save the voiceover: ' + e.message)
      })
    };
    reVoSpeech();
    rec.start();
    rePlay(true);
    reRenderInsp()
  }, function() {
    toast('Microphone access was blocked')
  })
}

function reVoSpeech() {
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR || !$('#reVoCap') || !$('#reVoCap').classList.contains('on')) return;
  var r = new SR(),
    V = RE.voRec,
    starts = {};
  r.continuous = true;
  r.interimResults = true;
  r.onresult = function(e) {
    for (var i = e.resultIndex; i < e.results.length; i++) {
      if (starts[i] == null) starts[i] = Math.max(V.a, RE.t - .4);
      if (!e.results[i].isFinal) continue;
      var ws = e.results[i][0].transcript.trim().split(/\s+/).filter(Boolean),
        a = starts[i],
        b = Math.max(a + ws.length * .18, RE.t - .1),
        per = (b - a) / Math.max(1, ws.length);
      ws.forEach(function(w, k) {
        V.words.push({
          w: w,
          a: a + k * per,
          b: a + (k + 1) * per
        })
      })
    }
  };
  r.onerror = function() {};
  try {
    r.start();
    V.sr = r
  } catch (e) {}
}

function reVoTick() {
  var b = $('#reVoBtn');
  if (b) b.textContent = 'Stop recording · ' + reFmt(RE.t - RE.voRec.a, 1)
}

function reVoStop() {
  var V = RE.voRec;
  if (!V) return;
  rePlay(false);
  if (V.sr) try {
    V.sr.stop()
  } catch (e) {}
  // Give speech recognition a moment to deliver its last words.
  setTimeout(function() {
    V.rec.stop()
  }, V.sr ? 700 : 0)
}

// Spreads typed text over the reel (or the voiceover) as timed caption words.
function reCapsFromText(txt) {
  var ws = txt.trim().split(/\s+/).filter(Boolean),
    D = reDur(),
    vo = RE.proj.vo[0],
    a = vo ? vo.a : Math.min(.3, D * .05),
    b = vo && REM[vo.m] ? Math.min(D, vo.a + REM[vo.m].dur) : D - .2,
    tot = ws.reduce(function(s, w) {
      return s + Math.max(3, w.length)
    }, 0),
    t = a;
  RE.proj.caps.words = ws.map(function(w) {
    var len = (b - a) * Math.max(3, w.length) / tot,
      o = {
        w: w,
        a: t,
        b: t + len
      };
    t += len;
    return o
  })
}

/* ---------- export ---------- */
function reExport(res) {
  var type = vidRecType();
  if (!type) return toast('This browser can’t record video. Try Chrome, Edge or Safari');
  if (!reDur()) return toast('Add some clips first');
  var c = $('#reC'),
    h = res === 720 ? 1280 : 1920;
  c.width = h * 9 / 16;
  c.height = h;
  reMix();
  var stream = c.captureStream(30);
  if (RA && RA.dest) stream.addTrack(RA.dest.stream.getAudioTracks()[0]);
  var chunks = [],
    rec = new MediaRecorder(stream, {
      mimeType: type,
      videoBitsPerSecond: res === 720 ? 5e6 : 10e6
    });
  rec.ondataavailable = function(e) {
    if (e.data.size) chunks.push(e.data)
  };
  rec.onstop = function() {
    RE.rec = null;
    c.width = RE_W;
    c.height = RE_H;
    $('#reExpM').classList.remove('busy');
    var blob = new Blob(chunks, {
        type: type.split(';')[0]
      }),
      name = 'reel-studio-de-nuance.' + (/mp4/.test(type) ? 'mp4' : 'webm'),
      file = typeof File === 'function' ? new File([blob], name, {
        type: blob.type
      }) : null;
    RE.lastFile = file;
    var a = document.createElement('a'),
      u = URL.createObjectURL(blob);
    a.href = u;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function() {
      URL.revokeObjectURL(u)
    }, 8000);
    $('#reShare').hidden = !(file && navigator.canShare && navigator.canShare({
      files: [file]
    }));
    $('#reExpMsg').textContent = 'Saved ' + name + '. ' + (/mp4/.test(type) ? 'Ready for Instagram.' : 'This browser saves WebM. Instagram on the web accepts it; for the app, convert to MP4 or export from Safari.');
    reDraw()
  };
  RE.rec = rec;
  $('#reExpM').classList.add('busy');
  $('#reExpMsg').textContent = 'Recording in real time… ' + reFmt(reDur()) + '. Keep this tab open.';
  RE.t = 0;
  rec.start(250);
  rePlay(true)
}

function reCoverPng() {
  var c = document.createElement('canvas');
  c.width = RE_W;
  c.height = RE_H;
  var x = c.getContext('2d'),
    cv = RE.proj.cover;
  reFrame(x, cv.t, RE_W, RE_H);
  if (cv.title) reDrawText(x, {
    id: 'cover',
    txt: cv.title,
    font: 'strong',
    size: .1,
    color: '#ffffff',
    bg: 'outline',
    align: 'center',
    anim: 'none',
    x: .5,
    y: .45,
    a: 0,
    b: 1
  }, .5, RE_W, RE_H);
  c.toBlob(function(b) {
    var a = document.createElement('a'),
      u = URL.createObjectURL(b);
    a.href = u;
    a.download = 'reel-cover.jpg';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function() {
      URL.revokeObjectURL(u)
    }, 4000)
  }, 'image/jpeg', .92)
}

/* ---------- open / close ---------- */
function reOpen(then) {
  var first = !RE;
  if (first) RE = {
    proj: reBlank(),
    bin: [],
    hist: [],
    hix: -1,
    t: 0,
    on: false,
    pps: 60,
    sel: null,
    panel: null,
    mute: false,
    hit: []
  };
  RE.open = true;
  $('#reelEd').hidden = false;
  document.body.classList.add('re-on');
  // Unlock audio while we still have the click.
  if (reelAudio() && RA.ac.state === 'suspended') RA.ac.resume();
  var go = function() {
    if (!RE.hist.length) reCommit('Start');
    else reRenderAll();
    if (then) then();
    cancelAnimationFrame(RE.raf);
    RE.raf = requestAnimationFrame(reTick)
  };
  if (first) reLoadDraft().then(function(ok) {
    if (ok) toast('Draft restored');
    go()
  });
  else go()
}

function reClose() {
  if (!RE) return;
  if (RE.voRec) reVoStop();
  rePlay(false);
  RE.open = false;
  cancelAnimationFrame(RE.raf);
  reSave();
  $('#reelEd').hidden = true;
  document.body.classList.remove('re-on')
}

function reNew() {
  if (RE.proj.clips.length && !confirm('Start a new reel? The current one will be replaced.')) return;
  rePlay(false);
  RE.proj = reBlank();
  RE.sel = null;
  RE.panel = null;
  RE.t = 0;
  reCommit('New reel')
}

/* ---------- templates ---------- */
// "Use template": the outline's cuts, transitions, hook text, captions and beat,
// filled with the photos from the Reels tray (or the bin, or the open photo).
function reTemplate(i) {
  var P2 = vidPlan(i),
    o = OUTLINES[i],
    pool = RE.bin.map(function(id) {
      return REM[id]
    }).filter(function(M) {
      return M && M.type !== 'audio'
    });
  if (!pool.length && VPH.length) pool = VPH.map(function(p) {
    var M = reMediaFromCanvas(p.c, p.name);
    RE.bin.push(M.id);
    return M
  });
  if (!pool.length && afterC.width) {
    var cc = document.createElement('canvas');
    cc.width = afterC.width;
    cc.height = afterC.height;
    cc.getContext('2d').drawImage(afterC, 0, 0);
    var M0 = reMediaFromCanvas(cc, fileName || 'photo');
    RE.bin.push(M0.id);
    pool = [M0]
  }
  // No photos yet: empty slots to replace, like an Instagram template.
  var slots = !pool.length;
  if (slots) pool = [0, 1, 2].map(function(n) {
    return reMediaFromCanvas(photoSlot(n), 'Empty slot ' + (n + 1))
  });
  var P = reBlank(),
    trMap = {
      cut: 'none',
      none: 'none'
    };
  RE.proj = P;
  P2.all.forEach(function(pc, k) {
    var M = pool[k % pool.length],
      c = reAppendClip(M);
    c.dur = Math.max(.2, pc.b - pc.a);
    if (M.type === 'video') c.dur = Math.min(c.dur, M.dur);
    c.tr = trMap[pc.tr] || (RE_TR[pc.tr] ? pc.tr : 'none')
  });
  P2.beats.forEach(function(b) {
    if (b.hook) P.texts.push(reNewText(b.hook, b.a, Math.min(b.b, b.a + Math.max(1.5, b.b - b.a)), {
      font: 'strong',
      size: .095,
      bg: 'outline',
      anim: 'words',
      y: .3
    }));
    if (b.cap) {
      var ws = b.cap.split(' '),
        a = b.a + (b.hook ? Math.min(.6, (b.b - b.a) * .25) : .05),
        per = Math.max(.12, (b.b - .08 - a) / ws.length);
      ws.forEach(function(w, k) {
        P.caps.words.push({
          w: w,
          a: a + k * per,
          b: a + (k + 1) * per
        })
      })
    }
  });
  P.music = {
    kind: 'beat',
    style: P2.sk
  };
  RE.sel = null;
  RE.panel = null;
  RE.t = 0;
  reCommit('Template: ' + o[0]);
  toast(slots ? 'Template ready. Add your photos, then use Replace on each clip' : 'Template ready. Replace any clip with your own photo or video')
}

function reNewText(txt, a, b, o) {
  return Object.assign({
    id: reId(),
    txt: txt,
    a: a,
    b: b,
    x: .47,
    y: .4,
    size: .075,
    font: 'classic',
    color: '#ffffff',
    bg: 'none',
    align: 'center',
    anim: 'pop'
  }, o || {})
}

/* ---------- bin ---------- */
function reRenderBin() {
  var el = $('#reMedia');
  el.innerHTML = RE.bin.map(function(id) {
    var M = REM[id];
    if (!M) return '';
    return '<button class="rbm" data-id="' + id + '" title="' + esc(M.name) + ' · click to add to the end" draggable="true"><img src="' + M.url + '" alt="">' + (M.type === 'video' ? '<i>' + reFmt(M.dur) + '</i>' : '') + '</button>'
  }).join('') + '<button class="rbm add" id="reAdd2"><b>+</b>Add</button>' + (typeof SET !== 'undefined' && SET.length > 1 ? '<button class="btn rfromset" id="reFromSet">+ Photo set from the editor (' + SET.length + ')</button>' : '');
  $$('#reMedia .rbm[data-id]').forEach(function(b) {
    b.onclick = function() {
      var M = REM[b.dataset.id];
      if (RE.replace) {
        var c = reFind('clip', RE.replace);
        RE.replace = null;
        $('#reelEd').classList.remove('picking');
        if (c) {
          c.m = M.id;
          c.in = 0;
          c.motion = M.type === 'photo';
          c.dur = Math.min(c.dur, reMaxDur(c));
          reCommit('Replace clip')
        }
        return
      }
      var cl = reAppendClip(M);
      RE.sel = {
        k: 'clip',
        id: cl.id
      };
      reCommit('Add clip')
    };
    b.ondragstart = function(e) {
      e.dataTransfer.setData('text/rem', b.dataset.id)
    }
  });
  $('#reAdd2').onclick = function() {
    $('#reFile').click()
  };
  if ($('#reFromSet')) $('#reFromSet').onclick = function() {
    setToReel()
  };
  $('#reBinEmpty').hidden = !!RE.bin.length
}

/* ---------- timeline ---------- */
function reRenderTL() {
  var P = RE.proj,
    D = reDur(),
    pps = RE.pps,
    wpx = Math.max($('#reScroll').clientWidth - 20, (D + 4) * pps),
    S2 = reStarts(),
    sel = RE.sel || {};
  $('#reInner').style.width = wpx + 'px';
  // Ruler: a tick every second, labelled every 1-5 s depending on zoom.
  var step = pps >= 80 ? 1 : pps >= 40 ? 2 : 5,
    r = '';
  for (var s = 0; s <= D + 4; s++) r += '<i style="left:' + s * pps + 'px"' + (s % step ? '' : ' class="l"') + '>' + (s % step ? '' : reFmt(s)) + '</i>';
  $('#reRuler').innerHTML = r;
  $('#reTrV').innerHTML = P.clips.map(function(c, i) {
    var M = REM[c.m];
    return '<div class="rc' + (sel.id === c.id ? ' on' : '') + '" data-i="' + i + '" style="left:' + S2[i] * pps + 'px;width:' + Math.max(8, c.dur * pps - 2) + 'px;background-image:url(' + (M ? M.url : '') + ')"><span>' + c.dur.toFixed(1) + 's' + (c.speed !== 1 ? ' · ' + c.speed + '×' : '') + (c.flt ? ' · ' + esc(fname(c.flt)) : '') + '</span><b class="rh l"></b><b class="rh r"></b></div>' + (i ? '<button class="rtr' + (c.tr !== 'none' ? ' set' : '') + '" data-i="' + i + '" style="left:' + S2[i] * pps + 'px" title="Transition: ' + RE_TR[c.tr] + '">' + (c.tr !== 'none' ? '&#10022;' : '&#9671;') + '</button>' : '')
  }).join('') || '<button class="rempty" id="reEmptyAdd"><b>+ Upload photos &amp; videos</b><span>Pick as many as you like. They go on the timeline in order</span></button>';
  // Text blocks stack in lanes so overlapping texts stay visible.
  var lanes = [];
  var th = P.texts.slice().sort(function(a, b) {
    return a.a - b.a
  }).map(function(T) {
    var ln = 0;
    while (lanes[ln] != null && lanes[ln] > T.a + 1e-3) ln++;
    lanes[ln] = T.b;
    return '<div class="rt' + (sel.id === T.id ? ' on' : '') + '" data-id="' + T.id + '" style="left:' + T.a * pps + 'px;width:' + Math.max(8, (T.b - T.a) * pps - 2) + 'px;top:' + ln * 22 + 'px"><span>Aa ' + esc(T.txt.replace(/\n/g, ' ')) + '</span><b class="rh l"></b><b class="rh r"></b></div>'
  });
  $('#reTrT').innerHTML = th.join('');
  $('#reTrT').style.height = Math.max(24, lanes.length * 22 + 2) + 'px';
  var W2 = P.caps.words;
  $('#reTrC').innerHTML = W2.length ? '<div class="rcap' + (RE.panel === 'caps' ? ' on' : '') + '" style="left:' + W2[0].a * pps + 'px;width:' + Math.max(8, (W2[W2.length - 1].b - W2[0].a) * pps) + 'px"><span>Captions · ' + W2.length + ' words</span></div>' : '';
  var mu = P.music,
    mname = mu ? mu.kind === 'beat' ? '&#9835; ' + RE_BEATS[mu.style] + ' beat · ' + REEL_STYLES[mu.style].bpm + ' BPM' : '&#9835; ' + esc(REM[mu.m] ? REM[mu.m].name : 'Song') : '';
  $('#reTrA').innerHTML = (mu ? '<div class="ra mus' + (RE.panel === 'audio' ? ' on' : '') + '" style="left:0;width:' + Math.max(40, D * pps - 2) + 'px"><span>' + mname + '</span></div>' : '') + P.vo.map(function(v) {
    var M = REM[v.m];
    return '<div class="ra vo' + (sel.id === v.id ? ' on' : '') + '" data-id="' + v.id + '" style="left:' + v.a * pps + 'px;width:' + Math.max(8, (M ? M.dur : 1) * pps - 2) + 'px"><span>&#127908; ' + esc(M ? M.name : 'Voiceover') + '</span></div>'
  }).join('');
  if ($('#reEmptyAdd')) $('#reEmptyAdd').onclick = function() {
    $('#reFile').click()
  };
  reWireTL();
  reSyncTime()
}

function reWireTL() {
  var pps = RE.pps;
  // Clips: click selects, drag reorders, edges trim (left edge slips the in-point).
  $$('#reTrV .rc').forEach(function(el) {
    el.onpointerdown = function(e) {
      var i = +el.dataset.i,
        c = RE.proj.clips[i],
        mode = e.target.classList.contains('l') ? 'l' : e.target.classList.contains('r') ? 'r' : 'move',
        x0 = e.clientX,
        o = {
          dur: c.dur,
          in: c.in
        },
        moved = false;
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      RE.sel = {
        k: 'clip',
        id: c.id
      };
      RE.panel = null;
      el.onpointermove = function(ev) {
        var dx = (ev.clientX - x0) / pps;
        if (Math.abs(ev.clientX - x0) > 3) moved = true;
        if (!moved) return;
        if (mode === 'r') c.dur = Math.max(.2, Math.min(reMaxDur(Object.assign({}, c, {
          in: o.in
        })), o.dur + dx));
        else if (mode === 'l') {
          var M = REM[c.m],
            d = Math.min(o.dur - .2, dx);
          if (M && M.type === 'video') d = Math.max(-o.in / c.speed, d);
          c.dur = o.dur - d;
          if (M && M.type === 'video') c.in = o.in + d * c.speed
        } else {
          el.style.transform = 'translateX(' + (ev.clientX - x0) + 'px)';
          el.classList.add('drag');
          return
        }
        el.style.width = c.dur * pps - 2 + 'px';
        el.querySelector('span').textContent = c.dur.toFixed(1) + 's';
        reDraw()
      };
      el.onpointerup = function(ev) {
        el.onpointermove = el.onpointerup = null;
        if (!moved) {
          // Clicking a clip moves the playhead onto it if it isn't there already.
          var st = reStarts()[i];
          if (RE.t < st || RE.t >= st + c.dur) RE.t = st + .01;
          reSeek(RE.t);
          reRenderAll();
          return
        }
        if (mode === 'move') {
          // Drop position → new index, using clip centres.
          var px = el.offsetLeft + (ev.clientX - x0) + el.offsetWidth / 2,
            S2 = reStarts(),
            C = RE.proj.clips,
            to = 0;
          for (var k = 0; k < C.length; k++)
            if (k !== i && px > (S2[k] + C[k].dur / 2) * pps) to++;
          C.splice(i, 1);
          C.splice(to, 0, c);
          if (to === 0) c.tr = 'none';
          reCommit('Move clip')
        } else reCommit(mode === 'l' ? 'Trim start' : 'Trim end')
      }
    }
  });
  $$('#reTrV .rtr').forEach(function(b) {
    b.onclick = function(e) {
      e.stopPropagation();
      RE.sel = {
        k: 'clip',
        id: RE.proj.clips[+b.dataset.i].id
      };
      RE.panel = 'tr';
      reRenderAll()
    }
  });
  // Texts and voiceovers: drag to move, text edges to change timing.
  $$('#reTrT .rt, #reTrA .vo').forEach(function(el) {
    el.onpointerdown = function(e) {
      var isT = el.classList.contains('rt'),
        o = reFind(isT ? 'text' : 'vo', el.dataset.id),
        mode = e.target.classList.contains('l') ? 'l' : e.target.classList.contains('r') ? 'r' : 'move',
        x0 = e.clientX,
        a0 = o.a,
        b0 = o.b,
        moved = false;
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      RE.sel = {
        k: isT ? 'text' : 'vo',
        id: o.id
      };
      RE.panel = null;
      el.onpointermove = function(ev) {
        var dx = (ev.clientX - x0) / pps;
        if (Math.abs(ev.clientX - x0) > 3) moved = true;
        if (!moved) return;
        if (mode === 'move') {
          o.a = Math.max(0, a0 + dx);
          if (isT) o.b = o.a + (b0 - a0)
        } else if (mode === 'l') o.a = Math.max(0, Math.min(b0 - .2, a0 + dx));
        else o.b = Math.max(a0 + .2, b0 + dx);
        el.style.left = o.a * pps + 'px';
        if (isT) el.style.width = (o.b - o.a) * pps - 2 + 'px';
        reDraw()
      };
      el.onpointerup = function() {
        el.onpointermove = el.onpointerup = null;
        if (moved) reCommit(isT ? 'Move text' : 'Move voiceover');
        else {
          if (isT && (RE.t < o.a || RE.t >= o.b)) RE.t = o.a + .01;
          reSeek(RE.t);
          reRenderAll()
        }
      }
    }
  });
  $$('#reTrC .rcap').forEach(function(el) {
    el.onclick = function() {
      RE.sel = null;
      RE.panel = 'caps';
      reRenderAll()
    }
  });
  $$('#reTrA .mus').forEach(function(el) {
    el.onclick = function() {
      RE.sel = null;
      RE.panel = 'audio';
      reRenderAll()
    }
  })
}

// Click or drag on the ruler / empty timeline to move the playhead.
(function() {
  var sc = $('#reScroll');
  sc.addEventListener('pointerdown', function(e) {
    if (e.target.closest('.rc,.rt,.ra,.rtr,.rcap')) return;
    var r = $('#reInner').getBoundingClientRect(),
      at = function(ev) {
        reSeek((ev.clientX - r.left) / RE.pps)
      };
    at(e);
    sc.setPointerCapture(e.pointerId);
    sc.onpointermove = at;
    sc.onpointerup = function() {
      sc.onpointermove = sc.onpointerup = null
    }
  });
  sc.addEventListener('dragover', function(e) {
    if (e.dataTransfer.types.indexOf('text/rem') >= 0) e.preventDefault()
  });
  sc.addEventListener('drop', function(e) {
    var id = e.dataTransfer.getData('text/rem');
    if (!id || !REM[id]) return;
    e.preventDefault();
    var r = $('#reInner').getBoundingClientRect(),
      t = (e.clientX - r.left) / RE.pps,
      S2 = reStarts(),
      C = RE.proj.clips,
      at = 0;
    for (var k = 0; k < C.length; k++)
      if (t > S2[k] + C[k].dur / 2) at = k + 1;
    var cl = reAppendClip(REM[id], at);
    RE.sel = {
      k: 'clip',
      id: cl.id
    };
    reCommit('Add clip')
  });
  $('#reZoom').oninput = function() {
    RE.pps = +this.value;
    reRenderTL()
  }
})();

/* ---------- inspector ---------- */
function reSl(id, label, min, max, step, val, fmt) {
  return '<div class="sl" id="' + id + 'W"><label>' + label + '</label><output>' + (fmt ? fmt(val) : val) + '</output><input type="range" id="' + id + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '"></div>'
}

// Live while dragging, one undo step on release.
function reWireSl(id, set, label, fmt) {
  var inp = $('#' + id);
  if (!inp) return;
  var out = inp.parentNode.querySelector('output'),
    paint = function() {
      var v = +inp.value,
        mn = +inp.min,
        mx = +inp.max,
        p = (v - mn) / (mx - mn) * 100,
        z = mn < 0 ? -mn / (mx - mn) * 100 : 0;
      inp.style.setProperty('--a', Math.min(p, z) + '%');
      inp.style.setProperty('--b', Math.max(p, z) + '%');
      out.textContent = fmt ? fmt(v) : v
    };
  paint();
  inp.oninput = function() {
    set(+inp.value);
    paint();
    reDraw();
    if (RE.on) reSyncVideos()
  };
  inp.onchange = function() {
    reCommit(label)
  }
}

function reChips(id, opts, cur, extra) {
  return '<div class="chips rchips" id="' + id + '">' + Object.keys(opts).map(function(k) {
    return '<button data-v="' + k + '" class="' + (String(cur) === k ? 'on' : '') + '"' + (extra ? extra(k) : '') + '>' + opts[k] + '</button>'
  }).join('') + '</div>'
}

function reWireChips(id, f) {
  $$('#' + id + ' button').forEach(function(b) {
    b.onclick = function() {
      f(b.dataset.v)
    }
  })
}

function rePct(v) {
  return Math.round(v * 100) + '%'
}

function reRenderInsp() {
  var el = $('#reInsp'),
    P = RE.proj,
    o = reSelObj(),
    k = RE.sel && o ? RE.sel.k : null,
    pn = RE.panel,
    h = '';
  if (pn === 'audio') h = reInspAudio();
  else if (pn === 'caps') h = reInspCaps();
  else if (pn === 'vo') h = reInspVo();
  else if (pn === 'cover') h = reInspCover();
  else if (pn === 'tpl') h = reInspTpl();
  else if (k === 'clip') h = pn === 'tr' ? reInspTr(o) : reInspClip(o);
  else if (k === 'text') h = reInspText(o);
  else if (k === 'vo') h = '<h4>Voiceover</h4>' + reSl('riVol', 'Volume', 0, 2, .05, o.vol, rePct) + '<div class="row rbtns"><button class="btn" id="riDel">Delete</button></div>';
  else h = '<h4>Your reel</h4><p class="rinfo">' + P.clips.length + ' clip' + (P.clips.length === 1 ? '' : 's') + ' · ' + reFmt(reDur(), 1) + (reDur() > RE_MAX ? ' · <b class="warn">Reels can be up to 3 minutes</b>' : '') + '</p><div class="rquick"><button class="btn" data-act="add">+ Photos &amp; videos</button><button class="btn" data-act="text">Aa Text</button><button class="btn" data-act="audio">&#9835; Music</button><button class="btn" data-act="caps">CC Captions</button><button class="btn" data-act="vo">&#127908; Voiceover</button><button class="btn" data-act="tpl">&#9638; Templates</button></div><p class="hint rtips">Click a clip or text on the timeline to edit it. Drag clips to reorder, drag their edges to trim. Drag text on the preview to move it.<br><kbd>Space</kbd> play &middot; <kbd>S</kbd> split &middot; <kbd>D</kbd> duplicate &middot; <kbd>T</kbd> text &middot; <kbd>Del</kbd> delete &middot; <kbd>&larr;</kbd><kbd>&rarr;</kbd> step</p>';
  el.innerHTML = h;
  $$('#reInsp [data-act]').forEach(function(b) {
    b.onclick = function() {
      reAct(b.dataset.act)
    }
  });
  if (pn === 'audio') reWireAudio();
  else if (pn === 'caps') reWireCaps();
  else if (pn === 'vo') reWireVo();
  else if (pn === 'cover') reWireCover();
  else if (pn === 'tpl') reWireTpl();
  else if (k === 'clip') pn === 'tr' ? reWireTr(o) : reWireClip(o);
  else if (k === 'text') reWireText(o);
  else if (k === 'vo') {
    reWireSl('riVol', function(v) {
      o.vol = v
    }, 'Voiceover volume', rePct);
    $('#riDel').onclick = function() {
      reAct('del')
    }
  }
}

function reInspClip(c) {
  var M = REM[c.m] || {
      type: 'photo',
      name: 'Missing'
    },
    i = RE.proj.clips.indexOf(c),
    vid = M.type === 'video',
    cats = {};
  P.FL.forEach(function(f) {
    (cats[f[2]] = cats[f[2]] || []).push(f)
  });
  var sel = '<select id="riFlt"><option value="">No filter</option>' + Object.keys(cats).map(function(ct) {
    return '<optgroup label="' + esc(ct) + '">' + cats[ct].map(function(f) {
      return '<option value="' + f[0] + '"' + (c.flt === f[0] ? ' selected' : '') + '>' + esc(f[1]) + '</option>'
    }).join('') + '</optgroup>'
  }).join('') + '</select>';
  return '<h4>Clip ' + (i + 1) + ' <small>' + esc(M.name) + '</small></h4>' +
    '<div class="row rbtns"><button class="btn" id="riRep">Replace</button><button class="btn" data-act="split">Split</button><button class="btn" data-act="dup">Duplicate</button><button class="btn" data-act="del">Delete</button></div>' +
    (vid ? reSl('riDur', 'Length', .2, Math.max(.3, reMaxDur(c)), .05, c.dur, function(v) {
      return v.toFixed(1) + 's'
    }) + reSl('riIn', 'Slip <em>start point in the video</em>', 0, Math.max(0, M.dur - c.dur * c.speed), .05, c.in, function(v) {
      return v.toFixed(1) + 's'
    }) : reSl('riDur', 'Length', .2, 15, .1, c.dur, function(v) {
      return v.toFixed(1) + 's'
    })) +
    (vid ? '<div class="lbl">Speed</div>' + reChips('riSpd', RE_SPEEDS.reduce(function(o, v) {
      o[v] = v + '×';
      return o
    }, {}), c.speed) + reSl('riVolC', 'Volume', 0, 2, .05, c.vol, rePct) : '') +
    '<div class="lbl">Filter</div>' + sel + (c.flt ? reSl('riFs', 'Strength', 0, 1, .05, c.fs, rePct) : '') +
    (vid && reLookKey(c) ? '<p class="hint">On videos, filters are applied as a colour grade.</p>' : '') +
    '<div class="lbl">Adjust</div>' + reSl('riBr', 'Brightness', -100, 100, 1, c.adj.br) + reSl('riCo', 'Contrast', -100, 100, 1, c.adj.co) + reSl('riSa', 'Saturation', -100, 100, 1, c.adj.sa) + reSl('riWa', 'Warmth', -100, 100, 1, c.adj.wa) +
    '<div class="tog">Mirror <button class="sw' + (c.mirror ? ' on' : '') + '" id="riMir" aria-label="Mirror"></button></div>' +
    (!vid ? '<div class="tog">Slow zoom (Ken Burns) <button class="sw' + (c.motion ? ' on' : '') + '" id="riMot" aria-label="Slow zoom"></button></div>' : '') +
    (i ? '<div class="lbl">Transition in</div>' + reChips('riTr', RE_TR, c.tr) : '')
}

function reWireClip(c) {
  var lbl = function(v) {
    return v.toFixed(1) + 's'
  };
  reWireSl('riDur', function(v) {
    c.dur = Math.min(v, reMaxDur(c))
  }, 'Clip length', lbl);
  reWireSl('riIn', function(v) {
    c.in = v
  }, 'Slip', lbl);
  reWireSl('riVolC', function(v) {
    c.vol = v
  }, 'Clip volume', rePct);
  reWireSl('riFs', function(v) {
    c.fs = v
  }, 'Filter strength', rePct);
  [
    ['riBr', 'br', 'Brightness'],
    ['riCo', 'co', 'Contrast'],
    ['riSa', 'sa', 'Saturation'],
    ['riWa', 'wa', 'Warmth']
  ].forEach(function(q) {
    reWireSl(q[0], function(v) {
      c.adj[q[1]] = v
    }, q[2])
  });
  reWireChips('riSpd', function(v) {
    var ns = +v;
    c.dur = Math.max(.2, c.dur * c.speed / ns);
    c.speed = ns;
    c.dur = Math.min(c.dur, reMaxDur(c));
    reCommit('Speed ' + v + '×')
  });
  reWireChips('riTr', function(v) {
    c.tr = v;
    reCommit('Transition')
  });
  $('#riFlt').onchange = function() {
    c.flt = this.value;
    reCommit(c.flt ? 'Filter: ' + fname(c.flt) : 'No filter')
  };
  $('#riMir').onclick = function() {
    c.mirror = !c.mirror;
    reCommit('Mirror')
  };
  if ($('#riMot')) $('#riMot').onclick = function() {
    c.motion = !c.motion;
    reCommit('Slow zoom')
  };
  $('#riRep').onclick = function() {
    RE.replace = c.id;
    $('#reelEd').classList.add('picking', 'binopen');
    toast('Pick a photo or video in the media bin to replace this clip')
  }
}

function reInspTr(c) {
  return '<h4>Transition into clip ' + (RE.proj.clips.indexOf(c) + 1) + '</h4>' + reChips('riTr', RE_TR, c.tr) + '<div class="row rbtns"><button class="btn" id="riTrAll">Use on every cut</button><button class="btn ghost" id="riTrBack">Clip settings</button></div>'
}

function reWireTr(c) {
  reWireChips('riTr', function(v) {
    c.tr = v;
    reCommit('Transition')
  });
  $('#riTrAll').onclick = function() {
    RE.proj.clips.forEach(function(q, i) {
      if (i) q.tr = c.tr
    });
    reCommit('Transition on every cut')
  };
  $('#riTrBack').onclick = function() {
    RE.panel = null;
    reRenderInsp()
  }
}

function reInspText(T) {
  var fonts = {};
  Object.keys(RE_FONTS).forEach(function(k) {
    fonts[k] = RE_FONTS[k][0]
  });
  return '<h4>Text</h4><textarea id="riTxt" rows="3" placeholder="Type something">' + esc(T.txt) + '</textarea>' +
    '<div class="lbl">Font</div>' + reChips('riFont', fonts, T.font, function(k) {
      return ' style="font:' + RE_FONTS[k][1].replace('{s}', 13) + '"'
    }) +
    '<div class="lbl">Color</div><div class="rsw" id="riCol">' + RE_COLORS.map(function(c) {
      return '<button data-v="' + c + '" class="' + (T.color === c ? 'on' : '') + '" style="background:' + c + '" aria-label="' + c + '"></button>'
    }).join('') + '<label class="rpick" title="Any color"><input type="color" id="riColAny" value="' + T.color + '"></label></div>' +
    '<div class="lbl">Background</div>' + reChips('riBg', RE_BG, T.bg) +
    '<div class="lbl">Align</div>' + reChips('riAl', {
      left: 'Left',
      center: 'Center',
      right: 'Right'
    }, T.align) +
    reSl('riSz', 'Size', .03, .2, .005, T.size, function(v) {
      return Math.round(v * 1000)
    }) +
    '<div class="lbl">Animation</div>' + reChips('riAn', RE_ANIM, T.anim) +
    reSl('riA', 'Starts at', 0, Math.max(.1, reDur()), .05, T.a, function(v) {
      return reFmt(v, 1)
    }) + reSl('riB', 'Ends at', 0, Math.max(.2, reDur()), .05, T.b, function(v) {
      return reFmt(v, 1)
    }) +
    '<div class="row rbtns"><button class="btn" data-act="dup">Duplicate</button><button class="btn" data-act="del">Delete</button></div>'
}

function reWireText(T) {
  var ta = $('#riTxt'),
    tt;
  ta.oninput = function() {
    T.txt = ta.value;
    reDraw();
    clearTimeout(tt);
    tt = setTimeout(function() {
      reCommitQuiet('Edit text')
    }, 600)
  };
  reWireChips('riFont', function(v) {
    T.font = v;
    reCommit('Font')
  });
  reWireChips('riBg', function(v) {
    T.bg = v;
    reCommit('Text background')
  });
  reWireChips('riAl', function(v) {
    T.align = v;
    reCommit('Align')
  });
  reWireChips('riAn', function(v) {
    T.anim = v;
    RE.t = T.a;
    rePlay(true);
    reCommit('Animation')
  });
  reWireChips('riCol', function(v) {
    T.color = v;
    reCommit('Text color')
  });
  $('#riColAny').onchange = function() {
    T.color = this.value;
    reCommit('Text color')
  };
  reWireSl('riSz', function(v) {
    T.size = v
  }, 'Text size', function(v) {
    return Math.round(v * 1000)
  });
  reWireSl('riA', function(v) {
    T.a = Math.min(v, T.b - .1)
  }, 'Text timing', function(v) {
    return reFmt(v, 1)
  });
  reWireSl('riB', function(v) {
    T.b = Math.max(v, T.a + .1)
  }, 'Text timing', function(v) {
    return reFmt(v, 1)
  })
}

// Commits without rebuilding the inspector, so typing isn't interrupted.
function reCommitQuiet(label) {
  RE.hist.length = RE.hix + 1;
  RE.hist.push(JSON.stringify(RE.proj));
  RE.hix = RE.hist.length - 1;
  reRenderTL();
  reSyncBtns();
  reSaveSoon()
}

function reInspAudio() {
  var P = RE.proj,
    mu = P.music,
    cur = !mu ? 'none' : mu.kind === 'beat' ? mu.style : 'file',
    opts = {
      none: 'No music'
    };
  Object.keys(RE_BEATS).forEach(function(k) {
    opts[k] = RE_BEATS[k] + ' · ' + REEL_STYLES[k].bpm
  });
  var M = mu && mu.kind === 'file' ? REM[mu.m] : null,
    B = reBpm();
  return '<h4>Audio</h4><div class="lbl">Built-in beats</div>' + reChips('riMus', opts, cur) +
    '<div class="row rbtns"><button class="btn" id="riSong">' + (M ? 'Change song…' : 'Use your own song…') + '</button></div>' +
    (M ? '<p class="rinfo">&#9835; ' + esc(M.name) + ' · ' + reFmt(M.dur) + '</p>' + reSl('riOff', 'Part of the song <em>where your reel starts</em>', 0, Math.max(0, M.dur - Math.min(M.dur, reDur())), .1, mu.off, function(v) {
      return reFmt(v, 1)
    }) : '') +
    (mu ? reSl('riMV', 'Music volume', 0, 1.5, .05, P.musicVol, rePct) : '') +
    reSl('riOV', 'Original audio <em>sound from your videos</em>', 0, 1.5, .05, P.origVol, rePct) +
    '<div class="tog">Transition sound effects <button class="sw' + (P.sfx ? ' on' : '') + '" id="riSfx" aria-label="Transition sounds"></button></div>' +
    '<div class="lbl">Beat sync</div><p class="hint">' + (B ? 'Music at about ' + Math.round(60 / B.spb) + ' BPM. ' : 'Pick music first. ') + 'Snaps every cut to the nearest beat.</p><div class="row rbtns"><button class="btn pri" data-act="beat"' + (B ? '' : ' disabled') + '>Sync cuts to beat</button></div>' +
    '<p class="hint">Instagram’s music library can only be added inside Instagram. Use a built-in beat or a song you have the rights to.</p>'
}

function reWireAudio() {
  var P = RE.proj;
  reWireChips('riMus', function(v) {
    reSetMusic(v === 'none' ? null : {
      kind: 'beat',
      style: v
    })
  });
  $('#riSong').onclick = function() {
    $('#reSong').click()
  };
  reWireSl('riOff', function(v) {
    P.music.off = v;
    if (RE.on) reSound(true)
  }, 'Song start', function(v) {
    return reFmt(v, 1)
  });
  reWireSl('riMV', function(v) {
    P.musicVol = v;
    if (RE.mg) RE.mg.gain.value = v
  }, 'Music volume', rePct);
  reWireSl('riOV', function(v) {
    P.origVol = v
  }, 'Original audio', rePct);
  $('#riSfx').onclick = function() {
    P.sfx = !P.sfx;
    reCommit('Transition sounds')
  }
}

function reInspCaps() {
  var C = RE.proj.caps;
  return '<h4>Captions</h4><p class="hint">Word-by-word captions, like Instagram’s captions sticker. Record a voiceover in Chrome or Edge and they’re made as you speak. Or type the script here and they’re timed across the reel.</p>' +
    '<textarea id="riCapT" rows="5" placeholder="Type or paste what is said in the reel">' + esc(C.words.map(function(w) {
      return w.w
    }).join(' ')) + '</textarea><div class="row rbtns"><button class="btn pri" id="riCapGo">Time captions to the reel</button>' + (C.words.length ? '<button class="btn" id="riCapDel">Remove</button>' : '') + '</div>' +
    '<div class="lbl">Style</div>' + reChips('riCapS', REEL_CAPS, C.style) + reSl('riCapY', 'Position', .2, .64, .01, C.y, function(v) {
      return Math.round(v * 100) + '%'
    })
}

function reWireCaps() {
  var C = RE.proj.caps;
  $('#riCapGo').onclick = function() {
    if (!reDur()) return toast('Add some clips first');
    reCapsFromText($('#riCapT').value);
    reCommit('Captions')
  };
  if ($('#riCapDel')) $('#riCapDel').onclick = function() {
    C.words = [];
    reCommit('Remove captions')
  };
  reWireChips('riCapS', function(v) {
    C.style = v;
    reCommit('Caption style')
  });
  reWireSl('riCapY', function(v) {
    C.y = v
  }, 'Caption position', function(v) {
    return Math.round(v * 100) + '%'
  })
}

function reInspVo() {
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  return '<h4>Voiceover</h4><p class="hint">Records your mic while the reel plays from the playhead.</p><div class="row rbtns"><button class="btn pri" id="reVoBtn">' + (RE.voRec ? 'Stop recording' : '&#9679; Record from ' + reFmt(RE.t, 1)) + '</button></div>' +
    (SR ? '<div class="tog">Auto captions while you speak <button class="sw on" id="reVoCap" aria-label="Auto captions"></button></div>' : '<p class="hint">Auto captions need Chrome or Edge. You can still type captions in the Captions tool.</p>') +
    (RE.proj.vo.length ? '<div class="lbl">Recorded</div><ul class="rvol">' + RE.proj.vo.map(function(v) {
      var M = REM[v.m];
      return '<li data-id="' + v.id + '"><span>&#127908; ' + esc(M ? M.name : 'Voiceover') + '</span><em>' + reFmt(v.a, 1) + '</em></li>'
    }).join('') + '</ul>' : '')
}

function reWireVo() {
  $('#reVoBtn').onclick = function() {
    RE.voRec ? reVoStop() : reVoStart()
  };
  if ($('#reVoCap')) $('#reVoCap').onclick = function() {
    this.classList.toggle('on')
  };
  $$('#reInsp .rvol li').forEach(function(li) {
    li.onclick = function() {
      RE.sel = {
        k: 'vo',
        id: li.dataset.id
      };
      RE.panel = null;
      reRenderAll()
    }
  })
}

function reInspCover() {
  var cv = RE.proj.cover;
  return '<h4>Cover</h4><p class="hint">Pick the frame people see on your profile grid, add a title, and download it to upload as the reel’s cover.</p>' + reSl('riCvT', 'Frame', 0, Math.max(.1, reDur()), .05, cv.t, function(v) {
    return reFmt(v, 1)
  }) + '<div class="lbl">Title</div><div class="save"><input id="riCvTi" maxlength="40" value="' + esc(cv.title) + '" placeholder="Optional cover title"></div><div class="row rbtns"><button class="btn pri" id="riCvDl">Download cover</button></div><p class="hint">Instagram crops the grid to 3:4, so keep faces and the title in the middle.</p>'
}

function reWireCover() {
  var cv = RE.proj.cover;
  reWireSl('riCvT', function(v) {
    cv.t = v;
    reSeek(v)
  }, 'Cover frame', function(v) {
    return reFmt(v, 1)
  });
  $('#riCvTi').oninput = function() {
    cv.title = this.value
  };
  $('#riCvTi').onchange = function() {
    reCommitQuiet('Cover title')
  };
  $('#riCvDl').onclick = reCoverPng
}

function reInspTpl() {
  return '<h4>Templates</h4><p class="hint">Fills the template’s cuts, transitions, text and beat with your media bin, the photos from the Reels tab, or your open photo.</p><div class="save"><input id="riTplQ" type="search" placeholder="Search templates"></div><div class="rtpl" id="riTpl"></div>'
}

function reWireTpl() {
  var draw = function() {
    var q = $('#riTplQ').value.trim().toLowerCase();
    $('#riTpl').innerHTML = OUTLINES.map(function(o, i) {
      return (!q || (o[0] + ' ' + o[1]).toLowerCase().indexOf(q) >= 0) ? '<button data-i="' + i + '"><b>' + esc(o[0]) + '</b><span>' + esc(o[1]) + ' · ' + esc(o[2]) + '</span></button>' : ''
    }).join('');
    $$('#riTpl button').forEach(function(b) {
      b.onclick = function() {
        if (RE.proj.clips.length && !confirm('Replace your current reel with this template?')) return;
        reTemplate(+b.dataset.i)
      }
    })
  };
  $('#riTplQ').oninput = draw;
  draw()
}

/* ---------- actions ---------- */
function reAct(a) {
  var P = RE.proj,
    o = reSelObj(),
    k = RE.sel && o ? RE.sel.k : null;
  if (a === 'add') $('#reFile').click();
  else if (a === 'media') $('#reelEd').classList.toggle('binopen');
  else if (a === 'text') {
    var D = reDur(),
      T = reNewText('Your text', Math.min(RE.t, Math.max(0, D - .5)), Math.min(Math.max(D, 3), RE.t + 3));
    P.texts.push(T);
    RE.sel = {
      k: 'text',
      id: T.id
    };
    RE.panel = null;
    reCommit('Add text');
    setTimeout(function() {
      var ta = $('#riTxt');
      if (ta) {
        ta.focus();
        ta.select()
      }
    }, 30)
  } else if (/^(audio|caps|vo|cover|tpl)$/.test(a)) {
    RE.panel = RE.panel === a ? null : a;
    if (a !== 'tpl') RE.sel = null;
    reRenderAll()
  } else if (a === 'beat') reSyncBeat();
  else if (a === 'split') reSplit();
  else if (a === 'dup') {
    if (k === 'clip') {
      var c = JSON.parse(JSON.stringify(o));
      c.id = reId();
      delete c._kb;
      P.clips.splice(P.clips.indexOf(o) + 1, 0, c);
      RE.sel.id = c.id
    } else if (k === 'text') {
      var t2 = JSON.parse(JSON.stringify(o));
      t2.id = reId();
      t2.y = Math.min(.9, t2.y + .06);
      P.texts.push(t2);
      RE.sel.id = t2.id
    } else return toast('Select a clip or text first');
    reCommit('Duplicate')
  } else if (a === 'del') {
    if (k === 'clip') {
      var i = P.clips.indexOf(o);
      P.clips.splice(i, 1);
      if (P.clips[i] && i === 0) P.clips[0].tr = 'none'
    } else if (k === 'text') P.texts.splice(P.texts.indexOf(o), 1);
    else if (k === 'vo') P.vo.splice(P.vo.indexOf(o), 1);
    else return toast('Select something on the timeline first');
    RE.sel = null;
    RE.t = Math.min(RE.t, reDur());
    reCommit('Delete')
  }
}

// Splits the selected text, or the clip under the playhead, at the playhead.
function reSplit() {
  var P = RE.proj,
    o = reSelObj();
  if (RE.sel && RE.sel.k === 'text' && o && RE.t > o.a + .1 && RE.t < o.b - .1) {
    var t2 = JSON.parse(JSON.stringify(o));
    t2.id = reId();
    t2.a = RE.t;
    o.b = RE.t;
    P.texts.push(t2);
    return reCommit('Split text')
  }
  var A = P.clips.length ? reAt(RE.t) : null;
  if (!A || A.l < .1 || A.l > A.c.dur - .1) return toast('Move the playhead inside a clip to split it');
  var c = JSON.parse(JSON.stringify(A.c));
  c.id = reId();
  delete c._kb;
  c.in = A.c.in + A.l * A.c.speed;
  c.dur = A.c.dur - A.l;
  c.tr = 'none';
  A.c.dur = A.l;
  P.clips.splice(A.i + 1, 0, c);
  RE.sel = {
    k: 'clip',
    id: c.id
  };
  reCommit('Split')
}

function reSyncBtns() {
  $('#reUndo').disabled = RE.hix <= 0;
  $('#reRedo').disabled = RE.hix >= RE.hist.length - 1;
  $('#reLen').textContent = reFmt(reDur(), 1);
  $$('#reTools [data-act]').forEach(function(b) {
    b.classList.toggle('on', RE.panel === b.dataset.act)
  })
}

function reGuides() {
  var c = $('#reG'),
    W = c.width = 540,
    H = c.height = 960,
    x = c.getContext('2d'),
    u = W / 100;
  x.clearRect(0, 0, W, H);
  if (!RE.safe) return;
  x.fillStyle = 'rgba(255,40,80,.22)';
  x.fillRect(0, 0, W, H * .14);
  x.fillRect(0, H * .65, W, H * .35);
  x.fillRect(W * .89, H * .14, W * .11, H * .51);
  x.strokeStyle = 'rgba(255,255,255,.7)';
  x.setLineDash([u * 1.5, u * 1.5]);
  x.strokeRect(W * .06, H * .14, W * .83, H * .51);
  x.setLineDash([]);
  x.fillStyle = '#fff';
  x.font = '600 ' + u * 3 + 'px ' + cssv('--sans');
  x.textAlign = 'center';
  x.fillText('Profile & audio', W / 2, H * .07);
  x.fillText('Caption, username & buttons', W / 2, H * .82)
}

function reRenderAll() {
  if (!RE || !RE.open) return;
  reRenderBin();
  reRenderTL();
  reRenderInsp();
  reSyncBtns();
  reGuides();
  $('#reSafe').classList.toggle('on', !!RE.safe);
  $('#reMute').classList.toggle('on', !RE.mute);
  reDraw()
}

/* ---------- wiring ---------- */
$('#reBack').onclick = reClose;
$('#reNew').onclick = reNew;
$('#reUndo').onclick = function() {
  reUndo(-1)
};
$('#reRedo').onclick = function() {
  reUndo(1)
};
$('#rePlay').onclick = function() {
  rePlay(!RE.on)
};
$('#reSafe').onclick = function() {
  RE.safe = !RE.safe;
  reRenderAll()
};
$('#reMute').onclick = function() {
  RE.mute = !RE.mute;
  if (RE.mon) RE.mon.gain.value = RE.mute ? 0 : 1;
  reSyncBtns();
  this.classList.toggle('on', !RE.mute)
};
$$('#reTools [data-act]').forEach(function(b) {
  b.onclick = function() {
    reAct(b.dataset.act)
  }
});
$('#reFile').onchange = function() {
  var fs = Array.prototype.slice.call(this.files);
  this.value = '';
  if (fs.length) reAddFiles(fs)
};
$('#reSong').onchange = function() {
  var f = this.files[0];
  this.value = '';
  if (!f) return;
  reAudioMedia(f, f.name).then(function(M) {
    reSetMusic({
      kind: 'file',
      m: M.id,
      off: 0
    });
    toast('Song added. Pick the part you want, then sync cuts to its beat')
  }, function() {
    toast('Couldn’t read that audio file')
  })
};
$('#reExport').onclick = function() {
  if (!reDur()) return toast('Add some clips first');
  rePlay(false);
  $('#reExpMsg').textContent = 'Records your reel in real time at 30 fps with all its sound. Takes as long as the reel (' + reFmt(reDur()) + ').';
  $('#reShare').hidden = true;
  $('#reExpM').classList.add('on')
};
$$('#reExpM [data-res]').forEach(function(b) {
  b.onclick = function() {
    reExport(+b.dataset.res)
  }
});
$('#reExpClose').onclick = function() {
  if (RE.rec) {
    RE.rec.onstop = null;
    RE.rec.stop();
    RE.rec = null;
    rePlay(false);
    $('#reC').width = RE_W;
    $('#reC').height = RE_H;
    $('#reExpM').classList.remove('busy')
  }
  $('#reExpM').classList.remove('on')
};
$('#reShare').onclick = function() {
  if (RE.lastFile) navigator.share({
    files: [RE.lastFile],
    title: 'My reel'
  }).catch(function() {})
};

// Preview: drag text to move it; tap elsewhere to play or pause.
(function() {
  var c = $('#reC');
  c.addEventListener('pointerdown', function(e) {
    var r = c.getBoundingClientRect(),
      W = c.width,
      H = c.height,
      px = (e.clientX - r.left) / r.width * W,
      py = (e.clientY - r.top) / r.height * H,
      hit = null;
    for (var i = RE.hit.length - 1; i >= 0; i--) {
      var h = RE.hit[i];
      if (px >= h.x && px <= h.x + h.w && py >= h.y && py <= h.y + h.h) {
        hit = h;
        break
      }
    }
    if (!hit) {
      rePlay(!RE.on);
      return
    }
    var T = reFind('text', hit.id),
      x0 = T.x,
      y0 = T.y,
      moved = false;
    RE.sel = {
      k: 'text',
      id: T.id
    };
    RE.panel = null;
    reRenderInsp();
    reRenderTL();
    c.setPointerCapture(e.pointerId);
    c.onpointermove = function(ev) {
      var dx = (ev.clientX - e.clientX) / r.width,
        dy = (ev.clientY - e.clientY) / r.height;
      if (Math.abs(dx) + Math.abs(dy) > .005) moved = true;
      T.x = Math.max(.05, Math.min(.95, x0 + dx));
      T.y = Math.max(.05, Math.min(.95, y0 + dy));
      // Snap to the centre line like Instagram's guides.
      if (Math.abs(T.x - .5) < .02) T.x = .5;
      reDraw()
    };
    c.onpointerup = function() {
      c.onpointermove = c.onpointerup = null;
      if (moved) reCommitQuiet('Move text')
    }
  });
  c.addEventListener('dblclick', function() {
    var ta = $('#riTxt');
    if (ta) ta.focus()
  });
  var ed = $('#reelEd');
  ed.addEventListener('dragover', function(e) {
    if (e.dataTransfer.types.indexOf('Files') >= 0) e.preventDefault()
  });
  ed.addEventListener('drop', function(e) {
    if (!e.dataTransfer.files.length) return;
    e.preventDefault();
    reAddFiles(Array.prototype.slice.call(e.dataTransfer.files))
  })
})();

// Shortcuts while the studio is open; they don't reach the photo editor underneath.
document.addEventListener('keydown', function(e) {
  if (!RE || !RE.open) return;
  e.stopPropagation();
  var tag = document.activeElement.tagName,
    typing = /^(INPUT|TEXTAREA|SELECT)$/.test(tag) && document.activeElement.type !== 'range',
    key = e.key.toLowerCase();
  if ((e.metaKey || e.ctrlKey) && key === 'z' && !typing) {
    e.preventDefault();
    reUndo(e.shiftKey ? 1 : -1);
    return
  }
  if (e.key === 'Escape') {
    if ($('#reExpM').classList.contains('on')) $('#reExpClose').click();
    else if (RE.sel || RE.panel) {
      RE.sel = null;
      RE.panel = null;
      reRenderAll()
    } else reClose();
    return
  }
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === ' ') {
    e.preventDefault();
    rePlay(!RE.on)
  } else if (key === 's') reAct('split');
  else if (key === 'd') reAct('dup');
  else if (key === 't') {
    e.preventDefault();
    reAct('text')
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    reAct('del')
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault();
    reSeek(RE.t + (e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 1 : 1 / 30))
  }
}, true);

// Entry points from the Reels tab and the example player.
$('#reOpenBtn').onclick = function() {
  reOpen()
};
function reUseTemplate(i) {
  reOpen(function() {
    if (RE.proj.clips.length && !confirm('Replace your current reel with this template?')) return;
    reTemplate(i)
  })
}
$('#vidUse').onclick = function() {
  var i = VID ? VID.i : 0;
  closeVid();
  reUseTemplate(i)
};
