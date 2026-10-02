/* ============================================================
   COLOR SCHEMES
   ============================================================ */
var THEMES = [
  ['noir', 'Noir Rouge', 'Black and bold red', ['#000000', '#111111', '#e5202e']],
  ['champagne', 'Champagne Noir', 'Warm black and champagne gold', ['#0e0d0b', '#1f1c18', '#c9a96e']],
  ['bordeaux', 'Bordeaux', 'Deep wine and soft ros\u00e9', ['#14080c', '#261019', '#e8a0b4']],
  ['atelier', 'Atelier', 'Light: ivory, ink and terracotta', ['#f6f2ec', '#ffffff', '#c2532d']],
  ['nuit', 'Nuit Bleue', 'Midnight navy and peach', ['#0b1020', '#161f36', '#ff8a65']]
];

function themeNow() {
  return document.documentElement.dataset.theme || 'noir'
}

function setTheme(id) {
  document.documentElement.dataset.theme = id;
  try {
    localStorage.setItem('nuance.theme', id)
  } catch (e) {}
  renderThemes();
  themeIcon();
  // canvases drawn with theme colours need repainting
  draw();
  if (typeof drawCurve === 'function' && tab === 'adjust') drawCurve();
  syncUI()
}

function renderThemes() {
  var cur = themeNow();
  $('#themePop').innerHTML = THEMES.map(function(t) {
    return '<button data-id="' + t[0] + '" class="' + (t[0] === cur ? 'cur' : '') + '"><span class="thsw">' + t[3].map(function(c) {
      return '<i style="background:' + c + '"></i>'
    }).join('') + '</span><span><b>' + t[1] + '</b><small>' + t[2] + '</small></span></button>'
  }).join('');
  $$('#themePop button').forEach(function(b) {
    b.onclick = function() {
      setTheme(b.dataset.id);
      $('#themePop').classList.remove('on')
    }
  })
}
$('#bTheme').onclick = function(e) {
  e.stopPropagation();
  $('#histPop').classList.remove('on');
  $('#themePop').classList.toggle('on')
};
document.addEventListener('click', function(e) {
  if (!e.target.closest('#themePop') && !e.target.closest('#bTheme')) $('#themePop').classList.remove('on')
});
renderThemes();

/* ---------- app icon in the theme's colours ---------- */
// The "N" logo tile from the header, drawn at `size` px. With `mac`, it sits on a
// Mac-style rounded square in the theme's background colour, like a Dock icon.
function drawThemeIcon(size, mac) {
  var c = document.createElement('canvas'),
    x = c.getContext('2d'),
    cs = getComputedStyle(document.documentElement),
    v = function(k) {
      return cs.getPropertyValue(k).trim()
    },
    k = size / 1024;
  c.width = c.height = size;

  function rr(x0, y0, w, h, r) {
    x.beginPath();
    x.moveTo(x0 + r, y0);
    x.arcTo(x0 + w, y0, x0 + w, y0 + h, r);
    x.arcTo(x0 + w, y0 + h, x0, y0 + h, r);
    x.arcTo(x0, y0 + h, x0, y0, r);
    x.arcTo(x0, y0, x0 + w, y0, r);
    x.closePath()
  }
  var t = mac ? 260 : 0,
    tw = mac ? 504 : 1024;
  if (mac) {
    x.save();
    x.shadowColor = 'rgba(0,0,0,.35)';
    x.shadowBlur = 28 * k;
    x.shadowOffsetY = 12 * k;
    rr(100 * k, 100 * k, 824 * k, 824 * k, 185 * k);
    x.fillStyle = v('--bg');
    x.fill();
    x.restore();
    x.save();
    x.shadowColor = v('--ac');
    x.shadowBlur = 110 * k
  }
  rr(t * k, t * k, tw * k, tw * k, (mac ? 116 : 230) * k);
  x.fillStyle = v('--ac');
  x.fill();
  if (mac) x.restore();
  x.fillStyle = v('--on-ac');
  x.font = '900 ' + Math.round((mac ? 330 : 700) * k) + 'px ' + v('--disp');
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText('N', 512 * k, 530 * k);
  return c
}

// Browser tab icon, address-bar colour and (in the Mac app) the Dock icon follow the theme.
function themeIcon() {
  var l = document.querySelector('link[rel="icon"]');
  if (l) l.href = drawThemeIcon(64).toDataURL('image/png');
  var m = document.querySelector('meta[name="theme-color"]');
  if (m) m.content = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  var h = window.webkit && webkit.messageHandlers && webkit.messageHandlers.nuance;
  if (h) h.postMessage({
    icon: drawThemeIcon(1024, true).toDataURL('image/png')
  })
}
themeIcon();
