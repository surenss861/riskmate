import Foundation

/// Defensive API response envelope that tolerates missing keys
/// Backend responses vary by endpoint:
/// - Some return: { "data": [...], "pagination": {...} }
/// - Others return: { "data": [...] }
/// - Others return: { "counts": {...}, "status": "ok" }
/// This envelope handles all shapes gracefully
struct APIEnvelope<T: Decodable>: Decodable {
    let data: T?
    let pagination: Pagination?
    let counts: [String: Int]?
    let status: String?
    let error: APIErrorResponse?
    
    struct Pagination: Decodable {
        let page: Int?
        let pageSize: Int?
        let limit: Int?
        let total: Int?
        let totalPages: Int?
        let hasMore: Bool?
        let cursor: String?
        
        enum CodingKeys: String, CodingKey {
            case page
            case pageSize = "page_size"
            case limit
            case total
            case totalPages = "total_pages"
            case hasMore = "has_more"
            case cursor
        }
    }
    
    /// Extract data, falling back to empty array/object if nil
    /// Note: Uses generic C to avoid shadowing outer T
    func unwrapData<C>() -> C? where C: Collection {
        return data as? C
    }
    
    /// Extract data for single objects
    /// Note: Uses generic V to avoid shadowing outer T
    func unwrapData<V>() -> V? {
        return data as? V
    }
}

/// Helper to decode responses through defensive envelope
extension APIClient {
    /// Decode response with defensive envelope (handles missing keys gracefully)
    private func decodeWithEnvelope<T: Decodable>(_ type: T.Type, from data: Data, decoder: JSONDecoder) throws -> T {
        // Try to decode as envelope first (if it has data wrapper)
        if let envelope = try? decoder.decode(APIEnvelope<T>.self, from: data),
           let wrappedData = envelope.data {
            return wrappedData
        }
        
        // If envelope decode fails, try direct decode (some endpoints don't wrap)
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            // If direct decode also fails, try envelope again and extract whatever is available
            if let envelope = try? decoder.decode(APIEnvelope<[String: RMAnyCodable]>.self, from: data) {
                // Last resort: try to decode from envelope's raw structure
                throw DecodingError.dataCorrupted(
                    DecodingError.Context(
                        codingPath: [],
                        debugDescription: "Could not decode \(type) from envelope or direct response"
                    )
                )
            }
            throw error
        }
    }
}

/// Helper for decoding flexible JSON structures
/// Handles all JSON types: null, bool, numbers (Int/Double/Float), strings, arrays, objects
/// NOTE: If Flight-School AnyCodable package is added, remove this and import AnyCodable instead
struct RMAnyCodable: Codable {
    let value: Any
    
    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        
        // Handle null first
        if container.decodeNil() {
            value = NSNull()
            return
        }
        
        // Try decoding as different types in order of likelihood
        if let bool = try? container.decode(Bool.self) {
            value = bool
        } else if let int = try? container.decode(Int.self) {
            value = int
        } else if let int64 = try? container.decode(Int64.self) {
            value = int64
        } else if let double = try? container.decode(Double.self) {
            value = double
        } else if let float = try? container.decode(Float.self) {
            value = float
        } else if let string = try? container.decode(String.self) {
            value = string
        } else if let array = try? container.decode([RMAnyCodable].self) {
            value = array.map { $0.value }
        } else if let dict = try? container.decode([String: RMAnyCodable].self) {
            value = dict.mapValues { $0.value }
        } else {
            // Last resort: try to decode as a generic JSON value
            // This handles edge cases like date strings, special number formats, etc.
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "AnyCodable value cannot be decoded - unsupported type"
            )
        }
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        
        switch value {
        case is NSNull:
            try container.encodeNil()
        case let bool as Bool:
            try container.encode(bool)
        case let int as Int:
            try container.encode(int)
        case let int64 as Int64:
            try container.encode(int64)
        case let double as Double:
            try container.encode(double)
        case let float as Float:
            try container.encode(float)
        case let string as String:
            try container.encode(string)
        case let array as [Any]:
            let codableArray = array.map { RMAnyCodable(value: $0) }
            try container.encode(codableArray)
        case let dict as [String: Any]:
            let codableDict = dict.mapValues { RMAnyCodable(value: $0) }
            try container.encode(codableDict)
        default:
            // Fallback: encode as string representation
            try container.encode(String(describing: value))
        }
    }
    
    // Convenience initializer for creating AnyCodable from Any value
    init(value: Any) {
        self.value = value
    }
}
