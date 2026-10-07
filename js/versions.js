/* ============================================================
   VERSIONS: saved looks for this photo, and compare any one against the current edit
   ============================================================ */
// Like Resolve's stills gallery. Versions belong to the open photo and go away
// when another photo is opened. cmpVer (if set) takes the "Before" side of the split.
var VERSIONS = [],
  cmpVer = null,
  verSeq = 0;

function verRender(st, key) {
  st = clone(st);
  st.up.on = false;
  return job({
    type: 'render',
    key: key,
    st: st,
    cache: false
  }).then(function(m) {
    return typeof textsReady === 'function' ? textsReady(st.texts || []).then(function() {
      return m
    }) : m
  }).then(function(m) {
    var c = document.createElement('canvas');
    putC(c, m);
    if (typeof paintTexts === 'function') paintTexts(c, st.texts || []);
    return c
  })
}

function saveVersion(name) {
  if (!work) return toast('Open a photo first');
  var v = {
    id: ++verSeq,
    name: name || 'Version ' + (VERSIONS.length + 1),
    s: clone(S),
    t: new Date(),
    url: ''
  };
  VERSIONS.unshift(v);
  renderVersions();
  toast('Saved “' + v.name + '”');
  verRender(v.s, 'proxy').then(function(c) {
    var k = Math.min(1, 240 / Math.max(c.width, c.height)),
      t = document.createElement('canvas');
    t.width = Math.round(c.width * k);
    t.height = Math.round(c.height * k);
    var x = t.getContext('2d');
    x.imageSmoothingQuality = 'high';
    x.drawImage(c, 0, 0, t.width, t.height);
    v.url = t.toDataURL('image/jpeg', .85);
    renderVersions()
  }).catch(function(e) {
    console.warn('version thumbnail failed', e)
  })
}

function compareVersion(v) {
  if (!v || cmpVer === v) {
    cmpVer = null;
    renderVersions();
    draw();
    return
  }
  cmpVer = v;
  renderVersions();
  // Rendered at preview size once; the split then wipes between it and the live edit.
  if (v.c) return showCompare();
  verRender(v.s, 'work').then(function(c) {
    v.c = c;
    if (cmpVer === v) showCompare()
  }).catch(function(e) {
    toast('Couldn’t render “' + v.name + '”: ' + e.message)
  })
}

function showCompare() {
  if (!showSplit) $('#bSplit').click();
  draw()
}

function restoreVersion(v) {
  var up = S.up;
  S = clone(v.s);
  S.up = up;
  plan = null;
  renderPlan();
  if (cmpVer === v) cmpVer = null;
  push('Restored ' + v.name);
  thumbsDirty = presetDirty = true;
  schedule();
  refreshThumbs();
  renderVersions()
}

function clearVersions() {
  VERSIONS = [];
  cmpVer = null;
  renderVersions()
}

function renderVersions() {
  var el = $('#verList');
  $('#bCmpOff').hidden = !cmpVer;
  if (!VERSIONS.length) {
    el.innerHTML = '<div class="empty">No versions yet. Save one, try a different look, then compare the two.</div>';
    return
  }
  el.innerHTML = VERSIONS.map(function(v, i) {
    return '<div class="ver' + (cmpVer === v ? ' on' : '') + '" data-i="' + i + '">' + (v.url ? '<img src="' + v.url + '" alt="">' : '<div class="vph"></div>') + '<div class="vmeta"><input value="' + esc(v.name) + '" aria-label="Version name" maxlength="40"><span>' + v.t.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit'
    }) + '</span></div><div class="vact"><button class="btn' + (cmpVer === v ? ' pri' : '') + '" data-a="cmp">' + (cmpVer === v ? 'Comparing' : 'Compare') + '</button><button class="btn" data-a="use">Restore</button><button class="ibtn" data-a="del" title="Delete version" aria-label="Delete version">&times;</button></div></div>'
  }).join('');
  $$('#verList .ver').forEach(function(card) {
    var v = VERSIONS[+card.dataset.i];
    card.querySelector('input').onchange = function() {
      v.name = this.value.trim() || v.name;
      if (cmpVer === v) draw()
    };
    Array.prototype.forEach.call(card.querySelectorAll('button'), function(b) {
      b.onclick = function() {
        if (b.dataset.a === 'cmp') compareVersion(v);
        else if (b.dataset.a === 'use') restoreVersion(v);
        else {
          VERSIONS.splice(VERSIONS.indexOf(v), 1);
          if (cmpVer === v) {
            cmpVer = null;
            draw()
          }
          renderVersions()
        }
      }
    })
  })
}

$('#bVerSave').onclick = function() {
  saveVersion($('#verName').value.trim());
  $('#verName').value = ''
};
$('#verName').onkeydown = function(e) {
  if (e.key === 'Enter') $('#bVerSave').click()
};
$('#bCmpOff').onclick = function() {
  compareVersion(null)
};
renderVersions();
