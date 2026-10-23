import SwiftUI

struct MonthPlanner: View {
    @Environment(FinanceStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var context: PlanningContext?
    @State private var rows: [PlanAllocation] = []
    @State private var selectedScope: WalletScope = .joint
    @State private var month = FinanceDate.month(.now)
    @State private var loading = true
    @State private var error: String?
    @State private var requestID = UUID()
    private var total: Decimal { rows.reduce(0) { $0 + $1.amount } }
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    DatePicker("Planning month", selection: monthDate, displayedComponents: .date)
                        .environment(\.timeZone, FinanceDate.calendar.timeZone)
                    Picker("Wallet", selection: $selectedScope) {
                        ForEach(WalletScope.allCases) { Text($0.title).tag($0) }
                    }.pickerStyle(.segmented)
                    LabeledContent("Total across wallets") { MoneyText(amount: total, currency: true) }
                    if let context {
                        LabeledContent("\(selectedScope.title) remaining capacity") { MoneyText(amount: remaining(context)[selectedScope.rawValue]) }
                        if hasShortfall { Text("A partner cannot cover this plan. Reduce personal or Joint assignments before saving.").foregroundStyle(FinanceTheme.expense).font(.caption) }
                    }
                }
                if loading { ProgressView("Loading saved plan") }
                if let error { Text(error).foregroundStyle(FinanceTheme.expense) }
                Section("Monthly assignments") {
                    ForEach($rows) { $row in
                        if let category = store.snapshot?.categories.first(where: { $0.id == row.categoryId }), category.scope == selectedScope {
                            HStack {
                                Text(category.name + (category.snoozed == true ? " · Frozen" : ""))
                                TextField("MAD", value: $row.amount, format: .number.precision(.fractionLength(0...2)))
                                    .keyboardType(.decimalPad).multilineTextAlignment(.trailing).monospacedDigit()
                                    .accessibilityLabel("\(category.name) monthly assignment in MAD")
                                    .disabled(category.snoozed == true)
                            }
                        }
                    }
                }
                Section {
                    Text("Saves the monthly baseline. Carry-over and category transfers remain separate. A zero assignment clears that month's ordinary plan record.").font(.caption).foregroundStyle(.secondary)
                    NativeSaveButton(title: "Save monthly plan", disabled: loading || error != nil || context == nil || hasShortfall || rows.isEmpty || rows.contains(where: { $0.amount < 0 })) {
                        var input = NativeInput(); input.month = month; input.allowClear = true; input.budgetItems = rows
                        try await store.submit(TransactionDraft(id: requestID, operation: "monthlyPlan", input: input)); dismiss()
                    }
                }
            }.navigationTitle("Plan the month").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
                .task(id: month) { await load() }
        }.interactiveDismissDisabled(store.isSubmitting)
    }
    private var monthDate: Binding<Date> {
        Binding(get: { FinanceDate.parse(month + "-01") ?? .now }, set: { month = FinanceDate.month($0) })
    }
    private var hasShortfall: Bool {
        guard let context else { return false }
        let values = remaining(context)
        return (values["anas"] ?? 0) < 0 || (values["salma"] ?? 0) < 0
    }
    private func remaining(_ context: PlanningContext) -> [String: Decimal] {
        var totals: [String: Decimal] = ["joint": 0, "anas": 0, "salma": 0]
        for row in rows {
            if let scope = store.snapshot?.categories.first(where: { $0.id == row.categoryId })?.scope { totals[scope.rawValue, default: 0] += row.amount }
        }
        return PlanCapacity.remaining(capacity: context.capacity, planned: totals, split: context.split)
    }
    private func load() async {
        loading = true; error = nil
        defer { loading = false }
        do {
            async let funds: FundsResource = store.resource("funds", parameters: ["month": month])
            async let capacity: PlanningContext = store.resource("planning", parameters: ["month": month])
            let resource = try await funds
            context = try await capacity
            rows = (store.snapshot?.categories.filter { $0.archived != true } ?? []).map { category in
                let value = resource.funds.filter { $0.categoryId == category.id && $0.assignmentType == "Monthly" && !$0.reverse }.reduce(Decimal.zero) { $0 + $1.planned }
                return PlanAllocation(categoryId: category.id, amount: value, defaultAccount: category.defaultAccount)
            }
            selectedScope = store.scope
        } catch { self.error = error.localizedDescription }
    }
}
