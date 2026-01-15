import SwiftUI

/// Integrity surface pinned at top of Ledger
struct LedgerIntegritySurface: View {
    @State private var integrityStatus: LedgerIntegrityStatus = .verified
    
    var body: some View {
        RMGlassCard {
            HStack(spacing: RMTheme.Spacing.md) {
                Image(systemName: integrityStatus.icon)
                    .foregroundColor(integrityStatus.color)
                    .font(.system(size: 20))
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(integrityStatus.title)
                        .font(RMTheme.Typography.bodySmallBold)
                        .foregroundColor(RMTheme.Colors.textPrimary)
                    
                    Text(integrityStatus.subtitle)
                        .font(RMTheme.Typography.caption)
                        .foregroundColor(RMTheme.Colors.textSecondary)
                }
                
                Spacer()
                
                if integrityStatus == .mismatch {
                    Button {
                        // Show mismatch details
                    } label: {
                        Text("View Details")
                            .font(RMTheme.Typography.captionBold)
                            .foregroundColor(RMTheme.Colors.error)
                    }
                }
            }
        }
    }
}

enum LedgerIntegrityStatus {
    case verified
    case pendingSync
    case mismatch
    
    var icon: String {
        switch self {
        case .verified: return "checkmark.shield.fill"
        case .pendingSync: return "clock.fill"
        case .mismatch: return "exclamationmark.triangle.fill"
        }
    }
    
    var color: Color {
        switch self {
        case .verified: return RMTheme.Colors.success
        case .pendingSync: return RMTheme.Colors.warning
        case .mismatch: return RMTheme.Colors.error
        }
    }
    
    var title: String {
        switch self {
        case .verified: return "Ledger Verified"
        case .pendingSync: return "Pending Sync"
        case .mismatch: return "Integrity Mismatch"
        }
    }
    
    var subtitle: String {
        switch self {
        case .verified: return "All events verified"
        case .pendingSync: return "Some events pending sync"
        case .mismatch: return "Hash mismatch detected"
        }
    }
}

/// Saved Views as horizontal cards
struct SavedViewsCarousel: View {
    @State private var selectedView: SavedView?
    
    let savedViews: [SavedView] = [
        SavedView(id: "review-queue", name: "Review Queue", icon: "list.bullet", count: 5),
        SavedView(id: "insurance-ready", name: "Insurance-Ready", icon: "checkmark.shield.fill", count: 12),
        SavedView(id: "governance", name: "Governance Enforcement", icon: "shield.checkered", count: 3),
        SavedView(id: "incident", name: "Incident Review", icon: "exclamationmark.triangle.fill", count: 1),
        SavedView(id: "access", name: "Access Review", icon: "person.badge.key.fill", count: 8)
    ]
    
    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: RMTheme.Spacing.sm) {
                ForEach(savedViews) { view in
                    SavedViewCard(view: view, isSelected: selectedView?.id == view.id) {
                        selectedView = view
                    }
                }
            }
        }
    }
}

struct SavedView: Identifiable {
    let id: String
    let name: String
    let icon: String
    let count: Int
}

struct SavedViewCard: View {
    let view: SavedView
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button {
            let generator = UIImpactFeedbackGenerator(style: .light)
            generator.impactOccurred()
            action()
        } label: {
            VStack(spacing: RMTheme.Spacing.xs) {
                Image(systemName: view.icon)
                    .foregroundColor(isSelected ? RMTheme.Colors.accent : RMTheme.Colors.textSecondary)
                    .font(.system(size: 20))
                
                Text(view.name)
                    .font(RMTheme.Typography.captionBold)
                    .foregroundColor(isSelected ? RMTheme.Colors.textPrimary : RMTheme.Colors.textSecondary)
                
                Text("\(view.count)")
                    .font(RMTheme.Typography.captionSmall)
                    .foregroundColor(RMTheme.Colors.textTertiary)
            }
            .frame(width: 100)
            .padding(.vertical, RMTheme.Spacing.sm)
            .background(isSelected ? RMTheme.Colors.accent.opacity(0.2) : RMTheme.Colors.inputFill)
            .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm))
        }
        .accessibilityLabel("\(view.name): \(view.count) items")
    }
}

/// Enforcement visual language - blocked items look serious
struct EnforcementRow: View {
    let event: AuditEvent
    @State private var showExportReport = false
    
    var body: some View {
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
                
                Text(event.summary)
                    .font(RMTheme.Typography.bodySmall)
                    .foregroundColor(RMTheme.Colors.textPrimary)
                
                if let reason = event.metadata?["reason"] as? String {
                    HStack {
                        Image(systemName: "info.circle.fill")
                            .foregroundColor(RMTheme.Colors.warning)
                            .font(.system(size: 12))
                        Text("Policy reason: \(reason)")
                            .font(RMTheme.Typography.caption)
                            .foregroundColor(RMTheme.Colors.textSecondary)
                    }
                }
                
                Button {
                    showExportReport = true
                } label: {
                    HStack {
                        Image(systemName: "doc.badge.plus")
                        Text("Export Enforcement Report")
                    }
                    .font(RMTheme.Typography.bodySmallBold)
                    .foregroundColor(RMTheme.Colors.accent)
                }
            }
            .padding(RMTheme.Spacing.md)
            .overlay(
                RoundedRectangle(cornerRadius: RMTheme.Radius.card)
                    .stroke(RMTheme.Colors.error, lineWidth: 2)
            )
        }
        .sheet(isPresented: $showExportReport) {
            EnforcementReportView(event: event)
        }
    }
}

struct EnforcementReportView: View {
    let event: AuditEvent
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationStack {
            ZStack {
                RMBackground()
                
                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: RMTheme.Spacing.sectionSpacing) {
                        Text("Enforcement Report")
                            .font(RMTheme.Typography.headingSmall)
                            .foregroundColor(RMTheme.Colors.textPrimary)
                        
                        RMGlassCard {
                            VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
                                EnforcementReportRow(label: "Event ID", value: event.id)
                                EnforcementReportRow(label: "Action", value: event.summary)
                                EnforcementReportRow(label: "Blocked At", value: formatDate(event.timestamp))
                                EnforcementReportRow(label: "Category", value: event.category)
                                
                                if let reason = event.metadata?["reason"] as? String {
                                    EnforcementReportRow(label: "Policy Reason", value: reason)
                                }
                            }
                        }
                        
                        Button {
                            // Generate PDF report
                        } label: {
                            HStack {
                                Image(systemName: "doc.badge.plus")
                                Text("Generate PDF Report")
                            }
                            .font(RMTheme.Typography.bodySmallBold)
                            .foregroundColor(.black)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, RMTheme.Spacing.md)
                            .background(RMTheme.Colors.accent)
                            .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm))
                        }
                    }
                    .padding(RMTheme.Spacing.pagePadding)
                }
            }
            .rmNavigationBar(title: "Enforcement Report")
        }
    }
    
    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

struct EnforcementReportRow: View {
    let label: String
    let value: String
    
    var body: some View {
        HStack {
            Text(label)
                .font(RMTheme.Typography.bodySmall)
                .foregroundColor(RMTheme.Colors.textSecondary)
            
            Spacer()
            
            Text(value)
                .font(RMTheme.Typography.bodySmallBold)
                .foregroundColor(RMTheme.Colors.textPrimary)
        }
    }
}
