import { AGE_GROUPS, HEARD_OPTIONS, SEAT_TARGET, TICKETS } from "./constants";
import type { IndexRow, PaymentStatus } from "./types";

export type StatsPayload = {
  totals: {
    registrations: number;
    seatsTaken: number;
    seatsTarget: number;
    remaining: number;
    paidCount: number;
    pendingCount: number;
    paidSeats: number;
    pendingSeats: number;
    revenuePaidGhs: number;
    revenuePendingGhs: number;
  };
  byTicket: { ticket: string; name: string; registrations: number; seats: number; revenueGhs: number }[];
  byIndustry: { industry: string; registrations: number; seats: number }[];
  byHeard: { heard: string; registrations: number; seats: number }[];
  byAgeGroup: { ageGroup: string; registrations: number; seats: number }[];
  last7Days: { date: string; registrations: number; seats: number }[];
  today: { registrations: number; seats: number; paid: number; pending: number };
};

export function accraDate(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Accra",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function shiftDate(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

function paidAmount(row: IndexRow): number {
  if (row.paymentStatus !== "paid") return 0;
  return row.amountPaidGhs ?? row.priceGhs;
}

export function buildStats(rows: IndexRow[], now = new Date()): StatsPayload {
  const seatsTaken = rows.reduce((sum, row) => sum + row.seats, 0);
  const countStatus = (status: PaymentStatus) => rows.filter((row) => row.paymentStatus === status).length;
  const seatsStatus = (status: PaymentStatus) =>
    rows.filter((row) => row.paymentStatus === status).reduce((sum, row) => sum + row.seats, 0);

  const todayKey = accraDate(now.toISOString());
  const dayKeys = Array.from({ length: 7 }, (_, index) => shiftDate(todayKey, index - 6));
  const dayMap = new Map(dayKeys.map((date) => [date, { date, registrations: 0, seats: 0 }]));
  let todayPaid = 0;
  let todayPending = 0;
  let todaySeats = 0;
  let todayRegistrations = 0;

  for (const row of rows) {
    const date = accraDate(row.createdAt);
    const bucket = dayMap.get(date);
    if (bucket) {
      bucket.registrations += 1;
      bucket.seats += row.seats;
    }
    if (date === todayKey) {
      todayRegistrations += 1;
      todaySeats += row.seats;
      if (row.paymentStatus === "paid") todayPaid += 1;
      if (row.paymentStatus === "pending") todayPending += 1;
    }
  }

  const byTicket = TICKETS.map((ticket) => {
    const matching = rows.filter((row) => row.ticket === ticket.id);
    return {
      ticket: ticket.id,
      name: ticket.name,
      registrations: matching.length,
      seats: matching.reduce((sum, row) => sum + row.seats, 0),
      revenueGhs: matching.reduce((sum, row) => sum + paidAmount(row), 0),
    };
  });

  const industryMap = new Map<string, { industry: string; registrations: number; seats: number }>();
  for (const row of rows) {
    const current = industryMap.get(row.industry) ?? { industry: row.industry, registrations: 0, seats: 0 };
    current.registrations += 1;
    current.seats += row.seats;
    industryMap.set(row.industry, current);
  }

  const byHeard = HEARD_OPTIONS.map((heard) => {
    const matching = rows.filter((row) => row.heard === heard);
    return {
      heard,
      registrations: matching.length,
      seats: matching.reduce((sum, row) => sum + row.seats, 0),
    };
  });

  const byAgeGroup = AGE_GROUPS.map((ageGroup) => {
    const matching = rows.filter((row) => row.ageGroup === ageGroup);
    return {
      ageGroup,
      registrations: matching.length,
      seats: matching.reduce((sum, row) => sum + row.seats, 0),
    };
  });

  return {
    totals: {
      registrations: rows.length,
      seatsTaken,
      seatsTarget: SEAT_TARGET,
      remaining: Math.max(0, SEAT_TARGET - seatsTaken),
      paidCount: countStatus("paid"),
      pendingCount: countStatus("pending"),
      paidSeats: seatsStatus("paid"),
      pendingSeats: seatsStatus("pending"),
      revenuePaidGhs: rows.reduce((sum, row) => sum + paidAmount(row), 0),
      revenuePendingGhs: rows
        .filter((row) => row.paymentStatus === "pending")
        .reduce((sum, row) => sum + row.priceGhs, 0),
    },
    byTicket,
    byIndustry: [...industryMap.values()].sort((a, b) => b.registrations - a.registrations || a.industry.localeCompare(b.industry)),
    byHeard,
    byAgeGroup,
    last7Days: dayKeys.map((date) => dayMap.get(date)!),
    today: {
      registrations: todayRegistrations,
      seats: todaySeats,
      paid: todayPaid,
      pending: todayPending,
    },
  };
}
