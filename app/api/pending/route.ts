import { NextRequest, NextResponse } from "next/server";

const PENDING_DB = process.env.NOTION_PENDING_DB ?? "d2db101b-faec-467d-8c57-eee6d8780311";
const HDR = (token: string) => ({ Authorization: `Bearer ${token}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" });

export async function GET() {
  const token = process.env.NOTION_TOKEN;
  if (!token) return NextResponse.json({ error: "NOTION_TOKEN not set" }, { status: 500 });
  try {
    const res = await fetch(`https://api.notion.com/v1/databases/${PENDING_DB}/query`, {
      method: "POST", headers: HDR(token), cache: "no-store",
      body: JSON.stringify({ sorts: [{ timestamp: "created_time", direction: "ascending" }], page_size: 50 }),
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.message }, { status: res.status });
    const items = data.results.map((page: any) => ({
      id: page.id,
      name: page.properties.Name?.title?.[0]?.plain_text ?? "",
      amount: page.properties.Amount?.number ?? null,
      categoryId: page.properties.Category?.relation?.[0]?.id ?? null,
      addedBy: page.properties.AddedBy?.select?.name ?? null,
      date: page.properties.Date?.date?.start ?? null,
    }));
    return NextResponse.json({ items });
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  const token = process.env.NOTION_TOKEN;
  if (!token) return NextResponse.json({ error: "NOTION_TOKEN not set" }, { status: 500 });
  const { name, amount, categoryId, addedBy, date } = await req.json();
  if (!name) return NextResponse.json({ error: "Missing name" }, { status: 400 });
  const properties: any = { Name: { title: [{ text: { content: name } }] } };
  if (amount != null && amount !== "") properties.Amount = { number: parseFloat(String(amount)) };
  if (categoryId) properties.Category = { relation: [{ id: categoryId }] };
  if (addedBy) properties.AddedBy = { select: { name: addedBy } };
  if (date) properties.Date = { date: { start: date } };
  try {
    const res = await fetch("https://api.notion.com/v1/pages", {
      method: "POST", headers: HDR(token),
      body: JSON.stringify({ parent: { database_id: PENDING_DB }, properties }),
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.message }, { status: res.status });
    return NextResponse.json({ id: data.id, name, amount: amount ? parseFloat(String(amount)) : null, categoryId: categoryId ?? null, addedBy: addedBy ?? null, date: date ?? null });
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }
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
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}
