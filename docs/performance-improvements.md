# Main branch performance improvements

Comparison baseline: committed main `2e49daa`. Implemented in the current main working tree. The existing configuration edits and Due Lab work were preserved; production comparisons used clean copies and the committed build configuration.

## Measured results

Three alternating runs per version, fresh browser contexts, local production servers, live Notion reads, Chromium at a 390 × 844 viewport. No CPU or network throttling; reduced motion enabled in both versions. The September reporting period was held constant by adjusting Date only; monotonic timing, resource timing, and timers remained native. Figures are medians.

| Metric | Before | After | Reduction |
|---|---:|---:|---:|
| Home balance visible, live Notion | 15.46 s | 4.37 s | 72% |
| Full startup through network settling, live Notion | 15.52 s | 8.26 s | 47% |
| Next.js reported first-load JavaScript | 374 kB | 256 kB | 32% |
| Measured initial JavaScript response bytes | 373,839 | 255,513 | 32% |
| Financial API calls on a fresh browser visit | 8 | 6 | 25% |

The balance-visible metric records when Home's wallet mounts with verified data, rather than waiting for the decorative number animation. The full-startup metric waits for secondary loading messages to disappear and for Playwright's network-idle condition, which includes a quiet window. Authentication/session calls are excluded from financial API counts.

Live balance samples (before): 15.459, 14.933, 17.946 seconds. After: 5.879, 4.348, 4.369 seconds. Live full-startup samples (before): 15.517, 15.155, 18.314 seconds. After: 10.116, 8.263, 8.144 seconds. Notion latency varies; these are local samples, not an iPhone or deployed Vercel latency guarantee. The optimized server's metadata cache was warm during this final comparison; cold-instance behavior is covered separately below.

## Controlled benchmarks

Browser API fixtures used a fixed 600 ms delay per response, the same fixture data in both versions, and three fresh contexts each.

| Metric | Before | After |
|---|---:|---:|
| Balance visible | 3.85 s | 0.82 s |
| Startup through network settling | 4.19 s | 1.76 s |

Backend fixtures ran the actual route handlers with fake timers and 500 ms per Notion response. They include the optimized client's 350 ms request pacing. Results use one query page per database unless a pagination test explicitly supplies more.

| Operation | Notion calls before → after | Simulated time before → after |
|---|---:|---:|
| Cold Home, balance ready | 11 → 9 total startup calls | 4.00 → 1.35 s |
| Cold Home, all data | 11 → 9 | 4.00 → 3.60 s |
| Warm Home, balance ready | 10 → 7 total startup calls | 4.00 → 0.85 s |
| Warm Home, all data | 10 → 7 | 4.00 → 2.75 s |
| Save 20 positive allocations | 40 → 21 | 20.00 → 10.50 s |

Plan-save timings are simulated, and no live budget writes were performed. The plan lookup is paginated: more than 100 matching funds adds query pages. The saving improvement removes per-category lookup calls; it does not reduce the number of required writes.

## Changes

1. Home waits for accounts and the category catalog, then shows the verified balance while other sections load. Missing monthly data has a reserved loading region and never appears as zero spending, “No monthly plan”, or settled contributions. Secondary errors retain Home and offer retry. Planning prompts wait for verified monthly and planning data.
2. The monthly-summary API can return all monthly transactions alongside aggregates. Contributions and monthly totals use that response, and Reflect can reuse the same in-flight request or a recent snapshot. Recent activity also seeds category suggestions, eliminating a separate startup transaction query. Recent and monthly queries remain separate because they cover different time ranges.
3. Account and pending database schemas share a five-minute cache scoped by token/database. Financial query results are not cached server-side. Client reads coalesce while in flight, and category refreshes use one catalog response for active and snoozed categories. Mutations invalidate earlier reads, request generations reject late responses, and a write arriving during a budget refresh schedules a fresh trailing pass. The existing delayed formula/rollup check is retained.
4. Reflect and Account Details load dynamically. Account Details is first mounted when opened and stays mounted afterward to preserve exit animations and draft behavior. Both consumers must be deferred to remove charting code from Home's initial bundle.
5. Monthly-plan saving loads the month's existing funds in one paginated lookup, then indexes them by category before updating, creating, or explicitly clearing records. Writes remain sequential, and ambiguous creates are not automatically retried.

The shared Notion client paces outgoing starts at 350 ms intervals and honors Retry-After. That queue and the schema cache are local to a server process; independent serverless instances can still encounter shared connection limits. The 15-second monthly snapshot reuse is confined to the current app instance and invalidated after app writes. [Notion request-limit guidance](https://developers.notion.com/reference/request-limits).

## Verification

- `npm test`: 313 tests passed, including pagination, shared monthly data, schema expiry/failure eviction, Retry-After, progressive loading, batch updates/clears, and mutation/read races.
- Production builds succeeded for both baseline and final implementation. Existing jose Edge Runtime build warnings occur in the baseline too.
- TypeScript checking and `git diff --check` passed.
- Live September monthly totals and category breakdowns matched the baseline; the optimized response also included transactions.
- Browser checks passed at 390 × 844 and 1280 × 900: Home, pending monthly data, secondary failure, Reflect, and Account Details opening/reopening. No page errors or document horizontal overflow were recorded. The final failure check also confirmed that retry retains the verified balance and planning prompts stay hidden when monthly capacity is unknown.
- No FPS or INP claim is made: this measured loading and request cost, with reduced motion enabled.

[Raw browser results](../artifacts/performance/browser-results.json), [backend results](../artifacts/performance/notion-results.json), [summary](../artifacts/performance/summary.json), and [live parity](../artifacts/performance/live-parity.json) are local verification artifacts, ignored by Git. Screenshots contain fixture data.

The local artifacts also contain `browser-benchmark.cjs`, `start-benchmark-server.cjs`, and `notion-benchmark.ts.fixture`. Run production baseline and modified copies on loopback ports 3211/3212; the server launcher reads environment variables from `APP_ENV_DIR` and uses a local-only session signing key. The browser script uses `PLAYWRIGHT_PACKAGE` when Playwright is supplied by the desktop runtime. Copy the backend fixture into each comparison root as `performance-benchmark.test.ts`, configure Vitest's `@` alias to that root, and set `BENCHMARK_VARIANT=before` or `after`. Live comparisons perform reads only; saving uses mocks.
