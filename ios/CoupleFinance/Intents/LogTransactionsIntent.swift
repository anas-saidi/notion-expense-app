import AppIntents

struct LogTransactionsIntent: AppIntent {
    static let title: LocalizedStringResource = "Log transactions"
    static let description = IntentDescription("Open transaction entry in Couple Finance. Review and save inside the app.")
    static var supportedModes: IntentModes { .foreground }
    static var authenticationPolicy: IntentAuthenticationPolicy { .requiresAuthentication }

    @MainActor func perform() async throws -> some IntentResult {
        AppNavigation.shared.requestedAction = .logTransactions
        return .result()
    }
}
