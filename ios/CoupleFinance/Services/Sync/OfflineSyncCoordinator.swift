import Foundation
@preconcurrency import BackgroundTasks

@MainActor final class OfflineSyncCoordinator {
    static let shared = OfflineSyncCoordinator()
    static let identifier = "com.anassaidi.couplefinance.sync"
    private var live: FinanceStore?

    func liveStore() throws -> FinanceStore {
        if let live { return live }
        let store = try FinanceStore(repository: LocalRepository())
        live = store
        return store
    }

    func synchronize() async {
        do { await (try liveStore()).synchronizeQueuedChanges() }
        catch { /* Opening a locked or unavailable store waits for foreground unlock. */ }
    }

    static func schedule(needed: Bool) {
        BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: identifier)
        guard needed else { return }
        let request = BGProcessingTaskRequest(identifier: identifier)
        request.requiresNetworkConnectivity = true
        request.requiresExternalPower = false
        request.earliestBeginDate = Date.now.addingTimeInterval(60)
        // Foreground/Wi-Fi monitoring remains available when iOS background
        // refresh is disabled or the scheduler is unavailable (e.g. simulator).
        try? BGTaskScheduler.shared.submit(request)
    }

    func register() {
        BGTaskScheduler.shared.register(forTaskWithIdentifier: Self.identifier, using: nil) { task in
            Task { @MainActor in
                let work = Task { @MainActor in
                    SyncConnectivity.shared.start()
                    for _ in 0..<30 {
                        if SyncConnectivity.shared.isKnown || Task.isCancelled { break }
                        try? await Task.sleep(for: .milliseconds(100))
                    }
                    if !Task.isCancelled { await self.synchronize() }
                    let complete = (try? self.liveStore().syncQueue.isEmpty) == true
                    task.setTaskCompleted(success: complete && !Task.isCancelled)
                }
                task.expirationHandler = { work.cancel() }
            }
        }
    }
}
