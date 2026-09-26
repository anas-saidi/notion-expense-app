import { type CSSProperties } from "react";
import { fmt, MONEY_CURRENCY } from "./app-utils";
import { AnimatedCounter } from "./ui/AnimatedCounter";

type MoneyProps = {
  value: number;
  absolute?: boolean;
  /**
   * Show the currency. Off by default: the whole app is in one currency, so it
   * appears only on a screen's main number and in amount inputs.
   */
  currency?: boolean;
  animated?: boolean;
  animateOnMount?: boolean;
};

export function Money({
  value,
  absolute = false,
  currency = false,
  animated = false,
  animateOnMount = false,
}: MoneyProps) {
  const displayValue = absolute ? Math.abs(value) : value;

  return (
    <span style={moneyWrapStyle}>
      {animated
        ? <AnimatedCounter value={displayValue} animateOnMount={animateOnMount} />
        : <span>{fmt(displayValue)}</span>}
      {currency && <Currency />}
    </span>
  );
}

/**
 * The one currency mark: small, regular weight and muted wherever it appears,
 * so it never competes with the number. Its size caps at 12px, so it stays
 * quiet next to a hero number and scales down beside smaller text.
 */
export function Currency({ style }: { style?: CSSProperties }) {
  return <span style={{ ...currencyStyle, ...style }}>{MONEY_CURRENCY}</span>;
}

export const currencyStyle: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "min(0.7em, 12px)",
  fontWeight: 500,
  letterSpacing: "0.04em",
  lineHeight: 1,
  color: "var(--muted)",
  opacity: 0.8,
};

const moneyWrapStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "baseline",
  gap: 4,
  fontVariantNumeric: "tabular-nums",
  fontFeatureSettings: "\"tnum\"",
};
