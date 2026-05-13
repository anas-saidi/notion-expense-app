"use client";

import { useMemo, type CSSProperties } from "react";
import type { BudgetScope, Category, Transaction } from "./app-types";
import { Money } from "./Money";
import { CategoryIcon } from "./ui/CategoryIcon";
import { SwipeToDelete } from "./ui/SwipeToDelete";
import { BUDGET_SCOPE_LABELS, fmtDate } from "./app-utils";

type Props = {
  transactions: Transaction[];
  categories: Category[];
  budgetScope: BudgetScope;
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

function buildHistoryStory(
  transactions: Transaction[],
  categories: Category[],
  scopeLabel: string,
): HistoryStory | null {
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
      ? `A first activity in ${scopeLabel.toLowerCase()} budget.`
      : activeDays.size <= 2
        ? `A light run of ${scopeLabel.toLowerCase()} activity, easy to revisit.`
        : activeDays.size <= 6
          ? `A steady rhythm of ${scopeLabel.toLowerCase()} spending across the week.`
          : `A clear timeline of everyday ${scopeLabel.toLowerCase()} spending.`;

  const note = topCategoryName
    ? `${topCategoryName} shows up the most in your shared activity right now.`
    : "Each entry stays ready to review, log again, or tidy up later.";

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
  budgetScope,
  onClickTransaction,
  onDeleteTransaction,
}: Props) {
  const totalSpent = useMemo(
    () => transactions.reduce((sum, transaction) => sum + (transaction.amount ?? 0), 0),
    [transactions]
  );

  const story = useMemo(
    () => buildHistoryStory(transactions, categories, BUDGET_SCOPE_LABELS[budgetScope]),
    [transactions, categories, budgetScope]
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

      {transactions.length > 0 && (
        <p className="history-lead" style={historyLeadStyle}>
          {story?.lead ?? `${transactions.length} transactions, all logged.`}
        </p>
      )}

      {transactions.length > 0 && (
        <section className="history-spotlight" aria-label="History summary">
          <div className="history-spotlight__header">
            <div>
              <p className="history-spotlight__eyebrow">{BUDGET_SCOPE_LABELS[budgetScope]} activity</p>
              <p className="history-spotlight__note">
                {story?.note ?? "Every expense stays close at hand for a quick check-in."}
              </p>
            </div>
            <span className="history-spotlight__amount">
              <Money value={totalSpent} absolute />
            </span>
          </div>

          <div className="history-spotlight__stats">
            <div className="history-pill">
              <span style={pillLabelStyle}>Most recent</span>
              <strong>{story ? fmtDate(story.latestDate) : "—"}</strong>
            </div>
            <div className="history-pill">
              <span style={pillLabelStyle}>Active days</span>
              <strong>{story?.activeDays ?? 0}</strong>
            </div>
            <div className="history-pill">
              <span style={pillLabelStyle}>Avg spend</span>
              <strong>
                <Money value={story?.averageSpend ?? 0} absolute />
              </strong>
            </div>
          </div>
        </section>
      )}

      {groups.length > 0 && (
        <div style={{ display: "grid", gap: 24 }}>
          {groups.map(({ label, items }, groupIdx) => {
            const startIdx = groupStartIndices[label] ?? 0;
            return (
              <div key={label}>
                <div style={{ ...groupLabelStyle, marginBottom: groupIdx === 0 ? 10 : 8 }}>
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: label === "Today" || label === "Yesterday" ? "var(--accent)" : "var(--border2)",
                      flexShrink: 0,
                      marginRight: 7,
                    }}
                  />
                  <span>{label}</span>
                  <span style={{ marginLeft: 6, opacity: 0.45 }}>{items.length}</span>
                </div>

                <div style={{ display: "grid", gap: 6 }}>
                  {items.map((transaction, localIdx) => {
                    const category = categories.find((entry) => entry.id === transaction.category);
                    const staggerIdx = startIdx + localIdx;

                    return (
                      <SwipeToDelete
                        key={transaction.id}
                        onDelete={() => onDeleteTransaction(transaction.id)}
                      >
                        <div
                          onClick={() => onClickTransaction(transaction)}
                          className="tx-row"
                          style={
                            {
                              "--stagger": `${staggerIdx * 22}ms`,
                              "--tx-accent":
                                label === "Today" || label === "Yesterday"
                                  ? "var(--accent)"
                                  : "color-mix(in srgb, var(--border2) 78%, transparent)",
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

                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                            <span
                              style={{
                                fontFamily: "'DM Mono', monospace",
                                fontSize: 13,
                                color: "var(--text2)",
                              }}
                            >
                              -<Money value={transaction.amount} absolute />
                            </span>
                          </div>
                        </div>
                      </SwipeToDelete>
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
            No activity yet
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
            Add your first expense and it will land here, ready to revisit, repeat, or tidy up.
          </div>
          <div className="history-empty__prompt" aria-hidden="true">
            groceries / coffee / fuel / weekend plan
          </div>
        </div>
      )}
    </div>
  );
}

const pillLabelStyle: CSSProperties = {
  fontSize: 10,
  color: "var(--muted)",
  fontFamily: "'DM Mono', monospace",
  letterSpacing: 0.4,
  textTransform: "uppercase",
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

const historyLeadStyle: CSSProperties = {
  marginBottom: 14,
  fontSize: 13,
  lineHeight: 1.55,
  color: "var(--muted)",
  animation: "fadeUp 0.32s ease both",
};
