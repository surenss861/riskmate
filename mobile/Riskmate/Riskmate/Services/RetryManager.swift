import Foundation

/// Smart retry manager with exponential backoff and error-aware retry logic
struct RetryManager {
    static func shouldRetry(error: Error, attempt: Int, maxAttempts: Int = 3) -> Bool {
        guard attempt < maxAttempts else { return false }
        
        // Don't retry auth errors (401/403) - force re-auth
        if let apiError = error as? APIError {
            switch apiError {
            case .httpError(let statusCode, _):
                if statusCode == 401 || statusCode == 403 {
                    return false // Force re-authentication
                }
                // Retry 5xx and timeouts
                if statusCode >= 500 || statusCode == 408 {
                    return true
                }
            default:
                break
            }
        }
        
        // Retry network errors and timeouts
        let nsError = error as NSError
        if nsError.domain == NSURLErrorDomain {
            switch nsError.code {
            case NSURLErrorTimedOut,
                 NSURLErrorNetworkConnectionLost,
                 NSURLErrorNotConnectedToInternet,
                 NSURLErrorCannotConnectToHost:
                return true
            default:
                return false
            }
        }
        
        return false
    }
    
    static func delayForAttempt(_ attempt: Int) -> TimeInterval {
        // Exponential backoff: 1s → 3s → 10s
        switch attempt {
        case 1: return 1.0
        case 2: return 3.0
        case 3: return 10.0
        default: return 10.0
        }
    }
    
    static func retry<T>(
        maxAttempts: Int = 3,
        operation: @escaping () async throws -> T
    ) async throws -> T {
        var lastError: Error?
        
        for attempt in 1...maxAttempts {
            do {
                return try await operation()
            } catch {
                lastError = error
                
                if !shouldRetry(error: error, attempt: attempt, maxAttempts: maxAttempts) {
                    throw error
                }
                
                if attempt < maxAttempts {
                    let delay = delayForAttempt(attempt)
                    try await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
                }
            }
        }
        
        throw lastError ?? NSError(domain: "RetryManager", code: -1, userInfo: [NSLocalizedDescriptionKey: "Max retries exceeded"])
    }
}
