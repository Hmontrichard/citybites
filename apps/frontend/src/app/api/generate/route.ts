import { NextResponse } from "next/server";

type GeneratePayload = {
  city?: unknown;
  theme?: unknown;
  day?: unknown;
};

type PlacesSearchResponse = {
  source: string;
  results: Array<{ id: string; name: string; lat: number; lon: number; notes?: string }>;
  warning?: string;
};

type RouteOptimizeResponse = {
  order: string[];
  distanceKm: number;
};

type MapsExportResponse = {
  filename: string;
  content: string;
  mimeType?: string;
};

type PdfBuildResponse = {
  filename: string;
  content: string;
  format: "pdf" | "html";
  encoding?: "base64" | "utf-8";
  mimeType?: string;
  htmlFallback?: string;
  warning?: string;
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

    const warnings: string[] = [];
    if (places.warning) {
      warnings.push(places.warning);
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

    const dayLabel = formatDateForDisplay(day);
    const pdf = await requestJson<PdfBuildResponse>("/pdf/build", {
      title: `CityBites — ${city}`,
      subtitle: `${theme} · ${dayLabel}`,
      city,
      theme,
      summary: `Une journée ${theme.toLowerCase()} à ${city}`,
      distanceKm: route.distanceKm,
      tips: buildDefaultTips(city, theme, route.distanceKm),
      highlights: orderedStops.slice(0, 3).map((stop) => stop.name),
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

    if (pdf.warning) {
      warnings.push(pdf.warning);
    }

    const assets = [
      {
        filename: geojson.filename,
        mimeType: geojson.mimeType ?? "application/geo+json",
        content: geojson.content,
        encoding: "utf-8" as const,
      },
      {
        filename: kml.filename,
        mimeType: kml.mimeType ?? "application/vnd.google-earth.kml+xml",
        content: kml.content,
        encoding: "utf-8" as const,
      },
      {
        filename: pdf.filename,
        mimeType: pdf.mimeType ?? (pdf.format === "pdf" ? "application/pdf" : "text/html"),
        content: pdf.content,
        encoding: pdf.encoding ?? (pdf.format === "pdf" ? "base64" : "utf-8"),
      },
    ];

    if (pdf.htmlFallback && pdf.format === "pdf") {
      assets.push({
        filename: "guide.html",
        mimeType: "text/html",
        content: pdf.htmlFallback,
        encoding: "utf-8",
      });
    }

    return NextResponse.json({
      summary: `Itinéraire ${theme.toLowerCase()} à ${city} pour le ${dayLabel}.`,
      itinerary: {
        totalDistanceKm: route.distanceKm,
        stops: orderedStops,
      },
      warnings: warnings.length > 0 ? warnings : undefined,
      assets,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
