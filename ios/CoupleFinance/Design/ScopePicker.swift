import SwiftUI

struct ScopePicker: View {
    @Environment(FinanceStore.self) private var store
    var body: some View {
        HStack(spacing: 0) {
            ForEach([WalletScope.anas, .joint, .salma]) { scope in
                Button { store.scope = scope } label: {
                    JarArtwork(scope: scope)
                        .frame(width: 30, height: 30)
                        .scaleEffect(store.scope == scope ? 1 : 0.78)
                        .opacity(store.scope == scope ? 1 : 0.5)
                        .frame(width: 44, height: 44)
                        .contentShape(.rect)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(scope.title)
                .accessibilityAddTraits(store.scope == scope ? .isSelected : [])
            }
        }
        .padding(2)
        .overlay { Capsule().stroke(.primary.opacity(0.07), lineWidth: 1) }
        .sensoryFeedback(.selection, trigger: store.scope)
    }
}
