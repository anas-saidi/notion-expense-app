"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Money } from "./Money";

type NumberTone = "default" | "danger" | "warning";

type NumberMetric = {
  label: string;
  value: number;
  meta?: ReactNode;
  tone?: NumberTone;
};

type NumbersHeaderCardProps = {
  primary: NumberMetric;
  secondary: NumberMetric;
  chip?: ReactNode;
  sticky?: boolean;
  compact?: boolean;
  marginBottom?: number;
};

export function NumbersHeaderCard({
  primary,
  secondary,
  chip,
  sticky = false,
  compact = false,
  marginBottom,
}: NumbersHeaderCardProps) {
  const animatedPrimary = useAnimatedNumber(primary.value);
  const animatedSecondary = useAnimatedNumber(secondary.value);

  return (
    <section
      style={{
        position: sticky ? "sticky" : "relative",
        top: sticky ? (compact ? "calc(var(--safe-top) + 8px)" : "calc(var(--safe-top) + 12px)") : undefined,
        zIndex: sticky ? 20 : undefined,
        marginBottom: marginBottom ?? (compact ? 14 : 18),
        animation: "fadeUp 0.45s ease both",
      }}
    >
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: 12,
          background: "transparent",
          border: "1px solid transparent",
          boxShadow: "none",
          padding: compact ? "6px 4px" : "8px 4px",
        }}
      >
        <div style={stackStyle}>
          <div style={metricWrapStyle}>
            <MetricBlock metric={primary} animatedValue={animatedPrimary} />
          </div>
          <div style={dividerStyle} />
          <div style={metricWrapStyle}>
            <MetricBlock metric={secondary} animatedValue={animatedSecondary} />
          </div>
          {chip ? <div style={metaChipStyle}>{chip}</div> : null}
        </div>
      </div>
    </section>
  );
}

function MetricBlock({
  metric,
  animatedValue,
}: {
  metric: NumberMetric;
  animatedValue: number;
}) {
  return (
    <div style={numberBlockStyle}>
      <div style={eyebrowStyle}>{metric.label}</div>
      <div
        style={{
          ...numberStyle,
          color: resolveToneColor(metric.tone ?? "default"),
        }}
      >
        <Money value={animatedValue} />
      </div>
      {metric.meta ? <div style={metaCopyStyle}>{metric.meta}</div> : null}
    </div>
  );
}

function resolveToneColor(tone: NumberTone) {
  if (tone === "danger") return "var(--danger)";
  if (tone === "warning") return "color-mix(in srgb, var(--warning) 82%, black)";
  return "var(--text)";
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);

    updatePreference();
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", updatePreference);
      return () => mediaQuery.removeEventListener("change", updatePreference);
    }
    mediaQuery.addListener(updatePreference);
    return () => mediaQuery.removeListener(updatePreference);
  }, []);

  return prefersReducedMotion;
}

function useAnimatedNumber(value: number) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [displayValue, setDisplayValue] = useState(value);
  const previousValueRef = useRef(value);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const startValue = previousValueRef.current;
    const targetValue = value;

    if (frameRef.current) cancelAnimationFrame(frameRef.current);

    if (prefersReducedMotion || startValue === targetValue) {
      setDisplayValue(targetValue);
      previousValueRef.current = targetValue;
      return;
    }

    const delta = targetValue - startValue;
    const duration = 420;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplayValue(startValue + delta * eased);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        previousValueRef.current = targetValue;
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [prefersReducedMotion, value]);

  return displayValue;
}

const eyebrowStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: 0,
  textTransform: "none",
  color: "var(--text2)",
};

const numberStyle: CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontSize: "clamp(2.2rem, 8vw, 3rem)",
  lineHeight: 0.9,
  letterSpacing: -0.4,
  fontWeight: 700,
  fontVariantNumeric: "tabular-nums",
  fontFeatureSettings: "\"tnum\"",
  textAlign: "left",
  width: "100%",
};

const metaCopyStyle: CSSProperties = {
  color: "var(--text2)",
  fontSize: 12,
  textAlign: "left",
};

const metaChipStyle: CSSProperties = {
  padding: "4px 8px",
  borderRadius: 999,
  background: "color-mix(in srgb, var(--warning) 16%, transparent)",
  color: "color-mix(in srgb, var(--warning) 70%, var(--text))",
  fontFamily: "'DM Mono', monospace",
  fontSize: 9,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  justifySelf: "start",
};

const numberBlockStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  justifyItems: "start",
  textAlign: "left",
};

const stackStyle: CSSProperties = {
  display: "grid",
  gap: 10,
};

const metricWrapStyle: CSSProperties = {
  padding: "6px 10px",
};

const dividerStyle: CSSProperties = {
  height: 1,
  background: "color-mix(in srgb, var(--border) 30%, transparent)",
  margin: "0 10px",
};
