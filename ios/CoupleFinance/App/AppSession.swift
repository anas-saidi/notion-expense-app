import Foundation
import Observation

@MainActor @Observable final class AppSession {
    let live: FinanceStore
    var preview: FinanceStore?
    var active: FinanceStore { preview ?? live }
    init() throws {
        live = try FinanceStore(repository: LocalRepository())
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
