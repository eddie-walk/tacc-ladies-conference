import { adminGuard, noStoreJson } from "@/lib/auth";
import { checkMoolrePaymentStatus, isMoolreConfigured } from "@/lib/moolre";
import { getRegistration, listRegistrations, updateRegistration } from "@/lib/registrations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const denied = adminGuard(request);
  if (denied) return denied;
  if (!isMoolreConfigured()) {
    return noStoreJson({ error: "Moolre is not configured." }, 400);
  }
  try {
    const pending = await listRegistrations("pending");
    let markedPaid = 0;
    const errors: { reference: string; error: string }[] = [];

    for (const row of pending) {
      try {
        const record = await getRegistration(row.id);
        if (!record || record.paymentStatus !== "pending") continue;
        const refs = Array.from(new Set([record.paystackReference, record.reference].filter(Boolean))) as string[];
        for (const ref of refs) {
          const check = await checkMoolrePaymentStatus(ref);
          if (check.ok && check.paid) {
            await updateRegistration(row.id, {
              paymentStatus: "paid",
              paystackReference: check.transactionId || ref,
            });
            markedPaid += 1;
            break;
          }
        }
      } catch (error) {
        errors.push({ reference: row.reference, error: error instanceof Error ? error.message : "Check failed" });
      }
    }

    return noStoreJson({
      checked: pending.length,
      markedPaid,
      stillPending: pending.length - markedPaid,
      errors,
    });
  } catch (error) {
    return noStoreJson({ error: error instanceof Error ? error.message : "Re-check failed." }, 500);
  }
}
