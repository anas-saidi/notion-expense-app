"use client";
import { SheetBody, SheetFooter, SheetHeader } from "./ui/SheetLayout";

import { SavingsFundingTargetPicker } from "./SavingsFundingTargetPicker";
import type { SavingsFundingTarget } from "../../lib/savings-funding";
import { SPENDING_PATTERNS, type SpendingPattern } from "../../lib/spending-pattern";
import { ChoicePicker } from "./ChoicePicker";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { Account, Category, BudgetScope } from "./app-types";
import { assignableOf, fmt, getCategoryScope, scopeFromAccountLabel, today } from "./app-utils";
import { isSavingsCategory } from "./wallet-utils";
import { BottomSheet } from "./ui/BottomSheet";
import { BlurScrollArea } from "./ui/ProgressiveBlur";
import { Money, Currency } from "./Money";
import { CategoryIcon } from "./ui/CategoryIcon";
import { CheckIcon, ChevronDownIcon, FundIcon, PlusIcon, XIcon } from "./ui/icons";
import { Button } from "./ui/Button";
import { SavingCover, guardClose, useBlockingSave } from "./ui/SavingCover";
import type { ContributionAgreement } from "../../lib/contribution-agreements";
import { planAdditionAmounts, type PlanAdditionInput } from "../../lib/plan-addition";
import { Banner } from "./ui/Banner";
import { Switch } from "./ui/Switch";

type CategoryManageSheetProps = {
  open: boolean;
  mode: "fund" | "create" | "edit";
  category: Category | null;
  month: string;
  accounts: Account[];
  defaultScope: BudgetScope;
  availableTypes?: string[];
  defaultType?: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
  zIndex?: number;
  agreement?: ContributionAgreement;
};

export function CategoryManageSheet({
  open,
  mode,
  category,
  month,
  accounts,
  defaultScope,
  availableTypes,
  defaultType,
  onClose,
  onSuccess,
  zIndex,
  agreement,
}: CategoryManageSheetProps) {
  const [updateContributions, setUpdateContributions] = useState(true);
  const [pendingAddition, setPendingAddition] = useState(false);
  const additionDraft = useRef<PlanAdditionInput | null>(null);
  const [savingsTarget, setSavingsTarget] = useState<SavingsFundingTarget>("separate");
  const [pendingSavings, setPendingSavings] = useState(false);
  const savingsDraft = useRef<{ operationId: string; categoryId: string; accountId: string; amount: number; date: string; target: SavingsFundingTarget } | null>(null);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("🧾");
  const [spendingPattern, setSpendingPattern] = useState<SpendingPattern | "">("");
  const [categoryType, setCategoryType] = useState(defaultType ?? availableTypes?.[0] ?? "");
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const save = useBlockingSave();
  const [error, setError] = useState("");
  // A new category rarely needs a pattern on day one, so it waits behind More options.
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);
  // A transfer already made for this funding (amount + accounts), so a retry after a
  // failed funding doesn't move the money a second time.
  const movedRef = useRef<string | null>(null);

  // Scope is always derived from the selected account — never manually set
  const scope: BudgetScope = useMemo(() => {
    const account = accounts.find((a) => a.id === accountId);
    return (account ? scopeFromAccountLabel(account.label) : null) ?? defaultScope;
  }, [accountId, accounts, defaultScope]);

  useEffect(() => {
    if (!open) return;
    setError("");
    setMoreOptionsOpen(false);
    setName(mode === "edit" ? category?.name ?? "" : "");
    setIcon(category?.icon ?? (mode === "edit" ? "" : "🧾"));
    setSpendingPattern(mode === "edit" ? category?.spendingPattern ?? "" : "");
    setCategoryType(mode === "edit" ? category?.type?.[0] ?? "" : defaultType ?? availableTypes?.[0] ?? "");
    // Editing never guesses an account: it rewrites the category's owners.
    setAccountId(category?.defaultAccount ?? (mode === "edit" ? "" : accounts[0]?.id ?? ""));
    setAmount("");
    setUpdateContributions(true); setPendingAddition(false); additionDraft.current = null;
    if (mode === "fund" && category) {
      try {
        const saved = localStorage.getItem(`planAddition:${month}:${category.id}`);
        if (saved) {
          const draft = JSON.parse(saved) as PlanAdditionInput;
          if (draft.categoryId === category.id && draft.month === month && draft.operationId) {
            additionDraft.current = draft; setPendingAddition(true); setAmount(String(draft.amount));
          }
        }
      } catch { /* The mounted request remains available for recovery. */ }
    }
    movedRef.current = null;
    setSavingsTarget("separate"); setPendingSavings(false); savingsDraft.current = null;
    if (mode === "fund" && category && isSavingsCategory(category)) {
      try {
        const stored = localStorage.getItem(`savingsFunding:${category.id}`);
        if (stored) {
          const draft = JSON.parse(stored);
          if (draft.categoryId === category.id && draft.operationId) {
            savingsDraft.current = draft; setPendingSavings(true);
            setAccountId(draft.accountId); setAmount(String(draft.amount)); setSavingsTarget(draft.target);
          }
        }
      } catch { /* The current mounted draft is still retained if storage is unavailable. */ }
    }
  }, [category?.id, open, mode, month]);

  const isCreate = mode === "create";
  const isEdit = mode === "edit";
  const isMetadata = isCreate || isEdit;
  const selectedAccount = accounts.find((account) => account.id === accountId) ?? null;
  const parsedAmount = amount ? Number(amount) : 0;
  const selectedAssignable = selectedAccount ? assignableOf(selectedAccount) : null;
  const keptForJoint = selectedAccount && selectedAccount.readyToAssign !== null && selectedAssignable !== null
    ? Math.round(selectedAccount.readyToAssign - selectedAssignable)
    : 0;
  // Notion reserves a category's money against its Default account, whichever account
  // a funding record names. Funding from another account therefore also has to move the
  // money there, or the source still looks unassigned and the holding account goes short.
  const holdingAccount = mode === "fund" && category?.defaultAccount
    ? accounts.find((account) => sameId(account.id, category.defaultAccount)) ?? null
    : null;
  const canAddToPlan = mode === "fund" && !!category && getCategoryScope(category, accounts) === "joint" && !isSavingsCategory(category) && !!holdingAccount && !/saving/i.test(holdingAccount.label) && scopeFromAccountLabel(holdingAccount.label) === "joint" && agreement?.month === month;
  const addingToPlan = pendingAddition || (canAddToPlan && updateContributions);
  const addedContributions = addingToPlan && agreement && Number.isFinite(parsedAmount) && parsedAmount > 0 ? planAdditionAmounts(parsedAmount, agreement.shares) : null;
  const moveNeeded = !addingToPlan && !!holdingAccount && !!selectedAccount && holdingAccount.id !== selectedAccount.id;
  const moveKey = moveNeeded ? `${selectedAccount.id}>${holdingAccount.id}:${parsedAmount}` : null;
  const canSubmit =
    (!addingToPlan || Boolean(agreement)) &&
    accountId &&
    (isMetadata ? name.trim().length > 0 && (!isEdit || Boolean(category?.id)) : Boolean(category?.id)) &&
    (isMetadata || !category || !isSavingsCategory(category) || Boolean(holdingAccount)) &&
    (isEdit || ((isCreate && !amount) || (Number.isFinite(parsedAmount) && parsedAmount > 0)));

  // Funding a savings category reads as adding to savings.
  const addingToSavings = !isEdit && !isCreate && !!category && isSavingsCategory(category);
  const title = isEdit ? "Edit category" : isCreate ? "New category" : addingToPlan ? `Add to ${category?.name} plan` : addingToSavings ? `Add to ${category?.name}` : `Fund ${category?.name ?? "category"}`;
  const actionLabel = addingToPlan ? "Add to plan"
    : isEdit ? "Save changes" : isCreate ? "Create category" : addingToSavings ? "Add to savings" : "Fund category";

  const submit = async () => {
    if (!canSubmit) return;
    setError("");
    try {
      // Every call in this save (addition, category, deposit, move, funding) runs under one blocking cover.
      const message = await save.run(async (): Promise<string> => {
      let categoryId = category?.id ?? "";
      let categoryName = category?.name ?? name.trim();

      if (addingToPlan && category && agreement) {
        const draft = additionDraft.current ?? { operationId: crypto.randomUUID(), month, categoryId: category.id, amount: parsedAmount, expectedVersion: agreement.version };
        additionDraft.current = draft; setPendingAddition(true);
        // Persist before sending so closing or reloading cannot turn a retry into a new allocation.
        try { localStorage.setItem(`planAddition:${month}:${category.id}`, JSON.stringify(draft)); }
        catch { throw new Error("Could not save recovery details in this browser. Enable browser storage before adding to the plan."); }
        const response = await fetch("/api/monthly-planning/addition", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
        const data = await response.json();
        if (!response.ok) {
          if (!data.pending) {
            additionDraft.current = null; setPendingAddition(false);
            try { localStorage.removeItem(`planAddition:${month}:${category.id}`); } catch {}
          }
          throw new Error(data.pending ? `${data.error} Retry to finish the same addition.` : data.error);
        }
        try { localStorage.removeItem(`planAddition:${month}:${category.id}`); } catch {}
        additionDraft.current = null; setPendingAddition(false);
        return `${category.name} added to plan; contributions updated`;
      }

      if (isMetadata) {
        const createRes = await fetch("/api/categories", {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...(isEdit ? { id: category?.id } : {}), name: name.trim(), icon, scope, type: categoryType, accountId, spendingPattern: spendingPattern || null }),
        });
        const createData = await createRes.json();
        if (!createRes.ok) throw new Error(createData.error || (isEdit ? "Could not save category" : "Could not create category"));
        categoryId = createData.category?.id;
        categoryName = createData.category?.name ?? categoryName;
        if (!categoryId) throw new Error("Category created, but confirmation is missing. Refresh before retrying.");
      }

      if (addingToSavings && category && holdingAccount) {
        const draft = savingsDraft.current ?? {
          operationId: crypto.randomUUID(), categoryId: category.id, accountId,
          amount: parsedAmount, date: today(), target: savingsTarget,
        };
        savingsDraft.current = draft; setPendingSavings(true);
        try { localStorage.setItem(`savingsFunding:${category.id}`, JSON.stringify(draft)); } catch {}
        const response = await fetch("/api/savings-funding", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft),
        });
        const data = await response.json();
        if (!response.ok) {
          if (!data.pending) {
            savingsDraft.current = null; setPendingSavings(false);
            try { localStorage.removeItem(`savingsFunding:${category.id}`); } catch {}
          }
          throw new Error(data.pending ? `${data.error} Retry to finish the same deposit.` : data.error);
        }
        try { localStorage.removeItem(`savingsFunding:${category.id}`); } catch {}
        savingsDraft.current = null; setPendingSavings(false);
        return `${category.name} funded`;
      }

      if (!isEdit && parsedAmount > 0 && moveNeeded && moveKey && movedRef.current !== moveKey) {
        const moveRes = await fetch("/api/account-transfer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fromAccountId: selectedAccount.id,
            toAccountId: holdingAccount.id,
            amount: parsedAmount,
            date: today(),
            note: `To ${categoryName}`,
          }),
        });
        const moveData = await moveRes.json().catch(() => ({}));
        if (!moveRes.ok) throw new Error(moveData.error || `Could not move the money to ${holdingAccount.label}`);
        movedRef.current = moveKey;
      }

      if (!isEdit && parsedAmount > 0) {
        const fundRes = await fetch("/api/monthly-planning/funds", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            month,
            categoryId,
            planned: parsedAmount,
            accountId,
            // "add" creates a separate Additional record — keeps original Monthly plan intact
            mode: isCreate ? "increment" : "add",
          }),
        });
        const fundData = await fundRes.json();
        if (!fundRes.ok) {
          const base = fundData.error || "Could not fund category";
          // The money already moved; say so, so a retry (which won't move it again) makes sense.
          throw new Error(movedRef.current === moveKey && moveNeeded
            ? `${fmt(parsedAmount)} moved to ${holdingAccount?.label}, but funding failed: ${base}`
            : base);
        }
      }

      return isEdit ? `${name.trim()} saved` : parsedAmount > 0 ? `${categoryName} funded` : `${categoryName} created`;
      });
      onSuccess(message);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not save");
    }
  };

  if (!open) return null;
  const close = guardClose(save.saving, onClose);

  const spendingPatternField = <label style={fieldStyle}>
    <span style={labelStyle}>Spending pattern</span>
    <ChoicePicker aria-label="Spending pattern" value={spendingPattern} onChange={(event) => setSpendingPattern(event.target.value as SpendingPattern | "")}>
      <option value="">Not set</option>
      {SPENDING_PATTERNS.map(pattern => <option key={pattern} value={pattern}>{pattern}</option>)}
    </ChoicePicker>
  </label>;

  return (
    <BottomSheet
      open={open}
      onClose={close}
      label={title}
      size="standard"
      detent="content"
      maxHeight="calc(100dvh - 20px)"
      panelStyle={sheetStyle}
      contentStyle={{ paddingTop: 0, overflow: "hidden", display: "flex", minHeight: 0 }}
      zIndex={zIndex}
    >
      <SheetBody style={innerStyle}>
        <SheetHeader style={headerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <CategoryIcon icon={isMetadata ? icon : category?.icon} categoryName={isMetadata ? name : category?.name} style={{ fontSize: 28, flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <h2 style={titleStyle}>{title}</h2>
            </div>
          </div>
          <button type="button" className="sheet-close-button" onClick={close} aria-label="Close">
            <XIcon size={20} />
          </button>
        </SheetHeader>

        <BlurScrollArea style={{ display: "grid", gap: 16, alignContent: "start", overflowY: "auto" }}>
        {isMetadata && (
          <section style={sectionStyle}>
            <label style={fieldStyle}>
              <span style={labelStyle}>Name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Groceries, fuel, gym..."
                className="field-input"
              />
            </label>

            <label style={fieldStyle}>
              <span style={labelStyle}>Type</span>
              <ChoicePicker aria-label="Category type" value={categoryType} onChange={(event) => setCategoryType(event.target.value)}>
                {[...new Set([...(availableTypes ?? []), ...(category?.type ?? [])])].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
                <option value="">No type</option>
              </ChoicePicker>
            </label>

            {isCreate ? <div style={moreOptionsStyle}>
              <Button variant="quiet" size="compact" aria-expanded={moreOptionsOpen} aria-controls="category-more-options" onClick={() => setMoreOptionsOpen(value => !value)} style={{ justifySelf: "start" }}
                icon={<ChevronDownIcon size={16} style={{ transform: moreOptionsOpen ? "rotate(180deg)" : "none", transition: "transform var(--motion-standard) var(--ease-standard)" }} />}>
                More options
              </Button>
              {moreOptionsOpen && <div id="category-more-options">{spendingPatternField}</div>}
            </div> : spendingPatternField}

          </section>
        )}

        <section style={sectionStyle}>
          <label style={fieldStyle}>
            <span style={labelStyle}>{isMetadata ? "Default account" : addingToPlan ? "Budget account" : "Funding account"}</span>
            <ChoicePicker disabled={pendingSavings || pendingAddition || addingToPlan}  aria-label={isMetadata ? "Default account" : addingToPlan ? "Budget account" : "Funding account"} value={addingToPlan ? holdingAccount?.id ?? accountId : accountId} onChange={(event) => setAccountId(event.target.value)}>
              <option value="" disabled>Choose account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.label}</option>
              ))}
            </ChoicePicker>
          </label>

          {addingToSavings && holdingAccount && /joined|joint/i.test(holdingAccount.label) && <SavingsFundingTargetPicker value={savingsTarget} onChange={setSavingsTarget} disabled={pendingSavings} />}

          {!isEdit && <label style={fieldStyle}>
            <span style={labelStyle}>{isCreate ? "Fund this month" : "Amount to add"}</span>
            <div style={amountWrapStyle}>
              <input
                className="display-amount-input"
                disabled={pendingSavings || pendingAddition}
                value={amount}
                onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ""))}
                placeholder={isCreate ? "Optional" : "0"}
                inputMode="decimal"
                aria-label={`${isCreate ? "Fund this month" : "Amount to add"} in MAD`}
                style={amountInputStyle}
              />
              <Currency />
            </div>
          </label>}

          {canAddToPlan && <Switch checked={updateContributions || pendingAddition} disabled={pendingAddition} onChange={setUpdateContributions}>
            Update agreed contributions
          </Switch>}
          {addedContributions && <div aria-live="polite" style={{ display: "grid", gap: 4 }}>
            <div style={accountHintStyle}><span>Anas contribution increase</span><strong>+<Money value={addedContributions.anas} /></strong></div>
            <div style={accountHintStyle}><span>Salma contribution increase</span><strong>+<Money value={addedContributions.salma} /></strong></div>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>No money moves now.</p>
          </div>}

          {isEdit && <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>Owner follows this account.</p>}
          {/* What the partner owes Joint is kept back, so the line says so when it changes the figure. */}
          {!addingToPlan && !isEdit && (!isCreate || parsedAmount > 0) && selectedAssignable !== null && selectedAccount && (
            <p style={accountLineStyle}>
              Unassigned in {selectedAccount.label}: <strong style={accountLineAmountStyle}><Money value={selectedAssignable} /></strong>
              {keptForJoint > 0 && <> ({fmt(keptForJoint)} kept for contributions due)</>}
            </p>
          )}
          {moveNeeded && holdingAccount && selectedAccount && (
            <p style={moveNoteStyle}>
              {category?.name} is held in {holdingAccount.label}.{" "}
              {parsedAmount > 0
                ? `This also moves ${fmt(parsedAmount)} from ${selectedAccount.label} to ${holdingAccount.label}.`
                : `The amount also moves from ${selectedAccount.label} to ${holdingAccount.label}.`}
            </p>
          )}
          {!addingToPlan && !isEdit && selectedAssignable !== null && parsedAmount > Math.max(0, selectedAssignable) && (
            <Banner tone="warning" role="alert" compact>
              This leaves {selectedAccount?.label} short by {fmt(Math.round(parsedAmount - Math.max(0, selectedAssignable)))}.
            </Banner>
          )}
        </section>

        {pendingAddition && !save.saving && !error && <Banner tone="warning" compact>Plan addition unfinished. Retry to complete the same addition.</Banner>}
        {pendingSavings && !save.saving && !error && <Banner tone="warning" compact>Deposit unfinished. Retry to complete it.</Banner>}
        {error && <Banner role="alert" tone="danger" compact>{error}</Banner>}

        </BlurScrollArea>
        <SheetFooter>
          <Button variant="primary" block onClick={submit} disabled={!canSubmit}
            icon={isEdit ? <CheckIcon size={20} /> : isCreate ? <PlusIcon size={20} /> : <FundIcon size={20} />}>
            {actionLabel}
          </Button>
        </SheetFooter>
      </SheetBody>
      <SavingCover saving={save.saving} />
    </BottomSheet>
  );
}

const sheetStyle: CSSProperties = {
  background: "var(--surface)",
  borderRadius: "var(--radius-sheet)",
  overflow: "hidden",
};

const innerStyle: CSSProperties = {
  padding: "16px 24px 24px",
  display: "grid",
  gap: 16,
  gridTemplateRows: "auto minmax(0, 1fr) auto",
  minHeight: 0,
  width: "100%",
  boxSizing: "border-box",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};


const titleStyle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-body)",
  fontSize: 20,
  lineHeight: "24px",
  fontWeight: 600,
  color: "var(--text)",
};

const sectionStyle: CSSProperties = {
  display: "grid",
  gap: 12,
};

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: 8,
};

const labelStyle: CSSProperties = {
  fontSize: 13,
  lineHeight: "16px",
  fontWeight: 600,
  color: "var(--muted)",
};

const moreOptionsStyle: CSSProperties = { display: "grid", gap: 8 };

const amountWrapStyle: CSSProperties = {
  minHeight: 112,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
};

const amountInputStyle: CSSProperties = {
  width: "min(260px, 68vw)",
  height: 88,
  padding: 0,
  border: "none",
  outline: "none",
  background: "transparent",
  color: "var(--text)",
  textAlign: "right",
  fontFamily: "var(--font-body)",
  fontVariantNumeric: "tabular-nums",
};


const moveNoteStyle: CSSProperties = { margin: 0, padding: "8px 12px", borderRadius: "var(--radius-control)", background: "var(--surface2)", fontSize: 12, lineHeight: 1.4, color: "var(--text2)" };
const sameId = (a: string, b: string | null | undefined) => !!b && a.replace(/-/g, "") === b.replace(/-/g, "");

const accountLineStyle: CSSProperties = { margin: 0, fontSize: 13, lineHeight: 1.45, color: "var(--text2)" };
const accountLineAmountStyle: CSSProperties = { color: "var(--text)", fontWeight: 600, fontVariantNumeric: "tabular-nums" };

// Read-only figures are plain label/value rows, never boxed or tinted like inputs.
const accountHintStyle: CSSProperties = {
  minHeight: 44,
  color: "var(--text2)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  fontSize: 13,
  lineHeight: "16px",
};
