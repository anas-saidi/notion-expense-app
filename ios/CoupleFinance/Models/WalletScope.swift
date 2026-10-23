import Foundation

enum WalletScope: String, Codable, CaseIterable, Identifiable {
    case joint, anas, salma
    var id: String { rawValue }
    var title: String { rawValue.capitalized }
    var symbol: String { self == .joint ? "person.2.fill" : "person.fill" }
}
