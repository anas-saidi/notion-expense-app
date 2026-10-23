# Build 5: offline editing and Wi-Fi sync

Transaction saves now persist on the phone and upload automatically on Wi-Fi. New and edited rows show “Waiting to sync”; balances retain their last synced values until Notion confirms the queued requests. Drafts & sync contains waiting changes and anything needing review. Manual drafts still wait for an explicit send.

Background sync is scheduled through iOS; its timing is controlled by the system. Opening the app on Wi-Fi also resumes uploads. Keep the existing AltStore-managed app when installing `ios/build/CoupleFinance.ipa` so its connection, cached data and queue survive. The backend detects stale offline transaction edits before writing them. See [offline sync details](../docs/native-offline-sync.md).

# Build 4: personal spending included in due

Personal-budget expenses paid from Joint now appear as debt owed by that budget's owner. It appears only in the existing amount due, without extra notices in Home or transaction entry. A later personal-to-Joint transfer repays outstanding personal spending first; only its remainder counts toward the household contribution. The live backend carries debt across months and recalculates edits, deletion and archived budgets. Funded savings remain separate.

The app uses the same server calculation as the PWA. Older cached snapshots and backups remain readable; refresh to load the new fields. Build 4 is packaged at `ios/build/CoupleFinance.ipa` for an AltStore update. Keep the existing managed app so its connection and data survive.

Verified: 38 native unit tests, all four native UI journeys (including Home debt), and the Release iPhone build. The preview journey ignores saved simulator connection settings without deleting them. Physical installation is pending because the iPhone was unavailable during this update.

# Couple Finance — native iOS app

SwiftUI screens backed by the existing Notion finance server. This is a personal-device app, with no App Store publishing, paid membership requirement, CloudKit, app extensions, or third-party iOS packages.

## Current delivery status

The iOS app owns its SwiftUI interface, tab navigation, sheets, forms, charts, local parsing, drafts, and SwiftData storage. It does not embed a browser, WebKit, the PWA, or JavaScript UI. Notion is reached through the existing protected finance server so integration secrets stay off the phone.

Implemented native surfaces include Home and the wallet character, partner contributions, Budget/category detail, category create/edit/freeze/archive, monthly planning with partner-capacity checks, category top-ups/releases, savings deposits/withdrawals/deposit undo, bill schedules and payments, pending purchases, account activity/reconciliation, manual and typed transactions, Gemini draft parsing and rebalance suggestions, month/range activity, Swift Charts spending breakdowns, appearance/work-time settings, sync, and Files backup/restore. There is no **Open full finance app** task-completion fallback.

Choose **Explore a sample household** on the connection screen to review native flows without credentials. The sample has its own in-memory repository and is clearly labeled. Its saves cannot write to Notion or modify the live repository; it is discarded when the preview is exited. Local sample behavior is a review aid, not verification of the deployed financial integration. Gemini requires a configured live connection.

Verification: a full Xcode simulator build, 31 native unit tests, and three automated native UI journeys passed, including sample/live isolation, request replay, added-workflow backups, typed parsing, and planning capacity. The complete backend suite passes 536 tests, with TypeScript checking. Home and planning were inspected in the iPhone simulator; the UI journey opened Budget, the editable planner, and Insights and verified that no web views were present. Live Notion writes, physical-device signing, renewal, update continuity, and exhaustive accessibility/interaction checks across every new flow still require verification. The detailed feature map is [NATIVE_PARITY.md](NATIVE_PARITY.md); it is not a claim of exhaustive behavioral parity.

Personal Team `6BA3YQ63RC` is configured with the user's Apple Account. The native backend is deployed at `https://notion-expense-app.vercel.app`. On 2026-10-22 the app was installed on the user's iPhone 13 (iOS 27.0.1), connected to live data, and migrated to AltStore Classic. AltStore refresh and app reopening were verified with the saved household data and connection intact. Background renewal is enabled; a future unattended background run has not yet been observed.

## 1. Finish Xcode setup

Xcode setup and its license have been completed on this Mac. Open `/Applications/Xcode.app` for project signing or additional simulator runtimes. In Xcode Settings → Locations, choose Xcode's command-line tools. Install a simulator runtime if required.

The project targets iOS **26.0 or later**, matching the installed iOS 26.5 simulator and the available Swift 6.4 / iOS 27.1 SDK. Newer APIs are only used where supported by that minimum. Deployment target is explicit rather than assuming the phone already runs iOS 27.

Open `ios/CoupleFinance.xcodeproj`. The generated project is included so XcodeGen is optional. Regenerate after changing the source/file structure with:

```sh
xcodegen generate --spec ios/project.yml
```

Simulator verification after Xcode setup:

```sh
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcodebuild \
  -project ios/CoupleFinance.xcodeproj -scheme CoupleFinance \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  -derivedDataPath ios/DerivedData CODE_SIGNING_ALLOWED=NO test
```

Use an installed device name from Xcode if this simulator is unavailable. Inspect the actual rendered Home, connection, transaction sheet, long category names, largest Dynamic Type, dark mode, and keyboard flow. Home and the month-planning form were inspected; the other listed device/accessibility permutations remain to be checked.

## 2. Connect the existing backend

Phone backend (2026-10-22): the authenticated native API is live at `https://notion-expense-app.vercel.app`. Its dedicated device-key hash is configured in Vercel Production. Deployment `dpl_DvmXTjL3paQMTEpG3QiK6GdcPaKq` was built from production revision `ff955ec` plus native APIs and their shared backend dependencies. The full 536-test backend suite passed; the isolated deployment passed strict TypeScript checking. Before promotion, its snapshot returned real data, malformed saves returned HTTP 400, and invalid keys returned HTTP 401. The public production origin returned a valid live snapshot after promotion. No financial records were changed for deployment verification. The prior deployment was `dpl_6xY4swvaypLnsxuW8UCURSnEyGGE`.

The private phone connection setup is stored in ignored `.codex/phone-setup/connection.json` with restricted permissions. It is not part of the app bundle, Git, or the deployment. For USB setup, transfer it into the installed app's private Documents directory as `.connection-setup.json`, then launch with `--configure-device`. The app validates the server by loading a snapshot, stores the key in Keychain, and deletes the temporary setup file. Later launches use the saved connection normally. This helper is compiled into Debug builds and personal IPA builds with the explicit `PERSONAL_INSTALL_SETUP` condition; ordinary Release builds omit it.

Simulator live connection (2026-10-22): connected to the existing backend credentials on this Mac through `http://localhost:4340`. **Saving edits updates the live Notion ledger.** The initial read-only restriction was removed at the user's request. Start this connection with `node ios/scripts/start-live-server.cjs`; the server must remain running. It exposes only the authenticated native API routes, including operations, assistant and explicit sync. This is a simulator development connection; phone use still requires deploying the HTTPS backend below. The simulator stores its separate device key in Keychain; no Notion secret is copied into the app. Temporary credentials and logs are private files under `/tmp/finance-live-preview/`.

Only Debug simulator builds accept an HTTP origin, and only for the literal `localhost` host. Device and Release builds continue to require HTTPS. The Debug simulator startup option `--connect-local-preview` reads `FINANCE_LOCAL_PREVIEW_KEY` from its launch environment and connects to that fixed loopback address; neither a key nor a server secret is embedded in the app. Build the live simulator app with normal ad hoc signing (`CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=-`): unsigned test builds lack the simulated application identifier required by Keychain.

Live connection verification: 36 native unit tests passed; a signed simulator build loaded the current month's real accounts, categories, transactions and bills. All 19 focused backend tests passed for native operations, resources, authentication and duplicate-save tracking. The live database's operation table is available and write permissions were checked using a rolled-back probe. Authenticated malformed saves reach backend validation (HTTP 400); invalid keys are rejected (HTTP 401). No arbitrary financial record was changed for testing. A real user-selected edit still needs its first save in the app.

Deploy the native API endpoints with the finance server changes:

- `GET /api/native/snapshot?month=YYYY-MM`: a versioned finance snapshot. It calls existing account/category/monthly-summary/bill handlers and uses the existing scope and contribution rules.
- `POST /api/native/operations`: explicitly allowlisted native finance commands, including planning, savings, category/bill management, pending purchases and reconciliation. Arbitrary route forwarding is not permitted.
- `GET /api/native/resources?kind=…`: protected planning/funds, pending, category timeline, scoped transaction history, bills, or sync status.
- `POST /api/native/resources?kind=sync`: explicit Notion import.
- `POST /api/native/assistant`: explicit Gemini parsing/suggestions; never a financial write.

All native endpoints require a separate bearer device key even in local development. Web sessions, Shortcut tokens, and MCP tokens do not grant native access. Server authentication stores only the key's SHA-256 hash. HTTPS is required by the iOS client; redirects are rejected, cookies are disabled, and credentials are never embedded in the app bundle or backup.

Generate a key yourself, locally:

```sh
python3 ios/scripts/create-device-key.py
```

Keep the raw key private. Add the printed `NATIVE_TOKEN_SHA256` to the backend deployment's environment, alongside its existing Notion configuration, and redeploy. Keep `DATABASE_URL` configured: native writes deliberately require the existing Postgres operation ledger. Without durable tracking, writes fail closed. Read-only use can work without that ledger. Keep the ledger through backend migrations; clearing it removes the server's duplicate-request protection.

On the phone: Settings → enter your deployed HTTPS finance-app origin and the raw device key → **Connect securely**. No Notion integration secret belongs on the phone. Rotating the server hash revokes the old key; reconnect with the replacement key.

Pull to refresh reloads the finance snapshot through the existing mirror freshness policy. Direct Notion changes follow the existing server sync behavior; use **Sync now** in native Settings when an immediate full import is needed. Snapshot time is when the client received the snapshot, not proof that every cached upstream rollup was freshly read from Notion.

## 3. Install with a free Personal Team

Choose a stable identity before the first real install:

- Bundle identifier: `com.anassaidi.couplefinance` (set in `project.yml` and the Xcode target).
- Signing: Automatic, with the same Apple Account / Personal Team on every build.
- No CloudKit/iCloud container, push notification, associated-domain, or shared-Keychain entitlement is requested.

First physical installation verified on 2026-10-22: Developer Mode enabled, device paired, Personal Team signing profile created, app installed, and user trusted the developer profile. The signed bundle and its entitlements validated successfully. USB connection setup loaded live finances and removed its temporary credentials file (Documents empty afterward). A second normal launch without setup arguments displayed the live balance and bills. Saves are enabled against the online API; no financial record was changed solely for installation testing. The Mac preview server is not needed for this phone connection.

The original Xcode profile `3366a007-4f66-4e36-8efb-1e8bc579587b` expires **2026-10-29 at 18:08 Africa/Casablanca** (17:08 UTC). The AltStore-managed copy described below renews separately; use AltStore's My Apps expiry counter for that copy. Do not delete an app to renew its signing.

In Xcode Settings → Accounts, add your Apple Account and accept required developer terms. Select your Personal Team under Signing & Capabilities. Connect and trust the iPhone, enable Developer Mode when prompted, choose it as the run destination, and run. Never delete a real installation simply to fix signing.

A free Personal Team profile expires seven days after issuance. Expiration affects launching, not the app's normal runtime speed, and does not by itself erase the data container. Keep backups: continuity depends on the app identity and installation path. [Apple's account and Personal Team limits](https://developer.apple.com/help/account/basics/about-your-developer-account).

## 4. AltStore Classic renewal — configured

Configured on 2026-10-22: notarized AltServer installed on the Mac and updated to **1.8.2**; **AltStore Classic 2.3.1** installed on the iPhone using the same Apple Account / Personal Team. The user completed Remote AltServer and LocalDevVPN setup. AltStore's Background Refresh switch was observed enabled. The user ran **Refresh All** successfully; both AltStore and Couple Finance were then observed in My Apps with **7 DAYS** remaining. The user subsequently confirmed another successful refresh with Mac AltServer closed. This confirms explicit remote refresh, not that a future unattended background refresh has already run.

For renewal without the Mac, keep **Wi-Fi and LocalDevVPN connected**. Remote AltServer supports refreshing from Wi-Fi without the Mac running. Background execution remains controlled by iOS. If the expiry counter gets low, open AltStore → My Apps → **Refresh All** and confirm success. AltServer remains installed as a Mac/USB fallback; Mac login startup and Finder Wi-Fi sync were not configured. See [Remote AltServers](https://faq.altstore.io/altstore-classic/remote-altservers) and [background refresh](https://faq.altstore.io/altstore-classic/your-altstore).

### Installed identities and migration

- Source bundle ID: `com.anassaidi.couplefinance` — keep this unchanged in the Xcode project.
- AltStore-managed installed ID: `com.anassaidi.couplefinance.6BA3YQ63RC`.
- AltStore installed ID: `com.6BA3YQ63RC.com.rileytestut.AltStore`.
- Managed app: version **1.0.0, build 2**.

AltStore created a separate copy instead of overwriting the Xcode app. The original remains installed as a fallback. Open the managed copy through **AltStore → My Apps → Couple Finance** to distinguish it. No original installation was deleted.

Before migration, the app's private SwiftData store and preferences were copied to ignored `.codex/phone-backups/2026-10-22-before-altstore/`; a portable `finance-backup.json` was extracted and validated. SQLite integrity was `ok`, with one cached month and zero unsent drafts. Cached data/preferences were transferred into the managed copy; its device key was re-established through the one-time USB setup. After an AltStore update and refresh, a second verified backup is in `.codex/phone-backups/2026-10-22-after-altstore/`. Integrity, household identity, cached months and draft identities matched. The managed app reopened normally with its saved live connection. No financial records were changed to test renewal.

AltStore attempts refresh during the week, but it is best effort. Open AltStore → My Apps → **Refresh All** before day seven and confirm the new expiry date. Free-account limits include AltStore itself: the current documentation describes three active sideloaded apps; App ID limits may also constrain signing. [AltStore refresh and app limits](https://faq.altstore.io/altstore-classic/your-altstore), [AltServer connectivity and startup](https://faq.altstore.io/altstore-classic/altserver).

Signing renewal and delivering a new app version are separate. A new Xcode build does not automatically become an AltStore update.

### Packaging a new build

After Xcode setup, create an unsigned device IPA locally for AltStore to sign:

```sh
ios/scripts/package-ipa.sh
```

The script builds an optimized personal IPA for a physical iPhone without embedding Apple credentials or device keys, enables the one-time USB setup helper, checks the app bundle, and writes `ios/build/CoupleFinance.ipa`. Packaging and installation through AltStore have been exercised. An unsigned IPA is not directly installable with Xcode or Files.

Import future packages through **AltStore → My Apps → +**, using the same Apple Account. AltStore appends the team suffix; do not append it in the source project yourself. An update from build 1 to build 2 and a subsequent refresh were verified with the transferred cache retained. Continue backing up before switching signing methods. Installing directly through Xcode targets the original copy, not the AltStore-managed app.

If the app expires, use the tool's documented refresh/reinstall-over-existing recovery. Do not delete the app. If AltStore expires, [AltServer documents reinstalling AltStore without deleting it first](https://faq.altstore.io/altstore-classic/altserver).

SideStore is an alternative if routine renewal without an available Mac is needed, but no SideStore configuration or automation is included. Verify its current compatibility and setup before switching: [SideStore FAQ](https://docs.sidestore.io/docs/faq).

## 5. Local persistence, backups, and recovery

The store is versioned with `FinanceSchemaV1` and `FinanceMigrationPlan`. Schema errors show a recovery screen; the code never deletes or replaces the database on launch. A future schema change must add a version and explicit migration stage, retain old schema types, and verify an update over an existing installation.

Settings → **Export backup to Files** writes JSON with:

- `format: "couple-finance-backup"`, `version: 1`, `exportedAt`, and a household identifier hash;
- `snapshots`: month-keyed cached account/category/transaction/bill/summary/contribution data;
- `drafts`: stable request UUID, operation, input, creation time, and unconfirmed-outcome flag.

Keys, Apple credentials, server secrets, and signing data are excluded. Exports contain private financial data and are not encrypted by the app; choose a private Files destination. No automatic cloud backup service has been selected or configured.

Restore validates the format/version and draft IDs before any store mutation, merges missing drafts, and keeps the newest cached month. Existing local drafts win on matching UUIDs. A backup carrying a different household identifier is rejected. Restore never submits a financial operation. A 25 MB file limit is enforced. This is a device recovery backup, not a full Notion database export: it contains only months the phone has fetched and local drafts. Notion remains the financial source of truth.

If a save's response is lost, the draft remains **Save unconfirmed**. Check activity, then **Check original request** queries that same operation through the server ledger. A pending/unknown operation is not executed twice. Remove the local draft only after resolving the real outcome. Do not create another copy as a retry. Validation failures may also retain an unconfirmed draft conservatively; resolve the message and activity before starting a corrected operation.

## Acceptance checklist still requiring Xcode/device access

- [x] Complete a full simulator build/test and inspect Home and the month-planning form.
- [ ] Inspect all remaining native flows, dark mode, large text, keyboard behavior and error recovery.
- [x] Install and launch on the user's iPhone with their Personal Team.
- [x] Connect to the deployed backend and verify reads without changing real data unexpectedly.
- [ ] Save a local sample draft, close the app, reopen, and confirm persistence.
- [ ] Export a representative backup; restore it in a safe installation and verify cents, scopes, draft IDs, and no server writes.
- [x] Refresh signing and verify the saved household/cache survives; existing unsent draft count was zero.
- [ ] Install a new build over the existing installation and verify retained data.
- [ ] For a future schema version, test an actual migration without resetting data.
- [ ] Install/configure AltStore Classic if chosen; confirm successful renewal and its expiry date.
- [ ] Observe a background refresh under the actual Mac/phone/network conditions and test manual recovery.

Executable core checks available without simulator testing frameworks:

```sh
ios/scripts/check-core.sh
```

`ios/Tests` also contains Swift Testing cases for backup validation, restore behavior, financial precision, calendar dates, and SwiftData persistence. Run them through the Xcode scheme after first launch. `swift test --package-path ios` requires a toolchain with the Testing module; the current command-line-only selection does not provide it.

## Bill notifications

Open Settings → Notifications → **Enable bill reminders**. iOS asks for notification permission only after that action. Configure day-before, due-date and unpaid follow-up alerts, the reminder hour (Africa/Casablanca), and whether to include bill names/amounts. Names and amounts are hidden by default. **Send a test notification** schedules a generic alert five seconds later. If permission is blocked, use **Open notification settings**.

These are local notifications, compatible with the personal/free signing plan; no push entitlement or server credential is required. iOS delivers scheduled alerts even while the app is closed. Notification presentation still follows the phone's Focus and notification settings.

The app refreshes the current and next month when enabled, on foregrounding and after confirmed writes. It rebuilds at most 60 pending bill requests from the latest verified bill snapshot, independent of the browsed month. Disabling reminders cancels its requests. Paying/skipping/deleting a bill cancels its alerts after a successful refresh. Changes made in Notion or on another device need a later refresh on this phone; local alerts cannot discover those changes while the app stays closed. The app schedules one future unpaid follow-up, which can be renewed at the next app refresh.

Sample household bills never schedule alerts. The explicit generic test can be used in sample mode. Tapping a bill alert opens the relevant month and wallet's Bills screen; it never pays a bill automatically.

### Partner activity push — configuration decision pending

True partner activity alerts while the app is closed require APNs server delivery, the Push Notifications capability, a compatible paid developer team/provisioning profile and server credentials. The original personal setup guide explicitly avoids paid membership. This capability has not been enabled and no paid account, server push credentials or production deployment has been configured. See [Apple's supported iOS capabilities](https://developer.apple.com/help/account/reference/supported-capabilities-ios).

Notification verification (2026-10-22): eight deterministic planner tests cover paid/skipped bills, duplicate occurrence IDs, configurable timing, privacy defaults, overdue handling, month/year boundaries, invalid dates and queue limits. The native UI test explicitly enables permission, schedules and observes a generic banner in the simulator, then disables reminders. Screenshots are in `DesignReview/2026-10-22/notification-settings.png` and `notification-test.png`. Physical-device delivery and live-bill sync still require the phone/backend connection.

## Daily transaction check-in and Siri

Settings → **Daily check-in** enables a daily transaction reminder independently of bill reminders. Its initial time is 21:00 Africa/Casablanca; hour and minute are adjustable. One repeating local request keeps working while the app is closed. The reminder is deliberately unconditional: logging one expense does not prove that the day's entries are complete. Tapping it opens transaction entry; it never saves anything automatically. Daily and bill preferences are stored separately so existing bill settings survive the update.

The native App Shortcut **Log transactions** exposes these Siri phrases:

- “Log transactions in Couple Finance”
- “Add an expense in Couple Finance”

The action requires device authentication and foregrounds the app. It opens the entry form for review, or connection settings if this installation isn't connected. It does not parse spoken amounts or submit ledger writes. It also appears as an action in Shortcuts and can be assigned to a shortcut used with the Action button. No SiriKit Intents extension, restricted Siri entitlement, or paid push capability was added. Siri recognition and discovery still need physical-device verification after installation and first launch.

### Apple Wallet workflow

The generated shortcut source and signing status are documented in [Shortcuts/README.md](Shortcuts/README.md). The native app also accepts `couplefinance://log-transactions`, with unsupported paths and parameters ignored. The link opens the same reviewed entry flow as the App Shortcut.

On a supported iPhone/card, create a personal automation in Shortcuts → Automation → Transaction → choose the Wallet card → add **Log transactions** from Couple Finance. Apple documents this trigger as firing when the selected card is tapped. Device/card behavior and any available transaction fields must be checked on the phone; this implementation only opens entry and does not silently import or save payments. Personal automations must be configured on that iPhone; none was created on the user's phone.

Direct access to financial history is separately governed by FinanceKit. Apple's requirements include approved managed entitlements, an organization developer account, supported financial products/regions and App Store distribution criteria. This personal sideloaded app does not claim access to Wallet card history. See [Wallet transaction triggers](https://support.apple.com/en-euro/guide/shortcuts/apd65c67538a/ios) and [FinanceKit requirements](https://developer.apple.com/financekit/).

Daily check-in verification: all 31 native unit tests and three UI journeys pass, including independent daily reminder enable/disable. App Intents metadata extraction succeeds for `LogTransactionsIntent`. Siri utterance recognition and Wallet card automation remain phone-only checks.
