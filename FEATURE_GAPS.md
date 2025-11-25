# RiskMate Feature Gap Analysis

This document identifies gaps between the current implementation and the complete RiskMate vision as a safety + job risk management platform.

## ✅ Implemented Features

### Core Job Management
- ✅ Job creation with client info, location, job type
- ✅ Risk factor selection and automatic risk scoring
- ✅ Mitigation checklist generation
- ✅ Job status tracking (draft, pending, in_progress, completed, cancelled)
- ✅ Risk level classification (low, medium, high, critical)

### Documentation & Evidence
- ✅ Document upload (photos, insurance certificates, waivers, etc.)
- ✅ Photo storage in Supabase Storage
- ✅ Timestamped document creation
- ✅ Document type classification

### Reporting
- ✅ PDF report generation
- ✅ Shareable report links (7-day expiry)
- ✅ Public read-only report viewer
- ✅ Live report page with real-time updates
- ✅ Report snapshots for audit trail

### Team & Access
- ✅ Team member management
- ✅ Role-based access (owner, admin, member)
- ✅ Team invites with temporary passwords
- ✅ Seat limits enforcement
- ✅ Member restrictions (no account/team access)

### Billing & Plans
- ✅ Stripe integration
- ✅ Plan-based feature gating
- ✅ Job limit enforcement
- ✅ Subscription status tracking
- ✅ Webhook handling for subscription updates

### Analytics (Business Plan)
- ✅ Compliance rate tracking
- ✅ Mitigation completion trends
- ✅ Evidence health metrics
- ✅ High-risk job alerts

## ⚠️ Feature Gaps

### 1. Team Signatures
**Status**: ❌ Not Implemented

**Required**:
- Digital signature capture for team members on job completion
- Signature storage with timestamp
- Signature display in reports
- Multiple signatures per job (supervisor, crew lead, etc.)

**Impact**: High - Critical for compliance and accountability

**Suggested Implementation**:
- Add `signatures` table with `job_id`, `user_id`, `signature_data` (base64 or SVG), `signed_at`
- Add signature capture UI component (canvas-based)
- Include signatures in PDF reports
- Add signature requirement to job completion workflow

### 2. Before/After Photo Distinction
**Status**: ⚠️ Partially Implemented

**Current State**: 
- Photos can be uploaded with `type: 'photo'`
- No distinction between "before job" and "after job" photos
- No photo categorization in UI

**Required**:
- Separate "Before Job" and "After Job" photo sections
- Photo timestamp categorization
- Before/after comparison in reports
- Photo upload workflow that prompts for before/after context

**Impact**: Medium - Important for compliance documentation

**Suggested Implementation**:
- Add `photo_category` field to documents table: `'before' | 'after' | 'during' | 'other'`
- Update document upload UI to require category selection
- Separate photo galleries in job detail view
- Include before/after sections in PDF reports

### 3. Living Job Log / Activity Tracking
**Status**: ⚠️ Partially Implemented

**Current State**:
- Audit logs exist for major events
- No real-time activity feed visible to users
- No "job log" view showing chronological activity

**Required**:
- Real-time activity feed per job
- Chronological log of all job changes
- Who did what, when
- Site changes tracking
- New hazard additions during job
- Photo uploads with context
- Mitigation completions

**Impact**: Medium - Important for "living job log" concept

**Suggested Implementation**:
- Enhance `audit_logs` table to include more granular events
- Create job activity feed component
- Add real-time subscriptions for job activity
- Display activity timeline in job detail view
- Include activity log in reports

### 4. Enhanced Safety Checklist Workflow
**Status**: ⚠️ Partially Implemented

**Current State**:
- Risk factors can be selected
- Mitigation items are auto-generated
- No guided step-by-step safety checklist

**Required**:
- Step-by-step safety checklist wizard
- Required controls checklist (PPE, lockout, etc.)
- Pre-job safety sign-off
- Post-job completion checklist
- Mandatory items before job can start

**Impact**: High - Core to safety compliance

**Suggested Implementation**:
- Add `safety_checklist_items` table
- Create guided checklist UI component
- Add job status workflow: `pre_job_checklist` → `in_progress` → `post_job_checklist` → `completed`
- Require checklist completion before job status changes
- Include checklist in reports

### 5. Job-Specific Notes & Observations
**Status**: ⚠️ Partially Implemented

**Current State**:
- Job has `description` field
- No structured notes/observations system
- No notes tied to specific events or timestamps

**Required**:
- Structured notes system
- Notes tied to specific events (hazard identified, control implemented, etc.)
- Notes with timestamps and authors
- Notes visible in activity log

**Impact**: Low-Medium - Useful for detailed documentation

**Suggested Implementation**:
- Add `job_notes` table with `job_id`, `user_id`, `note_text`, `note_type`, `created_at`
- Add notes UI in job detail view
- Link notes to specific events (mitigation items, hazards, etc.)

### 6. Crew Activity Tracking
**Status**: ❌ Not Implemented

**Required**:
- Track who's on-site
- Track who submitted what (photos, notes, mitigations)
- Crew member assignments to jobs
- Activity attribution

**Impact**: Medium - Important for accountability

**Suggested Implementation**:
- Add `job_crew_members` junction table
- Add crew assignment UI
- Track all job actions with `user_id`
- Display crew activity in job log
- Include crew roster in reports

### 7. Required Controls Checklist
**Status**: ❌ Not Implemented

**Required**:
- PPE checklist (hard hat, safety glasses, gloves, etc.)
- Lockout/tagout verification
- Equipment checks
- Site access controls
- Mandatory controls before job start

**Impact**: High - Critical for safety compliance

**Suggested Implementation**:
- Add `required_controls` table with job-specific controls
- Create controls checklist UI
- Require controls completion before job can proceed
- Include controls in reports

### 8. Enhanced Report Sections
**Status**: ⚠️ Partially Implemented

**Current State**:
- Basic report with job info, risk score, mitigations, photos
- Missing some key sections

**Required**:
- Before/after photo comparison section
- Team signatures section
- Safety checklist completion section
- Required controls verification section
- Crew roster section
- Activity timeline section

**Impact**: Medium - Important for comprehensive reports

**Suggested Implementation**:
- Enhance `buildJobReport` function
- Add new sections to PDF generator
- Update report template

## 📋 Priority Recommendations

### High Priority (Core Safety Features)
1. **Team Signatures** - Essential for compliance
2. **Enhanced Safety Checklist** - Core workflow
3. **Required Controls Checklist** - Safety requirement

### Medium Priority (Documentation Enhancement)
4. **Before/After Photo Distinction** - Better organization
5. **Living Job Log** - Activity visibility
6. **Enhanced Report Sections** - Comprehensive documentation

### Low Priority (Nice to Have)
7. **Job-Specific Notes** - Additional context
8. **Crew Activity Tracking** - Enhanced accountability

## 🎯 Next Steps

1. Create database migrations for missing tables (signatures, required_controls, job_notes, etc.)
2. Implement signature capture component
3. Add before/after photo categorization
4. Enhance safety checklist workflow
5. Build activity feed component
6. Update report generation to include new sections

---

**Last Updated**: November 12, 2025

