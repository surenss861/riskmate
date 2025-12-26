# HTML-Based PDF Generation Setup

This project uses **HTML-to-PDF** generation instead of PDFKit for better styling control and easier maintenance.

## Architecture

- **Print Route**: `/reports/[id]/print` - Renders report as HTML optimized for printing
- **PDF API**: `/api/reports/[id]/pdf` - Uses Playwright to convert HTML to PDF

## Setup

### 1. Install Playwright

```bash
npm install playwright @playwright/test --save-dev
```

### 2. Install Chromium Browser

```bash
npx playwright install chromium
```

### 3. Environment Variables

Add to `.env.local`:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000  # or your production URL
```

## Usage

### Generate PDF via API

```typescript
const response = await fetch('/api/reports/[jobId]/pdf', {
  method: 'POST',
})

const pdfBlob = await response.blob()
// Download or display PDF
```

### View Print Preview

Navigate to `/reports/[jobId]/print` in browser to see the print-friendly version.

Users can also use browser's "Print to PDF" feature directly.

## Benefits Over PDFKit

✅ **Better Styling**: Uses Tailwind + CSS (your actual design system)  
✅ **Easier Maintenance**: HTML/CSS instead of PDFKit drawing commands  
✅ **No Font Issues**: Browser handles fonts automatically  
✅ **Better Layout**: CSS Grid/Flexbox instead of manual positioning  
✅ **Print Preview**: Users can preview before exporting  

## Production Considerations

### Option 1: Playwright on Vercel (Current)

- Works but adds ~50MB to deployment
- May have cold start delays
- Consider using Vercel Edge Functions with smaller bundle

### Option 2: External Service (Recommended for Scale)

Use a service like:
- **Browserless.io** - Managed headless browser service
- **Render.com** - HTML-to-PDF API
- **Puppeteer-as-a-Service** - Self-hosted option

Update `/api/reports/[id]/pdf/route.ts` to call external service instead of local Playwright.

### Option 3: Client-Side Export (Simplest)

For MVP, users can visit `/reports/[id]/print` and use browser's "Print to PDF" feature.

## Security

The print route uses token-based access. In production:

1. Generate signed tokens with expiration
2. Store tokens in Redis/database
3. Validate tokens in print route
4. Don't rely on cookies (headless browser won't have them)

## Troubleshooting

**Error: "Playwright not installed"**
- Run: `npm install playwright @playwright/test --save-dev`
- Then: `npx playwright install chromium`

**Error: "Browser launch failed"**
- Check serverless environment supports headless Chrome
- May need to use external service (Browserless.io)

**PDF looks different than HTML**
- Check `@page` CSS rules
- Verify `print-color-adjust: exact` is set
- Test in browser print preview first

