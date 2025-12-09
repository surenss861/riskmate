# Templates System - Testing Checklist

## ✅ Step 1: Apply Template on Job Detail - COMPLETE

**Feature**: Apply Template button in Risk & Hazards section
- ✅ Modal with Job/Hazard template tabs
- ✅ Search and filter templates
- ✅ Preview of hazards before applying
- ✅ Append vs Replace toggle
- ✅ API endpoint `/api/jobs/[id]/apply-template`
- ✅ Auto-recalculate risk score
- ✅ Generate new mitigations
- ✅ Audit log entry

---

## 🧪 Step 2: Testing Checklist

### A. New Job + Template Flow

#### Test 1: Create Job from Template
- [ ] Navigate to `/dashboard/jobs/new`
- [ ] Select a job template from dropdown
- [ ] Verify job fields are pre-filled:
  - [ ] Job type matches template
  - [ ] Client type matches template
  - [ ] Description matches template (if provided)
- [ ] Verify hazards are selected:
  - [ ] Check risk factors section shows selected hazards
  - [ ] Count matches template hazard count
- [ ] Submit job
- [ ] Navigate to job detail
- [ ] Verify risk score is calculated correctly
- [ ] Verify mitigation items are generated

#### Test 2: Create Job from Hazard Template
- [ ] Create a hazard template with 5+ hazards
- [ ] Create new job
- [ ] Select hazard template (if available in dropdown)
- [ ] Verify hazards are applied
- [ ] Complete job creation
- [ ] Verify all hazards are present in job detail

#### Test 3: Create Job Without Template
- [ ] Create job from scratch (no template)
- [ ] Verify form is empty
- [ ] Add hazards manually
- [ ] Verify job creates successfully

---

### B. Job Detail + Apply Template Flow

#### Test 4: Apply Template to Empty Job
- [ ] Create job with no hazards
- [ ] Navigate to job detail
- [ ] Click "Apply Template" in Risk & Hazards section
- [ ] Select a job template
- [ ] Verify preview shows all hazards
- [ ] Click "Apply Template"
- [ ] Verify:
  - [ ] Hazards are added to job
  - [ ] Risk score recalculates
  - [ ] Mitigation items are generated
  - [ ] Job detail page updates

#### Test 5: Apply Template (Append Mode)
- [ ] Create job with 2 existing hazards
- [ ] Navigate to job detail
- [ ] Click "Apply Template"
- [ ] Select template with 3 hazards (2 overlapping, 1 new)
- [ ] Verify preview shows:
  - [ ] 2 existing hazards (marked as "will be skipped")
  - [ ] 1 new hazard to add
- [ ] Leave "Replace existing" unchecked
- [ ] Click "Apply Template"
- [ ] Verify:
  - [ ] No duplicate hazards
  - [ ] All 3 unique hazards are present
  - [ ] Risk score includes all hazards
  - [ ] Mitigations for new hazard are added

#### Test 6: Apply Template (Replace Mode)
- [ ] Create job with 3 existing hazards
- [ ] Navigate to job detail
- [ ] Click "Apply Template"
- [ ] Select template with 2 different hazards
- [ ] Check "Replace existing hazards"
- [ ] Click "Replace & Apply"
- [ ] Verify:
  - [ ] Old hazards are removed
  - [ ] Only template hazards are present (2 total)
  - [ ] Risk score recalculates
  - [ ] Old mitigations are removed
  - [ ] New mitigations are generated

#### Test 7: Apply Hazard Template
- [ ] Create hazard template
- [ ] Create job with some hazards
- [ ] Navigate to job detail
- [ ] Click "Apply Template"
- [ ] Switch to "Hazard Templates" tab
- [ ] Select hazard template
- [ ] Apply template
- [ ] Verify hazards are added correctly

---

### C. Edge Cases

#### Test 8: Template with No Hazards
- [ ] Create template with 0 hazards
- [ ] Try to apply to job
- [ ] Verify error message or disabled state

#### Test 9: All Hazards Already Present
- [ ] Create job with hazards A, B, C
- [ ] Create template with hazards A, B, C
- [ ] Apply template (append mode)
- [ ] Verify:
  - [ ] No duplicates
  - [ ] Preview shows "all hazards already applied"
  - [ ] Job remains unchanged

#### Test 10: Large Template (30+ Hazards)
- [ ] Create template with 30+ hazards
- [ ] Apply to job
- [ ] Verify:
  - [ ] No performance issues
  - [ ] All hazards are added
  - [ ] Risk score calculates correctly
  - [ ] Page doesn't freeze

#### Test 11: Deleted/Archived Template
- [ ] Create job using template
- [ ] Archive the template
- [ ] Verify:
  - [ ] Job still has its hazards (no cascade delete)
  - [ ] Template doesn't appear in Apply Template modal
  - [ ] Existing jobs are unaffected

---

### D. Multi-Org Safety

#### Test 12: Cross-Org Template Access
- [ ] Create template in Org A
- [ ] Switch to Org B (or create new org)
- [ ] Try to apply Org A's template
- [ ] Verify:
  - [ ] Template doesn't appear in list
  - [ ] Cannot access template via API
  - [ ] RLS blocks access

#### Test 13: Template Isolation
- [ ] Create template in Org A
- [ ] Note template ID
- [ ] Try to access template directly in Org B
- [ ] Verify 404 or access denied

---

### E. Performance

#### Test 14: Risk Score Recalculation Speed
- [ ] Apply template with 20+ hazards
- [ ] Measure time from click to score update
- [ ] Verify completes in < 2 seconds

#### Test 15: Mitigation Generation Speed
- [ ] Apply template with many hazards
- [ ] Verify mitigations generate quickly
- [ ] Check no UI freezing

---

### F. Audit Logging

#### Test 16: Template Applied Event
- [ ] Apply template to job
- [ ] Check audit log
- [ ] Verify entry:
  - [ ] `event_name = 'template.applied'`
  - [ ] `target_type = 'job'`
  - [ ] `target_id = job_id`
  - [ ] `metadata` contains template_id, template_type, hazard_count

---

## 🔒 Step 3: Plan Gating (To Implement)

### Test Cases for Plan Gating

#### Test 17: Starter Plan Limit (3 Templates)
- [ ] Sign up as Starter plan
- [ ] Create 3 templates (hazard + job combined)
- [ ] Try to create 4th template
- [ ] Verify:
  - [ ] API returns 402 error
  - [ ] Frontend shows upgrade prompt
  - [ ] Redirect to pricing page

#### Test 18: Pro Plan (Unlimited)
- [ ] Upgrade to Pro
- [ ] Create 10+ templates
- [ ] Verify all templates save successfully

#### Test 19: Apply Template (No Restriction)
- [ ] As Starter plan
- [ ] Apply templates to jobs (even if you didn't create them)
- [ ] Verify:
  - [ ] Can use any template
  - [ ] Only creation is restricted, not usage

---

## 🐛 Known Issues to Watch For

1. **Hazard ID vs Code Mismatch**: Templates store hazard_ids (UUIDs), but risk scoring uses codes. Verify conversion works.
2. **Duplicate Mitigations**: When appending, ensure mitigations don't duplicate.
3. **Risk Score Caching**: Ensure score updates immediately after template apply.
4. **Empty Template Handling**: Templates with 0 hazards should be handled gracefully.

---

## 📝 Test Results Template

For each test:
- **Status**: ✅ Pass / ❌ Fail / ⚠️ Partial
- **Notes**: Any issues found
- **Screenshots**: If visual bugs
- **Console Errors**: Any JS errors

---

**Last Updated**: December 2024
**Tester**: [Your Name]
**Environment**: Production / Staging

