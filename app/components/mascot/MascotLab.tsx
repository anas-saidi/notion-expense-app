"use client";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { fmt } from "../app-utils";
import { Mascot } from "./Mascot";
import { CategoryJarLab } from "./CategoryJarLab";
import { deriveTarget, reactionForBalanceChange, type ReactionToken } from "./mood";
import type { MascotScope, Mood, Outline, SalmaShape } from "./poses";

const SCOPES: { key: MascotScope; label: string }[] = [
  { key: "joint", label: "Joint" },
  { key: "anas", label: "Anas" },
  { key: "salma", label: "Salma" },
];
/** Category emojis, as they appear on the Budget screen. */
const CATEGORIES = {
  groceries: "🍽️", transport: "🏍️", rent: "🏠", medical: "💊", phone: "📱", selfcare: "✨",
  bank: "🏦", admin: "🪪", gym: "🏋️", dates: "❤️", coffee: "☕",
} as const;

type Spend = { id: string; category: keyof typeof CATEGORIES; amount: number };

/** A plausible month so far (~60% of a 4.138 MAD plan). */
const SAMPLE_MONTH: Spend[] = [
  ["groceries", 310], ["transport", 40], ["coffee", 35], ["groceries", 180], ["phone", 50], ["transport", 20],
  ["selfcare", 200], ["coffee", 30], ["groceries", 260], ["bank", 70], ["transport", 60], ["dates", 180],
  ["admin", 90], ["coffee", 35], ["groceries", 220], ["medical", 450], ["transport", 40], ["gym", 150],
].map(([category, amount], i) => ({ id: `m${i}`, category: category as keyof typeof CATEGORIES, amount: amount as number }));

/**
 * Emoji size from the amount. Area tracks the share of the plan, so the jar
 * fills roughly like the budget does: the jar's usable area (~2.3 units² at
 * ~70% packing) spread over the whole plan gives the 0.7 factor. A floor keeps
 * a coffee legible; a cap stops rent from filling half the jar on its own.
 */
function itemRadius(amount: number, plan: number): number {
  return Math.min(0.34, Math.max(0.12, Math.sqrt(amount / plan) * 0.7));
}

const MOODS: Array<Mood | "auto"> = ["auto", "idle", "happy", "excited", "worried", "sad", "curious", "sleepy", "wince"];

export function MascotLab() {
  const [scope, setScope] = useState<MascotScope>("joint");
  const [fundingGap, setFundingGap] = useState(2651);
  const [spentPct, setSpentPct] = useState(60);
  const [unassigned, setUnassigned] = useState(0);
  const [available, setAvailable] = useState(3845);
  const [loading, setLoading] = useState(false);
  const [calm, setCalm] = useState(false);
  const [moodOverride, setMoodOverride] = useState<Mood | "auto">("auto");
  const [balance, setBalance] = useState(1194);
  const [reaction, setReaction] = useState<ReactionToken | null>(null);
  const [dark, setDark] = useState(false);
  const [body, setBody] = useState<"shape" | "liquid" | "coins" | "spent">("liquid");
  const [spends, setSpends] = useState<Spend[]>(SAMPLE_MONTH);
  const plan = 4138;
  const spentTotal = spends.reduce((s, x) => s + x.amount, 0);
  const spend = (category: keyof typeof CATEGORIES, amount: number) => {
    setSpends(list => [...list, { id: `s${Date.now()}`, category, amount }]);
    setReaction(r => ({ kind: amount > plan * 0.25 ? "wince" : "dip", id: (r?.id ?? 0) + 1 }));
  };
  const [physics, setPhysics] = useState<"off" | "custom" | "matter">("matter");
  const [glass, setGlass] = useState<"off" | "fake">("off");
  const [outline, setOutline] = useState<Outline>("partner");
  const [salmaShape, setSalmaShape] = useState<SalmaShape>("egg");
  const [coinStyle, setCoinStyle] = useState<"beads" | "metal" | "emoji">("beads");
  const [liquidTone, setLiquidTone] = useState<"partner" | "lime" | "smoke" | "honey">("partner");
  const [shake, setShake] = useState<{ id: number; strength?: number } | null>(null);
  const [tiltDeg, setTiltDeg] = useState(0);
  const [phoneMotion, setPhoneMotion] = useState(false);
  const jar = { physics: physics === "off" ? false : physics, shake, tilt: (tiltDeg * Math.PI) / 180, glass, coinStyle, liquidTone };

  // Phone tilt steers gravity (right side down → coins slide right); a hard jolt shakes the jar.
  useEffect(() => {
    if (!phoneMotion) return;
    const onOrient = (e: DeviceOrientationEvent) => setTiltDeg(Math.max(-60, Math.min(60, e.gamma ?? 0)));
    let last = 0;
    const onMotion = (e: DeviceMotionEvent) => {
      const a = e.acceleration;
      const mag = Math.hypot(a?.x ?? 0, a?.y ?? 0, a?.z ?? 0);
      if (mag > 14 && performance.now() - last > 250) {
        last = performance.now();
        setShake(v => ({ id: (v?.id ?? 0) + 1, strength: Math.min(2, mag / 14) }));
      }
    };
    window.addEventListener("deviceorientation", onOrient);
    window.addEventListener("devicemotion", onMotion);
    return () => {
      window.removeEventListener("deviceorientation", onOrient);
      window.removeEventListener("devicemotion", onMotion);
    };
  }, [phoneMotion]);

  const enablePhoneMotion = async () => {
    // iOS asks for permission, and only from a tap.
    const Motion = DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> };
    const Orient = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
    try {
      if (Motion.requestPermission) await Motion.requestPermission();
      if (Orient.requestPermission) await Orient.requestPermission();
      setPhoneMotion(true);
    } catch {
      setPhoneMotion(false);
    }
  };
  const liquid = body !== "shape";
  // Shares of the joint target received from each partner (Sept: 9.434 + 6.994 of ~19.079).
  const [anasShare, setAnasShare] = useState(49);
  const [salmaShare, setSalmaShare] = useState(37);
  const jointFunded = Math.min(100, anasShare + salmaShare);
  const contribute = (who: "anas" | "salma", pct: number) => {
    const room = 100 - jointFunded;
    const add = Math.max(-100, Math.min(room, pct));
    if (who === "anas") setAnasShare(v => Math.max(0, v + add));
    else setSalmaShare(v => Math.max(0, v + add));
    if (add > 0) setReaction(r => ({ kind: "cheer", id: (r?.id ?? 0) + 1 }));
  };

  // Liquid levels: personal = what's left to spend this month; joint = share of contributions received.
  const left = Math.max(0, 1 - spentPct / 100);
  const fillFor = (s: MascotScope) => body !== "liquid" ? undefined : s === "joint" ? jointFunded / 100 : left;
  const itemsFor = () => body !== "spent" ? undefined : spends.map(x => ({ id: x.id, glyph: CATEGORIES[x.category], radius: itemRadius(x.amount, plan) }));
  const coinsFor = (s: MascotScope) => body !== "coins" ? undefined
    : s === "joint" ? { anas: anasShare / 100, salma: salmaShare / 100 }
    : { [s]: left };
  const targetFor = (s: MascotScope) => {
    const gap = s !== "joint" ? 0 : liquid ? (jointFunded >= 100 ? 0 : Math.max(fundingGap, 1)) : fundingGap;
    const pct = body === "spent" ? (spentTotal / plan) * 100 : spentPct;
    const derived = { ...deriveTarget({ scope: s, fundingGap: gap, spentPct: pct, unassigned, loading }), fill: fillFor(s), coins: coinsFor(s), items: itemsFor(), outline, salmaShape };
    return moodOverride === "auto" ? derived : { ...derived, mood: moodOverride, celebrate: derived.celebrate && moodOverride === "happy" };
  };
  const target = targetFor(scope);
  // The connector is always the joint mascot, whatever scope is previewed above.
  const jointTarget = targetFor("joint");

  const move = (delta: number) => {
    setBalance(b => b + delta);
    const kind = reactionForBalanceChange(delta, available);
    if (kind) setReaction(r => ({ kind, id: (r?.id ?? 0) + 1 }));
  };

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
  };

  return (
    <main style={pageStyle}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>Mascot lab</h1>
        <button type="button" onClick={toggleTheme} style={chipStyle(false)}>{dark ? "Light" : "Dark"}</button>
      </header>
      {/* Category jars vs budget bars: first, so it opens right on a phone. */}
      <CategoryJarLab />

      <section aria-label="Preview" style={stageStyle}>
        <Mascot target={target} reaction={reaction} size={180} calm={calm} {...jar} />
        <p style={readoutStyle}>
          {target.scope} ({target.mood}{target.celebrate ? ", heart" : ""})
          {target.coins ? ` Coins ${Math.round(((target.coins.anas ?? 0) + (target.coins.salma ?? 0)) * 100)}%` : target.fill !== undefined ? ` Filled ${Math.round(target.fill * 100)}%` : target.scope === "joint" && !target.celebrate ? ` Apart ${Math.round(target.gap * 100)}%` : ""}
        </p>
      </section>


      <section aria-label="Controls" style={cardStyle}>
        <Field label="Scope">
          <div role="group" aria-label="Scope" style={{ display: "flex", gap: 8 }}>
            {SCOPES.map(s => (
              <button key={s.key} type="button" aria-pressed={scope === s.key} onClick={() => setScope(s.key)} style={chipStyle(scope === s.key)}>{s.label}</button>
            ))}
          </div>
        </Field>

        <Field label="Outline">
          <div role="group" aria-label="Outline" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {([["orb", "Orb"], ["squircle", "Squircle"], ["partner", "Per partner"]] as const).map(([key, label]) => (
              <button key={key} type="button" aria-pressed={outline === key} onClick={() => setOutline(key)} style={chipStyle(outline === key)}>{label}</button>
            ))}
          </div>
        </Field>
        {outline === "partner" && (
          <Field label="Salma's shape">
            <div role="group" aria-label="Salma's shape" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {([["egg", "Egg"], ["drop", "Drop"], ["bean", "Bean"], ["pebble", "Pebble"]] as const).map(([key, label]) => (
                <button key={key} type="button" aria-pressed={salmaShape === key} onClick={() => setSalmaShape(key)} style={chipStyle(salmaShape === key)}>{label}</button>
              ))}
            </div>
          </Field>
        )}
        <Field label="Body">
          <div role="group" aria-label="Body" style={{ display: "flex", gap: 8 }}>
            {(["shape", "liquid", "coins", "spent"] as const).map(b => (
              <button key={b} type="button" aria-pressed={body === b} onClick={() => setBody(b)} style={chipStyle(body === b)}>{b === "liquid" ? "Pool" : b[0].toUpperCase() + b.slice(1)}</button>
            ))}
          </div>
        </Field>
        {liquid && (
          <>
            <Range label="Anas contributed (of joint target)" value={anasShare} min={0} max={100 - salmaShare} step={1} unit="%" onChange={setAnasShare} />
            <Range label="Salma contributed (of joint target)" value={salmaShare} min={0} max={100 - anasShare} step={1} unit="%" onChange={setSalmaShare} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button type="button" onClick={() => contribute("anas", 5)} style={chipStyle(false)}>Anas +5%</button>
              <button type="button" onClick={() => contribute("salma", 5)} style={chipStyle(false)}>Salma +5%</button>
              <button type="button" onClick={() => setSpentPct(v => Math.min(130, v + 10))} style={chipStyle(false)}>Spend 10%</button>
            </div>
          </>
        )}
        {body === "spent" && (
          <Field label={`Spent ${fmt(spentTotal)} of ${fmt(plan)} MAD (${Math.round((spentTotal / plan) * 100)}%)`}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button type="button" onClick={() => spend("coffee", 35)} style={chipStyle(false)}>☕ 35</button>
              <button type="button" onClick={() => spend("groceries", 240)} style={chipStyle(false)}>🍽️ 240</button>
              <button type="button" onClick={() => spend("transport", 60)} style={chipStyle(false)}>🏍️ 60</button>
              <button type="button" onClick={() => spend("medical", 615)} style={chipStyle(false)}>💊 615</button>
              <button type="button" onClick={() => spend("rent", 3500)} style={chipStyle(false)}>🏠 3.500</button>
              <button type="button" onClick={() => setSpends(list => list.slice(0, -1))} style={chipStyle(false)}>Undo last</button>
              <button type="button" onClick={() => setSpends([])} style={chipStyle(false)}>New month</button>
            </div>
          </Field>
        )}
        {body === "liquid" && (
          <Field label="Liquid">
            <div role="group" aria-label="Liquid" style={{ display: "flex", gap: 8 }}>
              {([["partner", "Partner"], ["lime", "Lime"], ["smoke", "Smoke"], ["honey", "Honey"]] as const).map(([key, label]) => (
                <button key={key} type="button" aria-pressed={liquidTone === key} onClick={() => setLiquidTone(key)} style={chipStyle(liquidTone === key)}>{label}</button>
              ))}
            </div>
          </Field>
        )}
        {body === "coins" && (
          <Field label="Coin">
            <div role="group" aria-label="Coin" style={{ display: "flex", gap: 8 }}>
              {([["beads", "Beads"], ["metal", "Metal"], ["emoji", "🪙 Emoji"]] as const).map(([key, label]) => (
                <button key={key} type="button" aria-pressed={coinStyle === key} onClick={() => setCoinStyle(key)} style={chipStyle(coinStyle === key)}>{label}</button>
              ))}
            </div>
          </Field>
        )}
        {liquid && (
          <Field label="Glass">
            <div role="group" aria-label="Glass" style={{ display: "flex", gap: 8 }}>
              {(["off", "fake"] as const).map(g => (
                <button key={g} type="button" aria-pressed={glass === g} onClick={() => setGlass(g)} style={chipStyle(glass === g)}>{g[0].toUpperCase() + g.slice(1)}</button>
              ))}
            </div>
          </Field>
        )}
        {body === "coins" && (
          <>
            <Field label="Physics">
              <div role="group" aria-label="Physics" style={{ display: "flex", gap: 8 }}>
                {([["off", "Off"], ["custom", "Custom"], ["matter", "Matter"]] as const).map(([key, label]) => (
                  <button key={key} type="button" aria-pressed={physics === key} onClick={() => setPhysics(key)} style={chipStyle(physics === key)}>{label}</button>
                ))}
              </div>
            </Field>
            {physics !== "off" && (
              <>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <button type="button" onClick={() => setShake(v => ({ id: (v?.id ?? 0) + 1 }))} style={chipStyle(false)}>Shake</button>
                  <button type="button" onClick={enablePhoneMotion} aria-pressed={phoneMotion} style={chipStyle(phoneMotion)}>{phoneMotion ? "Phone motion on" : "Use phone motion"}</button>
                </div>
                <Range label="Tilt" value={tiltDeg} min={-60} max={60} step={1} unit="°" onChange={setTiltDeg} />
              </>
            )}
          </>
        )}
        <Range label="Joint funding gap" value={fundingGap} min={0} max={6000} step={50} unit="MAD" onChange={setFundingGap} />
        <Range label="Spent this month" value={spentPct} min={0} max={130} step={1} unit="%" onChange={setSpentPct} />
        <Range label="Unassigned" value={unassigned} min={0} max={3000} step={50} unit="MAD" onChange={setUnassigned} />
        <Range label="Available in categories" value={available} min={0} max={8000} step={50} unit="MAD" onChange={setAvailable} />

        <Field label={`Balance ${fmt(balance)} MAD`}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button type="button" onClick={() => move(500)} style={chipStyle(false)}>+500 income</button>
            <button type="button" onClick={() => move(-40)} style={chipStyle(false)}>−40 expense</button>
            <button type="button" onClick={() => move(-1500)} style={chipStyle(false)}>−1.500 expense</button>
          </div>
        </Field>

        <Field label="Mood">
          <select className="choice-trigger" value={moodOverride} onChange={e => setMoodOverride(e.target.value as Mood | "auto")}>
            {MOODS.map(m => <option key={m} value={m}>{m === "auto" ? "Auto (from data)" : m}</option>)}
          </select>
        </Field>

        <label style={toggleStyle}><input type="checkbox" checked={loading} onChange={e => setLoading(e.target.checked)} /> Loading</label>
        <label style={toggleStyle}><input type="checkbox" checked={calm} onChange={e => setCalm(e.target.checked)} /> Still (Reduce Motion)</label>
      </section>

      {liquid && (
        <section aria-label="Liquid instead of the monthly bar" style={cardStyle}>
          <span style={labelStyle}>Personal: {body} vs today's bar</span>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", alignItems: "center", gap: 16 }}>
            <Mascot target={targetFor("anas")} reaction={reaction} size={72} calm={calm} {...jar} />
            <div style={{ display: "grid", gap: 8 }}>
              <span style={{ ...labelStyle, display: "flex", justifyContent: "space-between" }}><span>This month</span><span>{spentPct}%</span></span>
              <span style={{ height: 6, borderRadius: 999, background: "var(--surface2)", overflow: "hidden" }}>
                <span style={{ display: "block", height: "100%", width: `${Math.min(100, spentPct)}%`, background: spentPct >= 100 ? "var(--spend-over)" : spentPct >= 85 ? "var(--spend-caution-deep)" : "var(--budget-used)" }} />
              </span>
            </div>
          </div>
        </section>
      )}

      <section aria-label="In context" style={cardStyle}>
        <span style={labelStyle}>Contributions connector (replaces the heart)</span>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 8, textAlign: "center" }}>
          <span><strong>Anas</strong><br /><span style={mutedStyle}>{fundingGap > 0 ? `${fmt(Math.round(fundingGap))} MAD due` : "Settled"}</span></span>
          <Mascot target={jointTarget} reaction={reaction} size={72} calm={calm} {...jar} />
          <span><strong>Salma</strong><br /><span style={mutedStyle}>Settled</span></span>
        </div>
        <span style={labelStyle}>Sizes</span>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {[32, 48, 72].map(size => <Mascot key={size} target={target} reaction={reaction} size={size} calm={calm} />)}
        </div>
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div style={{ display: "grid", gap: 8 }}><span style={labelStyle}>{label}</span>{children}</div>;
}

function Range({ label, value, min, max, step, unit, onChange, disabled }: {
  label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void; disabled?: boolean;
}) {
  return (
    <label style={{ display: "grid", gap: 8, opacity: disabled ? 0.45 : 1 }}>
      <span style={{ ...labelStyle, display: "flex", justifyContent: "space-between" }}>
        <span>{label}</span><span>{fmt(value)} {unit}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={e => onChange(Number(e.target.value))} style={{ width: "100%", minHeight: 44, accentColor: "var(--accent)" }} />
    </label>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100dvh", maxWidth: 520, margin: "0 auto", padding: "24px 16px 48px",
  display: "grid", gap: 16, alignContent: "start", background: "var(--bg)", color: "var(--text)",
  fontFamily: "var(--font-body)", boxSizing: "border-box",
};
// Pinned while the controls scroll underneath, so every change stays in view.
const stageStyle: CSSProperties = {
  position: "sticky", top: 0, zIndex: 1, display: "grid", justifyItems: "center", gap: 8,
  padding: "12px 0", margin: "0 -16px", background: "var(--bg)", borderBottom: "1px solid var(--border)",
};
const cardStyle: CSSProperties = { display: "grid", gap: 16, padding: 16, borderRadius: "var(--radius-card)", background: "var(--surface)", border: "1px solid var(--border)" };
const labelStyle: CSSProperties = { fontSize: 12, fontWeight: 700, color: "var(--text2)" };
const mutedStyle: CSSProperties = { fontSize: 12, color: "var(--muted)" };
const readoutStyle: CSSProperties = { margin: 0, fontSize: 13, color: "var(--muted)", fontVariantNumeric: "tabular-nums" };
const toggleStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 10, minHeight: 44, fontSize: 15 };
const chipStyle = (selected: boolean): CSSProperties => ({
  minHeight: 44, padding: "0 16px", borderRadius: 999, cursor: "pointer", fontSize: 14, fontWeight: 600,
  border: `1px solid ${selected ? "transparent" : "var(--border)"}`,
  background: selected ? "var(--text)" : "var(--surface)", color: selected ? "var(--bg)" : "var(--text)",
});
