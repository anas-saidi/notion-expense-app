import Foundation

struct MonthlySummary: Codable, Equatable {
    var start: String
    var end: String
    var totalAssigned: Decimal
    var totalSpent: Decimal
    var assignedByCategory: [CategoryTotal]
    var spentByCategory: [CategoryTotal]
}
