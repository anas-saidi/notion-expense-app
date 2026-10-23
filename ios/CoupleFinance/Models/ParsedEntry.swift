import Foundation

struct ParsedEntry: Codable, Identifiable {
    var name: String
    var amount: Decimal
    var date: String
    var type: String
    var categoryId: String?
    var accountId: String?
    var id: String { name + date + amount.description }
}
