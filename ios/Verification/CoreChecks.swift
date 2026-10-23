import Foundation

@main struct CoreChecks {
    static func main() throws {
        var count = 0
        func check(_ condition: Bool, _ message: String) throws {
            guard condition else { throw FinanceError.message(message) }
            count += 1
        }
        let draft = TransactionDraft(input: NativeInput(name: "Groceries", amount: Decimal(string: "127.45"), date: "2026-10-22", accountId: "a", categoryId: "c"), outcomeUnknown: true)
        let original = FinanceBackup(drafts: [draft])
        let restored = try FinanceBackup.decode(original.encoded())
        try check(restored == original, "Backup round trip changed data")
        try check(restored.drafts[0].id == draft.id && restored.drafts[0].outcomeUnknown, "Request identity was lost")
        try check(restored.drafts[0].input.amount == Decimal(string: "127.45"), "Financial precision changed")
        var merged = FinanceBackup()
        merged.merge(restored); merged.merge(restored)
        try check(merged.drafts.count == 1, "Repeated restore duplicated drafts")
        var edited = draft; edited.input.name = "Updated"
        merged.drafts = [edited]; merged.merge(original)
        try check(merged.drafts[0].input.name == "Updated", "Restore replaced a local edit")
        var future = original; future.version = 2
        var rejected = false
        do { _ = try FinanceBackup.decode(future.encoded()) } catch { rejected = true }
        try check(rejected, "Accepted unsupported backup version")
        rejected = false
        do { _ = try FinanceBackup.decode(FinanceBackup(drafts: [draft, draft]).encoded()) } catch { rejected = true }
        try check(rejected, "Accepted duplicate request IDs")
        let date = try Date("2026-06-30T23:30:00Z", strategy: .iso8601)
        try check(FinanceDate.month(date) == "2026-07", "Used incorrect household calendar")
        print("Passed \(count) native core checks.")
    }
}
