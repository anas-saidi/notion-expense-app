import SwiftUI

struct PartnerSummaries: View {
    @Environment(FinanceStore.self) private var store
    let contributions: ContributionStatus
    var body: some View {
        HStack(alignment: .top, spacing: 24) {
            Button { store.scope = .anas } label: {
                VStack(spacing: 8) {
                    Image("PartnerAnas").resizable().scaledToFit().frame(width: 56, height: 56).accessibilityHidden(true)
                    Text("Anas").font(.subheadline.weight(.semibold))
                    MoneyText(amount: max(0, contributions.anasPlan - contributions.anasActual)).font(.headline)
                    Text("due to Joint").font(.caption).foregroundStyle(.secondary)
                }.frame(maxWidth: .infinity, minHeight: 44)
            }.buttonStyle(.plain)
            Button { store.scope = .salma } label: {
                VStack(spacing: 8) {
                    Image("PartnerSalma").resizable().scaledToFit().frame(width: 56, height: 56).accessibilityHidden(true)
                    Text("Salma").font(.subheadline.weight(.semibold))
                    MoneyText(amount: max(0, contributions.salmaPlan - contributions.salmaActual)).font(.headline)
                    Text("due to Joint").font(.caption).foregroundStyle(.secondary)
                }.frame(maxWidth: .infinity, minHeight: 44)
            }.buttonStyle(.plain)
        }.padding(.vertical, 8)
    }
}
