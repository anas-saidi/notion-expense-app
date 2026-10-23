import SwiftUI

struct PersonalJointDebtSummary: View {
    @Environment(FinanceStore.self) private var store

    var body: some View {
        if let contributions = store.snapshot?.contributions, contributions.personalDebt(for: store.scope) > 0 {
            VStack(spacing: 6) {
                ForEach([WalletScope.anas, .salma]) { partner in
                    if (store.scope == .joint || store.scope == partner), contributions.personalDebt(for: partner) > 0 {
                        ViewThatFits(in: .horizontal) {
                            HStack(spacing: 4) {
                                Text("\(partner.title) owes Joint")
                                MoneyText(amount: contributions.personalDebt(for: partner))
                            }
                            VStack(spacing: 4) {
                                Text("\(partner.title) owes Joint")
                                MoneyText(amount: contributions.personalDebt(for: partner))
                            }
                        }.accessibilityElement(children: .combine)
                    }
                }
                Text("For personal spending. Included in the amount due. Transfer from the personal account to Joint to repay.")
                    .font(.caption).foregroundStyle(.secondary)
            }
            .font(.subheadline)
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity)
            .accessibilityIdentifier("personal-joint-debt-summary")
        }
    }
}
