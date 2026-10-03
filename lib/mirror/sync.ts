import { waitUntil } from "@vercel/functions";
import { mirrorReadContext } from "./context";
import { mirrorDatabases, mirrorScope, mirrorStore, normalizeDatabaseId, type MirrorSnapshot } from "./store";

type SyncTask = { promise: Promise<unknown>; rerun: boolean };
const globalSync = globalThis as typeof globalThis & {
  financeMirrorSyncs?: Map<string, SyncTask>;
  financeMirrorSyncCooldowns?: Map<string, number>;
};
const syncs = globalSync.financeMirrorSyncs ??= new Map();
const cooldowns = globalSync.financeMirrorSyncCooldowns ??= new Map();
export function scheduleMirrorSync(token: string, settle = false, force = false) {
  if (!mirrorStore()) return;
  const scope = mirrorScope(token);
  const active = syncs.get(scope);
  if (active) { if (settle) active.rerun = true; return; }
  if (!settle && !force && (cooldowns.get(scope) ?? 0) > Date.now()) return;
  cooldowns.set(scope, Date.now() + 60_000);
  const entry: SyncTask = { promise: Promise.resolve(), rerun: false };
  const task = (async () => {
    if (settle) await new Promise(resolve => setTimeout(resolve, 2100));
    return syncMirror(token);
  })().catch(() => console.error("Financial mirror sync failed; live Notion reads remain available"));
  entry.promise = task;
  syncs.set(scope, entry);
  void task.finally(() => {
    if (syncs.get(scope) !== entry) return;
    syncs.delete(scope);
    if (entry.rerun) scheduleMirrorSync(token, true, true);
  });
  waitUntil(task);
}
export async function syncMirror(token: string) {
  return mirrorReadContext.run({ enabled: false, sources: new Set(), syncedAt: [], databases: new Map() }, async () => {
    const store = mirrorStore();
    if (!store) throw new Error("Set DATABASE_URL to enable financial sync");
    const scope = mirrorScope(token);
    const lease = await store.acquire(scope);
    if (!lease) return { syncing: true, syncedAt: null };
    try {
      const { notionFetchJson, queryDatabaseAll } = await import("../notion-api");
      const snapshot: MirrorSnapshot = {};
      // Full, paginated replacement also removes records archived or deleted
      // directly in Notion. Never publish a partially completed import.
      for (const id of Object.values(mirrorDatabases())) {
        const { data: schema } = await notionFetchJson<any>(token, `/databases/${id}`);
        const pages = await queryDatabaseAll(token, id);
        snapshot[normalizeDatabaseId(id)] = { schema, pages };
      }
      const syncedAt = await store.publish(scope, lease, snapshot);
      return { syncing: false, syncedAt };
    } finally { await store.release(scope, lease.id); }
  });
}
