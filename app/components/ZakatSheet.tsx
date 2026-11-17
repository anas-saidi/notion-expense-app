"use client";
import { useCallback, useEffect, useState } from "react";
import "./sheet-components.css";
import { BottomSheet } from "./ui/BottomSheet";
import { SheetHeader } from "./ui/SheetLayout";
import { Button } from "./ui/Button";
import { XIcon } from "./ui/icons";
import { SavingCover, guardClose, useBlockingSave } from "./ui/SavingCover";
import { fmt } from "./app-utils";
import type { ZakatResponse } from "../../lib/zakat-data";
import { payAmount, statusFrom, writeZakatStatus } from "./zakat-status";
import type { ZakatYear } from "../../lib/zakat";

const longDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const mad = (n: number) => `${fmt(Math.round(n))} MAD`;
const statusLabel: Record<ZakatYear["status"], string> = { covered: "Paid", overdue: "Overdue", "partly paid": "Partly paid", "not checked": "Not checked" };
const statusColor: Record<ZakatYear["status"], string> = { covered: "var(--success)", overdue: "var(--danger)", "partly paid": "var(--warning)", "not checked": "var(--muted)" };

export type ZakatPaymentDraft = { amount: number; categoryId: string; accountId: string };

export function ZakatSheet({ open, onClose, onRecordPayment, onStatusChange }: { open: boolean; onClose: () => void; onRecordPayment?: (draft: ZakatPaymentDraft) => void; onStatusChange?: () => void }) {
  const [data, setData] = useState<ZakatResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [priceUnavailable, setPriceUnavailable] = useState(false);
  const [manualPrice, setManualPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const save = useBlockingSave();

  const load = useCallback(async (silverMadPerGram?: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/zakat${silverMadPerGram ? `?silverMadPerGram=${silverMadPerGram}` : ""}`, { cache: "no-store" });
      const body = await res.json();
      setPriceUnavailable(!res.ok && !!body.priceUnavailable);
      if (!res.ok) throw new Error(body.error ?? "Zakat is unavailable.");
      setData(body);
      // A manual price makes every year an estimate: don't let it drive the Home reminder.
      if (body.prices?.source === "yahoo") { writeZakatStatus(statusFrom(body)); onStatusChange?.(); }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Zakat is unavailable.");
    } finally {
      setLoading(false);
    }
  }, [onStatusChange]);

  useEffect(() => { if (open && !data && !loading && !error) void load(); }, [open, data, loading, error, load]);

  const saveSetup = () => save.run(async () => {
    try {
      const res = await fetch("/api/zakat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedVersion: data?.setupSaved?.version ?? null }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't save the setup.");
      setData(d => (d ? { ...d, setupSaved: { version: body.version } } : d));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the setup.");
    }
  });
  const close = guardClose(save.saving, onClose);

  const years = data?.schedule.years ?? [];
  const unpaid = years.filter(y => y.status === "overdue" || y.status === "partly paid");
  const current = data?.schedule.current ?? null;
  const toPay = unpaid.reduce((s, y) => s + payAmount(y.owed, y.paid), 0);
  const manualValue = Number(manualPrice.replace(",", "."));
  const recordPayment = () => {
    if (!data || !onRecordPayment) return;
    onRecordPayment({ amount: toPay, categoryId: data.setup.paymentCategoryId, accountId: data.setup.paymentAccountId });
    setData(null); // the next open reloads, so the new payment shows up
    onClose();
  };

  return <BottomSheet open={open} onClose={close} label="Zakat" size="standard">
    <div className="sheet-body" style={contentStyle}>
      <SheetHeader style={headerStyle}>
        <h2 style={titleStyle}>Zakat</h2>
        <button type="button" className="sheet-close-button" aria-label="Close zakat" onClick={close}><XIcon size={20} /></button>
      </SheetHeader>

      {loading && !data && <p role="status" style={mutedStyle}>Checking your balances against the silver nisab. This can take up to a minute.</p>}
      {error && <div role="alert" style={{ display: "grid", gap: 8 }}>
        <p style={{ ...bodyStyle, color: "var(--danger)" }}>{error}</p>
        <Button variant="secondary" size="compact" onClick={() => load()} loading={loading} loadingLabel="Retrying">Try again</Button>
      </div>}
      {priceUnavailable && <section aria-label="Enter silver price" style={sectionStyle}>
        <label htmlFor="zakat-silver-price" style={labelStyle}>Silver price today, MAD per gram</label>
        <input id="zakat-silver-price" value={manualPrice} inputMode="decimal" placeholder="15.60" onChange={e => setManualPrice(e.target.value.replace(/[^0-9.,]/g, ""))} style={inputStyle} />
        <p style={smallStyle}>Used for every date while the price service is down, so past years become estimates. Check a live price, e.g. your bank or a bullion dealer.</p>
        <Button variant="secondary" size="compact" disabled={!(manualValue > 0)} onClick={() => load(manualValue)} loading={loading} loadingLabel="Checking">Use this price</Button>
      </section>}

      {data && <>
        <section aria-label="What to pay" style={heroStyle}>
          {unpaid.length ? <>
            <span style={{ ...eyebrowStyle, color: "var(--danger)" }}>Overdue</span>
            <strong style={heroAmountStyle}>Pay {mad(toPay)}</strong>
            <span style={mutedStyle}>{unpaid.map(y => `Year ${y.number}, due ${longDate(y.due)}: ${mad(y.owed - y.paid)} owed`).join(" · ")}. Rounded up to the next 10 MAD.</span>
            {onRecordPayment && <Button variant="primary" size="compact" onClick={recordPayment} style={{ justifySelf: "start", marginTop: 8 }}>Record payment</Button>}
          </> : current ? <>
            <span style={eyebrowStyle}>Next zakat</span>
            <strong style={heroAmountStyle}>{longDate(current.due)}</strong>
            <span style={mutedStyle}>In {current.daysLeft} days. At today's balance it would be about {mad(payAmount(current.estimate))}.</span>
          </> : <>
            <span style={eyebrowStyle}>No hawl running</span>
            <span style={mutedStyle}>Your balance is below the silver nisab, so no zakat year is counting.</span>
          </>}
        </section>

        {current && <section aria-label="Current hawl" style={sectionStyle}>
          <h3 style={sectionTitleStyle}>Current hawl</h3>
          <Row label="Started" value={longDate(current.start)} />
          <Row label="Due" value={`${longDate(current.due)} (${current.daysLeft} days)`} />
          <Row label="Your balance today" value={mad(current.wealthToday)} />
          <Row label="Silver nisab today" value={mad(current.nisabToday)} />
          <p style={smallStyle}>{data.prices.source === "yahoo"
            ? `595 g of silver at $${data.prices.silverUsdPerOunce.toFixed(2)}/oz (${longDate(data.prices.silverDate)}) × ${data.prices.usdToMad.toFixed(4)} MAD per USD. Source: Yahoo Finance.`
            : `595 g of silver at your price of ${data.prices.silverMadPerGram} MAD per gram, used for every date. Past years are estimates until the price service is back.`}</p>
        </section>}

        <section aria-label="Zakat years" style={sectionStyle}>
          <h3 style={sectionTitleStyle}>Zakat years</h3>
          {years.length === 0 && <p style={mutedStyle}>No zakat year has finished yet.</p>}
          {[...years].reverse().map(y => <div key={y.due} style={yearStyle}>
            <div style={rowStyle}>
              <span style={labelStyle}>Year {y.number} · due {longDate(y.due)}</span>
              <span style={{ ...chipStyle, color: statusColor[y.status] }}>{statusLabel[y.status]}</span>
            </div>
            <span style={smallStyle}>
              {Number.isFinite(y.owed) ? `Owed ${mad(y.owed)} (2.5% of ${mad(y.wealth)})` : "Due before the app's records start"} · Paid {mad(y.paid)}
              {y.payments.length > 0 && ` on ${y.payments.map(p => longDate(p.date)).join(", ")}`}
            </span>
          </div>)}
          {data.schedule.breaks.length > 0 && <p style={smallStyle}>Hawl restarted after: {data.schedule.breaks.map(b => `${longDate(b.date)} (${mad(b.wealth)} below a nisab of ${mad(b.nisab)})`).join("; ")}.</p>}
        </section>

        <section aria-label="Setup" style={sectionStyle}>
          <h3 style={sectionTitleStyle}>Setup</h3>
          <Row label="Standard" value="Silver, 595 g" />
          <Row label="First hawl started" value={longDate(data.setup.hawlStart)} />
          <Row label="Counted accounts" value="Hubby, Saving, Cash" />
          <p style={smallStyle}>Zakat paid is any expense on these accounts named "{data.setup.paymentKeyword}". Money you lent out still counts as yours. {data.setup.note}</p>
          {!data.setupSaved && <Button variant="secondary" size="compact" onClick={saveSetup} loading={save.saving} loadingLabel="Saving">Save setup to Notion</Button>}
        </section>
      </>}
    </div>
    <SavingCover saving={save.saving} />
  </BottomSheet>;
}

function Row({ label, value }: { label: string; value: string }) {
  return <div style={rowStyle}><span style={labelStyle}>{label}</span><span style={valueStyle}>{value}</span></div>;
}

const contentStyle = { padding: "16px 24px calc(24px + env(safe-area-inset-bottom, 0px))", display: "grid", gap: 24 } as const;
const headerStyle = { display: "flex", alignItems: "center", justifyContent: "space-between" } as const;
const titleStyle = { margin: 0, fontSize: 20, lineHeight: "24px", fontWeight: 600 } as const;
const heroStyle = { display: "grid", gap: 4 } as const;
const eyebrowStyle = { fontSize: 13, lineHeight: "16px", fontWeight: 600, color: "var(--text2)" } as const;
const heroAmountStyle = { fontSize: 28, lineHeight: "34px", fontWeight: 600, color: "var(--text)", fontVariantNumeric: "tabular-nums" } as const;
const sectionStyle = { display: "grid", gap: 8 } as const;
const sectionTitleStyle = { margin: 0, fontSize: 13, lineHeight: "16px", color: "var(--muted)", fontWeight: 600 } as const;
const rowStyle = { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, minHeight: 32 } as const;
const yearStyle = { display: "grid", gap: 2, padding: "8px 0", borderTop: "1px solid var(--surface2)" } as const;
const labelStyle = { fontSize: 15, lineHeight: "22px", color: "var(--text)" } as const;
const valueStyle = { fontSize: 15, lineHeight: "22px", color: "var(--text)", fontVariantNumeric: "tabular-nums", textAlign: "right" } as const;
const chipStyle = { fontSize: 13, lineHeight: "16px", fontWeight: 600, flexShrink: 0 } as const;
const bodyStyle = { margin: 0, fontSize: 15, lineHeight: "22px" } as const;
const mutedStyle = { margin: 0, fontSize: 15, lineHeight: "22px", color: "var(--text2)" } as const;
const inputStyle = { minHeight: 44, padding: "0 12px", border: "1px solid var(--border2)", borderRadius: "var(--radius-control)", background: "var(--surface)", color: "var(--text)", fontSize: 15, fontFamily: "inherit" } as const; // globals.css raises inputs to 16px on phones
const smallStyle = { margin: 0, fontSize: 13, lineHeight: "18px", color: "var(--text2)" } as const;
