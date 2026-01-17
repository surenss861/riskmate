import Foundation

/// JWT expiration checking - SDK-independent by decoding JWT payload
enum JWTExpiry {
    /// Check if JWT is expired by decoding the `exp` claim
    /// - Parameters:
    ///   - jwt: The JWT token string
    ///   - leewaySeconds: Grace period in seconds (default 30s) to account for clock skew
    /// - Returns: `true` if expired, `false` if valid
    static func isExpired(_ jwt: String, leewaySeconds: TimeInterval = 30) -> Bool {
        let parts = jwt.split(separator: ".")
        guard parts.count == 3 else { return true }

        func base64UrlDecode(_ str: Substring) -> Data? {
            var s = String(str)
                .replacingOccurrences(of: "-", with: "+")
                .replacingOccurrences(of: "_", with: "/")
            while s.count % 4 != 0 { s += "=" }
            return Data(base64Encoded: s)
        }

        guard
            let payloadData = base64UrlDecode(parts[1]),
            let payloadObj = try? JSONSerialization.jsonObject(with: payloadData) as? [String: Any],
            let exp = payloadObj["exp"] as? TimeInterval
        else {
            return true
        }

        let expiry = Date(timeIntervalSince1970: exp)
        return expiry <= Date().addingTimeInterval(leewaySeconds)
    }
}
