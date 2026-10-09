export const PAYMENT_STATUSES = ["pending", "paid", "waived"] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export type TicketId = "one" | "three" | "five";

export type RegistrationRecord = {
  id: string;
  reference: string;
  createdAt: string;
  updatedAt: string;
  ticketId: TicketId;
  ticketName: string;
  priceGhs: number;
  seats: number;
  name: string;
  email: string;
  phone: string;
  ageGroup: string;
  industry: string;
  residence: string;
  taccMember: "Yes" | "No";
  pfcc: string;
  heard: string;
  growthLab: string[];
  otherNames: string[];
  paymentStatus: PaymentStatus;
  paidAt: string | null;
  paystackReference: string | null;
  amountPaidGhs: number | null;
  notes: string | null;
  reservationEmailSentAt?: string | null;
  confirmationEmailSentAt?: string | null;
};

/** Lightweight index row. priceGhs and amountPaidGhs support revenue stats without re-reading every blob. */
export type IndexRow = {
  id: string;
  createdAt: string;
  reference: string;
  ticket: TicketId;
  seats: number;
  paymentStatus: PaymentStatus;
  name: string;
  email: string;
  phone: string;
  industry: string;
  heard: string;
  ageGroup: string;
  priceGhs: number;
  amountPaidGhs: number | null;
};

export type IndexFile = {
  rows: IndexRow[];
};

export type RegisterInput = {
  ticketId: TicketId;
  name: string;
  email: string;
  phone: string;
  ageGroup: string;
  industry: string;
  residence: string;
  taccMember: "Yes" | "No";
  pfcc: string;
  heard: string;
  growthLab: string[];
  otherNames: string[];
};

export type RegistrationPatch = {
  paymentStatus?: PaymentStatus;
  paystackReference?: string | null;
  notes?: string | null;
  reservationEmailSentAt?: string | null;
  confirmationEmailSentAt?: string | null;
};
