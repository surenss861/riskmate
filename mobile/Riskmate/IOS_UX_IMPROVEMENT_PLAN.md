# iOS UX Improvement Plan

## Current Navigation Structure

### iPhone (TabView - 4 tabs)
1. **Operations** (briefcase.fill) - First tab
2. **Ledger** (list.bullet.rectangle) - Second tab
3. **Work Records** (doc.text.fill) - Third tab
4. **Settings** (gearshape.fill) - Fourth tab

### iPad (NavigationSplitView)
- Sidebar with sections: Main, Audit, Team, Settings
- Detail view based on selection

## Recommended Improvements (Prioritized)

### Phase 1: Field-First Workflows (High Priority)

#### 1.1 Evidence Capture Flow (Killer Feature)
**Current State**: Unknown - needs investigation
**Target State**:
- Bottom sheet evidence capture
- Photo, Video, Note, File upload
- Auto-tag to job, location, timestamp
- Offline queue with retry
- "Uploading..." indicator

**Implementation**:
- Create `EvidenceCaptureSheet.swift`
- Integrate with `BackgroundUploadManager`
- Add to job detail view as primary CTA

#### 1.2 Home/Operations as "Field Dashboard"
**Current State**: OperationsView (needs review)
**Target State**:
- Search bar at top
- "My Active Jobs" (top 3-5)
- Quick actions:
  - "New Job"
  - "Scan / Attach Evidence"
  - "Report Hazard"
- Optional: 2-3 KPI chips max

**Changes**:
- Simplify OperationsView
- Remove heavy analytics
- Focus on actionable items

#### 1.3 Launch + Auth Flow Polish
**Current State**: Has `isBootstrapped` gate
**Target State**:
- Clean splash screen (0.3-1.0s)
- No flicker between states
- Clear loading indicators

**Changes**:
- Add `SplashView.swift`
- Ensure sequential state transitions
- Visual feedback for all states

### Phase 2: Jobs List + Detail UX (Medium Priority)

#### 2.1 Jobs List Improvements
**Target State**:
- Big tap targets (44px+)
- Risk badge + status pill
- Secondary line: client + location
- Swipe actions: Pin, Mark complete, Add evidence

**Changes**:
- Update `RMJobRow` component
- Add swipe actions
- Improve visual hierarchy

#### 2.2 Job Detail Improvements
**Target State**:
- Top: Status + Risk + Readiness
- Tabs/Sections:
  - Evidence (primary)
  - Hazards
  - Activity
  - Checklist/Requirements
- "Missing Evidence" as proactive CTA

**Changes**:
- Restructure `JobDetailView`
- Add evidence section as primary
- Make "Add Evidence" prominent

### Phase 3: Navigation Optimization (Low Priority)

#### 3.1 Tab Bar Simplification
**Consider**:
- Keep 4 tabs or reduce to 3?
- Rename "Operations" to "Home"?
- Make "Work Records" more prominent?

#### 3.2 Quick Actions
**Add**:
- Floating action button (FAB) for "New Job"
- Quick evidence capture from anywhere
- Shortcuts to common actions

## Implementation Checklist

### Immediate (Can do now)
- [ ] Create `EvidenceCaptureSheet.swift` component
- [ ] Add evidence capture button to job detail
- [ ] Simplify OperationsView (remove heavy analytics)
- [ ] Add splash screen
- [ ] Improve job row tap targets and swipe actions

### Needs Screenshots/Recording
- [ ] Review current OperationsView layout
- [ ] Review current JobDetailView layout
- [ ] Review evidence capture UI (if exists)
- [ ] Review overall information density

### Future Enhancements
- [ ] Offline-first evidence queue
- [ ] GPS metadata auto-tagging
- [ ] Quick actions menu
- [ ] Field-optimized dashboard

## Questions for User

1. **Evidence Capture**: Does evidence capture UI currently exist? Where is it?
2. **OperationsView**: What does it currently show? (Dashboard? Analytics? Jobs?)
3. **Priority**: Which is more important - evidence capture or dashboard simplification?
4. **Navigation**: Should we keep 4 tabs or simplify to 3?

## Next Steps

1. User provides screenshots/recording OR
2. Start implementing evidence capture flow (highest value)
3. Simplify OperationsView based on field-first principles
4. Add splash screen for better launch UX
