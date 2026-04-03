import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body?.month) {
    return NextResponse.json({ error: "Missing month" }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    savedAt: new Date().toISOString(),
    payload: body,
    mode: process.env.NOTION_TOKEN ? "scaffold" : "mock",
  });
}
