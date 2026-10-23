import Foundation

enum FinanceError: LocalizedError {
    case message(String)
    case server(Int, String)
    case temporarilyUnavailable(String)
    var errorDescription: String? {
        switch self { case .message(let message), .server(_, let message), .temporarilyUnavailable(let message): message }
    }
    var isRetryable: Bool {
        if case .temporarilyUnavailable = self { return true }
        if case .server(let status, _) = self { return status == 429 || status >= 500 }
        return false
    }
}
