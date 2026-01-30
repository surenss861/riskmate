import Foundation

/// Export audit events as JSON or CSV for sharing / compliance.
enum AuditExporter {
    static func exportJSON(events: [AuditEvent]) throws -> URL {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(events)
        let filename = "riskmate-audit-\(isoDate()).json"
        return try writeTempFile(data: data, filename: filename)
    }

    static func exportCSV(events: [AuditEvent]) throws -> URL {
        let header = "proof_id,event_summary,category,actor,timestamp_iso,details"
        var lines = [header]
        let formatter = ISO8601DateFormatter()
        for event in events {
            lines.append([
                event.id.csvEscaped,
                event.summary.csvEscaped,
                event.category.csvEscaped,
                event.actor.csvEscaped,
                formatter.string(from: event.timestamp).csvEscaped,
                event.details.csvEscaped,
            ].joined(separator: ","))
        }
        let csvString = lines.joined(separator: "\n")
        guard let data = csvString.data(using: .utf8) else {
            throw AuditExportError.encodingFailed
        }
        let filename = "riskmate-audit-\(isoDate()).csv"
        return try writeTempFile(data: data, filename: filename)
    }

    private static func isoDate() -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withFullDate, .withTime]
        return formatter.string(from: Date()).replacingOccurrences(of: ":", with: "-")
    }

    private static func writeTempFile(data: Data, filename: String) throws -> URL {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(filename)
        try data.write(to: url, options: .atomic)
        return url
    }
}

enum AuditExportError: Error {
    case encodingFailed
}

private extension String {
    var csvEscaped: String {
        if contains(",") || contains("\"") || contains("\n") {
            return "\"\(replacingOccurrences(of: "\"", with: "\"\""))\""
        }
        return self
    }
}
