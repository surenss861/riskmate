# QA — Premium Feel (single source of truth)

Run these checks before release to keep iOS and web aligned.

## iOS

- **B1 Dashboard:** Hero strip count-up; badge shelf; cards stagger; tap haptic.
- **B2 Operations:** Today panel state animation; coach marks once; FAB single haptic on expand.
- **B3 Jobs:** Chips (High Risk, Blockers, etc.); high-risk glow on cards; pull-to-refresh.
- **B4 Job detail:** Overview ring + next action; Activity stagger + New chip; Evidence bar; Signatures stamp; Tasks complete animation.
- **B5 Ledger/Proof:** Receipt seal (Hashing → Verified); copy hash + toast; integrity parallax; export receipt sealing.
- **B6 Team:** Member cards + role pills; Request signature 3-step sheet; success haptic on send.
- **B7 Account:** Header card; streak badge or empty state; entitlements card + skeleton; recent exports; danger zone + type DELETE.
- **B8 Notifications:** Today / This Week / Older; swipe read + pin; new insert animation; Reduce Motion = fade only.
- **Reduce Motion:** No slide offsets; no shimmer when reduced; fades only where specified.
- **Sheets:** RMSheetShell everywhere (Evidence, Signature, ExportProof, ProofDetail, ExportHistory, RequestSignature, Invite, DeleteAccount). Same header spacing, blur, close affordance; no random nav bars; Reduce Motion = no y-offset on enter; no double haptics on open/close.
- **Voice (iOS):** RMSearchBar mic opens dictation sheet (RMSheetShell); transcript lands in search field; Stop works; permission prompts handled; one light haptic on start/stop.

## Web

- **Route transitions:** Page enter opacity + y (or opacity only when Reduce Motion); exit opacity + y.
- **Card hover:** Clickable cards translateY -1 to -2px; press scale 0.98.
- **Skeleton shimmer:** Duration 1.25, opacity 0.22; only on content blocks; disabled when Reduce Motion.
- **Proof seal demo:** Hashing → Locked → Verified (0.5s / 0.5s); Reduce Motion = final state.
- **Reduce Motion:** prefers-reduced-motion respected; no decorative motion when reduced.
- **Voice (web):** Global search (Cmd+K) mic button when SpeechRecognition supported; transcript fills search field; Stop on second mic tap or when recognition ends; if unsupported, mic hidden.

## Cross-platform

- Motion numbers match `docs/MOTION_TOKENS.md` (0.14 / 0.22 / 0.32, staggerStep 0.045, shimmer 1.25 / 0.22).
- Success moments: toast or clear feedback; single haptic on completion (no spam).
