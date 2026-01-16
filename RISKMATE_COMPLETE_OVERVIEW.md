# RiskMate - Complete Technical & Product Overview

**The Ultimate Guide to Everything RiskMate**

> This document covers every aspect of RiskMate: features, tech stack, architecture, file structure, pages, workers, UI/UX design, database schema, API routes, mobile app, and deployment. **Everything.**

---

## 📋 Table of Contents

1. [Product Overview](#product-overview)
2. [Tech Stack](#tech-stack)
3. [Architecture](#architecture)
4. [Complete Feature List](#complete-feature-list)
5. [UI/UX Design System](#uiux-design-system)
6. [File Structure](#file-structure)
7. [Pages & Routes](#pages--routes)
8. [Backend Services & Workers](#backend-services--workers)
9. [Database Schema](#database-schema)
10. [API Routes](#api-routes)
11. [Mobile App (iOS)](#mobile-app-ios)
12. [Deployment](#deployment)
13. [Development Workflow](#development-workflow)

---

## 🎯 Product Overview

### What is RiskMate?

**RiskMate** is a SaaS platform for service contractors (electricians, roofers, HVAC, general contractors) to manage job safety, risk assessments, compliance documentation, and generate audit-ready PDF reports.

**Target Market**: Small to medium trade companies (1-50 employees) who need professional safety documentation for insurance, clients, and compliance.

### Core Value Proposition

- **Replace messy paper forms** → Digital checklists
- **Replace random job photos** → Organized evidence with categories
- **Replace inconsistent safety checks** → Automated risk scoring
- **Replace manual reports** → Auto-generated PDFs
- **Replace no audit trail** → Complete activity log

### Business Model

**Subscription Plans**:
- **Starter** (Free/Trial): 3 jobs/month, 1 seat, basic PDFs
- **Pro** ($X/month): Unlimited jobs, 5 seats, branded PDFs, notifications
- **Business** ($X/month): Unlimited jobs, unlimited seats, analytics, permit packs, priority support

**Revenue Streams**:
1. Monthly/annual subscriptions
2. Upsells (Starter → Pro → Business)
3. Enterprise custom pricing (future)

---

## 🏗️ Tech Stack

### Web Frontend

**Framework & Core**:
- **Next.js 15** (App Router) - React framework
- **TypeScript** - Type safety
- **React 18.2** - UI library
- **Tailwind CSS** - Styling
- **Framer Motion** - Animations
- **GSAP** - Advanced animations
- **Lenis** - Smooth scrolling

**UI Components**:
- **Radix UI** - Accessible components (Accordion, Popover, Select)
- **Lucide React** - Icons
- **React Hook Form** - Form handling
- **Zod** - Schema validation

**3D & Graphics**:
- **Three.js** - 3D graphics
- **React Three Fiber** - React wrapper for Three.js
- **@react-three/drei** - Three.js helpers
- **TSParticles** - Particle effects

**PDF & Documents**:
- **PDFKit** - PDF generation
- **pdf-lib** - PDF manipulation
- **pdfjs-dist** - PDF rendering

**Other**:
- **SWR** - Data fetching/caching
- **date-fns** - Date utilities
- **QRCode** - QR code generation
- **Archiver** - ZIP file creation

### Backend

**Core**:
- **Express.js** - Web framework
- **Node.js** - Runtime
- **TypeScript** - Type safety

**Database & Storage**:
- **Supabase** (PostgreSQL) - Database
- **Supabase Auth** - Authentication
- **Supabase Storage** - File storage
- **Supabase Realtime** - Real-time subscriptions

**Payments**:
- **Stripe** - Payment processing, subscriptions, webhooks

**PDF Generation**:
- **PDFKit** - Server-side PDF generation
- **Archiver** - ZIP file creation

**Other**:
- **Axios** - HTTP client
- **Crypto** - Hashing, encryption

### Mobile (iOS)

**Core**:
- **Swift** - Programming language
- **SwiftUI** - UI framework
- **iOS 17.0+** - Minimum deployment target

**Networking**:
- **URLSession** - HTTP requests
- **BackgroundUploadManager** - Background file uploads
- **BackgroundExportManager** - Background export processing

**Media**:
- **PhotosPicker** - Photo selection
- **PDFKit** - PDF viewing

**Other**:
- **Combine** - Reactive programming
- **UserNotifications** - Push notifications
- **Core Data** (via OfflineCache) - Local storage

### Infrastructure

**Hosting**:
- **Vercel** - Web app hosting (serverless)
- **Railway** - Backend API hosting
- **Supabase Cloud** - Database & storage

**Analytics**:
- **PostHog** - Product analytics
- **Vercel Analytics** - Performance metrics
- **Vercel Speed Insights** - Core Web Vitals

**Monitoring**:
- Built-in error handling with structured logging
- Request ID tracking
- Error ID generation for support

---

## 🏛️ Architecture

### Multi-Tenant Architecture

**Three-Layer Data Isolation**:

1. **Database Layer (RLS)**:
   - Row Level Security policies filter by `organization_id`
   - Automatic enforcement at database level

2. **Application Layer**:
   - All API routes use `getOrganizationContext()`
   - Explicit filtering by `organization_id`
   - Middleware enforces organization boundaries

3. **Storage Layer**:
   - Bucket policies scoped to `organization_id`
   - File paths: `{orgId}/jobs/{jobId}/photos/{filename}`

**Security Guarantees**:
- Users can only access their organization's data
- ID enumeration attacks blocked
- Direct database queries filtered by RLS
- Storage access organization-scoped

### Data Flow

```
User Action → Next.js API Route → Organization Guard → Supabase Query (with RLS) → Response
```

**Example: Creating a Job**:
1. User submits job form
2. API route verifies organization context
3. Backend checks subscription limits
4. Risk factors selected → Risk score calculated
5. Mitigation items auto-generated
6. Job created with audit log entry
7. Response returned to frontend

### Authentication & Authorization

**Authentication**:
- Supabase Auth (email/password)
- JWT tokens stored client-side
- Session management via Supabase client

**Authorization (RBAC)**:
- **Owner**: Full access (billing, team, all features)
- **Admin**: Most features (no billing management)
- **Member**: Limited access (create jobs, complete mitigations, view reports)

**Permission System**:
- Granular permissions: `jobs.create`, `jobs.edit`, `reports.generate`, `team.invite`, etc.
- Checked via `hasPermission(role, permission)`
- Enforced in API routes via middleware

### Ledger-First Architecture

**Command Model**:
Every command follows: **Validate → Authorize → Mutate → Ledger Append (atomic)**

**Benefits**:
- Domain changes and ledger entries succeed/fail together
- Idempotency via idempotency keys
- Consistent request_id correlation
- Standardized error handling

**Ledger Events**:
- All material events recorded in `audit_logs` table
- Complete activity trail for compliance
- Immutable audit log (read-only after creation)

---

## 📱 Complete Feature List

### A. Authentication & Organization

1. **Sign Up** (`/signup`)
   - Email/password registration
   - Auto-create organization
   - Set user as owner
   - Starter plan (trial)

2. **Login** (`/login`)
   - Email/password authentication
   - Session management
   - Redirect to dashboard

3. **Logout**
   - Clear session
   - Redirect to login

4. **Forgot Password** (`/forgot-password`)
   - Email reset link
   - Token-based reset flow

5. **Organization Context**
   - Multi-tenant data isolation
   - RLS policies
   - Organization-scoped queries

6. **Roles System**
   - Owner, Admin, Member roles
   - Granular permissions
   - Role-based UI gating

7. **Team Invites** (`/dashboard/team`)
   - Email-based invitations
   - Role assignment
   - Token-based acceptance

8. **Subscription Plans**
   - Starter, Pro, Business tiers
   - Plan limits enforcement
   - Stripe integration

9. **Plan Enforcement**
   - Job limits (Starter: 3/month)
   - Seat limits
   - Feature gating

10. **Plan Switching** (`/dashboard/account`)
    - Upgrade/downgrade flows
    - Stripe Checkout
    - Webhook confirmation

### B. Core App Features

11. **Dashboard Overview** (`/dashboard`)
    - Today's jobs card
    - Jobs at risk card
    - Recent evidence card
    - Incomplete mitigations card
    - Compliance trend chart
    - Workforce activity feed

12. **Jobs List** (`/dashboard/jobs`)
    - DataGrid with sorting/filtering
    - Search functionality
    - Status/risk level filters
    - Pagination

13. **New Job Flow** (`/dashboard/jobs/new`)
    - Job creation form
    - Risk factor selection
    - Template selection
    - Auto-mitigation generation

14. **Job Detail** (`/dashboard/jobs/[id]`)
    - Risk & Hazards tab
    - Mitigation Checklist tab
    - Evidence (Photos & Docs) tab
    - Timeline/Activity tab
    - Assignments & Signatures tab
    - Documents tab

15. **Risk Scoring Engine**
    - Weighted severity system
    - Real-time calculation
    - Risk level assignment (Low/Med/High/Critical)
    - Auto-mitigation generation

16. **Templates System** (`/dashboard/account` → Templates)
    - Job templates
    - Hazard templates
    - Usage tracking
    - Apply to jobs

17. **Mitigation Tracking**
    - Checklist items
    - Completion tracking
    - Progress calculation
    - Audit logging

18. **Photo Uploads**
    - Drag-and-drop upload
    - Client-side compression
    - Category assignment (Before/During/After)
    - GPS metadata extraction

19. **Document Management**
    - PDF, DOCX, image uploads
    - Category assignment
    - Signed URL access
    - Download functionality

20. **PDF Report Generation**
    - Risk Snapshot Report
    - Branded PDFs (Pro/Business)
    - Share links (token-based)
    - Multiple sections (cover, summary, hazards, controls, timeline, photos, signatures)

21. **Permit Pack Generator** (Business only)
    - ZIP file with all documentation
    - PDF report
    - CSV exports (hazards, controls)
    - JSON metadata
    - Categorized photos

22. **Client Portal** (`/client/[token]`)
    - Public read-only view
    - Token-based access
    - 7-day expiry
    - PDF download

23. **Analytics Dashboard** (`/dashboard/analytics`) (Business only)
    - Compliance rate over time
    - High-risk job count
    - Average time to close
    - Evidence volume
    - Risk score distribution
    - Top hazards
    - Team activity

24. **Audit Log & Version History**
    - Complete activity trail
    - Timeline view
    - Event grouping
    - Actor tracking

25. **Evidence Verification** (Admin/Owner only)
    - Approve/reject photos
    - Status badges
    - Reviewer tracking

26. **Job Assignment**
    - Assign workers to jobs
    - Multi-select interface
    - Assignment tracking

### C. UX Polish

27. **Microcopy**
    - Contextual help text
    - Risk score explanations
    - Feature descriptions

28. **Inline Editing**
    - EditableText component
    - EditableSelect component
    - Real-time updates

29. **Skeleton Loaders**
    - Dashboard skeletons
    - Job list skeletons
    - Smooth transitions

30. **PWA / Offline**
    - Service worker
    - Manifest file
    - Install prompt
    - Basic offline cache

31. **Onboarding Wizard**
    - First-time user flow
    - Trade type selection
    - Team size selection
    - Create first job

32. **Changelog**
    - Recent updates widget
    - Full changelog page

### D. Marketing Site

33. **Landing Page** (`/`)
    - Hero section with 3D scene
    - Feature highlights
    - "What RiskMate Replaces" section
    - Mobile app promo
    - Social proof
    - Founder story
    - FAQ preview

34. **Pricing Page** (`/pricing`)
    - Three-tier pricing table
    - Feature comparison
    - ROI calculator
    - FAQ section
    - Stripe checkout

35. **Case Studies**
    - `/case-studies/electrical`
    - `/case-studies/roofing`
    - `/case-studies/hvac`

36. **Comparison Pages**
    - `/compare/safetyculture`
    - `/compare/sitedocs`
    - `/compare/pen-and-paper`
    - `/compare/spreadsheets`

37. **Calculator Tools**
    - `/tools/risk-score-calculator`
    - `/tools/compliance-score`
    - `/tools/incident-cost`
    - `/tools/time-saved`

38. **Contractor Bundle** (`/resources/bundle`)
    - Free resource download
    - ZIP file with templates

39. **Sample Report** (`/sample-report`)
    - Sample PDF download
    - No email required

40. **Interactive Demo** (`/demo`)
    - Read-only demo environment
    - Sample jobs
    - No login required

41. **Roadmap** (`/roadmap`)
    - Recently shipped
    - In development
    - Coming soon
    - Ideas under review

42. **Live Chat Widget**
    - FAQ bot
    - Floating bubble
    - Static answers

---

## 🎨 UI/UX Design System

### Color Palette

**Surfaces**:
- **Primary surface (cards/panels)**: `bg-white/[0.03]` + `border-white/10` (GlassCard)
- **Secondary surface (inputs/controls)**: `bg-white/5` + `border-white/10` + `backdrop-blur-sm`
- **Subtle border/divider**: `border-white/5` or `divide-white/5`
- **Hover states**: `hover:bg-white/5` or `hover:bg-white/10`

**Colors**:
- **Background**: `#0A0A0A` (minimal black)
- **Surface**: `#121212` (card backgrounds)
- **Primary Accent**: `#F97316` (orange)
- **Text Primary**: `#FFFFFF`
- **Text Secondary**: `#A1A1A1`
- **Success**: `#29CC6A`
- **Warning**: `#FFC53D`
- **Danger**: `#FF4D4F`

### Typography

**Fonts**:
- **Display Font**: Playfair Display (serif) - headings only
- **Body Font**: Inter (sans-serif) - all text

**Sizes**:
- **Display-1**: 72px (page titles)
- **Display-2**: 64px
- **H1**: 48px
- **H2**: 36px
- **Body**: 18px
- **Muted**: 14px, `text-white/60`

**Hierarchy**:
- Page titles: `text-4xl md:text-5xl font-bold font-display`
- Section titles: `text-2xl font-bold font-display`
- Body text: `text-base text-white/70`
- Labels: `text-xs uppercase tracking-wider text-white/50`

### Components

**GlassCard**:
- **MUST USE** for all cards, containers, panels
- Surface: `bg-white/[0.03]`, `border-white/10`
- Rounded: `rounded-3xl`
- Shadow: `shadow-[0_8px_32px_rgba(0,0,0,0.3)]`

**Button**:
- Primary, secondary, ghost variants
- **MUST USE** shared Button component
- Never inline button styles

**Badge**:
- **MUST USE** shared Badge component
- No colored dots or custom badge styling

**DataGrid**:
- Custom table component
- Editorial density (not cramped)
- Generous padding
- Subtle separators

### Design Rules (Non-Negotiable)

1. **No raw colors in page files** (except inputs/selects)
   - ❌ `className="bg-white/[0.03] border-white/10"` (use GlassCard)
   - ✅ `<GlassCard>` for cards/panels
   - ✅ `bg-white/5` allowed only for inputs, selects

2. **Typography hierarchy**
   - Serif (`font-display`) ONLY for page/section titles
   - Sans-serif for all data, labels, UI text

3. **Orange accent usage**
   - Primary CTAs only
   - Selected states
   - Hairline dividers
   - Hover states on links

4. **No dashboard kit artifacts**
   - ❌ Colored dots, colored left borders
   - ❌ Heavy shadows, multiple glows
   - ❌ Cramped spacing, tight grids

5. **Editorial density**
   - Tables → editorial list rows
   - Generous padding, breathing room
   - Subtle separators

### Spacing

- **Section spacing**: `mb-16` (64px between major sections)
- **Card padding**: `p-6` to `p-10` depending on content
- **Inner spacing**: `gap-6` for grids, `space-y-16` for vertical stacks

### Animations

- **Page transitions**: Framer Motion
- **Smooth scrolling**: Lenis (global component)
- **3D effects**: Three.js for hero scene
- **Particle effects**: TSParticles

---

## 📁 File Structure

### Root Structure

```
riskmate/
├── app/                          # Next.js app directory
│   ├── api/                      # API routes (serverless functions)
│   ├── dashboard/                # Dashboard pages
│   ├── operations/               # Operations app pages
│   ├── pricing/                  # Pricing & checkout
│   ├── tools/                    # Calculator tools
│   ├── case-studies/             # Industry case studies
│   ├── compare/                  # Competitor comparisons
│   ├── client/                   # Client portal (public)
│   ├── demo/                    # Interactive demo
│   ├── resources/                # Resource downloads
│   ├── roadmap/                 # Public roadmap
│   ├── sample-report/           # Sample PDF
│   ├── page.tsx                 # Landing page
│   ├── layout.tsx               # Root layout
│   └── globals.css              # Global styles
├── apps/
│   └── backend/                 # Express API server
│       ├── src/
│       │   ├── index.ts         # Server entry point
│       │   ├── routes/          # API route handlers
│       │   ├── services/        # Background workers
│       │   ├── middleware/      # Express middleware
│       │   ├── lib/            # Supabase clients
│       │   └── utils/          # Utility functions
│       └── package.json
├── components/                   # React components
│   ├── dashboard/               # Dashboard-specific components
│   ├── audit/                   # Audit/ledger components
│   ├── executive/               # Executive brief components
│   ├── report/                  # PDF report components
│   ├── onboarding/              # Onboarding wizard
│   ├── demo/                    # Demo mode components
│   ├── marketing/               # Marketing page components
│   └── shared/                  # Shared UI components
├── hooks/                        # Custom React hooks
├── lib/                          # Utilities & API clients
│   ├── supabase/                # Supabase client setup
│   ├── utils/                   # Helper functions
│   │   ├── pdf/                 # PDF generation
│   │   ├── permissions.ts       # RBAC system
│   │   └── planRules.ts         # Subscription limits
│   └── design-system/           # Design system components
├── mobile/                       # iOS app
│   └── Riskmate/
│       └── Riskmate/
│           ├── Views/           # SwiftUI views
│           ├── Components/      # Reusable components
│           ├── Services/        # Business logic
│           ├── Models/          # Data models
│           ├── Theme/           # Design system
│           └── Config.swift    # App configuration
├── supabase/
│   └── migrations/              # Database migrations
├── scripts/                      # Utility scripts
├── public/                       # Static assets
├── __tests__/                    # Test files
├── docs/                         # Documentation
└── package.json
```

### Web App Structure (`app/`)

```
app/
├── api/                          # API routes (Next.js serverless)
│   ├── auth/                     # Authentication
│   ├── jobs/                     # Job management
│   ├── reports/                  # Report generation
│   ├── exports/                  # Export jobs
│   ├── executive/                # Executive brief
│   ├── audit/                    # Audit/ledger
│   ├── analytics/                # Analytics
│   ├── team/                     # Team management
│   ├── account/                  # Account settings
│   ├── subscriptions/            # Stripe subscriptions
│   ├── stripe/                   # Stripe webhooks
│   ├── legal/                    # Legal acceptance
│   ├── verify/                   # Verification
│   └── resources/                # Resource downloads
├── dashboard/                    # Main dashboard
│   └── page.tsx
├── operations/                   # Operations app
│   ├── page.tsx                  # Operations dashboard
│   ├── jobs/                     # Job management
│   ├── audit/                    # Audit feed
│   ├── executive/                # Executive brief
│   ├── account/                  # Account settings
│   └── team/                     # Team management
├── pricing/                      # Pricing page
│   ├── page.tsx
│   ├── thank-you/                # Post-checkout
│   └── cancelled/                # Cancelled checkout
├── tools/                         # Calculator tools
│   ├── risk-score-calculator/
│   ├── compliance-score/
│   ├── incident-cost/
│   └── time-saved/
├── case-studies/                  # Industry case studies
│   ├── electrical/
│   ├── roofing/
│   └── hvac/
├── compare/                       # Competitor comparisons
│   ├── safetyculture/
│   ├── sitedocs/
│   ├── pen-and-paper/
│   └── spreadsheets/
├── client/                        # Client portal (public)
│   └── [token]/
├── demo/                          # Interactive demo
│   ├── layout.tsx
│   └── page.tsx
├── resources/                     # Resource downloads
│   └── bundle/
├── roadmap/                       # Public roadmap
│   └── page.tsx
├── sample-report/                 # Sample PDF
│   └── page.tsx
├── login/                         # Login page
│   └── page.tsx
├── signup/                        # Signup page
│   └── page.tsx
├── forgot-password/               # Password reset
│   └── page.tsx
├── reset/                         # Password reset confirmation
│   └── page.tsx
├── privacy/                       # Privacy policy
│   └── page.tsx
├── terms/                         # Terms of service
│   └── page.tsx
├── page.tsx                       # Landing page
├── layout.tsx                     # Root layout
└── globals.css                    # Global styles
```

### Components Structure (`components/`)

```
components/
├── dashboard/                     # Dashboard components
│   ├── DashboardNavbar.tsx
│   ├── DashboardSkeleton.tsx
│   ├── DataGrid.tsx
│   ├── KpiGrid.tsx
│   ├── TrendChart.tsx
│   └── ... (26 files)
├── audit/                         # Audit/ledger components
│   ├── EventDetailsDrawer.tsx
│   ├── EventSelectionTable.tsx
│   ├── EvidenceDrawer.tsx
│   ├── FixQueueSidebar.tsx
│   ├── LedgerEventListSkeleton.tsx
│   └── ... (19 files)
├── executive/                     # Executive brief components
│   └── PostureTilesSkeleton.tsx
├── report/                        # PDF report components
│   ├── GenerationProgressModal.tsx
│   ├── ReportShareModal.tsx
│   └── ... (30 files)
├── onboarding/                    # Onboarding wizard
│   └── OnboardingWizard.tsx
├── demo/                          # Demo mode components
│   ├── DemoBanner.tsx
│   ├── DemoGuide.tsx
│   ├── DemoJobDetail.tsx
│   ├── DemoNavbar.tsx
│   ├── DemoProtection.tsx
│   ├── GuidedTour.tsx
│   ├── RoleSwitcher.tsx
│   └── ScenarioPicker.tsx
├── marketing/                     # Marketing components
│   ├── HeroScene.tsx
│   ├── MagneticButton.tsx
│   └── ... (7 files)
├── shared/                        # Shared UI components
│   ├── Button.tsx
│   ├── Badge.tsx
│   ├── GlassCard.tsx
│   ├── PageHeader.tsx
│   ├── ErrorModal.tsx
│   ├── ConfirmModal.tsx
│   └── ... (26 files)
├── ChatWidget.tsx                 # Live chat widget
├── CursorGlow.tsx                 # Cursor effect
├── LegalModal.tsx                 # Legal acceptance modal
├── PWARegister.tsx               # PWA registration
├── ProtectedRoute.tsx             # Auth guard
├── RiskMateLogo.tsx               # Logo component
├── ScrollSection.tsx              # Scroll animations
├── ScrollToTop.tsx                # Scroll to top button
├── SmoothScroll.tsx               # Smooth scroll provider
├── StripeCheckout.tsx             # Stripe checkout
├── ToastContainer.tsx             # Toast notifications
└── UpgradeBanner.tsx              # Upgrade prompts
```

### Backend Structure (`apps/backend/src/`)

```
apps/backend/src/
├── index.ts                       # Server entry point
├── routes/                        # API route handlers
│   ├── jobs.ts                    # Job CRUD operations
│   ├── reports.ts                 # Report generation
│   ├── exports.ts                 # Export jobs
│   ├── executive.ts               # Executive brief
│   ├── audit.ts                   # Audit/ledger
│   ├── analytics.ts               # Analytics
│   ├── team.ts                    # Team management
│   ├── account.ts                 # Account settings
│   ├── subscriptions.ts           # Stripe subscriptions
│   ├── stripeWebhook.ts           # Stripe webhooks
│   ├── evidence.ts                # Evidence management
│   ├── verification.ts            # Verification
│   ├── publicVerification.ts      # Public verification
│   ├── metrics.ts                 # Metrics
│   ├── notifications.ts          # Notifications
│   ├── legal.ts                   # Legal acceptance
│   ├── risk.ts                    # Risk scoring
│   └── sites.ts                   # Site management
├── services/                       # Background workers
│   ├── exportWorker.ts            # Export queue processor
│   ├── retentionWorker.ts         # Data retention cleanup
│   ├── ledgerRootWorker.ts        # Ledger root computation
│   └── notifications.ts            # Notification service
├── middleware/                     # Express middleware
│   ├── auth.ts                    # Authentication
│   ├── audit.ts                   # Audit logging
│   ├── limits.ts                  # Plan limits enforcement
│   ├── rateLimiter.ts             # Rate limiting
│   └── requestId.ts               # Request ID tracking
├── lib/                            # Supabase clients
│   ├── supabaseClient.ts          # Service role client
│   └── supabaseAuthClient.ts      # Auth client
├── utils/                          # Utility functions
│   ├── riskScoring.ts             # Risk score calculation
│   ├── structuredLog.ts           # Structured logging
│   ├── errorResponse.ts           # Error handling
│   ├── commandRunner.ts           # Command runner (ledger-first)
│   ├── idempotency.ts             # Idempotency keys
│   ├── jobReport.ts               # Job report builder
│   ├── legal.ts                   # Legal utilities
│   ├── email.ts                   # Email sending
│   ├── categoryMapper.ts          # Category mapping
│   ├── projections.ts             # Data projections
│   └── pdf/                       # PDF generation
│       ├── index.ts               # Main PDF generator
│       ├── executiveBrief.ts      # Executive brief PDF
│       ├── ledgerExport.ts        # Ledger export PDF
│       ├── proofPack.ts           # Proof pack PDF
│       ├── sections/              # PDF sections
│       │   ├── cover.ts
│       │   ├── executiveSummary.ts
│       │   ├── hazardChecklist.ts
│       │   ├── controlsApplied.ts
│       │   ├── timeline.ts
│       │   ├── photos.ts
│       │   └── signatures.ts
│       └── ... (other PDF utilities)
└── types/                         # TypeScript types
    └── express.d.ts               # Express type extensions
```

### Mobile App Structure (`mobile/Riskmate/Riskmate/`)

```
mobile/Riskmate/Riskmate/
├── Views/                         # SwiftUI views
│   ├── Auth/
│   │   └── AuthView.swift         # Login/signup
│   ├── Main/
│   │   ├── ContentView.swift      # Main app container
│   │   ├── DashboardView.swift    # Dashboard
│   │   ├── JobsListView.swift     # Jobs list
│   │   ├── JobDetailView.swift    # Job detail
│   │   ├── OperationsView.swift   # Operations
│   │   ├── AuditView.swift        # Audit feed
│   │   ├── AuditFeedView.swift    # Audit feed list
│   │   ├── ExecutiveView.swift    # Executive brief
│   │   ├── ExecutiveViewRedesigned.swift
│   │   ├── ReadinessView.swift    # Readiness score
│   │   ├── TeamView.swift         # Team management
│   │   └── AccountView.swift      # Account settings
│   ├── Onboarding/
│   │   ├── OnboardingView.swift   # Onboarding flow
│   │   └── SetupChecklistView.swift
│   ├── Exports/
│   │   └── ExportReceiptView.swift
│   ├── Settings/
│   │   ├── PrivacyPolicyView.swift
│   │   ├── TermsOfServiceView.swift
│   │   └── SupportBundleView.swift
│   └── Shared/
│       ├── RMAuthTextField.swift
│       ├── RMBackground.swift
│       ├── RMGlassCard.swift
│       ├── RMPrimaryButton.swift
│       └── RMTextField.swift
├── Components/                     # Reusable components
│   ├── RiskMateLogo.swift
│   ├── RMChartCard.swift
│   ├── RMEmptyState.swift
│   ├── RMEvidenceCapture.swift    # Photo capture
│   ├── RMEvidenceRequirements.swift
│   ├── RMImageLoader.swift
│   ├── RMIntegritySurface.swift
│   ├── RMLedgerIntegrity.swift
│   ├── RMLottieView.swift
│   ├── RMOfflineBanner.swift
│   ├── RMPDFViewer.swift
│   ├── RMPhotoPicker.swift
│   ├── RMPremiumList.swift
│   ├── RMProofFirstTile.swift
│   ├── RMRecordedStrip.swift
│   ├── RMRiveView.swift
│   ├── RMSkeletonView.swift
│   ├── RMSyncStatusChip.swift
│   ├── RMTrustReceipt.swift
│   └── RMTrustToast.swift
├── Services/                       # Business logic
│   ├── APIClient.swift            # API client
│   ├── AuthService.swift          # Authentication
│   ├── SessionManager.swift       # Session management
│   ├── BackgroundUploadManager.swift  # Background uploads
│   ├── BackgroundExportManager.swift  # Background exports
│   ├── OfflineCache.swift         # Local storage
│   ├── Analytics.swift            # Analytics
│   ├── CrashReporting.swift      # Crash reporting
│   ├── RetryManager.swift        # Retry logic
│   ├── ServerStatusManager.swift  # Server status
│   └── FilterPersistence.swift   # Filter persistence
├── Models/                         # Data models
│   ├── User.swift
│   ├── Organization.swift
│   ├── Job.swift
│   ├── Executive.swift
│   ├── Readiness.swift
│   └── Team.swift
├── Theme/                          # Design system
│   ├── DesignSystem.swift
│   ├── RMTheme.swift
│   ├── View+Accessibility.swift
│   ├── View+MicroInteractions.swift
│   └── View+RMStyle.swift
├── Config.swift                    # App configuration
├── Config.plist                   # Config values
├── RiskmateApp.swift              # App entry point
└── Assets.xcassets/               # Images/assets
```

---

## 🛣️ Pages & Routes

### Public Pages

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | `app/page.tsx` | Landing page with hero, features, CTA |
| `/pricing` | `app/pricing/page.tsx` | Pricing table, ROI calculator, Stripe checkout |
| `/login` | `app/login/page.tsx` | Login form |
| `/signup` | `app/signup/page.tsx` | Signup form |
| `/forgot-password` | `app/forgot-password/page.tsx` | Password reset request |
| `/reset` | `app/reset/page.tsx` | Password reset confirmation |
| `/privacy` | `app/privacy/page.tsx` | Privacy policy |
| `/terms` | `app/terms/page.tsx` | Terms of service |
| `/demo` | `app/demo/page.tsx` | Interactive demo (read-only) |
| `/sample-report` | `app/sample-report/page.tsx` | Sample PDF download |
| `/roadmap` | `app/roadmap/page.tsx` | Public roadmap |
| `/resources/bundle` | `app/resources/bundle/page.tsx` | Contractor bundle download |
| `/client/[token]` | `app/client/[token]/page.tsx` | Public client portal |

### Case Studies

| Route | Component | Description |
|-------|-----------|-------------|
| `/case-studies/electrical` | `app/case-studies/electrical/page.tsx` | Electrical contractor case study |
| `/case-studies/roofing` | `app/case-studies/roofing/page.tsx` | Roofing company case study |
| `/case-studies/hvac` | `app/case-studies/hvac/page.tsx` | HVAC technician case study |

### Comparison Pages

| Route | Component | Description |
|-------|-----------|-------------|
| `/compare/safetyculture` | `app/compare/safetyculture/page.tsx` | vs SafetyCulture |
| `/compare/sitedocs` | `app/compare/sitedocs/page.tsx` | vs SiteDocs |
| `/compare/pen-and-paper` | `app/compare/pen-and-paper/page.tsx` | vs Paper forms |
| `/compare/spreadsheets` | `app/compare/spreadsheets/page.tsx` | vs Spreadsheet templates |

### Calculator Tools

| Route | Component | Description |
|-------|-----------|-------------|
| `/tools/risk-score-calculator` | `app/tools/risk-score-calculator/page.tsx` | Interactive risk calculator |
| `/tools/compliance-score` | `app/tools/compliance-score/page.tsx` | Compliance checker |
| `/tools/incident-cost` | `app/tools/incident-cost/page.tsx` | Cost estimator |
| `/tools/time-saved` | `app/tools/time-saved/page.tsx` | Time savings calculator |

### Authenticated Pages

| Route | Component | Description |
|-------|-----------|-------------|
| `/dashboard` | `app/dashboard/page.tsx` | Main dashboard |
| `/operations` | `app/operations/page.tsx` | Operations dashboard |
| `/operations/jobs` | `app/operations/jobs/page.tsx` | Jobs list |
| `/operations/jobs/[id]` | `app/operations/jobs/[id]/page.tsx` | Job detail |
| `/operations/jobs/new` | `app/operations/jobs/new/page.tsx` | New job form |
| `/operations/audit` | `app/operations/audit/page.tsx` | Audit feed |
| `/operations/executive` | `app/operations/executive/page.tsx` | Executive brief |
| `/operations/account` | `app/operations/account/page.tsx` | Account settings |
| `/operations/team` | `app/operations/team/page.tsx` | Team management |

---

## ⚙️ Backend Services & Workers

### Export Worker (`exportWorker.ts`)

**Purpose**: Processes queued export jobs asynchronously

**Features**:
- Atomic job claiming via RPC (`claim_export_job`)
- Fallback to optimistic locking if RPC unavailable
- Generates PDFs (Risk Snapshot, Executive Brief, Proof Pack)
- Creates ZIP files (Permit Pack)
- Uploads to Supabase Storage
- Updates job state (queued → preparing → generating → uploading → ready/failed)
- Records ledger events

**Process Flow**:
1. Polls `exports` table for `state='queued'` jobs
2. Claims job atomically (RPC or optimistic locking)
3. Updates state to `preparing`
4. Generates PDF/ZIP
5. Uploads to storage
6. Updates state to `ready` with file URL
7. Records audit log entry

**Interval**: 5 seconds
**Max Concurrent**: 3 exports per organization

### Retention Worker (`retentionWorker.ts`)

**Purpose**: Cleans up old data based on retention policies

**Features**:
- Deletes old exports (configurable retention period)
- Deletes old evidence files
- Garbage collection for storage
- Respects organization preferences

**Schedule**: Daily (cron job)

### Ledger Root Worker (`ledgerRootWorker.ts`)

**Purpose**: Computes daily ledger root for auditor-proofing

**Features**:
- Computes Merkle root of all audit logs
- Anchors root (external service or blockchain)
- Public verification endpoint
- Daily computation at midnight UTC

**Schedule**: Daily (cron job)

### Notification Service (`notifications.ts`)

**Purpose**: Sends notifications (email, push, in-app)

**Features**:
- High-risk job alerts
- Weekly summary emails
- Export completion notifications
- Team invite notifications
- Plan limit warnings

**Channels**:
- Email (via Supabase or SendGrid)
- Push notifications (iOS/Android)
- In-app notifications (future)

---

## 🗄️ Database Schema

### Core Tables

**organizations**
- `id` (UUID, PK)
- `name` (text)
- `subscription_tier` (text: starter/pro/business)
- `logo_url` (text, nullable)
- `accent_color` (text, nullable)
- `created_at`, `updated_at`

**users**
- `id` (UUID, PK, FK → auth.users.id)
- `email` (text)
- `full_name` (text)
- `role` (text: owner/admin/member)
- `organization_id` (UUID, FK → organizations.id)
- `phone` (text, nullable)
- `created_at`, `updated_at`

**jobs**
- `id` (UUID, PK)
- `organization_id` (UUID, FK)
- `name` (text)
- `client_name` (text)
- `job_type` (text)
- `location` (text)
- `status` (text: draft/in_progress/completed/archived)
- `risk_score` (integer, 0-100)
- `risk_level` (text: low/medium/high/critical)
- `start_date`, `end_date` (timestamptz, nullable)
- `created_by` (UUID, FK → users.id)
- `created_at`, `updated_at`

**risk_factors**
- `id` (UUID, PK)
- `name` (text)
- `severity` (text: low/medium/high/critical)
- `category` (text)
- `weight` (integer) - for scoring

**job_risk_scores**
- `id` (UUID, PK)
- `job_id` (UUID, FK → jobs.id)
- `score` (integer, 0-100)
- `level` (text)
- `calculated_at` (timestamptz)

**mitigation_items**
- `id` (UUID, PK)
- `job_id` (UUID, FK → jobs.id)
- `title` (text)
- `description` (text)
- `is_completed` (boolean)
- `completed_by` (UUID, FK → users.id, nullable)
- `completed_at` (timestamptz, nullable)

**documents**
- `id` (UUID, PK)
- `organization_id` (UUID, FK)
- `job_id` (UUID, FK → jobs.id, nullable)
- `type` (text: photo/document)
- `category` (text: before/during/after/insurance/waiver/etc)
- `file_path` (text) - Supabase Storage path
- `file_size` (bigint)
- `mime_type` (text)
- `uploaded_by` (UUID, FK → users.id)
- `created_at`

**exports**
- `id` (UUID, PK)
- `organization_id` (UUID, FK)
- `work_record_id` (UUID, FK → jobs.id, nullable)
- `export_type` (text: risk_snapshot/executive_brief/proof_pack/permit_pack)
- `state` (text: queued/preparing/generating/uploading/ready/failed)
- `filters` (jsonb) - export filters
- `file_url` (text, nullable) - Supabase Storage URL
- `file_hash` (text, nullable) - SHA256 hash
- `created_by` (UUID, FK → users.id)
- `created_at`, `started_at`, `completed_at`

**audit_logs**
- `id` (UUID, PK)
- `organization_id` (UUID, FK)
- `actor_id` (UUID, FK → users.id)
- `actor_name` (text)
- `event_name` (text) - e.g., "job.created", "mitigation.completed"
- `target_type` (text) - e.g., "job", "hazard", "mitigation"
- `target_id` (UUID)
- `metadata` (jsonb) - additional context
- `created_at` (timestamptz)

**subscriptions**
- `id` (UUID, PK)
- `organization_id` (UUID, FK)
- `stripe_subscription_id` (text)
- `stripe_customer_id` (text)
- `plan` (text: starter/pro/business)
- `status` (text: active/cancelled/past_due)
- `current_period_start`, `current_period_end`
- `created_at`, `updated_at`

**organization_invites**
- `id` (UUID, PK)
- `organization_id` (UUID, FK)
- `email` (text)
- `role` (text: admin/member)
- `token` (UUID) - for invite link
- `invited_by` (UUID, FK → users.id)
- `expires_at` (timestamptz)
- `accepted_at` (timestamptz, nullable)
- `created_at`

### Extended Tables

**hazards** - Identified hazards per job
**controls** - Safety controls/mitigations
**job_assignments** - Worker assignments
**signatures** - Digital signatures
**compliance_checks** - Compliance verification
**evidence_verifications** - Photo/document verification
**hazard_templates** - Reusable hazard templates
**job_templates** - Complete job templates
**sites** - Multi-site support
**job_signoffs** - Job sign-offs
**report_runs** - Report generation runs
**executive_alerts** - Executive alert state

### Row-Level Security (RLS)

All tables have RLS policies that:
- Filter by `organization_id`
- Check user role/permissions
- Prevent cross-organization data access
- Enforce read/write permissions

---

## 🔌 API Routes

### Authentication

| Method | Route | Handler | Description |
|--------|-------|---------|-------------|
| POST | `/api/auth/signup` | `app/api/auth/signup/route.ts` | Create account + organization |
| POST | `/api/auth/signout` | `app/api/auth/signout/route.ts` | Sign out |

### Jobs

| Method | Route | Handler | Description |
|--------|-------|---------|-------------|
| GET | `/api/jobs` | `apps/backend/src/routes/jobs.ts` | List jobs (with filters) |
| POST | `/api/jobs` | `apps/backend/src/routes/jobs.ts` | Create job |
| GET | `/api/jobs/:id` | `apps/backend/src/routes/jobs.ts` | Get job detail |
| PATCH | `/api/jobs/:id` | `apps/backend/src/routes/jobs.ts` | Update job |
| DELETE | `/api/jobs/:id` | `apps/backend/src/routes/jobs.ts` | Delete job |
| POST | `/api/jobs/:id/recalculate-score` | `apps/backend/src/routes/jobs.ts` | Recalculate risk score |
| POST | `/api/jobs/:id/mitigations/:mitigationId` | `apps/backend/src/routes/jobs.ts` | Complete mitigation |

### Reports

| Method | Route | Handler | Description |
|--------|-------|---------|-------------|
| POST | `/api/reports/generate/:jobId` | `apps/backend/src/routes/reports.ts` | Generate PDF report |
| GET | `/api/reports/share/:token` | `apps/backend/src/routes/reports.ts` | Get shared report |
| POST | `/api/reports/packet/:jobId` | `apps/backend/src/routes/reports.ts` | Generate proof pack |

### Exports

| Method | Route | Handler | Description |
|--------|-------|---------|-------------|
| POST | `/api/exports` | `apps/backend/src/routes/exports.ts` | Create export job |
| GET | `/api/exports` | `apps/backend/src/routes/exports.ts` | List exports |
| GET | `/api/exports/:id` | `apps/backend/src/routes/exports.ts` | Get export status |
| POST | `/api/exports/:id/cancel` | `apps/backend/src/routes/exports.ts` | Cancel export |

### Executive Brief

| Method | Route | Handler | Description |
|--------|-------|---------|-------------|
| GET | `/api/executive/brief` | `apps/backend/src/routes/executive.ts` | Get executive brief data |
| POST | `/api/executive/brief/pdf` | `apps/backend/src/routes/executive.ts` | Generate executive brief PDF |
| POST | `/api/executive/alerts/check` | `apps/backend/src/routes/executive.ts` | Check alert conditions |

### Audit/Ledger

| Method | Route | Handler | Description |
|--------|-------|---------|-------------|
| GET | `/api/audit/events` | `apps/backend/src/routes/audit.ts` | List audit events |
| GET | `/api/audit/export` | `apps/backend/src/routes/audit.ts` | Export audit log |
| POST | `/api/audit/assign` | `apps/backend/src/routes/audit.ts` | Assign event |
| POST | `/api/audit/resolve` | `apps/backend/src/routes/audit.ts` | Resolve event |

### Analytics

| Method | Route | Handler | Description |
|--------|-------|---------|-------------|
| GET | `/api/analytics/dashboard` | `apps/backend/src/routes/analytics.ts` | Dashboard KPIs |
| GET | `/api/analytics` | `apps/backend/src/routes/analytics.ts` | Analytics data |

### Team

| Method | Route | Handler | Description |
|--------|-------|---------|-------------|
| GET | `/api/team` | `apps/backend/src/routes/team.ts` | List team members |
| POST | `/api/team/invite` | `apps/backend/src/routes/team.ts` | Invite team member |
| DELETE | `/api/team/:userId` | `apps/backend/src/routes/team.ts` | Remove team member |
| PATCH | `/api/team/:userId/role` | `apps/backend/src/routes/team.ts` | Update role |

### Subscriptions

| Method | Route | Handler | Description |
|--------|-------|---------|-------------|
| GET | `/api/subscriptions` | `apps/backend/src/routes/subscriptions.ts` | Get subscription |
| POST | `/api/subscriptions/upgrade` | `apps/backend/src/routes/subscriptions.ts` | Upgrade plan |
| POST | `/api/stripe/checkout` | `apps/backend/src/routes/stripeWebhook.ts` | Create checkout session |
| POST | `/api/stripe/webhook` | `apps/backend/src/routes/stripeWebhook.ts` | Stripe webhook handler |

### Evidence

| Method | Route | Handler | Description |
|--------|-------|---------|-------------|
| POST | `/api/evidence/upload` | `apps/backend/src/routes/evidence.ts` | Upload evidence |
| DELETE | `/api/evidence/:id` | `apps/backend/src/routes/evidence.ts` | Delete evidence |
| POST | `/api/evidence/:id/verify` | `apps/backend/src/routes/evidence.ts` | Verify evidence |

### Verification

| Method | Route | Handler | Description |
|--------|-------|---------|-------------|
| GET | `/api/verify/:token` | `apps/backend/src/routes/verification.ts` | Verify token |
| GET | `/api/public/verify/:orgId` | `apps/backend/src/routes/publicVerification.ts` | Public verification |

---

## 📱 Mobile App (iOS)

### Architecture

**Pattern**: MVVM (Model-View-ViewModel)
- **Models**: Data structures (`Job`, `User`, `Organization`, etc.)
- **Views**: SwiftUI views
- **Services**: Business logic (`APIClient`, `AuthService`, etc.)

### Key Features

1. **Authentication**
   - Email/password login
   - Supabase Auth integration
   - Session management
   - Auto-login on app launch

2. **Job Management**
   - Jobs list with filters
   - Job detail view
   - Create/edit jobs
   - Risk score display
   - Mitigation checklist

3. **Evidence Capture**
   - Photo capture with camera
   - Photo picker from library
   - Background uploads
   - Upload progress tracking
   - Offline queue

4. **Exports**
   - Request export
   - Background processing
   - Download when ready
   - Share functionality

5. **Executive Brief**
   - View executive brief
   - Risk posture tiles
   - Readiness score

6. **Audit Feed**
   - Real-time audit events
   - Filter by event type
   - Swipe actions

7. **Offline Support**
   - Local cache (Core Data)
   - Queue actions for sync
   - Offline banner
   - Sync status indicator

### Services

**APIClient**: HTTP client for backend API
**AuthService**: Authentication & session management
**SessionManager**: Session state management
**BackgroundUploadManager**: Background file uploads
**BackgroundExportManager**: Background export processing
**OfflineCache**: Local storage (Core Data)
**Analytics**: Event tracking
**CrashReporting**: Crash reporting
**RetryManager**: Retry logic for failed requests
**ServerStatusManager**: Server health monitoring
**FilterPersistence**: Persist filter state

### Design System

**Theme**: Dark mode only
**Colors**: Matches web design system
**Typography**: SF Pro (system font)
**Components**: Reusable SwiftUI components
- `RMGlassCard` - Glass morphism cards
- `RMPrimaryButton` - Primary buttons
- `RMTextField` - Text inputs
- `RMSkeletonView` - Loading skeletons

---

## 🚀 Deployment

### Web App (Vercel)

**Platform**: Vercel (serverless)
**Build Command**: `npm run build`
**Output Directory**: `.next`
**Environment Variables**: Set in Vercel dashboard
**Functions**: API routes run as serverless functions
**Edge Network**: Global CDN for static assets

**Deployment Flow**:
1. Push to `main` branch
2. Vercel auto-deploys
3. Build runs
4. Deploy to production

### Backend (Railway)

**Platform**: Railway
**Build**: Docker or Node.js buildpack
**Environment Variables**: Set in Railway dashboard
**Port**: Injected by Railway (`PORT` env var)
**Health Check**: `/health` endpoint

**Deployment Flow**:
1. Push to `main` branch
2. Railway auto-deploys (if connected via GitHub)
3. Build runs
4. Deploy to production
5. Workers start automatically

### Database (Supabase)

**Platform**: Supabase Cloud
**Migrations**: Run via Supabase CLI or dashboard
**Backups**: Automatic (Supabase handles)
**RLS**: Enabled on all tables

**Migration Flow**:
1. Create migration file in `supabase/migrations/`
2. Run `supabase db push` (CLI) or apply in dashboard
3. Verify migration applied

### Storage (Supabase Storage)

**Platform**: Supabase Storage
**Buckets**: `documents`, `photos`, `reports`
**Policies**: Organization-scoped access
**CDN**: Automatic via Supabase

---

## 🛠️ Development Workflow

### Local Setup

```bash
# Clone repository
git clone <repo-url>
cd riskmate

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
# Fill in Supabase and Stripe credentials

# Run database migrations
supabase link --project <project-id>
supabase db push

# Start development servers
pnpm dev
```

### Environment Variables

**Web (.env.local)**:
```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_BACKEND_URL=http://localhost:5173
STRIPE_SECRET_KEY=
STRIPE_PUBLIC_KEY=
```

**Backend (.env)**:
```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
PORT=5173
STRIPE_SECRET_KEY=
```

**iOS (Config.plist)**:
```xml
<key>SUPABASE_URL</key>
<string>https://xxx.supabase.co</string>
<key>SUPABASE_ANON_KEY</key>
<string>eyJ...</string>
<key>BACKEND_URL</key>
<string>https://api.riskmate.dev</string>
```

### Running Locally

**Web**:
```bash
pnpm dev:frontend
# Runs on http://localhost:3000
```

**Backend**:
```bash
pnpm dev:backend
# Runs on http://localhost:5173
```

**Both**:
```bash
pnpm dev
# Runs both concurrently
```

**iOS**:
1. Open `mobile/Riskmate/Riskmate.xcodeproj` in Xcode
2. Select simulator or device
3. Press Cmd+R to run

### Testing

**Unit Tests**:
```bash
pnpm test
```

**PDF Smoke Test**:
```bash
pnpm pdf:smoke
```

**Type Check**:
```bash
pnpm type-check
```

### Code Standards

- **TypeScript**: Strict mode enabled
- **ESLint**: Next.js config
- **Prettier**: Auto-formatting
- **Component-based**: Reusable components
- **Utility functions**: Shared logic in `lib/utils/`

---

## 📊 Summary

**RiskMate** is a comprehensive SaaS platform for service contractors with:

- **42 features** across web and mobile
- **Multi-tenant architecture** with RLS
- **Ledger-first design** for compliance
- **Modern tech stack** (Next.js, Express, Supabase, SwiftUI)
- **Professional UI/UX** with design system
- **Background workers** for async processing
- **Complete API** with 50+ endpoints
- **iOS app** with offline support
- **Production-ready** deployment on Vercel + Railway

**Status**: Production-ready, actively developed

**Last Updated**: December 2024

---

**This document is the complete reference for everything RiskMate. Use it as your guide for understanding the entire system.**
