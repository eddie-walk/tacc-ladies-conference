import { adminGuard, noStoreJson } from "@/lib/auth";
import { RegistrationError, listIndex } from "@/lib/registrations";
import { buildStats } from "@/lib/stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = adminGuard(request);
  if (denied) return denied;
  try {
    const rows = await listIndex();
    return noStoreJson(buildStats(rows));
  } catch (error) {
    if (error instanceof RegistrationError) return noStoreJson({ error: error.message }, error.status);
    console.error("stats failed");
    return noStoreJson({ error: "Could not load stats." }, 500);
  }
}
