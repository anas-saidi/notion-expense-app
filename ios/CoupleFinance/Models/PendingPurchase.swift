import Foundation

struct PendingPurchase: Codable, Equatable, Identifiable {
    var id: String
    var name: String
    var amount: Decimal?
    var categoryId: String?
    var addedBy: String?
    var claimedBy: String?
    var date: String?
}
