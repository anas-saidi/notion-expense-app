import Foundation

/// Native equivalent of the web spending breakdown, including the partner-to-Joint row.
enum FinanceAnalytics {
    static func spending(_ transactions: [FinanceTransaction], accounts: [FinanceAccount], scope: WalletScope) -> [CategoryTotal] {
        var totals: [String: Decimal] = [:]
        func accountScope(_ id: String?) -> WalletScope? { accounts.first { $0.id == id }?.scope }
        for transaction in transactions {
            let isExpense = transaction.type == "Expense" || transaction.type == nil
            let toJoint: Bool
            if scope == .joint { toJoint = false }
            else if transaction.type == "Transfer" {
                let from = accountScope(transaction.fromAccountId), to = accountScope(transaction.toAccountId)
                toJoint = transaction.fromCategoryId == nil && transaction.toCategoryId == nil && ((from == scope && to == .joint) || (from == .joint && to == scope))
            } else { toJoint = isExpense && accountScope(transaction.accountId) == scope && transaction.scopes.contains(.joint) }
            if !toJoint {
                guard transaction.type != "Transfer", transaction.scopes.contains(scope),
                      isExpense || (transaction.type == "Income" && transaction.category != nil) else { continue }
            }
            let categoryID = toJoint ? "__to_joint__" : transaction.category ?? "__uncategorized__"
            let inflow = transaction.type == "Income" || transaction.amount < 0 || (transaction.type == "Transfer" && accountScope(transaction.toAccountId) != .joint)
            totals[categoryID, default: 0] += inflow ? -abs(transaction.amount) : transaction.amount
        }
        return totals.map { CategoryTotal(categoryId: $0.key, total: $0.value) }.filter { $0.total > 0 }.sorted { $0.total > $1.total }
    }
}
