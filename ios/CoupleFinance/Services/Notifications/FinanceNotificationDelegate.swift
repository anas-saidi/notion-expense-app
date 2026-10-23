import UserNotifications

final class FinanceNotificationDelegate: NSObject, UNUserNotificationCenterDelegate, Sendable {
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        [.banner, .list, .sound]
    }
    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        guard response.actionIdentifier == UNNotificationDefaultActionIdentifier else { return }
        if response.notification.request.identifier == DailyReminderPlanner.identifier {
            await MainActor.run { AppNavigation.shared.requestedAction = .logTransactions }
            return
        }
        guard response.notification.request.identifier.hasPrefix(BillReminderPlanner.prefix) else { return }
        let month = response.notification.request.content.userInfo["month"] as? String
        let scope = response.notification.request.content.userInfo["scope"] as? String
        await MainActor.run {
            AppNavigation.shared.requestedAction = .bills(month: month, scope: scope.flatMap(WalletScope.init(rawValue:)))
        }
    }
}
