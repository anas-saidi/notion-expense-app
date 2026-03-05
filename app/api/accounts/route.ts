import { NextRequest, NextResponse } from "next/server";

const ACCOUNTS_DB = process.env.NOTION_ACCOUNTS_DB ?? "1926a2be-8922-8014-bb54-d9f5e9d1234b";

export async function GET(req: NextRequest) {
  const token = process.env.NOTION_TOKEN;

  if (!token) return NextResponse.json({ error: "NOTION_TOKEN not set" }, { status: 500 });

  try {
    const res = await fetch(`https://api.notion.com/v1/databases/${ACCOUNTS_DB}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filter: {
          property: "Disabled",
          checkbox: { equals: false },
        },
        sorts: [{ property: "Name", direction: "ascending" }],
        page_size: 50,
      }),
    });

    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.message }, { status: res.status });

    const accounts = data.results.map((page: any) => ({
      id: page.id,
      label: page.properties.Name?.title?.[0]?.plain_text ?? "Unnamed",
      icon: page.icon?.emoji ?? "🏦",
      type: page.properties["Account Type"]?.select?.name ?? null,
      balance: page.properties["Current Balance"]?.formula?.number
        ?? page.properties["Current Balance"]?.number
        ?? page.properties["Current Balance"]?.rollup?.number
        ?? null,
    }));

    return NextResponse.json({ accounts });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
