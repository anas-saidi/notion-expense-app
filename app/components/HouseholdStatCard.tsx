"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Money } from "./Money";

export type Scope = "household" | "wife" | "husband";

type StatView = {
  spent: number;
  planned: number;
};

type HouseholdStatCardProps = {
  views: Record<Scope, StatView>;
  scope: Scope;
  onScopeChange: (nextScope: Scope) => void;
  readyToAssignByScope: Record<Scope, number>;
  contributionDueByScope?: { wife: number; husband: number; total: number };
  householdSpentByPartner?: { wife: number; husband: number; other: number; total: number };
};

type RingSegment = {
  key: "wife" | "husband";
  label: string;
  value: number;
  spent: number;
  color: string;
  spentColor: string;
  startAngle: number;
  endAngle: number;
  spentEndAngle: number;
};

const RING_SIZE = 216;
const RING_CENTER = RING_SIZE / 2;
const RING_RADIUS = 68;
const RING_STROKE = 18;
const SPENT_RING_RADIUS = 68;
const SPENT_RING_STROKE = 8;
const RING_START = -90;
const RING_SWEEP = 360;
const SEGMENT_GAP = 16;
const SCOPE_ORDER: Scope[] = ["household", "wife", "husband"];
const SCOPE_LABELS: Record<Scope, string> = {
  household: "Joint",
  wife: "Salma",
  husband: "Anas",
};
const HINT_STORAGE_KEY = "household-stat-card-hint-hidden";

export function HouseholdStatCard({
  views,
  scope,
  onScopeChange,
  readyToAssignByScope,
  contributionDueByScope,
  householdSpentByPartner,
}: HouseholdStatCardProps) {
  const [showHint, setShowHint] = useState(false);

  // DEBUG: Print partner contribution and spend values
  if (typeof window !== "undefined") {
    // eslint-disable-next-line no-console
    console.log("[DEBUG] contributionDueByScope:", contributionDueByScope);
    // eslint-disable-next-line no-console
    console.log("[DEBUG] householdSpentByPartner:", householdSpentByPartner);
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    setShowHint(window.localStorage.getItem(HINT_STORAGE_KEY) !== "true");
  }, []);

  const wifePlanned = Math.max(0, contributionDueByScope?.wife ?? 0);
  const husbandPlanned = Math.max(0, contributionDueByScope?.husband ?? 0);
  const wifeSpent = Math.max(0, householdSpentByPartner?.wife ?? 0);
  const husbandSpent = Math.max(0, householdSpentByPartner?.husband ?? 0);
  const totalPartnerPlanned = wifePlanned + husbandPlanned;

  const ringSegments = useMemo(() => {
    const total = Math.max(1, wifePlanned + husbandPlanned);
    let cursor = RING_START;

    const buildSegment = (
      key: "wife" | "husband",
      label: string,
      value: number,
      spent: number,
      color: string,
      spentColor: string,
    ): RingSegment => {
      const sweep = RING_SWEEP * (value / total);
      const visibleSweep = Math.max(12, sweep - SEGMENT_GAP);
      const startAngle = cursor + SEGMENT_GAP / 2;
      const endAngle = startAngle + visibleSweep;
      const spentRatio = value > 0 ? Math.min(1, spent / value) : 0;
      const spentEndAngle = startAngle + visibleSweep * spentRatio;
      cursor += sweep;
      return { key, label, value, spent, color, spentColor, startAngle, endAngle, spentEndAngle };
    };

    return [
      buildSegment(
        "wife",
        "Wife",
        wifePlanned,
        wifeSpent,
        "color-mix(in srgb, var(--partner-wife) 42%, white)",
        "var(--partner-wife)",
      ),
      buildSegment(
        "husband",
        "Husband",
        husbandPlanned,
        husbandSpent,
        "color-mix(in srgb, var(--partner-husband) 42%, white)",
        "var(--partner-husband)",
      ),
    ];
  }, [husbandPlanned, husbandSpent, wifePlanned, wifeSpent]);

  const activeView = views[scope];
  const remaining = readyToAssignByScope[scope] ?? 0;

  const cycleScope = () => {
    const currentIndex = SCOPE_ORDER.indexOf(scope);
    const nextScope = SCOPE_ORDER[(currentIndex + 1) % SCOPE_ORDER.length];
    onScopeChange(nextScope);
    if (showHint && typeof window !== "undefined") {
      setShowHint(false);
      window.localStorage.setItem(HINT_STORAGE_KEY, "true");
    }
  };

  return (
    <section style={shellStyle} aria-label="Monthly household budget summary">
      <div style={headerStyle}>
        <span style={eyebrowStyle}>Partner contributions</span>
        <span style={scopeBadgeStyle}>{SCOPE_LABELS[scope]}</span>
      </div>

      <button
        type="button"
        onClick={cycleScope}
        style={tapAreaStyle}
        aria-label={`Switch summary scope. Currently showing ${SCOPE_LABELS[scope]}.`}
      >
        <div style={contentStyle}>
          <div style={ringWrapStyle}>
            <svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
              <circle
                cx={RING_CENTER}
                cy={RING_CENTER}
                r={RING_RADIUS}
                fill="none"
                stroke="color-mix(in srgb, var(--surface2) 58%, white)"
                strokeWidth={RING_STROKE}
                opacity="0.7"
              />

              {ringSegments.map((segment) => (
                <path
                  key={segment.key}
                  d={describeArc(RING_CENTER, RING_CENTER, RING_RADIUS, segment.startAngle, segment.endAngle)}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth={RING_STROKE}
                  strokeLinecap="round"
                  style={{
                    opacity: scope === "household" || scope === segment.key ? 0.82 : 0.22,
                    filter: "none",
                  }}
                />
              ))}

              {ringSegments.map((segment) => (
                <path
                  key={`${segment.key}-spent`}
                  d={describeArc(RING_CENTER, RING_CENTER, SPENT_RING_RADIUS, segment.startAngle, segment.spentEndAngle)}
                  fill="none"
                  stroke={segment.spentColor}
                  strokeWidth={SPENT_RING_STROKE}
                  strokeLinecap="round"
                  style={{
                    opacity: scope === "household" || scope === segment.key ? 0.96 : 0.18,
                  }}
                />
              ))}
            </svg>

            <div style={ringCenterStyle}>
              <div style={centerLabelStyle}>Assigned</div>
              <div style={centerAmountStyle}>
                {totalPartnerPlanned.toLocaleString("fr-MA")}
              </div>
              <div style={centerCurrencyStyle}>MAD</div>
            </div>
          </div>

          <div style={summaryStyle}>
            <div style={summaryTitleStyle}>How you're contributing</div>
            <p style={summaryBodyStyle}>
              Outer ring shows planned share. Inner line shows spend so far.
            </p>
            <div style={legendStyle}>
              {ringSegments.map((segment) => (
                <div key={segment.key} style={legendRowStyle}>
                  <span style={{ ...legendDotStyle, background: segment.color }} />
                  <span style={legendLabelStyle}>{segment.label}</span>
                  <span style={legendValueStyle}>
                    <Money value={segment.spent} /> / <Money value={segment.value} />
                  </span>
                </div>
              ))}
            </div>

            <div style={statsStyle}>
              <div style={statRowStyle}>
                <span style={statLabelStyle}>Spent</span>
                <span style={statValueStyle}>
                  <Money value={activeView.spent} />
                </span>
              </div>
              {scope !== "household" ? (
                <div style={statRowStyle}>
                  <span style={statLabelStyle}>Remaining</span>
                  <span style={{ ...statValueStyle, color: remaining < 0 ? "var(--danger)" : "var(--text)" }}>
                    <Money value={Math.abs(remaining)} absolute />
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </button>

      {showHint ? (
        <div style={hintStyle}>Tap to preview the same ring while switching scopes.</div>
      ) : null}
    </section>
  );
}

function polarToCartesian(cx: number, cy: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians),
  };
}

function describeArc(cx: number, cy: number, radius: number, startAngle: number, endAngle: number) {
  const safeEnd = Math.max(startAngle + 0.001, endAngle);
  const start = polarToCartesian(cx, cy, radius, safeEnd);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = safeEnd - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

const shellStyle: CSSProperties = {
  display: "grid",
  gap: 14,
  padding: "16px 15px 16px",
  borderRadius: 22,
  border: "1px solid color-mix(in srgb, var(--border) 16%, transparent)",
  background:
    "radial-gradient(circle at top, color-mix(in srgb, var(--accent) 5%, transparent), transparent 40%), color-mix(in srgb, var(--surface) 98%, white)",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const eyebrowStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: 0.3,
  textTransform: "uppercase",
  color: "color-mix(in srgb, var(--muted) 84%, transparent)",
};

const scopeBadgeStyle: CSSProperties = {
  padding: "5px 8px",
  borderRadius: 999,
  background: "color-mix(in srgb, var(--surface2) 48%, white)",
  fontSize: 9,
  fontWeight: 600,
  letterSpacing: 0.22,
  textTransform: "uppercase",
  color: "var(--text2)",
};

const tapAreaStyle: CSSProperties = {
  appearance: "none",
  border: "none",
  background: "transparent",
  padding: 0,
  textAlign: "left",
  cursor: "pointer",
};

const contentStyle: CSSProperties = {
  display: "grid",
  gap: 12,
  justifyItems: "center",
};

const ringWrapStyle: CSSProperties = {
  position: "relative",
  width: RING_SIZE,
  height: RING_SIZE,
  display: "grid",
  placeItems: "center",
  marginInline: "auto",
};

const ringCenterStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "grid",
  placeItems: "center",
  gap: 4,
  textAlign: "center",
  pointerEvents: "none",
  padding: 48,
};

const centerLabelStyle: CSSProperties = {
  fontSize: 9,
  fontWeight: 600,
  letterSpacing: 0.28,
  textTransform: "uppercase",
  color: "color-mix(in srgb, var(--muted) 84%, transparent)",
};

const centerValueStyle: CSSProperties = {
  display: "none",
};

const centerAmountStyle: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "clamp(1.18rem, 4.8vw, 1.48rem)",
  lineHeight: 1,
  letterSpacing: -0.12,
  color: "var(--text2)",
  fontWeight: 600,
  maxWidth: "100%",
  whiteSpace: "nowrap",
};

const centerCurrencyStyle: CSSProperties = {
  fontSize: 9,
  fontWeight: 600,
  letterSpacing: 0.26,
  textTransform: "uppercase",
  color: "color-mix(in srgb, var(--muted) 82%, transparent)",
};

const summaryStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  width: "100%",
  textAlign: "center",
};

const summaryTitleStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "var(--text2)",
};

const summaryBodyStyle: CSSProperties = {
  fontSize: 10,
  lineHeight: 1.45,
  color: "var(--muted)",
};

const legendStyle: CSSProperties = {
  display: "grid",
  gap: 7,
  width: "100%",
};

const legendRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  width: "100%",
};

const legendDotStyle: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: 999,
  flexShrink: 0,
};

const legendLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "var(--text2)",
};

const legendValueStyle: CSSProperties = {
  marginLeft: "auto",
  fontSize: 10,
  color: "var(--text2)",
};

const statsStyle: CSSProperties = {
  display: "grid",
  gap: 7,
  padding: "9px 11px",
  borderRadius: 14,
  background: "color-mix(in srgb, var(--surface2) 38%, white)",
  border: "1px solid color-mix(in srgb, var(--border) 14%, transparent)",
  width: "100%",
};

const statRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const statLabelStyle: CSSProperties = {
  fontSize: 10,
  letterSpacing: 0.24,
  textTransform: "uppercase",
  color: "var(--muted)",
};

const statValueStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "var(--text2)",
};

const hintStyle: CSSProperties = {
  fontSize: 11,
  lineHeight: 1.45,
  color: "color-mix(in srgb, var(--muted) 72%, transparent)",
};
