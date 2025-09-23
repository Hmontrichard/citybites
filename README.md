# CityBites

CityBites génère un mini-guide gourmand à partir d’une ville, d’un thème et d’une date. La stack se compose :

- d’un **serveur MCP** (`apps/mcp-citybites`) qui expose les tools `places.search`, `routes.optimize`, `maps.export`, `pdf.build` ;
- d’un **agent orchestrateur** (`apps/agent`) qui dialogue avec ce serveur via STDIO et assemble les résultats ;
- d’un **frontend Next.js** (`apps/frontend`) qui expose le formulaire utilisateur et consomme l’API de l’agent.

## Démarrer en local

1. **Installer les dépendances**
   ```bash
   npm --prefix apps/mcp-citybites install
   npm --prefix apps/agent install
   npm --prefix apps/frontend install
   ```

2. **Compiler le serveur MCP (facultatif mais recommandé)**
   ```bash
   npm --prefix apps/mcp-citybites run build
   ```

3. **Lancer l’agent** (démarre automatiquement le serveur MCP via STDIO)
   ```bash
   npm --prefix apps/agent run dev
   ```
   L’agent écoute sur `http://localhost:4000`. Il démarre `apps/mcp-citybites/dist/mcp-server.js` s’il existe, sinon `tsx src/mcp-server.ts`.

4. **Lancer le frontend**
   - Crée `apps/frontend/.env.local` avec `AGENT_SERVICE_URL=http://localhost:4000`.
   - Démarre Next.js :
     ```bash
     npm --prefix apps/frontend run dev
     ```
   - Le formulaire est accessible sur `http://localhost:3000`.

> Besoin uniquement de l’API REST mock ? Tu peux toujours lancer `npm --prefix apps/mcp-citybites run dev` et pointer le front sur `MCP_SERVICE_URL`, mais la voie officielle passe désormais par l’agent.

## Structure

- `apps/frontend/` : UI + route `app/api/generate/route.ts` (proxy vers l’agent).
- `apps/agent/` : serveur Express (`src/server.ts`) + orchestrateur MCP (`src/generator.ts`).
- `apps/mcp-citybites/` :
  - `src/tools.ts` mutualise Overpass, exports et PDF.
  - `src/server.ts` garde les endpoints HTTP historiques.
  - `src/mcp-server.ts` expose les tools via le protocole MCP.
- `scripts/run-tests.sh` : lance `npm test | lint | build` dans chaque app.

## Variables d’environnement

| Variable | Scope | Description |
| --- | --- | --- |
| `AGENT_SERVICE_URL` | Frontend | URL publique de l’agent (par défaut `http://localhost:4000`). |
| `MCP_PREFIX` | Agent | Chemin vers `apps/mcp-citybites` (déduit automatiquement si non fourni). |
| `MCP_COMMAND`, `MCP_ARGS`, `MCP_ENTRY`, `MCP_CWD` | Agent | Permettent de surcharger la façon dont l’agent lance le serveur MCP (ex : exécutable Docker, binaire pré-compilé). |
| `OVERPASS_ENDPOINTS`, `OVERPASS_USER_AGENT` | MCP | Configuration des requêtes Overpass. |
| `DISABLE_PDF` | MCP | Si `true`, `pdf.build` renvoie uniquement le HTML (utile pour des environnements sans Chromium). |

## Tests & qualité

- `npm --prefix apps/mcp-citybites run build` valide la compilation TypeScript (MCP + tools).
- `npm --prefix apps/agent run build` vérifie l’agent.
- `npm --prefix apps/frontend run lint` / `run build` couvre le front.
- `./scripts/run-tests.sh` orchestre l’ensemble des apps.

## Déploiement (aperçu)

1. **MCP (Fly.io recommandé)** : l’image Docker installe Chromium (Playwright) et expose `dist/mcp-server.js`.
2. **Agent** : peut tourner sur Fly ou Vercel. Fournir les variables `MCP_PREFIX`/`MCP_ENTRY` si le code MCP se trouve ailleurs, ou pointer vers un MCP HTTP si tu souhaites éviter STDIO en production.
3. **Frontend** : Vercel (nécessite `AGENT_SERVICE_URL` renseigné). Les téléchargements GeoJSON/KML/PDF reposent sur les payloads retournés par l’agent.

## Ressources complémentaires

- README rapide dans `AGENTS.md` pour les guidelines internes.
- Prompts / roadmap détaillée dans le brief CityBites.
- `apps/mcp-citybites/src/tools.ts` contient les points d’entrée à enrichir (`places.enrich`, cache Overpass, exports CSV, etc.).
