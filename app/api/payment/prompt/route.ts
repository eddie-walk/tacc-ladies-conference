import { noStoreJson } from "@/lib/auth";
import { createMoolrePaymentLink, isMoolreConfigured } from "@/lib/moolre";
import { allowPaymentPrompt, clientKey } from "@/lib/rate-limit";
import { getRegistration, listIndex, updateRegistration } from "@/lib/registrations";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!allowPaymentPrompt(clientKey(request))) {
    return noStoreJson({ error: "Too many payment attempts. Please wait a few minutes and try again." }, 429);
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return noStoreJson({ error: "Invalid request payload." }, 400);
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  const ref = typeof body.reference === "string" ? body.reference.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  
  if (!id && !ref) {
    return noStoreJson({ error: "Missing registration id or reference." }, 400);
  }

  if (!phone || phone.replace(/\D/g, "").length < 9) {
    return noStoreJson({ error: "Please enter a valid Mobile Money phone number." }, 400);
  }

  try {
    let targetId = id;
    let record = targetId ? await getRegistration(targetId) : null;
    if (!record && ref) {
      const index = await listIndex();
      const match = index.find((row) => row.reference.toLowerCase() === ref.toLowerCase());
      if (match) {
        targetId = match.id;
        record = await getRegistration(match.id);
      }
    }

    if (!record) {
      return noStoreJson({ error: "Reservation was not found. Please check your reference code or start a new reservation." }, 404);
    }

    if (ref && record.reference.toLowerCase() !== ref.toLowerCase()) {
      return noStoreJson({ error: "Registration reference does not match." }, 400);
    }

    if (record.paymentStatus === "paid") {
      return noStoreJson({ ok: true, paid: true, message: "This registration has already been paid." });
    }

    if (!isMoolreConfigured()) {
      return noStoreJson({ error: "Moolre Mobile Money integration is not configured." }, 500);
    }

    const txRef = `${record.reference}-${Date.now().toString().slice(-6)}`;
    const link = await createMoolrePaymentLink({ amountGhs: record.priceGhs, externalRef: txRef, email: record.email });

    if (link.ok && link.url) {
      // Save txRef on the registration so status checks reference it
      await updateRegistration(targetId, { paystackReference: txRef }).catch(() => undefined);
      return noStoreJson({
        ok: true,
        promptSent: true,
        txRef,
        paymentUrl: link.url,
        message: "Your secure Moolre payment page is ready. Complete payment there with Mobile Money.",
      });
    }

    return noStoreJson({ ok: false, promptSent: false, error: link.error || "Payment link could not be created." }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error sending payment prompt";
    return noStoreJson({ error: message }, 500);
  }
}
