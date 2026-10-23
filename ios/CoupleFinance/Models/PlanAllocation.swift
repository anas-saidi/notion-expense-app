import Foundation

struct PlanAllocation: Codable, Equatable, Identifiable {
    var categoryId: String
    var amount: Decimal
    var defaultAccount: String?
    var id: String { categoryId }
}
