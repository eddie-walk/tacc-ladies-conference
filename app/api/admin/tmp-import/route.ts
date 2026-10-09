import { adminGuard, noStoreJson } from "@/lib/auth";
import { importRegistrationsTemp } from "@/lib/registrations";
import type { RegistrationRecord } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const denied = adminGuard(request);
  if (denied) return denied;
  const body = (await request.json()) as { records: RegistrationRecord[] };
  return noStoreJson(await importRegistrationsTemp(body.records));
}
