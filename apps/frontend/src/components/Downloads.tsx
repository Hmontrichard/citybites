"use client";

import React from 'react';
import type { GenerateResponse } from '../types/place';

function decodeBase64ToBlob(b64: string, mimeType: string): Blob {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

function triggerDownload(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function Downloads({ data }: { data: GenerateResponse }) {
  const assets = data.assets || [];
  const signed = data.signedUrls || {};

  const handleDownload = async (asset: GenerateResponse['assets'][number]) => {
    const filename = asset.filename;
    const url = signed[filename];
    if (url) {
      // Prefer signed URL if available
      window.open(url, '_blank');
      return;
    }

    const mime = asset.mimeType || 'application/octet-stream';
    let blob: Blob;
    if (asset.encoding === 'base64') blob = decodeBase64ToBlob(asset.content, mime);
    else blob = new Blob([asset.content], { type: `${mime};charset=utf-8` });
    triggerDownload(filename, blob);
  };

  if (!assets.length) return null;

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {assets.map((asset) => (
        <button
          key={asset.filename}
          onClick={() => handleDownload(asset)}
          style={{
            backgroundColor: '#6c5ce7', color: 'white', border: 'none', borderRadius: 6, padding: '8px 12px', fontSize: 12, cursor: 'pointer'
          }}
          title={`Télécharger ${asset.filename}`}
        >
          ⬇️ {asset.filename}
        </button>
      ))}
    </div>
  );
}
