# Demo Release Notes - v1.0.0

## What Shipped

### Interactive Demo Flow
- Complete 6-step guided walkthrough of RiskMate's compliance workflow
- Job creation, template application, worker assignment, evidence verification, permit pack generation, and version history
- Sticky demo guide panel with progress tracking
- localStorage persistence (survives refresh, works in private mode)

### Pricing Integration
- Business plan highlighted when coming from demo (`?from=demo`)
- Highlight moves cleanly when user clicks other plans
- "Shown in Demo" badge and subtext for context

### Enterprise Guardrails
- Zero API calls from demo (no production data access)
- Route protection blocks `/dashboard/*`, `/api/*`, `/account/*`, and all production routes
- Redirects with calm message if user attempts to access protected routes
- Consistent disabled action messaging: "Disabled in demo mode. No data is saved."

### Sales-Ready Entry Points
- Demo links in navbar, pricing header, and footer
- "Interactive" badge for clarity
- Executive-friendly CTA: "Start Demo Walkthrough"

## What's Simulated vs Real

**Simulated (Demo Mode):**
- All job data, workers, evidence, and version history are hardcoded
- Actions are simulated locally (no database writes)
- Permit pack generation shows progress animation but doesn't create real files
- No authentication or authorization checks

**Real (Production):**
- All actions are saved to database with timestamps
- Full permission system (owner/admin/member roles)
- Immutable audit trail with actor names and timestamps
- Real file generation and storage
- Organization-level data isolation

## Non-Goals

- **No API calls**: Demo is completely self-contained, no backend communication
- **No persistence beyond localStorage**: Demo state is client-side only, cleared on restart
- **No authentication**: Demo doesn't require login or user accounts
- **No data collection**: No analytics tracking in demo (no posthog/trackEvent calls)

## Known Limitations

- Demo state is per-browser (localStorage is origin-scoped)
- If localStorage is blocked (private mode), demo works but doesn't persist across refresh
- Browser back/forward navigation restores state from localStorage (intended behavior)
- Demo cannot access real production data (by design)

## Security Notes

- Demo uses only public Supabase anon keys (if any) - no secrets in client bundle
- All API routes remain protected server-side (demo navigation blocking is client-side only)
- CSP headers should allow inline scripts for PostHog (if enabled) - demo doesn't use PostHog
- No secrets or sensitive data in demo code

## Performance

- Bundle size: `/demo` = 149 kB First Load JS (reasonable)
- No heavy waterfalls (all data hardcoded)
- OG image cached for 1 year (immutable)
- Demo page cached for 1 hour with stale-while-revalidate

## Entry Points

- Navbar: "Demo" with "Interactive" badge
- Pricing header: "Demo" with "Interactive" badge  
- Footer: "Demo" with "Interactive" badge
- Direct URL: `/demo`

