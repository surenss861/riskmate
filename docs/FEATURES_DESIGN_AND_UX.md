# Riskmate – Every feature, web & iOS design, UI & UX

Single reference for **every feature** (web + iOS), **design systems** (web + iOS), and **UI/UX patterns** (flows, states, accessibility).

---

## Part 1 – Every feature (web + iOS)

Features are grouped by domain. For each: **what it does**, **where it lives (web vs iOS)**, and **key UI/API touchpoints**.

---

### A. Auth, org & session

| Feature | Web | iOS | Notes |
|--------|-----|-----|------|
| **Sign up** | `/signup`, email/password/org, invite token support | Not in app (use web or magic link) | Backend: Supabase auth + `users`/`organizations` |
| **Login** | `/login`, email/password, redirect to last page or dashboard | `AuthView`: email/password, Supabase Swift | Session stored in Supabase client on both |
| **Logout** | Navbar “Logout” → `signOut()` → `/login` | Account → Sign out | Clears session |
| **Forgot password** | `/forgot-password` → reset email | Link to web or in-app email flow | Supabase `resetPasswordForEmail` |
| **Reset password** | `/reset?token=...` → new password | Typically via web link | `updateUser({ password })` |
| **Organization context** | All API routes use `getOrganizationContext()`; data scoped to `organization_id` | Session loads user + org; API calls send JWT (org in token) | Single org per user (multi-org later) |
| **Roles** | Owner, Admin, Member; `lib/utils/permissions.ts`, enforced in API | `EntitlementsManager`: server-driven; auditor (read-only) from backend | Owner: billing, delete org, team. Admin: no billing. Member: limited. |

---

### B. Team & invites

| Feature | Web | iOS | Notes |
|--------|-----|-----|------|
| **Team list** | `/operations/team` – members + pending invites | Account → Team (e.g. `TeamView`) | Same backend: team + invites |
| **Invite member** | Invite modal: email, role (Admin/Member) → `POST /api/team/invite` | Shown in team screen if permitted | Email with `/signup?invite_token=...` |
| **Accept invite** | `/signup?invite_token=...` – pre-fill org, complete signup | N/A (web flow) | Backend marks invite accepted, sets role |
| **Remove member** | Per-member remove (Owner/Admin) | Same if UI exposed | API: remove member |

---

### C. Subscription & billing

| Feature | Web | iOS | Notes |
|--------|-----|-----|------|
| **Plans** | Starter (3 jobs/mo, 1 seat), Pro (5 seats), Business (unlimited, analytics, permit pack) | Shown in Account / change plan (may open web) | `lib/utils/planRules.ts`; Stripe + webhooks |
| **Plan enforcement** | Frontend: upgrade badges, toasts; Backend: 402/403 on limits | Entitlements from backend; locked features hidden or upgrade CTA | Job creation, seat limits, feature gating |
| **Change plan / upgrade** | `/operations/account/change-plan` → Stripe Checkout | “Open in Web App” or in-app browser for checkout | Webhook updates subscription; plan cached in session |
| **Billing portal** | Stripe Customer Portal link | Often via web | Manage payment method, cancel |

---

### D. Jobs (work records)

| Feature | Web | iOS | Notes |
|--------|-----|-----|------|
| **Jobs list** | `/operations/jobs` – DataGrid, sort, search, filters (risk, status, date) | Operations tab: `OperationsView` + `JobRow` list; filters, search | API: `GET /api/jobs` (paginated). iOS: `JobsStore` |
| **Job detail** | `/operations/jobs/[id]` – header, tabs (Risk & Hazards, Mitigations, Evidence, Timeline, etc.) | `JobDetailView`: sticky tabs Overview / Hazards / Controls / Evidence (conditional) | Same job model; web has more config (hazards/controls), iOS focuses on evidence + export |
| **New job** | `/operations/jobs/new` – form (name, client, type, location, dates, template) | Create on web; iOS shows “Open Web App” when no jobs | `POST /api/jobs`; template apply |
| **Edit job** | `/operations/jobs/[id]/edit` – inline edit on web | Limited edit on iOS; full edit on web | `PATCH /api/jobs/[id]` |
| **Risk score** | Job header: score 0–100, level (Low/Medium/High/Critical), microcopy | Overview: `RiskScoreCard`; level pills | Backend recalc on hazard change; `lib/utils/riskScoring.ts` |
| **Hazards** | Job tab: list, add from library, severity/category | `HazardsTab`: list when count > 0; else “Managed in Web App” card + Open Web App | API: hazards for job; iOS shows when configured on web |
| **Controls / mitigations** | Job tab: checklist, mark complete, progress bar | `ControlsTab`: same idea when count > 0; else Managed in Web App | Mitigations API; completion updates score/audit |
| **Templates** | Account/Templates + New Job + Job Detail: create, apply, “Save as template” | Apply template on web; iOS uses jobs created from web | Hazard/Job templates; apply to new or existing job |

---

### E. Evidence (photos & documents)

| Feature | Web | iOS | Notes |
|--------|-----|-----|------|
| **Upload photos** | Job Evidence: drag-and-drop, categories (Before/During/After), compression | `EvidenceCaptureSheet` / `RMEvidenceCapture`: camera + picker; categories | Storage: Supabase; backend or direct upload per setup |
| **Upload documents** | Evidence/Documents: PDF, DOCX, etc. | Optional in evidence flow | Same storage bucket; type = document |
| **Evidence list** | Thumbnail grid, lightbox, delete | `EvidenceTab`: list + upload status (Queued, Uploading %, Uploaded, Failed – tap to retry) | API: evidence by job |
| **Verification (approve/reject)** | Evidence section: Approve/Reject (Admin/Owner) | Shown if supported in API | `evidence_verifications`; optional |

---

### F. Reports & exports

| Feature | Web | iOS | Notes |
|--------|-----|-----|------|
| **PDF report (Risk Snapshot)** | Job detail → “Generate PDF Report” → progress modal → View/Copy link/Download | Export sheet: “Risk Snapshot Report” card → generate | Backend: build PDF, store, return signed URL; export worker possible |
| **Proof Pack (ZIP)** | Job detail → “Generate Permit Pack” (Business) or similar | `ExportProofSheet`: “Proof Pack” – locked until evidence count ≥ required; “Add Evidence” CTA when locked | Backend: export worker; idempotent create; `failure_reason` on failure |
| **Permit packs list** | Job detail or reports: list of generated packs with download links | Export receipt / recent exports in sheet | API: `GET /api/jobs/[id]/permit-packs` (or equivalent) |
| **Export receipt** | After export: link to file, copy ID | `ExportReceiptView`: share, status | Export state: queued → preparing → generating → ready / failed |
| **Report view / print** | `/reports/[id]/print`, `/reports/packet/print/[runId]` | PDF viewer in app (`RMPDFViewer`) | Read-only report view |

---

### G. Audit & readiness

| Feature | Web | iOS | Notes |
|--------|-----|-----|------|
| **Audit feed** | `/operations/audit` – event list, filters, assign/resolve | `AuditView` / `AuditFeedView`: event list | API: audit events; client metadata (client, app_version, device_id) |
| **Readiness** | `/operations/audit/readiness` – readiness dashboard, items by category | `ReadinessView`: readiness score, items | Readiness API; evidence/controls/attestations/incidents |
| **Assign / resolve** | Modals: assign to user, resolve with note | From web; iOS read-only or simple actions if exposed | Audit API: assign, resolve |
| **Export pack (audit)** | Audit export: attestations, controls, pack | N/A or via web | Export endpoints under audit |

---

### H. Executive & analytics

| Feature | Web | iOS | Notes |
|--------|-----|-----|------|
| **Executive summary** | `/operations/executive` – risk posture, brief | `ExecutiveView` / `ExecutiveViewRedesigned`: summary, tiles | API: executive brief, risk posture |
| **Risk posture** | Tiles/cards: risk by area | Same data on iOS if implemented | Executive API |
| **Analytics dashboard** | Business plan: charts (compliance over time, high-risk count, evidence volume, etc.) | Not in iOS app (web only) | Analytics API; plan-gated |

---

### I. Ledger & verification

| Feature | Web | iOS | Notes |
|--------|-----|-----|------|
| **Ledger / trust strip** | Audit or report: ledger roots, verification | Tab or quick action: “View Ledger” – `QuickActionRouter.requestSwitchToLedger()` | Backend: ledger root worker; verification APIs |
| **Proof receipt** | Report or export: receipt with hash, chain | `ProofReceiptDetailsView`, `LedgerReceiptCard`: show hash, copy | Verification + ledger contracts |
| **Public verification** | `/client/[token]` or public link – read-only proof | N/A | Public verification API |

---

### J. Legal & account

| Feature | Web | iOS | Notes |
|--------|-----|-----|------|
| **Terms / Privacy** | `/terms`, `/privacy` | `TermsOfServiceView`, `PrivacyPolicyView` (in-app or web) | Static or CMS |
| **Accept legal** | Accept modal or account flow | On login/signup if required | `POST /api/legal/accept` |
| **Account settings** | `/operations/account` – profile, plan, team | `AccountView`: profile, team, support bundle, delete account | Account API |
| **Delete account** | Account → Deactivate/Delete | `DeleteAccountSheet` | Deactivate API |

---

### K. Marketing & public

| Feature | Web | iOS | Notes |
|--------|-----|-----|------|
| **Landing** | `/` – hero, features, social proof, CTAs | N/A | Marketing page |
| **Pricing** | `/pricing` – plans, CTA | N/A | Stripe Checkout |
| **Case studies** | `/case-studies/electrical`, hvac, roofing | N/A | Marketing |
| **Compare** | Pen and paper, SafetyCulture, Sitedocs, spreadsheets | N/A | Marketing |
| **Tools** | Compliance score, incident cost, risk score, time saved calculators | N/A | Lead gen / value |
| **Sample report** | `/sample-report` – view sample PDF | N/A | Marketing |
| **Demo** | `/demo` – guided demo, role switcher | N/A | Demo mode |
| **Client portal** | `/client/[token]` – read-only report view by token | N/A | Share link |

---

### L. iOS-specific flows

| Feature | Where | Notes |
|--------|--------|------|
| **Open Web App** | Operations empty state, Job Detail ••• menu, Managed in Web App card, Hazards/Controls empty | `WebAppURL.openWebApp()`; toast “Couldn’t open link” on failure |
| **Pick job for evidence** | Operations FAB → “Pick Job” sheet → select job → Evidence capture | When no job in context; `JobPickerSheet` |
| **Export from list** | Operations ••• or long-press → Export → `ExportProofSheet` (fetch mode: checks evidence count) | Proof Pack locked until evidence threshold; Retry on fetch failure |
| **Trust onboarding** | First launch after login – trust/ledger explanation | `TrustOnboardingView` |
| **Backend health gate** | Before main UI: check `/health`; show error + Retry if down | `ServerStatusManager`; blocks app until healthy |
| **Read-only (auditor)** | Hide edit/delete/add evidence; show banner | `EntitlementsManager.isAuditor()`; `ReadOnlyBanner` |

---

## Part 2 – Web design

### Design tokens (`lib/styles/design-tokens.ts`, `lib/styles/design-system.ts`)

- **Colors**: `bg #0A0A0A`, `surface` rgba white, `border` rgba white, `text` hierarchy, **accent `#F97316`** (primary CTAs, selected state only).
- **Spacing**: `pageContainer` max-w-6xl, `pagePaddingX/Y`, `sectionGap`.
- **Typography**: `font-display` (Playfair) for page/section titles; sans (Inter) for body, labels, data.
- **Radius**: card `rounded-3xl`, button `rounded-lg`, badge `rounded-full`.
- **Effects**: `backdrop-blur`, shadow levels.

**Rules**: Orange only for primary CTAs and selected states; status via badges (neutral / warning / critical); single ambient glow; no per-card glow.

### Component system

- **Cards**: `cardStyles.base` – border, bg, backdrop-blur; `flat` / `elevated`; padding sm/md/lg.
- **Buttons**: `buttonStyles.primary` (orange), `secondary` (border), `tertiary` (subtle); sizes sm/md/lg; disabled opacity, no hover on disabled.
- **Motion**: `motion.fast/normal/slow`; `hoverStates` for card, row, badge, tab, iconButton (no bounce).
- **Shadows**: `flat`, `raised`, `focused` (orange ring).

### Layout & shell

- **App**: `AppShell`, `DashboardNavbar`, sidebar or top nav; content in `pageContainer` with consistent padding.
- **Marketing**: Full-width sections; hero with gradient/glow; sections with `sectionGap`; CTA buttons primary orange.
- **Dashboard**: Grid of cards (KPI, jobs, evidence, activity); DataGrid for jobs; filters and search in `FilterBar`.

### Marketing vs app

- **Marketing**: Playfair for headlines, hero + features + social proof + CTAs; StringTune scroll/parallax; dark bg + orange accent.
- **App**: Same tokens; more data-dense; tables, modals, drawers; skeleton loaders; toasts for success/error.

---

## Part 3 – iOS design

### Theme (`RMTheme`, `RiskMateDesignSystem`, `RMSystemTheme`)

- **Colors**: `background #0A0A0A`, `surface #121212`, `cardBackground`; **accent `#F97316`** (primary only); text primary/secondary/tertiary/placeholder; status: success, error, warning, info; category colors (e.g. access blue, operations purple).
- **Spacing**: xs 4 → xxl 48; `pagePadding` 20, `sectionSpacing` 16.
- **Typography**: System font; largeTitle 34pt bold down to captionSmall 11pt; body 17pt, bodySmall 15pt.
- **Radius**: xs 8 → card 24; glass cards 26.
- **Shadows**: card, button (accent glow), small.

**Rules**: Orange only for primary actions and selected state; risk/status use system colors; motion purposeful (spring, no decoration).

### Components

- **Cards**: `RMCard`, `RMGlassCard` – dark surface, border, blur.
- **Buttons**: `RMButton`, `RMPrimaryButton` – primary orange; secondary text/outline.
- **Lists**: `JobRow`, `JobCard` – list and card variants; swipe actions (e.g. Add Evidence, Complete).
- **Empty states**: `RMEmptyState` – icon, title, message, optional action.
- **Feedback**: `ToastCenter` (toast); `Haptics.tap/success/warning/impact`; skeleton `RMSkeletonView`.

### Layout

- **iPhone**: Tab bar (Operations, Audit, Executive, Account); Job Detail = sticky segmented control + tab content; sheets for evidence, export, picker.
- **iPad**: Split or sidebar navigation; same components, larger canvas.
- **Navigation**: `NavigationStack`; ••• menu for Export, Ledger, Work Records, Open Web App; FAB for “Add Evidence” (opens pick job or evidence).

### Design principles (from DESIGN_SYSTEM.md)

- Serious infrastructure: trust, immutability, proof-first.
- Dark + orange only for primary actions.
- Clear hierarchy: primary actions distinct; risk and ledger status visible.
- Motion: spring (e.g. 0.25–0.5s response, 0.85–0.9 damping); haptics for punctuation, not every tap.

---

## Part 4 – UI/UX patterns

### Loading states

- **Web**: Skeleton loaders (dashboard cards, job list, job detail, analytics); spinners in modals; progress steps in report generation.
- **iOS**: `RMSkeletonView` / skeleton cards on job load; “Checking readiness…” in Export sheet; pull-to-refresh on lists; no phantom tab switches (tab validation waits for load).

### Empty states

- **Web**: Per widget (“No jobs scheduled for today”, “No evidence uploaded yet”); primary CTA (e.g. “New Job”, “Upload photos”).
- **iOS**: Operations “No active jobs yet” + “Open Web App”; Job Detail Hazards/Controls “Managed in Web App” + Open Web App + View Work Records; Evidence “Add Evidence”; Export sheet “Add X evidence to unlock” + Add Evidence CTA.

### Error states

- **Web**: Toast on API error; retry buttons; 402/403 → upgrade prompt + redirect to pricing; inline validation on forms.
- **iOS**: Toast (e.g. “Couldn’t open link” for Open Web App failure); Retry on export readiness fetch failure; alert for critical errors; backend health error + Retry gate.

### Success & feedback

- **Web**: Toasts (“Job created”, “Invitation sent”); success state in modals; copy-to-clipboard feedback.
- **iOS**: Toasts (“Marked complete”, “Copied”, “Anchored”); `Haptics.success()` when Proof Pack unlocks; tap haptic on tab change and key buttons.

### Navigation & information architecture

- **Web**: Operations hub → Jobs / Audit / Executive / Team / Account; Job detail → tabs; breadcrumbs or back where useful.
- **iOS**: Tab bar = main sections; Job Detail = Overview (primary) / Hazards / Controls / Evidence with conditional tabs; ••• for Export, Ledger, Work Records, Web; FAB = Add Evidence (with job picker when needed).

### Accessibility

- **Web**: Semantic HTML; labels; keyboard nav; focus states (e.g. orange ring); ARIA where needed.
- **iOS**: `accessibilityLabel` on segmented control (“Job sections: Overview, Evidence, …”); ••• menu “More actions for this job”; Export Proof Pack card: one sentence per state (e.g. “Proof Pack. Locked. Add X more evidence items to unlock.”); VoiceOver-friendly flow.

### Consistency across platforms

- Same **accent #F97316** and dark background; orange for primary CTAs only.
- Same **copy tone**: professional, contractor-friendly; risk microcopy aligned (e.g. “Add X evidence to unlock”).
- **Export flow**: Web = generate from job detail; iOS = sheet with PDF + Proof Pack, Proof Pack gated by evidence count, Retry and Add Evidence CTA when locked.
- **Open Web App**: One canonical URL; failure toast on both when open fails.

---

## Summary

- **Features**: Auth, team, billing, jobs, hazards/controls, evidence, reports, Proof Pack, audit, readiness, executive, ledger, legal, account, marketing – with clear web vs iOS ownership and shared backend.
- **Web design**: Tokens (dark bg, orange accent, typography, spacing, motion); card/button/shadow system; app vs marketing layout.
- **iOS design**: RMTheme + RiskMateDesignSystem; dark + orange; system fonts and semantics; iPhone/iPad layout; FAB, ••• menu, sheets.
- **UI/UX**: Skeleton and pull-to-refresh; empty states with primary CTA; error toasts and Retry; success toasts and haptics; navigation and Export flow; accessibility labels and one-sentence Proof Pack states.

Use with **FILE_BY_FILE_REFERENCE.md** to go from feature → screens/components → files.
