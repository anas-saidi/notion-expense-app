import { NextRequest, NextResponse } from "next/server";

const TRANSACTIONS_DB = "1926a2be-8922-80be-968a-efa6e6dace95";

export async function GET(req: NextRequest) {
  const token = process.env.NOTION_TOKEN;

  if (!token) return NextResponse.json({ error: "NOTION_TOKEN not set" }, { status: 500 });

  try {
    const res = await fetch(`https://api.notion.com/v1/databases/${TRANSACTIONS_DB}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({
        sorts: [{ property: "Date", direction: "descending" }],
        page_size: 20,
      }),
    });

    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.message }, { status: res.status });

    const transactions = data.results.map((page: any) => ({
      id: page.id,
      name: page.properties.Name?.title?.[0]?.plain_text ?? "",
      amount: page.properties.Amount?.number ?? 0,
      date: page.properties.Date?.date?.start ?? "",
      category: page.properties.Category?.relation?.[0]?.id ?? null,
    }));

    return NextResponse.json({ transactions });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
