#if canImport(CoupleFinance)
import Foundation
import Testing
@testable import CoupleFinance

struct DailyReminderTests {
    @Test func reminderIsOptInAndDefaultsToEvening() {
        let preferences = DailyReminderPreferences()
        #expect(!preferences.enabled)
        #expect(preferences.hour == 21 && preferences.minute == 0)
    }
    @Test func repeatingComponentsKeepCasablancaWallTimeWithoutPinningDate() {
        let preferences = DailyReminderPreferences(enabled: true, hour: 20, minute: 30)
        let components = DailyReminderPlanner.components(preferences: preferences)
        #expect(components.timeZone?.identifier == "Africa/Casablanca")
        #expect(components.hour == 20 && components.minute == 30)
        #expect(components.day == nil && components.month == nil && components.year == nil)
    }
    @Test func invalidRestoredTimeStaysWithinCalendarRange() {
        let components = DailyReminderPlanner.components(preferences: .init(enabled: true, hour: 99, minute: -5))
        #expect(components.hour == 23 && components.minute == 0)
    }
    @Test func dailyPreferenceRoundTripDoesNotDependOnBillPreferences() throws {
        let original = DailyReminderPreferences(enabled: true, hour: 22, minute: 15)
        let restored = try JSONDecoder().decode(DailyReminderPreferences.self, from: JSONEncoder().encode(original))
        #expect(restored == original)
        #expect(!ReminderPreferences().enabled)
    }
}
#endif
