import Foundation
import Observation
import UserNotifications

@MainActor @Observable final class FinanceNotifications {
    static let shared = FinanceNotifications()
    let delegate = FinanceNotificationDelegate()
    var preferences: ReminderPreferences {
        didSet {
            if let data = try? JSONEncoder().encode(preferences) { UserDefaults.standard.set(data, forKey: "billReminderPreferences.v1") }
        }
    }
    var dailyPreferences: DailyReminderPreferences {
        didSet {
            if let data = try? JSONEncoder().encode(dailyPreferences) { UserDefaults.standard.set(data, forKey: "dailyTransactionReminder.v1") }
        }
    }
    private var dailyRevision = 0
    private var dailyUpdating = false
    private(set) var authorization: UNAuthorizationStatus = .notDetermined
    private(set) var scheduledCount = 0
    private(set) var updating = false
    var message: String?
    private var bills: [BillOccurrence] = []
    private var revision = 0
    private let center = UNUserNotificationCenter.current()

    private init() {
        dailyPreferences = UserDefaults.standard.data(forKey: "dailyTransactionReminder.v1")
            .flatMap { try? JSONDecoder().decode(DailyReminderPreferences.self, from: $0) } ?? DailyReminderPreferences()
        preferences = UserDefaults.standard.data(forKey: "billReminderPreferences.v1")
            .flatMap { try? JSONDecoder().decode(ReminderPreferences.self, from: $0) } ?? ReminderPreferences()
    }
    var allowed: Bool { [.authorized, .provisional, .ephemeral].contains(authorization) }

    func enable() async { preferences.enabled = await requestPermission() }
    func enableDaily() async { dailyPreferences.enabled = await requestPermission() }
    private func requestPermission() async -> Bool {
        message = nil
        do {
            let granted = try await center.requestAuthorization(options: [.alert, .sound])
            await updateAuthorization()
            if !granted { message = "Notifications are off in iOS Settings. Allow them there to receive reminders." }
            return granted
        } catch { message = error.localizedDescription; return false }
    }
    func reconcileDaily() async {
        dailyRevision += 1
        guard !dailyUpdating else { return }
        dailyUpdating = true
        defer { dailyUpdating = false }
        var handled = -1
        while handled != dailyRevision {
            handled = dailyRevision
            let current = handled
            await updateAuthorization()
            guard current == dailyRevision else { continue }
            center.removePendingNotificationRequests(withIdentifiers: [DailyReminderPlanner.identifier])
            guard dailyPreferences.enabled, allowed else {
                center.removeDeliveredNotifications(withIdentifiers: [DailyReminderPlanner.identifier])
                continue
            }
            let content = UNMutableNotificationContent()
            content.title = "A moment for today's transactions"
            content.body = "Add today's spending, income, and transfers to Couple Finance."
            content.sound = .default
            content.threadIdentifier = "daily-check-in"
            let trigger = UNCalendarNotificationTrigger(dateMatching: DailyReminderPlanner.components(preferences: dailyPreferences), repeats: true)
            do {
                try await center.add(UNNotificationRequest(identifier: DailyReminderPlanner.identifier, content: content, trigger: trigger))
            } catch { message = "The daily reminder could not be scheduled. \(error.localizedDescription)" }
        }
    }
    func updateAuthorization() async {
        authorization = await center.notificationSettings().authorizationStatus
    }
    func reconcile(bills: [BillOccurrence]) async {
        self.bills = bills
        revision += 1
        guard !updating else { return }
        updating = true
        defer { updating = false }
        var handled = -1
        while handled != revision {
            handled = revision
            let current = handled
            await updateAuthorization()
            let plan = allowed ? BillReminderPlanner.make(bills: self.bills, preferences: preferences) : []
            let pending = await center.pendingNotificationRequests()
            guard current == revision else { continue }
            let ids = pending.map(\.identifier).filter { $0.hasPrefix(BillReminderPlanner.prefix) }
            center.removePendingNotificationRequests(withIdentifiers: ids)
            // Remove stale paid/skipped bill alerts already present in Notification Center too.
            let delivered = await center.deliveredNotifications()
            let activeBills = Set(self.bills.filter { ["Due", "Overdue"].contains($0.state) }.map(\.id))
            let stale = delivered.filter {
                $0.request.identifier.hasPrefix(BillReminderPlanner.prefix) &&
                (!preferences.enabled || !preferences.showDetails || !activeBills.contains($0.request.content.userInfo["billID"] as? String ?? ""))
            }.map { $0.request.identifier }
            center.removeDeliveredNotifications(withIdentifiers: stale)
            var count = 0
            for reminder in plan {
                guard current == revision else { break }
                let content = UNMutableNotificationContent()
                content.title = reminder.title
                content.body = reminder.body
                content.sound = .default
                content.threadIdentifier = "household-bills"
                content.userInfo = ["billID": reminder.billID, "month": reminder.month, "scope": reminder.scope ?? "joint"]
                var components = FinanceDate.calendar.dateComponents([.year, .month, .day, .hour, .minute], from: reminder.date)
                components.calendar = FinanceDate.calendar
                components.timeZone = FinanceDate.calendar.timeZone
                do {
                    try await center.add(UNNotificationRequest(identifier: reminder.id, content: content,
                        trigger: UNCalendarNotificationTrigger(dateMatching: components, repeats: false)))
                    count += 1
                } catch { message = "Some reminders could not be scheduled. \(error.localizedDescription)" }
            }
            scheduledCount = count
        }
    }
    func sendTest() async {
        await updateAuthorization()
        guard allowed else { message = "Enable notifications first."; return }
        let content = UNMutableNotificationContent()
        content.title = "Notifications are ready"
        content.body = "Your bill reminders will appear here."
        content.sound = .default
        do {
            try await center.add(UNNotificationRequest(identifier: "finance.test", content: content,
                trigger: UNTimeIntervalNotificationTrigger(timeInterval: 5, repeats: false)))
            message = "Test scheduled. It will appear in about five seconds."
        } catch { message = error.localizedDescription }
    }
}
