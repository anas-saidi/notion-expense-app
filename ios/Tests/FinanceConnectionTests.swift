#if canImport(CoupleFinance)
import Testing
@testable import CoupleFinance

struct FinanceConnectionTests {
    @Test(arguments: ["http://finance.example", "http://192.168.1.2:4340", "http://localhost.example:4340",
                      "http://localhost:4340/api", "http://user@localhost:4340", "https://finance.example?key=secret"])
    func rejectsUnsafeConnectionAddresses(value: String) {
        #expect(throws: (any Error).self) { try FinanceAPI.validatedURL(value) }
    }

    @Test func acceptsSecureServer() throws {
        #expect(try FinanceAPI.validatedURL("https://finance.example").host == "finance.example")
    }

    @Test func loopbackIsOnlyAvailableInDebugSimulator() throws {
        #if DEBUG && targetEnvironment(simulator)
        #expect(try FinanceAPI.validatedURL("http://localhost:4340").host == "localhost")
        #else
        #expect(throws: (any Error).self) { try FinanceAPI.validatedURL("http://localhost:4340") }
        #endif
    }
}
#endif
