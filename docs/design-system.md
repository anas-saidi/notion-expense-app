# Design System — Couple Finance App

This document is the canonical design reference for the app. It ties together the emotional brief (`design.md`), the component spec (`design-specs.md`), and the CSS tokens (`app/globals.css`) into one place — and adds the new direction established from the 2026-03 inspiration review.

---

## 1. Color System

### Hybrid Palette

Two distinct semantic roles. These are never swapped or used interchangeably.

| Token | Value | Role |
|---|---|---|
| `--accent` | `#9fe870` | **Brand.** Positive state, completion, mode indicators, the FAB, progress fills |
| `--accent-ink` | `#163300` | Text on green surfaces |
| `--action` | `#3535E0` | **Action.** Split-panel interactive zones, primary CTAs that require a decision |
| `--action-ink` | `#ffffff` | Text on cobalt surfaces |
| `--bg` | `#fbfdf7` | App background (warm off-white) |
| `--surface` | `#ffffff` | Card and sheet surfaces |
| `--surface2` | `#f1f4ee` | Subtle secondary surfaces, input fills |
| `--border` | `rgba(14,15,12,0.12)` | Default card borders |
| `--border2` | `rgba(14,15,12,0.18)` | Stronger borders, button outlines |
| `--text` | `#0e0f0c` | Primary text |
| `--text2` | `#454745` | Secondary text |
| `--muted` | `#6e6e6d` | Labels, captions, placeholders |
| `--danger` | `#d03238` | Over-budget, destructive actions |
| `--warning` | `#ffd11a` | Near-limit state |
| `--success` | `#054d28` | Confirmed / saved state text |

**The rule in one sentence:**  
Green (`--accent`) means something good happened or the brand is present. Cobalt (`--action`) means the user needs to act right now.

### Spend-Tone Scale

Used on progress bars and budget rows to communicate health at a glance:

| Threshold | Color token |
|---|---|
| < 85% spent | `--accent` (green) |
| 85–100% | `--spend-caution` `#f59e0b` → `--spend-warn` `#f97316` |
| > 100% | `--spend-over` `#ef4444` |

### Partner Identity Colors

Not used as primary UI accent — only for per-partner attribution (account indicators, scope pills):

| Person | Color |
|---|---|
| Wife (Salma) | `#e86c95` — `--partner-wife` |
| Husband (Anas) | `#6aa6e6` — `--partner-husband` |

### Mode Overrides

`html[data-mode="wife"]` and `html[data-mode="husband"]` override `--accent`, `--bg`, and `--surface2` with slightly different tints. The cobalt `--action` color is **not** mode-dependent — it stays consistent regardless of who is using the app.

---

## 2. Typography

### Fonts Loaded

| Family | Weights | Role |
|---|---|---|
| **Fraunces** (serif) | 500, 600, 700 | Display headings, hero numbers |
| **Instrument Sans** | 400, 500, 600 | All body text, labels, buttons |
| **DM Mono** | 400, 500 | Eyebrows, amounts in mono contexts, timestamps |

### Scale

| Role | Family | Size | Weight | Notes |
|---|---|---|---|---|
| Screen title / hero | Fraunces | 32–44px | 700–800 | `line-height: 0.95` |
| Section heading | Instrument Sans | 20–24px | 760 | |
| Card title | Instrument Sans | 15px | 760 | |
| Body | Instrument Sans | 14–15px | 400–500 | |
| Button | Instrument Sans | 13px | 780–800 | |
| Caption / meta | Instrument Sans | 12px | 400 | |
| Eyebrow / label | DM Mono | 10–12px | 400 | uppercase, `letter-spacing: 0.4–0.5px` |
| Amount (large display) | DM Mono or Fraunces | 40–52px | 700 | `font-variant-numeric: tabular-nums` |
| Currency prefix | DM Mono | ~60% of amount size | 400 | `color: var(--muted)`, same baseline |

### Large Number Display Pattern

The primary pattern for any screen where a single amount is the focal point.

```
┌──────────────────────────────┐
│  THIS MONTH  ← DM Mono 11px uppercase muted
│
│  $ 2,340     ← "$" at 18px muted / "2,340" at 48px Fraunces bold
│  of 3,200 planned  ← Instrument Sans 13px text2
└──────────────────────────────┘
```

**Specs:**
- Label above: 11–12px DM Mono, uppercase, `var(--muted)`, 6–8px margin below
- Dollar prefix: 14–18px DM Mono, `var(--muted)`, vertically aligned to bottom of number
- Number: 40–52px, `var(--text)`, `tabular-nums`, Fraunces or DM Mono
- Supporting line: 13px Instrument Sans, `var(--text2)`, 4–6px margin above

**Use on:** home hero, category detail sheet header, account balance, planning amount canvas.

---

## 3. Spacing

Base unit: **4px**. All spacing should be a multiple of 4.

| Context | Value |
|---|---|
| Card inner padding (default) | 16–20px |
| Card inner padding (compact) | 10–14px |
| Section gap (between cards) | 20–24px |
| List item gap | 8–10px |
| Inline gap (icon + text) | 8–12px |
| Screen edge padding | 18–20px horizontal |
| Bottom nav clearance | `108px + env(safe-area-inset-bottom)` |

---

## 4. Shape

| Component | Border-radius |
|---|---|
| Full-screen panels | 0px (edge to edge) |
| Bottom sheets (top corners) | 24–28px |
| Cards | 16–20px |
| Buttons | 14px |
| Chips / pills | 12–14px |
| Icon containers | 12–14px |
| Badge / status dot | 999px (circle) |
| FAB | 50% |

---

## 5. Touch Targets

**Minimum: 44×44px** for all standalone interactive elements.

Chips inside a segmented container (e.g. "Active / Frozen" pill group) may be 38px tall — the container itself provides the surrounding clearance. This is the only permitted exception.

---

## 6. Component Patterns

### Pattern A — Split-Panel Layout

**When to use:** Any screen where the user is actively setting or confirming a value. The white zone is for display; the cobalt zone is for action.

```
┌───────────────────────────────────┐
│  WHITE ZONE                       │  ← var(--bg) or var(--surface)
│  Back button                      │
│  Screen title + subtitle          │
│  Category pill carousel           │
│  ── ── ── ── ── ── ── ── ── ──    │
│        $ 400                      │  ← Large number pattern (Pattern B)
│        of 1,500 total             │
│                                   │
├───────────────────────────────────┤  ← hard edge, no gradient, no border
│  COBALT ZONE  #3535E0             │  ← --action
│  ╌╌╌╌╌╌╌╌┼╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌   │  ← ruler-style slider track
│  Normal                           │  ← context label, white 100%
│  Sometimes you can eat at café.   │  ← description, white 60%
│                           [Save]  │  ← white pill button (not green)
└───────────────────────────────────┘
```

**Rules:**
- White always on top, cobalt always on bottom
- Text on cobalt: `#ffffff` at 100% for primary, 60% for secondary
- CTA button inside cobalt: white background, dark text — never use `--accent` here
- The slider track in the cobalt zone uses a ruler/tick mark style (not a smooth bar)
- Do NOT use this pattern for read-only or list screens

**Applicable screens:** Monthly planning allocation step, fund category flow, budget goal setting (future).

---

### Pattern B — Large Number Display

See Typography section above for full specs. Key points:
- Currency prefix is always smaller and muted — never the same size as the number
- Supporting lines live below, not beside
- Number itself should have generous vertical breathing room (min 24px above, 16px below)

---

### Pattern C — Bar Chart (Spending History)

Used inside **CategoryDetailsSheet** to show month-over-month spending for a single category.

**Visual specs:**
- Library: `recharts` (already installed, `^3.8.1`) — use `BarChart` + `Bar`
- Bar fill: `var(--accent)` for current/selected month; `color-mix(in srgb, var(--surface2) 70%, var(--border))` for past months
- Overspent portion of a bar: `var(--spend-over)` stacked above the normal fill
- Goal reference line: `<ReferenceLine>` dashed, `var(--muted)`, `strokeWidth: 1`
- Y-axis: hidden — no labels, no gridlines
- X-axis: month abbreviations, 11px DM Mono, `var(--muted)`, no axis line
- Bar gap: 4–6px between bars
- Tooltip on tap: single floating pill showing `MAD amount`, Instrument Sans 13px

**Data shape:**
```ts
type MonthBar = {
  month: string;       // "Jan", "Feb", etc.
  spent: number;
  planned: number;     // used for reference line
};
```

---

### Pattern D — Line Chart (Expense Trend)

Used in **HistoryScreen** spotlight card to show spending trend over a date range.

**Visual specs:**
- Library: `recharts` — use `LineChart` + `Line`
- Stroke: `#3535E0` (cobalt, `--action`), `strokeWidth: 2`, `type="monotone"` for smooth curve
- Dots: `r={4}`, white fill, `#3535E0` stroke, `strokeWidth: 2`
- No Y-axis, no gridlines, no X-axis line
- X-axis: date labels at start and end only (not every point), 11px DM Mono, `var(--muted)`
- Baseline: single horizontal line at y=0, `var(--border)`, 1px
- Date range: shown below the chart as two pill chips (e.g. "May 1" · "May 23")

---

## 7. Motion

All animations use the spring easing by default. Reserve `ease` for pure color/opacity transitions.

| Token | Value | Use |
|---|---|---|
| Spring easing | `cubic-bezier(0.22, 1, 0.36, 1)` | Transforms, scale, position |
| Standard easing | `ease` | Color, opacity, background crossfades |
| Fast | 150–180ms | Press states, micro-interactions |
| Standard | 200–280ms | Sheet open, tab switch, number swap |
| Slow | 350–450ms | Theme mode transitions, planning flow |

**Number swap animation** (for large number display cycling between scopes):
- Outgoing: `opacity 1→0`, `translateY 0→-4px`, 200ms ease-out
- Incoming: `opacity 0→1`, `translateY 4px→0`, 220ms ease-out, 20ms delay

**Always respect `prefers-reduced-motion`:**  
Skip all transform/scale animations. Allow opacity-only fades at reduced duration (120ms).

---

## 8. Existing Design Principles (from `design.md`)

These are non-negotiable constraints — new patterns must not violate them:

- **One number owns the screen at a moment.** Supporting detail lives below it.
- **Budget health is felt before it is read.** The UI communicates anxiety, calm, or satisfaction through behavior — before the user reads the number.
- **Friction is information.** When a control resists, it's telling the user something true.
- **Empty states are the beginning of something.** Never a blank screen — always an invitation.
- **Never overwhelm.** One action at a time. The couple is deciding together.

---

## 9. What This App Is Not

(Preserved from `design.md` — guides scope decisions for every new feature)

- Not a transaction log — there are other tabs for that
- Not a spreadsheet dressed as an app
- Not one person's tool that the other also has access to
- Not anxiety-inducing — every design choice defaults toward calm and clarity

---

## Related Files

| File | Purpose |
|---|---|
| `app/globals.css` | All CSS custom properties (source of truth for tokens) |
| `design.md` | Emotional and conceptual design brief |
| `design-specs.md` | HouseholdStatCard component spec |
| `docs/mobile-design-brief-and-audit.md` | Mobile-specific UX audit |
| `docs/monthly-planning-design-brief.md` | Planning flow design intent |
