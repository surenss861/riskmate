# PDFKit Font Fix Verification Checklist

## Status: ✅ All Checks Passed

**Latest Commit:** `c002371` - "fix: Move outputFileTracingIncludes out of experimental (Next.js 15+)"

---

## ✅ Verification Results

### 1. Runtime Configuration ✅
All PDF generation routes have `export const runtime = 'nodejs'`:
- ✅ `/api/reports/generate/[id]/route.ts`
- ✅ `/api/proof-packs/route.ts`
- ✅ `/api/audit/export/route.ts`
- ✅ `/api/enforcement-reports/export/route.ts`
- ✅ `/api/sample-report/route.ts`

### 2. Next.js Configuration ✅
- ✅ `serverExternalPackages: ['pdfkit']` - PDFKit is externalized (not bundled)
- ✅ `outputFileTracingIncludes` - AFM files included in serverless bundle
- ✅ Config moved out of `experimental` (Next.js 15+ requirement)

### 3. Latest Commit ✅
Current commit: `c002371` includes all PDFKit fixes

---

## 🚀 Next Steps (Post-Deploy Verification)

### Step 1: Confirm Vercel Deployment
1. Go to Vercel Dashboard → Deployments → Production
2. Verify "Source" is commit `c002371` (or newer)
3. If not, trigger a new deployment

### Step 2: Test PDF Generation
1. Navigate to a job detail page
2. Click "Export PDF" or generate a report
3. **Expected:** PDF downloads successfully (200 status)

### Step 3: Check Vercel Logs
1. Go to Vercel → Functions → Logs
2. Filter by the PDF route (e.g., `/api/reports/generate/[id]`)
3. Look for font path references

**What to look for:**
- ✅ **Good:** Font path should be under `node_modules/pdfkit/js/data/` (or no font errors)
- ❌ **Bad:** If you see `/var/task/.next/server/chunks/data/Helvetica.afm` → PDFKit is still being bundled

### Step 4: If Still Failing

If PDF generation still fails with `ENOENT` errors:

**Option A:** Use global tracing pattern (more aggressive)
```javascript
outputFileTracingIncludes: {
  '/*': ['node_modules/pdfkit/js/data/*.afm'],
},
```

**Option B:** Check Vercel logs for exact error path
- Note the exact path PDFKit is trying to read
- Verify if it's under `node_modules` or still in `chunks`

---

## 🔒 Security Reminder

⚠️ **IMPORTANT:** You pasted a bearer token earlier in chat.

**Action Required:**
1. Go to Supabase Dashboard → Authentication → Sessions
2. Revoke all active sessions for your account
3. Log out and log back in
4. Generate new tokens if needed

---

## 📋 What Was Fixed

1. **Externalized PDFKit** - Prevents bundling issues with font paths
2. **Included AFM Files** - Ensures font metric files are in serverless bundle
3. **Node Runtime** - All PDF routes use Node.js runtime (not Edge)
4. **Config Updated** - Moved `outputFileTracingIncludes` to top-level (Next.js 15+)

---

## Expected Behavior (If Fixed)

✅ PDF generation returns 200 or file download  
✅ No `ENOENT` errors for `Helvetica.afm`  
✅ Vercel logs show PDFKit resolving fonts from `node_modules/pdfkit/js/data/`  
✅ No warnings about missing font files

---

## Troubleshooting

If issues persist:

1. **Check deployment commit** - Must be `c002371` or newer
2. **Check runtime** - All PDF routes must have `export const runtime = 'nodejs'`
3. **Check logs** - Verify font path is under `node_modules`, not `chunks`
4. **Try global pattern** - Use `'/*'` in `outputFileTracingIncludes` if route-specific doesn't work
5. **Clear Vercel cache** - Sometimes old builds persist; clear cache and redeploy

