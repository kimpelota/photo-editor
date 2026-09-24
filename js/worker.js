/* ============================================================
   WORKER
   ============================================================ */
// Runs inside the Web Worker. PIPE is prepended to the worker source, so
// this body can call it. Each source image gets its own render cache.
function WORKER_MAIN() {
  var P = PIPE(),
    S = {},
    C = {},
    AUX = {};
  onmessage = function(e) {
    var q = e.data;
    try {
      if (q.type === 'src') {
        S[q.key] = {
          w: q.w,
          h: q.h,
          d: new Uint8ClampedArray(q.buf)
        };
        C[q.key] = {};
        return
      }
      if (q.type === 'seg') {
        AUX.seg = q.buf ? {
          w: q.w,
          h: q.h,
          d: new Uint8ClampedArray(q.buf)
        } : null;
        return
      }
      var m = P.render(S[q.key], q.st, q.cache === false ? null : C[q.key], AUX);
      if (q.up) m = P.upscale(m, q.st.up);
      postMessage({
        id: q.id,
        w: m.w,
        h: m.h,
        buf: m.d.buffer
      }, [m.d.buffer])
    } catch (err) {
      postMessage({
        id: q.id,
        err: String(err && err.stack || err)
      })
    }
  }
}

var P = PIPE(),
  W = null,
  jobs = {},
  jobSeq = 0,
  SRC = {},
  CACHE = {},
  AUX = {};
try {
  var wsrc = PIPE.toString() + ';(' + WORKER_MAIN.toString() + ')();';
  W = new Worker(URL.createObjectURL(new Blob([wsrc], {
    type: 'text/javascript'
  })));
  W.onmessage = function(e) {
    var q = e.data,
      j = jobs[q.id];
    if (!j) return;
    delete jobs[q.id];
    q.err ? j.rej(new Error(q.err)) : j.res({
      w: q.w,
      h: q.h,
      d: new Uint8ClampedArray(q.buf)
    })
  };
  W.onerror = function(e) {
    console.warn('worker error, falling back', e.message);
    W = null
  };
} catch (e) {
  W = null
}

function sendSrc(key, m) {
  SRC[key] = m;
  CACHE[key] = {};
  if (W) W.postMessage({
    type: 'src',
    key: key,
    w: m.w,
    h: m.h,
    buf: m.d.slice().buffer
  })
}

// AI segmentation grid (RGBA: R = subject, G = face) in source-image space, or null.
function sendSeg(g) {
  AUX.seg = g;
  if (W) W.postMessage(g ? {
    type: 'seg',
    w: g.w,
    h: g.h,
    buf: g.d.slice().buffer
  } : {
    type: 'seg'
  })
}

function job(q) {
  return new Promise(function(res, rej) {
    if (!W) {
      setTimeout(function() {
        try {
          var m = P.render(SRC[q.key], q.st, q.cache === false ? null : CACHE[q.key], AUX);
          if (q.up) m = P.upscale(m, q.st.up);
          res(m)
        } catch (e) {
          rej(e)
        }
      }, 16);
      return
    }
    q.id = ++jobSeq;
    jobs[q.id] = {
      res: res,
      rej: rej
    };
    W.postMessage(q)
  })
}
