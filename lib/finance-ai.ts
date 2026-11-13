import { isCalendarDate } from "./bills";
import type { TypedTransaction } from "./typed-transactions";

export type AIOption = { id: string; name: string };
export type AIDraft = TypedTransaction & { categoryId: string | null; accountId: string | null };
export type BudgetOption = AIOption & { available: number; reserved: number };
export type SuggestedMove = { fromId: string; toId: string; amount: number; reason: string };
export type ReallocationSuggestion = { explanation: string; moves: SuggestedMove[]; balances: Record<string, number> };

export const aiError = (message: string, status = 400) => Object.assign(new Error(message), { status });
const object = (value: unknown): value is Record<string, any> => !!value && typeof value === "object" && !Array.isArray(value);
const money = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value > 0 && value <= 999999999 && Math.abs(value * 100 - Math.round(value * 100)) < 0.00001;
const shortText = (value: unknown, max: number): value is string => typeof value === "string" && !!value.trim() && value.length <= max;
const invalid = () => aiError("Gemini returned an invalid suggestion. Nothing was changed. Try rephrasing.", 502);

export function validateParsing(value: unknown, categories: AIOption[], accounts: AIOption[]): { transactions: AIDraft[]; questions: string[] } {
  if (!object(value) || !Array.isArray(value.transactions) || value.transactions.length > 50 || !Array.isArray(value.questions) || value.questions.length > 10 || !value.questions.every((q: unknown) => shortText(q, 300))) throw invalid();
  const transactions = value.transactions.map((t: unknown): AIDraft => {
    if (!object(t) || !shortText(t.name, 200) || /[\r\n]/.test(t.name) || !money(t.amount) || !isCalendarDate(t.date) || !["Expense", "Income"].includes(t.type) ||
      !(t.categoryId === null || categories.some(c => c.id === t.categoryId)) || !(t.accountId === null || accounts.some(a => a.id === t.accountId))) throw invalid();
    return { name: t.name.trim(), amount: t.amount, date: t.date, type: t.type, categoryId: t.type === "Income" ? null : t.categoryId, accountId: t.accountId };
  });
  if (!transactions.length && !value.questions.length) throw aiError("No transactions found. Include what you spent or received and the amount.", 422);
  return { transactions, questions: value.questions };
}

/** Validate cumulative donor spending in cents, never trust model arithmetic. */
export function validateReallocation(value: unknown, categories: BudgetOption[]): ReallocationSuggestion {
  if (!object(value) || !shortText(value.explanation, 1200) || !Array.isArray(value.moves) || value.moves.length > 20) throw invalid();
  const byId = new Map(categories.map(c => [c.id, c]));
  const outgoing = new Map<string, number>();
  const incoming = new Map<string, number>();
  const pairs = new Set<string>();
  const moves = value.moves.map((m: unknown): SuggestedMove => {
    if (!object(m) || !byId.has(m.fromId) || !byId.has(m.toId) || m.fromId === m.toId || !money(m.amount) || !Number.isInteger(m.amount) || !shortText(m.reason, 300)) throw invalid();
    const key = `${m.fromId}:${m.toId}`;
    if (pairs.has(key)) throw invalid();
    pairs.add(key);
    outgoing.set(m.fromId, (outgoing.get(m.fromId) ?? 0) + Math.round(m.amount * 100));
    incoming.set(m.toId, (incoming.get(m.toId) ?? 0) + Math.round(m.amount * 100));
    return { fromId: m.fromId, toId: m.toId, amount: m.amount, reason: m.reason.trim() };
  });
  for (const [id, amount] of outgoing) {
    const category = byId.get(id)!;
    // A received move cannot be used to justify draining the same category.
    if (incoming.has(id) || amount > Math.max(0, Math.floor((category.available - category.reserved) * 100))) throw invalid();
  }
  return { explanation: value.explanation.trim(), moves, balances: Object.fromEntries(categories.map(c => [c.id, c.available])) };
}

const string = { type: "string" };
const nullableString = { type: ["string", "null"] };
export const parsingSchema = { type: "object", required: ["transactions", "questions"], properties: {
  transactions: { type: "array", items: { type: "object", required: ["name", "amount", "date", "type", "categoryId", "accountId"], properties: {
    name: string, amount: { type: "number" }, date: string, type: { type: "string", enum: ["Expense", "Income"] }, categoryId: nullableString, accountId: nullableString,
  } } }, questions: { type: "array", items: string },
} };
export const reallocationSchema = { type: "object", required: ["explanation", "moves"], properties: {
  explanation: string, moves: { type: "array", items: { type: "object", required: ["fromId", "toId", "amount", "reason"], properties: {
    fromId: string, toId: string, amount: { type: "integer" }, reason: string,
  } } },
} };

const fold = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * What Suggest moves sends Gemini: only the categories that matter to this ask, not the whole budget.
 * Extra categories are noise the model can latch onto. In order, up to `max`:
 * 1. Named: categories the request mentions (by name or a word of it, 3+ letters, accents and plurals ignored).
 * 2. Short: categories below zero, the likely receivers.
 * 3. Givers: categories with money to spare after their unpaid bills, most spare first.
 * Categories with nothing to give and no part in the ask stay out. Names and figures only.
 */
export function pickReallocationContext(text: string, budget: BudgetOption[], max = 12): BudgetOption[] {
  const words = new Set(fold(text).split(/[^\p{L}\p{N}]+/u).filter(word => word.length >= 3));
  const said = fold(text);
  const named = budget.filter(c => {
    const name = fold(c.name);
    // "repair" names "Repairs": a shared stem of 4+ letters counts, as does an exact short word.
    const sameWord = (a: string, b: string) => a === b || (Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a)) && Math.abs(a.length - b.length) <= 2);
    return said.includes(name) || name.split(/[^\p{L}\p{N}]+/u).some(word => word.length >= 3 && [...words].some(w => sameWord(w, word)));
  });
  const short = budget.filter(c => c.available < -0.5).sort((a, b) => a.available - b.available);
  const spare = (c: BudgetOption) => c.available - c.reserved;
  const givers = budget.filter(c => spare(c) >= 1).sort((a, b) => spare(b) - spare(a));
  const picked: BudgetOption[] = [];
  const add = (c: BudgetOption) => { if (picked.length < max && !picked.some(p => p.id === c.id)) picked.push(c); };
  named.forEach(add);
  short.forEach(add);
  // Keep room for at least a few givers even when many categories are named or short.
  const reserveForGivers = Math.min(3, givers.length);
  while (picked.length > max - reserveForGivers && picked.length > 0 && givers.some(g => !picked.some(p => p.id === g.id))) picked.pop();
  givers.forEach(add);
  // A move needs two categories; top up from the largest balances, never the whole budget.
  for (const c of [...budget].sort((a, b) => b.available - a.available)) { if (picked.length >= 2) break; add(c); }
  return picked;
}
