"use client";

import React, { FormEvent, useState } from "react";

type GenerateResponse = {
  summary: string;
  itinerary: {
    totalDistanceKm: number;
    stops: Array<{ id: string; name: string; notes?: string }>;
  };
  assets: Array<{ filename: string; content: string; mimeType?: string }>;
};

const initialForm = { city: "", theme: "", day: "" };

function DownloadButton({ asset }: { asset: GenerateResponse["assets"][number] }) {
  const handleClick = () => {
    const blob = new Blob([asset.content], {
      type: asset.mimeType ?? "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = asset.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <button type="button" onClick={handleClick} style={{ marginRight: 8 }}>
      Télécharger {asset.filename}
    </button>
  );
}

export default function HomePage() {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponse | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Une erreur est survenue");
      }

      const data = (await response.json()) as GenerateResponse;
      setResult(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Échec de la génération";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}>
      <div style={{ maxWidth: 560, width: "100%", padding: 24 }}>
        <h1>CityBites.AI — Générateur</h1>
        <p>Renseigne la ville, le thème, et la date souhaitée pour produire une carte et un mini-guide.</p>
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12, marginTop: 16 }}>
          <label style={{ display: "grid", gap: 4 }}>
            <span>Ville</span>
            <input
              required
              value={form.city}
              onChange={(event) => setForm({ ...form, city: event.target.value })}
              placeholder="Ex : Paris"
            />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span>Thème</span>
            <input
              required
              value={form.theme}
              onChange={(event) => setForm({ ...form, theme: event.target.value })}
              placeholder="Ex : Cafés & brunchs"
            />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span>Jour</span>
            <input
              type="date"
              required
              value={form.day}
              onChange={(event) => setForm({ ...form, day: event.target.value })}
            />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? "Génération en cours…" : "Générer"}
          </button>
        </form>
        {error && (
          <div style={{ marginTop: 16, color: "#b83232" }}>
            <strong>Erreur :</strong> {error}
          </div>
        )}
        {result && (
          <section style={{ marginTop: 24, display: "grid", gap: 16 }}>
            <div>
              <h2>Résumé</h2>
              <p>{result.summary}</p>
            </div>
            <div>
              <h2>Itinéraire</h2>
              <p>Distance totale : {result.itinerary.totalDistanceKm.toFixed(1)} km</p>
              <ol>
                {result.itinerary.stops.map((stop) => (
                  <li key={stop.id}>
                    <strong>{stop.name}</strong>
                    {stop.notes ? <> — {stop.notes}</> : null}
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <h2>Téléchargements</h2>
              {result.assets.map((asset) => (
                <DownloadButton key={asset.filename} asset={asset} />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
