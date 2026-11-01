# Finance desktop review, 1 November 2026

Method: first test of Interface Craft, single-context source review plus live native browser inspection. This is not an Impeccable dual-agent critique.

Target: `/Users/Shared/finance-app/notion-expense-main-preview`, served at http://127.0.0.1:3001. The initial workspace contained only old Next cache files. Existing uncommitted work was preserved. Reviewed desktop light Home, Budget, Reflect's November empty state, and the form-mode transaction dialog. Browser content capture occupies the upper-left portion of the 5120×2880 screenshot; cropped evidence removes unused capture area. Viewport CSS dimensions were not available through the native browser API.

## Verdict

The app has a recognizable identity and already avoids most generic dashboard habits. Keep the jar metaphor, neutral action chrome, flat financial rows, one dominant balance, contextual warnings, and Budget's unequal summary/table columns. The useful next work is clearer interaction and stronger consistency, not replacing the product with article-recommended fonts or another component library. Confidence: high for inspected states, moderate for broader usability judgments.

## Test findings

| Priority / rules | Evidence and impact | Repair / acceptance | Result |
|---|---|---|---|
| P2 IC-03 | AddTransactionSheet rendered New transaction as a 12px div; shared desktop heading rules target h1/h2. The title was barely differentiated from metadata. | Use a semantic h2 with existing shared dialog typography. | Fixed. Live AX tree now reports heading level 2; after image shows the stronger title. |
| P2 IC-05, IC-09 | Banner mixed bright yellow with text for warning ink. Source-derived contrast on white was 4.19:1, below design.md's 4.5:1 minimum. | Separate --warning-ink by theme; use it in shared Banner. | Fixed. Calculated 6.10:1 light flat, 5.88:1 light tinted, 10.64:1 dark flat and 9.56:1 dark tinted. Light rendered result inspected. |
| P2 IC-07 | CardHeaderAction set only minimum height, so a short Plan action had no guaranteed 44px width. This violated the project's target contract. | Use --control-min for both dimensions. | Fixed in shared CSS; Plan remains available. Pixel bounds not exposed by native API. |
| P2 IC-08 | Escape dismissed the transaction dialog, but the AX focus indicator returned to HTML content, including on a second dismissal after reopening. | Restore focus to the originating control after dismissal; investigate with DOM focus instrumentation or a keyboard-only reproduction. | Open, moderate confidence: AX observation is clear, exact DOM cause unverified. Do not claim full keyboard acceptance. |
| P2 IC-11 | Home showed balance while monthly detail and spending panels remained skeletons across several observations, then resolved. Distinct loading labels exist, but no elapsed-time recovery was visible during that wait. | Measure load timing and exercise a stalled request. Ensure a bounded error/retry path, preserving already-loaded amounts. | Unverified recovery; no claim of an infinite loader or backend fault. |
| P3 IC-07, IC-14 | Scope uses three small mascot-only choices. AX labels identify Anas/Joint/Salma; a sighted newcomer must infer the icon mapping. This is an intentional incumbent convention. | Test first-use recognition; consider labels on hover/focus or desktop text if confusion is observed. | Review candidate, not a proven task failure. Retained. |
| P3 IC-01, IC-11 | Reflect's empty November state suggests another period or first expense, but its Add action is in the distant global rail. Empty state itself is clear. | Evaluate an in-context Add expense action using the existing destination. | Review candidate. Retained pending task evidence. |

## Rule coverage

| Rule | Status for this test |
|---|---|
| IC-01 hierarchy | Pass in reviewed desktop states; Reflect recovery proximity is a candidate improvement. |
| IC-02 system ownership | Pass for changes: shared Banner token, shared CardHeaderAction and shared dialog typography. |
| IC-03 type roles | Pass for repaired composer title; no full-app type census. |
| IC-04 grouping | Pass for visible desktop edges; no computed frame measurements. |
| IC-05 semantic color | Pass for repaired warning token; complete palette not audited. |
| IC-06 surfaces | Pass for visible established desktop composition; nested picker cases unverified. |
| IC-07 controls | Minimum header-action contract repaired; full app bounds unverified. |
| IC-08 keyboard | Fail in observed focus-return behavior; Tab/Shift-Tab between Close/Expense and Escape dismissal worked. Full focus loop unverified. |
| IC-09 readability | Pass for changed warning calculations; full app contrast unverified. |
| IC-10 presentation integrity | Existing values, signs, formatting and records preserved. Backend financial correctness not audited. |
| IC-11 feedback | Loading and genuine empty states observed; stalled-request recovery unverified. |
| IC-12 resilience | Unverified on phone, enlarged text and narrow desktop. |
| IC-13 motion | Unverified with Reduce Motion; animation code unchanged. |
| IC-14 copy | Existing task names and critical facts preserved; no new factual claims. |

## Verification

- TypeScript: `npx tsc --noEmit --incremental false` passed.
- Production build: `NEXT_BUILD_DIR=.next-interface-craft-build npm run build` passed, using a separate output directory to protect the running preview. Next's generated include entry was removed afterward; prior tsconfig entries preserved. Existing Browserslist age warning was non-blocking.
- Impeccable detector on changed TSX components returned an empty findings array. This static scan did not detect the title's semantic/CSS mismatch or prove contrast.
- Skill creator's validator passed in an isolated temporary Python environment after the system interpreter lacked PyYAML.
- Live desktop AX/screenshot verification: h2 title, stronger warning text, Home/Budget/Reflect, dialog navigation and dismissal. No transaction was saved and no financial record was changed.
- Dark contrast calculated against flat/tinted surfaces; dark rendering, phone rendering, touch targets and screen-reader announcements unverified.

## Evidence

- [Before transaction dialog](../artifacts/design-review-2026-11-01/transaction-before-crop.png)
- [After transaction dialog](../artifacts/design-review-2026-11-01/transaction-after-crop.png)
- [Home](../artifacts/design-review-2026-11-01/home-reviewed-crop.png)
- [Budget](../artifacts/design-review-2026-11-01/budget-reviewed-crop.png)
- [Reflect](../artifacts/design-review-2026-11-01/reflect-reviewed-crop.png)

## Sources and extraction

The [X article](https://x.com/Hartdrawss/status/2034890067236594136) informed consistent foundations and shared-component ownership. The [Interfaces cheat sheet](https://interfaces.dev/cheat-sheet) supplied detailed implementation checks. Source access and preference/requirement distinctions live in the skill's references/rules.md. Neither article proves this app's usability; that requires observed behavior.


## Follow-up: remaining findings addressed

The subsequent request authorized addressing the four remaining items. All four now have implementations:

| Rules | Change | Verification |
|---|---|---|
| IC-08 | Shared focus capture preserves the external opener across portal mounting; transaction input no longer autofocuses over it. Sidebar and contextual Add actions explicitly focus their trigger. | Live Safari desktop: Escape followed by Enter reopened the composer from both the sidebar Add transaction and Reflect Add expense triggers, including the sidebar opener after a fresh page load. |
| IC-11 | After 10 seconds of pending financial reads, a quiet status offers Retry loading. Retry aborts outstanding GETs, clears coalescing and starts fresh data reads while retaining verified balances. Superseded initial-load completions cannot overwrite the current status. | Live AX observation showed the delayed message and Retry loading beside the still-visible balance. Data finished before the captured screenshot/click. Unit tests prove stalled-read abort/fresh retry and prevention of retries from an abandoned backoff. Full button-to-server retry is not independently exercised. |
| IC-07 | Desktop scope picker shows Anas, Joint and Salma beside the existing mascots, with a neutral selected surface and stronger selected label. Phone remains mascot-only. | Light desktop screenshot in Brave; dark desktop Safari screenshot. Live Anas selection updated the page heading; returning to Joint restored it. Narrow Safari retained mascot-only controls. |
| IC-01, IC-11 | Reflect's genuine empty state offers Add expense using the existing composer. Filtered no-results keeps Reset filters. | Live Safari showed Add expense and opened the Expense tab without changing the selected period. No transaction saved. |

Validation: all 9 app-data tests passed, TypeScript passed, production build passed in `.next-interface-craft-followup`, static TSX detector returned no findings. Temporary build output and its generated tsconfig include were removed. Safari was used for interaction checks because Brave was in active user use and its native interaction state was intermittent.

Evidence: `artifacts/design-review-2026-11-01/followup/reflect-empty.png` shows the contextual action and labeled dark desktop scope picker. `narrow-home.png` shows the narrow layout after the slow read completed. `focus-return.png` shows the desktop layout after dismissal; the stronger behavioral focus evidence is Escape/Enter reopening, not that screenshot. Slow recovery was observed in AX state, not captured visually before completion.

This closes the listed implementation findings. Complete app accessibility, stalled-server end-to-end recovery, and phone simulator acceptance remain outside the verified scope of this desktop pass.
