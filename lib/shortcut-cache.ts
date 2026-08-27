import type { ShortcutOptions } from "@/lib/shortcut-options";

const CACHE_KEY = "notion-expense:shortcut-options:v1";
const DEFAULT_TTL_SECONDS = 60 * 60;

export type ShortcutOptionsCacheEnvelope = {
  version: 1;
  updatedAt: string;
  options: ShortcutOptions;
};

type CacheBackend = "redis" | "memory";

const memoryStore = new Map<string, string>();

function cacheTtlSeconds(): number {
  const parsed = Number(process.env.SHORTCUT_OPTIONS_CACHE_TTL_SECONDS);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_TTL_SECONDS;
}

function redisConfig(): { url: string; token: string } | null {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ??
    process.env.KV_REST_API_URL ??
    process.env.UPSTASH_REDIS_REST_KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ??
    process.env.KV_REST_API_TOKEN ??
    process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

function backend(): CacheBackend {
  return redisConfig() ? "redis" : "memory";
}

async function redisCommand(command: string[]): Promise<unknown> {
  const config = redisConfig();
  if (!config) throw new Error("Redis cache is not configured");

  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Shortcut cache request failed with status ${response.status}`);

  const data = await response.json();
  if (data.error) throw new Error(String(data.error));
  return data.result;
}

async function readRaw(): Promise<{ raw: string | null; backend: CacheBackend }> {
  if (backend() === "memory") return { raw: memoryStore.get(CACHE_KEY) ?? null, backend: "memory" };

  try {
    const result = await redisCommand(["GET", CACHE_KEY]);
    return { raw: typeof result === "string" ? result : null, backend: "redis" };
  } catch (error) {
    console.warn("Shortcut cache Redis read failed; using process-memory fallback.", error);
    return { raw: memoryStore.get(CACHE_KEY) ?? null, backend: "memory" };
  }
}

export async function readShortcutOptionsCache(): Promise<{
  cache: ShortcutOptionsCacheEnvelope | null;
  backend: CacheBackend;
  stale: boolean;
}> {
  const { raw, backend: usedBackend } = await readRaw();
  if (!raw) return { cache: null, backend: usedBackend, stale: false };

  try {
    const parsed = JSON.parse(raw) as ShortcutOptionsCacheEnvelope;
    if (parsed.version !== 1 || !parsed.updatedAt || !parsed.options) {
      return { cache: null, backend: usedBackend, stale: false };
    }
    const ageSeconds = (Date.now() - Date.parse(parsed.updatedAt)) / 1000;
    return {
      cache: parsed,
      backend: usedBackend,
      stale: !Number.isFinite(ageSeconds) || ageSeconds > cacheTtlSeconds(),
    };
  } catch (error) {
    console.warn("Shortcut cache contained invalid data; treating it as empty.", error);
    return { cache: null, backend: usedBackend, stale: false };
  }
}

export async function writeShortcutOptionsCache(
  options: ShortcutOptions,
): Promise<{ updatedAt: string; backend: CacheBackend }> {
  const envelope: ShortcutOptionsCacheEnvelope = {
    version: 1,
    updatedAt: new Date().toISOString(),
    options,
  };
  const raw = JSON.stringify(envelope);

  memoryStore.set(CACHE_KEY, raw);
  if (backend() === "memory") return { updatedAt: envelope.updatedAt, backend: "memory" };

  try {
    await redisCommand(["SET", CACHE_KEY, raw]);
    return { updatedAt: envelope.updatedAt, backend: "redis" };
  } catch (error) {
    console.warn("Shortcut cache Redis write failed; retaining process-memory fallback.", error);
    return { updatedAt: envelope.updatedAt, backend: "memory" };
  }
}

export function shortcutCacheTtlSeconds(): number {
  return cacheTtlSeconds();
}
