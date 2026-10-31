import { NextRequest, NextResponse } from "next/server";
import { contributionStore } from "../../../lib/contribution-store";
import { mirrorScope } from "../../../lib/mirror/store";
import { validMonth, cents } from "../../../lib/contribution-agreements";

export const dynamic = "force-dynamic";
const fail = (error: unknown) => NextResponse.json({ error: error instanceof Error ? error.message : "Could not load contribution agreements." }, { status: (error as { status?: number }).status ?? 500 });
export async function GET() {
  try {
    const token = process.env.NOTION_TOKEN;
    if (!token) return NextResponse.json({ error: "Finance connection unavailable." }, { status: 503 });
    return NextResponse.json({ agreements: await contributionStore().list(mirrorScope(token)) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return fail(error); }
}
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const validAmounts = (value: any) => value && [value.anas, value.salma].every(v => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1e9 && Math.abs(v * 100 - cents(v)) < 0.0001);
    const shares = body?.shares;
    if (!validMonth(body?.month) || !validAmounts(body?.targets) || !shares || ![shares.anas, shares.salma].every(v => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1) || Math.abs(shares.anas + shares.salma - 1) > 0.000001 || (body.expectedVersion != null && (typeof body.expectedVersion !== "string" || !/^[a-f0-9-]{36}$/i.test(body.expectedVersion)))) {
      return NextResponse.json({ error: "Provide a month, contribution amounts to the cent, and shares totaling 100%." }, { status: 400 });
    }
    const token = process.env.NOTION_TOKEN;
    if (!token) return NextResponse.json({ error: "Finance connection unavailable." }, { status: 503 });
    const agreement = await contributionStore().save(mirrorScope(token), body.month, body.targets, shares, body.expectedVersion ?? null);
    if (!agreement) return NextResponse.json({ error: "Contributions changed on another device. Refresh and review the agreement again." }, { status: 409 });
    return NextResponse.json({ agreement });
  } catch (error) { return fail(error); }
}
