import { describe, expect, it } from "vitest";
import { hasMeaningfulWorkTime, workTime } from "./work-time";
describe("spending in work time", () => {
  it("shows notes only for a valid rate and at least one actual hour", () => {
    expect(hasMeaningfulWorkTime(100, 100)).toBe(true);
    for (const [amount, rate] of [[99.9, 100], [0, 100], [-100, 100], [100, undefined], [100, 0], [100, Infinity]] as const) expect(hasMeaningfulWorkTime(amount, rate)).toBe(false);
  });
  it("converts spending to approximate whole hours", () => expect(workTime(4250, 100)).toBe("43 hours"));
  it("rounds across an hour boundary", () => expect(workTime(199.9, 100)).toBe("2 hours"));
  it("keeps tiny spending distinct from zero", () => { expect(workTime(.1, 100)).toBe("Less than 1 hour"); expect(workTime(0, 100)).toBe("0 hours"); });
});

import { calculateWorkRate, readWorkConfig, readWorkRates, saveWorkConfig, type PayInput } from "./work-time";
import { afterEach, vi } from "vitest";
const person = (pay: string, hours: string, frequency: PayInput["frequency"] = "monthly"): PayInput => ({ pay, hours, frequency });
afterEach(() => vi.unstubAllGlobals());
describe("salary rate calculation", () => {
  it("uses annualized monthly pay rather than four-week months", () => expect(calculateWorkRate([person("20000", "40")])).toBeCloseTo(115.384615));
  it("supports weekly and yearly pay", () => {
    expect(calculateWorkRate([person("1000", "20", "weekly")])).toBe(50);
    expect(calculateWorkRate([person("104000", "40", "yearly")])).toBe(50);
  });
  it("weights Joint by combined hours, with independent pay frequencies", () => expect(calculateWorkRate([person("20000", "40"), person("1000", "20", "weekly")])).toBeCloseTo(93.589744));
  it("rejects incomplete, nonfinite and impossible inputs", () => {
    for (const input of [person("", "40"), person("1000", "0"), person("-1", "40"), person("Infinity", "40"), person("1000", "169")]) expect(calculateWorkRate([input])).toBeNull();
  });
  it("restores salary inputs, isolates scopes, migrates legacy rates and removes them", () => {
    const storage = new Map<string, string>([["finance-work-rates-v1", JSON.stringify({ anas: 100, salma: 80 })]]);
    vi.stubGlobal("localStorage", { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) });
    vi.stubGlobal("window", { dispatchEvent: vi.fn() });
    expect(readWorkConfig("anas")).toEqual({ method: "hourly", rate: 100 });
    const people = [person("20000", "40")];
    saveWorkConfig("anas", { rate: calculateWorkRate(people)!, method: "salary", people });
    expect(readWorkConfig("anas")?.people).toEqual(people);
    expect(readWorkRates().salma).toBe(80);
    saveWorkConfig("anas", null);
    expect(readWorkRates().anas).toBeUndefined();
  });
});
