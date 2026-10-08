const hits = new Map<string, number[]>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_HITS = 10;

/** Returns true when the request is allowed. */
export function allowRegister(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((stamp) => now - stamp < WINDOW_MS);
  if (recent.length >= MAX_HITS) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 4000) {
    for (const [id, stamps] of hits) {
      if (stamps.every((stamp) => now - stamp >= WINDOW_MS)) hits.delete(id);
    }
  }
  return true;
}

const lookupHits = new Map<string, number[]>();
const LOOKUP_WINDOW_MS = 5 * 60 * 1000;
const MAX_LOOKUP_HITS = 30;

export function allowLookup(key: string): boolean {
  const now = Date.now();
  const recent = (lookupHits.get(key) ?? []).filter((stamp) => now - stamp < LOOKUP_WINDOW_MS);
  if (recent.length >= MAX_LOOKUP_HITS) {
    lookupHits.set(key, recent);
    return false;
  }
  recent.push(now);
  lookupHits.set(key, recent);
  if (lookupHits.size > 4000) {
    for (const [id, stamps] of lookupHits) {
      if (stamps.every((stamp) => now - stamp >= LOOKUP_WINDOW_MS)) lookupHits.delete(id);
    }
  }
  return true;
}

const promptHits = new Map<string, number[]>();
const PROMPT_WINDOW_MS = 5 * 60 * 1000;
const MAX_PROMPT_HITS = 15;

export function allowPaymentPrompt(key: string): boolean {
  const now = Date.now();
  const recent = (promptHits.get(key) ?? []).filter((stamp) => now - stamp < PROMPT_WINDOW_MS);
  if (recent.length >= MAX_PROMPT_HITS) {
    promptHits.set(key, recent);
    return false;
  }
  recent.push(now);
  promptHits.set(key, recent);
  if (promptHits.size > 4000) {
    for (const [id, stamps] of promptHits) {
      if (stamps.every((stamp) => now - stamp >= PROMPT_WINDOW_MS)) promptHits.delete(id);
    }
  }
  return true;
}

export function clientKey(request: Request): string {
  const realIp = request.headers.get("x-real-ip")?.trim();
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const ip = realIp || forwarded.split(",")[0]?.trim() || "local";
  return ip.slice(0, 80);
}
