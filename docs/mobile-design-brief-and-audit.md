# Mobile Design Brief And Audit

## Purpose

This document turns the video concepts into a practical mobile product brief, then audits the current `notion-expense` app against those rules.

The goal is not to copy the video literally. The goal is to preserve the product logic behind it:

- mobile navigation should stay simple
- actions should appear in context
- screens should have a single job
- cards and containers should not crowd the layout
- empty states should teach the interface
- motion and gestures should reinforce the mental model

## Part 1: Designer Brief

### 1. Global Navigation And Layout Rules

- Use a floating bottom navigation bar only if the app can be expressed in `3-5` primary destinations.
- If the app needs more than `5` top-level destinations, replace the bottom bar with a dedicated home screen that contains:
  recent activity, search, and links into the main areas.
- Every interactive target must be at least `44px` high and wide.
- Do not shrink typography for mobile. Mobile text and spacing should generally feel larger and easier to tap than desktop.
- Each section must commit to one dominant movement pattern:
  vertical stacking or horizontal scrolling, not both in the same section.

### 2. UI Building Blocks

- Build the interface mostly from:
  cards, text or links, images or icons, and inputs.
- Avoid extra wrappers whose only job is decoration.
- Do not nest cards inside cards unless there is a very strong semantic reason.
- Prefer whitespace, rhythm, and typography to create grouping.

### 3. Focus And Contextual Actions

- Follow the rule `one screen, one purpose`.
- The home screen may summarize multiple things, but task screens should stay focused.
- Persistent action bars should be minimal. Secondary actions should appear only when relevant.
- Use bottom sheets for secondary flows such as:
  pickers, creation menus, quick actions, and lightweight detail views.
- Avoid pushing users into extra pages when a sheet can preserve context.

### 4. Gestures And Motion

- Define the core gestures intentionally:
  swipe right to go back, swipe down to dismiss sheets, swipe up or tap search to search, long press for contextual actions.
- Motion should explain state changes.
- When a bottom sheet opens, the background should visibly recede.
- When a back gesture begins, the previous screen should feel physically connected to the current one.
- Long press should show clear focus on the selected item and de-emphasize the rest of the screen.

### 5. Empty States

- Design the first-run state, not only the fully populated state.
- New users should see one dominant action and a short explanation of what to do next.
- Search empty states should:
  confirm there are no results, suggest how to recover, and provide an obvious exit path.
- Empty states should teach the product instead of just saying nothing is here.

## Part 2: Current App Audit

## Anti-Patterns Verdict

Pass, with some caution.

The app does not read like generic AI slop. It has a clear light visual system, restrained use of color, deliberate bottom-sheet patterns, and a fairly specific finance-app tone. The main risk is not generic AI styling. The risk is that some screens are becoming over-composed, with extra panels, summaries, and decorative surfaces that push against the video's `one screen, one purpose` rule.

## Overall Impression

The current design already respects several of the video's strongest mobile ideas. The shell is mobile-first, bottom navigation is limited to three destinations, the add flow uses a sheet instead of a route change, and many controls are touch-sized.

Where it falls short is consistency. The home, planning, history, and category-detail experiences each add extra layers of summary, decoration, or embedded actions. That makes the app feel richer, but it also starts to dilute focus.

## What Is Working

- Navigation discipline is strong.
  The primary nav is only three items in [BottomNav.tsx](/abs/path/c:/Users/HP/Downloads/notion-expense_1/notion-expense/app/components/BottomNav.tsx), which fits the video's `3-5 icon` rule well.
- Secondary actions mostly stay in sheets.
  `AddTransactionSheet`, `PendingScreen`'s add sheet, and `CategoryDetailsSheet` all preserve context rather than sending the user through extra pages.
- Touch target sizing is mostly solid.
  Many interactive controls use `44px` or larger heights in [AddTransactionSheet.tsx](/abs/path/c:/Users/HP/Downloads/notion-expense_1/notion-expense/app/components/AddTransactionSheet.tsx), [PendingScreen.tsx](/abs/path/c:/Users/HP/Downloads/notion-expense_1/notion-expense/app/components/PendingScreen.tsx), and [MonthlyPlanningFlow.tsx](/abs/path/c:/Users/HP/Downloads/notion-expense_1/notion-expense/app/components/MonthlyPlanningFlow.tsx).
- Empty states exist in meaningful places.
  History and Pending both have designed empty states instead of blank screens.

## Priority Issues

### 1. Home screen is carrying too many jobs

**What**

The home tab is trying to be overview, planner entry point, category browser, category analytics, scope switcher, and quick-add launcher all at once.

**Why it matters**

This directly conflicts with the video's principle that non-home screens should do one thing, and even the home screen should act like a clear hub rather than a stack of competing surfaces. The result is good coverage but weaker scanability.

**Fix**

Reduce the home screen to two clear layers:

- a top summary and month context area
- a category list area

Move deeper category analytics into the category sheet only, and keep planning-related actions grouped into one obvious planning entry point rather than spreading them across the screen.

**Command**

`/distill`

### 2. Several buttons fall below the 44px touch target rule

**What**

Some buttons are explicitly shorter than the required minimum:

- `quickAddStyle.minHeight = 34` in [HomeScreen.tsx](/abs/path/c:/Users/HP/Downloads/notion-expense_1/notion-expense/app/components/HomeScreen.tsx)
- `addChipStyle.minHeight = 36` in [PendingScreen.tsx](/abs/path/c:/Users/HP/Downloads/notion-expense_1/notion-expense/app/components/PendingScreen.tsx)
- `topActionStyle.minHeight = 36` and `closeButtonStyle` at `36x36` in [CategoryDetailsSheet.tsx](/abs/path/c:/Users/HP/Downloads/notion-expense_1/notion-expense/app/components/CategoryDetailsSheet.tsx)

**Why it matters**

This is one of the clearest objective misses against the video rules. Small controls are harder to tap, especially in sheets and top bars where fingers and screen edges already create friction.

**Fix**

Raise all tappable controls to a hard minimum of `44x44`, even if the visual affordance inside stays smaller.

**Command**

`/harden`

### 3. Card density is drifting toward nested-surface behavior

**What**

The app avoids literal card-inside-card patterns in many places, but several screens recreate the same effect by stacking multiple strongly bordered or heavily surfaced blocks inside a larger surfaced container. The planning flow and category detail sheet are the clearest examples.

**Why it matters**

This creates the same visual compression the video warns about. Even without literal nested cards, the result is still `padding on padding`, reduced breathing room, and weaker hierarchy.

**Fix**

Flatten inner surfaces. Keep one dominant container per screen or sheet, then use dividers, whitespace, and type scale for grouping inside it.

**Command**

`/normalize`

### 4. Gesture design is only partially implemented

**What**

The app has swipe-to-delete interactions and sheet usage, but the broader gesture language from the brief is not consistently present:

- no visible swipe-down-to-dismiss behavior for sheets
- no mobile back-swipe spatial transition
- no long-press contextual action pattern
- no search reveal gesture

**Why it matters**

The video treats gestures as part of the product model, not as decoration. Right now the app uses some motion, but not yet a coherent gesture system.

**Fix**

Choose a small, repeatable gesture set and implement it consistently across sheets and list rows before adding more motion polish.

**Command**

`/animate`

### 5. Empty states exist, but first-run onboarding is still thin

**What**

There are empty states for `History` and `Pending`, and a no-results state for category search. What is still missing is a stronger first-run state on the main experience that teaches the user what to do first and points aggressively to the primary action.

**Why it matters**

The video specifically calls out first-login empty states as a core mobile design requirement. Right now a new user can land in a designed interface, but not necessarily a taught interface.

**Fix**

Add a true first-run home state with one highlighted primary action, one sentence of setup guidance, and a lightweight pointer toward add or plan.

**Command**

`/onboard`

## Minor Observations

- Typography generally respects mobile sizing, but a few micro labels are very small at `10-12px`, especially in metadata rows.
- `HistoryScreen` has a strong story panel and grouped rows, but it is starting to feel editorial rather than purely utilitarian.
- `CategoryDetailsSheet` is useful, but its fullscreen mode plus hero stats plus summary chips plus activity stream make it feel closer to a mini page than a lightweight contextual sheet.
- The current layouts mostly honor one-directional flow. The main watch-out is sticky summary plus dense list content, which can feel like two competing layers on smaller devices.

## Questions To Consider

- If a brand-new user opened the app with no data, would they know the one best first action within two seconds?
- Does the category details experience need to be this rich, or should some of that information only appear on demand?
- Could the home screen feel calmer if planning became one deliberate entry point rather than one concern among several?
- Which gestures do we want users to learn once and reuse everywhere?

## Bottom Line

The current app already aligns with the video's philosophy more than it misses it. The biggest strengths are navigation discipline, contextual sheets, and generally mobile-aware sizing. The biggest gaps are small touch targets in a few places, a creeping density of surfaced blocks, and a lack of a fully coherent gesture and onboarding system.

If we want the app to follow the brief more strictly, the next pass should focus on simplification, larger tap targets, and making the first-run and contextual-action story much clearer.
