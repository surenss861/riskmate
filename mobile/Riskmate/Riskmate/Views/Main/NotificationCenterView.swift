import SwiftUI

/// Notification center screen shown when the user opens riskmate://notifications or taps a notification.
/// Lists the user's notifications with unread indicators; tap marks item read and refreshes badge.
struct NotificationCenterView: View {
    @Environment(\.dismiss) private var dismiss

    @State private var items: [APIClient.NotificationItem] = []
    @State private var isLoading = true
    @State private var loadError: String?
    @State private var markingAllRead = false

    private let pageSize = 50
    @State private var hasMore = true
    @State private var loadingMore = false

    var body: some View {
        ZStack {
            RMBackground()

            if isLoading && items.isEmpty {
                VStack(spacing: RMTheme.Spacing.lg) {
                    RMSkeletonView(width: 80, height: 80, cornerRadius: 12)
                    Text("Loading notifications…")
                        .font(RMTheme.Typography.body)
                        .foregroundColor(RMTheme.Colors.textSecondary)
                }
            } else if let error = loadError, items.isEmpty {
                RMEmptyState(
                    icon: "exclamationmark.triangle.fill",
                    title: "Couldn’t Load",
                    message: error,
                    action: RMEmptyStateAction(title: "Retry", action: { Task { await load(offset: 0) } })
                )
                .padding(RMTheme.Spacing.pagePadding)
            } else if items.isEmpty {
                RMEmptyState(
                    icon: "bell.badge.fill",
                    title: "Notifications",
                    message: "You’re all caught up. New alerts will appear here.",
                    action: nil
                )
                .padding(RMTheme.Spacing.pagePadding)
            } else {
                VStack(spacing: 0) {
                    if items.contains(where: { !$0.is_read }) {
                        markAllReadButton
                    }
                    listContent
                }
            }
        }
        .rmNavigationBar(title: "Notifications")
        .task {
            await load(offset: 0)
        }
    }

    private var markAllReadButton: some View {
        Button {
            Task { await markAllAsRead() }
        } label: {
            HStack {
                Text("Mark all read")
                    .font(RMTheme.Typography.bodyBold)
                    .foregroundColor(RMTheme.Colors.accent)
                if markingAllRead {
                    ProgressView()
                        .scaleEffect(0.8)
                        .tint(RMTheme.Colors.accent)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, RMTheme.Spacing.md)
        }
        .disabled(markingAllRead)
        .padding(.horizontal)
        .padding(.top, RMTheme.Spacing.sm)
    }

    private var listContent: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                ForEach(items, id: \.id) { item in
                    NotificationRow(
                        item: item,
                        onTap: { Task { await handleRowTap(item) } }
                    )
                }
                if hasMore && !items.isEmpty {
                    ProgressView()
                        .padding()
                        .onAppear {
                            Task { await loadMore() }
                        }
                }
            }
        }
    }

    private func load(offset: Int) async {
        if offset == 0 {
            isLoading = true
            loadError = nil
        }
        defer {
            if offset == 0 {
                isLoading = false
            }
        }
        do {
            let list = try await APIClient.shared.getNotifications(limit: pageSize, offset: offset)
            await MainActor.run {
                if offset == 0 {
                    items = list
                } else {
                    items.append(contentsOf: list)
                }
                hasMore = list.count >= pageSize
            }
        } catch {
            await MainActor.run {
                if offset == 0 {
                    loadError = error.localizedDescription
                }
            }
        }
    }

    private func loadMore() async {
        guard !loadingMore, hasMore else { return }
        loadingMore = true
        defer { loadingMore = false }
        await load(offset: items.count)
    }

    /// On row tap: navigate via deep link if present, then mark this notification read and refresh badge.
    private func handleRowTap(_ item: APIClient.NotificationItem) async {
        if let link = item.deepLink, !link.isEmpty, let url = URL(string: link) {
            await MainActor.run {
                DeepLinkRouter.shared.handle(url)
            }
        }
        await markAsReadAndRefreshBadge(ids: [item.id])
    }

    private func markAsReadAndRefreshBadge(ids: [String]) async {
        do {
            try await APIClient.shared.markNotificationsAsRead(ids: ids)
        } catch {
            // Non-fatal
        }
        await MainActor.run {
            let idSet = Set(ids)
            items = items.map {
                if idSet.contains($0.id) {
                    APIClient.NotificationItem(
                        id: $0.id,
                        type: $0.type,
                        content: $0.content,
                        is_read: true,
                        created_at: $0.created_at,
                        deepLink: $0.deepLink
                    )
                } else {
                    $0
                }
            }
        }
        do {
            let count = try await APIClient.shared.getUnreadNotificationCount()
            await MainActor.run {
                NotificationService.shared.setBadgeCount(count)
            }
        } catch {
            // Non-fatal
        }
    }

    private func markAllAsRead() async {
        markingAllRead = true
        defer { markingAllRead = false }
        do {
            try await APIClient.shared.markNotificationsAsRead(ids: nil)
        } catch {
            return
        }
        await MainActor.run {
            items = items.map {
                APIClient.NotificationItem(
                    id: $0.id,
                    type: $0.type,
                    content: $0.content,
                    is_read: true,
                    created_at: $0.created_at,
                    deepLink: $0.deepLink
                )
            }
        }
        do {
            let count = try await APIClient.shared.getUnreadNotificationCount()
            await MainActor.run {
                NotificationService.shared.setBadgeCount(count)
            }
        } catch {
            // Non-fatal
        }
    }
}

// MARK: - Row

private struct NotificationRow: View {
    let item: APIClient.NotificationItem
    let onTap: () async -> Void

    var body: some View {
        Button {
            Task { await onTap() }
        } label: {
            HStack(alignment: .top, spacing: RMTheme.Spacing.md) {
                if !item.is_read {
                    Circle()
                        .fill(RMTheme.Colors.accent)
                        .frame(width: 8, height: 8)
                        .padding(.top, 6)
                }
                VStack(alignment: .leading, spacing: RMTheme.Spacing.xs) {
                    Text(item.content)
                        .font(RMTheme.Typography.body)
                        .foregroundColor(RMTheme.Colors.textPrimary)
                        .multilineTextAlignment(.leading)
                    Text(formatDate(item.created_at))
                        .font(RMTheme.Typography.caption)
                        .foregroundColor(RMTheme.Colors.textTertiary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Spacer(minLength: 0)
            }
            .padding(RMTheme.Spacing.md)
            .background(item.is_read ? Color.clear : RMTheme.Colors.surface.opacity(0.5))
        }
        .buttonStyle(.plain)
    }

    private func formatDate(_ iso: String) -> String {
        let withFractional = ISO8601DateFormatter()
        withFractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let withoutFractional = ISO8601DateFormatter()
        withoutFractional.formatOptions = [.withInternetDateTime]
        let date = withFractional.date(from: iso) ?? withoutFractional.date(from: iso)
        guard let date = date else { return iso }
        let f = RelativeDateTimeFormatter()
        f.unitsStyle = .abbreviated
        return f.localizedString(for: date, relativeTo: Date())
    }
}

#Preview {
    NavigationStack {
        NotificationCenterView()
    }
}
