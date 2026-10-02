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
  [/sun\s*set/g, 'sunset'],
  [/instant\s+(film|camera|photo)/g, 'polaroid'],
  [/(make|made)\s+(it|this|the\s+(photo|image|picture|pic))\s+(look\s+)?(like\s+)?/g, 'make '],
  [/\bhdr\b/g, 'dramatic_hdr'],
  // Harder phrasings: problems to fix, comparisons, split toning.
  [/split[\s-]*ton(?:e|ed|ing)?(?:\s+it)?(?:\s+with)?\s+([a-z]+)\s*(?:and|&|\/|with|to)\s*([a-z]+)/g, 'splittone_$1_$2'],
  [/\b(?:remove|reduce|cut(?:\s+through)?|fix|clear(?:\s+up)?|less|lose|lift)\s+(?:the\s+)?(?:haze|haziness|fog|mist)\b|\bde-?haze\b|\bmuddy\b|\bmurky\b/g, 'dehaze'],
  [/\bblown[\s-]*out\b|\boverblown\b|\bblown\b|\bclipped\b/g, 'blownout'],
  [/\b(?:colou?rs?|white\s+balance|wb|tones?|skin)\s+(?:are|is|look|looks|seem|seems)\s+(?:a\s+bit\s+|kind\s+of\s+|really\s+|so\s+)?(?:off|wrong|weird|strange|funny|bad|unnatural)\b|\b(?:fix|correct|neutrali[sz]e|remove)\s+(?:the\s+)?(?:white\s+balance|colou?r\s+cast|cast|wb)\b|\bwhite\s+balance\b|\bcolou?r\s+cast\b/g, 'fixcolor'],
  [/\bas\s+([a-z]+)\s+as\s+(?:possible|it\s+(?:can|will)\s+go|you\s+can)\b/g, '$1 max'],
  [/\btwice\s+as\b|\btwo\s+times\b|\b2\s*times\b/g, 'twice'],
  [/\bhalf\s+as\b|\bby\s+half\b|\bin\s+half\b|\bhalve\b/g, 'halve'],
  [/\bblue\s+hour\b/g, 'bluehour'],
  [/\bcloudy\s+day\b/g, 'overcast'],
  // "deepen the shadows with a blue tint" stays one clause.
  [/\s+with\s+an?\s+([a-z]+)\s+(?:tint|cast|tone|wash|hue)\b/g, '$1']
];
// Every phrase above must match whole words: "expired filter" is not "red filter".
PROT = PROT.map(function(p) {
  return [new RegExp('\\b(?:' + p[0].source + ')\\b', 'g'), p[1]]
});

// Where in the frame a filter goes: "bottom right and top left corners", "around the edges".
var POSW = {
  tl: 'top-left corner',
  tr: 'top-right corner',
  bl: 'bottom-left corner',
  br: 'bottom-right corner',
  t: 'top',
  b: 'bottom',
  l: 'left side',
  r: 'right side',
  c: 'center',
  edges: 'edges'
};

function posTokens(t) {
  t = t.replace(/\b(?:top|upper)[\s-]*left(?:[\s-]+(?:hand\s+)?corners?)?\b/g, ' pos_tl ')
    .replace(/\b(?:top|upper)[\s-]*right(?:[\s-]+(?:hand\s+)?corners?)?\b/g, ' pos_tr ')
    .replace(/\b(?:bottom|lower)[\s-]*left(?:[\s-]+(?:hand\s+)?corners?)?\b/g, ' pos_bl ')
    .replace(/\b(?:bottom|lower)[\s-]*right(?:[\s-]+(?:hand\s+)?corners?)?\b/g, ' pos_br ')
    .replace(/\b(?:(?:all|the|four|4)\s+)*corners\b/g, ' pos_tl pos_tr pos_bl pos_br ')
    .replace(/\b(?:the\s+)?(?:top|upper)\s+(?:half|edge|part|third|area)\b|\b(?:at|along|on|across)\s+the\s+top\b(?!\s+of)/g, ' pos_t ')
    .replace(/\b(?:the\s+)?(?:bottom|lower)\s+(?:half|edge|part|third|area)\b|\b(?:at|along|on|across)\s+the\s+bottom\b(?!\s+of)/g, ' pos_b ')
    .replace(/\b(?:the\s+)?left\s+(?:side|half|edge|part)\b/g, ' pos_l ')
    .replace(/\b(?:the\s+)?right\s+(?:side|half|edge|part)\b/g, ' pos_r ')
    .replace(/\b(?:in|on|at)\s+the\s+(?:center|centre|middle)\b/g, ' pos_c ')
    .replace(/\b(?:around|along|on|at)\s+the\s+(?:edges|borders?|sides|outside)\b/g, ' pos_edges ');
  // "pos_br and pos_tl" -> one token, so the clause splitter keeps them together.
  var re = /\bpos_([a-z_]+)(?:\s*(?:,|and|&|plus|\+)\s*|\s+)(?:the\s+)?pos_([a-z_]+)/;
  while (re.test(t)) t = t.replace(re, 'pos_$1_$2');
  return t
}

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
  ['glitching', 'glitch'],
  ['glitched', 'glitch'],
  ['glitches', 'glitch'],
  ['expired', 'expired'],
  ['vhs', 'vhs'],
  ['camcorder', 'vhs'],
  ['home video', 'vhs'],
  ['videotape', 'vhs'],
  ['kodak gold', 'gold200'],
  ['gold 200', 'gold200'],
  ['80s', 'gold200'],
  ['1980s', 'gold200'],
  ['eighties', 'gold200'],
  ['superia', 'superia'],
  ['fujicolor', 'superia'],
  ['ektachrome', 'ektachrome'],
  ['slide film', 'ektachrome'],
  ['aerochrome', 'aerochrome'],
  ['color infrared', 'aerochrome'],
  ['colour infrared', 'aerochrome'],
  ['disposable', 'disposable'],
  ['throwaway camera', 'disposable'],
  ['date stamp', 'disposable'],
  ['90s', 'disposable'],
  ['1990s', 'disposable'],
  ['nineties', 'disposable'],
  ['instax', 'instax'],
  ['tri-x', 'trix'],
  ['trix', 'trix'],
  ['tri x', 'trix'],
  ['street photography', 'trix'],
  ['high key', 'highkey'],
  ['high-key', 'highkey'],
  ['highkey', 'highkey'],
  ['low key', 'lowkey'],
  ['low-key', 'lowkey'],
  ['lowkey', 'lowkey'],
  ['chiaroscuro', 'lowkey'],
  ['orthochromatic', 'ortho'],
  ['ortho', 'ortho'],
  ['1920s', 'ortho'],
  ['20s', 'ortho'],
  ['twenties', 'ortho'],
  ['silent film', 'ortho'],
  ['silent movie', 'ortho'],
  ['daguerreotype', 'daguerreotype'],
  ['1850s', 'daguerreotype'],
  ['desert', 'desert'],
  ['dune', 'desert'],
  ['mad max', 'desert'],
  ['wes anderson', 'storybook'],
  ['storybook', 'storybook'],
  ['whimsical', 'storybook'],
  ['fairy tale', 'storybook'],
  ['fairytale', 'storybook'],
  ['thriller', 'thriller'],
  ['fincher', 'thriller'],
  ['crime', 'thriller'],
  ['western', 'western'],
  ['cowboy', 'western'],
  ['wild west', 'western'],
  ['neon noir', 'neonnoir'],
  ['john wick', 'neonnoir'],
  ['nightclub', 'neonnoir'],
  ['arctic', 'arctic'],
  ['nordic', 'arctic'],
  ['scandinavian', 'arctic'],
  ['icelandic', 'arctic'],
  ['frozen', 'arctic'],
  ['autochrome', 'autochrome'],
  ['1900s', 'autochrome'],
  ['1910s', 'autochrome'],
  ['edwardian', 'autochrome'],
  ['technicolor', 'technicolor'],
  ['1950s', 'technicolor'],
  ['50s', 'technicolor'],
  ['fifties', 'technicolor'],
  ['y2k', 'digicam'],
  ['2000s', 'digicam'],
  ['digicam', 'digicam'],
  ['digital camera', 'digicam'],
  ['early digital', 'digicam'],
  ['point and shoot', 'digicam'],
  ['sun bleached', 'sunbleached'],
  ['sun-bleached', 'sunbleached'],
  ['sunbleached', 'sunbleached'],
  ['bleached', 'sunbleached'],
  ['cotton candy', 'cottoncandy'],
  ['candy', 'cottoncandy'],
  ['tropical', 'tropical'],
  ['tropics', 'tropical'],
  ['caribbean', 'tropical'],
  ['orton', 'orton'],
  ['watercolor', 'watercolor'],
  ['watercolour', 'watercolor'],
  ['watercolors', 'watercolor'],
  ['watercolours', 'watercolor'],
  ['crosshatch', 'crosshatch'],
  ['cross hatch', 'crosshatch'],
  ['cross-hatch', 'crosshatch'],
  ['hatching', 'crosshatch'],
  ['ink drawing', 'crosshatch'],
  ['engraving', 'crosshatch'],
  ['etching', 'crosshatch'],
  ['risograph', 'risograph'],
  ['riso', 'risograph'],
  ['screen print', 'risograph'],
  ['screenprint', 'risograph'],
  ['zoom burst', 'zoom'],
  ['zoom blur', 'zoom'],
  ['radial blur', 'zoom'],
  ['warp speed', 'zoom'],
  ['kaleidoscope', 'kaleidoscope'],
  ['kaleidoscopic', 'kaleidoscope'],
  ['mandala', 'kaleidoscope'],
  ['moonlit', 'moonlight'],
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
  hazy: ['glow', 1],
  luminous: ['brightness', 1],
  radiant: ['brightness', 1],
  illuminate: ['brightness', 1],
  brightened: ['brightness', 1],
  darkened: ['brightness', -1],
  gloomier: ['brightness', -1],
  vibrancy: ['vibrance', 0],
  intensity: ['saturation', 0],
  punch: ['contrast', 0],
  depth: ['clarity', 0],
  structure: ['clarity', 0],
  definition: ['clarity', 0],
  crispness: ['clarity', 0],
  sharpened: ['sharpen', 1],
  softened: ['clarity', -1],
  teal: ['warmth', -1],
  cyan: ['warmth', -1],
  golden: ['warmth', 1],
  amber: ['warmth', 1],
  toasty: ['warmth', 1],
  warmed: ['warmth', 1],
  chilly: ['warmth', -1],
  frosty: ['warmth', -1],
  cooled: ['warmth', -1],
  reddish: ['warmth', 1],
  orangey: ['warmth', 1],
  yellowish: ['warmth', 1],
  pinkish: ['tint', 1],
  purplish: ['tint', 1],
  grainier: ['grain', 1],
  vignetted: ['vignette', 1]
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
  mountains: 'purple',
  desert: 'orange',
  lawn: 'green',
  field: 'green',
  fields: 'green',
  hills: 'green',
  jungle: 'green',
  bushes: 'green',
  leaf: 'green'
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
  intense: 'dramatic',
  moodier: 'moody',
  dreamier: 'dreamy',
  happier: 'happy',
  uplifting: 'happy',
  hopeful: 'happy',
  nostalgia: 'nostalgic',
  sunlit: 'sunny',
  dehaze: ['Dehaze', {
    contrast: 18,
    clarity: 35,
    saturation: 10,
    shadows: -8,
    highlights: -10
  }],
  foggy: ['Foggy', {
    glow: 30,
    fade: 25,
    contrast: -20,
    clarity: -25,
    saturation: -15,
    brightness: 6
  }],
  misty: 'foggy',
  stormy: ['Stormy', {
    contrast: 25,
    clarity: 35,
    saturation: -30,
    warmth: -15,
    brightness: -10,
    vignette: 25,
    highlights: -30
  }],
  bluehour: ['Blue hour', {
    warmth: -25,
    tint: 8,
    brightness: -8,
    vibrance: 15,
    contrast: 8
  }],
  dusk: 'bluehour',
  twilight: 'bluehour',
  dawn: ['Sunrise', {
    warmth: 18,
    tint: 10,
    glow: 20,
    brightness: 6,
    vibrance: 12
  }],
  sunrise: 'dawn',
  overcast: ['Overcast', {
    saturation: -18,
    contrast: -10,
    warmth: -8,
    fade: 10
  }],
  rainy: ['Rainy', {
    saturation: -20,
    warmth: -12,
    contrast: 10,
    clarity: 15,
    brightness: -6
  }],
  underwater: ['Underwater', {
    warmth: -35,
    tint: -15,
    saturation: -10,
    glow: 15,
    fade: 10,
    hsl: {
      aqua: {
        s: 30
      }
    }
  }],
  elegant: ['Elegant', {
    contrast: 12,
    saturation: -15,
    warmth: 4,
    clarity: 10,
    vignette: 15,
    fade: 6
  }],
  classy: 'elegant',
  luxurious: 'elegant',
  luxury: 'elegant',
  editorial: ['Editorial', {
    contrast: 15,
    clarity: 20,
    saturation: -10,
    highlights: -10,
    sharpen: 20
  }],
  magazine: 'editorial',
  minimal: ['Minimal', {
    brightness: 12,
    saturation: -25,
    contrast: -6,
    clarity: -5
  }],
  minimalist: 'minimal',
  candlelight: ['Candlelight', {
    warmth: 40,
    glow: 25,
    brightness: -6,
    vignette: 20,
    tint: 5
  }],
  candlelit: 'candlelight',
  fireplace: 'candlelight',
  fiery: ['Fiery', {
    warmth: 35,
    saturation: 20,
    contrast: 15,
    hsl: {
      red: {
        s: 25
      },
      orange: {
        s: 30
      }
    }
  }],
  calm: ['Calm', {
    contrast: -10,
    saturation: -10,
    warmth: -5,
    glow: 12,
    clarity: -8
  }],
  serene: 'calm',
  peaceful: 'calm',
  tranquil: 'calm',
  lively: ['Lively', {
    vibrance: 30,
    contrast: 15,
    clarity: 15,
    brightness: 5
  }],
  energetic: 'lively',
  mysterious: ['Mysterious', {
    brightness: -12,
    contrast: 15,
    saturation: -20,
    vignette: 35,
    glow: 12,
    warmth: -10
  }],
  mystical: 'mysterious',
  ominous: 'spooky',
  lush: ['Lush', {
    vibrance: 20,
    clarity: 10,
    hsl: {
      green: {
        s: 35,
        l: -6
      }
    }
  }]
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
  twice: 1,
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
  subtract: 1,
  halve: 1
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
  down: 1,
  actually: 1,
  instead: 1,
  rather: 1,
  everything: 1,
  entire: 1,
  kinda: 1,
  sorta: 1,
  pretty: 1,
  shot: 1,
  though: 1,
  still: 1,
  should: 1,
  bring: 1,
  out: 1,
  looking: 1,
  twice: 1,
  halve: 1,
  max: 1
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
  // "twice as warm", "double the contrast"; "half as saturated" is a 50% cut.
  if (/\btwice\b|\b2x\b|\bdouble\b(?!\s+the\s+(size|resolution))/.test(c)) mul = 2;
  var half = w.indexOf('halve') >= 0;
  var m = c.match(/(-?\d+(?:\.\d+)?)\s*(%|percent|points?)/) || c.match(/\bby\s+(-?\d+)\b/) || c.match(/(?:^|\s)([+-]\d+)\b/);
  return {
    mul: mul,
    abs: m ? parseFloat(m[1]) : half ? 50 : null,
    half: half
  }
}

/* ---- harder prompts: spelling, problem statements, exceptions, scenes ---- */
var NUMS = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100
};

// "twenty five percent" -> "25 percent", only in front of a unit so "one" elsewhere stays a word.
function numWords(t) {
  return t.replace(/\b(?:a\s+)?(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)(?:[\s-](one|two|three|four|five|six|seven|eight|nine))?(?=\s*(?:%|percent\b|points?\b|degrees?\b))/g, function(m, a, b) {
    return String(NUMS[a] + (b ? NUMS[b] : 0))
  })
}

// Everyday words that sit one letter away from editing words and must not be "corrected".
var KNOWN = ('the and but with without from into onto over under this that these those there their where which while what when would could should will just really very much many some every everything everyone whole overall part parts little photo photos image images picture pictures shot shots edit edits editing version face faces eyes skin hair body person people child children baby family couple bride groom model light lights lighting colored colored coloring coloring tones toned toning tinted shade shades black blacks white whites gray grays grey greys brown clouds cloud glass class grass sky skies water night nights morning evening mood feeling style styled filters effect effects cropped ratio aspect rotated flipped mirror straight level horizon natural realistic keep leave touch change changes changed alone same except apart other besides instead actually rather again after before first finally since though although only even ever never always something anything nothing things thing summer season details detail print poster phone story stories reels posts feed insta instagram tiktok youtube linkedin profile avatar thumbnail banner cover header older newer modern classic movies scene scenes spots lines edges corner corners center centre middle bottom left right sides half double twice times percent point points degree degrees good better great nice pretty beautiful fine okay wrong weird strange funny ugly boring plain looking looks looked makes making wanted needs needed means please thanks thank maybe perhaps slightly somewhat totally fully close closer further farther deeper lower higher wider bigger smaller whiter bench beach sunny street table house room paper print prints shoot shots bright').split(' ');
var TYPO_V = null,
  TYPO_K = null;

function typoVocab() {
  if (TYPO_V) return;
  TYPO_V = {};
  TYPO_K = {};
  var addV = function(k) {
    if (/^[a-z]{4,}$/.test(k)) TYPO_V[k] = 1
  };
  [ATTR, LOOKS, TARGETS, SOFT, HARD, MAXW, DOWNW].forEach(function(o) {
    Object.keys(o).forEach(addV)
  });
  FALIAS.forEach(function(a) {
    a[0].split(/[\s_-]/).forEach(addV)
  });
  ('background foreground subject shadows highlights midtones brightness contrast saturation exposure vignette sharpen denoise upscale enhance square rotate straighten crooked clockwise counterclockwise natural realistic except instead actually').split(' ').forEach(addV);
  KNOWN.concat(Object.keys(FILLER)).forEach(function(k) {
    TYPO_K[k] = 1
  })
}

// Optimal string alignment distance (a swap of two letters counts as one edit), capped.
function osa(a, b, cap) {
  var n = a.length,
    m = b.length,
    D = [];
  for (var i = 0; i <= n; i++) {
    D[i] = [i];
    for (var j = 1; j <= m; j++) D[i][j] = i ? 0 : j
  }
  for (i = 1; i <= n; i++) {
    var lo = cap + 1;
    for (j = 1; j <= m; j++) {
      var c = a[i - 1] === b[j - 1] ? 0 : 1,
        v = Math.min(D[i - 1][j] + 1, D[i][j - 1] + 1, D[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, D[i - 2][j - 2] + 1);
      D[i][j] = v;
      if (v < lo) lo = v
    }
    if (lo > cap) return cap + 1
  }
  return D[n][m]
}

function fixTypos(t, R) {
  typoVocab();
  var fixed = [];
  t = t.replace(/[a-z]+/g, function(x) {
    if (x.length < 5 || TYPO_V[x] || TYPO_K[x]) return x;
    var lim = x.length >= 8 ? 2 : 1,
      best = null,
      bd = lim + 1;
    for (var k in TYPO_V) {
      if (k[0] !== x[0] || Math.abs(k.length - x.length) > lim) continue;
      var d = osa(x, k, lim);
      if (d < bd) {
        bd = d;
        best = k
      }
    }
    if (!best) return x;
    fixed.push('“' + x + '” as “' + best + '”');
    return best
  });
  if (fixed.length) R.notes.push('Read ' + fixed.slice(0, 4).join(', ') + '.');
  return t
}

// "It's too dark", "the sky looks dull": the clause describes a problem, so edit the other way.
function stateOf(c) {
  return /\b(it'?s|it is|is|are|was|looks|looking|seems?|feels?|came out|turned out|appears?)\b/.test(c) && !/\b(make|made|more|add|give|want|wanna|should|could|would|need|needs|let|lacks?|lacking|missing|enough|like|keep|leave|as|want)\b/.test(c) && !/\bnot\b/.test(c)
}

function regionOf(c, people) {
  return /\bfaces?\b/.test(c) ? 'face' : /\b(background|backdrop|behind (him|her|them|me))\b/.test(c) ? 'background' : /\b(subject|foreground|(the|my|our|his|her|their) (person|people|man|woman|guy|girl|kid|kids|child|boy|baby|dog|cat|puppy|model|bride|groom|couple|family))\b/.test(c) || people && /\b(him|her|them|me|us)\b/.test(c) ? 'subject' : null
}

// What an "except …" / "keep … as is" clause points at: skin, an AI region or a color range.
function excOf(c, w) {
  if (w.indexOf('skin') >= 0) return {
    skin: 1
  };
  var region = regionOf(c, true);
  if (region) return {
    region: region
  };
  var tg = w.filter(function(x) {
    return TARGETS[x] || COLBAND[x]
  })[0];
  return tg ? {
    band: TARGETS[tg] || COLBAND[tg],
    word: tg
  } : null
}
// Plain colour names an exception can point at ("black and white except the red").
var COLBAND = {
  red: 'red',
  orange: 'orange',
  yellow: 'yellow',
  green: 'green',
  blue: 'blue',
  aqua: 'aqua',
  teal: 'aqua',
  cyan: 'aqua',
  purple: 'purple',
  pink: 'magenta',
  magenta: 'magenta'
};
var BWF = /^(mono|noir|selenium|infrared|redfilter|trix|highkey|lowkey|ortho)$/;

var MASKKEY = function(k) {
  return k === 'brightness' ? 'exposure' : k === 'vibrance' ? 'saturation' : k
};

// Hold a color range or an AI region back from the edits made since `from`.
function applyExcept(e, R, from) {
  var st = R.steps,
    prev = st.slice(from),
    clamp = function(x) {
      return Math.max(-100, Math.min(100, Math.round(x)))
    };
  if (e.skin) {
    if (!st.some(function(s) {
        return s.k === 'skin'
      })) st.push({
      k: 'skin'
    });
    R.notes.push('Skin tones stay natural.');
    return
  }
  // Black and white except one colour: a colour splash instead of the B&W filter.
  var bw = e.band && prev.filter(function(s) {
    return s.k === 'flt' && BWF.test(s.id)
  })[0];
  if (bw) {
    var keepB = e.band === 'blue' || e.band === 'aqua' ? ['blue', 'aqua'] : [e.band],
      H = {};
    ['red', 'orange', 'yellow', 'green', 'aqua', 'blue', 'purple', 'magenta'].forEach(function(b) {
      if (keepB.indexOf(b) < 0) H[b] = {
        s: -100
      }
    });
    st.splice(st.indexOf(bw), 1);
    st.push({
      k: 'look',
      name: 'Color splash',
      scene: true,
      vals: {
        hsl: H
      },
      m: 1
    });
    R.notes.push('Made everything black and white except the ' + e.word + '.');
    return
  }
  if (e.band) {
    var hs = {},
      warm = false,
      flt = false;
    prev.forEach(function(s) {
      var vals = s.k === 'adj' ? {} : s.k === 'look' ? s.vals : null,
        m = s.k === 'look' ? s.m : 1;
      if (s.k === 'adj') vals[s.key] = s.v;
      if (s.k === 'flt') flt = true;
      if (!vals) return;
      Object.keys(vals).forEach(function(k) {
        var x = vals[k] * m;
        if (k === 'saturation' || k === 'vibrance') hs.s = (hs.s || 0) - x * (k === 'vibrance' ? .7 : 1);
        else if (k === 'brightness' || k === 'exposure') hs.l = (hs.l || 0) - x;
        else if (k === 'warmth' || k === 'tint') warm = true
      })
    });
    var made = 0;
    ['s', 'l'].forEach(function(p) {
      if (!hs[p]) return;
      st.push({
        k: 'hsl',
        band: e.band,
        prop: p,
        v: clamp(hs[p]),
        tw: e.word
      });
      made++
    });
    if (made) R.notes.push('Held the ' + e.word + ' back from the ' + (hs.s ? 'color' : 'brightness') + ' change' + (warm ? '; warmth shifts can’t skip one color range, so it still gets those' : '') + '.');
    else R.skip.push({
      text: 'except the ' + e.word,
      why: warm || flt ? 'Warmth changes and filters apply to every color, so they can’t skip the ' + e.word + '. Mention the ' + e.word + ' on its own to adjust it separately.' : 'Nothing before it changes the ' + e.word + '.'
    });
    return
  }
  var v = {},
    keep = [],
    moved = 0;
  prev.forEach(function(s) {
    if (s.k === 'adj') {
      var key = MASKKEY(s.key);
      if (key === 'sharpen' && s.v < 0) {
        v.blur = Math.min(100, Math.round(-s.v * 1.8));
        moved++;
        return
      }
      if (MASK_EDIT[key]) {
        v[key] = clamp((v[key] || 0) + s.v);
        moved++;
        return
      }
    }
    if (s.k === 'look') {
      var used = false;
      Object.keys(s.vals).forEach(function(k) {
        var kk = MASKKEY(k);
        if (!MASK_EDIT[kk]) return;
        v[kk] = clamp((v[kk] || 0) + s.vals[k] * s.m);
        used = true
      });
      if (used) {
        moved++;
        return
      }
    }
    keep.push(s)
  });
  var nm = e.region === 'face' ? 'faces' : e.region;
  if (!moved) {
    R.skip.push({
      text: 'except the ' + nm,
      why: 'Only light, color and blur edits can skip the ' + nm + '. Filters and crops cover the whole photo.'
    });
    return
  }
  st.splice(from, prev.length);
  keep.forEach(function(s) {
    st.push(s)
  });
  st.push({
    k: 'mask',
    mk: {
      type: e.region,
      name: e.region.charAt(0).toUpperCase() + e.region.slice(1),
      inv: true,
      amt: 1,
      v: v
    },
    why: 'Everything except the ' + nm + ' the AI finds'
  });
  R.notes.push('Applied ' + (moved > 1 ? 'those edits' : 'that edit') + ' everywhere except the ' + nm + '.')
}

// Related sliders, so "don't make it brighter" also blocks exposure.
var REL = {
  brightness: ['brightness', 'exposure'],
  exposure: ['brightness', 'exposure'],
  saturation: ['saturation', 'vibrance'],
  vibrance: ['saturation', 'vibrance'],
  contrast: ['contrast'],
  clarity: ['clarity'],
  sharpen: ['sharpen']
};

// "keep the sky as is", "don't touch the face", "don't make it darker", "leave the colors alone".
function protect(c, w, R, dont) {
  var e = excOf(c, w);
  if (e) {
    (R.sentExc = R.sentExc || []).push(e);
    return true
  }
  var locks = [],
    names = [],
    lk = function(keys, d, nm) {
      keys.forEach(function(x) {
        locks.push([x, d])
      });
      if (names.indexOf(nm) < 0) names.push(nm)
    };
  w.forEach(function(x) {
    var a = ATTR[x];
    if (!a) return;
    if (/^colou?rs?$/.test(x)) lk(['saturation', 'vibrance', 'warmth', 'tint', 'hsl'], 0, 'the colors');
    else {
      var d = dont ? a[1] : 0;
      lk(REL[a[0]] || [a[0]], d, (d > 0 ? 'raise ' : d < 0 ? 'lower ' : '') + LBL_P[a[0]])
    }
  });
  if (/\b(crop|cropping|framing|composition|size|aspect)\b/.test(c)) lk(['crop'], 0, 'the framing');
  if (/\bfilters?\b/.test(c)) lk(['flt'], 0, 'filters');
  if (!locks.length) return false;
  locks.forEach(function(l) {
    R.lock[l[0]] = l[1]
  });
  R.notes.push(dont ? 'Won’t ' + (names.every(function(n) {
    return /^(raise|lower) /.test(n)
  }) ? '' : 'change ') + names.join(' or ') + '.' : 'Leaves ' + names.join(' and ') + ' as ' + (names.length > 1 || /s$/.test(names[0]) ? 'they are.' : 'it is.'));
  return true
}
var LBL_P = {
  brightness: 'brightness',
  exposure: 'exposure',
  contrast: 'contrast',
  saturation: 'saturation',
  vibrance: 'vibrance',
  warmth: 'warmth',
  tint: 'tint',
  clarity: 'clarity',
  sharpen: 'sharpening',
  vignette: 'the vignette',
  grain: 'grain',
  fade: 'fade',
  glow: 'glow',
  highlights: 'highlights',
  shadows: 'shadows'
};

function applyLocks(R) {
  var L = R.lock,
    hit = function(k, v) {
      return L[k] === 0 || L[k] != null && v * L[k] > 0
    };
  if (!Object.keys(L).length) return;
  R.steps = R.steps.filter(function(s) {
    if (s.k === 'adj') return !hit(s.key, s.v);
    if (s.k === 'hsl') return L.hsl == null;
    if (s.k === 'crop' || s.k === 'straighten') return L.crop == null;
    if (s.k === 'flt') return L.flt == null;
    if (s.k === 'look') {
      var nv = clone(s.vals);
      Object.keys(nv).forEach(function(k) {
        if (k === 'hsl' ? L.hsl != null : hit(k, nv[k] * s.m)) delete nv[k]
      });
      s.vals = nv;
      return Object.keys(nv).length > 0
    }
    return true
  })
}

// Shoot-type recipes: "this is a food photo", "edit it for my LinkedIn headshot".
var SCENES = [
  [/\b(portrait|headshot|linkedin|selfie|profile (photo|pic|picture))\b/, 'Portrait', 'lifted shadows, softer texture, skin kept natural', {
    shadows: 12,
    warmth: 6,
    vibrance: 10,
    clarity: -10,
    contrast: -4
  }, 1],
  [/\b(food|dish|meal|dinner|lunch|breakfast|dessert|restaurant|recipe|cake|pizza|burger)\b/, 'Food', 'warmer, richer color and crisp texture', {
    warmth: 10,
    vibrance: 25,
    clarity: 15,
    highlights: -12,
    shadows: 12,
    sharpen: 20
  }],
  [/\b(landscape|scenery|scenic|hike|hiking|vista|national park|mountain view)\b/, 'Landscape', 'recovered sky, opened shadows, more depth and color', {
    highlights: -28,
    shadows: 22,
    clarity: 25,
    vibrance: 25,
    contrast: 8
  }],
  [/\b(real estate|listing|interior|living room|bedroom|kitchen|airbnb|apartment)\b/, 'Interior', 'brighter rooms with window highlights held back', {
    brightness: 15,
    shadows: 35,
    highlights: -25,
    clarity: 10,
    vibrance: 8
  }],
  [/\b(product|products|ecommerce|e-commerce|etsy|ebay|catalog|catalogue)\b/, 'Product', 'clean, bright and sharp with true color', {
    brightness: 8,
    contrast: 10,
    clarity: 15,
    sharpen: 30,
    vibrance: 5
  }],
  [/\b(wedding|bridal|engagement)\b/, 'Wedding', 'bright, soft and glowing, skin kept natural', {
    brightness: 12,
    shadows: 18,
    contrast: -8,
    glow: 18,
    warmth: 6,
    saturation: -6
  }, 1],
  [/\b(concert|nightlife|low light|night shot|city at night)\b/, 'Low light', 'less noise, tamed lights, lifted shadows', {
    denoise: 35,
    highlights: -20,
    shadows: 18,
    vibrance: 18
  }],
  [/\b(snow|snowy|ski|skiing)\b/, 'Snow', 'brighter, cleaner snow', {
    exposure: 15,
    warmth: -6,
    highlights: -10,
    clarity: 10
  }],
  [/\b(pet|dog|cat|puppy|kitten)\b/, 'Pet', 'crisper fur and a little more color', {
    clarity: 18,
    vibrance: 12,
    sharpen: 20,
    shadows: 10
  }],
  [/\b(architecture|building|buildings|skyline|cityscape)\b/, 'Architecture', 'more structure and controlled highlights', {
    clarity: 28,
    contrast: 12,
    highlights: -15,
    shadows: 10,
    saturation: -6
  }],
  [/\b(document|receipt|whiteboard|scan|scanned|notes|handwriting)\b/, 'Document', 'white paper, dark crisp text', {
    brightness: 20,
    contrast: 40,
    saturation: -40,
    sharpen: 40,
    clarity: 20
  }],
  [/\b(instagram|insta|social media|feed)\b/, 'Social', 'punchier color and crisp detail', {
    vibrance: 22,
    clarity: 15,
    contrast: 8,
    sharpen: 15
  }]
];

// Split toning: which way each color pushes the red, green and blue curves.
var GRADE = {
  teal: [-1, .35, .6],
  cyan: [-1, .3, .8],
  aqua: [-1, .3, .8],
  blue: [-.6, -.1, 1],
  bluer: [-.6, -.1, 1],
  bluish: [-.6, -.1, 1],
  navy: [-.5, -.3, 1],
  green: [-.5, 1, -.5],
  greener: [-.5, 1, -.5],
  yellow: [.6, .5, -1],
  gold: [.8, .4, -.9],
  golden: [.8, .4, -.9],
  amber: [1, .45, -.9],
  orange: [1, .25, -.8],
  red: [1, -.4, -.4],
  magenta: [.7, -.8, .7],
  pink: [.8, -.4, .5],
  purple: [.35, -.7, .9],
  violet: [.35, -.7, .9],
  warm: [.8, .25, -.8],
  warmer: [.8, .25, -.8],
  cool: [-.6, 0, .8],
  cooler: [-.6, 0, .8],
  cold: [-.6, 0, .8],
  brown: [.5, .15, -.5],
  sepia: [.5, .15, -.5]
};

function gradeAdd(R, zone, col, I, down) {
  var st = R.steps.filter(function(s) {
    return s.k === 'grade'
  })[0];
  if (!st) {
    st = {
      k: 'grade',
      z: {
        sh: [0, 0, 0],
        mid: [0, 0, 0],
        hi: [0, 0, 0]
      },
      m: 1,
      lbl: []
    };
    R.steps.push(st)
  }
  var k = (I.abs != null ? Math.min(100, Math.abs(I.abs)) * .4 : 16 * I.mul) * (down ? -1 : 1),
    v = GRADE[col];
  for (var i = 0; i < 3; i++) st.z[zone][i] = Math.max(-60, Math.min(60, st.z[zone][i] + v[i] * k));
  st.lbl.push(col + ' ' + {
    sh: 'shadows',
    mid: 'midtones',
    hi: 'highlights'
  } [zone])
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
  if (EDITV.test(c) && OBJ.test(c) && !hasAttr && !/\b(photos?|pics?|pictures?|shots?|images?|portrait|headshot)\b/.test(c)) return /\b(add|insert|put|place|paste|give|draw)\b/.test(c) ? 'Adding new things means generating pixels that aren’t in the photo, which needs a generative (cloud) model.' : 'Changing specific objects needs object detection plus generative fill, which isn’t possible offline.';
  return null
}

function parsePrompt(txt) {
  var R = {
    steps: [],
    cant: [],
    skip: [],
    natural: false,
    notes: [],
    lock: {}
  };
  // Quoted words are text to put on the photo: add "Summer 2026" at the top in neon.
  R.quotes = [];
  txt = String(txt).replace(/["“]([^"”\n]{1,120})["”]/g, function(m, q) {
    R.quotes.push(q.trim());
    return ' __text' + (R.quotes.length - 1) + ' '
  });
  var t = ' ' + txt.toLowerCase().replace(/[’‘]/g, "'").replace(/[“”"]/g, ' ').replace(/°/g, ' degrees') + ' ';
  t = fixTypos(numWords(t), R);
  PROT.forEach(function(p) {
    t = t.replace(p[0], ' ' + p[1] + ' ')
  });
  t = posTokens(t);
  // Styling after a quoted text stays with it: "NEW DROP" with a red label.
  t = t.replace(/(__text\d+[^,;.!?\n]*?)\s(?:with|and|plus)\s(?=(?:an?\s+|the\s+|some\s+)?(?:[a-z]+\s+){0,2}(?:label|box|banner|outline|shadow|neon|font|letters|lettering|script|cursive|serif|bold|curve|curved|glitch|retro|background|caps|typewriter|handwriting)\b)/g, '$1 ');
  // Mark exceptions ("everything except the sky") and take-backs ("scratch that") before splitting.
  t = t.replace(/\b(everything|all)\s+but(?=\s+(the|my|his|her|their)\b)/g, '$1 , __except ')
    .replace(/\b(?:except(?:\s+for)?|apart\s+from|other\s+than|excluding|but\s+not(?=\s+(?:the|my|his|her|their|any|on)\b))\b/g, ' , __except ')
    .replace(/\b(?:scratch\s+that|never\s*mind(?:\s+that)?|undo\s+that|forget\s+(?:that|the\s+last\s+(?:one|step|part)))\b/g, ' , __undo , ');
  var clean = function(s) {
    return s.replace(/[^a-z0-9_%:+\-.'\/ ]/g, ' ').replace(/\s+/g, ' ').trim()
  };
  // Sentences (and "then") bound what an exception applies to; clauses are the edits inside.
  t.split(/[;!?\n]+|\.(?!\d)|\s(?:and then|after that|afterwards|afterward|finally|then)(?=\s)/).forEach(function(sent) {
    R.sentStart = R.steps.length;
    R.sentExc = [];
    var inExc = false;
    sent.split(/,|\s(?:also|plus|and|but|while|with|&)(?=\s)/).map(clean).filter(Boolean).forEach(function(c) {
      if (c === '__undo') {
        var gone = R.steps.pop();
        if (gone) R.notes.push('Dropped the step before “scratch that”.');
        return
      }
      if (/^__except\b/.test(c) || inExc) {
        var body = c.replace(/^__except\s*/, ''),
          w = body.split(' '),
          at = -1;
        // "except the sky should be black and white": the words after the target are an edit of their own.
        w.forEach(function(x, i) {
          if (at < 0 && (TARGETS[x] || COLBAND[x] || /^(faces?|background|backdrop|subject|foreground|skin|person|people|man|woman|guy|girl|kid|kids|child|boy|baby|dog|cat|puppy|model|bride|groom|couple|family|him|her|them|me|us)$/.test(x))) at = i
        });
        while (at >= 0 && at + 1 < w.length && (TARGETS[w[at + 1]] || COLBAND[w[at + 1]])) at++;
        var rest = at >= 0 ? w.slice(at + 1).join(' ') : '';
        if (at >= 0) {
          body = w.slice(0, at + 1).join(' ');
          w = w.slice(0, at + 1)
        }
        var e = excOf(body, w);
        // "except the sky and the water": keep collecting bare targets.
        if (e && (/^__except\b/.test(c) || !w.some(function(x) {
            return ATTR[x] || LOOKS[x]
          }))) {
          R.sentExc.push(e);
          inExc = true;
          if (rest) {
            inExc = false;
            parseClause(rest, R)
          }
          return
        }
        inExc = false;
        if (/^__except\b/.test(c)) {
          if (body) R.skip.push({
            text: 'except ' + body,
            why: 'I can leave out the sky, water, greenery and other color ranges, skin, faces, the subject or the background.'
          });
          return
        }
      }
      parseClause(c, R)
    });
    // Color-range exceptions first, then the AI-region one (which moves edits into a mask).
    R.sentExc.sort(function(a, b) {
      return (a.region ? 1 : 0) - (b.region ? 1 : 0)
    }).forEach(function(e, i, all) {
      if (e.region && all.slice(0, i).some(function(x) {
          return x.region
        })) return;
      applyExcept(e, R, R.sentStart)
    })
  });
  applyLocks(R);
  if (R.natural) R.steps.forEach(function(s) {
    if (s.k === 'adj' || s.k === 'hsl') s.v = Math.round(s.v * .65);
    else if (s.k === 'look' || s.k === 'grade') s.m = Math.round(s.m * 65) / 100;
    else if (s.k === 'flt') s.s = Math.round(s.s * 70) / 100
  });
  if (R.notes.length) R.summary = R.notes.join(' ');
  delete R.sentExc;
  return R
}

function val(key, s, I) {
  return I.abs != null ? s * Math.min(100, Math.abs(I.abs)) : Math.max(-100, Math.min(100, Math.round(s * BASEV[key] * I.mul)))
}

// "blur the face", "brighten the faces", "blur the background": an edit aimed at
// a region the AI masks can find becomes a mask step instead of a global edit.
var MASK_EDIT = {
  exposure: 25,
  contrast: 22,
  highlights: 30,
  shadows: 30,
  warmth: 22,
  tint: 15,
  saturation: 22,
  clarity: 25,
  sharpen: 30
};

function regionMask(c, w, carried) {
  var region = carried || (/\bbokeh\b/.test(c) ? 'background' : regionOf(c)) || (/\bskin\b/.test(c) && /\b(smooth|smoother|soften|softer|brighten|brighter|glow|glowing)\b/.test(c) ? 'face' : null);
  if (!region) return null;
  // Adding, removing or reshaping things is still out of reach.
  if (/\b(remove|erase|delete|replace|swap|move|insert|put|place|paste|add|draw|bigger|smaller|thinner|slimmer|fatter|taller|shorter|younger|older)\b/.test(c)) return null;
  var I = inten(w, c),
    down = w.some(function(x) {
      return DOWNW[x]
    }) || I.half,
    flip = w.indexOf('notso') >= 0 || w.indexOf('too') >= 0 || stateOf(c),
    v = {},
    blur = /\b(blur|blurred|blurry|bokeh|defocus|out of focus|unfocused)\b/.test(c);
  if (blur && !down) v.blur = Math.min(100, Math.round(55 * I.mul));
  w.forEach(function(x) {
    var a = ATTR[x];
    if (!a || a[0] === 'grain' || a[0] === 'fade' || a[0] === 'glow' || a[0] === 'vignette') return;
    var key = a[0] === 'brightness' ? 'exposure' : a[0] === 'vibrance' ? 'saturation' : a[0];
    if (key === 'sharpen' && a[1] < 0) return; // blur words, handled above
    if (!MASK_EDIT[key] || v[key]) return;
    var sg = a[1] === 0 ? (down ? -1 : 1) : down || flip ? -a[1] : a[1];
    v[key] = Math.max(-100, Math.min(100, Math.round(sg * MASK_EDIT[key] * I.mul)))
  });
  if (/\b(smooth|smoother|soften|softer)\b/.test(c) && !v.clarity) v.clarity = -Math.round(40 * I.mul);
  if (!Object.keys(v).length) return null;
  return {
    k: 'mask',
    mk: {
      type: region,
      name: region.charAt(0).toUpperCase() + region.slice(1),
      inv: false,
      amt: 1,
      v: v
    },
    why: 'Only affects the ' + (region === 'face' ? 'face' : region) + (region === 'face' ? 's the AI finds' : ' the AI finds')
  }
}

// Overlays and retro frames from the Overlays tab: "add dust and a light leak", "super 8 frame".
var OVWORDS = [
  [/\b(?:dust|dusty|specks?)\b/, 'dust'],
  [/\bscratch(?:es|ed|y)?\b/, 'scratches'],
  [/\blight[\s-]*leaks?\b/, 'leak'],
  [/\bprism\b|\brainbow\b/, 'prism'],
  [/\b(?:sun|lens)[\s-]*flares?\b|\bflares?\b/, 'flare'],
  [/\bpaper(?:[\s-]+texture[d]?)?\b/, 'paper'],
  [/\bplastic(?:\s+wrap)?\b|\bcling[\s-]?film\b/, 'plastic'],
  [/\bblinds?(?:\s+shadows?)?\b|\bwindow\s+shadows?\b/, 'blinds'],
  [/\b(?:leaf|leaves|palm)\s+shadows?\b|\bshadows?\s+of\s+(?:leaves|a\s+plant|plants)\b|\bdappled(?:\s+light)?\b/, 'leaves'],
  [/\bfilm[\s-]?burn\b|\bburnt\s+film\b/, 'burn'],
  [/\bbokeh\s+(?:lights?|circles|balls|overlay)\b|\bfairy\s+lights\b/, 'bokeh'],
  [/\bsparkles?\b|\bsparkly\b|\bglitter(?:y)?\b|\bglints?\b|\btwinkl(?:e|y)\b/, 'sparkle'],
  [/\bchromatic\s+fringe\b|\bfringing\b/, 'fringe']
];
var FRWORDS = [
  [/\bsuper[\s-]?8\b/, 'super8'],
  [/\b8\s?mm\b/, '8mm'],
  [/\bvhs\s+(?:frame|overlay|text|screen)\b|\bplay\s+screen\b/, 'vhs'],
  [/\bvcr\b|\bcamcorder\s+(?:frame|screen|overlay)\b|\brec(?:ording)?\s+(?:frame|screen|overlay)\b/, 'vcr'],
  [/\bfilm[\s-]?strip\b|\b35\s?mm(?:\s+(?:frame|strip|border))?\b|\bsprockets?\b/, 'filmstrip'],
  [/\bwhite\s+(?:border|frame)\b|\bborder\b/, 'border']
];

function overlayOf(c) {
  var out = [];
  FRWORDS.concat(OVWORDS).forEach(function(o, i) {
    var m = c.match(o[0]);
    // one frame per photo: "film strip border" is the film strip, not also a border
    if (m && i < FRWORDS.length && out.length) m = null;
    if (m) {
      out.push([i < FRWORDS.length ? 'fr' : 'ov', o[1], m[0]]);
      c = c.replace(m[0], ' ')
    }
  });
  return out
}

// Style and place a quoted text from the words around it.
var TXCOL = {
  white: '#ffffff',
  black: '#000000',
  red: '#e5202e',
  pink: '#ff4d8d',
  orange: '#ff8a1f',
  yellow: '#ffd23f',
  gold: '#f0c24b',
  golden: '#f0c24b',
  green: '#3ddc84',
  blue: '#00c2ff',
  navy: '#1f2a6b',
  purple: '#9b5cff',
  cream: '#f3e9d2',
  brown: '#7a5c3e'
};
var TXPOS = {
  tl: [.3, .12],
  tr: [.7, .12],
  bl: [.3, .88],
  br: [.7, .88],
  t: [.5, .13],
  b: [.5, .87],
  l: [.27, .5],
  r: [.73, .5],
  c: [.5, .5],
  edges: [.5, .87]
};

function textStyleOf(c, s) {
  var t = {
      s: s,
      f: 'Montserrat',
      size: .08,
      x: .5,
      y: .5,
      c: '#ffffff',
      c2: '#e5202e',
      b: true,
      it: false,
      up: false,
      al: 'center',
      fx: 'shadow',
      ls: 0,
      lh: 1.15,
      curve: 0,
      rot: 0,
      op: 1
    },
    has = function(re) {
      return re.test(c)
    };
  var pos = (c.match(/\bpos_([a-z_]+)/) || [])[1];
  pos = pos ? pos.split('_')[0] : has(/\btop\b/) ? 't' : has(/\bbottom\b/) ? 'b' : has(/\b(?:center|centre|middle)\b/) ? 'c' : has(/\bleft\b/) ? 'l' : has(/\bright\b/) ? 'r' : null;
  if (pos && TXPOS[pos]) {
    t.x = TXPOS[pos][0];
    t.y = TXPOS[pos][1]
  }
  if (has(/\b(?:script|cursive|signature|fancy|calligraphy)\b/)) t.f = 'Great Vibes', t.b = false, t.size = .1;
  if (has(/\b(?:handwritten|handwriting|hand[\s-]?drawn|marker|scribbled?)\b/)) t.f = 'Caveat';
  if (has(/\b(?:serif|elegant|classy|editorial|magazine)\b/)) t.f = 'Playfair Display', t.b = false, t.it = has(/\bitalic\b/);
  if (has(/\b(?:bold|impact|poster|headline|loud)\b/)) t.f = 'Anton', t.b = false, t.up = true;
  if (has(/\b(?:typewriter|mono|monospace|code)\b/)) t.f = 'Space Mono';
  if (has(/\b(?:caps|capitals|uppercase|all caps)\b/)) t.up = true;
  if (has(/\bneon\b/)) t.fx = 'neon', t.f = 'Bebas Neue', t.b = false, t.c = '#ff4d8d', t.ls = 4;
  if (has(/\bretro\b/)) t.fx = 'retro', t.f = 'Abril Fatface', t.b = false, t.c = '#ffd23f';
  if (has(/\b(?:outline|outlined)\b/)) t.fx = 'outline';
  if (has(/\b(?:label|banner|box|background|highlighted?)\b/)) t.fx = 'box';
  if (has(/\bglitch(?:y)?\b/)) t.fx = 'glitch';
  if (has(/\b(?:curved?|arched?|arc)\b/)) t.curve = 45;
  if (has(/\b(?:big|large|huge|giant|massive)\b/)) t.size = .13;
  if (has(/\b(?:small|tiny|little|subtle)\b/)) t.size = .045;
  Object.keys(TXCOL).forEach(function(k) {
    if (new RegExp('\\b' + k + '\\b').test(c)) t.c = TXCOL[k]
  });
  // "a red label": the colour belongs to the box, with readable text on it
  if (t.fx === 'box' && t.c !== '#ffffff') {
    t.c2 = t.c;
    t.c = /^#(?:ffd23f|f0c24b|f3e9d2|3ddc84|00c2ff)$/.test(t.c2) ? '#000000' : '#ffffff'
  }
  return t
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
    // "actually cooler", "a noir look instead": replace earlier steps of the same kind.
    replace = /\b(instead|actually|rather)\b/.test(c),
    add = function(s) {
      if (replace)
        for (var i = n0 - 1; i >= 0; i--) {
          var o = st[i];
          if (o.k === s.k && o.key === s.key && o.band === s.band && o.prop === s.prop) {
            st.splice(i, 1);
            n0--
          }
        }
      st.push(s)
    };
  if (!w.length) return;
  var qi = w.filter(function(x) {
    return /^__text\d+$/.test(x)
  });
  if (qi.length) {
    qi.forEach(function(q) {
      var s = R.quotes[+q.slice(6)];
      if (s) st.push({
        k: 'text',
        t: textStyleOf(c, s)
      })
    });
    return
  }
  // "don't make it darker", "keep the sky as is", "leave the colors alone"
  var dont = /\b(don'?t|do not|never|shouldn'?t|no need to|without (changing|touching|affecting|altering))\b/.test(c) && !/overdo|over the top|too much/.test(c),
    keepw = /\b(keep|leave|preserve|protect|untouched|unchanged|as is|as it is)\b/.test(c) && !/\b(natural|realistic|believable|real|normal)\b/.test(c);
  if ((dont || keepw) && protect(c, w, R, dont)) return;
  var ovs = overlayOf(c);
  if (ovs.length) {
    var I0 = inten(w, c),
      gone = w.some(function(x) {
        return REMOVEW[x] || x === 'remove'
      });
    ovs.forEach(function(o) {
      if (gone) st.push({
        k: o[0] === 'fr' ? 'fr' : 'ovrm',
        id: o[0] === 'fr' ? null : o[1]
      });
      else st.push(o[0] === 'fr' ? {
        k: 'fr',
        id: o[1]
      } : {
        k: 'ov',
        id: o[1],
        a: I0.abs != null ? Math.max(0, Math.min(1, I0.abs / 100)) : I0.mul < 1 ? .4 : I0.mul > 1 ? 1 : .7
      });
      c = c.replace(o[2], ' ')
    });
    // Keep reading whatever else the clause asks for ("dusty and faded film").
    c = c.replace(/\b(?:frame|overlay|texture|effect)s?\b/g, ' ').replace(/\s+/g, ' ').trim();
    w = c.split(' ').filter(function(x) {
      return x && !FILLER[x] && !REMOVEW[x]
    });
    if (!w.length) return;
    w = c.split(' ').filter(Boolean);
    n0 = st.length
  }
  var rm = regionMask(c, w);
  // A short follow-on like "...the face brighter and warmer" keeps talking about the face.
  if (!rm && R.lastRegion && R.lastRegion.n === st.length && w.length <= 4 && !/\b(make|it|photo|image|picture|pic|whole|everything|overall|rest)\b/.test(c)) {
    rm = regionMask(c, w, R.lastRegion.type);
    if (rm) {
      var prev = st[st.length - 1];
      Object.keys(rm.mk.v).forEach(function(k) {
        if (prev.mk.v[k] == null) prev.mk.v[k] = rm.mk.v[k]
      });
      return
    }
  }
  // "blur the background with bokeh": the second clause is the same background mask.
  var lastM = st[st.length - 1];
  if (rm && R.lastRegion && R.lastRegion.n === st.length && lastM && lastM.k === 'mask' && lastM.mk.type === rm.mk.type && lastM.mk.inv === rm.mk.inv) {
    Object.keys(rm.mk.v).forEach(function(k) {
      if (lastM.mk.v[k] == null) lastM.mk.v[k] = rm.mk.v[k]
    });
    return
  }
  if (rm) {
    st.push(rm);
    R.lastRegion = {
      type: rm.mk.type,
      n: st.length
    };
    return
  }
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
    down = any(DOWNW) || I.half,
    state = stateOf(c),
    flip = has('notso') || has('too') || has('overly') || state,
    rem = any(REMOVEW);
  if (has('fixcolor')) {
    add({
      k: 'enh',
      amt: .85
    });
    R.notes.push('Fixed the color balance with the Photo Enhancer’s auto white balance.');
    return
  }
  if (has('blownout')) {
    add({
      k: 'adj',
      key: 'highlights',
      v: -Math.min(100, Math.round(45 * I.mul))
    });
    add({
      k: 'adj',
      key: 'exposure',
      v: -Math.round(8 * I.mul)
    });
    if (w.some(function(x) {
        return TARGETS[x] === 'blue'
      })) add({
      k: 'hsl',
      band: 'blue',
      prop: 'l',
      v: -25,
      tw: 'sky'
    });
    R.notes.push('Pulled the blown-out highlights back.');
    return
  }
  if (flip && /\b(hazy|haze|foggy|misty|washed)\b/.test(c) && !/\b(more|add|make)\b/.test(c)) {
    add({
      k: 'look',
      name: LOOKS.dehaze[0],
      vals: LOOKS.dehaze[1],
      m: I.mul < 1 ? .6 : I.mul > 1 ? 1.4 : 1
    });
    R.notes.push('Read “' + c + '” as haze to cut through.');
    return
  }
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
  if (fo && /^(sunset|desert|night|candy|frozen)$/.test(fo.word) && (hits.length || tgtW === fo.word)) {
    fo = null
  }
  // "zoom blur", "neon noir colors": words inside or describing a filter aren't separate edits.
  if (fo) hits = hits.filter(function(h) {
    return fo.word.split(/[\s_]/).indexOf(h.w) < 0 && (h.d || /\b(more|less|increase|boost|reduce|lower|raise)\b/.test(c))
  });
  // "a blue tint", "a green cast": the colour word already says which way.
  if (hits.some(function(h) {
      return (h.key === 'warmth' || h.key === 'tint') && h.d
    })) hits = hits.filter(function(h) {
    return !(h.key === 'tint' && !h.d)
  });
  if (state && hits.some(function(h) {
      return h.d
    })) R.notes.push('Read “' + c + '” as a problem to fix, so I went the other way.');
  // Color grading: "teal shadows", "warm up the highlights", "split tone blue and gold".
  var spl = w.filter(function(x) {
      return /^splittone_/.test(x)
    })[0],
    gz = w.filter(function(x) {
      return /^(shadows?|highlights?|midtones|darks|lights|blacks|whites|lows|highs)$/.test(x)
    })[0],
    gc = w.filter(function(x) {
      return GRADE[x]
    })[0];
  if (spl) {
    var sp = spl.split('_');
    if (GRADE[sp[1]] && GRADE[sp[2]]) {
      gradeAdd(R, 'sh', sp[1], I, false);
      gradeAdd(R, 'hi', sp[2], I, false);
      return
    }
  }
  if (gz && gc) {
    gradeAdd(R, /^(shadows?|darks|blacks|lows)$/.test(gz) ? 'sh' : gz === 'midtones' ? 'mid' : 'hi', gc, I, down);
    if (!/\b(lift|lifted|raise|crush|crushed|deepen|deeper|brighten|brighter|darken|darker|recover|tame|open)\b/.test(c)) return;
    hits = hits.filter(function(h) {
      return h.key !== 'warmth' && h.key !== 'tint' && h.key !== 'saturation'
    })
  }
  if (tgtW === 'sunset' && !hits.length) tgtW = null;
  var looks = w.map(function(x) {
    var L = LOOKS[x];
    return typeof L === 'string' ? LOOKS[L] : L
  }).filter(Boolean);
  if (/\b(natural|realistic|subtle|believable|tasteful|subtly)\b/.test(c) && (!hits.length || /\b(keep|leave)\b/.test(c) && hits.every(function(h) {
      return !h.d
    })) && !fo && !looks.length && !tgtW || /don'?t overdo|not overdone|not too much|not over the top/.test(c)) {
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
  // Shoot-type recipe when the clause names the kind of photo but no specific edit.
  var sc = !hits.length && !fo && !looks.length && cropOf(c) === undefined ? SCENES.filter(function(x) {
    return x[0].test(c)
  })[0] : null;
  if (sc) {
    add({
      k: 'look',
      name: sc[1] + ' recipe',
      scene: true,
      vals: sc[3],
      m: I.mul < 1 ? .6 : I.mul > 1 ? 1.3 : 1
    });
    if (sc[4] && !st.some(function(s) {
        return s.k === 'skin'
      })) add({
      k: 'skin'
    });
    R.notes.push('Treated it as ' + (/^[aeiou]/i.test(sc[1]) ? 'an ' : 'a ') + sc[1].toLowerCase() + ' photo: ' + sc[2] + '.');
    tgtW = null
  }
  if (/\b(upscale|upscaled|upscaling|upres|up-res|super[ -]?res(olution)?|higher[ -]res(olution)?|high[ -]res(olution)?|more resolution|increase (the )?resolution|hd|4k|enlarge|bigger|larger|double the (size|resolution)|quadruple|resolution)\b/.test(c) || !hits.length && /\b(2x|4x)\b/.test(c)) add({
    k: 'up',
    f: /\b(4x|4k|quadruple|4 times|four times)\b/.test(c) || I.mul > 1.5 && !/\b(2x|double)\b/.test(c) ? 4 : 2
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
  var sm = c.match(/(-?\d+(?:\.\d+)?)\s*(?:degrees?|deg)\b/),
    sn = sm ? Math.abs(+sm[1]) : 0;
  if (sn && sn <= 45 && /\b(straighten|level|tilt|tilted|rotate|rotated|turn|crooked)\b/.test(c)) {
    var dg = sn * (/\b(counter|anti|ccw|counterclockwise|anticlockwise|left)\b/.test(c) || +sm[1] < 0 ? -1 : 1);
    add({
      k: 'straighten',
      deg: dg,
      why: 'Turns the photo ' + sn + '° ' + (dg > 0 ? 'clockwise' : 'counter-clockwise') + ' and trims the corners'
    })
  } else if (/\b(crooked|tilted|wonky|slanted|straighten)\b|\blevel (the|it)\b|\bhorizon (is )?(not straight|crooked|tilted|uneven)\b/.test(c)) R.skip.push({
    text: c,
    why: 'I can’t see the horizon offline. Say how much, like “straighten 2 degrees clockwise”, use the Straighten slider in the Crop tab, or connect Claude to level it automatically.'
  });
  else if (/\b(flip|flipped|mirror|mirrored)\b/.test(c)) add({
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
      m: (down || flip ? -1 : 1) * (I.mul < 1 ? .5 : I.mul > 1 ? 1.5 : 1)
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
  // "…on the bottom right and top left corners": place this clause's filter (or the last one).
  var posT = w.filter(function(x) {
    return /^pos_/.test(x)
  });
  if (posT.length) {
    var at = [];
    posT.forEach(function(x) {
      x.slice(4).split('_').forEach(function(k) {
        if (POSW[k] && at.indexOf(k) < 0) at.push(k)
      })
    });
    var pf2 = st.slice().reverse().filter(function(s) {
      return s.k === 'flt'
    })[0];
    if (pf2 && at.length) pf2.at = at;
    else if (at.length) R.skip.push({
      text: c,
      why: 'Placing an edit in one part of the photo works for filters. For light and color, use a Linear or Radial mask in the Masks tab.'
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
        var fl = {
          t: 'flt',
          id: s.id,
          s: s.s
        };
        if (s.at) fl.at = s.at.slice();
        st.layers.push(fl);
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
      case 'grade':
        v = tgt();
        v.curve = v.curve || {};
        ['r', 'g', 'b'].forEach(function(ch, i) {
          var a = s.z.sh[i] * s.m,
            b = s.z.mid[i] * s.m,
            h = s.z.hi[i] * s.m,
            cl = function(x) {
              return Math.max(0, Math.min(255, Math.round(x)))
            };
          if (a || b || h) v.curve[ch] = [
            [0, cl(a * .6)],
            [64, cl(64 + a)],
            [128, cl(128 + b)],
            [192, cl(192 + h)],
            [255, cl(255 + h * .4)]
          ]
        });
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
        var nm = clone(s.mk);
        // AI face masks from a prompt get the same editable ovals as the Masks tab.
        if (nm.type === 'face' && !nm.faces && typeof SEG !== 'undefined' && SEG && SEG.faceShapes) {
          nm.faces = clone(SEG.faceShapes);
          if (nm.feather == null) nm.feather = .35
        }
        st.masks = (st.masks || []).concat([nm]);
        break;
      case 'ov':
        st.fx = st.fx ? clone(st.fx) : {
          ov: [],
          fr: null
        };
        st.fx.ov.push({
          id: s.id,
          a: s.a,
          sd: 7 + st.fx.ov.length * 101 + s.id.length * 37
        });
        break;
      case 'ovrm':
        if (st.fx) st.fx.ov = st.fx.ov.filter(function(o) {
          return o.id !== s.id
        });
        break;
      case 'fr':
        st.fx = st.fx ? clone(st.fx) : {
          ov: [],
          fr: null
        };
        st.fx.fr = s.id;
        break;
      case 'text':
        var tx = clone(s.t);
        tx.id = 't' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
        st.texts = (st.texts || []).concat([tx]);
        break;
      case 'reset':
        st.masks = [];
        var up = st.up;
        var f = fresh();
        st.geo = f.geo;
        st.enh = null;
        st.layers = f.layers;
        st.fx = f.fx;
        st.texts = [];
        st.skin = false;
        st.up = up;
        st.up.on = false;
        afterF = false;
        break
    }
  });
  return st
}
