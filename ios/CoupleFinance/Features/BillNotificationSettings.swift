import SwiftUI
import UIKit

struct BillNotificationSettings: View {
    @Environment(AppSession.self) private var session
    @Environment(\.openURL) private var openURL
    @State private var requesting = false
    var body: some View {
        @Bindable var notifications = FinanceNotifications.shared
        Section {
            if notifications.preferences.enabled {
                Toggle("Bill reminders", isOn: $notifications.preferences.enabled)
                Toggle("The day before", isOn: $notifications.preferences.dayBefore)
                Toggle("On the due date", isOn: $notifications.preferences.dueDay)
                Toggle("Unpaid bill follow-up", isOn: $notifications.preferences.overdue)
                Picker("Reminder time", selection: $notifications.preferences.hour) {
                    ForEach(0..<24) { hour in Text(String(format: "%02d:00", hour)).tag(hour) }
                }
                Toggle("Show bill names and amounts", isOn: $notifications.preferences.showDetails)
                if notifications.allowed {
                    Text("\(notifications.scheduledCount) reminders scheduled").font(.caption).foregroundStyle(.secondary)
                    Button("Send a test notification") { Task { await notifications.sendTest() } }
                }
            } else {
                Button(requesting ? "Enabling…" : "Enable bill reminders", systemImage: "bell.badge") {
                    requesting = true
                    Task { await notifications.enable(); requesting = false }
                }.disabled(requesting)
            }
            if notifications.authorization == .denied {
                Text("Notifications are blocked in iOS Settings.").font(.subheadline).foregroundStyle(.secondary)
                Button("Open notification settings") {
                    if let url = URL(string: UIApplication.openNotificationSettingsURLString) { openURL(url) }
                }
            }
            if let message = notifications.message { Text(message).font(.caption).foregroundStyle(.secondary) }
        } header: { Text("Notifications") } footer: {
            Text(session.active.isDemo ? "Sample bills never schedule reminders. The test sends a generic notification only." : "Reminders use your latest saved bills and Africa/Casablanca time. Open the app to refresh changes made elsewhere. Bill details are hidden by default.")
        }
        .task(id: notifications.preferences) {
            if !notifications.preferences.enabled { await notifications.reconcile(bills: []) }
            else if let bills = session.live.reminderBills { await notifications.reconcile(bills: bills) }
        }
        .task(id: notifications.preferences.enabled) {
            if notifications.preferences.enabled, !session.active.isDemo {
                do { try await session.live.refreshReminderMonths() }
                catch { if !Task.isCancelled { notifications.message = "Using saved bills. Open the app online to update reminders." } }
            }
        }
        .sensoryFeedback(.selection, trigger: notifications.preferences)
    }
}
