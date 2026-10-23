import SwiftData
import Foundation

@MainActor final class LocalRepository {
    let container: ModelContainer
    private let context: ModelContext
    private var record: FinanceSchemaV1.LocalArchive?

    init(inMemory: Bool = false, storeURL: URL? = nil) throws {
        let schema = Schema(versionedSchema: FinanceSchemaV1.self)
        let configuration = storeURL.map { ModelConfiguration(schema: schema, url: $0) } ?? ModelConfiguration(schema: schema, isStoredInMemoryOnly: inMemory)
        container = try ModelContainer(for: schema, migrationPlan: FinanceMigrationPlan.self, configurations: configuration)
        context = ModelContext(container)
        context.autosaveEnabled = false
        record = try context.fetch(FetchDescriptor<FinanceSchemaV1.LocalArchive>()).first
    }

    func load() throws -> FinanceBackup {
        guard let record else { return FinanceBackup() }
        return try FinanceBackup.decode(record.payload)
    }

    func save(_ backup: FinanceBackup) throws {
        let data = try backup.encoded()
        if let record { record.payload = data }
        else {
            let newRecord = FinanceSchemaV1.LocalArchive(payload: data)
            context.insert(newRecord)
            record = newRecord
        }
        do { try context.save() }
        catch { context.rollback(); record = try context.fetch(FetchDescriptor<FinanceSchemaV1.LocalArchive>()).first; throw error }
    }
}
