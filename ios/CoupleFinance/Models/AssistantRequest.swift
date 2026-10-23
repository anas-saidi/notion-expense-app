import Foundation

struct AssistantRequest: Codable {
    var action: String
    var text: String
    var scope: String?
    var month: String?
    var defaultDate: String?
    var defaultAccountId: String?
    var categories: [AIOption]?
    var accounts: [AIOption]?
}
