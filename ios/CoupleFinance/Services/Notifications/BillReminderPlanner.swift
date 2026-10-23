import Foundation

/// A bounded, deterministic schedule using the household's Casablanca calendar.
enum BillReminderPlanner {
    static let prefix = "finance.bill."
    static func make(bills: [BillOccurrence], preferences: ReminderPreferences, now: Date = .now) -> [BillReminder] {
        guard preferences.enabled else { return [] }
        let calendar = FinanceDate.calendar
        var result: [String: BillReminder] = [:]
        for bill in bills where ["Due", "Overdue"].contains(bill.state) {
            guard let due = FinanceDate.parse(bill.dueDate), FinanceDate.day(due) == bill.dueDate else { continue }
            let dueStart = calendar.startOfDay(for: due)
            var events: [(String, Date, String)] = []
            if preferences.dayBefore, let date = calendar.date(byAdding: .day, value: -1, to: dueStart) {
                events.append(("before", date, "due tomorrow"))
            }
            if preferences.dueDay { events.append(("due", dueStart, "due today")) }
            if preferences.overdue, let dayAfter = calendar.date(byAdding: .day, value: 1, to: dueStart) {
                // Already-overdue bills get one upcoming follow-up, rather than a burst of missed alerts.
                let today = calendar.startOfDay(for: now)
                let earliest = max(dayAfter, today)
                let atHour = calendar.date(bySettingHour: min(23, max(0, preferences.hour)), minute: 0, second: 0, of: earliest) ?? earliest
                let followUp = atHour > now ? earliest : calendar.date(byAdding: .day, value: 1, to: earliest) ?? earliest
                events.append(("overdue", followUp, "still unpaid"))
            }
            for (kind, day, description) in events {
                guard let date = calendar.date(bySettingHour: min(23, max(0, preferences.hour)), minute: 0, second: 0, of: day), date > now else { continue }
                let id = prefix + bill.id + "." + kind + "." + FinanceDate.day(date)
                let amount = bill.amount.formatted(.number.locale(Locale(identifier: "fr_MA")))
                result[id] = BillReminder(id: id, billID: bill.id, month: bill.period, scope: bill.scope?.rawValue, date: date,
                    title: preferences.showDetails ? bill.name : "Bill reminder",
                    body: preferences.showDetails ? "\(amount) MAD · \(description). Tap to review." : "A household bill is \(description). Tap to review.")
            }
        }
        // Leave capacity for explicit test notifications and future app notification types.
        return Array(result.values.sorted { $0.date == $1.date ? $0.id < $1.id : $0.date < $1.date }.prefix(60))
    }
}
