import SwiftUI

/// Audit feed with native list, category pills, and detail sheets
struct AuditFeedView: View {
    @State private var events: [AuditEvent] = []
    @State private var isLoading = true
    @State private var selectedEvent: AuditEvent?
    @State private var showingDetail = false
    
    var body: some View {
        RMBackground()
            .overlay {
                if isLoading {
                    ProgressView()
                        .tint(RMTheme.Colors.accent)
                } else if events.isEmpty {
                    RMEmptyState(
                        icon: "tray",
                        title: "No Audit Events",
                        message: "Audit events will appear here as they occur"
                    )
                } else {
                    List {
                        ForEach(events) { event in
                            RMAuditRow(event: event)
                                .listRowBackground(Color.clear)
                                .listRowSeparator(.hidden)
                                .listRowInsets(EdgeInsets(
                                    top: RMTheme.Spacing.xs,
                                    leading: RMTheme.Spacing.md,
                                    bottom: RMTheme.Spacing.xs,
                                    trailing: RMTheme.Spacing.md
                                ))
                                .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                    Button {
                                        copyEventId(event.id)
                                    } label: {
                                        Label("Copy ID", systemImage: "doc.on.doc")
                                    }
                                    .tint(RMTheme.Colors.accent)
                                    
                                    Button {
                                        exportEvent(event)
                                    } label: {
                                        Label("Export", systemImage: "square.and.arrow.up")
                                    }
                                    .tint(RMTheme.Colors.categoryAccess)
                                }
                                .onTapGesture {
                                    selectedEvent = event
                                    showingDetail = true
                                }
                        }
                    }
                    .listStyle(.plain)
                    .scrollContentBackground(.hidden)
                }
            }
            .task {
                await loadEvents()
            }
            .refreshable {
                await loadEvents()
            }
            .sheet(isPresented: $showingDetail) {
                if let event = selectedEvent {
                    RMAuditDetailSheet(event: event)
                        .presentationDetents([.medium, .large])
                        .presentationDragIndicator(.visible)
                }
            }
    }
    
    private func loadEvents() async {
        isLoading = true
        defer { isLoading = false }
        
        // TODO: Replace with real API call
        try? await Task.sleep(nanoseconds: 500_000_000)
        
        // Mock data
        events = generateMockEvents()
    }
    
    private func generateMockEvents() -> [AuditEvent] {
        let now = Date()
        let calendar = Calendar.current
        
        return [
            AuditEvent(
                id: "evt_001",
                category: "ACCESS",
                summary: "User access review completed",
                timestamp: calendar.date(byAdding: .hour, value: -2, to: now) ?? now,
                details: "Access review for Q1 2024 completed with 12 approvals and 3 rejections.",
                actor: "John Doe",
                metadata: ["review_id": "rev_123", "approvals": "12", "rejections": "3"]
            ),
            AuditEvent(
                id: "evt_002",
                category: "OPS",
                summary: "Job risk assessment updated",
                timestamp: calendar.date(byAdding: .hour, value: -5, to: now) ?? now,
                details: "Risk level changed from Medium to High based on new findings.",
                actor: "Jane Smith",
                metadata: ["job_id": "job_456", "old_level": "Medium", "new_level": "High"]
            ),
            AuditEvent(
                id: "evt_003",
                category: "GOV",
                summary: "Compliance report generated",
                timestamp: calendar.date(byAdding: .day, value: -1, to: now) ?? now,
                details: "Monthly compliance report generated and shared with stakeholders.",
                actor: "System",
                metadata: ["report_id": "rpt_789", "period": "2024-01"]
            ),
        ]
    }
    
    private func copyEventId(_ id: String) {
        UIPasteboard.general.string = id
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }
    
    private func exportEvent(_ event: AuditEvent) {
        // TODO: Implement export
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }
}

// MARK: - Audit Row Component

struct RMAuditRow: View {
    let event: AuditEvent
    
    var body: some View {
        HStack(spacing: RMTheme.Spacing.md) {
            // Category pill
            Text(event.category.prefix(3).uppercased())
                .font(RMTheme.Typography.captionBold)
                .foregroundColor(.white)
                .padding(.horizontal, RMTheme.Spacing.sm)
                .padding(.vertical, RMTheme.Spacing.xs)
                .background(categoryColor(event.category))
                .clipShape(Capsule())
                .frame(width: 60, alignment: .leading)
            
            // Summary
            VStack(alignment: .leading, spacing: RMTheme.Spacing.xs) {
                Text(event.summary)
                    .font(RMTheme.Typography.bodySmallBold)
                    .foregroundColor(RMTheme.Colors.textPrimary)
                    .lineLimit(2)
                
                Text(relativeTime(event.timestamp))
                    .font(RMTheme.Typography.caption)
                    .foregroundColor(RMTheme.Colors.textTertiary)
            }
            
            Spacer()
            
            Image(systemName: "chevron.right")
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(RMTheme.Colors.textTertiary)
        }
        .padding(.vertical, RMTheme.Spacing.sm)
        .padding(.horizontal, RMTheme.Spacing.md)
        .background(RMTheme.Colors.inputFill)
        .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm))
        .overlay(
            RoundedRectangle(cornerRadius: RMTheme.Radius.sm)
                .stroke(RMTheme.Colors.border, lineWidth: 0.5)
        )
    }
    
    private func categoryColor(_ category: String) -> Color {
        switch category.uppercased() {
        case "ACCESS": return RMTheme.Colors.categoryAccess
        case "OPS", "OPERATIONS": return RMTheme.Colors.categoryOperations
        case "GOV", "GOVERNANCE": return RMTheme.Colors.categoryGovernance
        default: return RMTheme.Colors.textTertiary
        }
    }
    
    private func relativeTime(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}

// MARK: - Audit Detail Sheet

struct RMAuditDetailSheet: View {
    let event: AuditEvent
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: RMTheme.Spacing.lg) {
                    // Header
                    VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
                        HStack {
                            Text(event.category)
                                .font(RMTheme.Typography.captionBold)
                                .foregroundColor(.white)
                                .padding(.horizontal, RMTheme.Spacing.md)
                                .padding(.vertical, RMTheme.Spacing.sm)
                                .background(categoryColor(event.category))
                                .clipShape(Capsule())
                            
                            Spacer()
                            
                            Text(relativeTime(event.timestamp))
                                .font(RMTheme.Typography.caption)
                                .foregroundColor(RMTheme.Colors.textTertiary)
                        }
                        
                        Text(event.summary)
                            .font(RMTheme.Typography.title2)
                            .foregroundColor(RMTheme.Colors.textPrimary)
                    }
                    
                    Divider()
                        .overlay(RMTheme.Colors.divider)
                    
                    // Details
                    if !event.details.isEmpty {
                        VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
                            Text("Details")
                                .font(RMTheme.Typography.bodyBold)
                                .foregroundColor(RMTheme.Colors.textPrimary)
                            
                            Text(event.details)
                                .font(RMTheme.Typography.body)
                                .foregroundColor(RMTheme.Colors.textSecondary)
                        }
                    }
                    
                    // Actor
                    if !event.actor.isEmpty {
                        VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
                            Text("Actor")
                                .font(RMTheme.Typography.bodyBold)
                                .foregroundColor(RMTheme.Colors.textPrimary)
                            
                            Text(event.actor)
                                .font(RMTheme.Typography.body)
                                .foregroundColor(RMTheme.Colors.textSecondary)
                        }
                    }
                    
                    // Metadata
                    if !event.metadata.isEmpty {
                        VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
                            Text("Metadata")
                                .font(RMTheme.Typography.bodyBold)
                                .foregroundColor(RMTheme.Colors.textPrimary)
                            
                            VStack(alignment: .leading, spacing: RMTheme.Spacing.xs) {
                                ForEach(Array(event.metadata.keys.sorted()), id: \.self) { key in
                                    HStack {
                                        Text(key.replacingOccurrences(of: "_", with: " ").capitalized)
                                            .font(RMTheme.Typography.caption)
                                            .foregroundColor(RMTheme.Colors.textTertiary)
                                        
                                        Spacer()
                                        
                                        Text("\(event.metadata[key] ?? "")")
                                            .font(RMTheme.Typography.captionBold)
                                            .foregroundColor(RMTheme.Colors.textPrimary)
                                    }
                                }
                            }
                            .padding(RMTheme.Spacing.md)
                            .background(RMTheme.Colors.inputFill)
                            .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm))
                        }
                    }
                    
                    // Event ID
                    HStack {
                        Text("Event ID")
                            .font(RMTheme.Typography.caption)
                            .foregroundColor(RMTheme.Colors.textTertiary)
                        
                        Spacer()
                        
                        Button {
                            UIPasteboard.general.string = event.id
                            UINotificationFeedbackGenerator().notificationOccurred(.success)
                        } label: {
                            HStack(spacing: RMTheme.Spacing.xs) {
                                Text(event.id)
                                    .font(RMTheme.Typography.captionBold)
                                    .foregroundColor(RMTheme.Colors.accent)
                                
                                Image(systemName: "doc.on.doc")
                                    .font(.system(size: 12))
                                    .foregroundColor(RMTheme.Colors.accent)
                            }
                        }
                    }
                    .padding(RMTheme.Spacing.md)
                    .background(RMTheme.Colors.inputFill)
                    .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm))
                }
                .padding(RMTheme.Spacing.md)
            }
            .background(RMBackground())
            .navigationTitle("Event Details")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                    .foregroundColor(RMTheme.Colors.accent)
                }
            }
        }
    }
    
    private func categoryColor(_ category: String) -> Color {
        switch category.uppercased() {
        case "ACCESS": return RMTheme.Colors.categoryAccess
        case "OPS", "OPERATIONS": return RMTheme.Colors.categoryOperations
        case "GOV", "GOVERNANCE": return RMTheme.Colors.categoryGovernance
        default: return RMTheme.Colors.textTertiary
        }
    }
    
    private func relativeTime(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}


#Preview {
    AuditFeedView()
}
