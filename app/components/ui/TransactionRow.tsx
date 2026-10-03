import type { CSSProperties, ReactNode } from "react";
import { Money } from "../Money";

export type TransactionTone = "expense" | "income" | "transfer";

type TransactionRowProps = {
  title: string;
  subtitle?: ReactNode;
  amount: number;
  tone: TransactionTone;
  prefix?: string;
  date?: string | null;
  icon: ReactNode;
  onClick?: () => void;
  className?: string;
  /** Due amounts retain the shared typography without implying recorded spending. */
  amountColor?: string;
};

export function TransactionRow({
  title,
  subtitle,
  amount,
  tone,
  prefix = tone === "income" ? "+" : tone === "transfer" ? "↔" : "−",
  date,
  icon,
  onClick,
  className = "",
  amountColor,
}: TransactionRowProps) {
  const content = (
    <>
      <span style={iconStyle(tone)} aria-hidden="true">{icon}</span>
      <span style={copyStyle}>
        <span style={titleStyle}>{title}</span>
        {subtitle && <span style={subtitleStyle}>{subtitle}</span>}
      </span>
      <span style={valueStackStyle}>
        <span style={{ ...amountStyle(tone), ...(amountColor ? { color: amountColor } : {}) }}>
          <span style={{ display: "inline-flex", alignItems: "baseline" }}>
          <span>{prefix}</span>
            <Money value={Math.abs(amount)} />
          </span>
        </span>
        {date && <span style={dateStyle}>{date}</span>}
      </span>
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={`tx-row transaction-row ${className}`.trim()} onClick={onClick} style={{ ...rowStyle, cursor: "pointer" }}>
        {content}
      </button>
    );
  }

  return <div className={`tx-row transaction-row ${className}`.trim()} style={{ ...rowStyle, cursor: "default" }}>{content}</div>;
}

const rowStyle: CSSProperties = {
  width: "100%",
  minHeight: 64,
  padding: "10px 2px",
  border: 0,
  background: "transparent",
  color: "inherit",
  font: "inherit",
  textAlign: "left",
};

const iconStyle = (tone: TransactionTone): CSSProperties => ({
  width: 24,
  height: 24,
  flexShrink: 0,
  borderRadius: 8,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: tone === "income"
    ? "color-mix(in srgb, var(--action-income) 12%, var(--surface))"
    : tone === "transfer"
      ? "color-mix(in srgb, var(--action-transfer) 11%, var(--surface))"
      : "transparent",
  color: tone === "income"
    ? "var(--action-income)"
    : tone === "transfer"
      ? "var(--action-transfer)"
      : "var(--text2)",
});

const copyStyle: CSSProperties = { flex: 1, minWidth: 0, display: "grid", gap: 3 };
const titleStyle: CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13, lineHeight: 1.2, fontWeight: 500, color: "var(--text2)" };
const subtitleStyle: CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, lineHeight: 1.2, color: "var(--muted)" };
const valueStackStyle: CSSProperties = { display: "grid", justifyItems: "end", gap: 6, flexShrink: 0, whiteSpace: "nowrap" };

/** Signed-amount colour shared by every place that shows a transaction's amount. */
export const signedAmountColor = (tone: TransactionTone) => tone === "income"
  ? "var(--success)"
  : tone === "transfer"
    ? "color-mix(in srgb, var(--action-transfer) 68%, var(--text))"
    : "var(--spend-over-deep)";

/** The signed amount is coloured text, not a pill: the colour alone says expense, income or transfer. */
const amountStyle = (tone: TransactionTone): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 0,
  color: signedAmountColor(tone),
  fontSize: 15,
  lineHeight: 1,
  fontWeight: 650,
  fontVariantNumeric: "tabular-nums",
});

const dateStyle: CSSProperties = { fontSize: 12, lineHeight: 1, fontWeight: 400, color: "var(--muted)" };
