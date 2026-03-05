# Polished PR Summary (copy/paste for commit / PR)

## Fixes

### Operations — Search bar visibility
- **Bug:** `.searchable` was attached to the inner List (inside `fieldOperationsContent`), so the search UI was bound to the nested scroll view and rendered under custom chrome.
- **Fix:** Moved `.searchable` to the OperationsView root (same container that owns `.safeAreaInset(edge: .top)` + `.toolbar(.hidden)`).
- **Detail:** Forced `placement: .navigationBarDrawer(displayMode: .always)` so the search drawer remains available even when the system bar is hidden.

### Account — “Manage plan” deep link
- **Before:** Opened `WebAppURL.billingURL` via `UIApplication.shared.open`.
- **After:** Uses SwiftUI’s `@Environment(\.openURL)` and `openURL(WebAppURL.billingURL)` for a cleaner/safer flow.
- **UI:** Updated the CTA label to `Label("Manage plan", systemImage: "arrow.up.right")` to clearly indicate an external destination.

### Operations — Top-of-page anchor
- Added a compact status line between Quick actions and Jobs: **“Last updated · X ago · 0 open issues”** (switches to **“N need attention”** when blockers exist).
- Driven by `jobsStore.lastSyncDate` and `blockerCount` to prevent the area above Jobs from feeling empty.

---

## Deploy
- Commit + push triggered deploy.
- If needed locally: `./scripts/deploy.sh "Operations search fix, Manage plan openURL + icon, anchor line"`

---

## Future-proof notes (in code)
- **Billing URL:** `WebAppURL.billingURL` is the single source of truth; if path changes (e.g. `/settings/billing` → `/billing`), update only there.
- **Search + hidden nav bar:** Keep `NavigationStack` alive, use `.toolbar(.hidden, for: .navigationBar)` (not `navigationBarHidden(true)`), and keep `.searchable` on the root view.
