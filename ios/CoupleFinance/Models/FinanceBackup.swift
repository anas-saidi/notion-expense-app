import Foundation

struct FinanceBackup: Codable, Equatable {
    var format = "couple-finance-backup"
    var version = 1
    var householdID: String?
    var exportedAt = Date.now
    var snapshots: [String: FinanceSnapshot] = [:]
    var drafts: [TransactionDraft] = []
    var resources: [String: Data]?

    static func decode(_ data: Data) throws -> Self {
        guard data.count <= 25_000_000 else { throw FinanceError.message("This backup exceeds the 25 MB limit.") }
        let backup = try JSONDecoder().decode(Self.self, from: data)
        guard backup.format == "couple-finance-backup", backup.version == 1,
              Set(backup.drafts.map(\.id)).count == backup.drafts.count,
              backup.snapshots.allSatisfy({ $0.key == $0.value.month && $0.value.schemaVersion == 1 && (backup.householdID == nil || backup.householdID == $0.value.householdID) }),
              backup.drafts.allSatisfy({ NativeOperation.allowed.contains($0.operation) && ($0.input.amount.map { $0 > 0 } ?? true) })
        else { throw FinanceError.message("This backup is invalid or uses a newer format. Nothing was changed.") }
        return backup
    }

    func encoded() throws -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        return try encoder.encode(self)
    }

    /// Existing drafts win. Restored drafts always require review; never submit on restore.
    mutating func merge(_ other: Self) {
        if householdID == nil { householdID = other.householdID }
        for var draft in other.drafts where !drafts.contains(where: { $0.id == draft.id }) {
            draft.syncQueuedAt = nil
            draft.syncState = nil
            draft.syncError = nil
            drafts.append(draft)
        }
        for (month, snapshot) in other.snapshots {
            if let current = snapshots[month], current.fetchedAt >= snapshot.fetchedAt { continue }
            snapshots[month] = snapshot
        }
    }
}
