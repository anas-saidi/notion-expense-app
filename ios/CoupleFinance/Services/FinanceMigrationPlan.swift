import SwiftData

enum FinanceMigrationPlan: SchemaMigrationPlan {
    static var schemas: [any VersionedSchema.Type] { [FinanceSchemaV1.self] }
    static var stages: [MigrationStage] { [] }
}
