#if canImport(CoupleFinance)
import Foundation
import Testing
@testable import CoupleFinance

struct BillReminderTests {
    private let now = FinanceDate.parse("2026-10-20")!
    private func bill(id: String = "rent:2026-10", state: String = "Due", due: String = "2026-10-25") -> BillOccurrence {
        BillOccurrence(id: id, billId: "rent", period: "2026-10", name: "Rent", amount: 5000,
                       categoryId: "home", dueDate: due, state: state, scope: .joint)
    }
    private var enabled: ReminderPreferences {
        var result = ReminderPreferences(); result.enabled = true; return result
    }
    @Test func disabledAndSettledBillsNeverSchedule() {
        #expect(BillReminderPlanner.make(bills: [bill()], preferences: ReminderPreferences(), now: now).isEmpty)
        #expect(BillReminderPlanner.make(bills: [bill(state: "Paid"), bill(id: "skipped", state: "Skipped")], preferences: enabled, now: now).isEmpty)
    }
    @Test func scheduleUsesHouseholdDatesAndHour() {
        let rows = BillReminderPlanner.make(bills: [bill()], preferences: enabled, now: now)
        #expect(rows.map { FinanceDate.day($0.date) } == ["2026-10-24", "2026-10-25", "2026-10-26"])
        #expect(rows.allSatisfy { FinanceDate.calendar.component(.hour, from: $0.date) == 9 })
    }
    @Test func datesCrossMonthAndYearWithoutLosingBeforeReminder() {
        let rows = BillReminderPlanner.make(bills: [bill(due: "2027-01-01")], preferences: enabled, now: FinanceDate.parse("2026-12-30")!)
        #expect(rows.map { FinanceDate.day($0.date) } == ["2026-12-31", "2027-01-01", "2027-01-02"])
    }
    @Test func privacyIsDefaultAndCanBeExplicitlyEnabled() {
        let privateRows = BillReminderPlanner.make(bills: [bill()], preferences: enabled, now: now)
        #expect(privateRows.allSatisfy { !$0.title.contains("Rent") && !$0.body.contains("5000") && !$0.body.contains("5.000") })
        var preferences = enabled; preferences.showDetails = true
        #expect(BillReminderPlanner.make(bills: [bill()], preferences: preferences, now: now).first?.title == "Rent")
    }
    @Test func duplicateOccurrencesKeepStableIdentifiers() {
        let one = BillReminderPlanner.make(bills: [bill()], preferences: enabled, now: now)
        let duplicate = BillReminderPlanner.make(bills: [bill(), bill()], preferences: enabled, now: now)
        #expect(one == duplicate)
    }
    @Test func overdueBillsGetOneFutureFollowUpWithoutBacklog() {
        let rows = BillReminderPlanner.make(bills: [bill(state: "Overdue", due: "2026-10-01")], preferences: enabled, now: now)
        #expect(rows.count == 1)
        #expect(rows.first.map { FinanceDate.day($0.date) } == "2026-10-21")
        #expect(rows.allSatisfy { $0.date > now })
    }
    @Test func individualOptionsAreRespected() {
        var preferences = enabled; preferences.dayBefore = false; preferences.overdue = false; preferences.hour = 18
        let rows = BillReminderPlanner.make(bills: [bill()], preferences: preferences, now: now)
        #expect(rows.count == 1)
        #expect(rows.first.map { FinanceDate.day($0.date) } == "2026-10-25")
        #expect(rows.first.map { FinanceDate.calendar.component(.hour, from: $0.date) } == 18)
    }
    @Test func invalidDatesAreRejectedAndQueueIsBounded() {
        #expect(BillReminderPlanner.make(bills: [bill(due: "2026-02-31")], preferences: enabled, now: now).isEmpty)
        let rows = BillReminderPlanner.make(bills: (0..<30).map { bill(id: "bill-\($0)") }, preferences: enabled, now: now)
        #expect(rows.count == 60)
        #expect(Set(rows.map(\.id)).count == rows.count)
        #expect(rows == rows.sorted { $0.date == $1.date ? $0.id < $1.id : $0.date < $1.date })
    }
}
#endif
