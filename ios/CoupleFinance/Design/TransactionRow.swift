import SwiftUI

struct TransactionRow: View {
    @Environment(FinanceStore.self) private var store
    let transaction: FinanceTransaction
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: transaction.symbol)
                .frame(width: 32, height: 44)
                .foregroundStyle(FinanceTheme.amountColor(type: transaction.type))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 4) {
                Text(transaction.name).font(.subheadline.weight(.semibold))
                Text(transaction.type == "Transfer" ? "Transfer" : store.categoryName(transaction.category))
                    .font(.caption).foregroundStyle(.secondary)
            }
            Spacer(minLength: 8)
            MoneyText(amount: transaction.signedAmount)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(FinanceTheme.amountColor(type: transaction.type))
        }
        .padding(.vertical, 8)
        .accessibilityElement(children: .combine)
    }
}
