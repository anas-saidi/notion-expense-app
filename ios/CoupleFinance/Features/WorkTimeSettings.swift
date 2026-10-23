import SwiftUI

struct WorkTimeSettings: View {
    @Environment(FinanceStore.self) private var store
    @AppStorage("workRate.joint") private var joint = 0.0
    @AppStorage("workRate.anas") private var anas = 0.0
    @AppStorage("workRate.salma") private var salma = 0.0
    @State private var rate = 0.0
    @State private var pay = 0.0
    @State private var hours = 40.0
    @State private var frequency = 12.0
    @State private var message: String?
    var body: some View {
        Form {
            Section("\(store.scope.title) · hourly rate") {
                TextField("Take-home MAD per hour", value: $rate, format: .number).keyboardType(.decimalPad)
                Button("Save rate") { save(rate) }.disabled(rate <= 0)
                Button("Remove rate", role: .destructive) { rate = 0; save(0) }
            }
            Section("Calculate from salary") {
                TextField("Take-home pay in MAD", value: $pay, format: .number).keyboardType(.decimalPad)
                Picker("Pay period", selection: $frequency) { Text("Monthly").tag(12.0); Text("Weekly").tag(52.0); Text("Yearly").tag(1.0) }
                TextField("Hours per week", value: $hours, format: .number).keyboardType(.decimalPad)
                Button("Use calculated rate") { rate = pay * frequency / (hours * 52); save(rate) }.disabled(pay <= 0 || hours <= 0 || hours > 168)
            }
            if let message { Text(message).foregroundStyle(.secondary) }
        }.navigationTitle("Cost in work time")
            .onAppear { rate = store.scope == .joint ? joint : store.scope == .anas ? anas : salma }
    }
    private func save(_ value: Double) {
        switch store.scope { case .joint: joint = value; case .anas: anas = value; case .salma: salma = value }
        message = value > 0 ? "Hourly rate saved on this device." : "Work-time display turned off."
    }
}
