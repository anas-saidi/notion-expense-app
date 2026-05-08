"use client";

import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import type { Category, MonthlySummary } from "./app-types";
import { today } from "./app-utils";
import { BottomSheet } from "./ui/BottomSheet";
import { Money } from "./Money";
import { CategoryIcon } from "./ui/CategoryIcon";
import { CheckIcon, XIcon } from "./ui/icons";
import { ChipTabs } from "./ui/ChipTabs";

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
  // Joint takes priority — team funds can't be personal or savings
  if (isJointCategory(cat)) return "joint";
  // Savings: type hints, but only for non-joint categories
  if (cat.type.some((t) => SAVINGS_HINTS.some((h) => t.toLowerCase().includes(h)))) {
    return "savings";
  }
  if (cat.owner?.toLowerCase().includes("salma")) return "wife";
  if (cat.owner?.toLowerCase().includes("anas")) return "husband";
  return "joint"; // unowned, non-savings → joint
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

export function RebalanceSheet({ open, onClose, categories, onSuccess, homeMonth, monthlySummary }: RebalanceSheetProps) {
  const monthCtx = useMemo(() => getMonthContext(homeMonth), [homeMonth]);
  const isReadOnly = monthCtx !== "current";

  // Per-category lookup maps from the monthly summary
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

  // Available amount depends on month context
  const getAvailable = (c: Category): number => {
    if (monthCtx === "current") return Math.round(c.available ?? 0);
    if (monthCtx === "past") {
      const planned = plannedByCategory.get(c.id) ?? 0;
      const spent = spentByCategory.get(c.id) ?? 0;
      return Math.max(0, Math.round(planned - spent));
    }
    // future — show planned amounts
    return Math.max(0, Math.round(plannedByCategory.get(c.id) ?? c.planned ?? 0));
  };

  // Only categories with a non-zero amount for this month context
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

  // Fixed pool: sum of all currently-available funds. Sliders redistribute within this total.
  const totalPool = useMemo(
    () => funded.reduce((sum, f) => sum + f.original, 0),
    [funded],
  );

  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [inputRaw, setInputRaw] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [groupFilter, setGroupFilter] = useState<GroupFilter>("all");

  // Reset every time the sheet opens
  useEffect(() => {
    if (!open) return;
    const initial = Object.fromEntries(funded.map((f) => [f.id, f.original]));
    setAllocations(initial);
    setInputRaw(Object.fromEntries(funded.map((f) => [f.id, String(f.original)])));
    setStatus("idle");
    setErrorMsg("");
    setGroupFilter("all");
  }, [open, funded]);

  // ── Derived ──────────────────────────────────────────────────────────────
  const hasChanges = funded.some((f) => (allocations[f.id] ?? f.original) !== f.original);

  // ── Group filter ──────────────────────────────────────────────────────────
  const groupCounts = useMemo(() => {
    const counts: Record<Exclude<GroupFilter, "all">, number> = {
      joint: 0,
      wife: 0,
      husband: 0,
      savings: 0,
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
      ...(groupCounts.joint > 0
        ? [{ key: "joint", label: "Joint", count: groupCounts.joint }]
        : []),
      ...(groupCounts.wife > 0
        ? [{ key: "wife", label: "Salma", count: groupCounts.wife }]
        : []),
      ...(groupCounts.husband > 0
        ? [{ key: "husband", label: "Anas", count: groupCounts.husband }]
        : []),
      ...(groupCounts.savings > 0
        ? [{ key: "savings", label: "Savings", count: groupCounts.savings }]
        : []),
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

  // Stats scoped to the visible group
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

  // ── Balanced burst ────────────────────────────────────────────────────────
  const wasBalancedRef = useRef(false);
  const [burstKey, setBurstKey] = useState(0);
  useEffect(() => {
    const nowBalanced = isGroupBalanced && hasChanges;
    if (nowBalanced && !wasBalancedRef.current) setBurstKey((k) => k + 1);
    wasBalancedRef.current = nowBalanced;
  }, [isGroupBalanced, hasChanges]);

  // ── Handlers ─────────────────────────────────────────────────────────────
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

  // ── Pool hint copy ────────────────────────────────────────────────────────
  const poolHint = (() => {
    if (isGroupOver) return `Over by ${Math.round(Math.abs(groupFree))} MAD — reduce allocations`;
    if (isGroupBalanced && hasChanges) return "All funds accounted for — ready to apply";
    if (isGroupBalanced) return "Drag sliders to move funds between categories";
    return `${Math.round(groupFree)} MAD not yet assigned`;
  })();

  const saveLabel = (() => {
    if (status === "saving" || status === "success") return null;
    if (!hasChanges) return "No changes";
    if (isGroupBalanced) return "Apply · balanced";
    if (groupFree > 0) return `Apply · ${Math.round(groupFree)} unassigned`;
    return "Apply changes";
  })();

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      label="Rebalance categories"
      maxWidth="520px"
      detent="default"
      snapPoints={[0, 0.88, 1]}
      initialSnap={1}
      panelStyle={panelStyle}
      contentStyle={{ paddingTop: 0 }}
    >
      <div style={sheetInnerStyle}>

        {/* ── Header ── */}
        <header style={topBarStyle}>
          <div>
            <div style={eyebrowStyle}>{formatMonth(homeMonth)}</div>
            <h2 style={titleStyle}>Rebalance</h2>
          </div>
          <button onClick={onClose} aria-label="Close" style={closeButtonStyle}>
            <XIcon strokeWidth={2.2} />
          </button>
        </header>

        {/* ── Month context banner (past / future only) ── */}
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

        {/* ── Pool card ── */}
        <div style={{ ...statsCardStyle, position: "relative" }}>
          <div style={statsRowStyle}>
            <div style={statBlockStyle}>
              <div style={eyebrowStyle}>
                {monthCtx === "past" ? "Leftover" : monthCtx === "future" ? "Planned" : "Available pool"}
              </div>
              <div style={statValueStyle}><Money value={groupPool} /></div>
            </div>
            {(hasChanges || isGroupOver) && (
              <>
                <div style={statDividerStyle} />
                <div style={statBlockStyle}>
                  <div style={eyebrowStyle}>
                    {isGroupOver ? "Over by" : isGroupBalanced ? "Balanced" : "Unassigned"}
                  </div>
                  <div
                    style={{
                      ...statValueStyle,
                      color: isGroupOver
                        ? "var(--danger)"
                        : isGroupBalanced
                        ? "var(--success)"
                        : "var(--text)",
                      fontSize: isGroupBalanced ? 15 : 22,
                      fontFamily: isGroupBalanced ? "var(--font-body, inherit)" : "var(--font-display)",
                    }}
                  >
                    {isGroupBalanced
                      ? "All good"
                      : (
                        <>
                          {isGroupOver ? "−" : "+"}<Money value={Math.abs(Math.round(groupFree))} />
                        </>
                      )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Pool allocation bar */}
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

          <p
            style={{
              ...poolHintStyle,
              color: isGroupOver
                ? "color-mix(in srgb, var(--danger) 70%, var(--muted))"
                : isGroupBalanced && hasChanges
                ? "color-mix(in srgb, var(--success) 70%, var(--muted))"
                : "var(--muted)",
            }}
          >
            {poolHint}
          </p>
        </div>

        {/* ── Group filter chips ── */}
        {groupTabs.length > 2 && (
          <ChipTabs
            items={groupTabs}
            activeKey={groupFilter}
            ariaLabel="Filter categories by group"
            onChange={(key) => setGroupFilter(key as GroupFilter)}
          />
        )}

        {/* ── Sliders ── */}
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
                  borderTop:
                    i > 0
                      ? "1px solid color-mix(in srgb, var(--border) 28%, transparent)"
                      : "none",
                  animation: "fadeUp 0.22s ease both",
                  animationDelay: `${i * 30}ms`,
                }}
              >
                {/* Row: icon · name · delta badge · amount input */}
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
                        background:
                          delta > 0
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
                        onKeyDown={(e) =>
                          e.key === "Enter" && (e.target as HTMLInputElement).blur()
                        }
                        aria-label={`${cat.name} allocation`}
                        style={amountInputStyle}
                      />
                    )}
                    <span style={madStyle}>MAD</span>
                  </div>
                </div>

                {/* Slider row: percent · track */}
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

        {/* ── Error ── */}
        {status === "error" && (
          <div style={errorBoxStyle}>{errorMsg}</div>
        )}

        {/* ── Footer: apply button (current) or read-only notice (past/future) ── */}
        {isReadOnly ? (
          <button onClick={onClose} style={readOnlyCloseStyle}>
            Done
          </button>
        ) : (
          <button
            onClick={save}
            disabled={!canSave}
            style={{
              ...saveButtonStyle,
              background:
                status === "success"
                  ? "color-mix(in srgb, var(--success) 12%, white)"
                  : "var(--accent)",
              color: status === "success" ? "var(--success)" : "var(--accent-ink)",
              opacity: canSave || status !== "idle" ? 1 : 0.4,
              cursor: canSave ? "pointer" : "not-allowed",
            }}
          >
            {status === "saving" ? (
              <>
                <span style={spinnerStyle} />
                Applying...
              </>
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

// ── Styles ─────────────────────────────────────────────────────────────────

const panelStyle: CSSProperties = {
  background: "color-mix(in srgb, var(--surface) 97%, white)",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  borderRadius: 20,
};

const sheetInnerStyle: CSSProperties = {
  padding: "18px 18px 32px",
  display: "grid",
  gap: 20,
};

const topBarStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
};

const eyebrowStyle: CSSProperties = {
  fontFamily: "'DM Mono', monospace",
  fontSize: 10,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  color: "var(--muted)",
};

const titleStyle: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: 28,
  lineHeight: 0.95,
  fontWeight: 800,
  color: "var(--text)",
  margin: "4px 0 0",
};

const closeButtonStyle: CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 999,
  border: "1px solid color-mix(in srgb, var(--border2) 70%, transparent)",
  background: "color-mix(in srgb, var(--surface2) 70%, transparent)",
  color: "var(--text)",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const statsCardStyle: CSSProperties = {
  padding: "16px 18px",
  borderRadius: 16,
  background: "color-mix(in srgb, var(--surface2) 28%, white)",
  border: "1px solid color-mix(in srgb, var(--border) 30%, transparent)",
  display: "grid",
  gap: 12,
};

const statsRowStyle: CSSProperties = {
  display: "flex",
  gap: 0,
};

const statBlockStyle: CSSProperties = {
  flex: 1,
  display: "grid",
  gap: 6,
};

const statDividerStyle: CSSProperties = {
  width: 1,
  background: "color-mix(in srgb, var(--border) 40%, transparent)",
  margin: "0 18px",
  flexShrink: 0,
};

const statValueStyle: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: 22,
  fontWeight: 800,
  lineHeight: 1,
  color: "var(--text)",
  transition: "color 0.2s ease",
};

const poolBarTrackStyle: CSSProperties = {
  height: 4,
  borderRadius: 999,
  background: "color-mix(in srgb, var(--surface2) 80%, white)",
  overflow: "hidden",
};

const poolBarFillStyle: CSSProperties = {
  height: "100%",
  borderRadius: 999,
  transition: "width 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.2s ease",
};

const poolHintStyle: CSSProperties = {
  margin: 0,
  fontFamily: "'DM Mono', monospace",
  fontSize: 12,
  letterSpacing: 0,
  transition: "color 0.2s ease",
};

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
