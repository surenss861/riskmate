import SwiftUI

/// "Recorded by" strip showing last recorded action
struct RMRecordedStrip: View {
    let actor: String
    let role: String?
    let timestamp: Date
    
    var body: some View {
        HStack(spacing: RMTheme.Spacing.xs) {
            Image(systemName: "checkmark.circle.fill")
                .foregroundColor(RMTheme.Colors.success)
                .font(.system(size: 12))
            
            Text("Last recorded: \(formatRelativeTime(timestamp))")
                .font(RMTheme.Typography.caption)
                .foregroundColor(RMTheme.Colors.textSecondary)
            
            Text("•")
                .foregroundColor(RMTheme.Colors.textTertiary)
            
            Text("by \(actor)")
                .font(RMTheme.Typography.caption)
                .foregroundColor(RMTheme.Colors.textSecondary)
            
            if let role = role {
                Text("(\(role))")
                    .font(RMTheme.Typography.caption)
                    .foregroundColor(RMTheme.Colors.textTertiary)
            }
        }
        .padding(.horizontal, RMTheme.Spacing.sm)
        .padding(.vertical, RMTheme.Spacing.xs)
        .background(RMTheme.Colors.surface.opacity(0.5))
        .clipShape(Capsule())
    }
    
    private func formatRelativeTime(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}

/// Action receipt card for recent actions
struct RMActionReceipt: View {
    let action: ActionReceipt
    @State private var showDetail = false
    
    var body: some View {
        Button {
            showDetail = true
        } label: {
            RMGlassCard {
                HStack(spacing: RMTheme.Spacing.md) {
                    Image(systemName: action.icon)
                        .foregroundColor(action.color)
                        .font(.system(size: 20))
                    
                    VStack(alignment: .leading, spacing: 4) {
                        Text(action.title)
                            .font(RMTheme.Typography.bodySmallBold)
                            .foregroundColor(RMTheme.Colors.textPrimary)
                        
                        Text("\(formatRelativeTime(action.timestamp)) • by \(action.actor)")
                            .font(RMTheme.Typography.caption)
                            .foregroundColor(RMTheme.Colors.textSecondary)
                    }
                    
                    Spacer()
                    
                    Image(systemName: "chevron.right")
                        .foregroundColor(RMTheme.Colors.textTertiary)
                        .font(.system(size: 14))
                }
            }
        }
        .sheet(isPresented: $showDetail) {
            ActionReceiptDetailView(receipt: action)
        }
    }
    
    private func formatRelativeTime(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}

struct ActionReceipt: Identifiable {
    let id: String
    let type: ActionType
    let title: String
    let actor: String
    let role: String?
    let timestamp: Date
    let jobId: String?
    let jobTitle: String?
    let details: [String: String]?
    
    var icon: String {
        switch type {
        case .controlCompleted: return "checkmark.shield.fill"
        case .hazardChanged: return "exclamationmark.triangle.fill"
        case .evidenceUploaded: return "photo.fill"
        case .exportGenerated: return "doc.badge.plus"
        case .teamInvited: return "person.badge.plus"
        case .roleChanged: return "person.badge.key.fill"
        }
    }
    
    var color: Color {
        switch type {
        case .controlCompleted: return RMTheme.Colors.success
        case .hazardChanged: return RMTheme.Colors.warning
        case .evidenceUploaded: return RMTheme.Colors.accent
        case .exportGenerated: return RMTheme.Colors.accent
        case .teamInvited: return RMTheme.Colors.info
        case .roleChanged: return RMTheme.Colors.categoryGovernance
        }
    }
}

enum ActionType {
    case controlCompleted
    case hazardChanged
    case evidenceUploaded
    case exportGenerated
    case teamInvited
    case roleChanged
}

struct ActionReceiptDetailView: View {
    let receipt: ActionReceipt
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationStack {
            ZStack {
                RMBackground()
                
                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: RMTheme.Spacing.sectionSpacing) {
                        // Header
                        VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
                            HStack {
                                Image(systemName: receipt.icon)
                                    .foregroundColor(receipt.color)
                                    .font(.system(size: 32))
                                
                                Text(receipt.title)
                                    .font(RMTheme.Typography.title3)
                                    .foregroundColor(RMTheme.Colors.textPrimary)
                            }
                            
                            Text(formatDate(receipt.timestamp))
                                .font(RMTheme.Typography.bodySmall)
                                .foregroundColor(RMTheme.Colors.textSecondary)
                        }
                        .padding(.horizontal, RMTheme.Spacing.pagePadding)
                        .padding(.top, RMTheme.Spacing.lg)
                        
                        // Details
                        RMGlassCard {
                            VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
                                CustodyDetailRow(label: "Actor", value: receipt.actor)
                                
                                if let role = receipt.role {
                                    CustodyDetailRow(label: "Role", value: role)
                                }
                                
                                if let jobTitle = receipt.jobTitle {
                                    CustodyDetailRow(label: "Job", value: jobTitle)
                                }
                                
                                if let details = receipt.details {
                                    Divider()
                                        .background(RMTheme.Colors.border)
                                    
                                    ForEach(Array(details.keys.sorted()), id: \.self) { key in
                                        CustodyDetailRow(label: key, value: details[key] ?? "")
                                    }
                                }
                            }
                        }
                        .padding(.horizontal, RMTheme.Spacing.pagePadding)
                    }
                    .padding(.vertical, RMTheme.Spacing.lg)
                }
            }
            .rmNavigationBar(title: "Action Receipt")
        }
    }
    
    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

/// Recent receipts list (last 5 actions)
struct RMRecentReceipts: View {
    let receipts: [ActionReceipt]
    
    var body: some View {
        if !receipts.isEmpty {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
                Text("Recent Receipts")
                    .rmSectionHeader()
                    .padding(.horizontal, RMTheme.Spacing.pagePadding)
                
                ForEach(receipts.prefix(5)) { receipt in
                    RMActionReceipt(action: receipt)
                        .padding(.horizontal, RMTheme.Spacing.pagePadding)
                }
            }
        }
    }
}
