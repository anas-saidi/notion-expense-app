"use client";
import { DelightTrashButton } from "./ui/DelightTrashButton";

import { useMemo, type CSSProperties } from "react";
import type { Category, Transaction } from "./app-types";
import { Money } from "./Money";
import { CategoryIcon } from "./ui/CategoryIcon";
import { fmtDate } from "./app-utils";

type Props = {
  transactions: Transaction[];
  categories: Category[];
  deletingId: string | null;
  onClickTransaction: (t: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
};

type DateGroup = "Today" | "Yesterday" | "This week" | "Earlier" | "Older";

type HistoryStory = {
  lead: string;
  note: string;
  latestDate: string;
  activeDays: number;
  averageSpend: number;
};

const GROUP_ORDER: DateGroup[] = ["Today", "Yesterday", "This week", "Earlier", "Older"];

function getDateGroup(dateStr: string): DateGroup {
  const now = new Date();
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const txDay = new Date(`${dateStr}T00:00:00`);
  const txDayNorm = new Date(txDay.getFullYear(), txDay.getMonth(), txDay.getDate());
  const diffMs = nowDay.getTime() - txDayNorm.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays <= 6) return "This week";
  if (diffDays <= 30) return "Earlier";
  return "Older";
}

function buildHistoryStory(transactions: Transaction[], categories: Category[]): HistoryStory | null {
  if (transactions.length === 0) return null;

  const categoryCounts = new Map<string, number>();
  const activeDays = new Set<string>();
  let latestDate = transactions[0].date;

  for (const transaction of transactions) {
    activeDays.add(transaction.date);

    if (transaction.date > latestDate) latestDate = transaction.date;
    if (transaction.category) {
      categoryCounts.set(
        transaction.category,
        (categoryCounts.get(transaction.category) ?? 0) + 1
      );
    }
  }

  const topCategoryId = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const topCategoryName = topCategoryId
    ? categories.find((category) => category.id === topCategoryId)?.name ?? "Unsorted"
    : null;
  const averageSpend =
    transactions.reduce((sum, transaction) => sum + (transaction.amount ?? 0), 0) /
    Math.max(1, transactions.length);

  const lead =
    transactions.length === 1
      ? "A first note in your shared money story."
      : activeDays.size <= 2
        ? "A light trail of spending, easy to revisit together."
        : activeDays.size <= 6
          ? "A steady rhythm of check-ins across the week."
          : "A well-kept timeline of everyday household decisions.";

  const note = topCategoryName
    ? `${topCategoryName} shows up the most, so it is shaping the story right now.`
    : "Each entry stays ready to review, repeat, or tidy up later.";

  return {
    lead,
    note,
    latestDate,
    activeDays: activeDays.size,
    averageSpend,
  };
}

export function HistoryScreen({
  transactions,
  categories,
  deletingId,
  onClickTransaction,
  onDeleteTransaction,
}: Props) {
  const totalSpent = useMemo(
    () => transactions.reduce((sum, transaction) => sum + (transaction.amount ?? 0), 0),
    [transactions]
  );

  const story = useMemo(
    () => buildHistoryStory(transactions, categories),
    [transactions, categories]
  );

  const groups = useMemo(() => {
    const map = new Map<DateGroup, Transaction[]>();
    for (const transaction of transactions) {
      const group = transaction.date ? getDateGroup(transaction.date) : "Older";
      if (!map.has(group)) map.set(group, []);
      map.get(group)?.push(transaction);
    }
    return GROUP_ORDER.filter((group) => map.has(group)).map((group) => ({
      label: group,
      items: map.get(group) ?? [],
    }));
  }, [transactions]);

  const groupStartIndices = useMemo(() => {
    const result: Partial<Record<DateGroup, number>> = {};
    let idx = 0;
    for (const group of groups) {
      result[group.label] = idx;
      idx += group.items.length;
    }
    return result;
  }, [groups]);

  return (
    <div id="panel-history" role="tabpanel" aria-labelledby="tab-history">
      <header style={{ marginBottom: 20, animation: "fadeUp 0.4s ease both" }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
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
              History
            </h1>
            <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 8 }}>
              {transactions.length === 0
                ? "Your spending story starts here."
                : story?.lead ?? `${transactions.length} transactions, all logged.`}
            </p>
          </div>
        </div>
      </header>

      {transactions.length > 0 && (
        <section className="history-spotlight" aria-label="History summary">
          <div className="history-spotlight__main">
            <span className="history-spotlight__eyebrow">Shared money trail</span>
            <div style={{ display: "grid", gap: 8 }}>
              <span style={summaryAmountStyle}>
                <Money value={totalSpent} absolute />
              </span>
              <p className="history-spotlight__note">
                {story?.note ?? "Every expense stays close at hand for a quick check-in."}
              </p>
            </div>
          </div>

          <div className="history-spotlight__stats">
            <div className="history-pill">
              <span style={summaryLabelStyle}>Latest</span>
              <strong>{story ? fmtDate(story.latestDate) : "-"}</strong>
            </div>
            <div className="history-pill">
              <span style={summaryLabelStyle}>Active days</span>
              <strong>{story?.activeDays ?? 0}</strong>
            </div>
            <div className="history-pill">
              <span style={summaryLabelStyle}>Average</span>
              <strong>
                <Money value={story?.averageSpend ?? 0} absolute />
              </strong>
            </div>
          </div>
        </section>
      )}

      {groups.length > 0 && (
        <div style={{ display: "grid", gap: 24 }}>
          {groups.map(({ label, items }) => {
            const startIdx = groupStartIndices[label] ?? 0;
            return (
              <div key={label}>
                <div style={groupLabelStyle}>
                  <span>{label}</span>
                  <span style={{ marginLeft: 8, opacity: 0.45 }}>{items.length}</span>
                </div>

                <div style={{ display: "grid", gap: 6 }}>
                  {items.map((transaction, localIdx) => {
                    const category = categories.find((entry) => entry.id === transaction.category);
                    const isDeleting = deletingId === transaction.id;
                    const staggerIdx = startIdx + localIdx;

                    return (
                      <div
                        key={transaction.id}
                        onClick={() => {
                          if (!isDeleting) onClickTransaction(transaction);
                        }}
                        className={`tx-row${isDeleting ? " tx-row--deleting" : ""}`}
                        style={
                          {
                            "--stagger": `${staggerIdx * 22}ms`,
                            "--tx-accent":
                              label === "Today" || label === "Yesterday"
                                ? "var(--accent)"
                                : "color-mix(in srgb, var(--border2) 78%, transparent)",
                            cursor: isDeleting ? "default" : "pointer",
                          } as CSSProperties
                        }
                      >
                        <div className="tx-icon" style={iconBadgeStyle}>
                          <CategoryIcon icon={category?.icon} style={{ fontSize: 18 }} />
                        </div>

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
                            {transaction.name}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--muted)",
                              marginTop: 2,
                              fontFamily: "'DM Mono', monospace",
                            }}
                          >
                            {[category?.name ?? "Unsorted", fmtDate(transaction.date)].join(" / ")}
                          </div>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            flexShrink: 0,
                          }}
                        >
                          <span
                            style={{
                              fontFamily: "'DM Mono', monospace",
                              fontSize: 13,
                              color: isDeleting ? "var(--danger)" : "var(--text2)",
                              fontWeight: isDeleting ? 600 : 400,
                              transition: "color 0.2s ease",
                            }}
                          >
                            -<Money value={transaction.amount} absolute />
                          </span>

                          <span
                            className="tx-reuse-hint"
                            aria-hidden="true"
                            title="Tap to reuse"
                          >
                            reuse
                          </span>

                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              onDeleteTransaction(transaction.id);
                            }}
                            className={`tx-delete-btn${isDeleting ? " tx-delete-btn--confirm" : ""}`}
                            aria-label={isDeleting ? "Send to the void?" : "Delete transaction"}
                            title={isDeleting ? "Poof! Gone" : "Delete this transaction"}
                            style={{
                              background: isDeleting ? "#ffe5ec" : undefined,
                              transition: "background 0.2s",
                              position: "relative",
                              border: "none",
                              outline: "none",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              borderRadius: 8,
                              width: 32,
                              height: 32,
                            }}
                            onMouseDown={e => e.currentTarget.classList.add('shake')}
                            onMouseUp={e => e.currentTarget.classList.remove('shake')}
                            onMouseLeave={e => e.currentTarget.classList.remove('shake')}
                          >
                            {/* Delightful TrashIcon with lid pop and shake */}
                            <DelightTrashButton isDeleting={isDeleting} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {transactions.length === 0 && (
        <div className="history-empty" style={emptyStateStyle}>
          <div className="history-empty__orbit" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 18,
              fontWeight: 700,
              color: "var(--text)",
              marginBottom: 8,
            }}
          >
            Nothing logged yet
          </div>
          <div
            style={{
              fontSize: 13,
              color: "var(--muted)",
              lineHeight: 1.6,
              maxWidth: 240,
              textAlign: "center",
            }}
          >
            Add your first expense and it will land here, ready to revisit, repeat, or tidy up together.
          </div>
          <div className="history-empty__prompt" aria-hidden="true">
            groceries / coffee / fuel / weekend plan
          </div>
        </div>
      )}
    </div>
  );
}

const summaryLabelStyle: CSSProperties = {
  fontSize: 11,
  color: "var(--muted)",
  fontFamily: "'DM Mono', monospace",
  letterSpacing: 0.5,
  textTransform: "uppercase",
};

const summaryAmountStyle: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: 28,
  lineHeight: 0.95,
  fontWeight: 700,
  color: "var(--text)",
};

const groupLabelStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  fontSize: 11,
  fontFamily: "'DM Mono', monospace",
  letterSpacing: 0.7,
  textTransform: "uppercase",
  color: "var(--muted)",
  marginBottom: 8,
  paddingLeft: 2,
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

const emptyStateStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "64px 24px",
  animation: "fadeUp 0.5s ease both",
  animationDelay: "80ms",
};
