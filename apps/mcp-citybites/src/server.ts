import express from "express";
import { z } from "zod";

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

app.post("/places/search", (req, res) => {
  const parseResult = PlacesSearchSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: "Requête invalide", details: parseResult.error.flatten() });
  }

  const { city } = parseResult.data;
  return res.json({
    source: "mock",
    results: [
      { id: "r1", name: `${city} Coffee Lab`, lat: 48.8566, lon: 2.3522 },
      { id: "r2", name: `${city} Market Hall`, lat: 48.8584, lon: 2.2945 },
      { id: "r3", name: `${city} Night Bar`, lat: 48.853, lon: 2.3499 },
    ],
  });
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
