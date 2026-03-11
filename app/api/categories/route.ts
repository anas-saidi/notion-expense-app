import { NextRequest, NextResponse } from "next/server";

const CATEGORIES_DB = "1926a2be-8922-8029-9b90-c7d8bb55fabd";

export async function GET(req: NextRequest) {
  const token = process.env.NOTION_TOKEN;

  if (!token) return NextResponse.json({ error: "NOTION_TOKEN not set" }, { status: 500 });

  try {
    const res = await fetch(`https://api.notion.com/v1/databases/${CATEGORIES_DB}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({
        filter: {
          and: [
            { property: "Snooze", checkbox: { equals: false } },
            { property: "Archived", checkbox: { equals: false } },
          ],
        },
        sorts: [{ property: "Category", direction: "ascending" }],
        page_size: 100,
      }),
    });

    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.message }, { status: res.status });

    const categories = data.results.map((page: any) => ({
      id: page.id,
      name: page.properties.Category?.title?.[0]?.plain_text ?? "Unnamed",
      icon: page.icon?.emoji ?? null,
      type: page.properties.Type?.multi_select?.map((t: any) => t.name) ?? [],
      defaultAccount: page.properties.Default?.relation?.[0]?.id ?? null,
      available: page.properties["Available"]?.formula?.number ?? null,
      planned: page.properties.Planned?.number ?? null,
    }));

    return NextResponse.json({ categories });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
