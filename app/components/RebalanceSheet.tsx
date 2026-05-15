"use client";

import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import type { Category, MonthlySummary } from "./app-types";
import { today } from "./app-utils";
import { BottomSheet } from "./ui/BottomSheet";
import { Money } from "./Money";
import { CategoryIcon } from "./ui/CategoryIcon";
import { CheckIcon, XIcon } from "./ui/icons";

type RebalanceSheetProps = {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  onSuccess: () => void;
  homeMonth: string;         // "YYYY-MM"
  monthlySummary: MonthlySummary;
};

type MonthContext = "past" | "current" | "future";

function getMonthContext(homeMonth: string): MonthContext {
  const current = new Date().toISOString().slice(0, 7);
  if (homeMonth < current) return "past";
  if (homeMonth > current) return "future";
  return "current";
}

const MONTH_LABELS: Record<string, string> = {
  "01": "January", "02": "February", "03": "March", "04": "April",
  "05": "May", "06": "June", "07": "July", "08": "August",
  "09": "September", "10": "October", "11": "November", "12": "December",
};

function formatMonth(ym: string) {
  const [year, month] = ym.split("-");
  return `${MONTH_LABELS[month] ?? month} ${year}`;
}

type Transfer = { fromId: string; toId: string; amount: number };
type GroupFilter = "all" | "joint" | "wife" | "husband" | "savings";

const SAVINGS_HINTS = ["saving", "savings", "sinking", "goal", "fund"];

function isJointCategory(cat: Category): boolean {
  if (cat.isTeamFund) return true;
  return cat.type.some((t) => {
    const n = t.toLowerCase();
    return n.includes("team") || n.includes("household");
  });
}

function getCategoryGroup(cat: Category): Exclude<GroupFilter, "all"> {
  if (isJointCategory(cat)) return "joint";
  if (cat.type.some((t) => SAVINGS_HINTS.some((h) => t.toLowerCase().includes(h)))) {
    return "savings";
  }
  if (cat.owner?.toLowerCase().includes("salma")) return "wife";
  if (cat.owner?.toLowerCase().includes("anas")) return "husband";
  return "joint";
}

/** Greedy pairing of sources (reduced) → destinations (increased). */
function computeTransfers(
  funded: { id: string; original: number }[],
  allocations: Record<string, number>,
): Transfer[] {
  const sources: { id: string; rem: number }[] = [];
  const dests: { id: string; rem: number }[] = [];

  for (const { id, original } of funded) {
    const current = allocations[id] ?? original;
    const delta = current - original;
    if (delta < -0.5) sources.push({ id, rem: Math.round(-delta) });
    if (delta > 0.5) dests.push({ id, rem: Math.round(delta) });
  }

  const transfers: Transfer[] = [];
  let si = 0;
  let di = 0;

  while (si < sources.length && di < dests.length) {
    const take = Math.min(sources[si].rem, dests[di].rem);
    if (take >= 1) {
      transfers.push({ fromId: sources[si].id, toId: dests[di].id, amount: take });
    }
    sources[si].rem -= take;
    dests[di].rem -= take;
    if (sources[si].rem < 1) si++;
    if (dests[di].rem < 1) di++;
  }

  return transfers;
}

/** Burst particles fired when the pool first reaches perfect balance. */
type BurstStyleVars = CSSProperties & { "--x": string; "--y": string; "--d": string };

function BalancedBurst() {
  const PARTICLES: { x: number; y: number; d: number; size: number }[] = [
    { x: 0,   y: -36, d: 0,  size: 10 },
    { x: 28,  y: -24, d: 55, size: 8  },
    { x: 36,  y:   4, d: 25, size: 10 },
    { x: 20,  y:  30, d: 75, size: 7  },
    { x: -28, y: -24, d: 15, size: 8  },
    { x: -36, y:   4, d: 60, size: 10 },
    { x: -16, y:  32, d: 40, size: 7  },
    { x: 10,  y: -44, d: 35, size: 6  },
  ];
  return (
    <>
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className="save-burst"
          style={{
            "--x": `${p.x}px`,
            "--y": `${p.y}px`,
            "--d": `${p.d}ms`,
            color: "var(--accent)",
            fontSize: p.size,
          } as BurstStyleVars}
        >
          ✦
        </span>
      ))}
    </>
  );
}

// ── Group filter picker (portal dropdown, mirrors GroupPicker from MonthlyPlanningFlow) ──
function GroupFilterPicker({
  groupTabs,
  groupFilter,
  onSelect,
}: {
  groupTabs: Array<{ key: string; label: string; count: number }>;
  groupFilter: GroupFilter;
  onSelect: (key: GroupFilter) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const active = groupTabs.find((t) => t.key === groupFilter) ?? groupTabs[0];

  useEffect(() => { setMounted(true); }, []);

  const handleToggle = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    }
    setOpen((o) => !o);
  };

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (menuRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const menu = (
    <div
      ref={menuRef}
      role="listbox"
      aria-label="Filter by group"
      className="view-picker__menu"
      style={{ ...gfMenuStyle, position: "fixed", top: menuPos.top, right: menuPos.right, left: "auto" }}
    >
      {groupTabs.map((tab) => {
        const isActive = tab.key === groupFilter;
        return (
          <button
            key={tab.key}
            type="button"
            role="option"
            aria-selected={isActive}
            className={`view-picker__option${isActive ? " view-picker__option--active" : ""}`}
            onClick={() => { onSelect(tab.key as GroupFilter); setOpen(false); }}
            style={{ ...gfOptionStyle, ...(isActive ? gfOptionActiveStyle : null) }}
          >
            <span style={{ ...gfDotStyle, background: gfDotColor(tab.key) }} />
            <span style={gfOptionTextStyle}>{tab.label}</span>
            <span style={gfCountStyle}>{tab.count}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="view-picker" style={gfWrapStyle}>
      <button
        ref={triggerRef}
        type="button"
        className="view-picker__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Filter by group"
        onClick={handleToggle}
        style={gfTriggerStyle}
      >
        <span style={gfLabelStyle}>{active?.label ?? "All"}</span>
        <ChevronDown
          size={12}
          aria-hidden="true"
          style={{ ...gfChevronStyle, transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>
      {mounted && open && createPortal(menu, document.body)}
    </div>
  );
}

const gfDotColor = (key: string): string => {
  if (key === "wife") return "var(--partner-wife-strong)";
  if (key === "husband") return "var(--partner-husband-strong)";
  if (key === "savings") return "var(--warning)";
  return "var(--text2)";
};

// ── Main component ────────────────────────────────────────────────────────────
export function RebalanceSheet({ open, onClose, categories, onSuccess, homeMonth, monthlySummary }: RebalanceSheetProps) {
  const monthCtx = useMemo(() => getMonthContext(homeMonth), [homeMonth]);
  const isReadOnly = monthCtx !== "current";

  const plannedByCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of monthlySummary.assignedByCategory ?? []) m.set(e.categoryId, e.total);
    return m;
  }, [monthlySummary]);

  const spentByCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of monthlySummary.spentByCategory ?? []) m.set(e.categoryId, e.total);
    return m;
  }, [monthlySummary]);

  const getAvailable = (c: Category): number => {
    if (monthCtx === "current") return Math.round(c.available ?? 0);
    if (monthCtx === "past") {
      const planned = plannedByCategory.get(c.id) ?? 0;
      const spent = spentByCategory.get(c.id) ?? 0;
      return Math.max(0, Math.round(planned - spent));
    }
    return Math.max(0, Math.round(plannedByCategory.get(c.id) ?? c.planned ?? 0));
  };

  const funded = useMemo(
    () =>
      categories
        .filter((c) => getAvailable(c) > 0)
        .map((c) => ({ id: c.id, original: getAvailable(c) }))
        .sort((a, b) => b.original - a.original),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categories, monthCtx, plannedByCategory, spentByCategory],
  );

  const catById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [inputRaw, setInputRaw] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [groupFilter, setGroupFilter] = useState<GroupFilter>("all");

  useEffect(() => {
    if (!open) return;
    const initial = Object.fromEntries(funded.map((f) => [f.id, f.original]));
    setAllocations(initial);
    setInputRaw(Object.fromEntries(funded.map((f) => [f.id, String(f.original)])));
    setStatus("idle");
    setErrorMsg("");
    setGroupFilter("all");
  }, [open, funded]);

  const hasChanges = funded.some((f) => (allocations[f.id] ?? f.original) !== f.original);

  const groupCounts = useMemo(() => {
    const counts: Record<Exclude<GroupFilter, "all">, number> = {
      joint: 0, wife: 0, husband: 0, savings: 0,
    };
    for (const f of funded) {
      const cat = catById.get(f.id);
      if (cat) counts[getCategoryGroup(cat)]++;
    }
    return counts;
  }, [funded, catById]);

  const groupTabs = useMemo(
    () => [
      { key: "all", label: "All", count: funded.length },
      ...(groupCounts.joint > 0 ? [{ key: "joint", label: "Joint", count: groupCounts.joint }] : []),
      ...(groupCounts.wife > 0 ? [{ key: "wife", label: "Salma", count: groupCounts.wife }] : []),
      ...(groupCounts.husband > 0 ? [{ key: "husband", label: "Anas", count: groupCounts.husband }] : []),
      ...(groupCounts.savings > 0 ? [{ key: "savings", label: "Savings", count: groupCounts.savings }] : []),
    ],
    [funded.length, groupCounts],
  );

  const visibleFunded = useMemo(() => {
    if (groupFilter === "all") return funded;
    return funded.filter((f) => {
      const cat = catById.get(f.id);
      return cat && getCategoryGroup(cat) === groupFilter;
    });
  }, [funded, catById, groupFilter]);

  const groupIds = useMemo(() => new Set(visibleFunded.map((f) => f.id)), [visibleFunded]);

  const groupPool = useMemo(
    () =>
      funded
        .filter((f) => groupFilter === "all" || groupIds.has(f.id))
        .reduce((s, f) => s + f.original, 0),
    [funded, groupFilter, groupIds],
  );

  const groupAllocated = useMemo(
    () =>
      funded
        .filter((f) => groupFilter === "all" || groupIds.has(f.id))
        .reduce((s, f) => s + (allocations[f.id] ?? f.original), 0),
    [funded, groupFilter, groupIds, allocations],
  );

  const groupFree = groupPool - groupAllocated;
  const isGroupBalanced = Math.abs(groupFree) < 0.5;
  const isGroupOver = groupFree < -0.5;
  const poolPct = groupPool > 0 ? Math.min(groupAllocated / groupPool, 1) : 0;

  const canSave = hasChanges && isGroupBalanced && status === "idle";

  const wasBalancedRef = useRef(false);
  const [burstKey, setBurstKey] = useState(0);
  useEffect(() => {
    const nowBalanced = isGroupBalanced && hasChanges;
    if (nowBalanced && !wasBalancedRef.current) setBurstKey((k) => k + 1);
    wasBalancedRef.current = nowBalanced;
  }, [isGroupBalanced, hasChanges]);

  const commit = (id: string, raw: number) => {
    const clamped = Math.max(0, Math.min(Math.round(raw), groupPool));
    setAllocations((p) => ({ ...p, [id]: clamped }));
    setInputRaw((p) => ({ ...p, [id]: String(clamped) }));
  };

  const handleSlider = (id: string, raw: number) => commit(id, raw);

  const handleInputChange = (id: string, text: string) => {
    setInputRaw((p) => ({ ...p, [id]: text }));
    const parsed = parseFloat(text);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      setAllocations((p) => ({ ...p, [id]: Math.min(Math.round(parsed), groupPool) }));
    }
  };

  const handleInputBlur = (id: string) => {
    setInputRaw((p) => ({ ...p, [id]: String(allocations[id] ?? 0) }));
  };

  const save = async () => {
    if (!canSave) return;
    setStatus("saving");
    setErrorMsg("");
    const transfers = computeTransfers(funded, allocations);
    try {
      await Promise.all(
        transfers.map((t) =>
          fetch("/api/transfer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fromCategoryId: t.fromId,
              toCategoryId: t.toId,
              amount: t.amount,
              date: today(),
              note: "Budget rebalance",
            }),
          }).then(async (r) => {
            if (!r.ok) {
              const d = await r.json();
              throw new Error(d.error ?? "Transfer failed");
            }
          }),
        ),
      );
      setStatus("success");
      onSuccess();
      setTimeout(() => {
        onClose();
        setStatus("idle");
      }, 1200);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to save");
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  };

  const saveLabel = (() => {
    if (status === "saving" || status === "success") return null;
    if (!hasChanges) return "No changes";
    if (isGroupBalanced) return "Apply · balanced";
    if (groupFree > 0) return `Apply · ${Math.round(groupFree)} unassigned`;
    return "Apply changes";
  })();

  const poolContextLabel =
    monthCtx === "past" ? "Leftover" : monthCtx === "future" ? "Planned" : "Available pool";

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      showHandle
      label="Rebalance categories"
      detent="content"
      maxHeight="calc(100dvh - max(env(safe-area-inset-top, 0px), 20px))"
      maxWidth="520px"
      panelStyle={panelStyle}
      contentStyle={contentStyle}
      zIndex={80}
    >
      {/* ── Header ── */}
      <header style={headerStyle}>
        <h2 style={titleStyle}>Rebalance</h2>
        <button onClick={onClose} aria-label="Close" style={closeButtonStyle}>
          <XIcon size={14} />
        </button>
        <span style={monthLabelStyle}>{formatMonth(homeMonth)}</span>
        {groupTabs.length > 2 && (
          <GroupFilterPicker
            groupTabs={groupTabs}
            groupFilter={groupFilter}
            onSelect={(key) => setGroupFilter(key as GroupFilter)}
          />
        )}
      </header>

      {/* ── Scrollable content ── */}
      <div style={scrollStyle}>

        {/* Pool balance */}
        <section aria-label="Pool balance" style={balanceSectionStyle}>
          <div style={poolRowStyle}>
            <span style={poolLabelStyle}>{poolContextLabel}</span>
            <span style={poolValueStyle}><Money value={groupPool} /></span>
          </div>
          <div style={poolStatusStyle(isGroupOver, isGroupBalanced && hasChanges)}>
            <span>
              {isGroupOver
                ? "Over assigned"
                : isGroupBalanced && hasChanges
                ? "Balanced · ready to apply"
                : isGroupBalanced
                ? "Drag sliders to rebalance"
                : "Left to assign"}
            </span>
            {!isGroupBalanced && (
              <>
                <span>·</span>
                <strong style={{ fontVariantNumeric: "tabular-nums" }}>
                  <Money value={Math.abs(Math.round(groupFree))} />
                </strong>
              </>
            )}
          </div>
          <div style={{ ...poolBarTrackStyle, position: "relative", overflow: "visible" }}>
            <div
              style={{
                ...poolBarFillStyle,
                width: `${poolPct * 100}%`,
                background: isGroupOver
                  ? "var(--danger)"
                  : isGroupBalanced && hasChanges
                  ? "var(--success)"
                  : "var(--accent)",
              }}
            />
            {burstKey > 0 && <BalancedBurst key={burstKey} />}
          </div>
        </section>

        {/* Month context banner (past / future only) */}
        {isReadOnly && (
          <div style={{
            ...contextBannerStyle,
            background: monthCtx === "past"
              ? "color-mix(in srgb, var(--surface2) 55%, white)"
              : "color-mix(in srgb, var(--info-dim) 60%, white)",
            borderColor: monthCtx === "past"
              ? "color-mix(in srgb, var(--border2) 35%, transparent)"
              : "color-mix(in srgb, var(--info) 22%, transparent)",
          }}>
            <span style={contextBannerDotStyle} />
            <span style={contextBannerTextStyle}>
              {monthCtx === "past"
                ? `${formatMonth(homeMonth)} is closed — showing final balances`
                : `Rebalancing opens when ${formatMonth(homeMonth)} begins`}
            </span>
          </div>
        )}

        {/* Category sliders */}
        <section key={groupFilter}>
          {visibleFunded.length === 0 && (
            <p style={emptyStateStyle}>No funded categories in this group.</p>
          )}

          {visibleFunded.map((f, i) => {
            const cat = catById.get(f.id);
            if (!cat) return null;

            const alloc = allocations[f.id] ?? f.original;
            const pct = groupPool > 0 ? alloc / groupPool : 0;
            const delta = alloc - f.original;
            const changed = Math.abs(delta) >= 1;

            return (
              <div
                key={f.id}
                style={{
                  padding: "14px 0",
                  borderTop: i > 0
                    ? "1px solid color-mix(in srgb, var(--border) 28%, transparent)"
                    : "none",
                  animation: "fadeUp 0.22s ease both",
                  animationDelay: `${i * 30}ms`,
                }}
              >
                <div style={catHeaderRowStyle}>
                  <div style={catIconStyle}>
                    <CategoryIcon icon={cat.icon} size={16} />
                  </div>
                  <span style={catNameStyle}>{cat.name}</span>
                  {changed && (
                    <span
                      style={{
                        ...deltaBadgeStyle,
                        color: delta > 0 ? "var(--success)" : "var(--danger)",
                        background: delta > 0
                          ? "color-mix(in srgb, var(--success) 10%, transparent)"
                          : "color-mix(in srgb, var(--danger) 10%, transparent)",
                        animation: "badgePop 0.28s cubic-bezier(0.34, 1.56, 0.64, 1) both",
                      }}
                    >
                      {delta > 0 ? "+" : "−"}{Math.abs(Math.round(delta))}
                    </span>
                  )}
                  <div style={amountFieldStyle}>
                    {isReadOnly ? (
                      <span style={{ ...amountInputStyle, borderBottom: "none", opacity: 0.7 }}>
                        {alloc}
                      </span>
                    ) : (
                      <input
                        type="number"
                        inputMode="numeric"
                        value={inputRaw[f.id] ?? String(alloc)}
                        onChange={(e) => handleInputChange(f.id, e.target.value)}
                        onBlur={() => handleInputBlur(f.id)}
                        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                        aria-label={`${cat.name} allocation`}
                        style={amountInputStyle}
                      />
                    )}
                    <span style={madStyle}>MAD</span>
                  </div>
                </div>

                <div style={sliderRowStyle}>
                  <span style={pctStyle}>
                    {alloc === 0 ? "0%" : pct < 0.005 ? "<1%" : `${Math.round(pct * 100)}%`}
                  </span>
                  <input
                    type="range"
                    className="rebalance-slider"
                    min={0}
                    max={groupPool}
                    step={50}
                    value={alloc}
                    onChange={isReadOnly ? undefined : (e) => handleSlider(f.id, parseFloat(e.target.value))}
                    aria-label={`${cat.name} slider`}
                    style={{
                      flex: 1,
                      pointerEvents: isReadOnly ? "none" : "auto",
                      opacity: isReadOnly ? 0.55 : 1,
                      background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${pct * 100}%, color-mix(in srgb, var(--surface2) 75%, white) ${pct * 100}%, color-mix(in srgb, var(--surface2) 75%, white) 100%)`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </section>
      </div>

      {/* ── Sticky footer ── */}
      <div style={footerStyle}>
        {status === "error" && <div style={errorBoxStyle}>{errorMsg}</div>}
        {isReadOnly ? (
          <button onClick={onClose} style={readOnlyCloseStyle}>Done</button>
        ) : (
          <button
            onClick={save}
            disabled={!canSave}
            style={{
              ...saveButtonStyle,
              background: status === "success"
                ? "color-mix(in srgb, var(--success) 12%, white)"
                : "var(--accent)",
              color: status === "success" ? "var(--success)" : "var(--accent-ink)",
              opacity: canSave || status !== "idle" ? 1 : 0.4,
              cursor: canSave ? "pointer" : "not-allowed",
            }}
          >
            {status === "saving" ? (
              <><span style={spinnerStyle} />Applying...</>
            ) : status === "success" ? (
              <><CheckIcon size={16} />Applied</>
            ) : (
              saveLabel
            )}
          </button>
        )}
      </div>
    </BottomSheet>
  );
}

// ── GroupFilterPicker styles ────────────────────────────────────────────────

const gfWrapStyle: CSSProperties = {
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
  flexShrink: 0,
  overflow: "visible",
  justifySelf: "end",
};

const gfTriggerStyle: CSSProperties = {
  minHeight: 28,
  padding: 0,
  border: "none",
  background: "transparent",
  color: "var(--text2)",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
};

const gfLabelStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
};

const gfChevronStyle: CSSProperties = {
  pointerEvents: "none",
  color: "var(--muted)",
  transition: "transform 0.16s ease",
};

const gfMenuStyle: CSSProperties = {
  width: 192,
  padding: 6,
  borderRadius: 16,
  border: "1px solid color-mix(in srgb, var(--border2) 60%, transparent)",
  background: "var(--surface)",
  boxShadow:
    "0 18px 36px color-mix(in srgb, var(--ink-strong) 14%, transparent), inset 0 1px 0 color-mix(in srgb, white 55%, transparent)",
  zIndex: 90,
  display: "grid",
  gap: 3,
};

const gfOptionStyle: CSSProperties = {
  minHeight: 44,
  width: "100%",
  border: "none",
  borderRadius: 12,
  background: "transparent",
  color: "var(--text)",
  cursor: "pointer",
  display: "grid",
  gridTemplateColumns: "8px 1fr auto",
  alignItems: "center",
  gap: 9,
  padding: "0 10px",
  textAlign: "left",
};

const gfOptionActiveStyle: CSSProperties = {
  background: "color-mix(in srgb, var(--surface2) 70%, white)",
};

const gfDotStyle: CSSProperties = {
  width: 7,
  height: 7,
  borderRadius: 999,
};

const gfOptionTextStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
};

const gfCountStyle: CSSProperties = {
  fontFamily: "'DM Mono', monospace",
  fontSize: 10,
  color: "var(--muted)",
};

// ── Sheet layout ───────────────────────────────────────────────────────────

const panelStyle: CSSProperties = {
  background: "color-mix(in srgb, var(--bg) 96%, white)",
  borderRadius: "24px 24px 0 0",
};

const contentStyle: CSSProperties = {
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
};

const headerStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  alignItems: "start",
  rowGap: 6,
  columnGap: 12,
  padding: "12px 20px 10px",
  flexShrink: 0,
};

const titleStyle: CSSProperties = {
  fontSize: 20,
  fontWeight: 800,
  lineHeight: 1.15,
  color: "var(--text)",
};

const closeButtonStyle: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 999,
  border: "1px solid color-mix(in srgb, var(--border2) 70%, transparent)",
  background: "color-mix(in srgb, var(--surface2) 70%, transparent)",
  color: "var(--text2)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  justifySelf: "end",
};

const monthLabelStyle: CSSProperties = {
  minHeight: 28,
  display: "inline-flex",
  alignItems: "center",
  color: "var(--text2)",
  fontSize: 13,
  fontWeight: 600,
};

const scrollStyle: CSSProperties = {
  overflowY: "auto",
  overflowX: "hidden",
  padding: "4px 16px 8px",
  display: "grid",
  gap: 12,
};

const balanceSectionStyle: CSSProperties = {
  display: "grid",
  gap: 4,
};

const poolRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
};

const poolLabelStyle: CSSProperties = {
  color: "var(--muted)",
  fontSize: 12,
  fontWeight: 600,
};

const poolValueStyle: CSSProperties = {
  color: "var(--text)",
  fontSize: 22,
  fontWeight: 800,
  fontVariantNumeric: "tabular-nums",
  fontFeatureSettings: "\"tnum\"",
  letterSpacing: -0.5,
};

const poolStatusStyle = (isOver: boolean, isBalanced: boolean): CSSProperties => ({
  display: "flex",
  alignItems: "center",
  gap: 4,
  color: isOver
    ? "color-mix(in srgb, var(--danger) 72%, var(--text2))"
    : isBalanced
    ? "color-mix(in srgb, var(--success) 60%, var(--text2))"
    : "var(--muted)",
  fontSize: 11,
  fontWeight: 600,
});

const poolBarTrackStyle: CSSProperties = {
  height: 3,
  borderRadius: 999,
  background: "color-mix(in srgb, var(--surface2) 80%, white)",
  overflow: "hidden",
  marginTop: 4,
};

const poolBarFillStyle: CSSProperties = {
  height: "100%",
  borderRadius: 999,
  transition: "width 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.2s ease",
};

const footerStyle: CSSProperties = {
  flexShrink: 0,
  padding: "10px 16px calc(16px + env(safe-area-inset-bottom, 0px))",
  display: "grid",
  gap: 8,
  borderTop: "1px solid color-mix(in srgb, var(--border) 18%, transparent)",
};

// ── Category row styles ────────────────────────────────────────────────────

const catHeaderRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  marginBottom: 10,
};

const catIconStyle: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 10,
  background: "color-mix(in srgb, var(--surface2) 65%, white)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const catNameStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  fontSize: 14,
  fontWeight: 650,
  color: "var(--text)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const deltaBadgeStyle: CSSProperties = {
  fontFamily: "'DM Mono', monospace",
  fontSize: 10,
  fontWeight: 700,
  flexShrink: 0,
  padding: "2px 6px",
  borderRadius: 6,
};

const amountFieldStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: 4,
  flexShrink: 0,
};

const amountInputStyle: CSSProperties = {
  width: "6ch",
  background: "transparent",
  border: "none",
  borderBottom: "1.5px solid color-mix(in srgb, var(--border2) 55%, transparent)",
  padding: "2px 0",
  color: "var(--text)",
  outline: "none",
  fontSize: 14,
  fontWeight: 700,
  fontFamily: "'DM Mono', monospace",
  textAlign: "right",
};

const madStyle: CSSProperties = {
  fontFamily: "'DM Mono', monospace",
  fontSize: 10,
  color: "var(--muted)",
  letterSpacing: 0.3,
};

const sliderRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const pctStyle: CSSProperties = {
  fontFamily: "'DM Mono', monospace",
  fontSize: 11,
  color: "var(--muted)",
  width: "3ch",
  textAlign: "right",
  flexShrink: 0,
};

const emptyStateStyle: CSSProperties = {
  padding: "20px 0",
  color: "var(--muted)",
  fontSize: 14,
  textAlign: "center",
};

// ── Footer styles ──────────────────────────────────────────────────────────

const errorBoxStyle: CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  background: "color-mix(in srgb, var(--danger) 8%, white)",
  color: "color-mix(in srgb, var(--danger) 60%, var(--text))",
  fontSize: 13,
};

const saveButtonStyle: CSSProperties = {
  width: "100%",
  minHeight: 52,
  borderRadius: 14,
  border: "none",
  fontWeight: 700,
  fontSize: 15,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  transition: "all 0.22s cubic-bezier(0.22, 1, 0.36, 1)",
};

const spinnerStyle: CSSProperties = {
  width: 15,
  height: 15,
  border: "2px solid color-mix(in srgb, currentColor 26%, transparent)",
  borderTopColor: "currentColor",
  borderRadius: "50%",
  animation: "spin 0.6s linear infinite",
  flexShrink: 0,
};

const readOnlyCloseStyle: CSSProperties = {
  width: "100%",
  minHeight: 52,
  borderRadius: 14,
  border: "1px solid color-mix(in srgb, var(--border) 45%, transparent)",
  background: "transparent",
  fontWeight: 600,
  fontSize: 15,
  color: "var(--text2)",
  cursor: "pointer",
};

// ── Context banner styles ──────────────────────────────────────────────────

const contextBannerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid transparent",
};

const contextBannerDotStyle: CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: "50%",
  background: "var(--muted)",
  flexShrink: 0,
};

const contextBannerTextStyle: CSSProperties = {
  fontFamily: "'DM Mono', monospace",
  fontSize: 11,
  color: "var(--muted)",
  letterSpacing: 0.2,
};
