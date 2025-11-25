# RiskMate Backend API

Express.js API server for RiskMate platform.

## Features

- ✅ JWT Authentication middleware
- ✅ Organization-scoped data access
- ✅ Risk summary aggregation (`/api/risk/summary`)
- ✅ Subscription & usage tracking (`/api/subscriptions`)
- ✅ Job document management (`/api/jobs/:id/documents`)
- ✅ Permit Pack generator (`/api/reports/permit-pack/:jobId`)

## Setup

1. **Install dependencies:**
   ```bash
   cd apps/backend
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Fill in your Supabase and Stripe credentials
   ```

3. **Run development server:**
   ```bash
   npm run dev
   ```

4. **Build for production:**
   ```bash
   npm run build
   npm start
   ```

## API Endpoints

### Risk
- `GET /api/risk/summary` - Get top 3 hazards for organization (last 30 days)

### Subscriptions
- `GET /api/subscriptions` - Get current subscription and usage
- `POST /api/subscriptions/portal` - Get Stripe billing portal URL

### Jobs
- `GET /api/jobs/:id/documents` - Get all documents for a job

### Reports
- `POST /api/reports/permit-pack/:jobId` - Generate Permit Pack bundle

## Authentication

All endpoints require JWT authentication via `Authorization: Bearer <token>` header.

The token is validated against Supabase Auth, and the user's organization_id is extracted from the users table.

## Environment Variables

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (for admin operations)
- `STRIPE_SECRET_KEY` - Stripe API secret key
- `FRONTEND_URL` - Frontend URL for CORS
- `PORT` - Server port (default: 5173)

