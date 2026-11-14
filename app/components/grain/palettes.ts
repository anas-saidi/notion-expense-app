/**
 * Study palettes for the light mascot (dev only). Users will pick their own mascot
 * colour, so each colour is a pair of tones, like the reference's light:
 *   core   the deep, saturated heart of the light (the reference's orange)
 *   halo   the pale rim and the room around it (the reference's soft yellow)
 * A palette assigns one colour to each partner; Couple shows both.
 */
export type Tone = { core: string; halo: string; name: string };
export type PaletteId = "partner" | "amber-periwinkle" | "amber-teal";

const BLUE: Tone = { name: "Blue", core: "#4a8ddb", halo: "#9cc5f0" };
const PINK: Tone = { name: "Pink", core: "#de5a85", halo: "#f3a9c1" };
const AMBER: Tone = { name: "Amber", core: "#f7923a", halo: "#fbd57c" };
const PERIWINKLE: Tone = { name: "Periwinkle", core: "#7c86ee", halo: "#c2c7fa" };
const TEAL: Tone = { name: "Teal", core: "#2ea596", halo: "#a3e1d2" };

export const PALETTES: Record<PaletteId, { anas: Tone; salma: Tone }> = {
  partner: { anas: BLUE, salma: PINK },
  // Amber with a cool partner: periwinkle is the sunset pair from the first reference; teal is the fresher alternative.
  "amber-periwinkle": { anas: PERIWINKLE, salma: AMBER },
  "amber-teal": { anas: TEAL, salma: AMBER },
};
