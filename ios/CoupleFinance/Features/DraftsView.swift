import SwiftUI

struct DraftsView: View {
    @Environment(FinanceStore.self) private var store
    @State private var selected: TransactionDraft?
    @State private var removing: TransactionDraft?
    @State private var retrying = false
    var body: some View {
        List {
            Section {
                Text("Saved changes sync over Wi-Fi. Drafts wait for you to send them.").font(.subheadline).foregroundStyle(.secondary)
            }
            ForEach(store.backup.drafts) { draft in
                VStack(alignment: .leading, spacing: 8) {
                    HStack { Text(draft.title).font(.headline); Spacer(); MoneyText(amount: draft.input.amount) }
                    Text(status(draft)).font(.caption).foregroundStyle(.secondary)
                    if let issue = draft.syncError { Text(issue).font(.subheadline).foregroundStyle(FinanceTheme.expense) }
                    if draft.outcomeUnknown {
                        Button("Check original request") { Task { await retry(draft) } }
                            .disabled(retrying || store.isSubmitting || !store.canSyncOnWiFi)
                    } else if ["expense", "income", "transfer", "editTransaction"].contains(draft.operation) {
                        Button(draft.syncState == nil ? "Review draft" : "Edit saved change") { selected = draft }
                            .disabled(store.isSubmitting)
                    }
                    if draft.syncState == .needsReview {
                        Button("Refresh latest data") { Task { await store.refresh() } }.disabled(store.isSubmitting)
                    }
                    Button("Remove local draft", role: .destructive) { removing = draft }.disabled(store.isSubmitting)
                }.padding(.vertical, 8)
            }
            if store.backup.drafts.isEmpty { ContentUnavailableView("All synced", systemImage: "checkmark.circle", description: Text("There are no saved changes or drafts waiting on this phone.")) }
        }
        .navigationTitle("Drafts & sync")
        .sheet(item: $selected) { TransactionEditor(existingDraft: $0) }
        .confirmationDialog("Remove this local request?", isPresented: removalPresented, titleVisibility: .visible) {
            Button("Remove draft", role: .destructive) {
                guard let removing else { return }
                do { try store.removeDraft(removing.id) } catch { store.error = error.localizedDescription }
                self.removing = nil
            }
        } message: { Text("This cancels an unsent change. It does not undo anything already saved to Notion.") }
    }
    private func status(_ draft: TransactionDraft) -> String {
        switch draft.syncState {
        case .queued: "Waiting for Wi-Fi"
        case .awaitingRefresh: "Saved to Notion · refreshing balances"
        case .needsReview: "Needs review · automatic sync paused"
        case nil: draft.outcomeUnknown ? "Save unconfirmed · check activity" : "Draft · not scheduled to sync"
        }
    }
    private var removalPresented: Binding<Bool> {
        Binding(get: { removing != nil }, set: { if !$0 { removing = nil } })
    }
    private func retry(_ draft: TransactionDraft) async {
        retrying = true
        defer { retrying = false }
        do {
            if draft.syncState != nil { try await store.retrySyncRequest(draft.id) }
            else { try await store.submit(draft) }
        } catch { store.error = error.localizedDescription }
    }
}
