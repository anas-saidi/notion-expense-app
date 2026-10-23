#if canImport(CoupleFinance)
import Foundation
import Testing
@testable import CoupleFinance

@MainActor struct LocalRepositoryTests {
    @Test func committedDraftSurvivesReloadOfTheStore() throws {
        let repository = try LocalRepository(inMemory: true)
        let draft = TransactionDraft(input: NativeInput(name: "Persist me", amount: 19), outcomeUnknown: true)
        try repository.save(FinanceBackup(drafts: [draft]))
        let reloaded = try repository.load()
        #expect(reloaded.drafts == [draft])
        #expect(reloaded.drafts[0].id == draft.id)
    }

    @Test func draftsSurviveReopeningTheOnDiskDatabase() throws {
        let directory = FileManager.default.temporaryDirectory.appending(path: "finance-store-test-" + UUID().uuidString, directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        let url = directory.appending(path: "Finance.store")
        let draft = TransactionDraft(input: NativeInput(name: "Retain after update", amount: 127.45), outcomeUnknown: true, syncQueuedAt: .now, syncState: .queued)
        func write() throws {
            let first = try LocalRepository(storeURL: url)
            try first.save(FinanceBackup(drafts: [draft]))
        }
        try write()
        let reopened = try LocalRepository(storeURL: url)
        #expect(try reopened.load().drafts == [draft])
    }

    @Test func corruptRestoreCannotOverwriteVerifiedData() throws {
        let repository = try LocalRepository(inMemory: true)
        let original = FinanceBackup(drafts: [TransactionDraft(input: NativeInput(name: "Keep me", amount: 25))])
        try repository.save(original)
        let store = try FinanceStore(repository: repository)
        #expect(throws: (any Error).self) { try store.restore(Data("corrupt".utf8)) }
        #expect(try repository.load() == original)
    }
}
#endif
