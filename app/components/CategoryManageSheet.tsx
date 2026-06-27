"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { Account, Category, BudgetScope } from "./app-types";
import { BottomSheet } from "./ui/BottomSheet";
import { Money } from "./Money";
import { CategoryIcon } from "./ui/CategoryIcon";
import { CheckIcon, FundIcon, PlusIcon, XIcon } from "./ui/icons";

type CategoryManageSheetProps = {
  open: boolean;
  mode: "fund" | "create";
  category: Category | null;
  month: string;
  accounts: Account[];
  defaultScope: BudgetScope;
  onClose: () => void;
  onSuccess: (message: string) => void;
};

const SCOPE_OPTIONS: Array<{ value: BudgetScope; label: string }> = [
  { value: "joint", label: "Joint" },
  { value: "anas", label: "Anas" },
  { value: "salma", label: "Salma" },
];

export function CategoryManageSheet({
  open,
  mode,
  category,
  month,
  accounts,
  defaultScope,
  onClose,
  onSuccess,
}: CategoryManageSheetProps) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("🧾");
  const [scope, setScope] = useState<BudgetScope>(defaultScope);
  const [kind, setKind] = useState<"budget" | "savings">("budget");
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setStatus("idle");
    setError("");
    setName("");
    setIcon(category?.icon ?? "🧾");
    setScope(defaultScope);
    setKind("budget");
    setAccountId(category?.defaultAccount ?? accounts[0]?.id ?? "");
    setAmount("");
  }, [accounts, category, defaultScope, open]);

  const isCreate = mode === "create";
  const selectedAccount = accounts.find((account) => account.id === accountId) ?? null;
  const parsedAmount = amount ? Number(amount) : 0;
  const canSubmit =
    status === "idle" &&
    accountId &&
    (isCreate ? name.trim().length > 0 : Boolean(category?.id)) &&
    (!amount || (Number.isFinite(parsedAmount) && parsedAmount > 0));

  const title = isCreate ? "New category" : `Fund ${category?.name ?? "category"}`;
  const eyebrow = isCreate ? "Budget setup" : "Monthly funding";
  const actionLabel = useMemo(() => {
    if (status === "saving") return isCreate ? "Creating..." : "Funding...";
    if (status === "success") return isCreate ? "Created" : "Funded";
    if (status === "error") return "Try again";
    return isCreate ? "Create category" : "Fund category";
  }, [isCreate, status]);

  const submit = async () => {
    if (!canSubmit) return;
    setStatus("saving");
    setError("");
    try {
      let categoryId = category?.id ?? "";
      let categoryName = category?.name ?? name.trim();

      if (isCreate) {
        const createRes = await fetch("/api/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), icon, scope, kind, accountId }),
        });
        const createData = await createRes.json();
        if (!createRes.ok) throw new Error(createData.error || "Failed to create category");
        categoryId = createData.category?.id;
        categoryName = createData.category?.name ?? categoryName;
        if (!categoryId) throw new Error("Category was created without an id");
      }

      if (parsedAmount > 0) {
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
      onSuccess(parsedAmount > 0 ? `${categoryName} funded` : `${categoryName} created`);
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
      contentStyle={{ paddingTop: 0 }}
    >
      <div style={innerStyle}>
        <header style={headerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <CategoryIcon icon={isCreate ? icon : category?.icon} style={{ fontSize: 28, flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div style={eyebrowStyle}>{eyebrow}</div>
              <h2 style={titleStyle}>{title}</h2>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={closeStyle}>
            <XIcon strokeWidth={2.2} />
          </button>
        </header>

        {isCreate && (
          <section style={sectionStyle}>
            <label style={fieldStyle}>
              <span style={labelStyle}>Name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Groceries, fuel, gym..."
                style={inputStyle}
              />
            </label>

            <div style={twoColStyle}>
              <label style={fieldStyle}>
                <span style={labelStyle}>Icon</span>
                <input value={icon} onChange={(event) => setIcon(event.target.value.slice(0, 4))} style={inputStyle} />
              </label>
              <label style={fieldStyle}>
                <span style={labelStyle}>Type</span>
                <select value={kind} onChange={(event) => setKind(event.target.value as "budget" | "savings")} style={inputStyle}>
                  <option value="budget">Budget</option>
                  <option value="savings">Savings</option>
                </select>
              </label>
            </div>

            <div style={fieldStyle}>
              <span style={labelStyle}>Scope</span>
              <div style={segmentedStyle}>
                {SCOPE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setScope(option.value)}
                    aria-pressed={scope === option.value}
                    style={{ ...segmentStyle, ...(scope === option.value ? segmentActiveStyle : null) }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        <section style={sectionStyle}>
          <label style={fieldStyle}>
            <span style={labelStyle}>Default account</span>
            <select value={accountId} onChange={(event) => setAccountId(event.target.value)} style={inputStyle}>
              <option value="" disabled>Choose account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.icon} {account.label}</option>
              ))}
            </select>
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>{isCreate ? "Fund this month" : "Amount to add"}</span>
            <div style={amountWrapStyle}>
              <input
                value={amount}
                onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ""))}
                placeholder={isCreate ? "Optional" : "0"}
                inputMode="decimal"
                style={amountInputStyle}
              />
              <span style={currencyStyle}>MAD</span>
            </div>
          </label>

          {selectedAccount?.readyToAssign !== null && selectedAccount?.readyToAssign !== undefined && (
            <div style={accountHintStyle}>
              <span>Ready to assign from {selectedAccount.label}</span>
              <strong><Money value={selectedAccount.readyToAssign} /></strong>
            </div>
          )}
        </section>

        {error && <div style={errorStyle}>{error}</div>}

        <button type="button" onClick={submit} disabled={!canSubmit} style={{ ...submitStyle, opacity: canSubmit ? 1 : 0.48 }}>
          {status === "success" && <CheckIcon size={16} />}
          {status === "idle" && (isCreate ? <PlusIcon size={16} strokeWidth={2.3} /> : <FundIcon size={16} strokeWidth={2.3} />)}
          {actionLabel}
        </button>
      </div>
    </BottomSheet>
  );
}

const sheetStyle: CSSProperties = {
  background: "color-mix(in srgb, var(--surface) 98%, white)",
  borderRadius: 20,
  overflow: "hidden",
};

const innerStyle: CSSProperties = {
  padding: "18px 18px 22px",
  display: "grid",
  gap: 18,
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
};


const eyebrowStyle: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 10,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  color: "var(--muted)",
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

const inputStyle: CSSProperties = {
  width: "100%",
  minHeight: 48,
  borderRadius: 14,
  border: "1px solid transparent",
  boxShadow: "inset 0 0 0 1.5px var(--border2)",
  background: "color-mix(in srgb, var(--surface2) 34%, white)",
  color: "var(--text2)",
  padding: "0 13px",
  fontSize: 15,
  outline: "none",
  boxSizing: "border-box",
};

const twoColStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 0.72fr) minmax(0, 1fr)",
  gap: 10,
};

const segmentedStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 6,
  padding: 4,
  borderRadius: 16,
  background: "color-mix(in srgb, var(--surface2) 44%, white)",
  border: "1px solid color-mix(in srgb, var(--border) 50%, transparent)",
};

const segmentStyle: CSSProperties = {
  minHeight: 40,
  border: "none",
  borderRadius: 12,
  background: "transparent",
  color: "var(--muted)",
  fontSize: 13,
  fontWeight: 750,
  cursor: "pointer",
};

const segmentActiveStyle: CSSProperties = {
  background: "var(--surface)",
  color: "var(--text2)",
  boxShadow: "0 1px 0 color-mix(in srgb, var(--ink-strong) 7%, transparent)",
};

const amountWrapStyle: CSSProperties = {
  minHeight: 56,
  borderRadius: 16,
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

const currencyStyle: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 12,
  color: "var(--muted)",
};

const accountHintStyle: CSSProperties = {
  minHeight: 42,
  borderRadius: 14,
  background: "color-mix(in srgb, var(--accent) 8%, white)",
  color: "var(--text2)",
  padding: "0 12px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  fontSize: 12,
};

const errorStyle: CSSProperties = {
  borderRadius: 14,
  background: "color-mix(in srgb, var(--danger) 9%, white)",
  color: "color-mix(in srgb, var(--danger) 54%, var(--text))",
  padding: "11px 12px",
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
