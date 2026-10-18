import { NextRequest, NextResponse } from "next/server";
import { withMirrorMutation } from "../../../lib/mirror/routes";
import { undoSavingsDeposit } from "../../../lib/notion-savings-undo";
import { fundSavings } from "../../../lib/notion-savings-funding";

async function handlePOST(req: NextRequest) {
  const token = process.env.NOTION_TOKEN;
  if (!token) return NextResponse.json({ error: "NOTION_TOKEN not set" }, { status: 500 });
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  try { return NextResponse.json({ success: true, fund: await fundSavings(token, body) }); }
  catch (error: any) {
    return NextResponse.json({ error: error.message, pending: Boolean(error.pending) }, { status: error.status ?? 503 });
  }
}
export const POST = withMirrorMutation(handlePOST);
export const maxDuration = 240;

async function handleDELETE(req: NextRequest) {
  const token = process.env.NOTION_TOKEN;
  if (!token) return NextResponse.json({ error: "NOTION_TOKEN not set" }, { status: 500 });
  const body = await req.json().catch(() => null);
  try { return NextResponse.json(await undoSavingsDeposit(token, body?.operationId)); }
  catch (error: any) { return NextResponse.json({ error: error.message || "Could not undo this deposit. Retry to finish." }, { status: error.status ?? 503 }); }
}
export const DELETE = withMirrorMutation(handleDELETE);
