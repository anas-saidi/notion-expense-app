"use client";

import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { AmountSkeleton } from "./Skeleton";
import { Money } from "../Money";
import { SCREEN_HERO_MASCOT_SIZE } from "./hero-tokens";
import "./screen-hero.css";

type Props = {
  mascot: ReactNode;
  label: string;
  value: number | null;
  loading?: boolean;
  showMetric?: boolean;
  summary?: ReactNode;
  actions?: ReactNode;
  supporting?: ReactNode;
  tone?: "danger";
};

/** Home, Budget and Reflect share geometry; their data and controls stay local. */
export function ScreenHero({ mascot, label, value, summary, actions, supporting, tone, loading = false, showMetric = true }: Props) {
  const amount = useRef<HTMLDivElement>(null);
  const measure = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const container = amount.current;
    const content = measure.current;
    if (!container || !content) return;
    const fit = () => {
      content.style.fontSize = "";
      const base = parseFloat(getComputedStyle(content).fontSize);
      const width = content.getBoundingClientRect().width;
      if (width > container.clientWidth && width > 0) content.style.fontSize = `${base * container.clientWidth / width}px`;
    };
    const observer = new ResizeObserver(fit);
    observer.observe(container);
    fit();
    let active = true;
    void document.fonts.ready.then(() => { if (active) fit(); });
    return () => { active = false; observer.disconnect(); };
  }, [value, loading, showMetric]);

  return <div className="screen-hero" style={{ "--hero-mascot-size": `${SCREEN_HERO_MASCOT_SIZE}px` } as CSSProperties}>
    <div className="screen-hero-mascot">{mascot}</div>
    {showMetric && <div className="screen-hero-metric">
      <h2 className="screen-hero-label">{label}</h2>
      <div ref={amount} className="screen-hero-value" data-tone={tone} aria-busy={loading || undefined} aria-label={loading ? "Loading amount" : undefined}>
        <span ref={measure}>{loading ? <AmountSkeleton /> : value == null ? "—" : <Money value={value} currency animated={Number.isInteger(value)} />}</span>
      </div>
    </div>}
    <div className="screen-hero-summary">{summary}</div>
    {supporting && <div className="screen-hero-supporting">{supporting}</div>}
    {actions && <div className="screen-hero-actions">{actions}</div>}
  </div>;
}
