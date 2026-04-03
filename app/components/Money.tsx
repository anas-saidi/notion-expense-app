import { type CSSProperties } from "react";
import { fmt, MONEY_CURRENCY } from "./app-utils";

type MoneyProps = {
  value: number;
  absolute?: boolean;
  showCurrency?: boolean;
  currencyLabel?: string;
  currencyStyle?: CSSProperties;
};

export function Money({
  value,
  absolute = false,
  showCurrency = true,
  currencyLabel = MONEY_CURRENCY,
  currencyStyle,
}: MoneyProps) {
  const displayValue = absolute ? Math.abs(value) : value;

  return (
    <span style={moneyWrapStyle}>
      <span>{fmt(displayValue)}</span>
      {showCurrency && (
        <span style={{ ...currencyBaseStyle, ...currencyStyle }}>{currencyLabel}</span>
      )}
    </span>
  );
}

const moneyWrapStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "baseline",
  gap: 6,
};

const currencyBaseStyle: CSSProperties = {
  fontFamily: "'DM Mono', monospace",
  fontSize: "0.65em",
  letterSpacing: 0.4,
  textTransform: "uppercase",
  opacity: 0.6,
};
