# App roadmap

Updated 2026-11-04. Single source of pending product work. Read with `AGENTS.md` and `design.md`; historical reviews describe evidence, not a second backlog.

## Agent protocol

- Start with `git status` and latest `origin/main`. Preserve others' changes. Pick one bounded item; honor an explicit user priority over this ordering.
- States: `todo` = unstarted/full scope still pending; `doing` = claimed; `verify` = candidate implementation exists, acceptance/release pending; `blocked` = name the dependency; `parked` = deferred; `done` = acceptance met with evidence. `verify` is not an invitation to reimplement.
- When claiming, set `doing` and add owner/branch/date to the row. When handing off, record the next concrete step or blocker. Do not leave an abandoned claim without context.
- Mark `done` only after its acceptance checks pass. Record commit, verification and deployment reference, or explicit user acceptance of local-only scope. A build, local screenshot or “implemented” message alone does not establish a shipped fix. Reopen the same ID for a regression; do not create duplicates.
- Keep completed IDs in **Done** with one-line evidence; do not delete history or renumber. Merge duplicate feedback into existing rows. Update this file in the same change as the work; update `design.md` only for durable conventions.
- For UI, inspect actual narrow/wide renders and light/dark themes affected. Check keyboard/accessibility and real iPhone behavior where relevant; state unverified conditions. Financial writes need meaningful regression tests and preservation of existing coordination/idempotency. Never save real money records merely to test visuals.
- Priorities: P1 = correctness or core access; P2 = functional/interaction improvement; P3 = polish. Dependencies appear in the row; start with P1 unless directed otherwise.

## Intake and existing work

`C1`–`C22` refer to the 2026-11-04 feedback on the production app. `I1` = contributions unavailable on iPhone; `I2` = remaining strokes through glass; `I3` = quick notes for later processing. Earlier seven localhost annotations are **previous local feedback**, not these C numbers.

Baseline inspected: `origin/main` at `3d1d5b8`. Production annotations and local candidates are different evidence: do not assume an old production screenshot disproves an unpublished local fix, or that a local fix is shipped.

Uncommitted candidates exist in the `notion-expense-glass-calibration` checkout: gentler shared picker panels; stroke-free dense controls; account artwork in composer/options; unframed scope mascots; glass dismiss controls; simplified balance-check disclosure. Local browser checks and 640 tests/build passed; no commit/deployment acceptance. Local notes live in `docs/glass-calibration/` in that checkout and may be absent from a fresh clone. Inspect/reuse these changes before R03–R07, R15 or R20. They do not establish a full-app audit or real-iPhone acceptance.

## Core access and capture

| ID | Pri | State | Outcome and acceptance | Start points | Source |
|---|---|---|---|---|---|
| R01 | P1 | todo | Contributions have a visible direct mobile entry outside account details, including when nothing is due. Show agreed, paid and remaining amounts for the selected scope/month; preserve unknown/loading/error states and the existing contribution flow. Verify on iPhone. | `HomeScreen.tsx`, `ContributionDetails.tsx`, `app/page.tsx` | C18, I1 |
| R02 | P1 | todo | A bill paid through an expense logged elsewhere can be explicitly linked/acknowledged for the correct occurrence without creating a second expense or double-counting money. Review existing payment model first; retain transaction identity, partial/multiple-payment semantics and safe retry behavior. Test repeat submission, mismatched account/category/period and unlink/edit behavior. | `BillsSection.tsx`, `app/api/bills/route.ts`, `lib/bills.ts`, `docs/due-bills-feature-spec.md` | C7 |
| R08 | P2 | todo | Quick add saves an unprocessed note with minimal friction; notes survive reopening and can be found, reviewed, edited and removed. Clearly distinguish notes from posted transactions; exclude them from financial totals. Choose durable storage before implementation. Future natural-language/AI conversion produces reviewable drafts and requires explicit saving, never automatic posting. AI processing is a later phase, not a prerequisite for note capture. | `AddTransactionSheet.tsx`, `TypeItComposer.tsx`; decide inbox entry/storage | I3 |

## Shared material and controls

| ID | Pri | State | Outcome and acceptance | Start points | Source |
|---|---|---|---|---|---|
| R03 | P1 | todo | Audit every calendar, account/category/target picker, menu and other reading panel. Background text must not remain readable or warp across foreground content. Reuse the local large-panel preset, strengthen coverage where needed, avoid nested glass, and verify both themes plus iPhone Safari. Keep compact decorative glass separate from reading surfaces. | `PickerPopover.tsx`, `ui/liquid-glass.css`, picker consumers | C2 |
| R04 | P1 | todo | Full-app stroke audit: buttons, icons, chips, tabs, dismiss controls and held/pressed states have no interior lines/arcs from glass rendering. Reuse the local dense-control candidate; cover surfaces beyond the already checked composer/appearance controls. Record inspected surfaces and remaining exceptions. | `ui/LiquidGlass.tsx`, `ui/liquid-glass.css`, `globals.css` | I2, previous local feedback |
| R05 | P2 | todo | One shared button/chip system owns material, geometry and primary/secondary/quiet states. Account/category/date chips match in equivalent contexts; Category Expense/Fund/More actions and Budget Rebalance use the intended glass treatment. Account actions lose isolated blue/green fills; color differences must have semantic justification. Rebalance is clearly discoverable. Audit callers for inline background/border overrides; preserve pressed/disabled/focus/accessibility fallbacks. | `TransactionPickers.tsx`, `DatePicker.tsx`, `CategoryDetailsSheet.tsx`, `AccountDetailsSheet.tsx`, Budget toolbar, shared styles | C6, C12, C16, C22 |
| R06 | P2 | todo | Audit all account representations, not just the selected composer chip: option lists, headers, details, transfers, income, AI drafts and summaries use the existing account-type artwork resolver. Raw account-page emoji never render as account UI. Preserve category artwork and stored Notion icons. | `lib/category-icons.ts`, account consumers; local composer/options candidate | C4, account list in C2 |
| R17 | P3 | todo | Due bills and equivalent subsection headings share one readable, slightly larger type role. Audit all screens for consistency without enlarging metadata or flattening the heading hierarchy. | shared headers, `globals.css`, `BillsSection.tsx` | C19 |
| R20 | P2 | verify | Accept the remaining previous local fixes: Type it control material, glass dismiss buttons, unframed mascot scope picker, and less crowded balance check with visible errors and accessible secondary actions. Reuse the candidate, verify against current design, then record release evidence. R07 may supersede the Type it placement; do not ship two competing mode controls. | local changes/reviews described above | previous local feedback |

## Composer and AI modes

| ID | Pri | State | Outcome and acceptance | Start points | Source |
|---|---|---|---|---|---|
| R07 | P2 | todo | Provide a clear shared way to switch manual/AI entry in both Expense and Income. Replace the isolated pen affordance; Rebalance hides its AI section by default and reveals it only in AI mode, with a way back. Manual and AI editors never occupy the view simultaneously; switching preserves drafts. User requested a sparkle mode button: this is an explicit exception to the older no-sparkles rule, not permission for decorative sparkle UI. Give the switch a clear accessible name/state. Processing remains explicit, with data disclosure before sending and review before any save/apply. | `AddTransactionSheet.tsx`, `TypeItComposer.tsx`, `RebalanceSheet.tsx`, `ui/icons.tsx` | C1, C5 |
| R09 | P2 | todo | Remove the custom keypad and its Show keypad control completely; retain native numeric/expression input. Move Repeat to the pre-save step for eligible expenses, not the initial entry view; preserve recurring-bill behavior, edit rules and validation. Do not silently remove a selected repeat setting. | `AddTransactionSheet.tsx`, transaction submission flow | C3 |

## Bills

| ID | Pri | State | Outcome and acceptance | Start points | Source |
|---|---|---|---|---|---|
| R10 | P2 | todo | Calendar communicates Due/Paid/Skipped states. List is explicitly expandable or selectable as an alternative; do not show the full calendar and full list together by default. Preserve date/period navigation, filtering, overdue meaning, accessible state labels and access to every bill. | `BillsSection.tsx`, bill calendar/filter styles | C10 |
| R11 | P3 | todo | Add bill is a plus-only control with its existing accessible Add bill name, tooltip where appropriate and 44px target. | `BillsSection.tsx` | C8 |
| R12 | P3 | todo | Bill artwork is larger within calendar cells, while the day, state and multiple-bill cases remain legible and unclipped at phone widths and larger text. | calendar artwork in `BillsSection.tsx` | C9 |

## Details and navigation

| ID | Pri | State | Outcome and acceptance | Start points | Source |
|---|---|---|---|---|---|
| R13 | P2 | todo | Category details initially show one meaningful number; tapping it reveals allocated/planned/spent breakdown, with keyboard/VoiceOver access and an obvious collapse path. Remove verbose “X% of plan used”; use red for the used/spent indicator as explicitly requested, while preserving numeric accessibility and distinction from errors/overspend. Record this scoped exception to the previous neutral-consumption rule. | `CategoryDetailsSheet.tsx`, `design.md` | C13, C14 |
| R14 | P3 | todo | Remove redundant “Net spending across N transactions”/equivalent prose from spending details while retaining useful totals, period and transaction list; preserve a necessary accessible description if removing text loses meaning. | `ReflectScreen.tsx` | C11 |
| R15 | P2 | todo | Opening Check balance presents one active mobile panel, not account details plus another visible sheet stacked over it. Closing/back returns to the correct account context and focus; preserve drafts and operation guards. Audit similar nested flows rather than only hiding a backdrop. | `AccountDetailsSheet.tsx`, `ui/BottomSheet.tsx`, calling state in `app/page.tsx` | C15 |
| R16 | P2 | todo | Negative unassigned amount becomes a concise tappable summary consistent with the app's fact/summary pattern, with clear meaning and a relevant review destination. Preserve signed value, currency, scope, and distinction between unassigned budget and account cash/debt. | `AccountDetailsSheet.tsx`, existing summary/fact primitives | C17 |
| R18 | P2 | todo | Make the three-destination phone navigation narrower while preserving comfortable targets, Add placement and Glisse interactions. User offered a fourth destination as an alternative, not an instruction to invent one; consider it only if existing product structure justifies it, and coordinate with R01/R08. | `BottomNav.tsx`, `.phone-nav-*` and nav layout styles | C20 |
| R19 | P3 | todo | Budget gets a destination-specific icon distinct from the filter sliders used elsewhere. Keep one icon family, accessible tab names and selected states. | `BottomNav.tsx`, `ui/icons.tsx` | C21 |

## Carried forward

Preserved from the previous roadmap. Do not treat old architectural assumptions or past measurements as current behavior.

| ID | Pri | State | Outcome and acceptance | Context |
|---|---|---|---|---|
| L01 | P2 | todo | Revalidate actual iPhone cold/warm loading and slow/failing-read recovery against the current Notion + Supabase mirror architecture before proposing more caching. Preserve complete totals, freshness and write coordination. | Replaces the obsolete Notion-only “Faster loads” proposal; use `docs/performance-improvements.md` and `docs/notion-supabase-migration.md`. |
| L02 | P3 | todo | Check whether the phone plan sheet still needs the desktop's “spent so far” hint; add only if it helps the current flow. | Previous smaller follow-up; verify current behavior first. |
| L03 | P2 | todo | Verify real-iPhone modal scroll locking, nested-sheet dismissal, focus and keyboard/safe-area behavior. | Previous smaller follow-up; coordinate with R15. |
| L04 | P3 | todo | Review Reflect's desktop recap sentence in its current layout; remove redundancy without losing financial meaning. | Previous smaller follow-up. |
| L05 | P3 | parked | Settled-month keepsake receipt, distinct from the already implemented saved-plan confirmation. Trigger once after the last settlement line is marked sent; retain later View receipt access in Reflect. One text-only screen: month, top four spending categories + remainder, actual total/plan/variance, partner contributions, advances repaid, two signatures. Paper/monospace is a documented exception; reduced motion fades. Decide drawn vs tap signatures, persistence and image export before building. | Existing idea and `docs/design-references/receipt/concept.md`; no category artwork in saved/shared receipt under the recorded asset constraint. |
| L06 | P3 | parked | Pull Home hero down to reveal an insight-only daily brief: pace, next bill and Joint obligations. Keep actionable facts visible outside the brief. Decide interaction with pull-to-refresh; require a discovery hint, non-gesture alternative and reduced-motion behavior. Inline mascot sentence concept remains deferred here. | Previous daily-brief idea. |

## Done

No item from this intake has shipped/accepted completion evidence yet. Move completed rows here with their stable ID, outcome and commit/verification/release references; future agents must not pick them again.
