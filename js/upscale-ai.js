/* ============================================================
   AI UPSCALER (Real-ESRGAN-style models via UpscalerJS + TensorFlow.js)
   ============================================================ */
// Everything downloads from the CDN the first time (TensorFlow.js ~1.4 MB plus a
// 0.9 MB or 2.8 MB model) and then runs on this computer's graphics card.
var AI_LIBS = [
    'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js',
    'https://cdn.jsdelivr.net/npm/upscaler@1.0.0/dist/browser/umd/upscaler.min.js'
  ],
  AI_MODELS = {
    'ai-slim': ['https://cdn.jsdelivr.net/npm/@upscalerjs/esrgan-slim@1.0.0/dist/umd/models/esrgan-slim/src/x', 'ESRGANSlim'],
    'ai-medium': ['https://cdn.jsdelivr.net/npm/@upscalerjs/esrgan-medium@1.0.0/dist/umd/models/esrgan-medium/src/x', 'ESRGANMedium']
  },
  aiLoaded = {},
  aiUpscalers = {},
  aiCache = {
    key: '',
    m: null
  },
  aiCtl = null;

function isAI(k) {
  return /^ai-/.test(k)
}

function loadScript(src) {
  if (!aiLoaded[src]) aiLoaded[src] = new Promise(function(res, rej) {
    var s = document.createElement('script');
    s.src = src;
    s.onload = res;
    s.onerror = function() {
      delete aiLoaded[src];
      rej(new Error('Could not download ' + src.split('/npm/')[1]))
    };
    document.head.appendChild(s)
  });
  return aiLoaded[src]
}

// UpscalerJS pauses for an animation frame between tiles, but browsers stop
// animation frames in background tabs, which would freeze a long export. The
// upscaler captures window.tf when its script loads, so hand it a thin wrapper
// whose nextFrame also resolves on a timer.
function wrapTf() {
  if (window.tf.__lumen) return;
  // UpscalerJS copies tf's own enumerable keys, so copy them rather than inherit.
  var real = window.tf,
    w = {};
  Object.keys(real).forEach(function(k) {
    var d = Object.getOwnPropertyDescriptor(real, k);
    Object.defineProperty(w, k, d.get ? {
      enumerable: true,
      get: function() {
        return real[k]
      }
    } : {
      enumerable: true,
      writable: true,
      value: d.value
    })
  });
  w.__lumen = true;
  w.nextFrame = function() {
    return new Promise(function(res) {
      var done = false,
        go = function() {
          if (!done) {
            done = true;
            res()
          }
        };
      requestAnimationFrame(go);
      setTimeout(go, 60)
    })
  };
  window.tf = w
}

function getUpscaler(kind, f) {
  var id = kind + f;
  if (aiUpscalers[id]) return aiUpscalers[id];
  var M = AI_MODELS[kind];
  aiUpscalers[id] = loadScript(AI_LIBS[0]).then(function() {
    wrapTf();
    return loadScript(AI_LIBS[1])
  }).then(function() {
    return loadScript(M[0] + f + '/index.min.js')
  }).then(function() {
    return new window.Upscaler({
      model: window[M[1] + f + 'x']
    })
  }).catch(function(e) {
    delete aiUpscalers[id];
    throw e
  });
  return aiUpscalers[id]
}

// Upscales an already-edited image. `onProgress(0-1, label)`; rejects with name 'AbortError' if cancelled.
// The photo goes through the model in tiles, and each tile's result is copied
// into the output straight away. Asking the model for the whole photo at once
// holds the full result as 32-bit floats twice over (hundreds of MB for a 16 MP
// export), which is enough to make iPhone Safari reload the page.
var AI_TILE = 256,
  AI_OVERLAP = 12;

function aiUpscale(m, u, onProgress, signal) {
  var input = P.aiPrep(m, u);
  onProgress && onProgress(0, aiLoaded[AI_LIBS[0]] ? 'Starting AI upscale…' : 'Downloading the AI upscaler (first time only)…');
  return getUpscaler(u.k, u.f).then(function(up) {
    var tf = window.tf,
      W = input.w,
      H = input.h,
      f = u.f,
      OW = W * f,
      OH = H * f,
      out = new Uint8ClampedArray(OW * OH * 4),
      tiles = [];
    for (var y = 0; y < H; y += AI_TILE)
      for (var x = 0; x < W; x += AI_TILE) tiles.push([x, y, Math.min(AI_TILE, W - x), Math.min(AI_TILE, H - y)]);
    var n = 0;

    function one(tl) {
      if (signal && signal.aborted) {
        var e = new Error('Upscale cancelled');
        e.name = 'AbortError';
        return Promise.reject(e)
      }
      // Read a little past the tile edges so seams don't show, then keep only the middle.
      var x0 = Math.max(0, tl[0] - AI_OVERLAP),
        y0 = Math.max(0, tl[1] - AI_OVERLAP),
        x1 = Math.min(W, tl[0] + tl[2] + AI_OVERLAP),
        y1 = Math.min(H, tl[1] + tl[3] + AI_OVERLAP),
        tw = x1 - x0,
        th = y1 - y0,
        buf = new Uint8ClampedArray(tw * th * 4);
      for (var r = 0; r < th; r++) buf.set(input.d.subarray(((y0 + r) * W + x0) * 4, ((y0 + r) * W + x1) * 4), r * tw * 4);
      var t = tf.browser.fromPixels(new ImageData(buf, tw, th));
      return up.execute(t, {
        output: 'tensor',
        patchSize: 128,
        padding: 8,
        awaitNextFrame: true,
        signal: signal
      }).then(function(res) {
        t.dispose();
        return res.data().then(function(px) {
          res.dispose();
          var ow = tw * f,
            ox = (tl[0] - x0) * f,
            oy = (tl[1] - y0) * f,
            cw = tl[2] * f,
            ch = tl[3] * f;
          for (var r = 0; r < ch; r++) {
            var si = ((oy + r) * ow + ox) * 3,
              di = ((tl[1] * f + r) * OW + tl[0] * f) * 4;
            for (var c = 0; c < cw; c++, si += 3, di += 4) {
              out[di] = px[si];
              out[di + 1] = px[si + 1];
              out[di + 2] = px[si + 2];
              out[di + 3] = 255
            }
          }
          n++;
          onProgress && onProgress(n / tiles.length, 'AI upscaling ' + Math.round(n / tiles.length * 100) + '%')
        })
      }, function(e) {
        t.dispose();
        throw e
      })
    }
    return tiles.reduce(function(p, tl) {
      return p.then(function() {
        return one(tl)
      })
    }, Promise.resolve()).then(function() {
      return {
        w: OW,
        h: OH,
        d: out
      }
    })
  })
}

// Same as aiUpscale, but reuses the last result when only the detail slider changed.
function aiUpscaleCached(m, st, key, onProgress) {
  var k = key + JSON.stringify([st.geo, st.enh, st.layers, st.masks, st.skin, st.up.f, st.up.k, st.up.dn]);
  var finish = function(o) {
    return P.aiFinish(P.copy(o), st.up)
  };
  if (aiCache.key === k) return Promise.resolve(finish(aiCache.m));
  if (aiCtl) aiCtl.abort();
  var ctl = aiCtl = new AbortController();
  return aiUpscale(m, st.up, onProgress, ctl.signal).then(function(o) {
    if (aiCtl === ctl) aiCtl = null;
    aiCache = {
      key: k,
      m: o
    };
    return finish(o)
  }, function(e) {
    if (aiCtl === ctl) aiCtl = null;
    if (isAbort(e)) throw e;
    // The AI model can't run on some phones and older browsers. Rather than
    // failing, fall back to the classic upscaler so the button still works.
    console.warn('AI upscale failed, using Lanczos', e);
    toast('AI upscale isn’t available here, so the classic upscaler was used', 4500);
    var u = clone(st.up);
    u.k = 'lanczos';
    return P.upscale(m, u)
  })
}

function aiCancel() {
  if (aiCtl) aiCtl.abort()
}

function isAbort(e) {
  return e && (e.name === 'AbortError' || /abort/i.test(e.message || ''))
}
