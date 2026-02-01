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
                HStack(spacing: RiskmateDesignSystem.Spacing.md) {
                    // Warning icon
                    ZStack {
                        Circle()
                            .fill(RiskmateDesignSystem.Colors.riskCritical.opacity(0.2))
                            .frame(width: 40, height: 40)
                        
                        Image(systemName: "exclamationmark.triangle.fill")
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundColor(RiskmateDesignSystem.Colors.riskCritical)
                    }
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Critical risk detected")
                            .font(RiskmateDesignSystem.Typography.bodyBold)
                            .foregroundColor(RiskmateDesignSystem.Colors.textPrimary)
                        
                        Text("Add proof now to protect \(jobName)")
                            .font(RiskmateDesignSystem.Typography.bodySmall)
                            .foregroundColor(RiskmateDesignSystem.Colors.textSecondary)
                    }
                    
                    Spacer()
                    
                    // Dismiss button
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(RiskmateDesignSystem.Colors.textTertiary)
                            .frame(width: 28, height: 28)
                            .background(RiskmateDesignSystem.Colors.surface.opacity(0.5))
                            .clipShape(Circle())
                    }
                }
                .padding(RiskmateDesignSystem.Spacing.md)
                .background(
                    LinearGradient(
                        colors: [
                            RiskmateDesignSystem.Colors.riskCritical.opacity(0.15),
                            RiskmateDesignSystem.Colors.riskCritical.opacity(0.05)
                        ],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .overlay(
                    Rectangle()
                        .frame(height: 2)
                        .foregroundColor(RiskmateDesignSystem.Colors.riskCritical),
                    alignment: .top
                )
                
                // Action button
                Button {
                    RiskmateDesignSystem.Haptics.impact()
                    onAddProof()
                    dismiss()
                } label: {
                    Text("Add Proof Now")
                        .font(RiskmateDesignSystem.Typography.bodyBold)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, RiskmateDesignSystem.Spacing.md)
                        .background(RiskmateDesignSystem.Colors.riskCritical)
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: RiskmateDesignSystem.Radius.md))
            .riskmateShadow(RiskmateDesignSystem.Shadow.card)
            .padding(.horizontal, RiskmateDesignSystem.Spacing.pagePadding)
            .padding(.top, RiskmateDesignSystem.Spacing.sm)
            .transition(.move(edge: .top).combined(with: .opacity))
            .onAppear {
                withAnimation(RiskmateDesignSystem.Motion.spring) {
                    isVisible = true
                }
            }
        }
    }
    
    private func dismiss() {
        RiskmateDesignSystem.Haptics.tap()
        withAnimation(RiskmateDesignSystem.Motion.spring) {
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
