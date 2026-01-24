# Clear Service Worker Cache

If you're experiencing issues with the thank-you page looping or old JavaScript running, clear the service worker cache:

## Quick Fix (Browser DevTools)

1. Open DevTools (F12 or Cmd+Option+I)
2. Go to **Application** tab (Chrome) or **Storage** tab (Firefox)
3. Click **Service Workers** in the left sidebar
4. Find the RiskMate service worker
5. Click **Unregister**
6. Check **"Update on reload"** if available
7. Go to **Cache Storage** → Delete all `riskmate-*` caches
8. Hard reload: **Cmd+Shift+R** (Mac) or **Ctrl+Shift+R** (Windows/Linux)

## Alternative: Clear All Site Data

1. DevTools → **Application** tab
2. Click **Clear storage** in the left sidebar
3. Check **"Cache storage"** and **"Service workers"**
4. Click **Clear site data**
5. Hard reload the page

## Why This Happens

The service worker caches JavaScript files for offline support. When you deploy new code:
- Old cached JS may still run
- React StrictMode can cause double renders
- The thank-you page may loop if old code is cached

## Prevention

The service worker now:
- Bumps cache version on updates (`riskmate-v2`)
- Never caches `/api/*` routes
- Never caches `/pricing/thank-you` page
- Automatically cleans up old caches on activate

After clearing cache, the new code will run and the loop should stop.
