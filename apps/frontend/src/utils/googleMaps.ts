import type { Place, UserLocation, TravelMode } from '../types/place';

/**
 * Generate a Google Maps URL for a single destination
 */
export function createSingleDestinationUrl(
  place: Place, 
  origin?: UserLocation, 
  travelMode: TravelMode = 'walking'
): string {
  const params = new URLSearchParams({
    api: '1',
    destination: `${place.lat},${place.lon}`,
    travelmode: travelMode,
  });

  if (origin) {
    params.set('origin', `${origin.lat},${origin.lon}`);
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/**
 * Interface for Google Maps route leg
 */
export interface RouteLeg {
  id: number;
  name: string;
  url: string;
  pointCount: number;
}

/**
 * Split places into Google Maps legs (max 25 waypoints per URL)
 */
export function createMultiPointRouteUrls(
  places: Place[],
  origin?: UserLocation,
  travelMode: TravelMode = 'walking'
): RouteLeg[] {
  if (places.length === 0) return [];
  
  // Google Maps limit: origin + waypoints + destination = max 25 points
  const MAX_POINTS_PER_LEG = 25;
  const legs: RouteLeg[] = [];

  // If we have origin, it takes one slot
  const availableWaypoints = origin ? MAX_POINTS_PER_LEG - 2 : MAX_POINTS_PER_LEG - 1;
  
  // If all places fit in one leg
  if (places.length <= MAX_POINTS_PER_LEG) {
    const url = createCompleteRouteUrl(places, origin, travelMode);
    legs.push({
      id: 1,
      name: `Itinéraire complet (${places.length} points)`,
      url,
      pointCount: places.length
    });
    return legs;
  }

  // Split into multiple legs
  let currentOrigin = origin;
  let remainingPlaces = [...places];
  let legIndex = 1;

  while (remainingPlaces.length > 0) {
    // Take as many places as we can for this leg
    const placesForThisLeg = remainingPlaces.splice(0, availableWaypoints);
    
    // If this is the last leg and we have remaining places, adjust
    if (remainingPlaces.length > 0 && remainingPlaces.length < availableWaypoints) {
      // Combine with last leg if possible
      placesForThisLeg.push(...remainingPlaces);
      remainingPlaces = [];
    }

    const url = createCompleteRouteUrl(placesForThisLeg, currentOrigin, travelMode);
    legs.push({
      id: legIndex,
      name: `Étape ${legIndex} (${placesForThisLeg.length} points)`,
      url,
      pointCount: placesForThisLeg.length
    });

    // Next leg starts from the last place of current leg
    if (remainingPlaces.length > 0) {
      const lastPlace = placesForThisLeg[placesForThisLeg.length - 1];
      currentOrigin = { lat: lastPlace.lat, lon: lastPlace.lon };
    }

    legIndex++;
  }

  return legs;
}

/**
 * Create a complete route URL with all waypoints
 */
function createCompleteRouteUrl(
  places: Place[],
  origin?: UserLocation,
  travelMode: TravelMode = 'walking'
): string {
  if (places.length === 0) return '';

  const baseUrl = 'https://www.google.com/maps/dir/';
  const params = new URLSearchParams({ api: '1', travelmode: travelMode });

  // Build the route
  if (origin) {
    params.set('origin', `${origin.lat},${origin.lon}`);
  }

  // Set destination as the last place
  const destination = places[places.length - 1];
  params.set('destination', `${destination.lat},${destination.lon}`);

  // Add waypoints (all except the last one, and exclude origin if we have user location)
  const waypoints = places.slice(0, -1);
  if (waypoints.length > 0) {
    const waypointString = waypoints
      .map(place => `${place.lat},${place.lon}`)
      .join('|');
    params.set('waypoints', waypointString);
  }

  return `${baseUrl}?${params.toString()}`;
}

/**
 * Open URL in new tab/window (works on mobile to open native app)
 */
export function openInGoogleMaps(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Create a shareable Google Maps URL with place name
 */
export function createShareableUrl(place: Place): string {
  const placeName = encodeURIComponent(place.name);
  return `https://maps.google.com/maps?q=${placeName}@${place.lat},${place.lon}`;
}

/**
 * Estimate if we need multiple legs for better UX messaging
 */
export function estimateLegsNeeded(placeCount: number, hasOrigin: boolean = false): number {
  const MAX_POINTS_PER_LEG = 25;
  const availableSlots = hasOrigin ? MAX_POINTS_PER_LEG - 1 : MAX_POINTS_PER_LEG;
  
  return Math.ceil(placeCount / availableSlots);
}