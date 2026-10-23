import Foundation

/// One repeating request continues working without opening the app every day.
enum DailyReminderPlanner {
    static let identifier = "finance.daily-transactions"
    static func components(preferences: DailyReminderPreferences) -> DateComponents {
        var components = DateComponents()
        components.calendar = FinanceDate.calendar
        components.timeZone = FinanceDate.calendar.timeZone
        components.hour = min(23, max(0, preferences.hour))
        components.minute = min(59, max(0, preferences.minute))
        return components
    }
}
