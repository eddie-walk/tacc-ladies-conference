import type { TicketId } from "./types";

export const SEAT_TARGET = 400;

export const EVENT = {
  name: "TACC Ladies Conference",
  headline: "The next her.",
  tagline: "Feminine and formidable.",
  when: "Saturday 17 October 2026",
  time: "11:00 am",
} as const;

export type TicketOption = {
  id: TicketId;
  name: string;
  priceGhs: number;
  seats: number;
  note: string;
};

export const TICKETS: TicketOption[] = [
  { id: "one", name: "One seat", priceGhs: 100, seats: 1, note: "" },
  { id: "three", name: "Group of 3", priceGhs: 250, seats: 3, note: "Save GHS 50" },
  { id: "five", name: "Group of 5", priceGhs: 450, seats: 5, note: "Save GHS 50" },
];

export const AGE_GROUPS = ["18–24", "25–34", "35–44", "45–54", "55+"] as const;

export const INDUSTRIES = [
  "Media",
  "Fashion",
  "Technology",
  "Business",
  "Health",
  "Education",
  "Ministry",
  "Law",
  "Oil and energy",
  "Finance",
  "Hospitality",
  "Creative",
  "Other",
] as const;

export const HEARD_OPTIONS = [
  "Church",
  "WhatsApp",
  "PR and media",
  "Creator",
  "Referral",
] as const;

export const GROWTH_LAB = [
  "Branding",
  "Finance",
  "Strategy",
  "Sales",
  "Legal",
  "HR",
  "Digital",
  "Pricing",
] as const;

export function ticketById(id: string): TicketOption | undefined {
  return TICKETS.find((ticket) => ticket.id === id);
}
