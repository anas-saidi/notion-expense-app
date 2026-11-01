# Activity loading recovery

User screenshot: Joint activity showed the global Loading is taking longer than usual / Retry loading message and an Updating balances skeleton. IC-11 failure: recovery watched secondary Home, monthly and bills reads on every screen. On Activity, Retry aborted all financial reads and restarted the complete initial load, including the hidden work that had triggered it.

## Repair

- screenIsLoading scopes the delayed recovery to the visible destination, retaining global recovery for initial essentials. Switching screens remounts the recovery delay.
- Activity retries cancel only transaction/monthly-summary requests for the selected period. Pending Home account reads remain valid and coalesced. Both Reflect retry controls use this path.
- fetchHistoryData reads only transactions for Activity unless a completed matching Home snapshot is already available. Spending retains its monthly summary and budget comparison.
- The unrelated Home Updating balances indicator is omitted on Reflect. Actual refresh errors remain visible; genuinely slow visible-screen reads retain delayed recovery.

## Checks

18 tests passed covering loading scopes, targeted cancellation, preserving a pending Home read, fetching Activity without monthly-summary/funds, retaining Spending summary, snapshot reuse and existing read retry/coalescing behavior. TypeScript and production build passed. Existing jose Edge Runtime and Browserslist warnings remain. Recent production API requests returned HTTP 200; those records do not establish the browser state shown in the screenshot. Rendered interaction on the user's authenticated browser remains unverified because native browser access was unavailable in the preceding inspection. No financial mutation was performed.
