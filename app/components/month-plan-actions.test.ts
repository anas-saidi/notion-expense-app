import { afterEach, expect, it, vi } from "vitest";
import { freezeMonthPlanCategory } from "./month-plan-actions";
afterEach(() => vi.unstubAllGlobals());

it("clears only the selected planning month before freezing the category", async () => {
  const fetchMock = vi.fn().mockImplementation(async () => Response.json({ success: true }));
  vi.stubGlobal("fetch", fetchMock);
  const cleared = vi.fn();
  await freezeMonthPlanCategory({ month: "2026-10", categoryId: "car", hasSavedAllocation: true, onAllocationCleared: cleared });
  expect(fetchMock.mock.calls[0][0]).toBe("/api/monthly-planning/save");
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ month: "2026-10", allowClear: true, budgetItems: [{ categoryId: "car", amount: 0 }] });
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ id: "car", snoozed: true });
  expect(cleared).toHaveBeenCalledOnce();
});
it("does not freeze when clearing the allocation fails", async () => {
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ error: "Clear failed" }, { status: 500 }));
  vi.stubGlobal("fetch", fetchMock);
  const cleared = vi.fn();
  await expect(freezeMonthPlanCategory({ month: "2026-10", categoryId: "car", hasSavedAllocation: true, onAllocationCleared: cleared })).rejects.toThrow("Clear failed");
  expect(fetchMock).toHaveBeenCalledOnce();
  expect(cleared).not.toHaveBeenCalled();
});
it("reflects a successful clear even if the subsequent freeze fails", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ success: true })).mockResolvedValueOnce(Response.json({ error: "Freeze failed" }, { status: 500 })));
  const cleared = vi.fn();
  await expect(freezeMonthPlanCategory({ month: "2026-10", categoryId: "car", hasSavedAllocation: true, onAllocationCleared: cleared })).rejects.toThrow("Freeze failed");
  expect(cleared).toHaveBeenCalledOnce();
});
it("freezes an unallocated category without writing fund records", async () => {
  const fetchMock = vi.fn().mockImplementation(async () => Response.json({ success: true }));
  vi.stubGlobal("fetch", fetchMock);
  await freezeMonthPlanCategory({ month: "2026-10", categoryId: "car", hasSavedAllocation: false, onAllocationCleared: vi.fn() });
  expect(fetchMock).toHaveBeenCalledOnce();
  expect(fetchMock.mock.calls[0][0]).toBe("/api/categories");
});
