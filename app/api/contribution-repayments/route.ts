import { NextRequest, NextResponse } from "next/server";
import { contributionPool } from "../../../lib/contribution-store";
import { mirrorScope } from "../../../lib/mirror/store";
import { withMirrorMutation } from "../../../lib/mirror/routes";
import { readContributionContext } from "../../../lib/contribution-service";
import { REPAYMENT_PROPERTY, cents } from "../../../lib/contribution-agreements";
import { notionFetchJson, queryDatabaseAll } from "../../../lib/notion-api";
import { richText, normalizeId } from "../../../lib/savings-funding";
import { scopeFromAccountLabel } from "../../components/app-utils";
import { billToday, isCalendarDate } from "../../../lib/bills";

export const maxDuration = 240;
async function handlePOST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || !/^[a-f0-9-]{36}$/i.test(body.requestId ?? "") || !["anas", "salma"].includes(body.partner) || typeof body.amount !== "number" || !Number.isFinite(body.amount) || body.amount <= 0 || body.amount > 1e9 || Math.abs(body.amount * 100 - cents(body.amount)) > 0.0001 || !isCalendarDate(body.date) || body.date > billToday()) return NextResponse.json({ error: "Choose a person, a positive amount to the cent, and a date no later than today." }, { status: 400 });
  const token = process.env.NOTION_TOKEN;
  if (!token) return NextResponse.json({ error: "Finance connection unavailable." }, { status: 503 });
  let client;
  try {
    client = await contributionPool().connect();
    // One household repayment at a time, including across server instances.
    // Its request identifier lives on the Notion transfer for safe retry.
    await client.query("SELECT pg_advisory_lock(hashtextextended($1,0))", [mirrorScope(token) + ":repayment"]);
    const db = process.env.NOTION_TRANSACTIONS_DB ?? "1926a2be-8922-80be-968a-efa6e6dace95";
    const { data: schema } = await notionFetchJson<any>(token, `/databases/${db}`);
    if (!schema.properties?.[REPAYMENT_PROPERTY]) await notionFetchJson(token, `/databases/${db}`, { method: "PATCH", body: { properties: { [REPAYMENT_PROPERTY]: { rich_text: {} } } } });
    else if (schema.properties[REPAYMENT_PROPERTY].type !== "rich_text") throw new Error("Contribution repayment must be a text property in Transactions.");
    const existing = await queryDatabaseAll<any>(token, db, { filter: { property: REPAYMENT_PROPERTY, rich_text: { equals: body.requestId } } });
    if (existing.length) {
      const p = existing[0].properties;
      const { accounts } = await readContributionContext(token, body.date.slice(0, 7), body.date);
      const destination = accounts.find(a => normalizeId(a.id) === normalizeId(p["🏦 account ( in )"]?.relation?.[0]?.id));
      if (!destination || scopeFromAccountLabel(destination.label) !== body.partner || cents(p.Amount?.number ?? 0) !== cents(body.amount) || p.Date?.date?.start?.slice(0, 10) !== body.date) return NextResponse.json({ error: "This repayment request was already used with different details. Refresh and review activity." }, { status: 409 });
      return NextResponse.json({ success: true, id: existing[0].id });
    }
    const context = await readContributionContext(token, body.date.slice(0, 7), body.date);
    const source = context.accounts.find(a => !/saving/i.test(a.label) && scopeFromAccountLabel(a.label) === "joint");
    const destination = context.accounts.find(a => !/saving/i.test(a.label) && scopeFromAccountLabel(a.label) === body.partner);
    const outstanding = context.ledger.outstanding[body.partner as "anas" | "salma"];
    if (!source || !destination || source.balance == null) return NextResponse.json({ error: "Refresh the accounts before recording a repayment." }, { status: 409 });
    if (cents(body.amount) > cents(outstanding)) return NextResponse.json({ error: "That is more than Joined owes this person. Refresh the contributions." }, { status: 409 });
    if (cents(body.amount) > cents(source.balance)) return NextResponse.json({ error: "Joined does not have enough recorded cash for this repayment." }, { status: 409 });
    const { data } = await notionFetchJson<any>(token, "/pages", { method: "POST", retries: 0, body: { parent: { database_id: db }, properties: {
      Name: { title: [{ text: { content: `Advance repayment to ${body.partner === "anas" ? "Anas" : "Salma"}` } }] },
      Amount: { number: body.amount }, Date: { date: { start: body.date } }, Type: { select: { name: "Transfer" } },
      "🏦 account ( out )": { relation: [{ id: source.id }] }, "🏦 account ( in )": { relation: [{ id: destination.id }] },
      [REPAYMENT_PROPERTY]: richText(body.requestId),
    } } });
    return NextResponse.json({ success: true, id: data.id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not record repayment. Refresh activity before trying again." }, { status: (error as { status?: number }).status ?? 500 });
  } finally {
    if (client) { try { await client.query("SELECT pg_advisory_unlock(hashtextextended($1,0))", [mirrorScope(token) + ":repayment"]); } finally { client.release(); } }
  }
}
export const POST = withMirrorMutation(handlePOST);
