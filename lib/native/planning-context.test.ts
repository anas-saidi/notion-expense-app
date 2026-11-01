import { expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("../../app/api/accounts/route", () => ({ GET: async () => Response.json({ accounts: [] }) }));
vi.mock("../../app/api/categories/route", () => ({ GET: async () => Response.json({ categories: [] }) }));
vi.mock("../../app/api/monthly-summary/route", () => ({ GET: async () => Response.json({ summary: { contributionError: "unavailable", assignedByCategory: [] }, transactions: [] }) }));
import { planningContext } from "./planning-context";
it("does not expose zero dues or repayment reserves as valid planning capacity after a partial read", async () => {
  await expect(planningContext(new NextRequest("http://localhost/api/native/resources?month=2026-11"))).rejects.toThrow("Planning capacity is unavailable");
});
