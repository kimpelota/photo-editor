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
function aiUpscale(m, u, onProgress, signal) {
  var input = P.aiPrep(m, u);
  onProgress && onProgress(0, aiLoaded[AI_LIBS[0]] ? 'Starting AI upscale…' : 'Downloading the AI upscaler (first time only)…');
  return getUpscaler(u.k, u.f).then(function(up) {
    var tf = window.tf,
      t = tf.browser.fromPixels(new ImageData(input.d, input.w, input.h));
    return up.execute(t, {
      output: 'tensor',
      patchSize: 128,
      padding: 8,
      awaitNextFrame: true,
      signal: signal,
      progress: function(p) {
        onProgress && onProgress(p, 'AI upscaling ' + Math.round(p * 100) + '%')
      }
    }).then(function(res) {
      t.dispose();
      return res.data().then(function(px) {
        var sh = res.shape,
          h = sh[0],
          w = sh[1],
          d = new Uint8ClampedArray(w * h * 4);
        for (var i = 0, j = 0; i < w * h; i++, j += 3) {
          d[i * 4] = px[j];
          d[i * 4 + 1] = px[j + 1];
          d[i * 4 + 2] = px[j + 2];
          d[i * 4 + 3] = 255
        }
        res.dispose();
        return {
          w: w,
          h: h,
          d: d
        }
      })
    }, function(e) {
      t.dispose();
      throw e
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
    throw e
  })
}

function aiCancel() {
  if (aiCtl) aiCtl.abort()
}

function isAbort(e) {
  return e && (e.name === 'AbortError' || /abort/i.test(e.message || ''))
}
