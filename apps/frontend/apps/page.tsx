"use client";

import React, { useState } from "react";

type GeneratePayload = {
  city: string;
  theme: string;
  days: number;
};

export default function HomePage() {
  const [city, setCity] = useState("");
  const [theme, setTheme] = useState("");
  const [days, setDays] = useState<number>(2);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);

    // Validation ultra-simple
    if (!city.trim()) {
      setMessage("Merci d’indiquer une ville.");
      return;
    }
    if (days < 1 || days > 10) {
      setMessage("Le nombre de jours doit être entre 1 et 10.");
      return;
    }

    setLoading(true);
    try {
      const payload: GeneratePayload = { city: city.trim(), theme: theme.trim(), days };

      // 👉 Cette route sera faite à l'étape 5.3
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        // Pendant qu’on n’a pas encore fait /api/generate, on informe l’utilisateur.
        setMessage("La génération sera active après l’étape 5.3 (route /api/generate).");
      } else {
        const data = await res.json();
        // À terme : proposer les téléchargements (KML/GeoJSON/PDF)
        setMessage(`OK ! Résultat prêt (ex: ${Object.keys(data).join(", ")}).`);
      }
    } catch (err: any) {
      setMessage(`Erreur: ${err?.message ?? "inconnue"}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={styles.main}>
      <div style={styles.card}>
        <h1 style={{ marginBottom: 12 }}>CityBites.AI — Générateur</h1>
        <p style={{ opacity: 0.8, marginBottom: 20 }}>
          Saisis une ville, un thème (facultatif) et le nombre de jours. Clique sur Générer.
        </p>

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
          <label style={styles.label}>
            Ville <span style={{ color: "crimson" }}>*</span>
            <input
              style={styles.input}
              type="text"
              placeholder="Ex: Paris, Seoul, Tokyo"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
            />
          </label>

          <label style={styles.label}>
            Thème (facultatif)
            <input
              style={styles.input}
              type="text"
              placeholder="Ex: coffee, ramen, cocktail, street-food"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
            />
          </label>

          <label style={styles.label}>
            Nombre de jours
            <input
              style={styles.input}
              type="number"
              min={1}
              max={10}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            />
          </label>

          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? "Génération en cours…" : "Générer"}
          </button>
        </form>

        {message && (
          <div style={styles.notice}>
            {message}
          </div>
        )}

        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 16 }}>
          Astuce: essaie « Paris / coffee / 2 jours » pour un premier test.
        </div>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    minHeight: "100dvh",
    display: "grid",
    placeItems: "center",
    background: "linear-gradient(180deg, #f7f7fb 0%, #ffffff 100%)",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 520,
    background: "#fff",
    borderRadius: 16,
    boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
    padding: 20,
  },
  label: { display: "grid", gap: 6, fontWeight: 500 },
  input: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #E5E7EB",
    outline: "none",
  },
  button: {
    marginTop: 8,
    padding: "12px 16px",
    borderRadius: 12,
    border: "none",
    background: "black",
    color: "white",
    cursor: "pointer",
  },
  notice: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    background: "#F3F4F6",
    fontSize: 14,
  },
};
