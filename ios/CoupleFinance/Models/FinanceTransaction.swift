import Foundation

struct FinanceTransaction: Codable, Equatable, Identifiable {
    var id: String
    var name: String
    var amount: Decimal
    var date: String
    var category: String?
    var accountId: String?
    var type: String?
    var incomeUse: String?
    var fromAccountId: String?
    var toAccountId: String?
    var fromCategoryId: String?
    var toCategoryId: String?
    var savingsFundingOperation: String?
    var scopes: [WalletScope]
    var pendingSync: Bool?
    var signedAmount: Decimal { type == "Income" ? amount : type == "Transfer" ? amount : -amount }
    var symbol: String { type == "Income" ? "arrow.down.left" : type == "Transfer" ? "arrow.left.arrow.right" : "arrow.up.right" }
}
