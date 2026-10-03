import { expect, it } from "vitest";
import { queryMirrorPages, UnsupportedMirrorQuery } from "./query";
const page = (id: number, type = "Expense") => ({ id: String(id), properties: {
  Type: { select: { name: type } }, Date: { date: { start: `2026-10-${String(id % 28 + 1).padStart(2, "0")}` } },
  Category: { relation: [{ id: "a-b-c" }] }, Archived: { checkbox: false },
} });
it("paginates the complete monthly report beyond 100 rows with stable mirror cursors", () => {
  const pages = Array.from({ length: 230 }, (_, i) => page(i));
  const body = { filter: { and: [{ property: "Type", select: { does_not_equal: "Due" } }, { property: "Date", date: { on_or_after: "2026-10-01" } }, { property: "Category", relation: { is_not_empty: true } }] }, sorts: [{ property: "Date", direction: "descending" }] };
  const first = queryMirrorPages([...pages, page(999, "Due")], body);
  const second = queryMirrorPages(pages, { ...body, start_cursor: first.next_cursor });
  const third = queryMirrorPages(pages, { ...body, start_cursor: second.next_cursor });
  expect([...first.results, ...second.results, ...third.results]).toHaveLength(230);
  expect(new Set([...first.results, ...second.results, ...third.results].map(p => p.id)).size).toBe(230);
  expect(third.has_more).toBe(false);
  expect(first.results[0].properties.Date.date.start >= first.results[99].properties.Date.date.start).toBe(true);
});
it("supports the combined bill query and normalizes relation identities", () => {
  const payment: any = page(1); payment.properties.Bill = { relation: [{ id: "abc" }] };
  const due: any = page(2, "Due"); due.properties.Bill = { relation: [] };
  expect(queryMirrorPages([payment, due], { filter: { or: [
    { property: "Type", select: { equals: "Due" } },
    { and: [{ property: "Type", select: { equals: "Expense" } }, { property: "Bill", relation: { contains: "a-b-c" } }] },
  ] } }).results).toHaveLength(2);
});
it("falls back for unknown operators, missing properties and live cursors", () => {
  expect(() => queryMirrorPages([page(1)], { filter: { property: "Amount", number: { greater_than: 3 } } })).toThrow(UnsupportedMirrorQuery);
  expect(() => queryMirrorPages([page(1)], { start_cursor: "notion-cursor" })).toThrow(UnsupportedMirrorQuery);
  expect(() => queryMirrorPages([page(1)], { filter: { property: "Type", select: { unknown: "Expense" } } })).toThrow(UnsupportedMirrorQuery);
});
