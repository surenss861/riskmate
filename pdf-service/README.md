# PDF Service

Self-hosted PDF generation service using Playwright in Docker. This eliminates dependency on Browserless and gives you full control over PDF generation.

## Architecture

```
Vercel (Next.js) → PDF Service (Docker) → Returns PDF Buffer → Vercel uploads to storage
```

## Features

- ✅ Full control over Chromium/Playwright
- ✅ No third-party rate limits
- ✅ Stable Docker environment (no serverless /tmp issues)
- ✅ JWT/HMAC authentication
- ✅ Simple REST API

## Setup

### 1. Deploy to Fly.io (Recommended)

```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Launch (creates fly.toml)
fly launch

# Deploy
fly deploy
```

### 2. Deploy to Render

1. Connect your GitHub repo
2. Select "Web Service"
3. Set:
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
   - Environment: Docker

### 3. Deploy to Railway

1. Connect GitHub repo
2. Railway auto-detects Dockerfile
3. Add environment variables
4. Deploy

## Environment Variables

```bash
# Required
PDF_SERVICE_SECRET=your-secret-key-for-hmac-auth

# Optional
PORT=3000
NODE_ENV=production
```

## API

### POST /generate

Generate PDF from URL.

**Request:**
```json
{
  "url": "https://your-app.com/reports/packet/print/runId?token=...",
  "requestId": "optional-request-id"
}
```

**Headers:**
```
Authorization: Bearer <JWT or HMAC token>
```

**Response:**
- Success (200): PDF buffer (application/pdf)
- Error (400/500): JSON error object

## Authentication

The service uses HMAC authentication. Generate tokens on your Vercel side:

```typescript
import crypto from 'crypto'

function generateAuthToken(secret: string, requestId: string): string {
  const timestamp = Date.now()
  const message = `${requestId}:${timestamp}`
  const hmac = crypto.createHmac('sha256', secret).update(message).digest('hex')
  return `${timestamp}:${hmac}`
}
```

## Usage in Vercel

Update your `generatePdfRemote` function to call your service instead of Browserless:

```typescript
const PDF_SERVICE_URL = process.env.PDF_SERVICE_URL // e.g., https://pdf-service.fly.dev
const PDF_SERVICE_SECRET = process.env.PDF_SERVICE_SECRET

const authToken = generateAuthToken(PDF_SERVICE_SECRET, requestId)

const response = await fetch(`${PDF_SERVICE_URL}/generate`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`,
  },
  body: JSON.stringify({ url, requestId }),
})

if (!response.ok) {
  throw new Error(`PDF service failed: ${response.statusText}`)
}

const pdfBuffer = Buffer.from(await response.arrayBuffer())
```

## Cost Comparison

- **Browserless**: $75-300/month (depending on usage)
- **Self-hosted (Fly.io)**: ~$5-20/month (small instance)
- **Self-hosted (Render)**: ~$7-25/month (starter plan)
- **Self-hosted (Railway)**: ~$5-20/month (hobby plan)

## Benefits

1. **No rate limits** - You control concurrency
2. **Full control** - Customize Chromium args, timeouts, etc.
3. **Predictable costs** - Fixed monthly cost vs. usage-based
4. **Privacy** - PDFs never leave your infrastructure
5. **Reliability** - No third-party outages

