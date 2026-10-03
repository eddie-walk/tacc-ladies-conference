import { adminGuard, noStoreJson } from "@/lib/auth";
import { RegistrationError, updateRegistration } from "@/lib/registrations";
import { PAYMENT_STATUSES, type PaymentStatus, type RegistrationPatch } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = adminGuard(request);
  if (denied) return denied;
  const { id } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return noStoreJson({ error: "Update was not readable." }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return noStoreJson({ error: "Update was not readable." }, 400);
  }
  const raw = body as Record<string, unknown>;
  const patch: RegistrationPatch = {};
  if ("paymentStatus" in raw) {
    if (typeof raw.paymentStatus !== "string" || !PAYMENT_STATUSES.includes(raw.paymentStatus as PaymentStatus)) {
      return noStoreJson({ error: "Payment status is not valid." }, 400);
    }
    patch.paymentStatus = raw.paymentStatus as PaymentStatus;
  }
  if ("paystackReference" in raw) {
    if (raw.paystackReference != null && typeof raw.paystackReference !== "string") {
      return noStoreJson({ error: "Paystack reference is not valid." }, 400);
    }
    patch.paystackReference = raw.paystackReference ?? null;
  }
  if ("notes" in raw) {
    if (raw.notes != null && typeof raw.notes !== "string") {
      return noStoreJson({ error: "Notes are not valid." }, 400);
    }
    patch.notes = raw.notes ?? null;
  }
  if (!("paymentStatus" in patch) && !("paystackReference" in patch) && !("notes" in patch)) {
    return noStoreJson({ error: "Nothing to update." }, 400);
  }
  try {
    const registration = await updateRegistration(id, patch);
    return noStoreJson({ registration });
  } catch (error) {
    if (error instanceof RegistrationError) return noStoreJson({ error: error.message }, error.status);
    console.error("update failed");
    return noStoreJson({ error: "Could not update the registration." }, 500);
  }
}
