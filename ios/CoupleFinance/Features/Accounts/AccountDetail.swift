import SwiftUI

struct AccountDetail: View {
    @Environment(FinanceStore.self) private var store
    let account: FinanceAccount
    @State private var sheet: SheetSelection?
    @State private var selected: FinanceTransaction?
    private var current: FinanceAccount { store.snapshot?.accounts.first { $0.id == account.id } ?? account }
    private var transactions: [FinanceTransaction] { (store.snapshot?.transactions ?? []).filter { [$0.accountId, $0.fromAccountId, $0.toAccountId].contains(account.id) } }
    var body: some View {
        List {
            Section {
                MoneyText(amount: current.balance, currency: true).font(.largeTitle.weight(.semibold))
                LabeledContent("Ready to assign") { MoneyText(amount: current.readyToAssign) }
            }
            Section {
                Button("Add income", systemImage: "arrow.down.left") { sheet = SheetSelection(id: "income") }
                Button("Transfer between accounts", systemImage: "arrow.left.arrow.right") { sheet = SheetSelection(id: "transfer") }
                Button("Reconcile balance", systemImage: "checkmark.circle") { sheet = SheetSelection(id: "reconcile") }
            }
            Section("Activity · \(store.selectedMonth)") {
                ForEach(transactions) { transaction in
                    Button { selected = transaction } label: { TransactionRow(transaction: transaction) }.buttonStyle(.plain)
                }
                if transactions.isEmpty { Text("No activity for this account in this month").foregroundStyle(.secondary) }
            }
        }.navigationTitle(current.label)
            .sheet(item: $sheet) { item in
                if item.id == "reconcile" { ReconcileView(account: current) }
                else {
                    TransactionEditor(existingDraft: TransactionDraft(operation: item.id,
                        input: NativeInput(accountId: item.id == "income" ? account.id : nil, fromAccountId: item.id == "transfer" ? account.id : nil)))
                }
            }
            .sheet(item: $selected) { TransactionDetail(transaction: $0) }
    }
}
