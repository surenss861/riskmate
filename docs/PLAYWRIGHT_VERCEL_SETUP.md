# Playwright Setup for Vercel

## Current Setup (Simple)

We're using the standard Playwright installation approach:

```json
{
  "dependencies": {
    "playwright": "^1.57.0"
  },
  "scripts": {
    "postinstall": "playwright install chromium || echo 'Playwright browser installation skipped (non-fatal)'"
  }
}
```

### Why this works:
- Playwright is in `dependencies` (not `devDependencies`) so Vercel installs it
- Postinstall script runs during `npm install` on Vercel
- Simplified command without `--with-deps` (avoids system dependency issues)
- Launch args already configured for serverless: `--no-sandbox`, `--disable-setuid-sandbox`, `--disable-gpu`, `--disable-dev-shm-usage`

## If This Still Fails

If you still see "Executable doesn't exist" errors after this fix, use the **serverless-optimized approach**:

### Option 1: playwright-core + @sparticuz/chromium (Recommended)

This is the most reliable solution for serverless environments:

```bash
npm uninstall playwright
npm install playwright-core @sparticuz/chromium
```

Then update `lib/utils/playwright.ts`:

```typescript
import playwright from 'playwright-core'
import chromium from '@sparticuz/chromium'

export async function generatePdfFromUrl({ url, jobId, organizationId }: PdfOptions): Promise<Buffer> {
  chromium.setGraphicsMode(false) // Important for serverless
  
  const browser = await playwright.chromium.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  })
  
  // ... rest of code
}
```

**Benefits:**
- No browser download during build (much faster)
- Pre-built serverless-compatible Chromium binary
- More reliable on Vercel/other serverless platforms

### Option 2: Browserless (Managed Service)

If you want zero maintenance, use Browserless API:

```typescript
export async function generatePdfFromUrl({ url }: PdfOptions): Promise<Buffer> {
  const response = await fetch('https://chrome.browserless.io/pdf?token=YOUR_TOKEN', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  
  return Buffer.from(await response.arrayBuffer())
}
```

**Benefits:**
- Zero maintenance
- Scales automatically
- No binary size in your deployment
- Paid service but very reliable

## Troubleshooting

### "Executable doesn't exist" error

1. Check Vercel build logs for postinstall output
2. Verify Playwright is in `dependencies` (not `devDependencies`)
3. Try removing `|| echo ...` from postinstall to see actual error
4. Check build logs for browser installation errors

### Build timeout

Playwright browser installation can take 1-2 minutes. If Vercel times out:
- Use playwright-core + @sparticuz/chromium (no build-time download)
- Or use Browserless (no build step needed)

### Runtime errors

If browser launches but crashes:
- Ensure all launch args are present: `--no-sandbox`, `--disable-setuid-sandbox`, `--disable-gpu`, `--disable-dev-shm-usage`
- Consider increasing function timeout (`maxDuration` is already set to 60s)

## Current Status

✅ Playwright in dependencies  
✅ Simplified postinstall (no --with-deps)  
✅ Serverless-compatible launch args  
✅ Error handling for missing browser  

If deployment still fails, implement Option 1 (playwright-core) above.

