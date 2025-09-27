"use client";

import React from 'react';
import type { GenerateResponse } from '../types/place';

export default function DegradedNotice({ data }: { data: GenerateResponse | null }) {
  if (!data) return null;

  const warnings = data.warnings || [];
  const hasHtmlGuide = (data.assets || []).some(a => a.filename.toLowerCase().endsWith('.html'));

  if (!warnings.length && !hasHtmlGuide) return null;

  return (
    <div style={{
      position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
      background: '#fff7ed', color: '#7c2d12', border: '1px solid #fdba74',
      borderRadius: 8, padding: '8px 12px', boxShadow: '0 4px 10px rgba(0,0,0,0.08)', zIndex: 1100,
      fontSize: 13, maxWidth: '80vw'
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>Mode dégradé</div>
      <ul style={{ margin: 0, paddingLeft: 16 }}>
        {warnings.map((w, i) => (
          <li key={i}>{w}</li>
        ))}
        {hasHtmlGuide && <li>PDF indisponible: guide HTML fourni.</li>}
      </ul>
    </div>
  );
}
