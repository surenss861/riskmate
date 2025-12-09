# RiskMate - Comprehensive Technical & Product Overview

## 🎯 What is RiskMate?

**RiskMate** is an industry-grade SaaS platform for service contractors (electricians, roofers, HVAC, general contractors) to manage job safety, risk assessments, compliance documentation, and generate audit-ready PDF reports. It replaces messy paper forms, random job photos, and inconsistent safety checks with a unified dashboard.

**Target Market**: Small to medium trade companies (1-50 employees) who need professional safety documentation for insurance, clients, and compliance.

---

## 🏗️ Tech Stack

### Frontend
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS with custom design system
- **Animations**: Framer Motion, GSAP, Lenis (smooth scroll)
- **UI Components**: Radix UI (Accordion, Popover)
- **Forms**: React Hook Form + Zod validation
- **3D Graphics**: Three.js, React Three Fiber
- **Particles**: TSParticles
- **Fonts**: Inter (primary), Playfair Display (display)

### Backend
- **API**: Next.js API Routes (serverless functions)
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth (email/password)
- **Storage**: Supabase Storage (photos, documents, PDFs)
- **Real-time**: Supabase Realtime (for future features)
- **Payments**: Stripe (subscriptions, checkout, billing portal)

### PDF Generation
- **Library**: PDFKit
- **Format**: Professional Risk Snapshot Reports
- **Features**: Branded PDFs, photo embedding, audit trails, signatures

### Analytics & Monitoring
- **Analytics**: PostHog (product analytics)
- **Performance**: Vercel Analytics + Speed Insights
- **Error Tracking**: Built-in error handling with ErrorModal component

### Deployment
- **Hosting**: Vercel (serverless)
- **Database**: Supabase Cloud
- **CDN**: Vercel Edge Network
- **Build**: Next.js production build with webpack optimizations

---

## 📐 Architecture

### Multi-Tenant Architecture
RiskMate uses **true multi-tenant data isolation** enforced at three layers:

1. **Database Layer (RLS)**: Row Level Security policies automatically filter by `organization_id`
2. **Application Layer**: All API routes explicitly filter by `organization_id` using `getOrganizationContext()`
3. **Storage Layer**: Bucket policies scoped to `organization_id` in file paths

**Security Guarantees**:
- Users can only access their organization's data
- ID enumeration attacks are blocked
- Direct database queries are filtered by RLS
- Storage access is organization-scoped

### Data Flow

```
User Action → Next.js API Route → Organization Guard → Supabase Query (with RLS) → Response
```

**Example: Creating a Job**
1. User submits job form
2. API route verifies organization context
3. Backend checks subscription limits (Starter: 3 jobs/month)
4. Risk factors selected → Risk score calculated
5. Mitigation items auto-generated
6. Job created with audit log entry
7. Response returned to frontend

### Database Schema

**Core Tables**:
- `organizations` - Company accounts
- `users` - User accounts (linked to auth.users)
- `jobs` - Job records
- `risk_factors` - Master list of risk types
- `job_risk_scores` - Calculated risk scores per job
- `mitigation_items` - Safety checklist items
- `documents` - Files (photos, PDFs, certificates)
- `risk_snapshot_reports` - Generated PDF reports
- `subscriptions` - Stripe subscription data
- `audit_logs` - Complete activity trail
- `organization_invites` - Team invitation system
- `legal_acceptances` - Terms/privacy acceptance tracking

**Extended Tables** (from comprehensive schema):
- `hazards` - Identified hazards per job
- `controls` - Safety controls/mitigations
- `job_assignments` - Worker assignments
- `signatures` - Digital signatures
- `compliance_checks` - Compliance verification
- `evidence_verifications` - Photo/document verification
- `hazard_templates` - Reusable hazard templates
- `mitigation_templates` - Reusable mitigation templates
- `job_templates` - Complete job templates

---

## 🎨 Design System & UI

### Color Palette
- **Background**: `#0A0A0A` (minimal black)
- **Surface**: `#121212` (card backgrounds)
- **Primary Accent**: `#F97316` (orange)
- **Text Primary**: `#FFFFFF`
- **Text Secondary**: `#A1A1A1`
- **Success**: `#29CC6A`
- **Warning**: `#FFC53D`
- **Danger**: `#FF4D4F`

### Typography
- **Display Font**: Playfair Display (headings)
- **Body Font**: Inter (all text)
- **Sizes**: Display-1 (72px), Display-2 (64px), H1 (48px), H2 (36px), Body (18px)

### Components
- **Dashboard Components**: DataGrid, KpiGrid, TrendChart, EvidenceWidget
- **Forms**: EditableText, EditableSelect
- **Modals**: ErrorModal, ConfirmModal, GenerationProgressModal
- **Navigation**: DashboardNavbar, SmoothScroll
- **Marketing**: HeroScene, MagneticButton, ChatWidget

### Animations
- **Page Transitions**: Framer Motion
- **Smooth Scrolling**: Lenis (global component)
- **3D Effects**: Three.js for hero scene
- **Particle Effects**: TSParticles

---

## 🔐 Authentication & Authorization

### Authentication
- **Method**: Supabase Auth (email/password)
- **Flow**: Signup → Auto-create organization → Set user as owner
- **Session**: Managed by Supabase client-side

### Authorization (Role-Based Access Control)

**Three Roles**:
1. **Owner**: Full access (billing, team management, all features)
2. **Admin**: Most features (no billing management)
3. **Member**: Limited access (create jobs, complete mitigations, view reports)

**Permission System**:
- Granular permissions: `jobs.create`, `jobs.edit`, `reports.generate`, `team.invite`, etc.
- Permissions checked via `hasPermission(role, permission)`
- Middleware enforces permissions in API routes

---

## 💳 Subscription Plans & Billing

### Plans

**Starter** (Free/Trial):
- 3 jobs/month
- 1 seat
- Basic features
- Share links

**Pro** ($X/month):
- Unlimited jobs
- 5 seats
- Branded PDFs
- Notifications
- Advanced features

**Business** ($X/month):
- Unlimited jobs
- Unlimited seats
- Analytics dashboard
- Permit Pack generation
- Audit logs
- Priority support

### Billing System
- **Payment Processor**: Stripe
- **Checkout Flow**: Stripe Checkout Session → Redirect → Webhook confirmation
- **Subscription Management**: Stripe Customer Portal
- **Plan Enforcement**: Middleware checks subscription tier before operations
- **Limits**: Enforced at API level (e.g., job creation blocked if limit reached)

---

## 📊 Core Features

### 1. Job Management
- **Create Jobs**: Client name, type, location, description, dates
- **Risk Assessment**: Select risk factors → Auto-calculate risk score
- **Status Tracking**: Draft → In Progress → Completed
- **Job Details**: Full job view with all associated data

### 2. Risk Scoring Engine
- **Algorithm**: Weighted severity system
  - Critical: 25 points
  - High: 15 points
  - Medium: 8 points
  - Low: 3 points
- **Risk Levels**: Low (<40), Medium (40-69), High (70-89), Critical (90+)
- **Auto-Mitigation**: Risk factors trigger mitigation checklist items

### 3. Mitigation Checklists
- **Auto-Generated**: Based on selected risk factors
- **Completion Tracking**: Who completed, when, with timestamps
- **Status**: Pending → Completed
- **Templates**: Reusable mitigation templates (future)

### 4. Photo Evidence
- **Categories**: Before, During, After
- **Upload**: Drag-and-drop or file picker
- **Optimization**: Client-side photo compression
- **GPS Metadata**: Optional location tagging
- **Storage**: Supabase Storage (organization-scoped)

### 5. PDF Report Generation
- **Report Type**: Risk Snapshot Report
- **Sections**:
  - Cover page (branded)
  - Executive summary
  - Hazard checklist
  - Controls applied
  - Timeline/audit log
  - Photo evidence
  - Signatures & compliance
- **Branding**: Organization logo, accent color
- **Sharing**: Secure token-based share links (7-day expiry)

### 6. Team Management
- **Invitations**: Email-based team invites
- **Roles**: Owner, Admin, Member
- **Seat Limits**: Enforced by subscription tier
- **Member Management**: View, remove, change roles

### 7. Analytics Dashboard
- **KPIs**: Total jobs, jobs at risk, compliance score, workforce activity
- **Charts**: Trend analysis (risk scores, job completion)
- **Time Range**: 7, 30, 90 days
- **Feature Lock**: Business plan only

### 8. Audit Logging
- **Events Tracked**: Job created, hazard added, mitigation completed, report generated
- **Metadata**: Actor, timestamp, target resource
- **Compliance**: Complete activity trail for audits

---

## 🌐 Marketing & Sales Pages

### Landing Page (`/`)
- Hero section with 3D scene
- Feature highlights
- "What RiskMate Replaces" section
- Mobile app promo
- Social proof
- Founder story
- Case studies links
- Comparison pages links
- CTA buttons (Sign up, Demo)

### Pricing Page (`/pricing`)
- Three-tier pricing table
- Feature comparison
- FAQ section
- Stripe checkout integration

### Case Studies
- `/case-studies/electrical` - Electrical contractor example
- `/case-studies/roofing` - Roofing company example
- `/case-studies/hvac` - HVAC technician example

### Comparison Pages
- `/compare/safetyculture` - vs SafetyCulture
- `/compare/sitedocs` - vs SiteDocs
- `/compare/pen-and-paper` - vs Paper forms
- `/compare/spreadsheets` - vs Spreadsheet templates

### Calculator Tools (SEO + Lead Magnets)
- `/tools/risk-score-calculator` - Interactive risk calculator
- `/tools/compliance-score` - Compliance checker
- `/tools/incident-cost` - Cost estimator
- `/tools/time-saved` - Time savings calculator

### Resources
- `/resources/bundle` - Contractor bundle download (JSA templates, checklists, guides)
- `/sample-report` - Sample PDF download (no email required)
- `/roadmap` - Public feature roadmap (Shipped, In Progress, Coming Soon)

### Demo
- `/demo` - Interactive sandbox (view-only demo environment)

---

## 📱 PWA (Progressive Web App)

### Features
- **Service Worker**: Offline support
- **Manifest**: App-like experience
- **Install Prompt**: "Add to Home Screen"
- **Offline Sync**: Queue actions → Replay on reconnect (future)

### Mobile Optimization
- Responsive design (mobile-first)
- Touch-friendly buttons
- Swipe actions (future)
- Sticky headers
- Collapsible sections

---

## 🔄 User Workflows

### New User Onboarding
1. Sign up → Auto-create organization
2. Onboarding wizard (first-time only)
3. Create first job
4. Select risk factors
5. Complete mitigation checklist
6. Upload photos
7. Generate PDF report

### Daily Workflow
1. **Before Job**: Create job → Select risk factors → Review mitigations
2. **On-Site**: Complete mitigations → Upload photos → Update status
3. **After Job**: Generate report → Share with client/insurance

### Team Collaboration
1. Owner/Admin invites team members
2. Members assigned to jobs
3. Members complete mitigations, upload photos
4. Owner/Admin reviews, generates reports

---

## 🛠️ Development Setup

### Prerequisites
- Node.js 18+
- pnpm
- Supabase account
- Stripe account

### Installation
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

# Start development
pnpm dev
```

### Environment Variables
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_PRODUCT_STARTER=
STRIPE_PRODUCT_PRO=
STRIPE_PRODUCT_BUSINESS=

# Analytics
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=

# Backend
NEXT_PUBLIC_BACKEND_URL=http://localhost:5173
```

---

## 📁 Project Structure

```
riskmate/
├── app/                    # Next.js app directory
│   ├── api/                # API routes
│   ├── dashboard/          # Dashboard pages
│   ├── pricing/            # Pricing & checkout
│   ├── tools/              # Calculator tools
│   ├── case-studies/      # Industry case studies
│   ├── compare/            # Competitor comparisons
│   └── page.tsx            # Landing page
├── components/             # React components
│   ├── dashboard/         # Dashboard-specific components
│   ├── onboarding/        # Onboarding wizard
│   └── report/            # PDF report components
├── lib/                    # Utilities & API clients
│   ├── supabase/          # Supabase client setup
│   └── utils/              # Helper functions
│       ├── pdf/           # PDF generation
│       ├── permissions.ts # RBAC system
│       └── planRules.ts   # Subscription limits
├── hooks/                  # Custom React hooks
├── supabase/
│   └── migrations/        # Database migrations
└── public/                 # Static assets
```

---

## 🚀 Deployment

### Vercel Deployment
- **Platform**: Vercel (serverless)
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Environment Variables**: Set in Vercel dashboard
- **Functions**: API routes run as serverless functions
- **Edge Network**: Global CDN for static assets

### Database
- **Hosting**: Supabase Cloud
- **Migrations**: Run via Supabase CLI or dashboard
- **Backups**: Automatic (Supabase handles)

### Storage
- **Provider**: Supabase Storage
- **Buckets**: `documents`, `photos`, `reports`
- **Policies**: Organization-scoped access

---

## 🔮 Future Features (Roadmap)

### In Progress
- Templates system (hazards, mitigations, jobs)
- Job assignments with notifications
- Evidence verification workflow
- Advanced permissions matrix

### Coming Soon
- Workflow builder (custom job stages)
- Organization Insights v2 (advanced analytics)
- Offline Sync v2 (bi-directional)
- Command Palette (Ctrl+K)
- Dark theme only (light mode removed)
- Mobile app (iOS/Android)

### Ideas Under Review
- AI-powered risk suggestions
- Integration with safety management systems
- Multi-language support
- Custom reporting templates

---

## 📊 Key Metrics & Analytics

### Tracked Events
- Page views
- Signups
- Logins
- Job creation
- Report generation
- Subscription upgrades
- Feature usage
- Errors

### Analytics Tools
- **PostHog**: Product analytics, user behavior
- **Vercel Analytics**: Performance metrics
- **Custom Events**: Business-specific tracking

---

## 🎯 Business Model

### Revenue Streams
1. **Subscription Revenue**: Monthly/annual plans
2. **Upsells**: Starter → Pro → Business
3. **Enterprise**: Custom pricing for large teams

### Pricing Strategy
- **Freemium**: Starter plan (3 jobs/month) to attract users
- **Value-Based**: Pro/Business tiers unlock unlimited usage + premium features
- **Seat-Based**: Additional revenue from team expansion

### Go-To-Market
- **SEO**: Calculator tools, comparison pages, case studies
- **Content Marketing**: Contractor bundle, guides, blog (future)
- **Product-Led Growth**: Free tier → Upgrade prompts → Paid conversion
- **Sales**: Demo booking, direct outreach (future)

---

## 🔒 Security & Compliance

### Security Features
- **Multi-Tenant Isolation**: RLS + application-level checks
- **Authentication**: Supabase Auth (secure, industry-standard)
- **Data Encryption**: At rest (Supabase) and in transit (HTTPS)
- **Audit Logging**: Complete activity trail
- **Role-Based Access**: Granular permissions

### Compliance
- **SOC-2 Ready**: Multi-layer data isolation
- **GDPR Compliant**: Data isolation, user deletion
- **Audit-Ready**: Complete audit logs, timestamps
- **Legal**: Terms of service, privacy policy acceptance tracking

---

## 📈 Performance Optimizations

### Frontend
- **Image Optimization**: Next.js Image component
- **Code Splitting**: Automatic route-based splitting
- **Lazy Loading**: Components loaded on demand
- **Caching**: Static assets cached via CDN

### Backend
- **Serverless Functions**: Auto-scaling
- **Database Indexing**: Optimized queries
- **RLS Performance**: Efficient policy evaluation
- **PDF Generation**: Cached reports, async generation

### Future Optimizations
- DataGrid virtualization
- Photo upload optimization
- Offline caching
- GraphQL API (future consideration)

---

## 🐛 Error Handling

### Error Types
- **Feature Restricted**: Plan limits reached
- **Authentication Errors**: Unauthorized access
- **Validation Errors**: Form validation failures
- **API Errors**: Backend failures
- **PDF Generation Errors**: Font loading, serverless issues

### Error UI
- **ErrorModal**: User-friendly error messages
- **Toast Notifications**: Success/error feedback
- **Loading States**: Skeleton loaders, progress indicators

---

## 📝 Documentation

### Code Documentation
- TypeScript types for all data structures
- JSDoc comments on utility functions
- Architecture docs (`docs/MULTI_TENANT_ARCHITECTURE.md`)

### User Documentation
- Onboarding wizard (first-time users)
- In-app tooltips (future)
- Help center (future)

---

## 🎨 Brand Identity

### Visual Identity
- **Logo**: RiskMate logo (SVG)
- **Colors**: Orange (#F97316) primary, dark theme
- **Typography**: Inter + Playfair Display
- **Style**: Modern, professional, contractor-focused

### Messaging
- **Tagline**: "Protect Every Job Before It Starts"
- **Value Prop**: "Instant risk scoring, auto-mitigation checklists, and shareable PDF reports"
- **Tone**: Professional, trustworthy, contractor-friendly

---

## 🤝 Contributing

### Development Workflow
1. Create feature branch
2. Implement feature
3. Write tests (future)
4. Submit PR
5. Code review
6. Merge to main

### Code Standards
- TypeScript strict mode
- ESLint + Prettier
- Component-based architecture
- Utility functions for reusable logic

---

## 📞 Support & Contact

### Support Channels
- **Live Chat**: ChatWidget component (FAQ bot)
- **Email**: (future)
- **Help Center**: (future)

### Priority Support
- Business plan: Priority support
- Pro/Starter: Standard support

---

## 🏆 Competitive Advantages

1. **Contractor-Focused**: Built specifically for trade companies
2. **Speed**: Fast job creation, instant risk scoring
3. **Professional Output**: Audit-ready PDF reports
4. **Affordable**: Competitive pricing vs SafetyCulture/SiteDocs
5. **Modern UX**: Beautiful, intuitive interface
6. **Mobile-Ready**: PWA + future native apps

---

## 📚 Additional Resources

- **Database Schema**: `supabase/migrations/`
- **API Documentation**: Inline comments in API routes
- **Component Library**: `components/` directory
- **Utility Functions**: `lib/utils/`

---

**Last Updated**: December 2024
**Version**: 0.1.0
**Status**: Production-ready, actively developed

