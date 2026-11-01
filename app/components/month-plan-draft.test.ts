import { expect, it, vi } from "vitest";
import { parsePlanDraft, restorePlanDraft, clearUnchangedPlanDraft, planDraftKey, type LocalPlanDraft } from "./month-plan-draft";
const draft: LocalPlanDraft = { version: 1, month: "2026-11", scope: "joint", savedAt: "2026-11-01T10:00:00Z", entries: { rent: { amount: 0, base: 3500 }, groceries: { amount: 1250.75, base: 1000, expression: "1250.75+" }, frozen: { amount: 500, base: 0 } } };
it("isolates drafts by person and month and round-trips zeroes, cents and unfinished expressions", () => {
  expect(planDraftKey("anas", draft.month)).not.toBe(planDraftKey("salma", draft.month));
  expect(planDraftKey("anas", draft.month)).not.toBe(planDraftKey("anas", "2026-12"));
  expect(parsePlanDraft(JSON.stringify(draft), draft.month)).toEqual(draft);
});
it("restores only eligible categories and flags a saved plan changed since the draft", () => {
  expect(restorePlanDraft(draft, new Map([["rent", 3500], ["groceries", 1100]]), new Set(["rent", "groceries"]))).toEqual({ amounts: { rent: 0, groceries: 1250.75 }, expressions: { groceries: "1250.75+" }, changedSinceDraft: true, unavailable: 1 });
});
it("rejects corrupt, other-month or invalid financial drafts", () => {
  expect(parsePlanDraft("bad", draft.month)).toBeNull();
  expect(parsePlanDraft(JSON.stringify(draft), "2026-12")).toBeNull();
  expect(parsePlanDraft(JSON.stringify({ ...draft, entries: { rent: { amount: -1, base: 0 } } }), draft.month)).toBeNull();
});
it("clears the saved revision while preserving a newer draft from another tab", () => {
  const removeItem = vi.fn();
  clearUnchangedPlanDraft({ getItem: () => "new", removeItem }, "draft", "old");
  expect(removeItem).not.toHaveBeenCalled();
  clearUnchangedPlanDraft({ getItem: () => "old", removeItem }, "draft", "old");
  expect(removeItem).toHaveBeenCalledWith("draft");
});
