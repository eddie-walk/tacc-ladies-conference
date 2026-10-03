import { adminGuard } from "@/lib/auth";
import { registrationsToCsv } from "@/lib/csv";
import { RegistrationError, allRegistrations } from "@/lib/registrations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = adminGuard(request);
  if (denied) return denied;
  try {
    const rows = await allRegistrations();
    const csv = registrationsToCsv(rows);
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="tacc-ladies-registrations.csv"',
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const message = error instanceof RegistrationError ? error.message : "Could not export registrations.";
    const status = error instanceof RegistrationError ? error.status : 500;
    if (!(error instanceof RegistrationError)) console.error("export failed");
    return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
