import Observation

@MainActor @Observable final class AppNavigation {
    static let shared = AppNavigation()
    var requestedAction: FinanceAction?
}
