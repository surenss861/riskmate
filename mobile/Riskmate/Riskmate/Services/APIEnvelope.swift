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
            if let envelope = try? decoder.decode(APIEnvelope<[String: AnyCodable]>.self, from: data) {
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
struct AnyCodable: Decodable {
    let value: Any
    
    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        
        if let bool = try? container.decode(Bool.self) {
            value = bool
        } else if let int = try? container.decode(Int.self) {
            value = int
        } else if let double = try? container.decode(Double.self) {
            value = double
        } else if let string = try? container.decode(String.self) {
            value = string
        } else if let array = try? container.decode([AnyCodable].self) {
            value = array.map { $0.value }
        } else if let dict = try? container.decode([String: AnyCodable].self) {
            value = dict.mapValues { $0.value }
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "AnyCodable value cannot be decoded")
        }
    }
}
