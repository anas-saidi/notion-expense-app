import UIKit
import UserNotifications

@MainActor final class FinanceAppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        OfflineSyncCoordinator.shared.register()
        SyncConnectivity.shared.start()
        UNUserNotificationCenter.current().delegate = FinanceNotifications.shared.delegate
        return true
    }
}
