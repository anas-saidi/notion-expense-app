import type { CSSProperties, ReactNode } from "react";
import { Money } from "../Money";

export type TransactionTone = "expense" | "income" | "transfer";

type TransactionRowProps = {
  title: string;
  subtitle?: string | null;
  amount: number;
  tone: TransactionTone;
  prefix?: string;
  date?: string | null;
  icon: ReactNode;
  onClick?: () => void;
  className?: string;
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
}: TransactionRowProps) {
  const content = (
    <>
      <span style={iconStyle(tone)} aria-hidden="true">{icon}</span>
      <span style={copyStyle}>
        <span style={titleStyle}>{title}</span>
        {subtitle && <span style={subtitleStyle}>{subtitle}</span>}
      </span>
      <span style={valueStackStyle}>
        <span style={amountStyle(tone)}>
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

const amountStyle = (tone: TransactionTone): CSSProperties => ({
  minHeight: 26,
  padding: "3px 7px",
  borderRadius: 8,
  display: "inline-flex",
  alignItems: "center",
  gap: 0,
  background: tone === "income"
    ? "color-mix(in srgb, var(--action-income) 13%, var(--surface))"
    : tone === "transfer"
      ? "color-mix(in srgb, var(--action-transfer) 12%, var(--surface))"
      : "color-mix(in srgb, var(--spend-over) 11%, var(--surface))",
  color: tone === "income"
    ? "var(--success)"
    : tone === "transfer"
      ? "color-mix(in srgb, var(--action-transfer) 68%, var(--text))"
      : "var(--spend-over-deep)",
  fontSize: 14,
  lineHeight: 1,
  fontWeight: 700,
  fontVariantNumeric: "tabular-nums",
});

const dateStyle: CSSProperties = { fontSize: 12, lineHeight: 1, fontWeight: 400, color: "var(--muted)" };
