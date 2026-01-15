import SwiftUI

/// Universal Trust Receipt - shown for all actions
struct RMTrustReceipt: View {
    let action: TrustAction
    @Binding var isPresented: Bool
    @State private var showDetail = false
    
    var body: some View {
        VStack(spacing: 0) {
            // Mini receipt (toast-style)
            HStack(spacing: RMTheme.Spacing.sm) {
                Image(systemName: action.icon)
                    .foregroundColor(action.color)
                    .font(.system(size: 16))
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(action.title)
                        .font(RMTheme.Typography.bodySmallBold)
                        .foregroundColor(RMTheme.Colors.textPrimary)
                    
                    Text("by \(action.actor) • \(formatRelativeTime(action.timestamp))")
                        .font(RMTheme.Typography.caption)
                        .foregroundColor(RMTheme.Colors.textSecondary)
                }
                
                Spacer()
                
                Button {
                    showDetail = true
                } label: {
                    Image(systemName: "info.circle")
                        .foregroundColor(RMTheme.Colors.textTertiary)
                        .font(.system(size: 14))
                }
            }
            .padding(RMTheme.Spacing.md)
            .background(RMTheme.Colors.surface.opacity(0.8))
            .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm))
            .padding(.horizontal, RMTheme.Spacing.pagePadding)
            .padding(.top, RMTheme.Spacing.sm)
        }
        .sheet(isPresented: $showDetail) {
            TrustReceiptDetailView(action: action)
        }
        .onAppear {
            // Auto-dismiss after 3 seconds
            DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
                withAnimation {
                    isPresented = false
                }
            }
        }
    }
    
    private func formatRelativeTime(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}

/// Trust action model
struct TrustAction: Identifiable {
    let id: String
    let type: TrustActionType
    let title: String
    let actor: String
    let role: String?
    let timestamp: Date
    let jobId: String?
    let jobTitle: String?
    let details: [String: String]?
    let outcome: TrustOutcome
    let reason: String? // For blocked actions
    
    var icon: String {
        switch type {
        case .controlCompleted: return "checkmark.shield.fill"
        case .hazardChanged: return "exclamationmark.triangle.fill"
        case .evidenceUploaded: return "photo.fill"
        case .evidenceSealed: return "lock.shield.fill"
        case .exportGenerated: return "doc.badge.plus"
        case .actionBlocked: return "xmark.circle.fill"
        case .teamInvited: return "person.badge.plus"
        case .roleChanged: return "person.badge.key.fill"
        }
    }
    
    var color: Color {
        switch outcome {
        case .allowed: return RMTheme.Colors.success
        case .blocked: return RMTheme.Colors.error
        case .pending: return RMTheme.Colors.warning
        }
    }
}

enum TrustActionType {
    case controlCompleted
    case hazardChanged
    case evidenceUploaded
    case evidenceSealed
    case exportGenerated
    case actionBlocked
    case teamInvited
    case roleChanged
}

enum TrustOutcome {
    case allowed
    case blocked
    case pending
}

struct TrustReceiptDetailView: View {
    let action: TrustAction
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
                                Image(systemName: action.icon)
                                    .foregroundColor(action.color)
                                    .font(.system(size: 32))
                                
                                Text(action.title)
                                    .font(RMTheme.Typography.title3)
                                    .foregroundColor(RMTheme.Colors.textPrimary)
                            }
                            
                            Text(formatDate(action.timestamp))
                                .font(RMTheme.Typography.bodySmall)
                                .foregroundColor(RMTheme.Colors.textSecondary)
                        }
                        .padding(.horizontal, RMTheme.Spacing.pagePadding)
                        .padding(.top, RMTheme.Spacing.lg)
                        
                        // Details
                        RMGlassCard {
                            VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
                                CustodyDetailRow(label: "Actor", value: action.actor)
                                
                                if let role = action.role {
                                    CustodyDetailRow(label: "Role", value: role)
                                }
                                
                                CustodyDetailRow(label: "Outcome", value: outcomeText)
                                
                                if let jobTitle = action.jobTitle {
                                    CustodyDetailRow(label: "Job", value: jobTitle)
                                }
                                
                                if let reason = action.reason {
                                    Divider()
                                        .background(RMTheme.Colors.border)
                                    
                                    CustodyDetailRow(label: "Reason", value: reason)
                                }
                                
                                if let details = action.details {
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
            .rmNavigationBar(title: "Trust Receipt")
        }
    }
    
    private var outcomeText: String {
        switch action.outcome {
        case .allowed: return "Allowed"
        case .blocked: return "Blocked"
        case .pending: return "Pending Sync"
        }
    }
    
    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

/// View modifier for showing trust receipts
extension View {
    func trustReceipt(_ action: TrustAction?, isPresented: Binding<Bool>) -> some View {
        self.overlay(alignment: .top) {
            if let action = action, isPresented.wrappedValue {
                RMTrustReceipt(action: action, isPresented: isPresented)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
    }
}

/// Enforcement receipt for blocked actions
struct RMEnforcementReceipt: View {
    let action: TrustAction
    @Binding var isPresented: Bool
    
    var body: some View {
        VStack(spacing: 0) {
            RMGlassCard {
                VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
                    HStack {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(RMTheme.Colors.error)
                            .font(.system(size: 20))
                        
                        Text("Action Blocked")
                            .font(RMTheme.Typography.bodySmallBold)
                            .foregroundColor(RMTheme.Colors.error)
                        
                        Spacer()
                    }
                    
                    if let reason = action.reason {
                        Text(reason)
                            .font(RMTheme.Typography.bodySmall)
                            .foregroundColor(RMTheme.Colors.textSecondary)
                    }
                    
                    Button {
                        // Show enforcement report
                    } label: {
                        Text("Export Enforcement Report")
                            .font(RMTheme.Typography.bodySmallBold)
                            .foregroundColor(RMTheme.Colors.accent)
                    }
                }
            }
            .padding(.horizontal, RMTheme.Spacing.pagePadding)
            .padding(.top, RMTheme.Spacing.sm)
        }
    }
}
