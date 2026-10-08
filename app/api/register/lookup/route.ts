import { noStoreJson } from "@/lib/auth";
import { allowLookup, clientKey } from "@/lib/rate-limit";
import { getRegistration, listIndex } from "@/lib/registrations";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!allowLookup(clientKey(request))) {
    return noStoreJson({ error: "Too many lookup attempts. Please wait a moment and try again." }, 429);
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || searchParams.get("ref") || "").trim();

  if (!q) {
    return noStoreJson({ error: "Please enter your reference code." }, 400);
  }

  try {
    const rows = await listIndex();
    const cleanRef = q.toUpperCase().replace(/\s+/g, "");

    // Match exact reference or if user typed the 4+ character suffix (e.g. "25661" -> matches "PS-17OCT-25661")
    const match = rows.find((r) => {
      const refUpper = r.reference.toUpperCase();
      if (refUpper === cleanRef) return true;
      if (cleanRef.length >= 4 && refUpper.endsWith(`-${cleanRef}`)) return true;
      return false;
    });

    if (!match) {
      return noStoreJson({ found: false, error: "No reservation was found with that reference code. Please check the code and try again." }, 404);
    }

    const fullRecord = await getRegistration(match.id);
    if (!fullRecord) {
      return noStoreJson({ found: false, error: "Reservation details could not be loaded." }, 404);
    }

    return noStoreJson({
      found: true,
      registration: {
        id: fullRecord.id,
        reference: fullRecord.reference,
        name: fullRecord.name,
        email: fullRecord.email,
        phone: fullRecord.phone,
        ticketId: fullRecord.ticketId,
        ticketName: fullRecord.ticketName,
        priceGhs: fullRecord.priceGhs,
        seats: fullRecord.seats,
        paymentStatus: fullRecord.paymentStatus,
        otherNames: fullRecord.otherNames || [],
        ageGroup: fullRecord.ageGroup || "",
        industry: fullRecord.industry || "",
        residence: fullRecord.residence || "",
        taccMember: fullRecord.taccMember || "No",
        pfcc: fullRecord.pfcc || "",
        heard: fullRecord.heard || "",
        growthLab: fullRecord.growthLab || [],
        createdAt: fullRecord.createdAt,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error looking up registration";
    return noStoreJson({ error: message }, 500);
  }
}
