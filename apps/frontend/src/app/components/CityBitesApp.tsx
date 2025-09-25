"use client";

import React from 'react';
import dynamic from 'next/dynamic';
import { usePlaces } from '../../hooks/usePlaces';
import type { SearchFormData } from '../../types/place';

// Load components dynamically to avoid SSR issues
const LeafletMapView = dynamic(
  () => import('../../components/LeafletMapView'),
  { ssr: false }
);

const BottomBar = dynamic(
  () => import('../../components/BottomBar'),
  { ssr: false }
);

export default function CityBitesApp() {
  const { data, places, geoJSON, loading, error, searchPlaces, clearResults } = usePlaces();
  const [showSearchForm, setShowSearchForm] = React.useState(true);

  const handleSearch = (formData: SearchFormData) => {
    searchPlaces(formData);
    setShowSearchForm(false);
  };

  const handleNewSearch = () => {
    clearResults();
    setShowSearchForm(true);
  };

  return (
    <div className="h-full min-h-[70vh] flex flex-col">
      {/* Map Container */}
      <div className="flex-1 relative">
        <LeafletMapView 
          geoJSON={geoJSON}
          onPlaceClick={(placeId) => {
            console.log('Place clicked:', placeId);
          }}
          style={{ height: '100%', width: '100%' }}
        />
        
        {/* Search Form Overlay */}
        {showSearchForm && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <h3 className="text-xl font-bold mb-4 text-center">Rechercher des lieux</h3>
              <SearchForm onSearch={handleSearch} loading={loading} />
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => setShowSearchForm(false)}
                  className="text-sm text-gray-600 hover:text-gray-800 underline"
                >
                  Voir la carte d'abord
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Loading Overlay */}
        {loading && !showSearchForm && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
            <div className="bg-white rounded-lg p-6 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-700">Recherche en cours...</p>
            </div>
          </div>
        )}

        {/* Error Overlay */}
        {error && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
            <div className="bg-white rounded-lg p-6 text-center max-w-md">
              <div className="text-red-500 text-4xl mb-4">⚠️</div>
              <h3 className="text-lg font-semibold mb-2">Erreur</h3>
              <p className="text-gray-700 mb-4">{error}</p>
              <button
                onClick={() => {
                  clearResults();
                  setShowSearchForm(true);
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Nouvelle recherche
              </button>
            </div>
          </div>
        )}
        
        {/* New Search Button */}
        {places.length > 0 && (
          <button
            onClick={handleNewSearch}
            className="absolute top-4 left-4 bg-blue-500 text-white px-4 py-2 rounded-lg z-[1000] hover:bg-blue-600"
          >
            🔍 Nouvelle recherche
          </button>
        )}
      </div>

      {/* Bottom Bar */}
      {places.length > 0 && (
        <div className="h-auto">
          <BottomBar
            places={places}
            geoJSON={geoJSON}
          />
        </div>
      )}
    </div>
  );
}

// Simple search form component
function SearchForm({ onSearch, loading }: { onSearch: (data: SearchFormData) => void; loading: boolean }) {
  const [city, setCity] = React.useState('');
  const [theme, setTheme] = React.useState('');
  const [day, setDay] = React.useState(new Date().toISOString().split('T')[0]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!city || !theme || !day) return;
    onSearch({ city, theme, day });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Ville</label>
        <input
          type="text"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Ex: Paris, Lyon, Marseille..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-1">Thème</label>
        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        >
          <option value="">Choisissez un thème</option>
          <option value="restaurant">Restaurants</option>
          <option value="cafe">Cafés</option>
          <option value="bar">Bars</option>
          <option value="museum">Musées</option>
          <option value="park">Parcs</option>
          <option value="attraction">Attractions touristiques</option>
        </select>
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-1">Date</label>
        <input
          type="date"
          value={day}
          onChange={(e) => setDay(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>
      
      <button
        type="submit"
        disabled={loading || !city || !theme || !day}
        className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {loading ? 'Recherche...' : '🚀 Rechercher'}
      </button>
    </form>
  );
}
