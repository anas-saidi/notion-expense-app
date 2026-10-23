import SwiftUI

struct JarArtwork: View {
    let scope: WalletScope
    var fraction: Double = 1
    var warning = false
    var categoryIcon: String?
    var categoryColor: Color?
    var items: [JarItem] = []
    private var colors: [Color] {
        if let categoryColor { return [categoryColor] }
        if warning && fraction <= 0.2 { return [Color(red: 0.95, green: 0.69, blue: 0.67)] }
        return scope == .joint ? [FinanceTheme.anas, FinanceTheme.salma] : [scope == .anas ? FinanceTheme.anas : FinanceTheme.salma]
    }
    var body: some View {
        GeometryReader { geometry in
            let size = min(geometry.size.width, geometry.size.height)
            let level = min(1, max(0, fraction))
            ZStack {
                Ellipse().fill(.primary.opacity(0.07))
                    .frame(width: size * 0.48, height: size * 0.045)
                    .blur(radius: size * 0.025).offset(y: size * 0.43)
                ZStack(alignment: .bottom) {
                    WalletSilhouette(scope: scope)
                        .fill(LinearGradient(colors: colors.map { $0.opacity(0.11) }, startPoint: .top, endPoint: .bottom))
                    Rectangle()
                        .fill(LinearGradient(colors: colors.map { $0.opacity(0.45) }, startPoint: .leading, endPoint: .trailing))
                        .frame(height: size * (0.1 + level * 0.8))
                }
                .clipShape(WalletSilhouette(scope: scope))
                WalletSilhouette(scope: scope).stroke(.primary.opacity(0.09), lineWidth: 0.7)
                if !items.isEmpty {
                    JarContents(items: items).clipShape(WalletSilhouette(scope: scope))
                } else if let categoryIcon {
                    Text(categoryIcon).font(.system(size: size * 0.34))
                        .offset(y: size * (0.24 - level * 0.26))
                } else {
                    HStack(spacing: size * 0.14) {
                        Capsule().frame(width: size * 0.055, height: size * 0.12)
                        Capsule().frame(width: size * 0.055, height: size * 0.12)
                    }.offset(y: size * 0.035)
                }
            }.frame(width: geometry.size.width, height: geometry.size.height)
        }.accessibilityHidden(true)
    }
}
