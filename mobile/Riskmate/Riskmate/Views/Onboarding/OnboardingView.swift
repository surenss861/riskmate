import SwiftUI

/// First-run onboarding flow (3 screens)
struct OnboardingView: View {
    @Binding var isPresented: Bool
    @State private var currentPage = 0
    @State private var selectedRole: UserRole?
    
    let pages = [
        OnboardingPage(
            title: "Protect Every Job Before It Starts",
            description: "Riskmate helps contractors document hazards, controls, and evidence to create audit-ready proof packs.",
            icon: "shield.checkered",
            color: .orange
        ),
        OnboardingPage(
            title: "Works Offline. Syncs When You're Back.",
            description: "Capture evidence in the field, even without internet. Everything syncs automatically when you're connected.",
            icon: "wifi.slash",
            color: .blue
        ),
        OnboardingPage(
            title: "Generate Audit-Ready Proof Packs in 1 Tap",
            description: "Export complete documentation packages with ledger verification, controls, and evidence—ready for insurers and auditors.",
            icon: "doc.badge.plus",
            color: .green
        )
    ]
    
    var body: some View {
        ZStack {
            RMBackground()
            
            VStack(spacing: 0) {
                // Page Content
                TabView(selection: $currentPage) {
                    ForEach(0..<pages.count, id: \.self) { index in
                        OnboardingPageView(page: pages[index])
                            .tag(index)
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .always))
                .indexViewStyle(.page(backgroundDisplayMode: .always))
                
                // Role Selection (on last page)
                if currentPage == pages.count - 1 {
                    VStack(spacing: RMTheme.Spacing.md) {
                        Text("What's your role?")
                            .font(RMTheme.Typography.headingSmall)
                            .foregroundColor(RMTheme.Colors.textPrimary)
                            .padding(.top, RMTheme.Spacing.lg)
                        
                        RoleSelectionGrid(selectedRole: $selectedRole)
                            .padding(.horizontal, RMTheme.Spacing.pagePadding)
                    }
                    .padding(.bottom, RMTheme.Spacing.xl)
                }
                
                // Navigation Buttons
                HStack(spacing: RMTheme.Spacing.md) {
                    if currentPage > 0 {
                        Button {
                            withAnimation {
                                currentPage -= 1
                            }
                        } label: {
                            Text("Back")
                                .font(RMTheme.Typography.bodySmallBold)
                                .foregroundColor(RMTheme.Colors.textSecondary)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, RMTheme.Spacing.sm)
                                .background(RMTheme.Colors.surface.opacity(0.5))
                                .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm))
                        }
                    }
                    
                    Button {
                        if currentPage < pages.count - 1 {
                            withAnimation {
                                currentPage += 1
                            }
                        } else {
                            // Complete onboarding
                            completeOnboarding()
                        }
                    } label: {
                        Text(currentPage < pages.count - 1 ? "Next" : "Get Started")
                            .font(RMTheme.Typography.bodySmallBold)
                            .foregroundColor(.black)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, RMTheme.Spacing.sm)
                            .background(RMTheme.Colors.accent)
                            .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm))
                    }
                }
                .padding(.horizontal, RMTheme.Spacing.pagePadding)
                .padding(.bottom, RMTheme.Spacing.lg)
            }
        }
        .preferredColorScheme(.dark)
    }
    
    private func completeOnboarding() {
        // Save role selection
        if let role = selectedRole {
            UserDefaults.standard.set(role.rawValue, forKey: "user_role")
        }
        
        // Mark onboarding as complete
        UserDefaults.standard.set(true, forKey: "onboarding_complete")
        
        withAnimation {
            isPresented = false
        }
    }
}

struct OnboardingPage {
    let title: String
    let description: String
    let icon: String
    let color: Color
}

struct OnboardingPageView: View {
    let page: OnboardingPage
    
    var body: some View {
        VStack(spacing: RMTheme.Spacing.xl) {
            Spacer()
            
            // Icon
            Image(systemName: page.icon)
                .font(.system(size: 80))
                .foregroundColor(page.color)
                .padding(.bottom, RMTheme.Spacing.lg)
            
            // Title
            Text(page.title)
                .font(RMTheme.Typography.headingLarge)
                .foregroundColor(RMTheme.Colors.textPrimary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, RMTheme.Spacing.pagePadding)
            
            // Description
            Text(page.description)
                .font(RMTheme.Typography.body)
                .foregroundColor(RMTheme.Colors.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, RMTheme.Spacing.pagePadding)
            
            Spacer()
        }
    }
}

enum UserRole: String, CaseIterable {
    case owner = "owner"
    case admin = "admin"
    case safetyLead = "safety_lead"
    case executive = "executive"
    case member = "member"
    
    var displayName: String {
        switch self {
        case .owner: return "Owner"
        case .admin: return "Admin"
        case .safetyLead: return "Safety Lead"
        case .executive: return "Executive"
        case .member: return "Member"
        }
    }
    
    var icon: String {
        switch self {
        case .owner: return "crown.fill"
        case .admin: return "person.badge.key.fill"
        case .safetyLead: return "shield.fill"
        case .executive: return "chart.line.uptrend.xyaxis"
        case .member: return "person.fill"
        }
    }
}

struct RoleSelectionGrid: View {
    @Binding var selectedRole: UserRole?
    
    let columns = [
        GridItem(.flexible()),
        GridItem(.flexible())
    ]
    
    var body: some View {
        LazyVGrid(columns: columns, spacing: RMTheme.Spacing.md) {
            ForEach(UserRole.allCases, id: \.self) { role in
                RoleButton(role: role, isSelected: selectedRole == role) {
                    selectedRole = role
                }
            }
        }
    }
}

struct RoleButton: View {
    let role: UserRole
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            VStack(spacing: RMTheme.Spacing.sm) {
                Image(systemName: role.icon)
                    .font(.system(size: 32))
                    .foregroundColor(isSelected ? .black : RMTheme.Colors.textPrimary)
                
                Text(role.displayName)
                    .font(RMTheme.Typography.bodySmall)
                    .foregroundColor(isSelected ? .black : RMTheme.Colors.textPrimary)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, RMTheme.Spacing.md)
            .background(
                isSelected ? RMTheme.Colors.accent : RMTheme.Colors.surface.opacity(0.5)
            )
            .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm))
            .overlay(
                RoundedRectangle(cornerRadius: RMTheme.Radius.sm)
                    .stroke(isSelected ? RMTheme.Colors.accent : Color.clear, lineWidth: 2)
            )
        }
    }
}
