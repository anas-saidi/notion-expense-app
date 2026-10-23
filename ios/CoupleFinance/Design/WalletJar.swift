import SwiftUI

struct WalletJar: View {
    let scope: WalletScope
    let fraction: Double
    var detail = ""
    var size: CGFloat = 175
    var warning = true
    var items: [JarItem] = []
    @State private var expanded = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var body: some View {
        VStack(spacing: 4) {
            Button { expanded.toggle() } label: {
                JarArtwork(scope: scope, fraction: fraction, warning: warning, items: expanded ? items : [])
                    .frame(width: size, height: size)
                    .scaleEffect(expanded ? 0.97 : 1)
            }.buttonStyle(.plain)
                .accessibilityLabel("\(scope.title) wallet. \(detail)")
                .accessibilityValue(expanded ? "Details shown" : "Details hidden")
                .accessibilityHint("Show budget details")
                .sensoryFeedback(trigger: expanded) { _, isExpanded in
                    isExpanded ? .impact(weight: .light, intensity: 0.5) : .selection
                }
            if expanded { Text(detail).font(.caption).foregroundStyle(.secondary).multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true) }
        }
        .animation(reduceMotion ? nil : .easeOut(duration: 0.2), value: expanded)
        .animation(reduceMotion ? nil : .easeOut(duration: 0.32), value: fraction)
    }
}
