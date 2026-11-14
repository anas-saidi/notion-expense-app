"use client";

import { SheetHeader } from "./ui/SheetLayout";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { BudgetScope } from "./app-types";
import type { ContributionStatus } from "./contribution-utils";
import { contributionDue, type DirectSpend } from "./contribution-utils";
import { CategoryIcon } from "./ui/CategoryIcon";
import type { ContributionAgreement, ContributionLedger, Partner, PartnerAmounts } from "../../lib/contribution-agreements";
import { money } from "../../lib/contribution-agreements";
import { fmt, parseAmount, today } from "./app-utils";
import { Money } from "./Money";
import { BottomSheet } from "./ui/BottomSheet";
import { Banner } from "./ui/Banner";
import { DatePicker, MonthPicker } from "./DatePicker";
import { XIcon, ChevronRightIcon, TransferIcon } from "./ui/icons";
import { MascotHero } from "./mascot/MascotHero";
import { useOnceSignal } from "./mascot/MascotSignal";
import { motion } from "motion/react";
import { Summary, Fact } from "./ui/Summary";

const MASCOT_SIZE = 200;
import { SkeletonRows } from "./ui/Skeleton";
import "./contributions.css";

/**
 * Opens content in place: the space grows while the content fades and settles 4px down.
 * Always mounted so closing can animate too; closed content is inert (no focus, no screen reader).
 */
function Reveal({ open, children, label }: { open: boolean; children: ReactNode; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (open) ref.current?.removeAttribute("inert"); else ref.current?.setAttribute("inert", ""); }, [open]);
  return <div ref={ref} className="contribution-reveal" data-open={open || undefined} aria-label={label} aria-hidden={!open}>
    <div className="contribution-reveal-inner">{children}</div>
  </div>;
}

export const contributionMonthName = (month: string) => new Date(`${month}-01T12:00:00`).toLocaleDateString("en", { month: "long", year: "numeric" });
const person = (partner: Partner) => partner === "anas" ? "Anas" : "Salma";

export function ContributionEntry({ status, scope, onOpen, advancesOnly = false }: { status: ContributionStatus | null; scope: BudgetScope; onOpen: () => void; advancesOnly?: boolean }) {
  const owing = status?.advances?.outstanding;
  const amount = owing ? scope === "joint" ? money(owing.anas + owing.salma) : owing[scope] : 0;
  if (advancesOnly && amount <= 0) return null;
  return <button type="button" className="contribution-entry" onClick={onOpen}>
    <span><span className="contribution-entry-title">{amount > 0 ? "Advances to apply" : "Monthly contributions"}</span>
      {amount <= 0 && <span className="contribution-entry-detail">{status?.agreement ? contributionMonthName(status.agreement.month) : "Review contributions"}</span>}</span>
    <span className="contribution-entry-value">{amount > 0 && <Money value={amount} />}<ChevronRightIcon size={16} /></span>
  </button>;
}

export function ContributionAgreementEditor({ month, agreement, proposed, shares, disabled = false, showHeading = true, showAmounts = true, onSaved, editing: controlledEditing, onEditingChange }: {
  month: string; agreement?: ContributionAgreement; proposed: PartnerAmounts; shares: PartnerAmounts; disabled?: boolean; showHeading?: boolean;
  /** Off where the agreed amounts are already shown next to each partner. */
  showAmounts?: boolean; onSaved: () => void;
  /** Controlled: something else (a tappable fact) opens the editor, so no trigger button is drawn. */
  editing?: boolean; onEditingChange?: (editing: boolean) => void;
}) {
  const [ownEditing, setOwnEditing] = useState(false);
  const controlled = controlledEditing !== undefined;
  const editing = controlled ? controlledEditing : ownEditing;
  const setEditing = (value: boolean) => { if (controlled) onEditingChange?.(value); else setOwnEditing(value); };
  const [anas, setAnas] = useState("");
  const [salma, setSalma] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { setEditing(false); setError(""); }, [month, agreement?.version]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (controlled && controlledEditing) { setAnas(String(agreement?.targets.anas ?? money(proposed.anas))); setSalma(String(agreement?.targets.salma ?? money(proposed.salma))); setError(""); } }, [controlled, controlledEditing]); // eslint-disable-line react-hooks/exhaustive-deps
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
    {editing || controlled ? <>
      <div className="contribution-fields">
        <label>Anas<input className="field-input" inputMode="decimal" value={anas} onChange={e => setAnas(e.target.value)} disabled={saving} /></label>
        <label>Salma<input className="field-input" inputMode="decimal" value={salma} onChange={e => setSalma(e.target.value)} disabled={saving} /></label>
      </div>
      <p className="contribution-note">Extra contributions are repayable advances.</p>
      <div className="contribution-actions"><button type="button" className="contribution-primary" disabled={saving || disabled} onClick={() => void save()}>{saving ? "Confirming…" : "Confirm"}</button><button type="button" className="contribution-text" disabled={saving} onClick={() => setEditing(false)}>Cancel</button></div>
    </> : <>
      {agreement && showAmounts && <dl className="contribution-rows"><div><dt>Anas</dt><dd><Money value={agreement.targets.anas} /></dd></div><div><dt>Salma</dt><dd><Money value={agreement.targets.salma} /></dd></div></dl>}
      {!controlled && <button type="button" className="contribution-text" disabled={disabled} onClick={edit}>{agreement ? showAmounts ? "Change" : "Change agreed amounts" : "Set contributions"}</button>}
    </>}
    {error && <Banner tone="danger" role="alert" compact>{error}</Banner>}
  </section>;
}

export function ContributionDetails({ open, month, personalScope, initialPartner, status, currentAdvances, loading, error, onClose, onChanged, onRetry, onMonthChange }: {
  open: boolean; month: string;
  /** The signed-in person: the sheet answers for them only. */
  personalScope: Partner;
  /** The partner whose figure was tapped to open this; their jar starts in front. */
  initialPartner?: Partner; status: ContributionStatus | null; loading: boolean; error: boolean;
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
  const [applying, setApplying] = useState<Partner | null>(null);
  // Tapping the agreed amount opens the editor in place. The partner in front is the one shown.
  const [shown, setShown] = useState<Partner>(initialPartner ?? personalScope);
  const [editingAgreement, setEditingAgreement] = useState(false);
  /** Bumped when the agreed amounts are confirmed: both jars wink once. */
  const [agreedWink, setAgreedWink] = useState(0);
  const applyIds = useRef<Partial<Record<Partner, string>>>({});
  useEffect(() => { if (open) { setShown(initialPartner ?? personalScope); setEditingAgreement(false); setRepaying(null); setSaveError(""); setSuccess(""); setUncertain(false); } }, [open, month]);
  const ledger = currentAdvances;
  const outstanding = ledger?.outstanding ?? { anas: 0, salma: 0 };
  // An advance comes off this month's contribution: the offset is dated today, so only the current month can take it.
  const canApply = month === today().slice(0, 7);
  const applicable = (partner: Partner) => canApply && status ? money(Math.min(outstanding[partner], contributionDue(status, partner))) : 0;
  const applyAdvance = async (partner: Partner) => {
    if (applying || saving) return;
    setApplying(partner); setSaveError(""); setSuccess("");
    try {
      applyIds.current[partner] ??= crypto.randomUUID();
      const response = await fetch("/api/contribution-offsets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ partner, amount: applicable(partner), date: today(), requestId: applyIds.current[partner] }) });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error ?? "Could not apply the advance.");
      delete applyIds.current[partner];
      setSuccess(`${person(partner)}'s advance applied`); onChanged();
    } catch (e) { setSaveError(e instanceof Error ? e.message : "Could not apply the advance. Retry to finish it safely."); }
    finally { setApplying(null); }
  };
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
  // The hero already shows the agreed amount, so the editor is only the action beside it.
  const agreementEditor = status ? <ContributionAgreementEditor showHeading={false} showAmounts={false} editing={editingAgreement} onEditingChange={setEditingAgreement} month={month} agreement={status.agreement}
    proposed={{ anas: Math.max(0, money(status.anasPlan - status.anasPersonalDebt)), salma: Math.max(0, money(status.salmaPlan - status.salmaPersonalDebt)) }}
    shares={status.agreement?.shares ?? { anas: .65, salma: .35 }} disabled={saving || !!repaying} onSaved={() => { setAgreedWink(Date.now()); onChanged(); }} /> : null;
  return <BottomSheet open={open} onClose={() => { if (!saving) onClose(); }} label="Monthly contributions" size="standard" detent="content">
    <div className="contribution-sheet sheet-body">
      <SheetHeader className="contribution-header"><h2>Contributions</h2>
        <button type="button" className="contribution-close" aria-label="Close contributions" disabled={saving} onClick={onClose}><XIcon size={20} /></button></SheetHeader>
      {/* The same month chip as the Budget screen: past months stay reviewable for advances and repayments. */}
      <div className="contribution-toolbar"><MonthPicker value={month} max={today().slice(0, 7)} onChange={event => event.target.value && onMonthChange(event.target.value)} aria-label="Contribution month" triggerClassName="composer-picker-chip" showChevron={false} /></div>
      {loading ? <SkeletonRows label="Loading contributions" count={4} /> : error || !status ? <Banner tone="danger" role="alert" title="Contributions unavailable" action={<button className="contribution-text" type="button" onClick={onRetry}>Retry</button>} /> : <>
        {(() => {
          // Both jars; the one in front is whose answers show (the partner tapped to get here, else you).
          const me = shown;
          const actual = me === "anas" ? status.anasActual : status.salmaActual;
          const directTotal = me === "anas" ? status.anasDirectSpend : status.salmaDirectSpend;
          const direct = Math.min(Math.max(0, directTotal), Math.max(0, actual));
          const target = status.agreement?.targets[me] ?? (me === "anas" ? status.anasPlan : status.salmaPlan);
          const left = Math.max(0, money(contributionDue(status, me)));
          const levelFor = (partner: Partner) => {
            const goal = status.agreement?.targets[partner] ?? (partner === "anas" ? status.anasPlan : status.salmaPlan);
            const due = Math.max(0, contributionDue(status, partner));
            return goal > 0 ? Math.min(1, Math.max(0, (goal - due) / goal)) : 1;
          };
          return <ContributionSummary key={`${month}-${me}`} partner={me} agreed={!!status.agreement} target={target}
            contributed={Math.max(0, actual)} sent={Math.max(0, money(actual - direct))} left={left} categories={status.directByCategory?.[me] ?? []}
            advance={outstanding[me]} applicable={applicable(me)} busy={saving || !!repaying || !!applying} applying={applying === me}
            onApply={() => void applyAdvance(me)} onRepay={() => startRepayment(me)} agreementAction={agreementEditor}
            onEditAgreement={() => setEditingAgreement(value => !value)} editingAgreement={editingAgreement}
            isMe={me === personalScope} month={month} winkId={agreedWink} levels={{ anas: levelFor("anas"), salma: levelFor("salma") }} onShow={partner => { setShown(partner); setEditingAgreement(false); }} />;
        })()}
        {ledger && ledger.unappliedRepayments.anas + ledger.unappliedRepayments.salma > 0 && <Banner tone="warning" role="alert">A corrected agreement or transaction left a repayment above the advance. Review repayment activity.</Banner>}
        {repaying && <section className="contribution-repay"><h3>Record repayment</h3><label>Repayment amount<input autoFocus className="field-input" inputMode="decimal" value={amount} disabled={saving || uncertain} onChange={e => { setAmount(e.target.value); requestId.current = crypto.randomUUID(); }} /></label>{uncertain || saving ? <span className="contribution-note">Repayment date: {date}</span> : <DatePicker value={date} max={today()} onChange={event => { setDate(event.target.value); requestId.current = crypto.randomUUID(); }} aria-label="Date money was returned" />}
          <div className="contribution-actions"><button type="button" className="contribution-primary" disabled={saving} onClick={() => void repay()}>{saving ? "Recording…" : uncertain ? "Check repayment" : "Save repayment"}</button><button type="button" className="contribution-text" disabled={saving} onClick={() => setRepaying(null)}>Cancel</button></div>
        </section>}
        {saveError && <Banner tone="danger" role="alert">{saveError}</Banner>}{success && <p role="status">{success}</p>}
      </>}
    </div>
  </BottomSheet>;
}

/**
 * What's left to cover up front, one sentence, then where the paid amount went: sent to Joined,
 * or Joint spending paid directly. Tap the agreed amount to change it.
 */
function ContributionSummary({ partner, target, agreed, contributed, sent, left, categories, advance, applicable, busy, applying, onApply, onRepay, agreementAction, onEditAgreement, editingAgreement, levels, onShow, isMe, month, winkId }: {
  month: string; winkId?: number;
  partner: Partner; target: number; agreed: boolean; contributed: number; sent: number; left: number; categories: DirectSpend[];
  advance: number; applicable: number; busy: boolean; applying: boolean; onApply: () => void; onRepay: () => void;
  /** The agreement editor, opened by tapping the agreed amount. */
  agreementAction?: ReactNode;
  onEditAgreement: () => void; editingAgreement: boolean;
  /** Each partner's jar level (share of their agreed amount in), and switching who's in front. */
  levels: { anas: number; salma: number }; onShow: (partner: Partner) => void;
  /** The signed-in person is in front: the sentence says "You". */
  isMe: boolean;
}) {
  const whole$ = (value: number) => fmt(Math.round(value));
  const level = target > 0 ? Math.min(1, Math.max(0, (target - left) / target)) : 1;
  // Covering an agreed amount bursts once per partner and month on this device.
  const burst = useOnceSignal(`contribution-covered:${month}:${partner}`, agreed && target > 0 && left < 0.5, "burst");
  return <>
    <section className="contribution-left" aria-label="Left to cover">
      {/* Both of you, cuddled up; the one whose figures show sits in front, the other steps back. Tap the back jar,
          or swipe the pair sideways, to switch: the jars follow the finger 1:1, resist past the edge, and spring back
          with the release speed; distance or a quick flick decides. Anas sits left, Salma right. */}
      <motion.div className="contribution-pair" drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.35} dragMomentum={false}
        dragTransition={{ bounceStiffness: 400, bounceDamping: 30 }}
        onDragEnd={(_, info) => {
          const swiped = info.offset.x < -48 || info.velocity.x < -450 ? "salma" : info.offset.x > 48 || info.velocity.x > 450 ? "anas" : null;
          if (swiped && swiped !== partner) onShow(swiped);
        }}>
      <MascotHero look="light" variant="pool" scope="joint" size={MASCOT_SIZE} spentPct={null} level={level} warn={null} levels={levels} front={partner} style={{ marginBottom: -8 }} winkId={winkId} once={burst}
        wrapJar={(jarPartner, jar) => <button type="button" className="contribution-jar" data-front={jarPartner === partner || undefined} aria-pressed={jarPartner === partner}
          aria-label={jarPartner === partner ? `Showing ${person(jarPartner)}` : `Show ${person(jarPartner)}`} onClick={() => jarPartner !== partner && onShow(jarPartner)}>{jar}</button>} />
      </motion.div>
      <span className="contribution-who">{person(partner)}</span>
      <span>Left to cover</span>
      {left >= 0.5
        ? <strong className="contribution-due"><Money value={Math.round(left)} currency /></strong>
        : <strong>All covered</strong>}
      <Summary className="contribution-summary">
        {isMe ? "You" : person(partner)} paid <Fact>{whole$(contributed)}</Fact> of{" "}
        <Fact onClick={onEditAgreement} label={agreed ? `Change agreed amounts, ${whole$(target)} MAD agreed` : `Set contributions, ${whole$(target)} MAD planned`}>{whole$(target)} {agreed ? "agreed" : "planned"}</Fact>.
      </Summary>
      <Reveal open={editingAgreement}>{agreementAction}</Reveal>
      {/* Advances change what's left, so their actions sit with it. */}
      {(advance > 0 || applicable > 0) && <div className="contribution-advance">
        {advance > 0 && <span>Advance {whole$(advance)}</span>}
        {applicable > 0 && <button className="contribution-primary" type="button" disabled={busy} aria-label={`Apply ${fmt(applicable)} MAD of ${person(partner)}'s advance to this month`} onClick={onApply}>{applying ? "Applying…" : <>Apply <Money value={applicable} /></>}</button>}
        {advance > 0 && <button className="contribution-text" type="button" disabled={busy} onClick={onRepay}>Record repayment</button>}
      </div>}
    </section>
    {contributed >= 0.5 && <section className="contribution-in" aria-label="Where your contribution went">
      <ul>
        {sent >= 0.5 && <li><span className="contribution-in-icon" aria-hidden="true"><TransferIcon size={14} /></span><span className="contribution-in-name">Sent to Joined</span><span>{whole$(sent)}</span></li>}
        {categories.length > 0 && <li className="contribution-in-group">Paid directly</li>}
        {categories.map(category => <li key={category.categoryId}><CategoryIcon icon={category.icon} categoryName={category.name} size={24} /><span className="contribution-in-name">{category.name}</span><span>{whole$(category.amount)}</span></li>)}
      </ul>
    </section>}
  </>;
}
