import SwiftUI

/// Comments tab for job detail: list comments and add new ones. Mentions shown as plain text on iOS.
struct JobCommentsView: View {
    let jobId: String

    @State private var comments: [JobComment] = []
    @State private var isLoading = true
    @State private var loadError: String?
    @State private var newContent = ""
    @State private var isPosting = false

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
            Text(comment.content)
                .font(RMTheme.Typography.bodySmall)
                .foregroundColor(RMTheme.Colors.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
            if (comment.replyCount ?? 0) > 0 {
                Text("\(comment.replyCount!) reply(ies)")
                    .font(RMTheme.Typography.caption)
                    .foregroundColor(RMTheme.Colors.textTertiary)
            }
        }
        .padding(RMTheme.Spacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RMTheme.Colors.surface)
        .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.md))
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
}

#Preview {
    ScrollView {
        JobCommentsView(jobId: "00000000-0000-0000-0000-000000000001")
    }
    .background(RMTheme.Colors.background)
}
