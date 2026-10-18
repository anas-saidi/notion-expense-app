import { beforeEach, expect, it, vi } from "vitest";
import { assertTransferCanBeDeleted } from "./notion-transfer-deletion";
import { notionFetchJson } from "./notion-api";
vi.mock("./notion-api", () => ({ notionFetchJson: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
const transfer = { properties: { Amount: { number: 3000 }, "🏦 account ( in )": { relation: [{ id: "joint" }] } } };
it("allows removing an older account transfer when its receiving account covers it", async () => {
  vi.mocked(notionFetchJson).mockResolvedValue({ status: 200, data: { parent: { database_id: "1926a2be-8922-8014-bb54-d9f5e9d1234b" }, properties: { "Current Balance": { formula: { number: 3047 } } } } });
  await expect(assertTransferCanBeDeleted("token", transfer)).resolves.toBeUndefined();
});
it("blocks deletion that would make the receiving account negative", async () => {
  vi.mocked(notionFetchJson).mockResolvedValue({ status: 200, data: { parent: { database_id: "1926a2be-8922-8014-bb54-d9f5e9d1234b" }, properties: { "Current Balance": { number: 2999 } } } });
  await expect(assertTransferCanBeDeleted("token", transfer)).rejects.toMatchObject({ status: 409 });
});
it("checks remaining category funds for a budget transfer", async () => {
  vi.mocked(notionFetchJson).mockResolvedValue({ status: 200, data: { parent: { database_id: "1926a2be-8922-8029-9b90-c7d8bb55fabd" }, properties: { Available: { formula: { number: 2999 } } } } });
  await expect(assertTransferCanBeDeleted("token", { properties: { Amount: { number: 3000 }, "💰 budget (in)": { relation: [{ id: "cat" }] } } })).rejects.toMatchObject({ status: 409 });
});
it("fails closed without a destination and treats an archived transfer as already removed", async () => {
  await expect(assertTransferCanBeDeleted("token", { properties: { Amount: { number: 3000 } } })).rejects.toMatchObject({ status: 409 });
  await expect(assertTransferCanBeDeleted("token", { ...transfer, archived: true })).resolves.toBeUndefined();
  expect(notionFetchJson).not.toHaveBeenCalled();
});
