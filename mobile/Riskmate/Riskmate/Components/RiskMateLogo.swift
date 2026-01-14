import SwiftUI

struct RiskMateLogo: View {
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
            Text("RiskMate")
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
        RiskMateLogo(size: .small)
        RiskMateLogo(size: .medium)
        RiskMateLogo(size: .large)
    }
    .padding()
    .background(DesignSystem.Colors.background)
}
