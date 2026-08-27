# Apple Shortcut: Add a transaction

This workflow adds an expense directly to the authenticated server and Notion
without opening the web app. It uses a dedicated `SHORTCUT_API_TOKEN`; never
put `NOTION_TOKEN` in a Shortcut.

## Server setup

Set these Vercel environment variables for the same deployment:

- `SHORTCUT_API_TOKEN`: a random secret shared only with the Shortcut.
- `CRON_SECRET`: a different random secret used by Vercel Cron.
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`: recommended for a
  shared cache. `KV_REST_API_URL` and `KV_REST_API_TOKEN` are accepted as the
  legacy Vercel KV names. If the Vercel Upstash integration adds a custom
  prefix, its generated `<PREFIX>_KV_REST_API_URL` and
  `<PREFIX>_KV_REST_API_TOKEN` names are accepted as well.
- `SHORTCUT_OPTIONS_CACHE_TTL_SECONDS`: optional; defaults to `3600`.

The cache refreshes daily at 03:00 UTC through
`GET /api/shortcuts/cache/refresh` because Vercel's Hobby plan permits one
scheduled run per day. Vercel authenticates that request with
`Authorization: Bearer <CRON_SECRET>`. The options endpoint serves a stale
cached value, marked with `cache.stale: true` and the
`X-Shortcut-Options-Stale: true` header, while the next scheduled refresh is
pending. If no cache exists, it fetches the active Notion categories/accounts
on demand. A write will refresh a stale cache first and will not create a
transaction if that refresh fails.

## Shortcut actions

Create a new Shortcut with these actions:

1. **Ask for Input** — prompt `What did you spend?`, input type **Text**.
2. **Ask for Input** — prompt `Amount (MAD)`, input type **Number**.
3. **Get Contents of URL** — use `https://YOUR-DOMAIN/api/shortcuts/options`.
   Set method to **GET** and add header `Authorization` with value
   `Bearer YOUR_SHORTCUT_API_TOKEN`.
4. **Get Dictionary Value** — get `categories` from the options response.
5. **Repeat with Each** category — inside the repeat, **Get Dictionary Value**
   `name` and append it to a `Category Names` list.
6. **Choose from List** — choose from `Category Names`; save the result as
   `Chosen Category`.
7. **Get Dictionary Value** — get `accounts` from the options response.
8. **Repeat with Each** account — inside the repeat, **Get Dictionary Value**
   `name` and append it to an `Account Names` list.
9. **Choose from List** — choose from `Account Names`; save the result as
   `Chosen Account`.
10. **Current Date** — format it as `yyyy-MM-dd`.
11. **Dictionary** — create these keys:

   ```text
   name: [What did you spend?]
   amount: [Amount (MAD)]
   category: [Chosen Category]
   account: [Chosen Account]
   date: [Formatted Current Date]
   ```

12. **Get Contents of URL** — use
   `https://YOUR-DOMAIN/api/shortcuts/transactions`. Set method to **POST**,
   request body to **JSON**, use the Dictionary from the previous action, and
   add `Authorization: Bearer YOUR_SHORTCUT_API_TOKEN` and
   `Content-Type: application/json` headers.
13. **Get Dictionary Value** — get `success` from the POST response.
14. **If** `success` is `true`, **Show Notification** — `Saved [Amount (MAD)]
    MAD to [Chosen category → name]`. Otherwise show the response's `error`
    value.

The POST endpoint also accepts `categoryId`/`accountId` if you prefer to carry
the chosen dictionaries through the Shortcut. Names are matched
case-insensitively and only against the cached active options; ambiguous names
are rejected.

## Endpoint contract

`GET /api/shortcuts/options` returns only the fields Shortcuts need:

```json
{
  "categories": [{ "id": "...", "name": "Food", "icon": "🍽️" }],
  "accounts": [{ "id": "...", "name": "Checking", "icon": "🏦", "type": "Bank" }],
  "cache": { "updatedAt": "2026-08-27T12:00:00.000Z", "ageSeconds": 30, "stale": false, "ttlSeconds": 3600 }
}
```

`POST /api/shortcuts/transactions` requires `name`, a positive numeric
`amount`, `categoryId` or `category`, `accountId` or `account`, and an ISO
`date` (`YYYY-MM-DD`). It returns the created transaction plus the resolved
category and account names for the confirmation step.

For a lightweight local check, start the app and run:

```bash
curl -i -H "Authorization: Bearer $SHORTCUT_API_TOKEN" \
  http://localhost:3000/api/shortcuts/options

curl -i -X POST \
  -H "Authorization: Bearer $SHORTCUT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test transaction","amount":1,"category":"Food","account":"Checking","date":"2026-08-27"}' \
  http://localhost:3000/api/shortcuts/transactions
```
