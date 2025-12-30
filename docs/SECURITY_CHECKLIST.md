# Security Checklist - Token Leak Incident

## Immediate Actions Required

### 1. Rotate Supabase Credentials

**Password Reset:**
- [ ] Change password for the test user account that had tokens exposed
- [ ] Use a strong, unique password

**Session Revocation:**
- [ ] Go to Supabase Dashboard → Authentication → Users
- [ ] Find the affected user account
- [ ] Revoke all sessions/refresh tokens (sign out everywhere)
- [ ] Alternatively: Use Supabase API to revoke all refresh tokens for the user

**Token Rotation:**
- [ ] If using service role keys, rotate them in Supabase Dashboard → Settings → API
- [ ] Update environment variables in Vercel (or wherever they're stored)
- [ ] Rotate any other API keys/tokens that might have been in the request headers

### 2. Audit Exposed Information

**What was potentially exposed:**
- Bearer token (JWT access token)
- Refresh token
- Session cookies
- Any headers from the API request

**Assumptions:**
- Assume any token in those headers could have been replayed
- Treat all sessions from that timeframe as potentially compromised
- If this was a production account, consider broader audit

### 3. Monitor for Unauthorized Access

- [ ] Check Supabase Dashboard → Logs for unusual activity
- [ ] Review access logs for the affected user/organization
- [ ] Monitor for unexpected API calls or data access
- [ ] Set up alerts for unusual patterns (if not already configured)

### 4. Prevention

**For future:**
- [ ] Never paste full request logs into chat/code reviews without redaction
- [ ] Use environment variables for all secrets (never hardcode)
- [ ] Implement token rotation schedule
- [ ] Consider using shorter-lived tokens for development
- [ ] Use separate service accounts for different environments

---

## Post-Incident Verification

After completing the above:

- [ ] Confirm all sessions revoked
- [ ] Verify new tokens are working correctly
- [ ] Test that PDF generation still works with new credentials
- [ ] Document any lessons learned

---

**Date of incident:** 2025-12-30  
**Action taken:** Immediate token rotation and session revocation required

