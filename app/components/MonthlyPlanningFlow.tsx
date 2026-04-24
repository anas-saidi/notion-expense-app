"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { CalendarIcon, XIcon } from "./ui/icons";
import { MonthlyPlanningHeader } from "./MonthlyPlanningHeader";
import { CloseMonthStep } from "./planning/CloseMonthStep";
import { BudgetPlanningStep } from "./planning/BudgetPlanningStep";
import { IncomeStep } from "./planning/IncomeStep";
import { ReviewStep } from "./planning/ReviewStep";
import { SavingsStep } from "./planning/SavingsStep";
import type {
  Account,
  Category,
  CloseMonthStepState,
  MonthlyPlanningSnapshot,
  PlanningAllocationItem,
  PlanningIncomeItem,
  PlanningIncomeStepState,
  PlanningStep,
} from "./app-types";

type MonthlyPlanningFlowProps = {
  selectedMonth: string;
  onSelectedMonthChange: (nextMonth: string) => void;
  onCancel: () => void;
  onOpenAddTransaction?: (payload: {
    accountId: string;
    amount: number;
    name?: string;
  }) => void;
  accounts: Account[];
  categories: Category[];
  isUsingFallbackData: boolean;
};

type StepMeta = {
  id: PlanningStep;
  label: string;
  title: string;
  description: string;
  nextLabel: string;
};

const steps: StepMeta[] = [
  {
    id: "close",
    label: "Close",
    title: "Close last month",
    description: "Clear last month before planning.",
    nextLabel: "Continue",
  },
  {
    id: "income",
    label: "Income",
    title: "Confirm shared income",
    description: "Confirm the money available for your household this month.",
    nextLabel: "Continue",
  },
  {
    id: "budget",
    label: "Budget",
    title: "Plan joint and partner-owned categories",
    description: "Assign joint and partner-owned categories across your shared budget.",
    nextLabel: "Continue",
  },
  {
    id: "savings",
    label: "Savings",
    title: "Set aside savings",
    description: "Set aside money for shared savings goals.",
    nextLabel: "Continue",
  },
  {
    id: "review",
    label: "Review",
    title: "Review shared plan",
    description: "Check totals and save the shared plan for the month.",
    nextLabel: "Save shared plan",
  },
];

const buildStepState = () =>
  steps.reduce((acc, step) => {
    acc[step.id] = false;
    return acc;
  }, {} as Record<PlanningStep, boolean>);

const initialCloseStepState: CloseMonthStepState = {
  reviewed: false,
  unresolvedCount: 0,
  needsAttention: false,
};

const emptyIncomeMeta: Pick<PlanningIncomeStepState, "confirmedTotal" | "ready" | "source"> = {
  confirmedTotal: 0,
  ready: false,
  source: "mock" as const,
};

const monthFormatter = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" });

const isSavingsAccount = (account: Account) => {
  const value = account.type?.toLowerCase() ?? "";
  return value.includes("saving");
};

const savingsTypeHints = ["saving", "savings", "sinking", "goal", "fund"];

const isHouseholdCategory = (category: Category) => {
  if (category.isTeamFund) return true;
  return category.type.some((value) => {
    const normalized = value.toLowerCase();
    return normalized.includes("team") || normalized.includes("household");
  });
};

const isWifeCategory = (category: Category) =>
  category.owner?.toLowerCase() === "salma";

const isHusbandCategory = (category: Category) =>
  category.owner?.toLowerCase() === "anas";

const isSavingsCategory = (category: Category) => {
  const types = category.type.map((value) => value.toLowerCase());
  if (isHouseholdCategory(category)) return false;
  return types.some((value) => savingsTypeHints.some((hint) => value.includes(hint)));
};

function toAllocationItem(category: Category): PlanningAllocationItem {
  return {
    categoryId: category.id,
    name: category.name,
    icon: category.icon,
    amount: category.planned ?? 0,
    available: category.available,
    lastMonthSpent: category.lastMonthSpent,
  };
}

export function MonthlyPlanningFlow({
  selectedMonth,
  onSelectedMonthChange,
  onCancel,
  onOpenAddTransaction,
  accounts,
  categories,
  isUsingFallbackData,
}: MonthlyPlanningFlowProps) {
  const monthInputRef = useRef<HTMLInputElement | null>(null);
  const [activeStep, setActiveStep] = useState<PlanningStep>("close");
  const [completedSteps, setCompletedSteps] = useState<Record<PlanningStep, boolean>>(() => buildStepState());
  const [closeStepState, setCloseStepState] = useState<CloseMonthStepState>(initialCloseStepState);
  const [incomeItems, setIncomeItems] = useState<PlanningIncomeItem[]>([]);
  const [incomeMeta, setIncomeMeta] = useState(emptyIncomeMeta);
  const [householdItems, setHouseholdItems] = useState<PlanningAllocationItem[]>([]);
  const [wifeItems, setWifeItems] = useState<PlanningAllocationItem[]>([]);
  const [husbandItems, setHusbandItems] = useState<PlanningAllocationItem[]>([]);
  const [savingsItems, setSavingsItems] = useState<PlanningAllocationItem[]>([]);
  const [isCompact, setIsCompact] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "error">("idle");
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    setActiveStep("close");
    setCompletedSteps(buildStepState());
    setCloseStepState(initialCloseStepState);
    setIncomeItems([]);
    setIncomeMeta(emptyIncomeMeta);
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
    const householdBudgetItems = [...householdCategories, ...fallbackHouseholdCategories].map(toAllocationItem);
    setHouseholdItems(householdBudgetItems);
    setWifeItems(wifeCategories.map(toAllocationItem));
    setHusbandItems(husbandCategories.map(toAllocationItem));
    setSavingsItems(savingsCategories.map(toAllocationItem));
    setSaveState("idle");
    setSaveError("");
  }, [selectedMonth, categories]);

  useEffect(() => {
    const handleResize = () => setIsCompact(window.innerWidth < 640);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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

  const assignedHousehold = useMemo(
    () =>
      householdItems.reduce((sum, item) => sum + item.amount, 0) +
      wifeItems.reduce((sum, item) => sum + item.amount, 0) +
      husbandItems.reduce((sum, item) => sum + item.amount, 0),
    [householdItems, husbandItems, wifeItems],
  );
  const assignedSavings = useMemo(
    () => savingsItems.reduce((sum, item) => sum + item.amount, 0),
    [savingsItems],
  );
  const availablePool = baseAccountPool;
  const leftToAssign = readyToAssignPool - assignedHousehold - assignedSavings;
  const snapshot: MonthlyPlanningSnapshot = {
    availablePool,
    assignedHousehold,
    assignedSavings,
    leftToAssign,
  };

  const activeStepIndex = steps.findIndex((step) => step.id === activeStep);
  const activeStepMeta = steps[activeStepIndex];
  const prevStep = activeStepIndex > 0 ? steps[activeStepIndex - 1] : null;
  const nextStep = activeStepIndex < steps.length - 1 ? steps[activeStepIndex + 1] : null;

  const canAdvanceFromActiveStep = useMemo(() => {
    if (activeStep === "close") return closeStepState.reviewed;
    if (activeStep === "income") return incomeMeta.ready;
    if (activeStep === "budget") return householdItems.length + wifeItems.length + husbandItems.length > 0;
    if (activeStep === "savings") return savingsItems.length > 0;
    return true;
  }, [activeStep, closeStepState.reviewed, householdItems.length, husbandItems.length, incomeMeta.ready, savingsItems.length, wifeItems.length]);

  const completeActiveStep = async () => {
    if (!canAdvanceFromActiveStep) return;
    if (activeStep === "review") {
      try {
        setSaveState("saving");
        setSaveError("");
        const response = await fetch("/api/monthly-planning/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            month: selectedMonth,
            incomeItems,
            householdItems,
            savingsItems,
            snapshot,
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to save shared plan");
        setCompletedSteps((prev) => ({ ...prev, [activeStep]: true }));
        setSaveState("idle");
        onCancel();
        return;
      } catch (error: unknown) {
        setSaveState("error");
        setSaveError(error instanceof Error ? error.message : "Failed to save shared plan");
        return;
      }
    }
    setCompletedSteps((prev) => ({ ...prev, [activeStep]: true }));
    if (nextStep) setActiveStep(nextStep.id);
  };

  const renderStepBody = () => {
    switch (activeStep) {
      case "close":
        return (
          <CloseMonthStep
            selectedMonth={selectedMonth}
            onStateChange={setCloseStepState}
            onOpenAddTransaction={onOpenAddTransaction}
            compact={isCompact}
          />
        );
      case "income":
        return (
          <IncomeStep
            selectedMonth={selectedMonth}
            accounts={accounts}
            value={incomeItems}
            onChange={(items, meta) => {
              setIncomeItems(items);
              setIncomeMeta(meta);
            }}
            compact={isCompact}
          />
        );
      case "budget":
        return (
          <BudgetPlanningStep
            householdItems={householdItems}
            wifeItems={wifeItems}
            husbandItems={husbandItems}
            savingsItems={savingsItems}
            onHouseholdChange={setHouseholdItems}
            onWifeChange={setWifeItems}
            onHusbandChange={setHusbandItems}
            onSavingsChange={setSavingsItems}
            poolRemaining={leftToAssign}
          />
        );
      case "savings":
        return <SavingsStep items={savingsItems} onChange={setSavingsItems} />;
      case "review":
        return (
          <ReviewStep
            snapshot={snapshot}
            incomeItems={incomeItems}
            budgetItems={[...householdItems, ...wifeItems, ...husbandItems]}
            savingsItems={savingsItems}
            hasCloseAttention={closeStepState.needsAttention}
          />
        );
      default:
        return null;
    }
  };


  return (
    <div id="panel-plan" role="tabpanel" aria-labelledby="tab-plan" style={shellStyle}>
      <div className="planning-content" style={{ gap: isCompact ? 12 : 14 }}>
        <div style={sheetStyle}>
          <header style={topBarStyle}>
            <button
              type="button"
              aria-label="Change planning month"
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

            <button onClick={onCancel} aria-label="Close planning" style={closeButtonStyle}>
              <XIcon size={14} />
            </button>
          </header>

          <MonthlyPlanningHeader
            monthLabel={monthLabel}
            snapshot={snapshot}
            isUsingFallbackData={isUsingFallbackData || incomeMeta.source === "mock"}
            compact={isCompact}
          />

          <section
            id={`planning-screen-${activeStep}`}
            role="tabpanel"
            aria-labelledby={`planning-step-${activeStep}`}
            style={{
              ...screenStyle,
              gap: isCompact ? 12 : 14,
              padding: 0,
            }}
          >
            {activeStep !== "close" && (
              <div style={{ ...screenHeaderStyle, gap: 4 }}>
                <div>
                  <h2 style={incomeHeaderTitleStyle}>{activeStepMeta.title}</h2>
                  <p style={incomeHeaderCopyStyle}>{activeStepMeta.description}</p>
                </div>
              </div>
            )}

            {saveError && activeStep === "review" && (
              <div style={warningBannerStyle}>
                <strong style={{ color: "var(--text)" }}>Save failed:</strong> {saveError}
              </div>
            )}

            <div style={screenBodyStyle}>{renderStepBody()}</div>
          </section>

          <div style={footerBarStyle}>
            <div style={{ ...bottomBarInnerStyle, gap: isCompact ? 10 : 12 }}>
              <button
                onClick={() => {
                  if (prevStep) setActiveStep(prevStep.id);
                }}
                style={cancelButtonStyle}
                disabled={!prevStep}
              >
                Back
              </button>
              <button
                onClick={completeActiveStep}
                disabled={!canAdvanceFromActiveStep || saveState === "saving"}
                style={{
                  ...continueButtonStyle,
                  background: canAdvanceFromActiveStep && saveState !== "saving" ? "var(--accent)" : "var(--surface2)",
                  color: canAdvanceFromActiveStep && saveState !== "saving" ? "var(--accent-ink)" : "var(--muted)",
                  cursor: canAdvanceFromActiveStep && saveState !== "saving" ? "pointer" : "not-allowed",
                }}
              >
                {saveState === "saving" ? "Saving..." : nextStep ? activeStepMeta.nextLabel : "Save shared plan"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const shellStyle: CSSProperties = {
  minHeight: "100dvh",
  background: "linear-gradient(180deg, color-mix(in srgb, var(--bg) 94%, white), color-mix(in srgb, var(--surface) 64%, white))",
  padding: "calc(var(--safe-top) + 14px) 14px calc(88px + env(safe-area-inset-bottom, 0px))",
};


const sheetStyle: CSSProperties = {
  background: "color-mix(in srgb, var(--surface) 96%, white)",
  borderRadius: 26,
  padding: "18px 18px 14px",
  display: "grid",
  gap: 14,
  animation: "fadeUp 0.24s ease both",
};

const topBarStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  flexWrap: "nowrap",
};

const eyebrowStyle: CSSProperties = {
  fontFamily: "'DM Mono', monospace",
  fontSize: 10,
  letterSpacing: 0.55,
  textTransform: "uppercase",
  color: "var(--muted)",
};

const monthPickerButtonStyle: CSSProperties = {
  minHeight: 44,
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

const screenStyle: CSSProperties = {
  display: "grid",
  gap: 12,
  border: "none",
  background: "transparent",
  boxShadow: "none",
};

const screenHeaderStyle: CSSProperties = {
  display: "grid",
  gap: 8,
};

const progressTrackStyle: CSSProperties = {
  width: "100%",
  height: 3,
  marginTop: 8,
  borderRadius: 999,
  background: "color-mix(in srgb, var(--surface2) 42%, white)",
  overflow: "hidden",
};

const progressFillStyle: CSSProperties = {
  height: "100%",
  borderRadius: 999,
  background: "var(--text)",
};

const screenTitleStyle: CSSProperties = {
  marginTop: 2,
  fontFamily: "var(--font-display)",
  lineHeight: 1.05,
  letterSpacing: -0.2,
  color: "var(--text)",
};

const screenCopyStyle: CSSProperties = {
  marginTop: 4,
  maxWidth: 460,
  color: "var(--text2)",
  lineHeight: 1.45,
};

const incomeHeaderTitleStyle: CSSProperties = {
  color: "var(--text)",
  fontSize: 14,
  fontWeight: 700,
};

const incomeHeaderCopyStyle: CSSProperties = {
  color: "var(--text2)",
  fontSize: 12,
  lineHeight: 1.4,
  marginTop: 4,
};

const screenBodyStyle: CSSProperties = {
  display: "grid",
  gap: 14,
};

const warningBannerStyle: CSSProperties = {
  maxWidth: "100%",
  padding: "10px 12px",
  borderRadius: 16,
  background: "var(--warning-dim)",
  color: "color-mix(in srgb, var(--warning) 80%, black)",
  fontSize: 13,
  lineHeight: 1.45,
};

const footerBarStyle: CSSProperties = {
  marginTop: 4,
  paddingTop: 12,
};

const bottomBarInnerStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 12,
};

const closeButtonStyle: CSSProperties = {
  width: 44,
  height: 44,
  padding: 8,
  borderRadius: 0,
  border: "none",
  background: "transparent",
  color: "var(--text2)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const cancelButtonStyle: CSSProperties = {
  minHeight: 48,
  borderRadius: 16,
  border: "none",
  background: "color-mix(in srgb, var(--surface2) 54%, white)",
  color: "var(--text)",
  fontSize: 13,
  fontWeight: 600,
};

const continueButtonStyle: CSSProperties = {
  minHeight: 48,
  borderRadius: 16,
  border: "none",
  fontSize: 13,
  fontWeight: 600,
};

const hiddenMonthInputStyle: CSSProperties = {
  position: "absolute",
  pointerEvents: "none",
  opacity: 0,
  width: 0,
  height: 0,
};

