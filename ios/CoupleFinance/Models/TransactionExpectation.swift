import Foundation

struct TransactionExpectation: Codable, Equatable {
    var name: String
    var amount: Decimal
    var date: String
    var accountId: String?
    var category: String?
    var incomeUse: String?

    init(_ transaction: FinanceTransaction) {
        name = transaction.name
        amount = transaction.amount
        date = transaction.date
        accountId = transaction.accountId
        category = transaction.category
        incomeUse = transaction.incomeUse
    }
}
