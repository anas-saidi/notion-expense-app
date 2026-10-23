#if canImport(CoupleFinance)
import Foundation
import Testing
@testable import CoupleFinance

private actor OfflineTransport: FinanceTransport {
    var value: FinanceSnapshot
    var writes: [TransactionDraft] = []
    var committed: Set<UUID> = []
    var loseNextReceipt = false
    var failRefresh = false
    var conflict = false
    init(_ value: FinanceSnapshot) { self.value = value }
    func loseReceipt() { loseNextReceipt = true }
    func failNextRefresh() { failRefresh = true }
    func rejectWrites() { conflict = true }
    func sent() -> [TransactionDraft] { writes }
    func snapshot(month: String) async throws -> FinanceSnapshot {
        if failRefresh { failRefresh = false; throw URLError(.notConnectedToInternet) }
        var snapshot = value
        snapshot.month = month
        snapshot.transactions = value.transactions.filter { $0.date.hasPrefix(month) }
        return snapshot
    }
    func submit(_ draft: TransactionDraft) async throws {
        writes.append(draft)
        if conflict { throw FinanceError.server(409, "This transaction changed in Notion. Review the edit.") }
        if committed.insert(draft.id).inserted {
            value.transactions.append(FinanceTransaction(id: "remote-" + draft.id.uuidString, name: draft.title,
                amount: draft.input.amount ?? 0, date: draft.input.date ?? "2026-10-23", type: "Expense", scopes: [.joint]))
        }
        if loseNextReceipt { loseNextReceipt = false; throw URLError(.networkConnectionLost) }
    }
}

@MainActor private final class TestWiFi { var available = false }

@MainActor struct OfflineSyncTests {
    private func fixture() throws -> FinanceSnapshot {
        var snapshot = try SampleHousehold.snapshot(month: "2026-10")
        snapshot.householdID = "offline-sync-test"
        return snapshot
    }
    private func request() -> TransactionDraft {
        TransactionDraft(input: NativeInput(name: "Offline coffee", amount: 19.95, date: "2026-10-23",
            accountId: "00000000-0000-4000-8000-000000000001", categoryId: "00000000-0000-4000-8000-000000000011"))
    }
    private func store(_ repository: LocalRepository, _ transport: OfflineTransport, _ wifi: TestWiFi) throws -> FinanceStore {
        let store = try FinanceStore(repository: repository, transport: transport, server: "https://example.invalid", wifiAvailable: { wifi.available })
        store.selectedMonth = "2026-10"
        return store
    }
    @Test func offlineSaveSurvivesStoreReloadAndWaitsForWiFi() async throws {
        let snapshot = try fixture(), repository = try LocalRepository(inMemory: true), wifi = TestWiFi()
        try repository.save(FinanceBackup(householdID: snapshot.householdID, snapshots: [snapshot.month: snapshot]))
        let transport = OfflineTransport(snapshot), first = try store(repository, transport, wifi)
        let draft = request()
        try await first.submit(draft)
        #expect(await transport.sent().isEmpty)
        #expect(first.syncQueue.first?.id == draft.id)
        #expect(first.syncQueue.first?.outcomeUnknown == false)
        let reopened = try store(repository, transport, wifi)
        #expect(reopened.snapshot?.transactions.last?.name == "Offline coffee")
        #expect(reopened.snapshot?.transactions.last?.pendingSync == true)
        #expect(reopened.snapshot?.accounts == snapshot.accounts)
        wifi.available = true
        await reopened.synchronizeQueuedChanges()
        #expect(reopened.syncQueue.isEmpty)
        #expect(await transport.sent().map(\.id) == [draft.id])
        #expect(reopened.snapshot?.transactions.filter { $0.name == "Offline coffee" }.count == 1)
    }
    @Test func lostReceiptRetriesSameIdentityAndPayloadWithoutDuplicateRecord() async throws {
        let snapshot = try fixture(), repository = try LocalRepository(inMemory: true), wifi = TestWiFi()
        try repository.save(FinanceBackup(householdID: snapshot.householdID, snapshots: [snapshot.month: snapshot]))
        let transport = OfflineTransport(snapshot), store = try store(repository, transport, wifi)
        await transport.loseReceipt()
        wifi.available = true
        let draft = request()
        try await store.submit(draft)
        #expect(store.syncQueue.first?.outcomeUnknown == true)
        #expect(store.syncQueue.first?.syncState == .queued)
        var changed = draft; changed.input.amount = 50
        #expect(throws: (any Error).self) { try store.saveDraft(changed) }
        do { try await store.submit(changed); Issue.record("An attempted request was mutated") } catch { }
        await store.synchronizeQueuedChanges()
        let writes = await transport.sent()
        #expect(writes.count == 2)
        #expect(writes[0].id == writes[1].id)
        #expect(writes[0].input == writes[1].input)
        #expect(store.syncQueue.isEmpty)
        #expect(store.snapshot?.transactions.filter { $0.name == "Offline coffee" }.count == 1)
    }
    @Test func committedWriteWithFailedRefreshOnlyRefreshesOnNextConnection() async throws {
        let snapshot = try fixture(), repository = try LocalRepository(inMemory: true), wifi = TestWiFi()
        try repository.save(FinanceBackup(householdID: snapshot.householdID, snapshots: [snapshot.month: snapshot]))
        let transport = OfflineTransport(snapshot), store = try store(repository, transport, wifi)
        await transport.failNextRefresh()
        wifi.available = true
        try await store.submit(request())
        #expect(store.syncQueue.first?.syncState == .awaitingRefresh)
        await store.synchronizeQueuedChanges()
        #expect(await transport.sent().count == 1)
        #expect(store.syncQueue.isEmpty)
        #expect(store.snapshot?.transactions.filter { $0.name == "Offline coffee" }.count == 1)
    }
    @Test func repeatedOfflineEditsCoalesceAndDeletingUnsentCreationCancelsIt() async throws {
        let snapshot = try fixture(), repository = try LocalRepository(inMemory: true), wifi = TestWiFi()
        try repository.save(FinanceBackup(householdID: snapshot.householdID, snapshots: [snapshot.month: snapshot]))
        let transport = OfflineTransport(snapshot), store = try store(repository, transport, wifi)
        let draft = request()
        try await store.submit(draft)
        var input = draft.input; input.id = draft.id.uuidString; input.amount = 27.45
        try await store.submit(TransactionDraft(operation: "editTransaction", input: input))
        #expect(store.syncQueue.count == 1)
        #expect(store.syncQueue.first?.id == draft.id)
        #expect(store.syncQueue.first?.operation == "expense")
        #expect(store.syncQueue.first?.input.amount == Decimal(string: "27.45"))
        try await store.submit(TransactionDraft(operation: "deleteTransaction", input: NativeInput(id: draft.id.uuidString)))
        wifi.available = true
        await store.synchronizeQueuedChanges()
        #expect(store.syncQueue.isEmpty)
        #expect(await transport.sent().isEmpty)
    }
    @Test func editingCachedTransactionShowsLocalEditAndCapturesOriginalVersion() async throws {
        let snapshot = try fixture(), repository = try LocalRepository(inMemory: true), wifi = TestWiFi()
        let original = try #require(snapshot.transactions.first { $0.type == "Expense" })
        try repository.save(FinanceBackup(householdID: snapshot.householdID, snapshots: [snapshot.month: snapshot]))
        let transport = OfflineTransport(snapshot), store = try store(repository, transport, wifi)
        let input = NativeInput(name: "Edited offline", amount: 32.45, date: original.date,
            accountId: original.accountId, categoryId: original.category, id: original.id)
        try await store.submit(TransactionDraft(operation: "editTransaction", input: input))
        #expect(store.snapshot?.transactions.first { $0.id == original.id }?.name == "Edited offline")
        #expect(store.syncQueue.first?.input.expectedTransaction == TransactionExpectation(original))
        #expect(try repository.load().snapshots[snapshot.month]?.transactions.first { $0.id == original.id }?.name == original.name)
    }
    @Test func serverConflictPausesQueueInOrderInsteadOfSendingLaterChanges() async throws {
        let snapshot = try fixture(), repository = try LocalRepository(inMemory: true), wifi = TestWiFi()
        try repository.save(FinanceBackup(householdID: snapshot.householdID, snapshots: [snapshot.month: snapshot]))
        let transport = OfflineTransport(snapshot), store = try store(repository, transport, wifi)
        try await store.submit(request())
        try await store.submit(request())
        await transport.rejectWrites()
        wifi.available = true
        await store.synchronizeQueuedChanges()
        #expect(await transport.sent().count == 1)
        #expect(store.syncQueue.count == 2)
        #expect(store.syncQueue.first?.syncState == .needsReview)
        await store.synchronizeQueuedChanges()
        #expect(await transport.sent().count == 1)
    }
    @Test func manualAndRestoredDraftsNeverSendAutomatically() async throws {
        let snapshot = try fixture(), repository = try LocalRepository(inMemory: true), wifi = TestWiFi()
        try repository.save(FinanceBackup(householdID: snapshot.householdID, snapshots: [snapshot.month: snapshot]))
        let transport = OfflineTransport(snapshot), store = try store(repository, transport, wifi)
        try store.saveDraft(request())
        var queued = request(); queued.syncState = .queued
        try store.restore(FinanceBackup(householdID: snapshot.householdID, drafts: [queued]).encoded())
        wifi.available = true
        await store.synchronizeQueuedChanges()
        #expect(store.syncQueue.isEmpty)
        #expect(store.backup.drafts.count == 2)
        #expect(await transport.sent().isEmpty)
    }
}
#endif
