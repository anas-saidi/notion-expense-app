import Foundation
import Testing
#if canImport(FinanceCore)
@testable import FinanceCore
#else
@testable import CoupleFinance
#endif

struct FinanceCoreTests {
    @Test func backupRoundTripPreservesUnknownRequestIdentityAndCents() throws {
        let id = UUID()
        let amount = try #require(Decimal(string: "127.45"))
        let draft = TransactionDraft(id: id, operation: "expense", input: NativeInput(name: "Groceries", amount: amount,
            date: "2026-10-22", accountId: "account", categoryId: "category"), outcomeUnknown: true)
        let backup = FinanceBackup(drafts: [draft])
        let restored = try FinanceBackup.decode(backup.encoded())
        #expect(restored.drafts[0].id == id)
        #expect(restored.drafts[0].input.amount == amount)
        #expect(restored.drafts[0].outcomeUnknown)
    }

    @Test func restoringSameBackupTwiceDoesNotDuplicateDrafts() throws {
        let draft = TransactionDraft(input: NativeInput(name: "Rent", amount: 100))
        let incoming = FinanceBackup(drafts: [draft])
        var local = FinanceBackup()
        local.merge(incoming)
        local.merge(incoming)
        #expect(local.drafts.count == 1)
        #expect(local.drafts[0].id == draft.id)
    }

    @Test func olderBackupCannotReplaceEditedLocalDraft() {
        var old = TransactionDraft(input: NativeInput(name: "Old", amount: 100))
        var current = old
        current.input.name = "Updated"
        old.outcomeUnknown = true
        var backup = FinanceBackup(drafts: [current])
        backup.merge(FinanceBackup(drafts: [old]))
        #expect(backup.drafts[0].input.name == "Updated")
        #expect(!backup.drafts[0].outcomeUnknown)
    }

    @Test func rejectsUnknownVersionAndWrongFormat() throws {
        var backup = FinanceBackup()
        backup.version = 2
        #expect(throws: (any Error).self) { try FinanceBackup.decode(backup.encoded()) }
        backup.version = 1
        backup.format = "unrelated"
        #expect(throws: (any Error).self) { try FinanceBackup.decode(backup.encoded()) }
    }

    @Test func rejectsCorruptDuplicateAndNegativeDrafts() throws {
        #expect(throws: (any Error).self) { try FinanceBackup.decode(Data("invalid".utf8)) }
        let draft = TransactionDraft(input: NativeInput(amount: 12))
        let duplicate = FinanceBackup(drafts: [draft, draft])
        #expect(throws: (any Error).self) { try FinanceBackup.decode(duplicate.encoded()) }
        let negative = FinanceBackup(drafts: [TransactionDraft(input: NativeInput(amount: -1))])
        #expect(throws: (any Error).self) { try FinanceBackup.decode(negative.encoded()) }
    }

    @Test func validRestoreDoesNotIncludeServerOrCredentials() throws {
        let text = String(decoding: try FinanceBackup(drafts: [TransactionDraft()]).encoded(), as: UTF8.self)
        #expect(!text.contains("deviceKey"))
        #expect(!text.contains("serverAddress"))
        #expect(!text.contains("NOTION_TOKEN"))
    }

    @Test func usesCasablancaCalendarAcrossUTCMonthBoundary() throws {
        let date = try Date("2026-06-30T23:30:00Z", strategy: .iso8601)
        #expect(FinanceDate.day(date) == "2026-07-01")
        #expect(FinanceDate.month(date) == "2026-07")
        let leap = try #require(FinanceDate.parse("2028-02-29"))
        #expect(FinanceDate.day(leap) == "2028-02-29")
    }

    @Test func distinguishesExpenseIncomeAndTransfer() throws {
        let json = """
        {"id":"one","name":"Coffee","amount":12.45,"date":"2026-10-22","type":"Expense","incomeUse":"unassigned","scopes":["joint"]}
        """
        let transaction = try JSONDecoder().decode(FinanceTransaction.self, from: Data(json.utf8))
        #expect(transaction.signedAmount == Decimal(string: "-12.45"))
        #expect(transaction.scopes == [.joint])
        #expect(transaction.incomeUse == "unassigned")
    }
}
