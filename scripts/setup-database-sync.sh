#!/bin/bash

# RiskMate Database Sync Setup Script
# Ensures web, iOS, and backend all point to the same Supabase project
# and applies required migrations

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 RiskMate Database Sync Setup${NC}"
echo "========================================"
echo ""

# Step 1: Verify Configuration
echo -e "${BLUE}Step 1: Verifying Configuration${NC}"
echo ""

if [ ! -f .env.local ]; then
    echo -e "${RED}❌ .env.local not found${NC}"
    echo "Create it with your Supabase credentials"
    exit 1
fi

WEB_SUPABASE_URL=$(grep "NEXT_PUBLIC_SUPABASE_URL" .env.local | cut -d '=' -f2 | tr -d '"' | tr -d "'" | xargs)
WEB_ANON_KEY=$(grep "NEXT_PUBLIC_SUPABASE_ANON_KEY" .env.local | cut -d '=' -f2 | tr -d '"' | tr -d "'" | xargs)

if [ -z "$WEB_SUPABASE_URL" ]; then
    echo -e "${RED}❌ NEXT_PUBLIC_SUPABASE_URL not set in .env.local${NC}"
    exit 1
fi

if [ -z "$WEB_ANON_KEY" ]; then
    echo -e "${RED}❌ NEXT_PUBLIC_SUPABASE_ANON_KEY not set in .env.local${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Web config found${NC}"
echo "   SUPABASE_URL: ${WEB_SUPABASE_URL:0:40}..."
echo ""

# Check iOS Config
IOS_CONFIG="mobile/Riskmate/Riskmate/Config.plist"
if [ ! -f "$IOS_CONFIG" ]; then
    echo -e "${YELLOW}⚠️  iOS Config.plist not found${NC}"
    echo "   Path: $IOS_CONFIG"
    echo "   Please create it with SUPABASE_URL and SUPABASE_ANON_KEY"
    echo ""
else
    if command -v plutil &> /dev/null; then
        IOS_SUPABASE_URL=$(plutil -extract SUPABASE_URL raw "$IOS_CONFIG" 2>/dev/null || echo "")
        IOS_ANON_KEY=$(plutil -extract SUPABASE_ANON_KEY raw "$IOS_CONFIG" 2>/dev/null || echo "")
        
        if [ -n "$IOS_SUPABASE_URL" ] && [ "$WEB_SUPABASE_URL" = "$IOS_SUPABASE_URL" ]; then
            echo -e "${GREEN}✅ iOS config matches web${NC}"
        else
            echo -e "${RED}❌ iOS SUPABASE_URL doesn't match web${NC}"
            echo "   Web:  $WEB_SUPABASE_URL"
            echo "   iOS:  $IOS_SUPABASE_URL"
            echo ""
            echo "   Fix: Update mobile/Riskmate/Riskmate/Config.plist"
        fi
    else
        echo -e "${YELLOW}⚠️  plutil not found (install Xcode Command Line Tools)${NC}"
    fi
fi

echo ""
echo -e "${BLUE}Step 2: Migration Status${NC}"
echo ""

# Check if migration file exists
MIGRATION_FILE="supabase/migrations/20251203000004_export_worker_atomic_claim.sql"
if [ ! -f "$MIGRATION_FILE" ]; then
    echo -e "${RED}❌ Migration file not found: $MIGRATION_FILE${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Migration file found${NC}"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT: Apply this migration to your Supabase database${NC}"
echo ""
echo "   Option 1: Supabase Dashboard (Recommended)"
echo "   1. Go to https://app.supabase.com"
echo "   2. Select your project"
echo "   3. Navigate to SQL Editor"
echo "   4. Copy/paste contents of: $MIGRATION_FILE"
echo "   5. Run the SQL"
echo ""
echo "   Option 2: Supabase CLI"
echo "   supabase db push"
echo ""

# Step 3: Verification SQL
echo -e "${BLUE}Step 3: Verification${NC}"
echo ""
echo "After applying the migration, run this in Supabase SQL Editor:"
echo ""
echo -e "${GREEN}SELECT"
echo "  n.nspname AS schema,"
echo "  p.proname AS function,"
echo "  pg_get_function_identity_arguments(p.oid) AS args"
echo "FROM pg_proc p"
echo "JOIN pg_namespace n ON n.oid = p.pronamespace"
echo "WHERE p.proname = 'claim_export_job';${NC}"
echo ""
echo "Expected result:"
echo "  schema | function          | args"
echo "  -------|-------------------|------------------"
echo "  public | claim_export_job  | p_max_concurrent integer DEFAULT 3"
echo ""

# Step 4: Refresh PostgREST cache
echo -e "${BLUE}Step 4: Refresh PostgREST Schema Cache${NC}"
echo ""
echo "If the function exists but backend still can't find it, run:"
echo ""
echo -e "${GREEN}SELECT pg_notify('pgrst', 'reload schema');${NC}"
echo ""
echo "Then restart your Railway backend service."
echo ""

# Step 5: Summary
echo -e "${BLUE}Step 5: Configuration Summary${NC}"
echo ""
echo "Web App (Vercel/.env.local):"
echo "  ✅ SUPABASE_URL: ${WEB_SUPABASE_URL:0:50}..."
echo "  ✅ SUPABASE_ANON_KEY: ${WEB_ANON_KEY:0:30}..."
echo ""
echo "iOS App (Config.plist):"
if [ -n "$IOS_SUPABASE_URL" ]; then
    echo "  ✅ SUPABASE_URL: ${IOS_SUPABASE_URL:0:50}..."
else
    echo "  ⚠️  SUPABASE_URL: Not found"
fi
if [ -n "$IOS_ANON_KEY" ]; then
    echo "  ✅ SUPABASE_ANON_KEY: ${IOS_ANON_KEY:0:30}..."
else
    echo "  ⚠️  SUPABASE_ANON_KEY: Not found"
fi
echo ""
echo "Backend (Railway):"
echo "  ⚠️  Check manually in Railway Dashboard → Variables"
echo "  Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY"
echo ""

echo -e "${BLUE}Next Steps:${NC}"
echo ""
echo "1. ✅ Apply migration: $MIGRATION_FILE"
echo "2. ✅ Verify function exists (SQL check above)"
echo "3. ✅ Refresh PostgREST cache (if needed)"
echo "4. ✅ Restart Railway backend"
echo "5. ✅ Test: Create export → Check Railway logs for 'claimed export job via RPC'"
echo ""
echo -e "${GREEN}📚 See DATABASE_SYNC_GUIDE.md for complete instructions${NC}"
echo ""
