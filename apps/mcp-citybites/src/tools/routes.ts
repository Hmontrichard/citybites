import { z } from "zod";

export const RouteOptimizeSchema = z.object({
  points: z.array(z.object({ id: z.string(), lat: z.number(), lon: z.number() })).min(2),
});

export const RouteOptimizeResultSchema = z.object({
  order: z.array(z.string()),
  distanceKm: z.number(),
  polyline: z.string().optional(),
});

export type RouteOptimizeInput = z.infer<typeof RouteOptimizeSchema>;
export type RouteOptimizeOutput = { order: string[]; distanceKm: number; polyline?: string };

function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + Math.cos(la1) * Math.cos(la2) * sinDLon * sinDLon;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function polylineEncode(points: Array<{ lat: number; lon: number }>): string {
  // Simple polyline encoder (Google polyline algorithm)
  const factor = 1e5;
  let output = "";
  let prevLat = 0;
  let prevLon = 0;
  for (const p of points) {
    const lat = Math.round(p.lat * factor);
    const lon = Math.round(p.lon * factor);
    const dLat = lat - prevLat;
    const dLon = lon - prevLon;
    output += encodeSignedNumber(dLat) + encodeSignedNumber(dLon);
    prevLat = lat;
    prevLon = lon;
  }
  return output;
}

function encodeSignedNumber(num: number) {
  let sgn = num << 1;
  if (num < 0) sgn = ~sgn;
  return encodeNumber(sgn);
}
function encodeNumber(num: number) {
  let output = "";
  while (num >= 0x20) {
    output += String.fromCharCode((0x20 | (num & 0x1f)) + 63);
    num >>= 5;
  }
  output += String.fromCharCode(num + 63);
  return output;
}

export function handleRoutesOptimize(input: RouteOptimizeInput): RouteOptimizeOutput {
  const { points } = input;
  const n = points.length;
  // Nearest neighbor starting at first point
  const visited = new Array(n).fill(false);
  const orderIdx: number[] = [];
  let cur = 0;
  orderIdx.push(cur);
  visited[cur] = true;
  for (let step = 1; step < n; step++) {
    let best = -1;
    let bestDist = Number.POSITIVE_INFINITY;
    for (let j = 0; j < n; j++) {
      if (visited[j]) continue;
      const d = haversineKm(points[cur], points[j]);
      if (d < bestDist) {
        bestDist = d;
        best = j;
      }
    }
    if (best === -1) break;
    orderIdx.push(best);
    visited[best] = true;
    cur = best;
  }

  // 2-opt improvement
  const maxIters = 2000;
  let improved = true;
  let iter = 0;
  function pathDistance(idx: number[]) {
    let total = 0;
    for (let i = 0; i < idx.length - 1; i++) {
      total += haversineKm(points[idx[i]], points[idx[i + 1]]);
    }
    return total;
  }
  while (improved && iter < maxIters) {
    improved = false;
    iter++;
    for (let i = 1; i < orderIdx.length - 2; i++) {
      for (let k = i + 1; k < orderIdx.length - 1; k++) {
        const newOrder = orderIdx.slice(0, i).concat(orderIdx.slice(i, k + 1).reverse(), orderIdx.slice(k + 1));
        if (pathDistance(newOrder) + 0.0001 < pathDistance(orderIdx)) {
          orderIdx.splice(0, orderIdx.length, ...newOrder);
          improved = true;
        }
      }
    }
  }

  const order = orderIdx.map((i) => points[i].id);
  const distanceKm = pathDistance(orderIdx);
  const polyline = polylineEncode(orderIdx.map((i) => points[i]));

  return { order, distanceKm, polyline };
}
