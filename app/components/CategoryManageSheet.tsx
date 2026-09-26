"use client";
import { ChoicePicker } from "./ChoicePicker";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { Account, Category, BudgetScope } from "./app-types";
import { assignableOf, fmt, scopeFromAccountLabel } from "./app-utils";
import { isSavingsCategory } from "./wallet-utils";
import { BottomSheet } from "./ui/BottomSheet";
import { Money, Currency } from "./Money";
import { CategoryIcon } from "./ui/CategoryIcon";
import { CheckIcon, FundIcon, PlusIcon, XIcon } from "./ui/icons";
import { Banner } from "./ui/Banner";

// Keep one emoji: typing or picking a new one replaces the previous icon.
const lastGrapheme = (value: string) => {
  const parts = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value.trim())];
  return parts.at(-1)?.segment ?? "";
};

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
}: CategoryManageSheetProps) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("🧾");
  const [categoryType, setCategoryType] = useState(defaultType ?? availableTypes?.[0] ?? "");
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [error, setError] = useState("");

  // Scope is always derived from the selected account — never manually set
  const scope: BudgetScope = useMemo(() => {
    const account = accounts.find((a) => a.id === accountId);
    return (account ? scopeFromAccountLabel(account.label) : null) ?? defaultScope;
  }, [accountId, accounts, defaultScope]);

  useEffect(() => {
    if (!open) return;
    setStatus("idle");
    setError("");
    setName(mode === "edit" ? category?.name ?? "" : "");
    setIcon(category?.icon ?? (mode === "edit" ? "" : "🧾"));
    setCategoryType(mode === "edit" ? category?.type?.[0] ?? "" : defaultType ?? availableTypes?.[0] ?? "");
    // Editing never guesses an account: it rewrites the category's owners.
    setAccountId(category?.defaultAccount ?? (mode === "edit" ? "" : accounts[0]?.id ?? ""));
    setAmount("");
  }, [accounts, availableTypes, category, defaultType, open, mode]);

  const isCreate = mode === "create";
  const isEdit = mode === "edit";
  const isMetadata = isCreate || isEdit;
  const selectedAccount = accounts.find((account) => account.id === accountId) ?? null;
  const parsedAmount = amount ? Number(amount) : 0;
  const selectedAssignable = selectedAccount ? assignableOf(selectedAccount) : null;
  const keptForJoint = selectedAccount && selectedAccount.readyToAssign !== null && selectedAssignable !== null
    ? Math.round(selectedAccount.readyToAssign - selectedAssignable)
    : 0;
  const canSubmit =
    (status === "idle" || status === "error") &&
    accountId &&
    (isMetadata ? name.trim().length > 0 && (!isEdit || Boolean(category?.id)) : Boolean(category?.id)) &&
    (isEdit || ((isCreate && !amount) || (Number.isFinite(parsedAmount) && parsedAmount > 0)));

  // Funding a savings category reads as adding to savings.
  const addingToSavings = !isEdit && !isCreate && !!category && isSavingsCategory(category);
  const title = isEdit ? "Edit category" : isCreate ? "New category" : addingToSavings ? `Add to ${category?.name}` : `Fund ${category?.name ?? "category"}`;
  const actionLabel = useMemo(() => {
    if (status === "saving") return isEdit ? "Saving..." : isCreate ? "Creating..." : "Funding...";
    if (status === "success") return isEdit ? "Saved" : isCreate ? "Created" : "Funded";
    if (status === "error") return "Try again";
    return isEdit ? "Save changes" : isCreate ? "Create category" : addingToSavings ? "Add to savings" : "Fund category";
  }, [isCreate, isEdit, status]);

  const submit = async () => {
    if (!canSubmit) return;
    setStatus("saving");
    setError("");
    try {
      let categoryId = category?.id ?? "";
      let categoryName = category?.name ?? name.trim();

      if (isMetadata) {
        const createRes = await fetch("/api/categories", {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...(isEdit ? { id: category?.id } : {}), name: name.trim(), icon, scope, type: categoryType, accountId }),
        });
        const createData = await createRes.json();
        if (!createRes.ok) throw new Error(createData.error || (isEdit ? "Failed to save category" : "Failed to create category"));
        categoryId = createData.category?.id;
        categoryName = createData.category?.name ?? categoryName;
        if (!categoryId) throw new Error("Category was created without an id");
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
        if (!fundRes.ok) throw new Error(fundData.error || "Failed to fund category");
      }

      setStatus("success");
      onSuccess(isEdit ? `${name.trim()} saved` : parsedAmount > 0 ? `${categoryName} funded` : `${categoryName} created`);
      onClose();
    } catch (err: unknown) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  };

  if (!open) return null;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      label={title}
      maxWidth="520px"
      detent="content"
      maxHeight="calc(100dvh - 20px)"
      panelStyle={sheetStyle}
      contentStyle={{ paddingTop: 0, overflow: "hidden", display: "flex", minHeight: 0 }}
      zIndex={zIndex}
    >
      <div style={innerStyle}>
        <header style={headerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <CategoryIcon icon={isMetadata ? icon : category?.icon} style={{ fontSize: 28, flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <h2 style={titleStyle}>{title}</h2>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={closeStyle}>
            <XIcon strokeWidth={2.2} />
          </button>
        </header>

        <div style={{ display: "grid", gap: 16, alignContent: "start", overflowY: "auto", minHeight: 0 }}>
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

            <div style={twoColStyle}>
              <label style={fieldStyle}>
                <span style={labelStyle}>Icon</span>
                <input value={icon} onChange={(event) => setIcon(lastGrapheme(event.target.value))} placeholder="🧾" aria-label="Icon (one emoji)" className="field-input" />
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
            </div>

          </section>
        )}

        <section style={sectionStyle}>
          <label style={fieldStyle}>
            <span style={labelStyle}>{isMetadata ? "Default account" : "Funding account"}</span>
            <ChoicePicker aria-label={isMetadata ? "Default account" : "Funding account"} value={accountId} onChange={(event) => setAccountId(event.target.value)}>
              <option value="" disabled>Choose account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.icon} {account.label}</option>
              ))}
            </ChoicePicker>
          </label>

          {!isEdit && <label style={fieldStyle}>
            <span style={labelStyle}>{isCreate ? "Fund this month" : "Amount to add"}</span>
            <div style={amountWrapStyle}>
              <input
                value={amount}
                onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ""))}
                placeholder={isCreate ? "Optional" : "0"}
                style={amountInputStyle}
              />
              <Currency />
            </div>
          </label>}

          {isEdit && <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>Owners match the account.</p>}
          {!isEdit && selectedAssignable !== null && selectedAccount && (
            <div style={accountHintStyle}>
              <span>Ready to assign from {selectedAccount.label}</span>
              <strong><Money value={selectedAssignable} /></strong>
            </div>
          )}
          {/* What the partner owes Joint is kept back, so say so when it changes the figure. */}
          {!isEdit && selectedAccount && keptForJoint > 0 && (
            <p style={keptNoteStyle}>{fmt(keptForJoint)} is kept back for your Joint contribution.</p>
          )}
          {!isEdit && selectedAssignable !== null && parsedAmount > Math.max(0, selectedAssignable) && (
            <p role="alert" style={{ ...keptNoteStyle, color: "var(--danger)" }}>
              This leaves {selectedAccount?.label} short by {fmt(Math.round(parsedAmount - Math.max(0, selectedAssignable)))}.
            </p>
          )}
        </section>

        {error && <Banner role="alert" tone="danger" compact>{error}</Banner>}

        </div>
        <button type="button" onClick={submit} disabled={!canSubmit} style={{ ...submitStyle, opacity: canSubmit ? 1 : 0.48 }}>
          {status === "success" && <CheckIcon size={16} />}
          {status === "idle" && (isEdit ? <CheckIcon size={16} /> : isCreate ? <PlusIcon size={16} strokeWidth={2.3} /> : <FundIcon size={16} strokeWidth={2.3} />)}
          {actionLabel}
        </button>
      </div>
    </BottomSheet>
  );
}

const sheetStyle: CSSProperties = {
  background: "color-mix(in srgb, var(--surface) 98%, var(--surface))",
  borderRadius: "var(--radius-sheet)",
  overflow: "hidden",
};

const innerStyle: CSSProperties = {
  padding: "18px 18px 22px",
  display: "grid",
  gap: 16,
  gridTemplateRows: "auto minmax(0, 1fr) auto",
  minHeight: 0,
  width: "100%",
  boxSizing: "border-box",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
};


const titleStyle: CSSProperties = {
  margin: "4px 0 0",
  fontFamily: "var(--font-display)",
  fontSize: 26,
  lineHeight: 1,
  color: "var(--text)",
};

const closeStyle: CSSProperties = {
  width: 44,
  height: 44,
  border: "none",
  background: "transparent",
  color: "var(--text2)",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const sectionStyle: CSSProperties = {
  display: "grid",
  gap: 12,
};

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: 7,
};

const labelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "var(--text2)",
};

const twoColStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 0.72fr) minmax(0, 1fr)",
  gap: 10,
};

const amountWrapStyle: CSSProperties = {
  minHeight: 56,
  borderRadius: "var(--radius-control)",
  border: "1px solid var(--border)",
  background: "var(--surface)",
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "0 14px",
};

const amountInputStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  border: "none",
  outline: "none",
  background: "transparent",
  color: "var(--text2)",
  fontFamily: "var(--font-display)",
  fontSize: 28,
  fontWeight: 800,
};


const keptNoteStyle: CSSProperties = { margin: 0, fontSize: 12, lineHeight: 1.35, color: "var(--muted)" };

const accountHintStyle: CSSProperties = {
  minHeight: 42,
  borderRadius: 14,
  background: "color-mix(in srgb, var(--accent) 8%, var(--surface))",
  color: "var(--text2)",
  padding: "0 12px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  fontSize: 12,
};

const submitStyle: CSSProperties = {
  width: "100%",
  minHeight: 52,
  borderRadius: 14,
  border: "none",
  background: "var(--accent)",
  color: "var(--accent-ink)",
  fontWeight: 800,
  fontSize: 15,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
};
