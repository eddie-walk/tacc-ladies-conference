import { noStoreJson } from "@/lib/auth";
import { ticketById } from "@/lib/constants";
import { createMoolrePaymentLink, isMoolreConfigured, type MoolreCollectionChannel } from "@/lib/moolre";
import { allowRegister, clientKey } from "@/lib/rate-limit";
import { RegistrationError, createRegistration, getRegistration, sendRegistrationEmail, updateRegistration } from "@/lib/registrations";
import { validateRegister } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!allowRegister(clientKey(request))) {
    return noStoreJson({ error: "Too many attempts. Please wait a few minutes and try again." }, 429);
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return noStoreJson({ error: "Registration details were not readable." }, 400);
  }

  const parsed = validateRegister(body);
  if (!parsed.ok) return noStoreJson({ error: parsed.error }, 400);

  const paymentMeta = (body.payment && typeof body.payment === "object" ? body.payment : {}) as {
    payerPhone?: string;
    channel?: MoolreCollectionChannel;
    payNow?: boolean;
    otpCode?: string;
  };

  try {
    const saved = await createRegistration(parsed.value);
    const ticket = ticketById(parsed.value.ticketId);
    const amountGhs = ticket ? ticket.priceGhs : 100;

    let moolrePrompt = false;
    let otpRequired = false;
    let promptMessage = "";
    let paymentError = "";

    let txRef = "";
    let paymentUrl = "";
    // If payNow is true and Moolre is configured, create a hosted checkout link
    if (paymentMeta.payNow && isMoolreConfigured()) {
      txRef = `${saved.reference}-${Date.now().toString().slice(-6)}`;
      const link = await createMoolrePaymentLink({ amountGhs, externalRef: txRef, email: parsed.value.email });

      if (link.ok && link.url) {
        await updateRegistration(saved.id, { paystackReference: txRef }).catch(() => undefined);
        paymentUrl = link.url;
        moolrePrompt = true;
        promptMessage = "Your seat reservation is held. Complete payment below via Mobile Money to secure your pass.";
      } else {
        paymentError = link.error || "Payment link could not be created.";
      }
    }

    if (parsed.value.email) {
      try {
        const fresh = await getRegistration(saved.id);
        if (fresh) await sendRegistrationEmail(fresh, "reserved");
      } catch {
        // email must never block registration
      }
    }

    return noStoreJson(
      {
        reference: saved.reference,
        id: saved.id,
        txRef,
        paymentStatus: "pending",
        moolrePrompt,
        paymentUrl,
        otpRequired,
        promptMessage,
        paymentError,
        payerPhone: paymentMeta.payerPhone || parsed.value.phone,
        amountGhs,
      },
      201
    );
  } catch (error) {
    if (error instanceof RegistrationError) {
      return noStoreJson({ error: error.message }, error.status);
    }
    console.error("register failed", error);
    const detail = error instanceof Error ? error.message : "Unknown error";
    return noStoreJson({ error: `We couldn’t save your registration (${detail}). Please try again.` }, 500);
  }
}
