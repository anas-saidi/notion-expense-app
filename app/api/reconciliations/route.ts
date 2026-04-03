import { NextRequest, NextResponse } from "next/server";
import { notionFetchJson } from "@/lib/notion-api";

export const dynamic = "force-dynamic";

const RECONCILIATIONS_DB = process.env.NOTION_RECONCILIATIONS_DB ?? "";

type NotionProperty = { name: string; type: string };

const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const pickByTypeAndAliases = (props: NotionProperty[], type: string, aliases: string[]) => {
  const sameType = props.filter((prop) => prop.type === type);
  for (const alias of aliases) {
    const found = sameType.find((prop) => norm(prop.name) === norm(alias));
    if (found) return found.name;
  }
  return sameType[0]?.name;
};

export async function POST(req: NextRequest) {
  const token = process.env.NOTION_TOKEN;
  if (!token) return NextResponse.json({ error: "NOTION_TOKEN not set" }, { status: 500 });
  if (!RECONCILIATIONS_DB) {
    return NextResponse.json({ error: "NOTION_RECONCILIATIONS_DB not configured" }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  const accountId = typeof body?.accountId === "string" ? body.accountId : "";
  const actualBalance = typeof body?.actualBalance === "number" ? body.actualBalance : Number(body?.actualBalance);
  const currentBalance = typeof body?.currentBalance === "number" ? body.currentBalance : Number(body?.currentBalance);
  const date = typeof body?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
    ? body.date
    : new Date().toISOString().slice(0, 10);

  if (!accountId) return NextResponse.json({ error: "Missing accountId" }, { status: 400 });
  if (!Number.isFinite(actualBalance)) {
    return NextResponse.json({ error: "actualBalance must be a valid number" }, { status: 400 });
  }
  if (!Number.isFinite(currentBalance)) {
    return NextResponse.json({ error: "currentBalance must be a valid number" }, { status: 400 });
  }

  try {
    const { data: database } = await notionFetchJson<any>(token, `/databases/${RECONCILIATIONS_DB}`);
    const props = Object.entries(database.properties ?? {}).map(([name, prop]: [string, any]) => ({
      name,
      type: prop.type,
    }));

    const accountKey = pickByTypeAndAliases(props, "relation", ["Account", "Accounts"]);
    const realBalanceKey = pickByTypeAndAliases(props, "number", ["Real Balance", "Actual Balance", "Closing Balance"]);
    const currentBalanceKey = pickByTypeAndAliases(props, "number", ["Current Balance", "Notion Balance", "Ledger Balance"]);
    const dateKey = pickByTypeAndAliases(props, "date", ["Date", "Sync Date", "Reconciled At"]);
    const titleKey = pickByTypeAndAliases(props, "title", ["Name", "Title"]);

    if (!accountKey || !realBalanceKey || !currentBalanceKey || !dateKey) {
      return NextResponse.json({ error: "Could not match reconciliation database properties" }, { status: 500 });
    }

    const properties: Record<string, unknown> = {
      [accountKey]: { relation: [{ id: accountId }] },
      [realBalanceKey]: { number: Number(actualBalance.toFixed(2)) },
      [currentBalanceKey]: { number: Number(currentBalance.toFixed(2)) },
      [dateKey]: { date: { start: date } },
    };

    if (titleKey) {
      properties[titleKey] = {
        title: [{ type: "text", text: { content: `Reconciliation ${date}` } }],
      };
    }

    const { data } = await notionFetchJson<any>(token, "/pages", {
      method: "POST",
      body: {
        parent: { database_id: RECONCILIATIONS_DB },
        properties,
      },
    });

    return NextResponse.json({ success: true, id: data.id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create reconciliation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
