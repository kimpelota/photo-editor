/* ============================================================
   REELS ENGINE: plays any outline as a modern, beat-synced example video
   ============================================================ */
// Builds a mock edit from the user's photos: cuts on the beat of a small
// synthesised soundtrack, trending transitions (zoom punch, whip, glitch,
// speed ramp, flash), word-by-word captions and a hook in the first seconds,
// all kept inside Instagram's safe zone. Long formats are sped up to fit 30s.
var VID = null,
  VID_MAX = 30;

// "0–3s", "0:30–2:00", "30s" → seconds; null if it isn't a time.
function olSecs(t) {
  t = t.trim();
  if (/:/.test(t)) {
    var p = t.split(':');
    return +p[0] * 60 + +p[1]
  }
  return /^[\d.]+$/.test(t) ? +t : null
}

function olBeats(o) {
  var m = /([\d.]+)\s*(s|min)/.exec(o[2]),
    total = m ? +m[1] * (m[2] === 'min' ? 60 : 1) : 30,
    B = o[4].map(function(b) {
      var r = /^([\d:.]+)\s*s?\s*(?:[–-]\s*([\d:.]+)\s*(s|min)?)?\s*s?$/.exec(b[0].trim()),
        mul = r && r[3] === 'min' ? 60 : 1;
      return {
        label: b[0],
        text: b[1],
        a: r ? olSecs(r[1]) * mul : null,
        b: r && r[2] ? olSecs(r[2]) * mul : null
      }
    });
  if (B.some(function(b) {
      return b.a == null
    })) B.forEach(function(b, i) {
    b.a = total * i / B.length;
    b.b = total * (i + 1) / B.length
  });
  B.forEach(function(b, i) {
    // A lone start time ("30s") runs to the next beat, or 3 seconds if it's the last.
    if (b.b == null || b.b <= b.a) b.b = i + 1 < B.length ? B[i + 1].a : b.a + 3;
    if (b.b <= b.a) b.b = b.a + 3
  });
  var end = B[B.length - 1].b,
    k = end > VID_MAX ? VID_MAX / end : 1;
  B.forEach(function(b) {
    b.a *= k;
    b.b *= k
  });
  return {
    beats: B,
    dur: end * k,
    speed: 1 / k
  }
}

function vidRnd(seed) {
  return function() {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647
  }
}


// How each kind of video moves and sounds. Cuts land on the beat grid of the
// soundtrack; `unit` is how many beats a normal clip lasts, `fast` a montage clip.
var REEL_STYLES = {
    hype: {
      bpm: 128,
      unit: 2,
      fast: 1,
      trans: ['punch', 'shake', 'glitch', 'whip', 'punch', 'cut'],
      pulse: .035,
      grain: .05,
      vel: .35
    },
    travel: {
      bpm: 112,
      unit: 2,
      fast: 1,
      trans: ['whip', 'punch', 'swipe', 'zoomblend', 'punch'],
      pulse: .02,
      grain: .04,
      vel: .3
    },
    clean: {
      bpm: 120,
      unit: 2,
      fast: 1,
      trans: ['punch', 'swipe', 'whip', 'cut', 'flash'],
      pulse: .015,
      grain: .03,
      vel: .15
    },
    cinema: {
      bpm: 88,
      unit: 4,
      fast: 2,
      trans: ['zoomblend', 'fade', 'blur', 'zoomblend'],
      pulse: 0,
      grain: .09,
      vel: .1
    },
    talk: {
      bpm: 100,
      unit: 4,
      fast: 2,
      trans: ['cut', 'punch', 'cut', 'swipe'],
      pulse: 0,
      grain: .02,
      vel: 0
    }
  },
  REEL_CAT = {
    'Reels 2026': 'hype',
    Trends: 'hype',
    Fitness: 'hype',
    Sports: 'hype',
    Travel: 'travel',
    Vlog: 'travel',
    Personal: 'travel',
    Food: 'clean',
    Product: 'clean',
    'Fashion & Beauty': 'clean',
    Cinematic: 'cinema',
    Events: 'cinema',
    Business: 'talk',
    Education: 'talk',
    'Podcast & Talk': 'talk',
    YouTube: 'talk'
  };

// Quoted lines become on-screen hook text; the rest of a beat's wording is the caption.
function reelWords(t) {
  var q = /["“]([^"”]+)["”]/.exec(t);
  return {
    hook: q ? q[1] : '',
    cap: t.replace(/["“][^"”]*["”]/g, '').replace(/\s+/g, ' ').replace(/^[\s+:,.–-]+|[\s+:,–-]+$/g, '').trim()
  }
}

// Clips, transitions and sound cues for an outline, snapped to the beat grid.
function vidPlan(i) {
  var o = OUTLINES[i],
    P2 = olBeats(o),
    sk = REEL_CAT[o[1]] || 'clean',
    st = REEL_STYLES[sk],
    spb = 60 / st.bpm,
    rnd = vidRnd(i * 7919 + 13),
    B = P2.beats,
    edge = [0].concat(B.map(function(b) {
      return b.b
    })).map(function(x) {
      return Math.round(x / spb) * spb
    });
  for (var j = 1; j < edge.length; j++) edge[j] = Math.max(edge[j], edge[j - 1] + spb);
  P2.style = st;
  P2.sk = sk;
  P2.spb = spb;
  P2.clips = 0;
  P2.all = [];
  P2.events = [];
  B.forEach(function(b, bi) {
    b.a = edge[bi];
    b.b = edge[bi + 1];
    var t = b.text,
      w = reelWords(t),
      fast = /quick|fast|montage|clips|beat|cut|photos?\b|one per|month by month|room by room|round|exercises|steps|plays|tips?\b|items?|dish|spot|every look|intercut|lesson|details/i.test(t),
      slow = /slow|establish|hold|drone|reveal|silhouette|out-of-focus|talking|to camera/i.test(t) && !fast,
      nb = Math.max(1, Math.round((b.b - b.a) / spb)),
      n = Math.max(1, Math.min(nb, Math.round(nb / (fast ? st.fast : slow ? 8 : st.unit))));
    b.fx = {
      slow: slow,
      split: /split|side by side|\bvs\b|before|wipe|right next|comparison|both/i.test(t),
      flash: /flash|freeze|drop|reveal|hard cut|100%/i.test(t),
      black: /black screen|dark frame/i.test(t),
      fade: /fade to black/i.test(t),
      whip: /whip|transition|switch|jump|swipe/i.test(t),
      mono: /before photo|past|archive|wrong|reality|muted/i.test(t),
      vel: /velocity|speed ramp|ramps|speed-ramp|escalat/i.test(t),
      loading: /loading|percent|%/i.test(t),
      bars: o[3] === '2.39:1' || /letterbox|cinematic/i.test(t)
    };
    b.hook = w.hook;
    b.cap = w.cap;
    b.clips = [];
    for (var c = 0; c < n; c++) {
      var k = P2.clips++,
        tr = k === 0 ? 'none' : c === 0 && b.fx.flash ? 'flash' : c === 0 && b.fx.whip ? 'whip' : slow ? 'zoomblend' : st.trans[Math.floor(rnd() * st.trans.length)],
        cl = {
          k: k,
          a: b.a + spb * Math.round(nb * c / n),
          b: b.a + spb * Math.round(nb * (c + 1) / n),
          tr: tr,
          vel: b.fx.vel || rnd() < st.vel,
          dir: rnd() < .5 ? 1 : -1,
          z0: 1.04 + rnd() * (sk === 'cinema' ? .12 : .3),
          z1: 1.04 + rnd() * (sk === 'cinema' ? .12 : .3),
          x0: .25 + rnd() * .5,
          y0: .25 + rnd() * .5,
          x1: .25 + rnd() * .5,
          y1: .25 + rnd() * .5,
          prev: P2.all[P2.all.length - 1] || null
        };
      b.clips.push(cl);
      P2.all.push(cl);
      if (/whip|swipe|zoomblend|blur/.test(tr)) P2.events.push({
        t: cl.a,
        s: 'whoosh'
      });
      else if (/flash|shake|glitch/.test(tr)) P2.events.push({
        t: cl.a,
        s: 'impact'
      })
    }
  });
  // A hook in the first three seconds, even when the outline doesn't spell one out.
  if (!B.some(function(b) {
      return b.hook && b.a < 3
    })) B[0].hook = o[0];
  P2.dur = edge[edge.length - 1];
  return P2
}

/* ---------- your photos for the examples ---------- */
// One tray shared by every example video. Clips use the photos in order,
// looping if the edit has more clips than photos.
var VPH = [];

// A photo ready for the player: a copy no bigger than 1280px, plus a black-and-white one.
function vphMake(src, w, h, name) {
  var k = Math.min(1, 1280 / Math.max(w, h)),
    c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * k));
  c.height = Math.max(1, Math.round(h * k));
  var x = c.getContext('2d');
  x.imageSmoothingQuality = 'high';
  x.drawImage(src, 0, 0, c.width, c.height);
  var g = document.createElement('canvas');
  g.width = c.width;
  g.height = c.height;
  var gx = g.getContext('2d'),
    id = x.getImageData(0, 0, c.width, c.height),
    d = id.data;
  for (var p = 0; p < d.length; p += 4) d[p] = d[p + 1] = d[p + 2] = .2126 * d[p] + .7152 * d[p + 1] + .0722 * d[p + 2];
  gx.putImageData(id, 0, 0);
  var t = document.createElement('canvas'),
    tk = 160 / Math.max(c.width, c.height);
  t.width = Math.round(c.width * tk);
  t.height = Math.round(c.height * tk);
  t.getContext('2d').drawImage(c, 0, 0, t.width, t.height);
  return {
    c: c,
    g: g,
    url: t.toDataURL('image/jpeg', .8),
    name: name
  }
}

function vidSources() {
  if (VPH.length) return VPH;
  var src = afterC.width ? afterC : makeSample();
  return [vphMake(src, src.width, src.height, 'photo')]
}

function vphAdd(files) {
  files = files.filter(function(f) {
    return !f.type || /^image\//.test(f.type) || f.type === 'application/octet-stream'
  });
  if (!files.length) return toast('Those aren’t photos');
  var bad = 0;
  toast('Adding ' + files.length + ' photo' + (files.length > 1 ? 's' : '') + '…');
  return files.reduce(function(p, f) {
    return p.then(function() {
      return loadImg(f).then(function(im) {
        VPH.push(vphMake(im, im.naturalWidth, im.naturalHeight, f.name))
      }, function() {
        bad++
      })
    })
  }, Promise.resolve()).then(function() {
    vphChanged();
    toast(VPH.length + ' photo' + (VPH.length > 1 ? 's' : '') + ' in your examples' + (bad ? ' · ' + bad + ' couldn’t be read' : ''))
  })
}

function vphChanged() {
  renderVph();
  if (VID) {
    VID.srcs = vidSources();
    vidInfo()
  }
}

function vphThumbs() {
  return VPH.map(function(p, i) {
    return '<div class="vth" draggable="true" data-i="' + i + '" title="' + esc(p.name) + ' · drag to reorder"><img src="' + p.url + '" alt=""><i>' + (i + 1) + '</i><button data-x="' + i + '" aria-label="Remove photo">&times;</button></div>'
  }).join('') + '<button class="vth add" data-add="1"><b>+</b>Add photos</button>'
}

function renderVph() {
  ['#vphStrip', '#vidStrip'].forEach(function(sel) {
    var el = $(sel);
    el.innerHTML = vphThumbs();
    el.querySelector('[data-add]').onclick = function() {
      $('#vphFile').click()
    };
    $$(sel + ' [data-x]').forEach(function(b) {
      b.onclick = function(e) {
        e.stopPropagation();
        VPH.splice(+b.dataset.x, 1);
        vphChanged()
      }
    });
    // Drag a thumbnail onto another to reorder.
    $$(sel + ' .vth[data-i]').forEach(function(t) {
      t.ondragstart = function(e) {
        e.dataTransfer.setData('text/vph', t.dataset.i);
        e.dataTransfer.effectAllowed = 'move'
      };
      t.ondragover = function(e) {
        if (e.dataTransfer.types.indexOf('text/vph') >= 0) e.preventDefault()
      };
      t.ondrop = function(e) {
        var from = e.dataTransfer.getData('text/vph');
        if (from === '') return;
        e.preventDefault();
        e.stopPropagation();
        var it = VPH.splice(+from, 1)[0];
        VPH.splice(+t.dataset.i, 0, it);
        vphChanged()
      }
    })
  });
  $('#vphN').textContent = VPH.length ? VPH.length + ' photo' + (VPH.length > 1 ? 's' : '') : 'none yet';
  $('#vphClear').hidden = !VPH.length
}

$('#vphAdd').onclick = function() {
  $('#vphFile').click()
};
$('#vphFile').onchange = function() {
  var fs = Array.prototype.slice.call(this.files);
  this.value = '';
  if (fs.length) vphAdd(fs)
};
$('#vphCur').onclick = function() {
  if (!afterC.width) return toast('Open a photo first');
  var c = typeof withTexts === 'function' ? withTexts(afterC) : afterC;
  VPH.push(vphMake(c, c.width, c.height, fileName || 'Current photo'));
  vphChanged();
  toast('Added your current edit')
};
$('#vphClear').onclick = function() {
  VPH = [];
  vphChanged()
};

// Drop photos on the Video Ideas tab or on the player.
['[data-p="outlines"]', '#vidM'].forEach(function(sel) {
  var el = $(sel);
  el.addEventListener('dragover', function(e) {
    if (e.dataTransfer.types.indexOf('Files') < 0) return;
    e.preventDefault();
    el.classList.add('vdrop')
  });
  el.addEventListener('dragleave', function(e) {
    if (!el.contains(e.relatedTarget)) el.classList.remove('vdrop')
  });
  el.addEventListener('drop', function(e) {
    el.classList.remove('vdrop');
    if (!e.dataTransfer.files.length) return;
    e.preventDefault();
    vphAdd(Array.prototype.slice.call(e.dataTransfer.files))
  })
});
renderVph();


/* ---------- drawing ---------- */
var REEL_CAPS = {
    pop: 'Bold pop',
    box: 'Highlight',
    clean: 'Clean',
    off: 'No captions'
  },
  REEL_HI = '#ffe14d',
  REEL_BOX = '#ff3b5c',
  reelGrainC = null;

function reelPref(k, def) {
  try {
    var v = localStorage.getItem('nuance.reel.' + k);
    return v == null ? def : v
  } catch (e) {
    return def
  }
}

function reelSetPref(k, v) {
  try {
    localStorage.setItem('nuance.reel.' + k, v)
  } catch (e) {}
}

var reelCap = REEL_CAPS[reelPref('cap', 'pop')] ? reelPref('cap', 'pop') : 'pop',
  reelSnd = reelPref('snd', '1') === '1',
  reelSafe = reelPref('safe', '0') === '1';

function ease(p) {
  return p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2
}

function easeOut(p) {
  return 1 - Math.pow(1 - p, 3)
}

// Speed ramp: fast in, slow through the middle, fast out.
function velocity(p) {
  return p < .5 ? .5 * Math.pow(2 * p, .45) : 1 - .5 * Math.pow(2 - 2 * p, .45)
}

// Red, green and blue on their own, for the RGB-split glitch. Made once per photo.
function reelChannels(ph) {
  if (ph.ch) return ph.ch;
  var x0 = ph.c.getContext('2d'),
    src = x0.getImageData(0, 0, ph.c.width, ph.c.height).data;
  ph.ch = [0, 1, 2].map(function(k) {
    var c = document.createElement('canvas');
    c.width = ph.c.width;
    c.height = ph.c.height;
    var x = c.getContext('2d'),
      id = x.createImageData(c.width, c.height),
      d = id.data;
    for (var p = 0; p < d.length; p += 4) {
      d[p + k] = src[p + k];
      d[p + 3] = 255
    }
    x.putImageData(id, 0, 0);
    return c
  });
  return ph.ch
}

function reelGrain() {
  if (reelGrainC) return reelGrainC;
  var c = document.createElement('canvas');
  c.width = c.height = 256;
  var x = c.getContext('2d'),
    id = x.createImageData(256, 256),
    d = id.data;
  for (var p = 0; p < d.length; p += 4) {
    var v = Math.random() * 255;
    d[p] = d[p + 1] = d[p + 2] = v;
    d[p + 3] = 255
  }
  x.putImageData(id, 0, 0);
  return reelGrainC = c
}

// One photo filling the frame, with its slow push/pan. o: {dx, dy, s} extra move.
function vidShot(x, img, W, H, cl, p, o) {
  o = o || {};
  var z = cl.z0 + (cl.z1 - cl.z0) * p,
    cx = cl.x0 + (cl.x1 - cl.x0) * p,
    cy = cl.y0 + (cl.y1 - cl.y0) * p,
    k = Math.max(W / img.width, H / img.height) * z,
    sw = Math.min(img.width, W / k),
    sh = Math.min(img.height, H / k),
    s = o.s || 1;
  x.save();
  x.translate(W / 2 + (o.dx || 0), H / 2 + (o.dy || 0));
  x.scale(s, s);
  x.drawImage(img, (img.width - sw) * cx, (img.height - sh) * cy, sw, sh, -W / 2, -H / 2, W, H);
  x.restore()
}

// A moving shot drawn several times along its path, like motion blur.
function vidSmear(x, img, W, H, cl, p, dx, dy, n) {
  for (var i = 0; i < n; i++) {
    x.globalAlpha = i ? .3 : 1;
    vidShot(x, img, W, H, cl, p, {
      dx: dx * (1 + i * .12),
      dy: dy * (1 + i * .12)
    })
  }
  x.globalAlpha = 1
}

function clipProg(cl, t) {
  var p = Math.max(0, Math.min(1, (t - cl.a) / (cl.b - cl.a)));
  return cl.vel ? velocity(p) : p
}

// Lays words out in centred lines; returns [{w, x, y, wd}] around (cx, cy).
function reelLayout(x, words, cx, cy, maxW, lh) {
  var lines = [[]],
    lw = [0],
    sp = x.measureText(' ').width;
  words.forEach(function(w) {
    var wd = x.measureText(w).width,
      L = lines.length - 1;
    if (lines[L].length && lw[L] + sp + wd > maxW) {
      lines.push([]);
      lw.push(0);
      L++
    }
    lw[L] += (lines[L].length ? sp : 0) + wd;
    lines[L].push({
      w: w,
      wd: wd
    })
  });
  var out = [],
    y0 = cy - (lines.length - 1) * lh / 2;
  lines.forEach(function(ln, li) {
    var xx = cx - lw[li] / 2;
    ln.forEach(function(it) {
      out.push({
        w: it.w,
        wd: it.wd,
        x: xx,
        y: y0 + li * lh
      });
      xx += it.wd + sp
    })
  });
  return out
}

function reelWord(x, it, fs, style, active, shown) {
  if (style === 'box' && active) {
    x.fillStyle = REEL_BOX;
    rr(x, it.x - fs * .14, it.y - fs * .62, it.wd + fs * .28, fs * 1.18, fs * .18);
    x.fill()
  }
  if (style === 'boxhook') {
    x.globalAlpha = shown;
    x.fillStyle = '#fff';
    rr(x, it.x - fs * .12, it.y - fs * .58, it.wd + fs * .24, fs * 1.1, fs * .12);
    x.fill();
    x.fillStyle = '#000';
    x.fillText(it.w, it.x, it.y + fs * .04);
    x.globalAlpha = 1;
    return
  }
  if (style === 'clean') {
    x.globalAlpha = shown * (active ? 1 : .62);
    x.shadowColor = 'rgba(0,0,0,.55)';
    x.shadowBlur = fs * .25;
    x.fillStyle = '#fff';
    x.fillText(it.w, it.x, it.y);
    x.shadowBlur = 0;
    x.globalAlpha = 1;
    return
  }
  x.globalAlpha = shown;
  x.lineWidth = fs * .16;
  x.lineJoin = 'round';
  x.strokeStyle = '#000';
  x.strokeText(it.w, it.x, it.y);
  x.fillStyle = style === 'pop' && active ? REEL_HI : '#fff';
  x.fillText(it.w, it.x, it.y);
  x.globalAlpha = 1
}

// Where text can go without Instagram's buttons and caption covering it.
function reelZone(V) {
  var W = V.c.width,
    H = V.c.height;
  return V.o[3] === '9:16' ? {
    cx: W * .47,
    w: W * .8,
    hook: H * .3,
    cap: H * .6
  } : {
    cx: W / 2,
    w: W * .78,
    hook: H * .26,
    cap: H * .8
  }
}

function vidFrame(t) {
  var V = VID,
    x = V.x,
    W = V.c.width,
    H = V.c.height,
    P2 = V.plan,
    st = P2.style,
    B = P2.beats,
    b = B.filter(function(q) {
      return t >= q.a && t < q.b
    })[0] || B[B.length - 1],
    cl = b.clips.filter(function(q) {
      return t >= q.a && t < q.b
    })[0] || b.clips[b.clips.length - 1],
    fx = b.fx,
    ph = V.srcs[cl.k % V.srcs.length],
    img = fx.mono && !fx.split ? ph.g : ph.c,
    p = clipProg(cl, t),
    dt = t - cl.a,
    pv = cl.prev,
    pph = pv ? V.srcs[pv.k % V.srcs.length] : null,
    // Every beat gives the frame a small kick in time with the music.
    phase = (t % P2.spb) / P2.spb,
    pulse = 1 + st.pulse * Math.exp(-phase * 7);
  x.globalCompositeOperation = 'source-over';
  x.fillStyle = '#000';
  x.fillRect(0, 0, W, H);
  if (fx.split) {
    // Before in black and white on the left, after on the right, with a moving wipe.
    var bt = (t - b.a) / (b.b - b.a),
      sx = W * (.2 + .6 * (.5 - .5 * Math.cos(bt * Math.PI * 2)));
    vidShot(x, ph.c, W, H, cl, p, {
      s: pulse
    });
    x.save();
    x.beginPath();
    x.rect(0, 0, sx, H);
    x.clip();
    vidShot(x, ph.g, W, H, cl, p, {
      s: pulse
    });
    x.restore();
    x.fillStyle = '#fff';
    x.fillRect(sx - W * .004, 0, W * .008, H)
  } else if ((cl.tr === 'whip' || cl.tr === 'swipe') && dt < .26 && pv) {
    // The old shot flies out as the new one flies in, both smeared.
    var e = ease(dt / .26),
      hz = cl.tr === 'whip',
      ox = hz ? W * cl.dir : 0,
      oy = hz ? 0 : H * cl.dir;
    vidSmear(x, pph.c, W, H, pv, 1, -ox * e, -oy * e, 4);
    vidSmear(x, img, W, H, cl, p, ox * (1 - e), oy * (1 - e), 4)
  } else if (cl.tr === 'zoomblend' && dt < .45 && pv) {
    var e2 = ease(dt / .45);
    vidShot(x, img, W, H, cl, p, {
      s: pulse
    });
    x.globalAlpha = 1 - e2;
    vidShot(x, pph.c, W, H, pv, 1, {
      s: 1 + e2 * .35
    });
    x.globalAlpha = 1
  } else if (cl.tr === 'glitch' && dt < .22) {
    var d = W * .035 * (1 - dt / .22),
      ch = reelChannels(ph);
    x.globalCompositeOperation = 'lighter';
    vidShot(x, ch[0], W, H, cl, p, {
      dx: -d,
      s: 1.06
    });
    vidShot(x, ch[1], W, H, cl, p, {
      s: 1.06
    });
    vidShot(x, ch[2], W, H, cl, p, {
      dx: d,
      s: 1.06
    });
    x.globalCompositeOperation = 'source-over';
    // Torn strips.
    for (var s = 0; s < 5; s++) {
      var y = Math.random() * H,
        hh = H * (.02 + Math.random() * .06);
      x.drawImage(V.c, 0, y, W, hh, (Math.random() - .5) * W * .08, y, W, hh)
    }
  } else if (cl.tr === 'blur' && dt < .35) {
    var bl = 1 - dt / .35;
    for (var q = 0; q < 5; q++) {
      x.globalAlpha = q ? .25 * bl : 1;
      vidShot(x, img, W, H, cl, p, {
        dx: (q - 2) * W * .012 * bl,
        dy: (q % 2 - .5) * H * .008 * bl
      })
    }
    x.globalAlpha = 1
  } else {
    var o = {
      s: pulse
    };
    if (cl.tr === 'punch' && dt < .22) o.s *= 1 + .24 * (1 - easeOut(dt / .22));
    if (cl.tr === 'shake' && dt < .35) {
      var a = (1 - dt / .35) * W * .03;
      o.dx = (Math.random() - .5) * a * 2;
      o.dy = (Math.random() - .5) * a * 2;
      o.s *= 1.08
    }
    vidShot(x, img, W, H, cl, p, o)
  }
  if (fx.black) {
    x.fillStyle = 'rgba(0,0,0,' + (.92 - (t - b.a) / (b.b - b.a) * .6) + ')';
    x.fillRect(0, 0, W, H)
  }
  if (fx.fade) {
    x.fillStyle = 'rgba(0,0,0,' + Math.min(1, (t - b.a) / (b.b - b.a) * 1.2) + ')';
    x.fillRect(0, 0, W, H)
  }
  if (cl.tr === 'flash' && dt < .25) {
    x.fillStyle = 'rgba(255,255,255,' + (1 - dt / .25) + ')';
    x.fillRect(0, 0, W, H)
  }
  if (cl.tr === 'fade' && dt < .3) {
    x.fillStyle = 'rgba(0,0,0,' + (1 - dt / .3) + ')';
    x.fillRect(0, 0, W, H)
  }
  // Finish: soft vignette and film grain.
  var vg = x.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.hypot(W, H) * .6);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,' + (P2.sk === 'cinema' ? .45 : .25) + ')');
  x.fillStyle = vg;
  x.fillRect(0, 0, W, H);
  if (st.grain) {
    x.save();
    x.globalAlpha = st.grain;
    x.globalCompositeOperation = 'overlay';
    x.translate(-Math.random() * 256, -Math.random() * 256);
    x.fillStyle = x.createPattern(reelGrain(), 'repeat');
    x.fillRect(0, 0, W + 256, H + 256);
    x.restore()
  }
  if (fx.bars && V.o[3] !== '2.39:1') {
    var bh = (H - W / 2.39) / 2;
    if (bh > 0) {
      x.fillStyle = '#000';
      x.fillRect(0, 0, W, bh);
      x.fillRect(0, H - bh, W, bh)
    }
  }
  var Z = reelZone(V),
    u = Math.min(W, H) / 100;
  x.textAlign = 'left';
  x.textBaseline = 'middle';
  // "Loading 0% → 100%" bar for the GRWM-loading trend.
  if (fx.loading) {
    var pc = Math.min(100, Math.round(t / P2.dur * 100)),
      lw = Z.w * .7,
      lx = Z.cx - lw / 2,
      ly = H * .18;
    x.font = '700 ' + u * 4 + 'px Montserrat, ' + cssv('--sans');
    x.textAlign = 'center';
    x.lineWidth = u * .6;
    x.strokeStyle = '#000';
    x.strokeText('loading… ' + pc + '%', Z.cx, ly - u * 4);
    x.fillStyle = '#fff';
    x.fillText('loading… ' + pc + '%', Z.cx, ly - u * 4);
    x.fillStyle = 'rgba(0,0,0,.45)';
    rr(x, lx, ly, lw, u * 2.4, u * 1.2);
    x.fill();
    x.fillStyle = '#fff';
    rr(x, lx, ly, Math.max(u * 2.4, lw * pc / 100), u * 2.4, u * 1.2);
    x.fill();
    x.textAlign = 'left'
  }
  if (reelCap === 'off') return;
  // Hook: words land one after another at the start of the beat.
  if (b.hook) {
    var hs = u * (V.o[3] === '9:16' ? 9 : 7.5),
      ht = reelCap === 'clean' ? b.hook : b.hook.toUpperCase();
    x.font = (reelCap === 'clean' ? '700 ' + hs * .8 + 'px Montserrat, ' : hs + 'px Anton, Impact, ') + cssv('--sans');
    var hw = ht.split(' '),
      items = reelLayout(x, hw, Z.cx, Z.hook, Z.w, hs * 1.08),
      ft = t - b.a;
    items.forEach(function(it, wi) {
      var at = ft - wi * .08;
      if (at <= 0) return;
      var pop = Math.min(1, at / .14),
        sc = 1 + .25 * (1 - easeOut(pop));
      x.save();
      x.translate(it.x + it.wd / 2, it.y);
      x.scale(sc, sc);
      reelWord(x, {
        w: it.w,
        wd: it.wd,
        x: -it.wd / 2,
        y: 0
      }, hs, reelCap === 'box' ? 'boxhook' : reelCap, false, pop);
      x.restore()
    })
  }
  // Captions: a few words at a time, the spoken word highlighted.
  if (b.cap) {
    var cs = u * (V.o[3] === '9:16' ? 5.6 : 4.4),
      ws = b.cap.split(' '),
      groups = [],
      g = [];
    ws.forEach(function(w) {
      g.push(w);
      if (g.length >= 3 || g.join(' ').length > 16 || /[,:;.]$/.test(w)) {
        groups.push(g);
        g = []
      }
    });
    if (g.length) groups.push(g);
    var start = b.a + (b.hook ? Math.min(.6, (b.b - b.a) * .25) : .05),
      span = Math.max(.3, b.b - .08 - start),
      per = span / ws.length;
    if (t >= start) {
      var wi2 = Math.min(ws.length - 1, Math.floor((t - start) / per)),
        gi = 0,
        cnt = 0;
      while (gi < groups.length - 1 && cnt + groups[gi].length <= wi2) cnt += groups[gi++].length;
      var gw = groups[gi].map(function(w) {
          return reelCap === 'clean' ? w : w.toUpperCase()
        }),
        gt = t - (start + cnt * per),
        pop2 = Math.min(1, gt / .1),
        sc2 = .85 + .15 * easeOut(pop2);
      x.font = '700 ' + cs + 'px Montserrat, ' + cssv('--sans');
      var its = reelLayout(x, gw, 0, 0, Z.w / sc2, cs * 1.25);
      x.save();
      x.translate(Z.cx, Z.cap);
      x.scale(sc2, sc2);
      its.forEach(function(it, k) {
        reelWord(x, it, cs, reelCap, cnt + k === wi2, 1)
      });
      x.restore()
    }
  }
}

// Instagram's buttons, caption and header, shaded on a separate layer so they never get recorded.
function vidGuides() {
  var V = VID,
    c = $('#vidG');
  c.width = V.c.width;
  c.height = V.c.height;
  var x = c.getContext('2d'),
    W = c.width,
    H = c.height,
    u = Math.min(W, H) / 100;
  x.clearRect(0, 0, W, H);
  if (!reelSafe || V.o[3] !== '9:16') return;
  x.fillStyle = 'rgba(255,40,80,.22)';
  x.fillRect(0, 0, W, H * .14);
  x.fillRect(0, H * .65, W, H * .35);
  x.fillRect(W * .89, H * .14, W * .11, H * .51);
  x.strokeStyle = 'rgba(255,255,255,.7)';
  x.setLineDash([u * 1.5, u * 1.5]);
  x.lineWidth = u * .3;
  x.strokeRect(W * .06, H * .14, W * .83, H * .51);
  x.setLineDash([]);
  x.fillStyle = '#fff';
  x.font = '600 ' + u * 3 + 'px ' + cssv('--sans');
  x.textAlign = 'center';
  x.fillText('Profile & audio', W / 2, H * .07);
  x.fillText('Caption, username & buttons', W / 2, H * .82);
  x.save();
  x.translate(W * .945, H * .4);
  x.rotate(-Math.PI / 2);
  x.fillText('Like · comment · share', 0, 0);
  x.restore()
}

/* ---------- soundtrack ---------- */
// A small synthesised beat for each style, so cuts land on something you can hear
// and downloads come with audio. Sounds are scheduled a moment ahead of the picture.
var RA = null,
  REEL_ROOTS = [110, 87.31, 130.81, 98];

function reelAudio() {
  if (RA) return RA;
  var AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  var ac = new AC(),
    m = ac.createGain(),
    nb = ac.createBuffer(1, ac.sampleRate, ac.sampleRate),
    nd = nb.getChannelData(0);
  for (var i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  m.gain.value = .55;
  m.connect(ac.destination);
  RA = {
    ac: ac,
    m: m,
    noise: nb,
    dest: ac.createMediaStreamDestination ? ac.createMediaStreamDestination() : null
  };
  if (RA.dest) m.connect(RA.dest);
  return RA
}

function sEnv(g, when, v, len) {
  g.gain.setValueAtTime(v, when);
  g.gain.exponentialRampToValueAtTime(.0008, when + len)
}

function sOsc(out, type, f0, f1, when, v, len) {
  var ac = RA.ac,
    o = ac.createOscillator(),
    g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, when);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, when + Math.min(len, .15));
  sEnv(g, when, v, len);
  o.connect(g).connect(out);
  o.start(when);
  o.stop(when + len + .05)
}

function sNoise(out, ftype, freq, when, v, len, f1) {
  var ac = RA.ac,
    s = ac.createBufferSource(),
    f = ac.createBiquadFilter(),
    g = ac.createGain();
  s.buffer = RA.noise;
  f.type = ftype;
  f.frequency.setValueAtTime(freq, when);
  if (f1) f.frequency.exponentialRampToValueAtTime(f1, when + len);
  sEnv(g, when, v, len);
  s.connect(f).connect(g).connect(out);
  s.start(when, Math.random() * .5);
  s.stop(when + len + .05)
}

function reelBeat(V, n, when) {
  var out = V.sg,
    sk = V.plan.sk,
    bar = Math.floor(n / 4),
    pos = n % 4,
    root = REEL_ROOTS[bar % 4],
    spb = V.plan.spb,
    lvl = sk === 'talk' ? .5 : 1;
  if (sk === 'cinema') {
    if (pos === 0) {
      sOsc(out, 'sine', 120, 40, when, .7, .5);
      [1, 1.5, 2.4].forEach(function(m) {
        sOsc(out, 'sawtooth', root * m, root * m, when, .035, spb * 3.8)
      })
    }
    if (pos === 2) sNoise(out, 'lowpass', 900, when, .05, .4);
    return
  }
  if (sk === 'hype' || pos % 2 === 0) sOsc(out, 'sine', 150, 42, when, .9 * lvl, .32);
  if (pos % 2 === 1) {
    sNoise(out, 'highpass', 1600, when, .32 * lvl, .16);
    sOsc(out, 'triangle', 200, 160, when, .12 * lvl, .08)
  }
  sNoise(out, 'highpass', 8000, when + spb / 2, .1 * lvl, .05);
  if (sk === 'hype') sNoise(out, 'highpass', 9000, when + spb / 4 * 3, .05, .03);
  sOsc(out, sk === 'hype' ? 'sawtooth' : 'triangle', root / 2, root / 2, when, .14 * lvl, spb * .85)
}

function reelFx(V, ev, when) {
  if (ev.s === 'whoosh') sNoise(V.sg, 'bandpass', 300, Math.max(RA.ac.currentTime, when - .3), .35, .32, 3500);
  else {
    sOsc(V.sg, 'sine', 90, 30, when, 1, .6);
    sNoise(V.sg, 'lowpass', 2500, when, .3, .45)
  }
}

// Starts or stops the sound in step with the picture.
function reelSound(on) {
  var V = VID;
  if (!V) return;
  if (V.sg) {
    V.sg.disconnect();
    V.sg = null
  }
  if (!on || !reelSnd || !reelAudio()) return;
  if (RA.ac.state === 'suspended') RA.ac.resume();
  V.sg = RA.ac.createGain();
  V.sg.connect(RA.m);
  V.nb = Math.ceil((V.t - 1e-6) / V.plan.spb);
  V.ne = 0;
  while (V.ne < V.plan.events.length && V.plan.events[V.ne].t < V.t) V.ne++
}

function reelSchedule() {
  var V = VID;
  if (!V.sg) return;
  var now = RA.ac.currentTime,
    hz = V.t + .25,
    spb = V.plan.spb;
  while (V.nb * spb < hz && V.nb * spb < V.plan.dur - .01) {
    reelBeat(V, V.nb, now + Math.max(0, V.nb * spb - V.t));
    V.nb++
  }
  var E = V.plan.events;
  while (V.ne < E.length && E[V.ne].t < hz) {
    reelFx(V, E[V.ne], now + Math.max(0, E[V.ne].t - V.t));
    V.ne++
  }
}

/* ---------- player ---------- */
function vidSync() {
  var V = VID,
    f = V.t / V.plan.dur;
  $('#vidPlay').innerHTML = V.on ? '&#10074;&#10074;' : '&#9654;';
  $('#vidSeek').value = Math.round(f * 1000);
  $('#vidSeek').style.setProperty('--a', '0%');
  $('#vidSeek').style.setProperty('--b', f * 100 + '%');
  var shown = V.t * V.plan.speed,
    fmt = function(s) {
      s = Math.round(s);
      return Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2)
    };
  $('#vidTime').textContent = fmt(shown) + ' / ' + fmt(V.plan.dur * V.plan.speed);
  $$('#vidBeats li').forEach(function(li, j) {
    var b = V.plan.beats[j];
    li.classList.toggle('on', V.t >= b.a && V.t < b.b || j === V.plan.beats.length - 1 && V.t >= b.b)
  })
}

function vidPlaying(on) {
  var V = VID;
  if (on && V.t >= V.plan.dur - .02) V.t = 0;
  V.on = on;
  V.last = 0;
  reelSound(on)
}

function vidTick(now) {
  var V = VID;
  if (!V) return;
  if (V.on) {
    V.t += Math.min(.1, (now - (V.last || now)) / 1000);
    if (V.t >= V.plan.dur) {
      V.t = V.plan.dur - .001;
      if (V.rec) V.rec.stop();
      vidPlaying(false)
    } else reelSchedule()
  }
  V.last = now;
  vidFrame(V.t);
  vidSync();
  V.raf = requestAnimationFrame(vidTick)
}

function openVid(i) {
  var o = OUTLINES[i],
    c = $('#vidC'),
    ar = o[3] === '9:16' ? 9 / 16 : o[3] === '2.39:1' ? 2.39 : 16 / 9;
  c.width = ar < 1 ? 1080 : 1280;
  c.height = Math.round(c.width / ar);
  $('#vidFrame').style.aspectRatio = c.width + ' / ' + c.height;
  $('#vidFrame').classList.toggle('tall', ar < 1);
  if (VID) closeVid(true);
  VID = {
    i: i,
    o: o,
    c: c,
    x: c.getContext('2d'),
    plan: vidPlan(i),
    srcs: vidSources(),
    t: 0,
    on: false,
    last: 0
  };
  $('#vidT').textContent = o[0];
  vidInfo();
  vidGuides();
  $('#vidBeats').innerHTML = o[4].map(function(b) {
    return '<li><em>' + esc(b[0]) + '</em>' + esc(b[1]) + '</li>'
  }).join('');
  $('#vidYT').href = olSearch(o, 'yt');
  $('#vidTT').href = olSearch(o, 'tt');
  $('#vidDl').disabled = !vidRecType();
  $('#vidDl').textContent = 'Download video';
  syncReelCtl();
  $('#vidM').classList.add('on');
  // Safari only lets sound start from the click itself, so unlock it now.
  if (reelSnd && reelAudio() && RA.ac.state === 'suspended') RA.ac.resume();
  // Captions use the app's Anton and Montserrat; wait briefly for them so the first frames match.
  var ready = document.fonts && document.fonts.load ? Promise.all(['64px Anton', '700 64px Montserrat'].map(function(f) {
    return document.fonts.load(f)
  })) : Promise.resolve();
  Promise.race([ready, new Promise(function(r) {
    setTimeout(r, 600)
  })]).then(function() {
    if (VID && VID.i === i && !VID.raf) {
      vidPlaying(true);
      VID.raf = requestAnimationFrame(vidTick)
    }
  })
}

function vidInfo() {
  var V = VID,
    o = V.o,
    n = V.plan.clips;
  $('#vidSub').textContent = o[1] + ' · ' + o[2] + ' · ' + o[3] + ' · ' + Math.round(60 / V.plan.spb) + ' BPM' + (V.plan.speed > 1.05 ? ' · plays ' + V.plan.speed.toFixed(V.plan.speed < 10 ? 1 : 0) + '× faster' : '');
  $('#vidPh').textContent = VPH.length ? n + ' clips using your ' + VPH.length + ' photo' + (VPH.length > 1 ? 's' : '') + (VPH.length < n ? ', repeating them in order' : '') + '.' : n + ' clips. Add up to ' + n + ' photos and each clip gets its own. Until then it uses ' + (afterC.width ? 'your open photo.' : 'the sample photo.')
}

function closeVid(keep) {
  if (!VID) return;
  if (VID.rec && VID.rec.state === 'recording') {
    VID.rec.onstop = null;
    VID.rec.stop()
  }
  reelSound(false);
  cancelAnimationFrame(VID.raf);
  VID = null;
  if (!keep) $('#vidM').classList.remove('on')
}

function vidRecType() {
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) return '';
  return ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].filter(function(t) {
    return MediaRecorder.isTypeSupported(t)
  })[0] || ''
}

function syncReelCtl() {
  $$('#vidCap button').forEach(function(b) {
    b.classList.toggle('on', b.dataset.c === reelCap)
  });
  $('#vidSnd').classList.toggle('on', reelSnd);
  $('#vidSnd').title = reelSnd ? 'Sound on (M)' : 'Sound off (M)';
  $('#vidSnd').setAttribute('aria-pressed', reelSnd);
  $('#vidSafe').classList.toggle('on', reelSafe);
  $('#vidSafe').disabled = !VID || VID.o[3] !== '9:16';
  $('#vidG').style.display = reelSafe ? '' : 'none'
}

$('#vidCap').innerHTML = Object.keys(REEL_CAPS).map(function(k) {
  return '<button data-c="' + k + '">' + REEL_CAPS[k] + '</button>'
}).join('');
$$('#vidCap button').forEach(function(b) {
  b.onclick = function() {
    reelCap = b.dataset.c;
    reelSetPref('cap', reelCap);
    syncReelCtl()
  }
});
$('#vidSnd').onclick = function() {
  reelSnd = !reelSnd;
  reelSetPref('snd', reelSnd ? '1' : '0');
  if (VID && !VID.rec) reelSound(VID.on);
  syncReelCtl()
};
$('#vidSafe').onclick = function() {
  reelSafe = !reelSafe;
  reelSetPref('safe', reelSafe ? '1' : '0');
  if (VID) vidGuides();
  syncReelCtl()
};
$('#vidPlay').onclick = function() {
  if (!VID || VID.rec) return;
  vidPlaying(!VID.on)
};
$('#vidSeek').oninput = function() {
  if (!VID || VID.rec) return;
  VID.t = Math.min(VID.plan.dur - .001, this.value / 1000 * VID.plan.dur);
  if (VID.on) reelSound(true)
};
$('#vidClose').onclick = function() {
  closeVid()
};
$('#vidM').onclick = function(e) {
  if (e.target === this) closeVid()
};
document.addEventListener('keydown', function(e) {
  if (!VID) return;
  var tag = document.activeElement.tagName;
  if (e.key === 'Escape') closeVid();
  if (/^(INPUT|TEXTAREA)$/.test(tag)) return;
  if (e.key === ' ' && !/^(BUTTON|A)$/.test(tag)) {
    e.preventDefault();
    $('#vidPlay').click()
  }
  if (e.key === 'm' || e.key === 'M') $('#vidSnd').click()
});

// Records the example in real time from the canvas, with its soundtrack.
$('#vidDl').onclick = function() {
  var V = VID,
    type = vidRecType(),
    b = this;
  if (!V || V.rec || !type) return;
  var stream = V.c.captureStream(30);
  if (reelSnd && reelAudio() && RA.dest) stream.addTrack(RA.dest.stream.getAudioTracks()[0]);
  var chunks = [],
    rec = new MediaRecorder(stream, {
      mimeType: type,
      videoBitsPerSecond: 8e6
    });
  rec.ondataavailable = function(e) {
    if (e.data.size) chunks.push(e.data)
  };
  rec.onstop = function() {
    V.rec = null;
    b.disabled = false;
    b.textContent = 'Download video';
    var blob = new Blob(chunks, {
        type: type.split(';')[0]
      }),
      a = document.createElement('a'),
      u = URL.createObjectURL(blob);
    a.href = u;
    a.download = V.o[0].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-reel.' + (/mp4/.test(type) ? 'mp4' : 'webm');
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function() {
      URL.revokeObjectURL(u)
    }, 4000);
    toast('Video saved')
  };
  V.rec = rec;
  V.t = 0;
  vidPlaying(true);
  b.disabled = true;
  b.textContent = 'Recording… ' + Math.ceil(V.plan.dur) + 's';
  rec.start(250)
};
