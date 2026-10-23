import SwiftUI

struct SpendingCategoryRow: View {
    @Environment(FinanceStore.self) private var store
    let item: CategoryTotal
    let total: Decimal
    private var share: Double { total > 0 ? NSDecimalNumber(decimal: item.total / total).doubleValue : 0 }
    var body: some View {
        HStack(spacing: 12) {
            Text(store.snapshot?.categories.first { $0.id == item.categoryId }?.icon ?? "🧾")
                .font(.title2).frame(width: 36, height: 44).accessibilityHidden(true)
            VStack(spacing: 8) {
                HStack {
                    Text(store.categoryName(item.categoryId)).font(.subheadline.weight(.medium))
                    Spacer()
                    MoneyText(amount: item.total).font(.subheadline.weight(.semibold))
                }
                HStack(spacing: 12) {
                    GeometryReader { geometry in
                        Capsule().fill(.quaternary)
                        Capsule().fill(FinanceTheme.scopeColor(store.scope).opacity(0.55)).frame(width: geometry.size.width * max(0, min(1, share)))
                    }.frame(height: 4)
                    Text(share < 0.005 ? "<1%" : "\(Int((share * 100).rounded()))%")
                        .font(.caption).foregroundStyle(.secondary).monospacedDigit()
                }
            }
        }.padding(.vertical, 6).accessibilityElement(children: .combine)
    }
}
