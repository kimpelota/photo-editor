/* ============================================================
   TABS, HISTORY, EXPORT, KEYS, DnD
   ============================================================ */
$$('.tab').forEach(function(b) {
  b.onclick = function() {
    var prev = tab;
    tab = b.dataset.t;
    $$('.tab').forEach(function(x) {
      x.classList.toggle('on', x === b)
    });
    $$('.pane').forEach(function(p) {
      p.classList.toggle('on', p.dataset.p === tab)
    });
    if (tab === 'filters') renderFilterGrid();
    if (tab === 'adjust') {
      drawCurve();
      drawWheels()
    }
    if (tab === 'crop') syncCrop();
    if (tab === 'masks') renderMasks();
    refreshThumbs();
    if (prev === 'crop' || tab === 'crop') schedule();
    if ((prev === 'enhance') !== (tab === 'enhance') && vstate().up.on) schedule();
    if (tab === 'ai') setTimeout(function() {
      $('#prompt').focus()
    }, 50)
  }
});

function syncUI() {
  $('#bUndo').disabled = hix <= 0;
  $('#bRedo').disabled = hix >= hist.length - 1;
  SLIDERS = SLIDERS.filter(function(s) {
    return document.body.contains(s)
  });
  SLIDERS.forEach(function(s) {
    s.sync()
  });
  syncUpF();
  syncUpK();
  renderUpAct();
  renderEnh();
  renderStack();
  if (tab === 'filters') renderFilterGrid();
  syncCrop();
  $('#skinSw').classList.toggle('on', S.skin);
  markPreset();
  $('#histPop').innerHTML = hist.map(function(h, i) {
    return '<button data-i="' + i + '" class="' + (i === hix ? 'cur' : i > hix ? 'fut' : '') + '"><b>' + (i + 1) + '</b>' + esc(h.label) + '</button>'
  }).reverse().join('');
  $$('#histPop button').forEach(function(b) {
    b.onclick = function() {
      goto(+b.dataset.i);
      $('#histPop').classList.remove('on')
    }
  });
  syncCurves();
  syncGrade();
  if (tab === 'masks') renderMasks();
  updDims()
}
$('#bUndo').onclick = undo;
$('#bRedo').onclick = redo;
$('#bHist').onclick = function(e) {
  e.stopPropagation();
  $('#histPop').classList.toggle('on')
};
document.addEventListener('click', function(e) {
  if (!e.target.closest('#histPop') && !e.target.closest('#bHist')) $('#histPop').classList.remove('on')
});
$('#bOpen').onclick = $('#upload').onclick = function() {
  $('#file').click()
};
$('#file').onchange = function() {
  setAdd(Array.prototype.slice.call(this.files));
  this.value = ''
};
var dc = 0;
stage.addEventListener('dragenter', function(e) {
  e.preventDefault();
  dc++;
  $('#drop').classList.add('on')
});
stage.addEventListener('dragleave', function() {
  if (--dc <= 0) {
    dc = 0;
    $('#drop').classList.remove('on')
  }
});
stage.addEventListener('dragover', function(e) {
  e.preventDefault()
});
stage.addEventListener('drop', function(e) {
  e.preventDefault();
  dc = 0;
  $('#drop').classList.remove('on');
  var fs = Array.prototype.slice.call(e.dataTransfer.files);
  if (fs.length && fs.every(isCube)) importCubes(fs);
  else setAdd(fs)
});
document.addEventListener('keydown', function(e) {
  var typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && document.activeElement.type !== 'range';
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !typing) {
    e.preventDefault();
    e.shiftKey ? redo() : undo();
    return
  }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y' && !typing) {
    e.preventDefault();
    redo();
    return
  }
  // Zoom keys; Ctrl/Cmd with + − 0 zooms the photo rather than the page.
  if (!typing && afterC.width && (e.key === '+' || e.key === '=' || e.key === '-' || e.key === '_' || e.key === '0' || !e.metaKey && !e.ctrlKey && (e.key === '1' || e.key === '2'))) {
    e.preventDefault();
    if (e.key === '+' || e.key === '=') zoomStep(1);
    else if (e.key === '-' || e.key === '_') zoomStep(-1);
    else zoomTo(e.key === '0' ? 'fit' : +e.key);
    return
  }
  if (typing || e.metaKey || e.ctrlKey) return;
  if (e.key === 'b' || e.key === 'B') $('#bSplit').click();
  if (e.key === 'l' || e.key === 'L') $('#bLoupe').click();
  if (e.key === 'h' || e.key === 'H') $('#bHisto').click();
  if ((e.key === 'v' || e.key === 'V') && work) saveVersion();
  if (e.key === 'Escape' && cmpVer) compareVersion(null);
  if ((e.key === 'o' || e.key === 'O') && tab === 'masks') $('#ovSw').click();
  if (e.key === 'Enter' && tab === 'crop') $('#bCropDone').click();
  if (e.key === 'Escape') $('#expM').classList.remove('on')
});
/* export */
var ex = {
    f: 'png',
    q: 92,
    s: 1
  },
  syncExF = seg('#exF', 'v', function() {
    return ex.f
  }, function(v) {
    ex.f = v;
    expUI()
  }),
  syncExS = seg('#exS', 'v', function() {
    return ex.s
  }, function(v) {
    ex.s = +v;
    expUI()
  });
mkSlider($('#exQ'), {
  label: 'JPEG quality',
  min: 50,
  max: 100,
  def: 92,
  get: function() {
    return ex.q
  },
  set: function(v) {
    ex.q = v
  },
  commit: function() {},
  live: false
});

function geoDims(w, h, g) {
  var G = P.geoMap(w, h, g);
  return [G.w, G.h]
}

function outSize() {
  var g = geoDims(full.w, full.h, S.geo);
  return ex.s > 1 ? P.upSize(g[0], g[1], ex.s) : g
}

function expUI() {
  syncExF();
  syncExS();
  $('#exQ').style.display = ex.f === 'jpeg' ? '' : 'none';
  if (!full) return;
  var o = outSize();
  $('#exInfo').innerHTML = '<span>Output</span><b>' + o[0] + ' × ' + o[1] + ' px</b><em>' + ex.f.toUpperCase() + '</em>'
}
$('#bExport').onclick = function() {
  if (!full) return;
  ex.s = S.up.on ? S.up.f : 1;
  expUI();
  var g = $('#exGo');
  if (!g.disabled) {
    g.textContent = 'Download';
    g.onclick = exportGo
  }
  $('#expM').classList.add('on')
};
$('#exCancel').onclick = function() {
  if ($('#exGo').disabled) aiCancel();
  closeExport()
};
$('#expM').onclick = function(e) {
  if (e.target === this && !$('#exGo').disabled) closeExport()
};
function downloadBlob(blob, name) {
  var a = document.createElement('a'),
    u = URL.createObjectURL(blob);
  a.href = u;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function() {
    URL.revokeObjectURL(u)
  }, 4000)
}

function closeExport() {
  var b = $('#exGo');
  $('#expM').classList.remove('on');
  b.disabled = false;
  b.textContent = 'Download';
  b.onclick = exportGo
}
$('#exGo').onclick = exportGo;

function exportGo() {
  var b = this;
  b.disabled = true;
  b.textContent = 'Rendering…';
  var st = clone(S),
    ai = ex.s > 1 && isAI(st.up.k);
  st.up.f = ex.s;
  job({
    type: 'render',
    key: 'full',
    st: st,
    up: ex.s > 1 && !ai,
    cache: false
  }).then(function(m) {
    return ai ? aiUpscaleCached(m, st, 'full', function(p, label) {
      b.textContent = label
    }) : m
  }).then(function(m) {
    return typeof textsReady === 'function' ? textsReady(st.texts || []).then(function() {
      return m
    }) : m
  }).then(function(m) {
    var c = document.createElement('canvas');
    putC(c, m);
    if (typeof paintTexts === 'function') paintTexts(c, st.texts || []);
    c.toBlob(function(blob) {
      c.width = c.height = 0; // let the phone free the canvas memory now
      if (!blob) {
        toast('Export failed: the photo is too large for this device. Try Original size.', 5000);
        b.disabled = false;
        b.textContent = 'Download';
        return
      }
      var name = (fileName.replace(/\.[^.]+$/, '') || 'photo') + '-studio-de-nuance' + (ex.s > 1 ? '-' + ex.s + 'x' : '') + '.' + (ex.f === 'png' ? 'png' : 'jpg');
      toast('Exported ' + m.w + '×' + m.h + ' ' + ex.f.toUpperCase());
      var file = null;
      try {
        file = new File([blob], name, {
          type: blob.type
        })
      } catch (er) {}
      // On phones, a download link leaves the editor (or does nothing in the
      // installed app), so offer the share sheet instead: "Save Image" puts it in Photos.
      // The share sheet needs a fresh tap, so the button waits for one.
      if (LOWMEM && file && navigator.canShare && navigator.canShare({
          files: [file]
        })) {
        b.disabled = false;
        b.textContent = 'Save to Photos';
        b.onclick = function() {
          navigator.share({
            files: [file]
          }).then(function() {
            closeExport()
          }, function(er) {
            if (er && er.name === 'AbortError') return; // the user closed the share sheet
            downloadBlob(blob, name);
            closeExport()
          })
        };
        return
      }
      downloadBlob(blob, name);
      closeExport()
    }, 'image/' + ex.f, ex.q / 100)
  }).catch(function(e) {
    toast(isAbort(e) ? 'Export cancelled' : 'Export failed: ' + e.message);
    b.disabled = false;
    b.textContent = 'Download'
  })
}

/* boot */
renderMine();
window.__lumen = {
  P: P,
  parsePrompt: parsePrompt,
  applySteps: applySteps,
  get S() {
    return S
  },
  get hist() {
    return hist
  },
  get hix() {
    return hix
  },
  afterC: afterC,
  undo: undo,
  redo: redo,
  schedule: schedule,
  isBusy: function() {
    return busy
  }
};
