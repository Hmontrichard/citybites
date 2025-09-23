import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

export type MCPConnection = {
  client: Client;
  transport: StdioClientTransport;
};

let connectionPromise: Promise<MCPConnection> | null = null;

function resolveDefaultPrefix() {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(currentDir, "..", "..", "mcp-citybites");
}

function defaultCommand() {
  if (process.platform === "win32") {
    return process.env.ComSpec ? "npm.cmd" : "npm";
  }
  return "npm";
}

function parseArgs(raw: string | undefined, fallback: string[]): string[] {
  if (!raw || raw.trim().length === 0) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map(String);
    }
  } catch (error) {
    // Ignore JSON parsing errors and fall back to whitespace splitting
  }

  return raw
    .split(" ")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

async function createConnection(): Promise<MCPConnection> {
  const command = process.env.MCP_COMMAND ?? defaultCommand();
  const defaultArgs = ["--prefix", process.env.MCP_PREFIX ?? resolveDefaultPrefix(), "run", "mcp"];
  const args = parseArgs(process.env.MCP_ARGS, defaultArgs);
  const cwd = process.env.MCP_CWD ?? path.resolve(resolveDefaultPrefix());

  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      env[key] = value;
    }
  }

  const transport = new StdioClientTransport({
    command,
    args,
    cwd,
    env,
    stderr: "pipe",
  });

  const client = new Client({ name: "citybites-agent", version: "0.1.0" });

  transport.onclose = () => {
    connectionPromise = null;
  };

  transport.onerror = (error) => {
    console.error("[mcp stderr] transport error", error);
  };

  const stderrStream = transport.stderr;
  if (stderrStream) {
    stderrStream.on("data", (chunk) => {
      const message = chunk.toString();
      if (message.trim().length > 0) {
        console.error(`[mcp stderr] ${message}`);
      }
    });
  }

  await client.connect(transport);
  await client.listTools({});

  client.onclose = () => {
    connectionPromise = null;
  };

  process.once("exit", () => {
    void transport.close();
  });
  process.once("SIGINT", () => {
    void transport.close();
  });

  return { client, transport };
}

export async function getMcpConnection(): Promise<MCPConnection> {
  if (!connectionPromise) {
    connectionPromise = createConnection().catch((error) => {
      connectionPromise = null;
      throw error;
    });
  }
  return connectionPromise;
}
