import { notionLedgerConfigured } from "../../../lib/notion-ledger";
import { NextRequest, NextResponse } from "next/server";
import { contributionPool } from "../../../lib/contribution-store";
import { mirrorScope } from "../../../lib/mirror/store";
import { withMirrorMutation } from "../../../lib/mirror/routes";
import { readContributionContext } from "../../../lib/contribution-service";
import { OFFSET_PREFIX, REPAYMENT_PROPERTY, cents } from "../../../lib/contribution-agreements";
import { notionFetchJson, queryDatabaseAll } from "../../../lib/notion-api";
import { richText } from "../../../lib/savings-funding";
import { scopeFromAccountLabel } from "../../components/app-utils";
import { billToday, isCalendarDate } from "../../../lib/bills";

/**
 * Applies an advance to this month's contribution without moving money: Joined "repays" the partner and the partner
 * "contributes" the same amount. The contribution half is written first so Joined's recorded cash never dips;
 * both halves carry the request id, so a retry finds and skips whatever already exists.
 */
export const maxDuration = 240;
async function handlePOST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || !/^[a-f0-9-]{36}$/i.test(body.requestId ?? "") || !["anas", "salma"].includes(body.partner) || typeof body.amount !== "number" || !Number.isFinite(body.amount) || body.amount <= 0 || body.amount > 1e9 || Math.abs(body.amount * 100 - cents(body.amount)) > 0.0001 || !isCalendarDate(body.date) || body.date > billToday()) {
    return NextResponse.json({ error: "Choose a person, a positive amount to the cent, and a date no later than today." }, { status: 400 });
  }
  const token = process.env.NOTION_TOKEN;
  if (!token) return NextResponse.json({ error: "Finance connection unavailable." }, { status: 503 });
  const name = body.partner === "anas" ? "Anas" : "Salma";
  let client;
  try {
    if (!notionLedgerConfigured()) client = await contributionPool().connect();
    if (client) await client.query("SELECT pg_advisory_lock(hashtextextended($1,0))", [mirrorScope(token) + ":repayment"]);
    const db = process.env.NOTION_TRANSACTIONS_DB ?? "1926a2be-8922-80be-968a-efa6e6dace95";
    const { data: schema } = await notionFetchJson<any>(token, `/databases/${db}`);
    if (!schema.properties?.[REPAYMENT_PROPERTY]) await notionFetchJson(token, `/databases/${db}`, { method: "PATCH", body: { properties: { [REPAYMENT_PROPERTY]: { rich_text: {} } } } });
    else if (schema.properties[REPAYMENT_PROPERTY].type !== "rich_text") throw new Error("Contribution repayment must be a text property in Transactions.");
    const find = async (marker: string) => (await queryDatabaseAll<any>(token, db, { filter: { property: REPAYMENT_PROPERTY, rich_text: { equals: marker } } }))[0];
    const contributionLeg = await find(OFFSET_PREFIX + body.requestId);
    const repaymentLeg = await find(body.requestId);
    if (contributionLeg && repaymentLeg) return NextResponse.json({ success: true });

    const context = await readContributionContext(token, body.date.slice(0, 7), body.date);
    const joined = context.accounts.find(a => !/saving/i.test(a.label) && scopeFromAccountLabel(a.label) === "joint");
    const personal = context.accounts.find(a => !/saving/i.test(a.label) && scopeFromAccountLabel(a.label) === body.partner);
    if (!joined || !personal) return NextResponse.json({ error: "Refresh the accounts before applying the advance." }, { status: 409 });
    // Before the first write, the advance must still be owed (a half-done retry already passed this check).
    if (!contributionLeg && cents(body.amount) > cents(context.ledger.outstanding[body.partner as "anas" | "salma"])) {
      return NextResponse.json({ error: `That is more than Joined owes ${name}. Refresh the contributions.` }, { status: 409 });
    }
    const transfer = (title: string, from: string, to: string, marker: string) => notionFetchJson<any>(token, "/pages", { method: "POST", retries: 0, body: { parent: { database_id: db }, properties: {
      Name: { title: [{ text: { content: title } }] },
      Amount: { number: body.amount }, Date: { date: { start: body.date } }, Type: { select: { name: "Transfer" } },
      "🏦 account ( out )": { relation: [{ id: from }] }, "🏦 account ( in )": { relation: [{ id: to }] },
      [REPAYMENT_PROPERTY]: richText(marker),
    } } });
    if (!contributionLeg) await transfer(`${name}'s advance applied to contribution`, personal.id, joined.id, OFFSET_PREFIX + body.requestId);
    if (!repaymentLeg) await transfer(`Advance repayment to ${name} (applied)`, joined.id, personal.id, body.requestId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not apply the advance. Retry with the same details to finish it safely." }, { status: (error as { status?: number }).status ?? 500 });
  } finally {
    if (client) { try { await client.query("SELECT pg_advisory_unlock(hashtextextended($1,0))", [mirrorScope(token) + ":repayment"]); } finally { client.release(); } }
  }
}
export const POST = withMirrorMutation(handlePOST);
