# citybites

## Démarrer les services du MVP

1. **Mock MCP service** (`apps/mcp-citybites`)
   - `npm install`
   - `npm run dev`
   - Expose les endpoints HTTP `/places/search`, `/routes/optimize`, `/maps/export`, `/pdf/build`.

2. **Frontend Next.js** (`apps/frontend`)
   - Crée un fichier `.env.local` avec `MCP_SERVICE_URL=http://localhost:3001` si tu utilises le port par défaut.
   - `npm install`
   - `npm run dev`
   - Formulaire accessible sur `http://localhost:3000`.

## Structure actuelle

- `apps/frontend/src/app/page.tsx` — formulaire MVP + affichage des résultats et téléchargements.
- `apps/frontend/src/app/api/generate/route.ts` — appelle la stack mock pour assembler itinéraire + exports.
- `apps/mcp-citybites/src/server.ts` — implémentation Express mock des futures tools MCP (GeoJSON/KML/guide).

## Étapes suivantes

- Remplacer les mocks par l’implémentation MCP réelle (Overpass, optimisation, génération PDF).
- Ajouter des tests et un lint pass une fois la config ESLint Next initialisée.
- Préparer le déploiement (Render/Fly pour le service, Vercel pour le front).
