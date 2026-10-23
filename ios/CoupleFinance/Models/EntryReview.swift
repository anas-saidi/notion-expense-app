import Foundation

struct EntryReview: Identifiable {
    var id = UUID()
    var name: String
    var amount: Decimal
    var date: String
    var type: String
    var categoryId = ""
    var accountId = ""
    var draft: TransactionDraft {
        TransactionDraft(id: id, operation: type == "Income" ? "income" : "expense",
            input: NativeInput(name: name, amount: amount, date: date, accountId: accountId,
                categoryId: type == "Income" ? nil : categoryId))
    }
    var isValid: Bool { !name.isEmpty && amount > 0 && !accountId.isEmpty && (type == "Income" || !categoryId.isEmpty) }
}
