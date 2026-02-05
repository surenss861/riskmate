import SwiftUI

// MARK: - Riskmate Hero Palette (matches web hero)
private enum RMHeroColors {
    static let bg0 = Color(red: 0.03, green: 0.03, blue: 0.03)
    static let bg1 = Color(red: 0, green: 0, blue: 0)
    static let text = Color.white.opacity(0.95)
    static let subtext = Color.white.opacity(0.62)
    static let border = Color.white.opacity(0.10)
    static let orange = Color(hex: "#F97316")
    static let orangeHighlight = Color.white.opacity(0.22)
    static let orangeShadow = Color(hex: "#F97316").opacity(0.35)
}

// MARK: - Auth Hero Shell (editorial hero + compact card + bottom utility)
/// Top-aligned hero (wordmark + headline + pill), compact glass form, bottom links.
struct AuthHeroShell<Content: View, BottomContent: View>: View {
    let title: String
    let subtitle: String
    let pillText: String
    let content: Content
    let bottomUtility: BottomContent

    @State private var glowPhase: CGFloat = 0
    @State private var glowPhaseSlow: CGFloat = 0

    init(
        title: String,
        subtitle: String,
        pillText: String = "Ledger Contract v1.0 • Frozen",
        @ViewBuilder content: () -> Content,
        @ViewBuilder bottomUtility: () -> BottomContent
    ) {
        self.title = title
        self.subtitle = subtitle
        self.pillText = pillText
        self.content = content()
        self.bottomUtility = bottomUtility()
    }

    var body: some View {
        ZStack {
            RiskmateHeroBackground(glowPhase: glowPhase, glowPhaseSlow: glowPhaseSlow)
                .ignoresSafeArea()

            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 18) {
                    heroRegion
                    compactCard
                }
                .padding(.horizontal, 20)
                .padding(.top, 12)
                .padding(.bottom, 100)
            }
            .safeAreaInset(edge: .bottom, spacing: 0) {
                bottomUtility
                    .padding(.horizontal, 20)
                    .padding(.top, 12)
                    .padding(.bottom, 8)
                    .background(Color.black.opacity(0.4))
                // Subtle top edge so it doesn’t float
            }
        }
        .preferredColorScheme(.dark)
        .onAppear {
            withAnimation(.easeInOut(duration: 4.5).repeatForever(autoreverses: true)) {
                glowPhase = 1
            }
            withAnimation(.easeInOut(duration: 9).repeatForever(autoreverses: true)) {
                glowPhaseSlow = 1
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Sign in or create account")
    }

    private var heroRegion: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Riskmate")
                .font(.system(size: 15, weight: .semibold, design: .default))
                .foregroundColor(RMHeroColors.subtext)
                .tracking(0.6)

            Text(title)
                .font(.system(size: 36, weight: .bold, design: .serif))
                .foregroundColor(RMHeroColors.text)
                .lineLimit(2)
                .lineSpacing(-2)
                .tracking(-0.5)
                .shadow(color: Color.black.opacity(0.4), radius: 6, x: 0, y: 2)
                .shadow(color: Color.black.opacity(0.2), radius: 2, x: 0, y: 1)

            Text(subtitle)
                .font(.system(size: 15, weight: .regular, design: .default))
                .foregroundColor(RMHeroColors.subtext)
                .lineSpacing(2)
                .fixedSize(horizontal: false, vertical: true)

            HStack(spacing: 5) {
                Text(pillText)
                    .font(.system(size: 11, weight: .medium, design: .monospaced))
                    .foregroundColor(Color.white.opacity(0.85))
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(
                RoundedRectangle(cornerRadius: 999)
                    .fill(Color.white.opacity(0.07))
                    .overlay(
                        RoundedRectangle(cornerRadius: 999)
                            .stroke(Color.white.opacity(0.12), lineWidth: 1)
                    )
            )
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var compactCard: some View {
        AuthHeroGlassCard {
            content
        }
        .padding(.top, 4)
    }
}

// MARK: - Hero Background (glow + vignette + noise + grid)
struct RiskmateHeroBackground: View {
    let glowPhase: CGFloat
    var glowPhaseSlow: CGFloat = 0

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [RMHeroColors.bg1, RMHeroColors.bg0, RMHeroColors.bg1],
                startPoint: .top,
                endPoint: .bottom
            )

            RadialGradient(
                colors: [
                    RMHeroColors.orange.opacity(0.22 + 0.10 * glowPhase),
                    Color.clear
                ],
                center: .top,
                startRadius: 40,
                endRadius: 420
            )
            .blendMode(.screen)
            .opacity(0.75)

            RadialGradient(
                colors: [
                    RMHeroColors.orange.opacity(0.06 + 0.03 * glowPhaseSlow),
                    Color.clear
                ],
                center: UnitPoint(x: 0.5, y: 0.35),
                startRadius: 80,
                endRadius: 380
            )
            .blendMode(.screen)
            .opacity(0.9)

            Rectangle()
                .fill(
                    RadialGradient(
                        colors: [Color.clear, Color.black.opacity(0.78)],
                        center: .center,
                        startRadius: 120,
                        endRadius: 520
                    )
                )
                .allowsHitTesting(false)

            AuthGridOverlay()
                .allowsHitTesting(false)

            AuthNoiseOverlay()
                .opacity(0.06)
                .blendMode(.overlay)
                .allowsHitTesting(false)
        }
    }
}

// MARK: - Faint grid (industrial layer)
struct AuthGridOverlay: View {
    private let step: CGFloat = 24

    var body: some View {
        Canvas { context, size in
            context.stroke(
                Path { path in
                    var x: CGFloat = 0
                    while x <= size.width + step {
                        path.move(to: CGPoint(x: x, y: 0))
                        path.addLine(to: CGPoint(x: x, y: size.height))
                        x += step
                    }
                    var y: CGFloat = 0
                    while y <= size.height + step {
                        path.move(to: CGPoint(x: 0, y: y))
                        path.addLine(to: CGPoint(x: size.width, y: y))
                        y += step
                    }
                },
                with: .color(Color.white.opacity(0.03)),
                lineWidth: 0.5
            )
        }
    }
}

// MARK: - Noise Overlay
struct AuthNoiseOverlay: View {
    var body: some View {
        Canvas { context, size in
            let count = 1400
            for _ in 0..<count {
                let x = CGFloat.random(in: 0...size.width)
                let y = CGFloat.random(in: 0...size.height)
                let r = CGFloat.random(in: 0.5...1.4)
                let a = CGFloat.random(in: 0.02...0.08)
                context.fill(
                    Path(ellipseIn: CGRect(x: x, y: y, width: r, height: r)),
                    with: .color(Color.white.opacity(a))
                )
            }
        }
    }
}

// MARK: - Compact Glass Card (smaller radius, top bevel)
private enum AuthHeroGlassCardLayout {
    static let cardRadius: CGFloat = 14
}

struct AuthHeroGlassCard<Content: View>: View {
    let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        let radius = AuthHeroGlassCardLayout.cardRadius
        VStack(alignment: .leading, spacing: 12) {
            content
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: radius))
        .overlay(
            RoundedRectangle(cornerRadius: radius)
                .stroke(RMTheme.Colors.border, lineWidth: 1)
        )
        .overlay(
            RoundedRectangle(cornerRadius: radius - 1)
                .stroke(Color.white.opacity(0.08), lineWidth: 1)
                .padding(1)
        )
        .overlay(
            RoundedRectangle(cornerRadius: radius)
                .stroke(
                    LinearGradient(
                        colors: [Color.white.opacity(0.12), Color.clear],
                        startPoint: .top,
                        endPoint: .center
                    ),
                    lineWidth: 1
                )
                .padding(1)
                .clipShape(RoundedRectangle(cornerRadius: radius - 0.5))
        )
        .shadow(color: Color.black.opacity(0.4), radius: 14, x: 0, y: 6)
    }
}

// MARK: - Primary CTA Button (orange + arrow, for use inside card)
struct AuthPrimaryCTA: View {
    let title: String
    var isLoading: Bool = false
    var isDisabled: Bool = false
    let action: () -> Void

    @State private var pressed = false

    private static let orange = Color(hex: "#F97316")
    private static let orangeHighlight = Color.white.opacity(0.22)
    private static let orangeShadow = Color(hex: "#F97316").opacity(0.35)

    var body: some View {
        Button(action: {
            guard !(isDisabled || isLoading) else { return }
            Haptics.impact()
            action()
        }) {
            HStack(spacing: 8) {
                if isLoading {
                    ProgressView()
                        .tint(.black)
                        .scaleEffect(0.9)
                    Text("Signing in...")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundColor(.black)
                        .opacity(0.8)
                } else {
                    Text(title)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundColor(.black)
                    Image(systemName: "arrow.right")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(.black)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(
                ZStack {
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Self.orange)
                    RoundedRectangle(cornerRadius: 12)
                        .fill(
                            LinearGradient(
                                colors: [Self.orangeHighlight, Color.clear],
                                startPoint: .top,
                                endPoint: .center
                            )
                        )
                        .padding(1)
                        .clipShape(RoundedRectangle(cornerRadius: 11))
                }
                .shadow(color: Self.orangeShadow, radius: 12, x: 0, y: 4)
            )
            .scaleEffect(pressed ? 0.97 : 1.0)
        }
        .buttonStyle(.plain)
        .disabled(isDisabled || isLoading)
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in pressed = true }
                .onEnded { _ in pressed = false }
        )
    }
}

#Preview("Auth Hero Shell") {
    AuthHeroShell(
        title: "Audit-ready proof packs.",
        subtitle: "Secure access to your compliance ledger.",
        pillText: "Ledger Contract v1.0 • Frozen",
        content: {
            VStack(alignment: .leading, spacing: 12) {
                Text("Email and password fields here")
                    .font(.caption)
                    .foregroundColor(RMTheme.Colors.textSecondary)
                AuthPrimaryCTA(title: "Sign In", action: {})
            }
        },
        bottomUtility: {
            HStack {
                Text("Don't have an account?")
                    .foregroundColor(RMTheme.Colors.textSecondary)
                    .font(RMTheme.Typography.body)
                Button("Sign up") {}
                    .foregroundColor(RMTheme.Colors.accent)
                    .font(RMTheme.Typography.bodyBold)
                Spacer()
                Button("Need help?") {}
                    .font(.caption)
                    .foregroundColor(RMTheme.Colors.textTertiary)
            }
        }
    )
}
