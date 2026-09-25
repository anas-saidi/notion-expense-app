import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { PATCH, POST } from "./route";
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it("writes account owners and returns the saved category rather than an invented joint status", async () => {
  vi.stubEnv("NOTION_TOKEN", "test");
  vi.stubEnv("NOTION_ACCOUNTS_DB", "accounts");
  const saved = { id: "new", properties: { Category: { title: [{ plain_text: "Car" }] }, Owner: { people: [{ name: "Anas" }, { name: "Salma" }] }, "Team Fund": { formula: { boolean: true } }, Default: { relation: [{ id: "joint" }] } } };
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(Response.json({ properties: { Category: { type: "title" }, Owner: { type: "people" }, Default: { type: "relation" } } }))
    .mockResolvedValueOnce(Response.json({ parent: { database_id: "accounts" }, properties: { Owner: { type: "people", people: [{ id: "anas" }, { id: "salma" }] } } }))
    .mockResolvedValueOnce(Response.json(saved));
  vi.stubGlobal("fetch", fetchMock);
  const response = await POST(new NextRequest("http://localhost/api/categories", { method: "POST", body: JSON.stringify({ name: "Car", scope: "joint", accountId: "joint" }) }));
  expect(response.status).toBe(200);
  expect(JSON.parse(fetchMock.mock.calls[2][1].body).properties.Owner).toEqual({ people: [{ id: "anas" }, { id: "salma" }] });
  expect((await response.json()).category).toMatchObject({ owner: "Anas", isTeamFund: true, defaultAccount: "joint" });
});

const categoryDb = process.env.NOTION_CATEGORIES_DB ?? "1926a2be-8922-8029-9b90-c7d8bb55fabd";
const editBody = { id: "car", name: "Car Expenses", icon: "🚗", type: "Expenses", accountId: "joint", scope: "joint" };
const requestEdit = (body = editBody) => PATCH(new NextRequest("http://localhost/api/categories", { method: "PATCH", body: JSON.stringify(body) }));
function mockEdit(ids: string[], database = "accounts", label = "Joined Account") {
  vi.stubEnv("NOTION_TOKEN", "test");
  vi.stubEnv("NOTION_ACCOUNTS_DB", "accounts");
  const mock = vi.fn()
    .mockResolvedValueOnce(Response.json({ parent: { database_id: categoryDb }, properties: { Owner: { people: [] } } }))
    .mockResolvedValueOnce(Response.json({ parent: { database_id: database }, properties: { Name: { type: "title", title: [{ plain_text: label }] }, Owner: { type: "people", people: ids.map(id => ({ id })) } } }))
    .mockResolvedValueOnce(Response.json({ id: "car", properties: { Available: { formula: { number: 1234 } } } }));
  vi.stubGlobal("fetch", mock);
  return mock;
}
it.each([["joint", ["anas", "salma"], "Joined Account"], ["anas", ["anas"], "Hubby Account"], ["salma", ["salma"], "Wife Account"]] as const)("repairs owners for %s with one metadata-only write", async (scope, ids, label) => {
  const mock = mockEdit([...ids], "accounts", label);
  expect((await requestEdit({ ...editBody, scope })).status).toBe(200);
  expect(mock).toHaveBeenCalledTimes(3);
  expect(mock.mock.calls[2][0]).toBe("https://api.notion.com/v1/pages/car");
  expect(JSON.parse(mock.mock.calls[2][1].body)).toEqual({ icon: { type: "emoji", emoji: "🚗" }, properties: {
    Category: { title: [{ text: { content: "Car Expenses" } }] }, Type: { multi_select: [{ name: "Expenses" }] }, Default: { relation: [{ id: "joint" }] }, Owner: { people: ids.map(id => ({ id })) },
  } });
});
it("rejects incomplete owners without writing", async () => {
  const mock = mockEdit(["anas"]);
  expect((await requestEdit()).status).toBe(400);
  expect(mock).toHaveBeenCalledTimes(2);
});
it("rejects an account from another database without writing", async () => {
  const mock = mockEdit(["anas", "salma"], "other");
  expect((await requestEdit()).status).toBe(400);
  expect(mock).toHaveBeenCalledTimes(2);
});
it("rejects incomplete metadata", async () => {
  const mock = mockEdit([]);
  expect((await requestEdit({ ...editBody, name: " " })).status).toBe(400);
  expect(mock).not.toHaveBeenCalled();
});
it("retains the existing freeze-only route", async () => {
  vi.stubEnv("NOTION_TOKEN", "test");
  const mock = vi.fn().mockResolvedValue(Response.json({ id: "car", properties: {} }));
  vi.stubGlobal("fetch", mock);
  expect((await PATCH(new NextRequest("http://localhost/api/categories", { method: "PATCH", body: JSON.stringify({ id: "car", snoozed: true }) }))).status).toBe(200);
  expect(JSON.parse(mock.mock.calls[0][1].body)).toEqual({ properties: { Snooze: { checkbox: true } } });
});
it("derives owners from the account, not the client-sent scope", async () => {
  const mock = mockEdit(["anas"], "accounts", "Hubby Account");
  expect((await requestEdit({ ...editBody, scope: "joint" })).status).toBe(200);
  expect(JSON.parse(mock.mock.calls[2][1].body).properties.Owner).toEqual({ people: [{ id: "anas" }] });
});
it("accepts a savings account's owners as-is", async () => {
  mockEdit(["anas", "salma"], "accounts", "Joint Savings");
  expect((await requestEdit({ ...editBody, scope: "anas" })).status).toBe(200);
});
it("rejects a non-emoji icon without calling Notion", async () => {
  const mock = mockEdit(["anas", "salma"]);
  expect((await requestEdit({ ...editBody, icon: "car" })).status).toBe(400);
  expect(mock).not.toHaveBeenCalled();
});
