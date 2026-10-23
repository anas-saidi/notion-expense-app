import AppIntents

struct CoupleFinanceShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(intent: LogTransactionsIntent(), phrases: [
            "Log transactions in \(.applicationName)",
            "Add an expense in \(.applicationName)"
        ], shortTitle: "Log transactions", systemImageName: "plus.circle")
    }
}
