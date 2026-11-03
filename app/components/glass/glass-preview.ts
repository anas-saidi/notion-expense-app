import type { CSSProperties } from "react";

export const GLASS_CONTROLS = [
  { key: "tint", label: "Tint strength", min: 0, max: 1.3, step: .05, initial: .45 },
  { key: "blur", label: "Surface frost", min: 0, max: 16, step: .5, initial: 7, unit: "px" },
  { key: "bend", label: "Surface refraction", min: 0, max: 1, step: .05, initial: .4 },
  { key: "dispersion", label: "Surface colour separation", min: 0, max: 2, step: .1, initial: .1 },
  { key: "lensBend", label: "Moving lens refraction", min: 0, max: .6, step: .05, initial: 0 },
  { key: "lensDispersion", label: "Moving lens colour separation", min: 0, max: 4, step: .1, initial: 0 },
  { key: "shine", label: "Rim highlight", min: 0, max: 2, step: .1, initial: 0 },
] as const;
export type GlassPreset = { [K in typeof GLASS_CONTROLS[number]["key"]]: number };
export const DEFAULT_GLASS = Object.fromEntries(GLASS_CONTROLS.map(c => [c.key, c.initial])) as GlassPreset;
export function parseGlassPreset(input: unknown): GlassPreset | null {
  if (!input || typeof input !== "object") return null;
  const candidate = input as Record<string, unknown>;
  if (!GLASS_CONTROLS.every(c => typeof candidate[c.key] === "number" && Number.isFinite(candidate[c.key]) && Number(candidate[c.key]) >= c.min && Number(candidate[c.key]) <= c.max)) return null;
  return Object.fromEntries(GLASS_CONTROLS.map(c => [c.key, candidate[c.key]])) as GlassPreset;
}
export function glassPreviewStyle(p: GlassPreset): CSSProperties {
  return {
    "--glass-preview-tint": p.tint,
    "--glass-preview-light-shine": .3 * p.shine, "--glass-preview-dark-shine": .13 * p.shine,
    "--lg-blur": `${p.blur}px`, "--lg-glass-bend": p.bend,
    "--lg-glass-dispersion": p.dispersion, "--lg-tab-bend": p.lensBend,
    "--lg-tab-dispersion": p.lensDispersion,
  } as CSSProperties;
}
