# Epic Brief: Technical Fixes & Phase 2 Features

**Created:** February 5, 2026  
**Status:** In Progress  
**Owner:** Engineering

---

## 1. Problem Statement

### Phase 1: Production Stability Issues
- **Export 500s:** Proof pack and ledger exports occasionally return 500 errors, often due to missing DB columns or migrations not applied.
- **Export 401s:** Web export endpoints (audit, proof-packs, incidents, access, enforcement-reports) return 401 when clients send `Authorization: Bearer <token>` because `getOrganizationContext()` is called without the request object, so it only checks cookies and fails for token-based auth.
- **API exposure:** Backend lacks rate limiting; export and other endpoints are vulnerable to abuse.
- **Error handling:** Generic 500 responses make debugging and support difficult; no structured retry guidance for clients.

### Phase 2: Feature Gaps
- **Before/After photo distinction:** Field evidence photos lack category metadata (`before`, `after`, `other`), making it hard for auditors to understand remediation context.
- **Living job log / activity tracking:** No real-time audit trail or activity feed for jobs; compliance teams lack visibility into who did what and when.
- **Team signatures:** Report runs exist but lack robust signature capture (web canvas + iOS native), PDF integration, and team workflow (Prepared By, Reviewed By, Approved By).

---

## 2. Success Criteria

| Phase | Criteria |
|-------|----------|
| **Phase 1** | Export endpoints succeed consistently; 401 on token-based requests fixed; rate limiting in place; structured errors with retry hints. |
| **Phase 2** | Before/after photos labeled and surfaced in PDFs; job activity feed shows events; team signatures captured, stored, and rendered in proof packs. |

---

## 3. Acceptance Criteria

### Phase 1: Technical Fixes

| # | Item | Acceptance |
|---|------|------------|
| 1.1 | **Export migration** | Migration `20260201000000_ensure_exports_requested_at.sql` applied; exports table has `requested_at` column; no 500s from missing column on insert. |
| 1.2 | **Web auth headers** | ✅ Done. All export routes pass `request` to `getOrganizationContext(request)`; token-based clients receive 200 when valid Bearer token is sent. |
| 1.3 | **Rate limiting** | API endpoints have configurable rate limits; 429 returned with Retry-After when exceeded. |
| 1.4 | **Enhanced error handling** | Errors include `code`, `requestId`, `retryable` flag; 5xx responses include support-friendly `X-Error-ID`. |

### Phase 2: Features

#### Before/After Photos (Week 1)
| # | Item | Acceptance |
|---|------|------------|
| 2.1 | **Schema** | `evidence` (or equivalent) has `photo_category` enum: `before`, `after`, `other`. |
| 2.2 | **UI** | Photo upload/capture allows selecting category; existing photos can be re-categorized. |
| 2.3 | **PDF** | Proof pack PDF has distinct "Before" and "After" sections; thumbnails labeled accordingly. |

#### Living Job Log (Week 2)
| # | Item | Acceptance |
|---|------|------------|
| 2.4 | **Events** | Job events (created, status changed, evidence added, mitigation completed, export generated) written to audit/compliance ledger. |
| 2.5 | **Feed** | Job detail page shows activity feed; real-time updates via Supabase Realtime or polling. |
| 2.6 | **Filtering** | Activity feed filterable by event type and actor. |

#### Team Signatures (Week 3)
| # | Item | Acceptance |
|---|------|------------|
| 2.7 | **Capture** | Web: canvas signature pad; iOS: native signature capture. |
| 2.8 | **Storage** | Signatures stored in `report_signatures` with role, signer, timestamp, hash. |
| 2.9 | **PDF** | Signatures rendered in proof pack PDF; roles (Prepared By, Reviewed By, Approved By) visible. |

---

## 4. Core Flows

### 4.1 Before/After Photo Flow
```
1. User opens job → Evidence tab
2. User taps "Add Photo" or selects existing photo
3. User chooses category: Before | After | Other (default: Other)
4. Photo saved with photo_category
5. On proof pack export:
   - PDF sections: "Before Photos" → before photos
   - "After Photos" → after photos
   - "Other Evidence" → other
```

### 4.2 Activity / Living Job Log Flow
```
1. User performs action (create job, add evidence, complete mitigation, export)
2. Backend writes audit event with job_id, actor_id, event_name, metadata
3. Job detail page loads activity feed (GET /api/jobs/:id/activity or similar)
4. Feed displays: timestamp, actor, action, optional metadata
5. Optional: Supabase Realtime subscription for live updates
```

### 4.3 Team Signature Flow
```
1. User generates proof pack / report run → status: draft
2. User opens "Sign" flow
3. For each role (Prepared By, Reviewed By, Approved By):
   - Signer enters name, title
   - Signs on canvas (web) or native pad (iOS)
   - Confirms → signature saved to report_signatures
4. When all required roles signed → report run status: final
5. PDF generation includes signature blocks with SVG data
```

---

## 5. Dependencies & Risks

- **Migrations:** Must be applied to Supabase (staging + prod) before deploy.
- **Web auth fix:** Zero-risk; additive behavior (header + cookie).
- **Rate limiting:** May need tuning for high-traffic orgs.
- **Team signatures:** iOS native capture requires Swift implementation; web canvas already exists per TEAM_SIGNATURES_IMPLEMENTATION.md.

---

## 6. Out of Scope (This Epic)

- Multi-organization support
- Mobile offline sync improvements
- New subscription tiers

---

## 7. References

- [TEAM_SIGNATURES_IMPLEMENTATION.md](./TEAM_SIGNATURES_IMPLEMENTATION.md)
- [COMPLETE_FEATURE_SPECIFICATION.md](./COMPLETE_FEATURE_SPECIFICATION.md)
- [MULTI_TENANT_ARCHITECTURE.md](./MULTI_TENANT_ARCHITECTURE.md)
- Migration: `supabase/migrations/20260201000000_ensure_exports_requested_at.sql`
