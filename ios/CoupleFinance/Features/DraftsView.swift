import SwiftUI

struct DraftsView: View {
    @Environment(FinanceStore.self) private var store
    @State private var selected: TransactionDraft?
    @State private var removing: TransactionDraft?
    @State private var retrying = false
    var body: some View {
        List {
            Section {
                Text("Drafts stay on this phone until you send them. Check Notion activity before resolving an unconfirmed save.").font(.subheadline).foregroundStyle(.secondary)
            }
            ForEach(store.backup.drafts) { draft in
                VStack(alignment: .leading, spacing: 8) {
                    HStack { Text(draft.title).font(.headline); Spacer(); MoneyText(amount: draft.input.amount) }
                    Text(draft.outcomeUnknown ? "Save unconfirmed · check activity" : "Not sent to Notion").font(.caption).foregroundStyle(.secondary)
                    if draft.outcomeUnknown {
                        Button("Check original request") { Task { await retry(draft) } }.disabled(retrying)
                        Text("Uses the same request ID. A pending server operation will not run twice.").font(.caption).foregroundStyle(.secondary)
                    } else { Button("Review draft") { selected = draft } }
                    Button("Remove local draft", role: .destructive) { removing = draft }
                }.padding(.vertical, 8)
            }
            if store.backup.drafts.isEmpty { ContentUnavailableView("No drafts", systemImage: "checkmark.circle", description: Text("Your saved transactions are in Notion.")) }
        }
        .navigationTitle("Drafts")
        .sheet(item: $selected) { TransactionEditor(existingDraft: $0) }
        .confirmationDialog("Remove this local draft?", isPresented: removalPresented, titleVisibility: .visible) {
            Button("Remove draft", role: .destructive) {
                guard let removing else { return }
                do { try store.removeDraft(removing.id) } catch { store.error = error.localizedDescription }
                self.removing = nil
            }
        } message: { Text("This does not undo any transaction already saved to Notion.") }
    }
    private var removalPresented: Binding<Bool> {
        Binding(get: { removing != nil }, set: { if !$0 { removing = nil } })
    }
    private func retry(_ draft: TransactionDraft) async {
        retrying = true
        defer { retrying = false }
        do { try await store.submit(draft) } catch { store.error = error.localizedDescription }
    }
}
