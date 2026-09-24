/* ============================================================
   AI SEGMENTATION (subject, background, face) — runs in the browser
   ============================================================ */
// Models load from the CDN the first time an AI mask is used (~9 MB), then
// run on this computer. The result is a grid the size of the preview image in
// source orientation: R = subject, G = face.
var MP_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1',
  MODELS = {
    subject: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/deeplab_v3/float32/1/deeplab_v3.tflite',
    face: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
    pose: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task'
  },
  mpLib = null,
  segmenter = null,
  faceMarker = null,
  poseMarker = null,
  SEG = null, // {w, h, d, subject: bool, faces: n, key}
  segBusy = null;

function getSegmenter(V) {
  if (segmenter) return Promise.resolve(segmenter);
  return V.lib.ImageSegmenter.createFromOptions(V.fs, {
    baseOptions: {
      modelAssetPath: MODELS.subject,
      delegate: 'CPU'
    },
    runningMode: 'IMAGE',
    outputConfidenceMasks: true,
    outputCategoryMask: false
  }).then(function(sgm) {
    segmenter = sgm;
    return sgm
  })
}

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
      var mk = getSegmenter(V);
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
    onStatus && onStatus(poseMarker ? 'Finding faces…' : 'Downloading the face models (first time only)…');
    return findFaces(V, w, h, onStatus).then(function(F) {
      var c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      var x = c.getContext('2d');
      x.fillStyle = '#fff';
      F.forEach(function(f) {
        x.beginPath();
        if (f.poly) f.poly.forEach(function(p, j) {
          j ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])
        });
        else x.ellipse(f.cx, f.cy, f.rx, f.ry, f.ang, 0, Math.PI * 2);
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
      SEG.faces = F.length;
      SEG.facesEstimated = F.filter(function(f) {
        return !f.poly
      }).length;
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

/* ---------- face finding ---------- */
// Pass 1: the face-landmark model, which traces the face outline. It accepts
// low-confidence matches (helmets, cages and goggles lower its confidence) and
// runs on the whole photo and on zoomed-in sections, so small faces are found.
// Pass 2: the body-pose model on the whole photo, which places the nose, eyes
// and ears from the body; it catches helmeted heads pass 1 missed. Its guesses
// only count when they sit on a person with background above them.
// Returns faces in preview pixels: {poly} outlines or {cx, cy, rx, ry, ang} ellipses.
function findFaces(V, w, h, onStatus) {
  var src = workCanvas(),
    tiles = [
      [0, 0, 1, 1]
    ];
  [2, 3].forEach(function(n) {
    var sz = Math.min(1, 1.5 / n);
    for (var j = 0; j < n; j++)
      for (var i = 0; i < n; i++) tiles.push([i * (1 - sz) / (n - 1), j * (1 - sz) / (n - 1), sz, sz, n])
  });

  // Draws one section of the photo, enlarged, for the models to look at.
  function crop(t) {
    var c = document.createElement('canvas'),
      sw = t[2] * w,
      sh = t[3] * h,
      k = Math.min(3, 768 / Math.max(sw, sh));
    c.width = Math.round(sw * k);
    c.height = Math.round(sh * k);
    var x = c.getContext('2d');
    x.imageSmoothingQuality = 'high';
    x.drawImage(src, t[0] * w, t[1] * h, sw, sh, 0, 0, c.width, c.height);
    return c
  }
  var faces = [];

  // Keeps a face unless it overlaps one already found.
  function keep(f) {
    var dup = faces.some(function(g) {
      return Math.hypot(f.cx - g.cx, f.cy - g.cy) < Math.max(f.rx, g.rx, f.ry, g.ry) * 1.3
    });
    if (!dup && f.rx >= 3) faces.push(f);
    return !dup
  }
  var mkFace = faceMarker ? Promise.resolve(faceMarker) : V.lib.FaceLandmarker.createFromOptions(V.fs, {
      baseOptions: {
        modelAssetPath: MODELS.face,
        delegate: 'CPU'
      },
      runningMode: 'IMAGE',
      numFaces: 12,
      minFaceDetectionConfidence: .3,
      minFacePresenceConfidence: .3
    }),
    mkPose = poseMarker ? Promise.resolve(poseMarker) : V.lib.PoseLandmarker.createFromOptions(V.fs, {
      baseOptions: {
        modelAssetPath: MODELS.pose,
        delegate: 'CPU'
      },
      runningMode: 'IMAGE',
      numPoses: 8,
      minPoseDetectionConfidence: .3,
      minPosePresenceConfidence: .3
    });
  return Promise.all([mkFace, mkPose, getSegmenter(V)]).then(function(ms) {
    faceMarker = ms[0];
    poseMarker = ms[1];
    var pm = personMap(ms[2], src),
      onPerson = function(f) {
        if (!pm) return true;
        var x = Math.min(pm.w - 1, Math.max(0, Math.round(f.cx / w * pm.w))),
          y = Math.min(pm.h - 1, Math.max(0, Math.round(f.cy / h * pm.h)));
        if (pm.f[y * pm.w + x] <= .4) return false;
        // A real head has background (or the photo's top edge) just above it;
        // a misread hand or shirt has more body above it.
        var r = f.ry / h * pm.h;
        for (var yy = Math.round(y - r * 1.2); yy >= y - r * 3; yy--)
          if (yy < 0 || pm.f[yy * pm.w + x] < .4) return true;
        return false
      };
    var oval = ovalPath(V.lib.FaceLandmarker.FACE_LANDMARKS_FACE_OVAL);
    onStatus && onStatus('Finding faces…');
    // The 3×3 sections only run when the whole photo and 2×2 sections found nobody.
    tiles.forEach(function(t) {
      if (t[4] === 3 && faces.length) return;
      var c = crop(t),
        X = function(p) {
          return (t[0] + p.x * t[2]) * w
        },
        Y = function(p) {
          return (t[1] + p.y * t[3]) * h
        };
      faceMarker.detect(c).faceLandmarks.forEach(function(lm) {
        var poly = oval.map(function(k) {
            return [X(lm[k]), Y(lm[k])]
          }),
          xs = poly.map(function(p) {
            return p[0]
          }),
          ys = poly.map(function(p) {
            return p[1]
          }),
          x0 = Math.min.apply(0, xs),
          x1 = Math.max.apply(0, xs),
          y0 = Math.min.apply(0, ys),
          y1 = Math.max.apply(0, ys);
        keep({
          poly: poly,
          cx: (x0 + x1) / 2,
          cy: (y0 + y1) / 2,
          rx: (x1 - x0) / 2,
          ry: (y1 - y0) / 2
        })
      });
      // Pose only on the whole photo: on zoomed sections it sees partial bodies and guesses.
      if (t.length === 4) poseMarker.detect(c).landmarks.forEach(function(lm) {
        var f = headFromPose(lm, X, Y);
        // Pose guesses on partly visible bodies can land on a hand or a shirt;
        // only trust ones that sit on a person.
        if (f && onPerson(f)) keep(f)
      })
    });
    // If nothing is found, the Masks tab hands the user a circle to place instead.
    return faces
  })
}

// DeepLab's "person" probability for every pixel, or null.
function personMap(sgm, cv) {
  var res = sgm.segment(cv),
    person = sgm.getLabels().indexOf('person'),
    cm = res.confidenceMasks && res.confidenceMasks[person],
    out = cm ? {
      w: cm.width,
      h: cm.height,
      f: cm.getAsFloat32Array().slice()
    } : null;
  res.close && res.close();
  return out
}

// A face-shaped ellipse from pose points 0-10 (nose, eyes, ears, mouth corners).
function headFromPose(lm, X, Y) {
  var vis = function(i) {
      return lm[i] && (lm[i].visibility == null || lm[i].visibility > .5)
    },
    P = function(i) {
      return [X(lm[i]), Y(lm[i])]
    },
    dist = function(a, b) {
      return Math.hypot(a[0] - b[0], a[1] - b[1])
    },
    mid = function(a, b) {
      return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
    };
  // Needs the shoulders too: a head floating on its own is usually a misread.
  if (!vis(0) || !vis(11) || !vis(12)) return null;
  var nose = P(0),
    shW = dist(P(11), P(12)),
    shY = Math.min(P(11)[1], P(12)[1]),
    eyes = vis(2) && vis(5) ? [P(2), P(5)] : null,
    ears = vis(7) && vis(8) ? [P(7), P(8)] : null,
    width = Math.max(ears ? dist(ears[0], ears[1]) : 0, eyes ? dist(eyes[0], eyes[1]) * 2.3 : 0);
  // Side-on heads: use the nose-to-ear distance instead.
  if (vis(7)) width = Math.max(width, dist(nose, P(7)) * 1.6);
  if (vis(8)) width = Math.max(width, dist(nose, P(8)) * 1.6);
  if (!width || nose[1] > shY || width < shW * .2 || width > shW * 1.2) return null;
  var eyeMid = eyes ? mid(eyes[0], eyes[1]) : nose,
    mouth = vis(9) && vis(10) ? mid(P(9), P(10)) : [nose[0], nose[1] + width * .3],
    c = [eyeMid[0] + (mouth[0] - eyeMid[0]) * .7, eyeMid[1] + (mouth[1] - eyeMid[1]) * .7],
    ang = eyes ? Math.atan2(eyes[0][1] - eyes[1][1], eyes[0][0] - eyes[1][0]) : 0;
  // Keep the tilt sensible whichever eye the model called left.
  if (ang > Math.PI / 2) ang -= Math.PI;
  if (ang < -Math.PI / 2) ang += Math.PI;
  return {
    cx: c[0],
    cy: c[1],
    rx: width * .52,
    ry: width * .68,
    ang: ang
  }
}

// A new photo invalidates the old grid.
function resetSeg() {
  SEG = null;
  sendSeg(null)
}
