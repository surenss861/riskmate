#!/bin/bash

# Fix claim_export_job RPC Function
# This script helps you verify and fix the missing RPC function

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 Fix claim_export_job RPC Function${NC}"
echo "========================================"
echo ""

MIGRATION_FILE="supabase/migrations/20251203000004_export_worker_atomic_claim.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo -e "${RED}❌ Migration file not found: $MIGRATION_FILE${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Migration file found${NC}"
echo ""

echo -e "${BLUE}Step 1: Verify Function Exists${NC}"
echo ""
echo "Run this SQL in Supabase SQL Editor:"
echo ""
echo -e "${GREEN}SELECT"
echo "  n.nspname AS schema,"
echo "  p.proname AS function_name,"
echo "  pg_get_function_identity_arguments(p.oid) AS args"
echo "FROM pg_proc p"
echo "JOIN pg_namespace n ON n.oid = p.pronamespace"
echo "WHERE n.nspname = 'public'"
echo "  AND p.proname = 'claim_export_job';${NC}"
echo ""
echo "Expected result:"
echo "  schema | function_name     | args"
echo "  -------|-------------------|------------------"
echo "  public | claim_export_job  | p_max_concurrent integer DEFAULT 3"
echo ""

echo -e "${BLUE}Step 2: Apply Migration (if function doesn't exist)${NC}"
echo ""
echo "1. Go to https://app.supabase.com → Your Project → SQL Editor"
echo "2. Open: $MIGRATION_FILE"
echo "3. Copy entire contents → Paste in SQL Editor → Run"
echo ""

echo -e "${BLUE}Step 3: Refresh PostgREST Schema Cache${NC}"
echo ""
echo "After applying migration, run this SQL:"
echo ""
echo -e "${GREEN}SELECT pg_notify('pgrst', 'reload schema');${NC}"
echo ""

echo -e "${BLUE}Step 4: Verify Function Signature Matches Code${NC}"
echo ""
echo "Your code calls:"
echo -e "${GREEN}supabase.rpc('claim_export_job', { p_max_concurrent: 3 })${NC}"
echo ""
echo "Function must accept:"
echo "  - Parameter name: p_max_concurrent"
echo "  - Parameter type: INTEGER"
echo "  - Default value: 3 (optional)"
echo ""

echo -e "${BLUE}Step 5: Restart Railway Backend${NC}"
echo ""
echo "After applying migration and refreshing cache:"
echo "1. Go to Railway Dashboard"
echo "2. Select your backend service"
echo "3. Redeploy (or wait for auto-deploy)"
echo ""

echo -e "${BLUE}Step 6: Verify It's Working${NC}"
echo ""
echo "Check Railway logs for:"
echo -e "${GREEN}✅ [ExportWorker] claimed export job via RPC${NC}"
echo -e "${RED}❌ Should NOT see: 'Could not find the function public.claim_export_job'${NC}"
echo ""

echo -e "${YELLOW}📝 Quick Reference:${NC}"
echo ""
echo "Migration file: $MIGRATION_FILE"
echo "Verification SQL: scripts/verify-claim-export-job.sql"
echo "Full guide: FINAL_VERIFICATION.md"
echo ""
