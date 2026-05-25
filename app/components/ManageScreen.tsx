"use client";

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import type { Account, Category } from "./app-types";
import { Money } from "./Money";
import { CategoryIcon } from "./ui/CategoryIcon";
import {
  ArrowLeftIcon,
  BanknoteIcon,
  ChevronRightIcon,
  FreezeIcon,
  FundIcon,
  PlusIcon,
  ReviveIcon,
  TransferIcon,
  XIcon,
} from "./ui/icons";

type ManageScreenProps = {
  categories: Category[];
  frozenCategories: Category[];
  accounts: Account[];
  onClose: () => void;
  onNewCategory: () => void;
  onOpenCategory: (category: Category) => void;
  onFundCategory: (category: Category) => void;
  onFreezeCategory: (category: Category) => void;
  onReviveCategory: (category: Category) => void;
  onAddIncome: (account: Account) => void;
  onTransferMoney: (account: Account) => void;
};

type ManageView = "menu" | "categories" | "accounts";
type CategoryChip = "active" | "frozen";

export function ManageScreen({
  categories,
  frozenCategories,
  accounts,
  onClose,
  onNewCategory,
  onOpenCategory,
  onFundCategory,
  onFreezeCategory,
  onReviveCategory,
  onAddIncome,
  onTransferMoney,
}: ManageScreenProps) {
  const [view, setView] = useState<ManageView>("menu");
  const [categoryChip, setCategoryChip] = useState<CategoryChip>("active");

  const visibleCategories = categoryChip === "active" ? categories : frozenCategories;
  const totalReady = useMemo(
    () => accounts.reduce((sum, account) => sum + (account.readyToAssign ?? 0), 0),
    [accounts],
  );

  return (
    <main style={screenStyle}>
      <header style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>{view === "menu" ? "Manage" : "Manage / " + view}</div>
          <h1 style={titleStyle}>{view === "menu" ? "Tools" : view === "categories" ? "Categories" : "Accounts"}</h1>
        </div>
        <button type="button" onClick={view === "menu" ? onClose : () => setView("menu")} aria-label={view === "menu" ? "Close manage screen" : "Back to manage menu"} style={closeStyle}>
          {view === "menu" ? <XIcon size={18} /> : <><ArrowLeftIcon size={16} />Back</>}
        </button>
      </header>

      {view === "menu" && (
        <section style={menuGridStyle}>
          <MenuRow
            title="Categories"
            meta={`${categories.length} active / ${frozenCategories.length} frozen`}
            onClick={() => setView("categories")}
          />
          <MenuRow
            title="Accounts"
            meta={`${accounts.length} accounts / ${formatAmount(totalReady)} ready`}
            onClick={() => setView("accounts")}
          />
          <div style={disabledRowStyle}>
            <div>
              <strong style={rowTitleStyle}>Settings</strong>
              <p style={rowMetaStyle}>App preferences later</p>
            </div>
          </div>
        </section>
      )}

      {view === "categories" && (
        <section style={contentStyle}>
          <div style={toolbarStyle}>
            <div style={chipsStyle} role="tablist" aria-label="Category state">
              <Chip active={categoryChip === "active"} onClick={() => setCategoryChip("active")}>Active</Chip>
              <Chip active={categoryChip === "frozen"} onClick={() => setCategoryChip("frozen")}>Frozen</Chip>
            </div>
            <button type="button" onClick={onNewCategory} style={newButtonStyle}>
              <PlusIcon size={15} />
              New
            </button>
          </div>

          <div style={listStyle}>
            {visibleCategories.map((category) => (
              <article key={category.id} style={categoryRowStyle}>
                <button type="button" onClick={() => onOpenCategory(category)} style={categoryMainStyle}>
                  <CategoryIcon icon={category.icon} style={rowIconStyle} />
                  <div style={{ minWidth: 0 }}>
                    <strong style={rowTitleStyle}>{category.name}</strong>
                    <p style={rowMetaStyle}>{scopeLabel(category)} · {category.type[0] ?? "Budget"}</p>
                  </div>
                </button>
                <div style={rowActionsStyle}>
                  {categoryChip === "frozen" ? (
                    <IconActionButton
                      icon={<ReviveIcon size={15} strokeWidth={2.2} />}
                      label="Revive"
                      ariaLabel={`Revive ${category.name}`}
                      onClick={() => onReviveCategory(category)}
                    />
                  ) : (
                    <>
                      <IconActionButton
                        icon={<FundIcon size={15} strokeWidth={2.2} />}
                        label="Fund"
                        ariaLabel={`Fund ${category.name}`}
                        onClick={() => onFundCategory(category)}
                      />
                      <IconActionButton
                        icon={<FreezeIcon size={15} strokeWidth={2.2} />}
                        label="Freeze"
                        ariaLabel={`Freeze ${category.name}`}
                        tone="quiet"
                        onClick={() => onFreezeCategory(category)}
                      />
                    </>
                  )}
                </div>
              </article>
            ))}

            {visibleCategories.length === 0 && (
              <div style={emptyStyle}>
                {categoryChip === "frozen" ? "No frozen categories." : "No active categories."}
              </div>
            )}
          </div>
        </section>
      )}

      {view === "accounts" && (
        <section style={contentStyle}>
          <div style={summaryBandStyle}>
            <span>Total ready to assign</span>
            <strong><Money value={totalReady} /></strong>
          </div>
          <div style={listStyle}>
            {accounts.map((account) => (
              <article key={account.id} style={accountRowStyle}>
                <div style={accountIconStyle}>{account.icon}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <strong style={rowTitleStyle}>{account.label}</strong>
                  <p style={rowMetaStyle}>{account.type ?? "Account"}</p>
                </div>
                <div style={amountStackStyle}>
                  <strong><Money value={account.balance ?? 0} /></strong>
                  <span>Ready <Money value={account.readyToAssign ?? 0} /></span>
                </div>
                <div style={accountActionsStyle}>
                  <IconActionButton
                    icon={<TransferIcon size={15} strokeWidth={2.2} />}
                    label="Move"
                    ariaLabel={`Move money from ${account.label}`}
                    onClick={() => onTransferMoney(account)}
                  />
                  <IconActionButton
                    icon={<BanknoteIcon size={15} strokeWidth={2.2} />}
                    label="Income"
                    ariaLabel={`Add income to ${account.label}`}
                    onClick={() => onAddIncome(account)}
                  />
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function MenuRow({ title, meta, onClick }: { title: string; meta: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={menuRowStyle}>
      <div>
        <strong style={rowTitleStyle}>{title}</strong>
        <p style={rowMetaStyle}>{meta}</p>
      </div>
      <ChevronRightIcon size={18} />
    </button>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} style={{ ...chipStyle, ...(active ? chipActiveStyle : null) }}>
      {children}
    </button>
  );
}

function IconActionButton({
  icon,
  label,
  ariaLabel,
  tone = "default",
  onClick,
}: {
  icon: ReactNode;
  label: string;
  ariaLabel: string;
  tone?: "default" | "quiet";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      title={label}
      style={tone === "quiet" ? quietActionButtonStyle : actionButtonStyle}
    >
      <span style={actionIconStyle} aria-hidden="true">{icon}</span>
      <span style={actionLabelStyle}>{label}</span>
    </button>
  );
}

function scopeLabel(category: Category) {
  if (category.isTeamFund) return "Joint";
  const owner = category.owner?.toLowerCase() ?? "";
  if (owner.includes("salma") || owner.includes("wife")) return "Salma";
  if (owner.includes("anas") || owner.includes("husband")) return "Anas";
  return "Unscoped";
}

function formatAmount(value: number) {
  return `${Math.round(value).toLocaleString("fr-MA")} MAD`;
}

const screenStyle: CSSProperties = {
  minHeight: "100dvh",
  padding: "calc(env(safe-area-inset-top, 0px) + 20px) calc(env(safe-area-inset-right, 0px) + 18px) calc(env(safe-area-inset-bottom, 0px) + 24px) calc(env(safe-area-inset-left, 0px) + 18px)",
  background: "var(--bg)",
  display: "grid",
  alignContent: "start",
  gap: 22,
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
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
  margin: "4px 0 0",
  fontFamily: "var(--font-display)",
  fontSize: 34,
  lineHeight: 0.95,
  color: "var(--text)",
};

const closeStyle: CSSProperties = {
  minWidth: 44,
  height: 44,
  padding: "0 12px",
  borderRadius: 14,
  border: "1px solid color-mix(in srgb, var(--border2) 66%, transparent)",
  background: "color-mix(in srgb, var(--surface2) 50%, white)",
  color: "var(--text2)",
  fontWeight: 750,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
};

const menuGridStyle: CSSProperties = {
  display: "grid",
  gap: 10,
};

const menuRowStyle: CSSProperties = {
  width: "100%",
  minHeight: 76,
  border: "1px solid var(--card-border)",
  borderRadius: 18,
  background: "var(--surface)",
  color: "var(--text)",
  padding: "0 16px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 14,
  textAlign: "left",
  cursor: "pointer",
};

const disabledRowStyle: CSSProperties = {
  ...menuRowStyle,
  opacity: 0.52,
  cursor: "default",
};

const rowTitleStyle: CSSProperties = {
  display: "block",
  fontSize: 15,
  fontWeight: 760,
  color: "var(--text)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const rowMetaStyle: CSSProperties = {
  margin: "6px 0 0",
  fontSize: 12,
  color: "var(--muted)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const contentStyle: CSSProperties = {
  display: "grid",
  gap: 14,
};

const toolbarStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
};

const chipsStyle: CSSProperties = {
  display: "inline-flex",
  gap: 6,
  padding: 4,
  borderRadius: 16,
  border: "1px solid color-mix(in srgb, var(--border) 55%, transparent)",
  background: "color-mix(in srgb, var(--surface2) 45%, white)",
};

const chipStyle: CSSProperties = {
  minHeight: 38,
  padding: "0 13px",
  borderRadius: 12,
  border: "none",
  background: "transparent",
  color: "var(--muted)",
  fontSize: 13,
  fontWeight: 780,
  cursor: "pointer",
};

const chipActiveStyle: CSSProperties = {
  background: "var(--surface)",
  color: "var(--text)",
};

const newButtonStyle: CSSProperties = {
  minHeight: 44,
  padding: "0 13px",
  borderRadius: 14,
  border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
  background: "var(--accent)",
  color: "var(--accent-ink)",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
};

const listStyle: CSSProperties = {
  display: "grid",
  gap: 8,
};

const categoryRowStyle: CSSProperties = {
  minHeight: 70,
  borderRadius: 18,
  border: "1px solid var(--card-border)",
  background: "var(--surface)",
  padding: "12px 14px",
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 8,
};

const categoryMainStyle: CSSProperties = {
  flex: 1,
  flexBasis: 180,
  minWidth: 0,
  border: "none",
  background: "transparent",
  display: "flex",
  alignItems: "center",
  gap: 11,
  textAlign: "left",
  cursor: "pointer",
};

const rowIconStyle: CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 14,
  background: "color-mix(in srgb, var(--surface2) 58%, white)",
  border: "1px solid color-mix(in srgb, var(--border) 55%, transparent)",
};

const actionButtonStyle: CSSProperties = {
  minHeight: 44,
  padding: "0 11px",
  borderRadius: 14,
  border: "1px solid color-mix(in srgb, var(--border2) 66%, transparent)",
  background: "color-mix(in srgb, var(--surface2) 54%, white)",
  color: "var(--text2)",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  whiteSpace: "nowrap",
};

const quietActionButtonStyle: CSSProperties = {
  ...actionButtonStyle,
  background: "transparent",
  color: "var(--muted)",
};

const rowActionsStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  marginLeft: "auto",
  flexShrink: 0,
};

const actionIconStyle: CSSProperties = {
  width: 18,
  height: 18,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const actionLabelStyle: CSSProperties = {
  lineHeight: 1,
};

const emptyStyle: CSSProperties = {
  padding: "22px 10px",
  color: "var(--muted)",
  fontSize: 14,
  textAlign: "center",
};

const summaryBandStyle: CSSProperties = {
  minHeight: 58,
  borderRadius: 18,
  background: "color-mix(in srgb, var(--accent) 9%, white)",
  color: "var(--text2)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 14,
  padding: "0 14px",
  fontSize: 13,
};

const accountRowStyle: CSSProperties = {
  minHeight: 72,
  borderRadius: 18,
  border: "1px solid var(--card-border)",
  background: "var(--surface)",
  padding: "14px 16px",
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 12,
};

const accountIconStyle: CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 14,
  background: "color-mix(in srgb, var(--surface2) 58%, white)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const amountStackStyle: CSSProperties = {
  display: "grid",
  gap: 3,
  justifyItems: "end",
  fontSize: 12,
  color: "var(--text2)",
  marginLeft: "auto",
  flexShrink: 0,
};

const accountActionsStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  marginLeft: "auto",
  flexShrink: 0,
};
