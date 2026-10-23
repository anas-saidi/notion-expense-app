import Foundation

struct ContributionStatus: Codable, Equatable {
    var fundingGap: Decimal
    var anasPlan: Decimal
    var salmaPlan: Decimal
    var anasActual: Decimal
    var salmaActual: Decimal
    // Optional so backups and cached snapshots from earlier builds still open.
    var anasPersonalDebt: Decimal?
    var salmaPersonalDebt: Decimal?

    func personalDebt(for scope: WalletScope) -> Decimal {
        switch scope {
        case .anas: max(0, anasPersonalDebt ?? 0)
        case .salma: max(0, salmaPersonalDebt ?? 0)
        case .joint: max(0, anasPersonalDebt ?? 0) + max(0, salmaPersonalDebt ?? 0)
        }
    }
}
