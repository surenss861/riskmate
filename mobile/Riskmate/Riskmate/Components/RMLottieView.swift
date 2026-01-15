import SwiftUI

// Lottie import is conditional - package must be added via SPM
#if canImport(Lottie)
@preconcurrency import Lottie

/// Lottie animation wrapper for SwiftUI
struct RMLottieView: UIViewRepresentable {
    let name: String
    let loopMode: LottieLoopMode
    var speed: CGFloat = 1.0
    
    func makeUIView(context: Context) -> UIView {
        let container = UIView()
        let animationView = LottieAnimationView(name: name)
        animationView.loopMode = loopMode
        animationView.animationSpeed = speed
        animationView.play()
        animationView.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(animationView)
        
        NSLayoutConstraint.activate([
            animationView.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            animationView.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            animationView.topAnchor.constraint(equalTo: container.topAnchor),
            animationView.bottomAnchor.constraint(equalTo: container.bottomAnchor),
        ])
        
        return container
    }
    
    func updateUIView(_ uiView: UIView, context: Context) {
        // Animation updates automatically
    }
}
#else
/// Placeholder when Lottie is not available
struct RMLottieView: View {
    let name: String
    let loopMode: LottieLoopMode
    var speed: CGFloat = 1.0
    
    var body: some View {
        ProgressView()
            .tint(DesignSystem.Colors.accent)
    }
}

/// Dummy type for when Lottie isn't available
enum LottieLoopMode {
    case loop
    case playOnce
}
#endif

#Preview {
    RMLottieView(name: "loading", loopMode: .loop)
        .frame(width: 100, height: 100)
}
