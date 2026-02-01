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
    @AppStorage("riskmate.ledger.firstVisit") private var hasSeenFirstVisit = false

    private var rbac: RBAC { RBAC(role: entitlements.entitlements?.role) }
    
    var body: some View {
        RMBackground()
            .overlay {
                VStack(spacing: 0) {
                    RMOfflineBanner()
                    
                    // Trust Strip (always visible, unforgeable status)
                    LedgerTrustStrip(
                        isVerified: true, // TODO: Wire to actual verification status
                        lastAnchored: Date(), // TODO: Wire to actual anchor timestamp
                        onTap: {
                            showingVerificationExplainer = true
                        }
                    )
                    .overlay(alignment: .center) {
                        // First-visit "holy sh*t" moment: Proof hash → anchor → lock animation
                        if showFirstVisitAnimation && !UIAccessibility.isReduceMotionEnabled {
                            FirstVisitAnimationView()
                                .transition(.opacity.combined(with: .scale))
                                .zIndex(1000) // Ensure it appears above other content
                        }
                    }
                    
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
                            title: "First proof will appear here",
                            message: "Every action creates an immutable ledger event. Your first proof record will show up once you add evidence to a job from Operations or Work Records.",
                            action: nil
                        )
                    } else {
                        List {
                            Section("Proof Records") {
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
                                        }
                                        .contextMenu {
                                            Button {
                                                copyEventId(event.id)
                                            } label: {
                                                Label("Copy Event ID", systemImage: "doc.on.doc")
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
                                    // System-native Ledger Receipt Card (Proof Receipt)
                                    LedgerReceiptCard(
                                        title: event.summary,
                                        subtitle: "\(event.category) • \(event.actor.isEmpty ? "System" : event.actor)",
                                        timeAgo: event.timestamp.toRelative(since: nil, dateTimeStyle: .named, unitsStyle: .short),
                                        hashPreview: String(event.id.prefix(12)) + "...",
                                        fullHash: event.id,
                                        proofID: String(event.id.prefix(8)).uppercased()
                                    )
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
                                        .tint(Color(.systemBlue))
                                    }
                                    .contextMenu {
                                        Button {
                                            copyEventId(event.id)
                                        } label: {
                                            Label("Copy Event ID", systemImage: "doc.on.doc")
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
                        .listStyle(.insetGrouped)
                        .scrollContentBackground(.hidden)
                        .refreshable {
                            await loadEvents()
                        }
                    }
                }
            }
        }
        .rmNavigationBar(title: "Ledger")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
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
                            exportURL = try? AuditExporter.exportJSON(events: events)
                        } label: {
                            Label("Export JSON", systemImage: "curlybraces")
                        }
                        .disabled(events.isEmpty)
                        Button {
                            Haptics.tap()
                            exportURL = try? AuditExporter.exportCSV(events: events)
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
        .syncStatusChip()
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


#Preview {
    AuditFeedView()
}
