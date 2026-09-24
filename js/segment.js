/* ============================================================
   AI SEGMENTATION (subject, background, face) — runs in the browser
   ============================================================ */
// Models load from the CDN the first time an AI mask is used (~9 MB), then
// run on this computer. The result is a grid the size of the preview image in
// source orientation: R = subject, G = face.
var MP_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1',
  MODELS = {
    subject: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/deeplab_v3/float32/1/deeplab_v3.tflite',
    face: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
  },
  mpLib = null,
  segmenter = null,
  faceMarker = null,
  SEG = null, // {w, h, d, subject: bool, faces: n, key}
  segBusy = null;

function loadVision() {
  if (!mpLib) mpLib = import(MP_URL + '/vision_bundle.mjs').then(function(lib) {
    return lib.FilesetResolver.forVisionTasks(MP_URL + '/wasm').then(function(fs) {
      return {
        lib: lib,
        fs: fs
      }
    })
  }).catch(function(e) {
    mpLib = null;
    throw e
  });
  return mpLib
}

function workCanvas() {
  var c = document.createElement('canvas');
  putC(c, work);
  return c
}

// Guided filter: snaps the model's coarse mask edges to real edges in the photo.
function guidedRefine(p, I, w, h, r, eps) {
  function box(a) {
    var t = new Float32Array(a.length),
      o = new Float32Array(a.length),
      k = 1 / (2 * r + 1),
      x, y, s;
    for (y = 0; y < h; y++) {
      s = 0;
      for (x = -r; x <= r; x++) s += a[y * w + Math.min(w - 1, Math.max(0, x))];
      for (x = 0; x < w; x++) {
        t[y * w + x] = s * k;
        s += a[y * w + Math.min(w - 1, x + r + 1)] - a[y * w + Math.max(0, x - r)]
      }
    }
    for (x = 0; x < w; x++) {
      s = 0;
      for (y = -r; y <= r; y++) s += t[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (y = 0; y < h; y++) {
        o[y * w + x] = s * k;
        s += t[Math.min(h - 1, y + r + 1) * w + x] - t[Math.max(0, y - r) * w + x]
      }
    }
    return o
  }
  var n = w * h,
    Ip = new Float32Array(n),
    II = new Float32Array(n);
  for (var i = 0; i < n; i++) {
    Ip[i] = I[i] * p[i];
    II[i] = I[i] * I[i]
  }
  var mI = box(I),
    mp = box(p),
    mIp = box(Ip),
    mII = box(II),
    a = new Float32Array(n),
    b = new Float32Array(n);
  for (i = 0; i < n; i++) {
    var cov = mIp[i] - mI[i] * mp[i],
      vr = mII[i] - mI[i] * mI[i];
    a[i] = cov / (vr + eps);
    b[i] = mp[i] - a[i] * mI[i]
  }
  var ma = box(a),
    mb = box(b),
    q = new Float32Array(n);
  for (i = 0; i < n; i++) q[i] = Math.max(0, Math.min(1, ma[i] * I[i] + mb[i]));
  return q
}

// Walks the face-oval connections into an ordered outline.
function ovalPath(conns) {
  var next = {};
  conns.forEach(function(c) {
    next[c.start] = c.end
  });
  var start = conns[0].start,
    out = [start],
    cur = next[start];
  while (cur != null && cur !== start && out.length < 200) {
    out.push(cur);
    cur = next[cur]
  }
  return out
}

// Makes sure the segmentation grid exists for the current photo. `need` is 'subject' or 'face'.
function ensureSeg(need, onStatus) {
  var key = fileName + ':' + work.w + 'x' + work.h;
  if (SEG && SEG.key === key && SEG.done[need]) return Promise.resolve(SEG);
  if (segBusy) return segBusy.then(function() {
    return ensureSeg(need, onStatus)
  });
  onStatus && onStatus(mpLib ? 'Finding the ' + need + '…' : 'Downloading the AI model (first time only)…');
  segBusy = loadVision().then(function(V) {
    var w = work.w,
      h = work.h,
      cv = workCanvas();
    if (!SEG || SEG.key !== key) SEG = {
      key: key,
      w: w,
      h: h,
      d: new Uint8ClampedArray(w * h * 4),
      done: {},
      faces: 0,
      found: false
    };
    if (need === 'subject') {
      var mk = segmenter ? Promise.resolve(segmenter) : V.lib.ImageSegmenter.createFromOptions(V.fs, {
        baseOptions: {
          modelAssetPath: MODELS.subject,
          delegate: 'CPU'
        },
        runningMode: 'IMAGE',
        outputConfidenceMasks: true,
        outputCategoryMask: false
      });
      return mk.then(function(sgm) {
        segmenter = sgm;
        onStatus && onStatus('Finding the subject…');
        var res = sgm.segment(cv),
          bg = res.confidenceMasks[0],
          mw = bg.width,
          mh = bg.height,
          f = bg.getAsFloat32Array(),
          p = new Float32Array(w * h),
          I = new Float32Array(w * h),
          d = work.d,
          cover = 0;
        // Resample the model's mask to the preview size (it usually matches already).
        for (var y = 0; y < h; y++)
          for (var x = 0; x < w; x++) {
            var mx = Math.min(mw - 1, Math.floor((x + .5) * mw / w)),
              my = Math.min(mh - 1, Math.floor((y + .5) * mh / h)),
              i = y * w + x;
            p[i] = 1 - f[my * mw + mx];
            I[i] = (.2126 * d[i * 4] + .7152 * d[i * 4 + 1] + .0722 * d[i * 4 + 2]) / 255;
            cover += p[i] > .5 ? 1 : 0
          }
        res.close && res.close();
        var q = guidedRefine(p, I, w, h, Math.max(2, Math.round(Math.max(w, h) / 160)), 1e-3);
        for (i = 0; i < w * h; i++) SEG.d[i * 4] = q[i] * 255;
        SEG.found = cover > w * h * .01;
        SEG.done.subject = true
      })
    }
    var mf = faceMarker ? Promise.resolve(faceMarker) : V.lib.FaceLandmarker.createFromOptions(V.fs, {
      baseOptions: {
        modelAssetPath: MODELS.face,
        delegate: 'CPU'
      },
      runningMode: 'IMAGE',
      numFaces: 8
    });
    return mf.then(function(fm) {
      faceMarker = fm;
      onStatus && onStatus('Finding faces…');
      var res = fm.detect(cv),
        oval = ovalPath(V.lib.FaceLandmarker.FACE_LANDMARKS_FACE_OVAL),
        c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      var x = c.getContext('2d');
      x.fillStyle = '#fff';
      res.faceLandmarks.forEach(function(lm) {
        x.beginPath();
        oval.forEach(function(k, j) {
          j ? x.lineTo(lm[k].x * w, lm[k].y * h) : x.moveTo(lm[k].x * w, lm[k].y * h)
        });
        x.closePath();
        x.fill()
      });
      var fd = x.getImageData(0, 0, w, h).data,
        p = new Float32Array(w * h),
        I = new Float32Array(w * h),
        d = work.d;
      for (var i = 0; i < w * h; i++) {
        p[i] = fd[i * 4] / 255;
        I[i] = (.2126 * d[i * 4] + .7152 * d[i * 4 + 1] + .0722 * d[i * 4 + 2]) / 255
      }
      // Soften the outline so the edit fades out at the jaw and hairline.
      var q = guidedRefine(p, I, w, h, Math.max(2, Math.round(Math.max(w, h) / 200)), 4e-3);
      for (i = 0; i < w * h; i++) SEG.d[i * 4 + 1] = q[i] * 255;
      SEG.faces = res.faceLandmarks.length;
      SEG.done.face = true
    })
  }).then(function() {
    segBusy = null;
    sendSeg(SEG);
    return SEG
  }, function(e) {
    segBusy = null;
    throw e
  });
  return segBusy
}

// A new photo invalidates the old grid.
function resetSeg() {
  SEG = null;
  sendSeg(null)
}
