"use client";

import React, { useState } from 'react';
import type { EnrichedPlace, GenerateResponse } from '../types/place';

interface StopsListProps {
  places: EnrichedPlace[];
  onReorder: (newPlaces: EnrichedPlace[]) => void;
}

export default function StopsList({ places, onReorder }: StopsListProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => () => setDragIndex(index);
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };
  const handleDrop = (index: number) => (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    const copy = [...places];
    const [moved] = copy.splice(dragIndex, 1);
    copy.splice(index, 0, moved);
    setDragIndex(null);
    onReorder(copy);
  };

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {places.map((p, i) => (
        <div
          key={p.id}
          draggable
          onDragStart={handleDragStart(i)}
          onDragOver={handleDragOver}
          onDrop={handleDrop(i)}
          style={{
            background: '#fff', border: '1px solid #ddd', borderRadius: 8, padding: '8px 10px',
            display: 'flex', alignItems: 'center', gap: 8, cursor: 'grab'
          }}
          title="Glisser pour réordonner"
        >
          <span style={{ width: 20, textAlign: 'center', fontWeight: 700 }}>{i + 1}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</div>
            {p.summary && <div style={{ fontSize: 12, color: '#666' }}>{p.summary}</div>}
          </div>
          <span style={{ fontSize: 18, color: '#aaa' }}>⋮⋮</span>
        </div>
      ))}
    </div>
  );
}
