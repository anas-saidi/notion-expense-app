import SwiftUI

struct TransactionDetail: View {
    @Environment(FinanceStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let transaction: FinanceTransaction
    @State private var deleted = false
    @State private var editing: TransactionDraft?
    @State private var confirmingDelete = false
    @State private var saving = false
    @State private var error: String?
    private var canEdit: Bool { ["Expense", "Income"].contains(transaction.type ?? "") && transaction.savingsFundingOperation == nil }
    var body: some View {
        NavigationStack {
            List {
                Section {
                    MoneyText(amount: transaction.signedAmount, currency: true)
                        .font(.largeTitle.weight(.semibold)).foregroundStyle(FinanceTheme.amountColor(type: transaction.type))
                    LabeledContent("Type", value: transaction.type ?? "Legacy transaction")
                    LabeledContent("Date", value: transaction.date)
                    LabeledContent("Account", value: store.accountName(transaction.accountId ?? transaction.fromAccountId))
                    if transaction.category != nil { LabeledContent("Category", value: store.categoryName(transaction.category)) }
                    if transaction.toAccountId != nil { LabeledContent("To account", value: store.accountName(transaction.toAccountId)) }
                }
                if deleted {
                    Section {
                        Text("Deleted from the ledger").foregroundStyle(.secondary)
                        NativeSaveButton(title: "Undo deletion") {
                            try await store.submit(TransactionDraft(operation: "restoreTransaction", input: NativeInput(id: transaction.id))); deleted = false
                        }
                    }
                } else if canEdit {
                    Section {
                        Button("Edit transaction", systemImage: "pencil") {
                            editing = TransactionDraft(operation: "editTransaction", input: NativeInput(name: transaction.name,
                                amount: transaction.amount, date: transaction.date, accountId: transaction.accountId,
                                categoryId: transaction.type == "Expense" ? transaction.category : nil, incomeUse: transaction.incomeUse, id: transaction.id))
                        }
                        Button("Delete transaction", systemImage: "trash", role: .destructive) { confirmingDelete = true }
                            .confirmationDialog("Delete this transaction from Notion?", isPresented: $confirmingDelete, titleVisibility: .visible) {
                                Button("Delete transaction", role: .destructive) { Task { await delete() } }
                            } message: { Text("This changes the balances for everyone using this finance app.") }
                    }.disabled(saving)
                } else {
                    Section {
                        if let operationID = transaction.savingsFundingOperation {
                            NativeSaveButton(title: "Undo savings deposit") {
                                var input = NativeInput(); input.operationId = operationID
                                try await store.submit(TransactionDraft(operation: "undoSavingsDeposit", input: input)); dismiss()
                            }
                        } else if transaction.type == "Transfer" {
                            NativeSaveButton(title: "Delete transfer") {
                                try await store.submit(TransactionDraft(operation: "deleteTransaction", input: NativeInput(id: transaction.id))); deleted = true
                            }
                            Text("Linked assignments stay unchanged. Receiving balances are checked before removal.").font(.caption).foregroundStyle(.secondary)
                        } else { Text("This legacy record has no transaction type and is read-only to protect its ledger relationships.").foregroundStyle(.secondary) }
                    }
                }
                if saving { ProgressView("Saving…") }
                if let error { Text(error).foregroundStyle(FinanceTheme.expense) }
            }
            .navigationTitle(transaction.name).navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() }.disabled(saving) } }
            .sheet(item: $editing, onDismiss: { dismiss() }) { TransactionEditor(existingDraft: $0) }
            .interactiveDismissDisabled(saving)
        }
    }
    private func delete() async {
        saving = true
        defer { saving = false }
        do {
            try await store.submit(TransactionDraft(operation: "deleteTransaction", input: NativeInput(name: transaction.name, id: transaction.id)))
            deleted = true
        } catch { self.error = error.localizedDescription }
    }
}
