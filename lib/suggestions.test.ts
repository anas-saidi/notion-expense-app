import { describe, expect, it } from "vitest";
import { habitSuggestions, rebalanceSuggestions } from "./suggestions";

const today = "2026-11-13"; // a Friday
const tx = (name: string, amount: number, date: string, type = "Expense") => ({ name, amount, date, type });

describe("habitSuggestions", () => {
  it("needs three entries in 60 days and uses the median of the last five", () => {
    const pills = habitSuggestions([
      tx("Coffee", 20, "2026-11-12"), tx("Coffee", 22, "2026-11-11"), tx("Coffee", 18, "2026-11-10"),
      tx("Lunch", 115, "2026-11-12"), tx("Lunch", 90, "2026-11-01"),
      tx("Gaz", 40, "2026-08-01"), tx("Gaz", 40, "2026-08-02"), tx("Gaz", 40, "2026-08-03"),
    ], today);
    expect(pills).toEqual(["coffee 20"]);
  });
  it("hides a habit already logged today unless it happens several times a day", () => {
    const once = [tx("Gym", 50, "2026-11-13"), tx("Gym", 50, "2026-11-11"), tx("Gym", 50, "2026-11-09")];
    expect(habitSuggestions(once, today)).toEqual([]);
    const several = [tx("Coffee", 20, "2026-11-13"), tx("Coffee", 20, "2026-11-12"), tx("Coffee", 20, "2026-11-12")];
    expect(habitSuggestions(several, today)).toEqual(["coffee 20"]);
  });
  it("puts today's weekday habits first and ignores income", () => {
    const pills = habitSuggestions([
      tx("Bread", 5, "2026-11-12"), tx("Bread", 5, "2026-11-11"), tx("Bread", 5, "2026-11-10"), tx("Bread", 5, "2026-11-09"),
      tx("Market", 200, "2026-11-06"), tx("Market", 180, "2026-10-30"), tx("Market", 210, "2026-10-23"),
      tx("Salary", 9000, "2026-11-01", "Income"), tx("Salary", 9000, "2026-10-01", "Income"), tx("Salary", 9000, "2026-09-01", "Income"),
    ], today);
    expect(pills).toEqual(["market 200", "bread 5"]);
  });
});

describe("rebalanceSuggestions", () => {
  const formatAmount = (value: number) => String(value);
  it("covers shortfalls first, then bills the category can't cover, naming the category for Gemini", () => {
    const pills = rebalanceSuggestions({
      categories: [{ id: "a", name: "Groceries", available: -120 }, { id: "b", name: "Admin", available: 100 }, { id: "c", name: "Medical", available: 900 }],
      bills: [{ name: "Wifi", categoryId: "b", amount: 400, dueDate: "2026-11-15" }, { name: "Dentist", categoryId: "c", amount: 800, dueDate: "2026-11-15" }],
      today, formatAmount,
    });
    expect(pills).toEqual(["Cover Groceries", "Cover the 400 Wifi bill in Admin"]);
  });
  it("ignores bills more than a week away and shows nothing when nothing needs fixing", () => {
    expect(rebalanceSuggestions({ categories: [{ id: "b", name: "Admin", available: 100 }], bills: [{ name: "Wifi", categoryId: "b", amount: 400, dueDate: "2026-11-30" }], today, formatAmount })).toEqual([]);
  });
});
