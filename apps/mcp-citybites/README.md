# CityBites MCP Server

Serveur MCP (Model Context Protocol) pour CityBites, qui fournit les données de restaurants et l'enrichissement des informations.

## 🚀 Configuration rapide

### 1. Installation des dépendances

```bash
npm install
```

### 2. Configuration de l'API OpenAI

1. **Copiez le fichier d'exemple de configuration :**
   ```bash
   copy .env.example .env
   ```

2. **Obtenez une clé API OpenAI :**
   - Allez sur [OpenAI Platform](https://platform.openai.com/api-keys)
   - Connectez-vous ou créez un compte
   - Créez une nouvelle clé API
   - Copiez la clé (commence par `sk-`)

3. **Éditez le fichier `.env` :**
   ```env
   OPENAI_API_KEY=sk-votre-clé-api-openai-ici
   ```

### 3. Démarrage du serveur

```bash
npm run dev
```

## 🔧 Fonctionnement

Ce serveur MCP fournit plusieurs outils :

- **places.search** : Recherche de restaurants via OpenStreetMap
- **places.enrich** : Enrichissement des données avec OpenAI (nécessite la clé API)
- **routes.optimize** : Optimisation d'itinéraires
- **maps.export** : Export des cartes (GeoJSON/KML)
- **pdf.build** : Génération de guides PDF

## 📊 Sources de données

- **OpenStreetMap** via Overpass API pour les données de restaurants
- **Nominatim** pour le géocodage des villes
- **OpenAI** pour l'enrichissement des descriptions

## ⚙️ Configuration avancée

Toutes les configurations sont optionnelles sauf `OPENAI_API_KEY` :

```env
# Modèle OpenAI (défaut: gpt-4o-mini)
OPENAI_MODEL=gpt-4o-mini

# Endpoints Overpass personnalisés (séparés par des virgules)
OVERPASS_ENDPOINTS=https://overpass-api.de/api/interpreter

# Durée de cache (en millisecondes)
OVERPASS_CACHE_TTL_MS=86400000  # 24 heures
PLACE_ENRICH_CACHE_TTL_MS=21600000  # 6 heures
```

## 🐛 Dépannage

### "OPENAI_API_KEY manquante"

- Vérifiez que le fichier `.env` existe et contient votre clé API
- Redémarrez le serveur après modification du fichier `.env`

### "Ville introuvable"

- Le système utilise des données de fallback si la ville n'est pas trouvée
- Vérifiez l'orthographe de la ville

### "Overpass indisponible"

- Le système utilise des données de fallback si OpenStreetMap n'est pas accessible
- Cela peut arriver temporairement, réessayez plus tard

## 📝 Logs

Le serveur affiche des logs utiles :

```
[geocode] Paris impossible: Ville introuvable
[overpass] aucun résultat pour city="Paris" query="restaurant" – fallback utilisé
[enrich] échec node/123: OPENAI_API_KEY manquante
```