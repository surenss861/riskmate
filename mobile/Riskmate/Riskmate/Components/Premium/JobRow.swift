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
    
    var body: some View {
        HStack(spacing: RMSystemTheme.Spacing.md) {
            // Risk Badge (leading accessory)
            Circle()
                .fill(riskColor)
                .frame(width: 8, height: 8)
            
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
        }
        .listRowBackground(.ultraThinMaterial)
        .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 16))
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
