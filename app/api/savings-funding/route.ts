import { NextRequest, NextResponse } from "next/server";
import { withMirrorMutation } from "../../../lib/mirror/routes";
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
