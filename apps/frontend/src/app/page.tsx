"use client";

import React from 'react';
import dynamic from 'next/dynamic';

// Load main app component dynamically to avoid SSR issues
const CityBitesApp = dynamic(
  () => import('./components/CityBitesApp'),
  { 
    ssr: false,
    loading: () => (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>Chargement de CityBites...</p>
      </div>
    )
  }
);

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 via-purple-600 to-purple-800">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            🗺️ CityBites.AI
          </h1>
          <p className="text-xl text-blue-100">
            Découvrez les meilleurs lieux de votre ville
          </p>
        </div>
        
        <div className="bg-white rounded-xl shadow-2xl overflow-hidden">
          <CityBitesApp />
        </div>
      </div>
    </div>
  );
}
