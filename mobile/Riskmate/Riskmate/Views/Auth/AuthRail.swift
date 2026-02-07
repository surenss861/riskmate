import SwiftUI

/// Centered auth rail — centers the card ~45–55% down, scrolls with keyboard.
/// Use for Login + Signup so spacing + centering stay consistent.
struct AuthRail<Content: View>: View {
    let content: Content

    init(@ViewBuilder _ content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        GeometryReader { geo in
            let safeTop = geo.safeAreaInsets.top
            let safeBottom = geo.safeAreaInsets.bottom
            ScrollView(.vertical, showsIndicators: false) {
                VStack(spacing: 0) {
                    Spacer(minLength: 44)
                    content
                    Spacer(minLength: 0)
                }
                .frame(minHeight: geo.size.height - safeTop - safeBottom)
                .padding(.horizontal, 20)
                .padding(.top, 8)
                .padding(.bottom, 24)
            }
        }
    }
}
