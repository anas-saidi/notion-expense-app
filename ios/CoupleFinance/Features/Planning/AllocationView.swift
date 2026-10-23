import SwiftUI

struct AllocationView: View {
    @Environment(FinanceStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let category: FinanceCategory
    var releasing = false
    @State private var amount: Decimal?
    @State private var requestID = UUID()
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    LabeledContent("Category", value: category.name)
                    LabeledContent("Available now") { MoneyText(amount: category.available) }
                    TextField("Amount in MAD", value: $amount, format: .number.precision(.fractionLength(0...2))).keyboardType(.decimalPad)
                }
                Section {
                    Text(releasing ? "Returns category money to unassigned funds. It does not delete the monthly plan." : "Adds money to this category without changing the saved monthly baseline.").font(.subheadline).foregroundStyle(.secondary)
                    NativeSaveButton(title: releasing ? "Release money" : "Add money", disabled: (amount ?? 0) <= 0 || (releasing && (amount ?? 0) > (category.available ?? 0))) {
                        var input = NativeInput(accountId: category.defaultAccount, categoryId: category.id)
                        input.month = store.selectedMonth; input.planned = amount; input.mode = releasing ? "release" : "add"
                        try await store.submit(TransactionDraft(id: requestID, operation: "allocate", input: input)); dismiss()
                    }
                }
            }.navigationTitle(releasing ? "Release money" : "Add to category").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
        }.interactiveDismissDisabled(store.isSubmitting)
    }
}
