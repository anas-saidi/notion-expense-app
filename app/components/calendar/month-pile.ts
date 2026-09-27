/**
 * Lays out a month's top categories as emojis piled up on a flat floor. Each
 * emoji's area is proportional to spend; it's dropped from above and settles at
 * the lowest spot it can reach (the floor, or on top of emojis already placed),
 * so the pile reads as gravity, not a chart. Emojis collide as circles.
 * Pure and deterministic: the same month always piles the same way.
 */

export type PileInput = { id: string; amount: number };
export type PiledItem = { id: string; x: number; y: number; r: number };

type Options = {
  /** Half the box's side (viewBox units, centred on 0,0; y grows downward, floor at +size). */
  size: number;
  /** Share of the box's area the whole pile covers, 0–1. */
  fill: number;
  /** Space kept between emojis. */
  gap?: number;
};

export function pileMonth(items: PileInput[], options: Options): PiledItem[] {
  // A pile too tall for the box is shrunk as a whole until it fits, so sizes stay proportional.
  let fill = Math.max(0, Math.min(1, options.fill));
  for (let attempt = 0; attempt < 12; attempt++) {
    const pile = tryPile(items, { ...options, fill });
    if (pile) return pile;
    fill *= 0.88;
  }
  return tryPile(items, { ...options, fill }, true)!;
}

function tryPile(items: PileInput[], { size, fill, gap = 0.6 }: Options, force = false): PiledItem[] | null {
  const positive = items.filter((item) => item.amount > 0);
  const total = positive.reduce((sum, item) => sum + item.amount, 0);
  if (total <= 0) return [];

  const area = 4 * size * size * fill;
  const placed: PiledItem[] = [];
  const sorted = [...positive].sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id));
  for (const item of sorted) {
    const r = Math.sqrt((area * (item.amount / total)) / Math.PI);
    const reach = size - r;
    if (reach <= 0) { if (!force) return null; placed.push({ id: item.id, x: 0, y: 0, r }); continue; }

    let best: PiledItem | null = null;
    const step = reach / 40;
    for (let x = -reach; x <= reach + 1e-9; x += step) {
      // Falling from above, the emoji stops at the first thing it touches.
      let y = size - r;
      for (const other of placed) {
        const reachOther = r + other.r + gap;
        const dx = x - other.x;
        if (Math.abs(dx) < reachOther) y = Math.min(y, other.y - Math.sqrt(reachOther * reachOther - dx * dx));
      }
      if (y - r < -size - 1e-6) continue;
      // Lowest wins; between equals, the one nearer the middle.
      if (!best || y > best.y + 1e-6 || (Math.abs(y - best.y) <= 1e-6 && Math.abs(x) < Math.abs(best.x))) {
        best = { id: item.id, x, y, r };
      }
    }
    if (!best && !force) return null;
    placed.push(best ?? { id: item.id, x: 0, y: 0, r });
  }
  return placed;
}
