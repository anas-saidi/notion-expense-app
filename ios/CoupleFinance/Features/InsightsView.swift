import SwiftUI

struct InsightsView: View {
    @Environment(FinanceStore.self) private var store
    @Binding var searchVisible: Bool
    @State private var view = "Spending"
    @State private var period = "Month"
    @State private var rangeTransactions: [FinanceTransaction]?
    @State private var loadingRange = false
    @State private var rangeError: String?
    @State private var search = ""
    @State private var filter = "All"
    @State private var selected: FinanceTransaction?
    private var transactions: [FinanceTransaction] {
        let source = rangeTransactions ?? (store.snapshot?.transactions ?? [])
        return source.filter { transaction in
            let matchesScope = filter == "Unassigned" ? transaction.scopes.isEmpty : transaction.scopes.contains(store.scope)
            return matchesScope && (filter == "All" || filter == "Unassigned" || transaction.type == filter) && (search.isEmpty || transaction.name.localizedStandardContains(search))
        }
    }
    private var dates: [String] { Set(transactions.map { String($0.date.prefix(10)) }).sorted(by: >) }
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                ReflectHeader(selection: $view)
                if searchVisible {
                    HStack {
                        Image(systemName: "magnifyingglass")
                        TextField("Search activity", text: $search)
                        Button("Close search", systemImage: "xmark") { search = ""; searchVisible = false }.labelStyle(.iconOnly).frame(width: 44, height: 44)
                    }.padding(.leading, 12).background(.quaternary, in: .rect(cornerRadius: 12))
                }
                HStack {
                    Menu {
                        Picker("Period", selection: $period) {
                            ForEach(["Month", "Last 3 months", "Last 6 months", "This year", "All time"], id: \.self) { Text($0).tag($0) }
                        }
                        Button("Previous month") { store.stepMonth(-1) }
                        Button("Next month") { store.stepMonth(1) }
                    } label: {
                        Label(period == "Month" ? (FinanceDate.parse(store.selectedMonth + "-01")?.formatted(.dateTime.month(.wide).year()) ?? store.selectedMonth) : period, systemImage: "calendar")
                    }
                    Spacer()
                    if view == "Activity" {
                        Picker("Activity", selection: $filter) {
                            ForEach(["All", "Expense", "Income", "Transfer", "Unassigned"], id: \.self) { Text($0).tag($0) }
                        }.pickerStyle(.menu)
                    }
                }.font(.subheadline).frame(minHeight: 44)
                if loadingRange { ProgressView("Loading activity") }
                if let rangeError { Text(rangeError).foregroundStyle(FinanceTheme.expense) }
                if view == "Spending" && !searchVisible {
                    SpendingInsights(transactions: rangeTransactions)
                } else {
                    ForEach(dates, id: \.self) { day in
                        VStack(alignment: .leading, spacing: 12) {
                            NavigationLink(value: ActivityDay(day: day)) { Text(FinanceDate.parse(day)?.formatted(date: .abbreviated, time: .omitted) ?? day).font(.caption).foregroundStyle(.secondary) }
                            ForEach(transactions.filter { $0.date.hasPrefix(day) }) { transaction in
                                Button { selected = transaction } label: { TransactionRow(transaction: transaction) }.buttonStyle(.plain)
                            }
                        }
                    }
                    if transactions.isEmpty { ContentUnavailableView.search(text: search) }
                }
            }
            .frame(maxWidth: 592).padding(.horizontal, FinanceTheme.spacing).padding(.vertical, 16)
            .frame(maxWidth: .infinity)
        }
        .task(id: period + store.selectedMonth) { await loadRange() }
        .refreshable { await store.refresh() }
        .navigationDestination(for: ActivityDay.self) { DayActivityView(day: $0.day) }
        .sheet(item: $selected) { TransactionDetail(transaction: $0) }
    }
    private func loadRange() async {
        guard period != "Month" else { rangeTransactions = nil; rangeError = nil; return }
        loadingRange = true; rangeError = nil; defer { loadingRange = false }
        do {
            let calendar = FinanceDate.calendar
            let selected = FinanceDate.parse(store.selectedMonth + "-01") ?? .now
            let next = calendar.date(byAdding: .month, value: 1, to: selected) ?? selected
            let end = calendar.date(byAdding: .day, value: -1, to: next) ?? selected
            let count = period == "Last 3 months" ? -2 : -5
            let first = period == "This year" ? calendar.date(from: calendar.dateComponents([.year], from: selected)) ?? selected : calendar.date(byAdding: .month, value: count, to: selected) ?? selected
            let query = period == "All time" ? ["all": "true"] : ["start": FinanceDate.day(first), "end": FinanceDate.day(end)]
            let resource: TransactionsResource = try await store.resource("transactions", parameters: query)
            rangeTransactions = resource.transactions
        } catch { if !Task.isCancelled { rangeError = error.localizedDescription } }
    }

}
