/* ---------- AI PANE UI ---------- */
var EXAMPLES = ['make it warmer and a bit brighter, then add a vintage film look but keep the skin tones natural, and crop to square', 'less contrast, not so blue, lift the shadows a lot and make the sky bluer',
  'black and white with lots of grain and a strong vignette, then sharpen it slightly', 'moody cinematic look but not too dark, recover the highlights, crop 16:9', 'remove the people in the background and make the grass greener', 'enhance it, upscale 4x, reduce the noise and make the colors pop'
];
$('#examples').innerHTML = EXAMPLES.map(function(e, i) {
  return '<button data-i="' + i + '">' + esc(e) + '</button>'
}).join('');
$$('#examples button').forEach(function(b) {
  b.onclick = function() {
    $('#prompt').value = EXAMPLES[+b.dataset.i];
    runPrompt()
  }
});

function stepInfo(s) {
  var info = claudeStepInfo(s);
  if (info) return info;
  return stepInfoBase(s)
}

function stepInfoBase(s) {
  var cap = function(x) {
      return x.charAt(0).toUpperCase() + x.slice(1)
    },
    sg = function(v) {
      return (v > 0 ? '+' : '') + v
    };
  switch (s.k) {
    case 'adj':
      return {
        c: /exposure|brightness|contrast|highlights|shadows/.test(s.key) ? 'light' : /warmth|tint|saturation|vibrance/.test(s.key) ? 'color' : /clarity|sharpen|denoise/.test(s.key) ? 'detail' : 'look', t: LBL[s.key] + (s.guard ? ' (guard)' : ''), d: s.cap ? 'Halved so it doesn’t go too far' : s.guard ? 'Keeps it from going too far' : '', v: sg(s.v), rng: [NONNEG[s.key] ? 0 : -100, 100, s.v, function(x) {
          s.v = x
        }]
      };
    case 'set':
      return {
        c: 'detail', t: 'Remove ' + LBL[s.key].toLowerCase(), d: 'Sets it back to 0', v: '0'
      };
    case 'hsl':
      return {
        c: 'color', t: cap(s.tw || s.band) + ' ' + (s.prop === 's' ? 'saturation' : s.prop === 'l' ? 'brightness' : 'hue'), d: 'Only affects ' + s.band + ' tones', v: sg(s.v), rng: [-100, 100, s.v, function(x) {
          s.v = x
        }]
      };
    case 'look':
      var ks = Object.keys(s.vals).filter(function(k) {
        return k !== 'hsl'
      }).slice(0, 4).map(function(k) {
        return (SHORT[k] || k) + ' ' + sg(Math.round(s.vals[k] * s.m))
      });
      return {
        c: 'look', t: s.name + ' mood' + (s.m < 0 ? ' (reduced)' : ''), d: (s.cap ? 'Toned down · ' : '') + ks.join(', '), v: Math.round(Math.abs(s.m) * 100) + '%', rng: [0, 200, Math.round(Math.abs(s.m) * 100), function(x) {
          s.m = (s.m < 0 ? -1 : 1) * x / 100
        }]
      };
    case 'flt':
      return {
        c: 'look', t: fname(s.id) + ' filter', d: (s.cap ? 'Adjusted · ' : '') + P.FL.filter(function(f) {
          return f[0] === s.id
        })[0][2], v: Math.round(s.s * 100) + '%', rng: [0, 100, Math.round(s.s * 100), function(x) {
          s.s = x / 100
        }]
      };
    case 'crop':
      return {
        c: 'geo', t: 'Crop', d: s.ar ? 'Centered ' + s.ar + ' frame' : 'Back to original frame', v: '', sel: [
          ['1:1', '4:5', '3:2', '16:9', '9:16', '21:9', ''], s.ar || '',
          function(x) {
            s.ar = x || null
          }
        ]
      };
    case 'rot':
      return {
        c: 'geo', t: 'Rotate ' + (s.deg > 0 ? 'right' : 'left') + ' ' + Math.abs(s.deg) + '°', d: '', v: ''
      };
    case 'flip':
      return {
        c: 'geo', t: 'Flip ' + (s.ax === 'fh' ? 'horizontally' : 'vertically'), d: '', v: ''
      };
    case 'enh':
      return {
        c: 'detail', t: 'Photo Enhancer', d: 'Auto levels, white balance, clarity, vibrance, sharpen', v: Math.round(s.amt * 100) + '%', rng: [0, 100, Math.round(s.amt * 100), function(x) {
          s.amt = x / 100
        }]
      };
    case 'up':
      return {
        c: 'detail', t: 'Upscale', d: 'Lanczos-3 + detail recovery (see Upscale tab)', v: '', sel: [
          ['2', '4'], String(s.f),
          function(x) {
            s.f = +x
          }
        ], selL: function(x) {
          return x + '×'
        }
      };
    case 'skin':
      return {
        c: 'color', t: 'Protect skin tones', d: 'Keeps faces natural under color changes', v: ''
      };
    case 'natural':
      return {
        c: 'color', t: 'Keep it natural', d: 'Tones all steps down about 35%', v: ''
      };
    case 'reset':
      return {
        c: 'geo', t: 'Reset to original', d: 'Clears earlier edits', v: ''
      }
  }
}

function renderPlan() {
  var box = $('#planBox');
  if (!plan) {
    box.hidden = true;
    return
  }
  box.hidden = false;
  var R = plan.R,
    ol = $('#steps');
  ol.innerHTML = '';
  R.steps.forEach(function(s, i) {
    var inf = stepInfo(s),
      li = document.createElement('li');
    li.className = 'step c-' + inf.c;
    li.innerHTML = '<span class="n">' + (i + 1) + '</span><div><div class="t">' + esc(inf.t) + '</div>' + (inf.d ? '<div class="d">' + esc(inf.d) + '</div>' : '') + '</div><span class="v">' + esc(inf.v) + '</span><button class="x" title="Remove step">&times;</button>';
    if (inf.rng) {
      var d = document.createElement('div');
      d.className = 'ctl';
      var r = document.createElement('input');
      r.type = 'range';
      r.min = inf.rng[0];
      r.max = inf.rng[1];
      r.value = inf.rng[2];
      var paint = function() {
        var mn = +r.min,
          mx = +r.max,
          p = (r.value - mn) / (mx - mn) * 100,
          z = mn < 0 ? (-mn) / (mx - mn) * 100 : 0;
        r.style.setProperty('--a', Math.min(p, z) + '%');
        r.style.setProperty('--b', Math.max(p, z) + '%')
      };
      paint();
      r.oninput = function() {
        inf.rng[3](+r.value);
        paint();
        li.querySelector('.v').textContent = stepInfo(s).v;
        replan()
      };
      d.appendChild(r);
      li.appendChild(d)
    }
    if (inf.sel) {
      var d2 = document.createElement('div');
      d2.className = 'ctl';
      var se = document.createElement('select');
      inf.sel[0].forEach(function(o) {
        var op = document.createElement('option');
        op.value = o;
        op.textContent = o ? (inf.selL ? inf.selL(o) : o) : 'Original';
        se.appendChild(op)
      });
      se.value = inf.sel[1];
      se.onchange = function() {
        inf.sel[2](se.value);
        replan();
        renderPlan()
      };
      d2.appendChild(se);
      li.appendChild(d2)
    }
    li.querySelector('.x').onclick = function() {
      R.steps.splice(i, 1);
      replan();
      renderPlan()
    };
    ol.appendChild(li)
  });
  if (!R.steps.length) ol.innerHTML = '<li class="skip" style="list-style:none">No edits I can make from that. See below.</li>';
  $('#cantBox').innerHTML = R.cant.map(function(c) {
    return '<div class="cant"><b>' + (R.by === 'claude' ? 'Can’t do this here' : 'Can’t do this offline') + '</b><q>' + esc(c.text) + '</q><p>' + esc(c.why) + '</p></div>'
  }).join('') + R.skip.map(function(c) {
    return '<div class="skip">Skipped “' + esc(c.text) + '”. ' + esc(c.why) + '</div>'
  }).join('');
  $('#planWhy').textContent = R.summary || '';
  $('#planWhy').hidden = !R.summary;
  $('#planSum').textContent = R.steps.length + ' step' + (R.steps.length === 1 ? '' : 's') + (R.cant.length ? ' · ' + R.cant.length + ' can’t do' : '') + (R.skip.length ? ' · ' + R.skip.length + ' skipped' : '');
  $('#bApply').disabled = !R.steps.length
}
var rpT;

function replan() {
  if (!plan) return;
  plan.st = applySteps(S, plan.R.steps);
  clearTimeout(rpT);
  rpT = setTimeout(schedule, 30)
}

function runPrompt() {
  var t = $('#prompt').value.trim();
  if (!t) {
    toast('Type what you want to change');
    return
  }
  if (!work) return;
  if (claudeKey()) return runClaude(t);
  var R = parsePrompt(t);
  plan = {
    R: R,
    text: t,
    st: null
  };
  replan();
  renderPlan();
  if (R.steps.some(function(s) {
      return s.k === 'up'
    }) && tab !== 'enhance') toast('Upscale added. Open the Upscale tab to inspect it')
}
$('#bRun').onclick = runPrompt;
$('#prompt').onkeydown = function(e) {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    runPrompt()
  }
};
$('#bApply').onclick = function() {
  if (!plan) return;
  var t = plan.text;
  S = plan.st;
  plan = null;
  // The next filter picked should stack on top of the AI's look, not replace a filter it chose.
  fPos = fCount();
  renderPlan();
  push('AI: ' + (t.length > 38 ? t.slice(0, 36) + '…' : t));
  thumbsDirty = presetDirty = true;
  schedule();
  toast('Applied. Undo anytime with Ctrl/Cmd+Z')
};
$('#bDiscard').onclick = function() {
  plan = null;
  renderPlan();
  schedule()
};
