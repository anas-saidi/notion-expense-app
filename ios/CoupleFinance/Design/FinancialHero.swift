import SwiftUI

struct FinancialHero: View {
    let label: String
    let amount: Decimal?
    var color: Color = .primary
    @ScaledMetric(relativeTo: .largeTitle) private var amountSize = 60
    var body: some View {
        VStack(spacing: 4) {
            Text(label).font(.caption.weight(.semibold)).foregroundStyle(.secondary)
            MoneyText(amount: amount, currency: true)
                .font(.system(size: amountSize, weight: .regular, design: .rounded))
                .tracking(-1.3).foregroundStyle(color)
                .minimumScaleFactor(0.5).lineLimit(1)
        }.frame(maxWidth: .infinity).padding(.top, 10).padding(.bottom, 24)
    }
}
