import { NextResponse } from "next/server";
import { mirrorReadContext } from "./context";
import { mirrorScope, mirrorStore } from "./store";
import { scheduleMirrorSync } from "./sync";

type Handler = (...args: any[]) => Promise<Response>;
/** Opt in only display reads. Write validation always uses live Notion data. */
export function withMirrorReads<T extends Handler>(handler: T): T {
  return (async (...args: Parameters<T>) => {
    const context = { enabled: true, sources: new Set<string>(), syncedAt: [] as string[], databases: new Map() };
    return mirrorReadContext.run(context, async () => {
      const response = await handler(...args);
      response.headers.set("Cache-Control", "private, no-store");
      response.headers.set("X-Finance-Data-Source", context.sources.size === 1 ? [...context.sources][0] : "mixed");
      if (context.syncedAt.length) response.headers.set("X-Finance-Synced-At", context.syncedAt.sort()[0]);
      return response;
    });
  }) as T;
}
/** Fence the snapshot before ANY write, including legacy raw-fetch handlers. */
export function withMirrorMutation<T extends Handler>(handler: T): T {
  return (async (...args: Parameters<T>) => {
    const token = process.env.NOTION_TOKEN;
    const store = mirrorStore();
    if (!token || !store) return handler(...args);
    const scope = mirrorScope(token);
    let writeId: string;
    try { writeId = await store.beginWrite(scope); }
    catch { return NextResponse.json({ error: "Could not verify balances before saving. Try again." }, { status: 503 }); }
    try {
      return await mirrorReadContext.run({ enabled: false, sources: new Set(), syncedAt: [], databases: new Map() }, () => handler(...args));
    } finally {
      try { await store.finishWrite(scope, writeId); }
      catch { console.error("Financial sync write fence could not close; snapshot stays invalid"); }
      scheduleMirrorSync(token, true);
    }
  }) as T;
}
