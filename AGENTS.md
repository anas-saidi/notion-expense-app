# Project instructions

## Roadmap and task status

- At the start of every app task, read [docs/roadmap.md](docs/roadmap.md). It owns pending work, stable IDs, priorities, dependencies and completion evidence; `design.md` owns durable product conventions.
- Before picking an item, inspect its status and current changes. Reuse candidates marked `verify`; do not repeat `done` work. Claim/update the relevant ID, preserve other agents' changes, and follow the roadmap's completion/handoff rules.
- Update the roadmap in the same change as implementation. Mark completion only with acceptance evidence and commit/release references (or explicit local-only acceptance). A local fix is not a deployed fix. Keep historical IDs and deduplicate new feedback.

## Mobile interface work

- Design reference links live in `design.md` under **Design reference index**; mascot geometry and motion are documented in `mascot-design-system.md`.

- Before introducing, redesigning, or materially changing a UI component, read `DESIGN.md`, especially **External mobile design references** and the rule for the relevant shared component.
- Consult the relevant pattern in the [Mobbin Design Glossary](https://mobbin.com/glossary) and identify the component by behavior before styling it—for example card, stacked list, chip, badge, banner, bottom sheet, or segmented control.
- Apply Mobbin as pattern evidence, not as a replacement design system. Existing product hierarchy, semantic tokens, accessibility requirements, and `DESIGN.md` take precedence.
- Prefer the least visually heavy pattern that fits the behavior. Do not turn plain values into badges, repeated rows into cards, or section labels into chips.
- When a Mobbin decision becomes a durable product convention, record the conclusion in `DESIGN.md` so future work does not require the same research again.

## Interface clarity

- Cut taglines, helper text, and secondary labels. When a screen needs them to make sense, fix the layout and hierarchy. Keep essential field labels, actionable errors, and financial information clear and accessible.

## Mobile UI system

- Titles: Inter Tight, 22px/28px, semibold, -0.7px letter spacing.
- Section headers: Inter Tight, 19px/24px, semibold, 0.6px letter spacing.
- Body and day labels: Inter Tight, 14.5px/18px, regular, 0.3px letter spacing.
- Buttons: 38–46px circular, with a 6px inset highlight and soft drop shadow; no flat fills.
- Cards: 12–18px radius according to depth, with layered box shadows rather than borders.
- Text: `var(--text)` for primary, `var(--muted)` for secondary, and `var(--strong)` for icons.
- Dividers: 1px `var(--track)`, never a visible border color.


## Repeatable interface review

For an app design review or an unslop pass, use [Interface Craft](/Users/anassaidi/.codex/skills/interface-craft/SKILL.md). Read this project's design.md and tokens first. Cite the skill's rule IDs, distinguish observed from inferred defects, and verify the rendered primary flow. Keep design.md as the product specification; record unresolved checks without claiming acceptance.

## Readable product copy

Use the writing principles recorded in design.md under Readable text. Front-load the useful fact, use parallel clauses for related states, and keep one name per financial concept. Preserve specific accessible action labels when visible copy is shortened.

## Finance storage

Notion owns editable financial records, including contribution agreements and balance checks. Supabase supplies the rebuildable read mirror, distributed write coordination and duplicate-operation claims. Keep coordination/idempotency records when rebuilding mirror rows. Read `docs/notion-supabase-migration.md` before storage changes.

The installed Neon skills apply to legacy source inspection and recovery. Preserve the existing Neon project and credentials. Do not run Neon provisioning, config deployment or environment pulls as part of the Supabase migration; use existing credentials and explicit project IDs for read-only recovery.
