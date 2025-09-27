export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithRetry(
  input: any,
  init: any = {},
  attempts = 3,
  baseDelayMs = 300,
) {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), init.timeoutMs ?? 10000);
    try {
      const res = await fetch(input, { ...init, signal: ac.signal });
      clearTimeout(timeout);
      if (res.ok) return res;
      // Retry on 5xx
      if (res.status >= 500) {
        lastError = new Error(`HTTP ${res.status}`);
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (e) {
      lastError = e;
    }
    const backoff = baseDelayMs * Math.pow(2, i) + Math.floor(Math.random() * 100);
    await sleep(backoff);
  }
  throw lastError ?? new Error("fetchWithRetry: failed");
}
