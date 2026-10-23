import SwiftUI

struct BudgetView: View {
    @Environment(FinanceStore.self) private var store
    @Binding var searchVisible: Bool
    @State private var adding = false
    @State private var planning = false
    @State private var showFrozen = false
    @State private var search = ""
    @State private var selectedCategory: FinanceCategory?
    @FocusState private var searchFocused: Bool
    private var categories: [FinanceCategory] {
        (showFrozen ? (store.snapshot?.categories.filter { $0.scope == store.scope && $0.snoozed == true && $0.archived != true } ?? []) : store.categories)
            .filter { search.isEmpty || $0.name.localizedStandardContains(search) }
    }
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                if searchVisible {
                    HStack {
                        Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
                        TextField("Search categories", text: $search).focused($searchFocused)
                        Button("Close search", systemImage: "xmark") { search = ""; searchVisible = false }.labelStyle(.iconOnly).frame(width: 44, height: 44)
                    }.padding(.leading, 12).background(.quaternary, in: .rect(cornerRadius: 12))
                }
                VStack(spacing: 0) {
                    WalletFamily(allocated: true)
                    FinancialHero(label: "Allocated", amount: store.available)
                }.padding(.top, 12)
                HStack {
                    Menu {
                        Button("Previous month") { store.stepMonth(-1) }
                        Button("Next month") { store.stepMonth(1) }
                        Toggle("Show frozen categories", isOn: $showFrozen)
                    } label: {
                        Label(FinanceDate.parse(store.selectedMonth + "-01")?.formatted(.dateTime.month(.wide).year()) ?? store.selectedMonth, systemImage: "calendar")
                    }
                    Spacer()
                    Button("Plan the month", systemImage: "calendar.badge.plus") { planning = true }
                }.font(.caption.weight(.medium)).frame(minHeight: 44)
                ForEach([false, true], id: \.self) { savings in
                    let group = categories.filter { $0.isSavings == savings }
                    if !group.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Text(showFrozen ? "Frozen" : savings ? "Savings" : "Categories")
                                Text("\(group.count)").foregroundStyle(.tertiary)
                                Spacer()
                                MoneyText(amount: group.reduce(0) { $0 + ($1.available ?? 0) })
                            }.font(.subheadline.weight(.semibold)).foregroundStyle(.secondary)
                            VStack(spacing: 0) {
                                ForEach(group) { category in
                                    BudgetCategoryRow(category: category) { selectedCategory = category }
                                }
                            }
                        }
                    }
                }
                if categories.isEmpty { Text("No categories found").foregroundStyle(.secondary) }
                Button("New category", systemImage: "plus") { adding = true }.font(.subheadline).frame(minHeight: 44)
            }
            .frame(maxWidth: 592).padding(.horizontal, FinanceTheme.spacing).padding(.bottom, 24)
            .frame(maxWidth: .infinity)
        }
        .onChange(of: searchVisible) { _, visible in searchFocused = visible; if !visible { search = "" } }
        .refreshable { await store.refresh() }
        .sheet(isPresented: $adding) { CategoryEditor() }
        .sheet(isPresented: $planning) { MonthPlanner() }
        .sheet(item: $selectedCategory) { CategoryDetail(category: $0) }
    }
}
