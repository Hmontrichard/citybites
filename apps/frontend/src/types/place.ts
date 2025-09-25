// Place data structure from the API
export interface Place {
  id: string;
  name: string;
  lat: number;
  lon: number;
  notes?: string;
}

// Extended place with enrichment data
export interface EnrichedPlace extends Place {
  category?: PlaceCategory;
  summary?: string;
  highlights?: string[];
  bestTime?: string;
  localTip?: string;
  rating?: number;
  address?: string;
  dishes?: string[];
  reviews?: string[];
  url?: string;
}

// Place categories for icons and filtering
export type PlaceCategory = 
  | 'restaurant' 
  | 'cafe' 
  | 'bar' 
  | 'museum' 
  | 'park' 
  | 'shop' 
  | 'attraction' 
  | 'other';

// API Response types (existing from your backend)
export interface GenerateResponse {
  summary: string;
  itinerary: {
    totalDistanceKm: number;
    stops: Array<{ id: string; name: string; notes?: string }>;
  };
  warnings?: string[];
  assets: Array<{ 
    filename: string; 
    content: string; 
    mimeType?: string; 
    encoding?: "base64" | "utf-8" 
  }>;
  enrichments?: Array<{
    id: string;
    summary: string;
    highlights: string[];
    bestTime?: string;
    localTip?: string;
  }>;
}

// Search form data
export interface SearchFormData {
  city: string;
  theme: string;
  day: string;
}

// GeoJSON Feature for Mapbox
export interface PlaceFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lon, lat]
  };
  properties: {
    id: string;
    name: string;
    category: PlaceCategory;
    icon: string;
    shortName?: string;
    summary?: string;
    highlights?: string[];
    bestTime?: string;
    localTip?: string;
    rating?: number;
    address?: string;
    dishes?: string[];
    reviews?: string[];
  };
}

// GeoJSON FeatureCollection
export interface PlaceFeatureCollection {
  type: 'FeatureCollection';
  features: PlaceFeature[];
}

// Google Maps travel modes
export type TravelMode = 'walking' | 'driving' | 'transit' | 'bicycling';

// User location
export interface UserLocation {
  lat: number;
  lon: number;
  accuracy?: number;
}