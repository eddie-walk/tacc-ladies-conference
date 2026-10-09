import { adminGuard, noStoreJson } from "@/lib/auth";
import { getRegistration, sendRegistrationEmail } from "@/lib/registrations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = adminGuard(request);
  if (denied) return denied;
  const { id } = await context.params;
  let body: { type?: unknown } = {};
  try {
    body = (await request.json()) as { type?: unknown };
  } catch {
    return noStoreJson({ error: "Request was not readable." }, 400);
  }
  if (body.type !== "reserved" && body.type !== "confirmed") {
    return noStoreJson({ error: "type must be 'reserved' or 'confirmed'." }, 400);
  }
  const record = await getRegistration(id).catch(() => null);
  if (!record) return noStoreJson({ error: "Registration was not found." }, 404);
  if (!record.email?.trim()) return noStoreJson({ error: "This registration has no email address." }, 400);
  if (body.type === "confirmed" && record.paymentStatus !== "paid") {
    return noStoreJson({ error: "Registration is not paid yet." }, 400);
  }
  const result = await sendRegistrationEmail(record, body.type, true);
  if (result.skipped) return noStoreJson({ ok: false, skipped: true, message: "Email sending is not configured yet." }, 200);
  if (!result.ok) return noStoreJson({ ok: false, error: result.error ?? "Email failed." }, 502);
  return noStoreJson({ ok: true });
}
