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
import { logger } from "./logger.js";

function formatDateForDisplay(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function buildDefaultTips(city: string, theme: string, distanceKm: number) {
  const location = city.trim() ? city : "the city";
  const themeLower = theme.trim() ? theme.toLowerCase() : "the experience";

  return [
    `Book popular spots in ${location} at least 24h in advance if you can.`,
    `Keep a flexible budget for ${themeLower} — add a bonus stop if time allows.`,
    `Planned distance: ${distanceKm.toFixed(1)} km. Have alternatives in case of rain or closures.`,
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

async function callToolWithTimeout<T>(
  client: any,
  toolName: string,
  args: any,
  schema: z.Schema<T>,
  timeoutMs: number = 20000,
  requestId?: string,
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`Timeout: ${toolName} took longer than ${timeoutMs}ms`)), timeoutMs);
  });

  const toolPromise = client.callTool({ name: toolName, arguments: { ...args, meta: { requestId } } });
  
  try {
    const rawResult = await Promise.race([toolPromise, timeoutPromise]);
    const result = CallToolResultSchema.parse(rawResult);
    return extractStructured(result, schema, toolName);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('Timeout:')) {
      throw error; // Re-throw timeout errors as-is
    }
    throw new Error(`Tool ${toolName} failed: ${errorMessage}`);
  }
}

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
    polyline?: string;
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

export async function generateGuide(input: GenerateRequest, ctx?: { requestId?: string }): Promise<GenerateResult> {
  const parsed = GenerateRequestSchema.parse(input);
  const { client } = await getMcpConnection();

  const warnings: string[] = [];
  const requestId = ctx?.requestId;
  logger.info({ msg: 'generate:start', requestId, city: parsed.city, theme: parsed.theme, day: parsed.day });

  const places = await callToolWithTimeout(
    client,
    "places.search",
    { city: parsed.city, query: parsed.theme },
    PlacesSearchResultSchema,
    15000, // Reduced from 25s to 15s
    requestId,
  );
  if (places.warning) {
    warnings.push(places.warning);
  }

  if (!places.results.length) {
    throw new Error("No places found for this city/theme combination.");
  }

  const selectedPlaces = places.results.slice(0, 8);
  const points = selectedPlaces.map((place) => ({ id: place.id, lat: place.lat, lon: place.lon }));

  const route = await callToolWithTimeout(
    client,
    "routes.optimize",
    { points },
    RouteOptimizeResultSchema,
    5000, // Reduced from 10s to 5s (simple calculation)
    requestId,
  );

  const orderSet = new Set(route.order);
  const orderedStops = selectedPlaces
    .filter((place) => orderSet.has(place.id))
    .sort((a, b) => route.order.indexOf(a.id) - route.order.indexOf(b.id));

  const enrichmentTargets = orderedStops.slice(0, Math.min(5, orderedStops.length));
  const enrichments = new Map<string, PlaceEnrichment>();

  await Promise.all(
    enrichmentTargets.map(async (stop) => {
      // Retry enrichment up to 2 times with backoff; if it still fails, continue with warning
      let enrichment;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          enrichment = await callToolWithTimeout(
            client,
            "places.enrich",
            {
              id: stop.id,
              name: stop.name,
              city: parsed.city,
              theme: parsed.theme,
              description: stop.notes,
            },
            PlaceEnrichmentSchema,
            8000,
            requestId,
          );
          break; // Success
        } catch (error) {
          if (attempt < 2) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // 1s, 2s backoff
          }
        }
      }

      if (!enrichment) {
        warnings.push(`Enrichissement indisponible pour ${stop.name}`);
        return;
      }

      enrichments.set(stop.id, enrichment);
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

  const geojson = await callToolWithTimeout(
    client,
    "maps.export",
    { places: exportableStops, format: "geojson" },
    MapsExportResultSchema,
    5000,
    requestId,
  );

  const kml = await callToolWithTimeout(
    client,
    "maps.export",
    { places: exportableStops, format: "kml" },
    MapsExportResultSchema,
    5000,
    requestId,
  );

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

  const pdf = await callToolWithTimeout(
    client,
    "pdf.build",
    {
      title: `CityBites — ${parsed.city}`,
      subtitle: `${parsed.theme} · ${dayLabel}`,
      city: parsed.city,
      theme: parsed.theme,
      summary: `A ${parsed.theme.toLowerCase()} day in ${parsed.city}`,
      distanceKm: route.distanceKm,
      tips: baseTips,
      highlights: pdfHighlights.slice(0, 6),
      days: [
        {
          date: parsed.day,
          blocks: enrichedStops.map((stop, index) => ({
            time: `Step ${index + 1}`,
            name: stop.name,
            summary: stop.notes ?? "À découvrir",
          })),
        },
      ],
    },
    PdfBuildResultSchema,
    12000,
    requestId,
  );
  if (pdf.warning) {
    warnings.push(pdf.warning);
  }

  const summary = `A ${parsed.theme.toLowerCase()} itinerary in ${parsed.city} for ${dayLabel}.`;

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

  const result: GenerateResult = {
    summary,
    itinerary: {
      totalDistanceKm: route.distanceKm,
      polyline: (route as any).polyline,
      stops: enrichedStops.map((stop) => ({ id: stop.id, name: stop.name, notes: stop.notes, lat: stop.lat, lon: stop.lon })),
    },
    warnings: warnings.length > 0 ? warnings : undefined,
    assets,
    enrichments: enrichmentsList.length > 0 ? enrichmentsList : undefined,
  };
  logger.info({ msg: 'generate:success', requestId, stops: result.itinerary.stops.length, distanceKm: result.itinerary.totalDistanceKm });
  return result;
}

export type { GenerateRequest };
