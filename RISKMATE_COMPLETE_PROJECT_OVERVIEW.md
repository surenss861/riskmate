# RiskMate - Complete Project Overview

**Version**: 1.0 Production-Ready  
**Last Updated**: January 2025  
**Platforms**: Web (Next.js) + iOS (SwiftUI) + Backend API (Express)

---

## 🎯 What is RiskMate?

**RiskMate** is an industry-grade SaaS platform for service contractors (electricians, roofers, HVAC, general contractors) to manage job safety, risk assessments, compliance documentation, and generate audit-ready PDF reports. It replaces messy paper forms, random job photos, and inconsistent safety checks with a unified dashboard accessible on web and mobile.

**Target Market**: Small to medium trade companies (1-50 employees) who need professional safety documentation for insurance, clients, and compliance.

**Core Value Proposition**: "Immutable compliance records for field operations."

---

## 📱 Platforms & Architecture

### Web Application (Next.js 15)
- **Location**: `app/` directory (Next.js App Router)
- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS with custom design system
- **Deployment**: Vercel (or Railway for Next.js)
- **Primary Use**: Desktop + tablet workflows, reporting, admin dashboard

### iOS Application (SwiftUI)
- **Location**: `mobile/Riskmate/` directory
- **Framework**: SwiftUI + UIKit integration
- **Language**: Swift 5
- **Design**: Apple-native design system (RMSystemTheme)
- **Deployment**: App Store (TestFlight → Production)
- **Primary Use**: Field operations, evidence capture, on-site documentation

### Backend API (Express.js)
- **Location**: `apps/backend/` directory
- **Framework**: Express.js with TypeScript
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Storage**: Supabase Storage
- **Deployment**: Railway (or Fly.io / Render)
- **Primary Use**: REST API for both web and iOS

### Shared Infrastructure
- **Database**: Supabase PostgreSQL (single database for web + iOS)
- **Authentication**: Supabase Auth (same auth system)
- **Storage**: Supabase Storage buckets (organization-scoped)
- **Payments**: Stripe (subscriptions, billing)

---

## 🏗️ Project Structure

```
riskmate/
├── app/                          # Next.js Web App (App Router)
│   ├── api/                      # Next.js API Routes (86 endpoints)
│   ├── operations/               # Main dashboard (renamed from /dashboard)
│   ├── pricing/                  # Pricing & checkout
│   ├── case-studies/             # Marketing case studies
│   ├── compare/                  # Competitive comparison pages
│   └── tools/                    # Calculator tools (compliance score, etc.)
│
├── apps/
│   └── backend/                  # Express API Server
│       ├── src/
│       │   ├── routes/           # 20 route files (jobs, audit, executive, etc.)
│       │   ├── middleware/       # Auth, limits, rate limiting, audit logging
│       │   ├── services/         # Background workers (exports, notifications)
│       │   ├── utils/            # PDF generation, risk scoring, etc.
│       │   └── __tests__/        # Integration tests (read-only enforcement)
│       └── scripts/              # Test scripts, validation
│
├── mobile/
│   └── Riskmate/                 # iOS SwiftUI App
│       ├── Riskmate/
│       │   ├── Views/            # 29 SwiftUI views (main screens)
│       │   ├── Components/       # Reusable UI components
│       │   ├── Services/         # API client, auth, upload managers
│       │   ├── Stores/           # JobsStore (shared state)
│       │   ├── Models/           # Job, User, Organization models
│       │   ├── Theme/            # Design system (RMSystemTheme)
│       │   └── Utils/            # Haptics, offline cache, etc.
│       └── Riskmate.xcodeproj/   # Xcode project
│
├── components/                   # Shared React components (web)
├── lib/                          # Shared utilities (API clients, PDF, etc.)
├── supabase/
│   └── migrations/               # 56 database migration files
├── scripts/                      # Build/test scripts
└── docs/                         # Documentation (68 markdown files)
```

---

## 🎨 Design Systems

### Web (Next.js)
- **Design System**: Custom Tailwind-based system
- **Colors**: Dark theme with orange accent (#F97316)
- **Typography**: Inter (body), Playfair Display (headings)
- **Components**: Radix UI primitives, custom dashboard components
- **Animations**: Framer Motion, GSAP, Lenis (smooth scroll)
- **3D Graphics**: Three.js, React Three Fiber (hero scene)

### iOS (SwiftUI)
- **Design System**: `RMSystemTheme` - Apple-native design
- **Colors**: System semantic colors (`.label`, `.systemBackground`, `.systemOrange`)
- **Typography**: SF Pro (system fonts) with custom sizes
- **Materials**: `.ultraThinMaterial`, `.regularMaterial` (UIKit blur)
- **Components**: Native List rows, system sheets, UIKit integration
- **Motion**: Subtle appear animations, spring physics
- **Haptics**: System haptic feedback for key interactions

---

## 🔐 Authentication & Authorization

### Shared Auth System
- **Provider**: Supabase Auth
- **Method**: Email/password
- **Session**: JWT tokens (same for web + iOS)
- **Storage**: 
  - Web: Browser session storage
  - iOS: Keychain

### Roles & Permissions

**Three Roles**:
1. **Owner**: Full access (billing, team, all features)
2. **Admin**: Most features (no billing)
3. **Member**: Limited access (create jobs, view reports)

**Read-Only Roles** (server-enforced):
1. **Auditor**: Read-only access (ledger, verification, no writes)
2. **Executive**: Read-only access (dashboard, reports, no writes)

**Enforcement**:
- ✅ Server-side middleware (`requireWriteAccess`) blocks mutations
- ✅ UI hides write actions for read-only roles
- ✅ Audit logs record violations
- ✅ Proof-pack generation allowed (read-only output)

---

## 💰 Subscription Plans & Billing

### Plans

**Starter** (Free/Trial):
- 10 jobs/month limit
- 1 seat
- Basic features
- Share links

**Pro**:
- Unlimited jobs
- 5 seats
- Branded PDFs
- Notifications
- Advanced features

**Business**:
- Unlimited jobs
- Unlimited seats
- Analytics dashboard
- Permit Pack generation
- Audit logs
- Priority support

### Billing System
- **Payment Processor**: Stripe
- **Checkout**: Stripe Checkout (web redirect)
- **Subscription Management**: Stripe Customer Portal
- **Plan Enforcement**: 
  - Backend middleware (`enforceJobLimit`, `requireFeature`)
  - API-level limits (job creation blocked if limit reached)
  - Feature flags based on subscription tier

---

## 📊 Core Features

### 1. Job Management
**Web + iOS**:
- Create jobs with client details, location, job type
- Edit jobs (owners/admins only)
- Archive/delete jobs (strict eligibility checks)
- List jobs with filtering, sorting, pagination
- Job detail view with tabs (Overview, Hazards, Controls, Evidence, Exports)

**Key Features**:
- Risk score calculation (0-100)
- Status tracking (draft → in_progress → completed → archived)
- Multi-site support (sites table for facilities)
- Job templates (reusable job configurations)

### 2. Risk Assessment & Scoring
**Web + iOS**:
- Select risk factors (100+ predefined hazards)
- Auto-calculate risk score using weighted algorithm
- Risk level classification (low, medium, high, critical)
- Risk score history (versioned scoring)

**Algorithm**:
- Weighted factor scoring
- Severity multipliers
- Automatic risk level assignment

### 3. Hazards & Controls
**Web + iOS**:
- Identify hazards per job
- Link controls to hazards
- Track mitigation completion
- Auto-generate mitigation items from hazards
- Control templates (reusable safety measures)

**API Endpoints**:
- `GET /api/jobs/:id/hazards` - List hazards for job
- `GET /api/jobs/:id/controls` - List controls for job
- `PATCH /api/jobs/:id/mitigations/:mitigationId` - Update mitigation status

### 4. Evidence & Document Management
**Web + iOS**:
- Upload photos (before/during/after phases)
- Upload documents (PDFs, certificates, permits)
- Offline capture (iOS) with background upload
- Evidence verification workflow (manager approval)
- Evidence indexing in reports

**iOS-Specific**:
- Quick capture bar (Photo/Video/Note/File)
- Background upload manager (queued/uploading/synced/failed)
- Offline queue with retry
- One-hand operation (bottom sheet capture)

### 5. Reporting & Export
**Web + iOS**:
- Risk Snapshot Report (PDF) - single job report
- Executive Brief (PDF) - multi-job summary
- Permit Pack (ZIP) - complete job archive for permit offices
- Proof Pack (ZIP) - insurance/audit delivery
- Custom report generation
- Branded PDFs (Business plan)

**Export Types**:
- PDF reports (professional formatting)
- ZIP archives (evidence + PDFs + CSVs)
- CSV exports (hazards, controls, evidence)
- JSON exports (API access)

### 6. Ledger & Verification
**Web + iOS**:
- Immutable audit ledger
- Cryptographic hash chain
- Proof records with verification
- Public verification (shareable links)
- Verification details (root hash, timestamp, anchor method)

**iOS Features**:
- `LedgerTrustStrip` - Chain verification status
- `ProofReceiptDetailsView` - Detailed verification info
- `LedgerReceiptCard` - Receipt-style proof records
- Copy/share proof hashes

**Key Claims** (truthful):
- ✅ "Cryptographically hashed and linked in a chain"
- ✅ "Tamper-evident ledger"
- ✅ "Hash-chained proof records"
- ❌ NOT "anchored to a public blockchain" (removed from copy)

### 7. Team & Collaboration
**Web + iOS**:
- Team member management
- Role assignment (owner/admin/member)
- Invite system (email invitations)
- Seat limits (enforced by plan)
- Organization context (multi-tenant isolation)

### 8. Dashboard & Analytics
**Web + iOS**:
- Dashboard KPIs (active jobs, high risk, missing evidence)
- Risk posture overview
- Job trends (charts)
- Top hazards (aggregated)
- Executive insights (Business plan)

**API Endpoints**:
- `GET /api/dashboard/summary` - Aggregated dashboard data
- `GET /api/dashboard/top-hazards` - Top hazards across jobs
- `GET /api/executive/risk-posture` - Executive dashboard

### 9. Audit & Compliance
**Web + iOS**:
- Complete audit trail (every action logged)
- Audit log viewing
- Event filtering/search
- Audit export (CSV/PDF)
- Security events (access, revocations)
- Team events (invites, role changes)

**Audit Events**:
- `job.created`, `job.updated`, `job.deleted`
- `evidence.uploaded`, `evidence.verified`
- `auth.role_violation` (read-only role attempts)
- `report.generated`

### 10. iOS-Specific Features

#### Field-First Design
- **Operations View**: List-first home screen with KPI chips
- **Evidence Capture**: Bottom sheet with quick capture bar
- **Offline Support**: Queue evidence when offline, auto-upload when online
- **Global FAB**: Floating action button for quick evidence capture
- **One-Hand Operation**: Optimized for field workers

#### Apple-Grade Polish
- **System-Native Design**: Uses Apple's design system
- **Haptics**: System haptic feedback for interactions
- **Motion**: Subtle appear animations, spring physics
- **Native Components**: List rows, system sheets, context menus
- **Accessibility**: Full VoiceOver support

#### Read-Only Auditor Mode
- **Role**: `auditor` role flag
- **Behavior**: Launches directly into Ledger
- **UI**: Capture buttons hidden, "Read-only Audit Mode" banner
- **Enforcement**: Server-side blocks all mutations (403)

#### First-Run Onboarding
- **Single Screen**: Value prop + role selection
- **Content**: "Immutable compliance records" + 3 bullet points
- **Options**: "Get Started" (owner) / "Continue as auditor" (read-only)
- **One-Time**: Never shown again after first launch

---

## 🔧 Technical Stack Details

### Backend API (Express.js)

**Tech Stack**:
- **Framework**: Express.js 4.22
- **Language**: TypeScript 5.3
- **Runtime**: Node.js 20+
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage
- **PDF Generation**: PDFKit 0.17
- **Payments**: Stripe SDK 14.0

**Key Files**:
- `apps/backend/src/index.ts` - Express app entry point
- `apps/backend/src/routes/jobs.ts` - Job management (2146 lines)
- `apps/backend/src/routes/audit.ts` - Audit logging
- `apps/backend/src/routes/executive.ts` - Executive dashboard
- `apps/backend/src/routes/exports.ts` - Export generation
- `apps/backend/src/routes/reports.ts` - Report generation
- `apps/backend/src/middleware/requireWriteAccess.ts` - Read-only enforcement
- `apps/backend/src/utils/pdf/` - PDF generation utilities

**Middleware Stack**:
1. `requestIdMiddleware` - Generate request IDs for tracing
2. `cors` - CORS configuration
3. `authenticate` - Supabase auth validation
4. `requireWriteAccess` - Read-only role enforcement
5. `enforceJobLimit` - Plan limit enforcement
6. `requireFeature` - Feature flag checking
7. `rateLimiter` - Rate limiting on public endpoints

**Background Workers**:
- `exportWorker` - Async export generation
- `ledgerRootWorker` - Ledger root anchoring
- `retentionWorker` - Data retention policies
- `notifications` - Email notifications

**API Routes** (86 endpoints):
- `/api/jobs` - Job CRUD operations
- `/api/jobs/:id/hazards` - Job hazards
- `/api/jobs/:id/controls` - Job controls
- `/api/jobs/:id/proof-pack` - Proof pack generation
- `/api/dashboard/summary` - Dashboard data
- `/api/audit/events` - Audit log viewing
- `/api/executive/risk-posture` - Executive dashboard
- `/api/exports` - Export generation
- `/api/reports` - Report generation
- `/api/stripe/*` - Stripe webhooks

### Web Application (Next.js)

**Tech Stack**:
- **Framework**: Next.js 15.1 (App Router)
- **Language**: TypeScript 5.3
- **Styling**: Tailwind CSS 3.4
- **UI Components**: Radix UI primitives
- **Forms**: React Hook Form + Zod validation
- **State**: SWR for data fetching
- **Animations**: Framer Motion, GSAP, Lenis
- **3D**: Three.js, React Three Fiber
- **Analytics**: Vercel Analytics, PostHog

**Key Pages**:
- `/` - Landing page
- `/operations` - Main dashboard (renamed from /dashboard)
- `/operations/jobs` - Jobs list
- `/operations/jobs/:id` - Job detail
- `/operations/audit` - Audit feed
- `/operations/executive` - Executive dashboard
- `/pricing` - Pricing & checkout
- `/demo` - Interactive demo

**API Routes** (Next.js API):
- `/app/api/jobs/*` - Job management
- `/app/api/reports/*` - Report generation
- `/app/api/proof-packs/*` - Proof pack generation
- `/app/api/stripe/*` - Stripe integration
- `/app/api/auth/*` - Authentication

### iOS Application (SwiftUI)

**Tech Stack**:
- **Framework**: SwiftUI + UIKit integration
- **Language**: Swift 5
- **iOS Target**: iOS 17.0+
- **Architecture**: MVVM (ViewModels) + Stores (shared state)
- **State Management**: `@StateObject`, `@ObservedObject`, `@Published`
- **Networking**: Async/await with URLSession
- **Storage**: UserDefaults, Keychain (via Supabase)
- **Background**: Background URLSession for uploads
- **Design**: RMSystemTheme (system-native)

**Key Views** (29 files):
- `ContentView` - Root tab navigation
- `OperationsView` - Home screen (field-first)
- `JobsListView` - Jobs list with filtering
- `JobDetailView` - Job detail with tabs
- `AuditFeedView` - Ledger/audit feed
- `EvidenceCaptureSheet` - Bottom sheet for evidence
- `ProofReceiptDetailsView` - Verification details
- `FirstRunOnboardingView` - Onboarding screen
- `SplashView` - Launch screen

**Key Services**:
- `APIClient` - REST API client
- `AuthService` - Supabase authentication
- `SessionManager` - Session state management
- `BackgroundUploadManager` - Offline upload queue
- `BackgroundExportManager` - Export generation
- `JobsStore` - Shared jobs state (single-flight loading)
- `QuickActionRouter` - Global quick actions

**Key Components**:
- `JobRow` - Native List row with accessories
- `LedgerReceiptCard` - Proof receipt card
- `EvidenceQuickBar` - Quick capture bar
- `EvidenceUploadStatusBar` - Offline upload status
- `LedgerTrustStrip` - Chain verification strip
- `ReadOnlyBanner` - Auditor mode indicator
- `ToastContainer` - Global toast notifications

**Design System**:
- `RMSystemTheme` - System semantic colors, spacing, typography
- `VisualEffectBlur` - UIKit blur wrapper
- `Haptics` - System haptic feedback
- `AppearIn` - Subtle appear animations

---

## 📁 File Structure Deep Dive

### Backend (`apps/backend/src/`)

```
routes/
├── jobs.ts              # Job CRUD, hazards, controls, proof-pack (2146 lines)
├── audit.ts             # Audit log viewing, export, incidents
├── executive.ts         # Executive dashboard, risk posture
├── dashboard.ts         # Dashboard summary, top hazards
├── reports.ts           # Report generation
├── exports.ts           # Export generation (ZIP, PDF)
├── evidence.ts          # Evidence management
├── team.ts              # Team member management
├── account.ts           # Account settings, billing
├── subscriptions.ts     # Stripe subscriptions
├── sites.ts             # Multi-site support
├── analytics.ts         # Analytics endpoints
├── risk.ts              # Risk factor queries
├── legal.ts             # Terms/privacy acceptance
├── notifications.ts     # Notification preferences
├── verification.ts      # Ledger verification
├── publicVerification.ts # Public verification links
├── metrics.ts           # System metrics
├── stripeWebhook.ts     # Stripe webhook handler
└── devAuth.ts           # Dev authentication (optional)

middleware/
├── auth.ts              # Supabase authentication
├── requireWriteAccess.ts # Read-only role enforcement
├── limits.ts            # Plan limit enforcement
├── rateLimiter.ts       # Rate limiting
├── requestId.ts         # Request ID generation
└── audit.ts             # Audit log recording

utils/
├── pdf/                 # PDF generation (executive brief, proof pack)
├── riskScoring.ts       # Risk score calculation
├── jobReport.ts         # Job report data building
├── errorResponse.ts     # Consistent error formatting
└── legal.ts             # Legal version tracking

services/
├── exportWorker.ts      # Background export generation
├── ledgerRootWorker.ts  # Ledger root anchoring
├── retentionWorker.ts   # Data retention
└── notifications.ts     # Email notifications
```

### Web (`app/`)

```
app/
├── api/                 # Next.js API Routes (86 endpoints)
│   ├── jobs/           # Job management
│   ├── reports/        # Report generation
│   ├── proof-packs/    # Proof pack generation
│   ├── audit/          # Audit logging
│   ├── executive/      # Executive dashboard
│   ├── stripe/         # Stripe webhooks
│   └── ...
│
├── operations/         # Main dashboard (renamed from /dashboard)
│   ├── page.tsx        # Operations home
│   ├── jobs/           # Job management pages
│   ├── audit/          # Audit feed
│   ├── executive/      # Executive dashboard
│   ├── team/           # Team management
│   └── account/        # Account settings
│
├── pricing/            # Pricing & checkout
├── case-studies/       # Marketing pages
├── compare/            # Competitive comparison
├── tools/              # Calculator tools
└── page.tsx            # Landing page

components/
├── audit/              # Audit components
├── dashboard/          # Dashboard widgets
├── demo/               # Demo components
├── executive/          # Executive components
├── marketing/          # Marketing components
├── onboarding/         # Onboarding flow
├── report/             # Report components
└── shared/             # Shared components

lib/
├── api/                # API clients
├── pdf/                # PDF generation utilities
├── supabase/           # Supabase client
├── entitlements.ts     # Feature flag checking
└── utils/              # Utilities
```

### iOS (`mobile/Riskmate/Riskmate/`)

```
Riskmate/
├── Views/
│   ├── Main/
│   │   ├── ContentView.swift          # Root tab navigation
│   │   ├── OperationsView.swift       # Home screen
│   │   ├── JobsListView.swift         # Jobs list
│   │   ├── JobDetailView.swift        # Job detail
│   │   ├── AuditFeedView.swift        # Ledger/audit
│   │   ├── DashboardView.swift        # Dashboard (legacy)
│   │   ├── ExecutiveView.swift        # Executive dashboard
│   │   └── AccountView.swift          # Settings
│   │
│   ├── Evidence/
│   │   └── EvidenceCaptureSheet.swift # Bottom sheet capture
│   │
│   ├── Ledger/
│   │   ├── VerificationDetailsView.swift
│   │   └── ProofReceiptDetailsView.swift
│   │
│   ├── Auth/
│   │   └── AuthView.swift             # Login/signup
│   │
│   ├── Onboarding/
│   │   └── FirstRunOnboardingView.swift
│   │
│   └── Shared/
│       └── SplashView.swift           # Launch screen
│
├── Services/
│   ├── APIClient.swift                # REST API client
│   ├── AuthService.swift              # Supabase auth
│   ├── SessionManager.swift           # Session state
│   ├── BackgroundUploadManager.swift  # Offline uploads
│   ├── BackgroundExportManager.swift  # Export generation
│   └── JobsStore.swift                # Shared jobs state
│
├── Components/
│   ├── Premium/                       # UI components
│   ├── Evidence/                      # Evidence components
│   ├── Ledger/                        # Ledger components
│   ├── Operations/                    # Operations components
│   ├── UIKit/                         # UIKit wrappers
│   └── Toast/                         # Toast system
│
├── Models/
│   ├── Job.swift                      # Job model
│   ├── User.swift                     # User model
│   └── Organization.swift             # Organization model
│
├── Theme/
│   ├── RMSystemTheme.swift            # Design system
│   └── View+*.swift                   # View extensions
│
└── Utils/
    ├── Haptics.swift                  # Haptic feedback
    └── AuditorMode.swift              # Read-only mode check
```

---

## 🔒 Security & Compliance

### Multi-Tenant Data Isolation

**Three Layers**:
1. **Database (RLS)**: Row Level Security on every table
2. **Application**: Explicit `organization_id` filtering in all queries
3. **Storage**: Bucket policies scoped to `organization_id`

**Enforcement**:
- ✅ Users can only access their organization's data
- ✅ ID enumeration attacks blocked
- ✅ Direct database queries filtered by RLS
- ✅ Storage access organization-scoped

### Role Enforcement

**Server-Side** (`requireWriteAccess` middleware):
- Blocks `POST`, `PATCH`, `DELETE` for `auditor` and `executive` roles
- Returns `403 AUTH_ROLE_READ_ONLY` with error ID
- Logs violations to audit trail
- Fail-closed (returns 401 if auth context missing)

**Client-Side**:
- UI hides write actions for read-only roles
- Auditors launched directly into Ledger
- Read-only banner displayed

### Authentication Security

**JWT Tokens**:
- Issued by Supabase Auth
- Validated on every API request
- Expiration handled by Supabase SDK
- Refresh tokens managed automatically

**Session Management**:
- Web: Browser session storage
- iOS: Keychain (secure storage)
- Session restoration on app launch (iOS)

---

## 📦 Deployment Architecture

### Current Setup

**Web**: Vercel (serverless Next.js)
- **URL**: Production domain (e.g., `app.riskmate.dev`)
- **Build**: `next build` → Vercel Edge Network
- **Env Vars**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_API_URL`

**Backend**: Railway (Express.js)
- **URL**: Production domain (e.g., `api.riskmate.dev`)
- **Build**: `tsx src/index.ts` (or compiled `node dist/apps/backend/src/index.js`)
- **Env Vars**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PORT`, `CORS_ORIGINS`

**iOS**: App Store
- **Distribution**: TestFlight → App Store Review → Production
- **Config**: Production API URL + Supabase URL/Anon Key
- **Bundle ID**: `riskmate.Riskmate`

**Database**: Supabase Cloud
- **Single Database**: Shared by web + iOS
- **RLS**: Enabled on all tables
- **Storage**: Organization-scoped buckets

### Recommended Production Setup

**Option 1: Railway for Both**
```
Railway Project
├── backend-api service (Express)
│   └── Custom domain: api.riskmate.dev
│
└── web-next service (Next.js)
    └── Custom domain: app.riskmate.dev
```

**Option 2: Railway + Vercel**
```
Railway: backend-api → api.riskmate.dev
Vercel: web-next → app.riskmate.dev
```

**Option 3: All Vercel** (if using Next.js API routes instead of Express)
```
Vercel: Next.js app (API routes + frontend) → riskmate.dev
```

---

## 🔄 Data Flow

### Job Creation Flow

1. **User Action** (Web/iOS):
   - User fills job form (client, location, type)
   - Selects risk factors (optional)
   - Clicks "Create Job"

2. **API Request**:
   - `POST /api/jobs` with job data
   - `Authorization: Bearer <jwt_token>`
   - Backend validates organization context

3. **Backend Processing**:
   - Middleware: `authenticate` → validates JWT
   - Middleware: `requireWriteAccess` → checks role (blocks auditor/executive)
   - Middleware: `enforceJobLimit` → checks subscription limits
   - Business Logic:
     - Creates job record in `jobs` table
     - Calculates risk score (if hazards selected)
     - Generates mitigation items (if hazards selected)
     - Records audit log: `job.created`

4. **Response**:
   - Returns job object with ID
   - Web/iOS updates UI

### Evidence Upload Flow (iOS-Specific)

1. **Capture**:
   - User taps "Add Evidence" FAB or job detail button
   - `EvidenceCaptureSheet` opens (bottom sheet)
   - User selects photo/video/note/file
   - Quick capture bar for fast selection

2. **Offline Queue**:
   - Evidence saved to local storage
   - `BackgroundUploadManager` queues upload task
   - Status: `queued` → `uploading` → `synced` / `failed`

3. **Background Upload**:
   - Uses `URLSession` background configuration
   - Uploads to Supabase Storage
   - Updates job document record

4. **Success**:
   - Status changes to `synced`
   - `EvidenceUploadStatusBar` shows success
   - Auto-dismisses sheet with haptic + toast
   - Toast: "Evidence securely attached"

### Ledger Verification Flow

1. **Event Creation**:
   - Any action (job created, evidence uploaded, etc.)
   - Backend records audit log entry
   - Generates cryptographic hash
   - Links to previous hash (chain)

2. **Ledger Viewing** (Web/iOS):
   - `GET /api/audit/events` returns audit logs
   - Displayed as `LedgerReceiptCard` components
   - Shows proof ID, hash preview, timestamp

3. **Verification** (Web/iOS):
   - Tap receipt card → `ProofReceiptDetailsView`
   - Shows full hash, previous hash, chain verification status
   - Copy/share functionality
   - Public verification link (optional)

---

## 🚀 Key Differentiators

### 1. Field-First Mobile Design (iOS)
- One-hand operation optimized
- Offline capture with auto-upload
- Quick capture bar (Photo/Video/Note/File)
- Native iOS design (not custom UI)

### 2. Immutable Audit Ledger
- Cryptographic hash chain
- Tamper-evident proof records
- Public verification links
- Auditor-friendly read-only mode

### 3. Automated Risk Scoring
- Weighted algorithm
- Auto-generates mitigation items
- Risk level classification
- Versioned score history

### 4. Unified Platform
- Same API for web + iOS
- Shared authentication
- Consistent data model
- Cross-platform features

### 5. Compliance-Ready
- Audit-ready PDF reports
- Complete audit trail
- Role-based access control
- Server-side enforcement

---

## 📊 Feature Parity Matrix

| Feature | Web | iOS | Backend API |
|---------|-----|-----|-------------|
| Job Management | ✅ | ✅ | ✅ |
| Risk Assessment | ✅ | ✅ | ✅ |
| Hazards & Controls | ✅ | ✅ | ✅ |
| Evidence Upload | ✅ | ✅ | ✅ |
| Offline Capture | ❌ | ✅ | N/A |
| Report Generation | ✅ | ✅ | ✅ |
| Proof Pack | ✅ | ✅ | ✅ |
| Ledger Viewing | ✅ | ✅ | ✅ |
| Verification | ✅ | ✅ | ✅ |
| Team Management | ✅ | ⚠️ (limited) | ✅ |
| Billing | ✅ | ❌ | ✅ |
| Analytics Dashboard | ✅ | ⚠️ (read-only) | ✅ |
| Executive Dashboard | ✅ | ✅ | ✅ |

**Legend**: ✅ Full support | ⚠️ Limited support | ❌ Not available

---

## 🔧 Development Workflow

### Local Development

**Web**:
```bash
cd /path/to/riskmate
pnpm install
pnpm dev:frontend  # Starts Next.js on :3000
```

**Backend**:
```bash
cd apps/backend
pnpm install
pnpm dev  # Starts Express on :3001
```

**iOS**:
```bash
cd mobile/Riskmate
open Riskmate.xcodeproj
# Build & Run in Xcode
```

### Testing

**Backend Integration Tests**:
```bash
cd apps/backend
TEST_ORG_ID=your-org-id npm test
```

**Web Tests**:
```bash
pnpm test  # Jest tests
```

### Deployment

**Web (Vercel)**:
- Push to `main` → Auto-deploys
- Or: `vercel deploy --prod`

**Backend (Railway)**:
- Connect GitHub repo
- Set build command: `pnpm install && pnpm build`
- Set start command: `pnpm start:railway`
- Set env vars in Railway dashboard

**iOS (App Store)**:
- Archive in Xcode
- Upload to TestFlight
- Submit for App Store review

---

## 📋 Production Checklist

### Environment Variables

**Backend (Railway)**:
```bash
NODE_ENV=production
PORT=8080
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx (server-only)
SUPABASE_ANON_KEY=xxx (if needed server-side)
CORS_ORIGINS=https://app.riskmate.dev
BACKEND_URL=https://api.riskmate.dev
STRIPE_SECRET_KEY=xxx
# ... other secrets
```

**Web (Vercel/Railway)**:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
NEXT_PUBLIC_API_URL=https://api.riskmate.dev
STRIPE_PUBLISHABLE_KEY=xxx
# ... other public vars
```

**iOS (Xcode Build Settings)**:
```
API_BASE_URL = https://api.riskmate.dev
SUPABASE_URL = https://xxx.supabase.co
SUPABASE_ANON_KEY = xxx
```

### Supabase Production Hardening

✅ **RLS Enabled** on all tables:
- `jobs`, `users`, `organizations`
- `mitigation_items`, `hazards`, `controls`
- `job_documents`, `job_photos`
- `audit_logs`, `job_signoffs`
- All tables enforce `organization_id` scoping

✅ **Storage Policies**:
- Uploads require authentication
- Organization-scoped paths
- No public listing
- Signed URLs for reads

✅ **Service Role Key**:
- Never shipped to clients
- Backend-only usage
- Rotate periodically

### CORS Configuration

**Backend**:
```typescript
cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['https://app.riskmate.dev'],
  credentials: true,
})
```

### Rate Limiting

**Backend**:
- Public endpoints: Rate limited
- Auth endpoints: Stricter limits
- Export generation: Queue-based

### Monitoring

**Backend**:
- Request ID tracking
- Structured error logging
- Health check endpoint: `GET /health`
- Routes debug: `GET /__routes`
- Version endpoint: `GET /__version`

**Web**:
- Vercel Analytics
- Error tracking (ErrorModal)
- Performance monitoring

**iOS**:
- Crash reporting (`CrashReporting`)
- Analytics (`Analytics` service)
- Server health checks (`ServerStatusManager`)

---

## 🎯 Next Steps for Production

1. ✅ **Backend Typing**: Middleware properly typed, zero casts
2. ✅ **Read-Only Enforcement**: Server-side middleware blocks mutations
3. ✅ **Proof-Pack Verification**: Confirmed read-only (only audit logs)
4. ✅ **Integration Tests**: Test infrastructure ready
5. ⏳ **Test Organization**: Create in Supabase, set `TEST_ORG_ID`
6. ⏳ **Railway Setup**: Deploy backend with production env vars
7. ⏳ **Vercel/Railway Setup**: Deploy web with production env vars
8. ⏳ **iOS Production Config**: Set API URLs in Release build
9. ⏳ **App Store Submission**: Upload TestFlight build, submit for review

---

## 📚 Documentation Files

**Backend**:
- `MIDDLEWARE_TYPING_FIX.md` - Middleware typing changes
- `ENFORCEMENT_AND_TYPING_COMPLETE.md` - Read-only enforcement summary
- `TEST_SETUP.md` - Test infrastructure guide
- `TEST_CLEANUP_ORDER.md` - Cleanup order reference
- `TEST_VERIFICATION.md` - Test implementation verification

**iOS**:
- `APP_STORE_READINESS.md` - App Store submission checklist
- `APP_STORE_DESCRIPTION.md` - App Store copy (truthful claims)
- `FINAL_APP_STORE_CHECKLIST.md` - Final review checklist

**Web**:
- `RISKMATE_FEATURE_SPECIFICATION.md` - Complete feature spec
- `RISKMATE_WEB_SPEC_v1.md` - Web app specification

**General**:
- `RISKMATE_COMPREHENSIVE_OVERVIEW.md` - Technical overview
- `README.md` - Project README

---

**RiskMate is production-ready and ready to ship.** 🚀
