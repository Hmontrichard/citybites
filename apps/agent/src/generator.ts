import { z } from "zod";
import { getMcpConnection } from "./mcpClient.js";
import {
  GenerateRequestSchema,
  type GenerateRequest,
  PlacesSearchResultSchema,
  RouteOptimizeResultSchema,
  MapsExportResultSchema,
  PdfBuildResultSchema,
} from "./schemas.js";

function formatDateForDisplay(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function buildDefaultTips(city: string, theme: string, distanceKm: number) {
  const location = city.trim() ? city : "la ville";
  const themeLower = theme.trim() ? theme.toLowerCase() : "l'expérience";

  return [
    `Réserve les lieux incontournables de ${location} au moins 24h à l'avance si possible.`,
    `Prévoyez un budget flexible pour ${themeLower} — ajoute un stop bonus si le temps le permet.`,
    `Distance prévue : ${distanceKm.toFixed(1)} km. Pense à des alternatives en cas de pluie ou de fermeture.`,
  ];
}

const CallToolResultSchema = z.object({
  content: z.array(
    z.object({
      type: z.string(),
      text: z.string().optional(),
    }),
  ),
  structuredContent: z.unknown().optional(),
  isError: z.boolean().optional(),
});

type ToolResult = z.infer<typeof CallToolResultSchema>;

function extractStructured<T>(result: ToolResult, schema: z.Schema<T>, toolName: string): T {
  if (result.isError) {
    const fallback = result.content[0]?.text ?? `Tool ${toolName} returned an error.`;
    throw new Error(fallback);
  }

  const payload = result.structuredContent;
  if (!payload) {
    throw new Error(`Le tool ${toolName} n'a pas renvoyé de structuredContent.`);
  }

  return schema.parse(payload);
}

export type GenerateResult = {
  summary: string;
  itinerary: {
    totalDistanceKm: number;
    stops: Array<{ id: string; name: string; notes?: string }>;
  };
  warnings?: string[];
  assets: Array<{ filename: string; content: string; mimeType?: string; encoding?: "base64" | "utf-8" }>;
};

export async function generateGuide(input: GenerateRequest): Promise<GenerateResult> {
  const parsed = GenerateRequestSchema.parse(input);
  const { client } = await getMcpConnection();

  const warnings: string[] = [];

  const placesRaw = CallToolResultSchema.parse(
    await client.callTool({ name: "places.search", arguments: { city: parsed.city, query: parsed.theme } }),
  );
  const places = extractStructured(placesRaw, PlacesSearchResultSchema, "places.search");
  if (places.warning) {
    warnings.push(places.warning);
  }

  if (!places.results.length) {
    throw new Error("Aucun lieu trouvé pour cette combinaison ville/thème.");
  }

  const selectedPlaces = places.results.slice(0, 8);
  const points = selectedPlaces.map((place) => ({ id: place.id, lat: place.lat, lon: place.lon }));

  const routeRaw = CallToolResultSchema.parse(
    await client.callTool({ name: "routes.optimize", arguments: { points } }),
  );
  const route = extractStructured(routeRaw, RouteOptimizeResultSchema, "routes.optimize");

  const orderSet = new Set(route.order);
  const orderedStops = selectedPlaces
    .filter((place) => orderSet.has(place.id))
    .sort((a, b) => route.order.indexOf(a.id) - route.order.indexOf(b.id));

  const geojsonRaw = CallToolResultSchema.parse(
    await client.callTool({ name: "maps.export", arguments: { places: orderedStops, format: "geojson" } }),
  );
  const geojson = extractStructured(geojsonRaw, MapsExportResultSchema, "maps.export");

  const kmlRaw = CallToolResultSchema.parse(
    await client.callTool({ name: "maps.export", arguments: { places: orderedStops, format: "kml" } }),
  );
  const kml = extractStructured(kmlRaw, MapsExportResultSchema, "maps.export");

  const dayLabel = formatDateForDisplay(parsed.day);
  const pdfRaw = CallToolResultSchema.parse(
    await client.callTool({
      name: "pdf.build",
      arguments: {
        title: `CityBites — ${parsed.city}`,
        subtitle: `${parsed.theme} · ${dayLabel}`,
        city: parsed.city,
        theme: parsed.theme,
        summary: `Une journée ${parsed.theme.toLowerCase()} à ${parsed.city}`,
        distanceKm: route.distanceKm,
        tips: buildDefaultTips(parsed.city, parsed.theme, route.distanceKm),
        highlights: orderedStops.slice(0, 3).map((stop) => stop.name),
        days: [
          {
            date: parsed.day,
            blocks: orderedStops.map((stop, index) => ({
              time: `${index + 1}e étape`,
              name: stop.name,
              summary: stop.notes ?? "À découvrir",
            })),
          },
        ],
      },
    }),
  );
  const pdf = extractStructured(pdfRaw, PdfBuildResultSchema, "pdf.build");
  if (pdf.warning) {
    warnings.push(pdf.warning);
  }

  const summary = `Itinéraire ${parsed.theme.toLowerCase()} à ${parsed.city} pour le ${dayLabel}.`;

  const assets: GenerateResult["assets"] = [
    {
      filename: geojson.filename,
      mimeType: geojson.mimeType,
      content: geojson.content,
      encoding: "utf-8",
    },
    {
      filename: kml.filename,
      mimeType: kml.mimeType,
      content: kml.content,
      encoding: "utf-8",
    },
    {
      filename: pdf.filename,
      mimeType: pdf.mimeType,
      content: pdf.content,
      encoding: pdf.encoding ?? (pdf.format === "pdf" ? "base64" : "utf-8"),
    },
  ];

  if (pdf.htmlFallback) {
    assets.push({
      filename: "guide.html",
      mimeType: "text/html",
      content: pdf.htmlFallback,
      encoding: "utf-8",
    });
  }

  return {
    summary,
    itinerary: {
      totalDistanceKm: route.distanceKm,
      stops: orderedStops.map((stop) => ({ id: stop.id, name: stop.name, notes: stop.notes })),
    },
    warnings: warnings.length > 0 ? warnings : undefined,
    assets,
  };
}

export type { GenerateRequest };
