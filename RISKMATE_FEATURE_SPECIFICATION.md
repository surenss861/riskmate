# RiskMate Web Application - Complete Feature Specification

**Version**: 1.0 (Locked)  
**Last Updated**: December 2024  
**Scope**: Web application only (desktop + mobile web)

> **Note**: This spec is locked as v1.0. Any changes require opening an issue and updating this document.

## 📊 Quick Status

**Total Features**: 38  
**Fully Implemented**: 35 ✅  
**Partially Implemented**: 3 ⚠️  
**Not Implemented**: 0 ❌

**Impact Breakdown**:
- **High (Conversion)**: 10 features (pricing, demo, calculators, bundle, sample report)
- **Medium (Retention)**: 18 features (reports, permit packs, analytics, core app)
- **Low (Nice-to-Have)**: 10 features (roadmap, PWA, dark mode, microcopy polish)

---

## 📋 Table of Contents

- [A. Auth, Orgs & Plans](#a-auth-orgs--plans)
- [B. Core App – Jobs, Risk, Evidence, Reports](#b-core-app--jobs-risk-evidence-reports)
- [C. UX Polish & Platform-Level Features](#c-ux-polish--platform-level-features)
- [D. Marketing Site](#d-marketing-site)
- [Feature Status Matrix](#feature-status-matrix)
- [Implementation Checklist](#implementation-checklist)

---

## A. Auth, Orgs & Plans

### 1. Sign Up / Login / Logout

#### 1.1 Sign Up
**Route**: `/signup`  
**Status**: ✅ Implemented

**Flow**:
1. User enters:
   - Email
   - Password (min 8 chars)
   - Full name (optional)
   - Organization name (optional, defaults to "{name}'s Organization")
   - Trade type (optional)
2. Frontend calls: `POST /api/auth/signup`
3. Backend:
   - Creates Supabase auth user via service role
   - Creates organization in `organizations` table
   - Creates user record in `users` table with:
     - `role = 'owner'`
     - `organization_id` = new org ID
   - Sets `subscription_tier = 'starter'` (trial)
   - Auto-confirms email (MVP)
4. Frontend:
   - Stores Supabase session
   - Redirects to `/dashboard` (or onboarding if first time)

**Error States**:
- Email already exists → Show error message
- Weak password → Show validation error
- Network error → Show retry message

**Success State**:
- Success toast: "Account created! Welcome to RiskMate"
- Auto-login and redirect

---

#### 1.2 Login
**Route**: `/login`  
**Status**: ✅ Implemented  
**Impact**: High (Conversion)  
**Agent Scenario**: Agent enters valid credentials, verifies redirect to `/dashboard`, confirms session is stored, checks organization context is loaded.  
**Test Prerequisites**: Existing user account

**Flow**:
1. User enters email + password
2. Frontend calls: `supabase.auth.signInWithPassword()`
3. Backend validates credentials
4. Frontend:
   - Stores session in Supabase client
   - Loads user's organization context
   - Redirects to:
     - Last visited page (if stored)
     - `/dashboard` (default)

**Error States**:
- Invalid credentials → "Email or password incorrect"
- Account not found → "No account found with this email"
- Network error → "Connection error. Please try again"

**Success State**:
- Session stored
- Redirect to dashboard

---

#### 1.3 Logout
**Route**: Any authenticated page  
**Status**: ✅ Implemented  
**Impact**: Medium (Core Functionality)  
**Agent Scenario**: Agent clicks logout button, verifies session is cleared, confirms redirect to `/login`, attempts to access protected route and is blocked.  
**Test Prerequisites**: Authenticated session

**Flow**:
1. User clicks "Logout" in navbar
2. Frontend calls: `supabase.auth.signOut()`
3. Session cleared
4. Redirect to `/login`

**UI**: Logout button in `DashboardNavbar` component

---

### 2. Forgot Password
**Route**: `/forgot-password`  
**Status**: ✅ Implemented  
**Impact**: Medium (Retention)  
**Agent Scenario**: Agent enters email, clicks submit, verifies success message appears, checks email for reset link, follows link to reset page, enters new password, confirms redirect to login.  
**Test Prerequisites**: Existing user account with email access

**Flow**:
1. User enters email
2. Frontend calls: `supabase.auth.resetPasswordForEmail(email)`
3. Supabase sends reset email
4. Frontend shows success state:
   - "Check your email for password reset instructions"
   - Link back to login

**Error States**:
- Email not found → "No account found with this email" (for security, don't reveal if email exists)
- Network error → "Connection error. Please try again"

**Reset Flow**:
- User clicks email link → `/reset?token=...`
- User enters new password
- Frontend calls: `supabase.auth.updateUser({ password })`
- Redirect to `/login` with success message

---

### 3. Organization + Roles

#### 3.1 Organization Context
**Status**: ✅ Implemented

**How It Works**:
- Every user belongs to **one active organization** (multi-org support later)
- Organization ID stored in `users.organization_id`
- All API routes use `getOrganizationContext()` utility
- All database queries filtered by `organization_id` + RLS policies

**Data Flow**:
```
User Session → Load user record → Get organization_id → All queries scoped to org
```

**Tables**:
- `organizations` - Company data
- `users` - User accounts (linked to `auth.users`)
- `organization_members` - Extended membership (future multi-org)

---

#### 3.2 Roles System
**Status**: ✅ Implemented

**Roles**:
1. **Owner**
   - Full access to all features
   - Can manage billing
   - Can delete organization
   - Can invite/remove team members
   - All permissions enabled

2. **Admin**
   - Most features enabled
   - Cannot manage billing
   - Can invite team members
   - Cannot delete organization

3. **Member**
   - Limited access
   - Can create jobs
   - Can complete mitigations
   - Can upload photos
   - Can view reports
   - Cannot edit jobs (except own mitigations)
   - Cannot generate reports
   - Cannot invite team

**Permission System**:
- Defined in `lib/utils/permissions.ts`
- Permissions: `jobs.create`, `jobs.edit`, `reports.generate`, `team.invite`, etc.
- Checked via `hasPermission(role, permission)`
- Enforced in API routes via middleware

**Storage**:
- Role stored in `users.role` column
- Cached in session for performance

---

### 4. Team Invites
**Route**: `/dashboard/team`  
**Status**: ✅ Implemented (UI + Backend)

**Flow**:
1. Owner/Admin navigates to `/dashboard/team`
2. Clicks "Invite Team Member"
3. Enters:
   - Email address
   - Role (Admin or Member)
4. Frontend calls: `POST /api/team/invite`
5. Backend:
   - Creates row in `organization_invites` table:
     - `email`, `organization_id`, `role`, `invited_by`, `token` (UUID)
     - `expires_at` (7 days from now)
   - Sends email with link: `/signup?invite_token={token}`
6. Frontend shows success modal: "Invitation sent to {email}"

**Accept Invite Flow**:
1. User clicks email link → `/signup?invite_token={token}`
2. Frontend:
   - Validates token (calls `GET /api/team/invite/{token}`)
   - Pre-fills email and organization name
   - User completes signup
3. Backend:
   - Creates user account
   - Links to organization from invite
   - Sets role from invite
   - Marks invite as `accepted`
   - Redirects to dashboard

**Error States**:
- Invalid/expired token → "This invitation link has expired"
- Email already in use → "This email is already registered"
- Invite already accepted → "This invitation has already been used"

**UI Features**:
- List of pending invites (email, role, sent date)
- Resend invite button
- Cancel invite button
- List of current team members (name, email, role, joined date)
- Remove member button (Owner/Admin only)

---

### 5. Subscription Plans

#### 5.1 Plan Structure
**Status**: ✅ Implemented

**Plans**:

**Starter** (Free/Trial):
- 3 jobs per month
- 1 seat (owner only)
- Basic PDF reports (no branding)
- Share links (public report view)
- **Price**: Free

**Pro**:
- Unlimited jobs
- Up to 5 seats
- Branded PDFs (logo, colors)
- Email notifications
- Client share links
- **Price**: $X/month

**Business**:
- Everything in Pro
- Unlimited seats
- Analytics Dashboard
- Permit Pack generator (ZIP)
- Client Portal (token-based)
- Advanced audit logs
- Priority support
- **Price**: $X/month

**Storage**:
- Plan stored in `subscriptions` table
- Synced from Stripe via webhooks
- Cached in user session for performance

---

#### 5.2 Plan Enforcement
**Status**: ✅ Implemented

**Frontend Gating**:
- Locked features show "Upgrade" badge
- Upgrade prompts on feature use
- Plan comparison tooltips

**Backend Gating**:
- API routes check subscription tier
- Job creation: Enforces monthly limit (Starter: 3 jobs)
- Seat limits: Enforced on team invites
- Feature access: Middleware checks plan before route execution

**Error Responses**:
- `402 Payment Required` - Plan limit reached
- `403 Forbidden` - Feature not available on current plan
- Frontend shows toast + redirect to `/pricing`

**Plan Limits** (from `lib/utils/planRules.ts`):
```typescript
Starter: { seats: 1, jobsMonthly: 3 }
Pro: { seats: 5, jobsMonthly: null } // unlimited
Business: { seats: null, jobsMonthly: null } // unlimited
```

---

#### 5.3 Plan Switching
**Route**: `/dashboard/account/change-plan`  
**Status**: ✅ Implemented

**Flow**:
1. User clicks "Upgrade" or navigates to account settings
2. Frontend shows plan comparison
3. User selects plan → `POST /api/stripe/checkout`
4. Redirects to Stripe Checkout
5. After payment → Webhook confirms → Plan updated
6. Redirect to `/pricing/thank-you`

**Downgrade**:
- Owner can downgrade from account settings
- Takes effect at end of billing period
- Features locked immediately (grace period for data access)

---

## B. Core App – Jobs, Risk, Evidence, Reports

### 6. Dashboard Overview
**Route**: `/dashboard`  
**Status**: ✅ Implemented  
**Impact**: Medium (Retention)  
**Agent Scenario**: Agent loads dashboard, verifies all 6 cards render with data or empty states, clicks through to filtered views, confirms skeleton loaders appear during loading.  
**Test Prerequisites**: At least 3-5 jobs with varying statuses, risk levels, and evidence

**Layout**: Grid of cards/widgets

**Cards** (loaded via single API call):

1. **Today's Jobs**
   - List of jobs with `start_date = today`
   - Shows: Job name, client, risk level badge
   - Empty state: "No jobs scheduled for today"
   - Click → Filter jobs list by today

2. **Jobs at Risk**
   - Jobs where `risk_level IN ('high', 'critical')` AND `status != 'completed'`
   - Shows: Count + list of 3-5 jobs
   - Empty state: "All jobs are low risk"
   - Click → Filter jobs list by high/critical risk

3. **Recent Evidence**
   - Last N photos/documents uploaded (N = 6-9)
   - Thumbnail grid
   - Shows: Photo thumbnail, job name, upload date
   - Empty state: "No evidence uploaded yet"
   - Click photo → Opens in lightbox
   - Click job name → Navigate to job detail

4. **Incomplete Mitigations**
   - Count of mitigation items where `is_completed = false`
   - Shows: "X safety controls need attention"
   - List of jobs with incomplete mitigations
   - Empty state: "All mitigations complete"
   - Click → Filter jobs list by incomplete mitigations

5. **Compliance Trend**
   - Small line chart showing:
     - Average risk score over time (last 30 days)
     - Mitigation completion rate over time
   - X-axis: Date
   - Y-axis: Score (0-100) or % Complete
   - Empty state: "Not enough data yet"

6. **Workforce Activity**
   - Last few actions from audit log
   - Shows: Actor name, action, timestamp
   - Example: "John completed mitigation on Job #123 - 2 hours ago"
   - Empty state: "No recent activity"
   - Click → Navigate to audit log page

**Loading States**:
- Skeleton loaders for each card
- Spinner while fetching data

**API**: `GET /api/analytics/dashboard` (or similar)

**Refresh**: Auto-refresh every 5 minutes, manual refresh button

---

### 7. Jobs List
**Route**: `/dashboard/jobs`  
**Status**: ✅ Implemented

**Component**: `DataGrid` (custom table component)

**Columns**:
- **Name** - Job name (editable inline)
- **Client** - Client name
- **Location** - Job location
- **Score** - Risk score (0-100) with color coding
- **Level** - Risk level badge (Low/Med/High/Critical)
- **Status** - Status badge (Draft/In Progress/Completed/Archived)
- **Updated At** - Last modified timestamp

**Features**:

1. **Sorting**
   - Click column header to sort
   - Ascending/descending toggle
   - Visual indicator (arrow up/down)

2. **Search**
   - Search bar at top
   - Searches: Job name, client name, location
   - Real-time filtering

3. **Filters**
   - **Risk Level**: Low, Medium, High, Critical, All
   - **Status**: Draft, In Progress, Completed, Archived, All
   - **Score Range**: Min/Max slider or inputs
   - **Date Range**: Created date or updated date
   - Active filters shown as chips with "X" to remove

4. **Saved Views** (Future)
   - Save filter combinations
   - Quick switch between views

5. **Row Actions**
   - Click row → Navigate to job detail
   - Right-click → Context menu (Edit, Duplicate, Archive, Delete)

6. **Bulk Actions** (Future)
   - Select multiple rows
   - Bulk archive, bulk status change

**Empty States**:
- No jobs: "Create your first job to get started" + "New Job" button
- No results: "No jobs match your filters" + "Clear filters" button

**Pagination**:
- 20 jobs per page
- Page numbers or infinite scroll (configurable)

**API**: `GET /api/jobs?status=...&risk_level=...&search=...&page=1&limit=20`

---

### 8. New Job Flow
**Route**: `/dashboard/jobs/new`  
**Status**: ✅ Implemented

**Form Fields**:
1. **Job Name** (required) - Text input
2. **Client Name** (required) - Text input
3. **Client Type** (required) - Select: Residential, Commercial, Industrial, Government
4. **Job Type** (required) - Select: Repair, Installation, Maintenance, Inspection, Remodel, Other
5. **Location** (required) - Text input (address)
6. **Start Date** (optional) - Date picker
7. **End Date** (optional) - Date picker
8. **Description** (optional) - Textarea
9. **Risk Factors** (optional) - Multi-select from risk factors library
10. **Template** (optional) - Select job template to pre-fill

**Validation**:
- Required fields marked with asterisk
- Real-time validation feedback
- Submit button disabled until valid

**On Submit**:
1. Frontend validates form
2. Calls: `POST /api/jobs`
3. Backend:
   - Checks plan limits (Starter: 3 jobs/month)
   - Creates job in `jobs` table with:
     - `status = 'draft'`
     - `organization_id` from session
     - `created_by` = current user ID
   - If risk factors selected:
     - Calculates risk score
     - Creates `job_risk_scores` row
     - Generates mitigation items from risk factors
   - If template selected:
     - Clones hazards/mitigations from template
   - Creates audit log entry: `job.created`
4. Frontend:
   - Shows success toast: "Job created successfully"
   - Redirects to `/dashboard/jobs/{jobId}`

**Error States**:
- Plan limit reached → Toast: "Starter plan limit reached (3 jobs/month). Upgrade to Pro for unlimited jobs." + Redirect to pricing
- Validation errors → Show inline error messages
- Network error → Show retry button

**Template Selection**:
- If user selects template:
  - Pre-fills job type, hazards, mitigations
  - User can still edit before saving

---

### 9. Job Detail
**Route**: `/dashboard/jobs/[id]`  
**Status**: ✅ Implemented

**Layout**: Single page with sections

#### Top Section (Header)
- **Job Name** - Inline editable (click to edit)
- **Status Dropdown** - Draft / In Progress / Completed / Archived
- **Risk Score Pill** - Large number (0-100) with color:
  - Low: Green (< 40)
  - Medium: Yellow (40-69)
  - High: Orange (70-89)
  - Critical: Red (≥ 90)
- **Risk Level Badge** - "LOW RISK" / "MEDIUM RISK" / "HIGH RISK" / "CRITICAL RISK"
- **Microcopy** - Contextual message:
  - Low: "This job is low risk. Standard safety protocols apply."
  - Medium: "This job has moderate risk. Review mitigations before starting."
  - High: "⚠️ This job is HIGH risk. Complete all mitigations before work begins."
  - Critical: "🚨 CRITICAL RISK. Do not proceed until all safety controls are in place."
- **Actions** - "Generate Report", "Generate Permit Pack" (Business), "Archive", "Delete"

#### Tabs/Sections

**1. Risk & Hazards**
- **Selected Risk Factors** - List of hazards with:
  - Name
  - Severity badge (Low/Medium/High/Critical)
  - Category (Safety, Liability, Compliance, etc.)
  - Remove button (X)
- **Add Hazard Button** - Opens modal with:
  - Searchable library of risk factors
  - Filter by category, severity
  - Select multiple
  - "Add Selected" button
- **Auto-Recalculate** - When hazards change:
  - Shows loading state
  - Calls `POST /api/jobs/[id]/recalculate-score`
  - Updates score and level in real-time

**2. Mitigation Checklist**
- **Progress Bar** - "X of Y completed" with percentage
- **Checklist Items** - Each item shows:
  - Checkbox (checked if `is_completed = true`)
  - Title
  - Description
  - "Completed by" (name + timestamp if done)
  - "Mark Complete" button (if not done)
- **On Complete**:
  - Frontend calls: `PATCH /api/jobs/[id]/mitigations/[mitigationId]`
  - Backend sets: `is_completed = true`, `completed_by = userId`, `completed_at = NOW()`
  - UI updates immediately
  - Progress bar updates
- **Empty State**: "No mitigations required" (if no risk factors)

**3. Evidence (Photos & Docs)**
- **Upload Area** - Drag-and-drop zone
- **Categories**:
  - Before (photos before work starts)
  - During (photos during work)
  - After (photos after completion)
  - Documents (PDFs, contracts, permits, etc.)
- **Photo Upload Flow**:
  1. User selects/drops images
  2. Client-side compression (reduce file size)
  3. Optional: Extract GPS metadata
  4. Upload to Supabase Storage: `orgId/jobs/jobId/photos/{filename}`
  5. Create `documents` row with:
     - `type = 'photo'`
     - `category = 'before'/'during'/'after'`
     - `file_path` = storage path
  6. Show upload progress
  7. Add to grid on success
- **Thumbnail Grid**:
  - Thumbnails in grid layout
  - Click → Opens lightbox viewer
  - Hover → Shows metadata (date, uploaded by, category)
- **Document Upload**:
  - Same flow as photos
  - Supported: PDF, DOCX, images
  - Click → Opens in new tab (signed URL)
- **Tags/Labels** (Future):
  - Add custom tags to photos
  - Filter by tag

**4. Timeline / Activity**
- **Event List** - Chronological list from `audit_logs`:
  - Job created
  - Hazard added/removed
  - Mitigation completed
  - Photo uploaded
  - Report generated
  - Status changed
- **Each Event Shows**:
  - Icon (based on event type)
  - Actor name
  - Action description
  - Timestamp (relative: "2 hours ago")
  - Metadata (if available)
- **Grouping** (Optional):
  - Group by date
  - Collapsible sections

**5. Assignments & Signatures** (UI Done)
- **Assigned Workers**:
  - List of team members assigned to job
  - Shows: Name, role, assigned date
  - "Assign Worker" button → Multi-select dropdown
  - Remove button (X) next to each
- **Signatures** (If implemented):
  - List of captured signatures
  - Shows: Name, role, signature image, timestamp
  - "Capture Signature" button (if not done)

**6. Documents** (Separate from Photos)
- **Document List** - Table of documents:
  - Name
  - Type (Insurance Certificate, Waiver, Safety Plan, Contract, Other)
  - Uploaded by
  - Date
  - Download button
- **Upload Button** - Same as photos but for documents

**Loading States**:
- Skeleton loader for job header
- Spinner for sections while loading
- Optimistic updates for quick actions

**Error States**:
- Job not found → 404 page
- Unauthorized → 403 page
- Network error → Retry button

---

### 10. Risk Scoring Engine
**Status**: ✅ Implemented

**Algorithm** (from `lib/utils/riskScoring.ts`):

**Severity Weights**:
- Critical: 25 points
- High: 15 points
- Medium: 8 points
- Low: 3 points

**Calculation**:
1. Sum all selected risk factor weights
2. Cap at 100 (if sum > 100, set to 100)
3. Assign level:
   - < 40: Low
   - 40-69: Medium
   - 70-89: High
   - ≥ 90: Critical

**API Endpoint**: `POST /api/jobs/[id]/recalculate-score`

**Flow**:
1. User adds/removes hazard
2. Frontend calls API
3. Backend:
   - Fetches current hazards for job
   - Calculates score using algorithm
   - Updates `job_risk_scores` table (or creates if doesn't exist)
   - Updates `jobs.risk_score` and `jobs.risk_level`
   - Returns new score + level
4. Frontend:
   - Updates UI immediately
   - Shows animation (score number changes)
   - Updates risk level badge color
   - Updates microcopy

**Real-time Updates**:
- Score recalculates automatically when hazards change
- No manual "Calculate" button needed

**Caching**:
- Score cached in `jobs` table for performance
- Recalculated on hazard changes

---

### 11. Templates System
**Route**: `/dashboard/account` (Templates tab) + `/dashboard/jobs/new` + `/dashboard/jobs/[id]`  
**Status**: ✅ Fully Implemented (v1 Complete)  
**Impact**: Medium (Retention)  
**Agent Scenario**: Agent (Admin/Owner) navigates to Account → Templates, creates hazard/job template, applies template to new job, applies template to existing job, saves manual job as template, views template usage stats, archives template with usage warning.  
**Test Prerequisites**: Admin/Owner role, template tables populated (or seed data)

**Templates Types**:

1. **Job Templates**
   - Pre-configured sets of:
     - Job type
     - Default hazards
     - Default mitigations
   - Example: "Residential Roof Tear-Off" template includes:
     - Height work hazard
     - Weather exposure hazard
     - Mitigations: Fall protection, weather monitoring, etc.

2. **Hazard Templates**
   - Reusable groups of hazards
   - Example: "Electrical Work" template includes:
     - Live electrical work
     - Lockout/tagout required
     - Arc flash risk

3. **Mitigation Templates**
   - Standard mitigation checklists
   - Can be attached to hazards or jobs
   - Example: "Fall Protection Checklist"

**v1 Implementation** (✅ Complete):
- Templates management in `/dashboard/account` → Templates tab
- List of templates (tabs: Hazard / Job) with usage-based sorting
- "Create Template" button with plan gating (Starter: 3 max, Pro/Business: unlimited)
- Template editor modal:
  - Name, trade/category, description
  - Multi-select hazards with severity/category filters
  - Suggested template names
  - Preview hazards summary
  - "Save & Apply Now" option (from Job Detail)
- Template detail drawer:
  - Usage stats ("Used in X jobs")
  - Recent jobs list (top 5)
  - "View all jobs" link → filtered jobs page
  - Edit/Duplicate/Archive actions
- Apply template on:
  - New Job page: "Start from template" dropdown
  - Job Detail page: "Apply Template" button with preview
- "Save as Template" button on Job Detail (for manual jobs)
- Archive behavior:
  - Usage warning before archiving
  - Soft delete only (never breaks existing jobs)
  - "(Archived)" label shown in Job Detail
- Usage-based sorting (most used templates first)
- Jobs filter by template source (All/From Template/Manual) + template dropdown

**Database Tables**:
- `hazard_templates` (✅ with RLS)
- `job_templates` (✅ with RLS)
- `mitigation_templates` (Future v2)

**v2 Future Enhancements** (Not in scope for v1):
- Template pinning for official templates
- Template analytics (completion rates, risk score trends)
- Trade-based template recommendations
- Template health metrics

---

### 12. Mitigation Tracking
**Status**: ✅ Implemented

**Checklist Items**:
- Each item has:
  - `id` (UUID)
  - `title` (text)
  - `description` (text)
  - `is_completed` (boolean)
  - `completed_by` (user ID, nullable)
  - `completed_at` (timestamp, nullable)
  - `due_date` (optional)

**Completion Flow**:
1. User clicks checkbox or "Mark Complete" button
2. Frontend calls: `PATCH /api/jobs/[id]/mitigations/[mitigationId]`
3. Backend:
   - Sets `is_completed = true`
   - Sets `completed_by = current_user_id`
   - Sets `completed_at = NOW()`
   - Creates audit log entry: `mitigation.completed`
4. Frontend:
   - Updates UI (checkbox checked)
   - Shows "Completed by {name} on {date}"
   - Updates progress bar

**Progress Calculation**:
- `completed_count / total_count * 100`
- Displayed as: "7 of 10 safety controls applied (70%)"
- Progress bar with color:
  - 0-50%: Red
  - 51-75%: Yellow
  - 76-99%: Orange
  - 100%: Green

**Uncomplete** (Future):
- If user has permission, can uncheck to mark incomplete
- Clears `completed_by` and `completed_at`

---

### 13. Photo Uploads & Optimization
**Status**: ✅ Implemented

**Upload Component**: Drag-and-drop zone in Evidence section

**Client-Side Processing** (from `lib/utils/photoOptimization.ts`):
1. **File Validation**:
   - Check file type (images only: JPG, PNG, WebP)
   - Check file size (max 10MB before compression)
2. **Compression**:
   - Resize if > 1920px width
   - Compress to 80% quality
   - Convert to WebP if supported
3. **EXIF Orientation**:
   - Fix rotation based on EXIF data
   - Remove EXIF to reduce file size
4. **GPS Metadata** (Optional):
   - Extract GPS coordinates if available
   - Store in metadata

**Upload Flow**:
1. User selects/drops images
2. Frontend processes each image
3. Shows upload progress (X of Y uploaded)
4. For each image:
   - Upload to Supabase Storage: `{orgId}/jobs/{jobId}/photos/{filename}`
   - Create `documents` row:
     - `type = 'photo'`
     - `category = 'before'/'during'/'after'` (user selects)
     - `file_path` = storage path
     - `uploaded_by` = current user ID
5. On success: Add to thumbnail grid
6. On error: Show error message, allow retry

**Storage Path Structure**:
```
documents/
  {organization_id}/
    jobs/
      {job_id}/
        photos/
          {timestamp}_{filename}.webp
```

**UI Features**:
- Thumbnail grid with hover effects
- Click → Lightbox viewer (full size)
- Delete button (with confirmation)
- Category badges (Before/During/After)
- Upload date and user name

**Error States**:
- File too large → "File must be less than 10MB"
- Invalid type → "Only images are supported"
- Upload failed → "Upload failed. Please try again." + Retry button
- Network error → Show offline banner

---

### 14. Document Management
**Status**: ✅ Implemented

**Supported Types**:
- PDF
- Images (JPG, PNG, WebP)
- DOCX (Word documents)
- Other: Any file type (stored as-is)

**Upload Flow**:
- Same as photos but:
  - No compression (for PDFs/DOCX)
  - Stored in `documents` table with `type = 'document'`
  - Category: Insurance Certificate, Waiver, Safety Plan, Contract, Other

**Storage**:
- Path: `{orgId}/jobs/{jobId}/documents/{filename}`
- Signed URLs for access (expire after 1 hour)

**UI**:
- Document list table:
  - Name
  - Type
  - Size
  - Uploaded by
  - Date
  - Download button
- Click name → Opens in new tab (PDF viewer or download)

**Permissions**:
- Upload: `documents.upload` permission
- Delete: `documents.delete` permission (Owner/Admin only)

---

### 15. PDF Report Generation
**Route**: Job detail page → "Generate PDF Report" button  
**Status**: ✅ Implemented  
**Impact**: High (Retention)  
**Agent Scenario**: Agent opens job with hazards and mitigations, clicks "Generate PDF Report", waits for progress modal to complete, verifies PDF opens in new tab, checks file size > 0, confirms share link is generated.  
**Test Prerequisites**: At least 1 job with hazards, mitigations, and photos

**Component**: `GenerationProgressModal`

**Flow**:
1. User clicks "Generate PDF Report"
2. Modal opens with progress steps:
   - "Preparing data..." (0%)
   - "Building layout..." (25%)
   - "Embedding photos..." (50%)
   - "Finalizing file..." (75%)
   - "Complete!" (100%)
3. Frontend calls: `POST /api/reports/generate/[jobId]`
4. Backend:
   - Fetches job data, risk score, mitigations, photos, audit logs
   - Generates PDF using PDFKit:
     - Cover page (branded with logo)
     - Executive summary
     - Risk score breakdown
     - Hazard checklist
     - Controls applied (mitigations)
     - Timeline/audit log
     - Photo evidence (thumbnails)
     - Signatures & compliance
   - Saves PDF to Supabase Storage: `{orgId}/reports/{jobId}_{timestamp}.pdf`
   - Creates `risk_snapshot_reports` row:
     - `pdf_url` = storage path
     - `hash` = SHA256 hash (for versioning)
     - `generated_by` = current user ID
   - Returns signed URL (valid 1 hour)
5. Frontend:
   - Shows success state
   - "View PDF" button → Opens in new tab
   - "Copy Share Link" button → Copies token URL to clipboard
   - "Download" button → Downloads PDF

**PDF Sections** (from `lib/utils/pdf/`):
1. **Cover Page**: Logo, job name, date, risk score badge
2. **Executive Summary**: Job overview, risk level, key hazards
3. **Risk Score Breakdown**: Factors with weights, overall score
4. **Hazard Checklist**: All identified hazards with severity
5. **Controls Applied**: Mitigation checklist with completion status
6. **Timeline**: Audit log events (grouped by date)
7. **Photo Evidence**: Thumbnails with captions (Before/During/After)
8. **Signatures**: Digital signatures if captured
9. **Footer**: Page numbers, organization name, report ID

**Branding**:
- Pro/Business: Logo and accent color from organization
- Starter: Generic RiskMate branding

**Error States**:
- Generation failed → "Failed to generate report. Please try again."
- Network error → Retry button
- Plan restriction → "Upgrade to Pro for branded PDFs"

**Caching**:
- Reports cached in `risk_snapshot_reports` table
- Can regenerate to create new version
- Hash used to detect changes

---

### 16. Permit Pack Generator
**Route**: Job detail page → "Generate Permit Pack" button (Business only)  
**Status**: ✅ Implemented  
**Impact**: High (Retention)  
**Agent Scenario**: Agent (Business plan) opens job, clicks "Generate Permit Pack (ZIP)", waits for generation, verifies ZIP download starts automatically, checks file size > 0, extracts ZIP and confirms all expected files are present (PDF, CSVs, JSON, photos).  
**Test Prerequisites**: Business plan subscription, at least 1 job with complete data (hazards, mitigations, photos, documents)

**Visibility**: Only shown if `subscription_tier === 'business'`

**Flow**:
1. User clicks "Generate Permit Pack (ZIP)"
2. Shows loading state: "Generating permit pack..."
3. Frontend calls: `POST /api/jobs/[id]/permit-pack`
4. Backend:
   - Regenerates Risk Snapshot PDF (or uses latest)
   - Collects files:
     - `risk_snapshot.pdf` - Latest PDF report
     - `hazard_checklist.csv` - All hazards in CSV format
     - `controls_applied.csv` - All mitigations in CSV format
     - `job_details.json` - Job metadata (JSON)
     - `metadata.json` - Report metadata (JSON)
   - Includes documents from job (if any)
   - Includes categorized photos (Before/During/After folders)
   - Builds ZIP file in memory using `archiver`
   - Uploads ZIP to Supabase Storage: `{orgId}/permit-packs/{jobId}_{timestamp}.zip`
   - Returns signed URL (valid 1 hour)
5. Frontend:
   - Automatically opens download in new tab
   - Or shows "Download Permit Pack" link

**ZIP Structure**:
```
permit-pack-{jobId}-{date}.zip
├── risk_snapshot.pdf
├── hazard_checklist.csv
├── controls_applied.csv
├── job_details.json
├── metadata.json
├── documents/
│   ├── insurance_certificate.pdf
│   └── ...
└── photos/
    ├── before/
    │   ├── photo1.jpg
    │   └── ...
    ├── during/
    │   └── ...
    └── after/
        └── ...
```

**Error States**:
- Plan restriction → "Permit Pack is available on Business plan only"
- Generation failed → "Failed to generate permit pack. Please try again."

---

### 17. Client Portal
**Route**: `/client/[token]`  
**Status**: ✅ Implemented

**Access**: Public (no login required)

**Token Generation**:
- Created when user clicks "Copy Share Link" on report
- Token stored in `report_snapshots` or similar table
- Token format: UUID or base64-encoded JWT
- Expires: 7 days (configurable)

**Flow**:
1. User shares link: `https://riskmate.com/client/{token}`
2. Client clicks link
3. Frontend validates token:
   - Calls `GET /api/reports/share/[token]`
   - Backend verifies token, returns job data
4. Frontend displays read-only view:
   - Job summary
   - Risk score and level
   - Hazard checklist
   - Key photos (thumbnails)
   - Latest PDF report (download button)
   - No editing, no sensitive data

**UI**:
- Clean, professional layout
- RiskMate branding
- "Download Full Report" button
- "Back to RiskMate" link

**Error States**:
- Invalid token → 404 page: "This link has expired or is invalid"
- Expired token → "This link has expired. Please request a new one."

**Security**:
- Tokens are one-time use (optional)
- Tokens expire after 7 days
- No access to organization data beyond this job

---

### 18. Analytics Dashboard
**Route**: `/dashboard/analytics`  
**Status**: ✅ Implemented (Business plan only)  
**Impact**: Medium (Retention)  
**Agent Scenario**: Agent (Business plan) navigates to analytics, verifies all charts render with data, changes time range selector, confirms data updates, checks that non-Business users see upgrade prompt.  
**Test Prerequisites**: Business plan subscription, at least 10-15 jobs with varying risk scores, completion dates, and evidence over last 30-90 days

**Plan Gating**:
- If plan < Business → Show teaser:
  - "Analytics Dashboard is available on Business plan"
  - "Upgrade to Business" button → Redirects to pricing
- If Business → Full access

**Charts & KPIs**:

1. **Compliance Rate Over Time**
   - Line chart: % of jobs with all mitigations complete
   - Time range: Last 30/90 days
   - X-axis: Date
   - Y-axis: Percentage (0-100%)

2. **High-Risk Job Count**
   - Bar chart: Number of high/critical risk jobs per week
   - Color: Red for critical, Orange for high

3. **Average Time to Close**
   - Metric: Average days from job creation to completion
   - Trend: Is it improving or getting worse?

4. **Evidence Volume**
   - Bar chart: Number of photos/documents uploaded per week
   - Breakdown: Before/During/After photos

5. **Risk Score Distribution**
   - Pie chart: Jobs by risk level (Low/Med/High/Critical)
   - Percentage breakdown

6. **Top Hazards**
   - Table: Most common hazards across all jobs
   - Shows: Hazard name, count, % of jobs

7. **Team Activity**
   - List: Most active team members
   - Shows: Name, jobs created, mitigations completed, photos uploaded

**Time Range Selector**:
- 7 days
- 30 days
- 90 days
- Custom range (date picker)

**Export** (Future):
- "Export Report" button → CSV/PDF of analytics data

**API**: `GET /api/analytics?range=30d`

---

### 19. Audit Log & Version History
**Status**: ✅ Implemented

**Storage**: `audit_logs` table

**Events Tracked**:
- `job.created`
- `job.updated`
- `job.status_changed`
- `hazard.added`
- `hazard.removed`
- `mitigation.completed`
- `photo.uploaded`
- `document.uploaded`
- `report.generated`
- `permit_pack.generated`
- `team.member_added`
- `team.member_removed`

**Log Entry Structure**:
```typescript
{
  id: UUID
  organization_id: UUID
  user_id: UUID (actor)
  actor_name: string
  event_name: string
  target_type: 'job' | 'hazard' | 'mitigation' | 'report' | ...
  target_id: UUID
  metadata: JSONB (additional context)
  created_at: timestamp
}
```

**UI on Job Page**:
- "Version History" section or tab
- Timeline view:
  - Grouped by date
  - Each event shows: Icon, actor, action, timestamp
  - Expandable for details

**Standalone View** (Future):
- `/dashboard/audit` - Full audit log for organization
- Filter by: User, event type, date range
- Export to CSV

**Permissions**:
- View: Owner, Admin
- Members: Can only see their own actions

---

### 20. Evidence Verification UI
**Status**: ⚠️ Partially Implemented (Component exists, backend pending)  
**Impact**: Medium (Retention)  
**Agent Scenario**: Agent (Admin/Owner) views evidence section, sees photos with "Pending" status, clicks "Approve" on a photo, verifies status changes to "Approved" with reviewer name, checks that Members see approval badge but cannot approve.  
**Test Prerequisites**: At least 1 job with uploaded photos, Admin/Owner role for approval actions

**Component**: `EvidenceVerification` (in job detail page)

**Flow**:
1. Admin/Owner views Evidence section
2. Sees list of photos/documents with status:
   - **Pending** (default) - Yellow badge
   - **Approved** - Green badge
   - **Rejected** - Red badge
3. For each item:
   - "Approve" button
   - "Reject" button
   - Optional: Comment field
4. On approve/reject:
   - Frontend calls: `POST /api/jobs/[id]/evidence/[evidenceId]/verify`
   - Backend:
     - Updates `evidence_verifications` table:
       - `status = 'approved'/'rejected'`
       - `reviewed_by` = current user ID
       - `reviewed_at` = NOW()
       - `comment` = optional comment
   - Creates audit log entry
5. Workers see:
   - Badge: "Approved by {name}" or "Rejected - {reason}"
   - Cannot edit approved evidence

**Database Table**: `evidence_verifications`
- Links: `document_id` → `documents.id`
- Status: `pending` / `approved` / `rejected`
- Reviewer info: `reviewed_by`, `reviewed_at`, `comment`

**Permissions**:
- Approve/Reject: Owner, Admin only
- View status: All team members

---

### 21. Job Assignment UI
**Status**: ✅ Implemented (UI component exists)

**Component**: `JobAssignment` (in job detail page)

**UI**:
- **Assigned Workers** list:
  - Name, role, assigned date
  - Remove button (X)
- **Assign Worker** button:
  - Opens multi-select dropdown
  - Shows all team members
  - Select multiple
  - "Assign Selected" button

**Backend** (Future):
- `job_assignments` table exists
- API endpoints to create/delete assignments
- Notifications when assigned (email/SMS - v2)

**Current State**:
- UI is functional
- Backend may need wiring (check API routes)

---

## C. UX Polish & Platform-Level Features

### 22. Microcopy Everywhere
**Status**: ✅ Partially Implemented

**Microcopy Examples**:

**Risk Score**:
- Low: "This job is low risk. Standard safety protocols apply."
- Medium: "This job has moderate risk. Review mitigations before starting."
- High: "⚠️ This job is HIGH risk. Complete all mitigations before work begins."
- Critical: "🚨 CRITICAL RISK. Do not proceed until all safety controls are in place."

**Mitigation Checklist**:
- "Complete all safety controls before starting work. Each item must be verified on-site."

**Evidence**:
- "Upload photos to document job conditions. Categorize as Before, During, or After work."

**Analytics**:
- "Track your team's safety performance over time. Identify trends and areas for improvement."

**Permit Pack**:
- "Generate a complete permit package with all job documentation. Includes PDF report, checklists, and evidence."

**Pricing**:
- "Starter plan is perfect for solo contractors. Upgrade to Pro for unlimited jobs and team collaboration."

**Implementation**:
- Add microcopy components throughout UI
- Use consistent tone: Professional, helpful, contractor-friendly
- No screen should feel mysterious

---

### 23. Inline Editing
**Status**: ✅ Implemented

**Components**: `EditableText`, `EditableSelect`

**Pattern**:
1. Text displayed normally
2. Hover → Shows pencil icon
3. Click → Turns into input/select
4. Save button (checkmark) or Cancel (X)
5. Small spinner while saving
6. On success: Updates UI, shows success state
7. On error: Shows error message, reverts to original

**Editable Fields**:
- Job name ✅
- Job status ✅
- Client name (optional)
- Location (optional)
- Description (optional)
- Notes (optional)

**API**: Uses same endpoints as regular updates
- `PATCH /api/jobs/[id]` for job fields

---

### 24. Skeleton Loaders
**Status**: ✅ Implemented

**Component**: `SkeletonLoader`, `DashboardSkeleton`, `JobListSkeleton`

**Usage**:
- Dashboard cards → Skeleton cards
- Jobs table → Skeleton rows
- Job detail → Skeleton sections
- Analytics → Skeleton charts
- Case studies → Skeleton content blocks
- Calculators → Skeleton inputs

**Pattern**:
- Show skeleton immediately on page load
- Replace with content when data loads
- Smooth transition (fade in)

**Prevents**: "Flash of nothing" during network calls

---

### 25. Dark Mode Toggle
**Status**: ❌ Removed  
**Impact**: Low (Nice-to-Have)  
**Note**: Feature removed. RiskMate uses dark theme only.

**Current State**:
- Default theme: Dark mode
- Toggle component exists: `DarkModeToggle`
- Light mode: Not fully designed yet

**Implementation** (When ready):
1. Toggle sets `data-theme="dark"` or `data-theme="light"` on `<html>`
2. Persist preference in `localStorage`
3. Load preference on page load
4. Update Tailwind classes based on theme

**For Now**:
- Toggle can be hidden
- Or show "Coming soon" message
- Or disable with tooltip: "Light mode coming soon"

---

### 26. PWA / Offline
**Status**: ✅ Implemented (Basic)

**Components**: `PWARegister`, Service Worker

**Features**:
- **Manifest**: `public/manifest.json`
  - App name, icons, theme color
  - "Add to Home Screen" prompt
- **Service Worker**: `public/sw.js`
  - Caches static assets
  - Basic offline support
- **Offline Banner** (Future):
  - Show when offline
  - "You're offline. Some features may not work."
  - Queue actions for when online

**Current State**:
- PWA installable
- Basic offline cache
- Graceful degradation when offline

**Future**:
- Offline job creation
- Queue actions → Replay on reconnect
- Bi-directional sync

---

### 27. Changelog
**Status**: ✅ Implemented

**Component**: `Changelog` (in dashboard)

**Widget** (Footer or Sidebar):
- Shows latest 3 updates
- Each item: Title, date, short description
- "View full changelog" link

**Full Page**: `/changelog` (or `/dashboard/changelog`)
- Reverse-chronological list
- Grouped by date
- Each entry:
  - Title
  - Date
  - Description
  - Category (Feature, Bug Fix, Improvement)

**Data Source**:
- Hardcoded for now
- Future: Database table or CMS

**Example Entries**:
- "PDF Report Generation - December 2024"
- "Analytics Dashboard - November 2024"
- "Team Invites - October 2024"

---

### 28. Onboarding Wizard
**Status**: ✅ Implemented

**Component**: `OnboardingWizard`

**Trigger**:
- First time after signup
- Or if `has_completed_onboarding = false` in user record
- Can be re-opened from settings

**Steps**:
1. **Welcome**
   - "Welcome to RiskMate! Let's set up your account."
2. **Trade Type**
   - "What type of work do you do?"
   - Options: Electrical, Roofing, HVAC, General Contractor, Other
3. **Team Size**
   - "How many people are on your team?"
   - Options: Just me, 2-5, 6-10, 11-20, 20+
4. **Risk Preferences**
   - "How strict should risk assessments be?"
   - Options: Standard, Strict, Very Strict
5. **Create First Job**
   - "Let's create your first job using a template."
   - Shows template selector
   - Pre-fills based on trade type
   - User can edit before saving
6. **Complete**
   - "You're all set! Here's your dashboard."
   - "Skip tour" or "Take tour" buttons

**On Complete**:
- Sets `has_completed_onboarding = true` in user record
- Creates audit log entry
- Redirects to dashboard

**API**: `PATCH /api/users/me` to update onboarding status

---

## D. Marketing Site

### 29. Landing Page
**Route**: `/`  
**Status**: ✅ Implemented

**Sections**:

1. **Hero**
   - Headline: "Protect Every Job Before It Starts"
   - Subheadline: "Instant risk scoring, auto-mitigation checklists, and shareable PDF reports for service contractors."
   - Primary CTA: "Start Free" → `/signup`
   - Secondary CTA: "View Sample Report" → `/sample-report`
   - 3D scene or animated background

2. **What RiskMate Replaces**
   - Icons + text:
     - Paper hazard forms → Digital checklists
     - Photo albums in iMessage → Organized evidence
     - Google Drive chaos → Centralized dashboard
     - Manual reports → Auto-generated PDFs
     - No audit trail → Complete activity log

3. **Features** (3-6 blocks)
   - Risk Scoring
   - Mitigation Checklists
   - Photo Evidence
   - PDF Reports
   - Team Collaboration
   - Analytics

4. **Mobile App / PWA Promo**
   - Screenshot or mockup
   - Bullets:
     - "Capture evidence on-site"
     - "Offline mode support"
     - "Instant sync with web dashboard"

5. **Trust & Social Proof**
   - "Trusted by contractors across Canada"
   - Logos (if available)
   - Device icons: "Works with: iPhone, iPad, Android, Web, PWA"

6. **Founder Story**
   - Short, honest story
   - "After talking to dozens of contractors, one thing was consistent — safety paperwork was a mess. RiskMate fixes that."

7. **FAQ Preview**
   - 3-4 common questions
   - Link to full FAQ on pricing page

8. **Footer**
   - Links: Pricing, Case Studies, Compare, Tools, Resources, Roadmap, Login
   - Legal: Privacy, Terms
   - Social: Twitter, LinkedIn (if available)

**Design**:
- Dark theme
- Smooth scrolling
- Animations on scroll
- Mobile-responsive

---

### 30. Pricing Page
**Route**: `/pricing`  
**Status**: ✅ Implemented  
**Impact**: High (Conversion)  
**Agent Scenario**: Agent loads pricing page, verifies all 3 plans display correctly, fills ROI calculator with sample data, confirms calculations are correct, clicks "Start Free" and verifies redirect to signup, clicks "Upgrade to Pro" and confirms Stripe checkout opens.  
**Test Prerequisites**: None (public page)

**Layout**: Three-column table

**Columns**: Starter / Pro / Business

**Features Checklist**:
- Jobs per month
- Seats
- PDF Reports
- Branded PDFs
- Analytics
- Permit Pack
- Client Portal
- Priority Support

**"Most Popular" Ribbon**: On Pro column

**ROI Calculator** (Embedded):
- Inputs:
  - Jobs per month
  - Crew size
  - Average hourly rate
- Output:
  - Hours saved per month
  - $ saved per month
  - Annual savings

**Expanded FAQ**:
- "Can I use RiskMate as a solo contractor?"
- "Can I invite subcontractors?"
- "Does every worker need a login?"
- "Are my job reports private?"
- "Is this tax-deductible?" → Yes
- "What happens if I cancel?"
- "Can I export my data?"

**CTAs**:
- Starter: "Start Free" → `/signup`
- Pro: "Upgrade to Pro" → Stripe Checkout
- Business: "Upgrade to Business" → Stripe Checkout

**Thank You Page**: `/pricing/thank-you`
- Confirmation message
- Next steps
- Link to dashboard

---

### 31. Case Studies
**Routes**: 
- `/case-studies/electrical`
- `/case-studies/roofing`
- `/case-studies/hvac`

**Status**: ✅ Implemented

**Each Page Structure**:

1. **Hero**
   - "How [Trade] Contractor Cut Risk + Paperwork"
   - Subheadline with key metric

2. **Before → After Story**
   - Before: Problems (paper forms, lost photos, no audit trail)
   - After: Solutions (digital, organized, compliant)

3. **Example Hazards & Mitigations**
   - Screenshot or list of real hazards
   - Mitigations applied
   - Risk score breakdown

4. **Screenshots**
   - RiskMate dashboard
   - Job detail page
   - PDF report sample

5. **Metrics**
   - Time saved: "X hours per job"
   - Fewer incidents: "Y% reduction"
   - Faster quotes: "Z% faster"

6. **CTA**
   - "See how RiskMate works for [trade]"
   - "Start Free" button → `/signup`

**Design**:
- Trade-specific imagery
- Professional, credible tone
- Real examples (even if anonymized)

---

### 32. Comparison Pages
**Routes**:
- `/compare/safetyculture`
- `/compare/sitedocs`
- `/compare/pen-and-paper`
- `/compare/spreadsheets`

**Status**: ✅ Implemented

**Layout**: Comparison table

**Columns**: RiskMate vs [Competitor]

**Rows**:
- Price
- Setup time
- Mobile UX
- Contractor focus
- Exports (PDF, CSV, ZIP)
- Complexity
- Support
- Customization

**"When to Use Which" Section**:
- Honest, non-toxic comparison
- "If you're a contractor, RiskMate is simpler and cheaper."
- "If you need enterprise features, [Competitor] might be better."

**CTA**:
- "Try RiskMate Free" → `/signup`
- "See Pricing" → `/pricing`

**SEO**:
- Target keywords: "[Competitor] alternative", "vs [Competitor]"

---

### 33. Calculator Tools
**Routes**:
- `/tools/risk-score-calculator`
- `/tools/compliance-score`
- `/tools/incident-cost`
- `/tools/time-saved`

**Status**: ✅ Implemented  
**Impact**: High (Conversion - SEO)  
**Agent Scenario**: Agent loads each calculator, enters sample inputs, verifies results calculate in real-time, checks that CTAs appear at end, confirms mobile responsiveness, tests share functionality (if available).  
**Test Prerequisites**: None (public pages, no data needed)

**1. Risk Score Calculator**
- User selects hazards from checklist
- Real-time calculation:
  - Shows score (0-100)
  - Shows risk level (Low/Med/High/Critical)
  - Shows breakdown by hazard
- CTA: "See how RiskMate automates this"

**2. Compliance Score Checker**
- Yes/No questions:
  - "Do you document hazards before each job?"
  - "Do you track mitigation completion?"
  - "Do you generate safety reports?"
  - etc.
- Calculates compliance score (0-100%)
- Shows advice: "You're doing well, but RiskMate can help automate X"

**3. Incident Cost Estimator**
- Inputs:
  - Lost time (hours)
  - Medical costs ($)
  - Property damage ($)
  - Legal fees ($)
- Output: Total estimated cost
- CTA: "See how RiskMate prevents incidents"

**4. Time Saved Calculator**
- Inputs:
  - Jobs per month
  - Hours per job (admin time)
- Output:
  - Hours saved per month
  - Hours saved per year
  - $ saved (if hourly rate provided)
- CTA: "Start saving time with RiskMate"

**All Tools**:
- Show results in real-time
- Soft CTA at end
- Share button (optional)
- Mobile-responsive

---

### 34. Contractor Bundle
**Route**: `/resources/bundle`  
**Status**: ✅ Implemented

**Content**:
- Explains what's inside:
  - Free JSA template (PDF)
  - Hazard checklist (PDF)
  - Toolbox talk template (PDF)
  - Risk scoring cheat sheet (PDF)
  - "Reduce Liability 101" guide (PDF)
  - Sample Risk Snapshot PDF

**Download Flow**:
- "Download Bundle" button
- Option 1: Direct ZIP download (no email)
- Option 2: Email capture → Send download link
- Tracks downloads (analytics)

**API**: `GET /api/resources/bundle/download`
- Creates ZIP on-the-fly
- Returns download

---

### 35. Sample Report
**Route**: `/sample-report`  
**Status**: ✅ Implemented

**Content**:
- Preview image of PDF
- Bullet list of what's inside:
  - Risk score breakdown
  - Hazard checklist
  - Mitigation checklist
  - Photo evidence
  - Audit timeline
- "Download Sample Risk Snapshot Report" button

**Download**:
- Button → `/api/sample-report` or `/sample-risk-report.pdf`
- Generates PDF on-the-fly with sample data
- No email required
- Opens in new tab

**API**: `GET /api/sample-report`
- Uses `generateRiskSnapshotPDF()` with sample data
- Returns PDF buffer

---

### 36. Interactive Demo
**Route**: `/demo`  
**Status**: ✅ Implemented

**Content**:
- Fake read-only organization
- Sample jobs (3-5)
- Sample hazards, mitigations, photos
- "Demo data only" label clearly visible

**Features**:
- Click into jobs
- View hazards
- View mitigations
- View evidence
- Generate sample PDF (non-persisted)

**No Login Required**:
- Public access
- No backend actions (all read-only)
- Clear labeling: "This is a demo. Sign up to create real jobs."

**CTA**:
- "Start Free" button → `/signup`
- "See Pricing" → `/pricing`

---

### 37. Roadmap
**Route**: `/roadmap`  
**Status**: ✅ Implemented

**Sections**:

1. **Recently Shipped**
   - Latest features (last 3 months)
   - Each: Title, description, date

2. **In Development**
   - Currently being built
   - Each: Title, description, ETA (optional)

3. **Coming Soon**
   - Planned features
   - Each: Title, description, rough timeline

4. **Ideas Under Review**
   - Feature requests being considered
   - Each: Title, description, status

**Design**:
- Clean, simple layout
- Builds trust: "We're actively shipping"
- Can vote on ideas (future)

**Updates**:
- Update monthly or quarterly
- Keep it current

---

### 38. Live Chat Widget
**Status**: ✅ Implemented

**Component**: `ChatWidget`

**UI**:
- Floating bubble bottom-right
- Opens panel on click
- Shows FAQ questions:
  - "How do I generate a report?"
  - "How does the risk score work?"
  - "How many seats do I get?"
  - "Is this CRA tax deductible?"
  - "How do I invite team members?"
- Static answers (no AI for now)
- Option: "Still have questions? Email us at support@riskmate.com"

**Pages**:
- Marketing pages (landing, pricing, case studies)
- App pages (dashboard, jobs)

**Future**:
- AI-powered bot
- Real-time chat with support team
- Integration with support system

---

## Feature Status Matrix

| Feature | Route | Status | Notes |
|---------|-------|--------|-------|
| **A. Auth, Orgs & Plans** |
| Sign Up | `/signup` | ✅ | High | Create account, verify starter plan, onboarding appears | None |
| Login | `/login` | ✅ | High | Login, verify redirect to dashboard, session stored | Existing account |
| Logout | Any | ✅ | Medium | Logout, verify session cleared, redirect to login | Authenticated session |
| Forgot Password | `/forgot-password` | ✅ | Medium | Submit email, verify reset link, change password | Existing account |
| Organization Context | All | ✅ | High | All queries scoped to org, RLS enforced | Multi-org test data |
| Roles System | All | ✅ | High | Verify permissions per role, test access restrictions | Users with different roles |
| Team Invites | `/dashboard/team` | ✅ | Medium | Send invite, accept via email link, verify role set | Owner/Admin role |
| Subscription Plans | All | ✅ | High | Verify plan limits enforced, upgrade flows work | Different plan tiers |
| Plan Enforcement | All | ✅ | High | Hit limit, verify 402 error, upgrade prompt | Starter plan at limit |
| Plan Switching | `/dashboard/account` | ✅ | High | Change plan, verify Stripe checkout, confirm upgrade | Active subscription |
| **B. Core App** |
| Dashboard Overview | `/dashboard` | ✅ | Medium | Load dashboard, verify 6 cards, click through filters | 3-5 jobs with varied data |
| Jobs List | `/dashboard/jobs` | ✅ | Medium | Load list, test sorting/filtering/search, click row | Multiple jobs |
| New Job | `/dashboard/jobs/new` | ✅ | High | Create job, select hazards, verify redirect to detail | None |
| Job Detail | `/dashboard/jobs/[id]` | ✅ | High | Open job, verify all sections load, test inline edits | Job with complete data |
| Risk Scoring | Job detail | ✅ | High | Add/remove hazards, verify score recalculates, check level | Job with hazards |
| Templates System | `/dashboard/templates` | ⚠️ | Medium | Create template, use in job creation, verify pre-fill | Admin role, template data |
| Mitigation Tracking | Job detail | ✅ | High | Complete mitigations, verify progress bar, check audit log | Job with mitigations |
| Photo Uploads | Job detail | ✅ | High | Upload photos, verify compression, check storage path | None (upload test) |
| Document Management | Job detail | ✅ | Medium | Upload documents, verify download, check categories | None (upload test) |
| PDF Report Generation | Job detail | ✅ | High | Generate PDF, verify download, check share link | Job with complete data |
| Permit Pack | Job detail | ✅ | High | Generate ZIP, verify download, extract and check files | Business plan, complete job |
| Client Portal | `/client/[token]` | ✅ | Medium | Open share link, verify read-only view, check PDF access | Generated report + token |
| Analytics Dashboard | `/dashboard/analytics` | ✅ | Medium | Load analytics, verify charts, test time ranges | Business plan, 10+ jobs |
| Audit Log | Job detail | ✅ | Medium | View timeline, verify events, check actor names | Job with activity |
| Evidence Verification | Job detail | ⚠️ | Medium | Approve/reject photos, verify status changes | Admin role, job with photos |
| Job Assignment | Job detail | ✅ | Medium | Assign workers, verify list updates, test removal | Team members exist |
| **C. UX Polish** |
| Microcopy | All | ⚠️ | Low | Verify helpful text appears under key features | Various pages |
| Inline Editing | Job detail | ✅ | Medium | Edit job name/status inline, verify save/cancel | Job exists |
| Skeleton Loaders | All | ✅ | Low | Verify skeletons appear during loading, smooth transition | Slow network |
| Dark Mode Toggle | Navbar | ❌ | Low | Feature removed - dark theme only | N/A |
| PWA / Offline | All | ✅ | Low | Install PWA, go offline, verify graceful degradation | PWA installed |
| Changelog | Dashboard | ✅ | Low | View changelog widget, click through to full page | None |
| Onboarding Wizard | First login | ✅ | Medium | Complete wizard, verify onboarding flag set, check redirect | New account |
| **D. Marketing** |
| Landing Page | `/` | ✅ | High | Load page, verify all sections, test CTAs, check mobile | None |
| Pricing Page | `/pricing` | ✅ | High | Load page, test ROI calculator, verify Stripe checkout | None |
| Case Studies | `/case-studies/*` | ✅ | High | Load each page, verify content, check CTAs | None |
| Comparison Pages | `/compare/*` | ✅ | High | Load each page, verify comparison table, test CTAs | None |
| Calculator Tools | `/tools/*` | ✅ | High | Test each calculator, verify calculations, check CTAs | None |
| Contractor Bundle | `/resources/bundle` | ✅ | High | Download bundle, verify ZIP contains expected files | None |
| Sample Report | `/sample-report` | ✅ | High | Download sample PDF, verify file opens, check content | None |
| Interactive Demo | `/demo` | ✅ | High | Navigate demo, click through jobs, verify read-only | None |
| Roadmap | `/roadmap` | ✅ | Low | Load page, verify sections, check dates | None |
| Live Chat Widget | All | ✅ | Medium | Open widget, test FAQ questions, verify answers | None |

**Legend**:
- ✅ = Fully implemented and working
- ⚠️ = Partially implemented (needs completion)
- ❌ = Not implemented
- **Impact**: High (Conversion/Retention), Medium (Core Functionality), Low (Nice-to-Have)

---

## Implementation Checklist

### Phase 1: Core Features (v1.0)
- [x] Auth system (signup, login, logout)
- [x] Organization + roles
- [x] Team invites
- [x] Subscription plans + enforcement
- [x] Jobs list + detail
- [x] Risk scoring
- [x] Mitigation checklists
- [x] Photo uploads
- [x] PDF report generation
- [x] Basic dashboard

### Phase 2: Polish (v1.5)
- [x] Inline editing
- [x] Skeleton loaders
- [x] Microcopy
- [x] Onboarding wizard
- [x] Changelog
- [x] PWA basics

### Phase 3: Advanced Features (v2.0)
- [ ] Templates system (UI)
- [ ] Evidence verification (backend)
- [ ] Job assignments (backend notifications)
- [ ] Analytics dashboard (enhancements)
- [ ] Client portal (enhancements)

### Phase 4: Marketing (v2.5)
- [x] Landing page
- [x] Pricing page
- [x] Case studies
- [x] Comparison pages
- [x] Calculator tools
- [x] Contractor bundle
- [x] Sample report
- [x] Interactive demo
- [x] Roadmap
- [x] Live chat widget

### Phase 5: Enterprise (v3.0)
- [ ] Workflow builder
- [ ] Advanced analytics
- [ ] Offline sync v2
- [ ] Command palette
- [ ] Light mode
- [ ] Mobile app (native)

---

## Testing Checklist

For each feature, test:

1. **Happy Path**: Does it work as expected?
2. **Error States**: Are errors handled gracefully?
3. **Permissions**: Are role/plan restrictions enforced?
4. **Data Isolation**: Can users see other orgs' data? (Should be NO)
5. **Loading States**: Are skeletons/loaders shown?
6. **Empty States**: Are empty states shown when no data?
7. **Mobile**: Does it work on mobile browsers?
8. **Offline**: Does it degrade gracefully when offline?
9. **Agent Mode**: Can an automated user complete the flow via clicks/inputs?

## Agent Mode Readiness

Each feature includes:
- ✅ **Route**: Clear URL to navigate to
- ✅ **Agent Scenario**: Step-by-step automated test flow
- ✅ **Test Prerequisites**: Required data/state
- ✅ **Success Criteria**: How to verify completion

**Agent Testing Priority**:
1. **High Impact Features First**: Pricing, signup, core job flows, PDF generation
2. **Critical Paths**: Auth → Create Job → Generate Report → Share
3. **Edge Cases**: Plan limits, permissions, error states

## Known Gaps (⚠️ Features)

### 1. Templates System
**Status**: Backend tables exist, UI not fully wired  
**Action**: 
- Option A: Complete UI implementation
- Option B: Hide feature until ready (recommended for v1.0)

### 2. Evidence Verification
**Status**: UI component exists, backend endpoints may be missing  
**Action**:
- Verify API endpoints exist: `POST /api/jobs/[id]/evidence/[evidenceId]/verify`
- If missing: Implement or hide feature for Members
- Test with Admin/Owner roles only

### 3. Dark Mode Toggle
**Status**: Removed  
**Action**: Feature removed. RiskMate uses dark theme only.

### 4. Microcopy
**Status**: Some areas filled, others probably still dry  
**Action**:
- Audit all pages for missing microcopy
- Add helpful text under key features
- Low priority (can ship incrementally)

## QA Action Plan

### Phase 1: Critical Path Testing (Week 1)
1. **Auth Flow**: Signup → Login → Dashboard
2. **Job Creation**: Create job → Add hazards → Complete mitigations → Upload photos
3. **Report Generation**: Generate PDF → Verify download → Test share link
4. **Plan Enforcement**: Test limits, upgrade flows, Stripe checkout

### Phase 2: Feature Completeness (Week 2)
1. **All Marketing Pages**: Load, verify content, test CTAs
2. **Calculator Tools**: Test calculations, verify results
3. **Analytics Dashboard**: Verify charts render (Business plan)
4. **Team Management**: Invites, roles, permissions

### Phase 3: Edge Cases & Polish (Week 3)
1. **Error States**: Test all error scenarios
2. **Permissions**: Test each role's access
3. **Mobile**: Test on real devices
4. **Performance**: Load times, skeleton states

### Phase 4: Agent Mode Validation (Week 4)
1. **Automated Testing**: Run agent scenarios for each feature
2. **Documentation**: Update any gaps found
3. **Bug Fixes**: Address blockers

## Version Control

**This spec is locked as v1.0**. 

**To make changes**:
1. Open a GitHub issue describing the change
2. Get approval from team
3. Update this document with new version number
4. Document breaking changes in CHANGELOG

**File Location**: `/RISKMATE_FEATURE_SPECIFICATION.md`  
**Backup**: Save as `RISKMATE_WEB_SPEC_v1.md` in repo root

---

**Document Version**: 1.0 (Locked)  
**Last Updated**: December 2024  
**Maintained By**: Development Team  
**Next Review**: After v1.0 release

