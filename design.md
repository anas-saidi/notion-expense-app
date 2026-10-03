# Couple Finance App — Design System

## Product idea

This is a shared financial home for two people. It should make the household position understandable at a glance, support calm decisions, and preserve each partner's context without turning money into a competition.

The primary object on Home is the wallet overview. One financial number owns the screen at a time; supporting context follows underneath in descending importance.

## External mobile design references

- [Mobbin Design Glossary](https://mobbin.com/glossary) is the shared vocabulary and pattern reference for mobile components. Before introducing or substantially changing a component, identify its actual interaction model in the glossary (for example card, stacked list, tile, banner, chip, bottom sheet, or segmented control) and apply that pattern's usage guidance.
- Mobbin is a reference, not a replacement design system. This document, the app's semantic tokens, accessibility requirements, and established product hierarchy take precedence when examples conflict.
- Prefer the least visually heavy component that matches the behavior. Do not use cards for simple repeated rows, tiles for navigation, banners for ordinary content, or dialogs when a bottom sheet is sufficient.

## Global budget scope

`Joint / Anas / Salma` is one app-wide context. It stays in the same top position across Home, Budget, and Insights, and changing it updates every destination.

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
- `--accent`: ink (near-black in light mode, near-white in dark) for primary action fills, paired with `--accent-ink` text. Colour is left to the mascots and the wallet; actions stay calm next to them.
- `--select-color`, `--select-wash`, `--select-edge`, `--select-ink`: selection and data fills follow the wallet (`html[data-scope]`, set from the app-wide mode): Anas's blue, Salma's pink, or Joint's blue-pink blend. Selected rows, chips, tabs and toggles use the wash with the ink; progress bars, charts and sliders use the colour, so "selected" also says whose money it is. `--accent-foreground` is an alias of `--select-ink`.
- `--budget-used`: neutral text tone for normal budget consumption; retain amber caution and red overspending states. Spending is consumption, not a completion goal.
- `--summary-accent`: purple, reserved for the narrative Summary label and its analytical identity; it is not a general action color.
- Partner blue and pink identify people. Through the `--select-*` tokens they also mark what is selected and fill data inside that person's wallet (Joint blends both); they are never used for actions, which stay ink.
- Danger, warning, success, information, transfer, and income colors are semantic and must not be repurposed decoratively. Green (`--success`, `--action-income`, a soft sage that sits with the pastel mascots) means money in or kept: income, "Saved", positive available. Never selection, never an action.

Never tint the entire light canvas. Depth comes from surfaces and restrained elevation.

### Typography

Use Instrument Sans with system sans-serif fallback and tabular numerals for financial values.

The whole product is in one currency, so the currency mark appears only where it's needed: on a screen's or sheet's main number (once) and inside amount inputs. Rows, chips, subtotals, sentences, banners, chart labels and tooltips show the bare number. Accessible labels always say the currency. Wherever it does appear it is the one shared mark (`Currency` / `<Money currency>` in `Money.tsx`): same baseline, after the number (`199.516 MAD`, never `MAD 199.516`), regular weight, muted, at most 12px (`min(0.7em, 12px)`), and never tinted by the amount's state, so it never competes with the number.

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

Lucide is the structural icon family. Use 16, 20, or 24px icons with consistent strokes. One exception: Type it uses a filled four-point star (`SparklesIcon`), the one filled glyph, reserved for plain-language entry. Category or account emoji may appear only when they are user-authored data, inside a consistent badge, and never as the only accessible label.

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
| Money | `app/components/Money.tsx` | Owns number formatting, tabular numerals and optional counter motion; the currency mark is opt-in (`currency`) and shares one style via `Currency`. |
| Animated counter | `app/components/ui/AnimatedCounter.tsx` | Use only for a screen-owning financial value or a meaningful value transition; respect Reduce Motion. |
| Screen chip | `app/components/ui/ScreenChip.tsx` | Use for local filtering or tab selection, never for passive metadata. |
| Transaction row | `app/components/ui/TransactionRow.tsx` | Owns activity-row hierarchy, semantic signed amount treatment, dates, and interaction states. |
| Banner | `app/components/ui/Banner.tsx` | Owns informational, warning, error, and success messages. |
| Category icon | `app/components/ui/CategoryIcon.tsx` | Normalizes user-authored category and account icons; it never replaces an accessible text label. |
| Search field | `app/components/ui/SearchField.tsx` | Owns disclosed contextual search, clear behavior, focus, and accessible labeling. |
| Swipe action | `app/components/ui/SwipeToDelete.tsx` | Adds reversible swipe behavior while retaining a keyboard-operable action. |
| Mascot hero | `app/components/mascot/MascotHero.tsx` | The screen's hero mascot: a clear jar at the same size and importance as the main number, centred with it. Variants: `pool` (liquid level) and `split` (category emojis). Decorative; the same facts are always stated in text. |

New features must compose these primitives before introducing a new visual implementation. Extract a new primitive only after the same interaction appears at least three times; one-off arrangements belong to their owning screen.

- **App shell:** global scope, global actions, responsive content frame, bottom navigation.
- **Header icon action:** circular outlined control on the primary surface with no resting shadow. Search, settings, and rebalance use the same treatment; floating elevation remains reserved for navigation, overlays, and the Add action.
- **Contextual search:** searchable primary screens expose the same circular search action in the app header. The search field is disclosed below the local section heading, receives focus immediately, includes a leading search icon and explicit close action, and collapses after clearing. Keep a persistent search bar only on dedicated search or long-directory surfaces.
- **Screen chip:** local tabs and filters share one compact pill treatment. Selected chips use the high-contrast fill; unselected chips use the quiet surface and border. Screen chips are visually smaller than the app-wide scope controls. A trailing badge may show a count or scoped total, but must not change the chip’s interactive meaning.
- Numeric budget totals inside screen chips use the semantic accent metric treatment; ordinary counts remain neutral badges.
- **Wallet overview:** the uncontained primary financial summary on Home and the only financial hero.
- **Partner contribution relationship:** Joint mode presents both partners as two compact, softly tinted circular progress identities connected by a small high-contrast Joint marker. Use warm, distinct line-drawn portraits rather than generic gender pictograms. Keep the relationship grouping directly on the page without a containing card fill. Each identity remains an independent navigation target and shows only one contribution state. The shared remaining amount sits directly below the connector. Partner color stays confined to identity and progress, never implying competition.
- **Record row:** transaction/account/category rows share typography, spacing, pressed state, and interaction behavior. Rows inside a collection are flat and separated by whitespace or restrained inset dividers, never by one shadow per row.
- **Signed amount:** transaction rows show the signed amount as coloured text only—red for expense, green for income, blue for transfer—with no pill or background, centred in the row. Lists grouped under date headings (Home, Insights) omit the per-row date; ungrouped lists keep it, plain, under the amount.
- **Wallet status badge:** a compact, non-interactive badge attached to the owning balance (`On track`, `Low`, `Over`, or `No plan`). Use a filled semantic tint and text; do not represent these contextual states as an unlabeled dot or an interactive chip.
- **Date-group subtotal:** right-aligned tabular text attached to a date heading. It is not a badge because it is a value, not status or a dynamic count. Omit redundant nouns when the surrounding activity context already supplies them.
- **Transaction row:** one shared stacked-list row across Home, Insights, and account activity. The left side contains a semantic icon plus title and optional category; the right side contains a compact semantic amount tag and date. Expense is red, income is green, and transfer is blue. The tag communicates transaction type, not selection.
- **Daily inspection:** month navigation remains the primary analytical range. A date-group heading may open a focused day detail; do not add a second permanent day-by-day navigator to the screen header.
- **Mascot hero:** one per screen, centred directly above the screen's main number and sized to match its weight (`MASCOT_HERO_SIZE`, never a small sticker beside a row). The shape always means the scope: Anas's squircle, Salma's shape, and their midpoint for joint — one body in every variant. Jars are never fully clear: a pool's glass carries a very faint wash of the scope's colours (so an empty pool still reads as a body, not an outline), and `split` jars, which have no waterline, get a slightly stronger wash and a thin light sticker outline on each emoji (`--mascot-sticker`: white in light mode, none in dark mode), keeping the shape and pale emojis legible. The wash deepens softly towards the jar's edge (glass thickness) so the silhouette reads without a hard line, and each jar sits on a faint blurred contact shadow (`--mascot-shadow`) — never a drop shadow on the body. `pool` shows a share as a liquid level in the scope's colour (joint blends soft blue into soft pink); Tapping the Home pool also drops the month's top three spending categories into it as emojis (sized by how much of the pool each took; named in its accessible label), and they're sucked up and out through the top when it's tapped again. `split` fills the jar with one emoji per category that still has money in it, sized by its share of Available (so the jar always matches the number beside it). The jar is clear glass with a soft, always-neutral border (`--mascot-edge`; the level and the colour carry the state, never a red outline). A plan pool (Home hero, Insights card) keeps the scope's soft colour until its last fifth (about 80% of the plan spent), then its liquid and wash blend gradually into a soft, equally lightened red, fully red when empty; jars where empty isn't a warning (partner contributions, a month with no plan) never turn red, eyes and labels follow the theme, and it moves only when its data changes. Opening a screen never replays an entrance: a hero jar starts as it was last seen on this device and animates only what changed since (new category emojis drop in, removed ones are sucked out through the top, the pool eases from its old level); the emoji jar fills once from empty the very first time — still under Reduce Motion or off-screen. The jar alone gives the at-a-glance read; its exact numbers (spent %, over plan, a partner's due) are not shown until the jar is tapped: the jar gives a soft squish with a light haptic tap (a softer tick on close) and the numbers surface from behind it as a plain detail line (sliding down, fading in and coming into focus; no pill, border or background) via `MascotSpill`, staying until tapped again. The jar is a real button (keyboard operable, `aria-expanded`, details always in its accessible name); the first jar a person ever sees spills once by itself to teach the gesture; Reduce Motion simply fades the line in. Joint Home cuddles each partner's small jar (their own shape, no visible name: shape and colour identify them, the name stays in the accessible label) against the joint pool's lower sides, resting level with it, just touching its edge in front and leaning in (water stays level with the ground); a partner's details come out of their empty outer side (Anas's to the left, Salma's to the right) rather than from underneath, so they stay cuddled; the pool's stay underneath, filled by the share of their joint contribution already paid, whose tap spills "due"/"Settled"; this replaces the separate Contributions cards (scope switching stays in the header).
- **Floating Add action:** the persistent bottom-right FAB represents the app’s primary constructive action. Use a circular plus-only control with an explicit accessible name (`Add transaction`); retain floating elevation and keep secondary actions in the header.
- **Slide to confirm:** big, hard-to-undo commitments (saving a month's plan) use `SlideToConfirm` instead of a button: an ink thumb dragged across a quiet track that fills with the wallet wash, confirming past 90% and springing back otherwise; a tap only nudges the thumb. Enter/Space confirm for keyboard and assistive tech. Haptics fire on grab and confirm (pointerdown/up); iOS gives none mid-drag. Everyday saves stay ordinary buttons.
- **Composer sheet:** shared header, 44-point close action, amount treatment, keypad, picker chips, feedback, and primary action. Add Transaction and related money-entry flows use this hierarchy.
- **Composer fit:** the default transaction state must fit between the persistent header and the bottom safe area without scrolling at the reference phone height. Use border-box sizing and let the amount hero absorb height differences; preserve 44-point keypad and control targets. Exceptional feedback or keyboard-constrained states may scroll rather than clip content.
- **Sheet overflow:** task sheets use a fixed header and fixed primary-action dock with one independently scrolling content region between them. Dynamic banners, previews, and validation feedback must shrink or scroll that middle region; they must never move the primary or confirmation action below the viewport. Keep the bottom-sheet presentation through the 640-point app content rail and switch to a centered desktop dialog only at the wider tablet breakpoint.
- **Transaction type control:** Expense and Income are mutually exclusive modes, so the composer presents them as one labeled segmented control. The selected segment uses the raised primary surface; semantic red/green is confined to its directional icon.
- **Type it composer:** An accessible 44-point sparkle-icon (`SparklesIcon`: write it in plain words, the app works it out) [button](https://mobbin.com/glossary/button) beside the form’s date picker opens a quiet writing canvas in the existing `BottomSheet`; the same sparkle, tinted as selected, beside the canvas date returns to the form. No mode segments, Expense/Income selector, boxed input, or separate preview list in this mode. The sheet’s body is the entry surface: borderless, auto-growing native text fields form a [stacked list](https://mobbin.com/glossary/stacked-list), one transaction per line, with the signed parsed amount aligned right in the shared signed-amount colours (red expense, green income) and one quiet row of composer picker chips below: the category (suggested from past transactions, never silently defaulted), the account only on the line being edited or when it differs from the default, and the date as plain text only when it differs from the canvas date. The chips open the same anchored account and category pickers as the form (`TransactionPickers.tsx`). Enter creates a new line and multiline paste preserves lines. The text determines each line’s type (ordinary purchases are expenses; income wording or a plus sign means income), so one draft may contain both. Keep the selected default date and a way back to the form at the top; keep the net amount and compact Save action in a fixed dock. Preserve drafts and reviewed choices, validate combined expenses per category, save sequentially, and remove each confirmed row from the persisted draft while retaining unsaved lines. Inherit theme tokens, with 22px writing text and no decoration from the reference app.
- **Composer picker chip:** account, category, and date use one quiet outlined pill family with a leading icon and concise label. Account and category form a left-aligned context group; date stays independently right-aligned. Chips size to content, wrap without distributing evenly on narrow screens, and retain a 44-point target. The pill treatment already communicates interaction, so composer picker chips omit redundant disclosure chevrons.
- **Allocation flow:** Rebalance and planning share the sheet shell, slider behavior, category controls, feedback, and inherited scope context.
- **Section heading:** 12px label with an optional 44-point trailing action.
- **Category detail sheet:** compose the shared bottom-sheet shell, identity header, one dominant Available amount, Planned and Spent as quiet supporting metrics, a compact action toolbar directly below the summary, a subtle month-filter trigger beside Activity, and shared transaction rows. The header contains identity and dismissal only. The toolbar uses one three-column geometry: high-emphasis Expense, outlined Fund, and low-emphasis Freeze; all controls keep visible labels and equal height. Expense reuses the transaction composer’s red upward-arrow language. Show the budget progress rail only after spending begins and always pair it with an explicit percentage label; an empty rail reads as a divider and must be omitted. Currency is owned by `Money` and must never be repeated by a surrounding stat component.
- **Period filter:** use one compact outlined calendar-trigger displaying the active period and open the shared themed month grid for non-linear selection. When the active period is supporting metadata beside a section heading, use the same quiet pill geometry at a 44-point target. Previous/next steppers belong on primary time-series screens where sequential browsing is the core task; do not spend an entire section-header row on them inside a detail sheet.
- **Date picker:** every day- and month-granularity field uses the shared `DatePicker`/`MonthPicker` trigger: calendar icon, concise localized value, and a 44px minimum target. Compact contextual filters and composer pickers share the quiet outlined pill treatment; full-width form fields use the standard control radius. A chevron appears only when it adds disclosure information. The picker body may reflect its granularity, but equivalent trigger contexts must not change between forms, planning, and detail filters.
- **Anchored picker surface:** a trigger already identifies its picker, so compact anchored popovers omit duplicate title bars, dividers, and close buttons. They dismiss on selection, outside tap, or Escape. Use a titled sheet only when selection becomes a multi-step task. Searchable pickers must remain clamped to the visual viewport—including its offset and reduced height while the iOS keyboard is open—so filtering never moves the menu off-screen.
- **Calendar picker:** day selection shows one compact month grid with previous/next navigation; month selection shows a compact twelve-month grid with previous/next year navigation. Both use the same anchored surface, selection treatment, and current-period status. Do not duplicate `Today` or `Yesterday` shortcuts when those dates are already visible and selectable in the grid. Mark the actual current date or month independently from the selected value using the existing green status-badge color pair; if the current period is selected, use the deeper green selected treatment.
- **Picker option list:** keep option rows fully visible within the scrolling viewport; never leave a partial row trapped behind a fixed search region. Search stays attached to the bottom edge only when the dataset warrants it.
- **Scroll edges:** wherever content scrolls under a bar, the edge is a progressive blur (`ProgressiveBlur` in `app/components/ui/ProgressiveBlur.tsx`), never a hairline border or a hard clip. Stacked `backdrop-filter` bands ramp the blur radius down while a tint of the surface behind eases out, so the bar and the content meet without a visible line. The tint is always the surface the bar actually sits on: `--bg` for the app shell, `--surface` for sheets (`.bottom-sheet-panel` forces it in both themes). An edge shows only while content is hidden past it (`useScrollEdges`) and slides rather than fades, because opacity on an ancestor stops the blur. Where it's used: the app header (a 32px ramp below it once scrolled), the floating nav (content fades out behind the pill on mobile; the desktop sidebar has none), sheet scroll lists via `BlurScrollArea` (28px, 4px max blur, top and bottom), and the plan sheet's floating compact bar (see below).

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

- **Home:** wallet overview first, partner summaries directly below it, then actionable budget context and activity. The wallet distinguishes account cash, current category availability (including carry-over), and monthly assignments versus category spending. Never label assignments minus spending as money left. Show the remaining funding need once, in Contributions. Partner dues must sum to the positive current availability-minus-cash difference, to the cent. Remove diagnostic gap rows and explanatory paragraphs from Home. Savings goals live in Budget; Home shows one only when it becomes a time-sensitive action or exception.
- **Budget:** prominent Rebalance action, readable ranked allocation overview, search, then category groups.
- **Budget unassigned money:** shown as an action banner under the hero (like "due to Joint"), never a tag: "X unassigned" with an Assign action, or a danger "X over-assigned" with a neutral Rebalance action; both open Rebalance. Nothing unassigned shows nothing.
- **Loading:** all data reads use the shared Skeleton components and existing neutral shimmer tokens. Match the pending content’s shape and reserve its space, including initial startup, heroes, lists, planning, and charts. Keep verified content visible during independent reads. Announce loading through accessible status labels without visible loading sentences; respect Reduce Motion. Save progress and actionable errors retain their own feedback.
- **Rebalance:** the allocation flow shows the scope's jar above the pool number, filling as money is assigned — one emoji per assigned category sized by its share of the pool, unassigned money as empty space (full when balanced). Moving money resizes emojis in place; the face is curious while money is unassigned, excited when balanced, worried when over-assigned. It opens settled (no remembered state). The mascot stays out of data-entry sheets such as Add transaction.
- **Insights:** the Summary card is headed by the mode's small pool mascot in place of a text label (top-left) (level = what's left of the plan; face = pace: happy on or behind pace, worried ahead of the calendar, sad over plan), and its spent tag is always red. use the shared MonthPicker trigger as the single period filter, followed by compact analytical cards, accessible chart alternatives, and transaction history. Activity chips are self-explanatory and must not carry a redundant “Filter activity” heading. A failed request becomes an actionable error state, never a permanent skeleton.
- **Mascot taps:** every product mascot responds synchronously to a tap with one light haptic (selection when closing a detail spill or tapping a scope). Standalone planning and allocation jars use `MascotTap`, an accessible button, while existing detail and Reflect buttons retain their actions and emit only one haptic. Automatic hints and data animations never vibrate. Settings has no haptics test controls.
- **Accounts and Settings:** use the same title, spacing, control, and surface primitives as the app shell and sheets. Settings is a flat preference list: section labels and 24–32px whitespace create grouping, with no row dividers or enclosing borders. Appearance uses a 44-point animated sun/moon icon button beside a quiet System button; navigation rows remain transparent and full-width.
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
- Accounts is accessed inside Settings, never via a separate header icon. Settings uses the same shared bottom-sheet geometry as all other sheets, with grouped Preferences and Finances rows. Appearance offers a sun/moon button for Light / Dark and a separate System button with a visible selected state. System follows live OS appearance changes; choosing Light or Dark saves that explicit preference. The icon always reflects the effective theme, uses a unique SVG clip ID, and transitions immediately under Reduce Motion. Both controls provide a synchronous selection haptic. Pattern evidence: [Mobbin Button](https://mobbin.com/glossary/button) and [Switch](https://mobbin.com/glossary/switch); the binary theme action is kept separate from System. Animation adapted from [Skiper UI ThemeToggleButton2](https://skiper-ui.com/v1/skiper4), inspired by Alfie Jones’ [toggles.dev](https://toggles.dev).

## Pickers

Use one anchored popover surface for single-choice controls, including accounts, categories, and funding sources. Show a title, close action, selected state, and readable 44-point minimum rows. Long lists include search. Dates use the shared month calendar and Today/Yesterday shortcuts. Do not pin menus over the bottom keypad. Expense and Income use accessible icon-only controls in semantic red and green. Disabled submit buttons are neutral; enabled primary fills retain lime with dark text.

- **Wallet supporting metrics:** use plain text rows, following the [Mobbin card guidance](https://mobbin.com/glossary/card) for minimal content. Monthly assignments follow funding accounts; spending follows categories regardless of payer. Contribution credit includes transfers and direct joint-category payments; being above plan does not establish a reimbursement debt.

- **Category editing:** the detail action menu opens a modal bottom sheet with labeled name, icon, type and default-account fields, composing the existing category manager and choice pickers. Save copies account owners and changes category metadata only; funding uses a separately labeled Funding account. Keep the header and Save dock fixed around scrolling fields. Close/Escape discards the unsaved draft, reopening restores saved values, and failed saves retain fields for retry. This short contextual form follows [Mobbin bottom-sheet guidance](https://mobbin.com/glossary/bottom-sheet).

- **Contribution funding:** include current category carry-over and rebalance results through availability. Credit net partner transfers and personal joint-category expenses. Apply configured shares to credited contributions plus the cash shortfall, cap individual dues between zero and the shortfall, and assign any rounding remainder to the second partner. This is a funding request, not a reimbursement ledger; above-share contributions do not create refund requests.

- **Money words:** money not yet in a category is **Unassigned**, everywhere (never "ready to assign", "not assigned", "unallocated" or "available to plan"). What's in a category is **available**. People are **Anas** and **Salma**, never Husband/Wife.
- **Budget list:** categories sit in the plan sheet's collapsible sections (`SectionToggle`: Savings → Obligations → Long term → Wants → Other, then Frozen, closed). Each section is one flat surface of jar rows (`CategoryJarRow`): the category's jar, name, one quiet line only when it matters ("Overspent", "Spending fast", "X spent"; empty jars say why by colour instead of a label), and Available as the only number. Rows needing attention come first. Savings rows fill up towards their goal ("40% of 15.000 by Jun", "Goal reached").
- **Jar metaphor (one, everywhere):** a jar holds the money that's in it. Budget jars and the Home pool drain as you spend, which is the plan working, not a warning; savings jars fill as you save. The level says how much is there; the colour says how you're doing against the month (`pace` in `category-status.ts`).
- **Category jar:** `CategoryJar`, a static, eyeless, physics-free SVG in the wallet's outline (the shape says whose). The emoji floats on the liquid: near the top when full, settling as money is spent, resting on the bottom when empty. It's drawn above the liquid so it's never hidden, and its height doubles as the level. Still at rest; it never blinks or wobbles.
- **Status palette:** one family wherever a budget's health shows (jar liquid, the number, the status line, the Home pool): good = on or ahead of pace (sage); low = "Spending fast", under a fifth left *and* at least 10 points behind the calendar (honey liquid, deep amber `--status-low` text; never the bright `--warning` yellow for text); over = below zero (strong coral wash, red minus number, "Overspent"). Empty jars carry no label; their wash says why: soft coral = spent it all, soft honey = never funded. Tokens: `--status-{good,low,over}` and `--status-{good,low,over}-liquid`.
- **Budget banners:** at most one, the most urgent: Short by → Unassigned → Due to Joint. Next month's plan is a quiet pill beside the month picker, not a banner. Unassigned money is assigned in Rebalance from both Home and Budget; a category's Fund adds money, and Rebalance takes it back out.
- **Hard rule — no dot-separated information:** Never join labels, values, dates, statuses, or other metadata with middle dots, bullets, or dot separators anywhere in the app, including labs. Use concise natural language for a single thought, or separate fields with layout spacing or labeled rows. Remove redundant context rather than replacing dots with another separator chain. Ordinary sentence punctuation and decimal points are unaffected.
- **Concise copy:** labels name the value or action directly. Avoid explanatory subtitles that repeat the heading or button. Insights keeps its narrative summary. Home’s monthly rail uses one line: period and percentage spent; full Planned and Spent values remain available through the hero controls. Keep account/cash/category distinctions, money-movement context, and destructive-action consequences explicit.

- **Home hero:** the selected Balance / Planned / Spent pill labels the joint amount; omit a duplicate heading. Balance is neutral, planned allocation green, spending red. The monthly rail pairs This month with the percentage alone, with spent and allocated values below. Preserve the full metric label for assistive technology.

- **Desktop sheets:** from 768px, the shared sheet is a modal dialog with a full-window backdrop covering the sticky header and navigation. With the desktop sidebar (1100px+), center the dialog on the content rail; size that rail from the space remaining after the sidebar. Phone sheets retain their interactive global header. This follows the modal/non-modal distinction in the [Mobbin bottom-sheet guidance](https://mobbin.com/glossary/bottom-sheet). Allocation mascots use the same `MASCOT_HERO_SIZE` as screen heroes, without a smaller sheet override.

- **Sheet separation:** phone sheets use the subtle upward `--elevation-sheet` shadow so their top edge reads above the white canvas.
- **Warning banner actions:** compact composer alerts retain the shared semantic banner container and use `bannerActionStyle` for their primary corrective action, matching Budget warnings with a neutral filled button and a 44-point minimum target.

## Calendar (concept, replacing Reflect — paused)

An exploration to replace the Reflect tab with a Calendar. Prototyped at `/calendar-lab` (dev-only, mock data); nothing is wired into the app yet.

**What Reflect should answer** (from our planning discussion, 2026-09-27):
- **Trend across the year** and **this month's surprise** are the two questions Anas and Salma bring to it. They review together at month end.
- **Savings goals** exist (category `goal` / `goalDate`) and belong in the month view.
- **Over budget = spent beyond the original Monthly plan**, even when money moved in mid-month covered it. The original plan is the Fund with `Assignment Type = "Monthly"`; mid-month moves are `"Additional"` (source marked `Reverse`). Note: re-saving the month plan after the month starts overwrites the Monthly fund, so a snapshot may be needed.
- **Stay neutral:** no per-person comparison or "who spent more"; the wallet scope (Joint / Anas / Salma) stays the only split.
- **Irregular costs** (Eid, travel, car) live in `Long term` categories. They're expected lumps, never a "surprise".

**The concept:** a year of months in a 3-column grid (year arrows above, year total below the year). Each month shows its **three biggest categories as emojis piling up** on an invisible floor. No bubble, container or pebble shapes; just the emojis. Tapping a month opens its details (still to design: plan vs actual, the surprise, goals).
- **Sizing:** an emoji's *area* follows its spend. The pile's overall size follows the month's total against the year's biggest month, with a floor so quiet months still read (`fill = 0.16 + 0.4 × total / max`).
- **Piling:** `pileMonth` (`app/components/calendar/month-pile.ts`) drops emojis largest first. Each one settles at the lowest spot it can reach (floor or on top of others, colliding as circles); ties go to the middle. A pile too tall for its box is shrunk as a whole, so proportions hold. Deterministic, static: no physics or motion at rest.
- **Fixed bills left out by default:** otherwise Rent tops every month and every pile looks the same. One-off months then stand out without reading numbers (🐑 in May, ✈️ in August).
- **States:** the current month's label uses `--select-ink` and its amount says "so far"; future months show only their name and aren't tappable.

**Open questions:** scale against the biggest month or a typical month (a single large month makes the rest look small); collapse future months into one short row; the month detail view; emoji shapes differ across platforms (tuned for Apple emoji).


## Due bills

Bill detail follows the category-detail action hierarchy: three equal-width 44-point actions: filled Pay due, outlined Edit, and quiet More. Match the category detail sheet’s 18-point title, quiet dismiss button, 18-point insets, and centered 34-point amount. The bill name owns the header; its category icon belongs beside the category name in the supporting details. Skip, stop repeating, and destructive schedule deletion belong in the anchored More menu, with confirmation before mutation. The detail header has one dismiss control, without a second Back to bills action; nested payment and edit forms may have a header back control to return without losing the selected bill. Due date is a concise centered line below the amount; category, recurrence, and settled status use plain labeled rows. Category values pair the shared CategoryIcon with the category name, matching category identities elsewhere in the app. This applies the [Mobbin button hierarchy](https://mobbin.com/glossary/button) using the app’s existing control tokens.

Home's Due bills section is a standard [Mobbin stacked list](https://mobbin.com/glossary/stacked-list): bill rows compose TransactionRow with the same 22-point CategoryIcon and 15-point amount typography as activity, without a trailing chevron. Due amounts are unsigned and neutral because they are not recorded spending. Bills use compact icon-only Pay due and Edit swipe actions: 44-point controls, an 8-point gap between actions, and 16 points between the row and actions. The row contracts from the trailing edge rather than translating its name off-screen. Accessible labels retain the action names. This is the shared contextual swipe-action convention in `SwipeToDelete`, following [Mobbin icon-button guidance](https://mobbin.com/glossary/button). Keep destructive swipe behavior separate. Swiping only reveals controls and each action opens its existing form. Keyboard focus also reveals the actions, while tapping the row still opens details. Flat rows show name, concise due or paid date, and amount; category and recurrence are available in detail. Home uses a quiet section label with All bills navigation in the header. Adding a bill is available inside All bills; Home omits the redundant Add bill action. Omit the repeated month-end total; upcoming rows show the date alone, retaining explicit Overdue context. Passive dates and recurrence stay plain text. The Add bill action inside All bills is always available after a successful read; All bills opens the scoped month list with Due / Paid / Skipped filters.

Creation, occurrence details, editing, and payment confirmation use the shared [Mobbin bottom sheet](https://mobbin.com/glossary/bottom-sheet). Category and account choices reuse anchored picker popovers; dates reuse the shared calendar. Keep controls at least 44px, retain fields after failure, prevent repeated submissions, and respect the shared sheet's focus and Reduce Motion behavior.

One schedule (`Type = Due`, empty payment Date and Account) lives in Transactions. Monthly and yearly occurrences are derived; paying creates a separate linked Expense. No month-generation action is needed. Available remains actual money, Earmarked is unpaid expected spending through the current month-end (including overdue bills), and Free after bills is their signed difference. Future-month views omit present-balance comparisons. The ordinary expense form warns when it uses earmarked money and names its continuation action Save anyway.

The older dev-only `/due-lab` remains a sample-data exploration of the previous materialized-occurrence model; it does not control the production flow.

- **Next-month planning capacity:** all saved and draft personal allocations, including frozen categories, reserve capacity before Joint planning. Current commitments are deducted once from account capacity. Unassigned Joint cash covers the Joint plan first; only its shortfall is split using account contribution percentages (65/35 fallback). Joint capacity is constrained by each partner’s remaining money and share, not merely their combined total. Personal planning reserves the same next-month Joint dues. Show one contextual shortfall banner using the shared Banner, following [Mobbin banner guidance](https://mobbin.com/glossary/banner), and disable saving until both partners can cover their plans. Amounts remain exact internally; displays round to whole MAD.

- **Allocation labels:** wallet allocation totals include owned savings categories as well as spending categories. A savings funding account does not erase category ownership from monthly totals. Use “Allocated” for the money currently held in budget categories across screens, replacing “Left to spend.” “Unassigned” remains money outside categories. Rebalance’s total includes both, so call it “Allocation pool”; render its unassigned amount as a plain label/value row without a badge, dot, or nested surface, following [Mobbin stacked-list guidance](https://mobbin.com/glossary/stacked-list). The planner labels its computed capacity “Unassigned” in every scope; the sheet header already names the month, so hero, sub-lines and save copy don’t repeat it. In Joint, each partner’s capacity after personal plans is shown beside their mascot; this is affordable planning capacity, not the Joint bank balance.

- **Joint planning mascot family:** reuse Home’s `JointFamily` cuddle geometry. Planning partner jars show their contribution capacity after personal plans as quiet side details (“I can give” above the amount), visible on entry and toggleable through `MascotSpill`. Percentages and explanatory paragraphs are omitted; capacity remains in accessible labels. Follow the [Mobbin tooltip](https://mobbin.com/glossary/tooltip) pattern for tap disclosure. Home continues to show actual contribution status.

- **Monthly-plan Freeze:** swipe an active category left using the shared row-swipe primitive; the action uses a snowflake and light blue surface from the info token. Swiping reveals the labeled action behind the row; tapping it freezes. There is no Freeze action inside expanded row content and no automatic freeze on swipe release. Keyboard focus reveals the same action for Enter/Space activation. Freezing clears only the planning month’s saved allocation and draft amount, then moves the category to Frozen; balances and past funding stay intact. Other draft amounts survive. Failed writes restore the row and show the existing error banner. The compact scrolling summary floats over the top of the rows (no layout shift when it appears) and has no background of its own; its top - **Compact planning summary motion:** on hero exit (the hero amount passing under the bar), fade in with a 4px vertical settle over 180ms. Its backdrop is the app's own `ProgressiveBlur` (`app/components/ui/ProgressiveBlur.tsx`): stacked `backdrop-filter` layers, each masked to an overlapping band, so the blur radius ramps (12px → 0.75px) rather than one blur fading out. It is held solid behind the bar with a `--surface` tint — the token `.bottom-sheet-panel` forces in both themes, so the bar matches the header in dark mode — then blur and tint ease out over 44px below it, leaving no visible bottom edge. It slides in (220ms) rather than fading, because opacity on an ancestor becomes the backdrop root and kills the blur. Respect Reduce Motion by switching immediately. Freeze’s revealed action uses light blue info tint in every wallet scope.

## Progressive financial loading

Home shows the verified account balance as soon as accounts and the category catalog are ready. Monthly details, activity, pending bills, and next-month planning load independently. Unknown totals must never appear as zero, “No monthly plan”, or settled contributions. Keep the monthly illustration’s space reserved with a matching skeleton; suppress planning prompts until planning data is known. Failed secondary reads retain the balance and provide a retry.

Pattern evidence: [Mobbin Skeleton UI](https://mobbin.com/glossary/skeleton) describes placeholders for pending content and advises restraint for simple layouts. This app uses its shared neutral skeleton treatment in the existing content regions, with accessible status labels and no additional cards or decorative loading illustrations.

- **Planning after month rollover:** keep the current calendar month as the planning target until the selected wallet has a positive, non-reversed allocation. Allocations in another wallet do not advance its target. Then offer next month. Home's contextual planning banner remains actionable for an unfunded current month; next-month reminders retain their month-end timing. Budget's quiet planning button uses the same target. Wait for verified current-month funding before showing a target, and hold the chosen month fixed while the sheet is open. Use the existing [Mobbin banner](https://mobbin.com/glossary/banner) pattern and shared sheet styling.

- **Savings and contribution capacity:** savings allocations remain part of their owner's allocated totals. Reserve only a savings account's negative Ready to Assign from that owner's personal capacity; savings cash already backing allocations is not charged again. A personal-to-savings transfer lowers personal cash and reduces that reservation, leaving contribution capacity unchanged. Never treat a savings surplus as spendable personal cash. Use explicit partner names before the existing generic Saving Account → Anas ownership fallback.

- **Composer amount sizing:** use the [Skiper 105 auto-scale input](https://skiper-ui.com/v1/skiper105) behavior for the existing [text field](https://mobbin.com/glossary/text-field): measure the actual value at the maximum font size and shrink to fit the available width, rechecking on container resize and font load. Preserve native selection, caret, decimal entry, paste, arithmetic expressions, and the custom keypad. Reserve the hero's height so shrinking a long amount does not move the following controls. Very long text keeps a readable 24px floor and native input scrolling. The implementation is local and requires no runtime library.

- **Adjust available:** retain the category detail menu shortcut alongside Fund and Rebalance. It opens a focused modal bottom sheet (the [Mobbin bottom-sheet pattern](https://mobbin.com/glossary/bottom-sheet)) to set a target available amount, adding the difference from or releasing it to the default account. Preserve the monthly plan; write Additional funding records. Disable it for past months because Available is a live balance, and require a default account. This shortcut is a distinct supported workflow and must not be removed as cleanup.

- **Mascot eye contrast:** Empty glass uses theme text ink; eye portions covered by liquid use dark ink clipped to the actual animated liquid shape. Never infer eye contrast from a fixed target-fill threshold: gaze, body shape, and motion can put eyes above the visible waterline.

- **Expense recurrence disclosure:** A new expense’s Repeat action shares the quiet keypad-control row and reveals Off / Monthly / Yearly only on demand, following [Mobbin disclosure guidance](https://mobbin.com/glossary/accordion). Selecting recurrence keeps a concise visible summary when collapsed. Saving records the current expense as the first paid occurrence and schedules future due bills in Transactions, preserving the original date anchor through shorter months. Edit and Income flows do not offer this expense recurrence control. Failed saves retain the selection; completed saves reset it.

## Synchronized financial reads

Database-backed values show a quiet, plain-text “Last synced” timestamp and a 44-point “Sync now” action inside Settings’s flat Notion sync section. Home and the other primary screens omit this persistent strip. This is persistent provenance, not a financial badge, chip, or new card. Sync keeps displayed values visible; failed refresh retains the existing actionable error state. The plain label/value row follows [Mobbin stacked-list guidance](https://mobbin.com/glossary/stacked-list); [Mobbin banner guidance](https://mobbin.com/glossary/banner) remains the reference for a persistent issue requiring recovery. Snapshot timestamps identify when Notion was imported, not when the screen was opened. Writes and budget gates continue to use live Notion checks.

Bills’ Due / Paid / Skipped filters use the solid `--accent` fill and `--accent-ink` foreground for the selected option, retaining their 44-point targets and pressed state. Scope selection washes are solid tints, never gradients; partner gradients remain confined to the mascot illustration. Pattern evidence: [Mobbin segmented control](https://mobbin.com/glossary/segmented-control).
