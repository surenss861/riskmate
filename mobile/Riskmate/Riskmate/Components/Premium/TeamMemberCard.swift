import SwiftUI

/// Team member as a workspace card: avatar, name, email, role pill(s), action menu. Package 7.
struct TeamMemberCard: View {
    let member: TeamMember
    let currentUserRole: String
    let staggerIndex: Int
    let onRequestSignature: () -> Void
    let onDeactivate: (() -> Void)?
    
    private var canDeactivate: Bool {
        (currentUserRole == "owner" || currentUserRole == "admin") && member.role != .owner
    }
    
    var body: some View {
        RMGlassCard {
            HStack(alignment: .top, spacing: RMTheme.Spacing.md) {
                avatarView
                VStack(alignment: .leading, spacing: RMTheme.Spacing.xs) {
                    Text(member.fullName ?? member.email)
                        .font(RMTheme.Typography.bodyBold)
                        .foregroundColor(RMTheme.Colors.textPrimary)
                    Text(member.email)
                        .font(RMTheme.Typography.caption)
                        .foregroundColor(RMTheme.Colors.textSecondary)
                    HStack(spacing: RMTheme.Spacing.xs) {
                        RolePill(role: member.role)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                trailingActions
            }
        }
        .rmPressable(scale: 0.98, haptic: true, lightImpact: true)
        .rmAppearIn(staggerIndex: staggerIndex)
        .contextMenu {
            Button {
                UIPasteboard.general.string = member.email
            } label: {
                Label("Copy email", systemImage: "doc.on.doc")
            }
            Button {
                onRequestSignature()
            } label: {
                Label("Request signature", systemImage: "signature")
            }
            if canDeactivate, let onDeactivate = onDeactivate {
                Button(role: .destructive) {
                    onDeactivate()
                } label: {
                    Label("Deactivate", systemImage: "person.crop.circle.badge.minus")
                }
            }
        }
    }
    
    private var avatarView: some View {
        Text(initials(for: member))
            .font(RMTheme.Typography.bodyBold)
            .foregroundColor(RMTheme.Colors.textPrimary)
            .frame(width: 44, height: 44)
            .background(RMTheme.Colors.surface.opacity(0.8))
            .clipShape(Circle())
    }
    
    private var trailingActions: some View {
        HStack(spacing: RMTheme.Spacing.sm) {
            Button {
                Haptics.impact(.light)
                onRequestSignature()
            } label: {
                Text("Request signature")
                    .font(RMTheme.Typography.captionBold)
            }
            .buttonStyle(.borderedProminent)
            .tint(RMTheme.Colors.accent)
            .controlSize(.small)
            Menu {
                Button {
                    UIPasteboard.general.string = member.email
                } label: {
                    Label("Copy email", systemImage: "doc.on.doc")
                }
                Button {
                    onRequestSignature()
                } label: {
                    Label("Request signature", systemImage: "signature")
                }
                if canDeactivate, let onDeactivate = onDeactivate {
                    Button(role: .destructive) {
                        Haptics.impact(.light)
                        onDeactivate()
                    } label: {
                        Label("Deactivate", systemImage: "person.crop.circle.badge.minus")
                    }
                }
            } label: {
                Image(systemName: "ellipsis.circle")
                    .font(.body)
                    .foregroundColor(RMTheme.Colors.textSecondary)
            }
        }
    }
    
    private func initials(for member: TeamMember) -> String {
        if let name = member.fullName, !name.isEmpty {
            let parts = name.split(separator: " ").compactMap { $0.first }
            if parts.count >= 2 {
                return String(parts[0]) + String(parts[1])
            }
            if let first = parts.first {
                return String(first)
            }
        }
        let email = member.email
        if let first = email.first {
            return String(first).uppercased()
        }
        return "?"
    }
}

#Preview {
    ScrollView {
        VStack(spacing: 12) {
            TeamMemberCard(
                member: TeamMember(
                    id: "1",
                    email: "jane@example.com",
                    fullName: "Jane Doe",
                    role: .safetyLead,
                    createdAt: "",
                    mustResetPassword: false
                ),
                currentUserRole: "admin",
                staggerIndex: 0,
                onRequestSignature: {},
                onDeactivate: {}
            )
        }
        .padding()
    }
    .background(RMTheme.Colors.background)
}
