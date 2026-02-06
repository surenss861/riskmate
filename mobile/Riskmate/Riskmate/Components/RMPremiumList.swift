import SwiftUI

/// Premium list row with card styling (not default List gray)
struct RMPremiumListRow<Content: View>: View {
    let content: Content
    @AppStorage("list_density") private var listDensity: ListDensity = .comfortable
    
    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }
    
    var body: some View {
        content
            .padding(.vertical, densityPadding)
            .listRowBackground(Color.clear)
            .listRowSeparator(.hidden)
            .listRowInsets(EdgeInsets(
                top: 0,
                leading: RMTheme.Spacing.pagePadding,
                bottom: 0,
                trailing: RMTheme.Spacing.pagePadding
            ))
    }
    
    private var densityPadding: CGFloat {
        switch listDensity {
        case .compact: return RMTheme.Spacing.xs
        case .comfortable: return RMTheme.Spacing.sm
        case .spacious: return RMTheme.Spacing.md
        }
    }
}

enum ListDensity: String {
    case compact
    case comfortable
    case spacious
}

/// Sticky filter bar with subtle blur
struct RMStickyFilterBar<Content: View>: View {
    @ViewBuilder let content: Content
    @State private var scrollOffset: CGFloat = 0
    
    var body: some View {
        VStack(spacing: 0) {
            content
                .padding(.horizontal, RMTheme.Spacing.pagePadding)
                .padding(.vertical, RMTheme.Spacing.sm)
                .background(
                    .ultraThinMaterial,
                    in: Rectangle()
                )
                .overlay(
                    Rectangle()
                        .frame(height: 1)
                        .foregroundColor(RMTheme.Colors.border),
                    alignment: .bottom
                )
        }
    }
}

/// Sectioned list with card rows
struct RMSectionedCardList<Content: View>: View {
    let title: String?
    @ViewBuilder let content: Content
    
    var body: some View {
        VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
            if let title = title {
                Text(title)
                    .rmSectionHeader()
                    .padding(.horizontal, RMTheme.Spacing.pagePadding)
            }
            
            content
        }
    }
}

/// Empty state that sells (not just "No items")
struct RMSellingEmptyState: View {
    let icon: String
    let title: String
    let message: String
    let ctaTitle: String?
    let ctaAction: (() -> Void)?
    
    init(
        icon: String,
        title: String,
        message: String,
        ctaTitle: String? = nil,
        ctaAction: (() -> Void)? = nil
    ) {
        self.icon = icon
        self.title = title
        self.message = message
        self.ctaTitle = ctaTitle
        self.ctaAction = ctaAction
    }
    
    var body: some View {
        VStack(spacing: RMTheme.Spacing.lg) {
            Image(systemName: icon)
                .font(.system(size: 64, weight: .light))
                .foregroundColor(RMTheme.Colors.textTertiary)
                .accessibilityHidden(true)
            
            VStack(spacing: RMTheme.Spacing.sm) {
                Text(title)
                    .font(RMTheme.Typography.title2)
                    .foregroundColor(RMTheme.Colors.textPrimary)
                    .accessibilityAddTraits(.isHeader)
                
                Text(message)
                    .font(RMTheme.Typography.body)
                    .foregroundColor(RMTheme.Colors.textSecondary)
                    .multilineTextAlignment(.center)
            }
            
            if let ctaTitle = ctaTitle, let ctaAction = ctaAction {
                Button {
                    ctaAction()
                } label: {
                    Text(ctaTitle)
                        .font(RMTheme.Typography.bodyBold)
                        .foregroundColor(.black)
                        .padding(.horizontal, RMTheme.Spacing.lg)
                        .padding(.vertical, RMTheme.Spacing.md)
                        .background(RMTheme.Colors.accent)
                        .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.md))
                }
                .accessibilityLabel(ctaTitle)
                .accessibilityAddTraits(.isButton)
            }
        }
        .padding(RMTheme.Spacing.xl)
        .frame(maxWidth: .infinity)
    }
}
