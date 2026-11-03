import { describe, expect, it } from "vitest";
import { DEFAULT_GLASS, glassPreviewStyle, parseGlassPreset } from "./glass-preview";

describe("shareable glass presets", () => {
  it("round-trips the shipped material through a preview link", () => {
    const hash = new URLSearchParams({ glass: JSON.stringify(DEFAULT_GLASS) }).toString();
    expect(parseGlassPreset(JSON.parse(new URLSearchParams(hash).get("glass")!))).toEqual(DEFAULT_GLASS);
    const style = glassPreviewStyle(DEFAULT_GLASS) as Record<string, unknown>;
    expect(style["--lg-glass-bend"]).toBe(.4);
    expect(style["--glass-preview-light-shine"]).toBe(0);
    expect(style["--glass-preview-dark-shine"]).toBe(0);
  });
  it("rejects malformed, incomplete and out-of-range imported values", () => {
    for (const input of [null, {}, { ...DEFAULT_GLASS, blur: "3" }, { ...DEFAULT_GLASS, blur: 100 }, { ...DEFAULT_GLASS, bend: NaN }, { ...DEFAULT_GLASS, shine: Infinity }]) {
      expect(parseGlassPreset(input)).toBeNull();
    }
    expect(parseGlassPreset({ ...DEFAULT_GLASS, css: "untrusted" })).toEqual(DEFAULT_GLASS);
  });
});
