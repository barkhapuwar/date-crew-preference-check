import { REASONS, REASON_BY_ID } from "./taxonomy";

export type Tag = { id: string; label: string; evidence: string };
export type TagResult = { tags: Tag[]; source: "gemini" | "keyword"; note?: string };

// Fallback so the demo keeps working with no API key or when the free tier is rate limited.
const RULES: [string, RegExp][] = [
  ["age", /\b(age|older|younger|too old|too young)\b/i],
  ["height", /\b(height|tall|taller|shorter)\b/i],
  ["location", /\b(city|far|distance|relocat\w*|location|different city|close to|nearby|stays? near)\b/i],
  ["religion", /\b(religio\w*|communit\w*|caste|faith)\b/i],
  ["diet", /\b(vegetarian|non-?veg\w*|diet|food|meat)\b/i],
  ["smoking", /\b(smok\w*|cigarette\w*)\b/i],
  ["drinking", /\b(drink\w*|alcohol\w*)\b/i],
  ["children", /\b(kids?|child\w*)\b/i],
  ["marital_status", /\b(married|marriage|divorc\w*|widow\w*|marital)\b/i],
  ["education", /\b(education|degree|qualif\w*|graduate|postgraduate)\b/i],
  ["looks", /\b(photos?|pictures?|looks?|attract\w*|appearance)\b/i],
  ["no_spark", /\b(spark|click\w*|connection|chemistry|vibe)\b/i],
];

export function keywordTag(text: string): TagResult {
  const tags: Tag[] = [];
  for (const [id, re] of RULES) {
    const m = text.match(re);
    if (m) tags.push({ id, label: REASON_BY_ID[id].label, evidence: m[0] });
  }
  if (tags.length === 0) tags.push({ id: "other", label: REASON_BY_ID.other.label, evidence: "" });
  return { tags, source: "keyword" };
}

const SYSTEM = `You label a client's rejection message from a matchmaking service.
Pick every reason that applies from this fixed list, using the exact ids:
${REASONS.map((r) => `- ${r.id}: ${r.label}`).join("\n")}
Rules:
- Use only ids from the list. Use "other" only if nothing else fits.
- "no_spark" is for a lack of chemistry or connection with no specific attribute named.
- "evidence" is a short quote from the message that supports the id.
- Return JSON only.`;

export async function geminiTag(text: string, apiKey: string, model: string): Promise<TagResult> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: "user", parts: [{ text: `Message: """${text}"""` }] }],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            tags: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: { id: { type: "STRING", enum: REASONS.map((r) => r.id) }, evidence: { type: "STRING" } },
                required: ["id", "evidence"],
              },
            },
          },
          required: ["tags"],
        },
      },
    }),
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const body = await res.json();
  const raw = body?.candidates?.[0]?.content?.parts?.[0]?.text;
  const parsed = JSON.parse(raw) as { tags?: { id: string; evidence?: string }[] };
  const tags = (parsed.tags ?? [])
    .filter((t) => REASON_BY_ID[t.id])
    .map((t) => ({ id: t.id, label: REASON_BY_ID[t.id].label, evidence: t.evidence ?? "" }));
  if (tags.length === 0) tags.push({ id: "other", label: REASON_BY_ID.other.label, evidence: "" });
  return { tags, source: "gemini" };
}
