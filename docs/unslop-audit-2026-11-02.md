# Unslop audit: primary screens, 2 November 2026

Method: [unslop by Damir Sokolovsky](https://github.com/heydamir/unslop), CC BY 4.0, with the project's Interface Craft rule IDs. Scope: Home, Budget and Reflect. Classification: light slop; preserve the existing product identity and approved layout.

Evidence: the user's supplied screenshots and current component/styles source. Fresh internal-browser inspection is unavailable in this session. Source-confirmed defects are distinguished below; current rendered behavior, dark contrast and physical-device checks remain unverified. No UI changes were made for this audit.

| Finding | Evidence | Repair proposed |
| --- | --- | --- |
| IC-09: summary contrast, P2 | `.summary` mixes light `--muted` #6e6e6d at 85% with white. Approximate resulting #848483 gives 3.74:1 on white. At 18px/500 this is normal-sized text. | Use a semantic text role with at least 4.5:1 contrast; check both themes. |
| IC-03: emphasis density, P2 | `.summary-fact` uses 700 for names, ordinary values, actionable discrepancies and success text alike. Budget names/amounts also use 700. The supplied screenshots show several equally strong fragments. | Body 400–500, facts/rows at most 600; keep meaningful action and warning distinctions. |
| IC-14: long narrative summaries, P2 | Home joins up to three financial clauses; Reflect joins concentration and budget health. Screenshots show wrapping sentences with repeated emphasis. | Shorten each clause and prioritize actionable facts while keeping accessible destinations and financial distinctions. Keep mobile centering. |
| IC-04 / IC-14: inline decorative artwork, P3 | Account/category artwork also appears inside narrative sentences. | Remove redundant summary artwork where the adjacent name already identifies the subject. Preserve category-row artwork and hero mascots. |
| IC-02: competing style ownership, P2 | Multiple desktop grid/card rules and inline properties are countered by later overrides and `!important`. Earlier design sections contradict newer approved scope-picker rules. | Consolidate current geometry in shared owners and supersede stale guidance. Do not redesign the accepted layout. |

## Direction proposed for approval

- Product: household budgeting for two people.
- Character: warm, exact, unhurried.
- World: a shared set of money jars, on quiet neutral surfaces.
- Moments: the meaningful mascot waterline and the real spending chart.
- Signature: blue, Joint heart and pink as one stable household identity.

Preserve: the original left-aligned three-mascot pill, static picker artwork, 250px spending heroes, centered mobile amounts/summaries, Activity's chart exception, category artwork, financial operations and section order. User preferences override unslop's generic prohibition on these established brand visuals. No new font, palette, artwork or navigation model is proposed.

After approval: spacing audit, semantic contrast, summary icon reduction, concise copy, type weights, CSS ownership, control details, preservation of existing visuals, then removal of unused/nonfunctional motion only where verified. Verify in at most three rendered passes when the internal browser becomes available; do not label a build pass as visual acceptance.

## Approved implementation

The user approved the light polish pass. Applied:

1. **Spacing:** keep approved hero/toolbar geometry; normalize the shared chip's 7px icon gap to 8px. Merge duplicate mascot-frame declarations.
2. **Color:** summary prose now uses semantic `--text2` without fading it into the background. Source-based contrast: 9.37:1 on the light canvas, 8.25:1 on the dark canvas, 7.56:1 on dark panels.
3. **Icons:** remove redundant inline account/category artwork from Home and Reflect summaries. Preserve row artwork, hero mascots and picker artwork.
4. **Copy:** Reflect uses “top 3 categories account for … of spending” and “all categories are within budget.” Budget exceptions lead. Home's already concise financial clauses and all accessible destinations stay intact.
5. **Type:** summary prose 400, ordinary facts 500, actions/semantic exceptions 600; Budget row names 500 and amounts 600; shared chips 600. Keep the established font, sizes and tabular figures.
6. **Layout:** remove earlier desktop column/placement declarations that were superseded by the shared 2:3 composition. Keep the final composition and inspector exceptions. No section reorder or metric geometry change.
7. **Details:** move summary CSS into its component-owned stylesheet and replace contradictory scope/summary design guidance with the current approved rules. Existing hit extensions and focus treatment remain.
8. **Visuals:** retain the established blue/pink/Joint material and original static picker. No generated assets or palette replacement.
9. **Motion:** inline summary actions no longer lift on hover. Retain existing meaningful hero feedback and loading behavior; no new motion.

Validation: TypeScript passed; 616 tests in 75 files passed; production build passed with the existing authentication-dependency Edge Runtime warning; changed stylesheets parsed with PostCSS; whitespace checks passed; localhost returned HTTP 200. The development server uses `.next-local`, so production output did not replace its chunks.

Unresolved: the user's internal browser is unavailable to automation. No fresh rendered before/after comparison, dark screenshot, narrow-width keyboard pass or physical-device pass is claimed. No financial records were written. The audit's initial “no UI changes” statement describes the pre-approval stage; this section records the subsequently approved edits.

## Follow-up: hero-only pass

Applied the already approved direction to the shared hero, preserving settled mascot, typography and alignment choices.

- IC-04: the former centered amount-plus-currency group put the numerical digits left of the mascot centerline. The shared hero now mirrors the measured currency width and centers the digits themselves. Long-value fitting reserves both gutters, preserving signs and cents.
- IC-09: the hero's 12px currency mark formerly applied opacity 0.8 to the muted token. It now uses the same semantic color at full opacity. Source contrast on white improves from approximately 3.4:1 to 5.1:1; the existing global currency style is retained outside the primary hero.
- IC-11: Activity formerly displayed a jar skeleton while its chart loaded. The chart now retains its own slot and uses the established shimmer in a matching chart-shaped region. Removed Reflect's redundant summary-height wrapper; the shared summary reservation owns it.
- IC-02 / IC-04: centralized Activity frame/chart dimensions in hero-tokens.ts and normalized its 310px frame/10px bottom inset to 312px/12px; the user-pinned 250px Spending frame remains exact.
- IC-08 / IC-13: hero buttons retain their existing taps and haptics, without the global decorative hover lift. Added shared visible keyboard focus.

No new artwork, copy, financial calculations or navigation. Existing full-app and header changes remain in the working tree. Fresh internal-browser rendering is still unavailable, so optical alignment, extreme-value rendering, physical-device and dark-mode visual acceptance remain unverified; source geometry and color calculations are not screenshots.
