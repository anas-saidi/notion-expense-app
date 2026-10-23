import SwiftUI

struct BillEditor: View {
    @Environment(FinanceStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    var bill: BillOccurrence?
    @State private var name = ""
    @State private var amount: Decimal?
    @State private var category = ""
    @State private var account = ""
    @State private var due = Date.now
    @State private var repeatRule = "Monthly"
    @State private var editTarget = "occurrence"
    @State private var requestID = UUID()
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Bill name", text: $name)
                    TextField("Amount in MAD", value: $amount, format: .number).keyboardType(.decimalPad)
                    Picker("Category", selection: $category) {
                        Text("Choose category").tag("")
                        ForEach(store.categories.filter { !$0.isSavings }) { Text($0.name).tag($0.id) }
                    }
                    Picker("Payment account", selection: $account) {
                        Text("Choose when paying").tag("")
                        ForEach(store.snapshot?.accounts ?? []) { Text($0.label).tag($0.id) }
                    }
                    DatePicker("Due date", selection: $due, displayedComponents: .date).disabled(bill != nil && editTarget == "future")
                    Picker("Repeat", selection: $repeatRule) {
                        ForEach(["None", "Monthly", "Yearly"], id: \.self) { Text($0).tag($0) }
                    }.disabled(bill != nil)
                    if bill != nil {
                        Picker("Change", selection: $editTarget) { Text("This occurrence").tag("occurrence"); Text("This and future").tag("future") }
                    }
                }
                Section {
                    NativeSaveButton(title: "Save bill", disabled: name.isEmpty || (amount ?? 0) <= 0 || category.isEmpty) {
                        var input = NativeInput(name: name, amount: amount, accountId: account.isEmpty ? nil : account, categoryId: category, action: bill == nil ? "create" : "edit", billId: bill?.billId, period: bill?.period)
                        input.dueDate = FinanceDate.day(due); input.repeat = repeatRule; input.target = editTarget
                        try await store.submit(TransactionDraft(id: requestID, operation: bill == nil ? "bill" : "updateBill", input: input)); dismiss()
                    }
                }
            }.navigationTitle(bill == nil ? "New bill" : "Edit bill").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
                .task { name = bill?.name ?? ""; amount = bill?.amount; category = bill?.categoryId ?? ""; account = bill?.accountId ?? ""; due = FinanceDate.parse(bill?.dueDate ?? "") ?? .now; repeatRule = bill?.repeat ?? "Monthly" }
        }.interactiveDismissDisabled(store.isSubmitting)
    }
}
