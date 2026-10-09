export type SendEmailInput = { to: string; subject: string; html: string; text: string };
export type SendEmailResult = { ok: boolean; skipped?: boolean; error?: string };

const DEFAULT_FROM = "TACC Ladies Conference <tickets@theairportcitychurch.com>";
const DEFAULT_REPLY_TO = "taccladiesconference@gmail.com";

let warnedMissingKey = false;

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  try {
    const key = process.env.RESEND_API_KEY?.trim();
    if (!key) {
      if (!warnedMissingKey) {
        warnedMissingKey = true;
        console.warn("RESEND_API_KEY is not set; confirmation emails are skipped.");
      }
      return { ok: false, skipped: true };
    }
    const to = input.to.trim();
    if (!to) return { ok: false, skipped: true };
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM?.trim() || DEFAULT_FROM,
        to: [to],
        reply_to: process.env.EMAIL_REPLY_TO?.trim() || DEFAULT_REPLY_TO,
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error("email send failed", res.status);
      return { ok: false, error: `Resend responded ${res.status}` };
    }
    return { ok: true };
  } catch (error) {
    console.error("email send error", error instanceof Error ? error.name : "unknown");
    return { ok: false, error: "Email could not be sent." };
  }
}
