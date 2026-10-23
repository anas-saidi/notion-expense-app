import SwiftUI

struct CategoryGlyph: View {
    let category: FinanceCategory
    var body: some View {
        Group {
            if let icon = category.icon, !icon.isEmpty { Text(icon).font(.title2) }
            else { Image(systemName: category.isSavings ? "target" : "square.grid.2x2") }
        }.frame(width: 36, height: 44).accessibilityHidden(true)
    }
}
