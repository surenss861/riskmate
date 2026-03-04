# Premium Feel Upgrade Checklist (Phase B–E)

Phase A (global layer) is implemented: custom tab bar (`RMTabBar`), reactive Reduce Motion (`RMMotionObserver`), gesture coherence (FAB + `HolographicBadgeView`). This doc is the **file-by-file checklist** for Phases B–E so the app feels premium on every main surface.

**Conventions**
- **Press** = `rmPressable` only (no extra scale).
- **Enter** = `rmAppearIn(staggerIndex:)` only.
- **Selection** = `RMMotion.spring`.
- **Loading** = skeleton + shimmer on content block only.
- Every meaningful action ends with a **receipt moment** (toast or card).

---

## Phase B — Screen-by-screen upgrades

### B1) DashboardView — “Command center”

| Task | File(s) | Acceptance criteria |
|------|--------|---------------------|
| Hero strip: audit readiness + risk delta (30d) | `Views/Main/DashboardView.swift` | Animated count-up (light); ticking “Last synced” |
| Badge shelf | `DashboardView` + `HolographicBadgeView` | Horizontally scrollable badges; drag tilt (already); no hijack of swipe-back |
| Cards appear with stagger | `DashboardView` | Use `.rmAppearIn(staggerIndex:)` for top 6–10 widgets; cap stagger at 12 |
| Tap-to-drill | `DashboardView` | Each card: micro haptic + push into filtered Jobs / Ledger |

### B2) OperationsView — FAB + coach marks

| Task | File(s) | Acceptance criteria |
|------|--------|---------------------|
| “Today” panel state animation | `Views/Main/OperationsView.swift` | “0 blockers” → “2 blockers” color shift + soft animation |
| Coach marks | `Components/Operations/OperationsCoachMarks.swift` (or inline) | Show once; flag in `UserDefaultsManager`; don’t block FAB |
| FAB snap haptic | `FloatingEvidenceFAB.swift` | Single haptic on expand threshold (already); no double on long-press + drag |

### B3) JobsListView — List browsing ✅ Package 1 done

| Task | File(s) | Acceptance criteria | Status |
|------|--------|---------------------|--------|
| Search quick chips | `RMFilterChips.swift` (new) + `JobsListView` | “High Risk”, “Blockers”, “Needs Signature”, “Recent”; rmPressable + spring | ✅ |
| Pull-to-refresh | `AnchoringRefreshState.swift` + list | Haptic on refresh already; optional: slim strip with pull distance (custom scroll) | Deferred |
| Live inserts | `JobsListView` + RealtimeEventService | New items animate in when realtime wired | When realtime ready |
| High-risk glow | `JobCard.swift` | Subtle stroke (opacity 0.28) for high/critical risk; no pulse | ✅ |

### B4) JobDetailView — Tabs polish ✅ Package 2 done

| Task | File(s) | Acceptance criteria | Status |
|------|--------|---------------------|--------|
| Overview: evidence ring + next action | `RMEvidenceProgressRing.swift`, `RMNextActionCard.swift`, `OverviewTab` | Ring (overallPct); next-action card (evidence → signature); onSelectTab | ✅ |
| Activity: stagger + “New” chip | `JobActivityView.swift` | `.rmAppearIn(staggerIndex: min(i,12))`; “New activity” chip 0.6s, gated by lastPulsedEventId | ✅ |
| Evidence: upload bar smoothing | `EvidenceUploadStatusBar.swift` | `.animation(RMMotion.easeOut, value: statusText)` | ✅ |
| Signatures: “Signed” stamp | `JobSignaturesView.swift` | Overlay “SIGNED” with springSoft, fades after 1.2s; single haptic | ✅ |
| Tasks: complete animation | `JobTasksView.swift` | Row → “Completed” chip 0.22s then loadTasks() | ✅ |

### B5) Ledger / Proof — Cinematic but clean ✅ Package 3 done

| Task | File(s) | Acceptance criteria | Status |
|------|--------|---------------------|--------|
| Receipt “seal” on open | `ProofReceiptDetailsView.swift` | “Hashing…” then “Verified” strip; Reduce Motion = instant; once per appear | ✅ |
| Copy hash | `ProofReceiptDetailsView`, `VerificationDetailsView`, `LedgerReceiptCard` | Tap → copy → toast “Copied” + `Haptics.impact(.light)` | ✅ |
| Integrity parallax | `RMIntegritySurface`, `ExportsTab` + `ScrollOffsetPreferenceKey` | 2–4px background layer; Reduce Motion = off | ✅ |
| Export receipt sealing | `ExportReceiptView.swift` | Hashing… → Locked → Verified on first appear; Reduce Motion = final state | ✅ |

### B6) TeamView — Workspace feel

| Task | File(s) | Acceptance criteria |
|------|--------|---------------------|
| Members as cards + role pills | `Views/Main/TeamView.swift` | Card layout; role pills; optional presence dot |
| Request signature flow | `TeamSignaturesSheet` | Sheet header + clear steps; guided feel |

### B7) AccountView — Productized

| Task | File(s) | Acceptance criteria |
|------|--------|---------------------|
| Streak section | `Views/Main/AccountView.swift` | Already planned; ensure UTC + meaningful events only |
| Plan + entitlement card | `AccountView` + `EntitlementsManager` | Single card for plan / entitlement |
| Danger zone | `AccountView` | Confirm sheet; strong typography; no jank |

### B8) Notifications — Modern list

| Task | File(s) | Acceptance criteria |
|------|--------|---------------------|
| Grouping | `Views/Main/NotificationCenterView.swift` | “Today” / “This Week” |
| Swipe actions | `NotificationCenterView` | Mark read; pin (if supported by API) |
| New item animation | `NotificationCenterView` | Slide in + fade for new notification |

---

## Phase C — Voice & dictation

| Task | File(s) | Acceptance criteria |
|------|--------|---------------------|
| Dictation in search | `RMSearchBar.swift` + `Services/VoiceSearchService.swift` (new) | Mic → start dictation; sheet with waveform + examples; result fills search; Reduce Motion: no waveform, state only |
| Scope | Search + comments | Don’t overbuild; keep first version scoped |

---

## Phase D — Web alignment

| Task | Location | Acceptance criteria |
|------|----------|---------------------|
| Route transitions | Web (Framer Motion) | Use `docs/MOTION_TOKENS.md` |
| Card hover | Web | translateY 1–2px; shadow bloom |
| Skeleton shimmer | Web | Match iOS durations from MOTION_TOKENS |
| Proof Pack “sealing” | Web export demo | Micro-animation on export complete |

---

## Phase E — QA: “Feels premium” script

Run on a **real device** every release:

- [ ] Switch main tabs quickly — no stutter
- [ ] JobsList → JobDetail — no teleport; hero exists on first frame
- [ ] Switch job tabs rapidly — no animation overlap
- [ ] Post comment + resolve — one haptic; correct animations
- [ ] Upload evidence — progress smooth; completion feedback
- [ ] Generate export — receipt moment feels satisfying
- [ ] **Reduce Motion** on — no shimmer; no y-offset; no parallax; seal/receipt shows final state instantly; toggling in Settings updates without restart
- [ ] **Package 3:** Opening proof receipt shows hashing → verified (or instant with Reduce Motion); copy hash → “Copied” toast + light haptic; Integrity parallax subtle and clamped, off when Reduce Motion; seal does not repeat on back/forward
- [ ] Voice mic — doesn’t block UI; feels guided (when implemented)
- [ ] FAB drag in scroll view — doesn’t steal vertical scroll
- [ ] Holographic badge drag in horizontal list — doesn’t hijack swipe-back

---

## Edge cases (from plan)

| Item | Where | Note |
|------|--------|------|
| Matched geometry IDs | Job list + JobDetail | Use `job.id` only; no reorder animation during push |
| Haptic fatigue | App-wide | “Success” only for meaningful events (already scoped) |
| Proof Pack “signature” | `ExportReceiptView` | ✅ Implemented: Hashing… → Locked → Verified on first appear |

---

## Optional “signature” moment: Proof Pack sealing ✅ Done (Package 3)

**Where:** `Views/Exports/ExportReceiptView.swift`  
**Done:** On first appear: “Hashing…” (0.5s) → “Locked” (0.5s) → full IntegrityStatusCard “Verified”. Reduce Motion: show final state immediately. Gated by `hasSealCompleted` so it does not repeat on back/forward.

---

*Phase A (custom tab bar, reactive Reduce Motion, gesture coherence) is done. Use this checklist for Phases B–E and the QA script before each release.*
