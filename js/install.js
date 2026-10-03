/* ============================================================
   GET THE APP: install on this device, or download the code
   ============================================================ */
var SITE_URL = 'https://kimpelota.github.io/photo-editor/',
  ZIP_URL = 'https://github.com/kimpelota/photo-editor/archive/refs/heads/main.zip',
  installEv = null;

function isInstalled() {
  return window.NUANCE_APP === true || matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
}

var MAC_URL = 'https://github.com/kimpelota/photo-editor/releases/latest/download/Studio-de-Nuance-mac.zip';

function isMac() {
  return /mac/i.test(navigator.platform) && !isIOS()
}

// Step-by-step install instructions for the browser and device this is running on.
function installSteps() {
  var ua = navigator.userAgent;
  if (isIOS()) {
    // Chrome, Firefox and Edge on iPhone can add to the Home Screen too (iOS 16.4+).
    if (/CriOS|FxiOS|EdgiOS/.test(ua)) return ['Tap the <b>Share</b> button (the square with an arrow) next to the address bar, or in the <b>&middot;&middot;&middot;</b> menu.', 'Tap <b>Add to Home Screen</b> (scroll down or tap <b>More</b> if you don&rsquo;t see it).', 'Tap <b>Add</b>.'];
    // Since iOS 26, Safari's default layout keeps Share inside the ••• menu.
    return ['In <b>Safari</b>, tap the <b>&middot;&middot;&middot;</b> button at the bottom right, then tap <b>Share</b>. (If you see the Share button, the square with an arrow, just tap it.)', 'Scroll down and tap <b>Add to Home Screen</b>. If it isn&rsquo;t there, tap <b>View More</b> or <b>Edit Actions</b>.', 'Leave <b>Open as Web App</b> on, then tap <b>Add</b>.']
  }
  if (/android/i.test(ua)) return ['Open this page in <b>Chrome</b>.', 'Tap the menu (<b>&#8942;</b>) at the top right.', 'Tap <b>Install app</b> (or <b>Add to Home screen</b>), then <b>Install</b>.'];
  if (/safari/i.test(ua) && !/chrome|chromium|edg/i.test(ua)) return ['In the menu bar at the very top of the screen, click <b>File</b>.', 'Click <b>Add to Dock&hellip;</b>, then <b>Add</b>.', 'Open it from the Dock or your Applications folder.'];
  return ['Click the install icon at the right end of the address bar, or open the browser menu (<b>&#8942;</b>).', 'Choose <b>Install Studio de Nuance</b>, then <b>Install</b>.'];
}

function steps(list) {
  return '<ol class="appsteps">' + list.map(function(x) {
    return '<li>' + x + '</li>'
  }).join('') + '</ol>'
}

function renderAppPop() {
  var h = '';
  if (window.NUANCE_APP) h += '<div class="appsec"><b>You&rsquo;re using the Mac app</b><small>It works offline. Exports are saved to your Downloads folder.</small></div>';
  else {
    if (isMac()) h += '<a class="pbtn appmain" href="' + MAC_URL + '"><span><b>Download for Mac</b><small>A regular Mac app that works offline</small></span></a>' +
      steps(['Open the downloaded <b>Studio-de-Nuance-mac.zip</b> to unzip it.', 'Drag <b>Studio de Nuance</b> into your <b>Applications</b> folder and open it.', 'If macOS says it can&rsquo;t check the app: open <b>System Settings &rarr; Privacy &amp; Security</b>, scroll down and click <b>Open Anyway</b>. You only do this once.']);
    if (isInstalled()) h += '<div class="appsec"><b>Installed on this device</b></div>';
    else {
      h += '<div class="appsec"><b>' + (isMac() ? 'Or install it from this browser' : 'Install on this device') + '</b><small>Opens like an app, full screen, and works offline.</small></div>';
      if (installEv) h += '<button class="pbtn appmain" id="bInstall"><span><b>Install now</b></span></button>';
      else h += steps(installSteps())
    }
  }
  h += '<div class="appsec"><b>On your phone</b><small>Open <a href="' + SITE_URL + '" target="_blank" rel="noopener">' + SITE_URL.replace('https://', '') + '</a> and follow the install steps there.</small></div>' +
    '<a class="pbtn" href="' + ZIP_URL + '"><span><b>Download the code (.zip)</b><small>To run or change it yourself; see the README inside</small></span></a>';
  $('#appPop').innerHTML = h;
  if ($('#bInstall')) $('#bInstall').onclick = function() {
    installEv.prompt();
    installEv.userChoice.then(function() {
      installEv = null;
      renderAppPop()
    })
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

// On phones the top bar scrolls sideways, and iPhone Safari clips anything inside
// a sideways-scrolling bar, even a fixed-position menu. So on narrow screens the
// menus live directly in <body>, and go back under their buttons on wider screens.
(function() {
  var mq = matchMedia('(max-width: 760px)'),
    pops = ['#histPop', '#themePop', '#appPop'].map(function(id) {
      var el = $(id);
      return {
        el: el,
        home: el.parentNode
      }
    });

  function place() {
    pops.forEach(function(p) {
      var to = mq.matches ? document.body : p.home;
      if (p.el.parentNode !== to) to.appendChild(p.el)
    })
  }
  place();
  mq.addEventListener ? mq.addEventListener('change', place) : mq.addListener(place)
})();

if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(function(e) {
  console.warn('offline support unavailable', e)
});
