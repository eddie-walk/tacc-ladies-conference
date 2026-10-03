import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

function secretsMatch(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export function noStoreJson(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/** Returns a response when the caller is not allowed to continue. */
export function adminGuard(request: Request): NextResponse | null {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    return noStoreJson({ error: "Admin is not configured." }, 503);
  }
  const provided = request.headers.get("x-admin-secret") ?? "";
  if (!provided || !secretsMatch(provided, secret)) {
    return noStoreJson({ error: "Unauthorized." }, 401);
  }
  return null;
}
