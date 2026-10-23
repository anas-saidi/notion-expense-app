import Foundation

enum FinanceDate {
    static var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Africa/Casablanca") ?? .gmt
        return calendar
    }
    static func day(_ date: Date) -> String {
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        return "\(parts.year ?? 2000)-\(pad(parts.month ?? 1))-\(pad(parts.day ?? 1))"
    }
    static func instant(_ text: String) -> Date? {
        (try? Date(text, strategy: Date.ISO8601FormatStyle(includingFractionalSeconds: true))) ?? (try? Date(text, strategy: .iso8601))
    }
    static func month(_ date: Date) -> String { String(day(date).prefix(7)) }
    static func parse(_ day: String) -> Date? {
        let parts = day.prefix(10).split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        return calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2], hour: 12))
    }
    private static func pad(_ number: Int) -> String { number < 10 ? "0\(number)" : "\(number)" }
}
