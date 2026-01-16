#!/bin/bash

# RiskMate Supabase Sync Verification Script
# Checks that web, iOS, and backend all use the same Supabase project

set -e

echo "🔍 RiskMate Supabase Sync Verification"
echo "======================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track if all checks pass
ALL_PASS=true

# Check 1: Web Supabase URL
echo "📋 Check 1: Web Supabase URL"
if [ -f .env.local ]; then
    WEB_URL=$(grep "^NEXT_PUBLIC_SUPABASE_URL=" .env.local | cut -d'=' -f2 | tr -d '"' | tr -d "'" | xargs)
    if [ -z "$WEB_URL" ]; then
        echo -e "${RED}❌ NEXT_PUBLIC_SUPABASE_URL not found in .env.local${NC}"
        ALL_PASS=false
    else
        echo -e "${GREEN}✅ Web URL: ${WEB_URL}${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  .env.local not found (check Vercel env vars)${NC}"
    WEB_URL=""
fi
echo ""

# Check 2: iOS Supabase URL
echo "📋 Check 2: iOS Supabase URL"
IOS_CONFIG="mobile/Riskmate/Riskmate/Config.plist"
if [ -f "$IOS_CONFIG" ]; then
    IOS_URL=$(grep -A1 "SUPABASE_URL" "$IOS_CONFIG" | tail -1 | sed 's/.*<string>\(.*\)<\/string>.*/\1/' | xargs)
    if [ -z "$IOS_URL" ] || [[ "$IOS_URL" == *"YOUR_SUPABASE"* ]] || [[ "$IOS_URL" == *"xxxxx"* ]]; then
        echo -e "${RED}❌ iOS SUPABASE_URL is missing or still a placeholder${NC}"
        ALL_PASS=false
    else
        echo -e "${GREEN}✅ iOS URL: ${IOS_URL}${NC}"
    fi
else
    echo -e "${RED}❌ iOS Config.plist not found at $IOS_CONFIG${NC}"
    ALL_PASS=false
    IOS_URL=""
fi
echo ""

# Check 3: Compare URLs
echo "📋 Check 3: URL Consistency"
if [ -n "$WEB_URL" ] && [ -n "$IOS_URL" ]; then
    if [ "$WEB_URL" = "$IOS_URL" ]; then
        echo -e "${GREEN}✅ Web and iOS URLs match!${NC}"
    else
        echo -e "${RED}❌ URL MISMATCH!${NC}"
        echo -e "${RED}   Web:  $WEB_URL${NC}"
        echo -e "${RED}   iOS:  $IOS_URL${NC}"
        ALL_PASS=false
    fi
else
    echo -e "${YELLOW}⚠️  Cannot compare (one or both URLs missing)${NC}"
    ALL_PASS=false
fi
echo ""

# Check 4: Backend URL (if Railway CLI available)
echo "📋 Check 4: Backend Supabase URL"
if command -v railway &> /dev/null; then
    echo "Checking Railway environment variables..."
    BACKEND_URL=$(railway variables 2>/dev/null | grep "SUPABASE_URL" | cut -d'=' -f2 | xargs || echo "")
    if [ -n "$BACKEND_URL" ]; then
        echo -e "${GREEN}✅ Backend URL: ${BACKEND_URL}${NC}"
        if [ -n "$WEB_URL" ] && [ "$WEB_URL" != "$BACKEND_URL" ]; then
            echo -e "${RED}❌ Backend URL doesn't match web!${NC}"
            ALL_PASS=false
        fi
    else
        echo -e "${YELLOW}⚠️  SUPABASE_URL not found in Railway (check dashboard)${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Railway CLI not installed (check Railway dashboard manually)${NC}"
    echo "   Go to Railway → Your Service → Variables → Check SUPABASE_URL"
fi
echo ""

# Check 5: iOS Config validation
echo "📋 Check 5: iOS Config Validation"
if [ -f "$IOS_CONFIG" ]; then
    IOS_ANON_KEY=$(grep -A1 "SUPABASE_ANON_KEY" "$IOS_CONFIG" | tail -1 | sed 's/.*<string>\(.*\)<\/string>.*/\1/' | xargs)
    if [ -z "$IOS_ANON_KEY" ] || [[ "$IOS_ANON_KEY" == *"YOUR_SUPABASE"* ]] || [ ${#IOS_ANON_KEY} -lt 50 ]; then
        echo -e "${RED}❌ iOS SUPABASE_ANON_KEY is missing or invalid${NC}"
        ALL_PASS=false
    else
        echo -e "${GREEN}✅ iOS anon key is set (length: ${#IOS_ANON_KEY})${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Cannot check (Config.plist not found)${NC}"
fi
echo ""

# Summary
echo "======================================"
if [ "$ALL_PASS" = true ]; then
    echo -e "${GREEN}✅ All checks passed!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Verify user auth identity matches (see DATA_SYNC_VERIFICATION.md)"
    echo "2. Verify organization_id matches (see DATA_SYNC_VERIFICATION.md)"
    echo "3. Test RLS policies (see DATA_SYNC_VERIFICATION.md)"
else
    echo -e "${RED}❌ Some checks failed${NC}"
    echo ""
    echo "Fix the issues above, then run this script again."
    exit 1
fi
