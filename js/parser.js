/* ============================================================
   PROMPT PARSER ("AI" editor) — fully local
   ============================================================ */
var BASEV = {
  exposure: 25,
  brightness: 20,
  contrast: 22,
  highlights: 30,
  shadows: 30,
  warmth: 22,
  tint: 15,
  saturation: 22,
  vibrance: 25,
  clarity: 25,
  sharpen: 30,
  fade: 20,
  glow: 25,
  vignette: 30,
  grain: 25,
  denoise: 40
};
var NONNEG = {
  grain: 1,
  glow: 1,
  denoise: 1,
  fade: 1
};
var PROT = [
  [/black\s*(and|&|n)\s*white|b\s*&\s*w|b\/w/g, 'bw'],
  [/teal\s*(and|&)\s*orange|orange\s*(and|&)\s*teal/g, 'teal_and_orange'],
  [/day\s*for\s*night/g, 'day_for_night'],
  [/golden\s*hour/g, 'golden_hour'],
  [/cross[\s-]*process(ed|ing)?/g, 'cross_process'],
  [/pop\s*art/g, 'pop_art'],
  [/film\s*grain/g, 'film_grain'],
  [/skin\s*tones?|skin\s*colou?rs?/g, 'skin'],
  [/a\s+little\s+bit(\s+of)?|a\s+(tiny\s+)?bit(\s+of)?|a\s+wee\s+bit/g, 'abit'],
  [/a\s+little/g, 'alittle'],
  [/a\s+touch(\s+of)?/g, 'atouch'],
  [/a\s+lot(\s+of)?|lots\s+of|tons\s+of|loads\s+of|a\s+ton\s+of/g, 'alot'],
  [/not\s+so|not\s+as|less\s+of/g, 'notso'],
  [/not\s+too|don'?t\s+make\s+it\s+too|without\s+making\s+it\s+too|don'?t\s+(let\s+it\s+)?get\s+too|not\s+overly/g, 'nottoo'],
  [/tone\s+down|turn\s+down|dial\s+(back|down)|bring\s+down|pull\s+back|knock\s+down|cut\s+back\s+on|cut\s+down\s+on/g, 'reduce'],
  [/turn\s+up|crank\s+up|bump\s+up|dial\s+up|pump\s+up|bring\s+up|boost\s+up/g, 'increase'],
  [/washed\s+out/g, 'washed'],
  [/stand\s+out/g, 'pop'],
  [/8[\s-]?bit/g, '8bit'],
  [/tilt[\s-]?shift/g, 'tiltshift'],
  [/blade\s+runner/g, 'cyberpunk'],
  [/old[\s-]?timey|old[\s-]?fashioned|old\s+photo(graph)?/g, 'antique'],
  [/oil\s+paint(ing)?/g, 'oil_painting'],
  [/heat\s*map/g, 'thermal'],
  [/colou?r\s+splash|splash\s+of\s+colou?r/g, 'color_splash'],
  [/vintage\s+film|retro\s+film|classic\s+film/g, 'vintage_film'],
  [/bleach\s+bypass/g, 'bleach'],
  [/toy\s+camera/g, 'lomo'],
  [/red\s+filter/g, 'red_filter'],
  [/pixel\s+art/g, '8bit'],
  [/film\s+noir/g, 'noir'],
  [/expired\s+film|old\s+film/g, 'expired_film'],
  [/get\s+rid\s+of|take\s+out/g, 'remove'],
  [/pencil\s+sketch|pencil\s+drawing/g, 'sketch'],
  [/neon\s+edges?/g, 'neon_edges'],
  [/comic\s+book/g, 'cartoon'],
  [/light\s+leaks?/g, 'expired_film'],
  [/sun\s*set/g, 'sunset'],
  [/instant\s+(film|camera|photo)/g, 'polaroid'],
  [/(make|made)\s+(it|this|the\s+(photo|image|picture|pic))\s+(look\s+)?(like\s+)?/g, 'make '],
  [/\bhdr\b/g, 'dramatic_hdr']
];
var FALIAS = [
  ['vintage_film', 'kodachrome'],
  ['expired_film', 'expired'],
  ['film look', 'portra'],
  ['analog', 'portra'],
  ['analogue', 'portra'],
  ['portra', 'portra'],
  ['kodak', 'kodachrome'],
  ['kodachrome', 'kodachrome'],
  ['ektar', 'ektar'],
  ['velvia', 'velvia'],
  ['fuji', 'velvia'],
  ['cinestill', 'cinestill'],
  ['tungsten', 'cinestill'],
  ['film', 'portra'],
  ['bw', 'mono'],
  ['monochrome', 'mono'],
  ['grayscale', 'mono'],
  ['greyscale', 'mono'],
  ['mono', 'mono'],
  ['noir', 'noir'],
  ['selenium', 'selenium'],
  ['infrared', 'infrared'],
  ['red_filter', 'redfilter'],
  ['sepia', 'sepia'],
  ['cyanotype', 'cyanotype'],
  ['blueprint', 'cyanotype'],
  ['teal_and_orange', 'tealorange'],
  ['cinematic', 'tealorange'],
  ['movie', 'tealorange'],
  ['hollywood', 'blockbuster'],
  ['blockbuster', 'blockbuster'],
  ['letterbox', 'blockbuster'],
  ['bleach', 'bleach'],
  ['matrix', 'matrix'],
  ['hacker', 'matrix'],
  ['day_for_night', 'moonlight'],
  ['moonlight', 'moonlight'],
  ['nighttime', 'moonlight'],
  ['night', 'moonlight'],
  ['golden_hour', 'golden'],
  ['sunset', 'golden'],
  ['cyberpunk', 'cyber'],
  ['synthwave', 'cyber'],
  ['vaporwave', 'cyber'],
  ['polaroid', 'polaroid'],
  ['70s', 'seventies'],
  ['seventies', 'seventies'],
  ['1970s', 'seventies'],
  ['retro', 'seventies'],
  ['vintage', 'seventies'],
  ['cross_process', 'crossprocess'],
  ['lomo', 'lomo'],
  ['lomography', 'lomo'],
  ['faded film', 'faded'],
  ['tintype', 'tintype'],
  ['antique', 'tintype'],
  ['1800s', 'tintype'],
  ['victorian', 'tintype'],
  ['color_splash', 'splash'],
  ['neon', 'neon'],
  ['pastel', 'pastel'],
  ['psychedelic', 'psych'],
  ['trippy', 'psych'],
  ['pop_art', 'popart'],
  ['warhol', 'popart'],
  ['posterize', 'posterize'],
  ['posterized', 'posterize'],
  ['poster', 'posterize'],
  ['halftone', 'halftone'],
  ['newspaper', 'halftone'],
  ['comic', 'cartoon'],
  ['8bit', 'pixel'],
  ['pixelate', 'pixel'],
  ['pixelated', 'pixel'],
  ['pixel', 'pixel'],
  ['pixels', 'pixel'],
  ['sketch', 'sketch'],
  ['pencil', 'sketch'],
  ['drawing', 'sketch'],
  ['duotone', 'duotone'],
  ['oil_painting', 'oil'],
  ['painting', 'oil'],
  ['painterly', 'oil'],
  ['emboss', 'emboss'],
  ['embossed', 'emboss'],
  ['neon_edges', 'edges'],
  ['outline', 'edges'],
  ['outlines', 'edges'],
  ['thermal', 'thermal'],
  ['predator', 'thermal'],
  ['glitch', 'glitch'],
  ['glitchy', 'glitch'],
  ['vhs', 'glitch'],
  ['cartoon', 'cartoon'],
  ['anime', 'cartoon'],
  ['tiltshift', 'tiltshift'],
  ['miniature', 'tiltshift'],
  ['chromatic', 'chroma'],
  ['aberration', 'chroma'],
  ['negative', 'negative'],
  ['invert', 'negative'],
  ['inverted', 'negative']
];
var FRE = FALIAS.slice().sort(function(a, b) {
  return b[0].length - a[0].length
}).map(function(a) {
  return [new RegExp('(^|\\s)' + a[0] + '(\\s|$)'), a[1], a[0]]
});
var ATTR = {
  brighter: ['brightness', 1],
  brighten: ['brightness', 1],
  bright: ['brightness', 1],
  lighter: ['brightness', 1],
  lighten: ['brightness', 1],
  brightness: ['brightness', 0],
  lightness: ['brightness', 0],
  darker: ['brightness', -1],
  darken: ['brightness', -1],
  dark: ['brightness', -1],
  dim: ['brightness', -1],
  dimmer: ['brightness', -1],
  exposure: ['exposure', 0],
  overexposed: ['exposure', -1],
  underexposed: ['exposure', 1],
  contrast: ['contrast', 0],
  contrasty: ['contrast', 1],
  punchy: ['contrast', 1],
  punchier: ['contrast', 1],
  flat: ['contrast', -1],
  flatter: ['contrast', -1],
  saturation: ['saturation', 0],
  saturated: ['saturation', 1],
  saturate: ['saturation', 1],
  colorful: ['saturation', 1],
  colourful: ['saturation', 1],
  richer: ['saturation', 1],
  colors: ['saturation', 0],
  colours: ['saturation', 0],
  color: ['saturation', 0],
  colour: ['saturation', 0],
  muted: ['saturation', -1],
  desaturate: ['saturation', -1],
  desaturated: ['saturation', -1],
  dull: ['saturation', -1],
  duller: ['saturation', -1],
  washed: ['saturation', -1],
  vibrance: ['vibrance', 0],
  vibrant: ['vibrance', 1],
  vivid: ['vibrance', 1],
  pop: ['vibrance', 1],
  poppy: ['vibrance', 1],
  popping: ['vibrance', 1],
  warmer: ['warmth', 1],
  warm: ['warmth', 1],
  warmth: ['warmth', 0],
  orange: ['warmth', 1],
  yellow: ['warmth', 1],
  yellower: ['warmth', 1],
  red: ['warmth', 1],
  redder: ['warmth', 1],
  cooler: ['warmth', -1],
  cool: ['warmth', -1],
  colder: ['warmth', -1],
  cold: ['warmth', -1],
  blue: ['warmth', -1],
  bluer: ['warmth', -1],
  blueish: ['warmth', -1],
  bluish: ['warmth', -1],
  icy: ['warmth', -1],
  temperature: ['warmth', 0],
  green: ['tint', -1],
  greener: ['tint', -1],
  greenish: ['tint', -1],
  magenta: ['tint', 1],
  pink: ['tint', 1],
  pinker: ['tint', 1],
  purple: ['tint', 1],
  tint: ['tint', 0],
  clarity: ['clarity', 0],
  crisp: ['clarity', 1],
  crisper: ['clarity', 1],
  detail: ['clarity', 1],
  details: ['clarity', 1],
  texture: ['clarity', 1],
  defined: ['clarity', 1],
  sharp: ['sharpen', 1],
  sharper: ['sharpen', 1],
  sharpen: ['sharpen', 1],
  sharpness: ['sharpen', 0],
  focus: ['sharpen', 1],
  blurry: ['sharpen', -1],
  blurrier: ['sharpen', -1],
  blur: ['sharpen', -1],
  soft: ['clarity', -1],
  softer: ['clarity', -1],
  smooth: ['clarity', -1],
  smoother: ['clarity', -1],
  vignette: ['vignette', 0],
  vignetting: ['vignette', 0],
  grain: ['grain', 0],
  grainy: ['grain', 1],
  film_grain: ['grain', 0],
  grit: ['grain', 0],
  fade: ['fade', 0],
  faded: ['fade', 1],
  matte: ['fade', 1],
  glow: ['glow', 0],
  glowy: ['glow', 1],
  glowing: ['glow', 1],
  bloom: ['glow', 0],
  haze: ['glow', 0],
  hazy: ['glow', 1]
};
var TARGETS = {
  sky: 'blue',
  skies: 'blue',
  water: 'aqua',
  ocean: 'aqua',
  sea: 'aqua',
  lake: 'aqua',
  river: 'aqua',
  pool: 'aqua',
  grass: 'green',
  trees: 'green',
  tree: 'green',
  foliage: 'green',
  leaves: 'green',
  plants: 'green',
  greenery: 'green',
  greens: 'green',
  forest: 'green',
  nature: 'green',
  sunset: 'orange',
  oranges: 'orange',
  reds: 'red',
  yellows: 'yellow',
  blues: 'blue',
  purples: 'purple',
  flowers: 'magenta',
  lips: 'red',
  sand: 'yellow',
  beach: 'yellow',
  mountains: 'purple'
};
var BANDWORD = {
  blue: ['blue', 'bluer', 'blueish', 'bluish'],
  aqua: ['blue', 'bluer', 'blueish', 'bluish'],
  green: ['green', 'greener', 'greenish'],
  orange: ['orange', 'warmer', 'warm'],
  red: ['red', 'redder'],
  yellow: ['yellow', 'yellower'],
  purple: ['purple'],
  magenta: ['pink', 'pinker', 'magenta']
};
var LOOKS = {
  moody: ['Moody', {
    exposure: -8,
    contrast: 18,
    shadows: -15,
    highlights: -15,
    saturation: -22,
    warmth: -8,
    vignette: 30
  }],
  dreamy: ['Dreamy', {
    glow: 40,
    fade: 18,
    contrast: -12,
    warmth: 10,
    clarity: -20,
    brightness: 8
  }],
  dramatic: ['Dramatic', {
    contrast: 30,
    clarity: 40,
    vignette: 30,
    highlights: -25,
    shadows: -10,
    saturation: -10
  }],
  dramatic_hdr: ['HDR', {
    highlights: -50,
    shadows: 50,
    clarity: 55,
    vibrance: 25
  }],
  epic: 'dramatic',
  airy: ['Bright & airy', {
    brightness: 18,
    shadows: 25,
    contrast: -12,
    saturation: -12,
    exposure: 8
  }],
  sunny: ['Sunny', {
    warmth: 22,
    brightness: 10,
    vibrance: 20
  }],
  summery: 'sunny',
  summer: 'sunny',
  wintry: ['Wintry', {
    warmth: -28,
    saturation: -15,
    brightness: 6
  }],
  winter: 'wintry',
  spooky: ['Spooky', {
    saturation: -45,
    tint: -12,
    contrast: 22,
    vignette: 40,
    brightness: -12
  }],
  creepy: 'spooky',
  horror: 'spooky',
  eerie: 'spooky',
  haunted: 'spooky',
  scary: 'spooky',
  romantic: ['Romantic', {
    warmth: 12,
    tint: 10,
    glow: 25,
    clarity: -10
  }],
  gritty: ['Gritty', {
    clarity: 45,
    saturation: -25,
    grain: 30,
    contrast: 18
  }],
  cozy: ['Cozy', {
    warmth: 25,
    glow: 18,
    fade: 10,
    vignette: 15
  }],
  cosy: 'cozy',
  happy: ['Cheerful', {
    brightness: 14,
    vibrance: 30,
    warmth: 10
  }],
  cheerful: 'happy',
  gloomy: ['Gloomy', {
    saturation: -30,
    warmth: -15,
    brightness: -12,
    contrast: -5
  }],
  sad: 'gloomy',
  melancholy: 'gloomy',
  autumn: ['Autumn', {
    warmth: 20,
    hsl: {
      orange: {
        s: 35
      },
      yellow: {
        s: 20,
        h: -15
      },
      green: {
        h: -30,
        s: -15
      }
    }
  }],
  fall: 'autumn',
  autumnal: 'autumn',
  spring: ['Spring', {
    brightness: 10,
    vibrance: 15,
    hsl: {
      green: {
        s: 30,
        l: 8
      },
      magenta: {
        s: 20
      }
    }
  }],
  clean: ['Clean', {
    clarity: 12,
    vibrance: 10,
    contrast: 6
  }],
  fresh: 'clean',
  nostalgic: ['Nostalgic', {
    fade: 22,
    warmth: 14,
    saturation: -15,
    grain: 18
  }],
  ethereal: 'dreamy',
  intense: 'dramatic'
};
var SOFT = {
  slightly: 1,
  slight: 1,
  subtle: 1,
  subtly: 1,
  touch: 1,
  atouch: 1,
  abit: 1,
  alittle: 1,
  bit: 1,
  little: 1,
  tiny: 1,
  somewhat: 1,
  mildly: 1,
  mild: 1,
  gently: 1,
  gentle: 1,
  hint: 1,
  tad: 1,
  smidge: 1,
  barely: 1,
  lightly: 1
};
var HARD = {
  much: 1,
  alot: 1,
  very: 1,
  really: 1,
  way: 1,
  super: 1,
  extremely: 1,
  heavily: 1,
  dramatically: 1,
  significantly: 1,
  strong: 1,
  strongly: 1,
  intensely: 1,
  massively: 1,
  seriously: 1,
  hugely: 1,
  crazy: 1,
  insanely: 1,
  totally: 1,
  heavy: 1,
  big: 1,
  hard: 1,
  bold: 1,
  boldly: 1,
  tons: 1,
  majorly: 1,
  lots: 1,
  noticeably: 1,
  way_more: 1
};
var MAXW = {
  max: 1,
  maximum: 1,
  fully: 1,
  completely: 1,
  extreme: 1
};
var DOWNW = {
  less: 1,
  reduce: 1,
  decrease: 1,
  lower: 1,
  lessen: 1,
  fewer: 1,
  remove: 1,
  no: 1,
  without: 1,
  weaker: 1,
  cut: 1,
  drop: 1,
  kill: 1,
  minimize: 1,
  minimise: 1,
  zero: 1,
  off: 1,
  eliminate: 1,
  reduced: 1,
  decreased: 1,
  subtract: 1
};
var REMOVEW = {
  remove: 1,
  no: 1,
  without: 1,
  zero: 1,
  off: 1,
  eliminate: 1,
  kill: 1
};
var FILLER = {
  make: 1,
  it: 1,
  the: 1,
  a: 1,
  an: 1,
  photo: 1,
  image: 1,
  picture: 1,
  pic: 1,
  this: 1,
  that: 1,
  look: 1,
  looks: 1,
  like: 1,
  please: 1,
  can: 1,
  you: 1,
  could: 1,
  i: 1,
  want: 1,
  would: 1,
  to: 1,
  be: 1,
  more: 1,
  some: 1,
  of: 1,
  just: 1,
  its: 1,
  "it's": 1,
  kind: 1,
  sort: 1,
  also: 1,
  my: 1,
  me: 1,
  so: 1,
  really: 1,
  very: 1,
  feel: 1,
  vibe: 1,
  give: 1,
  add: 1,
  apply: 1,
  use: 1,
  in: 1,
  on: 1,
  for: 1,
  is: 1,
  effect: 1,
  filter: 1,
  style: 1,
  maybe: 1,
  bit: 1,
  abit: 1,
  slightly: 1,
  little: 1,
  alittle: 1,
  now: 1,
  again: 1,
  too: 1,
  overall: 1,
  whole: 1,
  thing: 1,
  little_bit: 1,
  then: 1,
  and: 1,
  look_like: 1,
  into: 1,
  as: 1,
  version: 1,
  edit: 1,
  one: 1,
  do: 1,
  lot: 1,
  alot: 1,
  much: 1,
  try: 1,
  "let's": 1,
  lets: 1,
  we: 1,
  go: 1,
  get: 1,
  getting: 1,
  here: 1,
  there: 1,
  what: 1,
  if: 1,
  at: 1,
  by: 1,
  up: 1,
  down: 1
};

function inten(w, c) {
  var mul = 1;
  if (w.some(function(x) {
      return SOFT[x]
    })) mul = .4;
  if (w.some(function(x) {
      return HARD[x]
    })) mul = 1.8;
  if (w.some(function(x) {
      return MAXW[x]
    })) mul = 3;
  var m = c.match(/(-?\d+(?:\.\d+)?)\s*(%|percent|points?)/) || c.match(/\bby\s+(-?\d+)\b/) || c.match(/(?:^|\s)([+-]\d+)\b/);
  return {
    mul: mul,
    abs: m ? parseFloat(m[1]) : null
  }
}

function filterOf(c) {
  for (var i = 0; i < FRE.length; i++)
    if (FRE[i][0].test(' ' + c + ' ')) return {
      id: FRE[i][1],
      word: FRE[i][2]
    };
  return null
}

function cropOf(c) {
  var cropish = /\b(crop|cropped|square|aspect|ratio|format|reframe)\b/.test(c) || (/\b\d+\s*:\s*\d+\b/.test(c));
  if (!cropish) return undefined;
  if (/\b(uncrop|no crop|remove (the )?crop|original (size|ratio|aspect|crop)|full frame)\b/.test(c)) return null;
  var m = c.match(/\b(\d+(?:\.\d+)?)\s*[:x\/]\s*(\d+(?:\.\d+)?)\b/);
  if (m && +m[1] > 0 && +m[2] > 0) return m[1] + ':' + m[2];
  if (/square|profile pic|avatar/.test(c)) return '1:1';
  if (/story|stories|tiktok|reels?|vertical|phone wallpaper/.test(c)) return '9:16';
  if (/instagram|insta|ig post|portrait/.test(c)) return '4:5';
  if (/ultra ?wide|anamorphic/.test(c)) return '21:9';
  if (/widescreen|wide|youtube|thumbnail|cinematic|desktop/.test(c)) return '16:9';
  if (/landscape/.test(c)) return '3:2';
  return 'ask'
}

function unsupported(c, w) {
  var EDITV = /\b(remove|erase|delete|replace|swap|move|insert|put|place|paste|add|give|turn|change|clone|cut|photoshop|whiten|fix|draw)\b/,
    FACE = /\b(face|faces|eyes?|nose|smile|smiling|teeth|hair|makeup|lipstick|acne|pimples?|zits?|blemish(es)?|wrinkles?|freckles|beard|mustache|red[ -]eye|body|taller|shorter|thinner|skinnier|slimmer|fatter|muscles?|abs|younger|older|shirt|dress|jacket|clothes|outfit|shoes)\b/,
    OBJ = /\b(person|people|guy|girl|man|woman|men|women|kid|kids|child|boy|he|she|him|her|them|someone|somebody|dog|cat|car|cars|tree|building|object|objects|stuff|text|words?|logo|watermark|sign|birds?|power ?lines?|wires?|photobomber|tourists?|crowd|trash|hat|glasses|sunglasses|crown|dragon|unicorn|rainbow|moon|clouds?|snow|rain|fire|explosion|lens flare|cabin|house|boat|dock)\b/;
  var hasAttr = w.some(function(x) {
    return ATTR[x] || LOOKS[x]
  }) || !!filterOf(c);
  if (/\b(remove|erase|delete|cut|move|clone)\b/.test(c) && OBJ.test(c) && !hasAttr) return 'Removing or moving objects needs generative “inpainting” to invent what was behind them. That needs a big cloud AI model, and this editor runs offline. It only makes whole-photo and color-range edits.';
  if (/\b(background|backdrop|behind (him|her|them|me))\b/.test(c)) return /\b(blur|bokeh|out of focus|depth)\b/.test(c) ? 'Blurring only the background needs subject detection (a segmentation model), which isn’t available offline. Try the Tilt-Shift filter for a similar shallow-focus feel.' : 'Editing the background separately from the subject needs subject detection, which this offline editor doesn’t have.';
  if (/\b(replace|swap|change)\b.*\bsky\b|\bsky\b.*\b(replace|swap)\b|new sky|different sky/.test(c)) return 'Swapping in a new sky needs generative AI. I can recolor the sky that’s there, though: try “make the sky bluer” or “darker sky”.';
  if (FACE.test(c) && (EDITV.test(c) || /\b(make|look|more|less|bigger|smaller)\b/.test(c))) return 'Face and body retouching needs a face/body model. This editor changes light, color and texture across the photo, not individual features.';
  if (EDITV.test(c) && OBJ.test(c) && !hasAttr) return /\b(add|insert|put|place|paste|give|draw)\b/.test(c) ? 'Adding new things means generating pixels that aren’t in the photo, which needs a generative (cloud) model.' : 'Changing specific objects needs object detection plus generative fill, which isn’t possible offline.';
  return null
}

function parsePrompt(txt) {
  var t = ' ' + txt.toLowerCase().replace(/[’‘]/g, "'").replace(/[“”"]/g, ' ') + ' ';
  PROT.forEach(function(p) {
    t = t.replace(p[0], ' ' + p[1] + ' ')
  });
  var cl = t.split(/[,;!?\n]+|\.(?!\d)|\s(?:and then|after that|afterwards|afterward|finally|then|also|plus|and|but|while|with|except|&)(?=\s)/).map(function(s) {
    return s.replace(/[^a-z0-9_%:+\-.'\/ ]/g, ' ').replace(/\s+/g, ' ').trim()
  }).filter(Boolean);
  var R = {
    steps: [],
    cant: [],
    skip: [],
    natural: false
  };
  cl.forEach(function(c) {
    parseClause(c, R)
  });
  if (R.natural) R.steps.forEach(function(s) {
    if (s.k === 'adj' || s.k === 'hsl') s.v = Math.round(s.v * .65);
    else if (s.k === 'look') s.m = Math.round(s.m * 65) / 100;
    else if (s.k === 'flt') s.s = Math.round(s.s * 70) / 100
  });
  return R
}

function val(key, s, I) {
  return I.abs != null ? s * Math.min(100, Math.abs(I.abs)) : Math.max(-100, Math.min(100, Math.round(s * BASEV[key] * I.mul)))
}

function parseClause(c, R) {
  var w = c.split(' ').filter(Boolean),
    has = function(x) {
      return w.indexOf(x) >= 0
    },
    any = function(o) {
      return w.some(function(x) {
        return o[x]
      })
    },
    st = R.steps,
    n0 = st.length,
    add = function(s) {
      st.push(s)
    };
  if (!w.length) return;
  var why = unsupported(c, w);
  if (why) {
    R.cant.push({
      text: c,
      why: why
    });
    return
  }
  if (/\b(reset|start over|revert|undo everything|back to (the )?original|clear (all|everything)|remove all (the )?(edits|effects|filters))\b/.test(c)) {
    add({
      k: 'reset'
    });
    return
  }
  if (has('skin') && /\b(keep|natural|protect|preserve|leave|don'?t|realistic|normal|alone|avoid|safe|real)\b/.test(c)) {
    add({
      k: 'skin'
    });
    return
  }
  var I = inten(w, c),
    down = any(DOWNW),
    flip = has('notso') || has('too') || has('overly'),
    rem = any(REMOVEW);
  var hits = [],
    seen = {};
  w.forEach(function(x) {
    var a = ATTR[x];
    if (a && !seen[a[0]]) {
      seen[a[0]] = 1;
      hits.push({
        w: x,
        key: a[0],
        d: a[1]
      })
    }
  });
  var fo = filterOf(c),
    tgtW = w.filter(function(x) {
      return TARGETS[x]
    })[0];
  if (fo && fo.word === 'sunset' && (hits.length || tgtW === 'sunset')) {
    fo = null
  }
  if (tgtW === 'sunset' && !hits.length) tgtW = null;
  var looks = w.map(function(x) {
    var L = LOOKS[x];
    return typeof L === 'string' ? LOOKS[L] : L
  }).filter(Boolean);
  if (/\b(natural|realistic|subtle|believable|tasteful|subtly)\b/.test(c) && !hits.length && !fo && !looks.length && !tgtW || /don'?t overdo|not overdone|not too much|not over the top/.test(c)) {
    R.natural = true;
    add({
      k: 'natural'
    });
    return
  }
  if (/\b(denoise|de-noise|noise reduction)\b/.test(c) || (/\b(noise|noisy|grainy|grain)\b/.test(c) && (down || /clean/.test(c)) && !st.some(function(s) {
      return s.k === 'adj' && s.key === 'grain' && s.v > 0
    }))) {
    add({
      k: 'adj',
      key: 'denoise',
      v: I.abs != null ? Math.min(100, I.abs) : Math.min(100, Math.round(40 * I.mul))
    });
    return
  }
  if (/\b(auto[ -]?enhance|enhance|enhancer|auto[ -]?fix|autofix|improve|fix (it|this|the photo|the picture|everything|the lighting|the colou?rs|the exposure)|better|touch up|retouch|professional|auto)\b/.test(c) && !hits.length && !fo) add({
    k: 'enh',
    amt: I.mul < 1 ? .5 : I.mul > 1 ? 1 : .85
  });
  if (/\b(upscale|upscaled|upscaling|upres|up-res|super[ -]?res(olution)?|higher[ -]res(olution)?|high[ -]res(olution)?|more resolution|increase (the )?resolution|hd|4k|enlarge|bigger|larger|2x|4x|double the (size|resolution)|quadruple|resolution)\b/.test(c)) add({
    k: 'up',
    f: /\b(4x|4k|quadruple|4 times|four times)\b/.test(c) || I.mul > 1.5 ? 4 : 2
  });
  var ar = cropOf(c);
  if (ar === 'ask') R.skip.push({
    text: c,
    why: 'Crop to what shape? Try “crop to square”, “4:5”, “16:9” or “story”.'
  });
  else if (ar !== undefined) add({
    k: 'crop',
    ar: ar
  });
  if (/\b(flip|flipped|mirror|mirrored)\b/.test(c)) add({
    k: 'flip',
    ax: /vertical|upside|top/.test(c) ? 'fv' : 'fh'
  });
  else if (/\b(rotate|rotated|rotation)\b|upside down|turn (it )?(90|sideways|left|right)/.test(c)) add({
    k: 'rot',
    deg: /upside down|180/.test(c) ? 180 : /\b(left|counter|anti|ccw|counterclockwise|anticlockwise)/.test(c) ? -90 : 90
  });
  looks.forEach(function(L) {
    add({
      k: 'look',
      name: L[0],
      vals: L[1],
      m: (down ? -1 : 1) * (I.mul < 1 ? .5 : I.mul > 1 ? 1.5 : 1)
    })
  });
  if (fo) {
    if (down) {
      var pf = st.slice().reverse().filter(function(s) {
        return s.k === 'flt'
      })[0];
      if (pf) pf.s = Math.max(0, pf.s - .3)
    } else add({
      k: 'flt',
      id: fo.id,
      s: I.abs != null ? Math.max(0, Math.min(1, I.abs / 100)) : I.mul < 1 ? .45 : I.mul > 1 ? 1 : .85
    })
  }
  var toneW = w.filter(function(x) {
    return /^(shadows?|highlights?|blacks|whites|lows|highs|midtones)$/.test(x)
  })[0];
  if (toneW) {
    var key = /high|white/.test(toneW) ? 'highlights' : 'shadows',
      s;
    if (key === 'highlights') s = any({
      recover: 1,
      tame: 1,
      save: 1,
      blown: 1,
      reduce: 1,
      less: 1,
      lower: 1,
      darker: 1,
      darken: 1,
      dim: 1,
      control: 1,
      notso: 1,
      too: 1,
      soften: 1,
      down: 1,
      rescue: 1,
      fix: 1
    }) ? -1 : 1;
    else if (toneW === 'blacks') s = any({
      lift: 1,
      lifted: 1,
      raise: 1,
      lighter: 1,
      brighter: 1,
      faded: 1,
      milky: 1,
      increase: 1,
      open: 1
    }) ? 1 : -1;
    else s = any({
      crush: 1,
      crushed: 1,
      deepen: 1,
      deeper: 1,
      darken: 1,
      darker: 1,
      lower: 1,
      reduce: 1,
      less: 1,
      richer: 1,
      down: 1,
      notso: 1,
      dark: 1
    }) && !any({
      lift: 1,
      open: 1,
      brighten: 1,
      recover: 1,
      too: 1
    }) ? -1 : 1;
    if (toneW === 'midtones') {
      key = 'brightness';
      s = any({
        darker: 1,
        darken: 1,
        lower: 1,
        reduce: 1,
        less: 1
      }) ? -1 : 1
    }
    add({
      k: 'adj',
      key: key,
      v: val(key, s, I)
    });
    hits = hits.filter(function(h) {
      return ['brightness', 'exposure', 'contrast'].indexOf(h.key) < 0
    })
  }
  if (tgtW && !toneW) {
    var band = TARGETS[tgtW],
      made = false;
    hits.forEach(function(h) {
      var prop, sg;
      if (h.key === 'brightness' || h.key === 'exposure') {
        prop = 'l';
        sg = h.d || (down ? -1 : 1);
        if (h.d && (down || flip)) sg = -h.d
      } else if ((h.key === 'warmth' || h.key === 'tint') && BANDWORD[band] && BANDWORD[band].indexOf(h.w) < 0) {
        prop = 'h';
        sg = (h.d || 1) * (down || flip ? -1 : 1) * (h.key === 'warmth' ? -1 : 1)
      } else {
        prop = 's';
        sg = (BANDWORD[band] && BANDWORD[band].indexOf(h.w) >= 0) ? 1 : (h.d || 1);
        if (down || flip) sg = -sg
      }
      add({
        k: 'hsl',
        band: band,
        prop: prop,
        v: I.abs != null ? sg * Math.min(100, Math.abs(I.abs)) : Math.max(-100, Math.min(100, Math.round(sg * (prop === 'h' ? 25 : 32) * I.mul))),
        tw: tgtW
      });
      made = true
    });
    if (!made) add({
      k: 'hsl',
      band: band,
      prop: 's',
      v: Math.round((down ? -1 : 1) * 32 * I.mul),
      tw: tgtW
    });
    hits = []
  }
  if (has('nottoo') && hits.length) {
    var h0 = hits[0],
      dir = h0.d || 1,
      rel = {
        brightness: ['brightness', 'exposure', 'shadows'],
        exposure: ['brightness', 'exposure', 'shadows'],
        saturation: ['saturation', 'vibrance'],
        vibrance: ['saturation', 'vibrance'],
        warmth: ['warmth'],
        contrast: ['contrast', 'clarity'],
        clarity: ['clarity', 'contrast']
      } [h0.key] || [h0.key],
      capped = false;
    st.forEach(function(s) {
      if (s.k === 'adj' && rel.indexOf(s.key) >= 0 && s.v * dir > 0) {
        s.v = Math.round(s.v / 2);
        s.cap = true;
        capped = true
      }
      if (s.k === 'look') {
        var nv = clone(s.vals),
          ch = false;
        rel.forEach(function(k) {
          if (nv[k] && nv[k] * dir * s.m > 0) {
            nv[k] = Math.round(nv[k] / 2);
            ch = true
          }
        });
        if (ch) {
          s.vals = nv;
          s.cap = true;
          capped = true
        }
      }
      if (s.k === 'flt' && (h0.key === 'brightness' && dir < 0 && /noir|moonlight|lomo/.test(s.id))) {
        s.s = Math.round(s.s * 60) / 100;
        s.cap = true;
        capped = true
      }
    });
    if (!capped) add({
      k: 'adj',
      key: h0.key,
      v: -dir * Math.round(BASEV[h0.key] * .4),
      guard: true
    });
    return
  }
  hits.forEach(function(h) {
    if (rem && h.d === 0) {
      add({
        k: 'set',
        key: h.key
      });
      return
    }
    var sg = h.d === 0 ? (down ? -1 : 1) : (down || flip ? -h.d : h.d);
    add({
      k: 'adj',
      key: h.key,
      v: val(h.key, sg, I)
    })
  });
  if (st.length === n0 && /\b(more|again|stronger|further|even|less|weaker|subtler|intensify|boost|increase|reduce|double)\b/.test(c)) {
    var prev = st.slice().reverse().filter(function(s) {
        return /^(adj|flt|look|hsl)$/.test(s.k)
      })[0],
      neg = /\b(less|weaker|subtler|reduce)\b/.test(c);
    if (prev) {
      if (prev.k === 'adj') add({
        k: 'adj',
        key: prev.key,
        v: (neg ? -1 : 1) * Math.sign(prev.v || 1) * Math.max(5, Math.round(Math.abs(prev.v) * .6 * I.mul))
      });
      else if (prev.k === 'hsl') add({
        k: 'hsl',
        band: prev.band,
        prop: prev.prop,
        tw: prev.tw,
        v: (neg ? -1 : 1) * Math.sign(prev.v || 1) * Math.max(5, Math.round(Math.abs(prev.v) * .6 * I.mul))
      });
      else if (prev.k === 'flt') {
        prev.s = Math.max(0, Math.min(1, prev.s + (neg ? -.25 : .2)));
        prev.cap = true
      } else prev.m = Math.round(prev.m * (neg ? .6 : 1.4) * 100) / 100;
      return
    }
  }
  if (st.length === n0 && !(ar === 'ask')) {
    var meaningful = w.filter(function(x) {
      return !FILLER[x] && !/^\d+$/.test(x)
    });
    if (meaningful.length) R.skip.push({
      text: c,
      why: 'I don’t know how to do that yet. Try words like brighter, warmer, more contrast, film look, noir, crop to square.'
    })
  }
}

function applySteps(S0, steps) {
  var st = clone(S0),
    afterF = false;

  function tgt() {
    if (!afterF) return st.layers[0].v;
    var L = st.layers[st.layers.length - 1];
    if (L.t !== 'adj') {
      L = {
        t: 'adj',
        v: {}
      };
      st.layers.push(L)
    }
    return L.v
  }

  function addv(v, k, x) {
    v[k] = Math.max(NONNEG[k] ? 0 : -100, Math.min(100, Math.round((v[k] || 0) + x)))
  }

  function addh(v, b, p, x) {
    v.hsl = v.hsl || {};
    v.hsl[b] = v.hsl[b] || {};
    v.hsl[b][p] = Math.max(-100, Math.min(100, Math.round((v.hsl[b][p] || 0) + x)))
  }
  steps.forEach(function(s) {
    var v;
    switch (s.k) {
      case 'adj':
        addv(tgt(), s.key, s.v);
        break;
      case 'set':
        v = tgt();
        v[s.key] = 0;
        if (afterF) st.layers[0].v[s.key] = 0;
        break;
      case 'look':
        v = tgt();
        Object.keys(s.vals).forEach(function(k) {
          if (k === 'hsl') Object.keys(s.vals.hsl).forEach(function(b) {
            Object.keys(s.vals.hsl[b]).forEach(function(p) {
              addh(v, b, p, s.vals.hsl[b][p] * s.m)
            })
          });
          else addv(v, k, s.vals[k] * s.m)
        });
        break;
      case 'hsl':
        addh(tgt(), s.band, s.prop, s.v);
        break;
      case 'flt':
        st.layers.push({
          t: 'flt',
          id: s.id,
          s: s.s
        });
        afterF = true;
        break;
      case 'crop':
        st.geo.crop = s.ar;
        st.geo.rect = null;
        st.geo.lock = undefined;
        break;
      case 'rot':
        st.geo.rot = ((st.geo.rot + s.deg) % 360 + 360) % 360;
        st.geo.rect = null;
        break;
      case 'flip':
        st.geo[s.ax] = !st.geo[s.ax];
        break;
      case 'enh':
        if (work) {
          st.enh = analyzeFor(st);
          st.enh.amt = s.amt
        }
        break;
      case 'up':
        st.up.f = s.f;
        st.up.on = true;
        break;
      case 'skin':
        st.skin = true;
        break;
      // Steps below come from the Claude editor: absolute values rather than nudges.
      case 'setv':
        v = tgt();
        if (s.v) v[s.key] = Math.max(NONNEG[s.key] ? 0 : -100, Math.min(100, Math.round(s.v)));
        else delete v[s.key];
        break;
      case 'hslset':
        v = tgt();
        v.hsl = v.hsl || {};
        var hv = {};
        ['h', 's', 'l'].forEach(function(p) {
          if (s[p]) hv[p] = Math.max(-100, Math.min(100, Math.round(s[p])))
        });
        if (Object.keys(hv).length) v.hsl[s.band] = hv;
        else delete v.hsl[s.band];
        break;
      case 'curve':
        v = tgt();
        v.curve = v.curve || {};
        v.curve[s.ch] = s.pts;
        break;
      case 'cropbox':
        st.geo.rect = srcRectToFrame(s.rect, st.geo);
        st.geo.crop = null;
        st.geo.lock = 'free';
        break;
      case 'straighten':
        st.geo.ang = Math.max(-45, Math.min(45, s.deg));
        break;
      case 'mask':
        st.masks = (st.masks || []).concat([clone(s.mk)]);
        break;
      case 'reset':
        st.masks = [];
        var up = st.up;
        var f = fresh();
        st.geo = f.geo;
        st.enh = null;
        st.layers = f.layers;
        st.skin = false;
        st.up = up;
        st.up.on = false;
        afterF = false;
        break
    }
  });
  return st
}
