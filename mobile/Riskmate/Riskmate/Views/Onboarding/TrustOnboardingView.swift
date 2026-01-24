import SwiftUI

/// Trust-focused onboarding - 3 screens that build confidence in the ledger
struct TrustOnboardingView: View {
    @Binding var isPresented: Bool
    @State private var currentPage = 0
    
    // Reordered: Trust → Action → Collaboration
    let pages = [
        OnboardingPageData(
            title: "This is a verifiable ledger",
            description: "Every action creates an immutable proof record. Once anchored, proofs cannot be edited or deleted—your audit trail is permanent.",
            icon: "lock.shield.fill",
            diagram: "ledger_diagram"
        ),
        OnboardingPageData(
            title: "Capture evidence in seconds",
            description: "Photo → Type → Anchor. Evidence is automatically linked to jobs and added to your ledger. Works offline, syncs when connected.",
            icon: "camera.fill",
            diagram: "capture_flow"
        ),
        OnboardingPageData(
            title: "Teams + roles",
            description: "Owner, Admin, Supervisor, Worker, and Auditor roles. Auditors have read-only access—they can view but not modify proofs.",
            icon: "person.3.fill",
            diagram: "roles_diagram"
        )
    ]
    
    var body: some View {
        ZStack {
            RiskMateDesignSystem.Colors.background
                .ignoresSafeArea()
            
            VStack(spacing: 0) {
                // Page Content
                TabView(selection: $currentPage) {
                    ForEach(0..<pages.count, id: \.self) { index in
                        TrustOnboardingPageView(page: pages[index])
                            .tag(index)
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .always))
                .indexViewStyle(.page(backgroundDisplayMode: .always))
                
                // Navigation
                HStack(spacing: RiskMateDesignSystem.Spacing.md) {
                    if currentPage > 0 {
                        Button {
                            RiskMateDesignSystem.Haptics.tap()
                            withAnimation(RiskMateDesignSystem.Motion.spring) {
                                currentPage -= 1
                            }
                        } label: {
                            Text("Back")
                                .font(RiskMateDesignSystem.Typography.bodyBold)
                                .foregroundColor(RiskMateDesignSystem.Colors.textSecondary)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, RiskMateDesignSystem.Spacing.md)
                                .background(RiskMateDesignSystem.Colors.surface.opacity(0.5))
                                .clipShape(RoundedRectangle(cornerRadius: RiskMateDesignSystem.Radius.sm))
                        }
                    }
                    
                    Button {
                        if currentPage < pages.count - 1 {
                            RiskMateDesignSystem.Haptics.impact()
                            withAnimation(RiskMateDesignSystem.Motion.spring) {
                                currentPage += 1
                            }
                        } else {
                            completeOnboarding()
                        }
                    } label: {
                        Text(currentPage < pages.count - 1 ? "Next" : "Get Started")
                            .font(RiskMateDesignSystem.Typography.bodyBold)
                            .foregroundColor(.black)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, RiskMateDesignSystem.Spacing.md)
                            .background(
                                LinearGradient(
                                    colors: [
                                        RiskMateDesignSystem.Colors.accent,
                                        RiskMateDesignSystem.Colors.accentLight
                                    ],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .clipShape(RoundedRectangle(cornerRadius: RiskMateDesignSystem.Radius.sm))
                    }
                }
                .padding(.horizontal, RiskMateDesignSystem.Spacing.pagePadding)
                .padding(.bottom, RiskMateDesignSystem.Spacing.lg)
            }
        }
        .preferredColorScheme(.dark)
    }
    
    private func completeOnboarding() {
        RiskMateDesignSystem.Haptics.success()
        
        // Get userId if available, otherwise use device-level
        if let userId = SessionManager.shared.currentUser?.id {
            UserDefaultsManager.Onboarding.markOnboardingSeen(userId: userId)
        } else {
            UserDefaultsManager.Onboarding.markDeviceOnboardingSeen()
        }
        
        // Track analytics
        Analytics.shared.trackOnboardingCompleted()
        
        withAnimation(RiskMateDesignSystem.Motion.spring) {
            isPresented = false
        }
    }
}

struct OnboardingPageData {
    let title: String
    let description: String
    let icon: String
    let diagram: String // For future diagram implementation
}

struct TrustOnboardingPageView: View {
    let page: OnboardingPageData
    
    var body: some View {
        VStack(spacing: RiskMateDesignSystem.Spacing.xl) {
            Spacer()
            
            // Icon
            ZStack {
                Circle()
                    .fill(RiskMateDesignSystem.Colors.accent.opacity(0.15))
                    .frame(width: 120, height: 120)
                
                Image(systemName: page.icon)
                    .font(.system(size: 50, weight: .semibold))
                    .foregroundColor(RiskMateDesignSystem.Colors.accent)
            }
            .padding(.bottom, RiskMateDesignSystem.Spacing.lg)
            
            // Title
            Text(page.title)
                .font(RiskMateDesignSystem.Typography.headingLarge)
                .foregroundColor(RiskMateDesignSystem.Colors.textPrimary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, RiskMateDesignSystem.Spacing.pagePadding)
            
            // Description
            Text(page.description)
                .font(RiskMateDesignSystem.Typography.body)
                .foregroundColor(RiskMateDesignSystem.Colors.textSecondary)
                .multilineTextAlignment(.center)
                .lineSpacing(4)
                .padding(.horizontal, RiskMateDesignSystem.Spacing.pagePadding)
            
            // Diagram placeholder (can be replaced with actual diagrams)
            if page.diagram == "ledger_diagram" {
                LedgerDiagramView()
                    .padding(.top, RiskMateDesignSystem.Spacing.lg)
            } else if page.diagram == "capture_flow" {
                CaptureFlowDiagramView()
                    .padding(.top, RiskMateDesignSystem.Spacing.lg)
            } else if page.diagram == "roles_diagram" {
                RolesDiagramView()
                    .padding(.top, RiskMateDesignSystem.Spacing.lg)
            }
            
            Spacer()
        }
    }
}

// MARK: - Diagram Views

struct LedgerDiagramView: View {
    var body: some View {
        VStack(spacing: RiskMateDesignSystem.Spacing.md) {
            HStack(spacing: RiskMateDesignSystem.Spacing.sm) {
                // Proof record
                VStack(spacing: RiskMateDesignSystem.Spacing.xs) {
                    RoundedRectangle(cornerRadius: RiskMateDesignSystem.Radius.sm)
                        .fill(RiskMateDesignSystem.Colors.surface)
                        .frame(width: 60, height: 40)
                        .overlay(
                            Image(systemName: "lock.fill")
                                .font(.system(size: 16))
                                .foregroundColor(RiskMateDesignSystem.Colors.accent)
                        )
                    
                    Text("Proof")
                        .font(RiskMateDesignSystem.Typography.caption)
                        .foregroundColor(RiskMateDesignSystem.Colors.textTertiary)
                }
                
                Image(systemName: "arrow.right")
                    .foregroundColor(RiskMateDesignSystem.Colors.textTertiary)
                
                // Anchor
                VStack(spacing: RiskMateDesignSystem.Spacing.xs) {
                    RoundedRectangle(cornerRadius: RiskMateDesignSystem.Radius.sm)
                        .fill(RiskMateDesignSystem.Colors.accent.opacity(0.2))
                        .frame(width: 60, height: 40)
                        .overlay(
                            Image(systemName: "link")
                                .font(.system(size: 16))
                                .foregroundColor(RiskMateDesignSystem.Colors.accent)
                        )
                    
                    Text("Anchored")
                        .font(RiskMateDesignSystem.Typography.caption)
                        .foregroundColor(RiskMateDesignSystem.Colors.textTertiary)
                }
                
                Image(systemName: "arrow.right")
                    .foregroundColor(RiskMateDesignSystem.Colors.textTertiary)
                
                // Immutable
                VStack(spacing: RiskMateDesignSystem.Spacing.xs) {
                    RoundedRectangle(cornerRadius: RiskMateDesignSystem.Radius.sm)
                        .fill(RiskMateDesignSystem.Colors.success.opacity(0.2))
                        .frame(width: 60, height: 40)
                        .overlay(
                            Image(systemName: "checkmark.seal.fill")
                                .font(.system(size: 16))
                                .foregroundColor(RiskMateDesignSystem.Colors.success)
                        )
                    
                    Text("Immutable")
                        .font(RiskMateDesignSystem.Typography.caption)
                        .foregroundColor(RiskMateDesignSystem.Colors.textTertiary)
                }
            }
            
            Text("Proofs cannot be altered once anchored")
                .font(RiskMateDesignSystem.Typography.caption)
                .foregroundColor(RiskMateDesignSystem.Colors.textTertiary)
                .padding(.top, RiskMateDesignSystem.Spacing.xs)
        }
        .padding(RiskMateDesignSystem.Spacing.lg)
        .background(RiskMateDesignSystem.Colors.surface.opacity(0.5))
        .clipShape(RoundedRectangle(cornerRadius: RiskMateDesignSystem.Radius.md))
    }
}

struct CaptureFlowDiagramView: View {
    var body: some View {
        VStack(spacing: RiskMateDesignSystem.Spacing.md) {
            HStack(spacing: RiskMateDesignSystem.Spacing.sm) {
                // Photo
                VStack(spacing: RiskMateDesignSystem.Spacing.xs) {
                    RoundedRectangle(cornerRadius: RiskMateDesignSystem.Radius.sm)
                        .fill(RiskMateDesignSystem.Colors.surface)
                        .frame(width: 50, height: 50)
                        .overlay(
                            Image(systemName: "camera.fill")
                                .foregroundColor(RiskMateDesignSystem.Colors.accent)
                        )
                    
                    Text("Photo")
                        .font(RiskMateDesignSystem.Typography.caption)
                        .foregroundColor(RiskMateDesignSystem.Colors.textTertiary)
                }
                
                Image(systemName: "arrow.right")
                    .foregroundColor(RiskMateDesignSystem.Colors.textTertiary)
                
                // Type
                VStack(spacing: RiskMateDesignSystem.Spacing.xs) {
                    RoundedRectangle(cornerRadius: RiskMateDesignSystem.Radius.sm)
                        .fill(RiskMateDesignSystem.Colors.surface)
                        .frame(width: 50, height: 50)
                        .overlay(
                            Image(systemName: "tag.fill")
                                .foregroundColor(RiskMateDesignSystem.Colors.accent)
                        )
                    
                    Text("Type")
                        .font(RiskMateDesignSystem.Typography.caption)
                        .foregroundColor(RiskMateDesignSystem.Colors.textTertiary)
                }
                
                Image(systemName: "arrow.right")
                    .foregroundColor(RiskMateDesignSystem.Colors.textTertiary)
                
                // Anchor
                VStack(spacing: RiskMateDesignSystem.Spacing.xs) {
                    RoundedRectangle(cornerRadius: RiskMateDesignSystem.Radius.sm)
                        .fill(RiskMateDesignSystem.Colors.accent.opacity(0.2))
                        .frame(width: 50, height: 50)
                        .overlay(
                            Image(systemName: "link")
                                .foregroundColor(RiskMateDesignSystem.Colors.accent)
                        )
                    
                    Text("Anchor")
                        .font(RiskMateDesignSystem.Typography.caption)
                        .foregroundColor(RiskMateDesignSystem.Colors.textTertiary)
                }
            }
            
            Text("Automatic ledger entry")
                .font(RiskMateDesignSystem.Typography.caption)
                .foregroundColor(RiskMateDesignSystem.Colors.textTertiary)
                .padding(.top, RiskMateDesignSystem.Spacing.xs)
        }
        .padding(RiskMateDesignSystem.Spacing.lg)
        .background(RiskMateDesignSystem.Colors.surface.opacity(0.5))
        .clipShape(RoundedRectangle(cornerRadius: RiskMateDesignSystem.Radius.md))
    }
}

struct RolesDiagramView: View {
    var body: some View {
        VStack(spacing: RiskMateDesignSystem.Spacing.md) {
            HStack(spacing: RiskMateDesignSystem.Spacing.sm) {
                // Write roles
                VStack(spacing: RiskMateDesignSystem.Spacing.xs) {
                    HStack(spacing: 4) {
                        Image(systemName: "person.fill")
                            .font(.system(size: 12))
                        Image(systemName: "person.fill")
                            .font(.system(size: 12))
                        Image(systemName: "person.fill")
                            .font(.system(size: 12))
                    }
                    .foregroundColor(RiskMateDesignSystem.Colors.accent)
                    
                    Text("Owner, Admin, Worker")
                        .font(RiskMateDesignSystem.Typography.caption)
                        .foregroundColor(RiskMateDesignSystem.Colors.textTertiary)
                        .multilineTextAlignment(.center)
                    
                    Text("Read + Write")
                        .font(RiskMateDesignSystem.Typography.caption2)
                        .foregroundColor(RiskMateDesignSystem.Colors.success)
                        .padding(.top, 2)
                }
                
                Divider()
                    .frame(height: 40)
                
                // Read-only role
                VStack(spacing: RiskMateDesignSystem.Spacing.xs) {
                    Image(systemName: "eye.fill")
                        .font(.system(size: 16))
                        .foregroundColor(RiskMateDesignSystem.Colors.textTertiary)
                    
                    Text("Auditor")
                        .font(RiskMateDesignSystem.Typography.caption)
                        .foregroundColor(RiskMateDesignSystem.Colors.textTertiary)
                    
                    Text("Read Only")
                        .font(RiskMateDesignSystem.Typography.caption2)
                        .foregroundColor(RiskMateDesignSystem.Colors.textTertiary)
                        .padding(.top, 2)
                }
            }
            
            Text("Auditors can view but not modify proofs")
                .font(RiskMateDesignSystem.Typography.caption)
                .foregroundColor(RiskMateDesignSystem.Colors.textTertiary)
                .padding(.top, RiskMateDesignSystem.Spacing.xs)
        }
        .padding(RiskMateDesignSystem.Spacing.lg)
        .background(RiskMateDesignSystem.Colors.surface.opacity(0.5))
        .clipShape(RoundedRectangle(cornerRadius: RiskMateDesignSystem.Radius.md))
    }
}

#Preview {
    TrustOnboardingView(isPresented: .constant(true))
}
