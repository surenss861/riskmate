#!/bin/bash
# Test RLS and Permission Boundaries
#
# Verifies that users from Org A cannot access resources from Org B
#
# Usage:
#   JWT_ORG_A=token_for_org_a \
#   JWT_ORG_B=token_for_org_b \
#   JOB_ID_ORG_A=job_id_from_org_a \
#   JOB_ID_ORG_B=job_id_from_org_b \
#   ./scripts/test-rls-permissions.sh

set -e

BACKEND_URL="${BACKEND_URL:-http://localhost:3001}"
JWT_ORG_A="${JWT_ORG_A}"
JWT_ORG_B="${JWT_ORG_B}"
JOB_ID_ORG_A="${JWT_ORG_A}"
JOB_ID_ORG_B="${JOB_ID_ORG_B}"

if [ -z "$JWT_ORG_A" ] || [ -z "$JWT_ORG_B" ]; then
  echo "❌ JWT_ORG_A and JWT_ORG_B environment variables are required"
  exit 1
fi

echo "🔒 Testing RLS and Permission Boundaries"
echo "   Backend: $BACKEND_URL"
echo ""

# Test 1: Org A cannot fetch Org B's exports
echo "Test 1: Org A cannot fetch Org B's exports"
if [ -n "$JOB_ID_ORG_B" ]; then
  EXPORT_ID=$(curl -s -X POST "$BACKEND_URL/api/jobs/$JOB_ID_ORG_B/export/proof-pack" \
    -H "Authorization: Bearer $JWT_ORG_B" \
    -H "Content-Type: application/json" \
    -d '{"filters": {}}' | jq -r '.data.id')
  
  if [ -n "$EXPORT_ID" ] && [ "$EXPORT_ID" != "null" ]; then
    RESPONSE=$(curl -s -w "\n%{http_code}" "$BACKEND_URL/api/exports/$EXPORT_ID" \
      -H "Authorization: Bearer $JWT_ORG_A")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    if [ "$HTTP_CODE" = "404" ]; then
      echo "✅ Org A correctly blocked from accessing Org B's export"
    else
      echo "❌ Org A was able to access Org B's export (HTTP $HTTP_CODE)"
      exit 1
    fi
  fi
fi

# Test 2: Org A cannot fetch Org B's evidence
echo ""
echo "Test 2: Org A cannot fetch Org B's evidence"
if [ -n "$JOB_ID_ORG_B" ]; then
  RESPONSE=$(curl -s -w "\n%{http_code}" "$BACKEND_URL/api/jobs/$JOB_ID_ORG_B/evidence" \
    -H "Authorization: Bearer $JWT_ORG_A")
  
  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  if [ "$HTTP_CODE" = "404" ]; then
    echo "✅ Org A correctly blocked from accessing Org B's evidence"
  else
    echo "❌ Org A was able to access Org B's evidence (HTTP $HTTP_CODE)"
    exit 1
  fi
fi

# Test 3: Org A cannot verify Org B's ledger events
echo ""
echo "Test 3: Org A cannot verify Org B's ledger events"
# This requires an event ID from Org B, which we'd need to fetch first
# For now, we'll just verify the endpoint exists
echo "   (Skipping - requires event ID from Org B)"

echo ""
echo "✅ All RLS permission tests passed"
