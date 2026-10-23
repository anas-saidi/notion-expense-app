import SwiftUI

struct FundingEditor: View {
    @Environment(FinanceStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let event: CategoryEvent?
    let category: FinanceCategory
    @State private var amount: Decimal?
    @State private var date = Date.now
    @State private var account = ""
    @State private var requestID = UUID()
    var body: some View {
        NavigationStack {
            Form {
                Text(category.name).font(.headline)
                TextField("Assigned amount in MAD", value: $amount, format: .number).keyboardType(.decimalPad)
                DatePicker("Date", selection: $date, displayedComponents: .date)
                Picker("Account", selection: $account) {
                    ForEach(store.snapshot?.accounts ?? []) { Text($0.label).tag($0.id) }
                }
                NativeSaveButton(title: "Update assignment", disabled: (amount ?? -1) < 0 || event == nil) {
                    var input = NativeInput(date: FinanceDate.day(date), accountId: account, id: event?.id)
                    input.planned = amount
                    try await store.submit(TransactionDraft(id: requestID, operation: "updateFund", input: input)); dismiss()
                }
                NativeSaveButton(title: "Remove assignment", disabled: event == nil) {
                    try await store.submit(TransactionDraft(id: requestID, operation: "deleteFund", input: NativeInput(id: event?.id))); dismiss()
                }
            }.navigationTitle("Funding record").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
                .task { amount = event?.amount; date = FinanceDate.parse(event?.date ?? "") ?? .now; account = category.defaultAccount ?? "" }
        }.interactiveDismissDisabled(store.isSubmitting)
    }
}
