import SwiftUI

struct FinanceTabBar: View {
    @Binding var selection: Int
    let add: () -> Void
    var addEnabled: Bool
    var body: some View {
        HStack(spacing: 12) {
            HStack(spacing: 0) {
                FinanceTab(title: "Home", symbol: "house", index: 0, selection: $selection)
                FinanceTab(title: "Budget", symbol: "slider.horizontal.3", index: 1, selection: $selection)
                FinanceTab(title: "Reflect", symbol: "chart.pie", index: 2, selection: $selection)
            }
            .padding(.horizontal, 8).padding(.vertical, 4)
            .background(.regularMaterial, in: .capsule)
            .shadow(color: .black.opacity(0.09), radius: 16, x: 0, y: 8)
            Button("Add transaction", systemImage: "plus", action: add)
                .labelStyle(.iconOnly).font(.system(size: 22, weight: .semibold))
                .frame(width: 58, height: 58)
                .foregroundStyle(Color(.systemBackground)).background(.primary, in: .circle)
                .buttonStyle(.plain).disabled(!addEnabled)
        }
        .padding(.horizontal, 16).padding(.top, 8).padding(.bottom, 4)
        .frame(maxWidth: 640)
    }
}
