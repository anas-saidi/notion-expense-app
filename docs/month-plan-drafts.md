# Browser month-plan drafts and partner remainders

User requested a Save draft action and separate remaining-to-assign values for each partner. The chosen storage is this browser only.

Save draft persists edited allocation amounts and desktop expressions under a versioned person/month key, then closes with a browser-only toast. Reopening reads current allocations and restores the draft. Discard draft reverts fields to the actual saved plan. Over-capacity drafts can be saved; applying the plan retains existing guards. Confirmed allocation writes clear only the previously read stored revision, preserving another tab's newer draft. Failed writes retain it. Storage errors are actionable; malformed drafts do not replace the actual saved plan. Changed baselines and unavailable categories produce review notices. A generation guard prevents an old month read from replacing a reopened planner.

Remaining to assign uses the existing capacity.left calculations after personal allocations and each partner's Joint requirement. Joint mode shows Anas and Salma separately. A personal mode already owns its main amount, so the secondary section shows only the other partner. Zeroes and cents are preserved; deficits say short and use danger color rather than being hidden.

## Checks

- 21 tests passed across draft decoding/restoration, zero/cents/unfinished expressions, month/person isolation, unavailable and changed categories, newer-tab cleanup protection, capacity math and existing save-receipt behavior. TypeScript passed; production build passed with the existing jose Edge Runtime/Browserslist warnings. Partner remainders show a loading skeleton until contribution inputs are ready.
- Rendered the actual MonthPlanSheet against a temporary mocked API and a seeded browser draft. Desktop light/dark and phone captures show restored amounts, Save draft/Discard draft and both partner remainders. The fixture reserves personal allocations of 2,000 / 500, a Joint plan of 3,800 against 1,000 Joint cash, and personal capacities of 6,000 / 4,000. Expected remainders 2,180 / 2,520 appear. A shortfall fixture shows 2,820 / 480 short with Save draft available and final review disabled. No household records were changed.
- [Desktop light](design-references/month-plan-drafts/desktop-light.png), [desktop dark](design-references/month-plan-drafts/desktop-dark.png), [phone](design-references/month-plan-drafts/phone.png), [shortfall](design-references/month-plan-drafts/shortfall.png).
- Browser-native Save draft/reopen/final-save clicks remain unverified; captures exercised the actual restore/render path with synthetic persisted data. Temporary route and development output were removed.
