import express from "express";
import { z } from "zod";

const OVERPASS_ENDPOINT = process.env.OVERPASS_ENDPOINT ?? "https://overpass-api.de/api/interpreter";

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

function buildOverpassQuery(city: string, query?: string): string {
  const trimmedCity = city.trim();
  const filters = pickFilters(query);
  const searchArea = `{{geocodeArea:${trimmedCity}}}`;

  const overpassFilters = filters
    .map((filter) => {
      const selector = `["${filter.key}"="${filter.value}"]`;
      return [
        `  node(area.searchArea)${selector};`,
        `  way(area.searchArea)${selector};`,
        `  relation(area.searchArea)${selector};`,
      ].join("\n");
    })
    .join("\n");

  return `[out:json][timeout:25];
area(${searchArea})->.searchArea;
(
${overpassFilters}
);
out center 25;
`;
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

  try {
    const overpassQuery = buildOverpassQuery(city, query);
    const response = await fetch(OVERPASS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "citybites-mcp/0.1 (+https://citybites.ai)",
      },
      body: new URLSearchParams({ data: overpassQuery }).toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(502).json({ error: "Overpass indisponible", details: text.slice(0, 500) });
    }

    type OverpassElement = {
      id: number;
      type: "node" | "way" | "relation";
      lat?: number;
      lon?: number;
      center?: { lat: number; lon: number };
      tags?: Record<string, string>;
    };

    const payload = (await response.json()) as { elements?: OverpassElement[] };
    const elements = payload.elements ?? [];

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
    return res.status(502).json({ error: message });
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

app.post("/pdf/build", (req, res) => {
  const parseResult = PdfBuildSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: "Requête invalide", details: parseResult.error.flatten() });
  }

  const { title, days } = parseResult.data;
  const markdown = [
    `# ${title}`,
    ...days.map(
      (day) =>
        `\n## ${day.date}\n` + day.blocks.map((block) => `**${block.time} – ${block.name}**\n${block.summary}`).join("\n\n"),
    ),
  ].join("\n");

  return res.json({ filename: "guide.md", content: markdown });
});

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  console.log(`Mock CityBites service listening on http://localhost:${port}`);
});
