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
