"use client";

import React, { useState } from 'react';
import { usePlaces } from '../../hooks/usePlaces';

export default function TestSimplePage() {
  const { data, loading, error, searchPlaces } = usePlaces();
  const [formData, setFormData] = useState({
    city: 'Paris',
    theme: 'restaurants',
    day: '2025-01-15',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('🔍 Starting search...');
    await searchPlaces(formData);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h1>🧪 Test Simple CityBites</h1>
      <p>Test uniquement de l'API sans carte</p>
      
      <form onSubmit={handleSubmit} style={{ marginBottom: '20px' }}>
        <div style={{ marginBottom: '10px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Ville:</label>
          <input
            type="text"
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
          />
        </div>
        
        <div style={{ marginBottom: '10px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Thème:</label>
          <input
            type="text"
            value={formData.theme}
            onChange={(e) => setFormData({ ...formData, theme: e.target.value })}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
          />
        </div>
        
        <div style={{ marginBottom: '10px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Date:</label>
          <input
            type="date"
            value={formData.day}
            onChange={(e) => setFormData({ ...formData, day: e.target.value })}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
          />
        </div>
        
        <button 
          type="submit" 
          disabled={loading}
          style={{
            padding: '10px 20px',
            backgroundColor: loading ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Recherche en cours...' : 'Tester l\'API'}
        </button>
      </form>

      {error && (
        <div style={{
          padding: '15px',
          backgroundColor: '#ffe6e6',
          border: '1px solid #ff0000',
          borderRadius: '4px',
          marginBottom: '20px'
        }}>
          <strong>❌ Erreur:</strong> {error}
        </div>
      )}

      {data && (
        <div style={{ 
          padding: '15px', 
          backgroundColor: '#e6ffe6', 
          border: '1px solid #00ff00',
          borderRadius: '4px'
        }}>
          <h2>✅ Résultats</h2>
          <p><strong>Résumé:</strong> {data.summary}</p>
          <p><strong>Nombre de lieux:</strong> {data.itinerary.stops.length}</p>
          <p><strong>Distance totale:</strong> {data.itinerary.totalDistanceKm} km</p>
          
          <h3>Lieux:</h3>
          <ol>
            {data.itinerary.stops.map((stop) => (
              <li key={stop.id} style={{ marginBottom: '5px' }}>
                <strong>{stop.name}</strong>
                {stop.notes && <span> - {stop.notes}</span>}
              </li>
            ))}
          </ol>
        </div>
      )}

      <div style={{ 
        marginTop: '30px', 
        fontSize: '12px', 
        color: '#666',
        backgroundColor: '#f8f9fa',
        padding: '10px',
        borderRadius: '4px'
      }}>
        <h4>📋 Instructions:</h4>
        <ol>
          <li>Ouvrez la console du navigateur (F12)</li>
          <li>Assurez-vous que votre backend agent tourne sur le port 4000</li>
          <li>Cliquez sur "Tester l'API"</li>
          <li>Regardez les logs dans la console</li>
        </ol>
      </div>
    </div>
  );
}