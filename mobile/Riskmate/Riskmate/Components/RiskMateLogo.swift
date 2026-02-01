import SwiftUI

struct RiskmateLogo: View {
    var size: LogoSize = .large
    var showText: Bool = true
    
    enum LogoSize {
        case small, medium, large
        
        var fontSize: CGFloat {
            switch self {
            case .small: return 16
            case .medium: return 20
            case .large: return 28
            }
        }
    }
    
    var body: some View {
        if showText {
            Text("Riskmate")
                .font(.system(size: size.fontSize, weight: .bold, design: .default))
                .foregroundStyle(
                    LinearGradient(
                        colors: [
                            Color(hex: "F97316"),
                            Color(hex: "FF8A00")
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
        }
    }
}

#Preview {
    VStack(spacing: 20) {
        RiskmateLogo(size: .small)
        RiskmateLogo(size: .medium)
        RiskmateLogo(size: .large)
    }
    .padding()
    .background(DesignSystem.Colors.background)
}
