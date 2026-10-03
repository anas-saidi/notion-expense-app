import { NextResponse } from "next/server";
import { mirrorConfigured, mirrorScope, mirrorStore } from "@/lib/mirror/store";
import { scheduleMirrorSync } from "@/lib/mirror/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 240;
export async function GET() {
  const token = process.env.NOTION_TOKEN;
  if (!mirrorConfigured() || !token) return NextResponse.json({ configured: false });
  try {
    const status = await mirrorStore()!.status(mirrorScope(token));
    if (!status.synced_at || !status.current || Date.now() - new Date(status.synced_at).getTime() > 60000) scheduleMirrorSync(token);
    return NextResponse.json({ configured: true, syncedAt: status.synced_at, current: status.current, syncing: !!status.syncing }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ configured: true, error: "Sync is unavailable. Using live Notion reads." }, { status: 503 }); }
}
export async function POST() {
  const token = process.env.NOTION_TOKEN;
  if (!mirrorConfigured() || !token) return NextResponse.json({ error: "Financial sync is not configured" }, { status: 503 });
  try {
    const previous = await mirrorStore()!.status(mirrorScope(token));
    scheduleMirrorSync(token, false, true);
    return NextResponse.json({ syncing: true, previousSyncedAt: previous.synced_at }, { status: 202 });
  } catch { return NextResponse.json({ error: "Could not start sync. Try again." }, { status: 503 }); }
}
