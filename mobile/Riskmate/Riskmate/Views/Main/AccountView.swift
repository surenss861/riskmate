import SwiftUI

struct AccountView: View {
    @Environment(\.openURL) private var openURL
    @StateObject private var sessionManager = SessionManager.shared
    @StateObject private var entitlementsManager = EntitlementsManager.shared
    @StateObject private var exportManager = BackgroundExportManager.shared

    @State private var isEditingOrgName = false
    @State private var editedOrgName = ""
    @State private var showError = false
    @State private var errorMessage = ""
    @State private var isLoading = false
    @State private var showSignOutConfirmation = false
    @State private var showDeleteAccountConfirmation = false
    @State private var deleteConfirmationText = ""
    @State private var isDeletingAccount = false
    @State private var showExportHistorySheet = false

    private var recentExports: [ExportTask] {
        Array(exportManager.exports.sorted { $0.createdAt > $1.createdAt }.prefix(3))
    }

    private var versionString: String {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "Unknown"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "Unknown"
        return "\(version) (\(build))"
    }
    
    private var buildChannel: String {
        #if DEBUG
        return "Development"
        #else
        // Check if TestFlight
        if Bundle.main.appStoreReceiptURL?.lastPathComponent == "sandboxReceipt" {
            return "TestFlight"
        }
        return "Production"
        #endif
    }
    
    var body: some View {
        ZStack {
            RMBackground()

            ScrollView(showsIndicators: false) {
                VStack(spacing: RMTheme.Spacing.lg) {
                    // 1) Account header (identity + quick actions)
                    if let user = sessionManager.currentUser {
                        AccountHeaderCard(
                            userName: user.full_name ?? user.email ?? "Account",
                            userEmail: user.email,
                            organizationName: sessionManager.currentOrganization?.name,
                            onSupportBundle: { /* NavigationLink handled below */ },
                            onNotificationPrefs: { /* NavigationLink handled below */ },
                            onSignOut: {
                                showSignOutConfirmation = true
                            }
                        )
                        .padding(.horizontal, RMTheme.Spacing.pagePadding)
                    }

                    // 2) Streak section
                    streakSection
                        .padding(.horizontal, RMTheme.Spacing.pagePadding)

                    // 3) Plan + entitlements
                    EntitlementCard(
                        entitlements: entitlementsManager.entitlements,
                        isLoading: entitlementsManager.isLoading,
                        onManagePlan: {
                            openURL(WebAppURL.billingURL)
                        }
                    )
                    .padding(.horizontal, RMTheme.Spacing.pagePadding)

                    // 4) Recent exports
                    recentExportsSection
                        .padding(.horizontal, RMTheme.Spacing.pagePadding)

                    // Organization, Privacy/Terms, Danger zone, Version
                    accountListContent
                }
                .padding(.bottom, 100)
            }
            .scrollContentBackground(.hidden)
            .navigationTitle("Account")
            .navigationBarTitleDisplayMode(.large)
            .refreshable {
                await sessionManager.refreshOrganization()
                await entitlementsManager.refresh(force: true)
            }
            .confirmationDialog("Sign Out", isPresented: $showSignOutConfirmation, titleVisibility: .visible) {
                Button("Sign Out", role: .destructive) {
                    Haptics.warning()
                    Task { await sessionManager.logout() }
                }
                Button("Cancel", role: .cancel) { Haptics.tap() }
            } message: {
                Text("You can sign back in anytime. Your data is securely stored.")
            }
            .alert("Error", isPresented: $showError) {
                Button("OK", role: .cancel) { }
            } message: {
                Text(errorMessage)
            }
            .sheet(isPresented: $showDeleteAccountConfirmation) {
                DeleteAccountSheet(
                    isPresented: $showDeleteAccountConfirmation,
                    onConfirm: { Task { await deleteAccount() } },
                    isDeleting: isDeletingAccount
                )
                .onAppear { Haptics.warning() }
            }
            .sheet(isPresented: $showExportHistorySheet) {
                ExportHistoryOverviewView()
            }
            .task {
                await entitlementsManager.refresh(force: false)
            }
        }
        .rmNavigationBar(title: "Account")
        .toolbar(.hidden, for: .navigationBar)
        .safeAreaInset(edge: .top, spacing: 0) {
            RMTopBar(title: "Account", notificationBadge: 0)
        }
        .preferredColorScheme(.dark)
    }

    private var streakSection: some View {
        Group {
            if UserDefaultsManager.Streaks.currentStreak() > 0 {
                let streak = UserDefaultsManager.Streaks.currentStreak()
                HolographicBadgeView(
                    title: streak == 1 ? "1 day" : "\(streak)-day streak",
                    subtitle: "Logging consistency",
                    icon: "flame.fill"
                )
            } else {
                RMCard(useSolidSurface: true) {
                    VStack(spacing: RMTheme.Spacing.sm) {
                        Image(systemName: "flame")
                            .font(.system(size: 32))
                            .foregroundColor(RMTheme.Colors.textTertiary)
                        Text("Start a streak")
                            .font(RMTheme.Typography.bodySmallBold)
                            .foregroundColor(RMTheme.Colors.textSecondary)
                        Text("Log evidence, complete tasks, or add comments to build your streak.")
                            .font(RMTheme.Typography.caption)
                            .foregroundColor(RMTheme.Colors.textTertiary)
                            .multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity)
                    .frame(minHeight: 92)
                }
            }
        }
    }

    private var recentExportsSection: some View {
        VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
            HStack {
                Text("Recent proof packs")
                    .font(RMTheme.Typography.title3)
                    .foregroundColor(RMTheme.Colors.textPrimary)
                Spacer()
                Button {
                    Haptics.impact(.light)
                    showExportHistorySheet = true
                } label: {
                    Text("View all")
                        .font(RMTheme.Typography.captionBold)
                        .foregroundColor(RMTheme.Colors.accent)
                }
            }
            if recentExports.isEmpty {
                Text("No exports yet")
                    .font(RMTheme.Typography.caption)
                    .foregroundColor(RMTheme.Colors.textTertiary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(RMTheme.Spacing.md)
                    .background(RMTheme.Colors.surface.opacity(0.5))
                    .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm))
            } else {
                VStack(spacing: RMTheme.Spacing.sm) {
                    ForEach(recentExports) { task in
                        RecentExportRow(task: task)
                            .onTapGesture {
                                Haptics.impact(.light)
                                showExportHistorySheet = true
                            }
                    }
                }
            }
        }
    }

    private var accountListContent: some View {
        List {
                if let org = sessionManager.currentOrganization {
                    Section {
                        // Organization badge/icon
                        HStack(spacing: RMTheme.Spacing.md) {
                            // Small org badge
                            ZStack {
                                Circle()
                                    .fill(RMTheme.Colors.accent.opacity(0.2))
                                    .frame(width: 40, height: 40)
                                
                                Text(String(org.name.prefix(1)).uppercased())
                                    .font(RMTheme.Typography.title3)
                                    .foregroundColor(RMTheme.Colors.accent)
                            }
                            
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Organization")
                                    .font(RMTheme.Typography.caption)
                                    .foregroundColor(RMTheme.Colors.textTertiary)
                                
                                if isEditingOrgName {
                                    TextField("Organization Name", text: $editedOrgName)
                                        .textFieldStyle(.plain)
                                        .foregroundColor(RMTheme.Colors.textPrimary)
                                        .font(RMTheme.Typography.bodyBold)
                                } else {
                                    Text(org.name)
                                        .foregroundColor(RMTheme.Colors.textPrimary)
                                        .font(RMTheme.Typography.bodyBold)
                                }
                            }
                            
                            Spacer()
                        }
                        .listRowBackground(RMTheme.Colors.surface.opacity(0.5))
                        
                        if isEditingOrgName {
                            Button {
                                let generator = UIImpactFeedbackGenerator(style: .medium)
                                generator.impactOccurred()
                                saveOrganizationName()
                            } label: {
                                if isLoading {
                                    HStack {
                                        ProgressView()
                                            .progressViewStyle(CircularProgressViewStyle(tint: RMTheme.Colors.accent))
                                        Text("Saving...")
                                            .foregroundColor(RMTheme.Colors.accent)
                                    }
                                } else {
                                    Text("Save")
                                        .foregroundColor(RMTheme.Colors.accent)
                                }
                            }
                            .disabled(isLoading || editedOrgName.isEmpty || editedOrgName == org.name)
                            .listRowBackground(RMTheme.Colors.surface.opacity(0.5))
                            
                            Button("Cancel", role: .cancel) {
                                let generator = UIImpactFeedbackGenerator(style: .light)
                                generator.impactOccurred()
                                isEditingOrgName = false
                                editedOrgName = org.name
                            }
                            .listRowBackground(RMTheme.Colors.surface.opacity(0.5))
                        } else {
                            Button {
                                let generator = UIImpactFeedbackGenerator(style: .light)
                                generator.impactOccurred()
                                editedOrgName = org.name
                                isEditingOrgName = true
                            } label: {
                                Text("Edit")
                                    .foregroundColor(RMTheme.Colors.accent)
                            }
                            .listRowBackground(RMTheme.Colors.surface.opacity(0.5))
                        }
                    } header: {
                        Text("Organization")
                            .font(RMTheme.Typography.caption)
                            .foregroundColor(RMTheme.Colors.textTertiary)
                    }
                }
                
                Section {
                    NavigationLink {
                        PrivacyPolicyView()
                    } label: {
                        HStack {
                            Image(systemName: "hand.raised.fill")
                            Text("Privacy Policy")
                        }
                        .foregroundColor(RMTheme.Colors.textPrimary)
                    }
                    .listRowBackground(RMTheme.Colors.surface.opacity(0.5))
                    
                    NavigationLink {
                        TermsOfServiceView()
                    } label: {
                        HStack {
                            Image(systemName: "doc.text.fill")
                            Text("Terms of Service")
                        }
                        .foregroundColor(RMTheme.Colors.textPrimary)
                    }
                    .listRowBackground(RMTheme.Colors.surface.opacity(0.5))
                    
                    #if DEBUG
                    NavigationLink {
                        EntitlementsDebugView()
                    } label: {
                        HStack {
                            Image(systemName: "info.circle.fill")
                            Text("Entitlements Debug")
                        }
                        .foregroundColor(RMTheme.Colors.textPrimary)
                    }
                    .listRowBackground(RMTheme.Colors.surface.opacity(0.5))
                    
                    NavigationLink {
                        EnvironmentDebugView()
                    } label: {
                        HStack {
                            Image(systemName: "server.rack")
                            Text("Environment Debug")
                        }
                        .foregroundColor(RMTheme.Colors.textPrimary)
                    }
                    .listRowBackground(RMTheme.Colors.surface.opacity(0.5))
                    #endif
                }
                
                // Production Toggles (dev/internal only)
                #if DEBUG
                Section {
                    Toggle(isOn: Binding(
                        get: { UserDefaultsManager.Production.sendDiagnostics },
                        set: { UserDefaultsManager.Production.sendDiagnostics = $0 }
                    )) {
                        HStack {
                            Image(systemName: "stethoscope")
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Send Diagnostics")
                                    .foregroundColor(RMTheme.Colors.textPrimary)
                                Text("Include device info in logs")
                                    .font(RMTheme.Typography.caption)
                                    .foregroundColor(RMTheme.Colors.textTertiary)
                            }
                        }
                    }
                    .tint(RMTheme.Colors.accent)
                    .listRowBackground(RMTheme.Colors.surface.opacity(0.5))
                    
                    Button {
                        Haptics.tap()
                        UserDefaultsManager.Production.resetOnboardingAndCoachMarks()
                        let generator = UINotificationFeedbackGenerator()
                        generator.notificationOccurred(.success)
                    } label: {
                        HStack {
                            Image(systemName: "arrow.counterclockwise")
                            Text("Reset Onboarding & Coach Marks")
                        }
                        .foregroundColor(RMTheme.Colors.error.opacity(0.9))
                    }
                    .listRowBackground(RMTheme.Colors.surface.opacity(0.5))
                } header: {
                    Text("Development")
                        .font(RMTheme.Typography.caption)
                        .foregroundColor(RMTheme.Colors.textTertiary)
                }
                #endif
                
                Section {
                    DangerZoneCard(onDeleteTapped: {
                        showDeleteAccountConfirmation = true
                    })
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets(top: RMTheme.Spacing.sm, leading: 0, bottom: RMTheme.Spacing.sm, trailing: 0))
                }
                
                // Version info (subtle, professional)
                Section {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text("Version")
                                .foregroundColor(RMTheme.Colors.textTertiary)
                                .font(RMTheme.Typography.caption)
                            Spacer()
                            Text(versionString)
                                .foregroundColor(RMTheme.Colors.textSecondary)
                                .font(.system(.caption, design: .monospaced))
                        }
                        #if DEBUG
                        .onLongPressGesture {
                            // Long-press to show entitlements debug
                            // This will be handled by navigation link below
                        }
                        #endif
                        
                        // Build channel (Production / TestFlight)
                        HStack {
                            Text("Build Channel")
                                .foregroundColor(RMTheme.Colors.textTertiary)
                                .font(RMTheme.Typography.caption)
                            Spacer()
                            Text(buildChannel)
                                .foregroundColor(RMTheme.Colors.textSecondary)
                                .font(.system(.caption, design: .monospaced))
                        }
                    }
                    .listRowBackground(RMTheme.Colors.surface.opacity(0.3))
                }
                
                // Bottom spacer
                Section {
                    Color.clear
                        .frame(height: 24)
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
    }
    
    private func saveOrganizationName() {
        isLoading = true
        Task {
            do {
                let updated = try await APIClient.shared.updateOrganization(name: editedOrgName)
                sessionManager.currentOrganization = updated
                isEditingOrgName = false
            } catch {
                errorMessage = error.localizedDescription
                showError = true
            }
            isLoading = false
        }
    }
    
    private func deleteAccount() async {
        isDeletingAccount = true
        do {
            _ = try await APIClient.shared.deactivateAccount(confirmation: "DELETE")
            Haptics.success()
            await sessionManager.logout()
        } catch {
            errorMessage = error.localizedDescription
            showError = true
            isDeletingAccount = false
        }
    }
}

// MARK: - Recent export row (Package 8)

private struct RecentExportRow: View {
    let task: ExportTask
    var body: some View {
        HStack(spacing: RMTheme.Spacing.md) {
            Image(systemName: task.type == .proofPack ? "archivebox.fill" : "doc.text.fill")
                .font(.system(size: 18))
                .foregroundColor(RMTheme.Colors.accent)
                .frame(width: 28)
            VStack(alignment: .leading, spacing: 2) {
                Text(task.type.displayName)
                    .font(RMTheme.Typography.bodySmallBold)
                    .foregroundColor(RMTheme.Colors.textPrimary)
                Text("Job \(task.jobId.prefix(8))… • \(stateText)")
                    .font(RMTheme.Typography.caption)
                    .foregroundColor(RMTheme.Colors.textSecondary)
            }
            Spacer()
            Text(formatDate(task.createdAt))
                .font(RMTheme.Typography.caption2)
                .foregroundColor(RMTheme.Colors.textTertiary)
        }
        .padding(RMTheme.Spacing.md)
        .background(RMTheme.Colors.surface.opacity(0.6))
        .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm, style: .continuous))
    }
    private var stateText: String {
        switch task.state {
        case .queued: return "Queued"
        case .preparing, .downloading: return "In progress"
        case .ready: return "Ready"
        case .failed: return "Failed"
        }
    }
    private func formatDate(_ date: Date) -> String {
        let f = RelativeDateTimeFormatter()
        f.unitsStyle = .abbreviated
        return f.localizedString(for: date, relativeTo: Date())
    }
}

#Preview {
    AccountView()
}
