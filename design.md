# Couple Finance App — Design System

## Product idea

This is a shared financial home for two people. It should make the household position understandable at a glance, support calm decisions, and preserve each partner's context without turning money into a competition.

The primary object on Home is the wallet overview. One financial number owns the screen at a time; supporting context follows underneath in descending importance.

## External mobile design references

- [Mobbin Design Glossary](https://mobbin.com/glossary) is the shared vocabulary and pattern reference for mobile components. Before introducing or substantially changing a component, identify its actual interaction model in the glossary (for example card, stacked list, tile, banner, chip, bottom sheet, or segmented control) and apply that pattern's usage guidance.
- Mobbin is a reference, not a replacement design system. This document, the app's semantic tokens, accessibility requirements, and established product hierarchy take precedence when examples conflict.
- Prefer the least visually heavy component that matches the behavior. Do not use cards for simple repeated rows, tiles for navigation, banners for ordinary content, or dialogs when a bottom sheet is sufficient.

## Global budget scope

`Joint / Husband / Wife` is one app-wide context. It stays in the same top position across Home, Budget, and Insights, and changing it updates every destination.

- The picker has no enclosing rail, background, or border.
- Each mode is an individual 44-point control. Unselected modes use a white surface and quiet shadow; the selected mode uses the high-contrast filled treatment.
- Use recognizable vector people pictograms, never gender symbols or structural emoji.
- Full-screen actions such as Rebalance inherit the global scope and show it as read-only context. They never introduce a second scope picker.
- A setup flow may step through owners locally only when owner selection is required to complete that workflow.

## Information hierarchy

1. Wallet overview: current balance or money left.
2. Budget state: spent, available, and monthly total.
3. Partner summaries: contributed, spent from joint, and personal surplus or shortfall.
4. Timely actions: unassigned money and categories needing attention.
5. Recent activity.

Partner summaries are context and navigation, not a leaderboard. Selecting one switches the global scope.

## Foundations

### Color

- `--bg`: true white canvas in light mode; near-black neutral canvas in dark mode.
- `--surface`: primary cards, records, and sheets.
- `--surface2`: quiet controls, tracks, and secondary regions.
- `--text`, `--text2`, `--muted`: three-level text hierarchy. Normal text must maintain at least 4.5:1 contrast.
- `--accent`: lime for action fills and occasional highlights, paired with dark `--accent-ink` text.
- `--accent-foreground`: deep green for selected navigation and small accent text in light mode; light green in dark mode.
- `--budget-used`: neutral text tone for normal budget consumption; retain amber caution and red overspending states. Spending is consumption, not a completion goal.
- `--summary-accent`: purple, reserved for the narrative Summary label and its analytical identity; it is not a general action color.
- Partner blue and pink identify people only. They are never generic chart or action colors.
- Danger, warning, success, information, transfer, and income colors are semantic and must not be repurposed decoratively.

Never tint the entire light canvas. Depth comes from surfaces and restrained elevation.

### Typography

Use Instrument Sans with system sans-serif fallback and tabular numerals for financial values.

Render the currency once, adjacent to the amount on the same baseline. The amount owns the hierarchy; the currency marker is supporting text at roughly two-thirds of its size with muted emphasis. Use locale-appropriate order, so this product displays `199.516 MAD`, not `MAD 199.516`.

| Role | Size / line | Use |
|---|---:|---|
| Caption | 12 / 16 | Dates, helper text, chart annotation |
| Label | 13 / 16 | Controls, section labels, badges |
| Body | 15 / 22 | Primary supporting copy |
| Title | 20 / 24 | Screen and sheet titles |
| Financial display | Responsive | The single owning amount |

Body and control text must not be smaller than 12px. Weight, size, and color create hierarchy; do not introduce decorative typefaces.

### Spacing

Use the 4-point scale: `4, 8, 12, 16, 24, 32`. Screen sections use 16 or 24 points. Avoid unexplained one-off gaps.

### Shape and elevation

- Controls: 12px radius.
- Content cards: 16px radius.
- Bottom sheets: 24px top radius.
- Standalone cards may use `--elevation-card`. Record collections use one shared surface; their child rows remain flat.
- Navigation, popovers, and modal surfaces use `--elevation-float`.
- Avoid combining a visible border and full shadow on the same surface.
- Every elevated content card uses the same recipe: `--surface`, `--radius-card`, no visible border, and `--elevation-card`.
- When depth without shadow is preferable, use exactly one Mobbin card-container alternative: a restrained outline or a filled semantic/neutral surface. The Insights narrative summary uses a quiet filled container because it is informational and non-interactive.
- Not every section is a card. Flat content is the default; elevation signals importance or interaction.

### Icons

Lucide is the structural icon family. Use 16, 20, or 24px icons with consistent strokes. Category or account emoji may appear only when they are user-authored data, inside a consistent badge, and never as the only accessible label.

### Motion

Use motion to explain state or preserve spatial continuity.

- Fast feedback: 120ms.
- Standard transition: 200ms.
- Sheet or structural transition: 320ms.
- Standard easing: `cubic-bezier(0.22, 1, 0.36, 1)`.
- Prefer opacity and transform. Avoid layout-thrashing width or height animation.
- Respect `prefers-reduced-motion` in CSS and motion components.

## Shared components

| Primitive | Source | Contract |
|---|---|---|
| App shell | `app/components/AppShell.tsx` | Owns global scope, primary navigation, header actions, safe areas, and the floating Add action. |
| Bottom sheet | `app/components/ui/BottomSheet.tsx` | Owns backdrop, drag dismissal, focus return, responsive modal behavior, and the shared sheet frame. |
| Money | `app/components/Money.tsx` | Owns number formatting, a single subdued currency marker, tabular numerals, and optional counter motion. |
| Animated counter | `app/components/ui/AnimatedCounter.tsx` | Use only for a screen-owning financial value or a meaningful value transition; respect Reduce Motion. |
| Screen chip | `app/components/ui/ScreenChip.tsx` | Use for local filtering or tab selection, never for passive metadata. |
| Transaction row | `app/components/ui/TransactionRow.tsx` | Owns activity-row hierarchy, semantic signed amount treatment, dates, and interaction states. |
| Banner | `app/components/ui/Banner.tsx` | Owns informational, warning, error, and success messages. |
| Category icon | `app/components/ui/CategoryIcon.tsx` | Normalizes user-authored category and account icons; it never replaces an accessible text label. |
| Search field | `app/components/ui/SearchField.tsx` | Owns disclosed contextual search, clear behavior, focus, and accessible labeling. |
| Swipe action | `app/components/ui/SwipeToDelete.tsx` | Adds reversible swipe behavior while retaining a keyboard-operable action. |

New features must compose these primitives before introducing a new visual implementation. Extract a new primitive only after the same interaction appears at least three times; one-off arrangements belong to their owning screen.

- **App shell:** global scope, global actions, responsive content frame, bottom navigation.
- **Header icon action:** circular outlined control on the primary surface with no resting shadow. Search, settings, and rebalance use the same treatment; floating elevation remains reserved for navigation, overlays, and the Add action.
- **Contextual search:** searchable primary screens expose the same circular search action in the app header. The search field is disclosed below the local section heading, receives focus immediately, includes a leading search icon and explicit close action, and collapses after clearing. Keep a persistent search bar only on dedicated search or long-directory surfaces.
- **Screen chip:** local tabs and filters share one compact pill treatment. Selected chips use the high-contrast fill; unselected chips use the quiet surface and border. Screen chips are visually smaller than the app-wide scope controls. A trailing badge may show a count or scoped total, but must not change the chip’s interactive meaning.
- Numeric budget totals inside screen chips use the semantic accent metric treatment; ordinary counts remain neutral badges.
- **Wallet overview:** the uncontained primary financial summary on Home and the only financial hero.
- **Partner contribution relationship:** Joint mode presents both partners as two compact, softly tinted circular progress identities connected by a small high-contrast Joint marker. Use warm, distinct line-drawn portraits rather than generic gender pictograms. Keep the relationship grouping directly on the page without a containing card fill. Each identity remains an independent navigation target and shows only one contribution state. The shared remaining amount sits directly below the connector. Partner color stays confined to identity and progress, never implying competition.
- **Record row:** transaction/account/category rows share typography, spacing, pressed state, and interaction behavior. Rows inside a collection are flat and separated by whitespace or restrained inset dividers, never by one shadow per row.
- **Signed amount metric:** Home’s Recent rows may use the compact inline-metric treatment from the narrative summary. Tint only the signed amount—red for expense, green for income, blue for transfer—while keeping the date plain and the row itself flat.
- **Wallet status badge:** a compact, non-interactive badge attached to the owning balance (`On track`, `Low`, `Over`, or `No plan`). Use a filled semantic tint and text; do not represent these contextual states as an unlabeled dot or an interactive chip.
- **Date-group subtotal:** right-aligned tabular text attached to a date heading. It is not a badge because it is a value, not status or a dynamic count. Omit redundant nouns when the surrounding activity context already supplies them.
- **Transaction row:** one shared stacked-list row across Home, Insights, and account activity. The left side contains a semantic icon plus title and optional category; the right side contains a compact semantic amount tag and date. Expense is red, income is green, and transfer is blue. The tag communicates transaction type, not selection.
- **Daily inspection:** month navigation remains the primary analytical range. A date-group heading may open a focused day detail; do not add a second permanent day-by-day navigator to the screen header.
- **Floating Add action:** the persistent bottom-right FAB represents the app’s primary constructive action. Use a circular plus-only control with an explicit accessible name (`Add transaction`); retain floating elevation and keep secondary actions in the header.
- **Composer sheet:** shared header, 44-point close action, amount treatment, keypad, picker chips, feedback, and primary action. Add Transaction and related money-entry flows use this hierarchy.
- **Composer fit:** the default transaction state must fit between the persistent header and the bottom safe area without scrolling at the reference phone height. Use border-box sizing and let the amount hero absorb height differences; preserve 44-point keypad and control targets. Exceptional feedback or keyboard-constrained states may scroll rather than clip content.
- **Transaction type control:** Expense and Income are mutually exclusive modes, so the composer presents them as one labeled segmented control. The selected segment uses the raised primary surface; semantic red/green is confined to its directional icon.
- **Composer picker chip:** account, category, and date use one quiet outlined pill family with a leading icon and concise label. Account and category form a left-aligned context group; date stays independently right-aligned. Chips size to content, wrap without distributing evenly on narrow screens, and retain a 44-point target. The pill treatment already communicates interaction, so composer picker chips omit redundant disclosure chevrons.
- **Allocation flow:** Rebalance and planning share the sheet shell, slider behavior, category controls, feedback, and inherited scope context.
- **Section heading:** 12px label with an optional 44-point trailing action.
- **Category detail sheet:** compose the shared bottom-sheet shell, identity header, one dominant Available amount, Planned and Spent as quiet supporting metrics, a compact action toolbar directly below the summary, a subtle month-filter trigger beside Activity, and shared transaction rows. The header contains identity and dismissal only. The toolbar uses one three-column geometry: high-emphasis Expense, outlined Fund, and low-emphasis Freeze; all controls keep visible labels and equal height. Expense reuses the transaction composer’s red upward-arrow language. Show the budget progress rail only after spending begins and always pair it with an explicit percentage label; an empty rail reads as a divider and must be omitted. Currency is owned by `Money` and must never be repeated by a surrounding stat component.
- **Period filter:** use one compact outlined calendar-trigger displaying the active period and open the shared themed month grid for non-linear selection. When the active period is supporting metadata beside a section heading, use the same quiet pill geometry at a 44-point target. Previous/next steppers belong on primary time-series screens where sequential browsing is the core task; do not spend an entire section-header row on them inside a detail sheet.
- **Date picker:** every day- and month-granularity field uses the shared `DatePicker`/`MonthPicker` trigger: calendar icon, concise localized value, and a 44px minimum target. Compact contextual filters and composer pickers share the quiet outlined pill treatment; full-width form fields use the standard control radius. A chevron appears only when it adds disclosure information. The picker body may reflect its granularity, but equivalent trigger contexts must not change between forms, planning, and detail filters.
- **Anchored picker surface:** a trigger already identifies its picker, so compact anchored popovers omit duplicate title bars, dividers, and close buttons. They dismiss on selection, outside tap, or Escape. Use a titled sheet only when selection becomes a multi-step task.
- **Calendar picker:** day selection shows one compact month grid with previous/next navigation; month selection shows a compact twelve-month grid with previous/next year navigation. Both use the same anchored surface, selection treatment, and current-period status. Do not duplicate `Today` or `Yesterday` shortcuts when those dates are already visible and selectable in the grid. Mark the actual current date or month independently from the selected value using the existing green status-badge color pair; if the current period is selected, use the deeper green selected treatment.
- **Picker option list:** keep option rows fully visible within the scrolling viewport; never leave a partial row trapped behind a fixed search region. Search stays attached to the bottom edge only when the dataset warrants it.

## Transaction list pattern

Use a **standard stacked list** for transaction history and recent activity on mobile.

- Group rows chronologically under date headings such as `Today`, `Yesterday`, or a localized date.
- Each row contains one category/account icon, description, category or account context, signed amount, and date/time only when the section heading does not already provide it.
- The full row opens transaction details. Swipe actions must retain a visible or keyboard-operable alternative.
- Use one shared list surface. Separate rows with 12–16px vertical rhythm or a quiet inset divider aligned to the text column.
- Do not give every transaction its own card radius and shadow; that reduces scan density and creates excessive scrolling.
- Do not use tiles: transactions are navigated to, not selected. Do not use a multi-column table on phone. A table may be considered only for a wide desktop history view with additional sortable dimensions.

## Charts and financial data

- Prefer ranked bars or lists when users need exact comparison.
- Donuts are limited to five meaningful parts plus `Other`; do not use them for long category lists.
- Every chart provides a text summary and direct values. Color is never the only differentiator.
- Empty, loading, error, and loaded states reserve similar space to avoid layout shift.

## Interaction and accessibility

- Every interactive target is at least 44×44px with visible pressed, focus, disabled, loading, success, and error states where applicable.
- Focus indicators appear for keyboard navigation, remain visible above fixed navigation, and use the neutral `--focus-ring`; pointer-focused text fields rely on the caret and do not gain a container outline. Bordered controls use a 3px ring that follows their shape. Borderless composer fields use a 3px underline so the focus treatment does not expose their rectangular layout box. Semantic accent colors remain reserved for state and action feedback.
- Dialogs trap focus, close with Escape, and restore focus to their trigger.
- Swipe and drag interactions always have a visible or keyboard-operable alternative.
- Icon-only actions have explicit accessible names. Decorative icons are hidden from assistive technology.
- Fixed navigation must not obscure focused or scrolled content.

## Screen rules

- **Home:** wallet overview first, partner summaries directly below it, then actionable budget context and activity. The wallet’s supporting plan context shows only its label, remaining amount, progress bar, and percentage used—never the same monthly values repeated in multiple captions. Savings goals live in Budget; Home shows one only when it becomes a time-sensitive action or exception.
- **Budget:** prominent Rebalance action, readable ranked allocation overview, search, then category groups.
- **Insights:** use the shared MonthPicker trigger as the single period filter, followed by compact analytical cards, accessible chart alternatives, and transaction history. Activity chips are self-explanatory and must not carry a redundant “Filter activity” heading. A failed request becomes an actionable error state, never a permanent skeleton.
- **Accounts and Settings:** use the same title, spacing, control, and surface primitives as the app shell and sheets. Settings is a flat preference list: section labels and 24–32px whitespace create grouping, with no row dividers or enclosing borders. Inline values such as Appearance use the quiet filled picker trigger; navigation rows remain transparent and full-width.
- **Add Transaction:** keypad-led amount entry, centered description input without a redundant visible label, picker chips in a stable position, and one clear save action.

## Product character

- Calm, direct, and shared.
- One dominant action or number at a time.
- Empty states invite the next useful action.
- Financial warnings are factual and non-judgmental.
- Visual variety never overrides consistency or comprehension.

## Phone composition

- Design and verify the primary phone experience at 430 × 932 points without hard-coding viewport height.
- Keep the app content rail fluid up to 640 points with 16-point horizontal insets; 430 points is a phone reference size, not a width cap. Match the floating navigation to the content rail. Hide the inner scrollbar while preserving scrolling.
- Use SF Pro Rounded through the native `ui-rounded` system stack; retain tabular numerals for financial values.
- All spacing follows the 4-point scale: 4, 8, 12, 16, 24, and 32 points.
- Use only two elevations: `--elevation-card` for resting surfaces and `--elevation-float` for sheets, navigation, and the add action.
- Prefer typography and whitespace over borders, extra labels, and decorative effects.

## Home and settings clarity

- Balances are informational. Joint Balance / Planned / Spent controls explicitly select the metric. Allocation uses the existing labeled action only when money is unassigned.
- Budget warnings belong beside monthly usage and use spending versus plan; do not label an account balance “On track.”
- Accounts is accessed inside Settings, never via a separate header icon. Settings uses the same shared bottom-sheet geometry as all other sheets, with grouped Preferences and Finances rows. Appearance offers System / Light / Dark without redundant descriptions. System follows live OS appearance changes.

## Pickers

Use one anchored popover surface for single-choice controls, including Appearance, accounts, categories, and funding sources. Show a title, close action, selected state, and readable 44-point minimum rows. Long lists include search. Dates use the shared month calendar and Today/Yesterday shortcuts. Do not pin menus over the bottom keypad. Expense and Income use accessible icon-only controls in semantic red and green. Disabled submit buttons are neutral; enabled primary fills retain lime with dark text.
