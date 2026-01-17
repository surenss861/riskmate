import SwiftUI

/// Premium job card with clear hierarchy and risk emphasis
struct JobCard: View {
    let job: Job
    let onTap: () -> Void
    
    var riskColor: Color {
        let level = (job.riskLevel ?? "").lowercased()
        if level.contains("critical") { return RMTheme.Colors.error }
        if level.contains("high") { return RMTheme.Colors.accent }
        if level.contains("medium") { return RMTheme.Colors.warning }
        return RMTheme.Colors.success
    }
    
    var body: some View {
        RMCard {
            HStack(spacing: RMTheme.Spacing.lg) {
                // Risk Pill
                RiskPill(text: (job.riskLevel ?? "RISK").uppercased(), color: riskColor)
                
                // Job Info
                VStack(alignment: .leading, spacing: 6) {
                    Text(job.clientName.isEmpty ? "Untitled Job" : job.clientName)
                        .font(.system(size: 18, weight: .bold, design: .rounded))
                        .foregroundStyle(RMTheme.Colors.textPrimary)
                        .lineLimit(1)
                    
                    Text("\(job.jobType)  •  \(job.location)")
                        .font(.system(size: 14, weight: .medium, design: .rounded))
                        .foregroundStyle(RMTheme.Colors.textSecondary)
                        .lineLimit(1)
                    
                    StatusChip(text: job.status.uppercased())
                }
                
                Spacer()
                
                // Risk Score
                VStack(alignment: .trailing, spacing: 4) {
                    Text("\(job.riskScore ?? 0)")
                        .font(.system(size: 26, weight: .bold, design: .rounded))
                        .foregroundStyle(RMTheme.Colors.textPrimary)
                    Text("Risk")
                        .font(.system(size: 12, weight: .semibold, design: .rounded))
                        .foregroundStyle(RMTheme.Colors.textTertiary)
                }
                
                // Chevron
                Image(systemName: "chevron.right")
                    .foregroundStyle(RMTheme.Colors.textTertiary)
                    .font(.system(size: 14, weight: .semibold))
            }
        }
        .contentShape(Rectangle())
        .onTapGesture {
            onTap()
        }
    }
}

/// Risk level pill
struct RiskPill: View {
    let text: String
    let color: Color
    
    var body: some View {
        Text(text)
            .font(.system(size: 13, weight: .heavy, design: .rounded))
            .foregroundStyle(.white)
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(
                Capsule()
                    .fill(color.opacity(0.95))
            )
    }
}

/// Status chip
struct StatusChip: View {
    let text: String
    
    var body: some View {
        Text(text)
            .font(.system(size: 11, weight: .bold, design: .rounded))
            .foregroundStyle(RMTheme.Colors.textTertiary)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(
                Capsule()
                    .fill(RMTheme.Colors.surface.opacity(0.6))
                    .overlay(
                        Capsule()
                            .stroke(RMTheme.Colors.border, lineWidth: 1)
                    )
            )
    }
}
