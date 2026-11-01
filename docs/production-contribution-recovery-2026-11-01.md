# Production contribution namespace recovery

The canonical notion-expense-app.vercel.app deployment used a different Notion token from the local preview. mirrorScope derives a namespace from the token plus database IDs. Live Notion reads continued to work, but production queried an empty contribution namespace while the existing October agreement remained under the earlier token-derived scope.

Read-only verification found the existing PostgreSQL agreement with October targets Anas 11,638.25 and Salma 6,266.75. The production token was verified to access the same Categories database. The agreement namespace matched the local token's derived scope and differed from production's. PostgreSQL was reachable; enabling the local-only Notion writer was neither necessary nor appropriate.

## Repair

Added server-only FINANCE_CONTRIBUTION_SCOPE and configured the canonical Vercel project's production environment to the verified existing agreement scope. contributionScope is used by monthly summaries, agreement reads/writes, contribution-context reads, advance-reservation validation and monthly-plan save validation. Without the setting, existing behavior is preserved. Invalid values fail visibly.

No agreement, transaction or balance was rewritten. Other stores retain their current namespaces, particularly operation receipts and balance checks; no deduplication history was moved or discarded. PostgreSQL's atomic agreement version checks remain in use. Local Notion configuration was not enabled on Vercel.

## Verification

- Production build and TypeScript passed.
- 46 tests passed across contribution namespace/store/ledger, contribution calculations, repayments, monthly summary pagination/partial failure and advance reservation.
- A temporary Next instance used the actual production Notion token, the existing PostgreSQL connection and configured contribution scope. Its real accounts/categories/monthly-summary read endpoints returned the October agreement without contribution errors. The app's actual calculateContributionStatus and ContributionEntry rendered Owed to you both with an outstanding total of 1,792 MAD (Anas 820.75, Salma 971.25). No financial mutation endpoint was called. The temporary server, integration test and generated builds were removed.
- Dependency warnings about jose Edge Runtime compression APIs and outdated Browserslist data remain unchanged.
