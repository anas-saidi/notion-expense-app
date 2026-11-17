import { describe, expect, it } from "vitest";
import { closeOnOrBefore, nisabMad, parseYahooChart, quoteFromCloses, silverNisabOn } from "./silver-nisab";

const ts = (d: string) => Date.parse(`${d}T04:00:00Z`) / 1000;
const chart = (rows: Array<[string, number | null]>) => ({ chart: { result: [{ timestamp: rows.map(([d]) => ts(d)), indicators: { quote: [{ close: rows.map(([, c]) => c) }] } }] } });

describe("silver nisab", () => {
  it("matches the verified Jul 27, 2024 figure", () => {
    expect(Math.round(nisabMad(27.86, 9.5237))).toBe(5076);
  });

  it("uses Friday's close for a Saturday and skips empty bars", () => {
    const closes = parseYahooChart(chart([["2024-08-29", 28.9], ["2024-08-30", 28.73], ["2024-09-02", null]]));
    expect(closes.has("2024-09-02")).toBe(false);
    expect(closeOnOrBefore(closes, "2024-08-31")).toEqual({ date: "2024-08-30", value: 28.73 });
  });

  it("dates bars by their local trading day in New York and London, summer and winter", () => {
    const bars = (stamps: string[]) => ({ chart: { result: [{ timestamp: stamps.map(s => Date.parse(s) / 1000), indicators: { quote: [{ close: stamps.map(() => 1) }] } }] } });
    expect([...parseYahooChart(bars(["2024-07-26T04:00:00Z", "2024-12-06T05:00:00Z"])).keys()]).toEqual(["2024-07-26", "2024-12-06"]);
    expect([...parseYahooChart(bars(["2024-07-25T23:00:00Z", "2024-12-06T00:00:00Z"])).keys()]).toEqual(["2024-07-26", "2024-12-06"]);
  });

  it("refuses a date with no price within a week", () => {
    const silver = parseYahooChart(chart([["2024-01-02", 23.7]]));
    expect(() => quoteFromCloses("2024-03-01", silver, silver)).toThrow(/within a week/);
  });

  it("builds a quote from both series", async () => {
    const fetcher = async (url: string) => ({ ok: true, status: 200, json: async () => url.includes("SI%3DF") ? chart([["2024-07-26", 27.86]]) : chart([["2024-07-26", 9.5237]]) });
    const q = await silverNisabOn("2024-07-27", fetcher);
    expect(q).toMatchObject({ priceDate: "2024-07-26", rateDate: "2024-07-26", source: "yahoo" });
    expect(Math.round(q.nisabMad)).toBe(5076);
  });

  it("reports a failed price service", async () => {
    const fetcher = async () => ({ ok: false, status: 429, json: async () => ({}) });
    await expect(silverNisabOn("2024-07-27", fetcher)).rejects.toThrow(/returned 429/);
  });
});
