import type { RegistrationRecord } from "./types";

function cell(value: string | number | null | undefined): string {
  const raw = value == null ? "" : String(value);
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  if (/[",\n\r]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
  return safe;
}

const COLUMNS: { key: keyof RegistrationRecord; header: string }[] = [
  { key: "id", header: "id" },
  { key: "reference", header: "reference" },
  { key: "createdAt", header: "createdAt" },
  { key: "updatedAt", header: "updatedAt" },
  { key: "ticketId", header: "ticketId" },
  { key: "ticketName", header: "ticketName" },
  { key: "priceGhs", header: "priceGhs" },
  { key: "seats", header: "seats" },
  { key: "name", header: "name" },
  { key: "email", header: "email" },
  { key: "phone", header: "phone" },
  { key: "ageGroup", header: "ageGroup" },
  { key: "industry", header: "industry" },
  { key: "residence", header: "residence" },
  { key: "taccMember", header: "taccMember" },
  { key: "pfcc", header: "pfcc" },
  { key: "heard", header: "heard" },
  { key: "growthLab", header: "growthLab" },
  { key: "otherNames", header: "otherNames" },
  { key: "paymentStatus", header: "paymentStatus" },
  { key: "paidAt", header: "paidAt" },
  { key: "paystackReference", header: "paystackReference" },
  { key: "amountPaidGhs", header: "amountPaidGhs" },
  { key: "notes", header: "notes" },
];

export function registrationsToCsv(rows: RegistrationRecord[]): string {
  const header = COLUMNS.map((column) => column.header).join(",");
  const lines = rows.map((row) =>
    COLUMNS.map((column) => {
      const value = row[column.key];
      if (Array.isArray(value)) return cell(value.join(" | "));
      return cell(value);
    }).join(","),
  );
  return `\uFEFF${header}\n${lines.join("\n")}\n`;
}
