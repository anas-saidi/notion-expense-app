#if canImport(CoupleFinance)
import Foundation
import Testing
@testable import CoupleFinance

struct FinanceDeepLinkTests {
    @Test func shortcutOpensTransactionEntry() throws {
        let url = try #require(URL(string: "couplefinance://log-transactions"))
        #expect(FinanceDeepLink.action(for: url) == .logTransactions)
    }

    @Test(arguments: [
        "https://log-transactions", "couplefinance://other",
        "couplefinance://log-transactions/save", "couplefinance://log-transactions?amount=100",
        "couplefinance://log-transactions#save", "couplefinance://user@log-transactions",
        "couplefinance://log-transactions:80"
    ]) func unsupportedLinksAreIgnored(value: String) throws {
        let url = try #require(URL(string: value))
        #expect(FinanceDeepLink.action(for: url) == nil)
    }
}
#endif
