export const SPENDING_PATTERNS = ["Everyday", "Scheduled", "Flexible", "Goal"] as const;
export type SpendingPattern = typeof SPENDING_PATTERNS[number];
export const SPENDING_PATTERN_PROPERTY = "Spending pattern";

export function isSpendingPattern(value: unknown): value is SpendingPattern {
  return typeof value === "string" && SPENDING_PATTERNS.some(pattern => pattern === value);
}
