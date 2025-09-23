import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import fs from "node:fs";
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
  return process.execPath;
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

function resolveDefaultCommand(prefix: string) {
  const builtEntry = path.resolve(prefix, "dist", "mcp-server.js");
  const tsEntry = path.resolve(prefix, "src", "mcp-server.ts");

  if (fs.existsSync(builtEntry)) {
    return {
      command: process.execPath,
      args: [builtEntry],
    };
  }

  const binName = process.platform === "win32" ? "tsx.cmd" : "tsx";
  const tsxPath = path.resolve(prefix, "node_modules", ".bin", binName);
  return {
    command: tsxPath,
    args: [tsEntry],
  };
}

async function createConnection(): Promise<MCPConnection> {
  const prefix = process.env.MCP_PREFIX ?? resolveDefaultPrefix();
  const defaults = resolveDefaultCommand(prefix);

  const command = process.env.MCP_COMMAND ?? defaults.command;
  const defaultArgs = process.env.MCP_ENTRY ? [process.env.MCP_ENTRY] : defaults.args;
  const args = parseArgs(process.env.MCP_ARGS, defaultArgs);
  const cwd = process.env.MCP_CWD ?? prefix;

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
