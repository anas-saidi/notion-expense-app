import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_ZAKAT_SETUP, loadZakat, saveZakatSetup, type ZakatSetupPayload } from "../../../lib/zakat-data";

export const dynamic = "force-dynamic";
export const maxDuration = 240;

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Casablanca" });
const fail = (error: unknown) => NextResponse.json({
  error: error instanceof Error ? error.message : "Zakat is unavailable.",
  priceUnavailable: (error as { code?: string }).code === "PRICE_UNAVAILABLE",
}, { status: (error as { status?: number }).status ?? 500 });
const token = () => {
  const value = process.env.NOTION_TOKEN;
  if (!value) throw Object.assign(new Error("Finance connection unavailable."), { status: 503 });
  return value;
};

/** GET /api/zakat[?silverMadPerGram=n] → setup, year-by-year schedule and the current hawl. Read-only. */
export async function GET(req: NextRequest) {
  try {
    const manual = Number(req.nextUrl.searchParams.get("silverMadPerGram"));
    return NextResponse.json(await loadZakat(token(), today(), Number.isFinite(manual) && manual > 0 ? manual : undefined));
  } catch (error) {
    return fail(error);
  }
}

/** POST /api/zakat { expectedVersion } → saves the default setup as the owner's Finance Records row. */
export async function POST(req: NextRequest) {
  try {
    const { expectedVersion = null } = await req.json().catch(() => ({}));
    const payload: ZakatSetupPayload = DEFAULT_ZAKAT_SETUP;
    const saved = await saveZakatSetup(token(), payload, expectedVersion);
    if (!saved) return NextResponse.json({ error: "The zakat setup changed on another device. Refresh and try again." }, { status: 409 });
    return NextResponse.json({ version: saved.version });
  } catch (error) {
    return fail(error);
  }
}
