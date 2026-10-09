import { EVENT } from "./constants";
import type { RegistrationRecord } from "./types";

export type EmailKind = "reserved" | "confirmed";

const SITE = "taccladies.theairportcitychurch.com";

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildEmail(kind: EmailKind, r: RegistrationRecord): { subject: string; html: string; text: string } {
  const confirmed = kind === "confirmed";
  const subject = confirmed
    ? `Payment confirmed: ${r.reference}`
    : `Your seat is reserved: ${r.reference}`;
  const first = (r.name.trim().split(/\s+/)[0] || "there");
  const status = confirmed ? "Confirmed" : "Pending payment";
  const amount = `GHS ${r.priceGhs}`;
  const seats = `${r.seats} ${r.seats === 1 ? "seat" : "seats"}`;
  const eventLine = `The Next Her, ${EVENT.when}, ${EVENT.time}, Accra`;
  const intro = confirmed
    ? "Your payment has been received and your seat is fully secured. We look forward to welcoming you."
    : "Your seat is held. To secure it, complete your payment by Mobile Money.";
  const how = confirmed
    ? `Keep this email. You can always retrieve your pass at ${SITE} with your code.`
    : `To complete payment, go to ${SITE} and enter your code ${r.reference}.`;

  const rows: [string, string][] = [
    ["Reference", r.reference],
    ["Ticket", r.ticketName],
    ["Seats", seats],
    ["Amount", amount],
    ["Status", status],
  ];

  const text = [
    `Hello ${first},`,
    "",
    intro,
    "",
    ...rows.map(([k, v]) => `${k}: ${v}`),
    "",
    how,
    "",
    `Event: ${eventLine}`,
    "",
    "Questions? Reply to this email.",
    "TACC Ladies Conference",
  ].join("\n");

  const rowHtml = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 0;color:#96426C;font-size:13px;border-bottom:1px solid #E4D0A4;">${esc(k)}</td><td style="padding:8px 0;text-align:right;color:#3D031B;font-size:14px;font-weight:bold;border-bottom:1px solid #E4D0A4;">${esc(v)}</td></tr>`,
    )
    .join("");

  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#F7F3EC;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F3EC;padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #E4D0A4;font-family:Georgia,'Times New Roman',serif;">
<tr><td style="background:#BA0753;padding:28px 24px;text-align:center;">
<div style="color:#E4D0A4;font-size:12px;letter-spacing:3px;text-transform:uppercase;">TACC Ladies Conference</div>
<div style="color:#ffffff;font-size:28px;margin-top:8px;">${confirmed ? "Payment confirmed" : "Your seat is reserved"}</div>
</td></tr>
<tr><td style="padding:28px 24px;color:#3D031B;font-size:15px;line-height:1.6;">
<p style="margin:0 0 12px;">Hello ${esc(first)},</p>
<p style="margin:0 0 20px;">${esc(intro)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">${rowHtml}</table>
<p style="margin:0 0 20px;">${esc(how)}</p>
<p style="margin:0;padding:14px;background:#FCEAF2;border-left:3px solid #C4A46A;">${esc(eventLine)}</p>
</td></tr>
<tr><td style="padding:16px 24px;text-align:center;color:#96426C;font-size:12px;border-top:1px solid #E4D0A4;">Questions? Just reply to this email.</td></tr>
</table></td></tr></table></body></html>`;

  return { subject, html, text };
}
