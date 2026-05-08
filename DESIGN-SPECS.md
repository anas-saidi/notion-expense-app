# Household Stats Card Design Spec

## Overview

This spec defines a calm, tap-to-switch stats card for a shared household finance app.

The card should show:
- `planned vs spent vs remaining`
- scope switching between `Household`, `Wife`, and `Husband`
- subtle animation with low visual noise

The interaction should feel quiet, elegant, and easy to scan on mobile.

## Design Direction

Use a blended design approach:
- `Notion` as the visual base for warmth, spacing, thin borders, and calm surfaces
- `Wise` for financial hierarchy and budget readability
- `Linear` only for subtle motion behavior

Avoid loud fintech styling, dense KPI grids, or overt tab bars.

## Component

`HouseholdStatCard`

Purpose:
A single card that shows `planned vs spent vs remaining`, while letting the user tap the main number to cycle between `Household`, `Wife`, and `Husband`.

## Content Structure

Top left:
- Eyebrow: `This month`

Main area:
- Active scope label: `Household` / `Wife` / `Husband`
- Main number: default to `spent so far`
- Secondary line: `of {planned} planned`
- Tertiary line: `{remaining} remaining` or `{over} over plan`

Bottom:
- Progress bar
- Small status text: `On track`, `Near limit`, or `Over budget`

Optional micro hint:
- `Tap amount to switch`
- Show only on first visits, then hide permanently

## Default State

Start on `Household`.

Reason:
- it matches the shared nature of the app
- it gives the clearest monthly overview
- partner views feel like drill-down, not competing top-level dashboards

## Tap Behavior

Tap target:
- the whole number block, not just the digits

Cycle order:
- `Household -> Wife -> Husband -> Household`

On each tap, update:
- scope label
- main amount
- planned amount in supporting line
- remaining or over text
- progress bar value
- status text

Do not change:
- card size
- layout
- typography scale
- surrounding chrome

## Visual Hierarchy

Style direction:
- Notion-like calm base
- Wise-like emphasis on money numbers

Suggested hierarchy:
- Eyebrow: 12px-13px, medium, muted
- Scope label: 14px, semibold
- Main number: 36px-44px, semibold or bold
- Supporting lines: 14px-15px, muted
- Status line: 12px-13px, medium

## Color System

Background:
- warm off-white

Card:
- white with whisper border

Text:
- near-black for primary
- warm gray for secondary

Accent:
- one accent only
- muted green is best for this use case

Status colors:
- `On track`: green
- `Near limit`: amber
- `Over budget`: red

Keep fills soft, not saturated.

## Progress Bar

Track:
- thin, around 8px high
- warm neutral background

Fill:
- green under 85%
- amber from 85% to 100%
- red above 100%

Bar behavior:
- width animates between states
- no bouncing
- no striped effects
- no gradient needed

## Motion

Animation should feel almost invisible.

Timing:
- `180ms` to `220ms`

Easing:
- `ease-out`

Transitions:
- scope label crossfade
- number swaps with slight vertical motion
- supporting text crossfades
- progress bar width animates smoothly

Suggested motion:
- outgoing number: opacity `1 -> 0`, translateY `-4px`
- incoming number: opacity `0 -> 1`, translateY `4px -> 0`

Respect reduced motion:
- if reduced motion is enabled, use fade only

## Discoverability

Because tabs are removed, keep one subtle clue:
- scope label always visible above the number
- optional 3 tiny dots below the number block
- active dot matches current scope

Example:
- filled dot = current
- two faded dots = other views

That is enough to imply multiple states without clutter.

## Example Copy

Household:
- `Household`
- `2,340 MAD`
- `of 3,200 MAD planned`
- `860 MAD remaining`
- `On track`

Wife:
- `Wife`
- `1,180 MAD`
- `of 1,600 MAD planned`
- `420 MAD remaining`

Husband:
- `Husband`
- `1,160 MAD`
- `of 1,600 MAD planned`
- `440 MAD remaining`

If over:
- `180 MAD over plan`
- status becomes `Over budget`

## Mobile Behavior

On mobile:
- full-width card
- keep the same single-card model
- do not split partner stats side-by-side
- center the number block or left-align consistently, but keep it stable across states

## Implementation Notes

State shape:

```ts
type Scope = "household" | "wife" | "husband";

type StatView = {
  spent: number;
  planned: number;
  remaining: number;
  progress: number;
  status: "on-track" | "near-limit" | "over-budget";
};
```

Derived logic:
- `remaining = planned - spent`
- `progress = spent / planned`
- if `remaining < 0`, show over-budget copy with absolute value

## Reference Files

- [Notion Design](C:/Users/HP/Downloads/awesome-design-md-main/awesome-design-md-main/design-md/notion/DESIGN.md)
- [Wise Design](C:/Users/HP/Downloads/awesome-design-md-main/awesome-design-md-main/design-md/wise/DESIGN.md)
- [Linear Design](C:/Users/HP/Downloads/awesome-design-md-main/awesome-design-md-main/design-md/linear.app/DESIGN.md)
