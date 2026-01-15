import SwiftUI

/// Setup checklist card shown after onboarding
struct SetupChecklistView: View {
    @Binding var isDismissed: Bool
    @StateObject private var sessionManager = SessionManager.shared
    
    @State private var checklistItems: [ChecklistItem] = []
    
    var body: some View {
        if !isDismissed {
            RMGlassCard {
                VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
                    HStack {
                        Text("Setup Checklist")
                            .font(RMTheme.Typography.headingSmall)
                            .foregroundColor(RMTheme.Colors.textPrimary)
                        
                        Spacer()
                        
                        Button {
                            withAnimation {
                                isDismissed = true
                                UserDefaults.standard.set(true, forKey: "setup_checklist_dismissed")
                            }
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundColor(RMTheme.Colors.textTertiary)
                                .font(.system(size: 20))
                        }
                    }
                    
                    ForEach(checklistItems) { item in
                        ChecklistRow(item: item)
                    }
                }
            }
            .padding(.horizontal, RMTheme.Spacing.pagePadding)
            .padding(.top, RMTheme.Spacing.md)
            .onAppear {
                loadChecklist()
            }
        }
    }
    
    private func loadChecklist() {
        var items: [ChecklistItem] = []
        
        // Check organization name
        if let org = sessionManager.currentOrganization, !org.name.isEmpty {
            items.append(ChecklistItem(
                id: "org_name",
                title: "Add company name",
                isCompleted: true
            ))
        } else {
            items.append(ChecklistItem(
                id: "org_name",
                title: "Add company name",
                isCompleted: false,
                action: { /* Navigate to account */ }
            ))
        }
        
        // Check team invites (placeholder)
        items.append(ChecklistItem(
            id: "team",
            title: "Invite team",
            isCompleted: false,
            action: { /* Navigate to team */ }
        ))
        
        // Check first job (placeholder)
        items.append(ChecklistItem(
            id: "first_job",
            title: "Create first job",
            isCompleted: false,
            action: { /* Navigate to jobs */ }
        ))
        
        // Check first evidence (placeholder)
        items.append(ChecklistItem(
            id: "first_evidence",
            title: "Upload first evidence",
            isCompleted: false,
            action: { /* Navigate to evidence */ }
        ))
        
        // Check first export (placeholder)
        items.append(ChecklistItem(
            id: "first_export",
            title: "Export first PDF",
            isCompleted: false,
            action: { /* Navigate to exports */ }
        ))
        
        checklistItems = items
    }
}

struct ChecklistItem: Identifiable {
    let id: String
    let title: String
    var isCompleted: Bool
    var action: (() -> Void)? = nil
}

struct ChecklistRow: View {
    let item: ChecklistItem
    
    var body: some View {
        HStack(spacing: RMTheme.Spacing.sm) {
            Image(systemName: item.isCompleted ? "checkmark.circle.fill" : "circle")
                .foregroundColor(item.isCompleted ? RMTheme.Colors.success : RMTheme.Colors.textTertiary)
                .font(.system(size: 20))
            
            Text(item.title)
                .font(RMTheme.Typography.bodySmall)
                .foregroundColor(item.isCompleted ? RMTheme.Colors.textSecondary : RMTheme.Colors.textPrimary)
            
            Spacer()
            
            if !item.isCompleted, let action = item.action {
                Button {
                    action()
                } label: {
                    Text("Go")
                        .font(RMTheme.Typography.captionBold)
                        .foregroundColor(RMTheme.Colors.accent)
                }
            }
        }
    }
}
