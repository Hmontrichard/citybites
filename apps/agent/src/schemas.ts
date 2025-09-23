import { z } from "zod";

export const PlaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  lat: z.number(),
  lon: z.number(),
  notes: z.string().optional(),
});

export const PlacesSearchResultSchema = z.object({
  source: z.string(),
  warning: z.string().optional(),
  results: z.array(PlaceSchema),
});

export const RouteOptimizeResultSchema = z.object({
  order: z.array(z.string()),
  distanceKm: z.number(),
});

export const MapsExportResultSchema = z.object({
  filename: z.string(),
  content: z.string(),
  mimeType: z.string(),
});

export const PdfBuildResultSchema = z.object({
  filename: z.string(),
  content: z.string(),
  format: z.enum(["pdf", "html"]),
  encoding: z.enum(["base64", "utf-8"]).optional(),
  mimeType: z.string(),
  warning: z.string().optional(),
  htmlFallback: z.string().optional(),
});

export const PlaceEnrichmentSchema = z.object({
  summary: z.string(),
  highlights: z.array(z.string()),
  bestTime: z.string().optional(),
  localTip: z.string().optional(),
  warning: z.string().optional(),
});

export const GenerateRequestSchema = z.object({
  city: z.string().min(1, "Ville obligatoire"),
  theme: z.string().min(1, "Thème obligatoire"),
  day: z.string().min(1, "Jour obligatoire"),
});

export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;
export type Place = z.infer<typeof PlaceSchema>;
export type PlacesSearchResult = z.infer<typeof PlacesSearchResultSchema>;
export type RouteOptimizeResult = z.infer<typeof RouteOptimizeResultSchema>;
export type MapsExportResult = z.infer<typeof MapsExportResultSchema>;
export type PdfBuildResult = z.infer<typeof PdfBuildResultSchema>;
export type PlaceEnrichment = z.infer<typeof PlaceEnrichmentSchema>;
