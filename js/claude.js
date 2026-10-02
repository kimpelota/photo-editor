/* ============================================================
   CLAUDE PROMPT EDITOR
   ============================================================ */
// With an Anthropic API key, the AI Editor sends the prompt plus a small copy
// of the photo to Claude, which returns an edit plan as JSON. The plan uses the
// same step list as the offline parser, so the user can review and tweak it.
// The key is kept only in this browser's localStorage and requests go straight
// from this computer to api.anthropic.com.
var CLAUDE_SDK = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.128.0/+esm',
  CLAUDE_MODEL = 'claude-opus-5',
  KEY_STORE = 'lumen.claudeKey',
  claudeLib = null,
  claudeCtl = null;

function claudeKey() {
  try {
    return localStorage.getItem(KEY_STORE) || ''
  } catch (e) {
    return ''
  }
}

function setClaudeKey(k) {
  try {
    k ? localStorage.setItem(KEY_STORE, k) : localStorage.removeItem(KEY_STORE);
    return true
  } catch (e) {
    toast('This browser is blocking storage, so the key can’t be saved');
    return false
  }
}

/* ---------- response schema ---------- */
var ADJ_KEYS = ['exposure', 'brightness', 'contrast', 'highlights', 'shadows', 'warmth', 'tint', 'saturation', 'vibrance', 'clarity', 'sharpen', 'denoise', 'fade', 'glow', 'vignette', 'grain'],
  BAND_KEYS = ['red', 'orange', 'yellow', 'green', 'aqua', 'blue', 'purple', 'magenta'],
  MASK_KEYS = ['exposure', 'contrast', 'highlights', 'shadows', 'warmth', 'tint', 'saturation', 'clarity', 'sharpen', 'blur'];

function obj(props) {
  var p = {
    why: {
      type: 'string',
      description: 'One short sentence shown to the user.'
    }
  };
  Object.keys(props).forEach(function(k) {
    p[k] = props[k]
  });
  return {
    type: 'object',
    properties: p,
    required: Object.keys(p),
    additionalProperties: false
  }
}
var NUM = {
    type: 'number'
  },
  lit = function(v) {
    return {
      type: 'string',
      enum: [v]
    }
  },
  maskAdjust = {
    type: 'object',
    properties: MASK_KEYS.reduce(function(o, k) {
      o[k] = NUM;
      return o
    }, {}),
    required: MASK_KEYS,
    additionalProperties: false,
    description: 'Adjustments inside the mask, -100..100 (blur 0..100). Use 0 for anything unchanged.'
  };

var PLAN_SCHEMA = {
  type: 'object',
  properties: {
    summary: {
      type: 'string',
      description: 'One or two friendly sentences describing the plan.'
    },
    steps: {
      type: 'array',
      items: {
        anyOf: [
          obj({
            type: lit('adjust'),
            control: {
              type: 'string',
              enum: ADJ_KEYS
            },
            value: NUM
          }),
          obj({
            type: lit('color_range'),
            band: {
              type: 'string',
              enum: BAND_KEYS
            },
            hue: NUM,
            saturation: NUM,
            luminance: NUM
          }),
          obj({
            type: lit('filter'),
            id: {
              type: 'string',
              enum: P.FL.map(function(f) {
                return f[0]
              })
            },
            strength: NUM
          }),
          obj({
            type: lit('curve'),
            channel: {
              type: 'string',
              enum: ['rgb', 'r', 'g', 'b']
            },
            points: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  x: NUM,
                  y: NUM
                },
                required: ['x', 'y'],
                additionalProperties: false
              }
            }
          }),
          obj({
            type: lit('crop_ratio'),
            ratio: {
              type: 'string',
              enum: ['original', '1:1', '4:5', '3:2', '16:9', '9:16', '21:9']
            }
          }),
          obj({
            type: lit('crop_box'),
            x: NUM,
            y: NUM,
            w: NUM,
            h: NUM
          }),
          obj({
            type: lit('straighten'),
            degrees: NUM
          }),
          obj({
            type: lit('rotate'),
            degrees: {
              type: 'integer',
              enum: [90, -90, 180]
            }
          }),
          obj({
            type: lit('flip'),
            axis: {
              type: 'string',
              enum: ['horizontal', 'vertical']
            }
          }),
          obj({
            type: lit('auto_enhance'),
            strength: NUM
          }),
          obj({
            type: lit('upscale'),
            factor: {
              type: 'integer',
              enum: [2, 4]
            }
          }),
          obj({
            type: lit('protect_skin')
          }),
          obj({
            type: lit('mask_ai'),
            region: {
              type: 'string',
              enum: ['subject', 'background', 'face']
            },
            adjust: maskAdjust
          }),
          obj({
            type: lit('mask_radial'),
            cx: NUM,
            cy: NUM,
            rx: NUM,
            ry: NUM,
            feather: NUM,
            invert: {
              type: 'boolean'
            },
            adjust: maskAdjust
          }),
          obj({
            type: lit('mask_linear'),
            x1: NUM,
            y1: NUM,
            x2: NUM,
            y2: NUM,
            adjust: maskAdjust
          }),
          obj({
            type: lit('reset_all')
          })
        ]
      }
    },
    cant: {
      type: 'array',
      description: 'Parts of the request this editor cannot do, each with a helpful alternative.',
      items: {
        type: 'object',
        properties: {
          request: {
            type: 'string'
          },
          reason: {
            type: 'string'
          }
        },
        required: ['request', 'reason'],
        additionalProperties: false
      }
    }
  },
  required: ['summary', 'steps', 'cant'],
  additionalProperties: false
};

var CLAUDE_SYSTEM = [
  'You are the editing brain of Studio de Nuance, a photo editor. The user describes an edit in plain language; you look at the photo and reply with an edit plan as JSON matching the schema. The app shows your plan as a list the user can review and adjust before applying it.',
  '',
  'What each step does:',
  '- adjust: sets one global slider to an absolute value from -100 to 100 (fade, glow, grain, denoise: 0 to 100). The current values are given; to nudge, add to them. Typical tasteful moves are 5 to 35.',
  '- color_range: HSL for one colour band (sky is blue/aqua, foliage green/yellow, skin orange). hue, saturation, luminance each -100 to 100, absolute.',
  '- filter: stacks a named look on top, strength 0 to 100. Filters apply after adjustments; adjust steps listed after a filter apply on top of it.',
  '  Filters by category: ' + ['Film', 'B&W', 'Cinematic', 'Vintage', 'Color Pop', 'Artistic'].map(function(c) {
    return c + ': ' + P.FL.filter(function(f) {
      return f[2] === c
    }).map(function(f) {
      return f[0] + ' (' + f[1] + ')'
    }).join(', ')
  }).join('; ') + '.',
  '- curve: tone curve points {x,y} from 0 to 255, including the endpoints (0,y) and (255,y). Replaces that channel\'s curve.',
  '- crop_ratio: centred crop to an aspect ratio. crop_box: a custom crop as fractions (0-1) of the photo you were shown (x, y = top-left). Use crop_box when composition matters, e.g. "crop to the subject" or "rule of thirds".',
  '- straighten: degrees, positive turns the photo clockwise. Use it for tilted horizons you can see.',
  '- rotate / flip: 90-degree turns and mirroring.',
  '- auto_enhance: the one-click enhancer (levels, white balance, clarity, vibrance), strength 0 to 100.',
  '- upscale: AI super-resolution, 2x or 4x.',
  '- protect_skin: keeps skin tones natural under colour changes.',
  '- mask_ai: a local edit through an AI-selected subject, background or face mask. mask_radial (centre cx,cy and radii rx,ry as fractions of the photo width and height, feather 0-1, invert to edit outside) and mask_linear (full effect at x1,y1 fading to none at x2,y2) for areas you place yourself, e.g. darken the sky with a linear mask from the top edge to just below the horizon. Mask coordinates are fractions of the photo you were shown.',
  '- reset_all: clears every existing edit first.',
  '',
  'Guidance: look at the photo before choosing values; keep results natural unless the user asks for something bold; prefer masks for requests about one part of the image; keep the plan short (usually 2 to 8 steps). Things the editor cannot do (removing or adding objects, changing faces or bodies, replacing the sky, generating new content) go in "cant" with a practical alternative the editor can do. Write "why" and "summary" for a non-expert.'
].join('\n');

/* ---------- request ---------- */
function loadClaude() {
  if (!claudeLib) claudeLib = import(CLAUDE_SDK).then(function(m) {
    return m.default || m.Anthropic
  }).catch(function(e) {
    claudeLib = null;
    throw e
  });
  return claudeLib
}

// Current look, in the photo's original orientation, as a JPEG for Claude.
function photoForClaude() {
  var st = clone(S);
  st.geo = {};
  var m = P.render(work, st, null, AUX),
    c = document.createElement('canvas'),
    k = Math.min(1, 1024 / Math.max(m.w, m.h)),
    t = document.createElement('canvas');
  putC(t, m);
  c.width = Math.round(m.w * k);
  c.height = Math.round(m.h * k);
  var x = c.getContext('2d');
  x.imageSmoothingQuality = 'high';
  x.drawImage(t, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', .85).split(',')[1]
}

function currentSettings() {
  var v = base(),
    g = S.geo,
    adj = {};
  ADJ_KEYS.forEach(function(k) {
    if (v[k]) adj[k] = v[k]
  });
  return {
    adjust: adj,
    color_ranges: v.hsl || {},
    curves: v.curve || {},
    filters: fLayers().map(function(l) {
      return {
        id: l.id,
        name: fname(l.id),
        strength: Math.round(l.s * 100)
      }
    }),
    geometry: {
      rotate: g.rot || 0,
      flipped: !!(g.fh || g.fv),
      straighten: g.ang || 0,
      crop: g.rect ? 'custom box' : g.crop || 'none'
    },
    masks: masks().map(function(m) {
      return m.name
    }),
    auto_enhance: S.enh ? Math.round(S.enh.amt * 100) : 0,
    protect_skin: !!S.skin
  }
}

function askClaude(text) {
  var ctl = claudeCtl = new AbortController();
  return loadClaude().then(function(Anthropic) {
    var client = new Anthropic({
      apiKey: claudeKey(),
      dangerouslyAllowBrowser: true
    });
    return client.beta.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      thinking: {
        type: 'adaptive'
      },
      output_config: {
        effort: 'medium',
        format: {
          type: 'json_schema',
          schema: PLAN_SCHEMA
        }
      },
      system: CLAUDE_SYSTEM,
      messages: [{
        role: 'user',
        content: [{
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/jpeg',
            data: photoForClaude()
          }
        }, {
          type: 'text',
          text: 'Current settings: ' + JSON.stringify(currentSettings()) + '\n\nRequest: ' + text
        }]
      }]
    }, {
      signal: ctl.signal
    }).then(function(res) {
      if (res.stop_reason === 'refusal') throw new Error('Claude declined this request.');
      if (res.stop_reason === 'max_tokens') throw new Error('The plan came back incomplete. Try a shorter request.');
      var tb = res.content.filter(function(b) {
        return b.type === 'text'
      }).pop();
      if (!tb) throw new Error('Claude didn’t return a plan.');
      return JSON.parse(tb.text)
    }, function(e) {
      if (e instanceof Anthropic.AuthenticationError) throw new Error('That API key was rejected. Check it in the Claude settings.');
      if (e instanceof Anthropic.RateLimitError) throw new Error('Rate limited by the API. Wait a moment and try again.');
      if (e instanceof Anthropic.APIUserAbortError) throw e;
      if (e instanceof Anthropic.APIConnectionError) throw new Error('Couldn’t reach Anthropic. Check your internet connection.');
      if (e instanceof Anthropic.APIError) throw new Error('API error ' + (e.status || '') + ': ' + e.message);
      throw e
    })
  }).finally(function() {
    if (claudeCtl === ctl) claudeCtl = null
  })
}

// AI masks need the segmentation grid before the preview can show them.
function segForSteps(steps, onNeed) {
  var needs = {};
  steps.forEach(function(s) {
    if (s.k === 'mask' && MASK_TYPES[s.mk.type].ai) needs[s.mk.type === 'face' ? 'face' : 'subject'] = true
  });
  return Object.keys(needs).reduce(function(p, need) {
    return p.then(function() {
      onNeed && onNeed(need);
      return ensureSeg(need)
    })
  }, Promise.resolve())
}

/* ---------- plan conversion ---------- */
// A crop box in source-photo fractions -> the straightened frame's fractions.
function srcRectToFrame(r, g) {
  var G = P.geoMap(work.w, work.h, {
      rot: g.rot,
      fh: g.fh,
      fv: g.fv,
      ang: g.ang
    }),
    A = G.m,
    det = A[0] * A[3] - A[2] * A[1],
    xs = [],
    ys = [];
  [
    [r.x, r.y],
    [r.x + r.w, r.y],
    [r.x, r.y + r.h],
    [r.x + r.w, r.y + r.h]
  ].forEach(function(p) {
    var sx = p[0] * work.w - A[4],
      sy = p[1] * work.h - A[5];
    xs.push((A[3] * sx - A[2] * sy) / det / G.frame[0]);
    ys.push((-A[1] * sx + A[0] * sy) / det / G.frame[1])
  });
  var x0 = Math.max(0, Math.min.apply(0, xs)),
    y0 = Math.max(0, Math.min.apply(0, ys)),
    x1 = Math.min(1, Math.max.apply(0, xs)),
    y1 = Math.min(1, Math.max.apply(0, ys));
  return {
    x: x0,
    y: y0,
    w: Math.max(.04, x1 - x0),
    h: Math.max(.04, y1 - y0)
  }
}

function clampN(v, lo, hi) {
  v = +v || 0;
  return Math.max(lo, Math.min(hi, v))
}

function maskV(a) {
  var v = {};
  MASK_KEYS.forEach(function(k) {
    var x = Math.round(clampN(a[k], k === 'blur' ? 0 : -100, 100));
    if (x) v[k] = x
  });
  return v
}

var MASK_NAMES = {
  subject: 'Subject',
  background: 'Background',
  face: 'Face'
};

function claudeSteps(plan) {
  var out = [];
  plan.steps.forEach(function(s) {
    var st = null;
    switch (s.type) {
      case 'adjust':
        st = {
          k: 'setv',
          key: s.control,
          v: Math.round(clampN(s.value, NONNEG[s.control] ? 0 : -100, 100))
        };
        break;
      case 'color_range':
        st = {
          k: 'hslset',
          band: s.band,
          h: clampN(s.hue, -100, 100),
          s: clampN(s.saturation, -100, 100),
          l: clampN(s.luminance, -100, 100)
        };
        break;
      case 'filter':
        st = {
          k: 'flt',
          id: s.id,
          s: clampN(s.strength, 0, 100) / 100
        };
        break;
      case 'curve':
        var pts = s.points.map(function(p) {
          return [Math.round(clampN(p.x, 0, 255)), Math.round(clampN(p.y, 0, 255))]
        }).sort(function(a, b) {
          return a[0] - b[0]
        });
        if (pts.length < 2) return;
        pts[0][0] = 0;
        pts[pts.length - 1][0] = 255;
        st = {
          k: 'curve',
          ch: s.channel,
          pts: pts
        };
        break;
      case 'crop_ratio':
        st = {
          k: 'crop',
          ar: s.ratio === 'original' ? null : s.ratio
        };
        break;
      case 'crop_box':
        st = {
          k: 'cropbox',
          rect: {
            x: clampN(s.x, 0, 1),
            y: clampN(s.y, 0, 1),
            w: clampN(s.w, .04, 1),
            h: clampN(s.h, .04, 1)
          }
        };
        break;
      case 'straighten':
        st = {
          k: 'straighten',
          deg: Math.round(clampN(s.degrees, -45, 45) * 10) / 10
        };
        break;
      case 'rotate':
        st = {
          k: 'rot',
          deg: s.degrees
        };
        break;
      case 'flip':
        st = {
          k: 'flip',
          ax: s.axis === 'vertical' ? 'fv' : 'fh'
        };
        break;
      case 'auto_enhance':
        st = {
          k: 'enh',
          amt: clampN(s.strength, 0, 100) / 100
        };
        break;
      case 'upscale':
        st = {
          k: 'up',
          f: s.factor
        };
        break;
      case 'protect_skin':
        st = {
          k: 'skin'
        };
        break;
      case 'mask_ai':
        st = {
          k: 'mask',
          mk: {
            type: s.region,
            name: MASK_NAMES[s.region],
            inv: false,
            amt: 1,
            v: maskV(s.adjust)
          }
        };
        break;
      case 'mask_radial':
        st = {
          k: 'mask',
          mk: {
            type: 'radial',
            name: 'Radial',
            cx: clampN(s.cx, 0, 1),
            cy: clampN(s.cy, 0, 1),
            rx: clampN(s.rx, .01, 2),
            ry: clampN(s.ry, .01, 2),
            feather: clampN(s.feather, 0, 1),
            inv: !!s.invert,
            amt: 1,
            v: maskV(s.adjust)
          }
        };
        break;
      case 'mask_linear':
        st = {
          k: 'mask',
          mk: {
            type: 'linear',
            name: 'Linear gradient',
            x1: clampN(s.x1, -.5, 1.5),
            y1: clampN(s.y1, -.5, 1.5),
            x2: clampN(s.x2, -.5, 1.5),
            y2: clampN(s.y2, -.5, 1.5),
            inv: false,
            amt: 1,
            v: maskV(s.adjust)
          }
        };
        break;
      case 'reset_all':
        st = {
          k: 'reset'
        };
        break
    }
    if (st) {
      st.why = s.why;
      out.push(st)
    }
  });
  return out
}

// Sends the prompt to Claude and shows the returned plan for review.
function runClaude(text) {
  var btn = $('#bRun');
  btn.disabled = true;
  btn.textContent = 'Claude is looking…';
  $('#bStop').hidden = false;
  return askClaude(text).then(function(res) {
    var steps = claudeSteps(res);
    return segForSteps(steps, function(need) {
      btn.textContent = 'Finding the ' + need + '…'
    }).then(function() {
      plan = {
        R: {
          steps: steps,
          cant: res.cant.map(function(c) {
            return {
              text: c.request,
              why: c.reason
            }
          }),
          skip: [],
          natural: false,
          summary: res.summary,
          by: 'claude'
        },
        text: text,
        st: null
      };
      replan();
      renderPlan()
    })
  }).catch(function(e) {
    if (/abort/i.test([e && e.name, e && e.constructor && e.constructor.name].join(' '))) toast('Stopped');
    else {
      console.error(e);
      toast(e.message || 'Something went wrong talking to Claude')
    }
  }).finally(function() {
    btn.disabled = false;
    btn.textContent = 'Understand →';
    $('#bStop').hidden = true
  })
}

/* ---------- settings UI ---------- */
function syncClaudeUI() {
  var k = claudeKey();
  $('#engine').innerHTML = k ? '<i class="ai">AI</i> Claude Opus 5 <em>· sees your photo</em>' : 'Offline parser <em>· connect Claude for full understanding</em>';
  $('#bClaude').textContent = k ? 'Settings' : 'Connect Claude';
  $('#keyForget').hidden = !k;
  $('#aiNote').hidden = !!k;
  $('#aiNoteClaude').hidden = !k
}
$('#bClaude').onclick = function() {
  var f = $('#keyForm');
  f.hidden = !f.hidden;
  if (!f.hidden) $('#keyIn').focus()
};
$('#keySave').onclick = function() {
  var k = $('#keyIn').value.trim();
  if (!/^sk-ant-/.test(k)) {
    toast('That doesn’t look like an Anthropic API key (it starts with sk-ant-)');
    return
  }
  if (setClaudeKey(k)) {
    $('#keyIn').value = '';
    $('#keyForm').hidden = true;
    syncClaudeUI();
    toast('Claude connected')
  }
};
$('#keyIn').onkeydown = function(e) {
  if (e.key === 'Enter') $('#keySave').click()
};
$('#keyForget').onclick = function() {
  setClaudeKey('');
  $('#keyForm').hidden = true;
  syncClaudeUI();
  toast('Key removed from this browser')
};
$('#bStop').onclick = function() {
  if (claudeCtl) claudeCtl.abort()
};
syncClaudeUI();

// How Claude's step types show in the plan list (the offline ones are in stepInfo).
function claudeStepInfo(s) {
  var sg = function(v) {
      return (v > 0 ? '+' : '') + v
    },
    why = s.why || '';
  switch (s.k) {
    case 'setv':
      return {
        c: /exposure|brightness|contrast|highlights|shadows/.test(s.key) ? 'light' : /warmth|tint|saturation|vibrance/.test(s.key) ? 'color' : /clarity|sharpen|denoise/.test(s.key) ? 'detail' : 'look',
        t: LBL[s.key],
        d: why,
        v: sg(s.v),
        rng: [NONNEG[s.key] ? 0 : -100, 100, s.v, function(x) {
          s.v = x
        }]
      };
    case 'hslset':
      return {
        c: 'color',
        t: s.band.charAt(0).toUpperCase() + s.band.slice(1) + ' tones',
        d: why || 'Only affects ' + s.band + ' colours',
        v: ['h', 's', 'l'].filter(function(p) {
          return s[p]
        }).map(function(p) {
          return {
            h: 'Hue ',
            s: 'Sat ',
            l: 'Lum '
          }[p] + sg(Math.round(s[p]))
        }).join(' ')
      };
    case 'curve':
      return {
        c: 'light',
        t: (s.ch === 'rgb' ? 'Tone' : s.ch.toUpperCase()) + ' curve',
        d: why,
        v: s.pts.length + ' pts'
      };
    case 'cropbox':
      return {
        c: 'geo',
        t: 'Crop',
        d: why,
        v: Math.round(s.rect.w * 100) + '×' + Math.round(s.rect.h * 100) + '%'
      };
    case 'straighten':
      return {
        c: 'geo',
        t: 'Straighten',
        d: why,
        v: sg(s.deg) + '°'
      };
    case 'mask':
      var m = s.mk,
        ks = Object.keys(m.v).map(function(k) {
          return (k === 'blur' ? 'Blur' : SHORT[k] || k) + ' ' + (k === 'blur' ? m.v[k] : sg(m.v[k]))
        }).slice(0, 3).join(', ');
      return {
        c: 'look',
        t: (MASK_TYPES[m.type].ai ? 'AI ' : '') + MASK_TYPES[m.type].name + ' mask' + (m.inv ? ' (outside)' : ''),
        d: why || ks,
        v: '',
        rng: [0, 100, Math.round(m.amt * 100), function(x) {
          m.amt = x / 100
        }]
      }
  }
  // Offline step kinds keep their own labels, with Claude's reason when there is one.
  if (why) {
    var base = stepInfoBase(s);
    if (base) base.d = why;
    return base
  }
  return null
}
