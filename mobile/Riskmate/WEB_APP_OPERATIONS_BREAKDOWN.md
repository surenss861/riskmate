# RiskMate Web App - Operations Pages Complete Breakdown

## Design System Foundation

### Visual Language
- **Background**: Pure dark (`#0A0A0A`) - no gradients, clean and minimal
- **Glass Cards**: `bg-white/[0.03]`, `border-white/10`, `backdrop-blur-xl`, `rounded-3xl`
- **Accent Color**: Orange (`#F97316`) for CTAs, active states, highlights
- **Typography**: 
  - Headers: `font-display` (serif) for editorial feel
  - Body: System sans-serif
  - Hierarchy: Large titles (4xl-5xl), body (base), captions (xs-sm)
- **Spacing**: Consistent 4/8/12/16/24/32/48pt scale
- **Shadows**: `shadow-[0_8px_32px_rgba(0,0,0,0.3)]` for depth

### Core Components
- `AppBackground`: Dark background wrapper
- `AppShell`: Page container with consistent padding/max-width
- `PageHeader`: Editorial-style title + subtitle + optional orange divider
- `GlassCard`: Primary surface component (glass morphism)
- `PageSection`: Section wrapper for consistent spacing
- `Button`: Primary (orange) / Secondary (outline) variants
- `Badge`: Status indicators (neutral/warning/critical)
- `ErrorToast`: Structured error display with Error ID

---

## 1. `/operations` - Main Dashboard

### Purpose
**Operations Control Center** - Live health overview across jobs, mitigations, evidence, and compliance metrics.

### Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│ DashboardNavbar (email, logout)                         │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  [PageHeader]                                            │
│  Operations                                              │
│  Audit-defensible live health...                         │
│  ──────── (orange divider)                              │
│                                                          │
│  [Time Range Pills] [30d] [90d] [All]  [+ New Job]     │
│                                                          │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                  │
│  │Active│ │Open  │ │Avg   │ │Audit │                  │
│  │Jobs  │ │Risks │ │Risk  │ │Events│                  │
│  │  12  │ │   3  │ │  45  │ │  89  │                  │
│  └──────┘ └──────┘ └──────┘ └──────┘                  │
│                                                          │
│  [Performance Metrics - KPI Grid]                        │
│  ┌──────────────────────────────────────┐              │
│  │ Compliance Rate: 87%                  │              │
│  │ Avg Time to Close: 18h                │              │
│  │ High-Risk Jobs: 3                     │              │
│  │ Evidence Files: 124                   │              │
│  └──────────────────────────────────────┘              │
│                                                          │
│  [Trend Chart] [Evidence Widget]                        │
│  ┌──────────────┐ ┌──────────────┐                     │
│  │ Line Chart   │ │ Evidence     │                     │
│  │ (7-day trend)│ │ Stats        │                     │
│  └──────────────┘ └──────────────┘                     │
│                                                          │
│  [Dashboard Overview]                                    │
│  - Today's Jobs                                          │
│  - Jobs at Risk                                          │
│  - Recent Evidence                                       │
│  - Incomplete Mitigations                                │
│                                                          │
│  [Top Hazards]                                           │
│  ┌──────────────────────────────────────┐              │
│  │ Hazard Pills (code + count)           │              │
│  └──────────────────────────────────────┘              │
│                                                          │
│  [Job Roster]                                            │
│  ┌──────────────────────────────────────┐              │
│  │ Search | Sort | Filters              │              │
│  ├──────────────────────────────────────┤              │
│  │ Job Name | Risk | Status | Score     │              │
│  │ ...                                   │              │
│  │ [Pagination]                          │              │
│  └──────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────┘
```

### Key Features

**1. KPI Row (4 Cards)**
- Active Jobs (currently tracked)
- Open Risks (requiring attention)
- Avg Risk Score (across all jobs)
- Audit Events (last 30 days)

**2. Performance Metrics (KPI Grid)**
- **Compliance Rate**: % of mitigations completed
- **Avg Time to Close**: Hours from creation → completion
- **High-Risk Jobs**: Count of jobs scoring >75
- **Evidence Files**: Total photos captured
- Each KPI is clickable → deep links to filtered views

**3. Trend Chart**
- 7-day compliance trend (line + area fill)
- Time range selector (7d/30d/90d/all)
- Empty states with CTAs

**4. Evidence Widget**
- Jobs with/without evidence breakdown
- Average time to first evidence
- Required evidence policy status

**5. Job Roster**
- **Search**: Real-time debounced search
- **Sort**: Blockers, Readiness, Risk, Date
- **Filters**: Status, Risk Level
- **Pagination**: 25/50/100 per page
- **Row Display**: 
  - Client name (link to detail)
  - Risk badge (LOW/MEDIUM/HIGH/CRITICAL)
  - Status badge
  - Readiness score + blockers count
  - Risk score (large number, right-aligned)

### Data Flow
1. Loads user role (member/owner/admin)
2. Fetches analytics (if not member)
3. Fetches jobs with pagination
4. Fetches hazards summary
5. URL params sync (time_range, filters, pagination)
6. Real-time updates via SWR (revalidateOnFocus)

### Design Patterns
- **Editorial Header**: Large serif title + orange divider
- **Segmented Control**: Time range pills (active = orange bg)
- **Glass Cards**: All metrics in glass containers
- **Empty States**: Friendly CTAs when no data
- **Skeleton Loading**: Shimmer placeholders during fetch

---

## 2. `/operations/audit` - Compliance Ledger

### Purpose
**Immutable governance record** - All actions, decisions, and evidence as audit-ready ledger events.

### Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│ DashboardNavbar                                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  [PageHeader]                                            │
│  Compliance Ledger                                       │
│  Immutable governance record...                          │
│                                                          │
│  [Saved View Cards]                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐               │
│  │Review    │ │Insurance │ │Governance│               │
│  │Queue     │ │Ready    │ │Enforce   │               │
│  │(12)      │ │(5)      │ │(3)      │               │
│  └──────────┘ └──────────┘ └──────────┘               │
│                                                          │
│  [Summary Cards - 6 Metrics]                            │
│  Total Events | Violations | Jobs Touched |            │
│  Proof Packs | Attestations | Access Changes            │
│                                                          │
│  [Filters]                                               │
│  ┌──────────────────────────────────────┐              │
│  │ Time Range | Severity | Outcome       │              │
│  │ Job | User | Site                     │              │
│  └──────────────────────────────────────┘              │
│                                                          │
│  [Tabs]                                                  │
│  Governance | Operations | Access                       │
│                                                          │
│  [Events List]                                           │
│  ┌──────────────────────────────────────┐              │
│  │ [EventChip] Type + Severity + Outcome │              │
│  │ [TrustReceiptStrip] Who/When/What     │              │
│  │ [IntegrityBadge] Verification status  │              │
│  │ [EnforcementBanner] (if blocked)      │              │
│  │ [Actions] View Evidence | View Job    │              │
│  └──────────────────────────────────────┘              │
│                                                          │
│  [Export Controls]                                       │
│  Export CSV | [Advanced Menu]                           │
│    - API Payload (JSON)                                 │
│    - Generate Proof Pack (ZIP)                         │
│    - Pack History                                       │
└─────────────────────────────────────────────────────────┘
```

### Key Features

**1. Saved View Cards**
- **Review Queue**: Items needing assignment/resolution
- **Insurance Ready**: Events ready for proof pack export
- **Governance Enforcement**: Blocked violations
- **Incident Review**: Critical incidents
- **Access Review**: Access changes and security events
- Each card shows count + quick actions (Assign, Resolve, Export)

**2. Event Display Components**
- **EventChip**: Event type + severity badge + outcome (allowed/blocked)
- **TrustReceiptStrip**: Actor name/role/email, timestamp, event summary, policy reason
- **IntegrityBadge**: Hash verification status (verified/unverified/mismatch)
- **EnforcementBanner**: Shows policy statement for blocked actions

**3. Three-Tab System**
- **Governance**: Blocked actions, policy enforcement, violations
- **Operations**: Human actions (assign/resolve/waive, exports)
- **Access**: Identity + security (logins, role changes, revocations)

**4. Advanced Export Menu**
- CSV (human-readable)
- API Payload JSON (automation)
- Proof Pack ZIP (audit-ready PDF bundle)
- Pack History drawer

**5. Bulk Actions**
- Multi-select events
- Bulk assign/resolve
- Partial failure handling (shows succeeded/failed counts)

### Data Flow
1. Loads events from backend with server-side enrichment
2. Applies saved view filters (if active)
3. Filters by category tab (governance/operations/access)
4. Client-side filtering (time range, severity, outcome, job, user)
5. Real-time updates on actions (assign/resolve)

### Design Patterns
- **Event Cards**: Each event is a glass card with color-coded borders (red for blocked)
- **Expandable Details**: Click event → EventDetailsDrawer (sheet)
- **Swipe Actions**: (Future iOS) Copy ID, Export
- **Empty States**: Category-specific messages with filter clearing
- **Loading Skeletons**: LedgerEventListSkeleton for list, SavedViewCardsSkeleton for cards

---

## 3. `/operations/audit/readiness` - Audit Readiness

### Purpose
**What's missing for audit?** - Actionable checklist to make governance record audit-ready.

### Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│ DashboardNavbar                                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  [PageHeader]                                            │
│  Audit Readiness                                         │
│  What's missing for audit?                               │
│                                                          │
│  [Summary Cards - 6 Metrics]                             │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌────┐ │
│  │Score │ │Total │ │Crit. │ │Mater.│ │Time │ │Old │ │
│  │ 87/  │ │Items │ │Block │ │      │ │Clear│ │Over│ │
│  │ 100  │ │  24  │ │  3   │ │  8   │ │ 12h │ │ 5d │ │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └────┘ │
│                                                          │
│  [Category Tabs]                                         │
│  Evidence (8) | Controls (5) | Attestations (3)         │
│  Incidents (2) | Access (6)                              │
│                                                          │
│  [Filters]                                               │
│  Time Range | Severity | Status | Sort By               │
│                                                          │
│  [Readiness Items List]                                  │
│  ┌──────────────────────────────────────┐              │
│  │ [Icon] [Badge] Rule Code              │              │
│  │ Rule Name                              │              │
│  │ Why it matters: ...                    │              │
│  │ Work Record: ... | Owner: ... | Due:  │              │
│  │ [Fix Action Button] →                  │              │
│  └──────────────────────────────────────┘              │
│                                                          │
│  [Footer CTA]                                            │
│  ┌──────────────────────────────────────┐              │
│  │ Resolve X critical blockers...        │              │
│  │ [View Compliance Ledger]              │              │
│  │ [Generate Proof Pack]                 │              │
│  └──────────────────────────────────────┘              │
│                                                          │
│  [Fix Queue Sidebar] (floating button)                  │
│  ┌──────────────────────────────────────┐              │
│  │ Fix Queue (3)                         │              │
│  │ - Item 1                              │              │
│  │ - Item 2                              │              │
│  │ [Bulk Resolve]                         │              │
│  └──────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────┘
```

### Key Features

**1. Audit-Ready Score**
- 0-100 score based on resolved vs. total items
- Color-coded border (green ≥80, yellow ≥60, red <60)

**2. Category Breakdown**
- **Evidence**: Missing photos/documents
- **Controls**: Incomplete mitigations
- **Attestations**: Pending signoffs
- **Incidents**: Unresolved incidents
- **Access**: Access review items

**3. Readiness Items**
- **Severity**: Critical (red), Material (yellow), Info (blue)
- **Rule Code**: e.g., `EVIDENCE_MISSING`, `CONTROL_INCOMPLETE`
- **Fix Action Type**: 
  - `upload_evidence` → UploadEvidenceModal
  - `request_attestation` → RequestAttestationModal
  - `complete_controls` → Navigate to job detail
  - `resolve_incident` → Navigate to incident view
  - `review_item` → Navigate to audit ledger

**4. Fix Queue**
- Floating sidebar for batch processing
- Add items to queue → Bulk resolve
- Shows progress and partial failures

**5. Proof Pack Generation**
- Direct call to Railway backend (bypasses Vercel timeout)
- Shows loading state ("Generating...")
- Downloads ZIP with PDFs + manifest

### Data Flow
1. Loads readiness data from `/api/audit/readiness`
2. Filters by category, severity, status, time range
3. Sorts by severity/oldest/score
4. URL params sync for shareable links
5. Optimistic UI updates on fix actions

### Design Patterns
- **Severity Color Coding**: Red borders for critical, yellow for material
- **Action Buttons**: Orange primary buttons with arrow icons
- **Empty State**: "All Clear" with green checkmark
- **Error Handling**: Structured ErrorToast with Error ID + retry

---

## 4. `/operations/jobs` - Work Records

### Purpose
**Centralized job hub** - Track progress, hazards, documents, generate audit-ready reports.

### Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│ DashboardNavbar                                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  [PageHeader]                                            │
│  Work Records                                            │
│  Your centralized job hub...                            │
│                                                          │
│  [Filters Bar]                                           │
│  ┌──────────────────────────────────────┐              │
│  │ Status: [All] | Risk: [All]           │              │
│  │ Source: [All] | Template: [All]      │              │
│  │ [+ New Job]                           │              │
│  └──────────────────────────────────────┘              │
│                                                          │
│  [Jobs Table]                                            │
│  ┌──────────────────────────────────────┐              │
│  │ Client | Type | Location | Risk | ...│              │
│  ├──────────────────────────────────────┤              │
│  │ Job 1 | ... | HIGH | [View] [Export] │              │
│  │ Job 2 | ... | LOW  | [View] [Export] │              │
│  │ ...                                   │              │
│  │ [Pagination]                          │              │
│  └──────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────┘
```

### Key Features

**1. Filter System**
- **Status**: Draft, Pending, In Progress, Completed, Cancelled
- **Risk Level**: Low, Medium, High, Critical
- **Template Source**: All, From Template, Manual
- **Template ID**: Specific template filter

**2. Job Display**
- Client name (link to detail)
- Job type + location
- Risk score + badge
- Status badge
- Readiness metrics (blockers, score)
- Template indicator (if applied)

**3. Actions**
- View job detail
- Export PDF report
- Archive/Delete (owners/admins)

**4. Pagination**
- 25/50/100 per page
- Page navigation
- Total count display

### Data Flow
1. SWR caching for jobs list
2. Real-time revalidation on focus/reconnect
3. Template filters applied client-side
4. Optimistic updates on archive/delete

### Design Patterns
- **Table Layout**: Clean rows with hover states
- **Badge System**: Risk and status color-coded
- **Empty States**: "No jobs" with CTA to create
- **Loading**: JobListSkeleton with shimmer

---

## 5. `/operations/executive` - Defensibility Posture

### Purpose
**Executive snapshot** - Audit-ready proof from everyday field work. Read-only visibility.

### Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│ DashboardNavbar                                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  [PageHeader]                                            │
│  Defensibility Posture                                   │
│  Audit-ready proof from everyday field work...           │
│  [Ledger Contract v1.0 Badge]                           │
│                                                          │
│  [IntegrityBadge] (top-right)                            │
│                                                          │
│  [Risk Posture Summary Banner]                           │
│  ┌──────────────────────────────────────┐              │
│  │ ✅ No unresolved governance...        │              │
│  │ Generated from immutable records      │              │
│  └──────────────────────────────────────┘              │
│                                                          │
│  [Exposure Assessment - 3 Cards]                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐               │
│  │High Risk │ │Open     │ │Violations│               │
│  │Jobs: 3   │ │Incidents│ │: 0       │               │
│  │+2        │ │: 1      │ │          │               │
│  └──────────┘ └──────────┘ └──────────┘               │
│                                                          │
│  [Controls Status - 3 Cards]                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐               │
│  │Flagged   │ │Pending  │ │Signed    │               │
│  │: 5       │ │Signoffs │ │: 12      │               │
│  └──────────┘ └──────────┘ └──────────┘               │
│                                                          │
│  [Defensibility Posture - 4 Cards]                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐│
│  │Ledger    │ │Proof    │ │Enforce  │ │Attest.   ││
│  │Integrity │ │Packs    │ │Actions  │ │Coverage  ││
│  │Verified  │ │Generated│ │Blocked  │ │12/15     ││
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘│
│                                                          │
│  [Single CTA Card]                                       │
│  ┌──────────────────────────────────────┐              │
│  │ Open Full Governance Record          │              │
│  │ [View Compliance Ledger]             │              │
│  │ [Export PDF Brief] [API Payload]     │              │
│  └──────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────┘
```

### Key Features

**1. Risk Posture Summary**
- **Exposure Level**: Low/Moderate/High (color-coded banner)
- **Confidence Statement**: Auto-generated from data
- **Timestamp**: When statement was generated

**2. Exposure Assessment**
- **High Risk Jobs**: Count + delta (trend indicator)
- **Open Incidents**: Count + delta
- **Violations**: Recent blocked actions + delta
- Each card is clickable → filtered ledger view

**3. Controls Status**
- **Flagged Jobs**: Jobs requiring review
- **Pending Signoffs**: Awaiting attestations
- **Signed Jobs**: Sealed records

**4. Defensibility Posture**
- **Ledger Integrity**: Verified/Unverified/Error status
- **Proof Packs Generated**: Count + link to history
- **Enforcement Actions**: Blocked violations count
- **Attestations Coverage**: Signed vs. total

**5. Export Options**
- **PDF Brief**: Executive summary PDF
- **API Payload**: JSON for integrations
- Both include hash verification

### Data Flow
1. Verifies executive role (read-only)
2. Fetches risk posture from `/api/executive/risk-posture`
3. Calculates deltas (trends)
4. Generates confidence statement
5. Checks ledger integrity status

### Design Patterns
- **Hover Tooltips**: Info icons show detailed explanations
- **Delta Indicators**: Green/red trend arrows
- **Color Coding**: Red for high exposure, green for all clear
- **Read-Only Badge**: "Executive access is read-only by database policy"

---

## 6. `/operations/account` - Account Settings

### Purpose
**User & organization management** - Profile, billing, templates, security, team.

### Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│ DashboardNavbar                                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  [Sidebar Navigation]                                    │
│  ┌──────────┐                                           │
│  │ Settings │                                           │
│  │          │                                           │
│  │ Profile  │ ← active                                 │
│  │ Org      │                                           │
│  │ Billing  │                                           │
│  │ Templates│                                           │
│  │ Security │                                           │
│  │ Danger   │                                           │
│  └──────────┘                                           │
│                                                          │
│  [Main Content]                                          │
│  ┌──────────────────────────────────────┐              │
│  │ [Record Card Header]                  │              │
│  │ Record: Profile                       │              │
│  │ Last updated: ...                     │              │
│  │                                       │              │
│  │ Email: user@example.com (read-only)  │              │
│  │                                       │              │
│  │ Full Name: [Edit] John Doe           │              │
│  │                                       │              │
│  │ Phone: [Edit] +1 234 567 8900        │              │
│  │                                       │              │
│  │ Role: OWNER (read-only)              │              │
│  └──────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────┘
```

### Key Features

**1. Profile Section**
- **Email**: Read-only (managed by auth provider)
- **Full Name**: Inline edit with save/cancel
- **Phone**: Inline edit with save/cancel
- **Role**: Read-only (assigned by admin)

**2. Organization Section**
- **Organization Name**: Inline edit (owners/admins only)
- **Last Updated**: Timestamp display

**3. Billing Section**
- **Current Plan**: Tier display (STARTER/PRO/BUSINESS)
- **Status**: Active/Trialing/Past Due
- **Next Renewal**: Date
- **Seats**: Used/Limit
- **Monthly Job Limit**: Display
- **Actions**: Change Plan, View Invoices (Stripe portal)

**4. Templates Section**
- TemplatesManager component
- Hazard templates + Job templates
- Create/Edit/Archive/Delete

**5. Security Section**
- **Password**: Change password (coming soon)
- **Active Sessions**: Sign out everywhere
- **2FA**: Enable (coming soon)
- **Recent Security Events**: Last 5 events

**6. Danger Zone**
- **Deactivate Account**: 
  - Last owner → Transfer ownership first
  - Last owner + only member → Dissolve org
  - Regular member → Deactivate immediately
- **Confirmation**: Type "DELETE" to confirm
- **Retention**: 30 days before permanent deletion

### Data Flow
1. Loads user profile from Supabase
2. Loads organization data
3. Loads subscription from Stripe
4. Loads billing info
5. Loads security events
6. Inline edits → API calls → Optimistic updates

### Design Patterns
- **Sidebar Navigation**: Sticky left sidebar with active state
- **Inline Editing**: Hover → Edit icon → Input field → Save/Cancel
- **Record Cards**: Each section has "Record: X" header with timestamp
- **Source of Truth Labels**: "Source of truth: Stripe" for billing
- **Confirmation Flow**: Multi-step confirmation for destructive actions

---

## 7. `/operations/team` - Access & Accountability

### Purpose
**Define who can view, manage, and approve risk** - Team management with role-based access.

### Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│ DashboardNavbar                                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  [PageHeader]                                            │
│  Access & Accountability                                 │
│  Define who can view, manage, and approve risk           │
│                                                          │
│  [Risk Coverage - 5 Cards]                               │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐        │
│  │Owner │ │Safety│ │Exec. │ │Admin │ │Member│        │
│  │  2   │ │Lead  │ │  1   │ │  3   │ │  8   │        │
│  │      │ │  1   │ │      │ │      │ │      │        │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘        │
│                                                          │
│  [Invite Form]                                           │
│  ┌──────────────────────────────────────┐              │
│  │ Email: [input] Role: [select]        │              │
│  │ [Send Invite]                         │              │
│  └──────────────────────────────────────┘              │
│                                                          │
│  [Team Members List]                                     │
│  ┌──────────────────────────────────────┐              │
│  │ Name | Role Badge | [Deactivate]     │              │
│  │ Email | Risk Visibility              │              │
│  │ ...                                   │              │
│  └──────────────────────────────────────┘              │
│                                                          │
│  [Pending Invites]                                       │
│  ┌──────────────────────────────────────┐              │
│  │ Email | Role | PENDING | [Revoke]    │              │
│  │ ...                                   │              │
│  └──────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────┘
```

### Key Features

**1. Risk Coverage Dashboard**
- **Owners**: Org-level authority, billing, deletion
- **Safety Leads**: Operational risk, sees all flagged jobs
- **Executives**: Read-only visibility into risk & trends
- **Admins**: Team management, no org-level authority
- **Members**: Can create/update jobs, no governance authority
- Shows seat usage if limit exists

**2. Invite System**
- **Email Input**: Required
- **Role Selector**: Member, Safety Lead, Executive, Admin, Owner
- **Role Descriptions**: Shown below selector
- **Temporary Password**: Generated for new users (shown in modal)

**3. Team Members**
- **Display**: Name, email, role badge
- **Risk Visibility**: Shown for Safety Leads and Executives
- **Reset Required Badge**: If password reset needed
- **Actions**: Deactivate Access (owners/admins only)

**4. Pending Invites**
- **Display**: Email, role, "PENDING" badge, invite date
- **Actions**: Revoke invite (owners/admins only)

**5. Access Control**
- **Members**: Redirected to dashboard (read-only)
- **Owners/Admins**: Full access to manage team
- **Last Owner Protection**: Cannot remove last owner

### Data Flow
1. Loads team data from `/api/team`
2. Checks current user role
3. Redirects members to dashboard
4. Invite → API call → Refresh team data → Show password modal
5. Remove/Revoke → API call → Refresh team data

### Design Patterns
- **Role Badges**: Color-coded badges for roles
- **Confirmation Modal**: "Deactivate Access" with consequence warning
- **Seat Limit Warning**: Disables invite if limit reached
- **Audit Footer**: "All access changes are recorded for compliance"

---

## Common Patterns Across All Pages

### Navigation
- **DashboardNavbar**: Top bar with email + logout (all pages)
- **Breadcrumbs**: "← Back to Dashboard" on detail pages
- **Tab Navigation**: Used in Audit page (3 tabs)

### Loading States
- **Skeleton Loaders**: Shimmer placeholders (DashboardSkeleton, JobListSkeleton, etc.)
- **Spinner**: Centered spinner with message
- **Optimistic Updates**: UI updates immediately, refetch in background

### Error Handling
- **ErrorToast**: Structured errors with Error ID, code, hint, retry
- **Empty States**: Friendly messages with CTAs
- **Fallback Queries**: Direct Supabase queries if backend fails

### Data Fetching
- **SWR**: Used for jobs list (caching + revalidation)
- **useEffect**: Direct API calls for most data
- **URL Params**: Filters/sort/pagination synced to URL for shareable links

### Modals & Drawers
- **Evidence Drawer**: Side panel for job evidence
- **Event Details Drawer**: Sheet for ledger event details
- **Fix Queue Sidebar**: Floating sidebar for batch actions
- **Confirmation Modals**: For destructive actions

### Export Functionality
- **CSV**: Human-readable exports
- **JSON**: API payloads for automation
- **PDF**: Executive briefs, proof packs
- **ZIP**: Proof pack bundles (PDFs + manifest)

### Design Consistency
- **Glass Cards**: All surfaces use GlassCard component
- **Orange Accent**: `#F97316` for CTAs, active states
- **Typography**: Editorial headers (serif), system body
- **Spacing**: Consistent 4/8/12/16/24/32/48pt scale
- **Dark Theme**: Pure `#0A0A0A` background, no gradients

---

## iOS App Mapping

For the iOS app, these pages map to:

1. **`/operations`** → `DashboardView` (KPIs, charts, recent activity)
2. **`/operations/audit`** → `AuditFeedView` (list, category pills, detail sheets)
3. **`/operations/audit/readiness`** → (Future: ReadinessView)
4. **`/operations/jobs`** → (Future: JobsListView)
5. **`/operations/executive`** → (Future: ExecutiveView)
6. **`/operations/account`** → `AccountView` (organization name edit)
7. **`/operations/team`** → (Future: TeamView)

The iOS app should mirror the web's design system (dark theme, glass cards, orange accent) while using native iOS patterns (TabView, NavigationStack, sheets, swipe actions).
