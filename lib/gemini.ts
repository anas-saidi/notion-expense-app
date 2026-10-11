import { aiError } from "./finance-ai";

/** Server-only, one bounded request. No grounding, retries or paid fallback. */
export async function generateFinanceJSON(instructions: string, context: unknown, schema: unknown) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw aiError("Gemini isn't configured yet. Add GEMINI_API_KEY on the server. Local transaction parsing still works.", 503);
  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  if (!/^gemini-[a-z0-9.-]+$/.test(model)) throw aiError("Invalid GEMINI_MODEL configuration.", 503);
  let response: Response;
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST", cache: "no-store", signal: AbortSignal.timeout(25000),
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: instructions }] }, contents: [{ role: "user", parts: [{ text: JSON.stringify(context) }] }],
        generationConfig: { responseMimeType: "application/json", responseJsonSchema: schema, maxOutputTokens: 8192 } }),
    });
  } catch { throw aiError("Gemini couldn't be reached. Your draft is kept; try again or use local parsing.", 503); }
  if (response.status === 429) throw aiError("Gemini's request limit was reached. Try later; local transaction parsing still works.", 429);
  if (!response.ok) throw aiError("Gemini is unavailable. Check the server API key and model access, or try again later.", 503);
  try {
    const body = await response.json();
    const candidate = body.candidates?.[0];
    if (candidate?.finishReason !== "STOP") throw new Error("Incomplete output");
    const text = candidate.content?.parts?.filter((p: any) => !p.thought && typeof p.text === "string").map((p: any) => p.text).join("");
    return JSON.parse(text);
  } catch { throw aiError("Gemini couldn't produce a complete draft. Nothing was changed. Try a shorter request.", 502); }
}
