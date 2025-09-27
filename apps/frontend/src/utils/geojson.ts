import type { 
  Place, 
  EnrichedPlace, 
  PlaceFeature, 
  PlaceFeatureCollection, 
  PlaceCategory,
  GenerateResponse 
} from '../types/place';

// Mapping for place categories based on themes/keywords
const CATEGORY_KEYWORDS: Record<string, PlaceCategory> = {
  restaurant: 'restaurant',
  café: 'cafe',
  coffee: 'cafe',
  bar: 'bar',
  musée: 'museum',
  museum: 'museum',
  parc: 'park',
  park: 'park',
  boutique: 'shop',
  shop: 'shop',
  magasin: 'shop',
  attraction: 'attraction',
  monument: 'attraction',
};

// Icon mapping for categories
const CATEGORY_ICONS: Record<PlaceCategory, string> = {
  restaurant: 'restaurant-icon',
  cafe: 'cafe-icon',
  bar: 'bar-icon',
  museum: 'museum-icon',
  park: 'park-icon',
  shop: 'shop-icon',
  attraction: 'attraction-icon',
  other: 'other-icon',
};

/**
 * Infer place category from name or notes
 */
export function inferPlaceCategory(place: Place, theme?: string): PlaceCategory {
  const searchText = `${place.name} ${place.notes || ''} ${theme || ''}`.toLowerCase();
  
  for (const [keyword, category] of Object.entries(CATEGORY_KEYWORDS)) {
    if (searchText.includes(keyword)) {
      return category;
    }
  }
  
  // Default fallback based on theme
  if (theme) {
    const themeCategory = CATEGORY_KEYWORDS[theme.toLowerCase()];
    if (themeCategory) return themeCategory;
  }
  
  return 'other';
}

/**
 * Create a short name for display on map
 */
function createShortName(name: string): string {
  // Take first word or first 2 words if short
  const words = name.split(' ');
  if (words.length === 1) return words[0];
  
  const firstTwo = words.slice(0, 2).join(' ');
  return firstTwo.length <= 12 ? firstTwo : words[0];
}

/**
 * Convert API response to enriched places
 */
export function enrichPlacesFromResponse(
  response: GenerateResponse,
  theme?: string
): EnrichedPlace[] {
  const { itinerary, enrichments } = response;
  const enrichmentMap = new Map(
    enrichments?.map(e => [e.id, e]) || []
  );

  return itinerary.stops.map(stop => {
    const enrichment = enrichmentMap.get(stop.id);
    const basePlace: Place = {
      id: stop.id,
      name: stop.name,
      lat: (stop as any).lat ?? 0,
      lon: (stop as any).lon ?? 0,
      notes: stop.notes,
    };

    const category = inferPlaceCategory(basePlace, theme);
    
    return {
      ...basePlace,
      category,
      summary: enrichment?.summary || stop.notes,
      highlights: enrichment?.highlights || [],
      bestTime: enrichment?.bestTime,
      localTip: enrichment?.localTip,
    };
  });
}

/**
 * Convert enriched places to GeoJSON FeatureCollection for Mapbox
 */
export function placesToGeoJSON(places: EnrichedPlace[]): PlaceFeatureCollection {
  const features: PlaceFeature[] = places.map((place, idx) => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [place.lon, place.lat], // GeoJSON is [lon, lat]
    },
    properties: {
      id: place.id,
      name: place.name,
      category: place.category || 'other',
      icon: CATEGORY_ICONS[place.category || 'other'],
      shortName: createShortName(place.name),
      summary: place.summary,
      highlights: place.highlights || [],
      bestTime: place.bestTime,
      localTip: place.localTip,
      rating: place.rating,
      address: place.address,
      dishes: place.dishes || [],
      reviews: place.reviews || [],
      order: idx,
    },
  }));

  return {
    type: 'FeatureCollection',
    features,
  };
}

/**
 * Calculate bounding box for places to fit map view
 */
export function calculateBounds(places: Place[]): [[number, number], [number, number]] | null {
  if (places.length === 0) return null;

  const lats = places.map(p => p.lat);
  const lons = places.map(p => p.lon);

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  // Add some padding (about 10%)
  const latPadding = (maxLat - minLat) * 0.1;
  const lonPadding = (maxLon - minLon) * 0.1;

  return [
    [minLon - lonPadding, minLat - latPadding], // Southwest
    [maxLon + lonPadding, maxLat + latPadding], // Northeast
  ];
}

/**
 * Get center point of places
 */
export function getPlacesCenter(places: Place[]): [number, number] | null {
  if (places.length === 0) return null;

  const avgLat = places.reduce((sum, p) => sum + p.lat, 0) / places.length;
  const avgLon = places.reduce((sum, p) => sum + p.lon, 0) / places.length;

  return [avgLon, avgLat]; // [lon, lat] for Mapbox
}

/**
 * Filter places by category
 */
export function filterPlacesByCategory(
  featureCollection: PlaceFeatureCollection,
  categories: PlaceCategory[]
): PlaceFeatureCollection {
  const filteredFeatures = featureCollection.features.filter(feature =>
    categories.includes(feature.properties.category)
  );

  return {
    type: 'FeatureCollection',
    features: filteredFeatures,
  };
}

/**
 * Export GeoJSON as downloadable file
 */
export function downloadGeoJSON(featureCollection: PlaceFeatureCollection, filename = 'places.geojson'): void {
  const blob = new Blob([JSON.stringify(featureCollection, null, 2)], {
    type: 'application/geo+json',
  });
  
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}