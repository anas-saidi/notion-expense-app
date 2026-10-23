import SwiftUI

struct SavingsActionView: View {
    @Environment(FinanceStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let category: FinanceCategory
    var withdrawing = false
    @State private var amount: Decimal?
    @State private var account = ""
    @State private var destination = ""
    @State private var target = "separate"
    @State private var date = Date.now
    @State private var requestID = UUID()
    private var destinations: [FinanceCategory] { (store.snapshot?.categories ?? []).filter { !$0.isSavings && $0.scope == category.scope && $0.snoozed != true } }
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    LabeledContent("Savings", value: category.name)
                    LabeledContent("Available") { MoneyText(amount: category.available) }
                    TextField("Amount in MAD", value: $amount, format: .number.precision(.fractionLength(0...2))).keyboardType(.decimalPad)
                    if withdrawing {
                        Picker("Move to category", selection: $destination) {
                            Text("Choose category").tag("")
                            ForEach(destinations) { Text($0.name).tag($0.id) }
                        }
                    } else {
                        Picker("Funding account", selection: $account) {
                            Text("Choose account").tag("")
                            ForEach(store.snapshot?.accounts ?? []) { Text($0.label).tag($0.id) }
                        }
                        Picker("Funding purpose", selection: $target) {
                            Text("Separate savings").tag("separate")
                            Text("Shared contribution").tag("shared")
                        }
                    }
                    DatePicker("Date", selection: $date, displayedComponents: .date).environment(\.timeZone, FinanceDate.calendar.timeZone)
                }
                Section {
                    Text(withdrawing ? "Moves savings into a spending category. The holding account stays unchanged." : "Records a linked deposit and moves account cash when the funding and holding accounts differ.").font(.caption).foregroundStyle(.secondary)
                    NativeSaveButton(title: withdrawing ? "Take money out" : "Deposit into savings", disabled: (amount ?? 0) <= 0 || (withdrawing ? destination.isEmpty || (amount ?? 0) > (category.available ?? 0) : account.isEmpty)) {
                        var input = NativeInput(amount: amount, date: FinanceDate.day(date))
                        if withdrawing { input.fromCategoryId = category.id; input.toCategoryId = destination; input.note = "From \(category.name)" }
                        else { input.categoryId = category.id; input.accountId = account; input.target = target; input.operationId = requestID.uuidString }
                        try await store.submit(TransactionDraft(id: requestID, operation: withdrawing ? "savingsWithdrawal" : "savingsDeposit", input: input)); dismiss()
                    }
                }
            }.navigationTitle(withdrawing ? "Take out of savings" : "Savings deposit").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
                .onAppear { account = store.accounts.first?.id ?? "" }
        }.interactiveDismissDisabled(store.isSubmitting)
    }
}
