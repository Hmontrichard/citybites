import { NextResponse } from "next/server";

// Ensure this route runs on Node.js runtime
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type GeneratePayload = {
  city?: unknown;
  theme?: unknown;
  day?: unknown;
};

function getAgentUrl() {
  // Provide a safe production default and treat empty strings as undefined
  const raw = (process.env.AGENT_SERVICE_URL ?? "").trim();
  const url = raw.length > 0 ? raw : "https://citybites.fly.dev";
  console.log('[API] Using agent URL:', url); // Debug log for Vercel
  return url.replace(/\/+$/, "");
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as GeneratePayload;
  const city = typeof body.city === "string" ? body.city.trim() : "";
  const theme = typeof body.theme === "string" ? body.theme.trim() : "";
  const day = typeof body.day === "string" ? body.day : "";

  if (!city || !theme || !day) {
return NextResponse.json(
      { error: "Please provide city, theme and day." },
      { status: 400 },
    );
  }

  // Create AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

  try {
    const AGENT_URL = getAgentUrl();
    console.log('[API] Making request to:', `${AGENT_URL}/generate`);

    // simple retry mechanism on 502/429
    const doRequest = async () => {
      const response = await fetch(`${AGENT_URL}/generate`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "User-Agent": "CityBites-Frontend/1.0"
        },
        body: JSON.stringify({ city, theme, day }),
        cache: "no-store",
        signal: controller.signal,
      });
      console.log('[API] Response status:', response.status);
      return response;
    };

    let response = await doRequest();
    if ((response.status === 502 || response.status === 429) && typeof setTimeout === 'function') {
      await new Promise((r) => setTimeout(r, 500));
      response = await doRequest();
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
      // Don't expose internal error details to frontend
      console.error(`Agent error: ${response.status} ${await response.text()}`);
      const genericMessage = response.status >= 500 
        ? "The service is temporarily unavailable. Please try again later."
        : "An error occurred while generating the guide.";
      throw new Error(genericMessage);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('Request timeout to agent service');
return NextResponse.json(
        { error: "Guide generation timed out. Please try again later." },
        { status: 504 }
      );
    }
    
    const message = error instanceof Error ? error.message : "The service is temporarily unavailable.";
    console.error('Frontend API route error:', error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
