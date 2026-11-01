"use client";

import type { CSSProperties, ReactNode } from "react";

type BannerTone = "neutral" | "info" | "accent" | "warning" | "danger" | "success";

type BannerProps = {
  className?: string;
  /** Contextual desktop notices are flat; blocking alerts can keep their surface. */
  desktopInline?: boolean;
  tone?: BannerTone;
  icon?: ReactNode;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  role?: "alert" | "status" | "note";
  style?: CSSProperties;
  compact?: boolean;
};

const toneStyles: Record<BannerTone, { background: string; border: string; foreground: string }> = {
  neutral: {
    background: "var(--surface2)",
    border: "color-mix(in srgb, var(--border2) 40%, transparent)",
    foreground: "var(--text2)",
  },
  info: {
    background: "color-mix(in srgb, var(--info-dim) 58%, var(--surface))",
    border: "color-mix(in srgb, var(--info) 24%, transparent)",
    foreground: "color-mix(in srgb, var(--info) 58%, var(--text))",
  },
  accent: {
    background: "var(--select-wash)",
    border: "var(--select-edge)",
    foreground: "var(--text)",
  },
  warning: {
    background: "color-mix(in srgb, var(--warning-dim) 48%, var(--surface))",
    border: "color-mix(in srgb, var(--warning) 30%, transparent)",
    foreground: "var(--warning-ink)",
  },
  danger: {
    background: "color-mix(in srgb, var(--danger) 7%, var(--surface))",
    border: "color-mix(in srgb, var(--danger) 20%, transparent)",
    foreground: "color-mix(in srgb, var(--danger) 58%, var(--text))",
  },
  success: {
    background: "color-mix(in srgb, var(--success) 8%, var(--surface))",
    border: "color-mix(in srgb, var(--success) 22%, transparent)",
    foreground: "color-mix(in srgb, var(--success) 56%, var(--text))",
  },
};

export function Banner({ className, tone = "neutral", icon, title, children, action, role = "note", style, compact = false, desktopInline = role !== "alert" && tone !== "danger" }: BannerProps) {
  const colors = toneStyles[tone];
  // Contextual notices sit flat on the page at every width; only blocking alerts get a tinted surface.
  const flat = desktopInline;
  const sharedStyle: CSSProperties = {
    width: "100%",
    display: "grid",
    gridTemplateColumns: icon ? "auto minmax(0, 1fr) auto" : "minmax(0, 1fr) auto",
    alignItems: "center",
    gap: compact ? 8 : 12,
    padding: flat ? "8px 0" : compact ? "10px 12px" : "14px 16px",
    border: flat ? 0 : `1px solid ${colors.border}`,
    borderRadius: flat ? 0 : 14,
    background: flat ? "transparent" : colors.background,
    color: colors.foreground,
    boxSizing: "border-box",
    textAlign: "left",
    ...style,
  };
  const content = (
    <>
      {icon && <span className="banner-icon" aria-hidden="true" style={{ display: "inline-flex", flexShrink: 0 }}>{icon}</span>}
      <span className="banner-content" style={{ minWidth: 0, display: "grid", gap: title && children ? 3 : 0 }}>
        {title && <strong style={{ color: "var(--text)", fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>{title}</strong>}
        {children && <span style={{ color: "inherit", fontSize: 12, lineHeight: 1.45 }}>{children}</span>}
      </span>
      {action && <span className="banner-action" style={{ flexShrink: 0, justifySelf: "end" }}>{action}</span>}
    </>
  );

  return <div className={["app-banner", desktopInline && "app-banner--desktop-inline", className].filter(Boolean).join(" ")} data-tone={tone} role={role} style={sharedStyle}>{content}</div>;
}

/** Quiet text action for banners that sit under the hero, so they never outweigh the balance. */
export const bannerTextActionStyle: CSSProperties = {
  minHeight: 44,
  margin: "-10px -8px -10px 0",
  padding: "0 8px",
  border: "none",
  borderRadius: 10,
  background: "transparent",
  color: "var(--text2)",
  fontSize: 12,
  fontWeight: 650,
  cursor: "pointer",
};

/** Neutral action for warning/error banners; shared with compact composer alerts. */
export const bannerActionStyle: CSSProperties = {
  minHeight: 44,
  padding: "0 12px",
  border: 0,
  borderRadius: "var(--radius-control)",
  background: "var(--text)",
  color: "var(--bg)",
  fontSize: 12,
  fontWeight: 750,
  whiteSpace: "nowrap",
  cursor: "pointer",
};
