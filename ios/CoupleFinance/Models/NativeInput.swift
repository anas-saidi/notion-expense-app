import Foundation

struct NativeInput: Codable, Equatable {
    var name: String?
    var amount: Decimal?
    var date: String?
    var accountId: String?
    var categoryId: String?
    var fromAccountId: String?
    var toAccountId: String?
    var note: String?
    var incomeUse: String?
    var id: String?
    var action: String?
    var billId: String?
    var period: String?
    var fromCategoryId: String?
    var toCategoryId: String?
    var month: String?
    var planned: Decimal?
    var mode: String?
    var operationId: String?
    var target: String?
    var dueDate: String?
    var `repeat`: String?
    var paymentId: String?
    var icon: String?
    var type: String?
    var scope: String?
    var spendingPattern: String?
    var clearSpendingPattern: Bool?
    var snoozed: Bool?
    var archived: Bool?
    var actualBalance: Decimal?
    var currentBalance: Decimal?
    var claimedBy: String?
    var addedBy: String?
    var allowClear: Bool?
    var expectedTransaction: TransactionExpectation?
    var budgetItems: [PlanAllocation]?
}
