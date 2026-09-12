import { type CSSProperties } from "react";
import { fmt, MONEY_CURRENCY } from "./app-utils";
import { AnimatedCounter } from "./ui/AnimatedCounter";

type MoneyProps = {
  value: number;
  absolute?: boolean;
  showCurrency?: boolean;
  currencyLabel?: string;
  currencyStyle?: CSSProperties;
  animated?: boolean;
  animateOnMount?: boolean;
};

export function Money({
  value,
  absolute = false,
  showCurrency = true,
  currencyLabel = MONEY_CURRENCY,
  currencyStyle,
  animated = false,
  animateOnMount = false,
}: MoneyProps) {
  const displayValue = absolute ? Math.abs(value) : value;

  return (
    <span style={moneyWrapStyle}>
      {animated
        ? <AnimatedCounter value={displayValue} animateOnMount={animateOnMount} />
        : <span>{fmt(displayValue)}</span>}
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
  fontVariantNumeric: "tabular-nums",
  fontFeatureSettings: "\"tnum\"",
};

const currencyBaseStyle: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "0.65em",
  letterSpacing: 0.4,
  textTransform: "uppercase",
  opacity: 0.6,
};
