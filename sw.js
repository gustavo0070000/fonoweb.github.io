// FonoPlayer PWA Service Worker for Offline App Shell Caching

const CACHE_NAME = "fonoplayer-static-v1.4";
const STATIC_ASSETS = [
    "./",
    "./index.html",
    "./style.css",
    "./app.js",
    "./manifest.json",
    "./meus_cds.json"
];

// Install Event: cache static shell assets
self.addEventListener("install", (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log("Caching static assets for FonoPlayer Web Shell...");
            return cache.addAll(STATIC_ASSETS);
        }).then(() => self.skipWaiting())
    );
});

// Activate Event: clean old static caches
self.addEventListener("activate", (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME && key !== "fonoplayer-audio-cache") {
                        console.log("Removing old cache version:", key);
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch Event: cache-first fallback to network for static files
self.addEventListener("fetch", (e) => {
    const url = new URL(e.request.url);
    
    // Ignore GitHub API calls, raw audios, and development hot reloads
    if (url.origin !== self.location.origin || e.request.method !== "GET") {
        return;
    }
    
    // Audio files are managed dynamically by app.js, skip interception
    if (url.pathname.includes("/Cds/") && url.pathname.endsWith(".wav")) {
        return;
    }

    e.respondWith(
        caches.match(e.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }
            
            return fetch(e.request).then((networkResponse) => {
                // Check valid response before caching
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                    return networkResponse;
                }
                
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(e.request, responseToCache);
                });
                
                return networkResponse;
            });
        }).catch(() => {
            // Fallback offline experience
            if (e.request.mode === 'navigate') {
                return caches.match('./index.html');
            }
        })
    );
});
