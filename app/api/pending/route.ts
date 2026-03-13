import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";

const PENDING_DB = process.env.NOTION_PENDING_DB ?? "d2db101b-faec-467d-8c57-eee6d8780311";
const HDR = (token: string) => ({ Authorization: `Bearer ${token}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" });

type NotionProp = { id: string; name: string; type: string };
type PendingPropKeys = {
  title: string;
  amount?: string;
  category?: string;
  addedBy?: string;
  date?: string;
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const pickByTypeAndAliases = (
  props: NotionProp[],
  type: string,
  aliases: string[]
) => {
  const sameType = props.filter((p) => p.type === type);
  for (const alias of aliases) {
    const found = sameType.find((p) => norm(p.name) === norm(alias));
    if (found) return found.name;
  }
  return sameType[0]?.name;
};

async function getPendingPropKeys(token: string): Promise<PendingPropKeys> {
  const metaRes = await fetch(`https://api.notion.com/v1/databases/${PENDING_DB}`, {
    method: "GET",
    headers: HDR(token),
    cache: "no-store",
  });
  const meta = await metaRes.json();
  if (!metaRes.ok) throw new Error(meta?.message || "Failed to read pending database schema");

  const rawProps = Object.entries(meta.properties ?? {}).map(([name, p]: [string, any]) => ({
    id: p.id,
    name,
    type: p.type,
  }));

  const title = pickByTypeAndAliases(rawProps, "title", ["Name", "Title", "Item", "Pending"]);
  if (!title) throw new Error("Pending database needs a title property");

  return {
    title,
    amount: pickByTypeAndAliases(rawProps, "number", ["Amount", "Price", "Cost"]),
    category: pickByTypeAndAliases(rawProps, "relation", ["Category", "Categories"]),
    addedBy: pickByTypeAndAliases(rawProps, "select", ["AddedBy", "Added By", "By", "Owner"]),
    date: pickByTypeAndAliases(rawProps, "date", ["Date", "Due", "Planned", "When"]),
  };
}

export async function GET() {
  const token = process.env.NOTION_TOKEN;
  if (!token) return NextResponse.json({ error: "NOTION_TOKEN not set" }, { status: 500 });
  try {
    const keys = await getPendingPropKeys(token);
    const res = await fetch(`https://api.notion.com/v1/databases/${PENDING_DB}/query`, {
      method: "POST", headers: HDR(token), cache: "no-store",
      body: JSON.stringify({ sorts: [{ timestamp: "created_time", direction: "ascending" }], page_size: 50 }),
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.message }, { status: res.status });
    const items = data.results.map((page: any) => ({
      id: page.id,
      name: page.properties[keys.title]?.title?.[0]?.plain_text ?? "",
      amount: keys.amount ? page.properties[keys.amount]?.number ?? null : null,
      categoryId: keys.category ? page.properties[keys.category]?.relation?.[0]?.id ?? null : null,
      addedBy: keys.addedBy ? page.properties[keys.addedBy]?.select?.name ?? null : null,
      date: keys.date ? page.properties[keys.date]?.date?.start ?? null : null,
    }));
    return NextResponse.json({ items });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load pending";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const token = process.env.NOTION_TOKEN;
  if (!token) return NextResponse.json({ error: "NOTION_TOKEN not set" }, { status: 500 });
  const { name, amount, categoryId, addedBy, date } = await req.json();
  if (!name) return NextResponse.json({ error: "Missing name" }, { status: 400 });
  try {
    const keys = await getPendingPropKeys(token);
    const properties: Record<string, unknown> = {
      [keys.title]: { title: [{ text: { content: name } }] },
    };
    if (keys.amount && amount != null && amount !== "") properties[keys.amount] = { number: parseFloat(String(amount)) };
    if (keys.category && categoryId) properties[keys.category] = { relation: [{ id: categoryId }] };
    if (keys.addedBy && addedBy) properties[keys.addedBy] = { select: { name: addedBy } };
    if (keys.date && date) properties[keys.date] = { date: { start: date } };

    const res = await fetch("https://api.notion.com/v1/pages", {
      method: "POST", headers: HDR(token),
      body: JSON.stringify({ parent: { database_id: PENDING_DB }, properties }),
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.message }, { status: res.status });
    return NextResponse.json({ id: data.id, name, amount: amount ? parseFloat(String(amount)) : null, categoryId: categoryId ?? null, addedBy: addedBy ?? null, date: date ?? null });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to save pending item";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const token = process.env.NOTION_TOKEN;
  if (!token) return NextResponse.json({ error: "NOTION_TOKEN not set" }, { status: 500 });
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  try {
    const res = await fetch(`https://api.notion.com/v1/pages/${id}`, {
      method: "PATCH", headers: HDR(token),
      body: JSON.stringify({ archived: true }),
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.message }, { status: res.status });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to delete pending item";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
