import { noStoreJson } from "@/lib/auth";
import { allowRegister, clientKey } from "@/lib/rate-limit";
import { RegistrationError, createRegistration } from "@/lib/registrations";
import { validateRegister } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!allowRegister(clientKey(request))) {
    return noStoreJson({ error: "Too many attempts. Please wait a few minutes and try again." }, 429);
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return noStoreJson({ error: "Registration details were not readable." }, 400);
  }
  const parsed = validateRegister(body);
  if (!parsed.ok) return noStoreJson({ error: parsed.error }, 400);
  try {
    const saved = await createRegistration(parsed.value);
    return noStoreJson({ reference: saved.reference, id: saved.id, paymentStatus: "pending" }, 201);
  } catch (error) {
    if (error instanceof RegistrationError) return noStoreJson({ error: error.message }, error.status);
    console.error("register failed");
    return noStoreJson({ error: "We couldn’t save your registration. Please try again." }, 500);
  }
}
