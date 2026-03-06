# TestFlight QA checklist (post audit fixes)

Use this after deploying the Comments redesign, Ledger headers/fallback, Export toggles, and Tab strip cleanup.

## Comments
- [ ] Open empty comments state
- [ ] Type a comment → send button enables only when text is valid
- [ ] Post succeeds and list refreshes
- [ ] Mention picker appears when `@` is typed
- [ ] Composer dock stays clean above keyboard
- [ ] Load existing comments, post reply, edit, delete
- [ ] Auth-expired flow (no fake “couldn’t load comments”)
- [ ] Keyboard / safe-area on real device

## Ledger
- [ ] “Today” / date bars span full width
- [ ] Scroll feels smooth through a long list
- [ ] Ugly summaries like “Job Created for job” show improved fallback (e.g. “Job created: [name]”)
- [ ] Actor/subtitle doesn’t show useless “Unknown” when metadata has a fallback

## Export
- [ ] Proof pack / export sheet spacing looks clean; toggles clearly separate
- [ ] Generate PDF → **verify downloaded artifact is actually PDF, not JSON**
- [ ] If user gets JSON when they chose PDF → backend artifact-selection bug (see below)

## Job detail
- [ ] Tab strip looks cleaner; selected tab obvious; no muddy grey banding

---

## Export PDF vs JSON – backend invariant

**Invariant:** `requested format == delivered artifact format`

If the UI says PDF and the user gets JSON, the backend is returning the wrong artifact URL. iOS cannot fix this by UI.

**Backend verification:**
1. Export request payload includes requested format.
2. Export record stores requested format.
3. Download/open endpoint returns the artifact that matches requested format.
4. Export history does not “grab first artifact” regardless of format.

**Fix applied (backend):** POST /api/jobs/:id/export/pdf now sets export_type to `pdf`; worker has a `pdf` branch that generates the single-job Risk Snapshot PDF. Requested format now matches delivered artifact.

**To trace the exact mismatch:** share either
- the export backend route/handler, or  
- the export response model + history/download logic  

so the mismatch can be pinned (e.g. which field is used for “download URL” and whether it’s format-specific).
