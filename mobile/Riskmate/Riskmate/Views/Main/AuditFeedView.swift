import SwiftUI
import SwiftDate

/// Audit feed with native list, category pills, and detail sheets
struct AuditFeedView: View {
    @State private var events: [AuditEvent] = []
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var selectedEvent: AuditEvent?
    @State private var showingDetail = false
    
    var body: some View {
        RMBackground()
            .overlay {
                VStack(spacing: 0) {
                    RMOfflineBanner()
                    
                    // Integrity Surface Pinned at Top
                    LedgerIntegritySurface()
                        .padding(.horizontal, RMTheme.Spacing.pagePadding)
                        .padding(.top, RMTheme.Spacing.sm)
                    
                    // Saved Views as Horizontal Cards
                    SavedViewsCarousel()
                        .padding(.horizontal, RMTheme.Spacing.pagePadding)
                        .padding(.top, RMTheme.Spacing.md)
                    
                    if isLoading {
                    // Premium skeleton loading
                    ScrollView {
                        VStack(spacing: RMTheme.Spacing.md) {
                            RMSkeletonList(count: 8)
                        }
                        .padding(.top, RMTheme.Spacing.md)
                    }
                } else if let errorMessage = errorMessage {
                    // Error state - show error with retry
                    VStack(spacing: RMTheme.Spacing.lg) {
                        RMEmptyState(
                            icon: "exclamationmark.triangle.fill",
                            title: "Failed to Load Events",
                            message: errorMessage,
                            action: RMEmptyStateAction(
                                title: "Retry",
                                action: {
                                    Task {
                                        await loadEvents()
                                    }
                                }
                            )
                        )
                    }
                    .padding(RMTheme.Spacing.pagePadding)
                } else if events.isEmpty {
                    RMEmptyState(
                        icon: "tray",
                        title: "No Audit Events",
                        message: "No events in last 30 days. Try viewing 90 days or all time.",
                        action: RMEmptyStateAction(
                            title: "View 90 Days",
                            action: {
                                // TODO: Change time range filter
                            }
                        )
                    )
                } else {
                    List {
                        ForEach(events) { event in
                            // Use enforcement row for blocked events
                            if event.category == "GOVERNANCE" && (event.metadata["blocked"] == "true" || event.summary.lowercased().contains("blocked")) {
                                EnforcementRow(event: event)
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
                                    .contextMenu {
                                        Button {
                                            copyEventId(event.id)
                                        } label: {
                                            Label("Copy Event ID", systemImage: "doc.on.doc")
                                        }
                                        
                                        Button {
                                            exportEvent(event)
                                        } label: {
                                            Label("Export", systemImage: "square.and.arrow.up")
                                        }
                                        
                                        Divider()
                                        
                                        Button {
                                            selectedEvent = event
                                            showingDetail = true
                                        } label: {
                                            Label("View Details", systemImage: "eye")
                                        }
                                    }
                                    .onTapGesture {
                                        let generator = UIImpactFeedbackGenerator(style: .light)
                                        generator.impactOccurred()
                                        selectedEvent = event
                                        showingDetail = true
                                    }
                            } else {
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
                                    .contextMenu {
                                        Button {
                                            copyEventId(event.id)
                                        } label: {
                                            Label("Copy Event ID", systemImage: "doc.on.doc")
                                        }
                                        
                                        Button {
                                            exportEvent(event)
                                        } label: {
                                            Label("Export", systemImage: "square.and.arrow.up")
                                        }
                                        
                                        Divider()
                                        
                                        Button {
                                            selectedEvent = event
                                            showingDetail = true
                                        } label: {
                                            Label("View Details", systemImage: "eye")
                                        }
                                    }
                                    .onTapGesture {
                                        let generator = UIImpactFeedbackGenerator(style: .light)
                                        generator.impactOccurred()
                                        selectedEvent = event
                                        showingDetail = true
                                    }
                            }
                        }
                    }
                    .listStyle(.plain)
                    .scrollContentBackground(.hidden)
                    }
                }
            }
            .rmNavigationBar(title: "Ledger")
            .syncStatusChip()
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
        errorMessage = nil
        defer { isLoading = false }
        
        do {
            events = try await APIClient.shared.getAuditEvents(timeRange: "30d", limit: 100)
            errorMessage = nil // Clear any previous error
        } catch {
            let errorDesc = error.localizedDescription
            print("[AuditFeedView] ❌ Failed to load events: \(errorDesc)")
            errorMessage = errorDesc
            events = [] // Clear events on error - never show stale data
        }
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
        return date.toRelative(since: nil, dateTimeStyle: .named, unitsStyle: .short)
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
        return date.toRelative(since: nil, dateTimeStyle: .named, unitsStyle: .short)
    }
}


#Preview {
    AuditFeedView()
}
