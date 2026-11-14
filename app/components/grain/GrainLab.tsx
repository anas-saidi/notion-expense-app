"use client";

import { useEffect, useState, type CSSProperties } from "react";
import type { BudgetScope } from "../app-types";
import { MascotHero, MASCOT_HERO_SIZE } from "../mascot/MascotHero";
import { ScreenHero } from "../ui/ScreenHero";
import { Summary } from "../ui/Summary";
import { LightMascot, LightPair, type LevelMode, type RestMode } from "./LightMascot";
import { PALETTES, type PaletteId } from "./palettes";
import { GrainGlow, type GlowDirection, type GlowEdge } from "./GrainGlow";

type Direction = GlowDirection | "none";
type A11y = "none" | "transparency" | "contrast";

const DIRECTIONS: Direction[] = ["halo", "tray", "sky", "room", "none"];
const SCOPES: BudgetScope[] = ["anas", "joint", "salma"];
const BALANCE: Record<BudgetScope, number> = { anas: 8420, joint: 12480, salma: 6130 };

function param<T extends string>(name: string, allowed: readonly T[], fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const value = new URLSearchParams(window.location.search).get(name) as T | null;
  return value && allowed.includes(value) ? value : fallback;
}

/** Dev-only comparison of grain glow directions behind the Home hero (?d=halo&e=wavy&s=anas&t=dark&a=transparency&l=0.64). */
export function GrainLab() {
  const [ready, setReady] = useState(false);
  const [direction, setDirection] = useState<Direction>("halo");
  const [scope, setScope] = useState<BudgetScope>("anas");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [a11y, setA11y] = useState<A11y>("none");
  const [level, setLevel] = useState(0.64);
  const [edge, setEdge] = useState<GlowEdge>("soft");
  const [body, setBody] = useState<"jar" | "light">("jar");
  const [levelMode, setLevelMode] = useState<LevelMode>("height");
  const [rest, setRest] = useState<RestMode>("live");
  const [palette, setPalette] = useState<PaletteId>("partner");

  useEffect(() => {
    setDirection(param("d", DIRECTIONS, "halo"));
    setScope(param("s", SCOPES, "anas"));
    setTheme(param("t", ["light", "dark"] as const, "light"));
    setA11y(param("a", ["none", "transparency", "contrast"] as const, "none"));
    setEdge(param("e", ["soft", "wavy"] as const, "soft"));
    setBody(param("b", ["jar", "light"] as const, "jar"));
    setLevelMode(param("m", ["height", "brightness", "core"] as const, "height"));
    setRest(param("r", ["live", "still"] as const, "live"));
    setPalette(param("p", ["partner", "amber-periwinkle", "amber-teal"] as const, "partner"));
    const l = Number(new URLSearchParams(window.location.search).get("l"));
    if (l >= 0 && l <= 1 && new URLSearchParams(window.location.search).has("l")) setLevel(l);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.scope = scope;
    if (a11y === "none") delete root.dataset.grainA11y; else root.dataset.grainA11y = a11y;
    const url = new URL(window.location.href);
    url.search = new URLSearchParams({ d: direction, s: scope, t: theme, a: a11y, e: edge, b: body, m: levelMode, r: rest, p: palette, l: String(level) }).toString();
    window.history.replaceState(null, "", url);
  }, [ready, direction, scope, theme, a11y, edge, body, levelMode, rest, palette, level]);

  const spentPct = Math.round((1 - level) * 100);
  // Chosen colours apply to the light body and its room; the jar keeps the partner colours.
  const tones = body === "light" && palette !== "partner" ? PALETTES[palette] : undefined;
  return <div style={pageStyle}>
    <div className="grain-lab-controls" style={controlsStyle}>
      <Row label="Body" value={body} options={["jar", "light"] as const} onChange={setBody} />
      {body === "light" && <Row label="Level as" value={levelMode} options={["height", "brightness", "core"] as const} onChange={setLevelMode} />}
      {body === "light" && <Row label="Colours" value={palette} options={["partner", "amber-periwinkle", "amber-teal"] as const} onChange={setPalette} />}
      {body === "light" && <Row label="Rest" value={rest} options={["live", "still"] as const} onChange={setRest} />}
      <Row label="Direction" value={direction} options={DIRECTIONS} onChange={setDirection} />
      <Row label="Scope" value={scope} options={SCOPES} onChange={setScope} />
      <Row label="Edge" value={edge} options={["soft", "wavy"] as const} onChange={setEdge} />
      <Row label="Theme" value={theme} options={["light", "dark"] as const} onChange={setTheme} />
      <Row label="Access" value={a11y} options={["none", "transparency", "contrast"] as const} onChange={setA11y} />
      <label style={rowStyle}><span style={rowLabelStyle}>Level {Math.round(level * 100)}%</span>
        <input type="range" min={0} max={1} step={0.01} value={level} onChange={event => setLevel(Number(event.target.value))} style={{ flex: 1 }} />
      </label>
    </div>

    <main style={phoneStyle}>
      <div className="grain-stage">
        {direction !== "none" && <GrainGlow direction={direction} scope={scope} level={level} edge={edge} tones={tones} />}
        <ScreenHero
          mascot={body === "light"
            ? scope === "joint"
              ? <LightPair level={level} levels={{ anas: level, salma: Math.min(1, level + 0.15) }} size={MASCOT_HERO_SIZE} spentPct={spentPct} edge={edge} levelMode={levelMode} rest={rest} tones={tones} />
              : <LightMascot scope={scope} level={level} size={MASCOT_HERO_SIZE} spentPct={spentPct} edge={edge} levelMode={levelMode} rest={rest} tone={tones?.[scope === "salma" ? "salma" : "anas"]} style={{ margin: "0 auto" }} />
            : <MascotHero
            variant="pool" size={MASCOT_HERO_SIZE} scope={scope} spentPct={spentPct} remember={false}
            level={level} levels={scope === "joint" ? { anas: level, salma: Math.min(1, level + 0.15) } : undefined}
            balance={BALANCE[scope]} available={BALANCE[scope]} warn={null} />}
          label="Balance"
          value={BALANCE[scope]}
          summary={<Summary><b>4,210</b> left to spend this month, <b>1,800</b> is unassigned.</Summary>}
        />
      </div>
      <section aria-label="Recent activity (sample)" style={{ padding: "8px 0 40px" }}>
        <h3 style={sectionStyle}>Recent activity</h3>
        {[["Groceries", "Marjane", "320"], ["Transport", "Taxi", "45"], ["Home", "Internet", "299"]].map(([cat, what, amount]) => (
          <div key={what} style={txnStyle}><span><span style={{ color: "var(--text)" }}>{what}</span><br /><span style={{ color: "var(--muted)", fontSize: 13 }}>{cat}</span></span><span style={{ fontVariantNumeric: "tabular-nums" }}>{amount}</span></div>
        ))}
      </section>
    </main>
  </div>;
}

function Row<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly T[]; onChange: (value: T) => void }) {
  return <div role="radiogroup" aria-label={label} style={rowStyle}>
    <span style={rowLabelStyle}>{label}</span>
    {options.map(option => <button key={option} type="button" role="radio" aria-checked={option === value} onClick={() => onChange(option)}
      style={{ ...chipStyle, ...(option === value ? { background: "var(--text)", color: "var(--bg)" } : null) }}>{option}</button>)}
  </div>;
}

const pageStyle: CSSProperties = { minHeight: "100vh", background: "var(--bg)", color: "var(--text)", fontFamily: "var(--font-body)" };
const controlsStyle: CSSProperties = { display: "grid", gap: 6, padding: "10px 16px", borderBottom: "1px solid var(--border)", fontSize: 12, background: "var(--bg)", position: "relative", zIndex: 2 };
const rowStyle: CSSProperties = { display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" };
const rowLabelStyle: CSSProperties = { width: 72, color: "var(--muted)" };
const chipStyle: CSSProperties = { border: "1px solid var(--border)", borderRadius: 999, padding: "3px 10px", background: "transparent", color: "var(--text)", font: "inherit", cursor: "pointer" };
const phoneStyle: CSSProperties = { maxWidth: 430, margin: "0 auto", padding: "0 16px" };
const sectionStyle: CSSProperties = { margin: "0 0 8px", fontSize: 13, fontWeight: 600, color: "var(--muted)" };
const txnStyle: CSSProperties = { display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border)", fontSize: 15 };
