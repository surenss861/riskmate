import SwiftUI

/// Proof & Evidence hub: Needs action (pending uploads + failed exports), Recent evidence, Recent proof packs.
/// Gives Work Records a clear job before backend evidence list API exists. Uses BackgroundUploadManager + BackgroundExportManager.
struct WorkRecordsHubView: View {
    @StateObject private var uploadManager = BackgroundUploadManager.shared
    @StateObject private var exportManager = BackgroundExportManager.shared
    @StateObject private var jobsStore = JobsStore.shared
    @EnvironmentObject private var quickAction: QuickActionRouter
    @State private var isRetryingExport = false

    /// Pending/uploading/failed evidence uploads. Excludes .synced. Sort by createdAt (non-optional on UploadTask).
    private var pendingUploads: [UploadTask] {
        uploadManager.uploads.filter { upload in
            switch upload.state {
            case .queued, .uploading, .failed: return true
            case .synced: return false
            }
        }
        .sorted { $0.createdAt > $1.createdAt }
    }

    /// Failed or in-progress exports for "Needs action". Excludes .ready.
    private var pendingOrFailedExports: [ExportTask] {
        exportManager.exports.filter { task in
            switch task.state {
            case .queued, .preparing, .downloading, .failed: return true
            case .ready: return false
            }
        }
        .sorted { $0.createdAt > $1.createdAt }
    }

    /// Last 10 uploads (any state) for "Recent evidence", newest first.
    private var recentEvidence: [UploadTask] {
        Array(uploadManager.uploads.sorted { $0.createdAt > $1.createdAt }.prefix(10))
    }

    /// True if any export for this job+type is already in-flight (prevents double-trigger retry).
    private func hasInFlightExport(jobId: String, type: ExportType) -> Bool {
        exportManager.exports.contains { task in
            task.jobId == jobId && task.type == type &&
            (task.state == .queued || task.state == .preparing || task.state == .downloading)
        }
    }

    /// Last 5 proof packs (ready or failed for retry)
    private var recentProofPacks: [ExportTask] {
        exportManager.exports
            .filter { $0.type == .proofPack }
            .sorted { $0.createdAt > $1.createdAt }
            .prefix(5)
            .map { $0 }
    }

    private var needsActionCount: Int {
        pendingUploads.count + pendingOrFailedExports.count
    }

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.lg) {
                // Needs action (queue)
                needsActionSection
                // Recent evidence (last 10)
                recentEvidenceSection
                // Recent proof packs (last 5)
                recentProofPacksSection
                // Browse all jobs
                browseJobsSection
            }
            .padding(.horizontal, RMTheme.Spacing.pagePadding)
            .padding(.top, RMTheme.Spacing.sm)
            .padding(.bottom, 100)
        }
        .scrollContentBackground(.hidden)
        .background(RMTheme.Colors.background)
        .rmNavigationBar(title: "Work Records")
        .toolbar(.hidden, for: .navigationBar)
        .safeAreaInset(edge: .top, spacing: 0) {
            RMTopBar(title: "Work Records", notificationBadge: 0) {
                EmptyView()
            }
        }
        .refreshable {
            _ = try? await jobsStore.fetch(forceRefresh: true)
        }
        .navigationDestination(for: WorkRecordsJobRoute.self) { route in
            JobDetailView(jobId: route.jobId, initialTab: route.initialTab)
        }
    }

    // MARK: - Needs action

    private var needsActionSection: some View {
        Group {
            if needsActionCount == 0 {
                hubSectionCard(
                    title: "Needs action",
                    subtitle: "Pending uploads and exports will appear here.",
                    icon: "checkmark.circle.fill",
                    iconColor: RMTheme.Colors.success
                )
            } else {
                VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
                    sectionHeader(title: "Needs action", count: needsActionCount)
                    if !pendingUploads.isEmpty {
                        VStack(spacing: RMTheme.Spacing.xs) {
                            ForEach(pendingUploads.prefix(5)) { upload in
                                WorkRecordsUploadRow(upload: upload) {
                                    Task {
                                        do {
                                            try await uploadManager.retryUpload(upload)
                                        } catch {
                                            ToastCenter.shared.show(error.localizedDescription, systemImage: "exclamationmark.triangle", style: .error)
                                        }
                                    }
                                }
                            }
                            if pendingUploads.count > 5 {
                                Text("+ \(pendingUploads.count - 5) more")
                                    .font(RMTheme.Typography.caption)
                                    .foregroundColor(RMTheme.Colors.textTertiary)
                            }
                        }
                    }
                    if !pendingOrFailedExports.isEmpty {
                        VStack(spacing: RMTheme.Spacing.xs) {
                            ForEach(pendingOrFailedExports.prefix(3)) { task in
                                WorkRecordsExportRow(
                                    export: task,
                                    isRetrying: isRetryingExport,
                                    canRetry: (task.state == .failed) && !hasInFlightExport(jobId: task.jobId, type: task.type),
                                    onRetry: {
                                        guard task.state == .failed, !hasInFlightExport(jobId: task.jobId, type: task.type) else { return }
                                        Task {
                                            isRetryingExport = true
                                            defer { isRetryingExport = false }
                                            do {
                                                try await exportManager.export(jobId: task.jobId, type: task.type)
                                            } catch {
                                                ToastCenter.shared.show(error.localizedDescription, systemImage: "exclamationmark.triangle", style: .error)
                                            }
                                        }
                                    }
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    // MARK: - Recent evidence

    private var recentEvidenceSection: some View {
        VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
            sectionHeader(title: "Recent evidence", count: recentEvidence.count)
            if recentEvidence.isEmpty {
                hubSectionCard(
                    title: "No evidence yet",
                    subtitle: "Add photos or files from a job to see them here.",
                    icon: "photo.on.rectangle.angled",
                    iconColor: RMTheme.Colors.textTertiary
                )
                .onTapGesture {
                    Haptics.tap()
                    quickAction.presentEvidence(jobId: nil)
                }
                .contentShape(Rectangle())
            } else {
                VStack(spacing: RMTheme.Spacing.xs) {
                    ForEach(recentEvidence) { upload in
                        NavigationLink(value: WorkRecordsJobRoute(jobId: upload.jobId, initialTab: .evidence)) {
                            WorkRecordsUploadRow(upload: upload, onRetry: nil)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    // MARK: - Recent proof packs

    private var recentProofPacksSection: some View {
        VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
            sectionHeader(title: "Recent proof packs", count: recentProofPacks.count)
            if recentProofPacks.isEmpty {
                hubSectionCard(
                    title: "No proof packs yet",
                    subtitle: "Generate a proof pack from a job's Exports tab.",
                    icon: "archivebox",
                    iconColor: RMTheme.Colors.textTertiary
                )
            } else {
                VStack(spacing: RMTheme.Spacing.xs) {
                    ForEach(recentProofPacks) { task in
                        if case .ready = task.state {
                            NavigationLink(value: WorkRecordsJobRoute(jobId: task.jobId, initialTab: .exports)) {
                                WorkRecordsExportRow(export: task, isRetrying: false, onRetry: nil)
                            }
                            .buttonStyle(.plain)
                        } else {
                            WorkRecordsExportRow(
                                export: task,
                                isRetrying: isRetryingExport,
                                canRetry: !hasInFlightExport(jobId: task.jobId, type: task.type),
                                onRetry: {
                                    guard !hasInFlightExport(jobId: task.jobId, type: task.type) else { return }
                                    Task {
                                        isRetryingExport = true
                                        defer { isRetryingExport = false }
                                        do {
                                            try await exportManager.export(jobId: task.jobId, type: .proofPack)
                                        } catch {
                                            ToastCenter.shared.show(error.localizedDescription, systemImage: "exclamationmark.triangle", style: .error)
                                        }
                                    }
                                }
                            )
                        }
                    }
                }
            }
        }
    }

    // MARK: - Browse jobs

    private var browseJobsSection: some View {
        NavigationLink {
            JobsListView(initialFilter: nil)
                .rmNavigationBar(title: "Work Records")
        } label: {
            HStack {
                Image(systemName: "list.bullet.rectangle")
                    .font(.system(size: 18))
                    .foregroundColor(RMTheme.Colors.accent)
                Text("See all jobs")
                    .font(RMTheme.Typography.bodyBold)
                    .foregroundColor(RMTheme.Colors.textPrimary)
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(RMTheme.Colors.textTertiary)
            }
            .padding(RMTheme.Spacing.md)
            .background(RMTheme.Colors.surface2.opacity(0.9))
            .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    // MARK: - Helpers

    private func sectionHeader(title: String, count: Int) -> some View {
        HStack {
            Text(title)
                .font(RMTheme.Typography.title3)
                .foregroundColor(RMTheme.Colors.textPrimary)
            if count > 0 {
                Text("\(count)")
                    .font(RMTheme.Typography.captionBold)
                    .foregroundColor(RMTheme.Colors.textSecondary)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(RMTheme.Colors.surface1)
                    .clipShape(Capsule())
            }
            Spacer()
        }
    }

    private func hubSectionCard(title: String, subtitle: String, icon: String, iconColor: Color) -> some View {
        HStack(spacing: RMTheme.Spacing.md) {
            Image(systemName: icon)
                .font(.system(size: 24))
                .foregroundColor(iconColor)
                .frame(width: 44, height: 44)
                .background(iconColor.opacity(0.15))
                .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm, style: .continuous))
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(RMTheme.Typography.bodyBold)
                    .foregroundColor(RMTheme.Colors.textPrimary)
                Text(subtitle)
                    .font(RMTheme.Typography.caption)
                    .foregroundColor(RMTheme.Colors.textSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(RMTheme.Spacing.md)
        .background(RMTheme.Colors.surface2.opacity(0.9))
        .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm, style: .continuous))
    }
}

// MARK: - Upload row (compact)

private struct WorkRecordsUploadRow: View {
    let upload: UploadTask
    var onRetry: (() -> Void)?

    private var statusLabel: String {
        switch upload.state {
        case .queued: return "Queued"
        case .uploading:
            if upload.progress > 0, upload.progress < 1 { return "\(Int(upload.progress * 100))%" }
            return "Uploading"
        case .synced: return "Synced"
        case .failed: return "Failed"
        }
    }

    private var statusColor: Color {
        switch upload.state {
        case .queued, .uploading: return RMTheme.Colors.textSecondary
        case .synced: return RMTheme.Colors.success
        case .failed: return RMTheme.Colors.error
        }
    }

    var body: some View {
        HStack {
            Image(systemName: upload.fileName.lowercased().hasSuffix("pdf") ? "doc.fill" : "photo.fill")
                .font(.system(size: 14))
                .foregroundColor(RMTheme.Colors.textTertiary)
            Text(upload.fileName)
                .font(RMTheme.Typography.bodySmall)
                .foregroundColor(RMTheme.Colors.textPrimary)
                .lineLimit(1)
            Spacer()
            Text(statusLabel)
                .font(RMTheme.Typography.caption2)
                .foregroundColor(statusColor)
            if case .failed = upload.state, onRetry != nil {
                Button {
                    Haptics.tap()
                    onRetry?()
                } label: {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 12))
                        .foregroundColor(RMTheme.Colors.accent)
                }
            }
        }
        .padding(RMTheme.Spacing.sm)
        .background(RMTheme.Colors.surface.opacity(0.6))
        .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.xs, style: .continuous))
    }
}

// MARK: - Export row (compact)

private struct WorkRecordsExportRow: View {
    let export: ExportTask
    let isRetrying: Bool
    /// When false, show status only (no Retry) so we don't double-trigger if already in-flight.
    var canRetry: Bool = true
    var onRetry: (() -> Void)?

    private var statusLabel: String {
        switch export.state {
        case .queued: return "Queued"
        case .preparing, .downloading: return "In progress…"
        case .ready: return "Ready"
        case .failed: return "Failed"
        }
    }

    private var statusColor: Color {
        switch export.state {
        case .queued, .preparing, .downloading: return RMTheme.Colors.textSecondary
        case .ready: return RMTheme.Colors.success
        case .failed: return RMTheme.Colors.error
        }
    }

    var body: some View {
        HStack {
            Image(systemName: export.type == .proofPack ? "archivebox.fill" : "doc.text.fill")
                .font(.system(size: 14))
                .foregroundColor(RMTheme.Colors.accent)
            Text(export.type.displayName)
                .font(RMTheme.Typography.bodySmall)
                .foregroundColor(RMTheme.Colors.textPrimary)
            Text("Job \(export.jobId.prefix(8))…")
                .font(RMTheme.Typography.caption2)
                .foregroundColor(RMTheme.Colors.textTertiary)
            Spacer()
            Text(statusLabel)
                .font(RMTheme.Typography.caption2)
                .foregroundColor(statusColor)
            if canRetry, onRetry != nil {
                Button {
                    Haptics.tap()
                    onRetry?()
                } label: {
                    if isRetrying {
                        ProgressView()
                            .scaleEffect(0.7)
                    } else {
                        Image(systemName: "arrow.clockwise")
                            .font(.system(size: 12))
                            .foregroundColor(RMTheme.Colors.accent)
                    }
                }
                .disabled(isRetrying)
            }
        }
        .padding(RMTheme.Spacing.sm)
        .background(RMTheme.Colors.surface.opacity(0.6))
        .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.xs, style: .continuous))
    }
}

/// Route for navigating from Work Records hub to a job (optionally a specific tab).
private struct WorkRecordsJobRoute: Hashable {
    let jobId: String
    let initialTab: JobDetailTab?
}

#Preview {
    NavigationStack {
        WorkRecordsHubView()
            .environmentObject(QuickActionRouter.shared)
    }
}
