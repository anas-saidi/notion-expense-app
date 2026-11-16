# Grain light: a portable design direction

A soft, coloured light that spreads from one point of a screen, fades into the page, and carries a fine grain where it settles. Everything else stays flat, neutral and quiet. The light is the one rich moment on the screen, and it always means something.

This file extracts the direction from the couple finance app (where the light comes from a money jar) so it can be applied to other products without the mascot. It describes the idea first, then a recipe, then the dials for adapting it. Read the "Fit check" before using it: the direction works because it is rare, so it should never be forced onto an app that has nothing to light.

## 1. The idea in four rules

1. **One light per screen, and it means something.** The light expresses one state the user cares about: how full, how healthy, how far along, whose. If you cannot finish the sentence "the light is bright when ___", don't add it.
2. **Light, not boxes.** Depth comes from the light, not from cards, borders or shadows. Content below the light sits on one plain surface.
3. **Nothing else glows.** No gradient buttons, no glowing icons, no decorative blur elsewhere. The light stays special because it is alone.
4. **The light is decoration; the fact is in text.** Every state the light shows is also stated in words and in accessible labels. Turning the light off loses no information.

## 2. Fit check

Use it when the product has:

- **A focal state** worth feeling at a glance: a balance, a streak, a goal, a status, a person, a season.
- **A hero region** at the top of a few primary screens, with breathing room below it.
- **A calm, mostly neutral UI** that can let one colour lead.

Skip it, or use only the smallest dial, when:

- The screen is dense with data (tables, dashboards, editors). The light competes with reading.
- The brand already has a strong visual signature (illustration system, photography, bold colour blocks). Two signatures fight.
- The state has no gradient of meaning (on or off only). A badge or a word does it better.
- Every screen would want one. If it's everywhere, it means nothing; pick the two or three screens where the state lives.

When unsure, start with the **Whisper** dial (section 6) on one screen and live with it for a day.

## 3. Anatomy

```
 ┌───────────────────────────────┐
 │        · ·  header (clear) ·  │  ← soft top fade, no hard line
 │             ( ● )             │  ← source: saturated core
 │          ░░( ◉ )░░            │  ← room: wide pale falloff, no flat fill
 │      ░ ░  Label  ░ ░          │  ← text sits on the pale part only
 │    ░ · 12,480 ·  ░            │
 │  · ░ · summary · ░ · ·        │  ← grain builds toward the bottom
 │ ·.·.·.·.·.·.·.·.·.·.·.·.·.·.· │
 ╰───────────────────────────────╯  ← content surface rises over the light
 │  plain content on page colour │
```

| Part | What it is | Why |
| - | - | - |
| **Source** | A small, saturated core where the light comes from (an object, an avatar, a number, or just a point) | Gives the light a place to belong; without it the room reads as a tinted panel |
| **Room** | A wide radial falloff of a paler tone around the source, with no flat fill anywhere | Makes the region feel lit, not painted |
| **Grain** | Static speckles in the light's own deep colour, faint near the source, densest where the light settles | Adds texture and warmth; hides gradient banding |
| **Fade** | One mask that ends light and grain together, soft at both top and bottom | No seam, no hard edge, text below sits on the plain page |
| **Surface** (optional) | A page coloured sheet with rounded top corners that rises over the bottom of the room | Ends the light cleanly and frames the content as one sheet |

## 4. Colour

Each light is a **pair** of tones from the same hue:

- **Core:** deep and saturated. Used for the source and for the grain.
- **Halo:** pale and soft. Used for the room.

```ts
type LightTone = { core: string; halo: string };

const tones = {
  blue:  { core: "#4a8ddb", halo: "#9cc5f0" },
  pink:  { core: "#de5a85", halo: "#f3a9c1" },
  amber: { core: "#f7923a", halo: "#fbd57c" },
  teal:  { core: "#2ea596", halo: "#a3e1d2" },
  periwinkle: { core: "#7c86ee", halo: "#c2c7fa" },
};
```

Rules:

- **Grain uses the core colour, never grey.** Grey grain looks like dirt; coloured grain looks like light.
- **Two lights stay two.** When two things share a screen (two people, two accounts), place two sources side by side, each with its own colour. Never blend them into a third colour.
- **Status hues are reserved.** If the light can turn warning or danger (honey, coral), keep those hues out of the normal palette so the shift reads.
- **Interface chrome stays neutral.** Buttons, navigation and text use ink and greys so the light owns colour.

## 5. Recipe (framework free CSS)

### Markup

```html
<section class="lit-stage">
  <div class="lit-room" aria-hidden="true"
       style="--light-core: #4a8ddb; --light-halo: #9cc5f0; --light-strength: 0.8"></div>
  <!-- hero content: source object (optional), label, number, summary -->
</section>
```

### Styles

```css
@property --light-strength { syntax: "<number>"; inherits: true; initial-value: 1; }

.lit-stage { position: relative; isolation: isolate; padding-bottom: 96px; }
.lit-stage > :not(.lit-room) { position: relative; z-index: 1; }

.lit-room {
  /* Inputs */
  --light-core: #4a8ddb;
  --light-halo: #9cc5f0;
  --light-strength: 1;      /* 0.35 (dim) to 1 (full); the meaning lives here */
  --light-x: 50%;
  --light-y: 160px;         /* centre of the source */
  --light-alpha: 0.7;       /* overall intensity for the theme */
  --wash: 20%;              /* how far the pale room reaches */

  --core: color-mix(in srgb, var(--light-core) calc(var(--light-alpha) * var(--light-strength) * 100%), transparent);
  --mid:  color-mix(in srgb, var(--light-halo) calc(var(--light-alpha) * var(--light-strength) * 38%), transparent);
  --wash-in:  color-mix(in srgb, var(--light-halo) calc(var(--light-strength) * var(--wash)), transparent);
  --wash-mid: color-mix(in srgb, var(--light-halo) calc(var(--light-strength) * var(--wash) * 0.45), transparent);

  --shape:
    radial-gradient(circle at var(--light-x) var(--light-y), var(--core) 0, var(--mid) 80px, transparent 140px),
    radial-gradient(ellipse 95% 80% at var(--light-x) var(--light-y), var(--wash-in) 0, var(--wash-mid) 50%, transparent 100%);

  position: absolute;
  inset: -16px -16px 0;     /* bleed past the page gutter: no visible side edge */
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
  /* One fade for light and grain: soft top, solid middle, soft bottom. */
  mask-image: linear-gradient(to bottom, transparent 0, #000 72px, #000 calc(100% - 150px), rgba(0,0,0,.55) calc(100% - 75px), transparent 100%);
  transition: --light-strength 700ms cubic-bezier(0.33, 0, 0.2, 1);
}

.lit-room::before,
.lit-room::after { content: ""; position: absolute; inset: 0; }

/* The light */
.lit-room::before { background: var(--shape); }

/* The grain: core coloured speckles, masked by a noise tile and a ramp that builds toward the bottom */
.lit-room::after {
  background: color-mix(in srgb, var(--light-core) 85%, #000);
  opacity: calc(0.25 + 0.5 * var(--light-strength));
  mask-image:
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='s'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.1' numOctaves='2' seed='9' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  3.4 0 0 0 -1.7'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23s)'/%3E%3C/svg%3E"),
    linear-gradient(to bottom, rgba(0,0,0,.05) 0%, rgba(0,0,0,.12) 45%, rgba(0,0,0,.4) 70%, #000 92%);
  mask-size: 180px 180px, 100% 100%;
  mask-repeat: repeat, no-repeat;
  mask-composite: intersect;
  transition: opacity 700ms cubic-bezier(0.33, 0, 0.2, 1);
}

/* Dark theme: the same light, dimmer, so it glows instead of lighting a panel */
[data-theme="dark"] .lit-room { --light-alpha: 0.5; --wash: 13%; }
[data-theme="dark"] .lit-room::after {
  background: var(--light-halo);
  opacity: calc(0.18 + 0.35 * var(--light-strength));
}

/* Accessibility */
@media (prefers-reduced-transparency: reduce) {
  .lit-room { --light-alpha: 0.3; }
  .lit-room::after { display: none; }
}
@media (prefers-contrast: more) { .lit-room { display: none; } }
@media (prefers-reduced-motion: reduce) { .lit-room, .lit-room::after { transition: none; } }
```

Add the `-webkit-` prefixed mask properties (`-webkit-mask-image`, `-webkit-mask-size`, `-webkit-mask-repeat`, and `-webkit-mask-composite: source-in`) for Safari.

### Optional: the content surface

```css
.lit-sheet-edge {
  position: absolute; z-index: 2; left: 0; right: 0;
  top: calc(100% - 28px); height: 640px;
  background: var(--bg);
  border-radius: 28px 28px 0 0;
  box-shadow: 0 -10px 28px -14px color-mix(in srgb, var(--text) 18%, transparent);
  pointer-events: none;
}
.lit-stage ~ * { position: relative; z-index: 3; }
```

Put it inside `.lit-stage` as the last child. Use it on phones; on desktop the hero card itself can be the room (`overflow: hidden` on the card, `inset: 0` on the light).

## 6. Dials: adapt instead of copying

Pick one setting per dial for the product. Most apps should land in the middle column.

| Dial | Whisper | Present | Full |
| - | - | - | - |
| **Strength range** (`--light-alpha`) | 0.35 | 0.55 | 0.7 |
| **Room reach** (`--wash`) | 8% | 14% | 20% |
| **Grain** (opacity multiplier) | none or 0.15 | 0.4 | 0.25 + 0.5 × strength |
| **Source** | none (wash only) | a soft point | an object or avatar drawn as light |
| **Where** | one screen | the primary screens | primary screens and key moments (success, onboarding) |
| **Edge** | inside a card | edge to edge in the hero | edge to edge, behind a transparent header |

Other ways to adapt:

- **No source object.** Drop the core gradient and keep only the wash and grain. This is the safest version for apps without a character or focal object, and it sits well behind charts.
- **Brand colour.** Derive the pair from the brand hue: core near the brand colour, halo at roughly 55 to 65% lightness toward white. Check contrast before choosing (section 8).
- **Shape of the room.** Keep it radial. A linear wash from the top reads as a header band; a light pooled at the bottom of a rounded card reads as a tray. Both work for smaller placements (a widget, an empty state), but the radial room is the default.
- **Wavy edge.** For a more organic, hand-made feel, bend the light's edge with a static `feTurbulence` plus `feDisplacementMap` filter (base frequency about 0.022, scale about 30, then a 2.5px blur). Apply it to the light layer only, never to the grain.

## 7. Mapping light to meaning

Choose one state per screen and map it to two or three channels. Keep the mapping the same everywhere in the product.

| Channel | Carries | Example |
| - | - | - |
| **Strength** (0.35 to 1) | Amount or progress | How full a goal is; never fully dark, so an empty state still shows the colour |
| **Core size** | The same amount, made spatial | A small ember growing to fill the source |
| **Hue shift** | Status | Normal hue, honey for "watch this", coral for "something is wrong" |
| **Number of sources** | Ownership | One light per person or account, side by side |

Guidelines:

- **Bright means "as it should be".** Dim means "needs you", a status hue means "wrong". Users learn this once; don't invert it on another screen.
- **Say the reason in words.** When the light is dim or tinted, the summary under the number gives the reason in one clause.
- **Never pair a light with a bare zero.** A finished state is words ("All done", "All assigned"); a glowing 0 confuses.
- **Not everything needs a level.** If a screen's hero has no meaningful state, use the steady wash at a fixed strength, or no light at all.

## 8. Text on light

- The fade should end the light **before or around** the main text where possible, so most words sit on the plain page.
- Labels over the room move one step darker than usual (for example from muted to secondary text).
- Captions inside the brightest area use the full text colour.
- Red text over the light goes one step deeper in light mode.
- Targets used in the original: 7:1 or better in light mode, 5.3:1 or better in dark. Check each palette pair; pale hues (amber, periwinkle) light a dark room a lot and need the lower dark wash.

## 9. Motion

- **No idle loop.** The light changes only when its state changes, then stops. No pulsing, breathing or drifting.
- **One curve for every light change:** 700ms `cubic-bezier(0.33, 0, 0.2, 1)` on strength and grain opacity together, so source and room move as one.
- **Screen switches:** swap instantly. Every screen keeps the same light in the same box, so a crossfade adds nothing, and a View Transition snapshot of the blurred light drifted on iPhone.
- **Grain never animates.** Animated grain looks like video noise and costs every frame.
- **Reduce Motion:** strength changes jump; crossfades keep opacity only.

## 10. Performance

- Everything is CSS: two gradients, one SVG noise tile as a mask, one mask for the fade. No canvas, no per frame drawing.
- Animate `--light-strength` through `@property` (registered as a number) so the transition runs without JavaScript.
- **Never write styles on scroll.** A scroll driven light (sinking, parallax) forces the browser to recompute the hero and its masks on every frame, which makes phones lag. Let the hero scroll with the page.
- Keep the noise tile small (160 to 180px) and static so it rasterises once.

## 11. Accessibility

- The light layer is `aria-hidden` and `pointer-events: none`.
- **Reduce Transparency:** keep the colour, halve the light, drop the grain.
- **Increased Contrast:** remove the room entirely (and the sheet edge with it).
- The state is always in text and accessible labels, so all three settings lose nothing.

## 12. Don'ts

- A light on every screen, or several lights competing on one screen.
- Glow on buttons, icons, cards, or text. The light lives in the hero only.
- Grey or black grain, or grain on flat page areas outside the light.
- Gradients in bars, charts or progress indicators. Data marks stay one solid colour; the gradient belongs only to the light.
- A flat tinted panel with grain on it. Without a falloff from a source, it is just a coloured box.
- Hard edges anywhere: top, sides or bottom.
- Purple by default, sparkles, or other borrowed "AI" decoration.
- A light whose state is not explained anywhere in text.

## 13. Checklist before shipping

- [ ] I can finish "the light is bright when ___" for every screen that has one.
- [ ] Only the hero has colour; chrome and data stay neutral or solid.
- [ ] Light and grain fade out together with no seam and no hard edge.
- [ ] Grain uses the core colour and is densest where the light settles.
- [ ] Text contrast passes in light and dark for every palette pair.
- [ ] Reduce Transparency, Increased Contrast and Reduce Motion each behave as described.
- [ ] Nothing animates while idle, and nothing writes styles on scroll.
- [ ] Turning the light off loses no information.

## Reference implementation

In this repository: `app/components/grain/grain-glow.css` and `GrainGlow.tsx` (the room, grain, sheet edge and accessibility settings), `app/components/grain/palettes.ts` (tone pairs), and the **Light** section of `design.md` (how the app maps the light to money).
