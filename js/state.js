/* ============================================================
   STATE + HISTORY
   ============================================================ */
var $ = function(s) {
    return document.querySelector(s)
  },
  $$ = function(s) {
    return Array.prototype.slice.call(document.querySelectorAll(s))
  };

function fresh() {
  return {
    geo: {
      rot: 0,
      fh: false,
      fv: false,
      ang: 0,
      crop: null,
      rect: null
    },
    enh: null,
    layers: [{
      t: 'adj',
      v: {}
    }],
    masks: [],
    fx: {
      ov: [],
      fr: null
    },
    skin: false,
    up: {
      on: false,
      f: 2,
      sharp: 60,
      dn: 35,
      k: LOWMEM ? 'ai-slim' : 'ai-medium'
    }
  }
}

// Current theme colour, e.g. cssv('--ac'), for things drawn on canvases.
function cssv(n) {
  return getComputedStyle(document.documentElement).getPropertyValue(n).trim()
}

function clone(o) {
  return JSON.parse(JSON.stringify(o))
}
var S = fresh(),
  hist = [],
  hix = -1,
  plan = null,
  full = null,
  work = null,
  proxy = null,
  small = null,
  fileName = '';
var tab = 'enhance',
  split = .5,
  showSplit = true,
  loupeOn = true,
  zoom = 'fit',
  pan = {
    x: 0,
    y: 0
  };
var afterC = document.createElement('canvas'),
  beforeC = document.createElement('canvas'),
  afterUp = false,
  beforeKey = '',
  thumbsDirty = true,
  presetDirty = true;

function push(label) {
  hist.length = hix + 1;
  hist.push({
    label: label,
    s: JSON.stringify(S)
  });
  if (hist.length > 100) hist.shift();
  hix = hist.length - 1;
  if (typeof sessionSaveSoon === 'function') sessionSaveSoon();
  if (plan && label.indexOf('AI:') !== 0) {
    plan = null;
    renderPlan()
  }
  syncUI()
}

function goto(i) {
  if (i < 0 || i >= hist.length) return;
  hix = i;
  S = JSON.parse(hist[i].s);
  if (typeof sessionSaveSoon === 'function') sessionSaveSoon();
  plan = null;
  renderPlan();
  thumbsDirty = true;
  presetDirty = true;
  syncUI();
  schedule();
  refreshThumbs()
}

function undo() {
  goto(hix - 1)
}

function redo() {
  goto(hix + 1)
}

function base() {
  return S.layers[0].v
}

function vstate() {
  return plan ? plan.st : S
}

function upView() {
  return tab === 'enhance' && vstate().up.on
}

function hasEdits(st) {
  var f = fresh();
  if (st.masks && st.masks.some(function(m) {
      return !m.off
    })) return true;
  if (st.fx && ((st.fx.ov || []).length || st.fx.fr)) return true;
  return JSON.stringify([st.geo.crop, st.enh, st.layers, st.skin]) !== JSON.stringify([null, null, f.layers, false]) && !(st.layers.length === 1 && !Object.keys(st.layers[0].v).some(function(k) {
    return st.layers[0].v[k]
  }) && !st.enh && !st.skin)
}

/* ============================================================
   IMAGE LOADING + SAMPLE
   ============================================================ */
// Draws the image at most `cap` pixels on its long edge (or `maxPx` in area).
function raster(src, w, h, cap, maxPx) {
  var k = Math.min(1, cap / Math.max(w, h));
  if (maxPx && w * h * k * k > maxPx) k = Math.sqrt(maxPx / (w * h));
  var c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * k));
  c.height = Math.max(1, Math.round(h * k));
  var x = c.getContext('2d');
  x.imageSmoothingQuality = 'high';
  x.drawImage(src, 0, 0, c.width, c.height);
  var id = x.getImageData(0, 0, c.width, c.height);
  return {
    w: c.width,
    h: c.height,
    d: id.data
  }
}

function setImage(src, w, h, name) {
  full = raster(src, w, h, 1e9, P.MAX_PX);
  work = raster(src, w, h, 1280);
  proxy = raster(src, w, h, 640);
  small = raster(src, w, h, 200);
  sendSrc('full', full);
  sendSrc('work', work);
  sendSrc('proxy', proxy);
  fileName = name;
  $('#upload').hidden = true;
  resetSeg();
  if (typeof clearVersions === 'function') clearVersions();
  $('#fname').textContent = name + '  ·  ' + w + '×' + h + (full.w < w ? '  (editing at ' + full.w + '×' + full.h + ')' : '');
  S = fresh();
  hist = [];
  hix = -1;
  plan = null;
  renderPlan();
  push('Opened ' + name);
  zoom = 'fit';
  pan = {
    x: 0,
    y: 0
  };
  beforeKey = '';
  thumbsDirty = true;
  presetDirty = true;
  afterC.width = 0;
  schedule();
  refreshThumbs()
}

// Browsers sometimes report no type (or a generic one) for real photos, e.g.
// files from cloud drives or cameras, so try to decode anything that isn't
// clearly another kind of file.
function loadFile(f) {
  if (!f) return;
  if (f.type && !/^image\//.test(f.type) && f.type !== 'application/octet-stream') {
    toast('That file isn’t an image');
    return
  }
  var url = URL.createObjectURL(f),
    im = new Image();
  im.onload = function() {
    if (typeof sessionSetSource === 'function') sessionSetSource(f);
    setImage(im, im.naturalWidth, im.naturalHeight, f.name);
    URL.revokeObjectURL(url);
    toast('Loaded ' + f.name)
  };
  im.onerror = function() {
    toast(/\.(raw|cr2|cr3|nef|arw|dng|orf|rw2|raf)$/i.test(f.name) ? 'Camera RAW files aren’t supported. Export a JPEG or HEIC first.' : 'Couldn’t read “' + f.name + '” as an image');
    URL.revokeObjectURL(url)
  };
  im.src = url
}
