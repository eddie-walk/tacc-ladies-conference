import { adminGuard, noStoreJson } from "@/lib/auth";
import { RegistrationError, listRegistrations } from "@/lib/registrations";
import { PAYMENT_STATUSES, type PaymentStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = adminGuard(request);
  if (denied) return denied;
  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status") ?? "";
  const query = (url.searchParams.get("q") ?? "").slice(0, 80);
  let status: PaymentStatus | undefined;
  if (statusParam) {
    if (!PAYMENT_STATUSES.includes(statusParam as PaymentStatus)) {
      return noStoreJson({ error: "Status filter is not valid." }, 400);
    }
    status = statusParam as PaymentStatus;
  }
  try {
    const registrations = await listRegistrations(status, query);
    return noStoreJson({ registrations });
  } catch (error) {
    if (error instanceof RegistrationError) return noStoreJson({ error: error.message }, error.status);
    console.error("list failed");
    return noStoreJson({ error: "Could not load registrations." }, 500);
  }
}
