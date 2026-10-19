# Hosted Finance MCP

The same Vercel project serves a stateless Streamable HTTP MCP endpoint at
`https://<production-domain>/api/mcp`. It uses the official TypeScript MCP SDK.
No local server is required. This first connection targets Codex and other MCP
clients that support an explicit Bearer header. It is not an OAuth login or a
ChatGPT plugin; those clients need an OAuth adapter added separately.

## Connection

Generate a separate, high-entropy connection key (at least 32 characters).
Configure only its lowercase SHA-256 digest as server-only `MCP_TOKEN_SHA256`
in Vercel Production, then redeploy. Never use NOTION_TOKEN, the session secret,
or a Shortcut token as the MCP key. An unset/invalid digest fails closed.

In Codex's MCP settings, add a Streamable HTTP server named `couple_finance`,
set its URL to the endpoint above and its Authorization header to
`Bearer <connection-key>`. Keep the key out of prompts and version control.
For config.toml, a local environment variable can be used instead:

```toml
[mcp_servers.couple_finance]
url = "https://<production-domain>/api/mcp"
bearer_token_env_var = "FINANCE_MCP_TOKEN"
```

Restart/reconnect the client to load the tools. Revoke a connection by removing
or replacing `MCP_TOKEN_SHA256` in Production and redeploying; remove the client
configuration too. The key grants access to this shared household ledger,
including both partners' records. Give a spouse a separately managed client key
only after adding multiple-key support; this version has one revocable key.

## Tools

- get_finance_context: Casablanca date and supported operations.
- get_accounts: active account balances, which may combine bank and cash.
- list_categories: category IDs, ownership, available money and snoozed state.
- list_transactions: complete activity in a bounded date range, optionally filtered.
- get_monthly_report: scoped net spending, assignments and plan variance.
- record_expense: live budget gate and savings holding-account validation.
- record_income: ordinary contribution-covering income into an active account.
- rebalance_budget: current-month moves within one wallet; protects unpaid bills
  and excludes savings. This changes available money, not monthly assignments.

Writes only create ledger records. They do not execute payments or bank transfers.
No delete, arbitrary Notion query, account transfer, or bulk mutation is exposed.

## Reliability and boundaries

Authentication runs before parsing, tool discovery, DB access or finance calls,
even on localhost. App browser cookies and Shortcut tokens do not grant MCP access.
Only the exact `/api/mcp` path bypasses session middleware and authenticates itself.
Cross-origin browser requests are rejected; request bodies are bounded to 64 KiB.
Exact cents remain in results and budget validation. IDs must come from the
configured account/category databases. All write preflights read live Notion data.
Writes use existing mirror invalidation and refresh hooks.

Every write requires a UUID requestId. Postgres `finance_mcp_operations` claims
it before execution, binds it to the tool/inputs and stores the confirmed receipt.
The table is initialized automatically, with the same DATABASE_URL as the mirror.
Concurrent/repeated requests cannot repeat the write; an altered payload under an
existing ID is rejected. A pending/unknown result remains blocked even after a
process restart. Inspect Notion/app activity to resolve an unknown outcome; never
blindly retry with a fresh ID. As with normal app writes, external simultaneous
edits can still race budget checks; MCP does not provide a bank-style transaction
across Notion and Postgres. Operation receipts are private ledger data.

Deployments require the existing NOTION_TOKEN and DATABASE_URL plus the new digest.
Check unauthorized requests, initialization, tools/list and read-only calls in
production. Exercise mutations with mocked Notion in tests rather than adding
fake expenses to the live household ledger.
