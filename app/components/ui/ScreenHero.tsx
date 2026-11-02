"use client";

import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { AmountSkeleton } from "./Skeleton";
import { Currency, Money } from "../Money";
import { SCREEN_HERO_ACTIVITY_SIZE, SCREEN_HERO_CHART_TOP, SCREEN_HERO_MASCOT_SIZE } from "./hero-tokens";
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
  const currency = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const container = amount.current;
    const content = measure.current;
    if (!container || !content) return;
    const fit = () => {
      content.style.fontSize = "";
      const base = parseFloat(getComputedStyle(content).fontSize);
      // Mirror the real currency width on the left, so the digits share the
      // mascot's centerline. Keep both gutters when fitting long amounts.
      const room = currency.current ? Math.ceil(currency.current.getBoundingClientRect().width) + 4 : 0;
      content.style.setProperty("--hero-currency-room", `${room}px`);
      const width = content.getBoundingClientRect().width - room * 2;
      const available = Math.max(0, container.clientWidth - room * 2);
      if (width > available && width > 0) content.style.fontSize = `${base * available / width}px`;
    };
    const observer = new ResizeObserver(fit);
    observer.observe(container);
    fit();
    let active = true;
    void document.fonts.ready.then(() => { if (active) fit(); });
    return () => { active = false; observer.disconnect(); };
  }, [value, loading, showMetric]);

  return <div className="screen-hero" style={{ "--hero-mascot-size": `${SCREEN_HERO_MASCOT_SIZE}px`, "--hero-activity-size": `${SCREEN_HERO_ACTIVITY_SIZE}px`, "--hero-chart-top": `${SCREEN_HERO_CHART_TOP}px` } as CSSProperties}>
    <div className="screen-hero-mascot">{mascot}</div>
    {showMetric && <div className="screen-hero-metric">
      <h2 className="screen-hero-label">{label}</h2>
      <div ref={amount} className="screen-hero-value" data-tone={tone} aria-busy={loading || undefined} aria-label={loading ? "Loading amount" : undefined}>
        <span ref={measure}>
          <span className="screen-hero-digits">{loading ? <AmountSkeleton /> : value == null ? "—" : <Money value={value} animated={Number.isInteger(value)} />}</span>
          {!loading && value != null && <span ref={currency} className="screen-hero-currency" aria-hidden="true"><Currency style={{ opacity: 1 }} /></span>}
        </span>
      </div>
    </div>}
    <div className="screen-hero-summary">{summary}</div>
    {supporting && <div className="screen-hero-supporting">{supporting}</div>}
    {actions && <div className="screen-hero-actions">{actions}</div>}
  </div>;
}
