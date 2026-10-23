#if DEBUG || PERSONAL_INSTALL_SETUP
import Foundation

/// One-time setup transferred into this app's private container during USB installation.
struct DeviceConnectionSetup: Decodable {
    let address: String
    let key: String

    @MainActor static func apply(to store: FinanceStore) async throws {
        let file = URL.documentsDirectory.appending(path: ".connection-setup.json")
        guard FileManager.default.fileExists(atPath: file.path()) else { return }
        defer { try? FileManager.default.removeItem(at: file) }
        let setup = try JSONDecoder().decode(Self.self, from: Data(contentsOf: file))
        try await store.connect(address: setup.address, key: setup.key)
    }
}
#endif
