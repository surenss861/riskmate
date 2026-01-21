# Squarespace DNS Setup for RiskMate

**Complete DNS configuration guide for Squarespace domains**

---

## 🎯 What You Need

- `riskmate.dev` (apex) → Vercel
- `www.riskmate.dev` → Vercel (redirects to apex)
- `api.riskmate.dev` → Railway

---

## 📋 Step 1: Get DNS Values

### Vercel DNS Records

1. Go to Vercel → Project → Settings → Domains
2. Add `riskmate.dev` and `www.riskmate.dev`
3. Vercel will show you DNS records:
   - **Apex (riskmate.dev)**: A record(s) with IP address(es)
   - **www**: CNAME → `cname.vercel-dns.com`

**Example**:
```
Type: A
Name: @
Value: 76.76.21.21
```

### Railway DNS Record

1. Go to Railway → Service → Settings → Domains
2. Add custom domain: `api.riskmate.dev`
3. Railway will show you:
   - **CNAME**: `api` → `[your-service].up.railway.app`

**Example**:
```
Type: CNAME
Name: api
Value: your-backend-production.up.railway.app
```

---

## 🔧 Step 2: Configure Squarespace DNS

### In Squarespace Domains

1. Go to Squarespace → Settings → Domains
2. Select `riskmate.dev`
3. Click "DNS Settings" or "Advanced DNS"

### Add Records

**Apex Domain (riskmate.dev)**:
```
Type: A
Host: @
Points to: [Vercel IP address]
TTL: 3600 (or default)
```

**www Subdomain**:
```
Type: CNAME
Host: www
Points to: cname.vercel-dns.com
TTL: 3600 (or default)
```

**api Subdomain**:
```
Type: CNAME
Host: api
Points to: [Railway domain].up.railway.app
TTL: 3600 (or default)
```

---

## ⏱️ Step 3: Wait for DNS Propagation

**Time**: 5-30 minutes (usually 5-10 minutes)

**Check propagation**:
```bash
# Check apex
dig riskmate.dev

# Check www
dig www.riskmate.dev

# Check api
dig api.riskmate.dev
```

**Or use online tool**: [dnschecker.org](https://dnschecker.org)

---

## ✅ Step 4: Verify Everything Works

### Vercel

1. **Apex domain**:
   ```bash
   curl -I https://riskmate.dev
   # Expected: 200 OK, SSL green lock
   ```

2. **www redirect**:
   ```bash
   curl -I https://www.riskmate.dev
   # Expected: 301 redirect to https://riskmate.dev
   ```

3. **In Vercel Dashboard**:
   - Both domains show "Valid Configuration"
   - SSL certificates issued (green checkmarks)

### Railway

1. **API domain**:
   ```bash
   curl https://api.riskmate.dev/health
   # Expected: {"status":"ok"}
   ```

2. **In Railway Dashboard**:
   - Custom domain shows "Active"
   - SSL certificate issued

---

## 🔒 Step 5: Set Canonical Redirect (Vercel)

**In Vercel → Project → Settings → Domains**:

1. Set `riskmate.dev` as **Primary Domain**
2. `www.riskmate.dev` will automatically redirect to `riskmate.dev`

**Or in `next.config.js`** (if you prefer code):

```javascript
async redirects() {
  return [
    {
      source: '/:path*',
      has: [{ type: 'host', value: 'www.riskmate.dev' }],
      destination: 'https://riskmate.dev/:path*',
      permanent: true,
    },
  ];
}
```

---

## 🚨 Troubleshooting

### DNS Not Propagating

**Check**:
- Records are saved in Squarespace
- TTL is reasonable (3600 seconds)
- No typos in domain values

**Wait**: Up to 48 hours for full global propagation (usually much faster)

### SSL Certificate Not Issuing

**Vercel**:
- Wait 5-10 minutes after DNS propagates
- Check Vercel dashboard for certificate status
- If stuck, remove and re-add domain

**Railway**:
- Wait 5-10 minutes after DNS propagates
- Check Railway dashboard for certificate status
- If stuck, remove and re-add custom domain

### CORS Errors

**Verify**:
- Backend `CORS_ORIGINS` includes both:
  - `https://riskmate.dev`
  - `https://www.riskmate.dev`

**Test**:
```javascript
// In browser console on riskmate.dev
fetch('https://api.riskmate.dev/health')
  .then(r => r.json())
  .then(console.log);
// Should work without CORS errors
```

---

## 📝 DNS Records Summary

**Squarespace DNS Records**:

| Type | Host | Points To | Purpose |
|------|------|-----------|---------|
| A | @ | `76.76.21.21` (Vercel IP) | Apex domain → Vercel |
| CNAME | www | `cname.vercel-dns.com` | www → Vercel |
| CNAME | api | `[service].up.railway.app` | api → Railway |

---

**After DNS propagates, all three domains should work with SSL.** ✅
