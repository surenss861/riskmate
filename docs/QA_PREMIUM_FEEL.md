# Release QA — Premium Feel (iOS + Web)

Run before every TestFlight / production push.

## iOS

### Navigation + motion

- **Dashboard:** Hero count-up (once), badge shelf, cards stagger, tap haptic feels light.
- **Operations:** Today panel animates state changes; coach marks show once; FAB expand haptic fires once per gesture.
- **Jobs:** Quick chips work + persist; high-risk glow only on risky jobs; pull-to-refresh feels smooth.
- **Job detail:**
  - Overview ring updates + next action routes correctly
  - Activity stagger + “New” chip (no spam)
  - Evidence status transitions smooth
  - Signature stamp shows once + one haptic
  - Task completion shows “Completed” chip then refreshes

### Proof / exports

- **Proof receipt:** Hashing → Verified runs once; copy hash shows toast + light haptic; parallax subtle (2–4px).
- **Export receipt:** Hashing → Locked → Verified runs once (Reduce Motion = final state).

### Screens

- **Team:** Member cards + role pills; Request Signature 3-step sheet; success haptic on send.
- **Account:** Header card; streak badge or empty state; entitlements card (skeleton → loaded); recent exports; delete requires typing DELETE.
- **Notifications:** Today/This Week/Older; swipe read + pin; new insert anim; pinned ordering.

### Global checks

- **Reduce Motion ON:** No y-offset transitions; shimmer disabled; fades only.
- **Sheets:** RMSheetShell everywhere (Evidence, Signature, Export, Proof, Export History, Request Signature, Invite, Delete). Same header/blur/close; no mixed nav bars; no open/close haptic spam.

### Voice (iOS)

- Mic visible only when enabled.
- Permission prompts work on fresh install.
- Dictation sheet opens, transcript updates, “Stop and use” fills search.
- One light haptic on start/stop.

## Web

### Motion + UI feel

- **Route transitions:** Enter opacity + y, exit opacity + y (Reduce Motion = opacity only).
- **PressableCard:** Hover -1 to -2px; press scale 0.98.
- **Skeleton shimmer:** Duration 1.25, opacity 0.22; content blocks only; disabled with Reduce Motion.
- **ProofSealStatus:** Hashing → Locked → Verified (0.5s / 0.5s); Reduce Motion = final state.

### Voice (web)

- Cmd+K global search: mic only when supported + enabled.
- Transcript fills search; stop on second tap or auto-end.
- Unsupported → mic hidden.

## Cross-platform alignment

- Motion tokens match `docs/MOTION_TOKENS.md` (0.14 / 0.22 / 0.32, stagger 0.045, shimmer 1.25/0.22).
- Success feedback: toast/receipt moment + single completion haptic.

## Hardening switches + breadcrumbs

- **Web flag:** `NEXT_PUBLIC_ENABLE_VOICE_SEARCH=false` disables mic/voice.
- **iOS flag:** `ENABLE_VOICE_SEARCH_IOS=false` in Info.plist disables voice (per-build; not runtime).
- **Breadcrumbs:** voice_start, voice_stop, voice_permission_denied; sheet_open, sheet_close (with sheet name).
