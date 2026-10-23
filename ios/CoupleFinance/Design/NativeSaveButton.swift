import SwiftUI

struct NativeSaveButton: View {
    let title: String
    var disabled = false
    let action: () async throws -> Void
    @State private var saving = false
    @State private var error: String?
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Button {
                saving = true
                Task {
                    do { try await action() }
                    catch { self.error = error.localizedDescription }
                    saving = false
                }
            } label: {
                HStack { if saving { ProgressView() }; Text(saving ? "Saving…" : title).frame(maxWidth: .infinity) }
            }
            .sensoryFeedback(.impact(weight: .light, intensity: 0.5), trigger: saving) { _, started in started }
            .sensoryFeedback(.error, trigger: error) { _, error in error != nil }
            .buttonStyle(.borderedProminent).disabled(disabled || saving || error != nil)
            if let error {
                Text(error).font(.subheadline).foregroundStyle(FinanceTheme.expense)
                Text("Review the saved request in Drafts before starting another save.").font(.caption).foregroundStyle(.secondary)
            }
        }
    }
}
