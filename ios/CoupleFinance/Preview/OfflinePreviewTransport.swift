#if DEBUG
import Foundation

/// Isolated UI-test transport: never reads credentials or contacts a server.
struct OfflinePreviewTransport: FinanceTransport {
    func snapshot(month: String) async throws -> FinanceSnapshot { throw URLError(.notConnectedToInternet) }
    func submit(_ draft: TransactionDraft) async throws { throw URLError(.notConnectedToInternet) }
}
#endif
