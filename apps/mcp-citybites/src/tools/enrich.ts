import { z } from "zod";
import { LRUCache } from "lru-cache";
import { normalise, safeParseJsonBlock } from "../utils/text.js";
import { logger } from "../logger.js";

const ENRICH_CACHE_TTL_MS = Number(process.env.PLACE_ENRICH_CACHE_TTL_MS ?? 1000 * 60 * 60 * 6);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

export const PlaceEnrichInputSchema = z.object({
  id: z.string(),
  name: z.string(),
  city: z.string().optional(),
  theme: z.string().optional(),
  description: z.string().optional(),
});

export const PlaceEnrichResultSchema = z.object({
  summary: z.string(),
  highlights: z.array(z.string()),
  bestTime: z.string().optional(),
  localTip: z.string().optional(),
  warning: z.string().optional(),
});

export type PlaceEnrichInput = z.infer<typeof PlaceEnrichInputSchema>;
export type PlaceEnrichOutput = z.infer<typeof PlaceEnrichResultSchema>;

const enrichCache = new LRUCache<string, PlaceEnrichOutput>({ max: 1000, ttl: ENRICH_CACHE_TTL_MS });

export async function handlePlaceEnrich(input: PlaceEnrichInput): Promise<PlaceEnrichOutput> {
  const cacheKey = `${input.id}::${normalise(input.theme ?? "_default")}`;
  const cached = enrichCache.get(cacheKey);
  if (cached) return cached;

  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY manquante");
  }

  const contextDescription = [
    input.city ? `Ville: ${input.city}` : null,
    input.theme ? `Thème: ${input.theme}` : null,
    input.description ? `Notes: ${input.description}` : null,
  ]
    .filter(Boolean)
    .join(" | ") || "Pas d'information supplémentaire";

  const prompt = `Produit un JSON strict décrivant ce lieu selon le schema suivant:\n{\n  \"summary\": string,\n  \"highlights\": string[],\n  \"bestTime\": string (optionnel),\n  \"localTip\": string (optionnel)\n}\n\nLe ton doit être concret, utile pour un guide food/local. Lieu: ${input.name}. ${contextDescription}.`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.4,
        messages: [
          { role: "system", content: "Tu es un expert food & lifestyle, réponds exclusivement en JSON valide." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenAI ${response.status} ${text.slice(0, 200)}`);
    }

    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("Réponse vide du modèle");

    const raw = safeParseJsonBlock(content);
    const parsed = PlaceEnrichResultSchema.parse({
      summary: typeof raw.summary === "string" ? raw.summary : JSON.stringify(raw.summary ?? raw),
      highlights: Array.isArray(raw.highlights) ? raw.highlights.map((item: unknown) => String(item)) : [],
      bestTime: typeof raw.bestTime === "string" ? raw.bestTime : (raw as any).best_time,
      localTip: typeof raw.localTip === "string" ? raw.localTip : (raw as any).local_tip,
    });

    enrichCache.set(cacheKey, parsed);
    return parsed;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn({ msg: 'enrich:failed', id: input.id, error: message });
    throw new Error(message);
  }
}
