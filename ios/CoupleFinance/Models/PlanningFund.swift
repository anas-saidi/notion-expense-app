import Foundation

struct PlanningFund: Codable, Equatable, Identifiable {
    var id: String
    var categoryId: String?
    var planned: Decimal
    var date: String?
    var assignmentType: String?
    var reverse: Bool
}
