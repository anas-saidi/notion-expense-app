import Foundation
import Testing
#if canImport(FinanceCore)
@testable import FinanceCore
#else
@testable import CoupleFinance
#endif

struct JointDebtContractTests {
    @Test func preservesExactDebtAmountsAndKeepsThemInsideTotalDue() throws {
        let data = Data(#"{"fundingGap":1100.25,"anasPlan":750.25,"salmaPlan":350,"anasActual":0,"salmaActual":0,"anasPersonalDebt":100.25,"salmaPersonalDebt":0}"#.utf8)
        let status = try JSONDecoder().decode(ContributionStatus.self, from: data)
        #expect(status.personalDebt(for: .anas) == Decimal(string: "100.25"))
        #expect(status.personalDebt(for: .salma) == 0)
        #expect(status.personalDebt(for: .joint) == Decimal(string: "100.25"))
        #expect(status.anasPlan - status.anasActual == Decimal(string: "750.25"))
        #expect(try JSONDecoder().decode(ContributionStatus.self, from: JSONEncoder().encode(status)) == status)
    }
    @Test func opensEarlierCachedSnapshotsWithoutDebtFields() throws {
        let data = Data(#"{"fundingGap":1000,"anasPlan":650,"salmaPlan":350,"anasActual":0,"salmaActual":0}"#.utf8)
        let status = try JSONDecoder().decode(ContributionStatus.self, from: data)
        #expect(status.anasPersonalDebt == nil)
        #expect(status.personalDebt(for: .joint) == 0)
    }
}
