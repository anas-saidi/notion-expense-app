import Foundation

struct RebalanceSuggestion: Codable { var explanation: String; var moves: [SuggestedMove]; var balances: [String: Decimal] }
