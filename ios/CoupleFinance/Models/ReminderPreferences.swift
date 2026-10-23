import Foundation

struct ReminderPreferences: Codable, Equatable {
    var enabled = false
    var dayBefore = true
    var dueDay = true
    var overdue = true
    var showDetails = false
    var hour = 9
}
