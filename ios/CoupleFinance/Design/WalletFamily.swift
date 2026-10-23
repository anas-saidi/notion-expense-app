import SwiftUI

struct WalletFamily: View {
    @Environment(FinanceStore.self) private var store
    var allocated = false
    private var items: [JarItem] {
        let amounts = allocated ? store.categories.filter { !$0.isSavings }.map { CategoryTotal(categoryId: $0.id, total: $0.available ?? 0) } : Array((store.snapshot?.summary.spentByCategory ?? []).sorted { $0.total > $1.total }.prefix(3))
        return amounts.compactMap { item in
            guard item.total > 0, let category = store.categories.first(where: { $0.id == item.categoryId }) else { return nil }
            return JarItem(id: category.id, icon: category.icon ?? "🧾", amount: NSDecimalNumber(decimal: item.total).doubleValue)
        }
    }
    var body: some View {
        ZStack(alignment: .top) {
            WalletJar(scope: store.scope, fraction: remainingFraction,
                      detail: "\(store.spent?.formatted() ?? "—") of \(store.assigned?.formatted() ?? "—") MAD spent this month.", items: items)
            if store.scope == .joint, let contributions = store.snapshot?.contributions {
                HStack(alignment: .top, spacing: 92) {
                    WalletJar(scope: .anas, fraction: ratio(contributions.anasActual, contributions.anasPlan),
                              detail: status(contributions.anasActual, contributions.anasPlan), size: 64, warning: false)
                        .rotationEffect(.degrees(4), anchor: .bottom)
                    WalletJar(scope: .salma, fraction: ratio(contributions.salmaActual, contributions.salmaPlan),
                              detail: status(contributions.salmaActual, contributions.salmaPlan), size: 64, warning: false)
                        .rotationEffect(.degrees(-8), anchor: .bottom)
                }.padding(.top, 94)
            }
        }.frame(maxWidth: .infinity).frame(minHeight: 175, alignment: .top)
    }
    private var remainingFraction: Double {
        guard let assigned = store.assigned, assigned > 0, let spent = store.spent else { return 1 }
        return NSDecimalNumber(decimal: (assigned - spent) / assigned).doubleValue
    }
    private func ratio(_ actual: Decimal, _ plan: Decimal) -> Double {
        plan > 0 ? NSDecimalNumber(decimal: actual / plan).doubleValue : 1
    }
    private func status(_ actual: Decimal, _ plan: Decimal) -> String {
        plan > actual ? "\((plan - actual).formatted()) MAD due" : "Settled"
    }
}
