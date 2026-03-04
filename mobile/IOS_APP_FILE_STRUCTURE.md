# RiskMate iOS App — File Structure

High-level layout of the iOS app (SwiftUI) under `mobile/`. Excludes build artifacts and user-specific Xcode data.

```
mobile/
├── Riskmate/
│   ├── Riskmate.xcodeproj/          # Xcode project
│   └── Riskmate/
│       ├── RiskmateApp.swift        # App entry, deep links, evidence sheet
│       ├── Config.swift             # Build/config
│       ├── Config.plist
│       ├── Info.plist
│       │
│       ├── Models/                  # Domain models
│       │   ├── Job.swift
│       │   ├── User.swift
│       │   ├── Organization.swift
│       │   ├── Team.swift
│       │   ├── Notification.swift
│       │   ├── Executive.swift
│       │   ├── Readiness.swift
│       │   ├── SyncConflict.swift
│       │   └── SyncOperation.swift
│       │
│       ├── Services/                # API, auth, sync, background
│       │   ├── APIClient.swift
│       │   ├── APIEnvelope.swift
│       │   ├── AuthService.swift
│       │   ├── SessionManager.swift
│       │   ├── ServerStatusManager.swift
│       │   ├── EntitlementsManager.swift
│       │   ├── SyncEngine.swift
│       │   ├── OfflineCache.swift
│       │   ├── OfflineDatabase.swift
│       │   ├── BackgroundUploadManager.swift
│       │   ├── BackgroundExportManager.swift
│       │   ├── AuditExporter.swift
│       │   ├── NotificationService.swift
│       │   ├── DeepLinkRouter.swift
│       │   ├── Analytics.swift
│       │   ├── RealtimeEventService.swift
│       │   ├── RetryManager.swift
│       │   ├── JWTExpiry.swift
│       │   ├── FilterPersistence.swift
│       │   └── CrashReporting.swift
│       │
│       ├── State/
│       │   └── QuickActionRouter.swift
│       │
│       ├── Stores/
│       │   └── JobsStore.swift
│       │
│       ├── ViewModels/
│       │   └── DashboardViewModel.swift
│       │
│       ├── Utils/
│       │   ├── Haptics.swift
│       │   ├── RBAC.swift
│       │   ├── UserDefaultsManager.swift
│       │   ├── WebAppHelpers.swift
│       │   ├── AuditorMode.swift
│       │   └── ExportErrorMessages.swift
│       │
│       ├── Theme/                   # Design system
│       │   ├── RMTheme.swift
│       │   ├── RMSystemTheme.swift
│       │   ├── RiskMateDesignSystem.swift
│       │   ├── DesignSystem.swift    # Color(hex:), tokens
│       │   ├── View+RMStyle.swift
│       │   ├── View+MicroInteractions.swift
│       │   └── View+Accessibility.swift
│       │
│       ├── Components/              # Reusable UI
│       │   ├── Premium/             # Job cards, tab bar, badges
│       │   │   ├── JobCard.swift
│       │   │   ├── JobRow.swift
│       │   │   ├── JobDetailTabBar.swift
│       │   │   ├── HolographicBadgeView.swift
│       │   │   ├── JobCardLongPressActions.swift
│       │   │   ├── RMCard.swift
│       │   │   ├── RMButton.swift
│       │   │   ├── RMSearchBar.swift
│       │   │   ├── SyncChip.swift
│       │   │   ├── LiveSyncStatus.swift
│       │   │   ├── LongPressHint.swift
│       │   │   ├── CriticalRiskBanner.swift
│       │   │   ├── VerificationBanner.swift
│       │   │   ├── AnchoringRefreshState.swift
│       │   │   └── LedgerReceiptCard.swift
│       │   ├── Evidence/
│       │   │   ├── EvidenceQuickBar.swift
│       │   │   ├── EvidenceUploadStatusBar.swift
│       │   │   └── StepIndicator.swift
│       │   ├── Ledger/
│       │   │   ├── LedgerTrustStrip.swift
│       │   │   ├── TickingTimestamp.swift
│       │   │   ├── VerificationExplainerSheet.swift
│       │   │   └── FirstVisitAnimationView.swift
│       │   ├── Operations/
│       │   │   ├── OperationsHeaderView.swift
│       │   │   ├── FloatingEvidenceFAB.swift
│       │   │   ├── OperationsCoachMarks.swift
│       │   │   └── ScrollOffsetPreferenceKey.swift
│       │   ├── Onboarding/
│       │   │   └── CoachMark.swift
│       │   ├── Toast/
│       │   │   ├── ToastCenter.swift
│       │   │   └── ToastView.swift
│       │   ├── UIKit/
│       │   │   ├── VisualEffectBlur.swift
│       │   │   └── ShareSheet.swift
│       │   ├── Auditor/
│       │   │   └── ReadOnlyBanner.swift
│       │   ├── Animations/
│       │   │   └── AppearIn.swift
│       │   ├── Debug/
│       │   │   └── DebugOverlay.swift
│       │   ├── RMEmptyState.swift
│       │   ├── RMSkeletonView.swift
│       │   ├── RMEvidenceCapture.swift
│       │   ├── RMPDFViewer.swift
│       │   ├── RMPhotoPicker.swift
│       │   ├── RMChartCard.swift
│       │   ├── RMPremiumList.swift
│       │   ├── RMOfflineBanner.swift
│       │   ├── RiskMateLogo.swift
│       │   ├── AnchoredProofSymbol.swift
│       │   ├── RMLottieView.swift
│       │   ├── RMRiveView.swift
│       │   ├── RMLedgerIntegrity.swift
│       │   ├── RMIntegritySurface.swift
│       │   ├── RMTrustReceipt.swift
│       │   ├── RMTrustToast.swift
│       │   ├── RMRecordedStrip.swift
│       │   ├── RMSyncStatusChip.swift
│       │   ├── RMEvidenceRequirements.swift
│       │   ├── RMProofFirstTile.swift
│       │   ├── RMImageLoader.swift
│       │   └── RMPremiumList.swift
│       │
│       ├── Views/
│       │   ├── Main/                # Root navigation, tabs, job list/detail
│       │   │   ├── ContentView.swift
│       │   │   ├── OperationsView.swift
│       │   │   ├── JobsListView.swift
│       │   │   ├── JobDetailView.swift
│       │   │   ├── DashboardView.swift
│       │   │   ├── AuditFeedView.swift
│       │   │   ├── AuditView.swift
│       │   │   ├── ExecutiveView.swift
│       │   │   ├── ExecutiveViewRedesigned.swift
│       │   │   ├── ReadinessView.swift
│       │   │   ├── TeamView.swift
│       │   │   ├── AccountView.swift
│       │   │   ├── NotificationCenterView.swift
│       │   │   ├── CreateJobSheet.swift
│       │   │   └── EditJobSheet.swift
│       │   ├── Auth/
│       │   │   ├── AuthView.swift
│       │   │   ├── AuthHeroShell.swift
│       │   │   └── AuthRail.swift
│       │   ├── Job/                 # Job detail tabs
│       │   │   ├── JobActivityView.swift
│       │   │   ├── JobCommentsView.swift
│       │   │   ├── JobSignaturesView.swift
│       │   │   ├── JobTasksView.swift
│       │   │   └── MentionsListView.swift
│       │   ├── Evidence/
│       │   │   └── EvidenceCaptureSheet.swift
│       │   ├── Signatures/
│       │   │   ├── SignatureCaptureSheet.swift
│       │   │   └── TeamSignaturesSheet.swift
│       │   ├── Exports/
│       │   │   ├── ExportProofSheet.swift
│       │   │   ├── ExportHistorySheet.swift
│       │   │   └── ExportReceiptView.swift
│       │   ├── Ledger/
│       │   │   ├── ProofDetailSheet.swift
│       │   │   ├── ProofReceiptDetailsView.swift
│       │   │   └── VerificationDetailsView.swift
│       │   ├── Sync/
│       │   │   ├── SyncQueueView.swift
│       │   │   ├── ConflictHistoryView.swift
│       │   │   └── ConflictResolutionSheet.swift
│       │   ├── Onboarding/
│       │   │   ├── TrustOnboardingView.swift
│       │   │   ├── OnboardingView.swift
│       │   │   ├── FirstRunOnboardingView.swift
│       │   │   └── SetupChecklistView.swift
│       │   ├── Settings/
│       │   │   ├── NotificationPreferencesView.swift
│       │   │   ├── TermsOfServiceView.swift
│       │   │   ├── PrivacyPolicyView.swift
│       │   │   ├── SupportBundleView.swift
│       │   │   ├── DeleteAccountSheet.swift
│       │   │   ├── EntitlementsDebugView.swift
│       │   │   └── EnvironmentDebugView.swift
│       │   └── Shared/
│       │       ├── RMBackground.swift
│       │       ├── SplashView.swift
│       │       ├── RMPrimaryButton.swift
│       │       ├── RMTextField.swift
│       │       ├── RMAuthTextField.swift
│       │       └── RMGlassCard.swift
│       │
│       RiskmateTests/
│       RiskmateUITests/
```

## Key areas

- **Entry & nav:** `RiskmateApp.swift`, `ContentView.swift` (tabs: Operations, Ledger, Work Records, Settings).
- **Job flow:** `JobsListView` → `JobDetailView` (tabs: Overview, Activity, Signatures, Evidence, Tasks, Comments). Tab bar: `JobDetailTabBar.swift`.
- **Auth:** `AuthView.swift`, `AuthHeroShell.swift`.
- **Evidence:** `EvidenceCaptureSheet`, `RMEvidenceCapture`, `BackgroundUploadManager`.
- **Signatures / export:** `SignatureCaptureSheet`, `JobSignaturesView`, `ExportProofSheet`, `BackgroundExportManager`.
- **Comments:** `JobCommentsView` (chat-style bubbles, resolve, long-press menu).
- **Design:** `RMTheme`, `RMSystemTheme`, `View+RMStyle`, `View+MicroInteractions`; haptics in `Haptics.swift`.
- **Gamification:** `HolographicBadgeView.swift`, `RiskMateBadges` / `StreakBadge`.
