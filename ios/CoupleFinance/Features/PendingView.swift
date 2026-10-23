import SwiftUI

struct PendingView: View {
    @Environment(FinanceStore.self) private var store
    @State private var items: [PendingPurchase] = []
    @State private var adding = false
    @State private var error: String?
    var body: some View {
        List {
            if let error { Text(error).foregroundStyle(FinanceTheme.expense) }
            ForEach(items) { item in
                VStack(alignment: .leading, spacing: 8) {
                    HStack { Text(item.name).font(.headline); Spacer(); MoneyText(amount: item.amount) }
                    Text(item.claimedBy.map { $0 == "wife" ? "Claimed by Salma" : "Claimed by Anas" } ?? "Unclaimed").font(.caption).foregroundStyle(.secondary)
                    Menu("Purchase actions", systemImage: "ellipsis") {
                        Button("Anas will cover it") { Task { await claim(item, by: "husband") } }
                        Button("Salma will cover it") { Task { await claim(item, by: "wife") } }
                        Button("Unclaim") { Task { await claim(item, by: nil) } }
                        Button("Remove purchase", role: .destructive) { Task { await remove(item) } }
                    }
                }.padding(.vertical, 8)
            }
            if items.isEmpty && error == nil { ContentUnavailableView("Nothing pending", systemImage: "basket", description: Text("Keep purchases you want to decide on together.")) }
        }.navigationTitle("Pending purchases")
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Add purchase", systemImage: "plus") { adding = true } } }
            .task { await load() }.refreshable { await load() }
            .sheet(isPresented: $adding, onDismiss: { Task { await load() } }) { PendingEditor() }
    }
    private func load() async {
        do { let result: PendingResource = try await store.resource("pending"); items = result.items; error = nil }
        catch { self.error = error.localizedDescription }
    }
    private func claim(_ item: PendingPurchase, by owner: String?) async {
        do { var input = NativeInput(id: item.id); input.claimedBy = owner; try await store.submit(TransactionDraft(operation: "claimPending", input: input)); await load() }
        catch { self.error = error.localizedDescription }
    }
    private func remove(_ item: PendingPurchase) async {
        do { try await store.submit(TransactionDraft(operation: "deletePending", input: NativeInput(id: item.id))); await load() }
        catch { self.error = error.localizedDescription }
    }
}
