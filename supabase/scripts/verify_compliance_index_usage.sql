-- Verify that get_compliance_rate_kpis and get_trends_compliance_buckets use idx_signatures_org_signed_at.
-- Run in Supabase SQL Editor after migration 20260230100050 has been applied.
-- Replace the UUID and timestamps below with real values from your org if desired.

-- 1) get_compliance_rate_kpis: check that signatures scan uses idx_signatures_org_signed_at
EXPLAIN (COSTS OFF, FORMAT TEXT)
SELECT * FROM get_compliance_rate_kpis(
  '00000000-0000-0000-0000-000000000000'::uuid,
  '2025-01-01'::timestamptz,
  '2025-12-31'::timestamptz
);

-- 2) get_trends_compliance_buckets: same check
EXPLAIN (COSTS OFF, FORMAT TEXT)
SELECT * FROM get_trends_compliance_buckets(
  '00000000-0000-0000-0000-000000000000'::uuid,
  '2025-01-01'::timestamptz,
  '2025-12-31'::timestamptz,
  'month'
);

-- Look for "Index Scan using idx_signatures_org_signed_at" or "Index Only Scan using idx_signatures_org_signed_at"
-- in the plans for the signatures subqueries.
