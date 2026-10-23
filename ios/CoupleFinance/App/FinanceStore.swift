import Foundation
import Observation

@MainActor @Observable final class FinanceStore {
    private let repository: LocalRepository
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
    var snapshot: FinanceSnapshot? { backup.snapshots[selectedMonth] }
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
        return transactions.filter { $0.type == "Expense" }.reduce(0) { $0 + $1.amount }
    }
    var assigned: Decimal? {
        guard let snapshot else { return nil }
        return snapshot.summary.assignedByCategory.filter { total in categories.contains { $0.id == total.categoryId && !$0.isSavings } }.reduce(0) { $0 + $1.total }
    }

    init(repository: LocalRepository) throws {
        self.repository = repository
        backup = try repository.load()
        serverAddress = UserDefaults.standard.string(forKey: "financeServer") ?? ""
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
        guard isConnected, !isDemo else { return }
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
        guard isConnected else { return }
        if isDemo {
            if backup.snapshots[selectedMonth] == nil { backup.snapshots[selectedMonth] = try? SampleHousehold.snapshot(month: selectedMonth) }
            return
        }
        activeReads += 1
        isLoading = true
        defer { activeReads -= 1; isLoading = activeReads > 0 }
        do {
            let snapshot = try await api().snapshot(month: selectedMonth)
            try verifyHousehold(snapshot.householdID)
            var updated = backup
            updated.householdID = snapshot.householdID
            updated.snapshots[snapshot.month] = snapshot
            try repository.save(updated)
            backup = updated
            error = nil
        } catch {
            if !Task.isCancelled { self.error = error.localizedDescription }
        }
    }

    func saveDraft(_ draft: TransactionDraft) throws {
        var updated = backup
        if let index = updated.drafts.firstIndex(where: { $0.id == draft.id }) { updated.drafts[index] = draft }
        else { updated.drafts.append(draft) }
        try repository.save(updated)
        backup = updated
    }

    func removeDraft(_ id: UUID) throws {
        var updated = backup
        updated.drafts.removeAll { $0.id == id }
        try repository.save(updated)
        backup = updated
    }

    func submit(_ draft: TransactionDraft) async throws {
        guard !isSubmitting else { throw FinanceError.message("A save is already in progress.") }
        if isDemo { try applySampleOperation(draft); return }
        let api = try api()
        isSubmitting = true
        defer { isSubmitting = false }
        var pending = draft
        pending.outcomeUnknown = true
        // Persist the stable request ID before sending any network write.
        try saveDraft(pending)
        try await api.submit(pending)
        try removeDraft(draft.id)
        notice = "Saved to Notion"
        await refresh()
    }

    func restore(_ data: Data) throws {
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
        let data = isDemo ? try sampleResource(kind, parameters: parameters) : try await api().resourceData(kind, parameters: parameters)
        return try JSONDecoder().decode(T.self, from: data)
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
