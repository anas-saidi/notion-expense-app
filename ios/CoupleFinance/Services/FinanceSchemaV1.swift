import SwiftData
import Foundation

enum FinanceSchemaV1: VersionedSchema {
    static var versionIdentifier: Schema.Version { .init(1, 0, 0) }
    static var models: [any PersistentModel.Type] { [LocalArchive.self] }

    @Model final class LocalArchive {
        @Attribute(.unique) var key: String
        var payload: Data
        init(key: String = "household", payload: Data) {
            self.key = key
            self.payload = payload
        }
    }
}
