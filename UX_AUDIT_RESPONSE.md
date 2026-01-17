# UX Audit Response & Action Plan

## Current iOS App State (Documented)

### Navigation Structure
- **iPhone**: TabView with 4 tabs
  1. **Operations** (briefcase.fill) - Shows DashboardView or ExecutiveViewRedesigned
  2. **Ledger** (list.bullet.rectangle) - AuditFeedView
  3. **Work Records** (doc.text.fill) - JobsListView
  4. **Settings** (gearshape.fill) - AccountView

- **iPad**: NavigationSplitView with sidebar navigation

### Evidence Capture (Already Exists!)
- **Component**: `RMEvidenceCapture.swift` - Full-screen evidence capture
- **Features**: Camera, photo picker, phase selection (before/during/after), evidence type tagging
- **Integration**: Used in JobDetailView → EvidenceTab
- **Upload**: Uses `BackgroundUploadManager` for offline support

### Job Detail Structure
- **Tabs**: Overview, Hazards, Controls, Evidence, Exports
- **Evidence Badge**: Shows requirements (required vs uploaded)
- **Navigation**: Full NavigationStack with toolbar

## Recommended Action Plan

### Option 1: Mobile UX Audit (Public Pages) ✅ Ready
**Status**: Can proceed immediately
**Focus**: riskmate.dev mobile site improvements

**Quick Wins** (Can implement now):
1. **Sticky Header** → Simplify to Logo + "Get Started" + Hamburger
2. **Hero Section** → Add trust strip under CTAs
3. **Proof Moments** → Convert to swipeable carousel
4. **Long Sections** → Convert to accordion/expandable
5. **Pricing** → Show 2 cards by default, expandable Business tier

**Action**: Say "Audit the mobile site" to proceed

### Option 2: Authenticated UX via Screenshots ✅ Ready
**Status**: Need screenshots/recording OR can infer from code
**Focus**: Logged-in flows optimization

**What I can do now** (based on code review):
1. **Evidence Capture** → Convert from full-screen to bottom sheet
2. **OperationsView** → Simplify to field-first dashboard
3. **Job Detail** → Make evidence tab primary, add quick capture CTA
4. **Launch Flow** → Add splash screen, polish loading states

**What I need** (for precision):
- Screenshots of: Home/Dashboard, Jobs list, Job detail, Evidence capture
- OR 30-60s screen recording of: Launch → Login → Dashboard → Job → Evidence

**Action**: Provide screenshots/recording OR say "Start iOS improvements" to proceed with code-based changes

### Option 3: iOS ↔ Web Parity Check ✅ Ready
**Status**: Can proceed with code analysis
**Focus**: Align mobile UX with backend architecture

**Current Alignment**:
- ✅ JobsStore (shared state) - Good
- ✅ Dashboard summary endpoint - Good
- ✅ Evidence capture exists - Good
- ⚠️ OperationsView shows full DashboardView - May be too heavy for mobile

**Recommended Changes**:
1. **OperationsView** → Show simplified "Field Dashboard" instead of full DashboardView
2. **Evidence Capture** → Make it a bottom sheet, accessible from anywhere
3. **Quick Actions** → Add FAB for "New Job" and "Capture Evidence"
4. **Jobs List** → Add swipe actions (Pin, Complete, Add Evidence)

**Action**: Say "Align iOS with field-first UX" to proceed

## Immediate Next Steps (Pick One)

### A) Mobile Site Improvements (Fastest)
**Command**: "Audit the mobile site"
**Time**: 1-2 hours
**Impact**: Better conversion, cleaner mobile experience

### B) iOS Field-First Improvements (Highest Value)
**Command**: "Start iOS improvements"
**Time**: 2-4 hours
**Impact**: Better field workflows, evidence capture optimization

### C) Provide Screenshots for Precision
**Action**: Share 4 screenshots or recording
**Time**: 5 minutes (your time) + 1-2 hours (implementation)
**Impact**: Most precise, targeted improvements

## What I Recommend (Based on Your Goals)

Since you mentioned:
> "Yes: we should focus iOS on fast field workflows (capture → attach → submit)"

**I recommend**: **Option B - iOS Field-First Improvements**

**Priority Order**:
1. **Evidence Capture Bottom Sheet** (Convert full-screen to sheet, add quick access)
2. **OperationsView Simplification** (Field dashboard instead of analytics)
3. **Job Detail Evidence CTA** (Make "Add Evidence" prominent)
4. **Splash Screen** (Polish launch experience)
5. **Quick Actions** (FAB for common actions)

**Estimated Time**: 2-3 hours
**Impact**: Users can capture evidence faster, less cognitive load, better field UX

## Ready to Proceed?

**Say one of**:
- "Audit the mobile site" → Mobile web improvements
- "Start iOS improvements" → Field-first iOS optimizations
- "Align iOS with field-first UX" → Full parity check + improvements
- Or provide screenshots/recording for precision work

I'll start implementing immediately based on your choice!
