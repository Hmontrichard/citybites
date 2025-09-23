import express from "express";
import {
  MapsExportSchema,
  PdfBuildSchema,
  PlaceEnrichInputSchema,
  PlacesSearchSchema,
  RouteOptimizeSchema,
  handleMapsExport,
  handlePdfBuild,
  handlePlaceEnrich,
  handlePlacesSearch,
  handleRoutesOptimize,
} from "./tools.js";

const app = express();
app.use(express.json());

app.post("/places/search", async (req, res) => {
  const parseResult = PlacesSearchSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: "Requête invalide", details: parseResult.error.flatten() });
  }

  try {
    const payload = await handlePlacesSearch(parseResult.data);
    return res.json(payload);
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

  const output = handleRoutesOptimize(parseResult.data);
  return res.json(output);
});

app.post("/maps/export", (req, res) => {
  const parseResult = MapsExportSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: "Requête invalide", details: parseResult.error.flatten() });
  }

  const payload = handleMapsExport(parseResult.data);
  return res.json({ filename: payload.filename, content: payload.content, mimeType: payload.mimeType });
});

app.post("/pdf/build", async (req, res) => {
  const parseResult = PdfBuildSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: "Requête invalide", details: parseResult.error.flatten() });
  }

  const result = await handlePdfBuild(parseResult.data);
  return res.json(result);
});

app.post("/places/enrich", async (req, res) => {
  const parseResult = PlaceEnrichInputSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: "Requête invalide", details: parseResult.error.flatten() });
  }

  const result = await handlePlaceEnrich(parseResult.data);
  return res.json(result);
});

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  console.log(`Mock CityBites service listening on http://localhost:${port}`);
});
