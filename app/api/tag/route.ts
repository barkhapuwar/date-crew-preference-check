import { geminiTag, keywordTag } from "@/lib/tagger";

// Very small per-IP limit so a public demo cannot burn the free-tier key.
const hits = new Map<string, number[]>();
const LIMIT = 30;
const WINDOW_MS = 60 * 60 * 1000;

function limited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > LIMIT;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const text = typeof body.text === "string" ? body.text.trim().slice(0, 1000) : "";
  if (!text) return Response.json({ error: "Paste the client's message first." }, { status: 400 });

  const key = process.env.GEMINI_API_KEY;
  // Try the configured model first, then current low-cost models, so a retired model name does not break the demo.
  const models = Array.from(new Set([process.env.GEMINI_MODEL, "gemini-3.5-flash-lite", "gemini-3.5-flash"].filter((m): m is string => !!m)));
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";

  if (!key) return Response.json({ ...keywordTag(text), note: "No API key set, using the keyword fallback." });
  if (limited(ip)) return Response.json({ ...keywordTag(text), note: "Demo limit reached, using the keyword fallback." });
  for (const model of models) {
    try {
      return Response.json(await geminiTag(text, key, model));
    } catch {
      // try the next model
    }
  }
  return Response.json({ ...keywordTag(text), note: "The AI call failed, using the keyword fallback." });
}
