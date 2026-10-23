import SwiftUI

struct SpendingInsights: View {
    @Environment(FinanceStore.self) private var store
    var transactions: [FinanceTransaction]?
    private var spending: [CategoryTotal] {
        FinanceAnalytics.spending(transactions ?? store.snapshot?.transactions ?? [], accounts: store.snapshot?.accounts ?? [], scope: store.scope)
    }
    private var total: Decimal { spending.reduce(0) { $0 + $1.total } }
    private var items: [JarItem] {
        spending.map { item in JarItem(id: item.categoryId, icon: store.snapshot?.categories.first { $0.id == item.categoryId }?.icon ?? "🧾", amount: NSDecimalNumber(decimal: item.total).doubleValue) }
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            VStack(spacing: 4) {
                JarArtwork(scope: store.scope, fraction: 0, items: items).frame(width: 175, height: 175)
                FinancialHero(label: "Spent", amount: total, color: FinanceTheme.expense)
            }.frame(maxWidth: .infinity)
            Text("Where it went").font(.headline)
            if spending.isEmpty { Text("No category spending in this period").font(.subheadline).foregroundStyle(.secondary) }
            ForEach(spending, id: \.categoryId) { item in
                SpendingCategoryRow(item: item, total: total)
            }
        }
    }
}
