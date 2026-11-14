import { describe, expect, it } from "vitest";
import { STEADY, contributionMood, planKeptMood, planningMood, spendingMood } from "./light-mood";

describe("spendingMood", () => {
  it("is steady on pace, brighter ahead of it, dimmer behind it", () => {
    expect(spendingMood(500, 500, 0.5)?.level).toBeCloseTo(STEADY);
    expect(spendingMood(900, 100, 0.5)?.level).toBe(1);
    expect(spendingMood(200, 800, 0.5)?.level).toBeLessThan(STEADY);
  });
  it("reads the same share differently by the calendar", () => {
    // 15% left is fine on day 28, worrying on day 5.
    expect(spendingMood(150, 850, 0.9)!.level).toBeGreaterThan(spendingMood(150, 850, 0.15)!.level);
  });
  it("is coral when overspent and empty without a plan", () => {
    expect(spendingMood(-50, 1050, 0.5)).toEqual({ level: 0.15, warn: "over" });
    expect(spendingMood(0, 0, 0.5)).toBeNull();
  });
  it("warms to honey when little is left ahead of the calendar", () => {
    expect(spendingMood(100, 900, 0.3)?.warn).toBe("low");
  });
});

describe("contributionMood", () => {
  it("fills with the share paid", () => {
    expect(contributionMood(1000, 1000).level).toBe(1);
    expect(contributionMood(500, 1000).level).toBe(0.5);
    expect(contributionMood(0, 1000).level).toBe(0.15);
    expect(contributionMood(0, 0).level).toBe(1);
  });
});

describe("planningMood", () => {
  it("is bright when everything is placed and dims with money waiting", () => {
    expect(planningMood(1000, 0)?.level).toBe(1);
    expect(planningMood(750, 250)?.level).toBe(0.75);
  });
  it("is coral when over-assigned and empty with no money", () => {
    expect(planningMood(1000, -20)?.warn).toBe("over");
    expect(planningMood(0, 0)).toBeNull();
  });
});

describe("planKeptMood", () => {
  it("is bright within plan, dimmer when categories went over, coral when the total did", () => {
    expect(planKeptMood(1000, 800, 0)).toEqual({ level: 1, warn: null });
    expect(planKeptMood(1000, 900, 100)).toEqual({ level: STEADY * 0.9, warn: null });
    expect(planKeptMood(1000, 1200, 300)?.warn).toBe("over");
    expect(planKeptMood(0, 100, 0)).toBeNull();
  });
});
