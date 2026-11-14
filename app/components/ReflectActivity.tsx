"use client";

import { SkeletonRows } from "./ui/Skeleton";
import { useMemo, useState, type CSSProperties } from "react";
import type { Account, BudgetScope, Category, Transaction } from "./app-types";
import { CategoryIcon } from "./ui/CategoryIcon";
import { SwipeToDelete } from "./ui/SwipeToDelete";
import { isExpenseTransaction, resolveTransactionScopes, transactionMatchesScope, fmt } from "./app-utils";
import { BanknoteIcon, TransferIcon, WriteIcon } from "./ui/icons";
import { ScreenChip } from "./ui/ScreenChip";
import { LedgerAnswerView, askSuggestions, useLedgerAsk } from "./ReflectAsk";
import { PromptInput } from "./ui/PromptInput";
import type { MonthRange } from "@/lib/ledger";
import "./ui/prompt-input.css";
import { TransactionRow } from "./ui/TransactionRow";
import { Button } from "./ui/Button";
import { EmptyState } from "./ui/EmptyState";
import { SavingCover, useBlockingSave } from "./ui/SavingCover";

type Props = { transactions: Transaction[]; categories: Category[]; accounts: Account[]; budgetScope: BudgetScope; periodLabel: string; transactionsLoading: boolean; searchOpen: boolean; onSearchClose: () => void;
  /** The months Reflect shows: a question without a month means these. */
  viewing: MonthRange;
  /** This period's biggest spending category, for the ask pills. */
  topCategoryName?: string;
  onLogAgain?: (transaction: Transaction) => void;
  onClickTransaction: (transaction: Transaction) => void; onDeleteTransaction: (id: string) => boolean | Promise<boolean> };
export function ReflectActivity({ transactions, categories, accounts, budgetScope, periodLabel: monthLabel, transactionsLoading, searchOpen, onSearchClose, viewing, topCategoryName, onClickTransaction, onDeleteTransaction, onLogAgain }: Props) {
  const [activityQuery, setActivityQuery] = useState("");
  // Search or ask: typing filters entries instantly; asking sends the text to Gemini as a question.
  const ledger = useLedgerAsk({ categories, accounts, scope: budgetScope, viewing });
  const [asked, setAsked] = useState("");
  const askNow = (text: string) => { setAsked(text.trim()); void ledger.ask(text); };
  const changeQuery = (value: string) => { setActivityQuery(value); if (ledger.active && value.trim() !== asked) { ledger.clear(); setAsked(""); } };

  const [activityType, setActivityType] = useState<"All" | "Expenses" | "Income" | "Transfers" | "Needs review">("All");
  // A swipe delete is a write: it blocks the screen with the shared saving cover until it settles.
  const deletion = useBlockingSave();
  const resetFilters = () => { setActivityType("All"); setActivityQuery(""); ledger.clear(); setAsked(""); };
  const scopedTransactions = useMemo(() => transactions.filter(t => transactionMatchesScope(t, categories, budgetScope, accounts)), [transactions, categories, budgetScope, accounts]);
  const unassignedTransactions = useMemo(() => transactions.filter(t => resolveTransactionScopes(t, categories, accounts).length === 0), [transactions, categories, accounts]);
  const activityTransactions = activityType === "Needs review" ? unassignedTransactions : scopedTransactions;
  const txGroups = useMemo(() => {
    const now = new Date();
    const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const getGroupLabel = (dateStr: string) => {
      const d = new Date(`${dateStr}T00:00:00`);
      const diff = Math.round((nowDay - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000);
      if (diff === 0) return "Today";
      if (diff === 1) return "Yesterday";
      return new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric" }).format(d);
    };
    const map = new Map<string, { label: string; items: Transaction[] }>();
    const query = activityQuery.trim().toLowerCase();
    const filtered = activityTransactions.filter(t => {
      const typeMatches = activityType === "All" || activityType === "Needs review" || (activityType === "Expenses" && isExpenseTransaction(t)) || (activityType === "Income" && t.type === "Income") || (activityType === "Transfers" && t.type === "Transfer");
      if (!typeMatches) return false;
      const related = [t.name, categories.find(c => c.id === t.category)?.name, accounts.find(a => a.id === t.accountId)?.label,
        categories.find(c => c.id === t.fromCategoryId)?.name, categories.find(c => c.id === t.toCategoryId)?.name,
        accounts.find(a => a.id === t.fromAccountId)?.label, accounts.find(a => a.id === t.toAccountId)?.label].filter(Boolean).join(" ").toLowerCase();
      return !query || related.includes(query);
    });
    for (const t of filtered) {
      const key = t.date || "undated";
      if (!map.has(key)) map.set(key, { label: t.date ? getGroupLabel(t.date) : "Undated", items: [] });
      map.get(key)!.items.push(t);
    }
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a)).map(([, group]) => ({
      label: group.label,
      items: group.items,
      expenseTotal: group.items.filter(isExpenseTransaction).reduce((s, t) => s + t.amount, 0),
      incomeTotal: group.items.filter(t => t.type === "Income").reduce((s, t) => s + t.amount, 0),
    }));
  }, [activityTransactions, activityQuery, activityType, categories, accounts]);

  return (
      <div className="reflect-activity">
        <div style={{ display: "grid", gap: 12, marginBottom: 24 }}>
          {/* Search or ask, in the app's prompt composer: typing filters entries straight away; send asks Gemini. */}
          {searchOpen && <>
            <PromptInput id="reflect-search" label="Search or ask about your money" value={activityQuery} placeholder="Search or ask, like coffee or eat out vs last month"
              onValueChange={changeQuery} onSubmit={() => askNow(activityQuery)} onStop={() => { ledger.clear(); setAsked(""); }}
              loading={ledger.busy} suggestions={askSuggestions(viewing, topCategoryName)} hint="Type to search, send to ask" autoFocus />
            <Button variant="quiet" size="compact" style={{ justifySelf: "start" }} onClick={() => { setActivityQuery(""); ledger.clear(); setAsked(""); onSearchClose(); }}>Close</Button>
          </>}
          {searchOpen && <LedgerAnswerView state={ledger} categories={categories} viewing={viewing} />}
          {/* While an answer is showing it is the result; the filtered list comes back when the search changes. */}
          {!ledger.active && <div role="group" aria-label="Activity filters" className="filter-chip-rail" style={{ display: "flex", gap: 8, overflowX: "auto" }}>
            {(["All", "Expenses", "Income", "Transfers"] as const).map(filter => <ScreenChip key={filter} selected={activityType === filter} onClick={() => setActivityType(filter)}>{filter}</ScreenChip>)}
            {/* Transactions no scope claims (missing account/category) appear in no mode's
                history, so this chip surfaces them — but only while there's something to fix. */}
            {(unassignedTransactions.length > 0 || activityType === "Needs review") && <ScreenChip
              selected={activityType === "Needs review"}
              onClick={() => setActivityType("Needs review")}
              badge={unassignedTransactions.length || undefined}
              ariaLabel={`Needs review: ${unassignedTransactions.length} transactions missing an account or category`}
            >
              Needs review
            </ScreenChip>}
          </div>}
        </div>
        {!ledger.active && <>
        {transactionsLoading && (
          <div style={{ display: "grid", gap: 8 }}>
            <h2 className="section-label" style={sectionLabelStyle}>Activity</h2>
            <SkeletonRows label="Loading transaction history" count={4} />
          </div>
        )}
        {!transactionsLoading && txGroups.length > 0 && (
          <div style={{ display: "grid", gap: 24 }}>
            {txGroups.map(({ label, items, expenseTotal, incomeTotal }) => (
              <section key={label}>
                <div style={groupHeaderStyle}>
                  <h3 className="section-label" style={sectionLabelStyle}>{label}</h3>
                  {/* A day with one transaction already shows its amount on the row. */}
                  {items.length > 1 && <span style={{ ...groupSubtotalStyle, display: "flex", gap: 12, flexWrap: "wrap" }}>{expenseTotal > 0 && <span>{fmt(expenseTotal)} spent</span>}{incomeTotal > 0 && <span>{fmt(incomeTotal)} income</span>}</span>}
                </div>
                <div className="tx-group-list row-list" style={transactionGroupStyle}>
                  {items.map(txn => {
                    const cat      = categories.find(c => c.id === txn.category);
                    const fromCat  = categories.find(c => c.id === txn.fromCategoryId);
                    const toCat    = categories.find(c => c.id === txn.toCategoryId);
                    const isIncome   = txn.type === "Income";
                    const isTransfer = txn.type === "Transfer";
                    const prefix = isIncome ? "+" : isTransfer ? "↔" : "−";
                    return (
                      <SwipeToDelete key={txn.id} flat deleteLabel={`Delete ${txn.name}`} onDelete={() => deletion.run(async () => await onDeleteTransaction(txn.id))}
                        // Swipe right: most spending repeats, so write this one again.
                        onSwipeRight={!isTransfer && onLogAgain ? () => onLogAgain(txn) : undefined} swipeRightLabel={`Log ${txn.name} again`} swipeRightIcon={<WriteIcon size={20} aria-hidden="true" />}>
                        <TransactionRow
                          title={isTransfer && (fromCat || toCat) ? `${fromCat?.name ?? "—"} → ${toCat?.name ?? "—"}` : txn.name}
                          subtitle={!isTransfer ? cat?.name : undefined}
                          amount={txn.amount}
                          tone={isIncome ? "income" : isTransfer ? "transfer" : "expense"}
                          prefix={prefix}
                          icon={isIncome ? <BanknoteIcon size={16} /> : isTransfer ? <TransferIcon size={16} /> : <CategoryIcon icon={cat?.icon ?? null} categoryName={cat?.name} size={22} />}
                          onClick={() => onClickTransaction(txn)}
                        />
                      </SwipeToDelete>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        {!transactionsLoading && txGroups.length === 0 && (
          <section aria-label="Activity" style={{ display: "grid", gap: 8 }}>
            <h2 className="section-label" style={sectionLabelStyle}>Activity</h2>
            {activityQuery.trim() || activityType !== "All"
              ? <EmptyState announce action={<Button variant="quiet" size="compact" onClick={resetFilters}>Reset filters</Button>}>
                  {activityQuery.trim() ? <>No activity matches “{activityQuery.trim()}” in {monthLabel}.</> : `No ${typeNoun[activityType]} in ${monthLabel}.`}
                </EmptyState>
              : <EmptyState>No activity in {monthLabel}.</EmptyState>}
          </section>
        )}
        </>}
        <SavingCover saving={deletion.saving} label="Deleting" fill="screen" />
      </div>

  );
}
/** Section heading (design.md Label): 13/16, weight 600, sentence case, muted, no tracking. */
const sectionLabelStyle: CSSProperties = { margin: 0, fontSize: "var(--type-label)", lineHeight: "16px", fontWeight: 600, color: "var(--muted)" };

/** The empty line names what the type filter hides. */
const typeNoun = { All: "activity", Expenses: "expenses", Income: "income", Transfers: "transfers", "Needs review": "activity to review" } as const;

const groupHeaderStyle: CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  marginBottom: 8, paddingLeft: 2,
};

const groupSubtotalStyle: CSSProperties = {
  fontSize: 12, fontWeight: 500, color: "var(--muted)",
};

const transactionGroupStyle: CSSProperties = {
  display: "grid",
  gap: 0,
};

