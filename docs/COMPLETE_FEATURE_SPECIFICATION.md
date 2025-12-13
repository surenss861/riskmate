# RiskMate Complete Feature Specification

**Last Updated:** January 15, 2025  
**Status:** Production-Ready  
**Version:** 1.0

---

## Table of Contents

1. [Core Job Management](#1-core-job-management)
2. [Risk Assessment & Scoring](#2-risk-assessment--scoring)
3. [Mitigation Management](#3-mitigation-management)
4. [Template System](#4-template-system)
5. [Evidence & Document Management](#5-evidence--document-management)
6. [Premium Features](#6-premium-features)
7. [Team & Collaboration](#7-team--collaboration)
8. [Reporting & Export](#8-reporting--export)
9. [Account & Subscription Management](#9-account--subscription-management)
10. [Analytics & Dashboard](#10-analytics--dashboard)
11. [Security & Compliance](#11-security--compliance)

---

## 1. Core Job Management

### 1.1 Job Creation

**Purpose:** Create a new safety job with client details, location, and initial risk assessment.

**How It Works:**

1. **User Flow:**
   - Navigate to `/dashboard/jobs/new`
   - Fill in job details:
     - Client name (required)
     - Client type (residential/commercial/industrial)
     - Job type (repair/renovation/new construction/maintenance)
     - Location (address)
     - Description (optional)
     - Start/end dates (optional)
     - Subcontractor info (optional)
     - Insurance status (pending/active/expired)
   - Select hazards/risk factors (or apply template)
   - Submit → Job created with risk score calculated

2. **Backend Process:**
   ```
   POST /api/jobs
   ├── Validates authentication & organization context
   ├── Checks plan limits (Starter: 10 jobs/month)
   ├── Creates job record in `jobs` table
   ├── If hazards selected:
   │   ├── Calculates risk score (weighted algorithm)
   │   ├── Saves to `job_risk_scores` table
   │   ├── Generates mitigation items automatically
   │   └── Updates job with risk_score & risk_level
   └── Writes audit log: "job.created"
   ```

3. **Risk Score Calculation:**
   - **Severity Weights:**
     - Critical: 25 points
     - High: 15 points
     - Medium: 8 points
     - Low: 3 points
   - **Risk Level Thresholds:**
     - Low: 0-40
     - Medium: 41-70
     - High: 71-90
     - Critical: 91-100
   - **Formula:** Sum of all selected hazard weights, capped at 100

4. **Database Schema:**
   ```sql
   jobs (
     id: uuid (PK)
     organization_id: uuid (FK → organizations)
     created_by: uuid (FK → users)
     client_name: text
     client_type: text
     job_type: text
     location: text
     description: text
     status: text (draft/active/completed/cancelled)
     risk_score: integer (0-100)
     risk_level: text (low/medium/high/critical)
     start_date: date
     end_date: date
     has_subcontractors: boolean
     subcontractor_count: integer
     insurance_status: text
     created_at: timestamptz
     updated_at: timestamptz
   )
   ```

5. **Plan Limits:**
   - **Starter:** 10 jobs/month (hard limit)
   - **Pro:** Unlimited jobs
   - **Business:** Unlimited jobs + premium features

---

### 1.2 Job Detail View

**Purpose:** View and manage a single job with all its components.

**Features:**

1. **Job Header:**
   - Editable client name (inline editing)
   - Location, status badges
   - Applied template indicator
   - Navigation breadcrumbs

2. **Risk Score Card (Hero Section):**
   - Large risk score display (0-100)
   - Risk level badge (low/medium/high/critical)
   - Number of risk factors detected
   - Breakdown of contributing factors
   - Mitigation progress bar
   - Micro-divider separating score from breakdown

3. **Hazards Section:**
   - List of identified hazards with severity
   - Each hazard shows:
     - Name
     - Severity badge
     - Weight contribution (+X points)
   - Actions:
     - Apply template (adds hazards)
     - Save current setup as template
     - Create new template

4. **Mitigation Checklist:**
   - Auto-generated from selected hazards
   - Each item:
     - Checkbox (toggle completion)
     - Title
     - Description
   - Visual states:
     - Unchecked: opacity-90 (dimmed)
     - Checked: opacity-100 + strikethrough
   - Grouping: Subtle spacing every 4-5 items
   - Progress tracking: X/Y completed

5. **Job Details Card (De-emphasized):**
   - Description
   - Created date
   - Status
   - Actions:
     - View Live Report (secondary)
     - Edit Job Details (tertiary/muted)

6. **CTA Priority Order:**
   - Generate Permit Pack (primary, Business only)
   - View Audit-Ready Report (secondary)
   - View Live Report (secondary)
   - Edit Job Details (tertiary)

---

### 1.3 Job Editing

**Purpose:** Update job details and recalculate risk scores.

**How It Works:**

1. **User Flow:**
   - Navigate to `/dashboard/jobs/[id]/edit`
   - Modify any field
   - Change hazard selections
   - Save → Risk score recalculated automatically

2. **Backend Process:**
   ```
   PATCH /api/jobs/:id
   ├── Validates ownership (organization_id match)
   ├── Updates job fields
   ├── If hazards changed:
   │   ├── Deletes old risk_score & mitigation_items
   │   ├── Recalculates risk score
   │   ├── Generates new mitigation items
   │   └── Updates job record
   └── Writes audit log: "job.updated"
   ```

3. **Optimistic UI:**
   - Changes appear immediately
   - Rollback on error
   - Toast notifications for success/error

---

### 1.4 Job List View

**Purpose:** Browse and filter all jobs in the organization.

**Features:**

1. **DataGrid Component:**
   - Sortable columns:
     - Client Name (clickable → job detail)
     - Job Type
     - Location
     - Risk Score
     - Status
     - Created Date
   - Row highlighting for high-risk jobs
   - Hover prefetching (150ms delay)
   - Click row → navigate to detail

2. **Filtering:**
   - By status (active/completed/cancelled)
   - By risk level (low/medium/high/critical)
   - By date range

3. **Empty State:**
   - Calm, explanatory copy
   - Single CTA: "Create Your First Job"

4. **Performance:**
   - Prefetch on hover (max 2 concurrent)
   - SWR caching (30min stale time)
   - Skeleton loaders (300ms minimum)

---

## 2. Risk Assessment & Scoring

### 2.1 Risk Factor Library

**Purpose:** Comprehensive database of workplace hazards with severity ratings.

**How It Works:**

1. **Risk Factor Structure:**
   ```typescript
   {
     id: uuid
     code: string (unique identifier)
     name: string
     description: string
     severity: 'low' | 'medium' | 'high' | 'critical'
     category: string (e.g., "Height Safety", "Electrical")
     mitigation_steps: string[] (array of required actions)
     is_active: boolean
   }
   ```

2. **Categories:**
   - Height Safety
   - Electrical Hazards
   - Chemical Exposure
   - Confined Spaces
   - Heavy Machinery
   - Fire Safety
   - Environmental
   - Structural
   - And more...

3. **API:**
   ```
   GET /api/risk/factors
   ├── Returns all active risk factors
   ├── Cached via SWR (2 hour stale time)
   └── Grouped by category in UI
   ```

4. **Selection UI:**
   - Grouped by category
   - Checkbox selection
   - Search/filter capability
   - Shows severity badge for each

---

### 2.2 Risk Score Calculation

**Purpose:** Quantify job risk using weighted algorithm.

**Algorithm:**

1. **Input:** Array of selected risk factor codes
2. **Process:**
   ```javascript
   totalScore = 0
   for each selected factor:
     weight = SEVERITY_WEIGHTS[factor.severity]
     totalScore += weight
   
   overall_score = min(100, totalScore)
   risk_level = determineLevel(overall_score)
   ```

3. **Output:**
   ```typescript
   {
     overall_score: number (0-100)
     risk_level: 'low' | 'medium' | 'high' | 'critical'
     factors: Array<{
       code: string
       name: string
       severity: string
       weight: number
     }>
   }
   ```

4. **When Calculated:**
   - Job creation (if hazards selected)
   - Job update (if hazards changed)
   - Template application (recalculates)

5. **Storage:**
   - Saved to `job_risk_scores` table
   - Also stored on `jobs` table for quick access
   - Full breakdown in `risk_score_detail` JSONB field

---

### 2.3 Risk Score Display

**Purpose:** Visual representation of job risk.

**UI Components:**

1. **Hero Card:**
   - Large number (text-9xl, ~144px)
   - Color-coded:
     - Green: 0-40 (low)
     - Yellow: 41-70 (medium)
     - Orange: 71-90 (high)
     - Red: 91-100 (critical)
   - Risk level badge below score
   - Factor count indicator
   - Micro-divider
   - Helper text explaining calculation

2. **Factor Breakdown:**
   - List of contributing factors
   - Each shows:
     - Name
     - Severity indicator (colored dot)
     - Weight contribution (+X points)

3. **Mitigation Progress:**
   - Progress bar (X/Y completed)
   - Updates in real-time as items checked

---

## 3. Mitigation Management

### 3.1 Auto-Generated Mitigation Items

**Purpose:** Automatically create safety checklist from identified hazards.

**How It Works:**

1. **Generation Process:**
   ```
   When hazards selected:
   ├── Fetch risk factors with mitigation_steps
   ├── For each factor:
   │   ├── If mitigation_steps defined:
   │   │   └── Create one item per step
   │   └── Else:
   │       └── Create default: "Address [Factor Name]"
   └── Insert into mitigation_items table
   ```

2. **Mitigation Item Structure:**
   ```sql
   mitigation_items (
     id: uuid (PK)
     job_id: uuid (FK → jobs)
     risk_factor_id: uuid (FK → risk_factors)
     title: text
     description: text
     done: boolean
     is_completed: boolean
     created_at: timestamptz
     updated_at: timestamptz
   )
   ```

3. **UI Display:**
   - Checkbox list
   - Grouped every 4-5 items (visual spacing)
   - Unchecked: dimmed (opacity-90)
   - Checked: full opacity + strikethrough
   - Progress indicator: X/Y completed

---

### 3.2 Mitigation Completion

**Purpose:** Track which safety measures have been completed.

**How It Works:**

1. **User Action:**
   - Click checkbox on mitigation item
   - UI updates immediately (optimistic)
   - API call in background

2. **Backend Process:**
   ```
   PATCH /api/jobs/:id/mitigations/:mitigationId
   ├── Validates ownership
   ├── Updates done & is_completed flags
   ├── Updates job.updated_at
   └── Writes audit log: "mitigation.completed"
   ```

3. **Optimistic UI:**
   - Immediate visual feedback
   - Rollback on error
   - Toast notification

4. **Progress Tracking:**
   - Real-time calculation: completed/total
   - Displayed in risk score card
   - Updates as items checked

---

## 4. Template System

### 4.1 Template Types

**Purpose:** Save and reuse job configurations for repeat work.

**Two Template Types:**

1. **Job Templates:**
   - Pre-filled job details:
     - Job type
     - Client type
     - Description
     - Linked hazard templates
   - Use case: Standard job setups (e.g., "Roofing - Residential")

2. **Hazard Templates:**
   - Pre-selected risk factors
   - Use case: Common hazard combinations (e.g., "Working at Heights")

---

### 4.2 Template Creation

**Purpose:** Save current job setup as reusable template.

**How It Works:**

1. **From Job Detail:**
   - Click "Save as Template" (if hazards selected)
   - Modal opens with:
     - Template name
     - Template type (Job or Hazard)
     - Trade/category (optional)
   - Submit → Template saved

2. **From Templates Manager:**
   - Navigate to `/dashboard/account/templates`
   - Click "Create Template"
   - Choose type (Job or Hazard)
   - Fill in details
   - Select hazards (for Hazard templates)
   - Submit → Template saved

3. **Backend Process:**
   ```
   POST /api/templates (or direct Supabase insert)
   ├── Validates organization context
   ├── Creates template record:
   │   ├── name
   │   ├── type ('job' | 'hazard')
   │   ├── organization_id
   │   ├── hazard_ids (for hazard templates)
   │   └── job fields (for job templates)
   └── Writes audit log: "template.created"
   ```

4. **Database Schema:**
   ```sql
   job_templates (
     id: uuid (PK)
     organization_id: uuid (FK)
     name: text
     job_type: text
     client_type: text
     description: text
     hazard_template_ids: uuid[] (array)
     archived: boolean
     created_at: timestamptz
   )
   
   hazard_templates (
     id: uuid (PK)
     organization_id: uuid (FK)
     name: text
     trade: text (optional)
     hazard_ids: uuid[] (array of risk_factor IDs)
     archived: boolean
     created_at: timestamptz
   )
   ```

---

### 4.3 Template Application

**Purpose:** Apply saved template to new or existing job.

**How It Works:**

1. **User Flow:**
   - On job creation or detail page
   - Click "Apply Template"
   - Select template from dropdown
   - Template applied:
     - Job fields pre-filled (if job template)
     - Hazards added (if hazard template)
     - Risk score recalculated
     - Mitigation items generated

2. **Backend Process:**
   ```
   POST /api/jobs/:id/apply-template
   ├── Validates template ownership
   ├── If job template:
   │   ├── Updates job fields
   │   └── Applies linked hazard templates
   ├── If hazard template:
   │   └── Adds hazards to job
   ├── Recalculates risk score
   ├── Generates mitigation items
   ├── Updates job.applied_template_id
   └── Writes audit log: "template.applied"
   ```

3. **UI Feedback:**
   - Shows applied template badge
   - Inline template selector
   - Toast notification on success

---

### 4.4 Template Management

**Purpose:** Organize, archive, and duplicate templates.

**Features:**

1. **Templates Manager UI:**
   - Tabs: "Hazard Templates" / "Job Templates"
   - List view with:
     - Template name
     - Trade/category
     - Usage count (how many jobs use it)
     - Actions: Archive, Duplicate, Edit

2. **Archive:**
   - Hides from new job selection
   - Existing jobs still reference it
   - Can be unarchived
   - Confirmation modal for templates in use

3. **Duplicate:**
   - Creates copy with "- Copy" suffix
   - Same organization
   - Can be edited independently

4. **Edit:**
   - Modify name, hazards, fields
   - Updates all future applications
   - Doesn't affect existing jobs

---

## 5. Evidence & Document Management

### 5.1 Document Upload

**Purpose:** Attach photos and documents to jobs for compliance.

**How It Works:**

1. **Upload Flow:**
   - On job detail page
   - Click "Upload Evidence"
   - Select files (photos or PDFs)
   - Files uploaded to Supabase Storage:
     - Path: `{organization_id}/jobs/{job_id}/documents/{filename}`
   - Metadata saved to `documents` table

2. **Photo Optimization:**
   - Automatic compression
   - GPS metadata extraction (if available)
   - Thumbnail generation

3. **Document Structure:**
   ```sql
   documents (
     id: uuid (PK)
     job_id: uuid (FK → jobs)
     organization_id: uuid (FK)
     file_name: text
     file_path: text (Supabase Storage path)
     file_type: text (MIME type)
     file_size: integer (bytes)
     uploaded_by: uuid (FK → users)
     gps_location: jsonb (lat/lng if available)
     created_at: timestamptz
   )
   ```

4. **Display:**
   - Grid view with thumbnails
   - Click to view full size
   - Download option
   - Metadata: Uploader, date, location

---

### 5.2 Evidence Verification (Premium)

**Purpose:** Manager approval workflow for uploaded evidence.

**How It Works:**

1. **Status Flow:**
   ```
   Uploaded → Pending → Approved/Rejected
   ```

2. **Verification Process:**
   - **Managers (owner/admin):**
     - See all evidence with status
     - Can approve or reject
     - Rejection requires reason (optional but recommended)
   - **Members:**
     - Can upload evidence
     - Can see verification status
     - Cannot verify

3. **Backend:**
   ```
   POST /api/jobs/:id/evidence/:docId/verify
   ├── Validates role (owner/admin only)
   ├── Upserts into evidence_verifications:
   │   ├── status: 'approved' | 'rejected'
   │   ├── reviewed_by: user_id
   │   ├── reviewed_at: timestamp
   │   └── rejection_reason: text (if rejected)
   └── Writes audit log: "evidence.approved" | "evidence.rejected"
   ```

4. **Database:**
   ```sql
   evidence_verifications (
     id: uuid (PK)
     job_id: uuid (FK → jobs)
     document_id: uuid (FK → documents)
     organization_id: uuid (FK)
     status: text ('pending' | 'approved' | 'rejected')
     reviewed_by: uuid (FK → users)
     reviewed_at: timestamptz
     rejection_reason: text
     created_at: timestamptz
     updated_at: timestamptz
   )
   ```

5. **UI:**
   - Filter by status (all/pending/approved/rejected)
   - Badge indicators
   - Approve/Reject buttons (managers only)
   - Rejection modal with reason input
   - Optimistic UI updates

---

## 6. Premium Features

### 6.1 Job Assignment

**Purpose:** Assign workers to jobs for accountability tracking.

**How It Works:**

1. **Assignment Flow:**
   - On job detail page
   - Click "Assign Worker"
   - Searchable dropdown of team members
   - Select worker → Assigned immediately

2. **Backend:**
   ```
   POST /api/jobs/:id/assign
   ├── Validates role (owner/admin only)
   ├── Validates worker belongs to org
   ├── Inserts into job_assignments:
   │   ├── job_id
   │   ├── user_id (worker)
   │   ├── role: 'worker' (default)
   │   └── assigned_at: timestamp
   └── Writes audit log: "worker.assigned"
   
   DELETE /api/jobs/:id/assign
   ├── Validates role
   ├── Deletes assignment
   └── Writes audit log: "worker.unassigned"
   ```

3. **Database:**
   ```sql
   job_assignments (
     id: uuid (PK)
     job_id: uuid (FK → jobs)
     user_id: uuid (FK → users)
     role: text (default: 'worker')
     assigned_at: timestamptz
   )
   ```

4. **UI:**
   - List of assigned workers
   - Avatar chips with initials
   - Hover tooltips (name + email)
   - Remove button (with confirmation)
   - Empty state with assignment CTA
   - Optimistic UI updates

5. **Permissions:**
   - **Owner/Admin:** Can assign/unassign
   - **Member:** Can view assignments only

---

### 6.2 Version History

**Purpose:** Complete audit trail of all job changes.

**How It Works:**

1. **Event Tracking:**
   - Every meaningful action writes to `audit_logs`:
     - Job created/updated
     - Hazards added/removed
     - Mitigations completed
     - Evidence uploaded/approved/rejected
     - Workers assigned/unassigned
     - Templates applied
     - Reports generated
     - Status changes

2. **Audit Log Structure:**
   ```sql
   audit_logs (
     id: uuid (PK)
     organization_id: uuid (FK)
     actor_id: uuid (FK → users, nullable)
     actor_name: text (nullable)
     event_name: text
     target_type: text ('job' | 'document' | 'mitigation' | ...)
     target_id: uuid (nullable)
     metadata: jsonb
     created_at: timestamptz
   )
   ```

3. **API:**
   ```
   GET /api/jobs/:id/audit
   ├── Returns all audit entries for job
   ├── Sorted by created_at DESC
   ├── Limited to 100 most recent
   └── Filtered to job-related events
   ```

4. **UI Display:**
   - Timeline layout
   - Date grouping (Today, Yesterday, specific dates)
   - Icon per action type (color-coded)
   - Human-readable descriptions
   - Clickable references (where applicable)
   - Read-only (no editing)

5. **Lazy Loading:**
   - Loads on hover/scroll
   - Skeleton loader while fetching
   - Cached via SWR

---

### 6.3 Permit Packs (Business Plan Only)

**Purpose:** Generate comprehensive ZIP archive for permit applications.

**How It Works:**

1. **Generation Process:**
   ```
   POST /api/jobs/:id/permit-pack
   ├── Validates Business plan
   ├── Fetches all job data:
   │   ├── Job details
   │   ├── Hazards & risk factors
   │   ├── Mitigation items
   │   ├── Documents & photos
   │   └── Evidence verifications
   ├── Generates PDF report (if needed)
   ├── Creates CSVs:
   │   ├── hazard_checklist.csv
   │   ├── controls_applied.csv
   │   └── signatures.csv (if available)
   ├── Creates JSON:
   │   ├── job_details.json
   │   └── metadata.json
   ├── Organizes photos:
   │   ├── before/
   │   ├── during/
   │   └── after/
   ├── Organizes documents: /documents/
   ├── Streams ZIP to Supabase Storage
   ├── Returns signed download URL
   └── Writes audit log: "permit_pack.generated"
   ```

2. **ZIP Structure:**
   ```
   permit-pack-{jobId}-{timestamp}.zip
   ├── risk_snapshot.pdf
   ├── hazard_checklist.csv
   ├── controls_applied.csv
   ├── job_details.json
   ├── metadata.json
   ├── documents/
   │   └── [all uploaded documents]
   └── photos/
       ├── before/
       ├── during/
       └── after/
   ```

3. **UI:**
   - Progress modal with steps:
     - Compiling job data...
     - Processing photos...
     - Generating PDF report...
     - Collecting documents...
     - Creating ZIP archive...
     - Uploading to storage...
   - Success toast
   - Download button
   - History of previous packs

4. **Plan Gating:**
   - **Business plan only**
   - Starter/Pro see upgrade prompt

---

## 7. Team & Collaboration

### 7.1 Team Management

**Purpose:** Invite and manage team members.

**How It Works:**

1. **Team Structure:**
   - **Owner:** Full access, billing control
   - **Admin:** Full access except billing
   - **Member:** Limited access (view jobs, upload evidence)

2. **Invitation Flow:**
   ```
   POST /api/team/invite
   ├── Validates inviter role (owner/admin)
   ├── Checks seat limits (plan-dependent)
   ├── Creates invite record:
   │   ├── email
   │   ├── role
   │   ├── organization_id
   │   ├── invited_by
   │   └── token (unique)
   ├── Sends invitation email (if configured)
   └── Returns invite details
   ```

3. **Acceptance:**
   - User clicks invite link
   - Creates account (if new) or links existing
   - Joins organization
   - Invite marked as accepted

4. **Team UI:**
   - List of members with:
     - Name, email
     - Role badge
     - Join date
     - Actions: Remove (with confirmation)
   - List of pending invites
   - Invite form (email + role)
   - Seat usage indicator

5. **Permissions:**
   - **Owner/Admin:** Can invite, remove, change roles
   - **Member:** Redirected to dashboard (no access)

---

### 7.2 Role-Based Access Control

**Purpose:** Enforce permissions based on user role.

**Permission Matrix:**

| Feature | Owner | Admin | Member |
|---------|-------|-------|--------|
| Create Jobs | ✅ | ✅ | ✅ |
| Edit Jobs | ✅ | ✅ | ✅ |
| Delete Jobs | ✅ | ✅ | ❌ |
| Assign Workers | ✅ | ✅ | ❌ |
| Verify Evidence | ✅ | ✅ | ❌ |
| Generate Permit Packs | ✅ | ✅ | ❌ |
| Manage Team | ✅ | ✅ | ❌ |
| Billing/Subscription | ✅ | ❌ | ❌ |
| View Reports | ✅ | ✅ | ✅ |
| Upload Evidence | ✅ | ✅ | ✅ |

**Enforcement:**
- Frontend: UI elements hidden/disabled
- Backend: API routes check role
- Database: RLS policies enforce at query level

---

## 8. Reporting & Export

### 8.1 PDF Report Generation

**Purpose:** Generate audit-ready PDF reports for jobs.

**How It Works:**

1. **Generation:**
   ```
   POST /api/reports/generate/:id
   ├── Fetches complete job data
   ├── Generates PDF using PDFKit:
   │   ├── Cover page
   │   ├── Executive summary
   │   ├── Risk assessment
   │   ├── Hazards identified
   │   ├── Mitigation checklist
   │   ├── Evidence gallery
   │   └── Signatures (if available)
   ├── Uploads to Supabase Storage
   ├── Returns download URL
   └── Writes audit log: "report.generated"
   ```

2. **Report Contents:**
   - Job details (client, location, dates)
   - Risk score & level
   - Hazard breakdown
   - Mitigation checklist (with completion status)
   - Evidence photos/documents
   - Version history summary
   - Timestamps & audit trail

3. **UI:**
   - "View Audit-Ready Report" button
   - Opens in new tab
   - Download option
   - Shareable link (optional)

---

### 8.2 Report Sharing

**Purpose:** Share reports with external parties (inspectors, insurers).

**How It Works:**

1. **Share Link Generation:**
   ```
   POST /api/reports/share/:id
   ├── Generates signed token
   ├── Creates shareable link:
   │   └── /public/report/[token]
   ├── Returns link
   └── Writes audit log: "report.shared"
   ```

2. **Public View:**
   - No authentication required
   - Read-only
   - Same PDF content
   - Expires after set time (optional)

---

## 9. Account & Subscription Management

### 9.1 Subscription Plans

**Three Tiers:**

1. **Starter:**
   - $29/month
   - 10 jobs/month
   - Basic risk assessment
   - PDF reports
   - Team: 3 seats

2. **Pro:**
   - $79/month
   - Unlimited jobs
   - All Starter features
   - Advanced analytics
   - Team: 10 seats

3. **Business:**
   - $129/month
   - All Pro features
   - Permit Packs
   - Priority support
   - Team: Unlimited seats

---

### 9.2 Plan Management

**Purpose:** Upgrade, downgrade, or cancel subscriptions.

**How It Works:**

1. **Upgrade Flow:**
   ```
   POST /api/subscriptions/checkout
   ├── Creates Stripe checkout session
   ├── Returns checkout URL
   └── User redirected to Stripe
   
   On success:
   ├── Stripe webhook fires
   ├── Updates subscription record
   ├── Unlocks premium features
   └── Sends confirmation email
   ```

2. **Downgrade:**
   - Via Stripe customer portal
   - Immediate feature restrictions
   - Data preserved

3. **Cancellation:**
   - Via Stripe customer portal
   - Access until period end
   - Data export available

---

### 9.3 Account Settings

**Purpose:** Manage profile and organization details.

**Features:**

1. **Profile:**
   - Full name
   - Email (read-only)
   - Phone number
   - Role (read-only)

2. **Organization:**
   - Organization name
   - Billing address
   - Tax ID (optional)

3. **Templates Tab:**
   - Manage job/hazard templates
   - Create, edit, archive, duplicate

---

## 10. Analytics & Dashboard

### 10.1 Dashboard Overview

**Purpose:** High-level view of organization's safety operations.

**Widgets:**

1. **KPI Grid:**
   - Total jobs
   - Active jobs
   - High-risk jobs
   - Completion rate
   - Average time to close

2. **Trend Chart:**
   - Jobs over time
   - Risk score trends
   - Completion rates

3. **Top Hazards:**
   - Most frequent risk factors
   - Last 30 days
   - With frequency counts

4. **Recent Jobs:**
   - Latest 5-10 jobs
   - Quick access cards
   - Status indicators

5. **Evidence Widget:**
   - Jobs with/without evidence
   - Pending verifications (managers)

---

### 10.2 Analytics API

**Purpose:** Aggregate data for dashboard widgets.

**Endpoints:**

```
GET /api/analytics/mitigations
├── Returns completion rates
├── Time-to-complete metrics
└── Grouped by time period

GET /api/analytics/summary
├── Job counts by status
├── Risk level distribution
├── Evidence statistics
└── Team activity
```

**Caching:**
- SWR with 5-minute stale time
- Revalidates on focus
- Background refresh

---

## 11. Security & Compliance

### 11.1 Authentication

**How It Works:**

1. **Supabase Auth:**
   - Email/password
   - Magic links (optional)
   - Session management
   - JWT tokens

2. **Protected Routes:**
   - `ProtectedRoute` component wrapper
   - Redirects to login if unauthenticated
   - Preserves intended destination

3. **Session Validation:**
   - Every API call validates token
   - Expired tokens → 401
   - Auto-refresh (handled by Supabase)

---

### 11.2 Row-Level Security (RLS)

**Purpose:** Database-level data isolation.

**How It Works:**

1. **Organization Scoping:**
   - Every table has `organization_id`
   - RLS policies enforce:
     ```sql
     CREATE POLICY "Users can only access their org's data"
     ON jobs
     FOR ALL
     USING (organization_id = auth.jwt() ->> 'organization_id');
     ```

2. **Enforced Tables:**
   - `jobs`
   - `documents`
   - `mitigation_items`
   - `job_assignments`
   - `evidence_verifications`
   - `templates`
   - `audit_logs`

3. **Benefits:**
   - No cross-org data leakage
   - Enforced at database level
   - Works even if API bypassed

---

### 11.3 Audit Logging

**Purpose:** Immutable record of all actions.

**What's Logged:**

- Job created/updated/deleted
- Hazards added/removed
- Mitigations completed
- Evidence uploaded/approved/rejected
- Workers assigned/unassigned
- Templates created/applied/archived
- Reports generated
- Permit packs generated
- Status changes
- User actions (login, logout, etc.)

**Log Structure:**
```typescript
{
  id: uuid
  organization_id: uuid
  actor_id: uuid (who did it)
  actor_name: string
  event_name: string (what happened)
  target_type: string (what was affected)
  target_id: uuid
  metadata: jsonb (additional context)
  created_at: timestamptz
}
```

**Properties:**
- Append-only (cannot be deleted/modified)
- Organization-scoped
- Used for compliance, legal, insurance
- Powers Version History UI

---

### 11.4 Data Privacy

**Measures:**

1. **GDPR Compliance:**
   - Data export (user can request)
   - Data deletion (on account closure)
   - Consent tracking (legal acceptance)

2. **Data Retention:**
   - Jobs: Retained per organization policy
   - Audit logs: Permanent (compliance requirement)
   - Documents: Retained with job

3. **Backup & Recovery:**
   - Daily automated backups
   - Point-in-time recovery
   - Encrypted at rest

---

## Technical Architecture

### Frontend Stack

- **Framework:** Next.js 15.1.9 (App Router)
- **UI:** React 18, Framer Motion
- **Styling:** Tailwind CSS
- **State:** React Hooks, SWR (caching)
- **Forms:** React controlled components
- **Routing:** Next.js navigation

### Backend Stack

- **API:** Next.js API Routes
- **Database:** Supabase (PostgreSQL)
- **Storage:** Supabase Storage
- **Auth:** Supabase Auth
- **Payments:** Stripe
- **PDF Generation:** PDFKit

### Performance Optimizations

1. **Caching:**
   - SWR for API responses
   - Stale-while-revalidate pattern
   - Cache invalidation on mutations

2. **Prefetching:**
   - Hover-based prefetch (150ms delay)
   - Max 2 concurrent prefetches
   - Route prefetching

3. **Loading States:**
   - Skeleton loaders (300ms minimum)
   - Progressive loading
   - Optimistic UI updates

4. **Error Handling:**
   - Retry on network errors (GET only)
   - Graceful degradation
   - User-friendly error messages

---

## API Endpoint Summary

| Endpoint | Method | Auth | Role | Plan |
|----------|--------|------|------|------|
| `/api/jobs` | POST | ✅ | Any | Starter+ |
| `/api/jobs/:id` | GET | ✅ | Org member | Any |
| `/api/jobs/:id` | PATCH | ✅ | Org member | Any |
| `/api/jobs/:id/assign` | POST | ✅ | Owner/Admin | Any |
| `/api/jobs/:id/assign` | DELETE | ✅ | Owner/Admin | Any |
| `/api/jobs/:id/evidence/:docId/verify` | POST | ✅ | Owner/Admin | Any |
| `/api/jobs/:id/audit` | GET | ✅ | Org member | Any |
| `/api/jobs/:id/permit-pack` | POST | ✅ | Owner/Admin | Business |
| `/api/jobs/:id/permit-packs` | GET | ✅ | Org member | Business |
| `/api/risk/factors` | GET | ✅ | Any | Any |
| `/api/reports/generate/:id` | POST | ✅ | Org member | Any |
| `/api/team` | GET | ✅ | Owner/Admin | Any |
| `/api/team/invite` | POST | ✅ | Owner/Admin | Any |
| `/api/subscriptions` | GET | ✅ | Owner | Any |
| `/api/subscriptions/checkout` | POST | ✅ | Owner | Any |

---

## Database Schema Overview

**Core Tables:**
- `organizations` - Organization records
- `users` - User accounts
- `jobs` - Job records
- `job_risk_scores` - Risk calculations
- `mitigation_items` - Safety checklists
- `risk_factors` - Hazard library
- `documents` - Uploaded files
- `job_assignments` - Worker assignments
- `evidence_verifications` - Evidence approvals
- `audit_logs` - Version history
- `job_templates` - Job templates
- `hazard_templates` - Hazard templates
- `subscriptions` - Plan subscriptions
- `team_invites` - Pending invitations

**Relationships:**
- All tables scoped by `organization_id`
- Foreign keys enforce referential integrity
- RLS policies enforce access control

---

## Conclusion

RiskMate is a comprehensive safety compliance platform with:

✅ **Complete job lifecycle management**  
✅ **Automated risk assessment & scoring**  
✅ **Template system for repeat work**  
✅ **Evidence verification workflow**  
✅ **Full audit trail (Version History)**  
✅ **Permit pack generation (Business plan)**  
✅ **Team collaboration & permissions**  
✅ **Enterprise-grade security (RLS, audit logs)**  
✅ **Plan-based feature gating**  
✅ **Performance optimizations (caching, prefetching)**

**Status:** Production-ready, enterprise-grade, inspector-safe.

---

**Last Updated:** January 15, 2025  
**Version:** 1.0  
**Status:** ✅ Complete

