#!/bin/bash

# RiskMate Database Sync Verification Script
# Verifies that web, iOS, and backend all point to the same Supabase project

echo "🔍 RiskMate Database Sync Verification"
echo "======================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo -e "${RED}❌ .env.local not found${NC}"
    echo "Create it with your Supabase credentials"
    exit 1
fi

# Extract values from .env.local
WEB_SUPABASE_URL=$(grep "NEXT_PUBLIC_SUPABASE_URL" .env.local | cut -d '=' -f2 | tr -d '"' | tr -d "'" | xargs)
WEB_ANON_KEY=$(grep "NEXT_PUBLIC_SUPABASE_ANON_KEY" .env.local | cut -d '=' -f2 | tr -d '"' | tr -d "'" | xargs)

# Check iOS Config.plist
IOS_CONFIG="mobile/Riskmate/Riskmate/Config.plist"
if [ ! -f "$IOS_CONFIG" ]; then
    echo -e "${YELLOW}⚠️  iOS Config.plist not found at $IOS_CONFIG${NC}"
    echo "Skipping iOS verification..."
    IOS_CONFIG_EXISTS=false
else
    IOS_CONFIG_EXISTS=true
    # Extract from plist (requires plutil on macOS)
    if command -v plutil &> /dev/null; then
        IOS_SUPABASE_URL=$(plutil -extract SUPABASE_URL raw "$IOS_CONFIG" 2>/dev/null || echo "")
        IOS_ANON_KEY=$(plutil -extract SUPABASE_ANON_KEY raw "$IOS_CONFIG" 2>/dev/null || echo "")
    else
        echo -e "${YELLOW}⚠️  plutil not found. Install Xcode Command Line Tools${NC}"
        IOS_CONFIG_EXISTS=false
    fi
fi

echo "📋 Verification Results:"
echo ""

# Verify web config
if [ -z "$WEB_SUPABASE_URL" ]; then
    echo -e "${RED}❌ Web: NEXT_PUBLIC_SUPABASE_URL not set${NC}"
else
    echo -e "${GREEN}✅ Web: SUPABASE_URL = ${WEB_SUPABASE_URL:0:30}...${NC}"
fi

if [ -z "$WEB_ANON_KEY" ]; then
    echo -e "${RED}❌ Web: NEXT_PUBLIC_SUPABASE_ANON_KEY not set${NC}"
else
    echo -e "${GREEN}✅ Web: ANON_KEY = ${WEB_ANON_KEY:0:20}...${NC}"
fi

# Verify iOS config
if [ "$IOS_CONFIG_EXISTS" = true ]; then
    if [ -z "$IOS_SUPABASE_URL" ]; then
        echo -e "${RED}❌ iOS: SUPABASE_URL not set in Config.plist${NC}"
    else
        echo -e "${GREEN}✅ iOS: SUPABASE_URL = ${IOS_SUPABASE_URL:0:30}...${NC}"
    fi
    
    if [ -z "$IOS_ANON_KEY" ]; then
        echo -e "${RED}❌ iOS: SUPABASE_ANON_KEY not set in Config.plist${NC}"
    else
        echo -e "${GREEN}✅ iOS: ANON_KEY = ${IOS_ANON_KEY:0:20}...${NC}"
    fi
fi

echo ""
echo "🔗 Consistency Check:"
echo ""

# Compare URLs
if [ -n "$WEB_SUPABASE_URL" ] && [ -n "$IOS_SUPABASE_URL" ]; then
    if [ "$WEB_SUPABASE_URL" = "$IOS_SUPABASE_URL" ]; then
        echo -e "${GREEN}✅ Web and iOS use the same SUPABASE_URL${NC}"
    else
        echo -e "${RED}❌ Web and iOS use DIFFERENT SUPABASE_URL${NC}"
        echo "   Web:  $WEB_SUPABASE_URL"
        echo "   iOS:  $IOS_SUPABASE_URL"
    fi
fi

# Compare anon keys
if [ -n "$WEB_ANON_KEY" ] && [ -n "$IOS_ANON_KEY" ]; then
    if [ "$WEB_ANON_KEY" = "$IOS_ANON_KEY" ]; then
        echo -e "${GREEN}✅ Web and iOS use the same SUPABASE_ANON_KEY${NC}"
    else
        echo -e "${RED}❌ Web and iOS use DIFFERENT SUPABASE_ANON_KEY${NC}"
        echo "   This will cause data sync issues!"
    fi
fi

echo ""
echo "📝 Backend Verification:"
echo ""
echo "⚠️  Backend config must be checked manually in Railway dashboard:"
echo "   1. Go to Railway → Your Service → Variables"
echo "   2. Verify SUPABASE_URL matches web/iOS"
echo "   3. Verify SUPABASE_SERVICE_ROLE_KEY is set (different from anon key)"
echo ""

echo "📋 Migration Status:"
echo ""
echo "⚠️  Check if claim_export_job function exists:"
echo "   Run this in Supabase SQL Editor:"
echo ""
echo "   SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)"
echo "   FROM pg_proc p"
echo "   JOIN pg_namespace n ON n.oid = p.pronamespace"
echo "   WHERE p.proname = 'claim_export_job';"
echo ""

if [ -n "$WEB_SUPABASE_URL" ] && [ -n "$IOS_SUPABASE_URL" ] && [ "$WEB_SUPABASE_URL" = "$IOS_SUPABASE_URL" ]; then
    if [ -n "$WEB_ANON_KEY" ] && [ -n "$IOS_ANON_KEY" ] && [ "$WEB_ANON_KEY" = "$IOS_ANON_KEY" ]; then
        echo -e "${GREEN}✅ All checks passed! Web and iOS are configured to use the same database.${NC}"
        exit 0
    else
        echo -e "${RED}❌ Configuration mismatch detected. Fix before deploying.${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ Configuration mismatch detected. Fix before deploying.${NC}"
    exit 1
fi
