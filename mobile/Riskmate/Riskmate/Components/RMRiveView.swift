import SwiftUI
import RiveRuntime

/// Rive animation wrapper for SwiftUI
struct RMRiveView: UIViewRepresentable {
    let resourceName: String
    var autoPlay: Bool = true
    var fit: RiveFit = .contain
    
    func makeUIView(context: Context) -> RiveView {
        guard let url = Bundle.main.url(forResource: resourceName, withExtension: "riv") else {
            return RiveView()
        }
        
        let riveView = RiveView()
        riveView.fit = fit
        
        if autoPlay {
            riveView.play()
        }
        
        return riveView
    }
    
    func updateUIView(_ riveView: RiveView, context: Context) {
        // Updates handled automatically
    }
}

#Preview {
    RMRiveView(resourceName: "animation")
        .frame(width: 200, height: 200)
}
