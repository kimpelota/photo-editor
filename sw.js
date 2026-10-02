/* ============================================================
   SERVICE WORKER: lets the installed app open and edit offline
   ============================================================ */
// The app's own files are fetched fresh when online (so updates show up straight away)
// and served from the cache when offline. Fonts, libraries and AI models from other
// sites are cached the first time they're used, so those features also work offline later.
var APP = 'nuance-app-v1',
  EXT = 'nuance-ext-v1';

// On install, cache the page and every local file it links to.
self.addEventListener('install', function(e) {
  e.waitUntil(caches.open(APP).then(function(c) {
    return fetch('./', {
      cache: 'no-store'
    }).then(function(r) {
      return r.clone().text().then(function(html) {
        var urls = ['./', 'manifest.webmanifest'],
          re = /(?:src|href)="((?:js|css|icons)\/[^"]+)"/g,
          m;
        while ((m = re.exec(html))) urls.push(m[1]);
        return c.put('./', r).then(function() {
          return c.addAll(urls.slice(1))
        })
      })
    })
  }).then(function() {
    return self.skipWaiting()
  }))
});

self.addEventListener('activate', function(e) {
  e.waitUntil(caches.keys().then(function(ks) {
    return Promise.all(ks.filter(function(k) {
      return k !== APP && k !== EXT
    }).map(function(k) {
      return caches.delete(k)
    }))
  }).then(function() {
    return self.clients.claim()
  }))
});

self.addEventListener('fetch', function(e) {
  var q = e.request;
  if (q.method !== 'GET') return;
  var u = new URL(q.url);
  if (u.origin === location.origin) {
    // network first, cache as a fallback
    e.respondWith(fetch(q).then(function(r) {
      if (r.ok) {
        var cp = r.clone();
        caches.open(APP).then(function(c) {
          c.put(q.mode === 'navigate' ? './' : q, cp)
        })
      }
      return r
    }).catch(function() {
      return caches.match(q.mode === 'navigate' ? './' : q, {
        ignoreSearch: q.mode === 'navigate'
      })
    }));
    return
  }
  if (!/fonts\.(googleapis|gstatic)\.com$|cdn\.jsdelivr\.net$|storage\.googleapis\.com$/.test(u.hostname)) return;
  // fonts, libraries and AI models: cache first, they never change at a given URL
  e.respondWith(caches.match(q).then(function(hit) {
    return hit || fetch(q).then(function(r) {
      if (r.ok || r.type === 'opaque') {
        var cp = r.clone();
        caches.open(EXT).then(function(c) {
          c.put(q, cp)
        })
      }
      return r
    })
  }))
});
