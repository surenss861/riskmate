import SwiftUI

/// Comments tab for job detail: list comments, replies nested per comment, add comment and reply. Mentions shown as styled chips.
struct JobCommentsView: View {
    let jobId: String

    @State private var comments: [JobComment] = []
    @State private var isLoading = true
    @State private var loadError: String?
    @State private var newContent = ""
    @State private var isPosting = false
    @State private var repliesByParent: [String: [JobComment]] = [:]
    @State private var loadingRepliesForId: String?
    @State private var repliesErrorForId: [String: String] = [:]
    @State private var expandedReplyForId: String?
    @State private var replyContent: [String: String] = [:]
    @State private var replyPostingForId: String?

    var body: some View {
        Group {
            if isLoading && comments.isEmpty {
                VStack(spacing: RMTheme.Spacing.sm) {
                    RMSkeletonList(count: 4)
                }
                .padding(RMTheme.Spacing.pagePadding)
            } else if let loadError = loadError, comments.isEmpty {
                RMEmptyState(
                    icon: "bubble.left.and.bubble.right",
                    title: "Couldn't load comments",
                    message: loadError,
                    action: RMEmptyStateAction(
                        title: "Retry",
                        action: { Task { await loadComments() } }
                    )
                )
                .padding(RMTheme.Spacing.pagePadding)
            } else {
                ScrollView(showsIndicators: false) {
                    LazyVStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
                        addCommentRow()

                        if comments.isEmpty {
                            RMEmptyState(
                                icon: "bubble.left.and.bubble.right",
                                title: "No comments yet",
                                message: "Be the first to add a comment.",
                                action: nil
                            )
                            .padding(.vertical, RMTheme.Spacing.lg)
                        } else {
                            ForEach(comments) { comment in
                                commentRow(comment)
                            }
                        }
                    }
                    .padding(RMTheme.Spacing.pagePadding)
                }
            }
        }
        .task {
            await loadComments()
        }
    }

    private func addCommentRow() -> some View {
        VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
            Text("Add a comment")
                .font(RMTheme.Typography.bodySmallBold)
                .foregroundColor(RMTheme.Colors.textSecondary)

            HStack(alignment: .bottom, spacing: RMTheme.Spacing.sm) {
                TextField("Write a comment…", text: $newContent, axis: .vertical)
                    .textFieldStyle(.plain)
                    .font(RMTheme.Typography.body)
                    .foregroundColor(RMTheme.Colors.textPrimary)
                    .padding(RMTheme.Spacing.sm)
                    .background(RMTheme.Colors.inputFill)
                    .overlay(
                        RoundedRectangle(cornerRadius: RMTheme.Radius.sm)
                            .stroke(RMTheme.Colors.border, lineWidth: 1)
                    )
                    .lineLimit(3...6)

                Button {
                    Task { await postComment() }
                } label: {
                    if isPosting {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .black))
                            .frame(width: 44, height: 44)
                    } else {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.system(size: 32))
                            .foregroundColor(newContent.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? RMTheme.Colors.textTertiary : RMTheme.Colors.accent)
                    }
                }
                .disabled(newContent.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isPosting)
            }
        }
        .padding(RMTheme.Spacing.md)
        .background(RMTheme.Colors.surface)
        .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.md))
    }

    private func commentRow(_ comment: JobComment) -> some View {
        VStack(alignment: .leading, spacing: RMTheme.Spacing.xs) {
            HStack(alignment: .center) {
                Text(authorDisplay(comment))
                    .font(RMTheme.Typography.bodySmallBold)
                    .foregroundColor(RMTheme.Colors.textPrimary)
                Spacer()
                Text(relativeTime(comment.createdAt))
                    .font(RMTheme.Typography.caption)
                    .foregroundColor(RMTheme.Colors.textTertiary)
                if comment.isResolved == true {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 14))
                        .foregroundColor(RMTheme.Colors.success)
                }
            }
            contentWithMentions(comment.content)
                .font(RMTheme.Typography.bodySmall)
                .fixedSize(horizontal: false, vertical: true)

            Button {
                withAnimation(.easeInOut(duration: 0.2)) {
                    if expandedReplyForId == comment.id {
                        expandedReplyForId = nil
                    } else {
                        expandedReplyForId = comment.id
                        if repliesByParent[comment.id] == nil && loadingRepliesForId != comment.id {
                            Task { await loadReplies(commentId: comment.id) }
                        }
                    }
                }
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: expandedReplyForId == comment.id ? "chevron.down" : "chevron.right")
                        .font(.system(size: 12, weight: .medium))
                    Text("Reply")
                    if (comment.replyCount ?? 0) > 0 {
                        Text("(\(comment.replyCount!))")
                            .foregroundColor(RMTheme.Colors.textTertiary)
                    }
                }
                .font(RMTheme.Typography.caption)
                .foregroundColor(RMTheme.Colors.textSecondary)
            }
            .buttonStyle(.plain)

            if expandedReplyForId == comment.id {
                repliesSection(comment)
            }
        }
        .padding(RMTheme.Spacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RMTheme.Colors.surface)
        .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.md))
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

    private func repliesSection(_ comment: JobComment) -> some View {
        VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
            if let err = repliesErrorForId[comment.id] {
                HStack {
                    Text(err)
                        .font(RMTheme.Typography.caption)
                        .foregroundColor(RMTheme.Colors.error)
                    Button("Retry") {
                        repliesErrorForId.removeValue(forKey: comment.id)
                        Task { await loadReplies(commentId: comment.id) }
                    }
                    .font(RMTheme.Typography.caption)
                }
                .padding(.vertical, 4)
            }
            if loadingRepliesForId == comment.id {
                HStack {
                    ProgressView()
                        .scaleEffect(0.8)
                    Text("Loading replies…")
                        .font(RMTheme.Typography.caption)
                        .foregroundColor(RMTheme.Colors.textTertiary)
                }
                .padding(.vertical, 8)
            } else {
                let replies = repliesByParent[comment.id] ?? []
                ForEach(replies) { reply in
                    replyRow(reply)
                }
            }
            replyComposer(comment)
        }
        .padding(.leading, RMTheme.Spacing.md)
        .padding(.top, 4)
        .overlay(
            Rectangle()
                .frame(width: 2)
                .foregroundColor(RMTheme.Colors.border),
            alignment: .leading
        )
    }

    private func replyRow(_ reply: JobComment) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(alignment: .center) {
                Text(authorDisplay(reply))
                    .font(RMTheme.Typography.caption)
                    .fontWeight(.medium)
                    .foregroundColor(RMTheme.Colors.textPrimary)
                Text(relativeTime(reply.createdAt))
                    .font(RMTheme.Typography.caption2)
                    .foregroundColor(RMTheme.Colors.textTertiary)
            }
            contentWithMentions(reply.content)
                .font(RMTheme.Typography.caption)
        }
        .padding(.vertical, 6)
        .padding(.horizontal, 8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RMTheme.Colors.inputFill.opacity(0.6))
        .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm))
    }

    private func replyComposer(_ comment: JobComment) -> some View {
        let binding = Binding(
            get: { replyContent[comment.id] ?? "" },
            set: { replyContent[comment.id] = $0 }
        )
        let text = binding.wrappedValue
        let isPosting = replyPostingForId == comment.id
        return HStack(alignment: .bottom, spacing: RMTheme.Spacing.sm) {
            TextField("Write a reply…", text: binding, axis: .vertical)
                .textFieldStyle(.plain)
                .font(RMTheme.Typography.bodySmall)
                .foregroundColor(RMTheme.Colors.textPrimary)
                .padding(8)
                .background(RMTheme.Colors.inputFill)
                .overlay(
                    RoundedRectangle(cornerRadius: RMTheme.Radius.sm)
                        .stroke(RMTheme.Colors.border, lineWidth: 1)
                )
                .lineLimit(2...4)
            Button {
                Task { await postReply(commentId: comment.id) }
            } label: {
                if isPosting {
                    ProgressView()
                        .scaleEffect(0.8)
                } else {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.system(size: 28))
                        .foregroundColor(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? RMTheme.Colors.textTertiary : RMTheme.Colors.accent)
                }
            }
            .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isPosting)
        }
        .padding(.top, 4)
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

    private func loadComments() async {
        isLoading = true
        loadError = nil
        defer { isLoading = false }
        do {
            comments = try await APIClient.shared.getComments(jobId: jobId, includeReplies: false)
        } catch {
            loadError = error.localizedDescription
        }
    }

    private func loadReplies(commentId: String) async {
        loadingRepliesForId = commentId
        repliesErrorForId.removeValue(forKey: commentId)
        defer { loadingRepliesForId = nil }
        do {
            let list = try await APIClient.shared.getReplies(commentId: commentId)
            repliesByParent[commentId] = list
        } catch {
            repliesErrorForId[commentId] = error.localizedDescription
            repliesByParent.removeValue(forKey: commentId)
        }
    }

    private func postComment() async {
        let content = newContent.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !content.isEmpty else { return }
        isPosting = true
        defer { isPosting = false }
        do {
            _ = try await APIClient.shared.createComment(jobId: jobId, content: content)
            newContent = ""
            await loadComments()
        } catch {
            loadError = error.localizedDescription
        }
    }

    private func postReply(commentId: String) async {
        let content = (replyContent[commentId] ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !content.isEmpty else { return }
        replyPostingForId = commentId
        defer { replyPostingForId = nil }
        do {
            _ = try await APIClient.shared.createReply(commentId: commentId, content: content)
            replyContent.removeValue(forKey: commentId)
            await loadReplies(commentId: commentId)
            await loadComments()
        } catch {
            repliesErrorForId[commentId] = error.localizedDescription
        }
    }

    private enum MentionSegment {
        case text(String)
        case mention(displayName: String)
    }

    private func parseMentionSegments(_ content: String) -> [MentionSegment] {
        guard !content.isEmpty else { return [.text("")] }
        // Match @[Display Name](userId)
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
}

#Preview {
    ScrollView {
        JobCommentsView(jobId: "00000000-0000-0000-0000-000000000001")
    }
    .background(RMTheme.Colors.background)
}
