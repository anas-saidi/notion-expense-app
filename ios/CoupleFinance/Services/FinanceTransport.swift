import Foundation

protocol FinanceTransport: Sendable {
    func snapshot(month: String) async throws -> FinanceSnapshot
    func submit(_ draft: TransactionDraft) async throws
}
