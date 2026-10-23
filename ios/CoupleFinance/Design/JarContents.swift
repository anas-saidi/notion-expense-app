import SwiftUI

struct JarContents: View {
    let items: [JarItem]
    private var total: Double { max(1, items.reduce(0) { $0 + $1.amount }) }
    var body: some View {
        GeometryReader { geometry in
            ZStack {
                ForEach(Array(items.prefix(9).enumerated()), id: \.element.id) { index, item in
                    let side = geometry.size.width * min(0.38, max(0.16, sqrt(item.amount / total) * 0.52))
                    Text(item.icon).font(.system(size: side))
                        .position(x: geometry.size.width * (0.3 + Double(index % 3) * 0.2),
                                  y: geometry.size.height * (0.66 - Double(index / 3) * 0.19))
                }
            }
        }.accessibilityHidden(true)
    }
}
