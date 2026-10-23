import Foundation

struct FinanceSnapshot: Codable, Equatable {
    var schemaVersion: Int
    var householdID: String
    var month: String
    var fetchedAt: String
    var categories: [FinanceCategory]
    var accounts: [FinanceAccount]
    var transactions: [FinanceTransaction]
    var summary: MonthlySummary
    var bills: [BillOccurrence]
    var billsError: String?
    var contributions: ContributionStatus?
}
