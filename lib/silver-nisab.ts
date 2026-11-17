/** Silver nisab in MAD: 595 g of silver at that day's price. */
export const NISAB_SILVER_GRAMS = 595;
export const GRAMS_PER_TROY_OUNCE = 31.1035;

export type DailyCloses = Map<string, number>;
export type NisabQuote = {
  date: string;
  priceDate: string;
  rateDate: string;
  silverUsdPerOunce: number;
  usdToMad: number;
  nisabMad: number;
  source: "yahoo" | "manual";
};

export function nisabMad(silverUsdPerOunce: number, usdToMad: number) {
  return (NISAB_SILVER_GRAMS * silverUsdPerOunce / GRAMS_PER_TROY_OUNCE) * usdToMad;
}

/** Markets close on weekends and holidays: use the last close on or before the date, within a week. */
export function closeOnOrBefore(closes: DailyCloses, date: string, maxDays = 7) {
  const day = new Date(`${date}T00:00:00Z`);
  for (let back = 0; back <= maxDays; back += 1) {
    const key = new Date(day.getTime() - back * 86_400_000).toISOString().slice(0, 10);
    const value = closes.get(key);
    if (value !== undefined) return { date: key, value };
  }
  return null;
}

/** Reads Yahoo Finance's chart JSON into date → close (UTC day of each bar). */
export function parseYahooChart(json: any): DailyCloses {
  const result = json?.chart?.result?.[0];
  const times: number[] = result?.timestamp ?? [];
  const closes: Array<number | null> = result?.indicators?.quote?.[0]?.close ?? [];
  // Each bar is stamped at local midnight of its trading day (New York for SI=F at 04:00/05:00 UTC,
  // London for MAD=X at 23:00/00:00 UTC). Local midnight is always within 12 h of UTC midnight,
  // so the nearest UTC midnight gives the trading day, summer time included.
  const out: DailyCloses = new Map();
  times.forEach((t, i) => {
    const close = closes[i];
    if (typeof close === "number" && Number.isFinite(close) && close > 0) out.set(new Date((t + 12 * 3600) * 1000).toISOString().slice(0, 10), close);
  });
  return out;
}

type Fetcher = (url: string) => Promise<{ ok: boolean; status: number; json: () => Promise<any> }>;

/** COMEX silver (SI=F, USD per troy ounce) and USD/MAD (MAD=X) daily closes for a date range. */
export async function fetchYahooCloses(symbol: "SI=F" | "MAD=X", from: string, to: string, fetcher: Fetcher = fetch as any) {
  const p1 = Math.floor(new Date(`${from}T00:00:00Z`).getTime() / 1000) - 10 * 86_400;
  const p2 = Math.floor(new Date(`${to}T00:00:00Z`).getTime() / 1000) + 2 * 86_400;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${p1}&period2=${p2}&interval=1d`;
  const res = await fetcher(url).catch(error => { throw Object.assign(new Error(`Silver price service unreachable: ${error instanceof Error ? error.message : error}`), { status: 502, code: "PRICE_UNAVAILABLE" }); });
  if (!res.ok) throw Object.assign(new Error(`Silver price service returned ${res.status}.`), { status: 502, code: "PRICE_UNAVAILABLE" });
  const closes = parseYahooChart(await res.json());
  if (!closes.size) throw Object.assign(new Error(`No ${symbol} prices for ${from} to ${to}.`), { status: 502, code: "PRICE_UNAVAILABLE" });
  return closes;
}

export function quoteFromCloses(date: string, silver: DailyCloses, fx: DailyCloses): NisabQuote {
  const price = closeOnOrBefore(silver, date);
  const rate = closeOnOrBefore(fx, date);
  if (!price || !rate) throw Object.assign(new Error(`No silver price or exchange rate within a week of ${date}.`), { status: 502 });
  return { date, priceDate: price.date, rateDate: rate.date, silverUsdPerOunce: price.value, usdToMad: rate.value, nisabMad: nisabMad(price.value, rate.value), source: "yahoo" };
}

export async function silverNisabOn(date: string, fetcher?: Fetcher): Promise<NisabQuote> {
  const [silver, fx] = await Promise.all([fetchYahooCloses("SI=F", date, date, fetcher), fetchYahooCloses("MAD=X", date, date, fetcher)]);
  return quoteFromCloses(date, silver, fx);
}
