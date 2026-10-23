import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
const mocks = vi.hoisted(() => ({ once: vi.fn(), expense: vi.fn(), income: vi.fn(), transfer: vi.fn(), edit: vi.fn(), remove: vi.fn(), bill: vi.fn(), validated: vi.fn(), savingsDeposit: vi.fn(), undoSavingsDeposit: vi.fn() }));
vi.mock("../../../../lib/mcp/operations", () => ({ mcpOperations: () => ({ once: mocks.once }) }));
vi.mock("../../../../lib/mcp/finance", () => ({ write: mocks.validated }));
vi.mock("../../expense/route", () => ({ POST: mocks.expense }));
vi.mock("../../monthly-income/route", () => ({ POST: mocks.income }));
vi.mock("../../account-transfer/route", () => ({ POST: mocks.transfer }));
vi.mock("../../transactions/route", () => ({ PATCH: mocks.edit, DELETE: mocks.remove }));
vi.mock("../../bills/route", () => ({ POST: mocks.bill }));
vi.mock("../../../../lib/native/additional-operations", () => ({ additionalHandlers: { savingsDeposit: mocks.savingsDeposit, undoSavingsDeposit: mocks.undoSavingsDeposit } }));
import { POST } from "./route";
const key = "native-device-key-that-is-at-least-32-characters";
const requestId = "12345678-1234-1234-1234-123456789012";
const request = (body: unknown, token = key) => new NextRequest("https://finance.example/api/native/operations", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NATIVE_TOKEN_SHA256", createHash("sha256").update(key).digest("hex"));
  mocks.once.mockImplementation((_scope, _id, _operation, _input, run) => run());
});
afterEach(() => vi.unstubAllEnvs());
describe("native operations boundary", () => {
  it("rejects unauthorized requests before calling any financial handler", async () => {
    expect((await POST(request({ requestId, operation: "expense", input: {} }, "wrong"))) .status).toBe(401);
    expect(mocks.once).not.toHaveBeenCalled();
  });
  it("rejects arbitrary handler names and missing request IDs", async () => {
    for (const body of [{ requestId, operation: "constructor", input: {} }, { operation: "expense", input: {} }]) {
      expect((await POST(request(body))).status).toBe(400);
    }
    expect(mocks.once).not.toHaveBeenCalled();
  });
  it("claims a stable ID before delegating an expense", async () => {
    const input = { name: "Coffee", amount: 12, date: "2026-10-22", accountId: "a", categoryId: "c" };
    mocks.expense.mockResolvedValue(NextResponse.json({ success: true, id: "created" }));
    const response = await POST(request({ requestId, operation: "expense", input }));
    expect(response.status).toBe(200);
    expect(mocks.once).toHaveBeenCalledWith("native-v1", requestId, "expense", input, expect.any(Function));
    expect(await mocks.expense.mock.calls[0][0].json()).toEqual(input);
  });
  it("reports ambiguous failures without bypassing the operation ledger", async () => {
    mocks.once.mockRejectedValue(new Error("pending; check activity"));
    const response = await POST(request({ requestId, operation: "expense", input: {} }));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "pending; check activity" });
    expect(mocks.expense).not.toHaveBeenCalled();
  });
  it("uses the existing live balance and bill reservation checks for rebalance", async () => {
    const input = { fromCategoryId: "a", toCategoryId: "b", amount: 20, date: "2026-10-22" };
    mocks.validated.mockResolvedValue({ success: true });
    expect((await POST(request({ requestId, operation: "rebalance", input }))).status).toBe(200);
    expect(mocks.validated).toHaveBeenCalledWith("rebalance_budget", { ...input, requestId });
  });
});

it("lets an interrupted savings deposit resume through its own durable operation identity", async () => {
  mocks.savingsDeposit.mockImplementation(async () => NextResponse.json({ success: true }));
  const body = { requestId, operation: "savingsDeposit", input: { operationId: requestId, amount: 50 } };
  expect((await POST(request(body))).status).toBe(200);
  expect((await POST(request(body))).status).toBe(200);
  expect(mocks.once).not.toHaveBeenCalled();
  expect(mocks.savingsDeposit).toHaveBeenCalledTimes(2);
});
it("rejects a changed savings operation identity before writing", async () => {
  const response = await POST(request({ requestId, operation: "savingsDeposit", input: { operationId: "different" } }));
  expect(response.status).toBe(400); expect(mocks.savingsDeposit).not.toHaveBeenCalled();
});
