import './otel.js';
import './sentry.js';
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import process from "node:process";
import { v4 as uuidv4 } from "uuid";
import { generateGuide } from "./generator.js";
import { GenerateRequestSchema, RouteOptimizeResultSchema } from "./schemas.js";
import { logger } from "./logger.js";
import { getMcpConnection } from "./mcpClient.js";
import { getKV, withLock } from "./lib/redis.js";
import { uploadObject, getSignedGetUrl } from "./lib/s3.js";
import { OptimizeInputZ, buildGenerationKey } from "@citybites/shared";
import * as Sentry from "@sentry/node";
import type { z } from "zod";

const app = express();

// Inject x-request-id
app.use((req, res, next) => {
  const rid = req.headers["x-request-id"]?.toString() || uuidv4();
  (res as any).locals = (res as any).locals ?? {};
  (res as any).locals.requestId = rid;
  res.setHeader("x-request-id", rid);
  next();
});

// Global MCP readiness state
let mcpReady = false;
let mcpError: string | null = null;

// Initialize MCP connection on startup
async function initializeMcp() {
  try {
    logger.info({ msg: 'mcp:init:start' });
    await getMcpConnection();
    mcpReady = true;
    mcpError = null;
    logger.info({ msg: 'mcp:init:success' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    mcpError = message;
    mcpReady = false;
    logger.error({ msg: 'mcp:init:failed', error: message });
  }
}

// Start MCP initialization
initializeMcp();

// Security middleware
app.use(helmet());
app.disable('x-powered-by');

// Rate limiting: 60 requests per hour per IP
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 60,
  message: { error: "Too many requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Body parsing with size limit (256 KB)
app.use(express.json({ limit: '256kb' }));

// CORS - production configuration
app.use((req, res, next) => {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(s => s.trim()).filter(Boolean) || ['https://citybites.vercel.app'];
  const origin = req.headers.origin as string | undefined;
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST');
  res.header('Access-Control-Allow-Headers', 'Content-Type, x-request-id');
  next();
});

app.get("/health", (_req, res) => {
  res.json({ 
    status: "ok", 
    mcpReady,
    ...(mcpError && { mcpError }) 
  });
});

app.post("/optimize", async (req, res, next) => {
  if (!mcpReady) {
    return res.status(503).json({ error: mcpError ?? "Service temporarily unavailable" });
  }
  const parsed = OptimizeInputZ.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
  }
  try {
    const { client } = await getMcpConnection();
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 10000);
    const raw = await client.callTool({ name: "routes.optimize", arguments: parsed.data, signal: ac.signal as any });
    clearTimeout(t);
    const result = RouteOptimizeResultSchema.parse(raw.structuredContent as unknown);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

app.post("/generate", async (req, res, next) => {
  // Check MCP readiness before processing
  if (!mcpReady) {
    const errorMessage = mcpError 
      ? `Service temporarily unavailable: ${mcpError}`
      : "Service temporarily unavailable. Please try again shortly.";
    return res.status(503).json({ error: errorMessage });
  }

  const parseResult = GenerateRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: "Invalid request", details: parseResult.error.flatten() });
  }

  const requestId = (res as any).locals?.requestId;
  const kv = getKV();
  const cacheKey = buildGenerationKey(parseResult.data as any);

  try {
    // Idempotency read
    const cached = await kv.get<any>(cacheKey);
    if (cached) {
      // Refresh signed URLs if S3 configured
      if (Array.isArray(cached.assetKeys)) {
        const urls: Record<string, string> = {};
        for (const k of cached.assetKeys) {
          try {
            urls[k] = await getSignedGetUrl(k);
          } catch {}
        }
        cached.signedUrls = urls;
      }
      return res.json({ ...cached, cache: { hit: true } });
    }

    const startTime = Date.now();
    // Set a total processing budget of 55s
    const totalTimeout = setTimeout(() => {
      logger.warn({ msg: 'generate:total_timeout', requestId, elapsed: Date.now() - startTime });
      if (!res.headersSent) {
        res.status(504).json({ 
          error: "Generation timed out. Please try a simpler request.",
          partial: true
        });
      }
    }, 55000);

    // Acquire short lock (60s)
    let result: any;
    await withLock(`lock:${cacheKey}`, 60, async () => {
      result = await generateGuide(parseResult.data, { requestId });

      // Upload assets to S3 if configured
      const bucket = process.env.S3_BUCKET;
      const uploadedKeys: string[] = [];
      const signedUrls: Record<string, string> = {};
      if (bucket && Array.isArray(result.assets)) {
        for (const asset of result.assets) {
          const key = `city/${parseResult.data.city}/${parseResult.data.theme}/${parseResult.data.day}/${asset.filename}`
            .replace(/\\/g, "/");
          try {
            await uploadObject({ key, body: asset.content, contentType: asset.mimeType, encoding: asset.encoding });
            uploadedKeys.push(key);
            signedUrls[asset.filename] = await getSignedGetUrl(key);
          } catch (e) {
            logger.warn({ msg: 's3:upload_failed', requestId, file: asset.filename, error: (e as any)?.message });
          }
        }
      }

      // Store compact cache entry
      const cacheTtl = Number(process.env.PDF_TTL_HOURS ?? 24) * 3600;
      const payload = {
        summary: result.summary,
        itinerary: result.itinerary,
        warnings: result.warnings,
        // Keep original assets inline for backward-compat but add urls
        assets: result.assets,
        assetKeys: uploadedKeys,
        signedUrls,
        enrichments: result.enrichments,
      };
      await kv.set(cacheKey, payload, cacheTtl);
      result = { ...payload, cache: { hit: false } };
    });

    clearTimeout(totalTimeout);
    const elapsed = Date.now() - startTime;
    logger.info({ msg: 'generate:success', requestId, elapsed });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

const port = Number(process.env.PORT ?? 4000);
// Global error handler
import type { Request, Response, NextFunction } from "express";

app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const requestId = (res as any).locals?.requestId;
  const message = err instanceof Error ? err.message : "Agent error";
  logger.error({ msg: 'unhandled:error', error: message, requestId });
  try {
    if (process.env.SENTRY_DSN) Sentry.captureException(err instanceof Error ? err : new Error(String(err)));
  } catch {}
  res.status(502).json({ error: message, requestId });
});

app.listen(port, () => {
  logger.info({ msg: 'agent:listen', url: `http://localhost:${port}` });
});
