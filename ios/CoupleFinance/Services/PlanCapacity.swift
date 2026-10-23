import Foundation

/// Same cent-based funding rule as the web product: current Joint cash is used first.
enum PlanCapacity {
    static func remaining(capacity: [String: Decimal], planned: [String: Decimal], split: [String: Decimal]) -> [String: Decimal] {
        let jointCash = max(0, capacity["joint"] ?? 0)
        let needed = max(0, (planned["joint"] ?? 0) - jointCash)
        var rawAnas = needed * (split["anas"] ?? 0.65)
        var anas = Decimal.zero
        NSDecimalRound(&anas, &rawAnas, 2, .plain)
        let salma = needed - anas
        let anasLeft = (capacity["anas"] ?? 0) - (planned["anas"] ?? 0) - anas
        let salmaLeft = (capacity["salma"] ?? 0) - (planned["salma"] ?? 0) - salma
        let anasShare = split["anas"] ?? 0.65
        let salmaShare = split["salma"] ?? 0.35
        let anasCapacity = (capacity["anas"] ?? 0) - (planned["anas"] ?? 0)
        let salmaCapacity = (capacity["salma"] ?? 0) - (planned["salma"] ?? 0)
        let maximum = min(anasShare > 0 ? anasCapacity / anasShare : Decimal.greatestFiniteMagnitude,
                          salmaShare > 0 ? salmaCapacity / salmaShare : Decimal.greatestFiniteMagnitude)
        var rawMaximum = max(0, maximum)
        var contribution = Decimal.zero
        NSDecimalRound(&contribution, &rawMaximum, 2, .down)
        return ["joint": jointCash + contribution - (planned["joint"] ?? 0), "anas": anasLeft, "salma": salmaLeft]
    }
}
