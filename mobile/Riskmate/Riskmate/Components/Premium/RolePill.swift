import SwiftUI

/// Reusable role pill for team cards and lists. Consistent with design system (Package 7).
struct RolePill: View {
    let role: TeamRole
    
    private var color: Color {
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

/// Generic pill for non-role labels (e.g. "Ops", "Auditor") when needed.
struct RMPill: View {
    let text: String
    let color: Color
    
    init(_ text: String, color: Color = RMTheme.Colors.textTertiary) {
        self.text = text
        self.color = color
    }
    
    var body: some View {
        Text(text)
            .font(RMTheme.Typography.captionBold)
            .foregroundColor(.white)
            .padding(.horizontal, RMTheme.Spacing.sm)
            .padding(.vertical, RMTheme.Spacing.xs)
            .background(color)
            .clipShape(Capsule())
    }
}

#Preview {
    VStack(spacing: 12) {
        HStack(spacing: 8) {
            RolePill(role: .owner)
            RolePill(role: .admin)
            RolePill(role: .member)
        }
        RMPill("Custom", color: RMTheme.Colors.accent)
    }
    .padding()
    .background(RMTheme.Colors.background)
}
