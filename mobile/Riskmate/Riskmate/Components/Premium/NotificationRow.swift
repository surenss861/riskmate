import SwiftUI

/// Notification list row: leading icon (by type), title, subtitle, trailing time + unread dot. Intentional, not default List cell.
struct NotificationRow: View {
    let item: AppNotification
    var isNew: Bool = false
    let onTap: () async -> Void
    
    var body: some View {
        Button {
            Task { await onTap() }
        } label: {
            HStack(alignment: .top, spacing: RMTheme.Spacing.md) {
                Image(systemName: item.type.iconName)
                    .font(.system(size: 18, weight: .medium))
                    .foregroundColor(item.type.iconColor)
                    .frame(width: 28, alignment: .center)
                
                VStack(alignment: .leading, spacing: 4) {
                    Text(item.title.isEmpty ? item.type.defaultTitle : item.title)
                        .font(RMTheme.Typography.bodyBold)
                        .foregroundColor(RMTheme.Colors.textPrimary)
                        .lineLimit(2)
                    if !item.body.isEmpty {
                        Text(item.body)
                            .font(RMTheme.Typography.body)
                            .foregroundColor(RMTheme.Colors.textSecondary)
                            .lineLimit(2)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                
                VStack(alignment: .trailing, spacing: 4) {
                    if isNew {
                        Text("New")
                            .font(RMTheme.Typography.caption2)
                            .foregroundColor(RMTheme.Colors.accent)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(RMTheme.Colors.accent.opacity(0.15))
                            .clipShape(Capsule())
                    }
                    Text(relativeTime(item.createdAt))
                        .font(RMTheme.Typography.caption)
                        .foregroundColor(RMTheme.Colors.textTertiary)
                    if !item.isRead {
                        Circle()
                            .fill(RMTheme.Colors.accent)
                            .frame(width: 8, height: 8)
                    }
                }
            }
            .padding(RMTheme.Spacing.md)
        }
        .buttonStyle(.plain)
    }
    
    private func relativeTime(_ date: Date) -> String {
        let f = RelativeDateTimeFormatter()
        f.unitsStyle = .abbreviated
        return f.localizedString(for: date, relativeTo: Date())
    }
}

#Preview {
    List {
        NotificationRow(
            item: AppNotification(
                id: "1",
                type: .signatureRequest,
                title: "Signature requested",
                body: "John requested your signature on Site Safety Check.",
                deepLink: nil,
                isRead: false,
                createdAt: Date()
            ),
            onTap: {}
        )
    }
}
