import Foundation
import Network
import Observation

@MainActor @Observable final class SyncConnectivity {
    static let shared = SyncConnectivity()
    private(set) var canSync = false
    private(set) var isKnown = false
    @ObservationIgnored private var monitor: NWPathMonitor?

    func start() {
        guard monitor == nil else { return }
        let monitor = NWPathMonitor()
        self.monitor = monitor
        monitor.pathUpdateHandler = { path in
            let wifi = path.status == .satisfied && path.usesInterfaceType(.wifi) && !path.isExpensive
            Task { @MainActor in
                self.canSync = wifi
                self.isKnown = true
                if wifi { await OfflineSyncCoordinator.shared.synchronize() }
            }
        }
        monitor.start(queue: DispatchQueue(label: "finance.sync.connectivity"))
    }
}
