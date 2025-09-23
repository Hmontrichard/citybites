import express from "express";
import process from "node:process";
import { generateGuide } from "./generator.js";
import { GenerateRequestSchema } from "./schemas.js";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/generate", async (req, res) => {
  const parseResult = GenerateRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: "Requête invalide", details: parseResult.error.flatten() });
  }

  try {
    const result = await generateGuide(parseResult.data);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur agent";
    console.error("[agent] génération échouée", error);
    return res.status(502).json({ error: message });
  }
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`Agent CityBites écoute sur http://localhost:${port}`);
});
