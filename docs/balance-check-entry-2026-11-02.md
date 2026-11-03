# Balance-check entry, 2 November 2026

Routine balance checks now open from Settings → Finances on phone and desktop. The Home shortcut and desktop rail shortcut are removed. Home summary discrepancies still open their account check, and error/paused states remain visible. With no error, the former notice component renders nothing, so no blank space remains.

The mascot's original soft material is restored after the user rejected the matte and split-color treatments. The single-mascot composition, contribution-summary entry, copy refinements and category artwork remain.

Verification: TypeScript and whitespace checks passed. In Safari, Settings showed Check balances under Finances; tapping it opened the existing account chooser without changing any financial record. Home's accessibility tree showed the discrepancy review link and no routine Check balances button. Exact phone width, dark appearance and a full keyboard dialog round trip remain unverified.

## Confirmed-save completion, 3 November 2026

The sheet previously showed “Balance check saved” while awaiting a full-history refresh before clearing its saving state. A slow refresh therefore left the button disabled and prevented closing an already-saved check. The sheet now applies the returned server check/version immediately, releases saving, and refreshes the catalog in the background. The hook ignores earlier reads after accepting the acknowledgment and removes the confirmed account from recovery review counts. Failed writes and version conflicts still retain the draft and report failure; no write retries were added.

Five regressions cover an indefinitely pending refresh, a rejected refresh after confirmation, a failed/conflicting mutation, a confirmed close, and malformed acknowledgments. A local isolated fixture rendered the actual sheet at 498×827 and 1200×827. Both simulated saves advanced the version and check date, released the button, and allowed immediate closing while follow-up reads remained pending. No live financial records were modified during verification.
