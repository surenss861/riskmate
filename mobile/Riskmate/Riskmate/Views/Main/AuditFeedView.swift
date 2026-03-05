import SwiftUI
import SwiftDate
import CryptoKit

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

    /// Same window as chrome (18→42, 24pt) so divider and card settle feel like one physical interaction.
    private var dividerOpacity: CGFloat {
        let amount = scrollAmount
        if amount < 18 { return 0 }
        if amount > 42 { return 0.075 }
        return 0.075 * (amount - 18) / 24
    }

    /// 0...1 over 18→42pt window (24pt); drives pinned chrome "attach" (fill + shadow). Feels physical, not snappy.
    private var chromeT: CGFloat {
        let amount = scrollAmount
        if amount < 18 { return 0 }
        return min(1, (amount - 18) / 24)
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
                    let tempURL = try? AuditExporter.exportJSON(events: events)
                    exportURL = tempURL
                    if let temp = tempURL, let (persistentURL, size, hash) = ExportPersistence.copyToExports(tempURL: temp, format: "json") {
                        lastExportedAt = Date()
                        ExportHistoryStore.shared.add(
                            filename: persistentURL.lastPathComponent,
                            date: Date(),
                            format: "JSON",
                            sizeBytes: size,
                            fileURL: persistentURL,
                            hash: hash
                        )
                        exportURL = persistentURL
                    } else if let temp = tempURL {
                        lastExportedAt = Date()
                        let size = (try? FileManager.default.attributesOfItem(atPath: temp.path)[.size] as? Int64) ?? 0
                        ExportHistoryStore.shared.add(
                            filename: temp.lastPathComponent,
                            date: Date(),
                            format: "JSON",
                            sizeBytes: size,
                            fileURL: nil,
                            hash: nil
                        )
                    }
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
    @State private var showingExportHistory = false
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
                    VStack(spacing: 0) {
                        Toggle("Include signatures", isOn: $includeSignatures)
                            .tint(RMTheme.Colors.accent)
                        Divider()
                            .background(RMTheme.Colors.border.opacity(0.5))
                        Toggle("Include photos", isOn: $includePhotos)
                            .tint(RMTheme.Colors.accent)
                    }
                    .padding(.horizontal, RMTheme.Spacing.cardPadding)
                    .padding(.vertical, RMTheme.Spacing.sm)
                    .listRowInsets(EdgeInsets(top: 0, leading: 0, bottom: 0, trailing: 0))
                    .listRowBackground(
                        RoundedRectangle(cornerRadius: RMTheme.Radius.card, style: .continuous)
                            .fill(RMTheme.Colors.surface2.opacity(0.92))
                            .overlay(
                                RoundedRectangle(cornerRadius: RMTheme.Radius.card, style: .continuous)
                                    .stroke(RMTheme.Colors.border.opacity(RMTheme.Surfaces.strokeOpacity), lineWidth: 1)
                            )
                    )
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
                        showingExportHistory = true
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
                        triggerExport()
                    }
                    .fontWeight(.semibold)
                    .foregroundColor(RMTheme.Colors.accent)
                    .disabled(isGenerating)
                }
            }
            .safeAreaInset(edge: .bottom, spacing: 0) {
                VStack(spacing: 0) {
                    Rectangle()
                        .fill(RMTheme.Colors.border.opacity(0.5))
                        .frame(height: 1)
                    Button {
                        Haptics.tap()
                        triggerExport()
                    } label: {
                        Group {
                            if isGenerating {
                                HStack(spacing: RMTheme.Spacing.sm) {
                                    ProgressView()
                                        .tint(.black)
                                    Text("Generating…")
                                        .font(RMTheme.Typography.bodyBold)
                                        .foregroundColor(.black.opacity(0.8))
                                }
                            } else {
                                Text("Generate Proof Pack")
                                    .font(RMTheme.Typography.bodyBold)
                                    .foregroundColor(.black)
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 52)
                        .background(RMTheme.Colors.accent)
                        .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.md))
                    }
                    .buttonStyle(.plain)
                    .disabled(isGenerating)
                    .opacity(isGenerating ? 0.7 : 1)
                    .padding(.horizontal, RMTheme.Spacing.pagePadding)
                    .padding(.top, RMTheme.Spacing.sm)
                    .padding(.bottom, RMTheme.Spacing.sm)
                }
                .background(RMTheme.Colors.background)
            }
            .sheet(isPresented: $showingExportHistory) {
                ExportHistorySheet()
            }
        }
    }

    private func triggerExport() {
        isGenerating = true
        onExport()
        ToastCenter.shared.show("Proof Pack exported", systemImage: "checkmark.circle", style: .success)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.65) {
            isGenerating = false
            dismiss()
        }
    }
}

// MARK: - Persistent export (Application Support/Exports); Share always works
private enum ExportPersistence {
    static let exportsSubfolder = "Exports"
    static let filenamePrefix = "riskmate-proof-pack"
    private static let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd-HHmm"
        return f
    }()

    /// Copy temp export to Application Support/Exports/ with human-readable unique filename. Extension matches format (json/pdf/csv). Returns (persistentURL, sizeBytes, sha256Hex) or nil.
    static func copyToExports(tempURL: URL, format: String) -> (URL, Int64, String?)? {
        guard let data = try? Data(contentsOf: tempURL) else { return nil }
        let fileManager = FileManager.default
        guard let appSupport = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else { return nil }
        let exportsDir = appSupport.appendingPathComponent(exportsSubfolder, isDirectory: true)
        try? fileManager.createDirectory(at: exportsDir, withIntermediateDirectories: true)
        let ext: String
        switch format.lowercased() {
        case "pdf": ext = "pdf"
        case "csv": ext = "csv"
        default: ext = "json"
        }
        let dateStr = dateFormatter.string(from: Date())
        let filename = "\(filenamePrefix)-\(dateStr).\(ext)"
        let destURL = exportsDir.appendingPathComponent(filename)
        do {
            try data.write(to: destURL, options: .atomic)
        } catch {
            return nil
        }
        let size = (try? fileManager.attributesOfItem(atPath: destURL.path)[.size] as? Int64) ?? Int64(data.count)
        let digest = SHA256.hash(data: data)
        let hash = digest.map { String(format: "%02x", $0) }.joined()
        return (destURL, size, hash)
    }
}

// MARK: - Export history (local list: filename, time, format, size, copy hash, Share)
struct ExportHistoryEntry: Identifiable {
    let id: UUID
    let filename: String
    let date: Date
    let format: String
    let sizeBytes: Int64
    let fileURL: URL?
    let hash: String?
    init(id: UUID = UUID(), filename: String, date: Date, format: String, sizeBytes: Int64, fileURL: URL? = nil, hash: String? = nil) {
        self.id = id
        self.filename = filename
        self.date = date
        self.format = format
        self.sizeBytes = sizeBytes
        self.fileURL = fileURL
        self.hash = hash
    }
    var sizeDisplay: String {
        let formatter = ByteCountFormatter()
        formatter.countStyle = .file
        return formatter.string(fromByteCount: sizeBytes)
    }
    var hashPreview: String? { hash.map { String($0.prefix(12)) + "…" } }
}

final class ExportHistoryStore: ObservableObject {
    static let shared = ExportHistoryStore()
    @Published private(set) var entries: [ExportHistoryEntry] = []
    private let maxEntries = 50

    func add(filename: String, date: Date, format: String, sizeBytes: Int64, fileURL: URL? = nil, hash: String? = nil) {
        let entry = ExportHistoryEntry(filename: filename, date: date, format: format, sizeBytes: sizeBytes, fileURL: fileURL, hash: hash)
        entries.insert(entry, at: 0)
        if entries.count > maxEntries { entries.removeLast() }
    }

    func remove(id: UUID) {
        entries.removeAll { $0.id == id }
    }
}

struct ExportHistorySheet: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var store = ExportHistoryStore.shared
    @State private var shareItem: IdentifiableURL?

    var body: some View {
        NavigationStack {
            Group {
                if store.entries.isEmpty {
                    ContentUnavailableView(
                        "No exports yet",
                        systemImage: "doc.badge.clock",
                        description: Text("Export a Proof Pack from the Ledger to see it here.")
                    )
                } else {
                    List {
                        ForEach(store.entries) { entry in
                            ExportHistoryRow(entry: entry, onShare: {
                                if let url = entry.fileURL {
                                    shareItem = IdentifiableURL(url: url)
                                }
                            }, onDelete: {
                                deleteExport(entry)
                            })
                        }
                    }
                }
            }
            .navigationTitle("Export History")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") {
                        Haptics.tap()
                        dismiss()
                    }
                    .foregroundColor(RMTheme.Colors.accent)
                }
            }
            .sheet(item: $shareItem) { item in
                ShareSheet(items: [item.url])
            }
        }
    }

    private func deleteExport(_ entry: ExportHistoryEntry) {
        ExportHistoryStore.shared.remove(id: entry.id)
        if let url = entry.fileURL {
            do {
                try FileManager.default.removeItem(at: url)
                ToastCenter.shared.show("Deleted export", systemImage: "trash", style: .success)
            } catch {
                ToastCenter.shared.show("Removed from history", systemImage: "doc.badge.clock", style: .success)
            }
        } else {
            ToastCenter.shared.show("Removed from history", systemImage: "doc.badge.clock", style: .success)
        }
    }
}

private struct IdentifiableURL: Identifiable {
    let id = UUID()
    let url: URL
}

private struct ExportHistoryRow: View {
    let entry: ExportHistoryEntry
    let onShare: () -> Void
    let onDelete: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: RMTheme.Spacing.sm) {
            Image(systemName: "doc.fill")
                .font(.system(size: 20))
                .foregroundColor(RMTheme.Colors.textSecondary.opacity(0.8))
                .frame(width: 40, height: 40)
                .background(RMTheme.Colors.surface1.opacity(0.6), in: RoundedRectangle(cornerRadius: 10))
            VStack(alignment: .leading, spacing: 4) {
                Text(entry.filename)
                    .font(RMTheme.Typography.bodyBold)
                    .foregroundColor(RMTheme.Colors.textPrimary)
                    .lineLimit(1)
                    .truncationMode(.middle)
                Text("\(entry.format) • \(entry.sizeDisplay)")
                    .font(RMTheme.Typography.metadataSmall)
                    .foregroundColor(RMTheme.Colors.textTertiary)
                Text(entry.date, style: .relative)
                    .font(RMTheme.Typography.metadataSmall)
                    .foregroundColor(RMTheme.Colors.textTertiary.opacity(0.85))
                HStack(spacing: 8) {
                    Button {
                        Haptics.impact(.light)
                        if let h = entry.hash {
                            UIPasteboard.general.string = h
                            ToastCenter.shared.show("Copied hash", systemImage: "doc.on.doc", style: .success)
                        } else {
                            UIPasteboard.general.string = entry.filename
                            ToastCenter.shared.show("Copied name", systemImage: "doc.on.doc", style: .success)
                        }
                    } label: {
                        HStack(spacing: 4) {
                            Text(entry.hashPreview ?? entry.filename)
                                .font(RMTheme.Typography.metadata)
                                .foregroundColor(RMTheme.Colors.textSecondary)
                                .lineLimit(1)
                                .truncationMode(.middle)
                            Image(systemName: "doc.on.doc")
                                .font(.system(size: 10))
                                .foregroundColor(RMTheme.Colors.textTertiary)
                        }
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(RMTheme.Colors.surface1.opacity(0.65), in: Capsule())
                    }
                    .buttonStyle(.plain)
                    if let url = entry.fileURL, FileManager.default.fileExists(atPath: url.path) {
                        Button {
                            Haptics.tap()
                            onShare()
                        } label: {
                            Label("Share", systemImage: "square.and.arrow.up")
                                .font(RMTheme.Typography.captionBold)
                                .foregroundColor(RMTheme.Colors.accent)
                        }
                        .buttonStyle(.plain)
                    }
                    Spacer()
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.vertical, 6)
        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
            Button(role: .destructive) {
                Haptics.impact(.light)
                onDelete()
            } label: {
                Label("Delete", systemImage: "trash")
            }
        }
    }
}

#Preview {
    AuditFeedView()
}
