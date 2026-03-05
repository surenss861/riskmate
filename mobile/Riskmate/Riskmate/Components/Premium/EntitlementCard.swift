import SwiftUI

/// Plan + entitlements card. Skeleton when loading. Package 8.
struct EntitlementCard: View {
    let entitlements: EntitlementsData?
    let isLoading: Bool
    let onManagePlan: () -> Void
    
    var body: some View {
        Group {
            if isLoading {
                RMGlassCard {
                    VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
                        RMSkeletonCard()
                    }
                }
                .rmShimmer()
            } else if let data = entitlements {
                RMCard(useSolidSurface: true) {
                    VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
                        HStack {
                            Text(planDisplayName(data.plan_code))
                                .font(RMTheme.Typography.title3)
                                .foregroundColor(RMTheme.Colors.textPrimary)
                            Spacer()
                            if let end = data.flags.current_period_end, let date = parseISO(end) {
                                Text("Renews \(formatDate(date))")
                                    .font(RMTheme.Typography.caption)
                                    .foregroundColor(RMTheme.Colors.textTertiary)
                            }
                        }
                        limitsSection(data)
                        if !data.features.isEmpty {
                            Text("Included")
                                .font(RMTheme.Typography.captionBold)
                                .foregroundColor(RMTheme.Colors.textTertiary)
                            LazyVGrid(columns: [GridItem(.adaptive(minimum: 92), spacing: 8)], spacing: 8) {
                                ForEach(data.features, id: \.self) { feature in
                                    Text(featureDisplayName(feature))
                                        .font(RMTheme.Typography.caption2)
                                        .foregroundColor(RMTheme.Colors.textSecondary)
                                        .lineLimit(1)
                                        .truncationMode(.tail)
                                        .padding(.horizontal, 8)
                                        .frame(height: 28)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                        .background(RMTheme.Colors.surface.opacity(0.6))
                                        .clipShape(Capsule())
                                }
                            }
                        }
                        VStack(alignment: .leading, spacing: 2) {
                            Button {
                                Haptics.impact(.light)
                                onManagePlan()
                            } label: {
                                HStack(spacing: 6) {
                                    Text("Manage plan")
                                        .font(RMTheme.Typography.bodySmallBold)
                                        .foregroundColor(RMTheme.Colors.accent)
                                    Image(systemName: "arrow.up.right")
                                        .font(.system(size: 10, weight: .semibold))
                                        .foregroundColor(RMTheme.Colors.accent.opacity(0.8))
                                }
                            }
                            .rmPressable(scale: 0.98, haptic: true, lightImpact: true)
                            Text("Opens web portal")
                                .font(RMTheme.Typography.caption2)
                                .foregroundColor(RMTheme.Colors.textTertiary)
                        }
                    }
                }
            } else {
                RMCard(useSolidSurface: true) {
                    VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
                        Text("Plan")
                            .font(RMTheme.Typography.title3)
                            .foregroundColor(RMTheme.Colors.textPrimary)
                        Text("Unable to load plan details")
                            .font(RMTheme.Typography.caption)
                            .foregroundColor(RMTheme.Colors.textSecondary)
                        Button("Retry", action: { Task { await EntitlementsManager.shared.refresh(force: true) } })
                            .font(RMTheme.Typography.captionBold)
                            .foregroundColor(RMTheme.Colors.accent)
                    }
                }
            }
        }
    }
    
    private func limitsSection(_ data: EntitlementsData) -> some View {
        VStack(alignment: .leading, spacing: RMTheme.Spacing.xs) {
            if let limit = data.limits.seats.limit {
                limitRow("Team seats", value: "\(data.limits.seats.used) / \(limit)")
            }
            if let limit = data.limits.jobs_monthly.limit {
                limitRow("Jobs this month", value: "\(limit) included")
            }
        }
    }
    
    private func limitRow(_ label: String, value: String) -> some View {
        HStack {
            Text(label)
                .font(RMTheme.Typography.caption)
                .foregroundColor(RMTheme.Colors.textSecondary)
            Spacer()
            Text(value)
                .font(RMTheme.Typography.caption)
                .foregroundColor(RMTheme.Colors.textTertiary)
        }
    }
    
    private func planDisplayName(_ code: String) -> String {
        switch code.lowercased() {
        case "free": return "Free"
        case "pro": return "Pro"
        case "enterprise": return "Enterprise"
        case "none": return "Free"
        default: return code.capitalized
        }
    }
    
    private func featureDisplayName(_ feature: String) -> String {
        switch feature.lowercased() {
        case "webhooks": return "Webhooks"
        case "auditor_mode", "auditor": return "Auditor mode"
        case "executive_view": return "Executive view"
        default: return feature.replacingOccurrences(of: "_", with: " ").capitalized
        }
    }
    
    private func parseISO(_ s: String) -> Date? {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f.date(from: s) ?? ISO8601DateFormatter().date(from: s)
    }
    
    private func formatDate(_ d: Date) -> String {
        let f = DateFormatter()
        f.dateStyle = .medium
        return f.string(from: d)
    }
}

#Preview {
    EntitlementCard(
        entitlements: nil,
        isLoading: false,
        onManagePlan: {}
    )
    .padding()
    .background(RMTheme.Colors.background)
}
