const CACHE_NAME = 'somnawave-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/variables.css',
  './css/base.css',
  './css/components.css',
  './css/screens.css',
  './js/app.js',
  './js/audio/audioEngine.js',
  './js/audio/binaural.js',
  './js/audio/noiseGen.js',
  './js/audio/isochronic.js',
  './js/audio/nature.js',
  './js/biometrics/wearableService.js',
  './js/biometrics/bioSimulator.js',
  './js/masking/ambientMasker.js',
  './js/visualizers/waveform.js',
  './js/visualizers/analyticsCharts.js',
  './js/analytics/sleepEngine.js',
  './js/mixer/mixerService.js',
  './assets/icons/icon-192.svg',
  './assets/icons/icon-512.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request);
    }).catch(() => caches.match('./index.html'))
  );
});
