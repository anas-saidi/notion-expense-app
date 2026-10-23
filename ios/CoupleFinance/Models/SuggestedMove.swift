import Foundation

struct SuggestedMove: Codable, Identifiable {
    var fromId: String
    var toId: String
    var amount: Decimal
    var reason: String
    var id: String { fromId + toId }
}
