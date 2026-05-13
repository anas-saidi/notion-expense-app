import { ArrowDown, Check, ListChecks } from "lucide-react";
import type { ReactNode } from "react";
import { Money } from "./Money";
import type { BudgetScope, MonthlySummary } from "./app-types";
import { ChipTabs } from "./ui/ChipTabs";
import { BUDGET_SCOPE_LABELS } from "./app-utils";

type HomeOverviewProps = {
  onOpenPlan: () => void;
  monthlySummary: MonthlySummary;
  readyToAssignByScope: Record<BudgetScope, number>;
  budgetScope: BudgetScope;
  homeMonth: string;
  onHomeMonthChange: (month: string) => void;
  planDone?: boolean;
};

export function HomeOverview({
  onOpenPlan,
  monthlySummary,
  readyToAssignByScope,
  budgetScope,
  homeMonth,
  onHomeMonthChange,
  planDone,
}: HomeOverviewProps) {
  const todayMonth = new Date().toISOString().slice(0, 7);
  const tabs = [shiftMonth(todayMonth, -1), todayMonth, shiftMonth(todayMonth, +1)] as const;
  const isCurrentMonth = homeMonth === todayMonth;
  const chipTabItems = tabs.map((month) => ({
    key: month,
    label: monthShortLabel(month),
  }));

  const totalAssigned = monthlySummary.totalAssigned;
  const totalSpent = monthlySummary.totalSpent;
  const available = isCurrentMonth ? readyToAssignByScope[budgetScope] : totalAssigned - totalSpent;
  const primaryLabel = isCurrentMonth ? "Left to assign" : "Available";

  return (
    <section aria-label="Monthly budget hub" className="home-hero" style={heroShellStyle}>
      <div style={heroToolbarStyle}>
        <div style={monthTabsWrapStyle}>
          <ChipTabs
            items={chipTabItems}
            activeKey={homeMonth}
            ariaLabel="Select month"
            onChange={onHomeMonthChange}
          />
        </div>
        {!planDone && (
          <button
            type="button"
            className="cta-save home-hero__plan"
            onClick={onOpenPlan}
            aria-label="Plan this month"
            title="Plan this month"
            style={planTriggerStyle}
          >
            <ListChecks size={18} />
          </button>
        )}
      </div>

      <div className="home-hero__body" style={heroBodyStyle}>
        <div key={homeMonth} style={{ ...heroCopyStyle, animation: "fadeUp 0.22s ease both" }}>
          <div style={heroRemainingWrapStyle}>
            <span style={heroRemainingLabelStyle}>
              {BUDGET_SCOPE_LABELS[budgetScope]} {primaryLabel}
            </span>
            <strong style={heroRemainingValueStyle(available < 0)}>
              <Money value={available} absolute={!isCurrentMonth && available < 0} />
            </strong>
            <span style={heroRemainingMetaStyle}>
              {isCurrentMonth ? "Unassigned money for this month" : formatMonthLabel(homeMonth)}
            </span>
          </div>
        </div>

        <div className="home-hero__visual" style={heroVisualStyle} aria-hidden="true">
          <span style={sparkleStyle(16, 18, 14)} />
          <span style={sparkleStyle(74, 33, 9)} />
          <span style={sparkleStyle(83, 70, 13)} />
          <div style={visualBlobStyle} />
          <div style={walletShadowStyle} />
          <div style={walletStyle}>
            <div style={cashStackStyle}>
              <span style={{ ...billStyle, transform: "rotate(-5deg) translateY(2px)" }} />
              <span style={{ ...billStyle, transform: "rotate(3deg) translate(10px, -3px)" }} />
            </div>
            <div style={walletFlapStyle} />
            <div style={walletButtonStyle} />
          </div>
        </div>
      </div>

      <div className="home-hero__stats" style={summaryGridStyle}>
        <MetricCard
          label={isCurrentMonth ? "Left" : "Available"}
          value={available}
          tone={available < 0 ? "danger" : "featured"}
          icon={<Check size={17} />}
        />
        <MetricCard label="Assigned" value={totalAssigned} tone="info" icon={<ListChecks size={17} />} />
        <MetricCard label="Spent" value={totalSpent} tone="soft" icon={<ArrowDown size={17} />} />
      </div>
    </section>
  );
}

function MetricCard({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number;
  tone: "default" | "danger" | "featured" | "info" | "soft";
  icon: ReactNode;
}) {
  const isFeatured = tone === "featured";
  const isDanger = tone === "danger";
  const isInfo = tone === "info";
  const isSoft = tone === "soft";

  return (
    <div
      className="home-hero__stat"
      style={{
        ...metricCardStyle,
        ...(isFeatured ? featuredMetricCardStyle : null),
        background:
          isDanger
            ? "color-mix(in srgb, var(--danger) 9%, var(--surface))"
            : isFeatured
            ? "linear-gradient(135deg, color-mix(in srgb, var(--accent) 78%, white), color-mix(in srgb, var(--accent) 32%, var(--surface)))"
            : isInfo
            ? "color-mix(in srgb, var(--info-dim) 44%, var(--surface))"
            : isSoft
            ? "color-mix(in srgb, #efe7ff 56%, var(--surface))"
            : "color-mix(in srgb, var(--surface2) 68%, white)",
        borderColor:
          isDanger
            ? "color-mix(in srgb, var(--danger) 26%, var(--border))"
            : isFeatured
            ? "color-mix(in srgb, var(--accent) 42%, var(--border))"
            : isInfo
            ? "color-mix(in srgb, var(--info) 18%, var(--border))"
            : "color-mix(in srgb, var(--border) 58%, transparent)",
      }}
    >
      <div style={metricIconStyle(tone)}>{icon}</div>
      <span style={{ ...metricLabelStyle, color: isFeatured ? "color-mix(in srgb, var(--accent-ink) 76%, transparent)" : "var(--text2)" }}>
        {label}
      </span>
      <strong
        style={{
          ...metricValueStyle,
          ...(isFeatured ? featuredMetricValueStyle : null),
          color: isDanger ? "var(--danger)" : isFeatured ? "var(--accent-ink)" : "var(--text)",
        }}
      >
        <Money value={Math.abs(value)} />
      </strong>
    </div>
  );
}

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthShortLabel(ym: string): string {
  return new Intl.DateTimeFormat("en", { month: "short", year: "2-digit" }).format(new Date(`${ym}-01`));
}

function formatMonthLabel(ym: string) {
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(new Date(`${ym}-01`));
}

const planTriggerStyle = {
  width: 52,
  height: 52,
  padding: 0,
  flexShrink: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 16,
  border: "1px solid color-mix(in srgb, var(--border2) 54%, transparent)",
  background: "var(--surface)",
  color: "var(--success)",
  cursor: "pointer",
  boxShadow: "0 8px 18px color-mix(in srgb, var(--ink-strong) 6%, transparent)",
};

const heroShellStyle = {
  display: "grid",
  gap: 22,
  padding: "18px 18px 20px",
  borderRadius: 24,
  border: "1px solid color-mix(in srgb, var(--border) 68%, transparent)",
  background:
    "radial-gradient(circle at 78% 30%, color-mix(in srgb, var(--accent) 18%, transparent) 0 22%, transparent 42%), linear-gradient(180deg, color-mix(in srgb, var(--surface) 94%, var(--accent-dim)) 0%, var(--surface) 72%)",
  boxShadow: "0 18px 38px color-mix(in srgb, var(--ink-strong) 8%, transparent)",
  animation: "fadeUp 0.36s 0.02s ease both",
};

const heroToolbarStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  minWidth: 0,
};

const monthTabsWrapStyle = {
  minWidth: 0,
  flex: 1,
};

const heroBodyStyle = {
  display: "grid",
  gap: 18,
  alignItems: "center",
};

const heroCopyStyle = {
  display: "grid",
  minWidth: 0,
};

const heroRemainingWrapStyle = {
  display: "grid",
  gap: 8,
  minWidth: 0,
};

const heroRemainingLabelStyle = {
  fontSize: 10,
  letterSpacing: 0.36,
  textTransform: "uppercase" as const,
  color: "var(--muted)",
  fontWeight: 700,
};

const heroRemainingValueStyle = (isNegative: boolean) => ({
  color: isNegative ? "var(--danger)" : "var(--text)",
  fontFamily: "var(--font-body)",
  fontSize: "clamp(3.2rem, 15vw, 5.35rem)",
  lineHeight: 0.92,
  letterSpacing: 0,
  fontWeight: 840,
  fontVariantNumeric: "tabular-nums",
  fontFeatureSettings: "\"tnum\"",
});

const heroRemainingMetaStyle = {
  color: "var(--text2)",
  fontSize: 15,
  lineHeight: 1.35,
};

const heroVisualStyle = {
  position: "relative" as const,
  minHeight: 180,
  display: "none",
  alignItems: "center",
  justifyContent: "center",
};

const visualBlobStyle = {
  position: "absolute" as const,
  width: "74%",
  aspectRatio: "1 / 0.9",
  borderRadius: "42% 58% 48% 52% / 54% 46% 54% 46%",
  background: "color-mix(in srgb, var(--accent) 14%, var(--surface2))",
  transform: "rotate(-12deg)",
};

const walletShadowStyle = {
  position: "absolute" as const,
  bottom: 22,
  width: "68%",
  height: 18,
  borderRadius: 999,
  background: "color-mix(in srgb, var(--ink-strong) 10%, transparent)",
  filter: "blur(1px)",
};

const walletStyle = {
  position: "relative" as const,
  width: 168,
  height: 112,
  borderRadius: 18,
  background: "linear-gradient(145deg, #7da95d, #416f36)",
  border: "1px solid color-mix(in srgb, #214c25 46%, transparent)",
  boxShadow:
    "inset 0 2px 0 color-mix(in srgb, white 24%, transparent), 0 18px 28px color-mix(in srgb, #24451e 22%, transparent)",
  overflow: "hidden",
};

const cashStackStyle = {
  position: "absolute" as const,
  left: 40,
  top: -20,
  width: 94,
  height: 58,
};

const billStyle = {
  position: "absolute" as const,
  inset: "8px 0 auto 0",
  height: 42,
  borderRadius: 4,
  background:
    "radial-gradient(circle at 28% 50%, #f4cf63 0 15%, transparent 16%), linear-gradient(90deg, #d7e9af, #89bd65)",
  boxShadow: "0 4px 8px color-mix(in srgb, var(--ink-strong) 12%, transparent)",
};

const walletFlapStyle = {
  position: "absolute" as const,
  right: -10,
  top: 48,
  width: 72,
  height: 42,
  borderRadius: "16px 0 0 16px",
  background: "linear-gradient(145deg, #568541, #315f30)",
  border: "1px solid color-mix(in srgb, #183d1e 48%, transparent)",
};

const walletButtonStyle = {
  position: "absolute" as const,
  right: 43,
  top: 61,
  width: 24,
  height: 24,
  borderRadius: 999,
  background: "#145629",
  boxShadow: "0 0 0 6px color-mix(in srgb, #9fe870 16%, transparent)",
};

const sparkleStyle = (left: number, top: number, size: number) => ({
  position: "absolute" as const,
  left: `${left}%`,
  top: `${top}%`,
  width: size,
  height: size,
  background: "color-mix(in srgb, var(--warning) 58%, white)",
  clipPath: "polygon(50% 0%, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0% 50%, 39% 39%)",
  opacity: 0.85,
});

const summaryGridStyle = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 12,
};

const metricCardStyle = {
  position: "relative" as const,
  display: "grid",
  gridTemplateColumns: "44px minmax(0, 1fr)",
  gridTemplateRows: "auto auto",
  alignItems: "center",
  columnGap: 12,
  rowGap: 4,
  minWidth: 0,
  minHeight: 92,
  padding: "14px 13px",
  borderRadius: 16,
  border: "1px solid transparent",
};

const featuredMetricCardStyle = {
  boxShadow:
    "inset 0 1px 0 color-mix(in srgb, white 54%, transparent), 0 10px 20px color-mix(in srgb, var(--accent) 20%, transparent)",
};

const metricLabelStyle = {
  fontSize: 10,
  letterSpacing: 0.32,
  textTransform: "uppercase" as const,
  fontWeight: 720,
  gridColumn: "2 / 3",
  alignSelf: "end",
};

const metricValueStyle = {
  gridColumn: "2 / 3",
  alignSelf: "start",
  fontSize: 22,
  lineHeight: 1.25,
  fontWeight: 800,
  fontVariantNumeric: "tabular-nums",
  fontFeatureSettings: "\"tnum\"",
};

const featuredMetricValueStyle = {
  fontSize: 24,
  lineHeight: 1.12,
  fontWeight: 840,
};

const metricIconStyle = (tone: "default" | "danger" | "featured" | "info" | "soft") => ({
  gridColumn: "1 / 2",
  gridRow: "1 / 3",
  width: 44,
  height: 44,
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  color:
    tone === "danger"
      ? "var(--danger)"
      : tone === "featured"
      ? "var(--accent-ink)"
      : tone === "info"
      ? "color-mix(in srgb, var(--info) 54%, var(--text))"
      : "color-mix(in srgb, #8d69d6 68%, var(--text))",
  background:
    tone === "danger"
      ? "color-mix(in srgb, var(--danger) 10%, white)"
      : tone === "featured"
      ? "color-mix(in srgb, white 38%, var(--accent))"
      : tone === "info"
      ? "color-mix(in srgb, var(--info) 12%, white)"
      : "color-mix(in srgb, #dcccff 42%, white)",
});
