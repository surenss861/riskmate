import SwiftUI

/// Lists comments where the current user is mentioned. Reachable from job detail (Comments tab) or notifications.
/// Fetches GET /api/comments/mentions/me with pagination; shows unread count and hasMore for load more.
struct MentionsListView: View {
    @Environment(\.dismiss) private var dismiss

    @State private var items: [JobComment] = []
    @State private var isLoading = true
    @State private var loadError: String?
    @State private var hasMore = true
    @State private var loadingMore = false
    @State private var offset = 0
    @State private var unreadCount: Int = 0

    private let pageSize = 50
    private let unreadKey = "riskmate_mentions_last_seen_at"

    var body: some View {
        ZStack {
            RMBackground()

            if isLoading && items.isEmpty {
                VStack(spacing: RMTheme.Spacing.sm) {
                    RMSkeletonList(count: 4)
                }
                .padding(RMTheme.Spacing.pagePadding)
            } else if let error = loadError, items.isEmpty {
                RMEmptyState(
                    icon: "at.badge.plus",
                    title: "Couldn't load mentions",
                    message: error,
                    action: RMEmptyStateAction(title: "Retry", action: { Task { await load(offset: 0) } })
                )
                .padding(RMTheme.Spacing.pagePadding)
            } else if items.isEmpty {
                RMEmptyState(
                    icon: "at.badge.plus",
                    title: "No mentions yet",
                    message: "When someone @mentions you in a comment, it will appear here.",
                    action: nil
                )
                .padding(RMTheme.Spacing.pagePadding)
            } else {
                listContent
            }
        }
        .rmNavigationBar(title: navigationTitle)
        .task {
            await load(offset: 0)
            updateUnreadCount()
        }
        .onAppear {
            updateUnreadCount()
        }
        .refreshable {
            await load(offset: 0)
            updateUnreadCount()
        }
    }

    private var navigationTitle: String {
        if unreadCount > 0 {
            return "Mentions (\(unreadCount))"
        }
        return "Mentions"
    }

    private var listContent: some View {
        ScrollView(showsIndicators: false) {
            LazyVStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
                ForEach(items) { comment in
                    mentionRow(comment)
                }
                if hasMore {
                    Button {
                        Task { await loadMore() }
                    } label: {
                        if loadingMore {
                            HStack {
                                ProgressView().scaleEffect(0.8)
                                Text("Loading…")
                                    .font(RMTheme.Typography.caption)
                                    .foregroundColor(RMTheme.Colors.textTertiary)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, RMTheme.Spacing.md)
                        } else {
                            Text("Load more")
                                .font(RMTheme.Typography.bodySmall)
                                .foregroundColor(RMTheme.Colors.accent)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, RMTheme.Spacing.md)
                        }
                    }
                    .buttonStyle(.plain)
                    .disabled(loadingMore)
                }
            }
            .padding(RMTheme.Spacing.pagePadding)
        }
    }

    private func mentionRow(_ comment: JobComment) -> some View {
        let isUnread = isCommentUnread(comment)
        return Button {
            markMentionsSeen()
            if comment.entityType == "job", !comment.entityId.isEmpty {
                DeepLinkRouter.shared.openJob(id: comment.entityId, tab: .comments)
                dismiss()
            } else if let jobId = comment.jobId, !jobId.isEmpty {
                // hazard/control/photo mentions: open job's Comments tab
                DeepLinkRouter.shared.openJob(id: jobId, tab: .comments)
                dismiss()
            }
        } label: {
            VStack(alignment: .leading, spacing: 4) {
                HStack(alignment: .center) {
                    Text(authorDisplay(comment))
                        .font(RMTheme.Typography.bodySmallBold)
                        .foregroundColor(RMTheme.Colors.textPrimary)
                    Spacer()
                    Text(relativeTime(comment.createdAt))
                        .font(RMTheme.Typography.caption2)
                        .foregroundColor(RMTheme.Colors.textTertiary)
                    if isUnread {
                        Circle()
                            .fill(RMTheme.Colors.accent)
                            .frame(width: 8, height: 8)
                    }
                }
                contentWithMentions(comment.content)
                    .font(RMTheme.Typography.bodySmall)
                    .foregroundColor(RMTheme.Colors.textSecondary)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                if comment.entityType == "job", !comment.entityId.isEmpty {
                    Text("View job")
                        .font(RMTheme.Typography.caption2)
                        .foregroundColor(RMTheme.Colors.accent)
                } else if comment.jobId != nil, !(comment.jobId ?? "").isEmpty {
                    Text("View job")
                        .font(RMTheme.Typography.caption2)
                        .foregroundColor(RMTheme.Colors.accent)
                }
            }
            .padding(RMTheme.Spacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(isUnread ? RMTheme.Colors.accent.opacity(0.08) : RMTheme.Colors.surface)
            .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.md))
        }
        .buttonStyle(.plain)
    }

    private func authorDisplay(_ comment: JobComment) -> String {
        comment.author?.fullName?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
            ? (comment.author?.fullName ?? "")
            : (comment.author?.email ?? "Unknown")
    }

    private func relativeTime(_ iso: String) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        guard let date = ISO8601DateFormatter().date(from: iso) ?? ISO8601DateFormatter().date(from: iso + "Z") else {
            return iso
        }
        return formatter.localizedString(for: date, relativeTo: Date())
    }

    @ViewBuilder
    private func contentWithMentions(_ content: String) -> some View {
        let attr = attributedContentWithMentions(content)
        Text(attr)
    }

    private func attributedContentWithMentions(_ content: String) -> AttributedString {
        var result = AttributedString()
        let segments = parseMentionSegments(content)
        let secondary = RMTheme.Colors.textSecondary
        let accent = RMTheme.Colors.accent
        for seg in segments {
            switch seg {
            case .text(let s):
                var a = AttributedString(s)
                a.foregroundColor = secondary
                result.append(a)
            case .mention(let name):
                var a = AttributedString("@\(name)")
                a.foregroundColor = accent
                a.font = .body.weight(.medium)
                result.append(a)
            }
        }
        return result
    }

    private enum MentionSegment {
        case text(String)
        case mention(displayName: String)
    }

    private func parseMentionSegments(_ content: String) -> [MentionSegment] {
        guard !content.isEmpty else { return [.text("")] }
        let pattern = #"@\[([^\]]+)\]\([a-f0-9-]+\)"#
        guard let regex = try? NSRegularExpression(pattern: pattern) else {
            return [.text(content)]
        }
        let ns = content as NSString
        let range = NSRange(location: 0, length: ns.length)
        var segments: [MentionSegment] = []
        var lastEnd = 0
        regex.enumerateMatches(in: content, options: [], range: range) { match, _, _ in
            guard let m = match, m.numberOfRanges >= 2 else { return }
            let fullRange = m.range(at: 0)
            let nameRange = m.range(at: 1)
            if fullRange.location > lastEnd {
                segments.append(.text(ns.substring(with: NSRange(location: lastEnd, length: fullRange.location - lastEnd))))
            }
            segments.append(.mention(displayName: ns.substring(with: nameRange)))
            lastEnd = fullRange.location + fullRange.length
        }
        if lastEnd < ns.length {
            segments.append(.text(ns.substring(from: lastEnd)))
        }
        return segments.isEmpty ? [.text(content)] : segments
    }

    private var lastSeenAt: Date? {
        get {
            let t = UserDefaults.standard.double(forKey: unreadKey)
            return t > 0 ? Date(timeIntervalSince1970: t) : nil
        }
        set {
            UserDefaults.standard.set(newValue?.timeIntervalSince1970 ?? 0, forKey: unreadKey)
        }
    }

    private func isCommentUnread(_ comment: JobComment) -> Bool {
        guard let seen = lastSeenAt else { return true }
        guard let created = ISO8601DateFormatter().date(from: comment.createdAt) ?? ISO8601DateFormatter().date(from: comment.createdAt + "Z") else {
            return false
        }
        return created > seen
    }

    private func updateUnreadCount() {
        guard let seen = lastSeenAt else {
            unreadCount = items.count
            return
        }
        let count = items.filter { comment in
            guard let created = ISO8601DateFormatter().date(from: comment.createdAt) ?? ISO8601DateFormatter().date(from: comment.createdAt + "Z") else {
                return false
            }
            return created > seen
        }.count
        unreadCount = count
    }

    private func markMentionsSeen() {
        lastSeenAt = Date()
        updateUnreadCount()
    }

    private func load(offset: Int) async {
        if offset == 0 {
            isLoading = true
            loadError = nil
        }
        defer {
            if offset == 0 { isLoading = false }
        }
        do {
            let (data, _, hasMoreResult) = try await APIClient.shared.getMentionsMe(limit: pageSize, offset: offset)
            if offset == 0 {
                items = data
                self.offset = data.count
            } else {
                items.append(contentsOf: data)
                self.offset += data.count
            }
            hasMore = hasMoreResult
        } catch {
            loadError = error.localizedDescription
            if offset == 0 { items = [] }
        }
    }

    private func loadMore() async {
        guard hasMore, !loadingMore else { return }
        loadingMore = true
        defer { loadingMore = false }
        await load(offset: offset)
        updateUnreadCount()
    }
}

#Preview {
    NavigationStack {
        MentionsListView()
    }
}
