"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { CalendarIcon, XIcon } from "./ui/icons";
import type { Account, Category, PlanningAllocationItem } from "./app-types";
import { NumbersHeaderCard } from "./NumbersHeaderCard";
import { BudgetPlanningStep } from "./planning/BudgetPlanningStep";

type BudgetEditSheetProps = {
  open: boolean;
  selectedMonth: string;
  onSelectedMonthChange: (nextMonth: string) => void;
  onClose: () => void;
  accounts: Account[];
  categories: Category[];
};

const monthFormatter = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" });

const isSavingsAccount = (account: Account) => {
  const value = account.type?.toLowerCase() ?? "";
  return value.includes("saving");
};

const savingsTypeHints = ["saving", "savings", "sinking", "goal", "fund"];

const isSavingsCategory = (category: Category) => {
  const types = category.type.map((value) => value.toLowerCase());
  if (category.isTeamFund) return false;
  return types.some((value) => savingsTypeHints.some((hint) => value.includes(hint)));
};

const isFallbackHouseholdCategory = (category: Category) =>
  !isHouseholdCategory(category) &&
  !isSavingsCategory(category) &&
  !isWifeCategory(category) &&
  !isHusbandCategory(category);

const isHouseholdCategory = (category: Category) => category.isTeamFund === true && !isSavingsCategory(category);

const isWifeCategory = (category: Category) =>
  !category.isTeamFund &&
  !isSavingsCategory(category) &&
  (category.owner?.toLowerCase().includes("salma") ?? false);

const isHusbandCategory = (category: Category) =>
  !category.isTeamFund &&
  !isSavingsCategory(category) &&
  (category.owner?.toLowerCase().includes("anas") ?? false);

const toAllocationItem = (category: Category, plannedByCategory: Record<string, number>): PlanningAllocationItem => ({
  categoryId: category.id,
  name: category.name,
  icon: category.icon,
  amount: plannedByCategory[category.id] ?? category.planned ?? category.available ?? 0,
  available: category.available,
  lastMonthSpent: category.lastMonthSpent,
});

export function BudgetEditSheet({
  open,
  selectedMonth,
  onSelectedMonthChange,
  onClose,
  accounts,
  categories,
}: BudgetEditSheetProps) {
  const monthInputRef = useRef<HTMLInputElement | null>(null);
  const [householdItems, setHouseholdItems] = useState<PlanningAllocationItem[]>([]);
  const [wifeItems, setWifeItems] = useState<PlanningAllocationItem[]>([]);
  const [husbandItems, setHusbandItems] = useState<PlanningAllocationItem[]>([]);
  const [savingsItems, setSavingsItems] = useState<PlanningAllocationItem[]>([]);
  const [fundByCategoryId, setFundByCategoryId] = useState<Record<string, boolean>>({});
  const [plannedByCategory, setPlannedByCategory] = useState<Record<string, number>>({});
  const fundUpdateTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    if (!open) return;
    const savingsCategories = categories.filter(isSavingsCategory);
    const householdCategories = categories.filter(isHouseholdCategory);
    const wifeCategories = categories.filter((category) => !isHouseholdCategory(category) && isWifeCategory(category));
    const husbandCategories = categories.filter((category) => !isHouseholdCategory(category) && isHusbandCategory(category));
    const fallbackHouseholdCategories = categories.filter(
      (category) =>
        !isHouseholdCategory(category) &&
        !isSavingsCategory(category) &&
        !isWifeCategory(category) &&
        !isHusbandCategory(category),
    );
    const householdBudgetItems = [...householdCategories, ...fallbackHouseholdCategories].map((category) =>
      toAllocationItem(category, plannedByCategory),
    );
    setHouseholdItems(householdBudgetItems);
    setWifeItems(wifeCategories.map((category) => toAllocationItem(category, plannedByCategory)));
    setHusbandItems(husbandCategories.map((category) => toAllocationItem(category, plannedByCategory)));
    setSavingsItems(savingsCategories.map((category) => toAllocationItem(category, plannedByCategory)));
  }, [open, selectedMonth, categories, plannedByCategory]);

  useEffect(() => {
    if (!open) return;
    if (!/^\d{4}-\d{2}$/.test(selectedMonth)) return;
    fetch(`/api/monthly-planning/funds?month=${selectedMonth}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data?.funds) return;
        const nextFundMap: Record<string, boolean> = {};
        const nextPlannedMap: Record<string, number> = {};
        for (const fund of data.funds as Array<{ id: string; categoryId: string; planned: number; reverse?: boolean }>) {
          if (!fund.categoryId) continue;
          nextFundMap[fund.categoryId] = true;
          const planned = Number(fund.planned ?? 0);
          const delta = fund.reverse ? -planned : planned;
          nextPlannedMap[fund.categoryId] = (nextPlannedMap[fund.categoryId] ?? 0) + delta;
        }
        setFundByCategoryId(nextFundMap);
        setPlannedByCategory(nextPlannedMap);
      })
      .catch(() => null);
  }, [open, selectedMonth]);

  const monthLabel = useMemo(() => {
    if (!/^\d{4}-\d{2}$/.test(selectedMonth)) return "Selected month";
    const [year, month] = selectedMonth.split("-").map(Number);
    const date = new Date(year, month - 1, 1);
    if (Number.isNaN(date.getTime())) return "Selected month";
    return monthFormatter.format(date);
  }, [selectedMonth]);

  const monthShortLabel = useMemo(() => {
    if (!/^\d{4}-\d{2}$/.test(selectedMonth)) return "Month";
    const [year, month] = selectedMonth.split("-").map(Number);
    const date = new Date(year, month - 1, 1);
    if (Number.isNaN(date.getTime())) return "Month";
    return date.toLocaleDateString("en", { month: "short" });
  }, [selectedMonth]);

  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);

  const baseAccountPool = useMemo(
    () =>
      accounts.reduce((sum, account) => {
        if (isSavingsAccount(account)) return sum;
        return sum + (account.balance ?? 0);
      }, 0),
    [accounts],
  );

  const readyToAssignPool = useMemo(
    () =>
      accounts.reduce((sum, account) => {
        if (isSavingsAccount(account)) return sum;
        return sum + (account.readyToAssign ?? 0);
      }, 0),
    [accounts],
  );

  const plannedTotal = useMemo(
    () =>
      [...householdItems, ...wifeItems, ...husbandItems, ...savingsItems].reduce((sum, item) => {
        const targetPlanned = Number.isFinite(item.amount) ? item.amount : 0;
        return sum + targetPlanned;
      }, 0),
    [householdItems, husbandItems, savingsItems, wifeItems],
  );

  const leftToAssign = readyToAssignPool;
  const sliderPoolRemaining = Math.max(0, readyToAssignPool - plannedTotal);

  const householdAvailable = useMemo(() => {
    const candidates = categories.filter((category) => isHouseholdCategory(category) || isFallbackHouseholdCategory(category));
    return candidates;
  }, [categories, householdItems]);

  const wifeAvailable = useMemo(() => {
    const candidates = categories.filter(isWifeCategory);
    return candidates;
  }, [categories, wifeItems]);

  const husbandAvailable = useMemo(() => {
    const candidates = categories.filter(isHusbandCategory);
    return candidates;
  }, [categories, husbandItems]);

  const savingsAvailable = useMemo(() => {
    const candidates = categories.filter(isSavingsCategory);
    return candidates;
  }, [categories, savingsItems]);

  const handleFundUpdate = (categoryId: string, targetPlanned: number, currentPlanned: number) => {
    if (!/^\d{4}-\d{2}$/.test(selectedMonth)) return;
    if (fundUpdateTimersRef.current[categoryId]) {
      clearTimeout(fundUpdateTimersRef.current[categoryId]);
    }

    const delta = targetPlanned - currentPlanned;

    fundUpdateTimersRef.current[categoryId] = setTimeout(() => {
      const category = categoryById.get(categoryId);
      const reverse = delta < 0;
      const planned = Math.abs(delta);
      if (planned === 0) return;
      fetch("/api/monthly-planning/funds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: selectedMonth,
          categoryId,
              planned,
          accountId: category?.defaultAccount ?? null,
          reverse,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (!data?.fund?.id) return;
          setFundByCategoryId((current) => ({ ...current, [categoryId]: true }));
        })
        .catch(() => null);
    }, 450);
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Edit budgets"
      style={sheetWrapStyle}
    >
      <div onClick={onClose} style={{ position: "absolute", inset: 0 }} />
      <div style={sheetStyle}>
        <div style={sheetInnerStyle}>
          <header style={topBarStyle}>
            <button
              type="button"
              aria-label="Change budget month"
              onClick={() => {
                const input = monthInputRef.current;
                if (!input) return;
                if ("showPicker" in HTMLInputElement.prototype) {
                  input.showPicker();
                } else {
                  input.click();
                }
              }}
              style={monthPickerButtonStyle}
            >
              <CalendarIcon />
              <span>{monthShortLabel}</span>
            </button>
            <input
              ref={monthInputRef}
              type="month"
              value={selectedMonth}
              onChange={(event) => onSelectedMonthChange(event.target.value)}
              aria-label="Selected planning month"
              style={hiddenMonthInputStyle}
              tabIndex={-1}
            />

            <button onClick={onClose} aria-label="Close budget editor" style={closeButtonStyle}>
              <XIcon size={14} />
            </button>
          </header>

          <div style={headerStyle}>
            <div>
              <div style={eyebrowStyle}>Budget editor</div>
              <h2 style={titleStyle}>{monthLabel}</h2>
              <p style={subtitleStyle}>Adjust planned amounts. Changes save as you edit.</p>
            </div>
            <NumbersHeaderCard
              primary={{
                label: "Current balance",
                value: baseAccountPool,
                meta: monthLabel,
              }}
              secondary={{
                label: "Current left to assign",
                value: leftToAssign,
                tone:
                  leftToAssign < 0
                    ? "danger"
                    : leftToAssign === 0
                      ? "warning"
                      : "default",
              }}
              compact
              marginBottom={0}
            />
          </div>

          <BudgetPlanningStep
            householdItems={householdItems}
            wifeItems={wifeItems}
            husbandItems={husbandItems}
            savingsItems={savingsItems}
            availableHouseholdCategories={householdAvailable}
            availableWifeCategories={wifeAvailable}
            availableHusbandCategories={husbandAvailable}
            availableSavingsCategories={savingsAvailable}
            fundByCategoryId={fundByCategoryId}
            onHouseholdChange={setHouseholdItems}
            onWifeChange={setWifeItems}
            onHusbandChange={setHusbandItems}
            onSavingsChange={setSavingsItems}
            onFundUpdate={handleFundUpdate}
            poolRemaining={sliderPoolRemaining}
          />
        </div>
      </div>
    </div>
  );
}


const sheetWrapStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 75,
  background: "rgba(18, 16, 22, 0.2)",
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "center",
  padding: "20px 14px calc(88px + env(safe-area-inset-bottom, 0px))",
};

const sheetStyle: CSSProperties = {
  position: "relative",
  width: "min(100%, 520px)",
  maxHeight: "calc(100dvh - 20px - 88px - env(safe-area-inset-bottom, 0px))",
  overflow: "hidden",
  borderRadius: "var(--card-radius)",
  background: "color-mix(in srgb, var(--surface) 96%, white)",
  border: "1px solid var(--card-border)",
  boxShadow: "var(--card-shadow)",
  animation: "fadeUp 0.24s ease both",
  display: "flex",
  flexDirection: "column",
};

const sheetInnerStyle: CSSProperties = {
  padding: "18px 18px 16px",
  overflowY: "auto",
  display: "grid",
  gap: 16,
};

const topBarStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
};

const monthPickerButtonStyle: CSSProperties = {
  minHeight: 36,
  padding: "0 6px",
  border: "none",
  background: "transparent",
  color: "var(--text)",
  fontSize: 12,
  fontWeight: 600,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  cursor: "pointer",
};

const hiddenMonthInputStyle: CSSProperties = {
  position: "absolute",
  opacity: 0,
  pointerEvents: "none",
  width: 1,
  height: 1,
};

const closeButtonStyle: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 999,
  border: "1px solid color-mix(in srgb, var(--border2) 70%, transparent)",
  background: "color-mix(in srgb, var(--surface2) 70%, transparent)",
  color: "var(--text)",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const headerStyle: CSSProperties = {
  display: "grid",
  gap: 14,
};

const eyebrowStyle: CSSProperties = {
  fontFamily: "'DM Mono', monospace",
  fontSize: 10,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  color: "var(--muted)",
};

const titleStyle: CSSProperties = {
  marginTop: 6,
  fontFamily: "var(--font-display)",
  fontSize: 26,
  lineHeight: 0.95,
  fontWeight: 800,
  color: "var(--text)",
};

const subtitleStyle: CSSProperties = {
  marginTop: 6,
  fontSize: 13,
  color: "var(--text2)",
};

