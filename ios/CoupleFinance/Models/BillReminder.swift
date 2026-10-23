import Foundation

struct BillReminder: Equatable, Identifiable {
    let id: String
    let billID: String
    let month: String
    let scope: String?
    let date: Date
    let title: String
    let body: String
}
