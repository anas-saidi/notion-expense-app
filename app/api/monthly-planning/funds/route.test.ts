import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("../../../../lib/mirror/routes", () => ({ withMirrorReads: (h: unknown) => h, withMirrorMutation: (h: unknown) => h }));
vi.mock("../../../../lib/contribution-service", () => ({ assertAdvanceReservation: vi.fn() }));
import { POST } from "./route";

const post = (body: object) => POST(new NextRequest("https://finance.example/api/monthly-planning/funds", { method: "POST", body: JSON.stringify(body) }));
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("funds from the category's Default account when the caller sends none", async () => {
  vi.stubEnv("NOTION_TOKEN", "t");
  const fetch = vi.fn(async (url: string, _init?: RequestInit) => url.endsWith("/v1/pages")
    ? Response.json({ id: "fund" })
    : Response.json({ properties: { Default: { relation: [{ id: "acct" }] } } }));
  vi.stubGlobal("fetch", fetch);
  expect((await post({ month: "2026-11", categoryId: "cat", planned: 50, mode: "add" })).status).toBe(200);
  const created = JSON.parse(fetch.mock.calls.at(-1)![1]!.body as string);
  expect(created.properties["🏦 Accounts"]).toEqual({ relation: [{ id: "acct" }] });
});

it("refuses to create a fund no account backs", async () => {
  vi.stubEnv("NOTION_TOKEN", "t");
  const fetch = vi.fn(async () => Response.json({ properties: { Default: { relation: [] } } }));
  vi.stubGlobal("fetch", fetch);
  expect((await post({ month: "2026-11", categoryId: "cat", planned: 50, mode: "add" })).status).toBe(400);
  expect(fetch).toHaveBeenCalledTimes(1);
});
