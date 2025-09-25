"use client";

import React, { useState } from 'react';
import { usePlaces } from '../../hooks/usePlaces';

export default function TestApiPage() {
  const { data, places, loading, error, searchPlaces } = usePlaces();
  const [formData, setFormData] = useState({
    city: 'Paris',
    theme: 'restaurants',
    day: '2025-01-15',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await searchPlaces(formData);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>🔬 Test API CityBites</h1>
      <p>Cette page teste votre API pour vérifier les coordonnées GPS.</p>
      
      <form onSubmit={handleSubmit} style={{ marginBottom: '20px' }}>
        <div style={{ marginBottom: '10px' }}>
          <label>
            Ville:
            <input
              type="text"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              style={{ marginLeft: '10px', padding: '5px' }}
            />
          </label>
        </div>
        
        <div style={{ marginBottom: '10px' }}>
          <label>
            Thème:
            <input
              type="text"
              value={formData.theme}
              onChange={(e) => setFormData({ ...formData, theme: e.target.value })}
              style={{ marginLeft: '10px', padding: '5px' }}
            />
          </label>
        </div>
        
        <div style={{ marginBottom: '10px' }}>
          <label>
            Date:
            <input
              type="date"
              value={formData.day}
              onChange={(e) => setFormData({ ...formData, day: e.target.value })}
              style={{ marginLeft: '10px', padding: '5px' }}
            />
          </label>
        </div>
        
        <button 
          type="submit" 
          disabled={loading}
          style={{ 
            padding: '10px 20px', 
            backgroundColor: loading ? '#ccc' : '#007bff', 
            color: 'white',
            border: 'none',
            borderRadius: '5px'
          }}
        >
          {loading ? 'Recherche en cours...' : 'Tester l\'API'}
        </button>
      </form>

      {error && (
        <div style={{ 
          padding: '10px', 
          backgroundColor: '#ffe6e6', 
          border: '1px solid #ff0000',
          borderRadius: '5px',
          marginBottom: '20px'
        }}>
          <strong>Erreur:</strong> {error}
        </div>
      )}

      {data && (
        <div>
          <h2>📊 Résultats API</h2>
          
          <div style={{ marginBottom: '20px' }}>
            <h3>Résumé:</h3>
            <p>{data.summary}</p>
            <p><strong>Distance totale:</strong> {data.itinerary.totalDistanceKm} km</p>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <h3>🏢 Lieux trouvés ({data.itinerary.stops.length}):</h3>
            {data.itinerary.stops.map((stop, index) => (
              <div key={stop.id} style={{ 
                border: '1px solid #ddd', 
                padding: '10px', 
                marginBottom: '10px',
                borderRadius: '5px'
              }}>
                <h4>{index + 1}. {stop.name}</h4>
                <p><strong>ID:</strong> {stop.id}</p>
                {stop.notes && <p><strong>Notes:</strong> {stop.notes}</p>}
                
                {/* Let's check if there are lat/lon properties */}
                <details>
                  <summary>Propriétés complètes</summary>
                  <pre style={{ fontSize: '12px', backgroundColor: '#f5f5f5', padding: '10px' }}>
                    {JSON.stringify(stop, null, 2)}
                  </pre>
                </details>
              </div>
            ))}
          </div>

          {data.enrichments && data.enrichments.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h3>✨ Enrichissements:</h3>
              {data.enrichments.map((enrichment) => (
                <div key={enrichment.id} style={{ 
                  border: '1px solid #ddd', 
                  padding: '10px', 
                  marginBottom: '10px',
                  borderRadius: '5px'
                }}>
                  <h4>ID: {enrichment.id}</h4>
                  <p><strong>Résumé:</strong> {enrichment.summary}</p>
                  {enrichment.highlights.length > 0 && (
                    <div>
                      <strong>Points forts:</strong>
                      <ul>
                        {enrichment.highlights.map((highlight, i) => (
                          <li key={i}>{highlight}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {enrichment.bestTime && <p><strong>Meilleur moment:</strong> {enrichment.bestTime}</p>}
                  {enrichment.localTip && <p><strong>Conseil local:</strong> {enrichment.localTip}</p>}
                </div>
              ))}
            </div>
          )}

          <div>
            <h3>📁 Assets disponibles:</h3>
            {data.assets.map((asset, index) => (
              <div key={index} style={{ marginBottom: '5px' }}>
                <span>{asset.filename}</span>
                <span style={{ marginLeft: '10px', fontSize: '12px', color: '#666' }}>
                  ({asset.mimeType}, {asset.encoding})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: '30px', fontSize: '12px', color: '#666' }}>
        <p>💡 <strong>Instructions:</strong></p>
        <ol>
          <li>Ouvrez la console du navigateur (F12)</li>
          <li>Cliquez sur "Tester l'API"</li>
          <li>Regardez les logs pour voir la structure des données</li>
          <li>Vérifiez si les lieux ont des coordonnées lat/lon</li>
        </ol>
      </div>
    </div>
  );
}