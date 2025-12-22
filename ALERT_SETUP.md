# Executive Alert System Setup

## Environment Variables

Add these to your Vercel project settings (Production, Preview, Development):

### Required

```bash
# Cron authentication secret (generate a long random string)
EXEC_ALERT_CRON_SECRET=your-long-random-secret-here-min-32-chars

# Backend URL (use relative path for Vercel, or absolute if backend is separate)
BACKEND_URL=https://your-backend-url.com  # Or leave empty to use Next.js API routes
```

### Email Provider (choose one)

#### Option 1: Resend (Recommended)

```bash
RESEND_API_KEY=re_xxxxx
RESEND_FROM_EMAIL=noreply@yourdomain.com  # Must be verified domain in Resend
```

#### Option 2: SMTP

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@yourdomain.com
SMTP_SECURE=false  # true for port 465, false for 587
```

## Setup Steps

### 1. Install Email Package

If using Resend:
```bash
cd apps/backend
pnpm add resend
```

If using SMTP:
```bash
cd apps/backend
pnpm add nodemailer @types/nodemailer
```

### 2. Configure Vercel Cron

The `vercel.json` file is already configured with:
- Daily alert check at 9am UTC (`0 9 * * *`)

To add additional checks (e.g., every 2 hours for integrity errors):
```json
{
  "crons": [
    {
      "path": "/api/cron/executive-alerts",
      "schedule": "0 9 * * *"
    },
    {
      "path": "/api/cron/executive-alerts?time_range=7d",
      "schedule": "0 */2 * * *"
    }
  ]
}
```

### 3. Generate Cron Secret

```bash
# Generate a secure random secret
openssl rand -hex 32
# Or
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output and set it as `EXEC_ALERT_CRON_SECRET` in Vercel.

### 4. Verify Resend Domain (if using Resend)

1. Go to https://resend.com/domains
2. Add and verify your domain
3. Use an email from that domain as `RESEND_FROM_EMAIL`

## Testing

### Manual Test (via curl)

```bash
# Test the cron endpoint
curl -X POST https://your-domain.vercel.app/api/cron/executive-alerts \
  -H "Authorization: Bearer $EXEC_ALERT_CRON_SECRET" \
  -H "Content-Type: application/json"

# Or test the backend endpoint directly
curl -X POST https://your-backend.com/api/executive/alerts/check \
  -H "Authorization: Bearer $EXEC_ALERT_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"time_range": "7d"}'
```

### Smoke Test Checklist

1. **Email Received**: Check that alert emails arrive for triggered conditions
2. **No Spam**: Trigger the same alert twice - second should be suppressed (cooldown)
3. **Payload Hash Change**: Modify data (create violation/overdue attestation) - should send new alert
4. **Deep Links Work**: Click links in email - should open filtered executive/audit pages
5. **Audit Log**: Check Compliance Ledger for `executive.alert_sent` events with correct metadata

### Test Alert Conditions

- **Integrity Error**: Modify an audit log hash manually (dev only) or wait for natural error
- **Violations**: Create a role violation by attempting unauthorized action
- **High-Risk Spike**: Create multiple high-risk jobs in a short period
- **Overdue Attestations**: Create jobs that require attestations and don't sign them

## Monitoring

Check Vercel cron execution logs:
1. Go to Vercel Dashboard → Your Project → Cron Jobs
2. View execution history and logs

Check alert state in database:
```sql
SELECT * FROM executive_alert_state 
WHERE organization_id = 'your-org-id'
ORDER BY updated_at DESC;
```

Check alert audit logs:
```sql
SELECT * FROM audit_logs 
WHERE event_name = 'executive.alert_sent'
ORDER BY created_at DESC
LIMIT 10;
```

## Troubleshooting

### Emails not sending
- Check email provider API key/credentials
- Verify `RESEND_FROM_EMAIL` domain is verified (Resend)
- Check backend logs for email send errors
- Verify recipients have valid email addresses in users table

### Cron not running
- Verify `vercel.json` is committed and deployed
- Check Vercel cron job is registered (Dashboard → Cron Jobs)
- Verify cron endpoint returns 200 OK
- Check cron execution logs in Vercel

### Duplicate alerts
- Check `executive_alert_state` table for last_sent_at
- Verify payload hash is changing when data changes
- Review cooldown_minutes setting (default 360 = 6 hours)

### Authorization errors
- Verify `EXEC_ALERT_CRON_SECRET` matches in Vercel env vars
- Check Authorization header format: `Bearer <secret>`
- Verify backend endpoint accepts the secret

