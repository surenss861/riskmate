# Riskmate – File-by-file reference (every slice)

Single reference for **every significant file** across web, iOS, backend, and Supabase. One line per file (or short block where needed).

---

## 1. Web – App Router (`app/`)

Next.js 14+ App Router: pages (routes) and API routes. API routes under `app/api/` are **Next.js server routes** (run on Vercel); many call Supabase directly via `createSupabaseServerClient`; some proxy to or mirror the Express backend.

### Root / layout / global

| File | Purpose |
|------|--------|
| `app/layout.tsx` | Root layout: fonts (Inter, Playfair), AuthProvider, SmoothScroll, PWARegister, PostHog, StringTune script, metadata. |
| `app/page.tsx` | Marketing landing page. |
| `app/globals.css` | Global CSS variables and base styles. |
| `app/favicon.ico` | Favicon. |

### Auth & account

| File | Purpose |
|------|--------|
| `app/login/page.tsx` | Login page: email/password, redirect after auth. |
| `app/signup/page.tsx` | Sign-up page: email, password, org name, optional invite token. |
| `app/forgot-password/page.tsx` | Forgot password: send reset email. |
| `app/reset/page.tsx` | Reset password: token from email, set new password. |
| `app/account/legal/page.tsx` | Account legal (terms/acceptances) page. |

### Marketing / public

| File | Purpose |
|------|--------|
| `app/dashboard/page.tsx` | Dashboard redirect or landing (post-login hub). |
| `app/pricing/page.tsx` | Pricing/plans page. |
| `app/pricing/cancelled/page.tsx` | Post-cancel flow. |
| `app/pricing/thank-you/page.tsx` | Post-checkout thank-you. |
| `app/industries/page.tsx` | Industries marketing page. |
| `app/case-studies/electrical/page.tsx` | Electrical case study. |
| `app/case-studies/hvac/page.tsx` | HVAC case study. |
| `app/case-studies/roofing/page.tsx` | Roofing case study. |
| `app/compare/pen-and-paper/page.tsx` | Compare: pen and paper. |
| `app/compare/safetyculture/page.tsx` | Compare: SafetyCulture. |
| `app/compare/sitedocs/page.tsx` | Compare: Sitedocs. |
| `app/compare/spreadsheets/page.tsx` | Compare: spreadsheets. |
| `app/privacy/page.tsx` | Privacy policy. |
| `app/terms/page.tsx` | Terms of service. |
| `app/roadmap/page.tsx` | Product roadmap. |
| `app/sample-report/page.tsx` | Sample report marketing. |
| `app/resources/bundle/page.tsx` | Resource bundle download. |
| `app/tools/compliance-score/page.tsx` | Compliance score calculator. |
| `app/tools/incident-cost/page.tsx` | Incident cost calculator. |
| `app/tools/risk-score-calculator/page.tsx` | Risk score calculator. |
| `app/tools/time-saved/page.tsx` | Time-saved calculator. |
| `app/demo/layout.tsx` | Demo area layout. |
| `app/demo/page.tsx` | Demo experience entry. |
| `app/client/[token]/page.tsx` | Client token-based view (e.g. share link). |

### Operations (app shell)

| File | Purpose |
|------|--------|
| `app/operations/page.tsx` | Operations hub (jobs, audit, executive, team, account). |
| `app/operations/jobs/page.tsx` | Jobs list. |
| `app/operations/jobs/JobsPageContent.tsx` | Jobs page content component. |
| `app/operations/jobs/new/page.tsx` | New job creation. |
| `app/operations/jobs/[id]/page.tsx` | Job detail. |
| `app/operations/jobs/[id]/edit/page.tsx` | Job edit. |
| `app/operations/jobs/[id]/report/page.tsx` | Job report view. |
| `app/operations/audit/page.tsx` | Audit feed / ledger. |
| `app/operations/audit/readiness/page.tsx` | Readiness dashboard. |
| `app/operations/executive/page.tsx` | Executive summary / risk posture. |
| `app/operations/team/page.tsx` | Team members and invites. |
| `app/operations/account/page.tsx` | Account settings. |
| `app/operations/account/change-plan/page.tsx` | Change subscription plan. |
| `app/reports/[id]/print/page.tsx` | Report print view. |
| `app/reports/packet/print/[runId]/page.tsx` | Packet print by run. |

### API routes – Auth & account

| File | Purpose |
|------|--------|
| `app/api/auth/signout/route.ts` | Sign out (clear session). |
| `app/api/auth/signup/route.ts` | Sign up (create user + org). |
| `app/api/account/billing/route.ts` | Billing info. |
| `app/api/account/deactivate/route.ts` | Deactivate account. |
| `app/api/account/organization/route.ts` | Get/update organization. |
| `app/api/account/security/events/route.ts` | Security events. |

### API routes – Jobs

| File | Purpose |
|------|--------|
| `app/api/jobs/route.ts` | List/create jobs. |
| `app/api/jobs/[id]/route.ts` | Get/update/delete job. |
| `app/api/jobs/[id]/full/route.ts` | Full job payload. |
| `app/api/jobs/[id]/assign/route.ts` | Assign job. |
| `app/api/jobs/[id]/audit/route.ts` | Job audit events. |
| `app/api/jobs/[id]/documents/route.ts` | Job documents. |
| `app/api/jobs/[id]/evidence/[docId]/verify/route.ts` | Verify evidence doc. |
| `app/api/jobs/[id]/mitigations/[mitigationId]/route.ts` | Mitigations. |
| `app/api/jobs/[id]/permit-pack/route.ts` | Generate permit pack. |
| `app/api/jobs/[id]/permit-packs/route.ts` | List permit packs for job (signed URLs). |
| `app/api/jobs/[id]/signoffs/route.ts` | Sign-offs. |
| `app/api/jobs/[id]/apply-template/route.ts` | Apply template to job. |

### API routes – Reports & runs

| File | Purpose |
|------|--------|
| `app/api/reports/route.ts` | Reports list. |
| `app/api/reports/[id]/route.ts` | Single report. |
| `app/api/reports/[id]/pdf/route.ts` | Report PDF. |
| `app/api/reports/generate/[id]/route.ts` | Trigger report generation. |
| `app/api/reports/share/[id]/route.ts` | Share report. |
| `app/api/reports/runs/route.ts` | Report runs list. |
| `app/api/reports/runs/active/route.ts` | Active runs. |
| `app/api/reports/runs/[id]/route.ts` | Single run. |
| `app/api/reports/runs/[id]/download/route.ts` | Run download. |
| `app/api/reports/runs/[id]/finalize/route.ts` | Finalize run. |
| `app/api/reports/runs/[id]/signatures/route.ts` | Signatures. |
| `app/api/reports/runs/[id]/signatures/check/route.ts` | Signature check. |
| `app/api/reports/runs/[id]/verify/route.ts` | Verify run. |

### API routes – Audit & access

| File | Purpose |
|------|--------|
| `app/api/audit/events/route.ts` | Audit events feed. |
| `app/api/audit/assign/route.ts` | Assign audit item. |
| `app/api/audit/readiness/route.ts` | Readiness summary. |
| `app/api/audit/resolve/route.ts` | Resolve item. |
| `app/api/audit/export/route.ts` | Export audit data. |
| `app/api/audit/export/attestations/route.ts` | Export attestations. |
| `app/api/audit/export/controls/route.ts` | Export controls. |
| `app/api/audit/export/pack/route.ts` | Export pack. |
| `app/api/audit/incidents/close/route.ts` | Close incident. |
| `app/api/audit/incidents/corrective-action/route.ts` | Corrective action. |
| `app/api/access/export/route.ts` | Access export. |
| `app/api/access/flag-suspicious/route.ts` | Flag suspicious. |
| `app/api/access/revoke/route.ts` | Revoke access. |
| `app/api/audit/access/flag-suspicious/route.ts` | Audit flag suspicious. |
| `app/api/audit/access/revoke/route.ts` | Audit revoke. |

### API routes – Executive & risk

| File | Purpose |
|------|--------|
| `app/api/executive/brief/[reportId]/route.ts` | Executive brief. |
| `app/api/executive/brief/pdf/route.ts` | Executive brief PDF. |
| `app/api/executive/risk-posture/route.ts` | Risk posture. |
| `app/api/risk/factors/route.ts` | Risk factors. |
| `app/api/risk/summary/route.ts` | Risk summary. |
| `app/api/analytics/mitigations/route.ts` | Analytics mitigations. |

### API routes – Subscriptions & Stripe

| File | Purpose |
|------|--------|
| `app/api/subscriptions/route.ts` | List subscriptions. |
| `app/api/subscriptions/checkout/route.ts` | Create checkout session. |
| `app/api/subscriptions/confirm/route.ts` | Confirm subscription. |
| `app/api/subscriptions/portal/route.ts` | Customer portal. |
| `app/api/subscriptions/reconcile/route.ts` | Reconcile. |
| `app/api/subscriptions/switch/route.ts` | Switch plan. |
| `app/api/subscriptions/track-view/route.ts` | Track plan view. |
| `app/api/subscriptions/verify/route.ts` | Verify subscription. |
| `app/api/stripe/checkout/route.ts` | Stripe checkout. |
| `app/api/me/plan/route.ts` | Current user plan. |
| `app/api/org/entitlements/route.ts` | Org entitlements. |

### API routes – Team & legal

| File | Purpose |
|------|--------|
| `app/api/team/route.ts` | Team list. |
| `app/api/team/invite/route.ts` | Invite member. |
| `app/api/team/invite/[id]/route.ts` | Get/cancel invite. |
| `app/api/team/member/[id]/route.ts` | Member actions. |
| `app/api/team/acknowledge-reset/route.ts` | Acknowledge reset. |
| `app/api/legal/accept/route.ts` | Accept legal. |
| `app/api/legal/status/route.ts` | Legal status. |
| `app/api/legal/version/route.ts` | Legal version. |

### API routes – Proof packs, incidents, review, verify

| File | Purpose |
|------|--------|
| `app/api/proof-packs/route.ts` | Proof packs list. |
| `app/api/proof-packs/export/route.ts` | Export proof pack. |
| `app/api/incidents/close/route.ts` | Close incident. |
| `app/api/incidents/corrective-action/route.ts` | Corrective action. |
| `app/api/incidents/export/route.ts` | Incidents export. |
| `app/api/review-queue/assign/route.ts` | Assign review. |
| `app/api/review-queue/export/route.ts` | Export review. |
| `app/api/review-queue/resolve/route.ts` | Resolve review. |
| `app/api/verify/[reportId]/route.ts` | Verify report. |
| `app/api/enforcement-reports/export/route.ts` | Enforcement export. |

### API routes – Admin, cron, debug, resources, sample

| File | Purpose |
|------|--------|
| `app/api/admin/route.ts` | Admin entry. |
| `app/api/admin/billing-alerts/route.ts` | Billing alerts. |
| `app/api/admin/billing-alerts/[id]/resolve/route.ts` | Resolve alert. |
| `app/api/admin/billing-alerts/monitor/route.ts` | Monitor. |
| `app/api/admin/billing-alerts/reconcile/route.ts` | Reconcile. |
| `app/api/cron/executive-alerts/route.ts` | Cron: executive alerts. |
| `app/api/cron/reconcile-subscriptions/route.ts` | Cron: reconcile subs. |
| `app/api/debug/env-check/route.ts` | Env check. |
| `app/api/debug/verify-org-scoping/route.ts` | Verify org scoping. |
| `app/api/debug/whoami/route.ts` | Whoami. |
| `app/api/dev/generate-sample-events/route.ts` | Generate sample events. |
| `app/api/resources/bundle/download/route.ts` | Resource bundle download. |
| `app/api/sample-report/route.ts` | Sample report. |
| `app/api/sample-risk-report.pdf/route.ts` | Sample risk report PDF. |

---

## 2. Web – Components (`components/`)

React components used by the app and marketing pages.

### Root-level

| File | Purpose |
|------|--------|
| `components/AuthProvider.tsx` | Auth context + session for app. |
| `components/ProtectedRoute.tsx` | Wrapper that redirects unauthenticated users. |
| `components/DashboardNavbar.tsx` | App shell navbar (logo, nav, user menu). |
| `components/PWARegister.tsx` | PWA service worker registration. |
| `components/SmoothScroll.tsx` | Smooth scroll behavior. |
| `components/StringScrollProvider.tsx` | StringTune scroll provider. |
| `components/ScrollToTop.tsx` | Scroll-to-top button. |
| `components/HeroScene.tsx` | Marketing hero scene. |
| `components/CursorGlow.tsx` | Cursor glow effect. |
| `components/MagneticButton.tsx` | Magnetic button effect. |
| `components/ChatWidget.tsx` | Chat widget (e.g. Intercom). |
| `components/LegalModal.tsx` | Legal terms modal. |
| `components/StripeCheckout.tsx` | Stripe checkout UI. |
| `components/ToastContainer.tsx` | Global toast container. |
| `components/UpgradeBanner.tsx` | Plan upgrade banner. |
| `components/RiskMateLogo.tsx` | RiskMate logo. |
| `components/RiskMateLogoAlt.tsx` | Alt logo. |
| `components/ScrollSection.tsx` | Scroll section wrapper. |

### audit/

| File | Purpose |
|------|--------|
| `components/audit/AssignModal.tsx` | Assign audit item modal. |
| `components/audit/BulkActionResultModal.tsx` | Bulk action result. |
| `components/audit/CloseIncidentModal.tsx` | Close incident modal. |
| `components/audit/CreateCorrectiveActionModal.tsx` | Create corrective action. |
| `components/audit/EventDetailsDrawer.tsx` | Event details drawer. |
| `components/audit/EventSelectionTable.tsx` | Event selection table. |
| `components/audit/EvidenceDrawer.tsx` | Evidence drawer. |
| `components/audit/FixQueueSidebar.tsx` | Fix queue sidebar. |
| `components/audit/FlagSuspiciousModal.tsx` | Flag suspicious modal. |
| `components/audit/LedgerEventListSkeleton.tsx` | Ledger list skeleton. |
| `components/audit/LedgerEventRowSkeleton.tsx` | Ledger row skeleton. |
| `components/audit/PackHistoryDrawer.tsx` | Pack history drawer. |
| `components/audit/RequestAttestationModal.tsx` | Request attestation. |
| `components/audit/ResolveModal.tsx` | Resolve modal. |
| `components/audit/RevokeAccessModal.tsx` | Revoke access modal. |
| `components/audit/SavedViewCards.tsx` | Saved view cards. |
| `components/audit/SavedViewCardsSkeleton.tsx` | Saved view skeleton. |
| `components/audit/SelectedActionBar.tsx` | Selected action bar. |
| `components/audit/UploadEvidenceModal.tsx` | Upload evidence modal. |

### dashboard/

| File | Purpose |
|------|--------|
| `components/dashboard/DashboardOverview.tsx` | Dashboard overview. |
| `components/dashboard/KpiGrid.tsx` | KPI grid. |
| `components/dashboard/KpiTile.tsx` | Single KPI tile. |
| `components/dashboard/DataGrid.tsx` | Data grid. |
| `components/dashboard/EvidenceWidget.tsx` | Evidence widget. |
| `components/dashboard/EvidenceVerification.tsx` | Evidence verification UI. |
| `components/dashboard/JobAssignment.tsx` | Job assignment UI. |
| `components/dashboard/JobRosterSelect.tsx` | Job roster select. |
| `components/dashboard/ApplyTemplateInline.tsx` | Inline apply template. |
| `components/dashboard/ApplyTemplateModal.tsx` | Apply template modal. |
| `components/dashboard/TemplateDetailDrawer.tsx` | Template detail drawer. |
| `components/dashboard/TemplatesManager.tsx` | Templates manager. |
| `components/dashboard/TemplateUpgradeModal.tsx` | Template upgrade modal. |
| `components/dashboard/BillingAlertsPanel.tsx` | Billing alerts panel. |
| `components/dashboard/Changelog.tsx` | Changelog. |
| `components/dashboard/ConfirmationModal.tsx` | Confirmation modal. |
| `components/dashboard/ConfirmModal.tsx` | Confirm modal. |
| `components/dashboard/ErrorModal.tsx` | Error modal. |
| `components/dashboard/EditableSelect.tsx` | Editable select. |
| `components/dashboard/EditableText.tsx` | Editable text. |
| `components/dashboard/GenerationProgressModal.tsx` | Generation progress. |
| `components/dashboard/InviteSuccessModal.tsx` | Invite success. |
| `components/dashboard/SkeletonLoader.tsx` | Skeleton loader. |
| `components/dashboard/Toast.tsx` | Toast component. |
| `components/dashboard/TrendChart.tsx` | Trend chart. |
| `components/dashboard/VersionHistory.tsx` | Version history. |

### demo/

| File | Purpose |
|------|--------|
| `components/demo/DemoBanner.tsx` | Demo banner. |
| `components/demo/DemoGuide.tsx` | Demo guide. |
| `components/demo/DemoJobDetail.tsx` | Demo job detail. |
| `components/demo/DemoNavbar.tsx` | Demo navbar. |
| `components/demo/DemoProtection.tsx` | Demo protection. |
| `components/demo/GuidedTour.tsx` | Guided tour. |
| `components/demo/RoleSwitcher.tsx` | Role switcher. |
| `components/demo/ScenarioPicker.tsx` | Scenario picker. |

### executive/

| File | Purpose |
|------|--------|
| `components/executive/PostureTilesSkeleton.tsx` | Posture tiles skeleton. |

### job/

| File | Purpose |
|------|--------|
| `components/job/JobPacketView.tsx` | Job packet view. |

### marketing/

| File | Purpose |
|------|--------|
| `components/marketing/Features.tsx` | Features section. |
| `components/marketing/Hero.tsx` | Hero. |
| `components/marketing/HeroBackground.tsx` | Hero background. |
| `components/marketing/HowItWorks.tsx` | How it works. |
| `components/marketing/SampleReportModal.tsx` | Sample report modal. |
| `components/marketing/SocialProof.tsx` | Social proof. |
| `components/marketing/index.ts` | Barrel export. |

### onboarding/

| File | Purpose |
|------|--------|
| `components/onboarding/OnboardingWizard.tsx` | Onboarding wizard. |

### report/

| File | Purpose |
|------|--------|
| `components/report/ReportView.tsx` | Report view. |
| `components/report/SectionRenderer.tsx` | Section renderer. |
| `components/report/ImageModal.tsx` | Image modal. |
| `components/report/PacketSelector.tsx` | Packet selector. |
| `components/report/SignatureCapture.tsx` | Signature capture. |
| `components/report/SignatureDetailsModal.tsx` | Signature details. |
| `components/report/TeamSignatures.tsx` | Team signatures. |
| `components/report/sections/*.tsx` | Report sections (ExecutiveSummary, HazardChecklist, EvidencePhotos, AuditTimeline, etc.). |
| `components/report/sections/index.ts` | Barrel. |

### setup/

| File | Purpose |
|------|--------|
| `components/setup/FirstRunSetupWizard.tsx` | First-run setup wizard. |

### shared/

| File | Purpose |
|------|--------|
| `components/shared/ActionButton.tsx` | Action button. |
| `components/shared/AppBackground.tsx` | App background. |
| `components/shared/AppShell.tsx` | App shell. |
| `components/shared/Badge.tsx` | Badge. |
| `components/shared/Button.tsx` | Button. |
| `components/shared/ChartCard.tsx` | Chart card. |
| `components/shared/DataTable.tsx` | Data table. |
| `components/shared/EmptyState.tsx` | Empty state. |
| `components/shared/EnforcementBanner.tsx` | Enforcement banner. |
| `components/shared/ErrorToast.tsx` | Error toast. |
| `components/shared/EventChip.tsx` | Event chip. |
| `components/shared/EvidenceStamp.tsx` | Evidence stamp. |
| `components/shared/FilterBar.tsx` | Filter bar. |
| `components/shared/GlassCard.tsx` | Glass card. |
| `components/shared/InlineStatus.tsx` | Inline status. |
| `components/shared/Input.tsx` | Input. |
| `components/shared/IntegrityBadge.tsx` | Integrity badge. |
| `components/shared/PackCard.tsx` | Pack card. |
| `components/shared/PageHeader.tsx` | Page header. |
| `components/shared/PageSection.tsx` | Page section. |
| `components/shared/SectionHeader.tsx` | Section header. |
| `components/shared/Select.tsx` | Select. |
| `components/shared/Skeleton.tsx` | Skeleton. |
| `components/shared/Table.tsx` | Table. |
| `components/shared/TrustReceiptStrip.tsx` | Trust receipt strip. |
| `components/shared/index.ts` | Barrel. |

---

## 3. Web – Lib (`lib/`)

Shared utilities, API client, Supabase, PDF, design system.

### API & config

| File | Purpose |
|------|--------|
| `lib/api.ts` | Main API client: BACKEND_URL, fetch with auth, device ID, idempotency; all domain methods (jobs, reports, audit, subscriptions, team, etc.). |
| `lib/api/fetchWithIdempotency.ts` | Idempotency-key fetch wrapper. |
| `lib/api/proxy-helpers.ts` | Server-side proxy to backend (BACKEND_URL); used by some API routes. |
| `lib/config.ts` | BACKEND_URL (NEXT_PUBLIC_API_URL), SUPABASE_URL, SUPABASE_ANON_KEY; production localhost guard. |

### Supabase

| File | Purpose |
|------|--------|
| `lib/supabase/client.ts` | Browser Supabase client (anon key). |
| `lib/supabase/server.ts` | Server Supabase client (cookies). |
| `lib/supabase/admin.ts` | Admin/service-role client (server-only). |
| `lib/supabaseClient.ts` | Legacy/alternate client reference. |
| `lib/authListener.ts` | Auth state listener. |

### Audit & logging

| File | Purpose |
|------|--------|
| `lib/audit/auditLogger.ts` | Audit logging helpers. |
| `lib/audit/eventMapper.ts` | Map events for audit display. |
| `lib/audit/industryLanguage.ts` | Industry-specific copy. |
| `lib/featureEvents.ts` | Feature event tracking. |
| `lib/featureLogging.ts` | Feature logging. |
| `lib/funnelTracking.ts` | Funnel tracking. |
| `lib/posthog.ts` | PostHog setup. |

### Billing & reconciliation

| File | Purpose |
|------|--------|
| `lib/billingMonitoring.ts` | Billing monitoring. |
| `lib/reconciliation.ts` | Reconciliation logic. |
| `lib/entitlements.ts` | Entitlements/plan checks. |
| `lib/cache.ts` | Cache helpers. |

### Design system & PDF (web)

| File | Purpose |
|------|--------|
| `lib/design-system/pdfTheme.ts` | PDF theme. |
| `lib/design-system/tokens.ts` | Design tokens. |
| `lib/design-system/components/*.tsx` | Badge, Button, Card, Input, Table; index. |
| `lib/styles/design-tokens.ts` | Design tokens. |
| `lib/styles/design-system.ts` | Design system. |
| `lib/styles/chart-tokens.ts` | Chart tokens. |

### PDF (lib – reports, executive brief)

| File | Purpose |
|------|--------|
| `lib/pdf/buildExecutiveBriefPDF.ts` | Build executive brief PDF. |
| `lib/pdf/core/layout.ts` | Core layout. |
| `lib/pdf/core/qa.ts` | QA helpers. |
| `lib/pdf/core/tokens.ts` | Tokens. |
| `lib/pdf/core/utils.ts` | Utils. |
| `lib/pdf/core/writer.ts` | Writer. |
| `lib/pdf/executiveBrief/build.ts` | Executive brief build. |
| `lib/pdf/executiveBrief/layout.ts` | Layout. |
| `lib/pdf/executiveBrief/tokens.ts` | Tokens. |
| `lib/pdf/executiveBrief/types.ts` | Types. |
| `lib/pdf/executiveBrief/utils.ts` | Utils. |
| `lib/pdf/reports/_template/build.ts` | Template build. |
| `lib/pdf/reports/_template/render/page1.ts, page2.ts` | Template pages. |
| `lib/pdf/reports/executiveBrief/build.ts` | Executive brief report build. |
| `lib/pdf/reports/executiveBrief/render/page1.ts, page2.ts` | Executive brief pages. |
| `lib/pdf/reports/index.ts` | Barrel. |

### Ledger & realtime

| File | Purpose |
|------|--------|
| `lib/ledger/contracts.ts` | Ledger contracts (TypeScript). |
| `lib/realtime/eventSubscription.ts` | Realtime event subscription. |

### Copy & terms

| File | Purpose |
|------|--------|
| `lib/copy/terms.ts` | Terms copy. |
| `lib/terms.ts` | Terms. |

### Demo

| File | Purpose |
|------|--------|
| `lib/demo/demoData.ts` | Demo data. |
| `lib/demo/useDemo.tsx` | Demo hook. |

### Hooks (lib)

| File | Purpose |
|------|--------|
| `lib/hooks/useAction.ts` | Action hook. |
| `lib/hooks/useSelectedRows.ts` | Selected rows. |
| `lib/hooks/useViewPackHistory.ts` | View pack history. |
| `lib/useStringScroll.ts` | StringTune scroll hook. |

### Utils (lib)

| File | Purpose |
|------|--------|
| `lib/utils/adminAuth.ts` | Admin auth. |
| `lib/utils/apiResponse.ts` | API response helpers. |
| `lib/utils/applyPlan.ts` | Apply plan. |
| `lib/utils/canonicalJson.ts` | Canonical JSON. |
| `lib/utils/clientRequestLogger.ts` | Request logger. |
| `lib/utils/cn.ts` | classNames. |
| `lib/utils/extractProxyError.ts` | Extract proxy error. |
| `lib/utils/gpsMetadata.ts` | GPS metadata. |
| `lib/utils/jobReport.ts` | Job report helpers. |
| `lib/utils/organizationGuard.ts` | Org context + verify job ownership. |
| `lib/utils/orgContext.ts` | Org context. |
| `lib/utils/packets/builder.ts` | Packet builder. |
| `lib/utils/packets/types.ts` | Packet types. |
| `lib/utils/pdf/*.ts` | PDF helpers, ledger export, sections (cover, executiveSummary, hazardChecklist, photos, signatures, timeline), stamp, styles, types, utils. |
| `lib/utils/pdf-service-auth.ts` | PDF service auth. |
| `lib/utils/pdf-test-helpers.ts` | PDF test helpers. |
| `lib/utils/pdfFormatUtils.ts` | PDF format utils. |
| `lib/utils/performance.ts` | Performance. |
| `lib/utils/permissions.ts` | Permissions (roles). |
| `lib/utils/permitPack.ts` | Permit pack. |
| `lib/utils/photoOptimization.ts` | Photo optimization. |
| `lib/utils/playwright-pdf-service.ts` | Playwright PDF service. |
| `lib/utils/playwright-remote.ts` | Playwright remote. |
| `lib/utils/playwright.ts` | Playwright. |
| `lib/utils/printToken.ts` | Print token. |
| `lib/utils/qrCode.ts` | QR code. |
| `lib/utils/reportUtils.ts` | Report utils. |
| `lib/utils/requestId.ts` | Request ID. |
| `lib/utils/riskScoring.ts` | Risk scoring. |
| `lib/utils/signatureValidation.ts` | Signature validation. |
| `lib/utils/stringHelpers.ts` | String helpers. |
| `lib/utils/subscriptionSync.ts` | Subscription sync. |
| `lib/utils/toast.ts` | Toast. |
| `lib/utils/trackPlan.ts` | Track plan. |
| `lib/utils/viewIntegrity.ts` | View integrity. |

---

## 4. Web – Hooks & types (root)

| File | Purpose |
|------|--------|
| `hooks/useAnalytics.ts` | Analytics hook. |
| `hooks/useDebounce.ts` | Debounce. |
| `hooks/useEntitlements.ts` | Entitlements hook. |
| `hooks/useFullJob.ts` | Full job fetch. |
| `hooks/useRealtimeEvents.ts` | Realtime events. |
| `types/report.ts` | Report types (JobReportData, etc.). |

---

## 5. iOS – Riskmate app (`mobile/Riskmate/Riskmate/`)

SwiftUI app: entry, config, models, services, views, components, theme, utils.

### Entry & config

| File | Purpose |
|------|--------|
| `RiskmateApp.swift` | App entry: ContentView, toast overlay, quick action handling. |
| `Config.swift` | Loads Config.plist: BACKEND_URL, SUPABASE_URL, SUPABASE_ANON_KEY. |
| `Config.plist` | Backend URL and Supabase keys (per environment). |
| `Info.plist` | App info, permissions. |
| `Riskmate.entitlements` | Capabilities. |

### Models

| File | Purpose |
|------|--------|
| `Models/Job.swift` | Job model (id, clientName, status, riskLevel, etc.). |
| `Models/User.swift` | User model. |
| `Models/Organization.swift` | Organization model. |
| `Models/Executive.swift` | Executive summary model. |
| `Models/Readiness.swift` | Readiness model. |
| `Models/Team.swift` | Team model. |

### Services

| File | Purpose |
|------|--------|
| `Services/APIClient.swift` | Backend API client: jobs, evidence, hazards, controls, exports, audit, account, etc. |
| `Services/APIEnvelope.swift` | API response envelope types. |
| `Services/AuthService.swift` | Supabase auth wrapper. |
| `Services/SessionManager.swift` | Session state, current user, bootstrap. |
| `Services/EntitlementsManager.swift` | Server-driven entitlements (e.g. auditor). |
| `Services/BackgroundUploadManager.swift` | Background evidence uploads. |
| `Services/BackgroundExportManager.swift` | Background export (PDF, proof pack). |
| `Services/ServerStatusManager.swift` | Backend health check. |
| `Services/RealtimeEventService.swift` | Realtime events. |
| `Services/OfflineCache.swift` | Offline cache. |
| `Services/RetryManager.swift` | Retry logic. |
| `Services/JWTExpiry.swift` | JWT expiry handling. |
| `Services/FilterPersistence.swift` | Filter persistence. |
| `Services/Analytics.swift` | Analytics. |
| `Services/CrashReporting.swift` | Crash reporting. |

### State & stores

| File | Purpose |
|------|--------|
| `State/QuickActionRouter.swift` | Quick actions: present evidence, switch to ledger/work records. |
| `Stores/JobsStore.swift` | Jobs list store (fetch, filter). |
| `ViewModels/DashboardViewModel.swift` | Dashboard VM. |

### Views – Main

| File | Purpose |
|------|--------|
| `Views/Main/ContentView.swift` | Root: session gate, backend health, onboarding, tab/split (Operations, Audit, Executive, Account). |
| `Views/Main/OperationsView.swift` | Operations hub: jobs list, header, FAB (pick job → evidence), empty “Open Web App”. |
| `Views/Main/JobDetailView.swift` | Job detail: sticky tabs (Overview, Hazards, Controls, Evidence), ••• menu (Export, Ledger, Work Records, Web), ExportProofSheet, tab validation. |
| `Views/Main/JobsListView.swift` | Jobs list content (dashboard/defensibility). |
| `Views/Main/DashboardView.swift` | Dashboard tab content. |
| `Views/Main/AccountView.swift` | Account: profile, team, support bundle, delete account. |
| `Views/Main/AuditView.swift` | Audit tab container. |
| `Views/Main/AuditFeedView.swift` | Audit feed list. |
| `Views/Main/ReadinessView.swift` | Readiness dashboard. |
| `Views/Main/ExecutiveView.swift` | Executive view. |
| `Views/Main/ExecutiveViewRedesigned.swift` | Executive redesigned. |
| `Views/Main/TeamView.swift` | Team members. |

### Views – Auth, Evidence, Exports, Ledger, Onboarding, Settings, Shared

| File | Purpose |
|------|--------|
| `Views/Auth/AuthView.swift` | Login/sign-in UI. |
| `Views/Evidence/EvidenceCaptureSheet.swift` | Evidence capture sheet (camera/upload, anchor). |
| `Views/Exports/ExportProofSheet.swift` | Export sheet: PDF + Proof Pack (fetch readiness, lock/unlock, Retry, Add Evidence CTA). |
| `Views/Exports/ExportReceiptView.swift` | Export receipt. |
| `Views/Ledger/ProofReceiptDetailsView.swift` | Proof receipt details. |
| `Views/Ledger/VerificationDetailsView.swift` | Verification details. |
| `Views/Onboarding/TrustOnboardingView.swift` | Trust onboarding. |
| `Views/Onboarding/FirstRunOnboardingView.swift` | First-run onboarding. |
| `Views/Onboarding/OnboardingView.swift` | Onboarding flow. |
| `Views/Onboarding/SetupChecklistView.swift` | Setup checklist. |
| `Views/Settings/DeleteAccountSheet.swift` | Delete account sheet. |
| `Views/Settings/EntitlementsDebugView.swift` | Entitlements debug. |
| `Views/Settings/EnvironmentDebugView.swift` | Environment debug. |
| `Views/Settings/SupportBundleView.swift` | Support bundle. |
| `Views/Settings/TermsOfServiceView.swift` | Terms. |
| `Views/Settings/PrivacyPolicyView.swift` | Privacy. |
| `Views/Shared/SplashView.swift` | Splash. |
| `Views/Shared/RMBackground.swift` | App background. |
| `Views/Shared/RMGlassCard.swift` | Glass card. |
| `Views/Shared/RMPrimaryButton.swift` | Primary button. |
| `Views/Shared/RMTextField.swift` | Text field. |
| `Views/Shared/RMAuthTextField.swift` | Auth text field. |

### Components – Operations, Premium, Evidence, Ledger, Toast, etc.

| File | Purpose |
|------|--------|
| `Components/Operations/OperationsHeaderView.swift` | Status row (Live • Active • High Risk). |
| `Components/Operations/FloatingEvidenceFAB.swift` | FAB for evidence. |
| `Components/Operations/OperationsCoachMarks.swift` | Coach marks. |
| `Components/Operations/ScrollOffsetPreferenceKey.swift` | Scroll offset. |
| `Components/Premium/JobRow.swift` | Job row (list). |
| `Components/Premium/JobCard.swift` | Job card. |
| `Components/Premium/JobCardLongPressActions.swift` | Job long-press actions. |
| `Components/Premium/RMButton.swift` | Button. |
| `Components/Premium/RMCard.swift` | Card. |
| `Components/Premium/RMSearchBar.swift` | Search bar. |
| `Components/Premium/SyncChip.swift` | Sync chip. |
| `Components/Premium/LiveSyncStatus.swift` | Live sync status. |
| `Components/Premium/LedgerReceiptCard.swift` | Ledger receipt card. |
| `Components/Premium/VerificationBanner.swift` | Verification banner. |
| `Components/Premium/CriticalRiskBanner.swift` | Critical risk banner. |
| `Components/Premium/LongPressHint.swift` | Long-press hint. |
| `Components/Premium/AnchoringRefreshState.swift` | Refresh state. |
| `Components/Premium/RMPremiumList.swift` | Premium list. |
| `Components/Evidence/EvidenceQuickBar.swift` | Evidence quick bar. |
| `Components/Evidence/EvidenceUploadStatusBar.swift` | Upload status bar. |
| `Components/Evidence/StepIndicator.swift` | Step indicator. |
| `Components/Ledger/LedgerTrustStrip.swift` | Ledger trust strip. |
| `Components/Ledger/FirstVisitAnimationView.swift` | First-visit animation. |
| `Components/Ledger/TickingTimestamp.swift` | Ticking timestamp. |
| `Components/Ledger/VerificationExplainerSheet.swift` | Verification explainer. |
| `Components/Toast/ToastCenter.swift` | Global toast center. |
| `Components/Toast/ToastView.swift` | Toast view. |
| `Components/Auditor/ReadOnlyBanner.swift` | Read-only banner (auditors). |
| `Components/Onboarding/CoachMark.swift` | Coach mark. |
| `Components/Animations/AppearIn.swift` | Appear animation. |
| `Components/UIKit/ShareSheet.swift` | Share sheet. |
| `Components/UIKit/VisualEffectBlur.swift` | Blur. |
| `Components/Debug/DebugOverlay.swift` | Debug overlay. |
| `Components/RMEvidenceCapture.swift` | Evidence capture (camera/picker). |
| `Components/RMEvidenceRequirements.swift` | Evidence requirements. |
| `Components/RMEmptyState.swift` | Empty state. |
| `Components/RMOfflineBanner.swift` | Offline banner. |
| `Components/RMSkeletonView.swift` | Skeleton. |
| `Components/RMPhotoPicker.swift` | Photo picker. |
| `Components/RMPDFViewer.swift` | PDF viewer. |
| `Components/RMImageLoader.swift` | Image loader. |
| `Components/RMLottieView.swift` | Lottie. |
| `Components/RMRiveView.swift` | Rive. |
| `Components/RMChartCard.swift` | Chart card. |
| `Components/RMProofFirstTile.swift` | Proof first tile. |
| `Components/RMRecordedStrip.swift` | Recorded strip. |
| `Components/RMSyncStatusChip.swift` | Sync status chip. |
| `Components/RMTrustReceipt.swift` | Trust receipt. |
| `Components/RMTrustToast.swift` | Trust toast. |
| `Components/RMIntegritySurface.swift` | Integrity surface. |
| `Components/RMLedgerIntegrity.swift` | Ledger integrity. |
| `Components/RiskMateLogo.swift` | Logo. |

### Theme

| File | Purpose |
|------|--------|
| `Theme/RMTheme.swift` | RM theme (colors, typography, spacing, radius). |
| `Theme/RMSystemTheme.swift` | System theme. |
| `Theme/DesignSystem.swift` | Design system. |
| `Theme/RiskMateDesignSystem.swift` | RiskMate design system (Haptics, etc.). |
| `Theme/View+Accessibility.swift` | Accessibility modifiers. |
| `Theme/View+MicroInteractions.swift` | Micro-interactions. |
| `Theme/View+RMStyle.swift` | RM style modifiers. |

### Utils

| File | Purpose |
|------|--------|
| `Utils/Haptics.swift` | Haptic feedback. |
| `Utils/UserDefaultsManager.swift` | UserDefaults (onboarding, prefs). |
| `Utils/AuditorMode.swift` | Auditor mode (legacy/local). |
| `Utils/WebAppHelpers.swift` | WebAppURL.openWebApp() + “Couldn’t open link” toast. |

---

## 6. Backend – Express API (`apps/backend/src/`)

Express server: routes, middleware, services, workers, utils.

### Entry & lib

| File | Purpose |
|------|--------|
| `index.ts` | Express app: CORS, auth, mount /api/* and /v1/*, health, __version, __routes; start exportWorker, retentionWorker, ledgerRootWorker. |
| `lib/supabaseClient.ts` | Supabase client (service role). |
| `lib/supabaseAuthClient.ts` | Supabase auth client. |
| `lib/billingMonitoring.ts` | Billing monitoring. |

### Middleware

| File | Purpose |
|------|--------|
| `middleware/auth.ts` | JWT validation (Supabase), attach user to request. |
| `middleware/audit.ts` | recordAuditLog, extractClientMetadata (client, app_version, device_id). |
| `middleware/requestId.ts` | Request ID. |
| `middleware/rateLimiter.ts` | Rate limiting. |
| `middleware/limits.ts` | Plan/usage limits. |
| `middleware/requireWriteAccess.ts` | Block read-only (auditor) for writes. |

### Routes

| File | Purpose |
|------|--------|
| `routes/account.ts` | Account/org, me. |
| `routes/analytics.ts` | Analytics. |
| `routes/audit.ts` | Audit events, assign, resolve, export, readiness, incidents. |
| `routes/dashboard.ts` | Dashboard. |
| `routes/devAuth.ts` | Dev auth (DEV_AUTH_SECRET). |
| `routes/evidence.ts` | Evidence CRUD, upload. |
| `routes/executive.ts` | Executive brief, risk posture. |
| `routes/exports.ts` | Export create (PDF, proof pack), get export; idempotency; failure_reason. |
| `routes/jobs.ts` | Jobs CRUD, hazards, controls, permit-packs, assign, etc. |
| `routes/legal.ts` | Legal accept, status, version. |
| `routes/metrics.ts` | Metrics. |
| `routes/notifications.ts` | Notifications. |
| `routes/publicVerification.ts` | Public verification. |
| `routes/reports.ts` | Reports, runs, signatures, PDF. |
| `routes/risk.ts` | Risk factors, summary. |
| `routes/sites.ts` | Sites. |
| `routes/stripeWebhook.ts` | Stripe webhook handler. |
| `routes/subscriptions.ts` | Subscriptions, checkout, portal, verify. |
| `routes/team.ts` | Team, invite, member. |
| `routes/verification.ts` | Verification. |

### Services & workers

| File | Purpose |
|------|--------|
| `services/exportWorker.ts` | Poll exports queue; generate PDF/proof pack; set failure_reason on error. |
| `services/ledgerRootWorker.ts` | Ledger root worker. |
| `services/retentionWorker.ts` | Retention worker. |
| `services/notifications.ts` | Notifications. |
| `workers/notifications.ts` | Notifications worker. |

### Utils

| File | Purpose |
|------|--------|
| `utils/errorResponse.ts` | createErrorResponse, logErrorForSupport. |
| `utils/structuredLog.ts` | Structured logging. |
| `utils/idempotency.ts` | Idempotency. |
| `utils/riskScoring.ts` | Risk scoring. |
| `utils/projections.ts` | Projections. |
| `utils/realtimeEvents.ts` | Emit job/evidence events. |
| `utils/categoryMapper.ts` | Category mapping. |
| `utils/commandRunner.ts` | Command runner. |
| `utils/email.ts` | Email. |
| `utils/legal.ts` | Legal. |
| `utils/jobReport.ts` | Job report. |
| `utils/pdf/*.ts` | PDF generation: contracts, executiveBrief, ledgerExport, proofPack, sections (cover, executiveSummary, hazardChecklist, photos, signatures, timeline), styles, types, utils, normalize, packContext, proofPackTheme. |
| `auth/planRules.ts` | Plan rules (backend). |
| `types/express.d.ts` | Express request extensions. |

### Tests

| File | Purpose |
|------|--------|
| `__tests__/helpers/testData.ts` | Test data. |
| `__tests__/routes/read-only-enforcement.test.ts` | Read-only enforcement tests. |

---

## 7. Supabase – Migrations (`supabase/migrations/`)

Ordered SQL migrations. Naming: `YYYYMMDD…_description.sql`.

| Migration | Purpose |
|-----------|--------|
| `20240101000000_initial_schema.sql` | Core schema (orgs, users, jobs, etc.). |
| `20240101000001_row_level_security.sql` | RLS policies. |
| `20240101000002_seed_data.sql` | Seed data. |
| `20240101000003_storage_buckets.sql` | Storage buckets. |
| `20241201000000_create_template_tables.sql` | Template tables. |
| `20241202000000_add_template_tracking_to_jobs.sql` | Template tracking on jobs. |
| `20241225000000_add_remove_team_member_rpc.sql` | Remove team member RPC. |
| `20241225000001_fix_fk_constraints_for_deletion.sql` | FK fixes for deletion. |
| `20241225000002_add_transfer_ownership_rpc.sql` | Transfer ownership RPC. |
| `20250105000000_add_report_run_statuses.sql` | Report run statuses. |
| `20250105000001_add_superseded_fields.sql` | Superseded fields. |
| `20250106000000_add_attestation_text_to_signatures.sql` | Attestation text on signatures. |
| `20250115000000_add_evidence_verifications.sql` | Evidence verifications. |
| `20250116000000_add_job_archive_delete.sql` | Job archive/delete. |
| `20250116000000_add_webhook_idempotency.sql` | Webhook idempotency. |
| `20250116000002_add_review_flag.sql` | Review flag. |
| `20250117000001_add_account_deactivation.sql` | Account deactivation. |
| `20250117000002_add_team_events.sql` | Team events. |
| `20250118000001_add_job_signoffs.sql` | Job sign-offs. |
| `20250119000000_upgrade_audit_logs_enterprise.sql` | Audit logs upgrade. |
| `20250122000000_fix_sites_rls_policy.sql` | Sites RLS fix. |
| `20250122000000_fix_stripe_webhook_events_table.sql` | Stripe webhook events table. |
| `20250122000002_fix_rls_recursion_with_security_definer_helpers.sql` | RLS recursion fix (security definer). |
| `20250122000003_fix_other_tables_rls_recursion.sql` | Other tables RLS recursion fix. |
| `20250123000000_add_none_plan_default.sql` | None plan default. |
| `20250123000000_recategorize_audit_events.sql` | Recategorize audit events. |
| `20250123000001_fix_users_current_plan_constraint.sql` | Users current_plan constraint. |
| `20250124000000_make_subscriptions_period_dates_nullable.sql` | Subscriptions period nullable. |
| `20250124000001_add_idempotency_cleanup_job.sql` | Idempotency cleanup. |
| `20250125000000_ensure_org_subscriptions_integrity.sql` | Org subscriptions integrity. |
| `20250126000000_add_realtime_events_table.sql` | Realtime events table. |
| `20250126000001_add_realtime_observability.sql` | Realtime observability. |
| `20250126000002_add_exports_failure_reason.sql` | exports.failure_reason column. |
| `20250127000000_add_funnel_events_table.sql` | Funnel events. |
| `20250127000001_add_reconciliation_logs_table.sql` | Reconciliation logs. |
| `20250127000002_add_billing_alerts_table.sql` | Billing alerts. |
| `20250127000003_lock_down_admin_reads.sql` | Lock down admin reads. |
| `20250127000004_add_alert_deduplication.sql` | Alert deduplication. |
| `20251109000200_add_audit_logs.sql` | Audit logs. |
| `20251109000300_add_legal_acceptances.sql` | Legal acceptances. |
| `20251109000400_add_device_tokens.sql` | Device tokens. |
| `20251112000500_add_org_branding.sql` | Org branding. |
| `20251112000600_add_report_snapshots.sql` | Report snapshots. |
| `20251112000700_add_refresh_tokens.sql` | Refresh tokens. |
| `20251112000800_add_team_seats.sql` | Team seats. |
| `20251112000900_add_invite_user_id_column.sql` | Invite user_id. |
| `20251118043000_add_phone_to_users.sql` | Phone on users. |
| `20251127000000_add_missing_rls_policies.sql` | Missing RLS policies. |
| `20251127000001_add_plan_tracking.sql` | Plan tracking. |
| `20251127000002_fix_plan_tracking_actor_id.sql` | Plan tracking actor_id. |
| `20251128000000_comprehensive_schema_restructure.sql` | Schema restructure. |
| `20251201000000_add_report_runs_and_signatures.sql` | Report runs and signatures. |
| `20251202000000_add_packet_type_to_report_runs.sql` | Packet type on report_runs. |
| `20251203000000_database_hardening_ledger_compliance.sql` | Ledger/compliance hardening. |
| `20251203000003_fix_evidence_lifecycle.sql` | Evidence lifecycle fix. |
| `20251203000004_export_worker_atomic_claim.sql` | Export worker atomic claim. |
| `20251203000005_production_hardening.sql` | Production hardening. |

(Full set: 68 migrations in `supabase/migrations/`; names follow `YYYYMMDD…_description.sql`.)

---

## 8. Scripts (`scripts/`)

| File | Purpose |
|------|--------|
| `apply-claim-export-job-migration.sql` | Apply export job claim migration. |
| `apply-template-columns-migration.sql` | Apply template columns. |
| `audit-day-test.ts` | Audit day test. |
| `check-error-codes.ts` | Check error codes. |
| `copy-pdfkit-afm.js` | Copy PDFKit AFM. |
| `fix-claim-export-job.sh` | Fix claim export job. |
| `generate-ci-print-token.ts` | Generate CI print token. |
| `get-stripe-price-ids.sh` / `.ts` | Get Stripe price IDs. |
| `setup-database-sync.sh` | Setup DB sync. |
| `setup-supabase.sh` | Setup Supabase. |
| `test-executive-brief-closeout.ts` | Executive brief closeout test. |
| `verify-claim-export-job.sql` | Verify claim export job. |
| `verify-database-sync.sh` | Verify DB sync. |
| `verify-org-data.ts` | Verify org data. |
| `verify-supabase-sync.sh` | Verify Supabase sync. |
| `verify-user-org-sync.sh` | Verify user/org sync. |

---

## 9. PDF service (`pdf-service/`)

Standalone PDF generation service (e.g. Fly.io).

| File | Purpose |
|------|--------|
| `server.js` | HTTP server for PDF generation. |
| `package.json` | Dependencies. |
| `Dockerfile` | Container build. |
| `fly.toml` | Fly.io config. |
| `docker-run.sh` | Local Docker run. |
| `test-auth.js` | Auth test. |
| `README.md` / `DEPLOY.md` / `DOCKER_LOCAL.md` | Docs. |
| `.dockerignore` | Docker ignore. |

---

## 10. Root & config

| File | Purpose |
|------|--------|
| `pnpm-workspace.yaml` | Workspace: apps/*. |
| `vercel.json` | Vercel: cron (e.g. executive-alerts). |
| `middleware.ts.backup` | Backup of Next middleware. |
| `.eslintrc.json` | ESLint. |
| `RISKMATE_FEATURE_SPECIFICATION.md` | Feature spec (web). |
| `RISKMATE_WEB_SPEC_v1.md` | Locked v1 spec pointer. |
| `APPLY_MIGRATIONS.md` | How to apply migrations. |
| `PRODUCTION_DEPLOYMENT_CHECKLIST.md` | Production checklist. |
| `ALERT_SETUP.md`, `DEPLOYMENT_CHECKLIST.md`, etc. | Other runbooks/docs. |

---

## Summary

- **Web**: `app/` = pages + API routes; `components/` = UI; `lib/` = API client, Supabase, PDF, utils; `hooks/`, `types/` at root.
- **iOS**: `mobile/Riskmate/Riskmate/` = SwiftUI app; Config, Models, Services, State, Stores, ViewModels, Views, Components, Theme, Utils.
- **Backend**: `apps/backend/src/` = Express index, lib, middleware, routes, services, workers, utils, auth, types, tests.
- **Supabase**: `supabase/migrations/` = 68 timestamped SQL migrations (schema, RLS, features).
- **Scripts**: `scripts/` = DB/Supabase sync, Stripe, export job, print token, verification.
- **PDF service**: `pdf-service/` = Standalone PDF server (Fly.io/Docker).

Use this doc to locate any file by slice and purpose. For a given feature (e.g. “export proof pack”), you can trace: **iOS** ExportProofSheet → **Backend** exports.ts + exportWorker.ts → **Supabase** exports table + `failure_reason` migration.

---

**Companion doc**: For **every feature** (web + iOS), **design systems** (web + iOS), and **UI/UX patterns** (flows, loading/empty/error, accessibility, haptics), see **[FEATURES_DESIGN_AND_UX.md](./FEATURES_DESIGN_AND_UX.md)**.
