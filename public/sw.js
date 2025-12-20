/**
 * Service Worker for Offline Support
 * 
 * Basic offline caching for RiskMate PWA functionality.
 */

const CACHE_NAME = 'riskmate-v1'
const urlsToCache = [
  '/',
  '/operations',
  '/operations/audit',
  '/operations/jobs',
  // Removed /offline - route doesn't exist, causes cache.add() failures
]

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE_NAME)
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
        cacheableUrls.map(url => cache.add(url).catch(e => {
          console.warn(`[SW] Failed to cache ${url}:`, e.message)
          throw e
        }))
      )
      
      // Log failures but don't throw
      const failures = results
        .map((result, index) => ({ result, url: cacheableUrls[index] }))
        .filter(({ result }) => result.status === 'rejected')
      
      if (failures.length > 0) {
        console.warn('[SW] Failed to cache some URLs:', failures.map(f => f.url))
      }
      
      // Skip waiting to activate immediately
      await self.skipWaiting()
    } catch (error) {
      console.error('[SW] Install failed:', error)
    }
  })())
})

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  
  // Never cache or intercept API routes and external requests
  if (url.pathname.startsWith('/api/') || 
      url.hostname.includes('supabase.co') ||
      url.hostname.includes('posthog.com') ||
      url.hostname.includes('stripe.com')) {
    return // Let the browser handle it normally (no caching, no interception)
  }

  event.respondWith((async () => {
    try {
      // Try cache first
      const cachedResponse = await caches.match(event.request)
      if (cachedResponse) {
        return cachedResponse
      }

      // Try network
      try {
        const networkResponse = await fetch(event.request)
        return networkResponse
      } catch (networkError) {
        // If offline and not in cache, return offline page for document requests
        if (event.request.destination === 'document') {
          const offlinePage = await caches.match('/offline')
          if (offlinePage) {
            return offlinePage
          }
        }
        // For other types of requests, throw the network error
        throw networkError
      }
    } catch (error) {
      console.error('[SW] Fetch error:', error)
      throw error
    }
  })())
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const cacheNames = await caches.keys()
      await Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName)
          }
        })
      )
      // Claim clients immediately
      await self.clients.claim()
    } catch (error) {
      console.error('[SW] Activate failed:', error)
    }
  })())
})

