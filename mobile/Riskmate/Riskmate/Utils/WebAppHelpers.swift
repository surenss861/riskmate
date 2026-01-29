import SwiftUI
import UIKit

/// Canonical web app URL for "Open in Web App" actions.
enum WebAppURL {
    static let appURL = URL(string: "https://app.riskmate.com")!

    /// Opens the web app URL. Shows "Couldn't open link" toast on failure.
    /// Uses completion handler so the toast is always dispatched on main; avoids background-thread UI updates.
    static func openWebApp() {
        UIApplication.shared.open(appURL, options: [:]) { success in
            guard !success else { return }
            DispatchQueue.main.async {
                ToastCenter.shared.show(
                    "Couldn't open link",
                    systemImage: "exclamationmark.triangle",
                    style: .error
                )
            }
        }
    }
}
