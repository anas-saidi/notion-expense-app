import Foundation

struct TransactionDraft: Codable, Equatable, Identifiable {
    var id = UUID()
    var operation = "expense"
    var input = NativeInput()
    var outcomeUnknown = false
    var createdAt = Date.now
    var syncQueuedAt: Date?
    var syncState: DraftSyncState?
    var syncError: String?
    var originalTransaction: FinanceTransaction?
    var title: String { input.name ?? input.note ?? "Transaction" }
}
