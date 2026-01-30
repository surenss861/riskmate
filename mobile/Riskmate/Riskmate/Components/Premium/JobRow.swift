import SwiftUI

/// Native List row for jobs - Apple-style with accessories and actions
struct JobRow: View {
    let job: Job
    let onAddEvidence: (() -> Void)?
    let onMarkComplete: (() -> Void)?
    
    init(job: Job, onAddEvidence: (() -> Void)? = nil, onMarkComplete: (() -> Void)? = nil) {
        self.job = job
        self.onAddEvidence = onAddEvidence
        self.onMarkComplete = onMarkComplete
    }
    
    var riskColor: Color {
        let level = (job.riskLevel ?? "").lowercased()
        if level.contains("critical") { return RMSystemTheme.Colors.critical }
        if level.contains("high") { return RMSystemTheme.Colors.high }
        if level.contains("medium") { return RMSystemTheme.Colors.medium }
        return RMSystemTheme.Colors.low
    }
    
    var isHighRisk: Bool {
        (job.riskScore ?? 0) >= 80
    }
    
    var hasMissingEvidence: Bool {
        // TODO: Wire to actual evidence check
        false
    }
    
    var riskGradient: LinearGradient {
        let level = (job.riskLevel ?? "").lowercased()
        if level.contains("critical") {
            return LinearGradient(colors: [Color.red, Color.red.opacity(0.6)], startPoint: .top, endPoint: .bottom)
        } else if level.contains("high") {
            return LinearGradient(colors: [Color.orange, Color.orange.opacity(0.6)], startPoint: .top, endPoint: .bottom)
        } else if level.contains("medium") {
            return LinearGradient(colors: [Color.yellow, Color.yellow.opacity(0.6)], startPoint: .top, endPoint: .bottom)
        } else {
            return LinearGradient(colors: [Color.green, Color.green.opacity(0.6)], startPoint: .top, endPoint: .bottom)
        }
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
    
    @State private var hasAppeared = false
    
    var body: some View {
        HStack(spacing: RMSystemTheme.Spacing.md) {
            // Left edge risk strip (green → yellow → red)
            RoundedRectangle(cornerRadius: 2)
                .fill(riskGradient)
                .frame(width: 4)
            
            // Job Info
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: RMSystemTheme.Spacing.xs) {
                    Text(job.clientName.isEmpty ? "Untitled Job" : job.clientName)
                        .font(RMSystemTheme.Typography.headline)
                        .foregroundStyle(RMSystemTheme.Colors.textPrimary)
                        .lineLimit(1)
                    
                    // High risk shield accessory
                    if isHighRisk {
                        Image(systemName: "shield.lefthalf.filled")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(RMSystemTheme.Colors.high)
                    }
                }
                
                HStack(spacing: RMSystemTheme.Spacing.xs) {
                    Text("\(job.jobType) • \(job.location)")
                        .font(RMSystemTheme.Typography.subheadline)
                        .foregroundStyle(RMSystemTheme.Colors.textSecondary)
                        .lineLimit(1)
                    
                    // Missing evidence indicator
                    if hasMissingEvidence {
                        Image(systemName: "exclamationmark.circle")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(RMSystemTheme.Colors.warning)
                    }
                }
                
                // Meta row: evidence/controls when API provides them. Orange = needs attention, secondary = complete.
                if let meta = job.metaString {
                    Text(meta)
                        .font(RMSystemTheme.Typography.caption)
                        .foregroundStyle(job.isMetaComplete ? RMSystemTheme.Colors.textSecondary : RMTheme.Colors.accent)
                        .lineLimit(1)
                }
            }
            
            Spacer()
            
            // Risk Score (trailing) with subtle gradient background
            VStack(alignment: .trailing, spacing: 2) {
                Text("\(job.riskScore ?? 0)")
                    .font(RMSystemTheme.Typography.title3)
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
        }
        .listRowBackground(
            Rectangle()
                .fill(.ultraThinMaterial)
        )
        .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 16))
        .onAppear {
            // Subtle shake on first appearance for critical risk
            if !hasAppeared && isHighRisk && (job.riskScore ?? 0) >= 90 {
                hasAppeared = true
                withAnimation(.spring(response: 0.3, dampingFraction: 0.5).repeatCount(1, autoreverses: true)) {
                    // Shake effect handled by offset
                }
            }
        }
        .contextMenu {
            if let onAddEvidence = onAddEvidence {
                Button {
                    Haptics.tap()
                    onAddEvidence()
                } label: {
                    Label("Add Evidence", systemImage: "camera.fill")
                }
            }
            
            Button {
                Haptics.tap()
                UIPasteboard.general.string = job.id
                ToastCenter.shared.show("Copied Job ID", systemImage: "doc.on.doc", style: .success)
            } label: {
                Label("Copy Job ID", systemImage: "doc.on.doc")
            }
            
            if let onMarkComplete = onMarkComplete {
                Divider()
                
                Button {
                    Haptics.tap()
                    onMarkComplete()
                } label: {
                    Label("Mark Complete", systemImage: "checkmark.circle")
                }
            }
        }
    }
}
