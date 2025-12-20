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
      // Use Promise.allSettled to prevent one failure from breaking the entire cache
      // Filter out API routes and external URLs that shouldn't be cached
      const cacheableUrls = urlsToCache.filter(url => {
        try {
          const urlObj = new URL(url, self.location.origin)
          // Exclude API routes
          if (urlObj.pathname.startsWith('/api/')) return false
          // Exclude Supabase/external domains
          if (!urlObj.hostname.includes(self.location.hostname)) return false
          return true
        } catch {
          return false
        }
      })
      
      const results = await Promise.allSettled(
        cacheableUrls.map(url => cache.add(url))
      )
      
      // Log failures but don't throw
      const failures = results
        .map((result, index) => ({ result, url: cacheableUrls[index] }))
        .filter(({ result }) => result.status === 'rejected')
      
      if (failures.length > 0) {
        console.warn('[SW] Failed to cache some URLs:', failures.map(f => f.url))
      }
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

