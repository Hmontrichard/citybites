import type { Place, EnrichedPlace } from '../types/place';

// Geocoding API (using the same token as before)
const GEOCODING_URL = 'https://api.mapbox.com/geocoding/v5/mapbox.places';
const ACCESS_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

interface GeocodeResult {
  lat: number;
  lon: number;
  found: boolean;
  address?: string;
}

/**
 * Geocode a single place using geocoding API
 */
async function geocodeSinglePlace(
  placeName: string, 
  city: string = '',
  countryCode: string = 'fr'
): Promise<GeocodeResult> {
  if (!ACCESS_TOKEN) {
    console.warn('⚠️ Geocoding token missing');
    return { lat: 0, lon: 0, found: false };
  }

  try {
    // Build search query: "Restaurant Name, City, Country"
    const query = [placeName, city, countryCode].filter(Boolean).join(', ');
    const encodedQuery = encodeURIComponent(query);
    
    const url = `${GEOCODING_URL}/${encodedQuery}.json?access_token=${ACCESS_TOKEN}&limit=1&types=poi,address`;
    
    console.log(`🌍 Geocoding: "${query}"`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Geocoding API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.features && data.features.length > 0) {
      const feature = data.features[0];
      const [lon, lat] = feature.center;
      const address = feature.place_name;
      
      console.log(`✅ Found coordinates for "${placeName}": ${lat}, ${lon}`);
      
      return {
        lat,
        lon,
        found: true,
        address,
      };
    } else {
      console.warn(`❌ No coordinates found for "${placeName}"`);
      return { lat: 0, lon: 0, found: false };
    }
    
  } catch (error) {
    console.error(`❌ Geocoding error for "${placeName}":`, error);
    return { lat: 0, lon: 0, found: false };
  }
}

/**
 * Geocode multiple places with rate limiting
 */
export async function geocodePlaces(
  places: Place[], 
  city: string = 'Paris'
): Promise<EnrichedPlace[]> {
  console.log(`🌍 Starting geocoding for ${places.length} places in ${city}...`);
  
  const results: EnrichedPlace[] = [];
  
  for (let i = 0; i < places.length; i++) {
    const place = places[i];
    
    // Check if coordinates already exist and are valid
    if (place.lat && place.lon && place.lat !== 0 && place.lon !== 0) {
      console.log(`✅ Using existing coordinates for "${place.name}"`);
      results.push({
        ...place,
        address: place.notes,
      });
      continue;
    }
    
    // Geocode the place
    const geocodeResult = await geocodeSinglePlace(place.name, city);
    
    results.push({
      ...place,
      lat: geocodeResult.lat,
      lon: geocodeResult.lon,
      address: geocodeResult.address || place.notes,
    });
    
    // Rate limiting: wait 100ms between requests to avoid hitting API limits
    if (i < places.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  const foundCount = results.filter(r => r.lat !== 0 && r.lon !== 0).length;
  console.log(`🌍 Geocoding complete: ${foundCount}/${places.length} places found`);
  
  return results;
}

/**
 * Geocode places with better error handling and fallbacks
 */
export async function geocodePlacesWithFallback(
  places: Place[],
  city: string = 'Paris'
): Promise<EnrichedPlace[]> {
  try {
    return await geocodePlaces(places, city);
  } catch (error) {
    console.error('❌ Geocoding failed, using default coordinates:', error);
    
    // Fallback: return places with default Paris coordinates spread around the city
    const parisCenter = { lat: 48.8566, lon: 2.3522 };
    const offsetRange = 0.02; // ~2km radius
    
    return places.map((place, index) => ({
      ...place,
      lat: parisCenter.lat + (Math.random() - 0.5) * offsetRange,
      lon: parisCenter.lon + (Math.random() - 0.5) * offsetRange,
      address: `${place.name}, ${city}`,
    }));
  }
}

/**
 * Simple coordinate validation
 */
export function isValidCoordinates(lat: number, lon: number): boolean {
  return lat !== 0 && lon !== 0 && 
         lat >= -90 && lat <= 90 && 
         lon >= -180 && lon <= 180;
}