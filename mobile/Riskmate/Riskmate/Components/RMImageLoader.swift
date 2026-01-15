import SwiftUI
import Kingfisher

/// Image loader using Kingfisher for async loading and caching
struct RMImageLoader: View {
    let url: URL?
    var placeholder: AnyView?
    var contentMode: SwiftUI.ContentMode = .fill
    
    init(url: URL?, placeholder: AnyView? = nil, contentMode: SwiftUI.ContentMode = .fill) {
        self.url = url
        self.placeholder = placeholder
        self.contentMode = contentMode
    }
    
    var body: some View {
        if let url = url {
            KFImage(url)
                .placeholder {
                    placeholder ?? AnyView(
                        ProgressView()
                            .tint(RMTheme.Colors.accent)
                    )
                }
                .resizable()
                .aspectRatio(contentMode: contentMode)
        } else {
            placeholder ?? AnyView(
                Rectangle()
                    .fill(RMTheme.Colors.inputFill)
            )
        }
    }
}

/// Convenience initializer for String URLs
extension RMImageLoader {
    init(urlString: String?, placeholder: AnyView? = nil, contentMode: SwiftUI.ContentMode = .fill) {
        if let urlString = urlString, let url = URL(string: urlString) {
            self.init(url: url, placeholder: placeholder, contentMode: contentMode)
        } else {
            self.init(url: nil, placeholder: placeholder, contentMode: contentMode)
        }
    }
}

#Preview {
    RMImageLoader(
        urlString: "https://picsum.photos/200",
        contentMode: SwiftUI.ContentMode.fill
    )
    .frame(width: 200, height: 200)
    .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.md))
}
