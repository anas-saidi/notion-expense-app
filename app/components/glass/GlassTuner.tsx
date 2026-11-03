"use client";
import { useEffect, useState } from "react";
import { DEFAULT_GLASS, GLASS_CONTROLS, parseGlassPreset, type GlassPreset } from "./glass-preview";
import "./glass-tuner.css";

const STORAGE = "finance-glass-preview-v1";
export default function GlassTuner({ onPreview, theme, onTheme }: {
  onPreview: (preset: GlassPreset | null) => void;
  theme: "system" | "light" | "dark";
  onTheme?: (theme: "system" | "light" | "dark") => void;
}) {
  const [preset, setPreset] = useState<GlassPreset>(DEFAULT_GLASS);
  const [ready, setReady] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [baseline, setBaseline] = useState(false);
  const [status, setStatus] = useState("");
  const [exportText, setExportText] = useState("");
  useEffect(() => {
    try {
      const hash = new URLSearchParams(window.location.hash.slice(1)).get("glass");
      const saved = hash ?? localStorage.getItem(STORAGE);
      if (saved) { const parsed = parseGlassPreset(JSON.parse(saved)); if (parsed) setPreset(parsed); }
    } catch { /* A malformed link or unavailable storage uses the shipped defaults. */ }
    setReady(true);
    return () => onPreview(null);
  }, [onPreview]);
  useEffect(() => {
    if (!ready) return;
    // Refit Glisse after a slider settles, rather than rebuilding its SVG lens on every pointer event.
    const timer = window.setTimeout(() => onPreview(baseline ? null : preset), 180);
    try { localStorage.setItem(STORAGE, JSON.stringify(preset)); } catch { /* Preview still works. */ }
    return () => clearTimeout(timer);
  }, [preset, ready, baseline, onPreview]);
  async function copy(link: boolean) {
    const url = new URL(window.location.href);
    url.hash = new URLSearchParams({ glass: JSON.stringify(preset) }).toString();
    const value = link ? url.toString() : JSON.stringify({ library: "glisse", version: "0.5.0", preset }, null, 2);
    setExportText(value);
    try { await navigator.clipboard.writeText(value); setStatus(link ? "Preview link copied" : "Settings copied"); }
    catch { setStatus("Select and copy the text below"); }
  }
  return <aside className="glass-tuner" data-expanded={expanded} aria-label="Navigation glass preview">
    <button className="glass-tuner-toggle" aria-expanded={expanded} aria-controls="glass-tuner-panel" onClick={() => setExpanded(!expanded)}>
      Glass preview <span>{expanded ? "Hide" : "Tune"}</span>
    </button>
    {expanded && <div id="glass-tuner-panel" className="glass-tuner-panel">
      <h2>Navigation glass</h2>
      <p>This is the real app navigation and Add button. Scroll content behind them, then tap, hold or drag a tab.</p>
      <p className="glass-tuner-note">Preview only. Settings stay on this device until you share them. Safari uses Glisse’s frosted fallback; test on the devices you use.</p>
      <label className="glass-tuner-theme">Appearance <select value={theme} onChange={e => onTheme?.(e.target.value as typeof theme)}>
        <option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option>
      </select></label>
      <label className="glass-tuner-compare"><input type="checkbox" checked={baseline} onChange={e => setBaseline(e.target.checked)} /> Compare with current app</label>
      <fieldset disabled={baseline}><legend className="sr-only">Glass settings</legend>
        {GLASS_CONTROLS.map(c => <label className="glass-tuner-control" key={c.key}>
          <span>{c.label}<output>{preset[c.key]}{"unit" in c ? c.unit : ""}</output></span>
          <input type="range" min={c.min} max={c.max} step={c.step} value={preset[c.key]} onChange={e => { setPreset(p => ({ ...p, [c.key]: Number(e.target.value) })); setStatus(""); }} />
        </label>)}
      </fieldset>
      <div className="glass-tuner-actions">
        <button onClick={() => { setPreset({ ...DEFAULT_GLASS }); setBaseline(false); setExportText(""); }}>Reset</button>
        <button onClick={() => copy(false)}>Copy settings</button>
        <button onClick={() => copy(true)}>Copy preview link</button>
      </div>
      <p role="status" className="glass-tuner-status">{status}</p>
      {exportText && <textarea aria-label="Shareable glass settings or preview link" readOnly value={exportText} onFocus={e => e.target.select()} rows={4} />}
      <a href="/">Exit preview</a>
    </div>}
  </aside>;
}
