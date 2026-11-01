"use client";

import { SheetHeader } from "./ui/SheetLayout";

import { useEffect, useRef, useState } from "react";
import type { BudgetScope } from "./app-types";
import type { ContributionStatus } from "./contribution-utils";
import { contributionDue } from "./contribution-utils";
import type { ContributionAgreement, ContributionLedger, Partner, PartnerAmounts } from "../../lib/contribution-agreements";
import { money } from "../../lib/contribution-agreements";
import { fmt, parseAmount, today } from "./app-utils";
import { Money } from "./Money";
import { BottomSheet } from "./ui/BottomSheet";
import { Banner } from "./ui/Banner";
import { DatePicker, MonthPicker } from "./DatePicker";
import { XIcon, ChevronRightIcon, ChevronDownIcon, ReceiptIcon } from "./ui/icons";
import { SkeletonRows } from "./ui/Skeleton";
import "./contributions.css";

export const contributionMonthName = (month: string) => new Date(`${month}-01T12:00:00`).toLocaleDateString("en", { month: "long", year: "numeric" });
const person = (partner: Partner) => partner === "anas" ? "Anas" : "Salma";

export function ContributionEntry({ status, scope, onOpen }: { status: ContributionStatus | null; scope: BudgetScope; onOpen: () => void }) {
  const owing = status?.advances?.outstanding;
  const amount = owing ? scope === "joint" ? money(owing.anas + owing.salma) : owing[scope] : 0;
  return <button type="button" className="contribution-entry" onClick={onOpen}>
    <span><span className="contribution-entry-title">{amount > 0 ? scope === "joint" ? "Owed to you both" : "Joined owes you" : "Monthly contributions"}</span>
      {amount <= 0 && <span className="contribution-entry-detail">{status?.agreement ? contributionMonthName(status.agreement.month) : "Review contributions"}</span>}</span>
    <span className="contribution-entry-value">{amount > 0 && <Money value={amount} />}<ChevronRightIcon size={16} /></span>
  </button>;
}

export function ContributionAgreementEditor({ month, agreement, proposed, shares, disabled = false, showHeading = true, onSaved }: {
  month: string; agreement?: ContributionAgreement; proposed: PartnerAmounts; shares: PartnerAmounts; disabled?: boolean; showHeading?: boolean; onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [anas, setAnas] = useState("");
  const [salma, setSalma] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { setEditing(false); setError(""); }, [month, agreement?.version]);
  const edit = () => { setAnas(String(agreement?.targets.anas ?? money(proposed.anas))); setSalma(String(agreement?.targets.salma ?? money(proposed.salma))); setEditing(true); setError(""); };
  const save = async () => {
    const a = parseAmount(anas), s = parseAmount(salma);
    if (a == null || s == null || a < 0 || s < 0) { setError("Enter both contribution amounts."); return; }
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/contribution-agreements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ month, targets: { anas: money(a), salma: money(s) }, shares, expectedVersion: agreement?.version ?? null }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not confirm contributions.");
      setEditing(false); onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not confirm contributions. Refresh and try again."); }
    finally { setSaving(false); }
  };
  return <section className="contribution-agreement" aria-label="Monthly contribution agreement">
    {showHeading && <h3>Agreed contributions</h3>}
    {editing ? <>
      <div className="contribution-fields">
        <label>Anas<input className="field-input" inputMode="decimal" value={anas} onChange={e => setAnas(e.target.value)} disabled={saving} /></label>
        <label>Salma<input className="field-input" inputMode="decimal" value={salma} onChange={e => setSalma(e.target.value)} disabled={saving} /></label>
      </div>
      <p className="contribution-note">Extra contributions are repayable advances. Category changes leave this agreement unchanged.</p>
      <div className="contribution-actions"><button type="button" className="contribution-primary" disabled={saving || disabled} onClick={() => void save()}>{saving ? "Confirming…" : agreement ? "Update contributions" : "Confirm contributions"}</button><button type="button" className="contribution-text" disabled={saving} onClick={() => setEditing(false)}>Cancel</button></div>
    </> : <>
      {agreement && <dl className="contribution-rows"><div><dt>Anas</dt><dd><Money value={agreement.targets.anas} /></dd></div><div><dt>Salma</dt><dd><Money value={agreement.targets.salma} /></dd></div></dl>}
      <button type="button" className="contribution-text" disabled={disabled} onClick={edit}>{agreement ? "Change agreed amounts" : "Set monthly contributions"}</button>
    </>}
    {error && <Banner tone="danger" role="alert" compact>{error}</Banner>}
  </section>;
}

export function ContributionDetails({ open, month, scope, status, currentAdvances, cash, loading, error, onClose, onChanged, onRetry, onMonthChange }: {
  open: boolean; month: string; scope: BudgetScope; status: ContributionStatus | null; cash: number | null; loading: boolean; error: boolean;
  currentAdvances: ContributionLedger | null; onMonthChange: (month: string) => void;
  onClose: () => void; onChanged: () => void; onRetry: () => void;
}) {
  const [repaying, setRepaying] = useState<Partner | null>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [success, setSuccess] = useState("");
  const requestId = useRef("");
  useEffect(() => { if (open) { setRepaying(null); setSaveError(""); setSuccess(""); setUncertain(false); } }, [open, month]);
  const ledger = currentAdvances;
  const current = ledger?.months.find(m => m.month === month);
  const outstanding = ledger?.outstanding ?? { anas: 0, salma: 0 };
  const totalOwed = money(outstanding.anas + outstanding.salma);
  const partners: Partner[] = scope === "joint" ? ["anas", "salma"] : [scope];
  const scopedOwed = money(partners.reduce((sum, partner) => sum + outstanding[partner], 0));
  const scopedDue = money(partners.reduce((sum, partner) => sum + (status ? contributionDue(status, partner) : 0), 0));
  const startRepayment = (partner: Partner) => { setRepaying(partner); setAmount(String(outstanding[partner])); setDate(today()); setSaveError(""); setSuccess(""); setUncertain(false); requestId.current = crypto.randomUUID(); };
  const repay = async () => {
    const value = parseAmount(amount);
    if (!repaying || value == null || value <= 0 || value > outstanding[repaying]) { setSaveError("Enter an amount no greater than the outstanding advance."); return; }
    setSaving(true); setSaveError("");
    try {
      const response = await fetch("/api/contribution-repayments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ partner: repaying, amount: money(value), date, requestId: requestId.current }) });
      const result = await response.json();
      if (response.status >= 500) { setUncertain(true); throw new Error("Could not confirm whether the repayment saved. Retry unchanged details to check safely."); }
      if (!response.ok) throw new Error(result.error ?? "Could not record repayment.");
      setRepaying(null); setSuccess("Repayment recorded"); onChanged();
    } catch (e) { if (e instanceof TypeError) setUncertain(true); setSaveError(e instanceof Error ? e.message : "Could not verify the repayment. Retry with the same details to check it safely."); }
    finally { setSaving(false); }
  };
  const agreementEditor = status ? <ContributionAgreementEditor showHeading={!status.agreement} month={month} agreement={status.agreement}
    proposed={{ anas: Math.max(0, money(status.anasPlan - status.anasPersonalDebt)), salma: Math.max(0, money(status.salmaPlan - status.salmaPersonalDebt)) }}
    shares={status.agreement?.shares ?? { anas: .65, salma: .35 }} disabled={saving || !!repaying} onSaved={onChanged} /> : null;
  return <BottomSheet open={open} onClose={() => { if (!saving) onClose(); }} label="Monthly contributions" size="standard" detent="content">
    <div className="contribution-sheet sheet-body">
      <SheetHeader className="contribution-header"><h2>Contributions</h2><button type="button" className="contribution-close" aria-label="Close contributions" disabled={saving} onClick={onClose}><XIcon size={20} /></button></SheetHeader>
      <MonthPicker value={month} onChange={event => onMonthChange(event.target.value)} aria-label="Contribution month" />
      {loading ? <SkeletonRows label="Loading contributions" count={4} /> : error || !status ? <Banner tone="danger" role="alert" title="Contributions unavailable" action={<button className="contribution-text" type="button" onClick={onRetry}>Retry</button>} /> : <>
        <section className="contribution-overview" aria-label="Contribution summary">
          {scopedOwed > 0 ? <><span>{scope === "joint" ? "Joined owes you both" : "Joined owes you"}</span><p className="contribution-hero-amount"><Money value={scopedOwed} currency /></p>
            {scope === "joint" && <div className="contribution-split" role="img" aria-label={`Outstanding repayments: ${partners.filter(partner => outstanding[partner] > 0).map(partner => `${person(partner)} ${fmt(outstanding[partner])} MAD`).join(", ")}`}>
              {partners.filter(partner => outstanding[partner] > 0).map(partner => <span key={partner} className="contribution-split-part" data-partner={partner} style={{ flexGrow: outstanding[partner] }} />)}
            </div>}
            <span className="contribution-note">Reserved until repaid</span></>
            : scopedDue > 0 ? <><span>Due to Joined</span><p className="contribution-hero-amount"><Money value={scopedDue} currency /></p></>
            : <p className="contribution-all-settled">{status.agreement ? "All settled" : "No agreed amounts"}</p>}
        </section>
        <div className="contribution-people">
        {partners.map(partner => {
          const actual = partner === "anas" ? status.anasActual : status.salmaActual;
          const target = status.agreement?.targets[partner];
          const due = contributionDue(status, partner);
          return <section className="contribution-person" data-partner={partner} key={`${month}-${partner}`} aria-label={`${person(partner)} contributions`}>
            <div className="contribution-person-main">
              <div className="contribution-person-summary">
                <span className="contribution-person-name"><strong>{person(partner)}</strong>{due > 0.005 ? <span>{fmt(due)} due to Joined</span> : !status.agreement ? <span>Not confirmed</span> : null}</span>
                {outstanding[partner] > 0 && <strong className="contribution-person-amount"><Money value={outstanding[partner]} /></strong>}
              </div>
              <details className="contribution-breakdown">
                <summary aria-label={`View breakdown for ${person(partner)}`}><span>View breakdown</span><ChevronDownIcon size={16} aria-hidden="true" /></summary>
              <dl className="contribution-rows">
                {status.agreement && <div><dt>Original</dt><dd><Money value={status.agreement.original[partner]} /></dd></div>}
                {target != null && target !== status.agreement?.original[partner] && <div><dt>Agreed</dt><dd><Money value={target} /></dd></div>}
                <div><dt>Contributed</dt><dd><Money value={actual} /></dd></div>
                {current && <div><dt>Above original</dt><dd><Money value={current.aboveOriginal[partner]} /></dd></div>}
                {current && current.repaid[partner] > 0 && <div><dt>Repaid</dt><dd><Money value={current.repaid[partner]} /></dd></div>}
              </dl>
              </details>
            </div>
            {outstanding[partner] > 0 && <button className="contribution-text contribution-repay-shortcut" type="button" disabled={saving || !!repaying} aria-label={`Log repayment to ${person(partner)}`} title={`Log repayment to ${person(partner)}`} onClick={() => startRepayment(partner)}><ReceiptIcon size={20} aria-hidden="true" /></button>}
          </section>;
        })}
        </div>
        {ledger && ledger.unappliedRepayments.anas + ledger.unappliedRepayments.salma > 0 && <Banner tone="warning" role="alert">A corrected agreement or transaction left a repayment above the advance. Review repayment activity.</Banner>}
        {repaying && <section className="contribution-repay"><h3>Money returned to {person(repaying)}</h3><label>Amount returned<input autoFocus className="field-input" inputMode="decimal" value={amount} disabled={saving || uncertain} onChange={e => { setAmount(e.target.value); requestId.current = crypto.randomUUID(); }} /></label>{uncertain || saving ? <span className="contribution-note">Repayment date: {date}</span> : <DatePicker value={date} max={today()} onChange={event => { setDate(event.target.value); requestId.current = crypto.randomUUID(); }} aria-label="Date money was returned" />}
          <p className="contribution-note">Log money already transferred from Joined to {person(repaying)}.</p>
          <div className="contribution-actions"><button type="button" className="contribution-primary" disabled={saving} onClick={() => void repay()}>{saving ? "Recording…" : uncertain ? "Check repayment" : "Save repayment"}</button><button type="button" className="contribution-text" disabled={saving} onClick={() => setRepaying(null)}>Cancel</button></div>
        </section>}
        {saveError && <Banner tone="danger" role="alert">{saveError}</Banner>}{success && <p role="status">{success}</p>}
        {totalOwed > 0 && <details className="contribution-disclosure" key={`coverage-${month}`}>
          <summary><span>Cash coverage</span>{cash != null && cash < totalOwed && <span className="contribution-coverage-shortfall">At least <Money value={money(totalOwed - cash)} /> short</span>}<ChevronDownIcon size={16} aria-hidden="true" /></summary>
          <dl className="contribution-rows"><div><dt>Reserved for repayments</dt><dd><Money value={totalOwed} /></dd></div><div><dt>Recorded Joined cash</dt><dd>{cash == null ? "Unavailable" : <Money value={cash} />}</dd></div></dl>
          <p className="contribution-note">Before other commitments.</p>
          {(ledger?.months.filter(m => m.outstanding.anas + m.outstanding.salma > 0).length ?? 0) > 1 && <dl className="contribution-rows">{ledger?.months.filter(m => m.outstanding.anas + m.outstanding.salma > 0).map(m => <div key={m.month}><dt>{contributionMonthName(m.month)}</dt><dd><Money value={money(m.outstanding.anas + m.outstanding.salma)} /></dd></div>)}</dl>}
        </details>}
        {status.agreement ? <details className="contribution-disclosure" key={`agreement-${month}`}><summary><span>Agreed amounts</span><ChevronDownIcon size={16} aria-hidden="true" /></summary>
          {agreementEditor}
        </details> : agreementEditor}
      </>}
    </div>
  </BottomSheet>;
}
