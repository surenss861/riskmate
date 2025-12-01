/**
 * Service Worker for Offline Support
 * 
 * Basic offline caching for RiskMate PWA functionality.
 */

const CACHE_NAME = 'riskmate-v1'
const urlsToCache = [
  '/',
  '/dashboard',
  '/dashboard/jobs',
  '/offline',
]

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache)
    })
  )
})

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Return cached version or fetch from network
      return response || fetch(event.request).catch(() => {
        // If offline and not in cache, return offline page
        if (event.request.destination === 'document') {
          return caches.match('/offline')
        }
      })
    })
  )
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
})

