import {
  AGE_GROUPS,
  GROWTH_LAB,
  HEARD_OPTIONS,
  INDUSTRIES,
  ticketById,
} from "./constants";
import type { RegisterInput, TicketId } from "./types";

const AGE = new Set<string>(AGE_GROUPS);
const INDUSTRY = new Set<string>(INDUSTRIES);
const HEARD = new Set<string>(HEARD_OPTIONS);
const LABS = new Set<string>(GROWTH_LAB);

export function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function validateRegister(body: unknown): { ok: true; value: RegisterInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Registration details were not readable." };
  }
  const raw = body as Record<string, unknown>;
  const ticket = ticketById(typeof raw.ticketId === "string" ? raw.ticketId : "");
  if (!ticket) return { ok: false, error: "Choose a ticket." };

  const name = cleanText(raw.name, 80);
  const email = cleanText(raw.email, 120).toLowerCase();
  const phone = cleanText(raw.phone, 30);
  const ageGroup = cleanText(raw.ageGroup, 20);
  const industry = cleanText(raw.industry, 80);
  const residence = cleanText(raw.residence, 80);
  const memberRaw = cleanText(raw.taccMember, 3);
  const pfcc = cleanText(raw.pfcc, 80);
  const heard = cleanText(raw.heard, 40);

  if (name.length < 2) return { ok: false, error: "Add your full name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Add an email address so we can send your confirmation." };
  }
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 15) return { ok: false, error: "Add a phone number." };
  if (!AGE.has(ageGroup)) return { ok: false, error: "Choose your age group." };
  const isKnownIndustry = INDUSTRY.has(industry) || industry.startsWith("Other:") || industry.startsWith("Other - ") || industry.startsWith("Other (");
  if (!isKnownIndustry || industry.length < 2) return { ok: false, error: "Choose your industry." };
  if (memberRaw !== "Yes" && memberRaw !== "No") {
    return { ok: false, error: "Let us know if you’re a member of TACC." };
  }
  if (memberRaw === "Yes" && pfcc.length < 2) return { ok: false, error: "Add your PFCC." };
  if (!HEARD.has(heard)) return { ok: false, error: "Tell us how you heard about the conference." };

  const labsRaw = Array.isArray(raw.growthLab) ? raw.growthLab : [];
  if (labsRaw.length > GROWTH_LAB.length) return { ok: false, error: "Growth Lab has too many choices." };
  const growthLab: string[] = [];
  for (const item of labsRaw) {
    const lab = cleanText(item, 40);
    if (!LABS.has(lab)) return { ok: false, error: "One of the Growth Lab choices is not valid." };
    if (!growthLab.includes(lab)) growthLab.push(lab);
  }

  const expectedNames = ticket.seats - 1;
  const namesRaw = Array.isArray(raw.otherNames) ? raw.otherNames : [];
  if (namesRaw.length !== expectedNames) {
    return { ok: false, error: "Add the name of each lady on this ticket." };
  }
  const otherNames: string[] = [];
  for (const item of namesRaw) {
    const guest = cleanText(item, 80);
    if (guest.length < 2) return { ok: false, error: "Add the name of each lady on this ticket." };
    otherNames.push(guest);
  }

  return {
    ok: true,
    value: {
      ticketId: ticket.id as TicketId,
      name,
      email,
      phone,
      ageGroup,
      industry,
      residence,
      taccMember: memberRaw,
      pfcc: memberRaw === "Yes" ? pfcc : "",
      heard,
      growthLab,
      otherNames,
    },
  };
}
