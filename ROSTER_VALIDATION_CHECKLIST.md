# Job Roster UX Validation Checklist

## Step 1: Smoke Test Roster UX (5 minutes)

### Search
- [ ] Type in search box → results update after 300ms debounce
- [ ] URL updates with `?q=...` parameter
- [ ] Page resets to 1 when search changes
- [ ] Clear search → results reset, URL param removed

### Sort
- [ ] Change sort dropdown → URL updates with `?sort=...`
- [ ] Page resets to 1 when sort changes
- [ ] All sort options work: `blockers_desc`, `readiness_asc`, `readiness_desc`, `risk_desc`, `newest`, `oldest`
- [ ] Default sort is `blockers_desc` (no param in URL)

### Pagination
- [ ] Change page size → URL updates with `?page_size=...`
- [ ] "Showing X–Y of Z" count is correct
- [ ] Prev/Next buttons work correctly
- [ ] "Page X of Y" displays correctly
- [ ] Pagination only shows when `total_pages > 1`

### URL Shareability
- [ ] Copy link with `?q=test&sort=readiness_asc&page=2&page_size=25&time_range=30d&status=in_progress&risk_level=high`
- [ ] Open in new tab → same view restored exactly
- [ ] All filters, search, sort, pagination preserved

## Step 2: Correctness Checks (Audit-Defensible)

### Job with 0 Mitigations
- [ ] API returns:
  ```json
  {
    "readiness_score": null,
    "readiness_empty_reason": "no_mitigations",
    "readiness_basis": "mitigation_completion_rate_v1",
    "mitigations_total": 0,
    "mitigations_complete": 0
  }
  ```
- [ ] UI shows "No mitigations" (NOT "0%")
- [ ] No readiness percentage displayed

### Job with Mitigations
- [ ] API returns correct `mitigations_total` and `mitigations_complete`
- [ ] `readiness_score = (mitigations_complete / mitigations_total) * 100`
- [ ] UI shows correct percentage
- [ ] No drift between UI calculation and API response

### Sorting with Null Scores
- [ ] Jobs with `readiness_score: null` appear last in `readiness_asc` sort
- [ ] Jobs with `readiness_score: null` appear last in `readiness_desc` sort
- [ ] Null scores don't break sorting

## Step 3: Performance + Stability

### Debounce
- [ ] Rapid typing doesn't spam API requests
- [ ] Only final query after 300ms triggers request
- [ ] Loading state appears during fetch

### Loading States
- [ ] Skeleton loader appears during data fetch
- [ ] No layout jumpiness when data loads
- [ ] Smooth transitions between states

### Empty States
- [ ] Zero results with filters → "No jobs match your filters" + "Clear Filters" button
- [ ] Zero results without filters → "No active jobs" + "Create Job" button
- [ ] No dead ends (always a CTA)

## Step 4: Edge Cases

### Missing Evidence Filter
- [ ] `?missing_evidence=true` filters correctly
- [ ] Only jobs without evidence shown
- [ ] URL param preserved on navigation

### Time Range
- [ ] `time_range` parameter preserved in all links
- [ ] Changing time range updates job list
- [ ] Time range syncs with URL

### Large Result Sets
- [ ] 100+ jobs paginate correctly
- [ ] No performance degradation
- [ ] All pages accessible

## API Contract Validation

### Readiness Fields
- [ ] `readiness_score`: `number | null` (null when no mitigations)
- [ ] `readiness_basis`: `"mitigation_completion_rate_v1"` (always present)
- [ ] `readiness_empty_reason`: `"no_mitigations" | null`
- [ ] `mitigations_total`: `number` (always present, 0 if none)
- [ ] `mitigations_complete`: `number` (always present, 0 if none)
- [ ] `blockers_count`: `number` (mitigations_total - mitigations_complete)
- [ ] `missing_evidence`: `boolean`
- [ ] `pending_attestations`: `number` (placeholder: 0)

### Pagination Response
- [ ] `pagination.page`: current page number
- [ ] `pagination.page_size`: items per page
- [ ] `pagination.total`: total items
- [ ] `pagination.total_pages`: total pages (calculated)

## Production Readiness

- [ ] All TypeScript types match API response
- [ ] No console errors or warnings
- [ ] ESLint passes
- [ ] Build succeeds
- [ ] No memory leaks (check React DevTools)
- [ ] URL state persists across page refresh
- [ ] Deep links work from external sources

