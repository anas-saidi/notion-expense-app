import Foundation
import Testing
#if canImport(FinanceCore)
@testable import FinanceCore
#else
@testable import CoupleFinance
#endif

struct NativeRebuildTests {
    @Test func parsesMultipleLocalEntriesWithHouseholdDatesAndDecimalComma() throws {
        let reference = try #require(FinanceDate.parse("2026-10-22"))
        let rows = try TypedEntryParser.parse("coffee 19 yesterday\n+salary 1250,50", reference: reference)
        #expect(rows.count == 2)
        #expect(rows[0].name == "coffee")
        #expect(rows[0].date == "2026-10-21")
        #expect(rows[1].amount == Decimal(string: "1250.50"))
        #expect(rows[1].type == "Income")
        #expect(rows[0].draft.id == rows[0].id)
    }
    @Test func doesNotSilentlyOmitAmbiguousBatchLines() {
        #expect(throws: (any Error).self) { try TypedEntryParser.parse("rent 100 internet 200") }
        #expect(throws: (any Error).self) { try TypedEntryParser.parse("coffee yesterday") }
    }
    @Test func planningUsesJointCashBeforeNewContributionsAndKeepsCents() {
        let result = PlanCapacity.remaining(capacity: ["joint": 100, "anas": 100, "salma": 100],
            planned: ["joint": 200, "anas": 20, "salma": 30], split: ["anas": 0.65, "salma": 0.35])
        #expect(result["anas"] == 15)
        #expect(result["salma"] == 35)
        #expect(result["joint"] == Decimal(string: "23.07"))
    }
    @Test func planningMakesUnaffordablePartnerShareVisible() {
        let result = PlanCapacity.remaining(capacity: ["joint": 0, "anas": 100, "salma": 100],
            planned: ["joint": 1000], split: ["anas": 0.65, "salma": 0.35])
        #expect((result["anas"] ?? 0) < 0)
        #expect((result["salma"] ?? 0) < 0)
    }
    @Test func nativeSpendingCountsPartnerContributionsOnceAndNetsReturnedCash() {
        let accounts = [FinanceAccount(id: "a", label: "Hubby Account", icon: "", scope: .anas), FinanceAccount(id: "j", label: "Joined Account", icon: "", scope: .joint)]
        let rows = [
            FinanceTransaction(id: "direct", name: "Shared groceries", amount: 50, date: "2026-10-22", category: "food", accountId: "a", type: "Expense", scopes: [.joint]),
            FinanceTransaction(id: "sent", name: "Contribution", amount: 100, date: "2026-10-22", type: "Transfer", fromAccountId: "a", toAccountId: "j", scopes: [.anas, .joint]),
            FinanceTransaction(id: "returned", name: "Returned", amount: 20, date: "2026-10-22", type: "Transfer", fromAccountId: "j", toAccountId: "a", scopes: [.anas, .joint])
        ]
        #expect(FinanceAnalytics.spending(rows, accounts: accounts, scope: .anas) == [CategoryTotal(categoryId: "__to_joint__", total: 130)])
        #expect(FinanceAnalytics.spending(rows, accounts: accounts, scope: .joint) == [CategoryTotal(categoryId: "food", total: 50)])
    }
    @Test func nativeSpendingIncludesUncategorizedExpensesAndNetsRefunds() {
        let rows = [
            FinanceTransaction(id: "one", name: "Purchase", amount: 20, date: "2026-10-22", type: "Expense", scopes: [.joint]),
            FinanceTransaction(id: "two", name: "Refund", amount: -5, date: "2026-10-22", type: "Expense", scopes: [.joint]),
            FinanceTransaction(id: "three", name: "Salary", amount: 1000, date: "2026-10-22", type: "Income", scopes: [.joint])
        ]
        #expect(FinanceAnalytics.spending(rows, accounts: [], scope: .joint) == [CategoryTotal(categoryId: "__uncategorized__", total: 15)])
    }
    @Test func addedWorkflowDraftsSurviveBackupRoundTrip() throws {
        for operation in ["monthlyPlan", "savingsDeposit", "updateBill", "reconcile", "createPending", "updateCategory"] {
            var input = NativeInput(name: "Sample action")
            input.month = "2026-10"; input.budgetItems = [PlanAllocation(categoryId: "c", amount: 125, defaultAccount: "a")]
            input.actualBalance = 2345
            let draft = TransactionDraft(operation: operation, input: input, outcomeUnknown: true)
            let restored = try FinanceBackup.decode(FinanceBackup(drafts: [draft]).encoded())
            #expect(restored.drafts == [draft])
        }
    }
}
