import Foundation

struct CategoryEvent: Codable, Equatable, Identifiable {
    var id: String
    var date: String
    var kind: String
    var amount: Decimal
    var direction: String
    var title: String
    var subtitle: String?
    var assignmentType: String?
    var sourceDb: String
    var readOnly: Bool?
    var savingsFundingOperation: String?
}
