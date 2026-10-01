const CACHE_NAME = 'fiber-report-v1';
const urlsToCache = [
  './',
  './index.html',
  './vendor/fontawesome/css/all.min.css',
  './vendor/fontawesome/webfonts/fa-brands-400.woff2',
  './vendor/fontawesome/webfonts/fa-regular-400.woff2',
  './vendor/fontawesome/webfonts/fa-solid-900.woff2',
  './vendor/fontawesome/webfonts/fa-v4compatibility.woff2',
  './css/main.css',
  './css/reports.css',
  './css/responsive.css',
  './js/vendor/xlsx.full.min.js',
  './js/vendor/jalali-moment.browser.js',
  './js/app.js',
  './js/core/helpers.js',
  './js/core/login.js',
  './js/core/navigation.js',
  './js/core/reports.js',
  './js/core/storage.js',
  './js/core/validation.js',
  './js/reports/drop.js',
  './js/reports/fat.js',
  './js/reports/fusion.js',
  './js/reports/omran.js',
  './js/reports/shoot.js',
 
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});