import SwiftUI
import SwiftDate

/// Team Management - Access & Accountability
struct TeamView: View {
    @State private var teamData: TeamResponse?
    @State private var isLoading = true
    @State private var showingInviteSheet = false
    @State private var inviteEmail = ""
    @State private var inviteRole: TeamRole = .member
    
    var body: some View {
        RMBackground()
            .overlay {
                if isLoading {
                    ScrollView {
                        VStack(spacing: RMTheme.Spacing.lg) {
                            RMSkeletonCard()
                            RMSkeletonCard()
                            RMSkeletonList(count: 5)
                        }
                        .padding(RMTheme.Spacing.md)
                    }
                } else if let data = teamData {
                    ScrollView(showsIndicators: false) {
                        VStack(spacing: RMTheme.Spacing.lg) {
                            // Header
                            VStack(alignment: .leading, spacing: RMTheme.Spacing.xs) {
                                Text("Access & Accountability")
                                    .font(RMTheme.Typography.largeTitle)
                                    .foregroundColor(RMTheme.Colors.textPrimary)
                                
                                Text("Define who can view, manage, and approve risk")
                                    .font(RMTheme.Typography.bodySmall)
                                    .foregroundColor(RMTheme.Colors.textSecondary)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, RMTheme.Spacing.md)
                            .padding(.top, RMTheme.Spacing.md)
                            
                            // Risk Coverage Cards
                            if let coverage = data.riskCoverage {
                                RiskCoverageSection(coverage: coverage)
                                    .padding(.horizontal, RMTheme.Spacing.md)
                            }
                            
                            // Seats Info
                            SeatsInfoCard(seats: data.seats)
                                .padding(.horizontal, RMTheme.Spacing.md)
                            
                            // Invite Form
                            if canInvite(data.currentUserRole) {
                                InviteFormCard(
                                    email: $inviteEmail,
                                    role: $inviteRole,
                                    onInvite: {
                                        await sendInvite(email: inviteEmail, role: inviteRole)
                                    }
                                )
                                .padding(.horizontal, RMTheme.Spacing.md)
                            }
                            
                            // Team Members
                            VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
                                Text("Team Members")
                                    .font(RMTheme.Typography.title3)
                                    .foregroundColor(RMTheme.Colors.textPrimary)
                                    .padding(.horizontal, RMTheme.Spacing.md)
                                
                                if data.members.isEmpty {
                                    RMEmptyState(
                                        icon: "person.2",
                                        title: "No Team Members",
                                        message: "Invite team members to get started"
                                    )
                                    .padding(.horizontal, RMTheme.Spacing.md)
                                } else {
                                    VStack(spacing: RMTheme.Spacing.sm) {
                                        ForEach(data.members) { member in
                                            TeamMemberRow(
                                                member: member,
                                                currentUserRole: data.currentUserRole,
                                                onDeactivate: {
                                                    // TODO: Deactivate member
                                                }
                                            )
                                        }
                                    }
                                    .padding(.horizontal, RMTheme.Spacing.md)
                                }
                            }
                            
                            // Pending Invites
                            if !data.invites.isEmpty {
                                VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
                                    Text("Pending Invites")
                                        .font(RMTheme.Typography.title3)
                                        .foregroundColor(RMTheme.Colors.textPrimary)
                                        .padding(.horizontal, RMTheme.Spacing.md)
                                    
                                    VStack(spacing: RMTheme.Spacing.sm) {
                                        ForEach(data.invites) { invite in
                                            TeamInviteRow(invite: invite)
                                        }
                                    }
                                    .padding(.horizontal, RMTheme.Spacing.md)
                                }
                            }
                            
                            // Audit Footer
                            AuditFooter()
                                .padding(.horizontal, RMTheme.Spacing.md)
                                .padding(.bottom, RMTheme.Spacing.lg)
                        }
                    }
                } else {
                    RMEmptyState(
                        icon: "exclamationmark.triangle",
                        title: "Failed to Load",
                        message: "Unable to load team data"
                    )
                }
            }
            .navigationTitle("Team")
            .navigationBarTitleDisplayMode(.large)
            .task {
                await loadTeam()
            }
            .refreshable {
                await loadTeam()
            }
    }
    
    private func canInvite(_ role: String) -> Bool {
        return role == "owner" || role == "admin"
    }
    
    private func loadTeam() async {
        isLoading = true
        defer { isLoading = false }
        
        do {
            teamData = try await APIClient.shared.getTeam()
        } catch {
            print("[TeamView] Failed to load: \(error)")
            // TODO: Show error toast
        }
    }
    
    private func sendInvite(email: String, role: TeamRole) async {
        do {
            try await APIClient.shared.inviteTeamMember(email: email, role: role.rawValue)
            inviteEmail = ""
            let generator = UINotificationFeedbackGenerator()
            generator.notificationOccurred(.success)
            await loadTeam() // Refresh
        } catch {
            print("[TeamView] Failed to send invite: \(error)")
            // TODO: Show error toast
        }
    }
}

// MARK: - Risk Coverage Section

struct RiskCoverageSection: View {
    let coverage: RiskCoverage
    
    var body: some View {
        VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
            Text("Risk Coverage")
                .font(RMTheme.Typography.title3)
                .foregroundColor(RMTheme.Colors.textPrimary)
            
            HStack(spacing: RMTheme.Spacing.sm) {
                CoverageCard(role: "Owner", count: coverage.owner)
                CoverageCard(role: "Safety Lead", count: coverage.safetyLead)
                CoverageCard(role: "Executive", count: coverage.executive)
                CoverageCard(role: "Admin", count: coverage.admin)
                CoverageCard(role: "Member", count: coverage.member)
            }
        }
    }
}

struct CoverageCard: View {
    let role: String
    let count: Int
    
    var body: some View {
        RMGlassCard {
            VStack(spacing: RMTheme.Spacing.xs) {
                Text(role)
                    .font(RMTheme.Typography.caption)
                    .foregroundColor(RMTheme.Colors.textSecondary)
                    .multilineTextAlignment(.center)
                
                Text("\(count)")
                    .font(RMTheme.Typography.title3)
                    .foregroundColor(RMTheme.Colors.textPrimary)
            }
        }
    }
}

// MARK: - Seats Info Card

struct SeatsInfoCard: View {
    let seats: SeatsInfo
    
    var body: some View {
        RMGlassCard {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
                Text("Seats")
                    .font(RMTheme.Typography.title3)
                    .foregroundColor(RMTheme.Colors.textPrimary)
                
                HStack {
                    VStack(alignment: .leading) {
                        Text("Used")
                            .font(RMTheme.Typography.caption)
                            .foregroundColor(RMTheme.Colors.textSecondary)
                        Text("\(seats.used)")
                            .font(RMTheme.Typography.title2)
                            .foregroundColor(RMTheme.Colors.textPrimary)
                    }
                    
                    Spacer()
                    
                    if let limit = seats.limit {
                        VStack(alignment: .trailing) {
                            Text("Limit")
                                .font(RMTheme.Typography.caption)
                                .foregroundColor(RMTheme.Colors.textSecondary)
                            Text("\(limit)")
                                .font(RMTheme.Typography.title2)
                                .foregroundColor(RMTheme.Colors.textPrimary)
                        }
                    }
                    
                    if let available = seats.available {
                        VStack(alignment: .trailing) {
                            Text("Available")
                                .font(RMTheme.Typography.caption)
                                .foregroundColor(RMTheme.Colors.textSecondary)
                            Text("\(available)")
                                .font(RMTheme.Typography.title2)
                                .foregroundColor(RMTheme.Colors.success)
                        }
                    }
                }
            }
        }
    }
}

// MARK: - Invite Form Card

struct InviteFormCard: View {
    @Binding var email: String
    @Binding var role: TeamRole
    let onInvite: () async -> Void
    
    @State private var isInviting = false
    
    var body: some View {
        RMGlassCard {
            VStack(spacing: RMTheme.Spacing.md) {
                Text("Invite Team Member")
                    .font(RMTheme.Typography.title3)
                    .foregroundColor(RMTheme.Colors.textPrimary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                
                VStack(spacing: RMTheme.Spacing.sm) {
                    TextField("Email", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .autocapitalization(.none)
                        .padding(RMTheme.Spacing.md)
                        .background(RMTheme.Colors.inputFill)
                        .cornerRadius(RMTheme.Radius.sm)
                        .foregroundColor(RMTheme.Colors.textPrimary)
                    
                    Picker("Role", selection: $role) {
                        ForEach(TeamRole.allCases, id: \.self) { role in
                            Text(role.displayName).tag(role)
                        }
                    }
                    .pickerStyle(.menu)
                    .padding(RMTheme.Spacing.md)
                    .background(RMTheme.Colors.inputFill)
                    .cornerRadius(RMTheme.Radius.sm)
                }
                
                Button {
                    Task {
                        isInviting = true
                        await onInvite()
                        isInviting = false
                    }
                } label: {
                    if isInviting {
                        ProgressView()
                            .tint(.black)
                    } else {
                        Text("Send Invite")
                            .font(RMTheme.Typography.bodyBold)
                    }
                }
                .foregroundColor(.black)
                .frame(maxWidth: .infinity)
                .padding(.vertical, RMTheme.Spacing.md)
                .background(RMTheme.Colors.accent)
                .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.md))
                .disabled(isInviting || email.isEmpty)
            }
        }
    }
}

// MARK: - Team Member Row

struct TeamMemberRow: View {
    let member: TeamMember
    let currentUserRole: String
    let onDeactivate: () -> Void
    
    var canDeactivate: Bool {
        return (currentUserRole == "owner" || currentUserRole == "admin") && member.role != .owner
    }
    
    var body: some View {
        RMGlassCard {
            HStack {
                VStack(alignment: .leading, spacing: RMTheme.Spacing.xs) {
                    Text(member.fullName ?? member.email)
                        .font(RMTheme.Typography.bodyBold)
                        .foregroundColor(RMTheme.Colors.textPrimary)
                    
                    Text(member.email)
                        .font(RMTheme.Typography.caption)
                        .foregroundColor(RMTheme.Colors.textSecondary)
                }
                
                Spacer()
                
                RoleBadge(role: member.role)
                
                if canDeactivate {
                    Button {
                        let generator = UIImpactFeedbackGenerator(style: .medium)
                        generator.impactOccurred()
                        onDeactivate()
                    } label: {
                        Image(systemName: "person.crop.circle.badge.minus")
                            .foregroundColor(RMTheme.Colors.error)
                    }
                }
            }
        }
    }
}

// MARK: - Team Invite Row

struct TeamInviteRow: View {
    let invite: TeamInvite
    
    var body: some View {
        RMGlassCard {
            HStack {
                VStack(alignment: .leading, spacing: RMTheme.Spacing.xs) {
                    Text(invite.email)
                        .font(RMTheme.Typography.bodyBold)
                        .foregroundColor(RMTheme.Colors.textPrimary)
                    
                    Text("Invited \(relativeTime(invite.createdAt))")
                        .font(RMTheme.Typography.caption)
                        .foregroundColor(RMTheme.Colors.textSecondary)
                }
                
                Spacer()
                
                RoleBadge(role: invite.role)
                
                Image(systemName: "clock")
                    .foregroundColor(RMTheme.Colors.warning)
            }
        }
    }
    
    private func relativeTime(_ dateString: String) -> String {
        guard let date = ISO8601DateFormatter().date(from: dateString) else {
            return dateString
        }
        return date.toRelative(since: nil, dateTimeStyle: .named, unitsStyle: .short)
    }
}

// MARK: - Role Badge

struct RoleBadge: View {
    let role: TeamRole
    
    var color: Color {
        switch role {
        case .owner: return RMTheme.Colors.accent
        case .admin: return RMTheme.Colors.categoryAccess
        case .safetyLead: return RMTheme.Colors.categoryOperations
        case .executive: return RMTheme.Colors.categoryGovernance
        case .member: return RMTheme.Colors.textTertiary
        }
    }
    
    var body: some View {
        Text(role.displayName)
            .font(RMTheme.Typography.captionBold)
            .foregroundColor(.white)
            .padding(.horizontal, RMTheme.Spacing.sm)
            .padding(.vertical, RMTheme.Spacing.xs)
            .background(color)
            .clipShape(Capsule())
    }
}

// MARK: - Audit Footer

struct AuditFooter: View {
    var body: some View {
        VStack(spacing: RMTheme.Spacing.sm) {
            Text("All team changes are logged in the audit ledger")
                .font(RMTheme.Typography.caption)
                .foregroundColor(RMTheme.Colors.textTertiary)
                .multilineTextAlignment(.center)
            
            Button {
                // Navigate to audit ledger
            } label: {
                Text("View Audit Ledger")
                    .font(RMTheme.Typography.bodySmallBold)
                    .foregroundColor(RMTheme.Colors.accent)
            }
        }
        .padding(RMTheme.Spacing.md)
        .frame(maxWidth: .infinity)
        .background(RMTheme.Colors.surface.opacity(0.5))
        .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.md))
    }
}

#Preview {
    NavigationStack {
        TeamView()
    }
}
