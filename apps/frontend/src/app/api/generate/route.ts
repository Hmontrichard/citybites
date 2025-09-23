import { NextResponse } from "next/server";

type GeneratePayload = {
  city?: unknown;
  theme?: unknown;
  day?: unknown;
};

type PlacesSearchResponse = {
  source: string;
  results: Array<{ id: string; name: string; lat: number; lon: number; notes?: string }>;
};

type RouteOptimizeResponse = {
  order: string[];
  distanceKm: number;
};

type MapsExportResponse = {
  filename: string;
  content: string;
};

type PdfBuildResponse = {
  filename: string;
  content: string;
};

const SERVICE_URL = (process.env.MCP_SERVICE_URL ?? "http://localhost:3001").replace(/\/+$/, "");

async function requestJson<T>(path: string, payload: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${SERVICE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Service ${path} → ${response.status} ${message}`);
  }

  const data = (await response.json()) as T;
  return data;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as GeneratePayload;
  const city = typeof body.city === "string" ? body.city.trim() : "";
  const theme = typeof body.theme === "string" ? body.theme.trim() : "";
  const day = typeof body.day === "string" ? body.day : "";

  if (!city || !theme || !day) {
    return NextResponse.json(
      { error: "Merci de renseigner la ville, le thème et le jour." },
      { status: 400 },
    );
  }

  try {
    const placesPayload = { city, query: theme };
    const places = await requestJson<PlacesSearchResponse>("/places/search", placesPayload);

    if (!Array.isArray(places.results) || places.results.length === 0) {
      throw new Error("Aucun lieu trouvé pour cette combinaison ville/thème.");
    }

    const selectedPlaces = places.results.slice(0, 8);
    const points = selectedPlaces.map((place) => ({ id: place.id, lat: place.lat, lon: place.lon }));

    const route = await requestJson<RouteOptimizeResponse>("/routes/optimize", { points });

    const orderSet = new Set(route.order);
    const orderedStops = selectedPlaces
      .filter((place) => orderSet.has(place.id))
      .sort((a, b) => route.order.indexOf(a.id) - route.order.indexOf(b.id));

    const geojson = await requestJson<MapsExportResponse>("/maps/export", {
      places: orderedStops,
      format: "geojson",
    });

    const kml = await requestJson<MapsExportResponse>("/maps/export", {
      places: orderedStops,
      format: "kml",
    });

    const pdf = await requestJson<PdfBuildResponse>("/pdf/build", {
      title: `CityBites — ${city}`,
      days: [
        {
          date: day,
          blocks: orderedStops.map((stop, index) => ({
            time: `${index + 1}e étape`,
            name: stop.name,
            summary: stop.notes ?? "À découvrir",
          })),
        },
      ],
    });

    return NextResponse.json({
      summary: `Itinéraire ${theme.toLowerCase()} à ${city} pour le ${day}.`,
      itinerary: {
        totalDistanceKm: route.distanceKm,
        stops: orderedStops,
      },
      assets: [
        {
          filename: geojson.filename,
          mimeType: "application/geo+json",
          content: geojson.content,
        },
        {
          filename: kml.filename,
          mimeType: "application/vnd.google-earth.kml+xml",
          content: kml.content,
        },
        {
          filename: pdf.filename,
          mimeType: "text/markdown",
          content: pdf.content,
        },
      ],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
