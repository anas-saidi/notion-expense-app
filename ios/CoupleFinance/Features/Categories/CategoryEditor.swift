import SwiftUI

struct CategoryEditor: View {
    @Environment(FinanceStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    var category: FinanceCategory?
    @State private var name = ""
    @State private var icon = ""
    @State private var kind = "Budget"
    @State private var account = ""
    @State private var pattern = "Not set"
    @State private var requestID = UUID()
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Category name", text: $name)
                    TextField("Emoji (optional)", text: $icon)
                    Picker("Type", selection: $kind) {
                        ForEach(["Budget", "Team", "Savings"], id: \.self) { Text($0).tag($0) }
                    }
                    Picker("Default account", selection: $account) {
                        Text("Choose account").tag("")
                        ForEach(store.snapshot?.accounts ?? []) { Text($0.label).tag($0.id) }
                    }
                    Picker("Spending pattern", selection: $pattern) {
                        ForEach(["Not set", "Everyday", "Scheduled", "Flexible", "Goal"], id: \.self) { Text($0).tag($0) }
                    }
                }
                Section {
                    NativeSaveButton(title: "Save category", disabled: name.trimmingCharacters(in: .whitespaces).isEmpty || account.isEmpty) {
                        var input = NativeInput(name: name.trimmingCharacters(in: .whitespacesAndNewlines), accountId: account, id: category?.id)
                        input.icon = icon; input.type = kind; input.scope = store.scope.rawValue
                        // Not-set preserves an unset pattern; other patterns are explicit choices.
                        if pattern != "Not set" { input.spendingPattern = pattern } else if category != nil { input.clearSpendingPattern = true }
                        try await store.submit(TransactionDraft(id: requestID, operation: category == nil ? "createCategory" : "updateCategory", input: input))
                        dismiss()
                    }
                }
            }
            .navigationTitle(category == nil ? "New category" : "Edit category").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
            .task {
                name = category?.name ?? ""; icon = category?.icon ?? ""
                kind = category?.type.first ?? (store.scope == .joint ? "Team" : "Budget")
                account = category?.defaultAccount ?? store.accounts.first?.id ?? ""
                pattern = category?.spendingPattern ?? "Not set"
            }
        }.interactiveDismissDisabled(store.isSubmitting)
    }
}
