import SwiftUI
import Supabase

// MARK: - Job Activity View

/// Native SwiftUI view that displays job activity in a chronological list with pull-to-refresh,
/// pagination, and filtering (actor, event type, date range).
struct JobActivityView: View {
    let jobId: String

    @State private var events: [ActivityEvent] = []
    @State private var isLoading = true
    @State private var isLoadingMore = false
    @State private var hasMore = true
    @State private var offset = 0
    private let pageSize = 50
    @State private var showFilterSheet = false
    @State private var filterActorId: String?
    @State private var filterEventTypes: Set<String> = []
    @State private var filterStartDate: Date?
    @State private var filterEndDate: Date?
    @State private var appliedFilters: ActivityFilters = ActivityFilters()
    @State private var actors: [ActivityActor] = []
    @State private var loadError: String?
    @State private var loadMoreError: String?
    @StateObject private var realtimeService = JobActivityRealtimeService()

    private var hasActiveFilters: Bool {
        appliedFilters.actorId != nil
            || !appliedFilters.eventTypes.isEmpty
            || appliedFilters.startDate != nil
            || appliedFilters.endDate != nil
    }

    var body: some View {
        Group {
            if isLoading && events.isEmpty && loadError == nil {
                loadingSkeleton
            } else if let error = loadError, events.isEmpty {
                errorState(message: error, retry: { Task { await retryLoadInitial() } })
            } else if events.isEmpty {
                emptyState
            } else {
                VStack(spacing: 0) {
                    if let error = loadError {
                        loadErrorBanner(message: error) { Task { await retryLoadInitial() } }
                    }
                    activityList
                    if let moreError = loadMoreError {
                        loadMoreErrorBanner(message: moreError) {
                            Task { await retryLoadMore() }
                        }
                    }
                }
            }
        }
        .refreshable {
            await refresh()
        }
        .task(id: jobId) {
            await loadInitial()
            await withTaskCancellationHandler {
                await realtimeService.subscribeAndWait(jobId: jobId)
            } onCancel: {
                Task { await realtimeService.unsubscribe() }
            }
        }
        .onChange(of: realtimeService.newEvent) { _, newEvent in
            guard let event = newEvent else { return }
            events.insert(event, at: 0)
            offset += 1
            realtimeService.clearNewEvent()
            Task { await loadActorsIfNeeded() }
            ToastCenter.shared.show("New activity", systemImage: "bell.badge", style: .info)
        }
        .sheet(isPresented: $showFilterSheet) {
            ActivityFilterSheet(
                actorId: $filterActorId,
                eventTypes: $filterEventTypes,
                startDate: $filterStartDate,
                endDate: $filterEndDate,
                actors: actors,
                eventTypeOptions: eventTypeOptions,
                onApply: {
                    appliedFilters = ActivityFilters(
                        actorId: filterActorId,
                        eventTypes: Array(filterEventTypes),
                        startDate: filterStartDate,
                        endDate: filterEndDate
                    )
                    showFilterSheet = false
                    Haptics.tap()
                    Task { await loadInitial() }
                },
                onClear: {
                    filterActorId = nil
                    filterEventTypes = []
                    filterStartDate = nil
                    filterEndDate = nil
                    appliedFilters = ActivityFilters()
                    showFilterSheet = false
                    Haptics.tap()
                    Task { await loadInitial() }
                }
            )
            .onAppear {
                filterActorId = appliedFilters.actorId
                filterEventTypes = Set(appliedFilters.eventTypes)
                filterStartDate = appliedFilters.startDate
                filterEndDate = appliedFilters.endDate
            }
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    Haptics.tap()
                    showFilterSheet = true
                } label: {
                    ZStack(alignment: .topTrailing) {
                        Image(systemName: "line.3.horizontal.decrease.circle")
                            .foregroundColor(RMTheme.Colors.textSecondary)
                        if hasActiveFilters {
                            Circle()
                                .fill(RMTheme.Colors.accent)
                                .frame(width: 8, height: 8)
                                .offset(x: 4, y: -4)
                        }
                    }
                }
                .accessibilityLabel("Filter activity")
            }
        }
    }

    private var loadingSkeleton: some View {
        VStack(spacing: RMTheme.Spacing.sm) {
            RMSkeletonList(count: 6)
        }
        .padding(RMTheme.Spacing.pagePadding)
    }

    private var emptyState: some View {
        RMEmptyState(
            icon: "clock.arrow.circlepath",
            title: "No activity yet",
            message: "Activity will appear here as team members work on this job"
        )
        .padding(RMTheme.Spacing.pagePadding)
    }

    private func errorState(message: String, retry: @escaping () -> Void) -> some View {
        VStack(spacing: RMTheme.Spacing.md) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 40))
                .foregroundColor(RMTheme.Colors.warning)
            Text("Couldn't load activity")
                .font(RMTheme.Typography.bodyBold)
                .foregroundColor(RMTheme.Colors.textPrimary)
            Text(message)
                .font(RMTheme.Typography.bodySmall)
                .foregroundColor(RMTheme.Colors.textSecondary)
                .multilineTextAlignment(.center)
            Button("Retry", action: retry)
                .font(RMTheme.Typography.bodySmallBold)
                .foregroundColor(RMTheme.Colors.accent)
        }
        .padding(RMTheme.Spacing.pagePadding)
    }

    private func loadErrorBanner(message: String, retry: @escaping () -> Void) -> some View {
        HStack {
            Text(message)
                .font(RMTheme.Typography.caption)
                .foregroundColor(RMTheme.Colors.textSecondary)
            Spacer()
            Button("Retry", action: retry)
                .font(RMTheme.Typography.caption)
                .foregroundColor(RMTheme.Colors.accent)
        }
        .padding(RMTheme.Spacing.sm)
        .background(RMTheme.Colors.surface.opacity(0.8))
    }

    private func loadMoreErrorBanner(message: String, retry: @escaping () -> Void) -> some View {
        HStack {
            Text(message)
                .font(RMTheme.Typography.caption)
                .foregroundColor(RMTheme.Colors.textSecondary)
            Spacer()
            Button("Retry", action: retry)
                .font(RMTheme.Typography.caption)
                .foregroundColor(RMTheme.Colors.accent)
        }
        .padding(RMTheme.Spacing.sm)
        .background(RMTheme.Colors.surface.opacity(0.8))
    }

    private var activityList: some View {
        List {
            ForEach(events) { event in
                ActivityCardView(event: event)
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.visible)
                    .listRowInsets(EdgeInsets(
                        top: RMTheme.Spacing.sm,
                        leading: RMTheme.Spacing.pagePadding,
                        bottom: RMTheme.Spacing.sm,
                        trailing: RMTheme.Spacing.pagePadding
                    ))
            }
            if hasMore && !events.isEmpty {
                HStack {
                    Spacer()
                    if isLoadingMore {
                        ProgressView()
                            .padding()
                    } else {
                        Color.clear
                            .frame(height: 1)
                            .onAppear { Task { await loadMore() } }
                    }
                    Spacer()
                }
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
    }

    /// Event types from loaded events, or fallback list so filter sheet is useful with no data
    private var eventTypeOptions: [String] {
        let fromEvents = Array(Set(events.compactMap { $0.eventName ?? $0.eventType })).sorted()
        if !fromEvents.isEmpty { return fromEvents }
        return Self.knownEventTypes
    }

    /// Known event types from spec so users can filter even when no activity is loaded yet
    private static let knownEventTypes: [String] = [
        "assignment.created",
        "assignment.removed",
        "control.added",
        "control.updated",
        "control.created",
        "control.verified",
        "document.uploaded",
        "document.deleted",
        "document.category_changed",
        "evidence.approved",
        "evidence.rejected",
        "evidence.uploaded",
        "evidence.deleted",
        "export.generated",
        "export.pack.generated",
        "hazard.added",
        "hazard.updated",
        "job.created",
        "job.updated",
        "job.status_changed",
        "job.assigned",
        "job.completed",
        "permit_pack.generated",
        "photo.uploaded",
        "proof_pack.generated",
        "signature.added",
        "worker.assigned",
        "worker.unassigned",
    ]

    private func loadInitial() async {
        loadError = nil
        isLoading = true
        offset = 0
        hasMore = true
        defer { isLoading = false }
        do {
            let (fetched, more) = try await APIClient.shared.getJobActivity(
                jobId: jobId,
                limit: pageSize,
                offset: 0,
                actorId: appliedFilters.actorId,
                eventTypes: appliedFilters.eventTypes.isEmpty ? nil : appliedFilters.eventTypes,
                category: nil,
                startDate: appliedFilters.startDate.flatMap { isoDate($0) },
                endDate: appliedFilters.endDate.flatMap { isoDate($0) }
            )
            events = fetched
            hasMore = more
            offset = fetched.count
            await loadActorsIfNeeded()
        } catch {
            let message = userFacingErrorMessage(error)
            loadError = message
            ToastCenter.shared.show(message, systemImage: "exclamationmark.triangle", style: .error)
            // Keep existing events; do not replace with []
        }
    }

    private func refresh() async {
        await loadInitial()
    }

    private func loadMore() async {
        guard !isLoadingMore, hasMore else { return }
        isLoadingMore = true
        defer { isLoadingMore = false }
        do {
            let (fetched, more) = try await APIClient.shared.getJobActivity(
                jobId: jobId,
                limit: pageSize,
                offset: offset,
                actorId: appliedFilters.actorId,
                eventTypes: appliedFilters.eventTypes.isEmpty ? nil : appliedFilters.eventTypes,
                category: nil,
                startDate: appliedFilters.startDate.flatMap { isoDate($0) },
                endDate: appliedFilters.endDate.flatMap { isoDate($0) }
            )
            events.append(contentsOf: fetched)
            hasMore = more
            offset += fetched.count
            loadMoreError = nil
            await loadActorsIfNeeded()
        } catch {
            let message = userFacingErrorMessage(error)
            loadMoreError = message
            ToastCenter.shared.show(message, systemImage: "exclamationmark.triangle", style: .error)
            // Do not set hasMore = false so retryLoadMore() can re-attempt pagination
        }
    }

    private func retryLoadInitial() async {
        loadError = nil
        await loadInitial()
    }

    private func retryLoadMore() async {
        loadMoreError = nil
        await loadMore()
    }

    private func userFacingErrorMessage(_ error: Error) -> String {
        if let apiError = error as? APIError {
            switch apiError {
            case .networkError(_, let msg, _): return msg
            case .httpError(let code, let msg): return msg.isEmpty ? "Request failed (\(code))" : msg
            case .decodingError: return "Invalid response"
            case .invalidURL: return "Invalid request"
            case .invalidResponse: return "Invalid response"
            }
        }
        return error.localizedDescription
    }

    private func loadActorsIfNeeded() async {
        var byId: [String: ActivityActor] = [:]
        for e in events {
            guard let aid = e.actorId, let name = e.actorName, !name.isEmpty else { continue }
            if byId[aid] == nil {
                byId[aid] = ActivityActor(id: aid, name: name, role: e.actorRole)
            }
        }
        actors = byId.values.sorted { $0.name < $1.name }
    }

    private func isoDate(_ date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withFullDate]
        return formatter.string(from: date)
    }
}

// MARK: - Activity Filters

private struct ActivityFilters {
    var actorId: String?
    var eventTypes: [String]
    var startDate: Date?
    var endDate: Date?
}

private struct ActivityActor: Identifiable {
    let id: String
    let name: String
    let role: String?
}

// MARK: - Activity Card

struct ActivityCardView: View {
    let event: ActivityEvent
    @State private var isExpanded = false

    private var displayName: String {
        event.eventName ?? event.eventType ?? "Activity"
    }

    private var actorLabel: String {
        let name = event.actorName ?? "Someone"
        if let role = event.actorRole, !role.isEmpty {
            return "\(name) · \(role)"
        }
        return name
    }

    var body: some View {
        RMGlassCard {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: RMTheme.Spacing.xs) {
                        Text(actorLabel)
                            .font(RMTheme.Typography.bodySmallBold)
                            .foregroundColor(RMTheme.Colors.textPrimary)
                        Text(relativeTime(event.createdAt))
                            .font(RMTheme.Typography.caption)
                            .foregroundColor(RMTheme.Colors.textSecondary)
                    }
                    Spacer()
                    HStack(spacing: RMTheme.Spacing.xs) {
                        outcomeBadge
                        Text(displayName)
                            .font(RMTheme.Typography.caption)
                            .foregroundColor(categoryColor)
                            .padding(.horizontal, RMTheme.Spacing.sm)
                            .padding(.vertical, 4)
                            .background(categoryColor.opacity(0.2))
                            .clipShape(Capsule())
                    }
                }
                Text(event.summary ?? displayName)
                    .font(RMTheme.Typography.bodySmall)
                    .foregroundColor(RMTheme.Colors.textSecondary)
                    .lineLimit(isExpanded ? nil : 2)
                if isExpanded {
                    if let outcome = event.outcome, !outcome.isEmpty {
                        Text("Outcome: \(outcome)")
                            .font(RMTheme.Typography.caption)
                            .foregroundColor(RMTheme.Colors.textTertiary)
                    }
                    if let severity = event.severity, !severity.isEmpty {
                        Text("Severity: \(severity)")
                            .font(RMTheme.Typography.caption)
                            .foregroundColor(RMTheme.Colors.textTertiary)
                    }
                }
                Button {
                    Haptics.tap()
                    withAnimation(.easeInOut(duration: 0.2)) {
                        isExpanded.toggle()
                    }
                } label: {
                    Text(isExpanded ? "Show less" : "Show more")
                        .font(RMTheme.Typography.caption)
                        .foregroundColor(RMTheme.Colors.accent)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var categoryColor: Color {
        switch (event.category ?? "").lowercased() {
        case "governance": return RMTheme.Colors.categoryGovernance
        case "operations": return RMTheme.Colors.categoryOperations
        case "access": return RMTheme.Colors.categoryAccess
        default: return RMTheme.Colors.textSecondary
        }
    }

    /// Outcome/severity badge (Success, Info, etc.) per ticket: "Action description with badge"
    @ViewBuilder
    private var outcomeBadge: some View {
        let label = outcomeLabel
        if !label.isEmpty {
            Text(label)
                .font(.caption2)
                .fontWeight(.medium)
                .foregroundColor(outcomeBadgeColor)
                .padding(.horizontal, 6)
                .padding(.vertical, 3)
                .background(outcomeBadgeColor.opacity(0.2))
                .clipShape(Capsule())
        }
    }

    private var outcomeLabel: String {
        if let outcome = event.outcome, !outcome.isEmpty {
            switch outcome.lowercased() {
            case "success", "allowed": return "Success"
            case "failed", "blocked": return "Failed"
            default: return outcome
            }
        }
        if let severity = event.severity, !severity.isEmpty {
            switch severity.lowercased() {
            case "critical": return "Critical"
            case "material": return "Warning"
            case "info": return "Info"
            default: return severity
            }
        }
        return ""
    }

    private var outcomeBadgeColor: Color {
        if let outcome = event.outcome {
            switch outcome.lowercased() {
            case "success", "allowed": return RMTheme.Colors.success
            case "failed", "blocked": return RMTheme.Colors.error
            default: break
            }
        }
        if let severity = event.severity {
            switch severity.lowercased() {
            case "critical": return RMTheme.Colors.error
            case "material": return RMTheme.Colors.warning
            case "info": return RMTheme.Colors.info
            default: break
            }
        }
        return RMTheme.Colors.textSecondary
    }

    private func relativeTime(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}

// MARK: - Job Activity Realtime Service

/// Subscribes to audit_log INSERTs for a job and publishes new events for the view to prepend.
@MainActor
final class JobActivityRealtimeService: ObservableObject {
    @Published var newEvent: ActivityEvent?

    private var channel: Any?
    private var supabaseClient: SupabaseClient?

    /// Subscribe to job-specific audit_log inserts, then wait until cancelled. Call unsubscribe() on cancel.
    func subscribeAndWait(jobId: String) async {
        guard let url = URL(string: AppConfig.shared.supabaseURL) else { return }
        let client = SupabaseClient(supabaseURL: url, supabaseKey: AppConfig.shared.supabaseAnonKey)
        supabaseClient = client
        let channelName = "job-\(jobId)-activity"
        let ch = client.channel(channelName)

        ch.on(event: "postgres_changes") { [weak self] payload in
            Task { @MainActor in
                await self?.handlePayload(payload: payload, jobId: jobId)
            }
        }
        try? await ch.subscribe()
        channel = ch

        await withCheckedContinuation { _ in }
    }

    private func handlePayload(payload: Any, jobId: String) {
        var record: [String: Any]?
        if let dict = payload as? [String: Any] {
            record = dict["new"] as? [String: Any] ?? dict["record"] as? [String: Any] ?? dict
        }
        guard let row = record else { return }
        let targetId: String? = {
            if let s = row["target_id"] as? String { return s }
            if let u = row["target_id"] as? UUID { return u.uuidString }
            return nil
        }()
        let metadataJobId: String? = {
            guard let meta = row["metadata"] as? [String: Any] else { return nil }
            if let s = meta["job_id"] as? String { return s }
            if let u = meta["job_id"] as? UUID { return u.uuidString }
            return nil
        }()
        let belongsToJob = (targetId == jobId) || (metadataJobId == jobId)
        guard belongsToJob else { return }
        guard let event = ActivityEvent(realtimeRecord: row) else { return }
        newEvent = event
    }

    func unsubscribe() async {
        if let ch = channel as? RealtimeChannel {
            await ch.unsubscribe()
        }
        channel = nil
        supabaseClient = nil
    }

    func clearNewEvent() {
        newEvent = nil
    }
}

// MARK: - Filter Sheet

struct ActivityFilterSheet: View {
    @Binding var actorId: String?
    @Binding var eventTypes: Set<String>
    @Binding var startDate: Date?
    @Binding var endDate: Date?
    let actors: [ActivityActor]
    let eventTypeOptions: [String]
    let onApply: () -> Void
    let onClear: () -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section("Actor") {
                    Picker("Actor", selection: Binding(
                        get: { actorId ?? "" },
                        set: { actorId = $0.isEmpty ? nil : $0 }
                    )) {
                        Text("All").tag("")
                        ForEach(actors) { a in
                            Text(a.name).tag(a.id)
                        }
                    }
                    .pickerStyle(.menu)
                }
                Section("Event type") {
                    ForEach(eventTypeOptions, id: \.self) { type in
                        Toggle(type, isOn: Binding(
                            get: { eventTypes.contains(type) },
                            set: { if $0 { eventTypes.insert(type) } else { eventTypes.remove(type) } }
                        ))
                    }
                    if eventTypeOptions.isEmpty {
                        Text("No event types from current data")
                            .font(RMTheme.Typography.caption)
                            .foregroundColor(RMTheme.Colors.textTertiary)
                    }
                }
                Section("Date range") {
                    DatePicker("From", selection: Binding(
                        get: { startDate ?? Date().addingTimeInterval(-30 * 24 * 3600) },
                        set: { startDate = $0 }
                    ), displayedComponents: .date)
                    DatePicker("To", selection: Binding(
                        get: { endDate ?? Date() },
                        set: { endDate = $0 }
                    ), displayedComponents: .date)
                }
            }
            .navigationTitle("Filter activity")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Clear") {
                        onClear()
                        dismiss()
                    }
                    .foregroundColor(RMTheme.Colors.accent)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Apply") {
                        onApply()
                        dismiss()
                    }
                    .fontWeight(.semibold)
                    .foregroundColor(RMTheme.Colors.accent)
                }
            }
        }
    }
}

#Preview {
    NavigationStack {
        JobActivityView(jobId: "00000000-0000-0000-0000-000000000001")
    }
}
