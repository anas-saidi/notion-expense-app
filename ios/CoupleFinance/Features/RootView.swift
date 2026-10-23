import SwiftUI

struct RootView: View {
    @Environment(FinanceStore.self) private var store
    @Environment(AppSession.self) private var session
    @State private var showingReminderBills = false
    @State private var selection = 0
    @State private var budgetSearch = false
    @State private var reflectSearch = false
    @State private var showingRebalance = false
    @State private var showingSettings = false
    @State private var showingEntry = false
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        TabView(selection: $selection) {
            Tab("Home", systemImage: "house", value: 0) { AppScreen(title: "Home", showingSettings: $showingSettings, showingEntry: $showingEntry) { HomeView() } }
            Tab("Budget", systemImage: "slider.horizontal.3", value: 1) { AppScreen(title: "Budget", showingSettings: $showingSettings, showingEntry: $showingEntry, onSearch: { budgetSearch.toggle() }, onRebalance: { showingRebalance = true }) { BudgetView(searchVisible: $budgetSearch) } }
            Tab("Reflect", systemImage: "chart.pie", value: 2) { AppScreen(title: "Reflect", showingSettings: $showingSettings, showingEntry: $showingEntry, onSearch: { reflectSearch.toggle() }) { InsightsView(searchVisible: $reflectSearch) } }
        }
        .toolbar(.hidden, for: .tabBar)
        .safeAreaInset(edge: .bottom, spacing: 0) {
            FinanceTabBar(selection: $selection, add: { showingEntry = true }, addEnabled: store.snapshot != nil)
        }
        .sheet(isPresented: $showingReminderBills) {
            NavigationStack { BillsView().toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { showingReminderBills = false } } } }
        }
        .task(id: session.live.backup) {
            let notifications = FinanceNotifications.shared
            if !notifications.preferences.enabled { await notifications.reconcile(bills: []) }
            else if let bills = session.live.reminderBills { await notifications.reconcile(bills: bills) }
        }
        .task(id: store.noticeSequence) { await refreshReminders() }
        .task(id: FinanceNotifications.shared.dailyPreferences) { await FinanceNotifications.shared.reconcileDaily() }
        .onChange(of: AppNavigation.shared.requestedAction, initial: true) { _, _ in processNavigation() }
        .onChange(of: [showingSettings, showingEntry, showingRebalance, showingReminderBills]) { _, _ in processNavigation() }
        .sheet(isPresented: $showingRebalance) { RebalanceView() }
        .sheet(isPresented: $showingSettings) { SettingsView() }
        .sheet(isPresented: $showingEntry) { TransactionEditor() }
        .task {
            guard !store.isDemo else { return }
            while !Task.isCancelled {
                await store.synchronizeQueuedChanges()
                do { try await Task.sleep(for: .seconds(30)) } catch { return }
            }
        }
        .task(id: SyncConnectivity.shared.canSync) {
            if SyncConnectivity.shared.canSync { await session.live.synchronizeQueuedChanges() }
        }
        .task(id: store.selectedMonth) { await store.refresh() }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { Task { await session.live.synchronizeQueuedChanges(); await store.refresh(); await refreshReminders() } }
            else if phase == .background { OfflineSyncCoordinator.schedule(needed: session.live.waitingForSync && !session.live.syncNeedsReview) }
        }
        .alert("Could not complete the action", isPresented: errorPresented) { } message: { Text(store.error ?? "") }
        .sensoryFeedback(.selection, trigger: selection)
        .sensoryFeedback(.impact(weight: .light, intensity: 0.5), trigger: showingEntry) { _, opened in opened }
        .sensoryFeedback(.success, trigger: store.noticeSequence)
        .sensoryFeedback(.error, trigger: store.error) { _, error in error != nil }
    }

    private func processNavigation() {
        guard let action = AppNavigation.shared.requestedAction else { return }
        if action == .logTransactions, showingEntry { AppNavigation.shared.requestedAction = nil; return }
        guard !showingSettings, !showingEntry, !showingRebalance, !showingReminderBills else { return }
        if store.isDemo { session.exitPreview(); return }
        AppNavigation.shared.requestedAction = nil
        selection = 0
        guard store.isConnected else { showingSettings = true; return }
        switch action {
        case .logTransactions: showingEntry = true
        case .bills(let month, let scope):
            store.selectedMonth = month.flatMap { FinanceDate.parse($0 + "-01") }.map(FinanceDate.month) ?? FinanceDate.month(.now)
            if let scope { store.scope = scope }
            showingReminderBills = true
        }
    }

    private func refreshReminders() async {
        let notifications = FinanceNotifications.shared
        await notifications.updateAuthorization()
        await notifications.reconcileDaily()
        guard notifications.preferences.enabled, session.live.isConnected, !store.isDemo else { return }
        do {
            try await session.live.refreshReminderMonths()
            if let bills = session.live.reminderBills { await notifications.reconcile(bills: bills) }
        } catch { notifications.message = "Using saved bills. Open the app online to update reminders." }
    }

    private var errorPresented: Binding<Bool> {
        Binding(get: { store.error != nil }, set: { if !$0 { store.error = nil } })
    }

}
