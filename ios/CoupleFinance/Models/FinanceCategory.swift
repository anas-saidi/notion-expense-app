import Foundation

struct FinanceCategory: Codable, Equatable, Identifiable {
    var id: String
    var name: String
    var icon: String?
    var type: [String]
    var owner: String?
    var defaultAccount: String?
    var available: Decimal?
    var planned: Decimal?
    var goal: Decimal?
    var goalDate: String?
    var isTeamFund: Bool
    var scope: WalletScope?
    var snoozed: Bool?
    var archived: Bool?
    var spendingPattern: String?
    var isSavings: Bool {
        let values = type.map { $0.lowercased() }
        if values.contains(where: { $0.contains("team") || $0.contains("household") }) { return false }
        return values.contains { value in ["saving", "sinking", "goal", "fund"].contains { value.contains($0) } }
    }
}
