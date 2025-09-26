import { z } from "zod";
import { LRUCache } from "lru-cache";
import { normalise } from "../utils/text.js";
import { logger } from "../logger.js";

const DEFAULT_OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/cgi/interpreter",
];

const OVERPASS_ENDPOINTS = (process.env.OVERPASS_ENDPOINTS ?? "")
  .split(",")
  .map((endpoint) => endpoint.trim())
  .filter((endpoint) => endpoint.length > 0);

const NOMINATIM_URL = process.env.NOMINATIM_URL ?? "https://nominatim.openstreetmap.org/search";
const NOMINATIM_CACHE_TTL_MS = Number(process.env.NOMINATIM_CACHE_TTL_MS ?? 1000 * 60 * 60 * 24);

const OVERPASS_USER_AGENT = process.env.OVERPASS_USER_AGENT ?? "CityBitesMCP/0.1 (+https://citybites.ai/contact)";
const OVERPASS_CACHE_TTL_MS = Number(process.env.OVERPASS_CACHE_TTL_MS ?? 1000 * 60 * 60 * 24);

export type ThemeFilter = { key: string; value: string };

const THEME_FILTERS: Array<{ matches: string[]; filters: ThemeFilter[] }> = [
  {
    matches: ["cafe", "café", "coffee", "espresso", "brunch"],
    filters: [
      { key: "amenity", value: "cafe" },
      { key: "amenity", value: "coffee_shop" },
      { key: "amenity", value: "restaurant" },
    ],
  },
  {
    matches: ["restaurant", "food", "diner", "bistro", "street food"],
    filters: [
      { key: "amenity", value: "restaurant" },
      { key: "amenity", value: "fast_food" },
    ],
  },
  {
    matches: ["bar", "cocktail", "night", "pub"],
    filters: [
      { key: "amenity", value: "bar" },
      { key: "amenity", value: "pub" },
    ],
  },
  {
    matches: ["wine", "vin", "cave"],
    filters: [
      { key: "amenity", value: "wine_bar" },
      { key: "shop", value: "wine" },
    ],
  },
  {
    matches: ["dessert", "patisserie", "boulangerie", "sweet"],
    filters: [
      { key: "shop", value: "bakery" },
      { key: "amenity", value: "ice_cream" },
    ],
  },
  {
    matches: ["museum", "musée", "art"],
    filters: [
      { key: "tourism", value: "museum" },
      { key: "tourism", value: "gallery" },
    ],
  },
  {
    matches: ["kids", "famille", "family", "park", "parc"],
    filters: [
      { key: "leisure", value: "park" },
      { key: "tourism", value: "attraction" },
    ],
  },
];

const DEFAULT_FILTERS: ThemeFilter[] = [
  { key: "amenity", value: "restaurant" },
  { key: "amenity", value: "cafe" },
  { key: "amenity", value: "bar" },
];

export type GeocodeResult = {
  label: string;
  lat: number;
  lon: number;
  boundingBox: {
    south: number;
    north: number;
    west: number;
    east: number;
  };
};

export type OverpassElement = {
  id: number;
  type: "node" | "way" | "relation";
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

// Caches (bounded, with TTL)
const geocodeCache = new LRUCache<string, GeocodeResult>({ max: 500, ttl: NOMINATIM_CACHE_TTL_MS });
const overpassCache = new LRUCache<string, OverpassElement[]>({ max: 500, ttl: OVERPASS_CACHE_TTL_MS });

export const PlaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  lat: z.number(),
  lon: z.number(),
  notes: z.string().optional(),
});

export const PlacesSearchSchema = z.object({
  city: z.string(),
  query: z.string().optional(),
});

export const PlacesSearchResultSchema = z.object({
  source: z.string(),
  warning: z.string().optional(),
  results: z.array(PlaceSchema),
});

export type PlacesSearchInput = z.infer<typeof PlacesSearchSchema>;
export type PlacesSearchOutput = {
  source: string;
  warning?: string;
  results: Array<{ id: string; name: string; lat: number; lon: number; notes?: string }>;
};

export function pickFilters(query?: string): ThemeFilter[] {
  if (!query) return DEFAULT_FILTERS;
  const normalisedQuery = normalise(query);
  const matchingEntry = THEME_FILTERS.find((entry) =>
    entry.matches.some((keyword) => normalisedQuery.includes(normalise(keyword))),
  );
  return matchingEntry?.filters ?? DEFAULT_FILTERS;
}

export async function geocodeCity(city: string): Promise<GeocodeResult> {
  const trimmed = city.trim();
  if (!trimmed) throw new Error("Ville introuvable");
  const cacheKey = normalise(trimmed);
  const cached = geocodeCache.get(cacheKey);
  if (cached) return cached;

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("q", trimmed);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");

  const response = await fetch(url.toString(), { headers: { "User-Agent": OVERPASS_USER_AGENT } });
  if (!response.ok) throw new Error(`Nominatim ${response.status}`);

  const data = (await response.json()) as Array<{
    display_name?: string;
    lat?: string;
    lon?: string;
    boundingbox?: [string, string, string, string];
  }>;

  const entry = data[0];
  if (!entry || !entry.lat || !entry.lon || !entry.boundingbox) {
    throw new Error(`Ville introuvable: ${trimmed}`);
  }

  const [southRaw, northRaw, westRaw, eastRaw] = entry.boundingbox;
  const result: GeocodeResult = {
    label: entry.display_name ?? trimmed,
    lat: Number.parseFloat(entry.lat),
    lon: Number.parseFloat(entry.lon),
    boundingBox: {
      south: Number.parseFloat(southRaw),
      north: Number.parseFloat(northRaw),
      west: Number.parseFloat(westRaw),
      east: Number.parseFloat(eastRaw),
    },
  };

  geocodeCache.set(cacheKey, result);
  return result;
}

function escapeForOverpass(value: string) {
  return value.replace(/"/g, "\\\"").replace(/</g, "");
}

export function buildOverpassQuery(geocode: GeocodeResult, filters: ThemeFilter[]): string {
  const { south, north, west, east } = geocode.boundingBox;
  // Basic bbox validation to avoid huge queries
  const height = Math.abs(north - south);
  const width = Math.abs(east - west);
  // If bbox is bigger than ~5 degrees, clamp by 5 degrees window around center
  const MAX_DEG = 5;
  let s = south, n = north, w = west, e = east;
  if (height > MAX_DEG || width > MAX_DEG) {
    const cLat = (north + south) / 2;
    const cLon = (east + west) / 2;
    s = cLat - MAX_DEG / 2;
    n = cLat + MAX_DEG / 2;
    w = cLon - MAX_DEG / 2;
    e = cLon + MAX_DEG / 2;
  }
  const bbox = `(${s},${w},${n},${e})`;
  const overpassFilters = filters
    .map((filter) => {
      const selector = `["${escapeForOverpass(filter.key)}"="${escapeForOverpass(filter.value)}"]`;
      return [`  node${selector}${bbox};`, `  way${selector}${bbox};`, `  relation${selector}${bbox};`].join("\n");
    })
    .join("\n");

  return `[out:json][timeout:25];\n(\n${overpassFilters}\n);\nout center 100;\n`;
}

export async function executeOverpass(query: string, cacheKey: string) {
  const cached = overpassCache.get(cacheKey);
  if (cached) return cached;

  const endpointsToTry = OVERPASS_ENDPOINTS.length > 0 ? OVERPASS_ENDPOINTS : DEFAULT_OVERPASS_ENDPOINTS;
  const errors: string[] = [];

  for (const endpoint of endpointsToTry) {
    const start = Date.now();
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": OVERPASS_USER_AGENT,
        },
        body: new URLSearchParams({ data: query }).toString(),
      });

      if (!response.ok) {
        const text = await response.text();
        errors.push(`${endpoint} → ${response.status} ${text.slice(0, 400)}`);
        continue;
      }

      const payload = (await response.json()) as { elements?: OverpassElement[] };
      const elements = payload.elements ?? [];
      overpassCache.set(cacheKey, elements);
      logger.info({ msg: 'overpass:success', endpoint, count: elements.length, ms: Date.now() - start, cacheKey });
      return elements;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${endpoint} → ${message}`);
    }
  }

  throw new Error(errors.join(" | "));
}


export async function handlePlacesSearch(input: PlacesSearchInput): Promise<PlacesSearchOutput> {
  const { city, query } = input;
if (!city.trim()) throw new Error("City is required");

  let geocode: GeocodeResult;
  try {
    geocode = await geocodeCity(city);
  } catch (error) {
const message = error instanceof Error ? error.message : "City not found";
    logger.warn({ msg: 'geocode:failed', city, error: message });
    throw new Error(message);
  }

  const filters = pickFilters(query);
  const overpassQuery = buildOverpassQuery(geocode, filters);
  const cacheKey = `${normalise(city)}::${query ? normalise(query) : "_default"}::${geocode.boundingBox.south.toFixed(3)}::${geocode.boundingBox.east.toFixed(3)}`;

  try {
    const elements = await executeOverpass(overpassQuery, cacheKey);

    const results = elements
      .map((element: OverpassElement): { id: string; name: string; lat: number; lon: number; notes?: string } | undefined => {
        const coordinates = element.type === "node"
          ? element.lat !== undefined && element.lon !== undefined
            ? { lat: element.lat, lon: element.lon }
            : undefined
          : element.center;
        if (!coordinates) return undefined;

        const tags = element.tags ?? {};
const name = tags.name ?? (tags as any)["name:en"] ?? "Unnamed place";
        const notesParts: string[] = [];
        if ((tags as any).cuisine) notesParts.push(`Cuisine: ${(tags as any).cuisine}`);
        if ((tags as any)["opening_hours"]) notesParts.push(`Horaires: ${(tags as any)["opening_hours"]}`);
        if ((tags as any).website) notesParts.push(`Site: ${(tags as any).website}`);

        return { id: `${element.type}/${element.id}`, name, lat: coordinates.lat, lon: coordinates.lon, notes: notesParts.length > 0 ? notesParts.join(" • ") : undefined };
      })
      .filter((v: unknown): v is { id: string; name: string; lat: number; lon: number; notes?: string } => Boolean(v))
      .slice(0, 30);

    if (results.length === 0) {
      logger.warn({ msg: 'overpass:empty', city, query });
throw new Error("No places found for this theme.");
    }

    return { source: "overpass", results };
  } catch (error) {
const message = error instanceof Error ? error.message : "Overpass error";
    logger.warn({ msg: 'overpass:error', city, query, error: message });
throw new Error(`Overpass unavailable: ${message}`);
  }
}
