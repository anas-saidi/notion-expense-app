# Copy and mascot review, 2 November 2026

**Visual direction superseded:** the user rejected the warm-ochre material after this review. The original soft mascot material is restored, with one hero retained. Check balances now lives in Settings; discrepancy links and retry states remain on Home. See design.md for the current convention. The captures below document the earlier reviewed proposal, not the accepted final material.

The local web app now uses shorter, consistent copy and one main hero mascot. Joint uses a single warm-ochre fill; personal scopes retain blue or pink. The waterline shows the monthly budget remaining, not account cash or contribution completion. The split-color hero was rejected by the user and replaced.

## Scope and coverage

Reviewed all 77 production web UI source files and selected text helpers listed in [the inventory](copy-inventory-2026-11-02.json). The repeatable extractor is `node scripts/copy-inventory.mjs`. Its 1,542 candidate items include repeated literals, enum values and a few technical expressions; they are a source-review aid, not 1,542 independently verified screen messages. The scan excludes tests, labs and the icon library.

Source-file review coverage is 77/77 (100%), exceeding the requested 96% coverage target for this defined web scope. This is not a measured 100% readability score or a guarantee that 96% of all runtime states comply. Runtime copy assembled from Notion records, server/library errors, and the separate native iOS app remain outside this pass. Financial labels, detailed accessible names, privacy notices, and partial-save recovery instructions retain their essential meaning.

The review applies Shreya Shankar's five principles: natural sentence order, useful words first, consistent structure and terms, meaningful variation, and accurate verbs. Short labels and field names need not become full sentences.

## Findings and repairs

| Rule | Priority | Evidence and impact | Repair and acceptance | Status |
| --- | --- | --- | --- | --- |
| IC-01 | P2 | Home/Budget combined budget depletion with partner contribution progress in one mascot family. The user reported visual clutter. | Remove partner jars from Home, Budget and planner heroes. Keep contribution summary/details and planner remaining-amount rows. One hero now carries one progress meaning. | Pass in source and light Home/Budget views. Planner source verified; rendered planner remains unverified. |
| IC-05 | P2 | The original blend and then the proposed two-color split made Joint's hero harder to read. User explicitly rejected the split. | One warm household fill token, neutral empty region, crisp waterline; blue/pink remain on partner controls and personal heroes. | Pass in light Joint and Anas views. Dark palette source checked; rendered dark state unverified. |
| IC-06 | P3 | Blurred rims, colored glass washes, depth layers and ground shadows accumulated around the fill. | Remove those effects from pool heroes. Retain silhouette, eyes, remembered fill, and existing tap response. | Pass in light wide/narrow captures. |
| IC-14 | P2 | Similar failures/actions used Failed to/Couldn't, Try again/Retry, and revive/restore. Long helper text repeated headings and actions. | Use Could not for fallback errors, Retry for retry controls, Restore for recoverable categories; shorten redundant explanations and action labels. Preserve detailed consequences and recovery when they change a decision. | Source review complete. Not every error state was triggered. |
| IC-14 | P3 | Web metadata used Expenses, Notion Expenses and Couple Finance for the same product. | Use Couple Finance in page title, login identity and install manifests. | Pass in source and Safari title. |
| IC-10 | P1 guardrail | Mascot level could be misread as the adjacent account balance. | Preserve `1 - spent / totalAssigned`, clamped in the hero; tap label explicitly names monthly budget remaining. Verified the remaining-budget percentage against observed spending and assigned totals in Joint and personal scopes. | Pass for observed records. No financial data was changed. |

## References and interpretation

- [Brilliant Koji welcome interaction](https://60fps.design/shots/brilliant-koji-mascot-welcome-back-animation): a recognizable character with a brief reaction and subtle idle behavior. This informed concentrating personality in the silhouette, eyes and tap response.
- [Runmo distance wheel](https://60fps.design/shots/runmo-distance-wheel-fill-interaction): progress changes track the selected value and settle with deceleration. This informed preserving the eased, data-linked level change.
- [Duolingo battery fill](https://60fps.design/shots/duolingo-battery-fill-up-interaction): reviewed but its reward confetti and large bursts were not adopted for ordinary financial status.

These are adaptations from 60fps's written descriptions. The Koji page's playback controls loaded, but its video area was blank in the browser capture; no frame-by-frame playback inspection is claimed. No reference artwork was copied.

## Verification

- TypeScript: `npx tsc --noEmit` passed after implementation (final rerun recorded in chat).
- Existing test suite: 601 tests in 74 files passed. No financial writes were performed during UI inspection.
- Rendered Safari Home and Budget in light appearance at wide and narrow window widths; observed Joint and Anas. Native narrow-window captures are not an iPhone-device test.
- Mascot tap changed expanded/collapsed state and its accessible label. Expanded category artwork appeared inside the mascot. No new dialog was introduced by the hero change.
- `git diff --check` passed.
- Unverified: exact 503px viewport, dark rendering, Salma view, full keyboard dialog round trips, every empty/error state, and actual Reduced Motion behavior. Existing reduced-motion paths were preserved, not empirically re-tested here.

Local evidence (private financial data, not for publication):

- [Home, wide light](../artifacts/copy-mascot-review/home-light-desktop.png)
- [Home, narrow light](../artifacts/copy-mascot-review/home-light-narrow.png)
- [Budget, narrow light](../artifacts/copy-mascot-review/budget-light-narrow.png)

The running checkout is `/Users/Shared/finance-app/notion-expense-app-latest`, a separate worktree. The original checkout and its earlier uncommitted work remain intact. Changes have not been pushed or deployed.
