# Supabase Setup Guide

This guide will help you set up your new Supabase project for RiskMate.

## Step 1: Get Your Supabase Credentials

1. Go to your Supabase project dashboard: https://app.supabase.com
2. Navigate to **Settings** → **API**
3. Copy the following values:
   - **Project URL** (this is your `NEXT_PUBLIC_SUPABASE_URL`)
   - **anon/public key** (this is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
   - **service_role key** (this is your `SUPABASE_SERVICE_ROLE_KEY` - keep this secret!)

## Step 2: Update Environment Variables

### Local Development (.env.local)

Create a `.env.local` file in the root of your project with:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_project_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Other environment variables (if you have them)
NEXT_PUBLIC_APP_URL=http://localhost:3000
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_PUBLIC_KEY=your_stripe_public_key
STRIPE_PRICE_ID_PRO=your_pro_price_id
STRIPE_PRICE_ID_BUSINESS=your_business_price_id
```

### Vercel Production

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add the same variables as above (use your production Supabase project URL and keys)

## Step 3: Run Database Migrations

You have two options:

### Option A: Using Supabase CLI (Recommended)

```bash
# Install Supabase CLI if you haven't
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref xwxghduwkzmzjrbpzwwq

# Run all migrations
supabase db push
```

### Option B: Using Supabase Dashboard SQL Editor

1. Go to your Supabase dashboard
2. Navigate to **SQL Editor**
3. Run each migration file in order (from `supabase/migrations/`):
   - Start with the earliest dated file
   - Run them sequentially

**Important Migration Order:**
1. `20240101000000_initial_schema.sql`
2. `20240101000001_row_level_security.sql`
3. `20240101000002_seed_data.sql`
4. `20240101000003_storage_buckets.sql`
5. Then all the numbered migrations in order
6. Finally: `20251128000000_comprehensive_schema_restructure.sql`

## Step 4: Set Up Storage Buckets

1. Go to **Storage** in your Supabase dashboard
2. Create the following buckets (if they don't exist from migrations):

   - **`documents`** - Public: No
   - **`photos`** - Public: No
   - **`signatures`** - Public: No
   - **`reports`** - Public: No
   - **`permit-packs`** - Public: No

3. For each bucket, set up policies:
   - Go to **Storage** → **Policies**
   - Add policies that allow users to upload/download files for their organization only

## Step 5: Verify RLS (Row Level Security)

1. Go to **Authentication** → **Policies**
2. Verify that RLS is enabled on all tables
3. Check that policies are in place for:
   - `jobs`
   - `organizations`
   - `users`
   - `documents`
   - `mitigation_items`
   - `audit_logs`
   - And all other tables

## Step 6: Test the Connection

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Try to sign up a new user
3. Check the Supabase dashboard to verify:
   - User was created in `auth.users`
   - Organization was created in `organizations`
   - User record was created in `users` table

## Step 7: Configure Email (Optional but Recommended)

1. Go to **Authentication** → **Email Templates**
2. Customize email templates if needed
3. For development, you can use Supabase's built-in email service
4. For production, configure SMTP settings in **Settings** → **Auth**

## Troubleshooting

### Migration Errors

If you get errors running migrations:
- Check that you're running them in the correct order
- Some migrations may have `IF NOT EXISTS` checks - that's okay
- If a table already exists, the migration will skip it

### RLS Policy Errors

If you get "permission denied" errors:
- Check that RLS is enabled on the table
- Verify that policies allow the operation you're trying to perform
- Check that the user's `organization_id` matches the data they're accessing

### Storage Errors

If file uploads fail:
- Verify buckets exist
- Check bucket policies allow uploads
- Ensure file paths include `organization_id` in the path structure

## Next Steps

After setup:
1. Test user signup
2. Test job creation
3. Test file uploads
4. Test PDF generation
5. Verify multi-tenant isolation (create two orgs and verify they can't see each other's data)

