import SwiftUI

struct TransactionEditor: View {
    @Environment(FinanceStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    var existingDraft: TransactionDraft?
    @State private var showingTyped = false
    @State private var repeatRule = "None"
    @State private var draft = TransactionDraft()
    @State private var amount: Decimal?
    @State private var name = ""
    @State private var kind = "expense"
    @State private var account = ""
    @State private var category = ""
    @State private var destination = ""
    @State private var incomeUse = "contributions"
    @State private var date = Date.now
    @State private var error: String?
    @State private var isSaving = false
    @State private var initialized = false
    private var allCategories: [FinanceCategory] { store.snapshot?.categories.filter { !$0.isSavings && $0.snoozed != true && $0.archived != true } ?? [] }
    private var allAccounts: [FinanceAccount] { store.snapshot?.accounts ?? [] }
    private var valid: Bool {
        (amount ?? 0) > 0 && !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !account.isEmpty &&
        (kind != "expense" || !category.isEmpty) && (kind != "transfer" || (!destination.isEmpty && destination != account))
    }
    private var editing: Bool { draft.operation == "editTransaction" }
    var body: some View {
        NavigationStack {
            Form {
                if !editing {
                    Section { Button("Type it", systemImage: "text.alignleft") { showingTyped = true } }
                }
                if !editing {
                    Section {
                        Picker("Transaction type", selection: $kind) {
                            Text("Expense").tag("expense")
                            Text("Income").tag("income")
                            Text("Transfer").tag("transfer")
                        }.pickerStyle(.segmented)
                    }
                }
                Section {
                    TextField("Amount in MAD", value: $amount, format: .number.precision(.fractionLength(0...2)))
                        .keyboardType(.decimalPad).font(.largeTitle.weight(.semibold)).monospacedDigit()
                        .accessibilityLabel("Amount in Moroccan dirhams")
                    TextField("What was it for?", text: $name).textInputAutocapitalization(.sentences)
                }
                Section {
                    if kind == "expense" {
                        Picker("Category", selection: $category) {
                            Text("Choose category").tag("")
                            ForEach(allCategories) { Text($0.name).tag($0.id) }
                        }
                    }
                    Picker(kind == "transfer" ? "From account" : "Account", selection: $account) {
                        Text("Choose account").tag("")
                        ForEach(allAccounts) { Text($0.label).tag($0.id) }
                    }
                    if kind == "transfer" {
                        Picker("To account", selection: $destination) {
                            Text("Choose account").tag("")
                            ForEach(allAccounts.filter { $0.id != account }) { Text($0.label).tag($0.id) }
                        }
                    }
                    if kind == "income", allAccounts.first(where: { $0.id == account })?.scope == .joint {
                        Picker("Use income for", selection: $incomeUse) {
                            Text("Contributions").tag("contributions")
                            Text("Unassigned money").tag("unassigned")
                        }
                    }
                    if kind == "expense" && !editing {
                        Picker("Repeat", selection: $repeatRule) { ForEach(["None", "Monthly", "Yearly"], id: \.self) { Text($0).tag($0) } }
                    }
                    DatePicker("Date", selection: $date, displayedComponents: .date)
                        .environment(\.timeZone, FinanceDate.calendar.timeZone)
                }
                if let error { Section { Text(error).foregroundStyle(FinanceTheme.expense) } }
                Section {
                    Button {
                        Task { await save(send: true) }
                    } label: {
                        HStack { Spacer(); if isSaving { ProgressView() }; Text(isSaving ? "Saving…" : store.canSyncOnWiFi || store.isDemo ? "Save to Notion" : "Save offline"); Spacer() }
                    }.buttonStyle(.borderedProminent).disabled(!valid || isSaving || !store.isConnected)
                    Button("Keep as draft") { Task { await save(send: false) } }.disabled(!valid || isSaving)
                }
            }
            .navigationTitle(editing ? "Edit transaction" : "Add transaction")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() }.disabled(isSaving) } }
            .sheet(isPresented: $showingTyped) { TypedEntryView() }
            .interactiveDismissDisabled(isSaving)
            .sensoryFeedback(.error, trigger: error) { _, error in error != nil && !store.backup.drafts.contains(where: { $0.id == draft.id && $0.outcomeUnknown }) }
            .task { initialize() }
            .onChange(of: category) { previous, id in
                if previous.isEmpty && id == existingDraft?.input.categoryId { return }
                if let defaultAccount = allCategories.first(where: { $0.id == id })?.defaultAccount { account = defaultAccount }
            }
        }
    }

    private func initialize() {
        guard !initialized else { return }
        initialized = true
        if let existingDraft {
            draft = existingDraft
            kind = draft.operation == "editTransaction" ? (draft.input.categoryId == nil ? "income" : "expense") : draft.operation
            amount = draft.input.amount
            name = draft.title
            account = draft.input.accountId ?? draft.input.fromAccountId ?? ""
            destination = draft.input.toAccountId ?? ""
            category = draft.input.categoryId ?? ""
            date = FinanceDate.parse(draft.input.date ?? "") ?? .now
            incomeUse = draft.input.incomeUse ?? "contributions"
        } else {
            account = store.accounts.first?.id ?? ""
        }
    }

    private func save(send: Bool) async {
        isSaving = true
        defer { isSaving = false }
        draft.operation = editing ? "editTransaction" : kind
        draft.input = NativeInput(name: name.trimmingCharacters(in: .whitespacesAndNewlines), amount: amount,
            date: FinanceDate.day(date), accountId: kind == "transfer" ? nil : account,
            categoryId: kind == "expense" ? category : nil, fromAccountId: kind == "transfer" ? account : nil,
            toAccountId: kind == "transfer" ? destination : nil, note: kind == "transfer" ? name : nil,
            incomeUse: kind == "income" ? incomeUse : nil, id: draft.input.id)
        if kind == "expense" && !editing { draft.input.repeat = repeatRule }
        do {
            if send { try await store.submit(draft) } else { draft.syncState = nil; draft.syncError = nil; try store.saveDraft(draft); store.notice = "Draft saved on this phone" }
            dismiss()
        } catch {
            self.error = error.localizedDescription
            // The persisted request may have committed. Do not mutate/reuse its ID with new inputs.
            if store.backup.drafts.contains(where: { $0.id == draft.id && $0.outcomeUnknown }) { dismiss(); store.error = error.localizedDescription }
        }
    }
}
