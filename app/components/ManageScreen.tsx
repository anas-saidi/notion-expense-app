"use client";

import { useMemo, type CSSProperties, type ReactNode } from "react";
import type { Account } from "./app-types";
import { Money } from "./Money";
import {
  BanknoteIcon,
  TransferIcon,
  XIcon,
} from "./ui/icons";

type ManageScreenProps = {
  accounts: Account[];
  onClose: () => void;
  onAddIncome: (account: Account) => void;
  onTransferMoney: (account: Account) => void;
};

export function ManageScreen({
  accounts,
  onClose,
  onAddIncome,
  onTransferMoney,
}: ManageScreenProps) {
  const totalReady = useMemo(
    () => accounts.reduce((sum, account) => sum + (account.readyToAssign ?? 0), 0),
    [accounts],
  );

  return (
    <main style={screenStyle}>
      <header style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>Manage</div>
          <h1 style={titleStyle}>Accounts</h1>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" style={closeStyle}>
          <XIcon size={18} />
        </button>
      </header>

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
    </main>
  );
}

function IconActionButton({
  icon,
  label,
  ariaLabel,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  ariaLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      title={label}
      style={actionButtonStyle}
    >
      <span style={actionIconStyle} aria-hidden="true">{icon}</span>
      <span style={actionLabelStyle}>{label}</span>
    </button>
  );
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
  fontFamily: "var(--font-body)",
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
  border: "none",
  background: "transparent",
  color: "var(--text2)",
  fontWeight: 750,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
};

const contentStyle: CSSProperties = {
  display: "grid",
  gap: 14,
};

const listStyle: CSSProperties = {
  display: "grid",
  gap: 8,
};

const rowTitleStyle: CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "var(--text2)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const rowMetaStyle: CSSProperties = {
  marginTop: 4,
  fontSize: 11,
  color: "var(--muted)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const summaryBandStyle: CSSProperties = {
  minHeight: 58,
  borderRadius: 14,
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
  borderRadius: 14,
  border: "none",
  background: "var(--surface)",
  padding: "14px 16px",
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 12,
  boxShadow: "0 1px 0 color-mix(in srgb, var(--ink-strong) 4%, transparent)",
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

const actionButtonStyle: CSSProperties = {
  minHeight: 44,
  padding: "0 11px",
  borderRadius: 14,
  border: "1px solid color-mix(in srgb, var(--border2) 66%, transparent)",
  background: "color-mix(in srgb, var(--surface2) 54%, white)",
  color: "var(--text2)",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  whiteSpace: "nowrap",
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
