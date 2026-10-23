import SwiftUI

struct PendingEditor: View {
    @Environment(FinanceStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var amount: Decimal?
    @State private var category = ""
    @State private var owner = ""
    @State private var requestID = UUID()
    var body: some View {
        NavigationStack {
            Form {
                TextField("What are you considering?", text: $name)
                TextField("Estimated cost in MAD (optional)", value: $amount, format: .number).keyboardType(.decimalPad)
                Picker("Category", selection: $category) {
                    Text("Decide later").tag("")
                    ForEach(store.categories) { Text($0.name).tag($0.id) }
                }
                Picker("Who will cover it?", selection: $owner) { Text("Unclaimed").tag(""); Text("Anas").tag("husband"); Text("Salma").tag("wife") }
                NativeSaveButton(title: "Add pending purchase", disabled: name.isEmpty || (amount != nil && (amount ?? 0) <= 0)) {
                    var input = NativeInput(name: name, amount: amount, categoryId: category.isEmpty ? nil : category)
                    input.claimedBy = owner.isEmpty ? nil : owner
                    try await store.submit(TransactionDraft(id: requestID, operation: "createPending", input: input)); dismiss()
                }
            }.navigationTitle("Pending purchase").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
        }.interactiveDismissDisabled(store.isSubmitting)
    }
}
