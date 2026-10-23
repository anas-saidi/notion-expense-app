import Foundation

struct SyncStatus: Codable {
    var configured: Bool?
    var syncedAt: String?
    var syncing: Bool?
    var current: Bool?
}
