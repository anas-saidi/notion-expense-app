import Foundation

struct BillPayment: Codable, Equatable, Identifiable {
    var id: String
    var date: String
    var amount: Decimal
    var accountId: String
}
