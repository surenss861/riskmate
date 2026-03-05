import SwiftUI
import SwiftDate

/// Audit feed with native list, category pills, and detail sheets
struct AuditFeedView: View {
    @StateObject private var entitlements = EntitlementsManager.shared
    @State private var events: [AuditEvent] = []
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var selectedEvent: AuditEvent?
    @State private var showingDetail = false
    @State private var exportURL: URL?
    @State private var showingVerificationDetails = false
    @State private var showingVerificationExplainer = false
    @State private var showFirstVisitAnimation = false
    @State private var showingExportSheet = false
    @State private var lastExportedAt: Date?
    @State private var scrollY: CGFloat = 0
    @State private var scrollBaselineY: CGFloat?
    @AppStorage("riskmate.ledger.firstVisit") private var hasSeenFirstVisit = false

    private let ledgerScrollSpace = "ledgerScroll"
    private var rbac: RBAC { RBAC(role: entitlements.entitlements?.role) }

    private var scrollAmount: CGFloat {
        max(0, (scrollBaselineY ?? 0) - scrollY)
    }

    private var dividerOpacity: CGFloat {
        let amount = scrollAmount
        if amount < 16 { return 0 }
        if amount > 28 { return 0.075 }
        return 0.075 * (amount - 16) / 12
    }

    /// 0...1 over same 16pt window; drives pinned chrome "attach" (fill + shadow).
    private var chromeT: CGFloat {
        let amount = scrollAmount
        if amount < 16 { return 0 }
        return min(1, (amount - 16) / 16)
    }

    /// Events sorted by timestamp desc, grouped by calendar day
    private var groupedByDay: [(day: Date, label: String, events: [AuditEvent])] {
        let cal = Calendar.current
        let sorted = events.sorted { $0.timestamp > $1.timestamp }
        let grouped = Dictionary(grouping: sorted) { cal.startOfDay(for: $0.timestamp) }
        return grouped.keys.sorted(by: >).map { day in
            let dayEvents = grouped[day] ?? []
            let label: String
            if cal.isDateInToday(day) { label = "Today" }
            else if cal.isDateInYesterday(day) { label = "Yesterday" }
            else {
                let formatter = DateFormatter()
                formatter.dateFormat = "MMM d"
                label = formatter.string(from: day)
            }
            return (day: day, label: label, events: dayEvents)
        }
    }

    var body: some View {
        RMBackground()
            .overlay {
                VStack(spacing: 0) {
                    RMOfflineBanner()

                    if isLoading {
                        // Premium skeleton loading
                        ScrollView {
                            VStack(spacing: RMTheme.Spacing.md) {
                                RMSkeletonList(count: 8)
                            }
                            .padding(.top, RMTheme.Spacing.sm)
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
                            title: "First proof will appear here",
                            message: "Every action creates an immutable ledger event. Your first proof record will show up once you add evidence to a job from Operations or Work Records.",
                            action: nil
                        )
                    } else {
                        ledgerTimelineList
                    }
                }
            }
        .rmNavigationBar(title: "Ledger")
        .toolbar(.hidden, for: .navigationBar)
        .safeAreaInset(edge: .top, spacing: 0) {
            RMTopBar(title: "Ledger", notificationBadge: 0) {
                Menu {
                    Button {
                        Haptics.tap()
                        showingVerificationExplainer = true
                    } label: {
                        Label("What is Verified?", systemImage: "questionmark.circle")
                    }
                    if rbac.canExportLedger {
                        Button {
                            Haptics.tap()
                            showingExportSheet = true
                        } label: {
                            Label("Export Proof Pack", systemImage: "square.and.arrow.up")
                        }
                        Button {
                            Haptics.tap()
                            exportURL = try? AuditExporter.exportJSON(events: events)
                            if exportURL != nil { lastExportedAt = Date() }
                        } label: {
                            Label("Export JSON", systemImage: "curlybraces")
                        }
                        .disabled(events.isEmpty)
                        Button {
                            Haptics.tap()
                            exportURL = try? AuditExporter.exportCSV(events: events)
                            if exportURL != nil { lastExportedAt = Date() }
                        } label: {
                            Label("Export CSV", systemImage: "tablecells")
                        }
                        .disabled(events.isEmpty)
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                        .font(.system(size: 20))
                        .foregroundColor(RMTheme.Colors.textSecondary)
                }
            }
        }
        .safeAreaInset(edge: .top, spacing: 0) {
            LedgerExportControl(
                lastExportedAt: lastExportedAt,
                dividerOpacity: dividerOpacity,
                chromeT: chromeT,
                onExportTapped: { showingExportSheet = true }
            )
        }
        .onPreferenceChange(ScrollYKey.self) { value in
            if scrollBaselineY == nil { scrollBaselineY = value }
            scrollY = value
        }
        .onAppear {
            // Show first-visit animation once
            if !hasSeenFirstVisit && !isLoading && !events.isEmpty {
                hasSeenFirstVisit = true
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    withAnimation(.spring(response: 0.6, dampingFraction: 0.8)) {
                        showFirstVisitAnimation = true
                    }
                    // Hide after animation completes
                    DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) {
                        withAnimation(.easeOut(duration: 0.3)) {
                            showFirstVisitAnimation = false
                        }
                    }
                }
            }
        }
        .task {
            await loadEvents()
        }
        .sheet(isPresented: $showingDetail) {
            if let event = selectedEvent {
                ProofDetailSheet(event: event)
                    .presentationDetents([.medium, .large])
                    .presentationDragIndicator(.visible)
            }
        }
        .sheet(item: $exportURL, onDismiss: { exportURL = nil }) { url in
            ShareSheet(items: [url])
        }
        .sheet(isPresented: $showingVerificationDetails) {
            VerificationDetailsView()
        }
        .sheet(isPresented: $showingVerificationExplainer) {
            VerificationExplainerSheet()
        }
        .sheet(isPresented: $showingExportSheet) {
            LedgerExportSheet(
                eventCount: events.count,
                onExport: {
                    showingExportSheet = false
                    exportURL = try? AuditExporter.exportJSON(events: events)
                    if exportURL != nil { lastExportedAt = Date() }
                },
                onDismiss: { showingExportSheet = false }
            )
        }
    }

    private var ledgerTimelineList: some View {
        List {
            Section {
                Color.clear
                    .frame(height: 1)
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
                    .trackScrollY(in: ledgerScrollSpace)
            }
            ForEach(groupedByDay, id: \.day) { group in
                Section {
                    ForEach(group.events) { event in
                        ledgerRow(for: event)
                    }
                } header: {
                    LedgerDaySectionHeader(title: group.label, eventCount: group.events.count)
                }
                .listSectionSpacing(RMTheme.Spacing.sectionSpacing)
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .coordinateSpace(name: ledgerScrollSpace)
        .refreshable { await loadEvents() }
    }

    private func ledgerRow(for event: AuditEvent) -> some View {
        let isBlocked = event.category == "GOVERNANCE" && (event.metadata["blocked"] == "true" || event.summary.lowercased().contains("blocked"))
        let status: LedgerTimelineRow.LedgerEventStatus = isBlocked ? .error : .verified
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        let timeText = formatter.localizedString(for: event.timestamp, relativeTo: Date())
        let hashPreview = String(event.id.prefix(12)) + "…"

        LedgerTimelineRow(
            title: isBlocked ? "Action Blocked" : event.summary,
            subtitle: "\(event.category) • \(event.actor.isEmpty ? "System" : event.actor)",
            hashPreview: hashPreview,
            fullHash: event.id,
            timeText: timeText,
            status: status,
            isVerified: !isBlocked,
            onTap: { selectedEvent = event; showingDetail = true }
        )
        .listRowInsets(EdgeInsets(top: 6, leading: RMTheme.Spacing.pagePadding, bottom: 6, trailing: RMTheme.Spacing.pagePadding))
        .listRowBackground(Color.clear)
        .listRowSeparator(.hidden)
        .contextMenu {
            Button {
                copyEventId(event.id)
            } label: {
                Label("Copy Event ID", systemImage: "doc.on.doc")
            }
            Button {
                selectedEvent = event
                showingDetail = true
            } label: {
                Label("View Details", systemImage: "eye")
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

// MARK: - Export sheet (format, scope, toggles, Generate + loading + success toast)
struct LedgerExportSheet: View {
    let eventCount: Int
    let onExport: () -> Void
    let onDismiss: () -> Void
    @State private var includeSignatures = true
    @State private var includePhotos = true
    @State private var isGenerating = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Label("PDF", systemImage: "doc.fill")
                        .font(RMTheme.Typography.bodyBold)
                } header: {
                    Text("Format")
                }
                Section {
                    Text("All events")
                        .font(RMTheme.Typography.body)
                } header: {
                    Text("Scope")
                }
                Section {
                    Toggle("Include signatures", isOn: $includeSignatures)
                        .tint(RMTheme.Colors.accent)
                    Toggle("Include photos", isOn: $includePhotos)
                        .tint(RMTheme.Colors.accent)
                }
                if isGenerating {
                    Section {
                        HStack(spacing: RMTheme.Spacing.sm) {
                            ProgressView()
                            Text("Generating Proof Pack…")
                                .font(RMTheme.Typography.secondaryLabelLarge)
                                .foregroundColor(RMTheme.Colors.textSecondary)
                        }
                        .frame(maxWidth: .infinity)
                    }
                }
                Section {
                    Button {
                        Haptics.tap()
                        onDismiss()
                        dismiss()
                    } label: {
                        Label("View export history", systemImage: "clock.arrow.circlepath")
                            .font(RMTheme.Typography.body)
                            .foregroundColor(RMTheme.Colors.accent)
                    }
                }
            }
            .navigationTitle("Export Proof Pack")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        Haptics.tap()
                        onDismiss()
                        dismiss()
                    }
                    .foregroundColor(RMTheme.Colors.textSecondary)
                    .disabled(isGenerating)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Generate") {
                        Haptics.tap()
                        isGenerating = true
                        onExport()
                        ToastCenter.shared.show("Proof Pack exported", systemImage: "checkmark.circle", style: .success)
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.65) {
                            isGenerating = false
                            dismiss()
                        }
                    }
                    .fontWeight(.semibold)
                    .foregroundColor(RMTheme.Colors.accent)
                    .disabled(isGenerating)
                }
            }
        }
    }
}

#Preview {
    AuditFeedView()
}
