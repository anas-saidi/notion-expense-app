import Foundation

struct DailyReminderPreferences: Codable, Equatable {
    var enabled = false
    var hour = 21
    var minute = 0
}
