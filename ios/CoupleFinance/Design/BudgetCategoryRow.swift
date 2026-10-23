import SwiftUI

struct BudgetCategoryRow: View {
    @Environment(FinanceStore.self) private var store
    let category: FinanceCategory
    let action: () -> Void
    @State private var taps = 0
    private var planned: Decimal { store.snapshot?.summary.assignedByCategory.first { $0.categoryId == category.id }?.total ?? category.planned ?? 0 }
    private var spent: Decimal { store.snapshot?.summary.spentByCategory.first { $0.categoryId == category.id }?.total ?? 0 }
    private var available: Decimal { category.available ?? 0 }
    private var fraction: Double {
        let capacity = category.isSavings ? (category.goal ?? 0) : max(available + spent, planned)
        guard capacity > 0 else { return available > 0 ? 0.5 : 0 }
        return NSDecimalNumber(decimal: max(0, available) / capacity).doubleValue
    }
    private var low: Bool { !category.isSavings && fraction < 0.2 }
    var body: some View {
        Button { taps += 1; action() } label: {
            HStack(spacing: 12) {
                JarArtwork(scope: store.scope, fraction: fraction, categoryIcon: category.icon ?? "🧾", categoryColor: available < 0 ? FinanceTheme.expense : low ? Color(red: 0.95, green: 0.83, blue: 0.54) : Color(red: 0.66, green: 0.85, blue: 0.73))
                    .frame(width: 60, height: 60)
                VStack(alignment: .leading, spacing: 4) {
                    Text(category.name).font(.subheadline.weight(.bold))
                    if available < 0 { Text("Overspent").font(.caption).foregroundStyle(FinanceTheme.expense) }
                    else if category.isSavings, let goal = category.goal, goal > 0 {
                        Text("\(Int(fraction * 100))% of \(goal.formatted())").font(.caption).foregroundStyle(.secondary)
                    } else if spent > 0 { Text("\(spent.formatted()) spent").font(.caption).foregroundStyle(.secondary) }
                }
                Spacer(minLength: 8)
                MoneyText(amount: category.available).font(.body.weight(.bold))
                    .foregroundStyle(available < 0 ? FinanceTheme.expense : .primary)
            }.padding(.vertical, 8).contentShape(.rect)
        }.buttonStyle(.plain)
        .sensoryFeedback(.selection, trigger: taps)
    }
}
