import SwiftUI

/// Native List row for jobs - Apple-style with swipe actions
struct JobRow: View {
    let job: Job
    
    var riskColor: Color {
        let level = (job.riskLevel ?? "").lowercased()
        if level.contains("critical") { return RMSystemTheme.Colors.critical }
        if level.contains("high") { return RMSystemTheme.Colors.high }
        if level.contains("medium") { return RMSystemTheme.Colors.medium }
        return RMSystemTheme.Colors.low
    }
    
    var body: some View {
        HStack(spacing: RMSystemTheme.Spacing.md) {
            // Risk Badge (leading accessory)
            Circle()
                .fill(riskColor)
                .frame(width: 8, height: 8)
            
            // Job Info
            VStack(alignment: .leading, spacing: 4) {
                Text(job.clientName.isEmpty ? "Untitled Job" : job.clientName)
                    .font(RMSystemTheme.Typography.headline)
                    .foregroundStyle(RMSystemTheme.Colors.textPrimary)
                    .lineLimit(1)
                
                Text("\(job.jobType) • \(job.location)")
                    .font(RMSystemTheme.Typography.subheadline)
                    .foregroundStyle(RMSystemTheme.Colors.textSecondary)
                    .lineLimit(1)
            }
            
            Spacer()
            
            // Risk Score (trailing)
            VStack(alignment: .trailing, spacing: 2) {
                Text("\(job.riskScore ?? 0)")
                    .font(RMSystemTheme.Typography.title3)
                    .foregroundStyle(RMSystemTheme.Colors.textPrimary)
                Text("Risk")
                    .font(RMSystemTheme.Typography.caption)
                    .foregroundStyle(RMSystemTheme.Colors.textTertiary)
            }
            
            // Chevron (system standard)
            Image(systemName: "chevron.right")
                .foregroundStyle(RMSystemTheme.Colors.textTertiary)
                .font(.system(size: 13, weight: .medium))
        }
        .padding(.vertical, 4)
    }
}
