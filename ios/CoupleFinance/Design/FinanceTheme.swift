import SwiftUI

enum FinanceTheme {
    static let ink = Color("Ink")
    static let canvas = Color("Canvas")
    static let secondary = Color.secondary
    static let expense = Color("Expense")
    static let income = Color("Income")
    static let transfer = Color("Transfer")
    static let anas = Color(red: 106 / 255, green: 166 / 255, blue: 230 / 255)
    static let salma = Color(red: 232 / 255, green: 108 / 255, blue: 149 / 255)
    static let spacing: CGFloat = 24
    static let sectionSpacing: CGFloat = 24
    static let radius: CGFloat = 16
    static func amountColor(type: String?) -> Color {
        type == "Income" ? income : type == "Transfer" ? transfer : expense
    }
    static func scopeColor(_ scope: WalletScope) -> Color {
        switch scope { case .joint: Color(red: 0.66, green: 0.54, blue: 0.74); case .anas: anas; case .salma: Color("Salma") }
    }
}
