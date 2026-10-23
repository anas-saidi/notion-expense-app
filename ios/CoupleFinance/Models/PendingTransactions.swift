import Foundation

/// Cached balances stay authoritative. Project editable rows without persisting
/// fictional server records or applying a successful operation twice.
enum PendingTransactions {
    static func project(_ original: FinanceSnapshot, drafts: [TransactionDraft]) -> FinanceSnapshot {
        var snapshot = original
        for draft in drafts where draft.syncState == .queued || draft.syncState == .awaitingRefresh {
            let input = draft.input
            switch draft.operation {
            case "expense", "income", "transfer":
                guard input.date?.hasPrefix(snapshot.month) == true else { continue }
                snapshot.transactions.append(FinanceTransaction(id: draft.id.uuidString, name: draft.title, amount: input.amount ?? 0,
                    date: input.date ?? "", category: input.categoryId, accountId: input.accountId,
                    type: draft.operation == "expense" ? "Expense" : draft.operation == "income" ? "Income" : "Transfer",
                    incomeUse: input.incomeUse, fromAccountId: input.fromAccountId, toAccountId: input.toAccountId,
                    scopes: scopes(input, in: original), pendingSync: true))
            case "editTransaction":
                let old = snapshot.transactions.first { $0.id == input.id } ?? draft.originalTransaction
                snapshot.transactions.removeAll { $0.id == input.id }
                if var transaction = old, input.date?.hasPrefix(snapshot.month) == true {
                    transaction.name = input.name ?? transaction.name
                    transaction.amount = input.amount ?? transaction.amount
                    transaction.date = input.date ?? transaction.date
                    transaction.accountId = input.accountId
                    transaction.category = input.categoryId
                    transaction.incomeUse = input.incomeUse
                    transaction.scopes = scopes(input, in: original)
                    transaction.pendingSync = true
                    snapshot.transactions.append(transaction)
                }
            case "deleteTransaction": snapshot.transactions.removeAll { $0.id == input.id }
            case "restoreTransaction":
                if var transaction = draft.originalTransaction, transaction.date.hasPrefix(snapshot.month), !snapshot.transactions.contains(where: { $0.id == transaction.id }) {
                    transaction.pendingSync = true
                    snapshot.transactions.append(transaction)
                }
            default: break
            }
        }
        return snapshot
    }

    private static func scopes(_ input: NativeInput, in snapshot: FinanceSnapshot) -> [WalletScope] {
        var result: [WalletScope] = []
        let categoryScope = snapshot.categories.first { $0.id == input.categoryId }?.scope
        if let categoryScope { return [categoryScope] }
        for id in [input.accountId, input.fromAccountId, input.toAccountId] {
            if let scope = snapshot.accounts.first(where: { $0.id == id })?.scope, !result.contains(scope) { result.append(scope) }
        }
        return result
    }
}
