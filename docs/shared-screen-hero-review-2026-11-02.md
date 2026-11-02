# Shared screen hero, 2 November 2026

Home, Budget and Reflect now use one primary hero component. Mascot material, financial values and controls retain their screen-specific meanings.

## Findings and changes

| Rule | Evidence | Repair | Acceptance |
| --- | --- | --- | --- |
| IC-02 / IC-03 | Home amount capped at 88px; Budget at 56px; Reflect at 36px. Reflect used a 250px mascot; Home/Budget used 175px, with additional desktop zoom. | Shared 250px frame, responsive amount capped at 72px, 13px metric label and 18px summary. Remove obsolete sizing/zoom and layout overrides. | All three render `ScreenHero`; one token owns the frame. Pass in source and observed wide/narrow light views. |
| IC-04 / IC-14 | Reflect centered and capped its recap; Home used an unrestricted sentence; Budget used separate banner layouts and action styling. | Shared summary/action slots, left-aligned narrative facts, consistent spacing. Budget facts keep their existing actions. | Observed Home/Reflect summaries align consistently. Budget's normal Joint view has no active notice; conditional summary paths source-reviewed, not all triggered. |
| IC-10 / IC-12 | A larger common number could overflow narrow desktop cards or round decimal values through the integer counter. | Fit the measured value to available width, recheck on resize/font load, preserve decimal values through static `Money`, reserve number-row height. | TypeScript passes. Rendered Home, Budget and Reflect amounts checked against their source values. Extreme values and decimal cases source-reviewed; synthetic extreme-value rendering remains unverified. |

The 250px frame follows the user’s preferred mascot size. Main amounts remain centered on mobile and desktop. Reflect’s date picker and icon-only filter sit at the bottom of the hero; its date trigger shares Budget’s calendar-pill component and styling. A 72px amount cap reduces Home's dominance while making Budget and Reflect's main values comparably prominent. These are the app's shared baseline, not a universal optimal size for all products.

## Verification

- TypeScript: `npx tsc --noEmit` passed (final result in chat).
- CSS structure parsed with PostCSS after a broken selector was found and corrected during the wide-layout check.
- Whitespace check: `git diff --check` passed.
- Safari: Home, Budget and Reflect observed at narrow and wide window widths, light appearance. Existing month/filter controls and navigation remain present. These window captures are not a physical-phone test.
- No financial data was written.
- Not verified: exact 535px viewport, dark rendering, every warning/error state, full keyboard dialog flow, synthetic extremely long values and physical-device rendering.

## Local screenshots

| Screen | Narrow | Wide |
| --- | --- | --- |
| Home | [Home](../artifacts/hero-system-review/home-narrow.png) | [Home](../artifacts/hero-system-review/home-wide.png) |
| Budget | [Budget](../artifacts/hero-system-review/budget-narrow.png) | [Budget](../artifacts/hero-system-review/budget-wide.png) |
| Reflect | [Reflect](../artifacts/hero-system-review/reflect-narrow.png) | [Reflect](../artifacts/hero-system-review/reflect-wide.png) |

The captures contain private household data and remain local. Implementation is in `/Users/Shared/finance-app/notion-expense-app-latest`; nothing has been pushed or deployed.

## Follow-up: stable hero position

Reflect’s separate Spending/Activity toolbar previously preceded the shared hero, shifting its mascot, number and summary down by the toolbar height plus the screen gap. The switch now follows the summary alongside the period/filter controls. Optional work-time text also follows the summary. Verified Reflect’s narrow layout after this correction; TypeScript and whitespace checks pass. Older wide screenshots above predate this follow-up.

## Follow-up: four layout patterns

Applied shared hero/summary space, `ScreenToolbar`, section-header spacing, and persistent loading/error/empty regions. Budget no longer hides its overview for zero categories or search matches. Budget and Reflect use the toolbar after the hero. Desktop overview/content columns share a 2:3 ratio. Home retains no mobile period toolbar, preserving its overview purpose.

Validation: TypeScript and all 601 tests across 74 files passed. Observed narrow Home loading, loaded Budget and Reflect; observed wide Budget and Reflect with aligned hero columns. Empty/error paths were source-reviewed, not forced through financial data changes. Historical screenshots above predate some of these changes.

## Follow-up: Reflect visual switch and amount skeleton

Reflect’s Spending/Activity chips now occupy the clear top of its existing 250px visual frame. Activity replaces the mascot with a 202px flow chart beneath the chips, keeping the complete frame at 250px and preserving metric/summary positions. Removed the result text tabs and duplicate chart from the transaction list. The shared `AmountSkeleton` now handles Reflect/Budget amount loading and the initial screen fallback. TypeScript and whitespace checks passed; observed both Reflect views at wide width and Activity at narrow width.
