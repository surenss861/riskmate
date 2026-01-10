# Phase 3B: Saved View Cards Polish

**Last Updated:** January 10, 2026  
**Status:** Planning → Implementation  
**Goal:** Make saved view cards feel "defensibility-first" with pack previews and integrity indicators

---

## Scope (No New Features)

### 1. PackCard Preview Snippet
- **Location:** Bottom of each saved view card (above CSV export button)
- **Display:**
  - If last pack exists: Compact PackCard preview showing:
    - Pack ID (truncated: `pack_abc1...`)
    - Generated date (relative time: "2 hours ago")
    - Integrity badge (verified/unverified)
    - Click to open Pack History drawer
  - If no pack exists: "No proof packs generated for this view yet" (subtle text)
- **Data Source:** Query `audit_log` for last `export.proof_pack.generated` event matching view filters
- **Styling:** Compact, non-intrusive, doesn't break CTA hierarchy

### 2. Integrity Indicator
- **Location:** Top-right of each saved view card (near "Active" badge area)
- **Display:**
  - IntegrityBadge component (compact)
  - Status based on view's ledger integrity:
    - `verified` - All events in view have verified integrity
    - `unverified` - Some events not yet verified
    - `mismatch` - Integrity mismatch detected
    - `pending` - Verification in progress
- **Data Source:** Aggregate integrity status from events matching view filters
- **Styling:** Small badge, doesn't compete with view title/icon

### 3. CTA Discipline
- **Primary Action:** 1 orange button per card (if applicable)
- **Secondary Action:** CSV export (always available, secondary variant)
- **Advanced Actions:** All other actions stay in Advanced/Integrations menu
- **No Changes:** Current CTA hierarchy is already correct ✅

---

## Implementation Plan

### Step 1: Query Pack History Per View
- **New Hook/Function:** `useViewPackHistory(viewId: SavedView)`
- **Query:** `audit_log` table filtered by:
  - `event_name = 'export.proof_pack.generated'`
  - `metadata.view` matches view ID (if stored)
  - OR match by `metadata.filters` (time_range, category, etc.)
- **Returns:** Last pack for this view (if exists) + integrity status

### Step 2: Create Compact PackCard Component
- **New Component:** `PackCardPreview` (or extend `PackCard` with `compact` prop)
- **Props:** Same as PackCard but renders in compact mode:
  - Single line: Pack ID + relative time + IntegrityBadge
  - Hover: Show tooltip with full details
  - Click: Opens Pack History drawer with view filter applied
- **Styling:** 
  - Subtle background (`bg-white/5`)
  - Small text (`text-xs`)
  - Minimal padding (`p-2`)

### Step 3: Add Integrity Aggregation
- **New Function:** `getViewIntegrityStatus(viewId: SavedView, events: AuditEvent[])`
- **Logic:**
  - Filter events matching view
  - Check integrity status of each event
  - Aggregate: If all verified → `verified`, if any mismatch → `mismatch`, etc.
- **Returns:** `IntegrityStatus` for the view

### Step 4: Update SavedViewCards Component
- **Add State:** `packHistory` per view (fetched on mount or when view selected)
- **Add State:** `viewIntegrityStatus` per view (computed from events)
- **Update Render:**
  - Add IntegrityBadge at top-right (if integrity status available)
  - Add PackCardPreview at bottom (if pack exists)
  - Add empty state text if no pack exists
- **Keep CTA Discipline:** No changes to button hierarchy ✅

---

## Data Model

### Pack Generation Event (Existing)
```typescript
{
  event_name: 'export.proof_pack.generated',
  metadata: {
    pack_id: string,
    time_range: string,
    site_ids?: string[],
    view?: SavedView, // Should be stored for view-specific packs
    filters?: Record<string, any>,
    generated_at: string,
    summary: string,
  }
}
```

### View Pack History Response
```typescript
{
  lastPack: {
    packId: string,
    packType: PackType,
    generatedAt: string,
    generatedBy: string,
    filters: Record<string, any>,
    integrityStatus: IntegrityStatus,
  } | null,
  viewIntegrityStatus: IntegrityStatus,
}
```

---

## Files to Modify

1. **`components/audit/SavedViewCards.tsx`**
   - Add pack history fetching
   - Add integrity status computation
   - Add PackCardPreview rendering
   - Add IntegrityBadge rendering

2. **`components/shared/PackCard.tsx`** (optional)
   - Add `compact` prop if not already exists
   - Or create `PackCardPreview` component

3. **`lib/hooks/useViewPackHistory.ts`** (new)
   - Hook to fetch last pack for a view
   - Cache results per view

4. **`lib/utils/viewIntegrity.ts`** (new)
   - Function to compute view integrity status
   - Aggregate event integrity statuses

---

## Design Constraints

### CTA Hierarchy (Unchanged)
1. **Primary Action:** Orange button (Assign, Resolve, Create Corrective Action, etc.)
2. **Secondary Action:** Secondary button (Resolve, Close Incident, Flag Suspicious)
3. **CSV Export:** Always available, secondary variant
4. **Pack Generation:** Stays in Advanced/Integrations menu (no change)

### Visual Hierarchy
- View icon + title (largest)
- IntegrityBadge (small, top-right)
- Description (medium)
- PackCardPreview (compact, subtle)
- Primary action button (orange, prominent)
- Secondary action button (if exists, secondary variant)
- CSV export button (secondary variant, always last)

### Responsive
- Mobile: Cards stack, pack preview stays compact
- Tablet: Grid adjusts, pack preview stays compact
- Desktop: Full grid, pack preview stays compact

---

## Acceptance Criteria

- [ ] Each saved view card shows IntegrityBadge (if data available)
- [ ] Each saved view card shows PackCardPreview if pack exists
- [ ] Empty state text shows if no pack exists
- [ ] PackCardPreview is compact and doesn't break layout
- [ ] CTA hierarchy remains unchanged (1 primary, CSV secondary)
- [ ] Click on PackCardPreview opens Pack History drawer
- [ ] Mobile viewport: No overflow, layout stays clean
- [ ] Data fetching: Handles loading states gracefully
- [ ] Error handling: Shows fallback if pack history fetch fails

---

## Testing Checklist

- [ ] Render all 5 saved view cards
- [ ] Check IntegrityBadge appears for each view
- [ ] Check PackCardPreview appears if pack exists
- [ ] Check empty state text appears if no pack exists
- [ ] Click PackCardPreview → opens Pack History drawer
- [ ] Verify CTA hierarchy unchanged (primary → secondary → CSV)
- [ ] Test on mobile viewport (iPhone width)
- [ ] Test with real data (generate pack, verify it shows)
- [ ] Test error states (network failure, no data)

---

**Phase 3B Status:** Ready for Implementation

