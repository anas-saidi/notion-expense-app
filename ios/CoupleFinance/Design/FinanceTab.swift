import SwiftUI

struct FinanceTab: View {
    let title: String
    let symbol: String
    let index: Int
    @Binding var selection: Int
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    var body: some View {
        Button { selection = index } label: {
            VStack(spacing: 4) {
                Image(systemName: symbol).font(.system(size: 20, weight: selection == index ? .semibold : .regular))
                if !dynamicTypeSize.isAccessibilitySize {
                    Text(title).font(.system(.caption2, design: .rounded, weight: .semibold)).lineLimit(1)
                }
            }
            .foregroundStyle(selection == index ? .primary : .secondary)
            .frame(maxWidth: .infinity, minHeight: 52)
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
        .accessibilityIdentifier("tab-\(title.lowercased())")
        .accessibilityAddTraits(selection == index ? .isSelected : [])
    }
}
