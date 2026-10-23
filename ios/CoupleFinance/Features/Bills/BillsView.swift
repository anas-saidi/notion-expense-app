import SwiftUI

struct BillsView: View {
    @Environment(FinanceStore.self) private var store
    @State private var filter = "Due"
    @State private var adding = false
    @State private var selected: BillOccurrence?
    var body: some View {
        List {
            Picker("Bills", selection: $filter) {
                ForEach(["Due", "Paid", "Skipped"], id: \.self) { Text($0).tag($0) }
            }.pickerStyle(.segmented)
            ForEach(store.bills.filter { filter == "Due" ? ["Due", "Overdue"].contains($0.state) : $0.state == filter }) { bill in
                Button { selected = bill } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) { Text(bill.name); Text("\(bill.dueDate) · \(bill.state)").font(.caption).foregroundStyle(.secondary) }
                        Spacer(); MoneyText(amount: bill.amount)
                    }
                }.buttonStyle(.plain)
            }
            if let error = store.snapshot?.billsError { Text(error).foregroundStyle(.secondary) }
        }.navigationTitle("Bills")
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Add bill", systemImage: "plus") { adding = true } } }
            .sheet(isPresented: $adding) { BillEditor() }
            .sheet(item: $selected) { BillDetail(bill: $0) }
            .refreshable { await store.refresh() }
    }
}
