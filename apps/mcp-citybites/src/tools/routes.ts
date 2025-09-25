import { z } from "zod";

export const RouteOptimizeSchema = z.object({
  points: z.array(z.object({ id: z.string(), lat: z.number(), lon: z.number() })),
});

export const RouteOptimizeResultSchema = z.object({
  order: z.array(z.string()),
  distanceKm: z.number(),
});

export type RouteOptimizeInput = z.infer<typeof RouteOptimizeSchema>;
export type RouteOptimizeOutput = { order: string[]; distanceKm: number };

export function handleRoutesOptimize(input: RouteOptimizeInput): RouteOptimizeOutput {
  const { points } = input;
  return {
    order: points.map((p) => p.id),
    distanceKm: 3.4,
  };
}
