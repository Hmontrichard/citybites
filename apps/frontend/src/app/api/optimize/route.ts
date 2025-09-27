import { NextResponse } from "next/server";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getAgentUrl() {
  const raw = (process.env.AGENT_SERVICE_URL ?? "").trim();
  const url = raw.length > 0 ? raw : "https://citybites.fly.dev";
  return url.replace(/\/+$/, "");
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { points?: unknown };
  if (!body || !Array.isArray((body as any).points) || (body as any).points.length < 2) {
    return NextResponse.json({ error: "Please provide { points: [{id,lat,lon}, ...] } (min 2)." }, { status: 400 });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const AGENT_URL = getAgentUrl();
    const response = await fetch(`${AGENT_URL}/optimize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const txt = await response.text();
      console.error('Agent optimize error:', response.status, txt);
      return NextResponse.json({ error: "Optimize failed" }, { status: 502 });
    }
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json({ error: "Optimize timed out" }, { status: 504 });
    }
    return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 502 });
  }
}
