import Foundation

enum TypedEntryParser {
    static func parse(_ text: String, reference: Date = .now) throws -> [EntryReview] {
        let pattern = try NSRegularExpression(pattern: #"[+-]?\d+(?:[.,]\d{1,2})?(?!\d)"#)
        return try text.split(whereSeparator: \.isNewline).map { line in
            let source = String(line).trimmingCharacters(in: .whitespaces)
            let matches = pattern.matches(in: source, range: NSRange(source.startIndex..., in: source))
            guard matches.count == 1, let match = matches.first, let range = Range(match.range, in: source),
                  let amount = Decimal(string: String(source[range]).replacing(",", with: ".")), amount != 0
            else { throw FinanceError.message("Write one transaction per line with one amount, such as ‘coffee 19 yesterday’. Review ambiguous entries separately.") }
            var name = source.replacingCharacters(in: range, with: "").trimmingCharacters(in: .whitespaces)
            let income = source.hasPrefix("+") || ["income", "salary", "salaire", "received"].contains { source.localizedStandardContains($0) }
            let yesterday = ["yesterday", "hier", "البارح"].contains { source.localizedStandardContains($0) }
            for word in ["yesterday", "today", "hier", "aujourd'hui", "البارح"] { name = name.replacingOccurrences(of: word, with: "", options: .caseInsensitive) }
            name = name.trimmingCharacters(in: .whitespaces)
            guard !name.isEmpty else { throw FinanceError.message("Add a description to each transaction.") }
            let date = yesterday ? FinanceDate.calendar.date(byAdding: .day, value: -1, to: reference) ?? reference : reference
            return EntryReview(name: name, amount: abs(amount), date: FinanceDate.day(date), type: income ? "Income" : "Expense")
        }
    }
}
