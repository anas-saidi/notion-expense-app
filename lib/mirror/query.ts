/** The read patterns used by this app. Unknown filters fall back to Notion. */
export class UnsupportedMirrorQuery extends Error {}
const text = (p: any) => (p?.rich_text ?? p?.title ?? []).map((t: any) => t.plain_text ?? t.text?.content ?? "").join("");
const fail = (): never => { throw new UnsupportedMirrorQuery("Query requires a live Notion read"); };
function matches(page: any, filter: any): boolean {
  if (!filter) return true;
  if (filter.and) return filter.and.every((f: any) => matches(page, f));
  if (filter.or) return filter.or.some((f: any) => matches(page, f));
  const p = page.properties?.[filter.property];
  if (!p) return fail();
  const kind = Object.keys(filter).find(k => k !== "property");
  const condition = filter[kind ?? ""];
  if (!condition || Object.keys(condition).length !== 1) return fail();
  const [op, expected] = Object.entries(condition)[0];
  let value: any;
  switch (kind) {
    case "checkbox": value = p.checkbox ?? false; break;
    case "select": value = p.select?.name ?? null; break;
    case "relation": {
      const ids = (p.relation ?? []).map((r: any) => r.id.replace(/-/g, "").toLowerCase());
      if (op === "is_empty") return !ids.length;
      if (op === "is_not_empty") return !!ids.length;
      if (op === "contains") return ids.includes(String(expected).replace(/-/g, "").toLowerCase());
      return fail();
    }
    case "date": value = p.date?.start?.slice(0, 10) ?? null; break;
    case "rich_text": case "title": value = text(p); break;
    case "number": value = p.number ?? null; break;
    default: return fail();
  }
  if (op === "equals") return value === expected;
  if (op === "does_not_equal") return value !== expected;
  if (op === "is_empty") return value === null || value === "";
  if (op === "is_not_empty") return value !== null && value !== "";
  if (op === "on_or_after" && kind === "date") return value !== null && value >= String(expected).slice(0, 10);
  if (op === "on_or_before" && kind === "date") return value !== null && value <= String(expected).slice(0, 10);
  return fail();
}
export function queryMirrorPages(pages: any[], body: any = {}) {
  const rows = pages.filter(p => !p.archived && !p.in_trash && matches(p, body.filter));
  const sorts: any[] = body.sorts ?? [];
  rows.sort((a, b) => {
    for (const sort of sorts) {
      let av: any, bv: any;
      if (sort.timestamp === "created_time" || sort.timestamp === "last_edited_time") {
        av = a[sort.timestamp]; bv = b[sort.timestamp];
      } else {
        const value = (page: any) => {
          const p = page.properties?.[sort.property];
          if (!p) return fail();
          if (p.type === "date" || "date" in p) return p.date?.start ?? "";
          if (p.type === "title" || "title" in p) return text(p);
          return fail();
        };
        av = value(a); bv = value(b);
      }
      const cmp = String(av ?? "").localeCompare(String(bv ?? ""));
      if (cmp) return sort.direction === "descending" ? -cmp : cmp;
    }
    return 0;
  });
  const start = body.start_cursor ? Number(String(body.start_cursor).replace(/^mirror:/, "")) : 0;
  if (!Number.isInteger(start) || start < 0 || (body.start_cursor && !String(body.start_cursor).startsWith("mirror:"))) return fail();
  const size = Math.min(100, Math.max(1, body.page_size ?? 100));
  const more = start + size < rows.length;
  return { results: rows.slice(start, start + size), has_more: more, next_cursor: more ? `mirror:${start + size}` : null };
}
