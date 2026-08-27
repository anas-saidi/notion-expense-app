import {
  fetchShortcutOptions,
  type ShortcutOptions,
} from "@/lib/shortcut-options";
import {
  readShortcutOptionsCache,
  shortcutCacheTtlSeconds,
  writeShortcutOptionsCache,
} from "@/lib/shortcut-cache";

export async function refreshShortcutOptionsCache() {
  const options = await fetchShortcutOptions();
  const stored = await writeShortcutOptionsCache(options);
  return {
    options,
    updatedAt: stored.updatedAt,
    backend: stored.backend,
  };
}

export async function getShortcutOptionsSnapshot(): Promise<{
  options: ShortcutOptions;
  updatedAt: string;
  stale: boolean;
  backend: "redis" | "memory";
}> {
  const cached = await readShortcutOptionsCache();
  if (cached.cache) {
    return {
      options: cached.cache.options,
      updatedAt: cached.cache.updatedAt,
      stale: cached.stale,
      backend: cached.backend,
    };
  }

  const refreshed = await refreshShortcutOptionsCache();
  return {
    options: refreshed.options,
    updatedAt: refreshed.updatedAt,
    stale: false,
    backend: refreshed.backend,
  };
}

export function shortcutOptionsAgeSeconds(updatedAt: string): number {
  return Math.max(0, Math.floor((Date.now() - Date.parse(updatedAt)) / 1000));
}

export { shortcutCacheTtlSeconds };
