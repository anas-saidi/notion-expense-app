import { NextRequest, NextResponse } from "next/server";
import { silverNisabOn } from "../../../../lib/silver-nisab";

export const dynamic = "force-dynamic";

/** GET /api/zakat/nisab?date=YYYY-MM-DD → silver nisab in MAD for that day (defaults to today, Casablanca). */
export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date") ?? new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Casablanca" });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "Use date=YYYY-MM-DD." }, { status: 400 });
  try {
    return NextResponse.json(await silverNisabOn(date));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Silver price unavailable.", manualOverride: true }, { status: (error as { status?: number }).status ?? 502 });
  }
}
