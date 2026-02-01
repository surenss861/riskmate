import SwiftUI
import UIKit

/// Canonical web app URL for "Open in Web App" actions.
enum WebAppURL {
    static let baseURL: URL = {
        guard let url = URL(string: "https://riskmate.dev") else {
            fatalError("Invalid base URL for web app")
        }
        return url
    }()

    /// URL for a specific job. Use when opening from Job Detail.
    static func jobURL(jobId: String) -> URL {
        baseURL.appendingPathComponent("jobs").appendingPathComponent(jobId)
    }

    /// Opens the web app URL, optionally for a specific job. Shows "Couldn't open link" toast on failure.
    static func openWebApp(jobId: String? = nil) {
        let url = jobId.map { jobURL(jobId: $0) } ?? baseURL
        UIApplication.shared.open(url, options: [:]) { success in
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
