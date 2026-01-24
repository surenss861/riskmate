import SwiftUI

/// System-native job card with clear hierarchy and risk emphasis
struct JobCard: View {
    let job: Job
    let onTap: () -> Void
    
    var riskColor: Color {
        let level = (job.riskLevel ?? "").lowercased()
        if level.contains("critical") { return RMSystemTheme.Colors.critical }
        if level.contains("high") { return RMSystemTheme.Colors.high }
        if level.contains("medium") { return RMSystemTheme.Colors.medium }
        return RMSystemTheme.Colors.low
    }
    
    var riskScoreBackgroundGradient: LinearGradient {
        let score = job.riskScore ?? 0
        if score >= 90 {
            return LinearGradient(colors: [Color.red.opacity(0.15), Color.red.opacity(0.05)], startPoint: .topLeading, endPoint: .bottomTrailing)
        } else if score >= 70 {
            return LinearGradient(colors: [Color.orange.opacity(0.15), Color.orange.opacity(0.05)], startPoint: .topLeading, endPoint: .bottomTrailing)
        } else if score >= 40 {
            return LinearGradient(colors: [Color.yellow.opacity(0.15), Color.yellow.opacity(0.05)], startPoint: .topLeading, endPoint: .bottomTrailing)
        } else {
            return LinearGradient(colors: [Color.green.opacity(0.15), Color.green.opacity(0.05)], startPoint: .topLeading, endPoint: .bottomTrailing)
        }
    }
    
    var body: some View {
        RMCard {
            HStack(spacing: RMSystemTheme.Spacing.md) {
                // Risk Pill
                RiskPill(text: (job.riskLevel ?? "RISK").uppercased(), color: riskColor)
                
                // Job Info
                VStack(alignment: .leading, spacing: 4) {
                    Text(job.clientName.isEmpty ? "Untitled Job" : job.clientName)
                        .font(RMSystemTheme.Typography.headline)
                        .foregroundStyle(RMSystemTheme.Colors.textPrimary)
                        .lineLimit(1)
                    
                    Text("\(job.jobType)  •  \(job.location)")
                        .font(RMSystemTheme.Typography.subheadline)
                        .foregroundStyle(RMSystemTheme.Colors.textSecondary)
                        .lineLimit(1)
                    
                    StatusChip(text: job.status.uppercased())
                    
                    // Contextual action hint for critical jobs
                    if (job.riskScore ?? 0) >= 90 {
                        HStack(spacing: 4) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundStyle(RMSystemTheme.Colors.warning)
                            Text("High risk — add proof to reduce exposure")
                                .font(RMSystemTheme.Typography.caption2)
                                .foregroundStyle(RMSystemTheme.Colors.textTertiary)
                        }
                        .padding(.top, 2)
                        .transition(.opacity.combined(with: .move(edge: .top)))
                    }
                }
                
                Spacer()
                
                // Risk Score with animation on first load
                VStack(alignment: .trailing, spacing: 2) {
                    Text("\(job.riskScore ?? 0)")
                        .font(RMSystemTheme.Typography.title2)
                        .foregroundStyle(RMSystemTheme.Colors.textPrimary)
                        .contentTransition(.numericText())
                        .animation(.spring(response: 0.4, dampingFraction: 0.8), value: job.riskScore)
                    Text("Risk")
                        .font(RMSystemTheme.Typography.caption)
                        .foregroundStyle(RMSystemTheme.Colors.textTertiary)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(
                    RoundedRectangle(cornerRadius: RMSystemTheme.Radius.sm)
                        .fill(riskScoreBackgroundGradient)
                )
                
                // Chevron
                Image(systemName: "chevron.right")
                    .foregroundStyle(RMSystemTheme.Colors.textTertiary)
                    .font(.system(size: 14, weight: .medium))
            }
        }
        .contentShape(Rectangle())
        .onTapGesture {
            Haptics.tap()
            onTap()
        }
        .appearIn()
    }
}

/// Risk level pill
struct RiskPill: View {
    let text: String
    let color: Color
    
    var body: some View {
        Text(text)
            .font(RMSystemTheme.Typography.caption2.weight(.bold))
            .foregroundStyle(.white)
            .padding(.horizontal, RMSystemTheme.Spacing.sm)
            .padding(.vertical, 6)
            .background(
                Capsule()
                    .fill(color)
            )
    }
}

/// Status chip
struct StatusChip: View {
    let text: String
    
    var body: some View {
        Text(text)
            .font(RMSystemTheme.Typography.caption2)
            .foregroundStyle(RMSystemTheme.Colors.textTertiary)
            .padding(.horizontal, RMSystemTheme.Spacing.sm)
            .padding(.vertical, 4)
            .background(
                Capsule()
                    .fill(RMSystemTheme.Colors.tertiaryBackground)
            )
    }
}
