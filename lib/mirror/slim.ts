// Mirror records are read back on every financial request, so every stored byte
// is paid again as database egress on each read. Keep only what the app reads
// from a Notion page: id, parent, archived/in_trash, timestamps, icon and
// property values. Rich text keeps its text and mentions but drops styling.
const DROPPED_PAGE_FIELDS = new Set(["created_by", "last_edited_by", "cover", "url", "public_url", "request_id"]);

function slimValue(value: any): any {
  if (Array.isArray(value)) return value.map(slimValue);
  if (!value || typeof value !== "object") return value;
  const richText = typeof value.plain_text === "string" && typeof value.type === "string";
  const out: Record<string, any> = {};
  for (const [key, child] of Object.entries(value)) {
    if (richText && (key === "annotations" || key === "href")) continue;
    if (richText && key === "text" && child && typeof child === "object") {
      out.text = { content: (child as any).content };
      continue;
    }
    out[key] = slimValue(child);
  }
  return out;
}

export function slimMirrorPage(page: any) {
  if (!page || typeof page !== "object" || Array.isArray(page)) return page;
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(page)) {
    if (DROPPED_PAGE_FIELDS.has(key)) continue;
    out[key] = key === "properties" ? slimValue(value) : value;
  }
  return out;
}
