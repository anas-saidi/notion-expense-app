import Foundation
import Observation

@MainActor @Observable final class AppSession {
    let live: FinanceStore
    var preview: FinanceStore?
    var active: FinanceStore { preview ?? live }
    init() throws {
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("--offline-household") {
            let repository = try LocalRepository(inMemory: true)
            var sample = try SampleHousehold.snapshot(month: FinanceDate.month(.now))
            sample.householdID = "offline-ui-test"
            try repository.save(FinanceBackup(householdID: sample.householdID, snapshots: [sample.month: sample]))
            live = try FinanceStore(repository: repository, transport: OfflinePreviewTransport(), server: "https://example.invalid", wifiAvailable: { false })
            return
        }
        #endif
        live = try OfflineSyncCoordinator.shared.liveStore()
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("--sample-household") { try explore() }
        #endif
    }
    func explore() throws {
        let store = try FinanceStore(repository: LocalRepository(inMemory: true))
        try store.loadSampleHousehold()
        preview = store
    }
    func exitPreview() { preview = nil }
}
