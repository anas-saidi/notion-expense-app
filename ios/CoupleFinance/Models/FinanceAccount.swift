import Foundation

struct FinanceAccount: Codable, Equatable, Hashable, Identifiable {
    var id: String
    var label: String
    var icon: String
    var type: String?
    var balance: Decimal?
    var readyToAssign: Decimal?
    var scope: WalletScope?
}
