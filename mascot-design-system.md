# Mascot Design System

A soft glass creature that holds money. It stands for a **pool of money** and shows that pool's state: how full it is, where it went, and how it's going. Everything here is written so the mascot can be rebuilt in a later version of this app or carried into another one. Values are the ones shipped in this app (`app/components/mascot/`).

Parts of the mechanics (radial-profile morphing, sphere-projected eyes, blink and gaze drift) and the eye expression presets are adapted from [bloub](https://github.com/jeremy-prt/bloub) under MIT — keep `BLOUB_LICENSE.txt` next to the code. bloub's own silhouettes, states and rest pose are not used.

---

## 1. Principles

1. **It is a jar, not a sticker.** It always holds something that means money: liquid (what's left) or category emojis (where it goes). If there is no pool of money to show, there is no mascot.
2. **One per screen, at hero weight.** Centred above the screen's main number and as heavy as it. Never a small decoration beside a row.
3. **Shape says who, colour supports.** Each person has their own silhouette; a shared pool is the midpoint of both. Colour is secondary and soft, so the mascot works for colour-blind users and in both themes.
4. **Calm by default.** It moves only when its data changes. Opening a screen never replays an entrance; it animates only what changed since it was last seen.
5. **Glanceable first, details on demand.** The jar gives the read at a glance; tapping reveals exact numbers.
6. **Soft, matte, muted.** Never game-like: no shine, no glow, no saturated candy colours, no hard outlines, no bounce.
7. **Decorative to assistive tech.** The drawing is `aria-hidden`; the same facts are always stated in text or in the tappable jar's accessible label.

---

## 2. Anatomy

| Layer (back → front) | What | Rule |
|---|---|---|
| Contact shadow | Blurred oval under the jar | `--mascot-shadow`; ellipse at y = 104, rx 64, ry 10, blur 6 (viewBox units). Never a drop shadow on the body. |
| Glass wash | The empty glass | Scope gradient at 7% (pool) or 24% (emoji jar). Never fully clear, never grey. |
| Glass thickness | Soft inner rim | Same gradient as a 26-unit stroke, blur 7, 22% opacity on a pool (32% on an emoji jar), clipped inside the body. Defines the silhouette without a line. |
| Contents | Liquid or emojis | Clipped to the body. |
| Face label | Page-coloured soft patch behind the eyes | Only when emojis sit behind the eyes. |
| Edge | Hairline outline | `--mascot-edge`, 1.8 units, blur 0.6. Always neutral — state is never carried by the outline. |
| Eyes | Two capsules | See §6. |

**Coordinate system.** SVG viewBox `-150 -150 300 300`; body rest radius = 100 (1 "body unit"). The visible jar is about two thirds of its box, so the jar's visible bottom sits ~16% of the box above the box's bottom edge, and its sides ~1/6 in.

---

## 3. Shapes

Bodies are **radial profiles**: 64 radii sampled around the centre (θ = 90° is straight down), drawn as a closed Catmull-Rom curve. Changing shape = interpolating radii, so any shape morphs into any other.

Every body **sags**: `r × (1 + a·sin θ)` with a = 0.035 — fuller at the bottom, narrower at the top, like something soft resting on a surface.

| Role | Shape | Profile |
|---|---|---|
| Partner A (here: Anas) | **Soft squircle** | superellipse n = 3.2, scale 0.93, sag 0.035. Deliberately softer than a true squircle so corners read as flesh, not machined edges. |
| Partner B (here: Salma) | **Egg** (default) | superellipse n = 2.1, sx 0.9, sy 1.04, then `r × (1 + 0.07·sin θ)`. Alternatives kept for trying: drop, bean, pebble. |
| Shared pool (joint) | **Midpoint** | The literal average of A's and B's radii. |

Rules:
- Two people's shapes must differ in silhouette at a glance (one has corners, one has none).
- The shared shape is always derived, never drawn separately, so it stays "between them" if either changes.
- Every variant (pool, emoji jar, loading) uses the same outline for the same scope.

---

## 4. Colour

| Token | Light | Dark | Use |
|---|---|---|---|
| Partner A hue | `#6aa6e6` | same | Base of A's liquid and wash (= `--partner-husband`). |
| Partner B hue | `#e86c95` | same | Base of B's liquid and wash (= `--partner-wife`). |
| `--mascot-edge` | `rgba(14,15,12,0.12)` | `rgba(255,255,255,0.2)` | Hairline edge. |
| `--mascot-shadow` | `rgba(14,15,12,0.1)` | `rgba(0,0,0,0.5)` | Contact shadow. |
| `--mascot-sticker` | `#ffffff` | `transparent` | Outline around emojis (none in dark, where it would read as a black border). |
| Eye ink (jar) | `var(--text)` | `var(--text)` | Eyes above the waterline follow the theme. |
| Eye ink (submerged) | `#0e0f0c` | `#0e0f0c` | Eyes under the liquid (level ≥ 0.55) always dark, on the pale liquid. |
| Low-pool red | `#d03238` (the `--danger` hue) | same | See below. |

**Softening.** Hues are never used at full strength. Liquid = hue mixed toward white:
- personal pool: 35% (`SOFTEN = 0.35`)
- shared pool: 55% for each partner's end, 60% for their mix in the middle (`SOFTEN_JOINT = 0.55`); the gradient runs A (left) → mix → B (right).

**Low pool.** A pool of money (a plan) keeps its colour until its last fifth (level < 0.2, ≈ 80% spent), then its liquid and wash blend linearly into the same softened red, fully red when empty. Only for pools where empty is a warning — never for a contribution jar or a "no plan" jar.

Don't: tint the empty glass grey, use a coloured outline for state, use gradients other than the scope gradient, add glow or shine.

---

## 5. Variants

### Pool — "how much is left"
- Liquid level = share left (e.g. `1 − spent / planned`), clamped 0–1.
- Surface: two slow sine waves (`0.6·sin(x/30 + 1.4t) + 0.4·sin(x/17 − 2t)`), resting amplitude 1 unit, +2.2 swell after a change decaying at `e^(−1.6t)`.
- Level changes ease in-out cubic over 0.6–1.2 s (longer for bigger changes). No pouring animation.
- Phone tilt: the surface stays level with gravity via a damped spring (k 18, damping 4.5).
- Tap: reveals details and drops the top 3 spending categories in as emojis (see Emoji rules); tap again sucks them out.

### Split — "where it goes"
- One emoji per category **with money left**, sized by its share of what's available, so the jar always matches the number beside it.
- Faint scope wash (24%) and white sticker outlines keep the shape and pale emojis legible.

### Allocation — "filling the plan"
- One emoji per category with money assigned, sized by its share of the pool being planned; unassigned money is empty space, so a balanced plan is a full jar.
- Moving money resizes emojis in place (source shrinks, destination grows).
- Face: curious while money is unassigned, excited when balanced, worried when over-assigned.

### Family (shared pool with both partners)
- Shared pool in the centre at hero size; each partner's small jar (64 px box) **cuddled** against its lower sides: bottoms level with the pool's, just touching its edge in front, leaning in (A 4°, B 8° — a tipped squircle reads as falling, so it leans less). Liquid stays level with the ground while leaning.
- A partner's jar level = share of their contribution paid; happy when settled, worried while something is due. No visible names — shape and colour identify them; names stay in accessible labels.
- The pool looks toward whoever owes the most (yaw ±18°).
- A partner's details come out of their **empty outer side**, never underneath.

### Corner / heading
- A small pool (87 px box) heading a summary card in place of a text label; face = pace (happy on or behind pace, worried ahead of the calendar, sad over plan).

### Loading
- Empty jar, sleepy face, in the saved mode's shape (112 px box) above the rotating status line.

---

## 6. Face

Two capsule eyes on a sphere-projected face; size, spacing, tilt and head direction carry the mood. Values are bloub's presets (w/h as fractions of the face radius, tilt in degrees, split = eye spacing).

| Mood | bloub name | Gaze yaw / pitch / roll | Split | Eyes (w, h, tilt, open) | Use |
|---|---|---|---|---|---|
| idle | attentif | 4 / 5 / −4 | 16 | 0.21, 0.44 | Default. |
| happy | heureux | 5 / 9 / 0 | 17 | 0.27, 0.17, 14 | Settled, on pace, funded. |
| excited | excite | 6 / −14 / 0 | 19.5 | 0.40, 0.56, −10 | Plan balanced. |
| worried | timide | −19 / −14 / −7 | 14 | 0.17, 0.30 | ≥ 85% spent, ahead of pace, something due, over-assigned. |
| sad | triste | 3 / −13 / 0 | 16 | 0.22, 0.40, −28 | ≥ 100% spent, over plan. |
| curious | curieux | 16 / −9 / −15 | 16.5 | 0.24/0.20, 0.46/0.38, −8 | Unassigned money; no plan yet. |
| sleepy | somnolent | 6 / −9 / −3 | 16 | 0.20, 0.42, 0, open 0.42 | Loading. |
| wince | blase | −22 / 2 / 0 | 16 | 0.30, 0.12 | Short reaction to a big drop. |

**Liveliness.** Seeded blink schedule (200 ms blinks), slow gaze drift. In a liquid jar the eyes watch the waterline; gaze is capped at pitch −28…22°, yaw ±32°. Expressions blend over 0.5 s.

**Reactions** (short, face only in a pool — no jiggle): `cheer` on money in, `dip` on a small drop, `wince` on a drop larger than a quarter of what's left.

---

## 7. Emoji contents

| Rule | Value |
|---|---|
| Size from share | `radius = √share × 0.7` (body units), so area tracks share. |
| Bounds — split jar | 0.13 – 0.34 (no single category fills the jar). |
| Bounds — top-3 in a pool | 0.14 – 0.30 (leave room for the face). |
| Bounds — allocation | 0.13 – 0.62 (big categories must still visibly shrink or grow). |
| Identity | Item id = the category's id, so a changed share **resizes in place** (eases ~0.25 s, nudging neighbours) instead of leaving and re-entering; a changed icon swaps the glyph in place. |
| Arrive | Drops straight in from the lid: speed 6 px/step at 120 Hz, near-zero spin, 0.06 s apart, first immediately. |
| Leave | **Sucked out through the top**: accelerating (ease-in cubic) toward the lid's centre over 0.42 s, top-most first, 0.05 s apart; the jar's clip hides it as it passes the rim. Never a fade or a burst. |
| Upright | Emojis settle upright (a small restoring spin); a flipped emoji reads as broken. |
| Physics | matter-js circles, fixed 1/120 s step (variable steps make bodies tunnel), jar outline as static wall segments. |

---

## 8. Interaction

- **Tap to reveal** (jars that have details): soft squish (scaleX 1 → 1.04 → 1, scaleY 1 → 0.95 → 1, 0.38 s, ease-out `[0.22, 1, 0.36, 1]`) plus haptics (light on open, selection tick on close). Details surface as a plain line of text — no pill, no background — sliding 10 px, fading and un-blurring (6 px → 0) from behind the jar, and stay until tapped again.
- The first time ever, one jar per app shows its details once by itself (after 900 ms), marked seen only once it has opened.
- The jar is a real `button`: `aria-expanded`, and an accessible name that carries the details ("This month: 91% spent (17,464 of 19,291 MAD); most went to …").
- Touch target ≥ 44 × 44 px.

---

## 9. Motion rules

- Moves only when data changes; animates only while on screen and the tab is visible.
- **Memory:** a hero jar remembers what it last showed on this device (per scope) and starts there, revealing the current state 350 ms after appearing — new emojis drop, removed ones are sucked out, the pool eases from its old level. First-ever visit: an emoji jar fills once from empty; a pool appears settled. Flows that open on fresh data (planning) don't remember.
- **Reduce Motion:** no drops, no squish, no memory replay; the current state is simply there, details fade.
- No looping idle animation beyond blinks and gentle drift.

---

## 10. Sizing

| Context | Box size | Notes |
|---|---|---|
| Screen hero | 175 px | Same weight as the main number. |
| Sheet / flow hero | 140 px | Keypad and editor below. |
| Corner / card heading | 87 px | Trim box margins so the jar aligns with text. |
| Loading | 112 px | |
| Partner (family) | 64 px | |

### App icon
- The shared (joint) jar, filled to 0.68 with the partner blend, **idle** face (the tall capsule eyes read best at small sizes; happy's flat eyes read as sleepy), contact shadow, on a light warm neutral (`#f6f5f2`).
- The jar fills ~62% of the tile, nudged so jar + shadow sit centred; the maskable version keeps everything inside the central 80% safe circle.
- Rendered from the engine itself (same frame, same tokens resolved to literals), never redrawn by hand: `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png` (180). Icon files must stay outside any sign-in gate.

---

## 11. Where it belongs

**Yes** — where it stands for a pool of money and can show its state:
home balance pool, budget split, planning / rebalancing / allocating flows, a monthly summary card, loading and empty states (branding).

**No** — data-entry sheets (add transaction), detail sheets that already have a progress bar, account screens (accounts aren't budget pools), anywhere as pure ornament, or more than one hero per screen.

---

## 12. Porting checklist

1. Copy `app/components/mascot/` (engine, shapes, face, physics, `Mascot`, `MascotHero`, `MascotSpill`, `memory`) and `BLOUB_LICENSE.txt`. Dependencies: `matter-js`, `motion`, a haptics helper.
2. Add the three tokens (`--mascot-edge`, `--mascot-shadow`, `--mascot-sticker`) in both themes.
3. Map your people to shapes and hues (§3, §4); keep the shared shape as their midpoint.
4. Decide each screen's pool and its meaning (level = what share? emojis = which items?) before placing a mascot (§11).
5. Wire moods to your domain's thresholds (§6) and give every mascot a text equivalent.
6. Check both themes, Reduce Motion, and a colour-blind simulation — the scopes must still be told apart by shape.
