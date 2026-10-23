import SwiftUI

struct MoneyText: View {
    let amount: Decimal?
    var currency = false
    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 4) {
            if let amount { Text(amount, format: .number.locale(Locale(identifier: "fr_MA")).precision(.fractionLength(0...2))) }
            else { Text("—") }
            if currency { Text("MAD").font(.caption).dynamicTypeSize(...DynamicTypeSize.xxxLarge).tracking(0).foregroundStyle(FinanceTheme.secondary) }
        }
        .monospacedDigit()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(amount.map { "\($0.formatted(.number.locale(Locale(identifier: "fr_MA")).precision(.fractionLength(0...2)))) Moroccan dirhams" } ?? "Balance unavailable")
    }
}
