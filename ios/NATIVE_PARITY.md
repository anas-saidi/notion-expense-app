# Native rebuild acceptance map

The iOS app owns its interface, navigation, forms, charts, calculations, drafts and local persistence. No WKWebView, JavaScript bundle, PWA shell, or browser-only task completion is permitted. The existing authenticated server remains the Notion synchronization and secrets boundary.

| PWA capability | Native surface | Verification required |
|---|---|---|
| Wallets, balances, contribution context | Home + global scope | Cash/availability/assignment meanings match |
| Category budgets, savings, frozen categories | Budget + category detail/editor | Create, edit, freeze/unfreeze, archive |
| Monthly planning and top-ups/releases | Month planner + allocation sheets | Carryover and monthly baseline remain distinct |
| Savings deposits, withdrawal, undo | Savings sheets + category timeline | Linked operations retained and used funds protected |
| Manual expenses, income, transfers | Transaction editor | Defaults, dates, repeat, income use |
| Natural text, Gemini, batch review | Type it | Explicit parsing, editable drafts, individual save IDs |
| Bills and recurring schedules | Bills list/detail/editor | Create, pay, edit, skip, restore, stop, undo payment |
| Rebalance + suggestions | Rebalance | Live balances, bill reservations, savings exclusions |
| Accounts and reconciliation | Account detail | Activity, real/ledger delta, income and transfers |
| Pending purchases | Pending list/editor | Add, claim/unclaim, remove |
| Insights and activity | Swift Charts + date-grouped ledger | Filter, category detail, previous-month comparison |
| Preferences and work-time rate | Native Settings | Appearance and saved per-wallet hourly rate |
| Sync, backup, restore, updates | Native Settings + SwiftData | No destructive launch reset; no writes on restore |
| Review without credentials | Isolated sample household | Clearly sample; no real Notion writes |

Mark work implemented only when its controls and destination exist. Mark verified only after automated or simulator evidence; sample data is never proof of live Notion integration.

## Verification on 2026-10-22

- Full iOS simulator build: passed.
- Native unit tests: 19 passed, including file-backed reopen, planning capacity, typed parsing, backup recovery, and isolated sample mutations.
- Automated native UI journey: passed through sample onboarding, Budget, the editable planner, and Insights; each inspected destination had zero web views.
- Backend regression suite: 536 passed; TypeScript checking passed.
- Manual simulator inspection: Home and planning.
- Remaining acceptance: live deployment/Notion integration, physical-device signing/renewal/update continuity, and full per-flow accessibility, dark-mode, and failure/recovery inspection. Native visual equivalents do not reproduce every web mascot physics interaction or guarantee that every live multi-record flow has been exercised.
