import { afterEach, expect, it, vi } from "vitest";
import { generateFinanceJSON } from "./gemini";
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it("does not make requests without a configured key", async () => {
  vi.stubEnv("GEMINI_API_KEY", "");
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  await expect(generateFinanceJSON("", {}, {})).rejects.toMatchObject({ status: 503 });
  expect(fetcher).not.toHaveBeenCalled();
});
it("uses a server header and bounded JSON generation without extra tools", async () => {
  vi.stubEnv("GEMINI_API_KEY", "test-secret"); vi.stubEnv("GEMINI_MODEL", "gemini-3.5-flash-lite");
  const fetcher = vi.fn().mockResolvedValue(Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: '{"ok":true}' }] } }] }));
  vi.stubGlobal("fetch", fetcher);
  expect(await generateFinanceJSON("parse", { text: "coffee 12" }, { type: "object" })).toEqual({ ok: true });
  const [url, init] = fetcher.mock.calls[0];
  expect(url).not.toContain("test-secret");
  expect(init.headers["x-goog-api-key"]).toBe("test-secret");
  expect(JSON.parse(init.body).tools).toBeUndefined();
});
it("preserves rate limit errors without retrying or switching models", async () => {
  vi.stubEnv("GEMINI_API_KEY", "test-secret");
  const fetcher = vi.fn().mockResolvedValue(new Response("", { status: 429 })); vi.stubGlobal("fetch", fetcher);
  await expect(generateFinanceJSON("", {}, {})).rejects.toMatchObject({ status: 429 });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("rejects truncated responses instead of accepting a partial draft", async () => {
  vi.stubEnv("GEMINI_API_KEY", "test-secret");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [{ text: '{"ok":true}' }] } }] })));
  await expect(generateFinanceJSON("", {}, {})).rejects.toMatchObject({ status: 502 });
});
