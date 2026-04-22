"use client";

import { useRef, useState, type CSSProperties } from "react";
import type { Category, PendingItem } from "./app-types";
import { Money } from "./Money";
import { CategoryIcon } from "./ui/CategoryIcon";
import { fmtDate, today } from "./app-utils";
import { PickerPopover } from "./PickerPopover";

type AddData = {
  name: string;
  amount: number | null;
  categoryId: string | null;
  addedBy: string;
  date: string | null;
};

type Props = {
  pendingItems: PendingItem[];
  categories: Category[];
  mode: "wife" | "husband";
  onLogItem: (item: PendingItem) => void;
  onDismiss: (id: string) => void;
  onAdd: (data: AddData) => Promise<void>;
};

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
    cardBorder: "color-mix(in srgb, var(--danger) 28%, var(--card-border))",
    timeColor: "var(--danger)",
    urgent: true,
  },
  "Due today": {
    dotColor: "var(--warning)",
    labelColor: "color-mix(in srgb, var(--warning) 55%, #7a5800)",
    cardBg: "color-mix(in srgb, var(--warning) 7%, var(--surface))",
    cardBorder: "color-mix(in srgb, var(--warning) 35%, var(--card-border))",
    timeColor: "color-mix(in srgb, var(--warning) 55%, #7a5800)",
    urgent: true,
  },
  "This week": {
    dotColor: "var(--accent)",
    labelColor: "var(--text2)",
    cardBg: "var(--surface)",
    cardBorder: "var(--card-border)",
    timeColor: "var(--text2)",
    urgent: false,
  },
  "This month": {
    dotColor: "var(--muted)",
    labelColor: "var(--muted)",
    cardBg: "var(--surface)",
    cardBorder: "var(--card-border)",
    timeColor: "var(--muted)",
    urgent: false,
  },
  "Later": {
    dotColor: "var(--muted)",
    labelColor: "var(--muted)",
    cardBg: "var(--surface)",
    cardBorder: "var(--card-border)",
    timeColor: "var(--muted)",
    urgent: false,
  },
  "Someday": {
    dotColor: "var(--border2)",
    labelColor: "var(--muted)",
    cardBg: "var(--surface)",
    cardBorder: "var(--card-border)",
    timeColor: "var(--muted)",
    urgent: false,
  },
};

export function PendingScreen({
  pendingItems,
  categories,
  mode,
  onLogItem,
  onDismiss,
  onAdd,
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

  const groups = (() => {
    const map = new Map<UrgencyGroup, PendingItem[]>();
    for (const item of pendingItems) {
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
        addedBy: mode === "wife" ? "Wife" : "Husband",
        date: formDate || null,
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
      {/* Header */}
      <header style={{ marginBottom: 20, animation: "fadeUp 0.4s ease both" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 32,
                lineHeight: 0.95,
                fontWeight: 800,
                color: "var(--text)",
              }}
            >
              Upcoming
            </h1>
            <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 8 }}>
              {pendingItems.length === 0
                ? "Bills, subs, and things you plan to buy."
                : urgentCount > 0
                ? `${urgentCount} need${urgentCount === 1 ? "s" : ""} attention.`
                : `${pendingItems.length} upcoming.`}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
            <button onClick={openSheet} style={addChipStyle} aria-label="Add upcoming expense">
              + Add
            </button>
          </div>
        </div>
      </header>

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
                    fontFamily: "'DM Mono', monospace",
                    letterSpacing: 0.7,
                    textTransform: "uppercase",
                    color: meta.labelColor,
                    fontWeight: meta.urgent ? 600 : 400,
                  }}
                >
                  {label}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: "'DM Mono', monospace",
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
                    <div
                      key={item.id}
                      className="pending-card"
                      style={
                        {
                          background: meta.cardBg,
                          border: `1px solid ${meta.cardBorder}`,
                          borderRadius: "var(--card-radius)",
                          overflow: "hidden",
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
                          padding: "12px 14px 10px",
                        }}
                      >
                        <div style={iconBadgeStyle}><CategoryIcon icon={cat?.icon} style={{ fontSize: 18 }} /></div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 500,
                              color: "var(--text)",
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
                              fontFamily: "'DM Mono', monospace",
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
                        <button
                          onClick={() => onDismiss(item.id)}
                          style={{
                            ...dismissButtonStyle,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            border: "none",
                            outline: "none",
                            borderRadius: 8,
                            width: 32,
                            height: 32,
                            background: "#fef2f2",
                            cursor: "pointer",
                            transition: "background 0.2s",
                          }}
                          aria-label="Dismiss (send to the void)"
                          title="Send to the void"
                        >
                          <DelightTrashButton isDeleting={false} />
                        </button>
                      import { DelightTrashButton } from "./ui/DelightTrashButton";
                      </div>

                      {/* Log it footer */}
                      <div style={{ borderTop: "1px solid var(--border)", padding: "0 14px 0" }}>
                        <button
                          onClick={() => onLogItem(item)}
                          style={logItButtonStyle}
                        >
                          Log it →
                        </button>
                      </div>
                    </div>
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
              color: "var(--text)",
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
            Add bills, subscriptions, or planned purchases — they'll show up here sorted by urgency.
          </div>
          <button onClick={openSheet} style={addChipStyle}>
            + Add something
          </button>
        </div>
      )}

      {/* Add sheet */}
      {showSheet && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setShowSheet(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.28)",
              zIndex: 100,
              animation: "backdropIn 0.22s ease both",
            }}
          />
          {/* Sheet */}
          <div className="pending-add-sheet">
            {/* Drag handle */}
            <div
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                background: "var(--border2)",
                margin: "0 auto 20px",
              }}
            />

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 20,
              }}
            >
              <h2
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 22,
                  fontWeight: 700,
                  color: "var(--text)",
                  lineHeight: 1,
                }}
              >
                Add upcoming
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
                      {categories
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
                  opacity: formName.trim() ? 1 : 0.45,
                }}
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────

const addChipStyle: CSSProperties = {
  minHeight: 36,
  padding: "0 14px",
  borderRadius: 999,
  border: "1px solid color-mix(in srgb, var(--accent) 40%, transparent)",
  background: "var(--accent)",
  color: "var(--accent-ink)",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
};

const iconBadgeStyle: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 12,
  background: "var(--surface2)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  fontSize: 16,
};

const logItButtonStyle: CSSProperties = {
  width: "100%",
  minHeight: 40,
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

const dismissButtonStyle: CSSProperties = {
  width: 28,
  height: 28,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--muted)",
  fontSize: 16,
  cursor: "pointer",
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
  color: "var(--text)",
  fontSize: 15,
  outline: "none",
  boxShadow: "inset 0 0 0 1.5px var(--border2)",
};

const chipPickerStyle: CSSProperties = {
  minHeight: 44,
  padding: "0 12px",
  borderRadius: 14,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text)",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  cursor: "pointer",
};

const pickerListButtonStyle: CSSProperties = {
  width: "100%",
  minHeight: 42,
  padding: "10px 12px",
  background: "transparent",
  border: "none",
  borderRadius: 12,
  color: "var(--text)",
  display: "flex",
  alignItems: "center",
  gap: 10,
  cursor: "pointer",
  textAlign: "left",
};

const sheetCloseStyle: CSSProperties = {
  width: 32,
  height: 32,
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
