import { z } from "zod";

export const PlaceZ = z.object({
  id: z.string(),
  name: z.string(),
  lat: z.number(),
  lon: z.number(),
  notes: z.string().optional(),
});

export const GenerateParamsZ = z.object({
  city: z.string().min(1),
  theme: z.string().min(1),
  day: z.string().min(1),
});

export const OptimizeInputZ = z.object({
  points: z.array(z.object({ id: z.string(), lat: z.number(), lon: z.number() })).min(2),
});

export const OptimizeResultZ = z.object({
  order: z.array(z.string()),
  distanceKm: z.number(),
  polyline: z.string().optional(),
});

export type GenerateParams = z.infer<typeof GenerateParamsZ>;
export type OptimizeInput = z.infer<typeof OptimizeInputZ>;
export type OptimizeResult = z.infer<typeof OptimizeResultZ>;
export type Place = z.infer<typeof PlaceZ>;

export function buildGenerationKey({ city, theme, day }: GenerateParams) {
  return `gen:${city.trim().toLowerCase()}:${theme.trim().toLowerCase()}:${day}`;
}
