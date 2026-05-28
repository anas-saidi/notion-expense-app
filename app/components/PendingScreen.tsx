"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { BudgetScope, Category, PendingItem } from "./app-types";
import { BottomSheet } from "./ui/BottomSheet";
import { Money } from "./Money";
import { CategoryIcon } from "./ui/CategoryIcon";
import { SwipeToDelete } from "./ui/SwipeToDelete";
import { BUDGET_SCOPE_LABELS, categoryIdMatchesScope, categoryMatchesScope, fmtDate, today } from "./app-utils";
import { PickerPopover } from "./PickerPopover";

type AddData = {
  name: string;
  amount: number | null;
  categoryId: string | null;
  addedBy: string;
  date: string | null;
  claimedBy: "wife" | "husband" | null;
};

type Props = {
  pendingItems: PendingItem[];
  categories: Category[];
  mode: "wife" | "husband";
  budgetScope: BudgetScope;
  onLogItem: (item: PendingItem) => void;
  onDismiss: (id: string) => void;
  onAdd: (data: AddData) => Promise<void>;
  onClaim: (id: string, claimedBy: "wife" | "husband" | null) => Promise<void>;
};

const PARTNER_NAME: Record<"wife" | "husband", string> = { wife: "Salma", husband: "Anas" };

type UrgencyGroup = "Overdue" | "Due today" | "This week" | "This month" | "Later" | "Someday";

const GROUP_ORDER: UrgencyGroup[] = [
  "Overdue",
  "Due today",
  "This week",
  "This month",
  "Later",
  "Someday",
];

function getUrgencyGroup(dateStr: string | null): UrgencyGroup {
  if (!dateStr) return "Someday";
  const now = new Date();
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const d = new Date(`${dateStr}T00:00:00`);
  const itemDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((itemDay.getTime() - nowDay.getTime()) / 86400000);
  if (diff < 0) return "Overdue";
  if (diff === 0) return "Due today";
  if (diff <= 6) return "This week";
  if (diff <= 30) return "This month";
  return "Later";
}

function getRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "";
  const now = new Date();
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const d = new Date(`${dateStr}T00:00:00`);
  const itemDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((itemDay.getTime() - nowDay.getTime()) / 86400000);
  if (diff < -1) return `${Math.abs(diff)} days ago`;
  if (diff === -1) return "yesterday";
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff <= 6) return `in ${diff} days`;
  if (diff < 30) return `in ${Math.round(diff / 7)} wk`;
  return `in ${Math.round(diff / 30)} mo`;
}

type GroupMeta = {
  dotColor: string;
  labelColor: string;
  cardBg: string;
  cardBorder: string;
  timeColor: string;
  urgent: boolean;
};

const GROUP_META: Record<UrgencyGroup, GroupMeta> = {
  "Overdue": {
    dotColor: "var(--danger)",
    labelColor: "var(--danger)",
    cardBg: "color-mix(in srgb, var(--danger) 5%, var(--surface))",
    cardBorder: "color-mix(in srgb, var(--danger) 28%, var(--border))",
    timeColor: "var(--danger)",
    urgent: true,
  },
  "Due today": {
    dotColor: "var(--warning)",
    labelColor: "color-mix(in srgb, var(--warning) 55%, #7a5800)",
    cardBg: "color-mix(in srgb, var(--warning) 7%, var(--surface))",
    cardBorder: "color-mix(in srgb, var(--warning) 35%, var(--border))",
    timeColor: "color-mix(in srgb, var(--warning) 55%, #7a5800)",
    urgent: true,
  },
  "This week": {
    dotColor: "var(--accent)",
    labelColor: "var(--muted)",
    cardBg: "var(--surface)",
    cardBorder: "transparent",
    timeColor: "var(--text2)",
    urgent: false,
  },
  "This month": {
    dotColor: "var(--muted)",
    labelColor: "var(--muted)",
    cardBg: "var(--surface)",
    cardBorder: "transparent",
    timeColor: "var(--muted)",
    urgent: false,
  },
  "Later": {
    dotColor: "var(--muted)",
    labelColor: "var(--muted)",
    cardBg: "var(--surface)",
    cardBorder: "transparent",
    timeColor: "var(--muted)",
    urgent: false,
  },
  "Someday": {
    dotColor: "var(--border2)",
    labelColor: "var(--muted)",
    cardBg: "var(--surface)",
    cardBorder: "transparent",
    timeColor: "var(--muted)",
    urgent: false,
  },
};

export function PendingScreen({
  pendingItems,
  categories,
  mode,
  budgetScope,
  onLogItem,
  onDismiss,
  onAdd,
  onClaim,
}: Props) {
  const [showSheet, setShowSheet] = useState(false);
  const [formName, setFormName] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formCatId, setFormCatId] = useState("");
  const [formDate, setFormDate] = useState(today());
  const [formCatSearch, setFormCatSearch] = useState("");
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const catPickerRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const scopedPendingItems = useMemo(
    () => pendingItems.filter((item) => categoryIdMatchesScope(item.categoryId, categories, budgetScope)),
    [budgetScope, categories, pendingItems],
  );
  const scopedCategories = useMemo(
    () => categories.filter((category) => categoryMatchesScope(category, budgetScope)),
    [budgetScope, categories],
  );

  useEffect(() => {
    if (!showSheet) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowSheet(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    // Focus the first input inside the sheet
    const firstInput = sheetRef.current?.querySelector<HTMLElement>("input, button");
    firstInput?.focus();
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showSheet]);

  useEffect(() => {
    if (!formCatId) return;
    if (scopedCategories.some((category) => category.id === formCatId)) return;
    setFormCatId("");
  }, [formCatId, scopedCategories]);

  const groups = (() => {
    const map = new Map<UrgencyGroup, PendingItem[]>();
    for (const item of scopedPendingItems) {
      const g = getUrgencyGroup(item.date);
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(item);
    }
    return GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({
      label: g,
      items: map.get(g)!,
      meta: GROUP_META[g],
    }));
  })();

  const urgentCount =
    (groups.find((g) => g.label === "Overdue")?.items.length ?? 0) +
    (groups.find((g) => g.label === "Due today")?.items.length ?? 0);

  const partner: "wife" | "husband" = mode === "wife" ? "husband" : "wife";
  const myCount = scopedPendingItems.filter((i) => (i.claimedBy ?? null) === mode).length;
  const partnerCount = scopedPendingItems.filter((i) => (i.claimedBy ?? null) === partner).length;
  const sharedCount = scopedPendingItems.filter((i) => (i.claimedBy ?? null) === null).length;

  const openSheet = () => {
    setFormName("");
    setFormAmount("");
    setFormCatId("");
    setFormDate(today());
    setFormCatSearch("");
    setShowSheet(true);
  };

  const handleAdd = async () => {
    if (!formName.trim() || saving) return;
    setSaving(true);
    try {
      await onAdd({
        name: formName.trim(),
        amount: formAmount ? parseFloat(formAmount) : null,
        categoryId: formCatId || null,
        addedBy: PARTNER_NAME[mode],
        date: formDate || null,
        claimedBy: null,
      });
      setShowSheet(false);
    } catch {
      // error surfaced via toast in page.tsx
    } finally {
      setSaving(false);
    }
  };

  return (
    <div id="panel-pending" role="tabpanel" aria-labelledby="tab-pending">
      <section style={pendingIntroStyle} aria-label="Pending summary">
        <div style={pendingIntroTopRowStyle}>
          <p style={pendingIntroCopyStyle}>
            {scopedPendingItems.length === 0
              ? `${BUDGET_SCOPE_LABELS[budgetScope]} upcoming items live here.`
              : urgentCount > 0
              ? `${urgentCount} need${urgentCount === 1 ? "s" : ""} attention.`
              : `${scopedPendingItems.length} upcoming.`}
          </p>
          <button onClick={openSheet} style={addChipStyle} aria-label="Add upcoming expense">
            + Add
          </button>
        </div>

        {scopedPendingItems.length > 0 && (
          <div style={pendingOwnershipRowStyle}>
            {[
              { label: "Assigned to you", count: myCount, color: mode === "wife" ? "var(--partner-wife)" : "var(--partner-husband)" },
              { label: PARTNER_NAME[partner], count: partnerCount, color: partner === "wife" ? "var(--partner-wife)" : "var(--partner-husband)" },
              { label: "Unassigned", count: sharedCount, color: "var(--muted)" },
            ].map(({ label, count, color }) => (
              <span
                key={label}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 11,
                  fontFamily: "var(--font-body)",
                  color: "var(--text2)",
                  background: "var(--surface2)",
                  borderRadius: 999,
                  padding: "4px 8px",
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
                {count} {label}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Grouped list */}
      {groups.length > 0 ? (
        <div style={{ display: "grid", gap: 24 }}>
          {groups.map(({ label, items, meta }) => (
            <div key={label}>
              {/* Group label */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  marginBottom: 10,
                  paddingLeft: 2,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: meta.dotColor,
                    flexShrink: 0,
                    boxShadow: meta.urgent
                      ? `0 0 0 3px color-mix(in srgb, ${meta.dotColor} 22%, transparent)`
                      : "none",
                  }}
                />
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: "var(--font-body)",
                    letterSpacing: 0.7,
                    textTransform: "uppercase",
                    color: meta.labelColor,
                    fontWeight: 700,
                  }}
                >
                  {label}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: "var(--font-body)",
                    color: "var(--muted)",
                    opacity: 0.45,
                  }}
                >
                  {items.length}
                </span>
              </div>

              {/* Item cards */}
              <div style={{ display: "grid", gap: 8 }}>
                {items.map((item, i) => {
                  const cat = categories.find((c) => c.id === item.categoryId);
                  const rel = getRelativeTime(item.date);

                  return (
                    <SwipeToDelete key={item.id} onDelete={() => onDismiss(item.id)}>
                    <div
                      className="pending-card"
                      style={
                        {
                          background: meta.cardBg,
                          border: `1px solid ${meta.cardBorder}`,
                          borderRadius: 14,
                          overflow: "hidden",
                          boxShadow: meta.urgent ? "none" : "0 1px 0 color-mix(in srgb, var(--ink-strong) 4%, transparent)",
                          "--stagger": `${i * 35}ms`,
                        } as CSSProperties
                      }
                    >
                      {/* Top row: icon + name + dismiss */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "14px 14px 12px",
                        }}
                      >
                        <CategoryIcon icon={cat?.icon} style={{ fontSize: 18, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 500,
                              color: "var(--text2)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {item.name}
                          </div>
                          {/* Meta row */}
                          <div
                            style={{
                              fontSize: 11,
                              fontFamily: "var(--font-body)",
                              color: "var(--muted)",
                              marginTop: 3,
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                              flexWrap: "wrap",
                            }}
                          >
                            {item.amount !== null && (
                              <>
                                <span style={{ color: "var(--text2)", fontWeight: 500 }}>
                                  <Money value={item.amount} absolute />
                                </span>
                                <span style={{ opacity: 0.3 }}>·</span>
                              </>
                            )}
                            {cat?.name && (
                              <>
                                <span>{cat.name}</span>
                                {(item.date || item.addedBy) && (
                                  <span style={{ opacity: 0.3 }}>·</span>
                                )}
                              </>
                            )}
                            {item.date && (
                              <span style={{ color: meta.timeColor }}>
                                {fmtDate(item.date)}{rel ? ` · ${rel}` : ""}
                              </span>
                            )}
                            {item.addedBy && !item.date && (
                              <span>{item.addedBy}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Footer: log + claim */}
                      <div
                        style={{
                          borderTop: "1px solid var(--border)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "0 14px 0 14px",
                        }}
                      >
                        <button
                          onClick={() => onLogItem(item)}
                          className="pending-log-btn"
                          style={logItButtonStyle}
                        >
                          Log expense →
                        </button>
                        {(() => {
                          const claimed = item.claimedBy ?? null;
                          if (claimed === mode) {
                            return (
                              <button
                                onClick={() => onClaim(item.id, null)}
                                className="pending-claim-btn"
                                style={claimReleaseStyle}
                                aria-label="Release — move back to shared"
                              >
                                <span style={{ width: 6, height: 6, borderRadius: "50%", background: mode === "wife" ? "var(--partner-wife)" : "var(--partner-husband)", flexShrink: 0 }} />
                                Assigned to you · Release
                              </button>
                            );
                          }
                          if (claimed === partner) {
                            return (
                              <span style={{ ...claimReleaseStyle, cursor: "default", opacity: 0.55 }} aria-label={`Claimed by ${PARTNER_NAME[partner]}`}>
                                <span style={{ width: 6, height: 6, borderRadius: "50%", background: partner === "wife" ? "var(--partner-wife)" : "var(--partner-husband)", flexShrink: 0 }} />
                                {PARTNER_NAME[partner]}&apos;s
                              </span>
                            );
                          }
                          return (
                            <button
                              onClick={() => onClaim(item.id, mode)}
                              className="pending-claim-btn"
                              style={claimReleaseStyle}
                              aria-label="Take this - assign to yourself"
                            >
                              Take this
                            </button>
                          );
                        })()}
                      </div>
                    </div>
                    </SwipeToDelete>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Empty state */
        <div style={emptyStateStyle}>
          <div style={{ fontSize: 36, marginBottom: 16, lineHeight: 1 }}>📋</div>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 18,
              fontWeight: 700,
              color: "var(--text2)",
              marginBottom: 8,
            }}
          >
            Nothing upcoming
          </div>
          <div
            style={{
              fontSize: 13,
              color: "var(--muted)",
              lineHeight: 1.6,
              maxWidth: 210,
              textAlign: "center",
              marginBottom: 24,
            }}
          >
            Add bills, subscriptions, or planned purchases - they'll show up here sorted by urgency.
          </div>
          <button onClick={openSheet} style={addChipStyle}>
            + Add something
          </button>
        </div>
      )}

      {/* Add sheet */}
      {showSheet && (
        <BottomSheet
          open={showSheet}
          onClose={() => setShowSheet(false)}
          labelledBy="pending-sheet-title"
          panelRef={sheetRef}
          maxWidth="480px"
          zIndex={101}
          detent="default"
          snapPoints={[0, 0.55, 1]}
          initialSnap={1}
          panelStyle={{
            background: "var(--surface)",
            borderRadius: "20px 20px 0 0",
            boxShadow: "0 -8px 40px rgba(0,0,0,0.12)",
          }}
          contentStyle={{ padding: "0 20px calc(28px + env(safe-area-inset-bottom, 0px))" }}
        >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 20,
              }}
            >
              <h2
                id="pending-sheet-title"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 22,
                  fontWeight: 700,
                  color: "var(--text2)",
                  lineHeight: 1,
                }}
              >
                Add upcoming expense
              </h2>
              <button
                onClick={() => setShowSheet(false)}
                style={sheetCloseStyle}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {/* Name */}
              <input
                type="text"
                aria-label="What's upcoming?"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder="What's upcoming?"
                autoFocus
                style={inputStyle}
              />

              {/* Amount + Category row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10 }}>
                <input
                  type="text"
                  inputMode="decimal"
                  aria-label="Amount (optional)"
                  value={formAmount}
                  onChange={(e) =>
                    setFormAmount(e.target.value.replace(/[^0-9.]/g, ""))
                  }
                  placeholder="Amount (optional)"
                  style={inputStyle}
                />
                <div style={{ position: "relative" }} ref={catPickerRef}>
                  <button
                    onClick={() => setShowCatPicker((v) => !v)}
                    aria-label="Select category"
                    style={{
                      ...chipPickerStyle,
                      width: 48,
                      justifyContent: "center",
                      padding: 0,
                    }}
                  >
                    {formCatId
                      ? (categories.find((c) => c.id === formCatId)?.icon ?? "#")
                      : "#"}
                  </button>
                  <PickerPopover
                    open={showCatPicker}
                    align="right"
                    placement="top"
                    width="min(240px, calc(100vw - 72px))"
                  >
                    <div style={{ maxHeight: 220, overflowY: "auto", padding: 8 }}>
                      <div
                        style={{
                          padding: "8px 10px",
                          borderBottom: "1px solid var(--border)",
                        }}
                      >
                        <input
                          type="text"
                          aria-label="Search categories"
                          value={formCatSearch}
                          onChange={(e) => setFormCatSearch(e.target.value)}
                          placeholder="Search categories"
                          style={{
                            ...inputStyle,
                            background: "transparent",
                            border: "none",
                            padding: 0,
                          }}
                        />
                      </div>
                      <button
                        onClick={() => {
                          setFormCatId("");
                          setShowCatPicker(false);
                          setFormCatSearch("");
                        }}
                        style={pickerListButtonStyle}
                      >
                        No category
                      </button>
                      {scopedCategories
                        .filter((c) =>
                          c.name
                            .toLowerCase()
                            .includes(formCatSearch.toLowerCase())
                        )
                        .map((cat) => (
                          <button
                            key={cat.id}
                            onClick={() => {
                              setFormCatId(cat.id);
                              setShowCatPicker(false);
                              setFormCatSearch("");
                            }}
                            style={pickerListButtonStyle}
                          >
                            <span>{cat.icon ?? "#"}</span>
                            <span>{cat.name}</span>
                          </button>
                        ))}
                    </div>
                  </PickerPopover>
                </div>
              </div>

              {/* Date */}
              <input
                type="date"
                aria-label="Due date (optional)"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                style={inputStyle}
              />

              {/* Save */}
              <button
                onClick={handleAdd}
                disabled={!formName.trim() || saving}
                style={{
                  ...saveButtonStyle,
                  opacity: formName.trim() && !saving ? 1 : 0.5,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                {saving && (
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      border: "2px solid color-mix(in srgb, var(--accent-ink) 30%, transparent)",
                      borderTopColor: "var(--accent-ink)",
                      borderRadius: "50%",
                      animation: "spin 0.7s linear infinite",
                      flexShrink: 0,
                    }}
                  />
                )}
                {saving ? "Saving" : "Save"}
              </button>
            </div>
        </BottomSheet>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────

const addChipStyle: CSSProperties = {
  minHeight: 44,
  padding: "0 14px",
  borderRadius: 999,
  border: "1px solid color-mix(in srgb, var(--accent) 40%, transparent)",
  background: "var(--accent)",
  color: "var(--accent-ink)",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
};


const logItButtonStyle: CSSProperties = {
  width: "100%",
  minHeight: 44,
  background: "transparent",
  border: "none",
  color: "var(--text2)",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
  textAlign: "left",
  padding: "0",
  letterSpacing: 0.1,
};


const emptyStateStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "56px 24px",
  animation: "fadeUp 0.5s ease both",
  animationDelay: "80ms",
};

const inputStyle: CSSProperties = {
  width: "100%",
  background: "var(--surface)",
  border: "1px solid transparent",
  borderRadius: 14,
  padding: "13px 16px",
  color: "var(--text2)",
  fontSize: 15,
  boxShadow: "inset 0 0 0 1.5px var(--border2)",
};

const chipPickerStyle: CSSProperties = {
  minHeight: 44,
  padding: "0 12px",
  borderRadius: 14,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text2)",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  cursor: "pointer",
};

const pickerListButtonStyle: CSSProperties = {
  width: "100%",
  minHeight: 44,
  padding: "10px 12px",
  background: "transparent",
  border: "none",
  borderRadius: 12,
  color: "var(--text2)",
  display: "flex",
  alignItems: "center",
  gap: 10,
  cursor: "pointer",
  textAlign: "left",
};

const sheetCloseStyle: CSSProperties = {
  width: 44,
  height: 44,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--muted)",
  fontSize: 18,
  cursor: "pointer",
};

const saveButtonStyle: CSSProperties = {
  width: "100%",
  minHeight: 50,
  borderRadius: 999,
  border: "1px solid color-mix(in srgb, var(--accent) 38%, transparent)",
  background: "var(--accent)",
  color: "var(--accent-ink)",
  fontWeight: 700,
  fontSize: 15,
  cursor: "pointer",
  marginTop: 4,
};

const claimReleaseStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  minHeight: 44,
  padding: "0 8px",
  border: "none",
  background: "transparent",
  color: "var(--muted)",
  fontSize: 11,
  fontFamily: "var(--font-body)",
  cursor: "pointer",
  letterSpacing: 0.2,
  flexShrink: 0,
};

const pendingIntroStyle: CSSProperties = {
  display: "grid",
  gap: 12,
  marginBottom: 20,
  animation: "fadeUp 0.4s ease both",
};

const pendingIntroTopRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const pendingIntroCopyStyle: CSSProperties = {
  fontSize: 13,
  color: "var(--muted)",
  lineHeight: 1.5,
  minWidth: 0,
};

const pendingOwnershipRowStyle: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};
