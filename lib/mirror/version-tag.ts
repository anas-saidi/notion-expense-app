import { createHash } from "node:crypto";
import { notionOnlyMode } from "../database-mode";
import { notionLedgerConfigured } from "../notion-ledger";
import { mirrorMaxAgeMs } from "./context";
import { mirrorScope, mirrorStore } from "./store";

export type MirrorVersionTag = { etag: string; syncedAt: string };

/**
 * A validator for a read built only from the stored Notion copy. It changes when
 * the copy's content changes (new generation), on every deploy, every hour (so
 * date-based labels such as "due today" roll over), and per signed-in session.
 * Only when every financial record lives in Notion (Finance Records configured):
 * then a save always changes the copy, and the copy is the only data source.
 */
export async function mirrorVersionTag(request: Request, now = Date.now()): Promise<MirrorVersionTag | null> {
  // Only GET handlers are wrapped (withMirrorReads). Read url and headers first and
  // never request.method: at build time Next.js prerenders with a stand-in request
  // whose url/headers access marks the route dynamic, while .method throws.
  const url = new URL(request.url);
  const cookie = request.headers.get("cookie") ?? "";
  const token = process.env.NOTION_TOKEN;
  if (!token || notionOnlyMode() || !notionLedgerConfigured()) return null;
  const store = mirrorStore();
  if (!store) return null;
  let version: { generation: string; syncedAt: string } | null;
  try { version = await store.version(mirrorScope(token), mirrorMaxAgeMs()); }
  catch { return null; }
  if (!version) return null;
  const session = /(?:^|;\s*)session=([^;]*)/.exec(cookie)?.[1] ?? "";
  const hash = createHash("sha256")
    .update([version.generation, url.pathname + url.search, Math.floor(now / 3_600_000), process.env.VERCEL_GIT_COMMIT_SHA ?? "", session].join("\n"))
    .digest("hex").slice(0, 32);
  return { etag: `W/"${hash}"`, syncedAt: version.syncedAt };
}

export function etagMatches(request: Request, etag: string) {
  const header = request.headers.get("if-none-match");
  if (!header) return false;
  return header.split(",").map(value => value.trim()).some(value => value === etag || value === "*");
}
