import { execSync } from "node:child_process";

const shouldSkip = process.env.SKIP_PLAYWRIGHT_INSTALL?.toLowerCase() === "true";

if (shouldSkip) {
  console.log("Skipping Playwright browser download (SKIP_PLAYWRIGHT_INSTALL=true)");
  process.exit(0);
}

const commands = ["npx playwright install --with-deps", "npx playwright install chromium"]; // fallback sans deps

let installed = false;

for (const command of commands) {
  if (installed) break;
  try {
    execSync(command, { stdio: "inherit" });
    installed = true;
  } catch (error) {
    console.warn(`Playwright install failed with '${command}':`, error?.message ?? error);
  }
}

if (!installed) {
  console.warn("Playwright browsers not installed (continuing). Set SKIP_PLAYWRIGHT_INSTALL=true to silence.");
}
