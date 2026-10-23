import Foundation

struct TransactionDraft: Codable, Equatable, Identifiable {
    var id = UUID()
    var operation = "expense"
    var input = NativeInput()
    var outcomeUnknown = false
    var createdAt = Date.now
    var title: String { input.name ?? input.note ?? "Transaction" }
}
