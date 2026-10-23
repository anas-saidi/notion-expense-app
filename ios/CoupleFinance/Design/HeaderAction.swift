import SwiftUI

struct HeaderAction: View {
    let title: String
    let symbol: String
    let action: () -> Void
    @State private var taps = 0
    var body: some View {
        Button(title, systemImage: symbol) { taps += 1; action() }
            .labelStyle(.iconOnly).font(.system(size: 18, weight: .medium))
            .frame(width: 44, height: 44)
            .overlay { Circle().stroke(.primary.opacity(0.12), lineWidth: 1) }
            .buttonStyle(.plain)
            .sensoryFeedback(.impact(weight: .light, intensity: 0.4), trigger: taps)
    }
}
