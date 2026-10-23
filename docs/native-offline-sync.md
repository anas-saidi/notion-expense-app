# Native offline editing (build 5)

A configured installation can add, edit and delete cached transactions without an internet connection. Save persists a queued request in the existing SwiftData archive before attempting a network write. New and edited transaction rows appear locally as “Waiting to sync”; cached balances and contribution dues remain authoritative and labelled with their last sync time until Notion confirms the changes. Repeated edits of an unsent transaction coalesce; deleting an unsent creation cancels it without contacting Notion.

Other native save actions use the same durable queue. Previously opened resource screens can use their cached responses offline. A screen that has never loaded its required server data still needs a connection before it can be used. Manual “Keep as draft” entries and imported backups are never automatically sent.

Sync runs in order when a non-expensive Wi-Fi path becomes available, on foreground activation, and during iOS background processing opportunities. POST sessions disallow cellular and expensive network access. BGProcessingTask requests require a network connection and are registered before app launch completes; expiration cancels active work without discarding the saved request. iOS chooses background execution timing, and force-quitting prevents automatic launches until the app is opened again. Opening the app on Wi-Fi also resumes sync.

The device-only Keychain entry is migrated to AfterFirstUnlockThisDeviceOnly so scheduled background work can authenticate after the first unlock following a restart. It remains excluded from iCloud Keychain sync and does not migrate to another device. Before first unlock, syncing waits.

Each request retains its UUID and exact financial payload after the first attempt. Lost responses retry the same server receipt; the existing operation ledger never executes a claimed request twice. After an acknowledged write, only snapshot refresh is retried. Snapshot replacement and request removal are saved atomically. An unresolved server claim, authentication failure, rejected budget check or detected stale edit pauses the queue for review, rather than inventing a new request ID.

Offline transaction edits and deletions carry the cached editable fields as a precondition. The API reads the current Notion page and rejects mismatches before issuing a write. Notion offers no atomic compare-and-swap, so this detects changes visible at the check; it cannot eliminate an edit in the short interval between the check and write. Existing clients without preconditions remain compatible.

Verification uses isolated transports and sample data: persistent queue reload, Wi-Fi gating, local row projection, coalescing/cancellation, stable retries after a lost receipt, refresh-only recovery after acknowledgement, conflict ordering, manual/imported draft isolation and a simulator journey editing a cached transaction offline. No test financial records are written to the live ledger.
