import SwiftUI

struct HomeView: View {
    @Environment(FinanceStore.self) private var store
    @State private var planning = false
    @State private var selectedBill: BillOccurrence?
    @State private var selectedTransaction: FinanceTransaction?
    private var recent: [FinanceTransaction] { Array(store.transactions.sorted { $0.date > $1.date }.prefix(8)) }
    private var dates: [String] { Set(recent.map { String($0.date.prefix(10)) }).sorted(by: >) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                VStack(spacing: 0) {
                    WalletFamily()
                    FinancialHero(label: "Balance", amount: store.cash, color: (store.cash ?? 0) < 0 ? FinanceTheme.expense : .primary)
                }.padding(.top, 12)
                PersonalJointDebtSummary()
                Button { planning = true } label: {
                    HStack {
                        Image(systemName: "calendar").font(.system(size: 18))
                        Text("Plan the month").fontWeight(.medium).fixedSize(horizontal: false, vertical: true)
                        Spacer()
                        Image(systemName: "arrow.right").font(.system(size: 18))
                    }.font(.subheadline).padding(16)
                        .background(.primary.opacity(0.04), in: .rect(cornerRadius: 16))
                }.buttonStyle(.plain)
                if !store.backup.drafts.isEmpty {
                    NavigationLink(value: HomeDestination.drafts) { Label("Review \(store.backup.drafts.count) drafts", systemImage: "square.and.pencil") }
                }
                if let billError = store.snapshot?.billsError {
                    Text(billError).font(.subheadline).foregroundStyle(.secondary)
                } else if !store.bills.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Text("Bills").font(.subheadline.weight(.semibold)).foregroundStyle(.secondary)
                            Spacer()
                            NavigationLink("All bills", value: HomeDestination.bills).font(.caption)
                        }
                        ForEach(store.bills) { bill in
                            Button { selectedBill = bill } label: {
                                HStack(spacing: 12) {
                                    Image(systemName: "calendar").frame(width: 36, height: 44).foregroundStyle(.secondary)
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(bill.name).font(.subheadline.weight(.semibold))
                                        Text("\(bill.dueDate) · \(bill.state)").font(.caption).foregroundStyle(.secondary)
                                    }
                                    Spacer()
                                    MoneyText(amount: bill.amount).font(.subheadline.weight(.semibold))
                                }.padding(.vertical, 8)
                            }.buttonStyle(.plain)
                        }
                    }
                }
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        Text("Recent").font(.subheadline.weight(.semibold)).foregroundStyle(.secondary)
                        Spacer()
                        NavigationLink(value: HomeDestination.pending) { Image(systemName: "basket").frame(width: 44, height: 44) }.accessibilityLabel("Pending purchases")
                    }
                    if recent.isEmpty { Text("No activity this month").font(.subheadline).foregroundStyle(.secondary) }
                    ForEach(dates, id: \.self) { day in
                        Text(FinanceDate.parse(day)?.formatted(date: .abbreviated, time: .omitted) ?? day)
                            .font(.caption).foregroundStyle(.secondary).padding(.top, 8)
                        ForEach(recent.filter { $0.date.hasPrefix(day) }) { transaction in
                            Button { selectedTransaction = transaction } label: { TransactionRow(transaction: transaction) }.buttonStyle(.plain)
                        }
                    }
                }
            }
            .frame(maxWidth: 592).padding(.horizontal, FinanceTheme.spacing).padding(.bottom, 24)
            .frame(maxWidth: .infinity)
        }
        .refreshable { await store.refresh() }
        .overlay { if store.snapshot == nil && store.isLoading { ProgressView("Loading finances") } }
        .navigationDestination(for: HomeDestination.self) { destination in
            switch destination { case .drafts: DraftsView(); case .bills: BillsView(); case .pending: PendingView() }
        }
        .sheet(isPresented: $planning) { MonthPlanner() }
        .sheet(item: $selectedBill) { BillDetail(bill: $0) }
        .sheet(item: $selectedTransaction) { TransactionDetail(transaction: $0) }
    }
}
