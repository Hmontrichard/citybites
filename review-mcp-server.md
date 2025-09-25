# Code Review - MCP Server (apps/mcp-citybites)

## 📋 Résumé exécutif

**Statut global** : 🟡 Modéré (améliorations nécessaires)
**Priorité critique** : Timeouts et gestion d'erreur réseau
**Points forts** : Schemas Zod solides, cache intelligent, fallback élégants
**Risques majeurs** : Pas de timeouts sur API externes, pas de limite de taille de requête

## 🔍 Analyse détaillée par composant

### 1. Appels réseau externes - CRITIQUE ⚠️

#### Overpass API (géolocalisation OSM)
```typescript
// ❌ PROBLÈME: Pas de timeout explicite
const response = await fetch(endpoint, {
  method: "POST", 
  headers: { "User-Agent": OVERPASS_USER_AGENT },
  body: new URLSearchParams({ data: query }).toString(),
});
```

**Bugs identifiés :**
- **Timeout manquant** : peut bloquer l'agent indéfiniment
- **Pas de contrôle de taille de réponse** : risque de mémoire avec requêtes larges
- **Retry naïf** : tous les endpoints tentés même si le premier timeout

**Corrections proposées :**
```typescript
const response = await fetch(endpoint, {
  method: "POST",
  headers: { "User-Agent": OVERPASS_USER_AGENT },
  body: new URLSearchParams({ data: query }).toString(),
  signal: AbortSignal.timeout(15000), // 15s timeout
});

// Vérifier la taille de la réponse
const contentLength = response.headers.get('content-length');
if (contentLength && parseInt(contentLength) > 5 * 1024 * 1024) { // 5MB limit
  throw new Error('Response too large');
}
```

#### Nominatim (géocodage)
```typescript
// ❌ MÊME PROBLÈME: Pas de timeout
const response = await fetch(url.toString(), {
  headers: { "User-Agent": OVERPASS_USER_AGENT },
});
```

**Corrections :**
- Timeout 10s (géocodage généralement rapide)
- Validation des coordonnées reçues
- Rate limiting implicite avec cache (bon point)

#### OpenAI (enrichissement)
```typescript
// ❌ PROBLÈME: Pas de timeout, pas de contrôle de tokens
const response = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${OPENAI_API_KEY}`,
  },
  body: JSON.stringify({
    model: OPENAI_MODEL,
    temperature: 0.4,
    messages: [...],
  }),
});
```

**Bugs majeurs :**
- **Pas de timeout** : OpenAI peut être lent (>30s)
- **Pas de limite de tokens** : budget OpenAI non contrôlé
- **Pas de retry avec backoff** : épuise les quotas rapidement

**Corrections proposées :**
```typescript
body: JSON.stringify({
  model: OPENAI_MODEL,
  temperature: 0.4,
  max_tokens: 300, // Limiter la réponse
  messages: [...],
}),
signal: AbortSignal.timeout(20000), // 20s timeout
```

### 2. Sécurité des données - MOYEN 🟡

#### Validation d'entrée
✅ **Bon point** : Schemas Zod exhaustifs
```typescript
export const PlacesSearchSchema = z.object({
  city: z.string(),
  query: z.string().optional(),
});
```

#### Sanitization HTML
✅ **Bon point** : Function escapeHtml complète
```typescript
function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
```

#### Requêtes Overpass
❌ **Problème mineur** : Validation bounding box manquante
```typescript
function buildOverpassQuery(geocode: GeocodeResult, filters: ThemeFilter[]): string {
  const { south, north, west, east } = geocode.boundingBox;
  // ❌ Pas de validation que south < north, west < east
  // ❌ Pas de limite sur la taille de la bbox (peut surcharger Overpass)
```

**Corrections :**
```typescript
// Valider et limiter la bbox
const maxBboxSize = 0.1; // ~11km
if ((north - south) > maxBboxSize || (east - west) > maxBboxSize) {
  throw new Error(`Bounding box too large: ${north-south}x${east-west} degrees`);
}
```

### 3. Cache et performance - BON ✅

#### Design du cache
✅ **Excellent** : TTL configurables, clés sensées
```typescript
type CacheEntry<T> = { value: T; expiresAt: number };
const overpassCache = new Map<string, CacheEntry<OverpassElement[]>>();
const CACHE_TTL_MS = Number(process.env.OVERPASS_CACHE_TTL_MS ?? 1000 * 60 * 60 * 24);
```

#### Problèmes potentiels :
❌ **Pas de limite de taille** : cache peut croître indéfiniment
❌ **Pas de LRU** : anciens résultats jamais supprimés

**Corrections proposées :**
```typescript
// LRU Cache avec limite de taille
import { LRUCache } from 'lru-cache';

const overpassCache = new LRUCache<string, OverpassElement[]>({
  max: 500, // Max 500 requêtes en cache
  ttl: CACHE_TTL_MS,
});
```

### 4. Gestion d'erreur et observabilité - MOYEN 🟡

#### Logs actuels
✅ **Bon** : Logs informatifs avec métriques
```typescript
console.log(
  `Overpass ${endpoint} → ${elements.length} résultats (${Date.now() - start}ms) cacheKey=${cacheKey}`
);
```

❌ **Manque** : Pas de logs d'erreur structurés
```typescript
console.warn(`[overpass] fallback triggered: ${message}`);
// ❌ Devrait inclure: requestId, ville, bbox size, tentative #
```

#### Fallback strategy
✅ **Excellent** : Fallback élégant avec données fictives
```typescript
return {
  source: "fallback",
  warning: "Overpass indisponible, données fictives retournées.",
  results: fallbackPlaces(city, geocode),
};
```

### 5. PDF Generation - RISQUE MOYEN 🟡

#### Playwright usage
Le code dépend de `renderHtmlToPdf` (externe) mais a une bonne stratégie de fallback :
```typescript
if (!pdfBuffer) {
  return {
    format: "html",
    warning: "Mode PDF désactivé, HTML retourné.",
  };
}
```

**Risques identifiés :**
❌ **Memory leak potentiel** : si Playwright browser contexts non fermés
❌ **Concurrence non limitée** : multiples PDF simultanés peuvent épuiser la RAM
❌ **HTML injection** : bien que escaped, risque avec contenu malveillant

## 🔧 Plan d'action priorisé

### CRITIQUE (Semaine 1)
1. **Ajouter timeouts sur tous les fetch externes**
   - Overpass: 15s
   - Nominatim: 10s  
   - OpenAI: 20s

2. **Limiter tailles de réponse**
   - Overpass: 5MB max
   - OpenAI: 300 tokens max

3. **Implémenter LRU cache avec limites**

### ÉLEVÉ (Semaines 2-3)
4. **Ajouter retry avec backoff exponentiel**
   - Overpass: 3 tentatives avec 2s, 4s, 8s
   - OpenAI: 2 tentatives avec 1s, 3s

5. **Validation des bounding boxes**
   - Taille max: 0.1° (~11km)
   - Validation géométrique

6. **Logs structurés avec requestId**

### MOYEN (Mois 1)
7. **Métriques détaillées**
   - Latence par endpoint
   - Taux de cache hit/miss
   - Compteurs d'erreur par type

8. **Tests d'intégration**
   - Mock des APIs externes
   - Tests de timeout
   - Tests de cache eviction

## 🧪 Suggestions d'amélioration

### Performance
```typescript
// Pool de requêtes Overpass pour éviter la congestion
const overpassPool = new Map<string, Promise<OverpassElement[]>>();
```

### Sécurité
```typescript
// Content-Type validation
const contentType = response.headers.get('content-type');
if (!contentType?.includes('application/json')) {
  throw new Error('Invalid content type');
}
```

### Observabilité
```typescript
// Métriques pour monitoring
const metrics = {
  overpass_requests_total: 0,
  overpass_cache_hits: 0,
  openai_tokens_used: 0,
  pdf_generation_errors: 0,
};
```

## 📊 Score de qualité par catégorie

| Catégorie | Score | Commentaire |
|-----------|-------|-------------|
| **Architecture** | 8/10 | Clean séparation, schemas solides |
| **Sécurité** | 6/10 | HTML escaped, mais timeouts manquants |
| **Performance** | 7/10 | Cache intelligent, mais pas de LRU |
| **Robustesse** | 5/10 | Fallbacks bons, mais pas de retry |
| **Observabilité** | 6/10 | Logs basiques, métriques manquantes |
| **Maintenabilité** | 8/10 | Code lisible, TypeScript strict |

**Score global : 6.7/10** 🟡

## 🎯 Objectifs post-amélioration

- **Score cible : 8.5/10**  
- **Zéro timeout en production**
- **Cache hit rate > 80%**  
- **P95 latency < 5s pour places.search**
- **Logs structurés avec correlation IDs**

---
*Rapport généré le $(date) - Code review CityBites MCP Server*