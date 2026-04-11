import type { CSSProperties } from "react";

type ChipTab = {
  key: string;
  label: string;
  count?: number;
};

type ChipTabsProps = {
  items: ChipTab[];
  activeKey: string;
  ariaLabel: string;
  onChange: (key: string) => void;
};

export function ChipTabs({ items, activeKey, ariaLabel, onChange }: ChipTabsProps) {
  return (
    <div style={chipRowStyle} role="tablist" aria-label={ariaLabel}>
      {items.map((item) => {
        const isActive = item.key === activeKey;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(item.key)}
            style={{
              ...chipStyle,
              ...(isActive ? chipActiveStyle : null),
            }}
          >
            <span style={{ fontWeight: isActive ? 650 : 600 }}>{item.label}</span>
            {typeof item.count === "number" && <span style={chipCountStyle}>{item.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

const chipRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const chipStyle: CSSProperties = {
  borderRadius: 999,
  padding: "6px 12px",
  border: "1px solid transparent",
  background: "color-mix(in srgb, var(--surface2) 60%, white)",
  color: "var(--text2)",
  fontSize: 12,
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  cursor: "pointer",
  transition: "all 0.2s ease",
};

const chipActiveStyle: CSSProperties = {
  border: "1px solid transparent",
  background: "var(--accent-dim)",
  color: "var(--text)",
};

const chipCountStyle: CSSProperties = {
  fontFamily: "'DM Mono', monospace",
  fontSize: 10,
  opacity: 0.7,
};
