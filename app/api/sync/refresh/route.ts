import { NextRequest, NextResponse } from "next/server";
import { requireBearerToken } from "@/lib/shortcut-auth";
import { syncMirror } from "@/lib/mirror/sync";
export const dynamic = "force-dynamic";
export const maxDuration = 240;
export async function GET(req: NextRequest) {
  const auth = requireBearerToken(req, "CRON_SECRET", "Financial sync");
  if (!auth.ok) return auth.response;
  if (!process.env.NOTION_TOKEN) return NextResponse.json({ error: "Notion is not configured" }, { status: 503 });
  try { return NextResponse.json(await syncMirror(process.env.NOTION_TOKEN)); }
  catch { return NextResponse.json({ error: "Financial sync failed" }, { status: 502 }); }
}
