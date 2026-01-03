# PDF Service Setup Guide

## Overview

The PDF generation service is self-hosted on Fly.io to avoid serverless Chromium issues and third-party rate limits.

## Service Details

- **Service URL**: `https://pdf-service-dawn-silence-4921.fly.dev`
- **Health Endpoint**: `https://pdf-service-dawn-silence-4921.fly.dev/health`
- **Generate Endpoint**: `https://pdf-service-dawn-silence-4921.fly.dev/generate`

## Vercel Environment Variables

Set these in **Vercel Dashboard → Project → Settings → Environment Variables**:

```
PDF_SERVICE_URL = https://pdf-service-dawn-silence-4921.fly.dev
PDF_SERVICE_SECRET = 151bf8598584fbfe2dd4753d1fa56ec1939af8dc0efde65a83df03a357e1e0bf
```

**Important**: 
- Apply to **Production**, **Preview**, and **Development** environments
- **Redeploy** after setting variables (or wait for next auto-deploy)

## How It Works

1. Vercel app calls `/api/reports/generate/[id]`
2. Route checks for `PDF_SERVICE_URL` + `PDF_SERVICE_SECRET` (preferred)
3. Falls back to `BROWSERLESS_TOKEN` if self-hosted not configured
4. Generates HMAC auth token using `PDF_SERVICE_SECRET`
5. Calls PDF service `/generate` endpoint with signed token
6. PDF service renders the page with Playwright and returns PDF buffer
7. Vercel uploads PDF to Supabase storage and returns signed URL

## Authentication

The service uses HMAC-SHA256 authentication:
- Format: `timestamp:hmac_hex`
- Message: `{requestId}:{timestamp}`
- Secret: `PDF_SERVICE_SECRET` (must match on both Vercel and Fly.io)

## Testing

### Test Health Endpoint
```bash
curl https://pdf-service-dawn-silence-4921.fly.dev/health
```

### Test Authentication (from pdf-service directory)
```bash
cd pdf-service
node test-auth.js
```

### Test from Vercel App
1. Set environment variables in Vercel
2. Redeploy
3. Generate a PDF report from the app
4. Check response headers for `X-PDF-Method: self-hosted`
5. Check Vercel logs for `[stage] call_pdf_service_ok`

## Troubleshooting

### Service Not Responding
```bash
cd pdf-service
fly status
fly logs
```

### Authentication Failures
- Verify `PDF_SERVICE_SECRET` matches on both Vercel and Fly.io
- Check Fly.io secrets: `fly secrets list`
- Update Fly.io secret: `fly secrets set PDF_SERVICE_SECRET=<new-secret>`

### PDF Generation Fails
- Check Vercel logs for `[stage] call_pdf_service_failed`
- Check Fly.io logs: `fly logs`
- Verify the render URL is accessible (no auth redirects)

## Monitoring

- **Fly.io Dashboard**: https://fly.io/apps/pdf-service-dawn-silence-4921
- **Vercel Logs**: Check function logs for `[stage]` markers
- **Response Headers**: Look for `X-PDF-Method: self-hosted` in successful responses

## Cost

- Fly.io free tier: 3 shared-cpu VMs, 256MB RAM each
- This service uses 2 VMs (high availability)
- Estimated cost: **$0/month** (within free tier limits)

## Maintenance

### Update Service Code
```bash
cd pdf-service
# Make changes to server.js, package.json, etc.
fly deploy
```

### View Logs
```bash
cd pdf-service
fly logs
```

### Restart Service
```bash
cd pdf-service
fly apps restart pdf-service-dawn-silence-4921
```

