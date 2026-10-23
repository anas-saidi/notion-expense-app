import SwiftUI

struct AccountsView: View {
    @Environment(FinanceStore.self) private var store
    var body: some View {
        List {
            ForEach(WalletScope.allCases) { scope in
                Section(scope.title) {
                    ForEach(store.snapshot?.accounts.filter { $0.scope == scope } ?? []) { account in
                        NavigationLink(value: account) { LabeledContent(account.label) { MoneyText(amount: account.balance) } }
                    }
                }
            }
            Section("Other accounts") {
                ForEach(store.snapshot?.accounts.filter { $0.scope == nil } ?? []) { account in
                    NavigationLink(value: account) { LabeledContent(account.label) { MoneyText(amount: account.balance) } }
                }
            }
        }.navigationTitle("Accounts")
        .navigationDestination(for: FinanceAccount.self) { AccountDetail(account: $0) }
    }
}
