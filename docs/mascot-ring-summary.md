# Mascot Ring Summary

## Overview
We are exploring a mascot-driven hero for the couple finance app. The mascot replaces the progress bar with a ring that shows budget progress, plus subtle personality shifts that reflect the household's budget health. The goal is to keep the interface playful but calm, with lightweight motion that does not distract from core tasks.

## Concept
- A soft, squishy blob mascot sits in the hero area.
- A circular ring wraps the mascot to show budget progress (spent vs planned).
- The ring can split into two arcs to show partner spend (wife/husband).
- Contribution ticks become small beads on the ring edge.
- The mascot's face shifts based on budget status (on track / close / over).

## Ring Behavior
- Ring fill = total spent / total planned.
- Partner split = pink and blue adjacent arcs.
- Contribution ticks = small beads positioned by planned contribution amounts.
- Over-budget = a small accent or break in the ring (subtle warning cue).

## Mascot Moods
- On track: gentle smile, soft blush, slow breathing ring.
- Close to limit: neutral mouth, slight brow tilt, breathing slows.
- Over budget: small frown, breathing stops, warning accent shows.

## Motion (Subtle)
- Breathing loop on the ring: scale 1.00 -> 1.03 -> 1.00 over ~1.2s.
- Tap ring: brief blob squish (scale down then settle).
- Tap tick: bead pulses once and reveals the contribution chip.

## Copy Integration
- Keep a small line under the ring: "Spent $X of $Y planned".
- Status label stays concise: "On track", "Close", "Over".

## Design Principles
- Playful but not childish.
- Micro-interactions under 1s.
- Keep attention on the main number (ready to fund).
- Avoid clutter by hiding details until tap.

## Next Steps
- Choose mascot style details (eyes, cheeks, expression intensity).
- Decide ring thickness (thin, medium, chunky).
- Define exact color tokens for ring and beads.
- Decide if split arcs are always visible or only on tap.
