import SwiftUI

@main struct CoupleFinanceApp: App {
    @UIApplicationDelegateAdaptor(FinanceAppDelegate.self) private var appDelegate
    @AppStorage("financeAppearance") private var appearance = "system"
    @State private var session: AppSession?
    @State private var startupError: String?

    var body: some Scene {
        WindowGroup {
            Group {
                if let session { RootView().environment(session.active).environment(session).id(session.preview != nil) }
                else if let startupError {
                    ContentUnavailableView {
                        Label("Your data could not be opened", systemImage: "externaldrive.badge.exclamationmark")
                    } description: {
                        Text("\(startupError)\nYour stored data has been preserved. Close and reopen the app to try again.")
                    }
                } else { ProgressView("Opening your finances") }
            }
            .tint(FinanceTheme.ink)
            .fontDesign(.rounded)
            .preferredColorScheme(appearance == "system" ? nil : appearance == "dark" ? .dark : .light)
            .onOpenURL { url in
                if let action = FinanceDeepLink.action(for: url) {
                    AppNavigation.shared.requestedAction = action
                }
            }
            .task {
                guard session == nil, startupError == nil else { return }
                do {
                    let opened = try AppSession()
                    #if DEBUG && targetEnvironment(simulator)
                    if ProcessInfo.processInfo.arguments.contains("--connect-local-preview"),
                       let key = ProcessInfo.processInfo.environment["FINANCE_LOCAL_PREVIEW_KEY"] {
                        try await opened.live.connect(address: "http://localhost:4340", key: key)
                    }
                    #endif
                    #if DEBUG || PERSONAL_INSTALL_SETUP
                    if ProcessInfo.processInfo.arguments.contains("--configure-device") {
                        try await DeviceConnectionSetup.apply(to: opened.live)
                    }
                    #endif
                    session = opened
                }
                catch { startupError = error.localizedDescription }
            }
        }
    }
}
