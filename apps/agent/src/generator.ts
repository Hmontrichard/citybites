import { z } from "zod";
import { getMcpConnection } from "./mcpClient.js";
import {
  GenerateRequestSchema,
  type GenerateRequest,
  PlacesSearchResultSchema,
  RouteOptimizeResultSchema,
  MapsExportResultSchema,
  PdfBuildResultSchema,
  PlaceEnrichmentSchema,
  type PlaceEnrichment,
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
    stops: Array<{ id: string; name: string; notes?: string; lat: number; lon: number }>;
  };
  warnings?: string[];
  assets: Array<{ filename: string; content: string; mimeType?: string; encoding?: "base64" | "utf-8" }>;
  enrichments?: Array<{
    id: string;
    summary: string;
    highlights: string[];
    bestTime?: string;
    localTip?: string;
  }>;
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

  const enrichmentTargets = orderedStops.slice(0, Math.min(5, orderedStops.length));
  const enrichments = new Map<string, PlaceEnrichment>();

  await Promise.all(
    enrichmentTargets.map(async (stop) => {
      try {
        const enrichRaw = CallToolResultSchema.parse(
          await client.callTool({
            name: "places.enrich",
            arguments: {
              id: stop.id,
              name: stop.name,
              city: parsed.city,
              theme: parsed.theme,
              description: stop.notes,
            },
          }),
        );
        const enrichment = extractStructured(enrichRaw, PlaceEnrichmentSchema, "places.enrich");
        if (enrichment.warning) {
          warnings.push(`${stop.name} · ${enrichment.warning}`);
        }
        enrichments.set(stop.id, enrichment);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        warnings.push(`${stop.name} · enrichissement indisponible (${message})`);
      }
    }),
  );

  const enrichedStops = orderedStops.map((stop) => {
    const enrichment = enrichments.get(stop.id);
    return {
      ...stop,
      notes: enrichment?.summary ?? stop.notes,
      enrichment,
    };
  });

  const exportableStops = enrichedStops.map(({ enrichment, ...rest }) => rest);

  const geojsonRaw = CallToolResultSchema.parse(
    await client.callTool({ name: "maps.export", arguments: { places: exportableStops, format: "geojson" } }),
  );
  const geojson = extractStructured(geojsonRaw, MapsExportResultSchema, "maps.export");

  const kmlRaw = CallToolResultSchema.parse(
    await client.callTool({ name: "maps.export", arguments: { places: exportableStops, format: "kml" } }),
  );
  const kml = extractStructured(kmlRaw, MapsExportResultSchema, "maps.export");

  const dayLabel = formatDateForDisplay(parsed.day);
  const baseTips = buildDefaultTips(parsed.city, parsed.theme, route.distanceKm);
  const highlightCandidates = enrichedStops.flatMap((stop) => stop.enrichment?.highlights ?? []);
  const pdfHighlights = highlightCandidates.length
    ? highlightCandidates.slice(0, 3)
    : enrichedStops.slice(0, 3).map((stop) => stop.name);

  enrichedStops.forEach((stop) => {
    const enrichment = stop.enrichment;
    if (!enrichment) {
      return;
    }
    if (enrichment.bestTime) {
      baseTips.push(`Moment conseillé pour ${stop.name} : ${enrichment.bestTime}`);
    }
    if (enrichment.localTip) {
      baseTips.push(`Astuce locale (${stop.name}) : ${enrichment.localTip}`);
    }
  });

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
        tips: baseTips,
        highlights: pdfHighlights.slice(0, 6),
        days: [
          {
            date: parsed.day,
            blocks: enrichedStops.map((stop, index) => ({
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

  const enrichmentsList = enrichedStops
    .filter((stop) => stop.enrichment)
    .map((stop) => ({ id: stop.id, ...(stop.enrichment as PlaceEnrichment) }));

  return {
    summary,
    itinerary: {
      totalDistanceKm: route.distanceKm,
      stops: enrichedStops.map((stop) => ({ id: stop.id, name: stop.name, notes: stop.notes, lat: stop.lat, lon: stop.lon })),
    },
    warnings: warnings.length > 0 ? warnings : undefined,
    assets,
    enrichments: enrichmentsList.length > 0 ? enrichmentsList : undefined,
  };
}

export type { GenerateRequest };
