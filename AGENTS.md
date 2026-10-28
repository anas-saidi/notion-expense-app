# Project instructions

## Mobile interface work

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
