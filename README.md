# CityBites

🚀 **Statut**: Repository public - Déploiement Vercel + Fly.io opérationnel (Test: 17h17)

CityBites génère un mini-guide gourmand à partir d'une ville, d'un thème et d'une date. La stack se compose :

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
| `OPENAI_API_KEY` | MCP | Clé API utilisée par `places.enrich` pour générer le résumé LLM (fallback mock si absent). |
| `OPENAI_MODEL` | MCP | Modèle OpenAI employé (défaut `gpt-4o-mini`). |
| `PLACE_ENRICH_CACHE_TTL_MS` | MCP | Temps de cache des enrichissements (défaut 6 h). |

## Tests & qualité

- `npm --prefix apps/mcp-citybites run build` valide la compilation TypeScript (MCP + tools).
- `npm --prefix apps/agent run build` vérifie l’agent.
- `npm --prefix apps/frontend run lint` / `run build` couvre le front.
- `./scripts/run-tests.sh` orchestre l’ensemble des apps.

## Intégration continue

- Les workflows vivent dans `.github/workflows/ci.yml` et `.github/workflows/deploy.yml`.
- Le workflow **CI** s’exécute sur chaque pull request et sur les pushes vers `main` pour lancer `./scripts/run-tests.sh`.
- Le workflow **Deploy** se déclenche après fusion sur `main` pour redéployer Fly.io (`apps/agent`, `apps/mcp-citybites`) puis Vercel (`apps/frontend`).
- Pour simuler la CI en local, exécute `./scripts/run-tests.sh` avant de pousser tes changements.

## Déploiement (aperçu)

1. **MCP (Fly.io recommandé)** : l’image Docker installe Chromium (Playwright) et expose `dist/mcp-server.js`.
2. **Agent** : peut tourner sur Fly ou Vercel. Fournir les variables `MCP_PREFIX`/`MCP_ENTRY` si le code MCP se trouve ailleurs, ou pointer vers un MCP HTTP si tu souhaites éviter STDIO en production.
3. **Frontend** : Vercel (nécessite `AGENT_SERVICE_URL` renseigné). Les téléchargements GeoJSON/KML/PDF reposent sur les payloads retournés par l’agent.

### Fly (agent)

Un `Dockerfile` dédié vit dans `apps/agent/Dockerfile`. Il embarque le serveur MCP et l’agent dans la même image.

1. Depuis la racine du repo :
   ```bash
   fly launch --no-deploy --name citybites-agent --copy-config --dockerfile apps/agent/Dockerfile
   ```
   Ajuste le nom Fly (`citybites-agent`) selon ta disponibilité.
2. Vérifie/édite `fly.toml` généré (expose le port 4000, `processes = ["app"]`).
3. Déploie :
   ```bash
   fly deploy --dockerfile apps/agent/Dockerfile
   ```
4. Ajoute les secrets si besoin (ex : `fly secrets set MCP_PREFIX=/app/apps/mcp-citybites`). Les valeurs par défaut fonctionnent si le build embarque le dossier MCP.

### Script d’automatisation

- `./scripts/push-prod.sh` : enchaîne les tests (`./scripts/run-tests.sh`), pousse sur `origin main`, puis lance `fly deploy --config apps/agent/fly.toml --dockerfile apps/agent/Dockerfile`. Les arguments passés au script sont relayés à `fly deploy` (ex. `--remote-only`).
- Le script vérifie que le worktree est propre ; pense à redéployer Vercel si besoin après mise à jour.

### Vercel (frontend)

- Ajoute `AGENT_SERVICE_URL=https://<ton-app>.fly.dev` dans les variables projet.
- Redéploie pour propager la configuration.

## Ressources complémentaires

- README rapide dans `AGENTS.md` pour les guidelines internes.
- Prompts / roadmap détaillée dans le brief CityBites.
- `apps/mcp-citybites/src/tools.ts` contient les points d’entrée à enrichir (`places.enrich`, cache Overpass, exports CSV, etc.).
