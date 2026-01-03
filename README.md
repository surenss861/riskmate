# RiskMate

**Smart safety + job risk management platform for contractors**

RiskMate replaces messy paper forms, random job photos, and inconsistent safety checks with one clean dashboard that handles job risk assessments, hazards, controls, documentation, and compliance reporting.

## 🎯 What RiskMate Does

RiskMate is the "control center" for small trade companies to document every job properly, avoid liability, and look more professional to clients.

### Core Features

- **Job Risk Assessments** - Comprehensive hazard checklists and risk scoring
- **Hazards + Controls** - Identify and document safety controls (PPE, lockout, etc.)
- **Before/After Job Photos** - Timestamped photo evidence with automatic organization
- **Team Accountability** - Track who's on-site, who submitted what, with signatures
- **Compliance Documentation** - Complete audit trail with timestamps
- **Team Management** - Seats, invites, role-based access control
- **Plan-Based Limits** - Job limits and seat limits enforced by subscription tier
- **Stripe Billing** - Automatic plan enforcement and feature gating
- **Audit-Ready PDF Reports** - Professional reports for clients, insurance, and auditors

## 🔄 Workflow

### Before a Job Starts

RiskMate guides teams through:
- Hazard checklists
- Risk assessments
- Required controls (PPE, lockout, etc.)
- Job-specific notes
- On-site photos
- Team signatures

Everything gets time-stamped and saved automatically.

### During the Job

RiskMate tracks:
- Site changes
- New hazards
- Additional photos
- Crew activity (who's on-site, who submitted what)

It essentially becomes a "living job log."

### After the Job

RiskMate generates:
- Risk Snapshot Report (PDF)
- Job summary
- Evidence photos
- Clear compliance trail
- Who completed what
- Job score / status

Reports can be shared with:
- Clients
- Insurance providers
- Internal supervisors
- Auditors

## 🏗️ Tech Stack

- **Frontend**: Next.js 15, React, TypeScript, Tailwind CSS, Framer Motion
- **Backend**: Express.js, Node.js, TypeScript
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Storage**: Supabase Storage
- **Payments**: Stripe
- **Real-time**: Supabase Realtime

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- Supabase account
- Stripe account (for payments)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd riskmate

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
# Fill in your Supabase and Stripe credentials

# Run database migrations
supabase db push

# Start development servers
pnpm dev
```

### Environment Variables

Required environment variables:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Backend
PORT=5173
NEXT_PUBLIC_BACKEND_URL=http://localhost:5173

# Stripe
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_PRODUCT_STARTER=prod_xxx
STRIPE_PRODUCT_PRO=prod_xxx
STRIPE_PRODUCT_BUSINESS=prod_xxx

# PDF Generation Service (self-hosted on Fly.io)
PDF_SERVICE_URL=https://pdf-service-dawn-silence-4921.fly.dev
PDF_SERVICE_SECRET=your_pdf_service_secret
# OR use Browserless (alternative):
# BROWSERLESS_TOKEN=your_browserless_token
```

## 📁 Project Structure

```
riskmate/
├── app/                    # Next.js app directory
│   ├── dashboard/         # Dashboard pages
│   ├── pricing/           # Pricing and checkout
│   └── page.tsx           # Landing page
├── apps/
│   └── backend/           # Express API server
├── components/            # React components
├── hooks/                 # Custom React hooks
├── lib/                   # Utilities and API clients
├── supabase/
│   └── migrations/       # Database migrations
└── public/               # Static assets
```

## 🔐 Authentication & Authorization

- **Authentication**: Supabase Auth with email/password
- **Authorization**: Role-based (owner, admin, member)
- **Plan Enforcement**: Middleware enforces feature access and limits based on subscription

## 💳 Subscription Plans

- **Starter**: 10 jobs/month, 1 seat, share links
- **Pro**: Unlimited jobs, 5 seats, branded PDFs, notifications
- **Business**: Unlimited jobs, unlimited seats, analytics, permit pack, audit logs, priority support

## 🧪 Development

```bash
# Run frontend
pnpm --filter @riskmate/web dev

# Run backend
pnpm --filter @riskmate/backend dev

# Run both
pnpm dev
```

## 📝 License

[Your License Here]

## 🤝 Contributing

[Contributing Guidelines]

---

**RiskMate turns every job into an organized, audit-ready safety report.**
# riskmate
# riskmate
