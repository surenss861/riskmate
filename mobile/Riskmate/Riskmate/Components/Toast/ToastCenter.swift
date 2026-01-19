import SwiftUI
import Combine

/// Global toast notification center - Apple-style system toasts
@MainActor
final class ToastCenter: ObservableObject {
    static let shared = ToastCenter()
    
    @Published var currentToast: Toast?
    
    private init() {}
    
    func show(_ message: String, systemImage: String = "checkmark.circle", style: ToastStyle = .success, duration: TimeInterval = 2.0) {
        currentToast = Toast(
            message: message,
            systemImage: systemImage,
            style: style,
            duration: duration
        )
        
        // Auto-dismiss
        Task {
            try? await Task.sleep(nanoseconds: UInt64(duration * 1_000_000_000))
            if currentToast?.id == currentToast?.id {
                currentToast = nil
            }
        }
    }
    
    func dismiss() {
        currentToast = nil
    }
}

struct Toast: Identifiable {
    let id = UUID()
    let message: String
    let systemImage: String
    let style: ToastStyle
    let duration: TimeInterval
}

enum ToastStyle {
    case success
    case warning
    case error
    case info
    
    var color: Color {
        switch self {
        case .success: return RMSystemTheme.Colors.success
        case .warning: return RMSystemTheme.Colors.warning
        case .error: return RMSystemTheme.Colors.error
        case .info: return RMSystemTheme.Colors.info
        }
    }
}
