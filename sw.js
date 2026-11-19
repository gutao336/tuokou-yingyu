/* 脱口英语 v0.9 — 外壳文件走网络优先：以后每次发新版，用户下次打开直接拿到新文件，
   不再被旧 service worker 缓存困在旧版（v0.6 之前是“先读缓存”，旧版赖在 iPhone 上不走）。 */
var CACHE = 'tuokou-yingyu-v10';
var SHELL = [
  'index.html',
  'app.js',
  'style.css',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'starter-words.json'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (cache) {
      /* 一个一个加：某个文件失败也不影响其他文件进缓存 */
      return Promise.all(SHELL.map(function (url) {
        return cache.add(url).catch(function () {});
      }));
    }).catch(function () {})
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    })
  );
});

/* 外壳文件（页面、脚本、样式）走网络优先：先 fetch，拿到就用、顺手更新缓存；
   只有断网、网络出错时才读缓存。其余文件（图标、词包、manifest）保持先读缓存。 */
function isNetworkFirst(req) {
  var u;
  try { u = new URL(req.url); } catch (e) { return false; }
  var p = u.pathname;
  if (p === '/' || p === '') return true; /* 打开根地址就是 index.html */
  return p === '/index.html' || p === '/app.js' || p === '/style.css' ||
    p.endsWith('/index.html') || p.endsWith('/app.js') || p.endsWith('/style.css');
}

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  if (isNetworkFirst(e.request)) {
    e.respondWith(
      fetch(e.request).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) {
            cache.put(e.request, copy).catch(function () {});
          }).catch(function () {});
        }
        return res;
      }).catch(function () {
        return caches.match(e.request).then(function (hit) {
          return hit || caches.match('index.html');
        });
      })
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      return hit || fetch(e.request);
    }).catch(function () { return caches.match('index.html'); })
  );
});
