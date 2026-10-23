// swift-tools-version: 6.0
import PackageDescription

// A platform-independent test target for the backup, calendar, and financial data contract.
let package = Package(
    name: "FinanceCore",
    platforms: [.macOS(.v14)],
    products: [.library(name: "FinanceCore", targets: ["FinanceCore"])],
    targets: [
        .target(name: "FinanceCore", path: "CoupleFinance", exclude: ["App", "Features", "Design", "Resources", "Preview",
            "Services/LocalRepository.swift", "Services/FinanceSchemaV1.swift", "Services/FinanceMigrationPlan.swift",
            "Services/DeviceKeychain.swift", "Services/FinanceAPI.swift", "Services/SameOriginDelegate.swift", "Services/BackupDocument.swift"],
            sources: ["Models", "Services/FinanceDate.swift", "Services/FinanceError.swift", "Services/PlanCapacity.swift", "Services/TypedEntryParser.swift", "Services/FinanceAnalytics.swift"]),
        .testTarget(name: "FinanceCoreTests", dependencies: ["FinanceCore"], path: "Tests")
    ]
)
