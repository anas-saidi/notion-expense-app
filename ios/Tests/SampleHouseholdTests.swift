#if canImport(CoupleFinance)
import Foundation
import Testing
@testable import CoupleFinance

@MainActor struct SampleHouseholdTests {
    @Test func previewDoesNotChangeTheLiveRepository() async throws {
        let session = try AppSession()
        let original = session.live.backup
        try session.explore()
        #expect(session.active.isDemo)
        #expect(!session.active.categories.isEmpty)
        let draft = TransactionDraft(operation: "expense", input: NativeInput(name: "Sample coffee", amount: 19,
            date: FinanceDate.day(.now), accountId: session.active.accounts.first?.id, categoryId: session.active.categories.first?.id))
        let preview = session.active
        let before = preview.cash
        try await preview.submit(draft)
        try await preview.submit(draft)
        #expect(preview.cash == before.map { $0 - 19 })
        #expect(session.live.backup == original)
        session.exitPreview()
        #expect(!session.active.isDemo)
    }
}
#endif
