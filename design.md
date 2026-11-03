# Couple Finance App — Design System

## Design reference index

- [Mobbin glossary](https://mobbin.com/glossary): component behavior and mobile patterns.
- [Bloub live](https://bloub.vercel.app/) and [MIT source](https://github.com/jeremy-prt/bloub): radial shape morphing, eyes, and Pebble's organic profile. Local implementation and attribution: `mascot-design-system.md` and `app/components/mascot/BLOUB_LICENSE.txt`.
- [Skiper theme toggle](https://skiper-ui.com/v1/skiper4), [Toggles](https://toggles.dev), and [Skiper input](https://skiper-ui.com/v1/skiper105): specific control references; use existing semantic tokens.

### Chart and mascot motion

Joint uses a heart-shaped Pebble: shallow top cleft, two rounded lobes, broad lower tip, one face, and the existing blue/pink glass. Use the same silhouette in the scope picker, liquid pool and spending jar. Personal shapes stay distinct.

Tap feedback compresses and settles in 280ms. Shape changes take 420ms and continue from the current pose when interrupted. Reflect view replacement fades in over 220ms; chart data changes take 360ms with no delay. Exact totals remain visible; do not count up from invented zeroes. Reduced motion removes the press, shape drift and chart interpolation. Keep the mascot's existing visibility pause; add no decorative animation loops.

## Concept: glass jars that hold money

This is a shared financial home for two people, built around one idea: **money lives in glass jars.** Every pool of money is a jar. The level is how much is in it, and the shape is whose it is (Anas's squircle, Salma's egg, and a heart-shaped Pebble for Joint). Spending drains a jar, saving fills one, and Rebalance pours money from one jar into another. Nobody is competing; it's one household's set of jars.

The concept comes first, and patterns come second. When a screen needs a decision, ask what the jar idea says before asking which generic component fits:

- **Colour comes from liquid.** Blue and pink belong to the people and appear as liquid, washes and that person's selection. Interface chrome stays ink and neutral. Blue and pink identify partners; the Joint mascot retains the original soft blue/pink material. Avoid a hard split or a new ochre palette.
- **Levels before labels.** Wherever a share of money is shown (budget used, a goal reached, contributions paid), prefer a level (a jar, a waterline, a fill) over a percentage chip or a badge. The exact number is still stated in text or in the accessible label.
- **Glass, not cards.** Depth comes from the jars themselves. Pages are flat white; surfaces exist only where touch needs them (sheets, the nav, the Add button). Notices sit flat on the page; only a blocking alert gets a tinted surface.
- **Quiet type.** Section labels are sentence-case and muted, never small tracked-out capitals. Size, weight and colour carry hierarchy; the main number is the one loud thing.
- **No borrowed AI vocabulary.** No sparkle glyphs, gradient chrome, glow or decorative purple. An action's icon describes what it does (Type it is a pen writing a line).
- **Nothing repeats for its own sake.** A run of identical items (empty jars, zero rows) folds into one line that names them.

The detailed jar rules live in `mascot-design-system.md` and in the **Mascot hero**, **Jar metaphor** and **Category jar** entries below.

The primary object on Home is the wallet overview. One financial number owns the screen at a time; supporting context follows underneath in descending importance.

## External mobile design references

- [Mobbin Design Glossary](https://mobbin.com/glossary) is a reference for *behavior*: use it to name a component's interaction model (stacked list, bottom sheet, segmented control, and so on) and to check usability guidance. It is not where the look comes from: the concept above decides how things look, and a Mobbin pattern that fights the concept loses.
- Mobbin is a reference, not a replacement design system. This document, the app's semantic tokens, accessibility requirements, and established product hierarchy take precedence when examples conflict.
- Prefer the least visually heavy component that matches the behavior. Do not use cards for simple repeated rows, tiles for navigation, banners for ordinary content, or dialogs when a bottom sheet is sufficient.

### Gemini assistance within existing tasks

- [AI Elements Prompt Input](https://elements.ai-sdk.dev/components/prompt-input) is supplementary evidence for an auto-growing text input with an explicit submit action and loading state. Adapt the behavior to the existing writing canvas and semantic tokens. The action reads **Create transactions**, loading reads **Creating…**, and a short count confirms drafts are ready to save. Use the existing Save action for persistence. Omit model selectors, attachments, chat bubbles, and decorative shimmer from this focused flow. Free-text entry can select any active spending category across wallets; the selected wallet does not remove eligible categories from the model context. Category defaults are supplied with the options and returned in completed drafts. Unspecified accounts follow the selected category’s default before the form account; explicit account choices take precedence.

- Type it retains the quiet writing canvas and editable transaction rows. An explicit **Create transactions** action converts natural text into drafts; typing alone never sends data. Missing details return inline clarification without replacing the draft. Saving remains a separate action.
- Rebalance adds a labeled [text field](https://mobbin.com/glossary/text-field) and **Suggest moves** inside its existing [modal bottom sheet](https://mobbin.com/glossary/bottom-sheet). Recommendations are flat label/value rows with a short reason, never cards or badges. **Use suggestion** loads amounts for review; the existing **Apply** confirmation commits them.
- Both actions explain the data sent to Google before invocation, preserve input on network/quota errors, announce loading/error/result states, and use the existing semantic controls and 44-point targets. Suggestions inherit the global scope, protect savings and unpaid bills, and never introduce a second scope picker.

## Global budget scope

`Joint / Anas / Salma` is one app-wide context. It stays in the same top position across Home, Budget, and Reflect, and changing it updates every destination.

- The phone mode picker is an unframed mascot stack at the left of the header. Keep separate 44px minimum targets and full accessible names; the selected scope sits in the center foreground.
- Picker artwork stays static between selections. On phones, a brief depth rotation brings the selected mascot forward; the others sit smaller behind it. No cuddling, captions or inner selected pill. Desktop retains visible names.
- Preserve the established blue, heart and pink mascot artwork. Do not substitute gender symbols or decorative emoji.
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
- `--select-color`, `--select-wash`, `--select-edge`, `--select-ink`: selection and data fills follow the wallet (`html[data-scope]`, set from the app-wide mode): Anas's blue, Salma's pink, or ink for Joint (never a blue-pink blend, which reads as lavender). Selected rows, chips, tabs and toggles use the wash with the ink; progress bars, charts and sliders use the colour, so "selected" also says whose money it is. `--accent-foreground` is an alias of `--select-ink`.
- `--budget-used`: neutral text tone for normal budget consumption; retain amber caution and red overspending states. Spending is consumption, not a completion goal.
- Summaries use `--text2` for readable connecting text and `--text` for facts. No decorative summary accent color.
- Partner blue and pink identify people. Through the `--select-*` tokens they also mark what is selected and fill data inside that person's wallet (Joint uses neutral ink); they are never used for actions, which stay ink.
- Danger, warning, success, information, transfer, and income colors are semantic and must not be repurposed decoratively. Green (`--success`, `--action-income`, a soft sage that sits with the pastel mascots) means money in or kept: income, "Saved", positive available. Never selection, never an action.

Never tint the entire light canvas. Depth comes from surfaces and restrained elevation.

### Typography

Use SF Pro Rounded through the native `ui-rounded` stack (`--font-body`), with tabular numerals for financial values.

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

Use the 4-point scale: `4, 8, 12, 16, 24, 32`. Screen sections use 16 or 24 points. The main mobile content rail uses 24-point side gutters, shared by the sticky header; below 360px, reduce them to 16 points to preserve row space. Desktop retains its 48-point gutters. Avoid unexplained one-off gaps.

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

Lucide is the structural icon family. Use 16, 20, or 24px icons with consistent strokes. Type it uses Lucide's pen-line (`WriteIcon`): it says "write it in words", not "AI". No sparkle glyphs. Category visuals use the curated Thiings artwork through CategoryIcon and the shared category image resolver. Account emoji remain user-authored data, never the only accessible label.

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
| Summary sentence | `app/components/ui/Summary.tsx` | The app's narrative voice for summaries; see **Summary sentence** below. |

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
- **Mascot hero:** one per screen, centred directly above the screen's main number and sized to match its weight (`MASCOT_HERO_SIZE`, never a small sticker beside a row). The shape always means the scope: Anas's squircle, Salma's shape, and a heart-shaped Pebble for Joint — one body in every variant. Jars are never fully clear: a pool's glass carries a very faint wash of the scope's colours (so an empty pool still reads as a body, not an outline), and `split` jars, which have no waterline, get a slightly stronger wash and a thin light sticker outline on each emoji (`--mascot-sticker`: white in light mode, none in dark mode), keeping the shape and pale emojis legible. The wash deepens softly towards the jar's edge (glass thickness) so the silhouette reads without a hard line, and each jar sits on a faint blurred contact shadow (`--mascot-shadow`) — never a drop shadow on the body. `pool` shows a share as a liquid level in the scope's colour (Joint retains soft blue/pink glass); Tapping the Home pool also drops the month's top three spending categories into it as emojis (sized by how much of the pool each took; named in its accessible label), and they're sucked up and out through the top when it's tapped again. `split` fills the jar with one emoji per category that still has money in it, sized by its share of Available (so the jar always matches the number beside it). The jar is clear glass with a soft, always-neutral border (`--mascot-edge`; the level and the colour carry the state, never a red outline). A plan pool (Home hero, Insights card) keeps the scope's soft colour until its last fifth (about 80% of the plan spent), then its liquid and wash blend gradually into a soft, equally lightened red, fully red when empty; jars where empty isn't a warning (partner contributions, a month with no plan) never turn red, eyes and labels follow the theme, and it moves only when its data changes. Opening a screen never replays an entrance: a hero jar starts as it was last seen on this device and animates only what changed since (new category emojis drop in, removed ones are sucked out through the top, the pool eases from its old level); the emoji jar fills once from empty the very first time — still under Reduce Motion or off-screen. The jar alone gives the at-a-glance read; its exact numbers (spent %, over plan, a partner's due) are not shown until the jar is tapped: the jar gives a soft squish with a light haptic tap (a softer tick on close) and the numbers surface from behind it as a plain detail line (sliding down, fading in and coming into focus; no pill, border or background) via `MascotSpill`, staying until tapped again. The jar is a real button (keyboard operable, `aria-expanded`, details always in its accessible name); the first jar a person ever sees spills once by itself to teach the gesture; Reduce Motion simply fades the line in. Joint Home cuddles each partner's small jar (their own shape, no visible name: shape and colour identify them, the name stays in the accessible label) against the joint pool's lower sides, resting level with it, just touching its edge in front and leaning in (water stays level with the ground); a partner's details come out of their empty outer side (Anas's to the left, Salma's to the right) rather than from underneath, so they stay cuddled; the pool's stay underneath, filled by the share of their joint contribution already paid, whose tap spills "due"/"Settled"; this replaces the separate Contributions cards (scope switching stays in the header).
- **Floating Add action:** the persistent bottom-right FAB represents the app’s primary constructive action. Use a circular plus-only control with an explicit accessible name (`Add transaction`); retain floating elevation and keep secondary actions in the header.
- **Slide to confirm:** big, hard-to-undo commitments (saving a month's plan) use `SlideToConfirm` instead of a button: an ink thumb dragged across a quiet track that fills with the wallet wash, confirming past 90% and springing back otherwise; a tap only nudges the thumb. Enter/Space confirm for keyboard and assistive tech. Haptics fire on grab and confirm (pointerdown/up); iOS gives none mid-drag. Everyday saves stay ordinary buttons.
- **Composer sheet:** shared header, 44-point close action, amount treatment, keypad, picker chips, feedback, and primary action. Add Transaction and related money-entry flows use this hierarchy.
- **Composer fit:** the default transaction state must fit between the persistent header and the bottom safe area without scrolling at the reference phone height. Use border-box sizing and let the amount hero absorb height differences; preserve 44-point keypad and control targets. Exceptional feedback or keyboard-constrained states may scroll rather than clip content.
- **Modal sheets own scrolling:** while a sheet or dialog is open, the page behind it never moves (Apple HIG "Sheets"; WAI-ARIA modal dialog). The lock sits on `<html>`, which is what scrolls; scroll areas inside sheets use `overscroll-behavior: contain`, so reaching the end never drags the page. The wide-desktop docked inspector isn't modal and leaves the page scrolling.
- **Sheet overflow:** task sheets use a fixed header and fixed primary-action dock with one independently scrolling content region between them. Dynamic banners, previews, and validation feedback must shrink or scroll that middle region; they must never move the primary or confirmation action below the viewport. Keep the bottom-sheet presentation through the 640-point app content rail and switch to a centered desktop dialog only at the wider tablet breakpoint.
- **Transaction type control:** Expense and Income are mutually exclusive modes, so the composer presents them as one labeled segmented control. The selected segment uses the raised primary surface; semantic red/green is confined to its directional icon.
- **Type it composer:** An accessible 44-point pen-line icon (`WriteIcon`: write it in plain words, the app works it out) [button](https://mobbin.com/glossary/button) beside the form’s date picker opens a quiet writing canvas in the existing `BottomSheet`; the canvas keeps the date and Close control without a duplicate mode toggle. No mode segments, Expense/Income selector, boxed input, or separate preview list in this mode. The sheet’s body is the entry surface: borderless, auto-growing native text fields form a [stacked list](https://mobbin.com/glossary/stacked-list), one transaction per line, with the signed parsed amount aligned right in the shared signed-amount colours (red expense, green income) and one quiet row of composer picker chips below: the category (suggested from past transactions, never silently defaulted), the account only on the line being edited or when it differs from the default, and the date as plain text only when it differs from the canvas date. The chips open the same anchored account and category pickers as the form (`TransactionPickers.tsx`). Enter creates a new line and multiline paste preserves lines. The text determines each line’s type (ordinary purchases are expenses; income wording or a plus sign means income), so one draft may contain both. Keep the selected default date and a way back to the form at the top; keep the net amount and compact Save action in a fixed dock. Preserve drafts and reviewed choices, validate combined expenses per category, save sequentially, and remove each confirmed row from the persisted draft while retaining unsaved lines. Inherit theme tokens, with 22px writing text and no decoration from the reference app.
- **Composer picker chip:** account, category, and date use one quiet outlined pill family with a leading icon and concise label. Account and category form a left-aligned context group; date stays independently right-aligned. Chips size to content, wrap without distributing evenly on narrow screens, and retain a 44-point target. The pill treatment already communicates interaction, so composer picker chips omit redundant disclosure chevrons.
- **Allocation flow:** Rebalance and planning share the sheet shell, slider behavior, category controls, feedback, and inherited scope context.
- **Section heading:** 12px sentence-case muted label (no uppercase, no letter-spacing) with an optional 44-point trailing action.
- **Category detail sheet:** compose the shared bottom-sheet shell, identity header, one dominant Available amount, Planned and Spent as quiet supporting metrics, a compact action toolbar directly below the summary, a subtle month-filter trigger beside Activity, and shared transaction rows. The header contains identity and dismissal only. The toolbar uses one three-column geometry: high-emphasis Expense, outlined Fund, and low-emphasis Freeze; all controls keep visible labels and equal height. Expense reuses the transaction composer’s red upward-arrow language. Show the budget progress rail only after spending begins and always pair it with an explicit percentage label; an empty rail reads as a divider and must be omitted. Currency is owned by `Money` and must never be repeated by a surrounding stat component.
- **Period filter:** use one compact outlined calendar-trigger displaying the active period and open the shared themed month grid for non-linear selection. When the active period is supporting metadata beside a section heading, use the same quiet pill geometry at a 44-point target. Previous/next steppers belong on primary time-series screens where sequential browsing is the core task; do not spend an entire section-header row on them inside a detail sheet.
- **Date picker:** every day- and month-granularity field uses the shared `DatePicker`/`MonthPicker` trigger: calendar icon, concise localized value, and a 44px minimum target. Compact contextual filters and composer pickers share the quiet outlined pill treatment; full-width form fields use the standard control radius. A chevron appears only when it adds disclosure information. The picker body may reflect its granularity, but equivalent trigger contexts must not change between forms, planning, and detail filters.
- **Anchored picker surface:** a trigger already identifies its picker, so compact anchored popovers omit duplicate title bars, dividers, and close buttons. They dismiss on selection, outside tap, or Escape. Use a titled sheet only when selection becomes a multi-step task. Searchable pickers must remain clamped to the visual viewport—including its offset and reduced height while the iOS keyboard is open—so filtering never moves the menu off-screen.
- **Calendar picker:** day selection shows one compact month grid with previous/next navigation; month selection shows a compact twelve-month grid with previous/next year navigation. Both use the same anchored surface, selection treatment, and current-period status. Do not duplicate `Today` or `Yesterday` shortcuts when those dates are already visible and selectable in the grid. Mark the actual current date or month independently from the selected value using the existing green status-badge color pair; if the current period is selected, use the deeper green selected treatment.
- **Picker option list:** keep option rows fully visible within the scrolling viewport; never leave a partial row trapped behind a fixed search region. Search stays attached to the bottom edge only when the dataset warrants it.
- **Scroll edges:** wherever content scrolls under a bar, the edge is a progressive blur (`ProgressiveBlur` in `app/components/ui/ProgressiveBlur.tsx`), never a hairline border or a hard clip. Stacked `backdrop-filter` bands ramp the blur radius down while a tint of the surface behind eases out, so the bar and the content meet without a visible line. The tint is always the surface the bar actually sits on: `--bg` for the app shell, `--surface` for sheets (`.bottom-sheet-panel` forces it in both themes). An edge shows only while content is hidden past it (`useScrollEdges`) and slides rather than fades, because opacity on an ancestor stops the blur. Where it's used: the app header (a 32px ramp below it once scrolled), the floating nav (content fades out behind the pill on mobile; the desktop sidebar has none), sheet scroll lists via `BlurScrollArea` (28px, 4px max blur, top and bottom), and the plan sheet's floating compact bar (see below).

## Summary sentence

Where a screen needs to say what matters right now, it says it in one sentence instead of stacking banners. `Summary` renders the sentence and `Fact` marks each fact inside it.

- Summary styles live with the shared component in `app/components/ui/summary.css`. Connecting text uses `--text2`, weight 400, and zero tracking. Ordinary facts use `--text`, weight 500; actions and semantic exceptions use 600. Main-screen summaries remain 18px / 1.4, centered on mobile and left-aligned on desktop. Other summaries retain the shared 20px baseline unless their component specifies an established size.
- Omit redundant account/category art inside Home and Reflect narrative sentences. Keep category artwork in rows and the established hero mascots.
- Tappable facts remain real buttons, with the existing invisible hit extension, pressed feedback, keyboard focus ring and full accessible destination label. Pointer hover underlines an action without lifting it out of the sentence. State color belongs only to the relevant fact.
- At most three facts, joined as "a, b and c" (`joinClauses`), ranked by urgency. Everything left out still lives on its own screen.
- Colour (`tone`) goes on the number or state only, never on the name or connecting words, and only when it carries meaning: `danger` for money already wrong (over budget, runs out today), `warning` for attention soon (count off, running low), `success` for good news (count matches, within budget). Opportunities such as unassigned money or planning stay in ink.
- Never repeat the screen's main number in the sentence, never put buttons or tinted backgrounds inside it, and never join phrases with a middle dot.
- On Home the sentence exists only when something needs action or is an exception (a balance that is off). When nothing does, there is no sentence at all: no calm filler line. Reflect is the exception: its sentence is a recap of the period, so it always shows when there is spending.
- Where it's used: Home under the wallet (balance checks, running low, planning, unassigned money; it replaces those banners), and Reflect under the Spent number (the biggest category and over-budget categories for the period).
- Errors that need a Retry stay banners.
- A sentence never restates something already on the same screen. On Reflect the list shows each category's share, so the recap names how concentrated spending was ("your **top 3 categories** took **51%**") instead of the top row again.

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

- **Home:** wallet overview first, partner summaries directly below it, then actionable budget context and activity. The wallet distinguishes account cash, current category availability (including carry-over), and monthly assignments versus category spending. Never label assignments minus spending as money left. Show the remaining funding need once, in Contributions. For unconfirmed months, partner dues sum to the positive current availability-minus-cash difference, to the cent. For confirmed months, dues follow the saved agreed contributions plus personal borrowing; show any separate cash shortfall without rewriting that agreement. Remove diagnostic gap rows and explanatory paragraphs from Home. Savings goals live in Budget; Home shows one only when it becomes a time-sensitive action or exception.
- **Budget:** prominent Rebalance action, readable ranked allocation overview, search, then category groups.
- **Budget unassigned money:** shown as an action banner under the hero (like "due to Joint"), never a tag: "X unassigned" with an Assign action, or a danger "X over-assigned" with a neutral Rebalance action; both open Rebalance. Nothing unassigned shows nothing.
- **Rebalance never says "Balanced" while the scope is short.** Its pool leaves out savings and can't go below zero, so when the scope is short outside it (over-assigned savings, advances owed back) the balanced mark becomes "Still **384 short**", tapping through to the same fix as Budget's notice.
- **Savings that hold less than they promise are named, with the fix pre-filled.** When a savings account's categories promise more than it holds, the owner's views say so directly (Budget: "Savings **9.703** short" with **Move from Hubby Account**; Home: "**Saving Account** is **9.703 short**"), even if their checking covers it on paper. The action opens a transfer from the owner's checking with the amount filled in (the gap, or what checking can spare). Nobody has to work out the number.
- **"Short by" points at what fixes it.** Rebalance only moves money between categories, so the action follows the cause: Joint short while advances are owed back reads **Plan** (contributions cover it); a partner short because a savings account holds more assigned than it has reads **Review** (opens that account for a balance check or undoing a deposit); otherwise **Rebalance**. Icon, message and action sit on one line on desktop.
- **Loading:** all data reads use the shared Skeleton components and existing neutral shimmer tokens. Match the pending content’s shape and reserve its space, including initial startup, heroes, lists, planning, and charts. Keep verified content visible during independent reads. Announce loading through accessible status labels without visible loading sentences; respect Reduce Motion. Save progress and actionable errors retain their own feedback.
- **Rebalance:** the allocation flow shows the scope's jar above the pool number, filling as money is assigned — one emoji per assigned category sized by its share of the pool, unassigned money as empty space (full when balanced). Moving money resizes emojis in place; the face is curious while money is unassigned, excited when balanced, worried when over-assigned. It opens settled (no remembered state). The mascot stays out of data-entry sheets such as Add transaction.
- **Insights:** the Summary card is headed by the mode's small pool mascot in place of a text label (top-left) (level = what's left of the plan; face = pace: happy on or behind pace, worried ahead of the calendar, sad over plan), and its spent tag is always red. use the shared MonthPicker trigger as the single period filter, followed by compact analytical cards, accessible chart alternatives, and transaction history. Activity chips are self-explanatory and must not carry a redundant “Filter activity” heading. A failed request becomes an actionable error state, never a permanent skeleton.
- **Mascot taps:** every product mascot responds synchronously to a tap with one light haptic (selection when closing a detail spill or tapping a scope). Standalone planning and allocation jars use `MascotTap`, an accessible button, while existing detail and Reflect buttons retain their actions and emit only one haptic. Automatic hints and data animations never vibrate. Settings has no haptics test controls.
- **Accounts and Settings:** use the same title, spacing, control, and surface primitives as the app shell and sheets. Settings is a flat preference list: section labels and 24–32px whitespace create grouping, with no row dividers or enclosing borders. Appearance uses a 44-point animated sun/moon icon button beside a quiet System button; navigation rows remain transparent and full-width.
- **Add Transaction:** keypad-led amount entry, centered description input without a redundant visible label, picker chips in a stable position, and one clear save action.

## Say it once per screen

Each piece of information appears once on a screen. When two elements would show the same fact, keep the one closest to where it's acted on and drop the other.

- A row's subtitle is hidden when it only repeats the title (a bill or transaction named "Rent" in the Rent category); `sameText` in `TransactionRow.tsx` decides.
- A control next to the month picker doesn't name the same month again (Budget's plan chip reads "Plan" for the shown month, "Plan December" only for another month; its accessible label always names the month).
- Colour plus a text label for the same state (a red overdue date and "Overdue") is not a repeat: the label is what makes the colour accessible.
- Actions are not information: a persistent header action (Rebalance) and a contextual one in a notice may coexist.

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

Use one anchored popover surface for single-choice controls, including accounts, categories, and funding sources. Show a title, close action, selected state, and readable 44-point minimum rows. Long lists include search. Dates use the shared month calendar. Do not pin menus over the bottom keypad. Expense and Income use accessible icon-only controls in semantic red and green. Disabled submit buttons are neutral; enabled primary fills use ink (`--accent`) with `--accent-ink` text.

- **Wallet supporting metrics:** use plain text rows, following the [Mobbin card guidance](https://mobbin.com/glossary/card) for minimal content. Monthly assignments follow funding accounts; spending follows categories regardless of payer. Contribution credit includes transfers and direct joint-category payments. A confirmed monthly contribution agreement establishes the target; contributions above its current agreed amounts are repayable advances. Months without an agreement retain the live funding estimate and do not establish reimbursement debt.

- **Category editing:** the detail action menu opens a modal bottom sheet with labeled name, icon, type and default-account fields, composing the existing category manager and choice pickers. Save copies account owners and changes category metadata only; funding uses a separately labeled Funding account. Keep the header and Save dock fixed around scrolling fields. Close/Escape discards the unsaved draft, reopening restores saved values, and failed saves retain fields for retry. This short contextual form follows [Mobbin bottom-sheet guidance](https://mobbin.com/glossary/bottom-sheet).

- **Contribution funding:** include current category carry-over and rebalance results through availability. Credit net partner transfers and personal joint-category expenses. Apply configured shares to credited contributions plus the cash shortfall, cap individual dues between zero and the shortfall, and assign any rounding remainder to the second partner. Without a confirmed agreement this is a funding request. Confirmed months use their saved targets and preserve the original agreement. Additional funding above the current agreed amount is a repayable advance; cash corrections, spending and category rebalancing never rewrite the targets.

- **Money words:** money not yet in a category is **Unassigned**, everywhere (never "ready to assign", "not assigned", "unallocated" or "available to plan"). What's in a category is **available**. People are **Anas** and **Salma**, never Husband/Wife.
- **Budget list:** categories sit in the plan sheet's collapsible sections (`SectionToggle`: Savings → Obligations → Long term → Wants → Other, then Frozen, closed). Each section is one flat surface of jar rows (`CategoryJarRow`): the category's jar, name, one quiet line only when it matters ("Overspent", "Spending fast", "X spent"; empty jars say why by colour instead of a label), and Available as the only number. Rows needing attention come first. Savings rows fill up towards their goal ("40% of 15.000 by Jun", "Goal reached").
- **Jar metaphor (one, everywhere):** a jar holds the money that's in it. Budget jars and the Home pool drain as you spend, which is the plan working, not a warning; savings jars fill as you save. The level says how much is there; the colour says how you're doing against the month (`pace` in `category-status.ts`).
- **Category jar:** `CategoryJar`, a static, eyeless, physics-free SVG in the wallet's outline (the shape says whose). The emoji floats on the liquid: near the top when full, settling as money is spent, resting on the bottom when empty. It's drawn above the liquid so it's never hidden, and its height doubles as the level. Still at rest; it never blinks or wobbles.
- **Status palette:** one family wherever a budget's health shows (jar liquid, the number, the status line, the Home pool): good = on or ahead of pace (sage); low = a current-month spending category estimated to run out within seven days and at least two days before month-end (honey liquid, deep amber `--status-low` text; never the bright `--warning` yellow for text); over = below zero (strong coral wash, red minus number, "Overspent"). Empty jars carry no label; their wash says why: soft coral = spent it all, soft honey = never funded. Tokens: `--status-{good,low,over}` and `--status-{good,low,over}-liquid`.
- **Budget banners:** at most one, the most urgent: Short by → Running low → Unassigned → Due to Joint. Next month's plan is a quiet pill beside the month picker, not a banner. Unassigned money is assigned in Rebalance from both Home and Budget; a category's Fund adds money, and Rebalance takes it back out.
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

Home's Due bills section is a standard [Mobbin stacked list](https://mobbin.com/glossary/stacked-list): bill rows use the date-led layout inspired by [Lime’s upcoming bills](https://design.how/systems/lime#upcoming-bills): a 44-point-wide quiet date tile with weekday above day, bill name in the middle, and a plain unsigned 15-point amount aligned right. Bill rows use 16-point vertical padding around the 56-point date tile for a relaxed 88-point minimum row height in both Home and All bills. No enclosing card, amount pill or trailing chevron. Dates use noon local parsing to avoid timezone shifts; Paid rows use payment dates. Full dates and currency remain in accessible row labels. Due amounts are unsigned and neutral because they are not recorded spending. Bills use compact icon-only Pay due and Edit swipe actions: 44-point controls, an 8-point gap between actions, and 16 points between the row and actions. The row contracts from the trailing edge rather than translating its name off-screen. Accessible labels retain the action names. This is the shared contextual swipe-action convention in `SwipeToDelete`, following [Mobbin icon-button guidance](https://mobbin.com/glossary/button). Keep destructive swipe behavior separate. Swiping only reveals controls and each action opens its existing form. Keyboard focus also reveals the actions, while tapping the row still opens details. Flat rows show the date tile, name, plain amount, and the category name as quiet subtext beneath the bill title. Useful status context (Paid, Skipped, Overdue, Needs funding, Recorded twice) sits beside the category with layout spacing, wrapping when needed; warnings retain their danger color. Missing categories omit the name without a placeholder. Recurrence remains in detail. Home uses a quiet section label with All bills navigation in the header. Adding a bill is available inside All bills; Home omits the redundant Add bill action. Omit the repeated month-end total; upcoming rows lead with the weekday/day tile, retaining explicit Overdue context. Passive dates and recurrence stay plain text. The Add bill action inside All bills is always available after a successful read; All bills opens the scoped month list with Due / Paid / Skipped filters.

Creation, occurrence details, editing, and payment confirmation use the shared [Mobbin bottom sheet](https://mobbin.com/glossary/bottom-sheet). Category and account choices reuse anchored picker popovers; dates reuse the shared calendar. Keep controls at least 44px, retain fields after failure, prevent repeated submissions, and respect the shared sheet's focus and Reduce Motion behavior.

One schedule (`Type = Due`, empty payment Date and Account) lives in Transactions. Monthly and yearly occurrences are derived; paying creates a separate linked Expense. No month-generation action is needed. Available remains actual money, Earmarked is unpaid expected spending through the current month-end (including overdue bills), and Free after bills is their signed difference. Future-month views omit present-balance comparisons. The ordinary expense form warns when it uses earmarked money and names its continuation action Save anyway.

The older dev-only `/due-lab` remains a sample-data exploration of the previous materialized-occurrence model; it does not control the production flow.

- **Next-month planning capacity:** all saved and draft personal allocations, including frozen categories, reserve capacity before Joint planning. Current commitments are deducted once from account capacity. Unassigned Joint cash covers the Joint plan first; only its shortfall is split using account contribution percentages (65/35 fallback). Joint capacity is constrained by each partner’s remaining money and share, not merely their combined total. Personal planning reserves the same next-month Joint dues. Show one contextual shortfall banner using the shared Banner, following [Mobbin banner guidance](https://mobbin.com/glossary/banner), and disable saving until both partners can cover their plans. Amounts remain exact internally; displays round to whole MAD.

- **Allocation labels:** wallet allocation totals include owned savings categories as well as spending categories. A savings funding account does not erase category ownership from monthly totals. Use “Allocated” for the money currently held in budget categories across screens, replacing “Left to spend.” “Unassigned” remains money outside categories. Rebalance’s total includes both, so call it “Allocation pool”; render its unassigned amount as a plain label/value row without a badge, dot, or nested surface, following [Mobbin stacked-list guidance](https://mobbin.com/glossary/stacked-list). The planner labels its computed capacity “Unassigned” in every scope; the sheet header already names the month, so hero, sub-lines and save copy don’t repeat it. In Joint, each partner’s capacity after personal plans is shown beside their mascot; this is affordable planning capacity, not the Joint bank balance.

- **Joint planning mascot family:** reuse Home’s `JointFamily` cuddle geometry. Planning partner jars show their contribution capacity after personal plans as quiet side details (“I can give” above the amount), visible on entry and toggleable through `MascotSpill`. Percentages and explanatory paragraphs are omitted; capacity remains in accessible labels. Follow the [Mobbin tooltip](https://mobbin.com/glossary/tooltip) pattern for tap disclosure. Home continues to show actual contribution status.

- **Monthly-plan Freeze:** swipe an active category left using the shared row-swipe primitive; the action uses a snowflake and light blue surface from the info token. Swiping reveals the labeled action behind the row; tapping it freezes. There is no Freeze action inside expanded row content and no automatic freeze on swipe release. Keyboard focus reveals the same action for Enter/Space activation. Freezing clears only the planning month’s saved allocation and draft amount, then moves the category to Frozen; balances and past funding stay intact. Other draft amounts survive. Failed writes restore the row and show the existing error banner. The compact scrolling summary floats over the top of the rows (no layout shift when it appears) and has no background of its own; its top - **Compact planning summary motion:** on hero exit (the hero amount passing under the bar), fade in with a 4px vertical settle over 180ms. Its backdrop is the app's own `ProgressiveBlur` (`app/components/ui/ProgressiveBlur.tsx`): stacked `backdrop-filter` layers, each masked to an overlapping band, so the blur radius ramps (12px → 0.75px) rather than one blur fading out. It is held solid behind the bar with a `--surface` tint — the token `.bottom-sheet-panel` forces in both themes, so the bar matches the header in dark mode — then blur and tint ease out over 44px below it, leaving no visible bottom edge. It slides in (220ms) rather than fading, because opacity on an ancestor becomes the backdrop root and kills the blur. Respect Reduce Motion by switching immediately. Freeze’s revealed action uses light blue info tint in every wallet scope.

## Monthly planning workspace

- **Header** has three slots: title left, scope picker centred, close at the right edge. The shared `.sheet-header h1` margin reset means alignment must come from the layout, not the title's margin.
- Header, table and summary share one `--dialog-inset`. The table and the summary both sit flat on `--surface`; a faint divider (the row-divider strength) separates the summary, which stays put while the table scrolls. Columns read Spent, Last plan, then the new plan, so "Copy last month" moves the column beside the box into it; Spent turns red when it beat its plan. The summary takes about a third of the width (at least 320px); table numbers keep fixed columns beside the plan box they inform, and the name column takes the rest.
- The scope picker names the scope and the title names the month, so neither appears again as a heading or column label. "Copy last month" lives in the plan column's header. The first group's name ("Savings") shares that column-label row, so the table opens with one line instead of two; the row isn't sticky, since it names the first group.
- The summary shows the result as the hero number (with a real minus sign), then one sentence giving its causes, one per number: Joint's gap and who covers it ("Joint is already short, so **Anas** puts in **204** and **Salma** **110**."), then, in that partner's own view only, their own money if it's already committed ("**Anas**'s money is already **384 over-assigned**") or runs out after planning. Each view talks only about its own money: Joint never mentions a partner's personal accounts, and a partner's view names only their own share of Joint's gap. It never says "for this plan" when nothing is planned. The for-Joint split lives only in the sentence; planned rows show only when not zero. Numbers round to whole MAD and shortfalls round up.
- **Plan cells are inline-editable numbers**, like a spreadsheet's (YNAB's Assigned column): at rest they read as the third number column (14px, right-aligned, tabular, aligned with Spent and Last plan), an empty plan shows a faint "—"; hovering the row tints the cell; focus shows a clear field with the selection ring; a changed amount keeps the selection wash and turns semibold. The whole cell (a label) is the 44px target. "Copy last month" is the column's only control: a quiet outlined pill, so actions and data never share a shape. The freeze action stays faintly visible so the last column is never dead space. Agreed contributions only appear once there's a shared plan to confirm or an agreement to show, and there's no "Nothing planned yet" filler.
- **Spend first, fund later.** Spending can be recorded before the month is planned; its category just goes below zero. Planning that month, a plan costs only what it adds above the hole (`planCost`: a category at −200 planned 3.800 takes 3.600 from unassigned money), because Ready To Assign already absorbed the spending. The sheet, the page's opening pool, the native planning context and the save route all use the same rule. A future month is charged in full. When the month being planned already has spending, the category shows a muted "200 spent so far" under its name: context, not a warning.
- **One thing at a time.** In Joint's view, a partner whose own money is already over-committed blocks saving, so the sentence says only that: "**Anas** needs to free up **384** first" (opens his view; never names the account). The usual sentence returns once it's resolved.
- **Left to put in, after saving.** With the month's contributions agreed, each partner gets one line: "**Salma** has **4.829** left to put in". It's their agreed share minus everything already counted (transfers to Joined, Joint bills paid from their own account, applied advances), so it stays current however and whenever they pay; the line disappears at 0. When Joined owes them an advance, a quiet **Apply 971** applies it with one tap: it records Joined repaying them and the same amount as their contribution (the contribution half carries an `offset:` marker so the ledger counts it), moving no cash and clearing the debt. Home's sentence carries the same "has **X** left to put in" while anything is left, opening the plan.
- **From last month** sits below the money in the summary (even 32px section spacing, no forced gap), under a quiet "From October" label that names the month once, and says only what the table can't: one sentence with the total over plan and how many categories went over ("**2.130 over** plan across **7 categories**"), and the top three gaps ranked by how much spending beat the plan (icon, name, red "+994"). No divider: spacing separates it. "Over capacity" and "From October" share one 15px semibold label style. A thin bar comparing this plan's total with last month's spending ("This plan" / "October spent") appears at the foot of the summary only once the plan has amounts. No per-category charts and no underspent list. It's tappable without looking like buttons: the category count filters the table to the rows over plan (tap again for all), and a ranked gap scrolls to its row and focuses its plan cell.
- Carried advances are one row per month ("October advances 1.792"), with a total only when more than one month is carried. On desktop each row opens Contributions, where who's owed what and the repayments live.
- Category art sits bare at 32px, with no tile behind it. A row's hover background reaches 12px past its content on both sides, so text stays on the dialog inset while the highlight never touches the icon.

## Overspending

Money that was already spent can't be refused. When an expense doesn't fit its category, every place that records spending (add expense, edit, Type it, the balance-check form, bill payments) warns instead of blocking:

> **Groceries** goes **44** below zero.

The action reads **Save anyway** (**Record anyway** for a bill payment). Rebalance and quick-fund stay beside the warning.

**Warnings are a nudge, not a paragraph.** One short line that names the fact (what's off and by how much). No instructions the button or the action beside it already gives, no consequences spelled out ("carries into next month" lives here, not in the UI). If a warning needs a second sentence, it's explaining a rule, and the rule belongs in this document.

- **Within the month, the category shows the deficit.** Groceries sits at −44 until money moves in. At month end Notion's category formula resets a negative balance to 0 (`pastCarry = max(0, …)`); the cost isn't lost, it already came out of unassigned money, because Ready To Assign counts only categories that still hold money. So next month's plan never has a deficit to cover, and the plan sheet doesn't show one; its red Spent column flags last month's overspending instead.
- **Deficits never hide while they exist.** Home's sentence leads with them in red ("**Groceries** is **44 overspent**", opens Rebalance) and drops the clause once covered or once the month rolls over.
- **The server still guards it.** It only saves spending that doesn't fit when the request says `overspend: true`, so Shortcuts, the assistant and any other caller can't overspend without an explicit confirmation. Shortcuts accept `"overspend": true` in the request body, and the assistant's `record_expense` tool has an `overspend` option it may set only after the person confirms.

### Advances (personal money for joint costs)

A special case with its own wording: an expense in a joint, non-savings category paid from Anas's or Salma's own account. That money was never Joint's, so it counts toward that partner's contribution, and anything above their agreed target becomes an advance Joint owes back.

- The warning reads: "Joint owes you this. **Groceries** goes **500** below zero." Save reads **Save as advance**.
- The server accepts `advance: true` only when the category is joint (`Team Fund`) and not savings *and* the paying account is a personal one.
- **Settling advances.** Joined rarely holds the cash to repay on its own, so an advance is applied to the next month's contribution (one tap per person in the plan sheet, moving no cash). Contributions says so under the owed amount ("Settled with **November's plan**", which opens the plan); its per-person receipt action stays for logging money Joined already sent back.

## Bills calendar

All bills opens on the chosen month as a calendar, so you see *when* money leaves before reading *what* it is. It lives only inside All bills; Home keeps its short due-bills list.

- **Summary sentence first** (current month only), saying only the totals nothing else shows: "**5.210** is still due, **430** of it **overdue**" (overdue in red). It doesn't name the month (the picker does), the next bill or today's bill (the calendar and list do).
- **Grid:** Monday-first, seven equal columns of square cells at least 44 points, 4-point gaps, the shared control radius. Weekday initials sit above in 12px muted text. The day number is 12px in the bottom-right of each cell.
- **Empty days stay faint** (a half-strength `--surface2` wash, not interactive). A day with bills is a button on full `--surface2` carrying the first bill's category artwork (`CategoryIcon`, 24px) and a "+N" count beside it when more bills share the day.
- **State colours the cell, not the art:** overdue gets a light `--danger` wash, paid or skipped days fade their art to 40%, and today has a thin ink ring. A selected day gets a stronger ring.
- **Tapping:** a day with one bill opens that bill; a day with several filters the list below to that day, with the full date as a heading and a Show all action in place of the Due / Paid / Skipped chips. Rows under that heading drop their date tile, since the heading already names the day.
- Each bill day's accessible label names the date and every bill on it with amount and state.
- Overdue bills from earlier months don't appear in this month's grid; the sentence and the Due list carry them.

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

Database-backed values show a quiet, plain-text “Last synced” timestamp and a 44-point “Sync now” action inside Settings’s flat Notion sync section. Home and the other primary screens omit this persistent strip. Keep Sync now available in Settings even when reads fall back to live Notion and there is no displayed snapshot timestamp; omit the unknown timestamp instead of hiding the action. This is persistent provenance, not a financial badge, chip, or new card. Sync keeps displayed values visible; failed refresh retains the existing actionable error state. The plain label/value row follows [Mobbin stacked-list guidance](https://mobbin.com/glossary/stacked-list); [Mobbin banner guidance](https://mobbin.com/glossary/banner) remains the reference for a persistent issue requiring recovery. Snapshot timestamps identify when Notion was imported, not when the screen was opened. Writes and budget gates continue to use live Notion checks.

Bills’ Due / Paid / Skipped filters compose the shared `ScreenChip`, with compact content-width outlined pills, solid selected fill, and 44-point targets. The list’s MonthPicker uses the shared compact outlined pill trigger. Omit the cutoff explanation and category balance/reservation breakdown above the list. Only exceptions appear in the owning bill row: overdue dates use danger text, insufficient current-month category funds show “Needs funding”, and duplicate payments show “Recorded twice”. Future-month rows omit present-balance funding comparisons. Scope selection washes are solid tints, never gradients; partner gradients remain confined to the mascot illustration. Pattern evidence: [Mobbin segmented control](https://mobbin.com/glossary/segmented-control).

## Reflect: spending in time

**Over budget:** integrate monthly plan variance into the existing **Where it went** category rows, following the flat [stacked-list pattern](https://mobbin.com/glossary/stacked-list). Keep the category's spent amount and share; affected rows add one plain danger-text line such as “220 over budget” and use danger for their share bar. Do not duplicate categories in a separate section or add a second summary. Never chain Spent and Assigned values with dot separators. Omit routine calculation explanations and placeholder reporting hints.

Compare each category's selected-month net spending (after category refunds) with its net monthly Assignments, to the cent: only `spent > assigned` is over budget; equality is fully spent. Missing assignments count as zero. Savings, uncategorized spending, and the synthetic To Joint row do not receive this comparison. Rebalances, carry-over, and current Available never change the assignment baseline. Assignment edits do change it; this is not a frozen original-plan comparison. Category exclusions apply. Show variance only for one selected month, with all accounts included and matching assignments successfully loaded. Keep assigned amounts and excess in accessible row labels. Load assignments and transactions together; failed reads must never appear as zero assignments. The existing category transaction detail and available-money gate remain in place.


Reflect’s Spending hero shows the category jar and unsigned spent amount. Work & income configuration and work-time conversions are removed at the user’s request. The Spending / Activity switch sits at the leading edge immediately beneath the mode picker, outside the jar’s rich content.

The cumulative spending/money-in flow chart belongs above the transaction list in Activity, using the selected period and scope independently of Spending’s category/account exclusions. Omit it when both series are zero or contextual search is open. Keep the existing Spending / Activity chips as the only view navigation.


### Compact bill payment confirmation

Pay due opens a quiet filled summary inside the existing bill sheet, inspired by Lime’s payment approval layout. Show bill name, plain amount, due date, selected payment account, category, and recording date. Record payment is the primary action; Edit reveals amount, account and date controls while retaining the summary and budget checks. A missing or unavailable account exposes Choose account and prevents submission. Cancel returns to bill detail without saving. Preserve funding blocks, earmarked-money warnings, failure drafts and duplicate-submission protection. Keep the normal confirmation concise: omit explanatory payment disclaimers and routine Available / Earmarked / Free balance breakdowns. Only actionable funding and earmarked-money warnings appear when relevant.

### Savings funding and purchases

Savings category details offer Add, Spend, Take out, and More using the existing action toolbar. Spend opens the expense composer with the category and its holding account selected. Savings expenses must use that holding account and fit the live available balance.

Add uses a compact Target picker for savings held in Joined Account: Separate savings (default) or Shared contribution. Follow the existing anchored picker pattern: only option labels, a selected-row highlight, 44-point targets, no heading, helper paragraphs, or selection checkmark. Persist the target on both the funding and linked account-transfer records. Separate deposits never earn household contribution credit, including after the savings is spent. Reserve every positive savings balance held in the joint spending account from household cash, regardless of category owner or freeze state. Shared deposits retain contribution credit and join the percentage-based funding requirement. Monthly assigned totals include both kinds.

The savings funding endpoint links a durable operation ID, zero-value pending assignment, account transfer, and final assignment. Retrying resumes the same operation, including after reopening the sheet. Pending draft fields stay fixed until completion; failures remain visible. A server database lock serializes matching operations across instances. Linked assignments and transfers cannot be independently edited, deleted, or restored through generic editors; use Spend or Take out to move their money. Existing untagged transfers keep their legacy contribution classification; do not infer or migrate their purpose from descriptions.

### Undo savings deposits

Linked savings transfers expose **Undo deposit** in transaction details. The same action is available from the deposit row in category activity, including deposits funded without an account transfer. Show the selected deposit’s source and amount, ask for confirmation, preserve the selection on errors, and refresh balances, contributions, and activity after success. A retry resumes any incomplete undo. The server verifies the exact linked records, checks the category’s current available amount and the holding account’s current cash before changing either side, and blocks undoing used funds. An undone assignment is kept as an invisible zero-valued tombstone; its transfer is archived. Late funding retries cannot recreate it. Generic independent editing/deletion stays blocked for linked records. Older unlinked transfers offer Delete transfer with a confirmation that assignments stay unchanged; validate the receiving account/category balance before deletion. Their independent assignment can be removed through the existing funding editor.

- **Spending pattern:** Categories stores an optional Notion Select named **Spending pattern** with Everyday, Scheduled, Flexible, and Goal. Category create/edit reuses the existing ChoicePicker, following [Mobbin select guidance](https://mobbin.com/glossary/select), with **Not set** for an empty value. Saving updates Notion; unclassified categories remain unclassified, with no silent inference from names or history. Everyday enables pace warnings; Scheduled continues to use unpaid bill schedules, Flexible shows its available balance without pace warnings, and Goal uses the existing savings goal/date controls. The pattern does not create bills or savings targets automatically.

- **Running low:** only explicitly Everyday categories qualify. Use the complete rolling 28-day ledger, live Available after rebalancing, and net spending per calendar day across that window. Include previous-month history so warnings can work at month start. Require spending on at least three distinct dates spanning a week and activity within the last seven days. Exclude savings types, frozen/archived categories, and unknown balances. Warn only when the estimated runway is under seven days and more than two days short of month-end. Empty Everyday categories also qualify. Home and Budget reuse one contextual [Mobbin banner](https://mobbin.com/glossary/banner) with a short category title, approximate days left, and **Rebalance**; no explanatory paragraph or duplicated category list. Multiple risks use a count and name the category running out first. Budget’s existing category row shows the approximate runway in amber and sorts it with the existing attention-first order. Hide predictions during loading/errors, when the rolling-window read fails, and for other selected months. Rebalancing remains an explicit user action; projections do not change assignments, over-budget reporting, or stored money.


## Confirmed monthly contributions and repayment advances

- The agreement, ledger and cash answer different questions. The agreement preserves intent; contributions and repayments rebuild from transactions; the recorded account balance remains live. Never replace recorded cash with an amount supplied in conversation.
- The first shared-plan save explicitly confirms the proposed contributions. Personal-only planning does not confirm a zero shared target. Later category-plan saves preserve the agreement; **Change agreed amounts** is a separate explicit action. Revisions preserve original amounts and confirmation time. Existing plans without an agreement offer **Set monthly contributions**.
- Home and account details use one flat, 44-point disclosure row: **Joined owes you** in personal scope or **Owed to you both** in Joint. Its value opens the existing modal bottom-sheet shell. The Home jar still represents contribution progress; ordinary repayment values do not become badges or another hero.
- The contribution sheet uses the shared MonthPicker, plain label/value rows, Money, semantic tokens, and the existing font and spacing system. Original contribution, contributed and above-original remain accessible after the contribution is paid, through the partner row’s disclosure. Current outstanding repayments remain distinct from historical excess.
- Pattern evidence: [Mobbin stacked list](https://mobbin.com/glossary/stacked-list) supports concise single-column financial rows without per-row cards; [Mobbin bottom sheet](https://mobbin.com/glossary/bottom-sheet) supports this focused contextual review and repayment action. These patterns inherit our existing components.
- **Reserved for repayments** is an obligation, not cash or an expense. Deduct it once from Joined's unassigned planning capacity, preserving negative capacity so new funding covers the shortfall first. Planning lists the originating month and total reserved before new allocations. Cash shortfalls are explicitly based on recorded cash and exclude other commitments.
- **Record repayment** records a transfer only after money has moved. The transfer pays the oldest outstanding advance for that person first, reduces cash normally, and never reduces the new month's contribution. Partial repayments and transaction deletion/restoration rebuild outstanding amounts. An over-repayment caused by subsequent corrections is an actionable warning, never a negative debt.
- Agreement or history read failures keep planning unavailable; they must never appear as zero debt or settled. Full-history reads allow the server's bounded pagination time instead of repeatedly aborting and duplicating requests.
- October 2026 starts from the user-confirmed original amounts: Anas 11,638.25 MAD and Salma 6,266.75 MAD. These are stored household data, never a hardcoded default in the calculation or UI.


## Desktop dashboard composition

- User direction (31 October 2026): the supplied Delibix dashboard establishes a wide balance panel, adjacent monthly context and a compact lower row; the supplied Spotbank reference establishes a narrow icon navigation rail. Use their composition with our own components, colors, typography and financial facts. Do not introduce their branding, promotional content, foreign currencies, rewards or accounts.
- From 900px, place the application in a neutral desktop frame, at most 1440px wide, with a 24px outer inset and 32px outer corners. The frame is a documented shape exception; internal surfaces keep the shared 16px content radius. An 80px left rail replaces the previous 220px text sidebar.
- Keep the global scope picker in the header. The desktop heading names scope and destination. The header aligns exactly with the page content, without mobile negative side margins, and leaves a 32px gap before every destination. The rail holds Home, Budget and Reflect. Its Actions group holds Add transaction, contextual Search, Rebalance, balance checks and Settings. Add transaction is the primary ink-filled action. Every icon keeps its accessible name, 44px target, active state, focus ring and hover/focus label.
- Home leads with the existing wallet balance and jar family inside a wide cash surface. The contribution disclosure stays with that balance. A quieter adjacent surface shows monthly spending, assignments and live category availability. Cash and budget values never substitute for one another.
- Unresolved balance counts, repayment obligations, low funds and planning actions remain visible before lower-priority activity. The discrepancy is not dismissed or reconciled by changing the layout.
- Home uses one shared page grid. At 1200px and wider, Balance spans the two left tracks, with Due bills then Recent activity beneath it. Monthly budget spans the two right tracks, with Top spending directly underneath. The lower-left pair ends at the same edge as Balance; the right-side cards share both edges. Cash verification and urgent bill actions lead, recent activity supports checking changes, and monthly planning stays beside its spending insights. At intermediate desktop widths, omit Top spending and align Bills/Recent directly with the two top columns. Lists stay flat inside each section; no per-transaction or per-bill cards. Long names wrap, values retain tabular numerals, empty/error states remain explicit, and the DOM follows the visual reading order.
- Below 900px, the desktop-only sections, title, add action and brand are hidden; the established mobile scope header, jar overview and bottom navigation keep their existing arrangement. Docked inspectors collapse the remaining content rather than overlapping it; modal centers include the frame offset and rail width.

### Desktop consistency and contextual tasks

- Home, Budget and Reflect share the same content edges, 24px section gaps, 24px surface padding and shared card radius. Budget retains its category table; Reflect uses one compact desktop toolbar for period, filters and Spending / Activity, without a duplicate page title. Below 900px, retain the existing mobile headings and toolbar order.
- Desktop contextual notices belong inside the object they qualify. Balance discrepancies and balance-check refresh errors sit inside Home’s balance card; low funds, unassigned cash and planning sit with the monthly budget summary. Budget’s shortfall, low-funds, unassigned and contribution prompts sit with its allocated total. Use plain rows on the parent surface, semantic ink and 44px text actions, without another tinted rectangle. A one-banner recommendation does not imply a full-width layout. Multiple unresolved issues remain reviewable. [Mobbin banner guidance](https://mobbin.com/glossary/banner) supports prioritizing prominent notices and using ordinary sections for persistent content.
- Due bills uses the same surface for the list and its parent card. Swipe rows receive the desktop surface through a scoped token; mobile keeps its canvas background. Never suggest a separate hierarchy with a darker nested rectangle.
- Sidebar actions open centered desktop dialogs for focused tasks such as recording a transaction, choosing an account or editing preferences. The shared responsive shell retains mobile bottom sheets, removes mobile handles on desktop, normalizes all four dialog corners and constrains panel height to the viewport. Desktop modal Tab / Shift-Tab stays inside the topmost dialog; Escape closes that dialog and returns focus. Non-modal category inspectors remain docked on wide screens; the planning workspace retains its wider centered layout.
- Pattern evidence: [Mobbin dialog](https://mobbin.com/glossary/dialog) describes a focused modal task, commonly centered; [Mobbin bottom sheet](https://mobbin.com/glossary/bottom-sheet) describes contextual mobile content. These are pattern choices, not a rule that every desktop task must be a dialog. Keep sustained planning in its wider workspace.
- Validation for this pass: TypeScript and production build checks; live browser inspection was blocked because the browser access host was unavailable and native browser inspection returned no usable window. Rendered visual acceptance remains pending.

- **Shared desktop notice variant:** Banner defaults non-blocking information, warnings and success notices to its unboxed desktop variant from 900px. Blocking alerts, errors and destructive confirmations retain a surfaced banner; explicit `desktopInline` overrides describe exceptions such as Budget’s contextual shortfall and a local balance-check read failure. Preserve roles, message content and recovery actions. Mobile keeps the established filled treatment and reading order. Home’s saved discrepancy remains visible during read failures, with a local Retry action; this never resolves or writes a financial difference.
- User-confirmed direction (31 October 2026): account-specific warnings should be compact rows within the balance card, and similar desktop notices should follow the same contextual treatment. Implementation checked with TypeScript and production build; browser host remains unavailable, so rendered verification is pending.

- **Saved balance counts awaiting review:** show an account-local “Confirm balance” row with “Saved count” and the amount. Review opens the existing balance-check form with that value as an editable draft; only explicit confirmation creates an active count. This is a normal review state, not a refresh error: omit Retry, technical storage/migration copy and alert announcements. Keep unconfirmed values out of actual-funds estimates.

- **Contribution review hierarchy:** lead with the scoped amount Joined still owes and one reserved-until-repaid note. Keep partner names, repayment amounts and Log repayment actions visible in compact flat rows. Expand a partner row for Original, Contributed, Above original and Repaid. Cash coverage shows an actionable shortfall even while collapsed; its ledger cash, reservation and multi-month breakdown are disclosed. Agreed amounts uses a separate disclosure when an agreement exists; first-time setup stays visible. Avoid repeating an outstanding amount as an above-original figure, a reserved total and a monthly total on the initial view. Follow [Mobbin accordion guidance](https://mobbin.com/glossary/accordion): disclose supporting detail, keep critical amounts, failures and actions visible.

- **Repayment split:** in Joint contribution review, place one horizontal stacked bar under the owed total, using the existing husband blue and wife pink tokens. Segment widths follow outstanding repayment amounts, not contribution percentages. Matching marks identify partner rows; amounts are shown once beside names with their record actions. The static bar has a text equivalent, no axes, percentages or extra legend, and disappears when nothing is owed. Personal scope keeps its own amount without a redundant one-part chart.

- **Repayment wording:** omit the redundant paid-contribution status when the target is fulfilled. Keep positive dues and unconfirmed amounts visible. “Log repayment…” opens an editable amount/date form; “Save repayment” records money already transferred from Joined. The opening action never saves immediately or executes a bank transfer.

- **Dashboard grid states:** flatten only structural Home wrappers on desktop so the same tracks govern both rows. Stretch the two overview cards to the first row’s height, while lower cards keep content-driven heights. At phone widths retain the existing single reading flow; with a docked inspector reset every card to one column. DOM and focus order follow the desktop row order: Balance, Monthly budget, Due bills, Recent activity, Top spending.

- **Repayment shortcut:** use the existing Lucide receipt icon in a 44px circular action beside each partner, retaining “Log repayment to [name]” as the accessible name and hover tooltip. Keep the action beside its amount on mobile too; its form explains the returned-money entry and explicit save.

- **Contribution breakdown access:** partner names and outstanding amounts are static text. A separate **View breakdown** disclosure beneath each row opens the supporting contribution history. Do not make the financial value itself an expand control; repayment retains its separate receipt action.


## Shared dialog anatomy and size families

- Desktop dialogs use named sizes from `ui/BottomSheet`: **compact** 440px for confirmations and short choices, **standard** 520px for ordinary forms, contribution review, settings and detail lists. Account review uses **account** 900px and the monthly planning workspace uses **planning** 1200px. Avoid per-screen widths between these families.
- Ordinary desktop dialogs follow content height. Use `desktopHeight="fill"` explicitly for the transaction composer, category activity, long Reflect lists and planning workspaces that require a bounded scrolling region. All remain within a 24px viewport inset. Mobile detents, safe areas and docked inspectors keep their existing behavior.
- `SheetBody`, `SheetHeader`, and `SheetFooter` in `ui/SheetLayout` share desktop chrome: 24px body inset and section gap, 20px/28px semibold title, 44px close target, 12px action gap. Class-based forms use the same anatomy classes without adding wrappers. Split workspaces apply the same inset to their header and controls. Task content, amounts and nested form spacing remain distinct from chrome.
- Anchored `PickerPopover` remains a separate interaction, with named **menu** 280px, **choice** 320px and **calendar** 304px widths. All use a 16px viewport gutter and retain trigger anchoring, keyboard navigation and calendar anatomy. They do not inherit modal dialog headers or padding.
- Pattern evidence: the existing Mobbin Dialog and Bottom Sheet glossary entries support the responsive shell and task-dependent workspace exceptions. Code-level verification covers types and the production build; rendered desktop/mobile comparison is still required when browser access is available.

- **Home planning action:** when the monthly planning reminder is visible, it owns the planning action. Hide the duplicate action in the monthly budget header; restore that header action when no planning reminder is shown. Both use the existing planning destination.

- **Home monthly budget density:** the month heading supplies time context; use Spent, Assigned, Available, and Above assigned. Accessible labels preserve that Available means category funds and Above assigned compares spending with assignments. This panel uses `Money subtleDecimals` to show exact cents smaller and muted, without rounding values or adding a gap before the decimal separator. Other money displays retain their existing treatment.

- **Semantic amount colors:** smaller decimals inherit the warning/danger color for colored financial amounts. Reserve muted gray decimals for neutral amounts; never split a warning amount between red whole units and gray cents. `Money` supports this through `--money-decimal-color`.

- **Desktop mascot captions:** Home reserves 96px on each side of the mascot family for bounded side captions, growing to 112px with the larger composition. Never rely on overflow into the neighboring budget card. The balance card uses its own available width to choose a stacked composition below 620px or a larger side-by-side mascot group above it. Phone mascot geometry stays unchanged.

- **Monthly budget comparison:** replace the solid warning line and repeated fact rows with one horizontal spending-versus-assignment bar. Above assignment, the neutral segment equals assigned funds and the red segment equals the excess, scaled against total spending; labels directly below show Assigned and Above assigned. Below assignment, neutral spending fills the assignment track proportionally. Zero values render an empty track. Keep live category availability on a separate quieter line because it is not the arithmetic remainder of these monthly totals. The accessible chart label states exact amounts without relying on color.

- **Compact desktop monthly context:** title the card October spending (using its actual month) and omit the redundant Spent label. Put the assigned amount with an inline assigned label beneath the neutral boundary, and a signed red excess beneath the red segment; the accessible definition retains Above assigned. Show only Available for category availability, with its full accessible label. Replace desktop planning banners with a single Plan/Resume [month] action; phone reminders and unrelated funding warnings retain their information.

- **Spending total status:** the Home monthly spending total uses danger color, including smaller decimals, only when spending exceeds monthly assignments. Within assignments, the total remains neutral. The bar and signed excess preserve the same status without relying on color alone.

- **Home card surfaces:** monthly spending uses the same `--surface` and `--elevation-card` as Balance and the lower cards, in both themes. Separate the sections through layout rather than a gray fill. Outstanding repayments remain with Balance because they are carried account obligations, not extra monthly spending.

- **Desktop primary action placement:** Add transaction occupies its own primary action slot immediately below the rail brand and before Home/Budget/Reflect. Search, Rebalance, balance checks and Settings stay in the lower utility group. The DOM and keyboard order match the visual order; mobile navigation remains unchanged.
- **Repayment visibility:** a positive repayment obligation remains visible as one compact label/value row with no redundant month subtitle. Do not hide the outstanding amount behind a mascot tap; its breakdown and month remain in Contributions.

- **Dashboard card headers:** Due bills, Recent activity, Top spending and the monthly spending card reuse `ui/CardHeader`. Desktop titles are 16px/24px semibold and share a 44px header baseline. Header navigation uses `CardHeaderAction`: muted 13px text, 16px Lucide chevron, 4px gap, 44px target, consistent hover/pressed/disabled/focus states. Preserve descriptive labels such as All bills and All activity. Mobile sections retain their existing typography through the same component.

- **Balance obligation placement:** Home nests the Contributions entry directly beneath the balance in its number group. On desktop it is a compact, content-width action: muted 13px label beside a 15px amount and chevron, with 12px separation from the main balance. It no longer spans the card as a detached full-width row. Keep balance-check notices in their separate account action area. The same Contributions destination and financial data are retained.

- **Home summary alignment:** Balance uses the same CardHeader as monthly spending, giving both a shared 44px heading row and 16px gap before their amounts. Left-align the balance heading, amount/currency and repayment action as one group at every desktop width. Place that group first in the narrow desktop composition; keep mascots adjacent when the balance card is wide enough. Spending content follows fixed section gaps rather than distributing spare height between its numbers.

- **Monthly spending scope:** do not display live category Available balances in the monthly spending card. Its figures are only spending, monthly assignments and their excess. Category balances remain in Budget; they are not new-month funding, cash, or capacity after repayment reserves.

- **Monthly context vertical rhythm:** the spending section must not flex-grow to consume the card height. Keep its heading, amount and comparison together, with 16px section gaps and 8px from bar to its labels. Contextual warnings follow after 16px; any spare height from matching the Balance card stays below the content rather than between financial figures and actions.

- **Spending card height:** top-align the monthly spending card and let its content determine its height. Do not stretch it to match Balance; preserve the shared grid column edges and lower-row alignment without padding the card with empty space.


## Desktop dashboard row contract

- Supersedes the earlier content-height exception: use one equal-height summary row and one equal-height detail row. Both summary cards stretch to the row's content-driven height with a shared 320px minimum. Keep content grouped at the top; do not distribute spare height between values.
- Due bills, Recent activity and Top spending use a shared 420px desktop detail height. Show the existing three due bills, five recent transactions and four spending categories; longer content scrolls within the panel, with its header/action retained. Preserve the full All bills and All activity destinations.
- Loading and empty states occupy the same panel footprint. The separate legacy Upcoming bills rail is omitted on desktop when the due-bills panel is present. Below 900px the existing content-height phone layout remains in use.
- Basis: Anas's supplied Delibix desktop reference establishes aligned two-card and three-card rows. This is a product composition choice, not a claim that every dashboard needs equal cards. Fresh Mobbin search was blocked by its paid-plan requirement; Pinterest candidates have not been visually reviewed.


## Desktop Budget workspace composition

- At 1100px and wider, Budget uses a content-height left summary and a larger right category workspace, roughly one-third to two-thirds. Summary and category controls align at the top; do not stretch the summary down the category list.
- Center the existing mascot family above Allocated and its larger amount. Use Home's semantic surface, shared card radius/elevation, 24px inset/gutters, muted 13px secondary label and 48–64px regular-weight number with the shared currency mark. Amount semantics and the existing mascot tap behavior stay intact.
- Stack contextual notices below the summary, with the relevant action on its own nearby 44px row. Month/planning controls, loading/error states and all active/frozen category groups belong to the wider workspace. Search stays above both columns.
- From 900–1099px and with a docked inspector, stack the summary and category workspace. Below 900px the workspace wrapper is display:contents, preserving the existing mobile flow. Home's equal-height overview row remains specific to its dashboard; Budget's unequal columns support its different primary task.

- In the narrow Budget summary, partner tap captions appear beneath their jars within the card, reserving room only while open. The category workspace adjusts its shared numeric-column width to its own available width so labels and values keep the same tracks.


## Interface craft verification

- Use the single [Interface Craft skill](/Users/anassaidi/.codex/skills/interface-craft/SKILL.md) for a bounded audit and repair pass. Its rule IDs provide review references; this document remains the product's visual authority. Article font lists, a single radius and decorative animation are not requirements.
- `--warning-ink` owns readable warning text independently of the brighter warning fill. Light uses #8a5700; dark uses #f2c14e. Banner uses that token for both flat and surfaced warnings. Calculated contrast on the current light surface is 6.10:1 flat and 5.88:1 tinted; dark is 10.64:1 flat and 9.56:1 tinted. Recheck if those surfaces change.
- The form-mode transaction composer uses a semantic h2 so shared desktop dialog typography applies (20px/28px, semibold). Its phone title retains its existing size. Typed entry retains its date control.
- CardHeaderAction has a minimum 44px target in both dimensions, including short Plan actions.
- Test-run evidence and remaining gaps: [desktop review](docs/interface-craft-review-2026-11-01.md). Desktop light rendering, title semantics, Tab/Shift-Tab between Close and Expense, and Escape dismissal were inspected. Escape returned accessibility focus to the page rather than the trigger; this remains unresolved. Dark palette contrast was calculated; dark and phone rendering remain unverified.


### Interface craft follow-up

- **IC-08 dialog focus:** the shared sheet retains the external opener across portal mounting, returns focus on the next animation frame, and ignores body or panel descendants when capturing it. The transaction amount no longer competes with the shell through autofocus. Desktop sidebar Add and Reflect's contextual action focus their trigger before opening. Closing should return to that exact trigger; Enter should reopen it.
- **IC-11 slow reads:** after 10 seconds of pending financial reads, show a quiet status with a 44px Retry loading action. Keep verified balances visible. Retry aborts pending read requests and clears coalesced promises before starting fresh reads; it does not cancel or repeat mutations. Existing request generations protect against older responses, and superseded initial loads do not overwrite the new load's status. Preserve the existing 30-second ordinary and 180-second fully paginated monthly timeouts.
- **IC-07 scope discovery:** from 900px, show Anas, Joint and Salma beside the existing mascots, with a neutral selected surface and stronger label weight. Phone remains mascot-only. This is an explicit desktop exception to earlier icon-only scope guidance, authorized by the follow-up request.
- **IC-01, IC-11 Reflect recovery:** a genuinely empty spending view offers Add expense beside its empty-state message, opening the existing expense form. Filtered no-results retains Reset filters instead. It inherits the active scope and keeps the viewed period while the transaction date remains the form's editable date.


## Category artwork: Thiings first pass

- Web category displays use bundled transparent Thiings illustrations, 256px WebP assets in public/category-icons. Lucide remains the structural icon family; the jar shapes, liquid status colors and ownership mascots remain unchanged. Images do not replace financial status labels.
- lib/category-icons.ts owns normalized category-name matches, legacy emoji aliases and the neutral receipt image fallback. All 91 records in the reviewed category catalog have deliberate name mappings, including frozen and archived records. Images sharing a category name may share an asset; no identifier is inferred from money or account ownership.
- CategoryIcon owns image sizing, decorative/accessibility behavior and image-error fallback. Its explicit account variant keeps existing account emoji. Category images also render in SVG jars, including animated spending/planning contents, without changing their sizes by amount or physics.
- Budget row artwork occupies 68% of the jar's usable height and stays fully opaque; the jar's background/liquid communicates empty and unfunded states. This keeps the more detailed images readable.
- Transactions, category pickers, details, allocation/planning, savings and spending breakdowns share the same resolver. ChoicePicker supports an image as option metadata while keeping its text searchable.
- New/edit category forms preview artwork matched to the entered name. Manual image selection is not implemented in this pass. The underlying Notion emoji stays unchanged, including on ordinary metadata edits; no Notion page icons or financial records were migrated. The native Swift app is outside this web presentation pass.
- Provenance and selected source URLs live in public/category-icons/attribution.json. These 56 assets total 621,084 bytes. Free personal/non-commercial use requires visible attribution, provided by the Category images by Thiings link in Settings. A commercial release requires the appropriate Thiings license.
- Verification and the proposed persistent picker flow: docs/thiings-category-icons.md.


## Saved-plan receipt

- After Month plan successfully saves its allocations, replace the editor content with the Printed keepsake confirmation inside the same responsive BottomSheet. Done closes it; Back to plan returns to the saved editor without submitting again. Reopening the planner starts in the editor.
- The receipt snapshots the submitted month's entire catalog across wallets, including unchanged saved/frozen allocations. Show the four largest positive planned categories, the remainder as one subtotal, exact total planned and each nonzero wallet's planned total. Clearing the final allocation produces a zero-total receipt. These are planned allocations, never spending, contributions paid or advances repaid.
- Include an **Agreed contributions** section with Anas and Salma’s exact targets from the existing agreement or the newly confirmed server response. Snapshot these values independently of wallet allocations; Joint cash can cover part of the plan, so contributions need not equal the joint allocation. These are agreed targets, not amounts already paid. Failed confirmation never displays proposed targets as agreed.
- The receipt is an intentional monospace/paper exception. Its private receipt-paper/ink/muted/rule tokens own the light and dark treatment; shared Money and primary controls preserve number precision, currency and interface conventions. It is text-only. The narrow paper and serrated edge express the accepted printed concept without adding category artwork.
- Print once on each successful save with a 900ms transform through a clipped slot. Controls are usable immediately. Reduce Motion replaces travel with a 120ms fade. Compact spacing and conditional owner labels keep a single-wallet receipt within a typical phone viewport; longer mixed-wallet plans and warnings scroll.
- Failed plan writes preserve the draft and existing error state without a receipt. A contribution-agreement failure after a successful plan write shows the receipt with an actionable warning; Set monthly contributions returns to the editor. A dismissed save cannot overwrite a newly opened month's draft. A ref lock prevents duplicate submission before React paints the busy state.
- Focus enters Plan saved, Back to plan restores focus to the editor panel, and dismissal retains the original shared-sheet opener. No extra Plan saved toast competes with the confirmation.
- This is an in-session save confirmation. Persistent settled-month receipts, signatures, history and export remain separate roadmap work. Verification: docs/month-plan-receipt-review.md.

- **Month plan review:** the pre-save review uses MonthPlanReview with the editor's plan-table rows, 32px CategoryIcon, category typography (owner subtitles only when the review spans multiple wallets), tabular Money columns and the existing outlined Edit plan control with a 44px target. Review columns remain Saved/New plan; only the post-save receipt uses paper/monospace. Entering review focuses its heading; Edit plan restores the changed field or editor panel.


## Month plan modal isolation

- Opening Month plan copies the app-wide wallet into a local planning selection. Switching Joint/Anas/Salma inside the planner updates only that session; it never writes the page's scope, html[data-scope] or the saved app-wide preference. Reopening starts from the main page's current wallet. Drafts still survive wallet changes inside the same plan, and Save still submits changes across wallets.
- Planner selection colors resolve under data-plan-scope on its own content, using existing ownership tokens. The picker is labeled Monthly plan wallet. Phone includes this local picker inside the sheet.
- Month plan and its saved receipt opt into BottomSheet lockBackground. The full-viewport backdrop covers the phone header; the app-shell-root is inert until the last locking modal closes; Tab stays within the modal on desktop and phone. The page retains its existing scroll lock. Dismissal restores its original interactivity and focus. Other sheets retain their established presentation.


## Screen-specific loading recovery

- The ten-second loading recovery follows the visible screen. Reflect/Activity uses historyLoading; hidden Home bills/monthly planning requests do not show Retry loading on Activity. Budget follows its monthly data and budget refresh. Initial essential reads retain the global recovery. Changing screens resets the delay.
- Retrying Reflect restarts only the selected period's history requests, clears its reusable monthly snapshot and keeps Home/account requests running. Both the slow-read action and Reflect's error action use this recovery. A Home retry retains its full-load behavior.
- Activity reads transactions directly unless a completed matching monthly response is already available. It does not wait for the funds query needed by the Spending comparison. Changing between Activity and Spending loads the data required by that view. Home's background updating indicator is omitted on Reflect; genuine refresh errors remain visible.


## Local month-plan drafts and partner remainders

- Save draft writes allocation changes to localStorage, then closes Month plan with a browser-only confirmation. It never calls the allocation or agreement mutation endpoints. Drafts are separated by signed-in partner and month; all wallet edits in that planning session share one draft. They can be over capacity. Desktop unfinished amount expressions retain their last valid numeric amount and expression.
- Opening that month reads the latest saved plan first, then restores the local draft and its selected wallet. Browser draft restored and Discard draft identify the local state. Drafts preserve explicit zero allocations and cents. Invalid/corrupt drafts produce a notice while the actual saved plan stays available. Browser storage errors remain actionable and do not report success.
- Store the saved baseline with each edited amount. If allocations changed since the draft, show a review warning; unavailable categories are excluded with a notice. The existing review compares draft amounts against the latest saved allocations. Confirmed final allocation saving removes the unchanged stored draft; a newer draft from another tab is preserved. A failed final save retains the draft. Freezing categories and explicitly editing contribution agreements retain their existing immediate, separately confirmed behavior.
- Remaining to assign uses capacity.left for Anas and Salma, after their personal allocations, required Joint contributions and existing capacity reserves. Never substitute their pre-contribution capacity or clamp away a shortfall. Joint view shows both partners; a personal view uses its main amount for that person and shows the other partner below, avoiding repetition. Zero remains visible, cents stay exact, and a deficit says short in danger color. Desktop uses flat summary rows; phone uses two compact columns above the save actions.

## Home contribution entry

- Home omits the generic Monthly contributions disclosure beneath the balance. Outstanding advances retain their compact amount and existing Contributions destination.
- In the Home summary, each partner’s remaining monthly contribution is a tappable fact opening Contributions, using the existing text-button interaction and accessible hit area. Suppress these facts while monthly data is loading or unavailable. Fully contributed months add no summary prompt; Contributions remains accessible from account details.
- This uses the low-emphasis text-button behavior in [Mobbin button guidance](https://mobbin.com/glossary/button), preserving the balance as the main financial number.

## Budget category artwork and row spacing

- Budget rows use uncontained 60px category artwork instead of miniature jar bubbles. Budget artwork fades from full opacity to 60% as available funds drain; savings gains opacity as its goal fills. Unfunded artwork remains recognizable and the whole row stays interactive. Other mascots retain their existing jar metaphor.
- Overspent artwork stays fully opaque with a restrained 30% semantic red tint. The negative amount and Overspent text remain explicit, so color is never the only signal.
- Amounts have a 24px trailing inset in every Budget group, with matching desktop column headers. Group add actions say **Add**; accessible labels retain the destination section.
- These remain standard [stacked list rows](https://mobbin.com/glossary/stacked-list), with artwork identifying the category and a single row action opening its details.

## Readable text

Adapt [Shreya Shankar's five principles](https://fsdatalab.github.io/blog/agent-text-at-scale/) to product copy: lead with the useful fact, use direct sentences, repeat structure and vocabulary for comparable facts, vary presentation only for meaningful differences, and choose verbs that match the actual state.

- Home keeps financial summary clauses short and parallel: **Joined Account** is **134 off**, **Anas** has **13.408 due** and **Salma** has **3.406 due**. Due means the remaining monthly contribution here, never a repayable advance. Accessible labels name contributions, destination, currency, and the balance-check action in full.
- Remove conversational padding such as “has … left to put in.” Preserve account identity, each partner's amount, and existing tap actions. Do not abbreviate names or substitute a debt label for a contribution.

## Single hero and balance-check entry

- Home and Budget retain one main mascot. The fill still represents monthly budget remaining; partner contribution progress belongs in the summary and Contributions. The planner also keeps one main mascot with its remaining-amount rows.
- Restore the original soft mascot material and scope colors. The user rejected both the hard split and the flat warm-ochre treatment. Do not carry either forward as the accepted design direction. Keep the prior material, facial expressions, level animation and reduced-motion behavior.
- Routine checks live under **Settings → Accounts → account → Check balance** on phone and desktop. Home has no routine balance-check button or empty spacer. A discrepancy remains tappable in the summary, opening that account’s existing check flow. Balance-check failures keep their Retry action; paused checks keep their reason without an ineffective retry.
- Use Couple Finance consistently for web identity and install metadata. Preserve the shortened copy, category artwork and 24px amount inset.

## Shared primary screen hero

Home, Budget and Reflect use `ui/ScreenHero.tsx` and `ui/screen-hero.css`. This supersedes their older per-screen amount sizes, enlarged Reflect mascot, Home desktop mascot zoom and number-first desktop exceptions.

| Block | Shared rule |
| --- | --- |
| Mascot | 250 × 250px frame, owned by `SCREEN_HERO_MASCOT_SIZE`; same default used by `MascotHero`. The visible artwork sits inside this frame. No screen-specific zoom or negative image margins. |
| Main amount | Centered on mobile and desktop. `clamp(44px, 14vw, 72px)`, regular weight, −0.022em tracking, tabular numerals. Same size at the same viewport; shrink only if the actual value exceeds its available width. Preserve cents when supplied. |
| Metric label | 13px / 20px, semibold, muted. Balance, Allocated and Spent share the same heading role and spacing. |
| Narrative summary | Shared `Summary` and `Fact`, 18px / 1.4, centered on mobile and left aligned on desktop, without a per-screen width cap. |
| Spacing | 16px between major blocks, 8px within the label/amount group, 16px top and 24px bottom padding. The mascot frame's 8px bottom compensation accounts for the artwork's transparent margin. |
| Actions | Separate shared slot beneath the summary, 12px between actions. Routine Budget notices use tappable summary facts; genuine errors retain their recovery control. |

- Keep the order mascot → metric → summary → actions on narrow and wide screens. Desktop cards and workspace columns remain screen-specific; internal hero geometry does not change.
- Reflect’s period picker and icon-only filter share one row below the summary. Spending/Activity uses `ScreenChip` controls at the top of the existing 250px visual frame. Activity omits the duplicate main amount and uses a 312px chart frame, with 80px above the 220px chart and 12px below it. Leading-aligned view chips sit directly beneath the mode picker and keep the same top position in both views. Spending retains its 250px mascot and metric positions. Activity places a factual money-in-versus-spending summary directly under the chart. The same hero and control slots remain mounted through transaction loading, errors, empty results and view changes. The view chips use the clear top of the visual frame, without adding a row above the hero. Optional work-time text also follows the summary, so it cannot shift the summary baseline. Reflect and Budget place their controls in the shared `ScreenToolbar` after the hero and use the same calendar pill trigger (`composer-picker-chip`, no chevron); Reflect retains its range-selection dialog. The filter keeps an accessible label and active-state tint. Screen-specific tabs and supporting information remain optional slots or surrounding controls. Reserve two lines for the summary even when no notice exists; allow longer summaries to grow without clipping. Do not reserve empty action controls.
- The number row reserves 1.2em height. Long values fit their container on mount, resize and font load. All heroes start at the real value; integer changes may use the existing counter, while decimal values preserve their exact formatting.
- Keep the existing mascot illustration, data meaning, tap destinations, financial scope, warnings and loading/error behavior. This component standardizes presentation; it does not make cash, allocation and spending interchangeable.

## Primary screen layout patterns

- **Hero:** Home, Budget and Reflect start at the same content origin with a 250px mascot frame, centered amount and shared summary baseline. Reserve two summary lines; allow extra content to expand. Budget has no separate screen entrance animation.
- **Context toolbar:** `ui/ScreenLayout.tsx` owns the 44px minimum control row below the hero. Budget supplies month/planning; Reflect supplies period/filter. Home has no period control and does not receive a placeholder toolbar. Financial notices retain their existing destinations.
- **Content:** use a 24px region gap, 44px section-header interaction height, 8px header-to-content gap, and consistent 13px semibold headings. Budget keeps collapsible category groups, Home keeps bills/activity previews, Reflect keeps view chips inside its visual frame. Row content retains its financial meaning.
- **State:** `ScreenLoadingSkeleton` reserves hero and optional toolbar regions for startup/lazy loading. Budget keeps its hero and toolbar for loading, month errors, no categories and no search matches. Reflect keeps its overview and view chips mounted while results load or change. Independent Home sections retain independent loading and recovery behavior.
- **Desktop:** overview and content use common 2:3 columns with a 280px minimum overview width, shared 24px panel padding and gaps. Existing inspector layouts may stack those columns. Home’s supporting sections retain their own content and order.

Primary amounts use `AmountSkeleton` for the shared shimmer treatment when unknown during loading. Reflect and Budget pass the explicit `loading` prop to `ScreenHero`; unavailable/error values retain the dash. The initial screen skeleton reuses `AmountSkeleton`.

Activity summary compares the last cumulative flow point, preserving cents. It handles spending above money in, money in above spending, equal totals, and zero activity. It does not describe money in as income or the difference as available cash.

## Forgotten Joint allocations

Joint category Fund uses **Add to plan** when a saved contribution agreement exists. Preview the extra allocation and contribution increases using the existing split; confirm both in one action. Keep a checkbox for funding with existing money without revising agreed amounts. Original agreements and actual contributions remain recorded. Pending additions retain their operation ID across retries and reloads. See docs/plan-additions.md for recovery behavior.

On mobile, the scope picker anchors the header's left edge and screen actions remain grouped on the right. Reflect's view chips align at the top-right of the content region without shifting its mascot/metric blocks. Do not invent a left action just to balance the header.

## Mobile header ownership

The app header uses two CSS-owned columns on mobile: the budget picker on the left, screen actions then Settings on the right. Remove the former inline three-column template. Keep Settings at the far-right position on Home, Budget and Reflect; Budget’s Rebalance action lives in the context toolbar beside month/planning controls.

The phone picker is an unframed 132×48px group with three separate 44px touch targets. Keep the original static artwork: 32px for the selected mascot and 22px for the alternatives, which sit 4px higher at 80% opacity. Selection rotates that scope into the foreground in 220ms using transform/opacity without bounce. No idle animation. Reduced motion changes state immediately. Desktop retains its labeled picker.

Local development uses `NEXT_BUILD_DIR=.next-local` so production builds in `.next` cannot replace its chunks. The preview returned HTTP 200 after restart. This header change passed TypeScript and whitespace checks; internal-browser automation remains unavailable, so rendered mobile/desktop acceptance is unverified.

## Approved light unslop pass

Scope: Home, Budget and Reflect, preserving accepted layout and mascot identity. Use readable semantic secondary text in summaries, 500 for ordinary facts and 600 for actionable/status facts; category names use 500 and amounts 600. Reflect leads with budget exceptions, then concentration and period health; shorten filler without changing dates, scope or calculations. Keep all financial destinations and full accessible labels.

One shared desktop composition block owns the 2:3 overview/content columns. Remove earlier superseded grid placements rather than adding further overrides. Preserve inspector stacking, hero frame sizes and all header/toolbar decisions. No new artwork, font, palette, layout model or financial behavior is introduced.

Method: unslop by Damir Sokolovsky (https://github.com/heydamir/unslop), CC BY 4.0. See docs/unslop-audit-2026-11-02.md for evidence and verification limits.

## Focused hero polish

Keep the approved 250px mascot artwork/frame and centered mobile summaries. Align the numerical digits with the mascot centerline; mirror the measured currency width as empty space on the left and retain the visible `MAD` on the right. Account for both gutters when fitting long numbers. Preserve all signs, cents, integer-change animation and accessible currency text. The hero currency mark uses the existing semantic muted color at full opacity so its small type retains readable contrast.

`ui/hero-tokens.ts` owns the 250px mascot frame and Activity's 312px frame, 220px chart and 80px top inset. Activity has no duplicate main amount. Its loading state uses the same chart slot and a chart-shaped skeleton; Spending retains the mascot skeleton. Shared summary space owns its height, with no extra Reflect-only wrapper. Hero taps preserve their existing behavior and feedback without a decorative hover lift; keyboard focus remains visible.

Direction remains the approved light unslop direction: household budgeting; warm, exact and unhurried; shared money jars on neutral surfaces; mascot waterline and spending chart as the rich moments; blue, Joint heart and pink as the signature. No financial calculations, palette, art or navigation changes.

Confirmed balance-check saves apply the server's returned check and version immediately and release the save button. Refresh other checks in the background; a slow or failed refresh never leaves a confirmed save labeled “Saving…” or reports that save as failed. Ignore reads started before the acknowledgment so they cannot restore an older check. Keep the existing check sheet, draft preservation and conflict handling.


## Settings and summary details

Settings has one Accounts entry. Account details retain Check balance; Home discrepancy links can still open a check directly. Remove the separate account-check chooser, Work & income editor/conversions and Artwork section. Keep the free-license artwork attribution as a small footer link after Notion sync.

Summaries use the shared Fact action for an insight whose details are not already visible in the current chart/list. Underline these links quietly and keep descriptive category names/plain state text unlinked. Home and Budget exceptions retain their existing account, contribution, planning or Rebalance destinations. Reflect’s top-three concentration and within-budget state describe the ranked list directly below, so remain plain. Multiple over-budget categories open a focused review sheet with links to their existing transaction details. Activity’s totals already appear in the chart legend. Planner contribution dues open Contributions; bill totals select the corresponding Due or Overdue list. Do not turn an entire sentence into one large button or add empty drill-downs.
