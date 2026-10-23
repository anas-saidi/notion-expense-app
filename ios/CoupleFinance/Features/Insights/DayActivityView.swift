import SwiftUI

struct DayActivityView: View {
    @Environment(FinanceStore.self) private var store
    let day: String
    @State private var selected: FinanceTransaction?
    @State private var entries: [FinanceTransaction] = []
    @State private var error: String?
    var body: some View {
        List {
            if let error { Text(error).foregroundStyle(FinanceTheme.expense) }
            ForEach(entries) { transaction in
                Button { selected = transaction } label: { TransactionRow(transaction: transaction) }.buttonStyle(.plain)
            }
            if entries.isEmpty && error == nil { Text("No activity on this day").foregroundStyle(.secondary) }
        }.navigationTitle(FinanceDate.parse(day)?.formatted(date: .abbreviated, time: .omitted) ?? day)
            .sheet(item: $selected) { TransactionDetail(transaction: $0) }
            .task(id: day) {
                do {
                    let result: TransactionsResource = try await store.resource("transactions", parameters: ["start": day, "end": day])
                    entries = result.transactions.filter { $0.date.hasPrefix(day) && $0.scopes.contains(store.scope) }
                } catch { self.error = error.localizedDescription }
            }
    }
}
