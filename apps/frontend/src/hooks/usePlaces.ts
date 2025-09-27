import { useState, useCallback, useRef } from 'react';
import type { 
  SearchFormData, 
  GenerateResponse, 
  EnrichedPlace,
  PlaceFeatureCollection 
} from '../types/place';
import { enrichPlacesFromResponse, placesToGeoJSON } from '../utils/geojson';

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
  loadCached: () => boolean;
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
      if (process.env.NODE_ENV !== 'production') {
        console.log('🔍 Searching places with:', formData);
        console.log('📡 Making request to /api/generate...');
      }

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
        signal: abortController.signal,
      });
      
      if (process.env.NODE_ENV !== 'production') {
        console.log('📡 Response status:', response.status);
        console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));
      }

      if (!response.ok) {
        if (process.env.NODE_ENV !== 'production') {
          console.log('❌ Response not OK:', response.status, response.statusText);
        }
        const errorData = await response.json().catch(() => null);
        if (process.env.NODE_ENV !== 'production') {
          console.log('❌ Error data:', errorData);
        }
        throw new Error(errorData?.error ?? `HTTP error ${response.status}`);
      }

      const data: GenerateResponse = await response.json();
      if (process.env.NODE_ENV !== 'production') {
        console.log('📦 JSON parsed successfully, data type:', typeof data);
        console.log('✅ API Response:', data);
        // Check if we have coordinate data
        console.log('🗺️  Checking coordinate data in places...');
      }
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

      // Build enriched places directly from backend lat/lon
      const finalPlaces = enrichPlacesFromResponse(data, formData.theme);
      if (process.env.NODE_ENV !== 'production') {
        console.log('📍 Places from backend coordinates:', finalPlaces);
      }

      // Convert to GeoJSON
      const geoJSON = placesToGeoJSON(finalPlaces);
      if (process.env.NODE_ENV !== 'production') {
        console.log('🗺️  GeoJSON:', geoJSON);
      }

      setState({
        data,
        places: finalPlaces,
        geoJSON,
        loading: false,
        error: null,
      });

      try {
        localStorage.setItem('citybites:lastResult', JSON.stringify(data));
      } catch {}

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Request was cancelled, don't update state
        return;
      }

      if (process.env.NODE_ENV !== 'production') {
        console.error('❌ API Error:', error);
      }
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      
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

  const loadCached = useCallback(() => {
    try {
      const raw = localStorage.getItem('citybites:lastResult');
      if (!raw) return false;
      const data: GenerateResponse = JSON.parse(raw);
      const places = enrichPlacesFromResponse(data, data?.summary || undefined);
      const geoJSON = placesToGeoJSON(places);
      setState({ data, places, geoJSON, loading: false, error: null });
      return true;
    } catch {
      return false;
    }
  }, []);

  return {
    ...state,
    searchPlaces,
    clearResults,
    retry,
    loadCached,
  };
}
