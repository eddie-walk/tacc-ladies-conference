import { noStoreJson } from "@/lib/auth";
import { checkMoolrePaymentStatus, isMoolreConfigured } from "@/lib/moolre";
import { getRegistration, listIndex, updateRegistration } from "@/lib/registrations";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ref = searchParams.get("ref")?.trim() || "";
  const id = searchParams.get("id")?.trim() || "";

  if (!ref && !id) {
    return noStoreJson({ error: "Missing ref or id parameter." }, 400);
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
      return noStoreJson({ error: "Registration not found." }, 404);
    }

    if (ref && record.reference.toLowerCase() !== ref.toLowerCase()) {
      return noStoreJson({ error: "Registration reference does not match." }, 400);
    }

    if (record.paymentStatus === "paid") {
      return noStoreJson({ paid: true, status: "paid" });
    }

    if (!isMoolreConfigured()) {
      return noStoreJson({ paid: false, status: record.paymentStatus });
    }

    const checkRef = record.paystackReference || record.reference;
    const check = await checkMoolrePaymentStatus(checkRef);
    if (check.ok && check.paid) {
      await updateRegistration(targetId, {
        paymentStatus: "paid",
        paystackReference: check.transactionId || checkRef,
      });
      return noStoreJson({ paid: true, status: "paid", transactionId: check.transactionId });
    }

    return noStoreJson({ paid: false, status: "pending" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error checking payment status";
    return noStoreJson({ error: message }, 500);
  }
}
