/* ============================================================
   WORKER
   ============================================================ */
var P = PIPE(),
  W = null,
  jobs = {},
  jobSeq = 0,
  SRC = {};
try {
  var wsrc = 'var P=(' + PIPE.toString() + ')();var S={};onmessage=function(e){var q=e.data;try{if(q.type==="src"){S[q.key]={w:q.w,h:q.h,d:new Uint8ClampedArray(q.buf)};return}var m=P.render(S[q.key],q.st);if(q.up)m=P.upscale(m,q.st.up);postMessage({id:q.id,w:m.w,h:m.h,buf:m.d.buffer},[m.d.buffer])}catch(err){postMessage({id:q.id,err:String(err&&err.stack||err)})}}';
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
  if (W) W.postMessage({
    type: 'src',
    key: key,
    w: m.w,
    h: m.h,
    buf: m.d.slice().buffer
  })
}

function job(q) {
  return new Promise(function(res, rej) {
    if (!W) {
      setTimeout(function() {
        try {
          var m = P.render(SRC[q.key], q.st);
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
