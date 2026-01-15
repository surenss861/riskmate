import SwiftUI
#if canImport(RiveRuntime)
import RiveRuntime
#endif

/// Rive animation wrapper for SwiftUI
struct RMRiveView: View {
    let resourceName: String
    var autoPlay: Bool = true
    
    var body: some View {
        #if canImport(RiveRuntime)
        // RiveRuntime integration - placeholder until package is properly configured
        // TODO: Implement with RiveViewModel once RiveRuntime v2+ is confirmed
        Rectangle()
            .fill(RMTheme.Colors.inputFill)
            .overlay(
                Text("Rive: \(resourceName)")
                    .foregroundColor(RMTheme.Colors.textSecondary)
            )
        #else
        Rectangle()
            .fill(RMTheme.Colors.inputFill)
            .overlay(
                Text("RiveRuntime not available")
                    .foregroundColor(RMTheme.Colors.textSecondary)
            )
        #endif
    }
}

#Preview {
    RMRiveView(resourceName: "animation")
        .frame(width: 200, height: 200)
}
