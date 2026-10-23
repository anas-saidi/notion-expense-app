import Foundation

enum SampleHousehold {
    static func snapshot(month: String) throws -> FinanceSnapshot {
        guard let url = Bundle.main.url(forResource: "SampleHousehold", withExtension: "json") else { throw FinanceError.message("Sample household could not be opened.") }
        let text = try String(contentsOf: url, encoding: .utf8)
            .replacing("__MONTH__", with: month).replacing("__TIMESTAMP__", with: Date.now.ISO8601Format())
        return try JSONDecoder().decode(FinanceSnapshot.self, from: Data(text.utf8))
    }
    static var pending: [PendingPurchase] {
        [PendingPurchase(id: UUID().uuidString, name: "A new coffee grinder", amount: 650, categoryId: nil, addedBy: "Anas", claimedBy: nil, date: nil)]
    }

    static func apply(_ draft: TransactionDraft, to original: FinanceSnapshot, pending originalPending: [PendingPurchase]) throws -> (snapshot: FinanceSnapshot, pending: [PendingPurchase]) {
        var snapshot = original
        var pending = originalPending
        let input = draft.input
        let amount = input.amount ?? input.planned ?? 0
        func categoryIndex(_ id: String?) -> Int? { snapshot.categories.firstIndex { $0.id == id } }
        func accountIndex(_ id: String?) -> Int? { snapshot.accounts.firstIndex { $0.id == id } }
        func moveCategory(_ id: String?, _ delta: Decimal) {
            if let index = categoryIndex(id), let available = snapshot.categories[index].available { snapshot.categories[index].available = available + delta }
        }
        func moveAccount(_ id: String?, _ delta: Decimal) {
            if let index = accountIndex(id), let balance = snapshot.accounts[index].balance { snapshot.accounts[index].balance = balance + delta }
        }
        switch draft.operation {
        case "expense", "income", "bill":
            if draft.operation == "bill" && input.action == "create" {
                snapshot.bills.append(BillOccurrence(id: draft.id.uuidString, billId: draft.id.uuidString, period: snapshot.month,
                    name: input.name ?? "Bill", amount: amount, categoryId: input.categoryId ?? "", dueDate: input.dueDate ?? FinanceDate.day(.now), accountId: input.accountId,
                    state: "Due", scope: categoryIndex(input.categoryId).map { snapshot.categories[$0].scope } ?? nil, repeat: input.repeat, payments: []))
            } else {
                let income = draft.operation == "income"
                moveAccount(input.accountId, income ? amount : -amount)
                if !income { moveCategory(input.categoryId, -amount) }
                let scope = categoryIndex(input.categoryId).flatMap { snapshot.categories[$0].scope } ?? accountIndex(input.accountId).flatMap { snapshot.accounts[$0].scope }
                snapshot.transactions.insert(FinanceTransaction(id: draft.id.uuidString, name: input.name ?? "Transaction", amount: amount,
                    date: input.date ?? FinanceDate.day(.now), category: input.categoryId, accountId: input.accountId, type: income ? "Income" : "Expense",
                    incomeUse: input.incomeUse, scopes: scope.map { [$0] } ?? []), at: 0)
                if draft.operation == "bill", let index = snapshot.bills.firstIndex(where: { $0.billId == input.billId }) {
                    snapshot.bills[index].state = "Paid"
                    snapshot.bills[index].payments = [BillPayment(id: draft.id.uuidString, date: input.date ?? FinanceDate.day(.now), amount: amount, accountId: input.accountId ?? "")]
                }
            }
        case "transfer": moveAccount(input.fromAccountId, -amount); moveAccount(input.toAccountId, amount)
        case "rebalance", "savingsWithdrawal": moveCategory(input.fromCategoryId, -amount); moveCategory(input.toCategoryId, amount)
        case "savingsDeposit":
            guard let index = categoryIndex(input.categoryId), snapshot.categories[index].isSavings else { throw FinanceError.message("Choose a savings category.") }
            let holding = snapshot.categories[index].defaultAccount
            guard let sourceIndex = accountIndex(input.accountId), (snapshot.accounts[sourceIndex].balance ?? 0) >= amount else { throw FinanceError.message("The funding account does not have enough cash.") }
            moveCategory(input.categoryId, amount)
            if input.accountId != holding { moveAccount(input.accountId, -amount); moveAccount(holding, amount) }
            snapshot.transactions.insert(FinanceTransaction(id: draft.id.uuidString, name: "To " + snapshot.categories[index].name,
                amount: amount, date: input.date ?? FinanceDate.day(.now), category: input.categoryId, type: "Transfer",
                fromAccountId: input.accountId, toAccountId: holding, savingsFundingOperation: input.operationId,
                scopes: snapshot.categories[index].scope.map { [$0] } ?? []), at: 0)
        case "undoSavingsDeposit":
            guard let transaction = snapshot.transactions.first(where: { $0.savingsFundingOperation == input.operationId }),
                  let index = categoryIndex(transaction.category), (snapshot.categories[index].available ?? 0) >= transaction.amount
            else { throw FinanceError.message("This deposit is no longer available to undo.") }
            moveCategory(transaction.category, -transaction.amount)
            if transaction.fromAccountId != transaction.toAccountId {
                guard let holding = accountIndex(transaction.toAccountId), (snapshot.accounts[holding].balance ?? 0) >= transaction.amount else { throw FinanceError.message("The holding account does not have enough cash.") }
                moveAccount(transaction.toAccountId, -transaction.amount); moveAccount(transaction.fromAccountId, transaction.amount)
            }
            snapshot.transactions.removeAll { $0.id == transaction.id }
        case "updateFund", "deleteFund":
            let categoryID = input.id?.replacing("fund-", with: "")
            if let index = snapshot.summary.assignedByCategory.firstIndex(where: { $0.categoryId == categoryID }) {
                let next = draft.operation == "deleteFund" ? Decimal.zero : input.planned ?? 0
                let old = snapshot.summary.assignedByCategory[index].total
                moveCategory(categoryID, next - old)
                snapshot.summary.assignedByCategory[index].total = next
            }
        case "allocate": moveCategory(input.categoryId, input.mode == "release" ? -amount : amount)
        case "monthlyPlan":
            for allocation in input.budgetItems ?? [] {
                if let index = snapshot.summary.assignedByCategory.firstIndex(where: { $0.categoryId == allocation.categoryId }) { snapshot.summary.assignedByCategory[index].total = allocation.amount }
                else { snapshot.summary.assignedByCategory.append(CategoryTotal(categoryId: allocation.categoryId, total: allocation.amount)) }
            }
        case "updateCategory":
            if let index = categoryIndex(input.id) {
                if let name = input.name { snapshot.categories[index].name = name }
                if let icon = input.icon { snapshot.categories[index].icon = icon }
                if let type = input.type { snapshot.categories[index].type = [type] }
                if let account = input.accountId { snapshot.categories[index].defaultAccount = account }
                if let frozen = input.snoozed { snapshot.categories[index].snoozed = frozen }
                if let archived = input.archived { snapshot.categories[index].archived = archived }
                if input.clearSpendingPattern == true { snapshot.categories[index].spendingPattern = nil }
                else if let pattern = input.spendingPattern { snapshot.categories[index].spendingPattern = pattern }
            }
        case "createCategory":
            snapshot.categories.append(FinanceCategory(id: draft.id.uuidString, name: input.name ?? "Category", icon: input.icon, type: [input.type ?? "Budget"], defaultAccount: input.accountId, available: 0, planned: 0,
                isTeamFund: input.type == "Team", scope: input.scope.flatMap(WalletScope.init(rawValue:)), spendingPattern: input.spendingPattern))
        case "deleteTransaction":
            if let transaction = snapshot.transactions.first(where: { $0.id == input.id }) {
                moveAccount(transaction.accountId, -transaction.signedAmount)
                if transaction.type == "Expense" { moveCategory(transaction.category, transaction.amount) }
                snapshot.transactions.removeAll { $0.id == input.id }
            }
        case "editTransaction":
            if let index = snapshot.transactions.firstIndex(where: { $0.id == input.id }) {
                let old = snapshot.transactions[index]
                moveAccount(old.accountId, -old.signedAmount)
                if old.type == "Expense" { moveCategory(old.category, old.amount) }
                moveAccount(input.accountId, old.type == "Income" ? amount : -amount)
                if old.type == "Expense" { moveCategory(input.categoryId, -amount) }
                snapshot.transactions[index].name = input.name ?? old.name
                snapshot.transactions[index].amount = amount
                snapshot.transactions[index].accountId = input.accountId
                snapshot.transactions[index].category = input.categoryId
                snapshot.transactions[index].date = input.date ?? old.date
            }
        case "updateBill":
            if let index = snapshot.bills.firstIndex(where: { $0.billId == input.billId }) {
                if input.action == "skip" { snapshot.bills[index].state = "Skipped" }
                else if input.action == "restore" { snapshot.bills[index].state = "Due" }
                else if input.action == "stop" { snapshot.bills.remove(at: index) }
                else { snapshot.bills[index].name = input.name ?? snapshot.bills[index].name; snapshot.bills[index].amount = amount; snapshot.bills[index].dueDate = input.dueDate ?? snapshot.bills[index].dueDate }
            }
        case "deleteBill":
            if let paymentID = input.paymentId, let index = snapshot.bills.firstIndex(where: { $0.payments?.contains(where: { $0.id == paymentID }) == true }) {
                snapshot.bills[index].state = "Due"; snapshot.bills[index].payments = []
            } else { snapshot.bills.removeAll { $0.billId == input.billId } }
        case "createPending": pending.append(PendingPurchase(id: draft.id.uuidString, name: input.name ?? "Purchase", amount: input.amount, categoryId: input.categoryId, addedBy: input.addedBy, claimedBy: input.claimedBy, date: input.date))
        case "claimPending": if let index = pending.firstIndex(where: { $0.id == input.id }) { pending[index].claimedBy = input.claimedBy }
        case "deletePending": pending.removeAll { $0.id == input.id }
        case "reconcile": if let index = accountIndex(input.accountId) { snapshot.accounts[index].balance = input.actualBalance }
        default: throw FinanceError.message("This sample action needs a connected finance backend. No real data was changed.")
        }
        snapshot.fetchedAt = Date.now.ISO8601Format()
        return (snapshot, pending)
    }
}
