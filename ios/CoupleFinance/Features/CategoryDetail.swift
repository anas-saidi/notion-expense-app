import SwiftUI

struct CategoryDetail: View {
    @Environment(FinanceStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let category: FinanceCategory
    @State private var sheet: String?
    @State private var events: [CategoryEvent] = []
    @State private var loadError: String?
    @State private var confirmingArchive = false
    private var current: FinanceCategory { store.snapshot?.categories.first { $0.id == category.id } ?? category }
    var body: some View {
        NavigationStack {
            List {
                Section {
                    MoneyText(amount: current.available, currency: true).font(.largeTitle.weight(.semibold))
                    LabeledContent("Monthly plan") { MoneyText(amount: current.planned) }
                    LabeledContent("Default account", value: store.accountName(current.defaultAccount))
                    if let goal = current.goal { LabeledContent("Savings target") { MoneyText(amount: goal) } }
                }
                Section {
                    if current.isSavings {
                        Button("Deposit into savings", systemImage: "plus.circle") { sheet = "deposit" }
                        Button("Take money out", systemImage: "arrow.up.right") { sheet = "withdraw" }
                    } else {
                        Button("Add money", systemImage: "plus.circle") { sheet = "allocate" }
                        Button("Release money", systemImage: "arrow.uturn.backward") { sheet = "release" }
                    }
                    Button("Edit category", systemImage: "pencil") { sheet = "edit" }
                    NativeSaveButton(title: current.snoozed == true ? "Unfreeze category" : "Freeze category") {
                        var input = NativeInput(id: category.id); input.snoozed = current.snoozed != true
                        try await store.submit(TransactionDraft(operation: "updateCategory", input: input))
                    }
                }
                Section("Activity · \(store.selectedMonth)") {
                    if let loadError { Text(loadError).foregroundStyle(.secondary) }
                    ForEach(events) { event in
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                VStack(alignment: .leading) { Text(event.title); Text(event.date).font(.caption).foregroundStyle(.secondary) }
                                Spacer(); MoneyText(amount: event.direction == "out" ? -event.amount : event.amount)
                            }
                            if let operationID = event.savingsFundingOperation {
                                NativeSaveButton(title: "Undo deposit") {
                                    var input = NativeInput(); input.operationId = operationID
                                    try await store.submit(TransactionDraft(operation: "undoSavingsDeposit", input: input)); await load()
                                }
                            } else if event.sourceDb == "funds" && event.readOnly != true {
                                Button("Edit assignment") { sheet = "fund:" + event.id }
                            }
                        }
                    }
                    if events.isEmpty && loadError == nil { Text("No activity in this month").foregroundStyle(.secondary) }
                }
                Section {
                    Button("Archive category", role: .destructive) { confirmingArchive = true }
                        .confirmationDialog("Archive \(current.name)?", isPresented: $confirmingArchive, titleVisibility: .visible) {
                            Button("Archive category", role: .destructive) {
                                Task {
                                    do { var input = NativeInput(id: category.id); input.archived = true; try await store.submit(TransactionDraft(operation: "updateCategory", input: input)); dismiss() }
                                    catch { store.error = error.localizedDescription }
                                }
                            }
                        } message: { Text("Its historical transactions remain in your ledger.") }
                }
            }
            .navigationTitle(current.name).navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
            .task { await load() }
            .sheet(item: sheetSelection) { selection in
                switch selection.id {
                case "edit": CategoryEditor(category: current)
                case "deposit": SavingsActionView(category: current)
                case "withdraw": SavingsActionView(category: current, withdrawing: true)
                case "release": AllocationView(category: current, releasing: true)
                case let id where id.hasPrefix("fund:"): FundingEditor(event: events.first { "fund:" + $0.id == id }, category: current)
                default: AllocationView(category: current)
                }
            }
        }
    }
    private var sheetSelection: Binding<SheetSelection?> {
        Binding(get: { sheet.map { SheetSelection(id: $0) } }, set: { sheet = $0?.id })
    }
    private func load() async {
        do { let data: CategoryActivity = try await store.resource("activity", parameters: ["id": category.id, "month": store.selectedMonth]); events = data.timeline; loadError = nil }
        catch { loadError = error.localizedDescription }
    }
}
