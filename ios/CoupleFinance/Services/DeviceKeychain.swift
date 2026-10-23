import Foundation
import Security

enum DeviceKeychain {
    private static let service = "com.anassaidi.couplefinance.connection"
    static func read() throws -> String? {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service, kSecAttrAccount as String: "device-key",
            kSecReturnData as String: true, kSecMatchLimit as String: kSecMatchLimitOne]
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        if status == errSecInteractionNotAllowed || status == errSecNotAvailable {
            throw FinanceError.temporarilyUnavailable("Unlock the phone to resume syncing.")
        }
        guard status == errSecSuccess, let data = result as? Data, let key = String(data: data, encoding: .utf8)
        else { throw FinanceError.message("The device key could not be read. Unlock your phone and try again.") }
        // Permit the existing device-only key to be used by background sync
        // after the phone has been unlocked once since boot. Never enable iCloud sync.
        let identity: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service, kSecAttrAccount as String: "device-key"]
        let migrated = SecItemUpdate(identity as CFDictionary, [kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly] as CFDictionary)
        guard migrated == errSecSuccess else { throw FinanceError.temporarilyUnavailable("Unlock the phone to prepare background syncing.") }
        return key
    }
    static func save(_ key: String) throws {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service, kSecAttrAccount as String: "device-key"]
        let attributes: [String: Any] = [kSecValueData as String: Data(key.utf8),
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly]
        let status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            var insert = query
            attributes.forEach { insert[$0.key] = $0.value }
            guard SecItemAdd(insert as CFDictionary, nil) == errSecSuccess else { throw FinanceError.message("The device key could not be saved.") }
        } else if status != errSecSuccess { throw FinanceError.message("The device key could not be updated.") }
    }
}
