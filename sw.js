"use strict";

const CACHE = "gyosei-quest-v4";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./srs.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./data/gyoseiho.js",
  "./data/gyoseiho2.js",
  "./data/minpo.js",
  "./data/minpo2.js",
  "./data/kenpo.js",
  "./data/shoho.js",
  "./data/kisochishiki.js",
  "./data/bunsho.js",
  "./data/kijutsu.js",
  "./data/tashi.js",
  "./data/suji.js",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ネットワーク優先(オンライン時は常に最新、オフライン時はキャッシュ)
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
