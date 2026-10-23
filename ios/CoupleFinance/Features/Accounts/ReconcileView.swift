import SwiftUI

struct ReconcileView: View {
    @Environment(FinanceStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let account: FinanceAccount
    @State private var actual: Decimal?
    @State private var requestID = UUID()
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text(account.label).font(.headline)
                    LabeledContent("Ledger balance") { MoneyText(amount: account.balance) }
                    TextField("Actual balance in MAD", value: $actual, format: .number).keyboardType(.numbersAndPunctuation)
                    if let actual, let balance = account.balance { LabeledContent("Difference") { MoneyText(amount: actual - balance) } }
                }
                Section {
                    Text("Records the actual and ledger balances in your reconciliation database. This is a ledger adjustment, not a bank transaction.").font(.caption).foregroundStyle(.secondary)
                    NativeSaveButton(title: "Save reconciliation", disabled: actual == nil || account.balance == nil) {
                        var input = NativeInput(date: FinanceDate.day(.now), accountId: account.id)
                        input.actualBalance = actual; input.currentBalance = account.balance
                        try await store.submit(TransactionDraft(id: requestID, operation: "reconcile", input: input)); dismiss()
                    }
                }
            }.navigationTitle("Reconcile account").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
        }.interactiveDismissDisabled(store.isSubmitting)
    }
}
