import SwiftUI

/// Critical risk banner - shows when risk hits critical threshold
struct CriticalRiskBanner: View {
    let jobName: String
    let onAddProof: () -> Void
    let onDismiss: () -> Void
    
    @State private var isVisible = false
    
    var body: some View {
        if isVisible {
            VStack(spacing: 0) {
                HStack(spacing: RiskMateDesignSystem.Spacing.md) {
                    // Warning icon
                    ZStack {
                        Circle()
                            .fill(RiskMateDesignSystem.Colors.riskCritical.opacity(0.2))
                            .frame(width: 40, height: 40)
                        
                        Image(systemName: "exclamationmark.triangle.fill")
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundColor(RiskMateDesignSystem.Colors.riskCritical)
                    }
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Critical risk detected")
                            .font(RiskMateDesignSystem.Typography.bodyBold)
                            .foregroundColor(RiskMateDesignSystem.Colors.textPrimary)
                        
                        Text("Add proof now to protect \(jobName)")
                            .font(RiskMateDesignSystem.Typography.bodySmall)
                            .foregroundColor(RiskMateDesignSystem.Colors.textSecondary)
                    }
                    
                    Spacer()
                    
                    // Dismiss button
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(RiskMateDesignSystem.Colors.textTertiary)
                            .frame(width: 28, height: 28)
                            .background(RiskMateDesignSystem.Colors.surface.opacity(0.5))
                            .clipShape(Circle())
                    }
                }
                .padding(RiskMateDesignSystem.Spacing.md)
                .background(
                    LinearGradient(
                        colors: [
                            RiskMateDesignSystem.Colors.riskCritical.opacity(0.15),
                            RiskMateDesignSystem.Colors.riskCritical.opacity(0.05)
                        ],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .overlay(
                    Rectangle()
                        .frame(height: 2)
                        .foregroundColor(RiskMateDesignSystem.Colors.riskCritical),
                    alignment: .top
                )
                
                // Action button
                Button {
                    RiskMateDesignSystem.Haptics.impact()
                    onAddProof()
                    dismiss()
                } label: {
                    Text("Add Proof Now")
                        .font(RiskMateDesignSystem.Typography.bodyBold)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, RiskMateDesignSystem.Spacing.md)
                        .background(RiskMateDesignSystem.Colors.riskCritical)
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: RiskMateDesignSystem.Radius.md))
            .riskMateShadow(RiskMateDesignSystem.Shadow.card)
            .padding(.horizontal, RiskMateDesignSystem.Spacing.pagePadding)
            .padding(.top, RiskMateDesignSystem.Spacing.sm)
            .transition(.move(edge: .top).combined(with: .opacity))
            .onAppear {
                withAnimation(RiskMateDesignSystem.Motion.spring) {
                    isVisible = true
                }
            }
        }
    }
    
    private func dismiss() {
        RiskMateDesignSystem.Haptics.tap()
        withAnimation(RiskMateDesignSystem.Motion.spring) {
            isVisible = false
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            onDismiss()
        }
    }
}

extension CriticalRiskBanner {
    /// Show banner if job is critical and hasn't been shown before
    static func shouldShow(for job: Job) -> Bool {
        (job.riskScore ?? 0) >= 90 && !CriticalRiskBannerManager.hasShownBanner(for: job.id)
    }
}

/// Critical risk banner manager - tracks which jobs have shown banner
struct CriticalRiskBannerManager {
    static func hasShownBanner(for jobId: String) -> Bool {
        UserDefaultsManager.Banners.hasShownCriticalBanner(jobId: jobId)
    }
    
    static func markBannerShown(for jobId: String) {
        UserDefaultsManager.Banners.markCriticalBannerShown(jobId: jobId)
    }
}
