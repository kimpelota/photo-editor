/* ============================================================
   GET THE APP: install on this device, or download the code
   ============================================================ */
var SITE_URL = 'https://kimpelota.github.io/photo-editor/',
  ZIP_URL = 'https://github.com/kimpelota/photo-editor/archive/refs/heads/main.zip',
  installEv = null;

function isInstalled() {
  return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
}

// What to tell people when the browser can't show its own install prompt.
function installHow() {
  if (isIOS()) return 'In Safari, tap the Share button, then <b>Add to Home Screen</b>.';
  if (/android/i.test(navigator.userAgent)) return 'Open the browser menu (&#8942;) and tap <b>Install app</b> or <b>Add to Home screen</b>.';
  if (/safari/i.test(navigator.userAgent) && !/chrome|chromium|edg/i.test(navigator.userAgent)) return 'In Safari, choose <b>File &rarr; Add to Dock</b>.';
  return 'Use the install icon in the address bar, or the browser menu &rarr; <b>Install Studio de Nuance</b>. Chrome and Edge support this.'
}

function renderAppPop() {
  var on = isInstalled();
  $('#appPop').innerHTML =
    '<button id="bInstall"' + (on ? ' disabled' : '') + '><span><b>' + (on ? 'Installed on this device' : 'Install on this device') + '</b><small>Opens like an app, full screen, and works offline</small></span></button>' +
    '<p class="apphow" id="appHow" hidden></p>' +
    '<a class="pbtn" href="' + ZIP_URL + '" download><span><b>Download the code (.zip)</b><small>Run it yourself: open index.html through any local web server</small></span></a>' +
    '<a class="pbtn" href="' + SITE_URL + '" target="_blank" rel="noopener"><span><b>Open on your phone</b><small>' + SITE_URL.replace('https://', '') + '</small></span></a>';
  $('#bInstall').onclick = function() {
    if (installEv) {
      installEv.prompt();
      installEv.userChoice.then(function() {
        installEv = null;
        renderAppPop()
      });
      return
    }
    var h = $('#appHow');
    h.innerHTML = installHow();
    h.hidden = false
  }
}

window.addEventListener('beforeinstallprompt', function(e) {
  e.preventDefault();
  installEv = e
});
window.addEventListener('appinstalled', function() {
  installEv = null;
  toast('Studio de Nuance is installed');
  renderAppPop()
});
$('#bApp').onclick = function(e) {
  e.stopPropagation();
  $('#histPop').classList.remove('on');
  $('#themePop').classList.remove('on');
  renderAppPop();
  $('#appPop').classList.toggle('on')
};
document.addEventListener('click', function(e) {
  if (!e.target.closest('#appPop') && !e.target.closest('#bApp')) $('#appPop').classList.remove('on')
});

if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(function(e) {
  console.warn('offline support unavailable', e)
});
