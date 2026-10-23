import { stableInput } from "../../../../lib/native/stable-input";
import { additionalHandlers } from "../../../../lib/native/additional-operations";
import { NextRequest, NextResponse } from "next/server";
import { authenticateNative } from "../../../../lib/native/auth";
import { write as validatedWrite } from "../../../../lib/mcp/finance";
import { mcpOperations } from "../../../../lib/mcp/operations";
import { POST as expense } from "../../expense/route";
import { POST as income } from "../../monthly-income/route";
import { POST as transfer } from "../../account-transfer/route";
import { PATCH as editTransaction, DELETE as deleteTransaction } from "../../transactions/route";
import { POST as bill } from "../../bills/route";

export const dynamic = "force-dynamic";
export const maxDuration = 240;
const handlers = { ...additionalHandlers, expense, income, transfer, editTransaction, deleteTransaction, bill, rebalance: null };
export async function POST(request: NextRequest) {
  const auth = authenticateNative(request);
  if (auth) return auth;
  const body = await request.json().catch(() => null);
  if (!body || !/^[A-Fa-f0-9-]{36}$/.test(body.requestId ?? "") || !Object.hasOwn(handlers, body.operation) || !body.input || typeof body.input !== "object" || Array.isArray(body.input)) {
    return NextResponse.json({ error: "Invalid native operation" }, { status: 400 });
  }
  body.input = stableInput(body.input);
  try {
    // Savings workflows already own durable, resumable linked-record identities.
    // Wrapping an interrupted deposit in a permanently pending generic claim would
    // prevent its own recovery protocol from finishing the transfer/assignment pair.
    if (body.operation === "savingsDeposit" || body.operation === "undoSavingsDeposit") {
      if (body.operation === "savingsDeposit" && body.input.operationId !== body.requestId) {
        return NextResponse.json({ error: "A savings deposit must keep its original operation ID" }, { status: 400 });
      }
      const handler = body.operation === "savingsDeposit" ? handlers.savingsDeposit : handlers.undoSavingsDeposit;
      const response = await handler(new NextRequest(request.url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body.input) }));
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    }
    // Use the durable operation ledger already used by MCP. A lost response cannot duplicate a write.
    const result = await mcpOperations().once("native-v1", body.requestId, body.operation, body.input, async () => {
      if (body.operation === "rebalance") {
        if (!Number.isFinite(body.input.amount) || body.input.amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(body.input.date ?? "") || typeof body.input.fromCategoryId !== "string" || typeof body.input.toCategoryId !== "string") throw new Error("Choose two categories, a valid date, and a positive amount");
        return validatedWrite("rebalance_budget", { ...body.input, requestId: body.requestId });
      }
      const handler = handlers[body.operation as Exclude<keyof typeof handlers, "rebalance">];
      const response = await handler(new NextRequest(request.url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body.input) }));
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not save");
      return data;
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Check activity before trying again." }, { status: 409, headers: { "Cache-Control": "no-store" } });
  }
}
