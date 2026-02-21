import SwiftUI
import Supabase

/// Comments tab for job detail: list comments, replies nested per comment, add comment and reply. Mentions shown as styled chips.
/// Supports @ mention composition: teammate lookup on @, tokens as @[Display Name](userId), and mention_user_ids sent to backend for notifications.
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
    // Mention composition: teammate list and @ autocomplete state
    @State private var members: [TeamMember] = []
    @State private var mentionQuery: String?
    @State private var activeReplyMentionParentId: String?
    @State private var resolvingCommentId: String?
    @State private var currentUserRole: String = "member"
    @State private var editCommentId: String?
    @State private var editContent: String = ""
    @State private var commentToDelete: JobComment?
    @State private var updatingCommentId: String?
    @State private var deletingCommentId: String?
    @State private var editOrDeleteError: String?
    @StateObject private var realtimeService = JobCommentsRealtimeService()

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
            await loadMembers()
        }
        .onAppear {
            realtimeService.subscribe(jobId: jobId)
        }
        .onDisappear {
            Task { await realtimeService.unsubscribe() }
        }
        .onChange(of: realtimeService.needsRefresh) { _, newValue in
            if newValue {
                Task {
                    await loadComments()
                    if let expandedId = expandedReplyForId {
                        await loadReplies(commentId: expandedId)
                    }
                    realtimeService.clearRefresh()
                }
            }
        }
        .confirmationDialog("Delete comment?", isPresented: Binding(
            get: { commentToDelete != nil },
            set: { if !$0 { commentToDelete = nil } }
        ), titleVisibility: .visible) {
            Button("Delete", role: .destructive) {
                if let c = commentToDelete {
                    Task { await performDelete(comment: c) }
                }
                commentToDelete = nil
            }
            Button("Cancel", role: .cancel) {
                commentToDelete = nil
            }
        } message: {
            Text("This comment will be removed. This action cannot be undone.")
        }
    }

    private func loadMembers() async {
        do {
            let team = try await APIClient.shared.getTeam()
            members = team.members
            currentUserRole = team.currentUserRole
        } catch {
            // Non-fatal: comments work without mention picker
        }
    }

    private func addCommentRow() -> some View {
        let newContentBinding = Binding(
            get: { newContent },
            set: { val in
                newContent = val
                // Cursor-at-end heuristic for @ mention query (mirrors web extractMentionQuery)
                mentionQuery = Self.extractMentionQuery(text: val, cursorPos: val.count)
            }
        )
        return VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
            Text("Add a comment")
                .font(RMTheme.Typography.bodySmallBold)
                .foregroundColor(RMTheme.Colors.textSecondary)

            ZStack(alignment: .topLeading) {
                HStack(alignment: .bottom, spacing: RMTheme.Spacing.sm) {
                    TextField("Write a comment… Use @ to mention a teammate.", text: newContentBinding, axis: .vertical)
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
                if mentionQuery != nil {
                    let candidates = mentionCandidates(query: mentionQuery ?? "", forReplyParentId: nil)
                    if !candidates.isEmpty {
                        VStack(alignment: .leading, spacing: 0) {
                            ForEach(candidates) { member in
                                Button {
                                    insertMention(member: member, intoNewComment: true, replyParentId: nil)
                                } label: {
                                    HStack(spacing: RMTheme.Spacing.sm) {
                                        Text(member.fullName ?? member.email)
                                            .font(RMTheme.Typography.bodySmall)
                                            .fontWeight(.medium)
                                            .foregroundColor(RMTheme.Colors.textPrimary)
                                        if member.fullName != nil {
                                            Text(member.email)
                                                .font(RMTheme.Typography.caption2)
                                                .foregroundColor(RMTheme.Colors.textTertiary)
                                        }
                                    }
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .padding(.horizontal, RMTheme.Spacing.sm)
                                    .padding(.vertical, 8)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .background(RMTheme.Colors.surface)
                        .overlay(
                            RoundedRectangle(cornerRadius: RMTheme.Radius.sm)
                                .stroke(RMTheme.Colors.border, lineWidth: 1)
                        )
                        .padding(.top, 4)
                    }
                }
            }
        }
        .padding(RMTheme.Spacing.md)
        .background(RMTheme.Colors.surface)
        .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.md))
    }

    /// Resolve permission aligned with backend: author, org owner, or org admin may resolve/unresolve.
    private func canResolve(_ comment: JobComment) -> Bool {
        let isAuthor = comment.authorId == currentUserId
        let isOwnerOrAdmin = currentUserRole == "owner" || currentUserRole == "admin"
        return isAuthor || isOwnerOrAdmin
    }

    /// Edit/delete permission: author, org owner, or org admin (aligned with backend).
    private func canEditOrDelete(_ comment: JobComment) -> Bool {
        let isAuthor = comment.authorId == currentUserId
        let isOwnerOrAdmin = currentUserRole == "owner" || currentUserRole == "admin"
        return isAuthor || isOwnerOrAdmin
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
                if canResolve(comment) {
                    let isResolving = resolvingCommentId == comment.id
                    Button {
                        Task { await toggleResolve(comment) }
                    } label: {
                        if isResolving {
                            ProgressView()
                                .scaleEffect(0.7)
                        } else if comment.isResolved == true {
                            Image(systemName: "circle")
                                .font(.system(size: 14))
                                .foregroundColor(RMTheme.Colors.textTertiary)
                        } else {
                            Image(systemName: "checkmark.circle")
                                .font(.system(size: 14))
                                .foregroundColor(RMTheme.Colors.textSecondary)
                        }
                    }
                    .buttonStyle(.plain)
                    .disabled(isResolving)
                }
                if canEditOrDelete(comment) && editCommentId != comment.id {
                    Button {
                        editCommentId = comment.id
                        editContent = comment.content
                        editOrDeleteError = nil
                    } label: {
                        Image(systemName: "pencil")
                            .font(.system(size: 14))
                            .foregroundColor(RMTheme.Colors.textSecondary)
                    }
                    .buttonStyle(.plain)
                    Button {
                        commentToDelete = comment
                        editOrDeleteError = nil
                    } label: {
                        Image(systemName: "trash")
                            .font(.system(size: 14))
                            .foregroundColor(RMTheme.Colors.textSecondary)
                    }
                    .buttonStyle(.plain)
                }
            }
            if editCommentId == comment.id {
                VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
                    TextField("Edit comment…", text: $editContent, axis: .vertical)
                        .textFieldStyle(.plain)
                        .font(RMTheme.Typography.bodySmall)
                        .foregroundColor(RMTheme.Colors.textPrimary)
                        .padding(RMTheme.Spacing.sm)
                        .background(RMTheme.Colors.inputFill)
                        .overlay(
                            RoundedRectangle(cornerRadius: RMTheme.Radius.sm)
                                .stroke(RMTheme.Colors.border, lineWidth: 1)
                        )
                        .lineLimit(2...6)
                    if let err = editOrDeleteError {
                        Text(err)
                            .font(RMTheme.Typography.caption2)
                            .foregroundColor(RMTheme.Colors.error)
                    }
                    HStack(spacing: RMTheme.Spacing.sm) {
                        Button("Save") {
                            Task { await saveEdit(commentId: comment.id) }
                        }
                        .font(RMTheme.Typography.caption)
                        .foregroundColor(RMTheme.Colors.accent)
                        .disabled(updatingCommentId == comment.id || editContent.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                        if updatingCommentId == comment.id {
                            ProgressView()
                                .scaleEffect(0.7)
                        }
                        Button("Cancel") {
                            editCommentId = nil
                            editContent = ""
                            editOrDeleteError = nil
                        }
                        .font(RMTheme.Typography.caption)
                        .foregroundColor(RMTheme.Colors.textSecondary)
                    }
                }
                .padding(.top, 4)
            } else {
                contentWithMentions(comment.content)
                    .font(RMTheme.Typography.bodySmall)
                    .fixedSize(horizontal: false, vertical: true)
            }

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
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .center) {
                Text(authorDisplay(reply))
                    .font(RMTheme.Typography.caption)
                    .fontWeight(.medium)
                    .foregroundColor(RMTheme.Colors.textPrimary)
                Text(relativeTime(reply.createdAt))
                    .font(RMTheme.Typography.caption2)
                    .foregroundColor(RMTheme.Colors.textTertiary)
                Spacer()
                if canEditOrDelete(reply) && editCommentId != reply.id {
                    Button {
                        editCommentId = reply.id
                        editContent = reply.content
                        editOrDeleteError = nil
                    } label: {
                        Image(systemName: "pencil")
                            .font(.system(size: 12))
                            .foregroundColor(RMTheme.Colors.textTertiary)
                    }
                    .buttonStyle(.plain)
                    Button {
                        commentToDelete = reply
                        editOrDeleteError = nil
                    } label: {
                        Image(systemName: "trash")
                            .font(.system(size: 12))
                            .foregroundColor(RMTheme.Colors.textTertiary)
                    }
                    .buttonStyle(.plain)
                }
            }
            if editCommentId == reply.id {
                TextField("Edit reply…", text: $editContent, axis: .vertical)
                    .textFieldStyle(.plain)
                    .font(RMTheme.Typography.caption)
                    .foregroundColor(RMTheme.Colors.textPrimary)
                    .padding(6)
                    .background(RMTheme.Colors.surface)
                    .overlay(
                        RoundedRectangle(cornerRadius: RMTheme.Radius.sm)
                            .stroke(RMTheme.Colors.border, lineWidth: 1)
                    )
                    .lineLimit(2...4)
                HStack(spacing: RMTheme.Spacing.xs) {
                    Button("Save") {
                        Task { await saveEdit(commentId: reply.id) }
                    }
                    .font(RMTheme.Typography.caption2)
                    .foregroundColor(RMTheme.Colors.accent)
                    .disabled(updatingCommentId == reply.id || editContent.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    Button("Cancel") {
                        editCommentId = nil
                        editContent = ""
                        editOrDeleteError = nil
                    }
                    .font(RMTheme.Typography.caption2)
                    .foregroundColor(RMTheme.Colors.textSecondary)
                }
            } else {
                contentWithMentions(reply.content)
                    .font(RMTheme.Typography.caption)
            }
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
            set: { val in
                replyContent[comment.id] = val
                activeReplyMentionParentId = comment.id
            }
        )
        let text = replyContent[comment.id] ?? ""
        let isPosting = replyPostingForId == comment.id
        let replyQuery = Self.extractMentionQuery(text: text, cursorPos: text.count)
        let showReplyPicker = activeReplyMentionParentId == comment.id && replyQuery != nil
        let replyCandidates = showReplyPicker ? mentionCandidates(query: replyQuery ?? "", forReplyParentId: comment.id) : []
        return ZStack(alignment: .topLeading) {
            HStack(alignment: .bottom, spacing: RMTheme.Spacing.sm) {
                TextField("Write a reply… Use @ to mention.", text: binding, axis: .vertical)
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
            if !replyCandidates.isEmpty {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(replyCandidates) { member in
                        Button {
                            insertMention(member: member, intoNewComment: false, replyParentId: comment.id)
                        } label: {
                            HStack(spacing: RMTheme.Spacing.sm) {
                                Text(member.fullName ?? member.email)
                                    .font(RMTheme.Typography.caption)
                                    .fontWeight(.medium)
                                    .foregroundColor(RMTheme.Colors.textPrimary)
                                if member.fullName != nil {
                                    Text(member.email)
                                        .font(RMTheme.Typography.caption2)
                                        .foregroundColor(RMTheme.Colors.textTertiary)
                                }
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 6)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .background(RMTheme.Colors.surface)
                .overlay(
                    RoundedRectangle(cornerRadius: RMTheme.Radius.sm)
                        .stroke(RMTheme.Colors.border, lineWidth: 1)
                )
                .padding(.top, 4)
            }
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

    private func toggleResolve(_ comment: JobComment) async {
        resolvingCommentId = comment.id
        defer { resolvingCommentId = nil }
        do {
            if comment.isResolved == true {
                _ = try await APIClient.shared.unresolveComment(commentId: comment.id)
            } else {
                _ = try await APIClient.shared.resolveComment(commentId: comment.id)
            }
            await loadComments()
        } catch {
            // Non-fatal: comment state unchanged; user can retry
        }
    }

    private func saveEdit(commentId: String) async {
        let content = editContent.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !content.isEmpty else { return }
        updatingCommentId = commentId
        editOrDeleteError = nil
        defer { updatingCommentId = nil }
        do {
            _ = try await APIClient.shared.updateComment(commentId: commentId, content: content)
            editCommentId = nil
            editContent = ""
            await loadComments()
            if expandedReplyForId != nil {
                await loadReplies(commentId: expandedReplyForId!)
            }
        } catch {
            editOrDeleteError = error.localizedDescription
        }
    }

    private func performDelete(comment: JobComment) async {
        deletingCommentId = comment.id
        editOrDeleteError = nil
        defer { deletingCommentId = nil }
        do {
            try await APIClient.shared.deleteComment(commentId: comment.id)
            await loadComments()
            if let parentId = comment.parentId {
                await loadReplies(commentId: parentId)
            }
            if expandedReplyForId == comment.id {
                expandedReplyForId = nil
                repliesByParent.removeValue(forKey: comment.id)
            } else if let expandedId = expandedReplyForId {
                await loadReplies(commentId: expandedId)
            }
        } catch {
            editOrDeleteError = error.localizedDescription
        }
    }

    private func postComment() async {
        let content = newContent.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !content.isEmpty else { return }
        let mentionUserIds = Self.extractMentionUserIds(content)
        isPosting = true
        mentionQuery = nil
        defer { isPosting = false }
        do {
            _ = try await APIClient.shared.createComment(jobId: jobId, content: content, mentionUserIds: mentionUserIds.isEmpty ? nil : mentionUserIds)
            newContent = ""
            await loadComments()
        } catch {
            loadError = error.localizedDescription
        }
    }

    private func postReply(commentId: String) async {
        let content = (replyContent[commentId] ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !content.isEmpty else { return }
        let mentionUserIds = Self.extractMentionUserIds(content)
        replyPostingForId = commentId
        if activeReplyMentionParentId == commentId { activeReplyMentionParentId = nil }
        defer { replyPostingForId = nil }
        do {
            _ = try await APIClient.shared.createReply(commentId: commentId, content: content, mentionUserIds: mentionUserIds.isEmpty ? nil : mentionUserIds)
            replyContent.removeValue(forKey: commentId)
            await loadReplies(commentId: commentId)
            await loadComments()
        } catch {
            repliesErrorForId[commentId] = error.localizedDescription
        }
    }

    // MARK: - Mention composition (mirrors web: @[Display Name](userId), mention_user_ids for backend notifications)

    /// Extract query string after last @ before cursor for autocomplete (mirrors web extractMentionQuery).
    private static func extractMentionQuery(text: String, cursorPos: Int) -> String? {
        guard cursorPos >= 0, cursorPos <= text.count else { return nil }
        let beforeCursor = String(text.prefix(cursorPos))
        guard let lastAt = beforeCursor.lastIndex(of: "@") else { return nil }
        let afterAt = String(beforeCursor[beforeCursor.index(after: lastAt)...])
        if afterAt.contains(where: { $0.isNewline || $0 == " " }) { return nil }
        return afterAt
    }

    /// Format mention token for storage (mirrors web: @[Display Name](userId)).
    private static func formatMention(displayName: String, userId: String) -> String {
        let safe = (displayName.isEmpty ? "User" : displayName.replacingOccurrences(of: "]", with: "\\]").trimmingCharacters(in: .whitespacesAndNewlines))
        return "@[\(safe)](\(userId))"
    }

    /// Extract user IDs from content containing @[Name](userId) (for API mention_user_ids).
    private static func extractMentionUserIds(_ content: String) -> [String] {
        let pattern = #"@\[[^\]]+\]\(([a-f0-9-]+)\)"#
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return [] }
        let ns = content as NSString
        let range = NSRange(location: 0, length: ns.length)
        var ids: [String] = []
        regex.enumerateMatches(in: content, options: [], range: range) { match, _, _ in
            guard let m = match, m.numberOfRanges >= 2 else { return }
            let idRange = m.range(at: 1)
            let id = ns.substring(with: idRange)
            if !id.isEmpty, !ids.contains(id) { ids.append(id) }
        }
        return ids
    }

    /// Insert mention token into text: replace from last @ to cursor (cursor-at-end) with token + space.
    private static func insertMentionIntoText(_ text: String, token: String) -> String {
        let cursorPos = text.count
        guard cursorPos > 0, let lastAt = text.prefix(cursorPos).lastIndex(of: "@") else { return text + token + " " }
        let before = String(text[..<lastAt])
        return before + token + " "
    }

    private var currentUserId: String { SessionManager.shared.currentUser?.id ?? "" }

    private func mentionCandidates(query: String, forReplyParentId replyParentId: String?) -> [TeamMember] {
        let q = query.lowercased()
        let filtered = members.filter { m in
            m.id != currentUserId &&
            (q.isEmpty ||
             (m.fullName?.lowercased().contains(q) == true) ||
             m.email.lowercased().contains(q))
        }
        return Array(filtered.prefix(5))
    }

    private func insertMention(member: TeamMember, intoNewComment: Bool, replyParentId: String?) {
        let displayName = member.fullName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? member.email
        let token = Self.formatMention(displayName: displayName, userId: member.id)
        if intoNewComment {
            newContent = Self.insertMentionIntoText(newContent, token: token)
            mentionQuery = nil
        } else if let parentId = replyParentId {
            let current = replyContent[parentId] ?? ""
            replyContent[parentId] = Self.insertMentionIntoText(current, token: token)
            if activeReplyMentionParentId == parentId { activeReplyMentionParentId = nil }
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

// MARK: - Job Comments Realtime

@MainActor
final class JobCommentsRealtimeService: ObservableObject {
    @Published var needsRefresh = false

    private var channel: RealtimeChannelV2?
    private var subscription: RealtimeSubscription?
    private var supabaseClient: SupabaseClient?

    func subscribe(jobId: String) {
        guard let url = URL(string: AppConfig.shared.supabaseURL) else { return }
        let client = SupabaseClient(supabaseURL: url, supabaseKey: AppConfig.shared.supabaseAnonKey)
        supabaseClient = client
        let channelName = "job-comments-\(jobId)"
        let ch = client.channel(channelName)
        let filter = "entity_id=eq.\(jobId)"
        let refresh: @Sendable () -> Void = { [weak self] in
            Task { @MainActor in
                self?.needsRefresh = true
            }
        }
        subscription = ch.onPostgresChange(
            InsertAction.self,
            schema: "public",
            table: "comments",
            filter: filter
        ) { _ in refresh() }
        ch.onPostgresChange(
            UpdateAction.self,
            schema: "public",
            table: "comments",
            filter: filter
        ) { _ in refresh() }
        ch.onPostgresChange(
            DeleteAction.self,
            schema: "public",
            table: "comments",
            filter: filter
        ) { _ in refresh() }
        Task { @MainActor in
            try? await ch.subscribeWithError()
            self.channel = ch
        }
    }

    func unsubscribe() async {
        subscription = nil
        if let ch = channel {
            await ch.unsubscribe()
        }
        channel = nil
        supabaseClient = nil
    }

    func clearRefresh() {
        needsRefresh = false
    }
}

#Preview {
    ScrollView {
        JobCommentsView(jobId: "00000000-0000-0000-0000-000000000001")
    }
    .background(RMTheme.Colors.background)
}
