import SwiftUI

struct RebalanceView: View {
    @Environment(FinanceStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var requestText = ""
    @State private var suggestion: RebalanceSuggestion?
    @State private var suggesting = false
    @State private var from = ""
    @State private var to = ""
    @State private var amount: Decimal?
    @State private var saving = false
    @State private var error: String?
    @State private var requestID = UUID()
    private var categories: [FinanceCategory] { store.categories.filter { !$0.isSavings } }
    private var valid: Bool { !from.isEmpty && !to.isEmpty && from != to && (amount ?? 0) > 0 }
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    LabeledContent("Wallet", value: store.scope.title)
                    Text("Move available money between spending categories. Savings and money reserved for unpaid bills are protected.").font(.subheadline).foregroundStyle(.secondary)
                }
                Section {
                    Picker("From category", selection: $from) {
                        Text("Choose category").tag("")
                        ForEach(categories) { Text($0.name).tag($0.id) }
                    }
                    Picker("To category", selection: $to) {
                        Text("Choose category").tag("")
                        ForEach(categories.filter { $0.id != from }) { Text($0.name).tag($0.id) }
                    }
                    TextField("Amount in MAD", value: $amount, format: .number.precision(.fractionLength(0...2)))
                        .keyboardType(.decimalPad).monospacedDigit()
                    if let source = categories.first(where: { $0.id == from }) {
                        LabeledContent("Available before bill reservations") { MoneyText(amount: source.available) }
                    }
                }
                Section("Suggest moves") {
                    TextField("What needs covering?", text: $requestText, axis: .vertical).lineLimit(2...4)
                    Button(suggesting ? "Preparing…" : "Suggest moves") { Task { await suggest() } }.disabled(requestText.isEmpty || suggesting)
                    if let suggestion {
                        Text(suggestion.explanation).font(.subheadline)
                        ForEach(suggestion.moves) { move in
                            VStack(alignment: .leading, spacing: 4) {
                                LabeledContent("\(store.categoryName(move.fromId)) → \(store.categoryName(move.toId))") { MoneyText(amount: move.amount) }
                                Text(move.reason).font(.caption).foregroundStyle(.secondary)
                                Button("Review this move") { from = move.fromId; to = move.toId; amount = move.amount }
                            }
                        }
                    }
                }
                if let error { Text(error).foregroundStyle(FinanceTheme.expense) }
                Section {
                    Button(saving ? "Moving…" : "Move money") { Task { await move() } }
                        .disabled(!valid || saving).buttonStyle(.borderedProminent)
                }
            }
            .navigationTitle("Rebalance").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() }.disabled(saving) } }
            .interactiveDismissDisabled(saving)
        }
    }
    private func suggest() async {
        suggesting = true; defer { suggesting = false }
        do {
            suggestion = try await store.askAssistant(AssistantRequest(action: "reallocate", text: requestText, scope: store.scope.rawValue, month: store.selectedMonth))
            error = nil
        } catch { self.error = error.localizedDescription }
    }
    private func move() async {
        saving = true
        defer { saving = false }
        let draft = TransactionDraft(id: requestID, operation: "rebalance", input: NativeInput(name: "Budget rebalance", amount: amount,
            date: FinanceDate.day(.now), fromCategoryId: from, toCategoryId: to))
        do { try await store.submit(draft); dismiss() }
        catch { store.error = error.localizedDescription; dismiss() }
    }
}
