# Month plan save confirmation

Implemented from origin/main `e1b5b89` on `codex/month-plan-receipt`. Scope: web Month plan, desktop and responsive phone sheet. Existing shared sheet, Money formatting, wallet meanings and editing controls remain.

## Decisions and acceptance

| Rule | Prior state / impact | Repair and acceptance | Result |
| --- | --- | --- | --- |
| IC-01, IC-11 | Successful save returned to editor with a toast; the requested final reward was absent. | Show Printed keepsake after the save succeeds. Done closes; Back to plan reviews saved values. | Pass in mocked browser flow |
| IC-10 | Receipt prototype contained illustrative spending and settlement data, unsuitable for a plan-save confirmation. | Snapshot all positive planned allocations across wallets, including unchanged/frozen allocations. Top four plus remainder and wallet totals preserve the full sum. Include separately labeled Agreed contributions from the server-confirmed agreement. No settlement/signature claims. | Unit tests verify snapshot isolation, cents, cleared category exclusion, targets independent of wallet allocations and rejection of mismatched/unconfirmed agreements |
| IC-11 | Contribution confirmation could fail after a successful allocation save. | Keep saved-plan confirmation with an actionable warning and a return to the agreement editor. A failed allocation request retains the draft and shows no receipt. | Pass for mocked 409 save failure and 500 contribution failure; network failure covered by unit test |
| IC-08 | Content replacement removes the focused Save control. | Focus the saved heading, retain shared opener, restore editor panel focus on Back, allow Escape/Done dismissal and Enter reopening. | Pass on desktop |
| IC-02, IC-03, IC-05, IC-09 | Paper concept needs a bounded visual exception. | Local light/dark paper tokens and monospace typography; app controls and Money remain shared. | Rendered light/dark desktop inspected; paper muted contrast 5.64:1 light and 8.04:1 dark |
| IC-12 | Initial phone receipt repeated the same owner under every category and pushed controls below the viewport. | Omit category owner subtitles when only one wallet is planned, reduce receipt group spacing, preserve scrolling for longer content. | 390px phone inspected; 320px flow checked with no horizontal overflow and reachable Done |
| IC-13 | Printing must not block dismissal or impose travel under Reduce Motion. | One 900ms transform through clipped slot; controls immediately usable; 120ms fade for reduced motion. | Reduced-motion computed animation checked; rendering inspected after reveal |

## Evidence

All images use synthetic fixture data, not household financial records.

- [Desktop light](design-references/receipt/plan-save/desktop-light.png)
- [Desktop dark](design-references/receipt/plan-save/desktop-dark.png)
- [Phone 390px](design-references/receipt/plan-save/phone-light.png)
- [Phone 320px](design-references/receipt/plan-save/phone-320.png)

Browser verification used a temporary local fixture mounting the actual MonthPlanSheet and intercepting every API request. Tested desktop Review → Save, failed-save retry, successful receipt, contribution warning and recovery, Done/Escape focus return, Enter reopening, and phone accessible save action at 320px. Agreed contribution amounts were checked in the rendered receipt; failed confirmation was checked to omit unconfirmed targets. Seven mutation requests were intercepted; no financial record was saved. The fixture route and its isolated dev build were removed afterwards.

Automated checks: 20 targeted receipt/actions/capacity tests passed; TypeScript passed; production build passed. Build emitted dependency warnings for jose CompressionStream/DecompressionStream in Edge Runtime and outdated Browserslist data.

## Remaining verification and scope

Actual Notion writes intentionally untested. Native iOS MonthPlanner is unchanged. A real iPhone touch drag and VoiceOver session remain unverified; phone saving was exercised through the existing control's keyboard accessibility path. Mixed-wallet receipt logic is unit-tested; the screenshot fixture uses one wallet. Signatures, persistent history and image export remain future work. No public deployment was made.


## Review styling follow-up

The live 3001 planner reproduced a browser-default Edit plan button and a separate text-only review list. This was a gap in the earlier review-flow visual acceptance (IC-02, IC-03, IC-07). The review now reuses the planner's category row styles and shared CategoryIcon/Money components through MonthPlanReview, with semantic table cells and a 44px styled Edit action. Entering review focuses its heading rather than leaving focus on the primary action that becomes Save. Edit restores the changed field or panel.

Rendered verification of the actual MonthPlanReview component in the shared BottomSheet used a temporary synthetic fixture: [light](design-references/receipt/plan-save/review-light.png), [dark](design-references/receipt/plan-save/review-dark.png). The captures use 1440×900. The native live-app reproduction used an unsaved Copy last month draft; no live Save action was invoked. Native follow-up clicking was interrupted by active browser changes and Safari rendering failures; the updated component's focus behavior is implemented and type-checked but not accepted as a new end-to-end keyboard pass. The earlier save/receipt checks remain as recorded above.

Follow-up checks: TypeScript passed, all 20 targeted tests passed, and the production build passed with the same dependency warnings recorded above. Temporary fixture and build output were removed.

Owner-label refinement: reviews containing only one wallet omit per-category owner subtitles. Mixed-wallet saves retain them to distinguish ownership. Earlier review screenshots predate this copy reduction. TypeScript passed after the change.


## Modal background follow-up

Cause: MonthPlanSheet received the app-wide setBudgetScope callback. Its local picker consequently updated Home and persisted the app's preference. It now copies the opening scope into session state; all in-planner navigation uses that state. Selection tokens are scoped under data-plan-scope rather than changing html[data-scope].

Month plan and receipt opt into the shared sheet's lockBackground: full-screen backdrop on phone, modal semantics and keyboard containment at both breakpoints, and a reference-counted inert lock on app-shell-root. All other sheets keep their default behavior. Unit tests verify restoration, overlapping locks, idempotent cleanup and preservation of pre-existing inert state.

Rendered the actual sheet in a synthetic fixture at 1440×900 and 390×844. The phone has its own Monthly plan wallet picker and the header is behind the full-viewport backdrop ([capture](design-references/receipt/plan-save/modal-mobile.png)). Live 3001 inspection confirmed only the planner remained in the accessibility tree and changing Joint to Anas changed its category table. Subsequent native closing/reopening verification was interrupted by browser changes/noWindowsAvailable failures; it remains unverified end to end. No live save was performed.

Modal follow-up validation: all 23 targeted tests, TypeScript and production build passed. The same existing jose Edge Runtime/Browserslist warnings remain. Temporary test route and build output were removed.
