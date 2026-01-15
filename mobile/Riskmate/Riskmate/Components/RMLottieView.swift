import SwiftUI
import Lottie

/// Lottie animation wrapper for SwiftUI
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

/// Loop mode enum
enum LottieLoopMode {
    case loop
    case playOnce
}

#Preview {
    RMLottieView(name: "loading", loopMode: .loop)
        .frame(width: 100, height: 100)
}
