"use client";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Save } from "lucide-react";
import { XIcon } from "./ui/icons";
import { Money, Currency } from "./Money";
import { CategoryIcon } from "./ui/CategoryIcon";
import { Workspace } from "./ui/Workspace";
import { Button } from "./ui/Button";
import { ScreenChip } from "./ui/ScreenChip";
import { SheetHeader } from "./ui/SheetLayout";
import { SavingCover, guardClose, useBlockingSave } from "./ui/SavingCover";
import { GrainGlow } from "./grain/GrainGlow";
import { PALETTES } from "./grain/palettes";
import { planningMood } from "./light-mood";
import "./allocation-workspace.css";
import { AnimatedCounter } from "./ui/AnimatedCounter";
import { Banner } from "./ui/Banner";
import { EmptyState } from "./ui/EmptyState";
import { SteppedAmountSlider } from "./ui/SteppedAmountSlider";
import type { BudgetScope, MonthlyPlanningSnapshot, PlanningAllocationItem } from "./app-types";
import { MascotFrame } from "./mascot/MascotFrame";
import { MascotHero, type JarSignal } from "./mascot/MascotHero";
import { allocationJarItems } from "./mascot/budgetJar";
import { fmt } from "./app-utils";

export type BudgetGroupKey = "household" | "wife" | "husband" | "savings" | string;

export type AllocationGroup = {
  key: BudgetGroupKey;
  label: string;
  items: PlanningAllocationItem[];
  onChange: (items: PlanningAllocationItem[]) => void;
};

type AllocationFlowProps = {
  open: boolean;
  selectedMonth: string;
  onCancel: () => void;
  onComplete?: () => void;
  groups: AllocationGroup[];
  onSave?: (payload: { month: string; budgetItems: PlanningAllocationItem[]; savingsItems: PlanningAllocationItem[]; snapshot: MonthlyPlanningSnapshot }) => Promise<void>;
  // extension props (used by RebalanceSheet and other wrappers)
  /** The money being placed: category allocations plus unassigned money in this scope. */
  poolOverride: number;
  poolLabel?: string;
  saveButtonLabel?: string;
  readOnly?: boolean;
  readOnlyBanner?: ReactNode;
  flowPreview?: ReactNode;
  /** Hide the category pills, amount and slider (e.g. while Suggest moves is open): one way to move money at a time. */
  editorHidden?: boolean;
  title?: string;
  /** Replaces the balanced mark when the pool balances but the scope is still short outside it (savings, advances). */
  balancedNote?: ReactNode;
  metaLabel?: string;
  rebalanceMode?: boolean;
  /**
   * Show the scope's budget jar filling as money is assigned: one emoji per
   * category, sized by its share of the pool (unassigned money is empty space).
   */
  jarScope?: BudgetScope;
  /**
   * The scope's liquid level (0–1), as on Home and Budget. When set, the jar is the
   * liquid pool with the emojis dropped in; the level stays put while only the
   * emojis move with the allocation. Unset keeps the emoji-only jar.
   */
  jarLevel?: number;
  /** The jar shows what the screen is about: filled by the share of money assigned (full = nothing left
   *  unassigned), with no category emojis inside. Overrides `jarLevel`. */
  jarShowsAssigned?: boolean;
  /** A signal on the jar, e.g. thinking while Suggest moves works. */
  jarSignal?: JarSignal | null;
};

/** Matches the desktop breakpoint, for the parts that differ in structure (not just style). */
function useWide() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 900px)");
    const sync = () => setWide(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return wide;
}

export function AllocationFlow({
  open,
  selectedMonth,
  onCancel,
  onComplete,
  groups,
  onSave,
  poolOverride,
  poolLabel = "Available",
  saveButtonLabel = "Save",
  readOnly = false,
  readOnlyBanner,
  flowPreview,
  editorHidden = false,
  title = "Rebalance",
  balancedNote,
  metaLabel = "Last month",
  rebalanceMode = false,
  jarScope,
  jarLevel,
  jarShowsAssigned = false,
  jarSignal = null,
}: AllocationFlowProps) {
  const wide = useWide();
  const [rowDrafts, setRowDrafts] = useState<Record<string, string>>({});
  // Spent-floor per category, snapshotted on first activation.
  // Must NOT be recomputed from activeItem.amount after edits — that shifts the
  // range input's `min` mid-drag and causes a runaway feedback loop.
  const spentFloorRef = useRef<Record<string, number>>({});
  const [activeGroup, setActiveGroup] = useState<BudgetGroupKey>(groups[0]?.key ?? "household");
  const [activeCategoryId, setActiveCategoryId] = useState<string>(groups[0]?.items[0]?.categoryId ?? "");
  // Apply blocks the whole workspace until the writes settle (design.md, Saving).
  const blockingSave = useBlockingSave();
  const [saveError, setSaveError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [draftValue, setDraftValue] = useState<string | null>(null);
  // While the slider is held, numbers update plainly instead of rolling on every stop.
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    if (!dragging) return;
    const stop = () => setDragging(false);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => { window.removeEventListener("pointerup", stop); window.removeEventListener("pointercancel", stop); };
  }, [dragging]);
  // Reset active item only when the set of group keys changes (not on every amount update)
  const groupKeysSignal = useMemo(() => groups.map((g) => g.key).join(","), [groups]);
  useEffect(() => {
    setActiveGroup(groups[0]?.key ?? "household");
    setActiveCategoryId(groups[0]?.items[0]?.categoryId ?? "");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, groupKeysSignal]);

  // Reset interaction tracking when sheet closes; also clear floor snapshots
  // so they're re-computed fresh if the sheet re-opens with new data.
  useEffect(() => {
    if (!open) {
      setDraftValue(null);
      setConfirming(false);
      spentFloorRef.current = {};
    }
  }, [open]);

  // Discard any in-progress draft when the active category changes.
  useEffect(() => { setDraftValue(null); setConfirming(false); }, [activeCategoryId]);

  const availablePool = poolOverride;

  const active = groups.find((g) => g.key === activeGroup) ?? groups[0];
  const activeIndex = Math.max(0, active.items.findIndex((item) => item.categoryId === activeCategoryId));
  const activeItem = active.items[activeIndex] ?? active.items[0] ?? null;
  const allBudgetItems = useMemo(() => groups.reduce((acc, g) => acc.concat(g.items.filter((it) => g.key !== "savings")), [] as PlanningAllocationItem[]), [groups]);
  const savingsItems = useMemo(() => groups.find((g) => g.key === "savings")?.items ?? [], [groups]);
  const assignedBudget = useMemo(() => allBudgetItems.reduce((sum, item) => sum + item.amount, 0), [allBudgetItems]);
  const assignedSavings = useMemo(() => savingsItems.reduce((sum, item) => sum + item.amount, 0), [savingsItems]);
  const leftToAssign = availablePool - assignedBudget - assignedSavings;
  const snapshot: MonthlyPlanningSnapshot = { availablePool, assignedHousehold: assignedBudget, assignedSavings, leftToAssign };

  const totalCategories = allBudgetItems.length + savingsItems.length;
  const jarItems = useMemo(
    () => (jarScope ? allocationJarItems([...allBudgetItems, ...savingsItems], availablePool) : []),
    [jarScope, allBudgetItems, savingsItems, availablePool],
  );
  const isBalanced = availablePool > 0 && leftToAssign === 0;
  const isOver = availablePool > 0 && leftToAssign < 0;
  const canSave =
    totalCategories > 0 &&
    typeof onSave === "function" &&
    !readOnly;

  // Stable spent floor — snapshot on first access, never recompute from the
  // mutable activeItem.amount. Without this, dragging the slider increases
  // `amount`, which increases `rangeMin`, which shifts the native input's `min`
  // mid-drag, triggering another onChange → runaway feedback loop.
  const getSpentFloor = (item: PlanningAllocationItem): number => {
    if (spentFloorRef.current[item.categoryId] === undefined) {
      spentFloorRef.current[item.categoryId] = Math.max(
        0,
        item.amount - (item.available ?? item.amount),
      );
    }
    return spentFloorRef.current[item.categoryId];
  };

  // Range math
  const rangeMin = activeItem ? getSpentFloor(activeItem) : 0;
  const rangeMax = activeItem ? Math.max(rangeMin, activeItem.amount + Math.max(0, leftToAssign)) : 0;
  const updateItemAmount = (target: PlanningAllocationItem, nextAmount: number) => {
    if (readOnly) return;
    setConfirming(false);
    const minAmount = getSpentFloor(target);
    const maxAmount = Math.max(minAmount, target.amount + Math.max(0, leftToAssign));
    const clampedAmount = Math.min(maxAmount, Math.max(minAmount, Math.round(nextAmount)));
    active.onChange(active.items.map((item) => (item.categoryId === target.categoryId ? { ...item, amount: clampedAmount } : item)));
  };
  const updateActiveAmount = (nextAmount: number) => { if (activeItem) updateItemAmount(activeItem, nextAmount); };
  // The workspace's light is the mood of To assign, as on Budget: bright when all is placed, dim with money waiting, coral when over.
  // While the slider is held the light and the face hold still, then settle once on release: following
  // every step made the lights flicker for no reason (the money is still moving).
  const liveMood = availablePool > 0 ? planningMood(assignedBudget + assignedSavings, leftToAssign) : null;
  const settled = useRef({ mood: liveMood, left: leftToAssign });
  if (!dragging) settled.current = { mood: liveMood, left: leftToAssign };
  const mood = settled.current.mood;
  const faceLeft = settled.current.left;

  // Close, Cancel, Escape and the backdrop do nothing while Apply's writes run.
  const close = guardClose(blockingSave.saving, onCancel);

  const savePlan = async () => {
    if (!canSave || !onSave) return;
    setSaveError("");
    try {
      await blockingSave.run(() => onSave({ month: selectedMonth, budgetItems: allBudgetItems, savingsItems, snapshot }));
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : "Could not save plan");
      return;
    }
    onComplete?.();
    onCancel();
  };

  const headerEl = (
        <SheetHeader style={sheetHeaderStyle}>
          <h2 style={sheetTitleStyle}>{title}</h2>
          <button type="button" className="sheet-close-button" onClick={close} aria-label={`Close ${title.toLowerCase()}`} style={closeButtonPlacementStyle}>
            <XIcon size={20} />
          </button>
        </SheetHeader>
  );
  const balanceEl = (
        <section className="planning-balance" aria-label="Planning balance" style={{ ...balanceHeaderStyle, position: "relative", overflow: "visible" }}>
          {/* The jar fills as money is assigned: full when balanced, worried when over. */}
          {jarScope && (jarItems.length > 0 || jarShowsAssigned) && (() => {
            // Same face vocabulary as every other jar: content ("happy", like a funded Joint)
            // when balanced, not the oversized "excited" eyes nothing else uses.
            const jarMood = availablePool > 0 && faceLeft < 0 ? "worried" : availablePool > 0 && faceLeft === 0 ? "happy" : faceLeft > 0.5 ? "curious" : "idle";
            const jarStyle = { marginBottom: -8 };
            // While editing, a smaller jar keeps the active amount and slider in view on a phone.
            const jarSize = !readOnly ? 176 : undefined;
            if (jarShowsAssigned) {
              const assignedShare = availablePool > 0 ? Math.max(0, Math.min(1, (availablePool - Math.max(0, leftToAssign)) / availablePool)) : 1;
              return <MascotFrame><MascotHero look="light" variant="pool" scope={jarScope} level={mood?.level ?? assignedShare} warn={mood?.warn ?? null} spentPct={null} mood={jarMood} size={jarSize} style={jarStyle} signal={jarSignal} /></MascotFrame>;
            }
            return jarLevel !== undefined ? (
              <MascotFrame><MascotHero look="light" variant="pool" scope={jarScope} level={jarLevel} items={jarItems} spentPct={null} mood={jarMood} size={jarSize} style={jarStyle} signal={jarSignal} /></MascotFrame>
            ) : (
              <MascotFrame><MascotHero look="light" variant="split" scope={jarScope} items={jarItems} spentPct={null} remember={false} mood={jarMood} size={jarSize} style={jarStyle} signal={jarSignal} /></MascotFrame>
            );
          })()}
          {readOnly ? (
            // A closed or future month has nothing to assign: the hero is the pool itself.
            <div style={heroPoolWrapStyle}>
              <span style={{ ...heroPoolLabelStyle, ...onRoomLabelStyle }}>{poolLabel}</span>
              <span style={heroPoolNumberStyle}>
                <Money value={availablePool} currency animated />
              </span>
            </div>
          ) : (
            // The hero is what is left to place; the pool it comes from is a quiet line under it.
            <div style={heroPoolWrapStyle}>
              <span style={{ ...heroPoolLabelStyle, ...onRoomLabelStyle }}>{isOver ? "Over-assigned" : "Unassigned"}</span>
              <span style={{ ...heroPoolNumberStyle, color: isOver ? "var(--danger)" : heroPoolNumberStyle.color }}>
                {isBalanced ? <span style={allAssignedStyle}>All assigned</span> : <>{isOver && "−"}<Money value={Math.abs(Math.round(leftToAssign))} currency animated={!dragging} /></>}
              </span>
              {/* "Unassigned 0" already says it's balanced; only a caller's own note adds anything. */}
              {isBalanced && balancedNote && <div style={heroPoolMetaStyle}>{balancedNote}</div>}
            </div>
          )}
        </section>
  );
  const editorEls = (<>
        {!editorHidden && <section className="planning-studio" aria-label="Budget allocation" style={studioStyle}>
          <div className="planning-scroll-rail planning-category-rail" role="tablist" style={categoryRailStyle} aria-label={`${active.label} categories`}>
            {active.items.map((item) => {
              const isActive = item.categoryId === activeItem?.categoryId;
              // Rebalancing: each category's live available, so you can see where money is without tapping.
              // The active one is already the big number below.
              const showAmount = rebalanceMode && !isActive && Math.round(item.amount) !== 0;
              return (
                <ScreenChip
                  key={item.categoryId}
                  mode="tab"
                  selected={isActive}
                  onClick={() => setActiveCategoryId(item.categoryId)}
                  icon={<CategoryIcon icon={item.icon} categoryName={item.name} size={16} />}
                  badge={showAmount ? (item.amount < 0 ? <span style={negativeBadgeStyle}>{fmt(Math.round(item.amount))}</span> : fmt(Math.round(item.amount))) : undefined}
                  badgeTone="metric"
                  ariaLabel={showAmount ? `${item.name}, ${fmt(Math.round(item.amount))} MAD available` : item.name}
                  style={categoryChipLayoutStyle}
                >
                  {item.name}
                </ScreenChip>
              );
            })}
          </div>

          {!activeItem && <EmptyState minHeight={220}>No {active.label} categories.</EmptyState>}
        </section>}

        {activeItem && !editorHidden && (
          <div className="planning-editor" style={editorStyle}>
            <div key={activeItem.categoryId} className="planning-category-enter planning-amount-canvas" style={amountCanvasStyle}>
              <label style={amountEditorStyle}>
                <span style={srOnlyStyle}>Planned amount for {activeItem.name}</span>
                {/* The currency follows the number on its baseline (design.md, Typography). */}
                {draftValue === null && <span aria-hidden="true" style={amountCounterRowStyle}>
                  <span style={amountCounterLineStyle}>
                    {dragging
                      ? <span style={{ ...amountCounterStyle, fontVariantNumeric: "tabular-nums", color: isOver ? "var(--danger)" : "var(--text2)" }}>{formatCounter(activeItem.amount)}</span>
                      : <AnimatedCounter value={activeItem.amount} separator="." style={{ ...amountCounterStyle, color: isOver ? "var(--danger)" : "var(--text2)" }} />}
                    <Currency />
                  </span>
                </span>}
                <input
                  className="planning-amount-input"
                  type="text"
                  readOnly={readOnly}
                  value={draftValue ?? String(activeItem.amount)}
                  onFocus={() => setDraftValue(String(activeItem.amount))}
                  onChange={(event) => setDraftValue(event.target.value)}
                  onBlur={() => {
                    if (draftValue !== null) {
                      updateActiveAmount(parseFloat(draftValue.replace(/[^0-9.]/g, "")) || 0);
                      setDraftValue(null);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      updateActiveAmount(parseFloat((draftValue ?? "").replace(/[^0-9.]/g, "")) || 0);
                      setDraftValue(null);
                      event.currentTarget.blur();
                    } else if (event.key === "Escape") {
                      // Escape cancels the draft only; the workspace stays open.
                      event.preventDefault();
                      setDraftValue(null);
                      event.currentTarget.blur();
                    }
                  }}
                  aria-label={`Planned amount for ${activeItem.name}`}
                  style={{ ...amountInputBigStyle(isOver), ...(draftValue === null ? hiddenAmountInputStyle : null), ...(readOnly ? { opacity: 0.7 } : null) }}
                />
              </label>
              <div style={metaRowStyle}>
                <span>{metaLabel} <Money value={activeItem.lastMonthSpent ?? 0} /></span>
                <span>Spent <Money value={activeItem.spent ?? getSpentFloor(activeItem)} /></span>
              </div>
            </div>
          </div>
        )}
  </>);
  const footerEl = (<>
      {activeItem && !readOnly && !editorHidden && (
        <div className="sheet-footer sheet-inset" aria-label="Budget control" style={slimBarPanelStyle}>
          <div onPointerDownCapture={() => setDragging(true)}>
            <SteppedAmountSlider min={rangeMin} max={rangeMax} value={activeItem.amount} onChange={updateActiveAmount} label={`Adjust planned amount for ${activeItem.name}`} />
          </div>
          {saveError && <Banner role="alert" tone="danger" compact>{saveError}</Banner>}
          {confirming && (
            <Banner
              tone="neutral"
              role="status"
              compact
              title="Apply this rebalance?"
              action={<Button variant="secondary" size="compact" onClick={() => setConfirming(false)}>Back</Button>}
            >
              {isBalanced ? "All available money stays assigned." : <><Money value={Math.abs(Math.round(leftToAssign))} currency /> will remain unassigned.</>}
            </Banner>
          )}
          <Button variant="primary" block className="ws-apply" icon={<Save />} onClick={() => confirming ? savePlan() : setConfirming(true)} disabled={!canSave}>
            {confirming ? "Confirm" : saveButtonLabel}
          </Button>
        </div>
      )}
  </>);

  // Rebalance is a big operation: a full-screen workspace, not a sheet (design.md, Light).
  // Desktop: every category of the group as a row with its amount typed inline (faster than a slider with a mouse).
  const commitRow = (item: PlanningAllocationItem) => {
    const draft = rowDrafts[item.categoryId];
    if (draft === undefined) return;
    updateItemAmount(item, parseFloat(draft.replace(/[^0-9.]/g, "")) || 0);
    setRowDrafts(drafts => { const next = { ...drafts }; delete next[item.categoryId]; return next; });
  };
  const rowsEl = !editorHidden && (
    <section className="ws-rows" aria-label={`${active.label} categories`}>
      {active.items.map(item => {
        const isActive = item.categoryId === activeItem?.categoryId;
        return <div key={item.categoryId} className="ws-row" data-active={isActive || undefined} onClick={() => setActiveCategoryId(item.categoryId)}>
          <CategoryIcon icon={item.icon} categoryName={item.name} size={24} />
          <span className="ws-row-name">{item.name}</span>
          <span className="ws-row-meta">{metaLabel} <Money value={item.lastMonthSpent ?? 0} /></span>
          <input
            className="field-input ws-row-input"
            type="text"
            inputMode="decimal"
            readOnly={readOnly}
            aria-label={`Planned amount for ${item.name}`}
            value={rowDrafts[item.categoryId] ?? fmt(Math.round(item.amount))}
            onFocus={event => { const input = event.target; setActiveCategoryId(item.categoryId); setRowDrafts(drafts => ({ ...drafts, [item.categoryId]: String(Math.round(item.amount)) })); requestAnimationFrame(() => input.select()); }}
            onChange={event => { const value = event.target.value; setRowDrafts(drafts => ({ ...drafts, [item.categoryId]: value })); }}
            onBlur={() => commitRow(item)}
            onKeyDown={event => {
              if (event.key === "Enter") { commitRow(item); event.currentTarget.blur(); }
              else if (event.key === "Escape") { event.preventDefault(); setRowDrafts(drafts => { const next = { ...drafts }; delete next[item.categoryId]; return next; }); event.currentTarget.blur(); }
            }}
          />
        </div>;
      })}
      {active.items.length === 0 && <EmptyState minHeight={220}>No {active.label} categories.</EmptyState>}
      {/* The slider belongs to the selected row, so it sits under the list, not in the footer. */}
      {activeItem && !readOnly && <div className="ws-row-slider" onPointerDownCapture={() => setDragging(true)}>
        <span className="ws-row-slider-label">Adjust {activeItem.name}</span>
        <SteppedAmountSlider min={rangeMin} max={rangeMax} value={activeItem.amount} onChange={updateActiveAmount} label={`Adjust planned amount for ${activeItem.name}`} />
      </div>}
    </section>
  );
  return (
    <Workspace open={open} onClose={close} label={title}>
      <div className="ws-alloc" data-wide={wide || undefined}>
        <section className="ws-room grain-stage" aria-label="Planning balance">
          {jarScope && <GrainGlow direction="room" scope={jarScope} level={mood?.level ?? 0.7} tones={PALETTES.partner} contained />}
          {headerEl}
          <div className="ws-balance">{balanceEl}</div>
        </section>
        <div className="ws-main">
      {readOnlyBanner}
      {flowPreview}
          {wide ? rowsEl : editorEls}
        </div>
        <div className="ws-footer">
          {wide && <Button variant="secondary" className="ws-cancel" onClick={close}>Cancel</Button>}
          {footerEl}
        </div>
      </div>
      {/* Fills the screen so the whole app, workspace included, is inert until Apply settles. */}
      <SavingCover saving={blockingSave.saving} fill="screen" scope={jarScope} />
    </Workspace>
  );
}



/** Same digits as AnimatedCounter, without the rolling wheels. */
function formatCounter(value: number): string {
  const rounded = Math.round(Number.isFinite(value) ? value : 0);
  const magnitude = String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return rounded < 0 ? `−${magnitude}` : magnitude;
}

const sheetHeaderStyle: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "center", rowGap: 12, columnGap: 12, padding: "var(--dialog-body-padding, 16px)" };
/** Title role (design.md, Shared dialog anatomy): 20/28 semibold in --text. */
const sheetTitleStyle: CSSProperties = { margin: 0, fontSize: 20, lineHeight: "28px", fontWeight: 600, color: "var(--text)" };
const closeButtonPlacementStyle: CSSProperties = { justifySelf: "end" };
const balanceHeaderStyle: CSSProperties = { display: "grid", gap: 4 };
const studioStyle: CSSProperties = { display: "grid", gap: 8 };
const categoryRailStyle: CSSProperties = { display: "flex", gap: 8, overflowX: "auto", padding: "0 4px 4px", alignItems: "center" };
const categoryChipLayoutStyle: CSSProperties = { maxWidth: 196 };
const negativeBadgeStyle: CSSProperties = { color: "var(--danger)" };
const editorStyle: CSSProperties = { display: "grid" };
const amountCanvasStyle: CSSProperties = { position: "relative", display: "grid", alignContent: "center", gridTemplateRows: "minmax(68px, auto) auto", gap: 8, minHeight: 132, padding: "16px 12px 12px", borderRadius: 0, background: "var(--surface)", borderBottom: "1px solid color-mix(in srgb, var(--border) 14%, transparent)", overflow: "hidden" };
const amountEditorStyle: CSSProperties = { position: "relative", display: "flex", justifyContent: "center", alignItems: "center", minWidth: 0, minHeight: 68 };
const amountCounterRowStyle: CSSProperties = { position: "absolute", inset: 0, display: "flex", justifyContent: "center", alignItems: "center", pointerEvents: "none", zIndex: 3 };
const amountCounterLineStyle: CSSProperties = { display: "inline-flex", alignItems: "baseline", gap: 4 };
const amountCounterStyle: CSSProperties = { fontFamily: "var(--font-body)", fontSize: "clamp(3rem, 16vw, 4.2rem)", lineHeight: 0.92, fontWeight: 500, letterSpacing: "-0.022em" };
const hiddenAmountInputStyle: CSSProperties = { color: "transparent", caretColor: "transparent" };
const srOnlyStyle: CSSProperties = { position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0, 0, 0, 0)", whiteSpace: "nowrap", border: 0 };
const amountInputBigStyle = (isOver: boolean): CSSProperties => ({ width: "100%", minWidth: 0, maxWidth: "100vw", border: "none", background: "transparent", color: isOver ? "var(--danger)" : "var(--text2)", textAlign: "center", fontFamily: "var(--font-body)", fontSize: "clamp(3rem, 16vw, 4.2rem)", lineHeight: 0.92, fontWeight: 500, letterSpacing: "-0.022em", outline: "none", fontVariantNumeric: "tabular-nums", fontFeatureSettings: '"tnum"', zIndex: 2, padding: 0, margin: 0, backgroundClip: "text", transition: "color var(--motion-standard) var(--ease-standard)" });
/** Supporting figures under the amount: --muted keeps AA, no faded --text2. */
const metaRowStyle: CSSProperties = { display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 12, color: "var(--muted)", fontSize: 12, lineHeight: "16px", fontFamily: "var(--font-body)" };
const slimBarPanelStyle: CSSProperties = { display: "flex", flex: "0 0 auto", minHeight: 0, flexDirection: "column", gap: 12, padding: `16px 16px calc(16px + env(safe-area-inset-bottom, 0px))`, background: "var(--surface)", boxShadow: "none" };

// Hero: the shared screen hero geometry (ui/screen-hero.css), so Rebalance matches Home, Budget and Reflect.
const heroPoolWrapStyle: CSSProperties = {
  display: "grid",
  gap: 0,
  textAlign: "center",
  padding: "12px 0 16px",
};
const heroPoolLabelStyle: CSSProperties = {
  fontSize: 13,
  lineHeight: "20px",
  fontWeight: 600,
  color: "var(--muted)",
};
/** A finished state in words, never a light next to a bare 0 (design.md, Light). */
const allAssignedStyle: CSSProperties = { display: "block", fontSize: "0.5em", lineHeight: 1.8 };
/** Labels sitting on the room: --text2 keeps AA on the tint (muted falls under it). */
const onRoomLabelStyle: CSSProperties = { color: "var(--text2)" };
const heroPoolMetaStyle: CSSProperties = { display: "grid", justifyItems: "center", gap: 4, marginTop: 8 };
const heroPoolNumberStyle: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "clamp(44px, 14vw, 72px)",
  fontWeight: 400,
  lineHeight: 0.9,
  letterSpacing: "-0.022em",
  color: "var(--text2)",
  fontVariantNumeric: "tabular-nums",
  fontFeatureSettings: '"tnum"',
};
