import { GET as readCategories } from "../../categories/route";
import { GET as readAccounts } from "../../accounts/route";
import { resolveTransactionScopes } from "../../../components/app-utils";
import type { Transaction } from "../../../components/app-types";
import { planningContext } from "../../../../lib/native/planning-context";
import { NextRequest, NextResponse } from "next/server";
import { authenticateNative } from "../../../../lib/native/auth";
import { GET as pending } from "../../pending/route";
import { GET as funds } from "../../monthly-planning/funds/route";
import { GET as activity } from "../../categories/[id]/activity/route";
import { GET as transactions } from "../../transactions/route";
import { GET as syncStatus, POST as syncNow } from "../../sync/route";
import { GET as bills } from "../../bills/route";
export const dynamic = "force-dynamic";
export const maxDuration = 240;
export async function GET(request: NextRequest) {
  const auth = authenticateNative(request); if (auth) return auth;
  const kind = request.nextUrl.searchParams.get("kind");
  let response: Response;
  if (kind === "planning") {
    try { return NextResponse.json(await planningContext(request), { headers: { "Cache-Control": "private, no-store" } }); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Planning is unavailable" }, { status: 503 }); }
  }
  else if (kind === "pending") response = await pending();
  else if (kind === "funds") response = await funds(request);
  else if (kind === "bills") response = await bills();
  else if (kind === "transactions") {
    const responses = await Promise.all([transactions(request), readCategories(new NextRequest(new URL("/api/categories?includeSnoozed=true", request.url))), readAccounts(request)]);
    for (const result of responses) if (!result.ok) return new NextResponse(result.body, { status: result.status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
    const [ledger, catalog, wallets] = await Promise.all(responses.map(result => result.json()));
    response = NextResponse.json({ transactions: ledger.transactions.map((transaction: Transaction) => ({ ...transaction, scopes: resolveTransactionScopes(transaction, catalog.categories, wallets.accounts) })) });
  }
  else if (kind === "sync") response = await syncStatus();
  else if (kind === "activity") {
    const id = request.nextUrl.searchParams.get("id") ?? "";
    if (!/^[a-f0-9-]{32,36}$/i.test(id)) return NextResponse.json({ error: "Choose a valid category" }, { status: 400 });
    response = await activity(request, { params: Promise.resolve({ id }) });
  } else return NextResponse.json({ error: "Unknown native resource" }, { status: 400 });
  return new NextResponse(response.body, { status: response.status, headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" } });
}
export async function POST(request: NextRequest) {
  const auth = authenticateNative(request); if (auth) return auth;
  // The only resource action is an explicit background Notion import.
  if (request.nextUrl.searchParams.get("kind") !== "sync") return NextResponse.json({ error: "Unknown resource action" }, { status: 400 });
  return syncNow();
}
