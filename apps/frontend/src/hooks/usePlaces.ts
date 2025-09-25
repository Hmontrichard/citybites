import { useState, useCallback, useRef } from 'react';
import type { 
  SearchFormData, 
  GenerateResponse, 
  EnrichedPlace,
  PlaceFeatureCollection 
} from '../types/place';
import { enrichPlacesFromResponse, placesToGeoJSON } from '../utils/geojson';
import { geocodePlacesWithFallback } from '../utils/geocoding';

interface UsePlacesState {
  data: GenerateResponse | null;
  places: EnrichedPlace[];
  geoJSON: PlaceFeatureCollection | null;
  loading: boolean;
  error: string | null;
}

interface UsePlacesReturn extends UsePlacesState {
  searchPlaces: (formData: SearchFormData) => Promise<void>;
  clearResults: () => void;
  retry: () => void;
}

export function usePlaces(): UsePlacesReturn {
  const [state, setState] = useState<UsePlacesState>({
    data: null,
    places: [],
    geoJSON: null,
    loading: false,
    error: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const lastSearchRef = useRef<SearchFormData | null>(null);

  const searchPlaces = useCallback(async (formData: SearchFormData) => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    lastSearchRef.current = formData;

    setState(prev => ({
      ...prev,
      loading: true,
      error: null,
    }));

    try {
      console.log('🔍 Searching places with:', formData);
      console.log('📡 Making request to /generate...');

      const response = await fetch('/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
        signal: abortController.signal,
      });
      
      console.log('📡 Response status:', response.status);
      console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        console.log('❌ Response not OK:', response.status, response.statusText);
        const errorData = await response.json().catch(() => null);
        console.log('❌ Error data:', errorData);
        throw new Error(errorData?.error ?? `Erreur HTTP ${response.status}`);
      }

      console.log('📦 Parsing JSON response...');
      const data: GenerateResponse = await response.json();
      console.log('📦 JSON parsed successfully, data type:', typeof data);
      console.log('✅ API Response:', data);
      
      // Check if we have coordinate data
      console.log('🗺️  Checking coordinate data in places...');
      if (data.itinerary?.stops) {
        data.itinerary.stops.forEach((stop, index) => {
          console.log(`Place ${index + 1}:`, {
            name: stop.name,
            id: stop.id,
            // Let's see what properties the stop actually has
            keys: Object.keys(stop),
            data: stop
          });
        });
      }

      // Try to enrich places (will use 0,0 coordinates if none provided)
      const enrichedPlaces = enrichPlacesFromResponse(data, formData.theme);
      console.log('📍 Enriched places (before geocoding):', enrichedPlaces);
      
      // Add geocoding to get real coordinates
      console.log('🌍 Starting geocoding process...');
      const geocodedPlaces = await geocodePlacesWithFallback(
        enrichedPlaces.map(p => ({ id: p.id, name: p.name, lat: p.lat, lon: p.lon, notes: p.notes })),
        formData.city
      );
      
      // Merge geocoded coordinates with enriched data
      const finalPlaces = enrichedPlaces.map(place => {
        const geocoded = geocodedPlaces.find(g => g.id === place.id);
        return {
          ...place,
          lat: geocoded?.lat || place.lat,
          lon: geocoded?.lon || place.lon,
          address: geocoded?.address || place.address,
        };
      });
      
      console.log('📍 Final places (after geocoding):', finalPlaces);

      // Convert to GeoJSON
      const geoJSON = placesToGeoJSON(finalPlaces);
      console.log('🗺️  GeoJSON:', geoJSON);

      setState({
        data,
        places: finalPlaces,
        geoJSON,
        loading: false,
        error: null,
      });

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Request was cancelled, don't update state
        return;
      }

      console.error('❌ API Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Une erreur est survenue';
      
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));
    }
  }, []);

  const clearResults = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    setState({
      data: null,
      places: [],
      geoJSON: null,
      loading: false,
      error: null,
    });
    
    lastSearchRef.current = null;
  }, []);

  const retry = useCallback(() => {
    if (lastSearchRef.current) {
      searchPlaces(lastSearchRef.current);
    }
  }, [searchPlaces]);

  return {
    ...state,
    searchPlaces,
    clearResults,
    retry,
  };
}