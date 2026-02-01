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
            RiskmateDesignSystem.Colors.background
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
                HStack(spacing: RiskmateDesignSystem.Spacing.md) {
                    if currentPage > 0 {
                        Button {
                            RiskmateDesignSystem.Haptics.tap()
                            withAnimation(RiskmateDesignSystem.Motion.spring) {
                                currentPage -= 1
                            }
                        } label: {
                            Text("Back")
                                .font(RiskmateDesignSystem.Typography.bodyBold)
                                .foregroundColor(RiskmateDesignSystem.Colors.textSecondary)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, RiskmateDesignSystem.Spacing.md)
                                .background(RiskmateDesignSystem.Colors.surface.opacity(0.5))
                                .clipShape(RoundedRectangle(cornerRadius: RiskmateDesignSystem.Radius.sm))
                        }
                    }
                    
                    Button {
                        if currentPage < pages.count - 1 {
                            RiskmateDesignSystem.Haptics.impact()
                            withAnimation(RiskmateDesignSystem.Motion.spring) {
                                currentPage += 1
                            }
                        } else {
                            completeOnboarding()
                        }
                    } label: {
                        Text(currentPage < pages.count - 1 ? "Next" : "Get Started")
                            .font(RiskmateDesignSystem.Typography.bodyBold)
                            .foregroundColor(.black)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, RiskmateDesignSystem.Spacing.md)
                            .background(
                                LinearGradient(
                                    colors: [
                                        RiskmateDesignSystem.Colors.accent,
                                        RiskmateDesignSystem.Colors.accentLight
                                    ],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .clipShape(RoundedRectangle(cornerRadius: RiskmateDesignSystem.Radius.sm))
                    }
                }
                .padding(.horizontal, RiskmateDesignSystem.Spacing.pagePadding)
                .padding(.bottom, RiskmateDesignSystem.Spacing.lg)
            }
        }
        .preferredColorScheme(.dark)
    }
    
    private func completeOnboarding() {
        RiskmateDesignSystem.Haptics.success()
        
        // Get userId if available, otherwise use device-level
        if let userId = SessionManager.shared.currentUser?.id {
            UserDefaultsManager.Onboarding.markOnboardingSeen(userId: userId)
        } else {
            UserDefaultsManager.Onboarding.markDeviceOnboardingSeen()
        }
        
        // Track analytics
        Analytics.shared.trackOnboardingCompleted()
        
        withAnimation(RiskmateDesignSystem.Motion.spring) {
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
        VStack(spacing: RiskmateDesignSystem.Spacing.xl) {
            Spacer()
            
            // Icon
            ZStack {
                Circle()
                    .fill(RiskmateDesignSystem.Colors.accent.opacity(0.15))
                    .frame(width: 120, height: 120)
                
                Image(systemName: page.icon)
                    .font(.system(size: 50, weight: .semibold))
                    .foregroundColor(RiskmateDesignSystem.Colors.accent)
            }
            .padding(.bottom, RiskmateDesignSystem.Spacing.lg)
            
            // Title
            Text(page.title)
                .font(RiskmateDesignSystem.Typography.headingLarge)
                .foregroundColor(RiskmateDesignSystem.Colors.textPrimary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, RiskmateDesignSystem.Spacing.pagePadding)
            
            // Description
            Text(page.description)
                .font(RiskmateDesignSystem.Typography.body)
                .foregroundColor(RiskmateDesignSystem.Colors.textSecondary)
                .multilineTextAlignment(.center)
                .lineSpacing(4)
                .padding(.horizontal, RiskmateDesignSystem.Spacing.pagePadding)
            
            // Diagram placeholder (can be replaced with actual diagrams)
            if page.diagram == "ledger_diagram" {
                LedgerDiagramView()
                    .padding(.top, RiskmateDesignSystem.Spacing.lg)
            } else if page.diagram == "capture_flow" {
                CaptureFlowDiagramView()
                    .padding(.top, RiskmateDesignSystem.Spacing.lg)
            } else if page.diagram == "roles_diagram" {
                RolesDiagramView()
                    .padding(.top, RiskmateDesignSystem.Spacing.lg)
            }
            
            Spacer()
        }
    }
}

// MARK: - Diagram Views

struct LedgerDiagramView: View {
    var body: some View {
        VStack(spacing: RiskmateDesignSystem.Spacing.md) {
            HStack(spacing: RiskmateDesignSystem.Spacing.sm) {
                // Proof record
                VStack(spacing: RiskmateDesignSystem.Spacing.xs) {
                    RoundedRectangle(cornerRadius: RiskmateDesignSystem.Radius.sm)
                        .fill(RiskmateDesignSystem.Colors.surface)
                        .frame(width: 60, height: 40)
                        .overlay(
                            Image(systemName: "lock.fill")
                                .font(.system(size: 16))
                                .foregroundColor(RiskmateDesignSystem.Colors.accent)
                        )
                    
                    Text("Proof")
                        .font(RiskmateDesignSystem.Typography.caption)
                        .foregroundColor(RiskmateDesignSystem.Colors.textTertiary)
                }
                
                Image(systemName: "arrow.right")
                    .foregroundColor(RiskmateDesignSystem.Colors.textTertiary)
                
                // Anchor
                VStack(spacing: RiskmateDesignSystem.Spacing.xs) {
                    RoundedRectangle(cornerRadius: RiskmateDesignSystem.Radius.sm)
                        .fill(RiskmateDesignSystem.Colors.accent.opacity(0.2))
                        .frame(width: 60, height: 40)
                        .overlay(
                            Image(systemName: "link")
                                .font(.system(size: 16))
                                .foregroundColor(RiskmateDesignSystem.Colors.accent)
                        )
                    
                    Text("Anchored")
                        .font(RiskmateDesignSystem.Typography.caption)
                        .foregroundColor(RiskmateDesignSystem.Colors.textTertiary)
                }
                
                Image(systemName: "arrow.right")
                    .foregroundColor(RiskmateDesignSystem.Colors.textTertiary)
                
                // Immutable
                VStack(spacing: RiskmateDesignSystem.Spacing.xs) {
                    RoundedRectangle(cornerRadius: RiskmateDesignSystem.Radius.sm)
                        .fill(RiskmateDesignSystem.Colors.success.opacity(0.2))
                        .frame(width: 60, height: 40)
                        .overlay(
                            Image(systemName: "checkmark.seal.fill")
                                .font(.system(size: 16))
                                .foregroundColor(RiskmateDesignSystem.Colors.success)
                        )
                    
                    Text("Immutable")
                        .font(RiskmateDesignSystem.Typography.caption)
                        .foregroundColor(RiskmateDesignSystem.Colors.textTertiary)
                }
            }
            
            Text("Proofs cannot be altered once anchored")
                .font(RiskmateDesignSystem.Typography.caption)
                .foregroundColor(RiskmateDesignSystem.Colors.textTertiary)
                .padding(.top, RiskmateDesignSystem.Spacing.xs)
        }
        .padding(RiskmateDesignSystem.Spacing.lg)
        .background(RiskmateDesignSystem.Colors.surface.opacity(0.5))
        .clipShape(RoundedRectangle(cornerRadius: RiskmateDesignSystem.Radius.md))
    }
}

struct CaptureFlowDiagramView: View {
    var body: some View {
        VStack(spacing: RiskmateDesignSystem.Spacing.md) {
            HStack(spacing: RiskmateDesignSystem.Spacing.sm) {
                // Photo
                VStack(spacing: RiskmateDesignSystem.Spacing.xs) {
                    RoundedRectangle(cornerRadius: RiskmateDesignSystem.Radius.sm)
                        .fill(RiskmateDesignSystem.Colors.surface)
                        .frame(width: 50, height: 50)
                        .overlay(
                            Image(systemName: "camera.fill")
                                .foregroundColor(RiskmateDesignSystem.Colors.accent)
                        )
                    
                    Text("Photo")
                        .font(RiskmateDesignSystem.Typography.caption)
                        .foregroundColor(RiskmateDesignSystem.Colors.textTertiary)
                }
                
                Image(systemName: "arrow.right")
                    .foregroundColor(RiskmateDesignSystem.Colors.textTertiary)
                
                // Type
                VStack(spacing: RiskmateDesignSystem.Spacing.xs) {
                    RoundedRectangle(cornerRadius: RiskmateDesignSystem.Radius.sm)
                        .fill(RiskmateDesignSystem.Colors.surface)
                        .frame(width: 50, height: 50)
                        .overlay(
                            Image(systemName: "tag.fill")
                                .foregroundColor(RiskmateDesignSystem.Colors.accent)
                        )
                    
                    Text("Type")
                        .font(RiskmateDesignSystem.Typography.caption)
                        .foregroundColor(RiskmateDesignSystem.Colors.textTertiary)
                }
                
                Image(systemName: "arrow.right")
                    .foregroundColor(RiskmateDesignSystem.Colors.textTertiary)
                
                // Anchor
                VStack(spacing: RiskmateDesignSystem.Spacing.xs) {
                    RoundedRectangle(cornerRadius: RiskmateDesignSystem.Radius.sm)
                        .fill(RiskmateDesignSystem.Colors.accent.opacity(0.2))
                        .frame(width: 50, height: 50)
                        .overlay(
                            Image(systemName: "link")
                                .foregroundColor(RiskmateDesignSystem.Colors.accent)
                        )
                    
                    Text("Anchor")
                        .font(RiskmateDesignSystem.Typography.caption)
                        .foregroundColor(RiskmateDesignSystem.Colors.textTertiary)
                }
            }
            
            Text("Automatic ledger entry")
                .font(RiskmateDesignSystem.Typography.caption)
                .foregroundColor(RiskmateDesignSystem.Colors.textTertiary)
                .padding(.top, RiskmateDesignSystem.Spacing.xs)
        }
        .padding(RiskmateDesignSystem.Spacing.lg)
        .background(RiskmateDesignSystem.Colors.surface.opacity(0.5))
        .clipShape(RoundedRectangle(cornerRadius: RiskmateDesignSystem.Radius.md))
    }
}

struct RolesDiagramView: View {
    var body: some View {
        VStack(spacing: RiskmateDesignSystem.Spacing.md) {
            HStack(spacing: RiskmateDesignSystem.Spacing.sm) {
                // Write roles
                VStack(spacing: RiskmateDesignSystem.Spacing.xs) {
                    HStack(spacing: 4) {
                        Image(systemName: "person.fill")
                            .font(.system(size: 12))
                        Image(systemName: "person.fill")
                            .font(.system(size: 12))
                        Image(systemName: "person.fill")
                            .font(.system(size: 12))
                    }
                    .foregroundColor(RiskmateDesignSystem.Colors.accent)
                    
                    Text("Owner, Admin, Worker")
                        .font(RiskmateDesignSystem.Typography.caption)
                        .foregroundColor(RiskmateDesignSystem.Colors.textTertiary)
                        .multilineTextAlignment(.center)
                    
                    Text("Read + Write")
                        .font(RiskmateDesignSystem.Typography.caption2)
                        .foregroundColor(RiskmateDesignSystem.Colors.success)
                        .padding(.top, 2)
                }
                
                Divider()
                    .frame(height: 40)
                
                // Read-only role
                VStack(spacing: RiskmateDesignSystem.Spacing.xs) {
                    Image(systemName: "eye.fill")
                        .font(.system(size: 16))
                        .foregroundColor(RiskmateDesignSystem.Colors.textTertiary)
                    
                    Text("Auditor")
                        .font(RiskmateDesignSystem.Typography.caption)
                        .foregroundColor(RiskmateDesignSystem.Colors.textTertiary)
                    
                    Text("Read Only")
                        .font(RiskmateDesignSystem.Typography.caption2)
                        .foregroundColor(RiskmateDesignSystem.Colors.textTertiary)
                        .padding(.top, 2)
                }
            }
            
            Text("Auditors can view but not modify proofs")
                .font(RiskmateDesignSystem.Typography.caption)
                .foregroundColor(RiskmateDesignSystem.Colors.textTertiary)
                .padding(.top, RiskmateDesignSystem.Spacing.xs)
        }
        .padding(RiskmateDesignSystem.Spacing.lg)
        .background(RiskmateDesignSystem.Colors.surface.opacity(0.5))
        .clipShape(RoundedRectangle(cornerRadius: RiskmateDesignSystem.Radius.md))
    }
}

#Preview {
    TrustOnboardingView(isPresented: .constant(true))
}
