/** A retry's financial identity must not depend on JSON dictionary key order. */
export function stableInput(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableInput);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, stableInput(entry)]));
  }
  return value;
}
