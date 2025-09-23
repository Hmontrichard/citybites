import express from "express";
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

type OverpassElement = {
  id: number;
  type: "node" | "way" | "relation";
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

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

function escapeForOverpass(value: string) {
  return value.replace(/"/g, "\\\"").replace(/</g, "");
}

function buildOverpassQuery(city: string, query?: string): string {
  const trimmedCity = city.trim();
  const escapedCity = escapeForOverpass(trimmedCity);
  const filters = pickFilters(query);
  const overpassFilters = filters
    .map((filter) => {
      const selector = `["${filter.key}"="${filter.value}"]`;
      return [
        `  node${selector}(area.searchArea);`,
        `  way${selector}(area.searchArea);`,
        `  relation${selector}(area.searchArea);`,
      ].join("\n");
    })
    .join("\n");

  return `[out:json][timeout:25];
area["name"="${escapedCity}"]["boundary"="administrative"]["admin_level"~"^(4|5|6|7|8)$"]->.searchArea;
(
${overpassFilters}
);
out center 25;
`;
}

async function executeOverpass(query: string) {
  const endpointsToTry = OVERPASS_ENDPOINTS.length > 0 ? OVERPASS_ENDPOINTS : DEFAULT_OVERPASS_ENDPOINTS;
  const errors: string[] = [];

  for (const endpoint of endpointsToTry) {
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
      return payload.elements ?? [];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${endpoint} → ${message}`);
    }
  }

  throw new Error(errors.join(" | "));
}

function fallbackPlaces(city: string) {
  const formattedCity = city.trim() || "Ville";
  return [
    { id: "fallback-1", name: `${formattedCity} Coffee Lab`, lat: 48.8566, lon: 2.3522 },
    { id: "fallback-2", name: `${formattedCity} Market Hall`, lat: 48.8584, lon: 2.2945 },
    { id: "fallback-3", name: `${formattedCity} Night Bar`, lat: 48.853, lon: 2.3499 },
  ];
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

const app = express();
app.use(express.json());

const PlacesSearchSchema = z.object({
  city: z.string(),
  query: z.string().optional(),
});

const RouteOptimizeSchema = z.object({
  points: z.array(z.object({ id: z.string(), lat: z.number(), lon: z.number() })),
});

const MapsExportSchema = z.object({
  places: z.array(
    z.object({ id: z.string(), name: z.string(), lat: z.number(), lon: z.number(), notes: z.string().optional() }),
  ),
  format: z.enum(["geojson", "kml"]),
});

const PdfBuildSchema = z.object({
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

app.post("/places/search", async (req, res) => {
  const parseResult = PlacesSearchSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: "Requête invalide", details: parseResult.error.flatten() });
  }

  const { city, query } = parseResult.data;

  if (!city.trim()) {
    return res.status(400).json({ error: "Ville manquante" });
  }

  const overpassQuery = buildOverpassQuery(city, query);

  try {
    const elements = await executeOverpass(overpassQuery);

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

    return res.json({ source: "overpass", results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur Overpass";
    console.warn(`[overpass] fallback triggered: ${message}`);
    return res.json({
      source: "fallback",
      warning: "Overpass indisponible, données fictives retournées.",
      results: fallbackPlaces(city),
    });
  }
});

app.post("/routes/optimize", (req, res) => {
  const parseResult = RouteOptimizeSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: "Requête invalide", details: parseResult.error.flatten() });
  }

  const { points } = parseResult.data;
  return res.json({
    order: points.map((point) => point.id),
    distanceKm: 3.4,
  });
});

app.post("/maps/export", (req, res) => {
  const parseResult = MapsExportSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: "Requête invalide", details: parseResult.error.flatten() });
  }

  const { places, format } = parseResult.data;
  if (format === "geojson") {
    const geojson = {
      type: "FeatureCollection",
      features: places.map((place) => ({
        type: "Feature",
        properties: { name: place.name, notes: place.notes ?? "" },
        geometry: { type: "Point", coordinates: [place.lon, place.lat] },
      })),
    } satisfies Record<string, unknown>;

    return res.json({ filename: "map.geojson", content: JSON.stringify(geojson, null, 2) });
  }

  const kml = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document>\n${places
    .map(
      (place) =>
        `<Placemark><name>${place.name}</name><Point><coordinates>${place.lon},${place.lat},0</coordinates></Point></Placemark>`,
    )
    .join("\n")}\n</Document></kml>`;

  return res.json({ filename: "map.kml", content: kml });
});

app.post("/pdf/build", async (req, res) => {
  const parseResult = PdfBuildSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: "Requête invalide", details: parseResult.error.flatten() });
  }

  const html = buildGuideHtml(parseResult.data);

  try {
    const pdfBuffer = await renderHtmlToPdf(html);

    if (!pdfBuffer) {
      return res.json({
        filename: "guide.html",
        content: html,
        format: "html",
        mimeType: "text/html",
        warning: "Mode PDF désactivé, HTML retourné.",
      });
    }

    return res.json({
      filename: "guide.pdf",
      content: pdfBuffer.toString("base64"),
      format: "pdf",
      encoding: "base64",
      mimeType: "application/pdf",
      htmlFallback: html,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossible de générer le PDF";
    console.warn(`[pdf] génération impossible: ${message}`);
    return res.json({
      filename: "guide.html",
      content: html,
      format: "html",
      mimeType: "text/html",
      warning: "PDF non disponible, HTML renvoyé.",
    });
  }
});

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  console.log(`Mock CityBites service listening on http://localhost:${port}`);
});
