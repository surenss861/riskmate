# Supabase Auth Refresh Token Fix

**Prevents "Invalid Refresh Token" errors from breaking the UI**

---

## ✅ What Was Fixed

### 1. **Safe Refresh Handling** ✅
- Added `safeGetSession()` helper that handles refresh token errors gracefully
- Refresh token errors → sign out locally → continue as guest (no UI break)
- Added to `lib/supabase/client.ts`

### 2. **Global Auth State Listener** ✅
- Added `onAuthStateChange` listener to handle session state changes
- Automatically clears stale session state on refresh failures
- Prevents auth errors from propagating

### 3. **Error Handling in Key Places** ✅
- `lib/api.ts` - `getAuthToken()` now handles refresh token errors
- `components/ProtectedRoute.tsx` - `checkSession()` handles refresh token errors
- Both sign out locally and continue as guest (no fatal errors)

### 4. **Pricing Page Protection** ✅
- Pricing page doesn't require auth (already public)
- No auth provider wrapping that could break render
- Safe to load even if auth is broken

---

## 🔧 Changes Made

### `lib/supabase/client.ts`
- Added `storageKey: 'riskmate.auth'` for consistent storage
- Added `onAuthStateChange` listener for global refresh handling
- Added `safeGetSession()` helper function

### `lib/api.ts`
- Updated `getAuthToken()` to handle refresh token errors
- Signs out locally on refresh token failure
- Returns null gracefully (doesn't throw)

### `components/ProtectedRoute.tsx`
- Updated `checkSession()` to handle refresh token errors
- Signs out locally and redirects to login
- Doesn't block render on auth errors

---

## 🚨 Common Causes of Refresh Token Errors

1. **Stale Cookies/Storage**
   - Changed domains (preview → production)
   - Changed `storageKey` in client config
   - Switched between cookie/localStorage auth

2. **Wrong Supabase Project**
   - Refresh token from Project A, but app points to Project B
   - Check `NEXT_PUBLIC_SUPABASE_URL` matches expected project

3. **Service Worker Cache**
   - Old JS cached with old config
   - Hard reload or clear cache

4. **Session Persistence Path**
   - Using `@supabase/ssr` (cookies) vs `@supabase/supabase-js` (localStorage)
   - Mixed usage causes conflicts

---

## ✅ Verification Steps

### 1. Test in Incognito
- Open incognito window
- Load site
- If error is gone → it's stale storage/cookies

### 2. Clear Site Data
- Open DevTools → Application → Storage
- Clear cookies + localStorage for `riskmate.dev`
- Hard reload (Cmd+Shift+R)

### 3. Verify Environment Variables
```bash
# Check these match your Supabase project
NEXT_PUBLIC_SUPABASE_URL=https://xwxghdu...supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
```

### 4. Test Refresh Token Error Handling
- Manually clear refresh token from storage
- Try to access protected route
- Should redirect to login (not break UI)

---

## 📊 Expected Behavior

### Before Fix
- ❌ Refresh token error → fatal error → page breaks
- ❌ User stuck in loading state
- ❌ Pricing page might break if auth provider fails

### After Fix
- ✅ Refresh token error → sign out locally → continue as guest
- ✅ User redirected to login (smooth UX)
- ✅ Pricing page always renders (public, no auth required)
- ✅ No fatal errors, no broken UI

---

## 🔍 Debugging

### Check Auth State
```typescript
const supabase = createSupabaseBrowserClient()
const { data: { session }, error } = await supabase.auth.getSession()

if (error?.message?.toLowerCase().includes('refresh token')) {
  console.log('Refresh token invalid - will sign out')
}
```

### Check Storage
```javascript
// In browser console
localStorage.getItem('riskmate.auth')
// Should be null or valid session JSON
```

### Check Cookies
```javascript
// In browser console
document.cookie
// Should include Supabase auth cookies
```

---

**Status**: ✅ **Fixed - Auth errors no longer break UI**

The app now handles refresh token errors gracefully:
- Signs out locally on refresh failure
- Continues as guest (no fatal errors)
- Pricing page always renders (public)
- Smooth UX even when auth is broken
