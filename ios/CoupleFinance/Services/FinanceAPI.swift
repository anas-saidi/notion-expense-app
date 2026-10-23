import Foundation

struct FinanceAPI: FinanceTransport {
    let baseURL: URL
    let key: String

    static func validatedURL(_ text: String) throws -> URL {
        guard let components = URLComponents(string: text.trimmingCharacters(in: .whitespacesAndNewlines)),
              allowedTransport(components), components.host != nil, components.user == nil,
              components.password == nil, components.query == nil, components.fragment == nil,
              components.path.isEmpty || components.path == "/", let url = components.url
        else { throw FinanceError.message("Enter the HTTPS address of your finance app, without a path.") }
        return url
    }

    private static func allowedTransport(_ components: URLComponents) -> Bool {
        if components.scheme == "https" { return true }
        #if DEBUG && targetEnvironment(simulator)
        // Local simulator development stays on this Mac's loopback interface.
        return components.scheme == "http" && components.host == "localhost"
        #else
        return false
        #endif
    }

    func snapshot(month: String) async throws -> FinanceSnapshot {
        var url = URLComponents(url: baseURL.appending(path: "api/native/snapshot"), resolvingAgainstBaseURL: false)
        url?.queryItems = [.init(name: "month", value: month)]
        guard let url = url?.url else { throw FinanceError.message("Invalid server address.") }
        let snapshot = try JSONDecoder().decode(FinanceSnapshot.self, from: await request(url: url))
        guard snapshot.schemaVersion == 1, snapshot.month == month else {
            throw FinanceError.message("The server returned an unsupported snapshot. Your saved data has been kept.")
        }
        return snapshot
    }

    func submit(_ draft: TransactionDraft) async throws {
        struct Operation: Encodable { let requestId: UUID; let operation: String; let input: NativeInput }
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        let body = try encoder.encode(Operation(requestId: draft.id, operation: draft.operation, input: draft.input))
        _ = try await request(url: baseURL.appending(path: "api/native/operations"), body: body, wifiOnly: true)
    }

    func resourceData(_ kind: String, parameters: [String: String] = [:], post: Bool = false) async throws -> Data {
        var url = URLComponents(url: baseURL.appending(path: "api/native/resources"), resolvingAgainstBaseURL: false)
        url?.queryItems = [URLQueryItem(name: "kind", value: kind)] + parameters.sorted { $0.key < $1.key }.map { URLQueryItem(name: $0.key, value: $0.value) }
        guard let url = url?.url else { throw FinanceError.message("Invalid resource address.") }
        return try await request(url: url, body: post ? Data("{}".utf8) : nil)
    }

    func assistant(_ input: AssistantRequest) async throws -> Data {
        try await request(url: baseURL.appending(path: "api/native/assistant"), body: JSONEncoder().encode(input))
    }

    private func request(url: URL, body: Data? = nil, wifiOnly: Bool = false) async throws -> Data {
        var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 90)
        request.httpMethod = body == nil ? "GET" : "POST"
        request.httpBody = body
        request.setValue("Bearer \(key)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if body != nil { request.setValue("application/json", forHTTPHeaderField: "Content-Type") }
        let config = URLSessionConfiguration.ephemeral
        config.httpShouldSetCookies = false
        if wifiOnly { config.allowsCellularAccess = false; config.allowsExpensiveNetworkAccess = false }
        let session = URLSession(configuration: config, delegate: SameOriginDelegate(origin: baseURL), delegateQueue: nil)
        defer { session.finishTasksAndInvalidate() }
        let (data, response) = try await session.data(for: request)
        guard let response = response as? HTTPURLResponse else { throw FinanceError.message("The server did not respond.") }
        guard (200...299).contains(response.statusCode) else {
            struct ErrorBody: Decodable { let error: String }
            let message = (try? JSONDecoder().decode(ErrorBody.self, from: data).error) ?? "The server returned \(response.statusCode). Try again from Settings."
            throw FinanceError.server(response.statusCode, message)
        }
        return data
    }
}
