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

### B1) DashboardView — "Command center"

| Task | File(s) | Acceptance criteria |
|------|--------|---------------------|
| Hero strip: audit readiness + risk delta (30d) | `Views/Main/DashboardView.swift` | Animated count-up (light); ticking "Last synced" |
| Badge shelf | `DashboardView` + `HolographicBadgeView` | Horizontally scrollable badges; drag tilt (already); no hijack of swipe-back |
| Cards appear with stagger | `DashboardView` | Use `.rmAppearIn(staggerIndex:)` for top 6–10 widgets; cap stagger at 12 |
| Tap-to-drill | `DashboardView` | Each card: micro haptic + push into filtered Jobs / Ledger |

### B2) OperationsView — FAB + coach marks

| Task | File(s) | Acceptance criteria |
|------|--------|---------------------|
| "Today" panel state animation | `Views/Main/OperationsView.swift` | "0 blockers" → "2 blockers" color shift + soft animation |
| Coach marks | `Components/Operations/OperationsCoachMarks.swift` (or inline) | Show once; flag in `UserDefaultsManager`; don't block FAB |
| FAB snap haptic | `FloatingEvidenceFAB.swift` | Single haptic on expand threshold (already); no double on long-press + drag |

### B3) JobsListView — List browsing ✅ Package 1 done

| Task | File(s) | Acceptance criteria | Status |
|------|--------|---------------------|--------|
| Search quick chips | `RMFilterChips.swift` (new) + `JobsListView` | "High Risk", "Blockers", "Needs Signature", "Recent"; rmPressable + spring | ✅ |
| Pull-to-refresh | `AnchoringRefreshState.swift` + list | Haptic on refresh already; optional: slim strip with pull distance (custom scroll) | Deferred |
| Live inserts | `JobsListView` + RealtimeEventService | New items animate in when realtime wired | When realtime ready |
| High-risk glow | `JobCard.swift` | Subtle stroke (opacity 0.28) for high/critical risk; no pulse | ✅ |

### B4) JobDetailView — Tabs polish ✅ Package 2 done

| Task | File(s) | Acceptance criteria | Status |
|------|--------|---------------------|--------|
| Overview: evidence ring + next action | `RMEvidenceProgressRing.swift`, `RMNextActionCard.swift`, `OverviewTab` | Ring (overallPct); next-action card (evidence → signature); onSelectTab | ✅ |
| Activity: stagger + "New" chip | `JobActivityView.swift` | `.rmAppearIn(staggerIndex: min(i,12))`; "New activity" chip 0.6s, gated by lastPulsedEventId | ✅ |
| Evidence: upload bar smoothing | `EvidenceUploadStatusBar.swift` | `.animation(RMMotion.easeOut, value: statusText)` | ✅ |
| Signatures: "Signed" stamp | `JobSignaturesView.swift` | Overlay "SIGNED" with springSoft, fades after 1.2s; single haptic | ✅ |
| Tasks: complete animation | `JobTasksView.swift` | Row → "Completed" chip 0.22s then loadTasks() | ✅ |

### B5) Ledger / Proof — Cinematic but clean ✅ Package 3 done

| Task | File(s) | Acceptance criteria | Status |
|------|--------|---------------------|--------|
| Receipt "seal" on open | `ProofReceiptDetailsView.swift` | "Hashing…" then "Verified" strip; Reduce Motion = instant; once per appear | ✅ |
| Copy hash | `ProofReceiptDetailsView`, `VerificationDetailsView`, `LedgerReceiptCard` | Tap → copy → toast "Copied" + `Haptics.impact(.light)` | ✅ |
| Integrity parallax | `RMIntegritySurface`, `ExportsTab` + `ScrollOffsetPreferenceKey` | 2–4px background layer; Reduce Motion = off | ✅ |
| Export receipt sealing | `ExportReceiptView.swift` | Hashing… → Locked → Verified on first appear; Reduce Motion = final state | ✅ |
| *Micro-tweaks* | | Confidence line: "Verifying ledger chain" / "Computing receipt hash"; copy affordance (trailing icon + "Tap to copy" that fades after first copy); seal/parallax comments | ✅ |

### B6) TeamView — Workspace feel ✅ Package 7 done

| Task | File(s) | Acceptance criteria | Status |
|------|--------|---------------------|--------|
| Members as cards + role pills | `TeamMemberCard.swift`, `RolePill.swift`, `TeamView.swift` | Card layout; avatar (initials); role pills; rmPressable + stagger (cap 12) | ✅ |
| Request signature flow | `RequestSignatureSheet.swift`, `RMSheetHeader.swift` | 3 steps: Select signers → Choose what (job/proof/general) → Confirm & send; toast + success haptic on send | ✅ |
| Team signatures sheet | `TeamSignaturesSheet.swift` | RMSheetHeader; success haptic on signature saved | ✅ |
| Toolbar | `TeamView` | Primary = Request signature; trailing = Invite (sheet) | ✅ |
| **QA** | | Cards with role pills; request signature sheet has header + steps; success toast + haptic; Reduce Motion fades only; no gesture conflicts | |

### B7) AccountView — Productized ✅ Package 8 done

| Task | File(s) | Acceptance criteria | Status |
|------|--------|---------------------|--------|
| Account header | `AccountHeaderCard.swift`, `AccountView` | Avatar, name, email, org; quick actions: Support bundle, Notification prefs, Sign out; rmAppearIn(0), rmPressable | ✅ |
| Streak section | `AccountView`, `HolographicBadgeView` | Holographic badge when streak > 0; calm empty state when 0 ("Start by logging…"); meaningful-event logic | ✅ |
| Plan + entitlements | `EntitlementCard.swift`, `EntitlementsManager` | Plan name, renewal, limits (seats, jobs/month), features; skeleton while loading; "Manage plan" → web billing URL | ✅ |
| Recent exports | `AccountView`, `BackgroundExportManager` | "Recent proof packs" top 3; "View all" opens `ExportHistoryOverviewView`; tap row opens sheet | ✅ |
| Danger zone | `DangerZoneCard.swift`, `DeleteAccountSheet` | Delete opens sheet; type DELETE to confirm; Haptics.warning on open, success on completion | ✅ |
| **QA** | | Header + quick actions; streak badge or empty; entitlements card + skeleton; recent exports + view all; danger zone deliberate; Reduce Motion | |

### B8) Notifications — Modern list ✅ Package 6 done

| Task | File(s) | Acceptance criteria | Status |
|------|--------|---------------------|--------|
| Grouping | `NotificationCenterView.swift`, `NotificationSection` | "Today" / "This Week" / "Older"; empty sections hidden; `.rmSectionHeader()` | ✅ |
| Swipe actions | `NotificationCenterView` | Mark read / Unread + Pin (toggle); light haptic; pin stored in `UserDefaultsManager.Notifications` | ✅ |
| New item animation | `NotificationCenterView`, `NewInsertModifier` | `.rmAppearIn(staggerIndex: 0)` on insert; optional "New" chip; Reduce Motion = fade only | ✅ |
| Row design | `Components/Premium/NotificationRow.swift`, `NotificationType.iconName/iconColor` | Leading icon by type, headline, subheadline, trailing time + unread dot | ✅ |
| **QA** | | Notifications grouped correctly; swipe read/pin + light haptic; new inserts animate (when realtime set); Reduce Motion no slide; no list jank when swiping | |

---

## Phase C — Voice & dictation

| Task | File(s) | Acceptance criteria |
|------|--------|---------------------|
| Dictation in search | `RMSearchBar.swift` + `Services/VoiceSearchService.swift` (new) | Mic → start dictation; sheet with waveform + examples; result fills search; Reduce Motion: no waveform, state only |
| Scope | Search + comments | Don't overbuild; keep first version scoped |

---

## Phase D — Web alignment (scaffold done)

| Task | Location | Acceptance criteria | Status |
|------|----------|---------------------|--------|
| D0 Motion tokens | `lib/motionTokens.ts`, `lib/reduceMotion.ts` | Numbers from MOTION_TOKENS.md; prefersReducedMotion() | Done |
| D1 Route transitions | `components/motion/PageTransition.tsx`, root layout | Page enter/exit; Reduce Motion opacity only | Done |
| D2 Card hover | `components/motion/PressableCard.tsx` | translateY -2px, scale 0.98 on tap | Done |
| D3 Skeleton shimmer | `components/motion/SkeletonShimmer.tsx`, globals.css | Duration 1.25, opacity 0.22 | Done |
| D4 Proof seal | `components/proof/ProofSealStatus.tsx` | Hashing to Locked to Verified | Scaffold done |
| QA doc | `docs/QA_PREMIUM_FEEL.md` | Web + iOS QA bullets | Done |

---

## Phase E — QA: "Feels premium" script

Run on a **real device** every release:

- [ ] Switch main tabs quickly — no stutter
- [ ] JobsList → JobDetail — no teleport; hero exists on first frame
- [ ] Switch job tabs rapidly — no animation overlap
- [ ] Post comment + resolve — one haptic; correct animations
- [ ] Upload evidence — progress smooth; completion feedback
- [ ] Generate export — receipt moment feels satisfying
- [ ] **Reduce Motion** on — no shimmer; no y-offset; no parallax; seal/receipt shows final state instantly; toggling in Settings updates without restart
- [ ] **Package 3:** Opening proof receipt shows hashing → verified (or instant with Reduce Motion); copy hash → "Copied" toast + light haptic; Integrity parallax subtle and clamped, off when Reduce Motion; seal does not repeat on back/forward
- [ ] Voice mic — doesn't block UI; feels guided (when implemented)
- [ ] FAB drag in scroll view — doesn't steal vertical scroll
- [ ] Holographic badge drag in horizontal list — doesn't hijack swipe-back

---

## Edge cases (from plan)

| Item | Where | Note |
|------|--------|------|
| Matched geometry IDs | Job list + JobDetail | Use `job.id` only; no reorder animation during push |
| Haptic fatigue | App-wide | "Success" only for meaningful events (already scoped) |
| Proof Pack "signature" | `ExportReceiptView` | ✅ Implemented: Hashing… → Locked → Verified on first appear |

---

## Optional "signature" moment: Proof Pack sealing ✅ Done (Package 3)

**Where:** `Views/Exports/ExportReceiptView.swift`  
**Done:** On first appear: "Hashing…" (0.5s) → "Locked" (0.5s) → full IntegrityStatusCard "Verified". Reduce Motion: show final state immediately. Gated by `hasSealCompleted` so it does not repeat on back/forward.

---

*Phase A (custom tab bar, reactive Reduce Motion, gesture coherence) is done. Use this checklist for Phases B–E and the QA script before each release.*
