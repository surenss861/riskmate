# Supabase Singleton Audit

**Verification that there's exactly ONE browser client and ONE auth listener**

---

## ✅ Client Creation Audit

### Browser Client (Client-Side Only)
- ✅ `lib/supabase/client.ts` - **SINGLETON** - Only place that creates browser client
- ✅ Uses `globalThis.__supabase__` caching
- ✅ All client-side code uses `createSupabaseBrowserClient()` or `getSupabaseClient()`

### Service Role Clients (Server-Side Only - OK)
- ✅ `lib/billingMonitoring.ts` - Service role (server-side)
- ✅ `lib/funnelTracking.ts` - Service role (server-side)
- ✅ `lib/supabase/admin.ts` - Service role (server-side)
- ✅ `app/api/*` routes - Service role (server-side)

**Verdict:** ✅ **SAFE** - No duplicate browser clients found

---

## ✅ Auth Listener Audit

### Listener Attachment Points
- ✅ `lib/supabase/authListener.ts` - `ensureAuthListener()` function
- ✅ `components/AuthProvider.tsx` - Calls `ensureAuthListener()` once
- ✅ `app/layout.tsx` - Wraps app with `<AuthProvider>` (one-time initialization)

### Listener Guards
- ✅ `globalThis.__supabaseAuthListenerAttached__` prevents duplicate attachment
- ✅ Only attached in `AuthProvider` (root layout)
- ✅ No listeners in `client.ts` (removed)
- ✅ No listeners in components (checked)

**Verdict:** ✅ **SAFE** - Listener attached exactly once

---

## ✅ Storage Key Verification

### All Browser Clients Use Same Storage Key
- ✅ `lib/supabase/client.ts` - `storageKey: 'riskmate.auth'`
- ✅ No other browser clients found with different storage keys

**Verdict:** ✅ **SAFE** - Single storage key, no split-brain auth state

---

## ✅ Server/Client Separation

### Server-Side Files (OK to use service role)
- ✅ `lib/billingMonitoring.ts` - Server-side only
- ✅ `lib/funnelTracking.ts` - Server-side only
- ✅ `lib/supabase/admin.ts` - Server-side only
- ✅ `app/api/*` routes - Server-side only

### Client-Side Files (Must use singleton)
- ✅ All components use `createSupabaseBrowserClient()` or `getSupabaseClient()`
- ✅ No direct `createClient()` calls in client components

**Verdict:** ✅ **SAFE** - Server/client separation maintained

---

## 🚨 Potential Issues Found

### None Found ✅
- No duplicate browser client creation
- No duplicate listener attachment
- No mixed storage keys
- No server/client mixing

---

## 📊 Final Verification Checklist

- [x] Only ONE browser client creator (`createSupabaseBrowserClient()`)
- [x] Singleton pattern with `globalThis.__supabase__` caching
- [x] Auth listener attached exactly once (`ensureAuthListener()`)
- [x] Listener only in `AuthProvider` (root layout)
- [x] All sign-out calls use `scope: 'local'` for refresh errors
- [x] Single storage key (`riskmate.auth`) everywhere
- [x] Server/client separation maintained
- [x] No `createClient()` in client components

---

## 🔍 Hard Guard (Dev-Only Warning)

If you want to catch duplicates in development, add this to `createSupabaseBrowserClient()`:

```typescript
if (typeof window !== 'undefined' && globalThis.__supabase__) {
  // Log warning in dev if somehow a second instance tries to create
  if (process.env.NODE_ENV === 'development') {
    console.warn('[Supabase] ⚠️ Attempted to create second client instance - using singleton')
  }
  return globalThis.__supabase__
}
```

**Status**: ✅ **Bulletproof - No duplication paths found**

The singleton implementation is correct and there are no alternate client creation paths.
