import Foundation

struct BillOccurrence: Codable, Equatable, Identifiable {
    var id: String
    var billId: String
    var period: String
    var name: String
    var amount: Decimal
    var categoryId: String
    var dueDate: String
    var accountId: String?
    var state: String
    var scope: WalletScope?
    var `repeat`: String?
    var payments: [BillPayment]?
}
