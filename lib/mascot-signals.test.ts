import { describe, expect, it } from "vitest";
import { billShortfalls } from "./suggestions";
import { pickSignal } from "../app/components/mascot/MascotSignal";

describe("pickSignal", () => {
  it("shows one signal, by priority", () => {
    expect(pickSignal({ sleep: true, dot: true, thinking: true, alert: true })).toBe("alert");
    expect(pickSignal({ sleep: true, dot: true, thinking: true })).toBe("thinking");
    expect(pickSignal({ sleep: true, dot: true })).toBe("dot");
    expect(pickSignal({ sleep: true })).toBe("sleep");
    expect(pickSignal({})).toBeNull();
  });
});

describe("billShortfalls", () => {
  const bill = (categoryId: string, amount: number, dueDate: string, name = "Rent") => ({ name, categoryId, amount, dueDate });
  it("flags a bill due within a week that the category can't cover", () => {
    const out = billShortfalls([bill("a-1", 500, "2026-11-18")], [{ id: "a1", available: 200 }], "2026-11-13");
    expect(out.get("a1")).toEqual({ name: "Rent", dueDate: "2026-11-18", short: 300 });
  });
  it("ignores covered bills and bills more than a week away", () => {
    expect(billShortfalls([bill("a1", 500, "2026-11-18")], [{ id: "a1", available: 500 }], "2026-11-13").size).toBe(0);
    expect(billShortfalls([bill("a1", 500, "2026-11-25")], [{ id: "a1", available: 0 }], "2026-11-13").size).toBe(0);
  });
  it("adds up several bills in one category and names the first due", () => {
    const out = billShortfalls([bill("a1", 100, "2026-11-19", "Water"), bill("a1", 100, "2026-11-15", "Power")], [{ id: "a1", available: 150 }], "2026-11-13");
    expect(out.get("a1")).toEqual({ name: "Power", dueDate: "2026-11-15", short: 50 });
  });
});

import { NO_EYE_MOMENT, eyeMoment, shapeEye } from "../app/components/mascot/face";

describe("eye range", () => {
  it("rounds a capsule into a dot and leaves it alone otherwise", () => {
    const dot = shapeEye(0.2, 0.44, { ...NO_EYE_MOMENT, round: 1 });
    expect(dot.w).toBeCloseTo(dot.h);
    expect(shapeEye(0.2, 0.44, NO_EYE_MOMENT)).toEqual({ w: 0.2, h: 0.44 });
  });
  it("does something every few seconds, and nothing when calm", () => {
    const active = Array.from({ length: 400 }, (_, i) => eyeMoment(i * 0.1)).filter(m => m !== NO_EYE_MOMENT).length;
    expect(active).toBeGreaterThan(20);
    expect(eyeMoment(5, true)).toBe(NO_EYE_MOMENT);
  });
});
