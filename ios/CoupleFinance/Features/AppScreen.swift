import SwiftUI

struct AppScreen<Content: View>: View {
    @Environment(AppSession.self) private var session
    @Environment(FinanceStore.self) private var store
    let title: String
    @Binding var showingSettings: Bool
    @Binding var showingEntry: Bool
    var onSearch: (() -> Void)?
    var onRebalance: (() -> Void)?
    @ViewBuilder let content: () -> Content

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                ZStack {
                    ScopePicker()
                    HStack(spacing: 4) {
                        Spacer()
                        if let onSearch { HeaderAction(title: "Search", symbol: "magnifyingglass", action: onSearch) }
                        if let onRebalance { HeaderAction(title: "Rebalance", symbol: "shuffle", action: onRebalance) }
                        else { HeaderAction(title: "Settings", symbol: "gearshape") { showingSettings = true } }
                    }
                }.padding(.horizontal, FinanceTheme.spacing).padding(.vertical, 8).frame(maxWidth: 640)
                if store.isDemo {
                    HStack {
                        Text("Sample household").font(.caption)
                        Spacer()
                        Button("Exit preview") { session.exitPreview() }.font(.caption)
                    }.foregroundStyle(.secondary).padding(.horizontal, FinanceTheme.spacing).padding(.bottom, 4)
                }
                if !store.isConnected {
                    ContentUnavailableView {
                        Label("Your finances, together", systemImage: "person.2")
                    } description: {
                        Text("Connect your Notion finance app to see your wallets and start logging expenses.")
                    } actions: {
                        Button("Connect finance app") { showingSettings = true }.buttonStyle(.borderedProminent)
                        Button("Explore a sample household") {
                            do { try session.explore() } catch { store.error = error.localizedDescription }
                        }
                    }
                } else {
                    content()
                    if store.waitingForSync, !store.isDemo {
                        Text(store.syncNeedsReview ? "Sync needs review · open Drafts & sync" : store.isSubmitting ? "Syncing changes…" : "\(store.syncQueue.count) \(store.syncQueue.count == 1 ? "change" : "changes") waiting for Wi-Fi")
                            .font(.caption).foregroundStyle(.secondary).padding(.vertical, 4)
                    }
                    if let snapshot = store.snapshot, !store.isDemo {
                        Text("Balances last synced: \(FinanceDate.instant(snapshot.fetchedAt)?.formatted(date: .abbreviated, time: .shortened) ?? snapshot.fetchedAt)")
                            .font(.caption2).foregroundStyle(.secondary).padding(.bottom, 4)
                    }
                }
            }
            .background(FinanceTheme.canvas)
            .toolbar(.hidden, for: .navigationBar)
            .toolbar(.hidden, for: .tabBar)
        }
    }
}
