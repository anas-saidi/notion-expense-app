import SwiftUI

struct BillDetail: View {
    @Environment(FinanceStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let bill: BillOccurrence
    @State private var editing = false
    @State private var account = ""
    @State private var date = Date.now
    @State private var saving = false
    @State private var requestID = UUID()
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    MoneyText(amount: bill.amount, currency: true).font(.largeTitle.weight(.semibold))
                    LabeledContent("Due", value: bill.dueDate)
                    LabeledContent("Status", value: bill.state)
                    LabeledContent("Category", value: store.categoryName(bill.categoryId))
                }
                if bill.state != "Paid" {
                    Section {
                        Picker("Payment account", selection: $account) {
                            Text("Choose account").tag("")
                            ForEach(store.snapshot?.accounts ?? []) { Text($0.label).tag($0.id) }
                        }
                        DatePicker("Payment date", selection: $date, displayedComponents: .date)
                            .environment(\.timeZone, FinanceDate.calendar.timeZone)
                        Button(saving ? "Recording…" : "Record payment") { Task { await pay() } }
                            .disabled(account.isEmpty || saving).buttonStyle(.borderedProminent)
                    }
                }
                Section("Schedule") {
                    Button("Edit bill", systemImage: "pencil") { editing = true }.disabled(bill.state == "Paid")
                    NativeSaveButton(title: bill.state == "Skipped" ? "Restore occurrence" : "Skip occurrence", disabled: bill.state == "Paid") {
                        let input = NativeInput(action: bill.state == "Skipped" ? "restore" : "skip", billId: bill.billId, period: bill.period)
                        try await store.submit(TransactionDraft(operation: "updateBill", input: input)); dismiss()
                    }
                    NativeSaveButton(title: "Stop after this occurrence") {
                        let input = NativeInput(action: "stop", billId: bill.billId, period: bill.period)
                        try await store.submit(TransactionDraft(operation: "updateBill", input: input)); dismiss()
                    }
                    NativeSaveButton(title: "Remove bill schedule") {
                        try await store.submit(TransactionDraft(operation: "deleteBill", input: NativeInput(billId: bill.billId))); dismiss()
                    }
                }
                if let payments = bill.payments, !payments.isEmpty {
                    Section("Payments") {
                        ForEach(payments) { payment in
                            LabeledContent(payment.date) { MoneyText(amount: payment.amount) }
                            NativeSaveButton(title: "Undo payment") {
                                var input = NativeInput(); input.paymentId = payment.id
                                try await store.submit(TransactionDraft(operation: "deleteBill", input: input)); dismiss()
                            }
                        }
                    }
                }
            }
            .sheet(isPresented: $editing) { BillEditor(bill: bill) }
            .navigationTitle(bill.name).navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() }.disabled(saving) } }
            .interactiveDismissDisabled(saving)
            .onAppear { account = bill.accountId ?? store.snapshot?.categories.first(where: { $0.id == bill.categoryId })?.defaultAccount ?? "" }
        }
    }
    private func pay() async {
        saving = true
        defer { saving = false }
        let draft = TransactionDraft(id: requestID, operation: "bill", input: NativeInput(name: bill.name,
            amount: bill.amount, date: FinanceDate.day(date), accountId: account, categoryId: bill.categoryId,
            action: "pay", billId: bill.billId, period: bill.period))
        do { try await store.submit(draft); dismiss() }
        catch { store.error = error.localizedDescription; dismiss() }
    }
}
