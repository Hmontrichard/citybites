import { NextResponse } from "next/server";

type GeneratePayload = {
  city?: unknown;
  theme?: unknown;
  day?: unknown;
};

function getAgentUrl() {
  const rawAgentUrl =
    process.env.AGENT_SERVICE_URL ?? (process.env.NODE_ENV === "development" ? "http://localhost:4000" : undefined);

  if (!rawAgentUrl) {
    throw new Error(
      "AGENT_SERVICE_URL is not configured. Set it to the public URL of the agent service before deploying.",
    );
  }

  return rawAgentUrl.replace(/\/+$/, "");
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as GeneratePayload;
  const city = typeof body.city === "string" ? body.city.trim() : "";
  const theme = typeof body.theme === "string" ? body.theme.trim() : "";
  const day = typeof body.day === "string" ? body.day : "";

  if (!city || !theme || !day) {
    return NextResponse.json(
      { error: "Merci de renseigner la ville, le thème et le jour." },
      { status: 400 },
    );
  }

  try {
    const AGENT_URL = getAgentUrl();
    const response = await fetch(`${AGENT_URL}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ city, theme, day }),
      cache: "no-store",
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Agent → ${response.status} ${message}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur agent";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
