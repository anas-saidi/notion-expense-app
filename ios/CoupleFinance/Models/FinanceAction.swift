import Foundation

enum FinanceAction: Equatable {
    case logTransactions
    case bills(month: String?, scope: WalletScope?)
}
