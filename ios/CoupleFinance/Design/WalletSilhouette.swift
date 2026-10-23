import SwiftUI

/// Same radial profiles as the PWA's mascot/poses.ts: Anas's squircle,
/// Salma's egg, and their midpoint for Joint.
struct WalletSilhouette: Shape {
    let scope: WalletScope

    func path(in rect: CGRect) -> Path {
        let points = (0..<64).map { index -> CGPoint in
            let theta = Double(index) / 64 * .pi * 2
            let c = cos(theta), s = sin(theta)
            let anas = 0.93 * pow(pow(abs(c), 3.2) + pow(abs(s), 3.2), -1 / 3.2) * (1 + 0.035 * s)
            let salma = pow(pow(abs(c / 0.9), 2.1) + pow(abs(s / 1.04), 2.1), -1 / 2.1) * (1 + 0.07 * s)
            let radius = scope == .anas ? anas : scope == .salma ? salma : (anas + salma) / 2
            let scale = min(rect.width, rect.height) * 0.4
            return CGPoint(x: rect.midX + radius * c * scale, y: rect.midY + radius * s * scale)
        }
        var path = Path()
        path.move(to: points[0])
        for i in points.indices {
            let p0 = points[(i + 63) % 64], p1 = points[i]
            let p2 = points[(i + 1) % 64], p3 = points[(i + 2) % 64]
            path.addCurve(to: p2,
                          control1: CGPoint(x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6),
                          control2: CGPoint(x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6))
        }
        path.closeSubpath()
        return path
    }
}
