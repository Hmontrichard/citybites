"use client";

import React from 'react';

export default function HomePage() {
  return (
    <main style={{ 
      minHeight: "100vh", 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      color: "white"
    }}>
      <div style={{ 
        textAlign: "center",
        padding: "40px",
        backgroundColor: "rgba(255,255,255,0.1)",
        borderRadius: "16px",
        backdropFilter: "blur(10px)",
        maxWidth: "500px"
      }}>
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>🗺️</div>
        <h1 style={{ fontSize: "32px", marginBottom: "16px", margin: 0 }}>CityBites.AI</h1>
        <p style={{ fontSize: "18px", marginBottom: "32px", opacity: 0.9 }}>
          Découvrez les meilleurs lieux de votre ville avec une carte interactive
        </p>
        
        <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
          <a 
            href="/leaflet-test"
            style={{
              backgroundColor: "#28a745",
              color: "white",
              padding: "12px 24px",
              borderRadius: "8px",
              textDecoration: "none",
              fontWeight: "bold",
              fontSize: "16px",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            🚀 Lancer l'application
          </a>
          
          <a 
            href="/test-simple"
            style={{
              backgroundColor: "rgba(255,255,255,0.2)",
              color: "white",
              padding: "12px 24px",
              borderRadius: "8px",
              textDecoration: "none",
              fontSize: "16px",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            🧪 Version simple
          </a>
        </div>
        
        <div style={{ 
          marginTop: "32px", 
          padding: "16px", 
          backgroundColor: "rgba(255,255,255,0.1)",
          borderRadius: "8px",
          fontSize: "14px"
        }}>
          <h3 style={{ margin: "0 0 8px 0" }}>✨ Fonctionnalités</h3>
          <ul style={{ textAlign: "left", margin: 0, paddingLeft: "20px" }}>
            <li>🗺️ Carte interactive avec OpenStreetMap</li>
            <li>📍 Géolocalisation automatique</li>
            <li>🎯 Marqueurs colorés par catégorie</li>
            <li>🔗 Intégration Google Maps</li>
            <li>🌍 Géocodage automatique des adresses</li>
            <li>📱 Compatible mobile et desktop</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
