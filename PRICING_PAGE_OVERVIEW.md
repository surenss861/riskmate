# Pricing Page Overview - https://riskmate.dev/pricing

**Complete breakdown of the pricing page implementation**

---

## 🎯 Page Purpose

The pricing page (`/pricing`) is a **public-facing marketing page** that:
- Displays three subscription tiers (Starter, Pro, Business)
- Allows users to start checkout for Pro/Business plans
- Shows feature comparison table
- Includes FAQ, testimonials, and ROI calculator
- Links to signup for Starter plan (free tier)

---

## 📋 Current Implementation

### File Location
- **Path**: `app/pricing/page.tsx`
- **Type**: Client-side React component (Next.js App Router)
- **Framework**: Next.js 15 with App Router

### Key Features

#### 1. **Three Pricing Tiers**

**Starter** - $29/mo
- 10 jobs per month
- Automatic risk scores
- Branded watermark proof packs
- View-only proof packs
- 1 team seat
- **CTA**: "Start Free" → Links to `/signup`

**Pro** - $59/mo (Most Popular)
- Unlimited jobs
- Up to 5 team seats
- Branded proof packs + notifications
- Live, shareable proof packs
- Priority email support
- **CTA**: "Start Pro →" → Creates Stripe checkout session

**Business** - $129/mo (Audit-Ready)
- Unlimited seats
- Generate proof packs (ZIP with verification hash)
- Org-level dashboard analytics
- Immutable compliance ledger
- Dedicated onboarding & phone support
- **CTA**: "Start Business →" → Creates Stripe checkout session

#### 2. **Interactive Elements**

- **Plan Highlighting**: Click any card to highlight it
- **Demo Mode**: If `?from=demo` in URL, Business plan shows "Shown in Demo" badge
- **Framer Motion**: Smooth animations on cards and sections
- **Error Handling**: Error modal for checkout failures

#### 3. **Content Sections**

- **Hero**: "Defensibility Tiers" headline + Ledger Contract badge
- **Pricing Cards**: Three plan cards with features
- **Feature Comparison Table**: Side-by-side feature comparison
- **Proof Pack Example**: Demo PackCard component (unverified, clearly labeled)
- **Testimonials**: Three contractor testimonials
- **ROI Calculator**: Interactive calculator (currently static, not functional)
- **FAQ**: 9 common questions
- **CTA**: Final "Create Account" button

---

## 🔧 Technical Implementation

### Component Structure

```typescript
PricingPage (default export)
  └─ Suspense boundary (fallback: "Loading pricing...")
      └─ PricingContent (main component)
          ├─ Header (logo + nav)
          ├─ Hero section
          ├─ Pricing cards (3)
          ├─ Feature comparison table
          ├─ Proof pack example
          ├─ Testimonials
          ├─ ROI calculator
          ├─ FAQ
          └─ Error modal
```

### State Management

- `loading`: Tracks which plan is being processed (for checkout)
- `error`: Stores error message if checkout fails
- `highlightedPlan`: Tracks which plan card is highlighted

### API Integration

**Checkout Flow**:
1. User clicks "Start Pro" or "Start Business"
2. Calls `subscriptionsApi.createCheckoutSession({ plan, success_url, cancel_url })`
3. API endpoint: `POST /api/subscriptions/checkout` (Next.js API route)
4. Backend creates Stripe Checkout Session
5. Redirects to Stripe hosted checkout
6. On success → `/pricing/thank-you`
7. On cancel → `/pricing/cancelled`

**API Route**: `app/api/subscriptions/checkout/route.ts`
- Uses Stripe product IDs (from env vars or defaults)
- Creates checkout session with metadata (plan_code, organization_id, user_id)
- Returns checkout URL

---

## 🐛 Current Issue: "Loading pricing..." Stuck

### Problem

The page shows "Loading pricing... Please wait" and never loads the actual content.

### Root Cause

The page uses `useSearchParams()` which requires a `<Suspense>` boundary in Next.js App Router. The fallback is showing, but the component isn't resolving.

### Possible Causes

1. **JavaScript Error**: Component throwing error during render
2. **Missing Dependencies**: Framer Motion or other deps not loading
3. **API Error**: If page tries to fetch data (it doesn't currently)
4. **Hydration Mismatch**: SSR/client mismatch

### Quick Fix

The page doesn't actually need `useSearchParams()` for the base case - it only uses it for `?from=demo`. We can make it optional:

```typescript
// Current: Requires Suspense
const searchParams = useSearchParams()
const fromDemo = searchParams.get('from') === 'demo'

// Better: Optional, no Suspense needed
const searchParams = useSearchParams() // Still needs Suspense, but...
```

Actually, the real issue is that `useSearchParams()` **always** requires Suspense in App Router. The page structure is correct, but something is preventing the component from rendering.

---

## 🔍 Debugging Steps

### 1. Check Browser Console

Open DevTools → Console, look for:
- JavaScript errors
- React hydration errors
- Missing component errors

### 2. Check Network Tab

Look for:
- Failed API requests
- Missing static assets (JS bundles)
- 404 errors

### 3. Check Vercel Logs

Vercel → Project → Deployments → View Function Logs
- Look for build errors
- Look for runtime errors

### 4. Test Locally

```bash
cd apps/web
pnpm dev
# Visit http://localhost:3000/pricing
```

---

## ✅ What Should Work

### Normal Flow

1. User visits `/pricing`
2. Page loads instantly (no API calls needed)
3. Shows three pricing cards
4. User clicks "Start Pro" or "Start Business"
5. Creates Stripe checkout session
6. Redirects to Stripe
7. User completes payment
8. Webhook updates subscription
9. User redirected to `/pricing/thank-you`

### Starter Plan Flow

1. User clicks "Start Free" on Starter card
2. Redirects to `/signup`
3. Creates account (no payment)
4. Gets Starter plan by default

---

## 🎨 Design & UX

### Visual Design

- **Background**: Dark (`#050505`)
- **Cards**: Glass-morphism style (`bg-white/5`, `border-white/10`)
- **Accent Color**: Orange (`#F97316`)
- **Typography**: Clean, modern, Apple-style
- **Animations**: Subtle Framer Motion animations

### User Experience

- **Clear Hierarchy**: Pro plan highlighted as "Most Popular"
- **Feature Comparison**: Easy-to-scan table
- **Social Proof**: Testimonials from contractors
- **Trust Signals**: "Ledger Contract v1.0 (Frozen)" badge
- **Transparency**: Clear pricing, no hidden fees

---

## 🔗 Related Pages

- `/pricing/thank-you` - Post-checkout success page
- `/pricing/cancelled` - Post-checkout cancellation page
- `/signup` - Account creation (for Starter plan)
- `/demo` - Interactive demo (can link to pricing with `?from=demo`)

---

## 📊 Analytics & Tracking

**Current**: No analytics tracking visible
**Recommended**: Add:
- Page view tracking
- Plan selection tracking
- Checkout initiation tracking
- Conversion funnel tracking

---

## 🚀 Optimization Opportunities

### Performance

1. **Remove Suspense if possible**: Make `useSearchParams()` optional
2. **Code splitting**: Lazy load heavy components (ROI calculator)
3. **Image optimization**: If adding images, use Next.js Image component

### Functionality

1. **ROI Calculator**: Currently static, make it interactive
2. **Plan Comparison**: Add "Compare Plans" expandable section
3. **Live Pricing**: Fetch actual prices from Stripe (optional)

### SEO

1. **Meta tags**: Add pricing page meta description
2. **Structured data**: Add JSON-LD for pricing schema
3. **Open Graph**: Add OG tags for social sharing

---

## 🔧 Quick Fix for Loading Issue

**Most likely fix**: The component is fine, but there's a build/runtime error. Check:

1. **Vercel build logs**: Look for TypeScript/compilation errors
2. **Browser console**: Look for runtime errors
3. **Network tab**: Check if JS bundles are loading

**If it's a Suspense issue**, we can refactor to not require it:

```typescript
// Option: Make searchParams optional
'use client'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

function PricingContent() {
  const [fromDemo, setFromDemo] = useState(false)
  
  useEffect(() => {
    // Check URL params client-side
    const params = new URLSearchParams(window.location.search)
    setFromDemo(params.get('from') === 'demo')
  }, [])
  
  // Rest of component...
}
```

---

**The pricing page is production-ready, but the loading state suggests a build/runtime issue that needs debugging.** 🔍
