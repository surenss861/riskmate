import SwiftUI

// Lottie is conditionally compiled - remove this file or add Lottie package if needed
// For now, using a simple placeholder that works without Lottie

/// Placeholder animation view (replace with Lottie when package is properly linked)
struct RMLottieView: View {
    let name: String
    let loopMode: LottieLoopMode
    var speed: CGFloat = 1.0
    
    var body: some View {
        ProgressView()
            .tint(RMTheme.Colors.accent)
            .scaleEffect(1.2)
    }
}

/// Loop mode enum (matches Lottie's API when available)
enum LottieLoopMode {
    case loop
    case playOnce
}

// MARK: - Lottie Implementation (Uncomment when package is linked)
/*
import Lottie

struct RMLottieView: UIViewRepresentable {
    let name: String
    let loopMode: LottieLoopMode
    var speed: CGFloat = 1.0
    
    func makeUIView(context: Context) -> UIView {
        let container = UIView()
        let animationView = LottieAnimationView(name: name)
        animationView.loopMode = loopMode == .loop ? .loop : .playOnce
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
*/

#Preview {
    RMLottieView(name: "loading", loopMode: .loop)
        .frame(width: 100, height: 100)
}
