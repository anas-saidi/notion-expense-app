import Foundation
import Observation

@MainActor @Observable final class FinanceStore {
    private let repository: LocalRepository
    @ObservationIgnored private let transportOverride: (any FinanceTransport)?
    @ObservationIgnored private let wifiAvailable: @MainActor () -> Bool
    private(set) var backup: FinanceBackup
    private(set) var serverAddress: String
    private(set) var isLoading = false
    private var activeReads = 0
    private(set) var isDemo = false
    private var samplePending: [PendingPurchase] = []
    private var sampleCompleted: Set<UUID> = []
    private(set) var isSubmitting = false
    var error: String?
    private(set) var noticeSequence = 0
    var notice: String? {
        didSet { if notice != nil { noticeSequence += 1 } }
    }
    var scope: WalletScope = .joint
    var selectedMonth = FinanceDate.month(.now)
    var isConnected: Bool { isDemo || !serverAddress.isEmpty }
    var snapshot: FinanceSnapshot? {
        backup.snapshots[selectedMonth].map { PendingTransactions.project($0, drafts: syncQueue) }
    }
    var syncQueue: [TransactionDraft] { backup.drafts.filter { $0.syncState != nil }.sorted { ($0.syncQueuedAt ?? $0.createdAt) < ($1.syncQueuedAt ?? $1.createdAt) } }
    var waitingForSync: Bool { !syncQueue.isEmpty }
    var canSyncOnWiFi: Bool { wifiAvailable() }
    var syncNeedsReview: Bool { syncQueue.contains { $0.syncState == .needsReview } }
    var categories: [FinanceCategory] { snapshot?.categories.filter { $0.scope == scope && $0.archived != true && $0.snoozed != true } ?? [] }
    var accounts: [FinanceAccount] { snapshot?.accounts.filter { $0.scope == scope } ?? [] }
    var transactions: [FinanceTransaction] { snapshot?.transactions.filter { $0.scopes.contains(scope) } ?? [] }
    var bills: [BillOccurrence] { snapshot?.bills.filter { $0.scope == scope } ?? [] }
    var cash: Decimal? {
        let spendable = accounts.filter { !$0.label.localizedStandardContains("saving") && !($0.type?.localizedStandardContains("saving") ?? false) }
        guard !spendable.isEmpty, spendable.allSatisfy({ $0.balance != nil }) else { return nil }
        return spendable.reduce(0) { $0 + ($1.balance ?? 0) }
    }
    var available: Decimal? {
        let spending = categories.filter { !$0.isSavings }
        guard !spending.isEmpty, spending.allSatisfy({ $0.available != nil }) else { return nil }
        return spending.reduce(0) { $0 + ($1.available ?? 0) }
    }
    var spent: Decimal? {
        guard snapshot != nil else { return nil }
        return (backup.snapshots[selectedMonth]?.transactions ?? []).filter { $0.type == "Expense" && $0.scopes.contains(scope) }.reduce(0) { $0 + $1.amount }
    }
    var assigned: Decimal? {
        guard let snapshot else { return nil }
        return snapshot.summary.assignedByCategory.filter { total in categories.contains { $0.id == total.categoryId && !$0.isSavings } }.reduce(0) { $0 + $1.total }
    }

    init(repository: LocalRepository, transport: (any FinanceTransport)? = nil, server: String? = nil,
         wifiAvailable: @escaping @MainActor () -> Bool = { SyncConnectivity.shared.canSync }) throws {
        self.repository = repository
        backup = try repository.load()
        transportOverride = transport
        self.wifiAvailable = wifiAvailable
        serverAddress = server ?? UserDefaults.standard.string(forKey: "financeServer") ?? ""
    }

    /// Latest authoritative bill list from current/next month, independent of the browsed month.
    var reminderBills: [BillOccurrence]? {
        guard !isDemo else { return nil }
        let current = FinanceDate.month(.now)
        let nextDate = FinanceDate.calendar.date(byAdding: .month, value: 1, to: .now) ?? .now
        let next = FinanceDate.month(nextDate)
        return backup.snapshots.values.filter { $0.month == current || $0.month == next }
            .filter { $0.billsError == nil }.max { $0.fetchedAt < $1.fetchedAt }?.bills
    }

    func refreshReminderMonths() async throws {
        guard isConnected, !isDemo, !waitingForSync else { return }
        let api = try api()
        let current = FinanceDate.month(.now)
        let next = FinanceDate.month(FinanceDate.calendar.date(byAdding: .month, value: 1, to: .now) ?? .now)
        for month in [current, next] {
            try Task.checkCancellation()
            let snapshot = try await api.snapshot(month: month)
            try verifyHousehold(snapshot.householdID)
            guard snapshot.billsError == nil else { throw FinanceError.message("Bills could not be refreshed.") }
            var updated = backup
            updated.snapshots[month] = snapshot
            try repository.save(updated)
            backup = updated
        }
    }

    private func api() throws -> FinanceAPI {
        let url = try FinanceAPI.validatedURL(serverAddress)
        guard let key = try DeviceKeychain.read(), !key.isEmpty else { throw FinanceError.message("Connect your finance app in Settings first.") }
        return FinanceAPI(baseURL: url, key: key)
    }

    func connect(address: String, key: String) async throws {
        guard !isDemo else { throw FinanceError.message("Exit the sample household before connecting your real finances.") }
        guard !isLoading else { throw FinanceError.message("Wait for the current refresh to finish.") }
        let url = try FinanceAPI.validatedURL(address)
        guard key.range(of: "^[A-Za-z0-9_-]{32,256}$", options: .regularExpression) != nil else {
            throw FinanceError.message("Enter the device key generated for your native app.")
        }
        if isConnected && url.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/")) != serverAddress.trimmingCharacters(in: CharacterSet(charactersIn: "/")) {
            throw FinanceError.message("This installation is linked to a different server. Export your backup before changing households.")
        }
        activeReads += 1
        isLoading = true
        defer { activeReads -= 1; isLoading = activeReads > 0 }
        let snapshot = try await FinanceAPI(baseURL: url, key: key).snapshot(month: selectedMonth)
        try verifyHousehold(snapshot.householdID)
        try DeviceKeychain.save(key)
        var updated = backup
        updated.householdID = snapshot.householdID
        updated.snapshots[snapshot.month] = snapshot
        try repository.save(updated)
        backup = updated
        serverAddress = url.absoluteString
        UserDefaults.standard.set(serverAddress, forKey: "financeServer")
        error = nil
    }

    func refresh() async {
        guard isConnected, !isSubmitting else { return }
        if !isDemo, syncQueue.contains(where: { $0.syncState == .awaitingRefresh || ($0.syncState == .queued && $0.outcomeUnknown) }) {
            await synchronizeQueuedChanges()
            return
        }
        if isDemo {
            if backup.snapshots[selectedMonth] == nil { backup.snapshots[selectedMonth] = try? SampleHousehold.snapshot(month: selectedMonth) }
            return
        }
        activeReads += 1
        isLoading = true
        defer { activeReads -= 1; isLoading = activeReads > 0 }
        do {
            let snapshot = try await transport().snapshot(month: selectedMonth)
            try verifyHousehold(snapshot.householdID)
            var updated = backup
            updated.householdID = snapshot.householdID
            updated.snapshots[snapshot.month] = snapshot
            try repository.save(updated)
            backup = updated
            error = nil
        } catch {
            if !Task.isCancelled && !((error is URLError || (error as? FinanceError)?.isRetryable == true) && snapshot != nil) { self.error = error.localizedDescription }
        }
    }

    func saveDraft(_ draft: TransactionDraft) throws {
        if let previous = backup.drafts.first(where: { $0.id == draft.id }), previous.outcomeUnknown,
           (!draft.outcomeUnknown || previous.input != draft.input || previous.operation != draft.operation) {
            throw FinanceError.message("This request has already been sent. Check its original outcome before editing it.")
        }
        var updated = backup
        if let index = updated.drafts.firstIndex(where: { $0.id == draft.id }) { updated.drafts[index] = draft }
        else { updated.drafts.append(draft) }
        try repository.save(updated)
        backup = updated
    }

    func removeDraft(_ id: UUID) throws {
        guard !isSubmitting else { throw FinanceError.message("Wait for the current sync to finish before removing a request.") }
        var updated = backup
        updated.drafts.removeAll { $0.id == id }
        try repository.save(updated)
        backup = updated
    }

    private func transport() throws -> any FinanceTransport { try transportOverride ?? api() }

    func submit(_ draft: TransactionDraft) async throws {
        if isDemo { try applySampleOperation(draft); return }
        guard isConnected else { throw FinanceError.message("Connect your finance app before saving changes.") }
        var pending = draft
        // A row created locally has no Notion ID yet. Fold subsequent edits into
        // its unsent request instead of queuing a reference the server cannot resolve.
        if let existing = syncQueue.first(where: { $0.id.uuidString == draft.input.id || ($0.input.id != nil && $0.input.id == draft.input.id) }),
           ["editTransaction", "deleteTransaction", "restoreTransaction"].contains(draft.operation) {
            guard existing.syncState == .queued, !existing.outcomeUnknown else {
                throw FinanceError.message("This transaction is already syncing or needs review. Resolve its saved request first.")
            }
            if draft.operation == "deleteTransaction" && ["expense", "income", "transfer"].contains(existing.operation) {
                try removeDraft(existing.id)
                notice = "Removed from this phone"
                return
            }
            if draft.operation == "restoreTransaction" && existing.operation == "deleteTransaction" {
                try removeDraft(existing.id)
                notice = "Deletion cancelled"
                return
            }
            if draft.operation == "editTransaction" {
                pending = existing
                pending.input.name = draft.input.name
                pending.input.amount = draft.input.amount
                pending.input.date = draft.input.date
                pending.input.accountId = draft.input.accountId
                pending.input.categoryId = draft.input.categoryId
                pending.input.incomeUse = draft.input.incomeUse
            } else { try removeDraft(existing.id) }
        }
        if !pending.outcomeUnknown {
            let original = backup.snapshots.values.flatMap(\.transactions).first { $0.id == pending.input.id }
            pending.originalTransaction = pending.originalTransaction ?? original
            if ["editTransaction", "deleteTransaction"].contains(pending.operation), let original {
                pending.input.expectedTransaction = pending.input.expectedTransaction ?? TransactionExpectation(original)
            }
        }
        if let previous = backup.drafts.first(where: { $0.id == pending.id }), previous.outcomeUnknown,
           (previous.input != pending.input || previous.operation != pending.operation) {
            throw FinanceError.message("Keep the original request unchanged until its outcome is confirmed.")
        }
        if pending.syncState == nil { pending.syncQueuedAt = .now }
        pending.syncState = .queued
        pending.syncError = nil
        try saveDraft(pending)
        OfflineSyncCoordinator.schedule(needed: true)
        notice = "Saved on this phone"
        await synchronizeQueuedChanges()
        if let rejected = backup.drafts.first(where: { $0.id == pending.id && $0.syncState == .needsReview }) {
            throw FinanceError.message(rejected.syncError ?? "Review this change before syncing.")
        }
    }

    /// FIFO, one sender per store. Retrying preserves both identity and payload.
    func synchronizeQueuedChanges() async {
        guard isConnected, !isDemo, wifiAvailable(), !isSubmitting else { return }
        isSubmitting = true
        defer {
            isSubmitting = false
            OfflineSyncCoordinator.schedule(needed: !syncQueue.isEmpty && !syncNeedsReview)
        }
        while let next = syncQueue.first, next.syncState != .needsReview, wifiAvailable(), !Task.isCancelled {
            do {
                let transport = try transport()
                if next.syncState != .awaitingRefresh {
                    var sending = next
                    sending.outcomeUnknown = true
                    try saveDraft(sending)
                    try await transport.submit(sending)
                    // If the app dies here, the stable request ID retrieves the
                    // server receipt. If refresh fails, never POST it again.
                    sending.syncState = .awaitingRefresh
                    try saveDraft(sending)
                }
                var months = Set([selectedMonth])
                for date in [next.input.date, next.originalTransaction?.date] {
                    if let date, FinanceDate.parse(String(date.prefix(10))) != nil { months.insert(String(date.prefix(7))) }
                }
                var fresh: [String: FinanceSnapshot] = [:]
                for month in months.sorted() {
                    try Task.checkCancellation()
                    let value = try await transport.snapshot(month: month)
                    try verifyHousehold(value.householdID)
                    fresh[month] = value
                }
                var updated = backup
                for (month, value) in fresh { updated.snapshots[month] = value }
                updated.drafts.removeAll { $0.id == next.id }
                try repository.save(updated)
                backup = updated
                notice = "Synced to Notion"
            } catch {
                if error is URLError || error is CancellationError || (error as? FinanceError)?.isRetryable == true { return }
                // A committed receipt must survive even a local persistence or
                // refresh error. Retrying that request is safe; changing it isn't.
                if var held = backup.drafts.first(where: { $0.id == next.id }) {
                    if held.syncState != .awaitingRefresh { held.syncState = .needsReview }
                    held.syncError = error.localizedDescription
                    do { try saveDraft(held) } catch { self.error = "Could not update the saved sync request. Your request is still on this phone." }
                }
                return
            }
        }
    }

    func retrySyncRequest(_ id: UUID) async throws {
        guard var draft = backup.drafts.first(where: { $0.id == id }) else { return }
        draft.syncState = draft.syncState == .awaitingRefresh ? .awaitingRefresh : .queued
        draft.syncError = nil
        try saveDraft(draft)
        await synchronizeQueuedChanges()
    }

    func restore(_ data: Data) throws {
        guard !isSubmitting else { throw FinanceError.message("Wait for the current sync to finish before restoring a backup.") }
        let incoming = try FinanceBackup.decode(data)
        if !isDemo && incoming.householdID == "sample-household" { throw FinanceError.message("Sample backups cannot be merged into your real finances.") }
        if let householdID = incoming.householdID { try verifyHousehold(householdID) }
        var updated = backup
        updated.merge(incoming)
        try repository.save(updated)
        backup = updated
        notice = "Backup restored. Review drafts before sending."
    }

    func resource<T: Decodable>(_ kind: String, parameters: [String: String] = [:], as type: T.Type = T.self) async throws -> T {
        if isDemo { return try JSONDecoder().decode(T.self, from: sampleResource(kind, parameters: parameters)) }
        let cacheKey = kind + "?" + parameters.sorted { $0.key < $1.key }.map { $0.key + "=" + $0.value }.joined(separator: "&")
        do {
            let data = try await api().resourceData(kind, parameters: parameters)
            let value = try JSONDecoder().decode(T.self, from: data)
            var updated = backup
            if data.count <= 1_000_000 {
                if updated.resources == nil { updated.resources = [:] }
                updated.resources?[cacheKey] = data
                if (updated.resources?.values.reduce(0, { $0 + $1.count }) ?? 0) > 4_000_000 || (updated.resources?.count ?? 0) > 40 {
                    updated.resources = [cacheKey: data]
                }
            }
            try repository.save(updated)
            backup = updated
            return value
        } catch let failure as URLError {
            guard let cached = backup.resources?[cacheKey] else { throw failure }
            return try JSONDecoder().decode(T.self, from: cached)
        }
    }

    func askAssistant<T: Decodable>(_ request: AssistantRequest, as type: T.Type = T.self) async throws -> T {
        guard !isDemo else { throw FinanceError.message("Gemini is available after connecting your own finance backend. Local Type it parsing works in this preview.") }
        return try JSONDecoder().decode(T.self, from: await api().assistant(request))
    }

    func syncNotion() async throws {
        guard !isDemo else { notice = "Sample data stays on this simulator."; return }
        _ = try await api().resourceData("sync", post: true)
        // Poll the existing import state, then refresh. This is an explicit user action.
        for _ in 0..<30 {
            try await Task.sleep(for: .seconds(2))
            let status: SyncStatus = try await resource("sync")
            if status.syncing != true && status.current == true { await refresh(); return }
        }
        throw FinanceError.message("Notion sync is still running. Refresh again shortly.")
    }

    func loadSampleHousehold() throws {
        isDemo = true
        backup = FinanceBackup(householdID: "sample-household", snapshots: [selectedMonth: try SampleHousehold.snapshot(month: selectedMonth)])
        samplePending = SampleHousehold.pending
        try repository.save(backup)
    }

    private func sampleResource(_ kind: String, parameters: [String: String]) throws -> Data {
        let encoder = JSONEncoder()
        switch kind {
        case "planning": return try encoder.encode(PlanningContext(capacity: ["joint": 17000, "anas": 9000, "salma": 7500], split: ["anas": 0.65, "salma": 0.35]))
        case "pending": return try encoder.encode(PendingResource(items: samplePending))
        case "funds":
            let entries = (snapshot?.summary.assignedByCategory ?? []).map { PlanningFund(id: $0.categoryId, categoryId: $0.categoryId, planned: $0.total, date: selectedMonth + "-01", assignmentType: "Monthly", reverse: false) }
            return try encoder.encode(FundsResource(funds: entries))
        case "activity":
            let id = parameters["id"]
            var entries = (snapshot?.transactions ?? []).filter { $0.category == id || $0.fromCategoryId == id || $0.toCategoryId == id }.map {
                CategoryEvent(id: $0.id, date: $0.date, kind: $0.type == "Transfer" ? "moved_in" : "expense", amount: $0.amount,
                    direction: $0.type == "Income" ? "in" : "out", title: $0.name, sourceDb: "transactions", savingsFundingOperation: $0.savingsFundingOperation)
            }
            if let categoryID = id, let total = snapshot?.summary.assignedByCategory.first(where: { $0.categoryId == categoryID }), total.total > 0 {
                entries.append(CategoryEvent(id: "fund-" + categoryID, date: selectedMonth + "-01", kind: "funded", amount: total.total,
                    direction: "in", title: "Monthly assignment", assignmentType: "Monthly", sourceDb: "funds"))
            }
            return try encoder.encode(CategoryActivity(timeline: entries))
        case "transactions": return try encoder.encode(TransactionsResource(transactions: snapshot?.transactions ?? []))
        default: return Data("{}".utf8)
        }
    }

    private func applySampleOperation(_ draft: TransactionDraft) throws {
        if sampleCompleted.contains(draft.id) { return }
        guard let snapshot else { return }
        let result = try SampleHousehold.apply(draft, to: snapshot, pending: samplePending)
        var updated = backup
        updated.snapshots[selectedMonth] = result.snapshot
        updated.drafts.removeAll { $0.id == draft.id }
        try repository.save(updated)
        backup = updated
        samplePending = result.pending
        sampleCompleted.insert(draft.id)
        notice = "Saved in sample household"
    }

    private func verifyHousehold(_ householdID: String) throws {
        if let current = backup.householdID, current != householdID {
            throw FinanceError.message("This data belongs to a different household. Your existing data has been kept.")
        }
    }

    func stepMonth(_ step: Int) {
        guard let current = FinanceDate.parse(selectedMonth + "-01"),
              let next = FinanceDate.calendar.date(byAdding: .month, value: step, to: current) else { return }
        selectedMonth = FinanceDate.month(next)
    }

    func categoryName(_ id: String?) -> String {
        if id == "__to_joint__" { return "To Joint" }
        if id == nil || id == "__uncategorized__" { return "Uncategorized" }
        return snapshot?.categories.first { $0.id == id }?.name ?? "Archived category"
    }

    func accountName(_ id: String?) -> String {
        snapshot?.accounts.first { $0.id == id }?.label ?? "Unknown account"
    }
}
