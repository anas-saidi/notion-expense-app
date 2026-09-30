import { expect, it } from "vitest";
import { calculateMonthPlanCapacity as calculate } from "./month-plan-capacity";
const split = { anas: 0.65, salma: 0.35 };

it("reserves personal allocations before calculating affordable Joint spending", () => {
  const result = calculate({ joint: 0, anas: 30206.82, salma: 20000 }, { joint: 0, anas: 18690, salma: 0 }, split);
  expect(result.left.anas).toBe(11516.82);
  expect(result.pool.joint).toBe(17718.18);
});
it("checks each partner's share rather than just combined money", () => {
  const result = calculate({ joint: 0, anas: 10000, salma: 100 }, { joint: 1000, anas: 0, salma: 0 }, split);
  expect(result.due).toEqual({ anas: 650, salma: 350 });
  expect(result.left.salma).toBe(-250);
  expect(result.left.joint).toBeLessThan(0);
});
it("reserves the saved Joint plan when editing a personal plan", () => {
  const result = calculate({ joint: 0, anas: 1000, salma: 1000 }, { joint: 1000, anas: 500, salma: 0 }, split);
  expect(result.pool.anas).toBe(350);
  expect(result.left.anas).toBe(-150);
});
it("uses existing Joint cash first without charging personal money twice", () => {
  const result = calculate({ joint: 600, anas: 1000, salma: 1000 }, { joint: 1000, anas: 0, salma: 0 }, split);
  expect(result.due).toEqual({ anas: 260, salma: 140 });
  expect(result.left.anas).toBe(740);
});
it("does not request contributions when Joint already covers its plan", () => {
  const result = calculate({ joint: 1000, anas: 0, salma: 0 }, { joint: 500, anas: 0, salma: 0 }, split);
  expect(result.due).toEqual({ anas: 0, salma: 0 });
  expect(result.left.joint).toBe(500);
});
it("supports a zero-share partner and exact cent remainders", () => {
  const result = calculate({ joint: 0, anas: 10, salma: 0 }, { joint: 0.01, anas: 0, salma: 0 }, { anas: 1, salma: 0 });
  expect(result.pool.joint).toBe(10);
  expect(result.due).toEqual({ anas: 0.01, salma: 0 });
});
it("keeps existing personal deficits visible", () => {
  const result = calculate({ joint: 0, anas: -100, salma: 1000 }, { joint: 0, anas: 0, salma: 0 }, split);
  expect(result.left.anas).toBe(-100);
  expect(result.pool.joint).toBe(0);
});
