"use client";

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { PlaceFeatureCollection } from '../types/place';
import { createSingleDestinationUrl, openInGoogleMaps } from '../utils/googleMaps';

// Fix for default markers in Leaflet
// Use locally bundled images instead of external CDN (CSP-friendly)
// @ts-ignore - allow png imports as strings
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
// @ts-ignore
import iconUrl from 'leaflet/dist/images/marker-icon.png';
// @ts-ignore
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

// Ensure Leaflet uses the imported assets
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: (iconRetinaUrl as unknown) as string,
  iconUrl: (iconUrl as unknown) as string,
  shadowUrl: (shadowUrl as unknown) as string,
});

// Custom icons for different categories
const createCustomIcon = (category: string) => {
  const colors: Record<string, string> = {
    restaurant: '#ff6b35',
    cafe: '#8b4513',
    bar: '#9b59b6',
    museum: '#3498db',
    park: '#27ae60',
    shop: '#f39c12',
    attraction: '#e74c3c',
    other: '#95a5a6',
  };

  const color = colors[category] || colors.other;
  
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: 20px;
        height: 20px;
        background-color: ${color};
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 10px;
        font-weight: bold;
      ">
        ${category === 'restaurant' ? '🍽️' : 
          category === 'cafe' ? '☕' :
          category === 'bar' ? '🍺' :
          category === 'museum' ? '🏛️' :
          category === 'park' ? '🌳' :
          category === 'shop' ? '🛍️' :
          category === 'attraction' ? '🎯' : '📍'}
      </div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
};

// Component to fit bounds when data changes
function FitBounds({ geoJSON }: { geoJSON: PlaceFeatureCollection }) {
  const map = useMap();

  useEffect(() => {
    if (geoJSON.features.length > 0) {
      const validFeatures = geoJSON.features.filter(feature => {
        const [lon, lat] = feature.geometry.coordinates;
        return lat !== 0 && lon !== 0;
      });

      if (validFeatures.length > 0) {
        const bounds = L.latLngBounds(
          validFeatures.map(feature => {
            const [lon, lat] = feature.geometry.coordinates;
            return [lat, lon] as [number, number];
          })
        );
        
        map.fitBounds(bounds, { padding: [20, 20], maxZoom: 15 });
      }
    }
  }, [geoJSON, map]);

  return null;
}

// Component for user location
function LocationControl() {
  const map = useMap();
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation([latitude, longitude]);
          console.log('📍 User location found:', latitude, longitude);
        },
        (error) => {
          console.warn('⚠️ Geolocation error:', error.message);
        }
      );
    }
  }, []);

  const centerOnUser = () => {
    if (userLocation) {
      map.setView(userLocation, 15);
    }
  };

  if (!userLocation) return null;

  return (
    <>
      <Marker position={userLocation}>
        <Popup>
          <div style={{ textAlign: 'center' }}>
            <strong>📍 Votre position</strong>
          </div>
        </Popup>
      </Marker>
      <div style={{
        position: 'absolute',
        bottom: '20px',
        right: '20px',
        zIndex: 1000,
      }}>
        <button
          onClick={centerOnUser}
          style={{
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '20px',
            padding: '8px 12px',
            fontSize: '12px',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          }}
          title="Recentrer sur ma position"
        >
          📍 Ma position
        </button>
      </div>
    </>
  );
}

interface LeafletMapViewProps {
  geoJSON: PlaceFeatureCollection | null;
  onPlaceClick?: (placeId: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

export default function LeafletMapView({ 
  geoJSON, 
  onPlaceClick, 
  className, 
  style 
}: LeafletMapViewProps) {
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

  // Get user location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
        },
        () => {
          // Fallback to Paris if geolocation fails
          setUserLocation([48.8566, 2.3522]);
        }
      );
    } else {
      setUserLocation([48.8566, 2.3522]);
    }
  }, []);

  if (!userLocation) {
    return (
      <div style={{ 
        ...style,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f0f0f0',
        borderRadius: '8px'
      }} className={className}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>🗺️</div>
          <div>Chargement de la carte...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', ...style }} className={className}>
      <MapContainer
        center={userLocation}
        zoom={12}
        style={{ height: '100%', width: '100%', borderRadius: '8px' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        {/* User location and controls */}
        <LocationControl />

        {/* Places markers */}
        {geoJSON && geoJSON.features.map((feature) => {
          const [lon, lat] = feature.geometry.coordinates;
          
          // Skip invalid coordinates
          if (lat === 0 && lon === 0) return null;

          const { properties } = feature;
          
          return (
            <Marker
              key={properties.id}
              position={[lat, lon]}
              icon={createCustomIcon(properties.category)}
              eventHandlers={{
                click: () => {
                  console.log('🖱️ Place clicked:', properties.name);
                  if (onPlaceClick) {
                    onPlaceClick(properties.id);
                  }
                },
              }}
            >
              <Popup maxWidth={300}>
                <div style={{ fontFamily: 'system-ui, sans-serif' }}>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>
                    {properties.name}
                  </h3>
                  
                  <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#666' }}>
                    <strong>Type:</strong> {properties.category}
                  </p>
                  
                  {properties.summary && (
                    <p style={{ margin: '0 0 8px 0', fontSize: '13px' }}>
                      {properties.summary}
                    </p>
                  )}
                  
                  {properties.highlights && properties.highlights.length > 0 && (
                    <div style={{ margin: '8px 0' }}>
                      <strong style={{ fontSize: '12px' }}>Points forts:</strong>
                      <ul style={{ margin: '4px 0 0 16px', fontSize: '12px' }}>
                        {properties.highlights.slice(0, 3).map((highlight, i) => (
                          <li key={i}>{highlight}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {properties.bestTime && (
                    <p style={{ margin: '4px 0', fontSize: '12px' }}>
                      <strong>Meilleur moment:</strong> {properties.bestTime}
                    </p>
                  )}
                  
                  {properties.localTip && (
                    <p style={{ margin: '4px 0', fontSize: '12px', fontStyle: 'italic' }}>
                      💡 {properties.localTip}
                    </p>
                  )}
                  
                  <div style={{ marginTop: '12px', textAlign: 'center' }}>
                    <button
                      onClick={() => {
                        const url = createSingleDestinationUrl(
                          { id: properties.id, name: properties.name, lat, lon },
                          userLocation ? { lat: userLocation[0], lon: userLocation[1] } : undefined
                        );
                        openInGoogleMaps(url);
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
                      🗺️ Ouvrir dans Google Maps
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Fit bounds to show all places */}
        {geoJSON && <FitBounds geoJSON={geoJSON} />}
      </MapContainer>
    </div>
  );
}