import Foundation

/// User-facing messages for export failures (backend DATABASE_ERROR / 500 get friendly copy).
enum ExportErrorMessages {
    static func friendlyMessage(for error: Error) -> String {
        let desc = error.localizedDescription
        if desc.contains("DATABASE_ERROR") || (desc.contains("500") && desc.lowercased().contains("create export")) {
            return "Export system is temporarily unavailable. Please try again in a few minutes or contact support."
        }
        if desc.contains("500") || desc.lowercased().contains("internal server") {
            return "Server error creating export. Our team has been notified."
        }
        return desc
    }
}
