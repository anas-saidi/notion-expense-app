import SwiftUI

struct TypedEntryView: View {
    @Environment(FinanceStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var text = ""
    @State private var rows: [EntryReview] = []
    @State private var error: String?
    @State private var busy = false
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("coffee 19 yesterday\ngroceries 250", text: $text, axis: .vertical).lineLimit(4...8)
                    Button("Create drafts locally") { parseLocally() }.disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || busy)
                    Button(busy ? "Creating…" : "Create transactions with Gemini") { Task { await parseWithGemini() } }.disabled(text.isEmpty || busy)
                    Text("Gemini sends this text and category/account labels to Google only when you choose it. Use non-sensitive examples. Local parsing stays on this device.").font(.caption).foregroundStyle(.secondary)
                }
                if busy { ProgressView("Creating drafts") }
                if let error { Text(error).foregroundStyle(FinanceTheme.expense) }
                ForEach($rows) { $row in
                    Section {
                        TextField("Description", text: $row.name)
                        TextField("Amount in MAD", value: $row.amount, format: .number).keyboardType(.decimalPad)
                        Picker("Type", selection: $row.type) { Text("Expense").tag("Expense"); Text("Income").tag("Income") }
                        if row.type == "Expense" {
                            Picker("Category", selection: $row.categoryId) {
                                Text("Choose category").tag("")
                                ForEach(store.snapshot?.categories.filter { !$0.isSavings && $0.snoozed != true } ?? []) { Text($0.name).tag($0.id) }
                            }
                        }
                        Picker("Account", selection: $row.accountId) {
                            Text("Choose account").tag("")
                            ForEach(store.snapshot?.accounts ?? []) { Text($0.label).tag($0.id) }
                        }
                        Text(row.date).font(.caption).foregroundStyle(.secondary)
                    }
                }
                if !rows.isEmpty {
                    Section {
                        NativeSaveButton(title: "Save \(rows.count) transactions", disabled: rows.contains(where: { !$0.isValid })) {
                            // Store every request first. A partial batch leaves the remainder in Drafts.
                            for row in rows { try store.saveDraft(row.draft) }
                            for row in rows { try await store.submit(row.draft) }
                            dismiss()
                        }
                        Button("Keep drafts on this phone") {
                            do { for row in rows { try store.saveDraft(row.draft) }; dismiss() }
                            catch { self.error = error.localizedDescription }
                        }.disabled(rows.contains(where: { !$0.isValid }))
                    }
                }
            }.navigationTitle("Type it").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
        }.interactiveDismissDisabled(store.isSubmitting || busy)
    }
    private func parseLocally() {
        do {
            rows = try TypedEntryParser.parse(text).map { entry in
                var row = entry; row.accountId = store.accounts.first?.id ?? ""; return row
            }
            error = nil
        } catch { self.error = error.localizedDescription }
    }
    private func parseWithGemini() async {
        busy = true; error = nil; defer { busy = false }
        do {
            let input = AssistantRequest(action: "parse", text: text, defaultDate: FinanceDate.day(.now),
                defaultAccountId: store.accounts.first?.id,
                categories: store.snapshot?.categories.filter { !$0.isSavings && $0.snoozed != true }.map { AIOption(id: $0.id, name: $0.name, defaultAccountId: $0.defaultAccount) },
                accounts: store.snapshot?.accounts.map { AIOption(id: $0.id, name: $0.label) })
            let result: ParsingResult = try await store.askAssistant(input)
            if !result.questions.isEmpty { error = result.questions.joined(separator: "\n"); return }
            rows = result.transactions.map { EntryReview(name: $0.name, amount: $0.amount, date: $0.date, type: $0.type, categoryId: $0.categoryId ?? "", accountId: $0.accountId ?? "") }
        } catch { self.error = error.localizedDescription }
    }
}
