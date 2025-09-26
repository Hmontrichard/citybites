import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import process from "node:process";
import { generateGuide } from "./generator.js";
import { GenerateRequestSchema } from "./schemas.js";
import { logger } from "./logger.js";
import { getMcpConnection } from "./mcpClient.js";

const app = express();

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

// Rate limiting: 60 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60, // limit each IP to 60 requests per windowMs
  message: { error: "Too many requests. Please try again later." },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
app.use(limiter);

// Body parsing with size limit
app.use(express.json({ limit: '200kb' }));

// CORS - production configuration
app.use((req, res, next) => {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['https://citybites.vercel.app'];
  
  const origin = req.headers.origin;
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

  try {
    const requestId = (res as any).locals?.requestId;
    const startTime = Date.now();
    
    // Set a total processing budget of 55s to stay under Fly.io 60s limit
    const totalTimeout = setTimeout(() => {
      logger.warn({ msg: 'generate:total_timeout', requestId, elapsed: Date.now() - startTime });
      if (!res.headersSent) {
        res.status(504).json({ 
          error: "Generation timed out. Please try a simpler request.",
          partial: true
        });
      }
    }, 55000);

    const result = await generateGuide(parseResult.data, { requestId });
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
  res.status(502).json({ error: message, requestId });
});

app.listen(port, () => {
  logger.info({ msg: 'agent:listen', url: `http://localhost:${port}` });
});
