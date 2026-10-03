import { UnsupportedMirrorQuery } from "./query";
/** Only fixed SQL fragments are emitted; property names and values are parameters. */
export function compileMirrorQuery(body: any = {}, firstParameter = 4) {
  const params: any[] = [];
  const parameter = (value: any) => { params.push(value); return `$${firstParameter + params.length - 1}`; };
  const unsupported = (): never => { throw new UnsupportedMirrorQuery("Query requires Notion"); };
  const property = (name: unknown) => {
    if (typeof name !== "string") return unsupported();
    return `(page->'properties'->${parameter(name)})`;
  };
  const filter = (f: any): string => {
    if (!f) return "true";
    if (f.and || f.or) {
      const parts = f.and ?? f.or;
      if (!Array.isArray(parts)) return unsupported();
      return parts.length ? `(${parts.map(filter).join(f.and ? " AND " : " OR ")})` : f.and ? "true" : "false";
    }
    const p = property(f.property);
    const kind = Object.keys(f).find(k => k !== "property");
    const condition = f[kind ?? ""];
    if (!condition || Object.keys(condition).length !== 1) return unsupported();
    const [op, value] = Object.entries(condition)[0];
    if (kind === "relation") {
      const rows = `COALESCE(${p}->'relation','[]'::jsonb)`;
      if (op === "is_empty") return `jsonb_array_length(${rows})=0`;
      if (op === "is_not_empty") return `jsonb_array_length(${rows})>0`;
      if (op === "contains") return `EXISTS (SELECT 1 FROM jsonb_array_elements(${rows}) relation WHERE lower(replace(relation->>'id','-',''))=${parameter(String(value).replace(/-/g, "").toLowerCase())})`;
      return unsupported();
    }
    let expression: string;
    if (kind === "checkbox") expression = `COALESCE((${p}->>'checkbox')::boolean,false)`;
    else if (kind === "select") expression = `${p}->'select'->>'name'`;
    else if (kind === "date") expression = `left(${p}->'date'->>'start',10)`;
    else if (kind === "number") expression = `(${p}->>'number')::numeric`;
    else if (kind === "rich_text" || kind === "title") expression = `(SELECT COALESCE(string_agg(COALESCE(item->>'plain_text',item->'text'->>'content',''),''),'') FROM jsonb_array_elements(COALESCE(${p}->'${kind}','[]'::jsonb)) item)`;
    else return unsupported();
    if (op === "equals") return `${expression} IS NOT DISTINCT FROM ${parameter(value)}`;
    if (op === "does_not_equal") return `${expression} IS DISTINCT FROM ${parameter(value)}`;
    if (op === "is_empty") return `(${expression} IS NULL${kind === "rich_text" || kind === "title" ? ` OR ${expression}=''` : ""})`;
    if (op === "is_not_empty") return `(${expression} IS NOT NULL${kind === "rich_text" || kind === "title" ? ` AND ${expression}<>''` : ""})`;
    if (kind === "date" && (op === "on_or_after" || op === "on_or_before")) return `${expression} ${op === "on_or_after" ? ">=" : "<="} ${parameter(String(value).slice(0, 10))}`;
    return unsupported();
  };
  const where = filter(body.filter);
  const order = (body.sorts ?? []).map((sort: any) => {
    let expression: string;
    if (sort.timestamp === "created_time" || sort.timestamp === "last_edited_time") expression = `page->>${parameter(sort.timestamp)}`;
    else {
      const p = property(sort.property);
      // All app property sorts are titles or dates; refuse other schema types in context.
      expression = `COALESCE(${p}->'date'->>'start',(SELECT string_agg(COALESCE(item->>'plain_text',item->'text'->>'content',''),'') FROM jsonb_array_elements(COALESCE(${p}->'title','[]'::jsonb)) item),'')`;
    }
    if (sort.direction !== "ascending" && sort.direction !== "descending") return unsupported();
    return `${expression} ${sort.direction === "descending" ? "DESC" : "ASC"} NULLS LAST`;
  });
  const cursor = body.start_cursor;
  const offset = cursor ? Number(String(cursor).slice(7)) : 0;
  if (cursor && (!String(cursor).startsWith("mirror:") || !Number.isInteger(offset) || offset < 0)) return unsupported();
  const size = body.page_size ?? 100;
  if (!Number.isInteger(size) || size < 1 || size > 100) return unsupported();
  return { where, order: [...order, "ordinal ASC"].join(", "), params, offset: parameter(offset), size: parameter(size) };
}
