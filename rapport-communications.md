# Rapport Communications Frontend ↔ Agent ↔ MCP

## 📋 Vue d'ensemble

**Architecture** : 3-tiers avec protocoles distincts
- **Frontend (Next.js)** ↔ **Agent (Express)** via HTTP
- **Agent** ↔ **MCP Server** via STDIO
- **MCP** ↔ **Services externes** via HTTP

## 🔌 Flux de données détaillé

### 1. Frontend → Agent (HTTP)

#### Endpoint principal
```
POST /generate
Host: localhost:4000 (dev) | AGENT_SERVICE_URL (prod)
Content-Type: application/json
```

#### Contrat d'entrée
```typescript
interface GenerateRequest {
  city: string;    // Requis, nom de ville
  theme: string;   // Requis, thème recherche ("restaurant", "cafe", etc.)
  day: string;     // Requis, format YYYY-MM-DD
}
```

#### Contrat de sortie (succès)
```typescript
interface GenerateResult {
  summary: string;
  itinerary: {
    totalDistanceKm: number;
    stops: Array<{
      id: string;
      name: string; 
      notes?: string;
      lat: number;
      lon: number;
    }>;
  };
  warnings?: string[];
  assets: Array<{
    filename: string;
    content: string;
    mimeType?: string;
    encoding?: "base64" | "utf-8";
  }>;
  enrichments?: Array<{
    id: string;
    summary: string;
    highlights: string[];
    bestTime?: string;
    localTip?: string;
  }>;
}
```

#### Gestion d'erreur
```typescript
// Format d'erreur uniforme
interface ApiError {
  error: string; // Message utilisateur
}

// Codes HTTP
200: Succès
400: Validation échouée (city/theme/day manquant)
502: Erreur agent ou MCP
504: Timeout (30s)
```

### 2. Agent → MCP (STDIO)

#### Protocole MCP
- **Transport** : STDIO (stdin/stdout)
- **Format** : JSON-RPC via SDK MCP
- **Lifecycle** : Process enfant persistent

#### Tools invoqués
```typescript
// 1. Recherche de lieux
client.callTool({
  name: "places.search",
  arguments: { city: "Paris", query: "restaurants" }
})

// 2. Optimisation route  
client.callTool({
  name: "routes.optimize", 
  arguments: { points: [{ id: "1", lat: 48.8, lon: 2.3 }] }
})

// 3. Enrichissement IA (optionnel)
client.callTool({
  name: "places.enrich",
  arguments: { 
    id: "place_123",
    name: "Bistro du Marché",
    city: "Paris",
    theme: "restaurant" 
  }
})

// 4. Export cartes
client.callTool({
  name: "maps.export",
  arguments: { places: [...], format: "geojson" }
})

// 5. Génération PDF
client.callTool({
  name: "pdf.build", 
  arguments: { title: "Guide Paris", days: [...] }
})
```

### 3. MCP → Services externes

#### Overpass API (OpenStreetMap)
```http
POST https://overpass-api.de/api/interpreter
Content-Type: application/x-www-form-urlencoded
User-Agent: CityBitesMCP/0.1 (+https://citybites.ai/contact)

data=[out:json][timeout:25];
(
  node["amenity"="restaurant"](48.8,2.2,48.9,2.4);
  way["amenity"="restaurant"](48.8,2.2,48.9,2.4);
  relation["amenity"="restaurant"](48.8,2.2,48.9,2.4);
);
out center 100;
```

#### Nominatim (Géocodage)  
```http
GET https://nominatim.openstreetmap.org/search
  ?q=Paris
  &format=json
  &limit=1
User-Agent: CityBitesMCP/0.1
```

#### OpenAI (Enrichissement)
```http
POST https://api.openai.com/v1/chat/completions
Content-Type: application/json
Authorization: Bearer sk-...

{
  "model": "gpt-4o-mini",
  "temperature": 0.4,
  "messages": [
    {"role": "system", "content": "Expert food & lifestyle, JSON uniquement"},
    {"role": "user", "content": "Produit JSON: {summary, highlights, bestTime, localTip} pour Bistro du Marché à Paris"}
  ]
}
```

## ✅ Points forts identifiés

### Séparation des responsabilités
- **Frontend** : UI, validation basique, proxy vers agent
- **Agent** : Orchestration, agrégation, timeouts (ajoutés)
- **MCP** : Logique métier, cache, services externes

### Schemas et validation
- **Zod partout** : validation runtime solide
- **Types TypeScript** : contrats stricts entre couches
- **Fallbacks gracieux** : données fictives si APIs down

### Gestion d'erreur améliorée
- **Timeouts ajoutés** : 30s frontend, 20s agent, 15s MCP tools
- **Messages génériques** : pas d'exposition des erreurs internes
- **Retry avec backoff** : enrichissements IA seulement

## ⚠️ Bugs et risques identifiés

### CRITIQUE - Sécurité réseau
❌ **MCP sans timeouts** (CORRIGÉ dans notre commit)
❌ **Pas de limite taille réponse** sur APIs externes
❌ **CORS non configuré** en production côté agent

### ÉLEVÉ - Robustesse
❌ **Pas de circuit breaker** si OpenAI/Overpass saturent
❌ **Gestion MCP process crash** non testée
❌ **Cache unbounded** : peut croître indéfiniment

### MOYEN - Observabilité  
❌ **Pas de request-id** propagé entre couches
❌ **Logs non structurés** (console.log basiques)
❌ **Pas de métriques** (latence, erreurs, cache hit/miss)

## 🔧 Plan de corrections priorisées

### ✅ FAIT - Sécurité de base
- [x] Timeouts frontend (30s avec AbortController)
- [x] Helmet + rate limiting agent (60/15min)
- [x] Timeouts MCP tools (5-30s selon type)
- [x] Messages d'erreur génériques frontend

### 🔄 EN COURS - Robustesse
- [ ] Limites taille réponse (5MB Overpass, 300 tokens OpenAI)
- [ ] LRU cache avec éviction (500 entrées max)
- [ ] Circuit breaker pour APIs externes
- [ ] Validation bounding box Overpass

### 📋 À FAIRE - Observabilité
- [ ] Request-ID propagation (frontend → agent → MCP)
- [ ] Logs structurés Pino avec correlation
- [ ] Métriques Prometheus (latence, erreurs, cache)
- [ ] Tracing OpenTelemetry bout-en-bout

## 🚀 Recommandations architecture

### Contrats API unifiés
```typescript
// Schémas partagés dans packages/contracts/
import { z } from 'zod';

export const GenerateRequestSchema = z.object({
  city: z.string().min(1).max(100),
  theme: z.string().min(1).max(50), 
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const ApiErrorSchema = z.object({
  error: z.string(),
  code: z.enum(['VALIDATION', 'TIMEOUT', 'SERVICE_DOWN']),
  requestId: z.string().uuid(),
});
```

### Middleware standardisé
```typescript
// Agent middleware pour request correlation
app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('x-request-id', req.requestId);
  next();
});
```

### Health checks
```typescript
// Endpoints de santé par couche
GET /health -> Agent basic
GET /health/deep -> Agent + MCP tools connectivity
GET /health/external -> + Overpass/OpenAI reachability
```

## 📊 Métriques de communication cibles

| Métrique | Cible | Actuel | Gap |
|----------|-------|---------|-----|
| **Frontend → Agent** | 95% < 2s | Non mesuré | Instrumenter |
| **Agent → MCP tools** | 90% < 5s | Non mesuré | Instrumenter |
| **Cache hit rate** | > 80% | Non mesuré | Dashboard |
| **Error rate** | < 1% | Non mesuré | Alerting |
| **Availability** | 99.5% | Non mesuré | SLI/SLO |

## 🔐 Matrice de sécurité

| Couche | Authentification | Autorisation | Chiffrement | Rate Limiting |
|--------|-----------------|--------------|-------------|---------------|
| **Frontend** | N/A | N/A | HTTPS | N/A |
| **Agent** | N/A | CORS | HTTP(S) | ✅ 60/15min |
| **MCP** | N/A | Process isolation | N/A | Cache TTL |
| **Externes** | API Keys | N/A | HTTPS | Respecter limites |

## 🎯 Prochaines étapes

### Semaine 1-2
1. **Request correlation** : UUID propagé sur toute la chaîne
2. **Métriques de base** : Latence et erreurs par endpoint
3. **Circuit breaker** : Désactiver temporairement APIs down

### Semaines 3-4  
4. **OpenAPI spec** : Documentation auto-générée des contrats
5. **Tests de contrat** : Vérifier compatibilité entre couches
6. **Dashboard monitoring** : Visualisation temps réel

### Mois 2
7. **Tracing distribué** : OpenTelemetry end-to-end
8. **Alerting proactif** : Slack/PagerDuty sur métriques
9. **Chaos engineering** : Tests de résilience (MCP down, etc.)

---

## 📈 Score de maturité communications

| Aspect | Score actuel | Score cible | Actions |
|--------|--------------|-------------|---------|
| **Contrats** | 7/10 | 9/10 | OpenAPI, tests |
| **Sécurité** | 6/10 | 8/10 | CORS prod, validation |
| **Robustesse** | 6/10 | 9/10 | Circuit breaker, retry |
| **Observabilité** | 3/10 | 8/10 | Tracing, métriques |
| **Performance** | 7/10 | 8/10 | Cache LRU, optimisations |

**Score global : 5.8/10 → Cible : 8.4/10**

L'architecture de communication est **solide dans les bases** mais nécessite **des améliorations significatives en observabilité et robustesse** pour être prête pour la production.

Les corrections appliquées ont éliminé les **risques critiques de timeout** et ajouté une **sécurité de base**. Le prochain palier est l'**observabilité complète** pour diagnostiquer et optimiser les performances en continu.

---
*Rapport communications - CityBites Architecture Review*