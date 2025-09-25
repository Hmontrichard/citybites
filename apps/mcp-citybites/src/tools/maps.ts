import { z } from "zod";
import { escapeHtml } from "../utils/text.js";
import { PlaceSchema } from "./places.js";

export const MapsExportSchema = z.object({
  places: z.array(PlaceSchema),
  format: z.enum(["geojson", "kml"]),
});

export const MapsExportResultSchema = z.object({
  filename: z.string(),
  content: z.string(),
  mimeType: z.string(),
});

export type MapsExportInput = z.infer<typeof MapsExportSchema>;
export type MapsExportOutput = z.infer<typeof MapsExportResultSchema>;

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
    .map((place) => `<Placemark><name>${escapeHtml(place.name)}</name><Point><coordinates>${place.lon},${place.lat},0</coordinates></Point></Placemark>`)
    .join("\n")}\n</Document></kml>`;

  return { filename: "map.kml", content: kml, mimeType: "application/vnd.google-earth.kml+xml" };
}
