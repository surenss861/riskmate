import SwiftUI

/// File-private helper so load(offset:since:) default param can be evaluated from any isolation context.
private nonisolated func _notificationDefaultSinceISO() -> String {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    guard let date = Calendar.current.date(byAdding: .day, value: -30, to: Date()) else {
        return formatter.string(from: Date())
    }
    return formatter.string(from: date)
}

/// Section for grouped notifications (Package 6 — Today / This Week / Older).
struct NotificationSection: Identifiable {
    var id: String { title }
    let title: String
    let items: [AppNotification]
}

/// Notification center screen shown when the user opens riskmate://notifications or taps a notification.
/// Lists the user's notifications with unread indicators; tap marks item read and refreshes badge.
struct NotificationCenterView: View {
    @Environment(\.dismiss) private var dismiss

    @State private var items: [AppNotification] = []
    @State private var unreadCount: Int = 0
    @State private var isLoading = true
    @State private var loadError: String?
    @State private var markingAllRead = false
    @State private var typeFilter: NotificationType? = nil
    @State private var showMentionsList = false
    /// Pinned notification IDs (local; backend may not support). Refresh to reorder.
    @State private var pinnedIds: Set<String> = UserDefaultsManager.Notifications.pinnedIds()
    /// IDs that were just inserted (realtime or prepend); get one-time appear animation. Cleared after delay.
    @State private var newInsertedIds: Set<String> = []
    @State private var previousItemIds: Set<String> = []

    private let pageSize = 50
    @State private var hasMore = true
    @State private var loadingMore = false
    /// Effective `since` for the current list; nil after fallback so pagination stays consistent.
    @State private var listSince: String? = Self.since30DaysISO

    private var filteredItems: [AppNotification] {
        guard let typeFilter = typeFilter else { return items }
        return items.filter { $0.type == typeFilter }
    }
    
    /// Group into Today / This Week / Older; each section sorted by pinned first, then by date desc. Empty sections omitted.
    private var sections: [NotificationSection] {
        let cal = Calendar.current
        let now = Date()
        let today = filteredItems.filter { cal.isDateInToday($0.createdAt) }
        let weekAgo = cal.date(byAdding: .day, value: -7, to: now) ?? now
        let thisWeek = filteredItems.filter {
            !cal.isDateInToday($0.createdAt) && $0.createdAt >= weekAgo
        }
        let older = filteredItems.filter { $0.createdAt < weekAgo }
        func sort(_ list: [AppNotification]) -> [AppNotification] {
            list.sorted { a, b in
                let aPin = pinnedIds.contains(a.id)
                let bPin = pinnedIds.contains(b.id)
                if aPin != bPin { return aPin }
                return a.createdAt >= b.createdAt
            }
        }
        var out: [NotificationSection] = []
        if !today.isEmpty { out.append(NotificationSection(title: "Today", items: sort(today))) }
        if !thisWeek.isEmpty { out.append(NotificationSection(title: "This Week", items: sort(thisWeek))) }
        if !older.isEmpty { out.append(NotificationSection(title: "Older", items: sort(older))) }
        return out
    }

    private var navigationTitle: String {
        if unreadCount > 0 {
            return "Notifications (\(unreadCount))"
        }
        return "Notifications"
    }

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
            } else if filteredItems.isEmpty {
                VStack(spacing: 0) {
                    if unreadCount > 0 {
                        markAllReadButton
                    }
                    RMEmptyState(
                        icon: "bell.badge.fill",
                        title: "No alerts yet",
                    message: "You'll see exports, blockers, and signature requests here.",
                    action: nil
                    )
                    .padding(RMTheme.Spacing.pagePadding)
                }
            } else {
                VStack(spacing: 0) {
                    if filteredItems.contains(where: { !$0.isRead }) {
                        markAllReadButton
                    }
                    listContent
                }
            }
        }
        .rmNavigationBar(title: navigationTitle)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                typeFilterMenu
            }
            ToolbarItem(placement: .topBarLeading) {
                Button {
                    showMentionsList = true
                } label: {
                    Label("Mentions", systemImage: "at.badge.plus")
                        .font(RMTheme.Typography.bodySmall)
                        .foregroundColor(RMTheme.Colors.accent)
                }
            }
        }
        .sheet(isPresented: $showMentionsList) {
            NavigationStack {
                MentionsListView()
            }
        }
        .task {
            await load(offset: 0)
            await refreshUnreadCountAndBadge()
            // If unread count exceeds loaded items, older unreads exist outside the 30d window; fetch without since so user can clear badge.
            if unreadCount > items.count {
                await load(offset: 0, since: nil)
                await refreshUnreadCountAndBadge()
            }
        }
        .refreshable {
            await load(offset: 0)
            await refreshUnreadCountAndBadge()
        }
    }

    private var typeFilterMenu: some View {
        Menu {
            Button {
                typeFilter = nil
            } label: {
                Label("All types", systemImage: typeFilter == nil ? "checkmark.circle.fill" : "circle")
            }
            ForEach(NotificationType.allCases) { type in
                Button {
                    typeFilter = type
                } label: {
                    Label(type.displayName, systemImage: typeFilter == type ? "checkmark.circle.fill" : "circle")
                }
            }
        } label: {
            Image(systemName: "line.3.horizontal.decrease.circle")
                .font(.body)
                .foregroundColor(RMTheme.Colors.accent)
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
        List {
            ForEach(sections) { section in
                Section(header: Text(section.title).rmSectionHeader()) {
                    ForEach(section.items, id: \.id) { item in
                        notificationRow(for: item)
                    }
                }
            }
            if hasMore && !items.isEmpty {
                ProgressView()
                    .frame(maxWidth: .infinity)
                    .listRowBackground(Color.clear)
                    .onAppear {
                        Task { await loadMore() }
                    }
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
    }
    
    private func notificationRow(for item: AppNotification) -> some View {
        let isNew = newInsertedIds.contains(item.id)
        return NotificationRow(
            item: item,
            isNew: isNew,
            onTap: { Task { await handleRowTap(item) } }
        )
        .listRowBackground(item.isRead ? Color.clear : RMTheme.Colors.surface.opacity(0.5))
        .listRowSeparator(.visible)
        .listRowInsets(EdgeInsets(top: RMTheme.Spacing.md, leading: RMTheme.Spacing.md, bottom: RMTheme.Spacing.md, trailing: RMTheme.Spacing.md))
        .modifier(NewInsertModifier(isNew: isNew, id: item.id, clearInsert: { id in
            newInsertedIds.remove(id)
        }))
        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
            Button {
                Haptics.impact(.light)
                UserDefaultsManager.Notifications.togglePinned(id: item.id)
                pinnedIds = UserDefaultsManager.Notifications.pinnedIds()
            } label: {
                Label(UserDefaultsManager.Notifications.isPinned(id: item.id) ? "Unpin" : "Pin",
                      systemImage: UserDefaultsManager.Notifications.isPinned(id: item.id) ? "pin.slash" : "pin")
            }
            if item.isRead {
                Button {
                    Haptics.impact(.light)
                    Task { await markAsUnreadAndRefreshBadge(ids: [item.id]) }
                } label: {
                    Label("Mark unread", systemImage: "envelope.badge")
                }
            } else {
                Button {
                    Haptics.impact(.light)
                    Task { await markAsReadAndRefreshBadge(ids: [item.id]) }
                } label: {
                    Label("Mark read", systemImage: "envelope.open")
                }
            }
        }
        .contextMenu {
            Button {
                Haptics.impact(.light)
                UserDefaultsManager.Notifications.togglePinned(id: item.id)
                pinnedIds = UserDefaultsManager.Notifications.pinnedIds()
            } label: {
                Label(UserDefaultsManager.Notifications.isPinned(id: item.id) ? "Unpin" : "Pin",
                      systemImage: UserDefaultsManager.Notifications.isPinned(id: item.id) ? "pin.slash" : "pin")
            }
            if item.isRead {
                Button {
                    Task { await markAsUnreadAndRefreshBadge(ids: [item.id]) }
                } label: {
                    Label("Mark unread", systemImage: "envelope.badge")
                }
            } else {
                Button {
                    Task { await markAsReadAndRefreshBadge(ids: [item.id]) }
                } label: {
                    Label("Mark read", systemImage: "envelope.open")
                }
            }
        }
    }

    private func load(offset: Int, since: String? = _notificationDefaultSinceISO()) async {
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
            let list = try await APIClient.shared.getNotifications(limit: pageSize, offset: offset, since: since)
            let mapped = list.map { AppNotification(from: $0) }
        await MainActor.run {
            if offset == 0 {
                newInsertedIds = []
                items = mapped
                listSince = since
                previousItemIds = Set(mapped.map(\.id))
            } else {
                items.append(contentsOf: mapped)
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

    private static var since30DaysISO: String {
        _notificationDefaultSinceISO()
    }

    private func refreshUnreadCount() async {
        do {
            let count = try await APIClient.shared.getUnreadNotificationCount()
            await MainActor.run { unreadCount = count }
        } catch {
            // Non-fatal
        }
    }

    private func loadMore() async {
        guard !loadingMore, hasMore else { return }
        loadingMore = true
        defer { loadingMore = false }
        await load(offset: items.count, since: listSince)
    }

    /// On row tap: navigate via deep link if present, then mark this notification read and refresh badge.
    private func handleRowTap(_ item: AppNotification) async {
        if let link = item.deepLink, !link.isEmpty, let url = URL(string: link) {
            await MainActor.run {
                _ = DeepLinkRouter.shared.handle(url)
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
                    AppNotification(
                        id: $0.id,
                        type: $0.type,
                        title: $0.title,
                        body: $0.body,
                        deepLink: $0.deepLink,
                        isRead: true,
                        createdAt: $0.createdAt
                    )
                } else {
                    $0
                }
            }
        }
        await refreshUnreadCountAndBadge()
    }

    private func markAsUnreadAndRefreshBadge(ids: [String]) async {
        do {
            try await APIClient.shared.markNotificationsAsUnread(ids: ids)
        } catch {
            // Non-fatal
        }
        await MainActor.run {
            let idSet = Set(ids)
            items = items.map {
                if idSet.contains($0.id) {
                    AppNotification(
                        id: $0.id,
                        type: $0.type,
                        title: $0.title,
                        body: $0.body,
                        deepLink: $0.deepLink,
                        isRead: false,
                        createdAt: $0.createdAt
                    )
                } else {
                    $0
                }
            }
        }
        await refreshUnreadCountAndBadge()
    }

    private func refreshUnreadCountAndBadge() async {
        do {
            let count = try await APIClient.shared.getUnreadNotificationCount()
            await MainActor.run {
                NotificationService.shared.setBadgeCount(count)
                unreadCount = count
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
                AppNotification(
                    id: $0.id,
                    type: $0.type,
                    title: $0.title,
                    body: $0.body,
                    deepLink: $0.deepLink,
                    isRead: true,
                    createdAt: $0.createdAt
                )
            }
        }
        await refreshUnreadCountAndBadge()
    }
}

// MARK: - New insert animation (Package 6)

private struct NewInsertModifier: ViewModifier {
    let isNew: Bool
    let id: String
    let clearInsert: (String) -> Void

    func body(content: Content) -> some View {
        content
            .modifier(ConditionalAppearModifier(animate: isNew))
            .onAppear {
                if isNew {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                        clearInsert(id)
                    }
                }
            }
    }
}

private struct ConditionalAppearModifier: ViewModifier {
    let animate: Bool

    func body(content: Content) -> some View {
        if animate {
            content.rmAppearIn(staggerIndex: 0)
        } else {
            content
        }
    }
}

#Preview {
    NavigationStack {
        NotificationCenterView()
    }
}
