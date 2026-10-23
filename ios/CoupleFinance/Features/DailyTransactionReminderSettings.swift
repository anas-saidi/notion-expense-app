import SwiftUI

struct DailyTransactionReminderSettings: View {
    @State private var requesting = false
    var body: some View {
        @Bindable var notifications = FinanceNotifications.shared
        Section {
            if notifications.dailyPreferences.enabled {
                Toggle("Daily transaction reminder", isOn: $notifications.dailyPreferences.enabled)
                Picker("Hour", selection: $notifications.dailyPreferences.hour) {
                    ForEach(0..<24) { hour in Text(String(format: "%02d", hour)).tag(hour) }
                }
                Picker("Minute", selection: $notifications.dailyPreferences.minute) {
                    ForEach(0..<60) { minute in Text(String(format: "%02d", minute)).tag(minute) }
                }
            } else {
                Button(requesting ? "Enabling…" : "Enable daily transaction reminder", systemImage: "clock.badge.checkmark") {
                    requesting = true
                    Task { await notifications.enableDaily(); requesting = false }
                }.disabled(requesting)
            }
        } header: { Text("Daily check-in") } footer: {
            Text("A daily nudge to add today's transactions, even if you've already logged some. Uses Casablanca time; tap the reminder to open transaction entry.")
        }
        .sensoryFeedback(.selection, trigger: notifications.dailyPreferences)
    }
}
