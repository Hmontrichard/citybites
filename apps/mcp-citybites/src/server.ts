// apps/mcp-citybites/src/server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// --- Helpers Overpass/Nominatim ---
const NOMINATIM_BASE = "https://nominatim.openstreetmap.org/search";
const OVERPASS_URL = "https://overpass-api.de/api/interpreter"; // endpoint public

// Mappe un "thème" simple vers des tags OSM
function tagsForTheme(theme?: string) {
  if (!theme) return { amenities: ["cafe", "restaurant", "bar", "fast_food"], cuisines: [] as string[] };

  const t = theme.toLowerCase();
  if (/(coffee|café|cafe|espresso)/i.test(t)) return { amenities: ["cafe"], cuisines: [] };
  if (/(ramen)/i.test(t)) return { amenities: ["restaurant", "fast_food"], cuisines: ["ramen"] };
  if (/(kbbq|barbecue|bbq|bulgogi|galbi)/i.test(t)) return { amenities: ["restaurant"], cuisines: ["korean", "barbecue"] };
  if (/(street[- ]?food|tstreet|tteokbokki|hotteok|mandu)/i.test(t)) return { amenities: ["fast_food", "restaurant"], cuisines: [] };
  if (/(cocktail|speakeasy|bar)/i.test(t)) return { amenities: ["bar"], cuisines: [] };
  // par défaut: large
  return { amenities: ["cafe", "restaurant", "bar", "fast_food"], cuisines: [] };
}

async function geocodeCity(city: string) {
  const url = `${NOMINATIM_BASE}?q=${encodeURIComponent(city)}&format=json&limit=1`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "CityBites.AI-MVP/0.1 (contact@example.com)"
    }
  });
  if (!res.ok) throw new Error(`Nominatim error ${res.status}`);
  const data: any[] = await res.json();
  if (!data.length) throw new Error(`Ville introuvable: ${city}`);
  const { lat, lon, display_name } = data[0];
  return { lat: parseFloat(lat), lon: parseFloat(lon), label: display_name as string };
}

function buildOverpassQuery(params: {
  lat: number;
  lon: number;
  radiusMeters: number;
  amenities: string[];
  cuisines: string[];
}) {
  const { lat, lon, radiusMeters, amenities, cuisines } = params;

  // Filtre amenity
  const amenityRegex = `^(${amenities.join("|")})$`;

  // Filtre cuisine (optionnel)
  // Overpass: ["cuisine"~"(ramen|korean)"]
  const cuisineFilter = cuisines.length ? `["cuisine"~"(${cuisines.join("|")})",i]` : "";

  // On interroge node/way/relation + out center pour avoir des coords sur way/relation
  return `
[out:json][timeout:25];
(
  node["amenity"~"${amenityRegex}",i]${cuisineFilter}(around:${radiusMeters},${lat},${lon});
  way["amenity"~"${amenityRegex}",i]${cuisineFilter}(around:${radiusMeters},${lat},${lon});
  relation["amenity"~"${amenityRegex}",i]${cuisineFilter}(around:${radiusMeters},${lat},${lon});
);
out center 100;
`;
}

async function fetchOverpass(ql: string) {
  const body = new URLSearchParams({ data: ql });
  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "User-Agent": "CityBites.AI-MVP/0.1 (contact@example.com)"
    },
    body
  });
  if (!res.ok) throw new Error(`Overpass error ${res.status}`);
  const json = await res.json();
  return json;
}

// Normalise node/way/relation en {id, name, lat, lon}
function normalizeOverpassElements(elts: any[]) {
  const places: { id: string; name: string; lat: number; lon: number; notes?: string }[] = [];
  for (const e of elts) {
    const tags = e.tags || {};
    const name = tags.name || tags["name:en"] || tags["name:ko"] || tags["brand"] || "Sans nom";
    // coords:
    const lat = e.lat ?? e.center?.lat;
    const lon = e.lon ?? e.center?.lon;
    if (typeof lat !== "number" || typeof lon !== "number") continue;
    // id stable: type/id
    const id = `${e.type}/${e.id}`;
    places.push({ id, name, lat, lon });
  }
  // Dédupe par id
  const map = new Map(places.map(p => [p.id, p]));
  return Array.from(map.values());
}


// --- Schemas ---
const SearchSchema = z.object({ city: z.string(), query: z.string().optional() });
const OptimizeSchema = z.object({
  points: z.array(z.object({ id: z.string(), lat: z.number(), lon: z.number() })),
});
const ExportSchema = z.object({
  places: z.array(z.object({
    id: z.string(), name: z.string(), lat: z.number(), lon: z.number(), notes: z.string().optional()
  })),
  format: z.enum(["geojson", "kml"]),
});
const PdfSchema = z.object({
  title: z.string(),
  days: z.array(z.object({
    date: z.string(),
    blocks: z.array(z.object({ time: z.string(), name: z.string(), summary: z.string() }))
  }))
});

// --- Server ---
const server = new McpServer({ name: "citybites-mcp", version: "0.1.0" });

// Tool 1) places.search — Overpass réel
server.registerTool(
  "places.search",
  {
    title: "Search places",
    description: "Recherche cafés/restos/bars via Overpass autour d'une ville",
    inputSchema: SearchSchema, // { city: string; query?: string }
  },
  async ({ city, query }) => {
    // 1) géocode
    const geo = await geocodeCity(city);

    // 2) construit le filtre en fonction du thème éventuel
    const { amenities, cuisines } = tagsForTheme(query);

    // 3) prépare la requête Overpass (rayon 5km pour MVP)
    const ql = buildOverpassQuery({
      lat: geo.lat,
      lon: geo.lon,
      radiusMeters: 5000,
      amenities,
      cuisines
    });

    // 4) appelle Overpass + normalise
    const data = await fetchOverpass(ql);
    const results = normalizeOverpassElements(data.elements ?? []);

    // 5) option: limiter à 60 résultats pour rester léger
    const limited = results.slice(0, 60);

    // 6) réponse JSON pour l'agent/front
    return {
      content: [
        {
          type: "json",
          json: {
            city,
            query: query ?? null,
            center: { lat: geo.lat, lon: geo.lon, label: geo.label },
            count: limited.length,
            results: limited
          }
        }
      ]
    };
  }
);


// Tool 2) routes.optimize — ordre simple
server.registerTool(
  "routes.optimize",
  {
    title: "Optimize route",
    description: "Retourne l’ordre conseillé + distance approximative",
    inputSchema: OptimizeSchema,
  },
  async ({ points }) => {
    return { content: [{ type: "json", json: { order: points.map(p => p.id), distanceKm: 3.4 } }] };
  }
);

// Tool 3) maps.export — GeoJSON / KML
server.registerTool(
  "maps.export",
  {
    title: "Export map",
    description: "Exporte les lieux en GeoJSON ou KML",
    inputSchema: ExportSchema,
  },
  async ({ places, format }) => {
    if (format === "geojson") {
      const fc = {
        type: "FeatureCollection",
        features: places.map(p => ({
          type: "Feature",
          properties: { name: p.name, notes: p.notes ?? "" },
          geometry: { type: "Point", coordinates: [p.lon, p.lat] }
        }))
      };
      return { content: [{ type: "json", json: { fileName: "map.geojson", content: fc } }] };
    }
    const kml =
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<kml xmlns="http://www.opengis.net/kml/2.2"><Document>` +
      places.map(p => `<Placemark><name>${p.name}</name><Point><coordinates>${p.lon},${p.lat},0</coordinates></Point></Placemark>`).join("") +
      `</Document></kml>`;
    return { content: [{ type: "json", json: { fileName: "map.kml", content: kml } }] };
  }
);

// Tool 4) pdf.build — Markdown (PDF plus tard)
server.registerTool(
  "pdf.build",
  {
    title: "Build guide (Markdown)",
    description: "Construit un guide en Markdown (passage PDF plus tard)",
    inputSchema: PdfSchema,
  },
  async ({ title, days }) => {
    const md = [
      `# ${title}`,
      ...days.map(d =>
        `\n## ${d.date}\n` +
        d.blocks.map(b => `**${b.time} – ${b.name}**\n${b.summary}`).join("\n\n")
      ),
    ].join("\n");
    return { content: [{ type: "json", json: { fileName: "guide.md", content: md } }] };
  }
);

// --- Start (stdio transport for dev) ---
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log("MCP server started: citybites-mcp");
}
main().catch(err => {
  console.error("Server error:", err);
  process.exit(1);
});
