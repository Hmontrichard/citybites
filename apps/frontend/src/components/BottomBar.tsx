"use client";

import React, { useState } from 'react';
import type { EnrichedPlace, UserLocation } from '../types/place';
import { 
  createMultiPointRouteUrls, 
  openInGoogleMaps, 
  estimateLegsNeeded 
} from '../utils/googleMaps';
import { downloadGeoJSON } from '../utils/geojson';
import type { PlaceFeatureCollection } from '../types/place';

interface BottomBarProps {
  places: EnrichedPlace[];
  geoJSON: PlaceFeatureCollection | null;
  userLocation?: UserLocation | null;
  className?: string;
  style?: React.CSSProperties;
}

export default function BottomBar({ 
  places, 
  geoJSON, 
  userLocation, 
  className, 
  style 
}: BottomBarProps) {
  const [showRouteModal, setShowRouteModal] = useState(false);

  if (places.length === 0) return null;

  const handleCompleteRoute = () => {
    const validPlaces = places.filter(p => p.lat !== 0 && p.lon !== 0);
    
    if (validPlaces.length === 0) {
      alert('Aucun lieu avec des coordonnées valides trouvé.');
      return;
    }

    const legsCount = estimateLegsNeeded(validPlaces.length, !!userLocation);
    
    if (legsCount === 1) {
      // Single route - open directly
      const routes = createMultiPointRouteUrls(validPlaces, userLocation);
      if (routes.length > 0) {
        openInGoogleMaps(routes[0].url);
      }
    } else {
      // Multiple routes - show modal
      setShowRouteModal(true);
    }
  };

  const handleExportGeoJSON = () => {
    if (geoJSON) {
      downloadGeoJSON(geoJSON, 'citybites-places.geojson');
    }
  };

  const routes = showRouteModal ? createMultiPointRouteUrls(places, userLocation) : [];

  return (
    <>
      <div 
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          borderTop: '1px solid #ddd',
          padding: '12px 20px',
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          flexWrap: 'wrap',
          zIndex: 1000,
          ...style
        }}
        className={className}
      >
        {/* Route Button */}
        <button
          onClick={handleCompleteRoute}
          style={{
            backgroundColor: '#4285f4',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            padding: '10px 16px',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          🗺️ Itinéraire complet
          {estimateLegsNeeded(places.length, !!userLocation) > 1 && (
            <span style={{ 
              fontSize: '10px', 
              backgroundColor: 'rgba(255,255,255,0.2)',
              padding: '2px 6px',
              borderRadius: '10px'
            }}>
              {estimateLegsNeeded(places.length, !!userLocation)} étapes
            </span>
          )}
        </button>

        {/* Export Button */}
        <button
          onClick={handleExportGeoJSON}
          disabled={!geoJSON}
          style={{
            backgroundColor: geoJSON ? '#28a745' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            padding: '10px 16px',
            fontSize: '14px',
            cursor: geoJSON ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          📁 Exporter GeoJSON
        </button>

        {/* Info */}
        <div style={{ 
          fontSize: '12px', 
          color: '#666',
          marginLeft: 'auto'
        }}>
          {places.length} lieu{places.length > 1 ? 'x' : ''}
        </div>
      </div>

      {/* Route Modal */}
      {showRouteModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '24px',
            maxWidth: '500px',
            width: '100%',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>
              🗺️ Itinéraire multi-étapes
            </h3>
            
            <p style={{ fontSize: '14px', color: '#666', marginBottom: '20px' }}>
              Google Maps limite à 25 points par itinéraire. Votre parcours a été divisé en {routes.length} étape{routes.length > 1 ? 's' :''} :
            </p>

            <div style={{ marginBottom: '20px' }}>
              {routes.map((route, index) => (
                <div key={route.id} style={{
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  padding: '12px',
                  marginBottom: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <strong style={{ fontSize: '14px' }}>{route.name}</strong>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      {route.pointCount} points
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      openInGoogleMaps(route.url);
                      setShowRouteModal(false);
                    }}
                    style={{
                      backgroundColor: '#4285f4',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '6px 12px',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    Ouvrir ({index + 1}/{routes.length})
                  </button>
                </div>
              ))}
            </div>

            <div style={{ 
              padding: '12px', 
              backgroundColor: '#f8f9fa', 
              borderRadius: '4px',
              fontSize: '12px',
              color: '#666',
              marginBottom: '20px'
            }}>
              💡 <strong>Conseil :</strong> Commencez par l'étape 1, puis enchaînez avec les étapes suivantes dans Google Maps.
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowRouteModal(false)}
                style={{
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '8px 16px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}