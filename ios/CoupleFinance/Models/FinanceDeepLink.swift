import Foundation

enum FinanceDeepLink {
    static func action(for url: URL) -> FinanceAction? {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              components.scheme?.lowercased() == "couplefinance",
              components.host?.lowercased() == "log-transactions",
              components.path.isEmpty,
              components.user == nil, components.password == nil,
              components.port == nil, components.query == nil, components.fragment == nil
        else { return nil }
        return .logTransactions
    }
}
