"use client";

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { usePlaces } from '../../hooks/usePlaces';
import BottomBar from '../../components/BottomBar';

// Dynamic import to avoid SSR issues with Leaflet
const LeafletMapView = dynamic(() => import('../../components/LeafletMapView'), {
  ssr: false,
  loading: () => <div style={{ 
    height: '500px', 
    backgroundColor: '#f0f0f0', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center',
    borderRadius: '8px'
  }}>
    🗺️ Chargement de la carte Leaflet...
  </div>
});

export default function LeafletTestPage() {
  const { data, places, geoJSON, loading, error, searchPlaces } = usePlaces();
  const [formData, setFormData] = useState({
    city: 'Paris',
    theme: 'restaurants',
    day: '2025-01-15',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await searchPlaces(formData);
  };

  const handlePlaceClick = (placeId: string) => {
    console.log('🖱️ Place clicked from parent:', placeId);
  };

  return (
    <div style={{ padding: '20px', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1>🗺️ CityBites avec Leaflet</h1>
        <p>Carte interactive stable avec OpenStreetMap + intégration Google Maps</p>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSubmit} style={{ 
        display: 'flex', 
        gap: '10px', 
        marginBottom: '20px',
        flexWrap: 'wrap'
      }}>
        <input
          type="text"
          placeholder="Ville"
          value={formData.city}
          onChange={(e) => setFormData({ ...formData, city: e.target.value })}
          style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
        />
        <input
          type="text"
          placeholder="Thème"
          value={formData.theme}
          onChange={(e) => setFormData({ ...formData, theme: e.target.value })}
          style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
        />
        <input
          type="date"
          value={formData.day}
          onChange={(e) => setFormData({ ...formData, day: e.target.value })}
          style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
        />
        <button 
          type="submit" 
          disabled={loading}
          style={{
            padding: '8px 16px',
            backgroundColor: loading ? '#ccc' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Recherche + Géocodage...' : 'Rechercher'}
        </button>
      </form>

      {/* Error Display */}
      {error && (
        <div style={{
          padding: '10px',
          backgroundColor: '#ffe6e6',
          border: '1px solid #ff0000',
          borderRadius: '4px',
          marginBottom: '20px'
        }}>
          ❌ {error}
        </div>
      )}

      {/* Loading Info */}
      {loading && (
        <div style={{
          padding: '10px',
          backgroundColor: '#fff3cd',
          border: '1px solid #ffeaa7',
          borderRadius: '4px',
          marginBottom: '20px'
        }}>
          ⏳ Recherche en cours... (géocodage des adresses en cours)
        </div>
      )}

      {/* Info Panel */}
      {data && (
        <div style={{ 
          marginBottom: '20px', 
          padding: '10px', 
          backgroundColor: '#d4edda', 
          border: '1px solid #c3e6cb',
          borderRadius: '4px',
          fontSize: '14px'
        }}>
          <strong>✅ Résultats:</strong> {data.itinerary.stops.length} lieux • 
          Distance: {data.itinerary.totalDistanceKm.toFixed(1)} km •
          {geoJSON && ` ${geoJSON.features.length} points géocodés`}
        </div>
      )}

      {/* Map Container */}
      <div style={{ 
        flex: 1, 
        minHeight: '500px',
        border: '1px solid #ddd',
        borderRadius: '8px',
        overflow: 'hidden'
      }}>
        <LeafletMapView 
          geoJSON={geoJSON}
          onPlaceClick={handlePlaceClick}
          style={{ height: '100%' }}
        />
      </div>

      {/* Instructions */}
      <div style={{ 
        marginTop: '20px', 
        fontSize: '12px', 
        color: '#666',
        backgroundColor: '#f8f9fa',
        padding: '10px',
        borderRadius: '4px'
      }}>
        <strong>✅ Carte Leaflet (stable) :</strong>
        <ul style={{ margin: '5px 0 0 20px' }}>
          <li>✅ Pas d'erreurs de projection</li>
          <li>🗺️ OpenStreetMap (gratuit)</li>
          <li>📍 Géolocalisation automatique</li>
          <li>🎯 Marqueurs colorés par catégorie</li>
          <li>🔗 Intégration Google Maps dans les popups</li>
          <li>🌍 Géocodage automatique des adresses</li>
        </ul>
      </div>
      
      {/* Bottom Bar with route and export buttons */}
      <BottomBar 
        places={places} 
        geoJSON={geoJSON}
      />
    </div>
  );
}