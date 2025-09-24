import { z } from "zod";
import { renderHtmlToPdf } from "./pdf.js";

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

type ThemeFilter = { key: string; value: string };

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

const OVERPASS_USER_AGENT =
  process.env.OVERPASS_USER_AGENT ?? "CityBitesMCP/0.1 (+https://citybites.ai/contact)";
const CACHE_TTL_MS = Number(process.env.OVERPASS_CACHE_TTL_MS ?? 1000 * 60 * 60 * 24);
type CacheEntry<T> = { value: T; expiresAt: number };
const overpassCache = new Map<string, CacheEntry<OverpassElement[]>>();

const ENRICH_CACHE_TTL_MS = Number(process.env.PLACE_ENRICH_CACHE_TTL_MS ?? 1000 * 60 * 60 * 6);
type EnrichCacheValue = {
  summary: string;
  highlights: string[];
  bestTime?: string;
  localTip?: string;
};
const enrichCache = new Map<string, CacheEntry<EnrichCacheValue>>();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

type GeocodeResult = {
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

const geocodeCache = new Map<string, CacheEntry<GeocodeResult>>();

type OverpassElement = {
  id: number;
  type: "node" | "way" | "relation";
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

const PlaceSchema = z.object({
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

export const RouteOptimizeSchema = z.object({
  points: z.array(z.object({ id: z.string(), lat: z.number(), lon: z.number() })),
});

export const MapsExportSchema = z.object({
  places: z.array(PlaceSchema),
  format: z.enum(["geojson", "kml"]),
});

export const PdfBuildSchema = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  city: z.string().optional(),
  theme: z.string().optional(),
  summary: z.string().optional(),
  distanceKm: z.number().optional(),
  tips: z.array(z.string()).optional(),
  highlights: z.array(z.string()).optional(),
  days: z.array(
    z.object({
      date: z.string(),
      blocks: z.array(z.object({ time: z.string(), name: z.string(), summary: z.string() })),
    }),
  ),
});

export type PlacesSearchInput = z.infer<typeof PlacesSearchSchema>;
export type PlacesSearchOutput = {
  source: string;
  warning?: string;
  results: Array<{ id: string; name: string; lat: number; lon: number; notes?: string }>;
};

export type RouteOptimizeInput = z.infer<typeof RouteOptimizeSchema>;
export type RouteOptimizeOutput = {
  order: string[];
  distanceKm: number;
};

export type MapsExportInput = z.infer<typeof MapsExportSchema>;
export type MapsExportOutput = {
  filename: string;
  content: string;
  mimeType: string;
};

export type PdfBuildInput = z.infer<typeof PdfBuildSchema>;
export type PdfBuildOutput = {
  filename: string;
  content: string;
  format: "pdf" | "html";
  encoding?: "base64" | "utf-8";
  mimeType: string;
  warning?: string;
  htmlFallback?: string;
};

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

export const PlacesSearchResultSchema = z.object({
  source: z.string(),
  warning: z.string().optional(),
  results: z.array(PlaceSchema),
});

export const RouteOptimizeResultSchema = z.object({
  order: z.array(z.string()),
  distanceKm: z.number(),
});

export const MapsExportResultSchema = z.object({
  filename: z.string(),
  content: z.string(),
  mimeType: z.string(),
});

export const PdfBuildResultSchema = z.object({
  filename: z.string(),
  content: z.string(),
  format: z.enum(["pdf", "html"]),
  encoding: z.enum(["base64", "utf-8"]).optional(),
  mimeType: z.string(),
  warning: z.string().optional(),
  htmlFallback: z.string().optional(),
});

function normalise(text: string) {
  return text
    .toLocaleLowerCase("fr-FR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function pickFilters(query?: string): ThemeFilter[] {
  if (!query) {
    return DEFAULT_FILTERS;
  }

  const normalisedQuery = normalise(query);
  const matchingEntry = THEME_FILTERS.find((entry) =>
    entry.matches.some((keyword) => normalisedQuery.includes(normalise(keyword))),
  );

  return matchingEntry?.filters ?? DEFAULT_FILTERS;
}

async function geocodeCity(city: string): Promise<GeocodeResult> {
  const trimmed = city.trim();
  if (!trimmed) {
    throw new Error("Ville introuvable");
  }

  const cacheKey = normalise(trimmed);
  const now = Date.now();
  const cached = geocodeCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("q", trimmed);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");

  const response = await fetch(url.toString(), {
    headers: {
      "User-Agent": OVERPASS_USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`Nominatim ${response.status}`);
  }

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

  geocodeCache.set(cacheKey, { value: result, expiresAt: now + NOMINATIM_CACHE_TTL_MS });
  return result;
}

function escapeForOverpass(value: string) {
  return value.replace(/"/g, "\\\"").replace(/</g, "");
}

function buildOverpassQuery(geocode: GeocodeResult, filters: ThemeFilter[]): string {
  const { south, north, west, east } = geocode.boundingBox;
  const bbox = `(${south},${west},${north},${east})`;
  const overpassFilters = filters
    .map((filter) => {
      const selector = `["${escapeForOverpass(filter.key)}"="${escapeForOverpass(filter.value)}"]`;
      return [
        `  node${selector}${bbox};`,
        `  way${selector}${bbox};`,
        `  relation${selector}${bbox};`,
      ].join("\n");
    })
    .join("\n");

  return `[out:json][timeout:25];
(
${overpassFilters}
);
out center 100;
`;
}

async function executeOverpass(query: string, cacheKey: string) {
  const now = Date.now();
  const cached = overpassCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

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
      overpassCache.set(cacheKey, { value: elements, expiresAt: now + CACHE_TTL_MS });
      console.log(
        `Overpass ${endpoint} → ${elements.length} résultats (${Date.now() - start}ms) cacheKey=${cacheKey}`,
      );
      return elements;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${endpoint} → ${message}`);
    }
  }

  throw new Error(errors.join(" | "));
}

function fallbackPlaces(city: string, geocode?: GeocodeResult) {
  const formattedCity = city.trim() || "Ville";
  const baseLat = geocode?.lat ?? 48.8566;
  const baseLon = geocode?.lon ?? 2.3522;
  const offsets = [
    {
      id: "fallback-1",
      name: `${formattedCity} Coffee Crawl`,
      dLat: 0.004,
      dLon: 0.002,
      notes: "Commence la journée avec un espresso signature.",
    },
    {
      id: "fallback-2",
      name: `${formattedCity} Market Hall`,
      dLat: -0.003,
      dLon: 0.003,
      notes: "Food court local pour déjeuner rapide.",
    },
    {
      id: "fallback-3",
      name: `${formattedCity} Night Bar`,
      dLat: 0.002,
      dLon: -0.003,
      notes: "Cocktails signature en fin de parcours.",
    },
  ];

  return offsets.map((spot) => ({
    id: spot.id,
    name: spot.name,
    lat: Number((baseLat + spot.dLat).toFixed(6)),
    lon: Number((baseLon + spot.dLon).toFixed(6)),
    notes: spot.notes,
  }));
}

function safeParseJsonBlock(text: string) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    const match = trimmed.match(/```json\s*([\s\S]+?)```/i);
    if (match) {
      return JSON.parse(match[1]);
    }
    throw error;
  }
}

function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return escapeHtml(value);
  }

  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

type GuideBlock = { time: string; name: string; summary: string };
type GuideDay = { date: string; blocks: GuideBlock[] };

type GuideOptions = {
  title: string;
  subtitle?: string;
  city?: string;
  theme?: string;
  summary?: string;
  distanceKm?: number;
  tips?: string[];
  highlights?: string[];
  days: GuideDay[];
};

function buildGuideHtml({
  title,
  subtitle,
  city,
  theme,
  summary,
  distanceKm,
  tips = [],
  highlights = [],
  days,
}: GuideOptions) {
  const badge = theme ? `<span class="badge">${escapeHtml(theme)}</span>` : "";
  const cityLine = city ? `<p class="hero-meta">${escapeHtml(city)}${
    distanceKm ? ` · ${distanceKm.toFixed(1)} km` : ""
  }</p>` : distanceKm ? `<p class="hero-meta">${distanceKm.toFixed(1)} km</p>` : "";
  const heroSubtitle = subtitle ? `<p class="hero-subtitle">${escapeHtml(subtitle)}</p>` : "";
  const heroSummary = summary ? `<p class="hero-summary">${escapeHtml(summary)}</p>` : "";

  const highlightsList = highlights.length
    ? `<section class="section section-highlights">
        <h2>À goûter absolument</h2>
        <ul>
          ${highlights.map((item) => `<li>${escapeHtml(item)}</li>`).join("\n        ")}
        </ul>
      </section>`
    : "";

  const tipsList = tips.length
    ? `<section class="section section-tips">
        <h2>Budget & conseils</h2>
        <ul>
          ${tips.map((tip) => `<li>${escapeHtml(tip)}</li>`).join("\n        ")}
        </ul>
      </section>`
    : `<section class="section section-tips">
        <h2>Budget & conseils</h2>
        <ul>
          <li>Prévois une enveloppe flexible (entrées + repas) selon tes envies.</li>
          <li>Réserve les tables du soir à l’avance, surtout le week-end.</li>
          <li>Garde une option “pluie” et une option “soirée” pour chaque bloc.</li>
        </ul>
      </section>`;

  const daySections = days
    .map((day, dayIndex) => {
      const stops = day.blocks
        .map((block, blockIndex) => {
          const label = `${dayIndex + 1}.${blockIndex + 1}`;
          return `<article class="stop">
              <header>
                <span class="stop-order">${escapeHtml(label)}</span>
                <div class="stop-info">
                  <h3>${escapeHtml(block.name)}</h3>
                  <p class="stop-time">${escapeHtml(block.time)}</p>
                </div>
              </header>
              <p class="stop-summary">${escapeHtml(block.summary)}</p>
            </article>`;
        })
        .join("\n");

      return `<section class="section day">
          <h2>${formatDateLabel(day.date)}</h2>
          <div class="stops">
            ${stops}
          </div>
        </section>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        color-scheme: light;
        font-family: "Helvetica Neue", Arial, sans-serif;
        background: #f5f5f6;
        color: #1f2a37;
      }

      body {
        margin: 0;
        padding: 0;
      }

      .wrap {
        max-width: 840px;
        margin: 0 auto;
        padding: 48px 32px 64px;
      }

      header.hero {
        background: linear-gradient(135deg, #ff7a18 0%, #af002d 74%);
        color: #fff;
        padding: 48px;
        border-radius: 24px;
        box-shadow: 0 12px 24px rgba(0, 0, 0, 0.16);
      }

      .badge {
        display: inline-block;
        padding: 6px 14px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.18);
        border: 1px solid rgba(255, 255, 255, 0.35);
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        margin-bottom: 16px;
      }

      .hero-title {
        font-size: 42px;
        margin: 0 0 12px;
      }

      .hero-subtitle,
      .hero-summary,
      .hero-meta {
        font-size: 17px;
        line-height: 1.6;
        margin: 8px 0;
        max-width: 580px;
      }

      main {
        margin-top: 40px;
        display: grid;
        gap: 32px;
      }

      .section {
        background: #fff;
        padding: 32px;
        border-radius: 20px;
        box-shadow: 0 10px 20px rgba(15, 23, 42, 0.08);
      }

      .section h2 {
        margin-top: 0;
        font-size: 24px;
      }

      .section ul {
        padding-left: 20px;
        line-height: 1.5;
      }

      .stops {
        display: grid;
        gap: 20px;
      }

      .stop {
        border: 1px solid #e2e8f0;
        border-radius: 16px;
        padding: 20px;
        display: grid;
        gap: 12px;
        background: #fcfdff;
      }

      .stop header {
        display: flex;
        align-items: center;
        gap: 16px;
      }

      .stop-order {
        width: 36px;
        height: 36px;
        border-radius: 12px;
        background: #1f2937;
        color: #fff;
        font-weight: 600;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .stop-info h3 {
        margin: 0;
        font-size: 20px;
      }

      .stop-time {
        margin: 0;
        color: #64748b;
        font-size: 15px;
      }

      .stop-summary {
        margin: 0;
        font-size: 16px;
        line-height: 1.6;
      }

      footer {
        text-align: center;
        color: #94a3b8;
        font-size: 13px;
        margin-top: 48px;
      }

      @media print {
        body {
          background: #fff;
        }

        .wrap {
          padding: 24px;
        }

        header.hero {
          box-shadow: none;
          color: #1f2a37;
          background: #fef3c7;
        }

        .section {
          box-shadow: none;
        }
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <header class="hero">
        ${badge}
        <h1 class="hero-title">${escapeHtml(title)}</h1>
        ${heroSubtitle}
        ${cityLine}
        ${heroSummary}
      </header>
      <main>
        ${highlightsList}
        ${daySections}
        ${tipsList}
      </main>
      <footer>
        Créé avec CityBites — partage tes découvertes gourmandes.
      </footer>
    </div>
  </body>
</html>`;
}

export async function handlePlacesSearch(input: PlacesSearchInput): Promise<PlacesSearchOutput> {
  const { city, query } = input;

  if (!city.trim()) {
    throw new Error("Ville manquante");
  }

  let geocode: GeocodeResult;
  try {
    geocode = await geocodeCity(city);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ville introuvable";
    console.warn(`[geocode] ${city} impossible: ${message}`);
    return {
      source: "fallback",
      warning: "Ville introuvable, suggestions génériques proposées.",
      results: fallbackPlaces(city),
    };
  }

  const filters = pickFilters(query);
  const overpassQuery = buildOverpassQuery(geocode, filters);
  const cacheKey = `${normalise(city)}::${query ? normalise(query) : "_default"}::${geocode.boundingBox.south.toFixed(3)}::${geocode.boundingBox.east.toFixed(3)}`;

  try {
    const elements = await executeOverpass(overpassQuery, cacheKey);

    const results = elements
      .map((element): { id: string; name: string; lat: number; lon: number; notes?: string } | undefined => {
        const coordinates =
          element.type === "node"
            ? element.lat !== undefined && element.lon !== undefined
              ? { lat: element.lat, lon: element.lon }
              : undefined
            : element.center;

        if (!coordinates) {
          return undefined;
        }

        const tags = element.tags ?? {};
        const name = tags.name ?? tags["name:fr"] ?? "Lieu sans nom";
        const notesParts: string[] = [];

        if (tags.cuisine) {
          notesParts.push(`Cuisine: ${tags.cuisine}`);
        }
        if (tags["opening_hours"]) {
          notesParts.push(`Horaires: ${tags["opening_hours"]}`);
        }
        if (tags.website) {
          notesParts.push(`Site: ${tags.website}`);
        }

        return {
          id: `${element.type}/${element.id}`,
          name,
          lat: coordinates.lat,
          lon: coordinates.lon,
          notes: notesParts.length > 0 ? notesParts.join(" • ") : undefined,
        };
      })
      .filter((value): value is { id: string; name: string; lat: number; lon: number; notes?: string } => Boolean(value))
      .slice(0, 30);

    if (results.length === 0) {
      console.warn(
        `[overpass] aucun résultat pour city="${city}" query="${query ?? ""}" – fallback utilisé`,
      );
      return {
        source: "fallback",
        warning: "Aucun lieu trouvé pour ce thème, suggestions génériques proposées.",
        results: fallbackPlaces(city, geocode),
      };
    }

    return { source: "overpass", results };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur Overpass";
    console.warn(`[overpass] fallback triggered: ${message}`);
    return {
      source: "fallback",
      warning: "Overpass indisponible, données fictives retournées.",
      results: fallbackPlaces(city, geocode),
    };
  }
}

export function handleRoutesOptimize(input: RouteOptimizeInput): RouteOptimizeOutput {
  const { points } = input;
  return {
    order: points.map((point) => point.id),
    distanceKm: 3.4,
  };
}

export function handleMapsExport(input: MapsExportInput): MapsExportOutput {
  const { places, format } = input;
  if (format === "geojson") {
    const geojson = {
      type: "FeatureCollection",
      features: places.map((place) => ({
        type: "Feature",
        properties: { name: place.name, notes: place.notes ?? "" },
        geometry: { type: "Point", coordinates: [place.lon, place.lat] },
      })),
    } satisfies Record<string, unknown>;

    return { filename: "map.geojson", content: JSON.stringify(geojson, null, 2), mimeType: "application/geo+json" };
  }

  const kml = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document>\n${places
    .map(
      (place) =>
        `<Placemark><name>${escapeHtml(place.name)}</name><Point><coordinates>${place.lon},${place.lat},0</coordinates></Point></Placemark>`,
    )
    .join("\n")}\n</Document></kml>`;

  return { filename: "map.kml", content: kml, mimeType: "application/vnd.google-earth.kml+xml" };
}

export async function handlePdfBuild(input: PdfBuildInput): Promise<PdfBuildOutput> {
  const html = buildGuideHtml(input);

  try {
    const pdfBuffer = await renderHtmlToPdf(html);

    if (!pdfBuffer) {
      return {
        filename: "guide.html",
        content: html,
        format: "html",
        mimeType: "text/html",
        warning: "Mode PDF désactivé, HTML retourné.",
      };
    }

    return {
      filename: "guide.pdf",
      content: pdfBuffer.toString("base64"),
      format: "pdf",
      encoding: "base64",
      mimeType: "application/pdf",
      htmlFallback: html,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossible de générer le PDF";
    console.warn(`[pdf] génération impossible: ${message}`);
    return {
      filename: "guide.html",
      content: html,
      format: "html",
      mimeType: "text/html",
      warning: "PDF non disponible, HTML renvoyé.",
    };
  }
}

export async function handlePlaceEnrich(input: PlaceEnrichInput): Promise<PlaceEnrichOutput> {
  const cacheKey = `${input.id}::${normalise(input.theme ?? "_default")}`;
  const now = Date.now();
  const cached = enrichCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return PlaceEnrichResultSchema.parse({ ...cached.value });
  }

  if (!OPENAI_API_KEY) {
    return PlaceEnrichResultSchema.parse({
      summary: `Découvre ${input.name}. Enrichissement désactivé (clé API manquante).`,
      highlights: [],
      warning: "OPENAI_API_KEY manquante",
    });
  }

  const contextDescription = [
    input.city ? `Ville: ${input.city}` : null,
    input.theme ? `Thème: ${input.theme}` : null,
    input.description ? `Notes: ${input.description}` : null,
  ]
    .filter(Boolean)
    .join(" | ") || "Pas d'information supplémentaire";

  const prompt = `Produit un JSON strict décrivant ce lieu selon le schema suivant:\n{
  "summary": string,
  "highlights": string[],
  "bestTime": string (optionnel),
  "localTip": string (optionnel)
}\n
Le ton doit être concret, utile pour un guide food/local. Lieu: ${input.name}. ${contextDescription}.`;

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

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error("Réponse vide du modèle");
    }

    const raw = safeParseJsonBlock(content);
    const parsed = PlaceEnrichResultSchema.parse({
      summary: typeof raw.summary === "string" ? raw.summary : JSON.stringify(raw.summary ?? raw),
      highlights: Array.isArray(raw.highlights) ? raw.highlights.map((item: unknown) => String(item)) : [],
      bestTime: typeof raw.bestTime === "string" ? raw.bestTime : raw.best_time,
      localTip: typeof raw.localTip === "string" ? raw.localTip : raw.local_tip,
    });

    enrichCache.set(cacheKey, { value: parsed, expiresAt: now + ENRICH_CACHE_TTL_MS });
    return parsed;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[enrich] échec ${input.id}: ${message}`);
    return PlaceEnrichResultSchema.parse({
      summary: `À explorer : ${input.name}. (Enrichissement indisponible)`,
      highlights: [],
      warning: message,
    });
  }
}
