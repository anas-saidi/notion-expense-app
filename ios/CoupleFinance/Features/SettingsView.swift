import SwiftUI
import UniformTypeIdentifiers

struct SettingsView: View {
    @Environment(FinanceStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @AppStorage("financeAppearance") private var appearance = "system"
    @State private var syncing = false
    @State private var address = ""
    @State private var key = ""
    @State private var connecting = false
    @State private var message: String?
    @State private var exportDocument: BackupDocument?
    @State private var exporting = false
    @State private var importing = false
    @State private var restoreData: Data?
    @State private var confirmingRestore = false
    var body: some View {
        NavigationStack {
            Form {
                if !store.isDemo {
                Section("Connection") {
                    TextField("https://your-finance-app.vercel.app", text: $address)
                        .textInputAutocapitalization(.never).autocorrectionDisabled().keyboardType(.URL)
                        .accessibilityLabel("Finance server address")
                    SecureField("Device access key", text: $key).textInputAutocapitalization(.never).autocorrectionDisabled()
                    Button(connecting ? "Connecting…" : "Connect securely") { Task { await connect() } }
                        .disabled(connecting || key.isEmpty || address.isEmpty)
                    Text("Use the separate native device key configured on your server. Your Notion secret stays on the server.")
                        .font(.caption).foregroundStyle(.secondary)
                }
                }
                Section("Preferences") {
                    Picker("Appearance", selection: $appearance) { Text("System").tag("system"); Text("Light").tag("light"); Text("Dark").tag("dark") }
                }
                BillNotificationSettings()
                DailyTransactionReminderSettings()
                if store.isConnected {
                    Section("Notion sync") {
                        Text("Saved changes upload automatically over Wi-Fi. Background sync runs when iOS allows it; opening the app also resumes sync.").font(.caption).foregroundStyle(.secondary)
                        Button("Send queued changes") { Task { await store.synchronizeQueuedChanges() } }.disabled(!store.canSyncOnWiFi || store.isSubmitting)
                        Button(syncing ? "Syncing…" : "Sync now", systemImage: "arrow.triangle.2.circlepath") { Task { await sync() } }.disabled(syncing)
                    }
                }
                Section("Finances") {
                    NavigationLink(value: "accounts") { Label("Accounts", systemImage: "building.columns") }
                    NavigationLink(value: "drafts") { Label("Drafts & sync", systemImage: "square.and.pencil") }
                    NavigationLink(value: "pending") { Label("Pending purchases", systemImage: "basket") }
                    NavigationLink(value: "bills") { Label("Bills", systemImage: "calendar") }
                    NavigationLink(value: "work") { Label("Cost in work time", systemImage: "clock") }

                }
                Section("Backup & restore") {
                    Button("Export backup to Files", systemImage: "square.and.arrow.up") {
                        do { exportDocument = BackupDocument(data: try store.backup.encoded()); exporting = true }
                        catch { message = error.localizedDescription }
                    }
                    Button("Restore from Files", systemImage: "square.and.arrow.down") { importing = true }
                    Text("Includes cached finances and unsent drafts. Keep exports private. Device keys are excluded. A phone backup does not replace your full Notion workspace backup.")
                        .font(.caption).foregroundStyle(.secondary)
                }
                Section("Personal installation") {
                    Text("Keep the same bundle ID and signing account for updates. Renew the existing installation before its seven-day profile expires. Export a backup before changing signing methods.")
                        .font(.subheadline).foregroundStyle(.secondary)
                }
                if let message { Section { Text(message).font(.subheadline) } }
            }
            .sensoryFeedback(.selection, trigger: appearance)
            .navigationTitle("Settings").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() }.disabled(connecting) } }
            .navigationDestination(for: String.self) { destination in
                switch destination {
                case "accounts": AccountsView()
                case "pending": PendingView()
                case "bills": BillsView()
                case "work": WorkTimeSettings()
                default: DraftsView()
                }
            }
            .onAppear { address = store.serverAddress }
            .fileExporter(isPresented: $exporting, document: exportDocument, contentType: .json,
                defaultFilename: "couple-finance-\(FinanceDate.day(.now))") { result in
                switch result { case .success: message = "Backup exported."; case .failure(let error): message = error.localizedDescription }
            }
            .fileImporter(isPresented: $importing, allowedContentTypes: [.json]) { result in
                do {
                    let url = try result.get()
                    guard url.startAccessingSecurityScopedResource() else { throw FinanceError.message("The backup could not be opened. Choose it again from Files.") }
                    defer { url.stopAccessingSecurityScopedResource() }
                    let data = try Data(contentsOf: url, options: .mappedIfSafe)
                    _ = try FinanceBackup.decode(data)
                    restoreData = data
                    confirmingRestore = true
                } catch { message = error.localizedDescription }
            }
            .confirmationDialog("Restore this backup?", isPresented: $confirmingRestore, titleVisibility: .visible) {
                Button("Merge backup") {
                    guard let restoreData else { return }
                    do { try store.restore(restoreData); message = "Restored. No transactions were sent to Notion." }
                    catch { message = error.localizedDescription }
                    self.restoreData = nil
                }
            } message: { Text("Existing drafts are kept. Cached months use the newest snapshot. Nothing is sent to Notion.") }
        }
    }
    private func sync() async {
        syncing = true; defer { syncing = false }
        do { try await store.syncNotion(); message = "Finances refreshed from Notion." }
        catch { message = error.localizedDescription }
    }
    private func connect() async {
        connecting = true
        defer { connecting = false }
        do { try await store.connect(address: address, key: key); key = ""; message = "Connected to your finances." }
        catch { message = error.localizedDescription }
    }
}
