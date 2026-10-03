import { randomBytes, randomInt } from "crypto";
import { BlobNotFoundError, BlobPreconditionFailedError, del, get, put } from "@vercel/blob";
import { SEAT_TARGET, ticketById } from "./constants";
import type { IndexFile, IndexRow, PaymentStatus, RegisterInput, RegistrationPatch, RegistrationRecord } from "./types";

const INDEX_PATH = "registrations/_index.json";

export class RegistrationError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "RegistrationError";
    this.status = status;
  }
}

function token(): string {
  const value = process.env.BLOB_READ_WRITE_TOKEN;
  if (!value) throw new RegistrationError("Registration storage is not configured.", 503);
  return value;
}

function recordPath(id: string): string {
  if (!/^[a-f0-9]{32}$/.test(id)) throw new RegistrationError("Registration was not found.", 404);
  return `registrations/${id}.json`;
}

function isConflict(error: unknown): boolean {
  if (error instanceof BlobPreconditionFailedError) return true;
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String(error.name) : "";
  const message = "message" in error ? String(error.message) : "";
  return name === "BlobPreconditionFailedError" || /already exists|precondition failed|condition/i.test(message);
}

type Stored<T> = { value: T; etag: string | null };

async function readJson<T>(pathname: string): Promise<Stored<T> | null> {
  try {
    const result = await get(pathname, {
      access: "private",
      useCache: false,
      token: token(),
    });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    const text = await new Response(result.stream).text();
    return { value: JSON.parse(text) as T, etag: result.blob.etag };
  } catch (error) {
    if (error instanceof BlobNotFoundError) return null;
    if (error instanceof RegistrationError) throw error;
    const message = error instanceof Error ? error.message : "";
    if (/not found|404/i.test(message)) return null;
    throw error;
  }
}

async function writeJson(pathname: string, value: unknown, etag: string | null): Promise<void> {
  await put(pathname, JSON.stringify(value), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: Boolean(etag),
    contentType: "application/json",
    cacheControlMaxAge: 60,
    token: token(),
    ...(etag ? { ifMatch: etag } : {}),
  });
}

async function readIndex(): Promise<Stored<IndexFile>> {
  const stored = await readJson<IndexFile>(INDEX_PATH);
  if (!stored) return { value: { rows: [] }, etag: null };
  if (!stored.value || !Array.isArray(stored.value.rows)) {
    throw new RegistrationError("Registration index is unreadable.", 500);
  }
  return stored;
}

let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(work: () => Promise<T>): Promise<T> {
  const run = queue.then(work, work);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function referenceCode(): string {
  return `PS-17OCT-${randomInt(0, 100000).toString().padStart(5, "0")}`;
}

function freshId(rows: IndexRow[]): string {
  const used = new Set(rows.map((row) => row.id));
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const id = randomBytes(16).toString("hex");
    if (!used.has(id)) return id;
  }
  throw new RegistrationError("Could not reserve a registration id. Please try again.", 503);
}

function toRow(record: RegistrationRecord): IndexRow {
  return {
    id: record.id,
    createdAt: record.createdAt,
    reference: record.reference,
    ticket: record.ticketId,
    seats: record.seats,
    paymentStatus: record.paymentStatus,
    name: record.name,
    email: record.email,
    phone: record.phone,
    industry: record.industry,
    heard: record.heard,
    ageGroup: record.ageGroup,
    priceGhs: record.priceGhs,
    amountPaidGhs: record.amountPaidGhs,
  };
}

function seatsTaken(rows: IndexRow[]): number {
  return rows.reduce((sum, row) => sum + row.seats, 0);
}

export async function createRegistration(input: RegisterInput): Promise<{ id: string; reference: string }> {
  token();
  const ticket = ticketById(input.ticketId);
  if (!ticket) throw new RegistrationError("Choose a ticket.", 400);

  return enqueue(async () => {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const index = await readIndex();
      if (seatsTaken(index.value.rows) + ticket.seats > SEAT_TARGET) {
        throw new RegistrationError("Those seats would take us past 400. Choose a smaller ticket, or check back if a seat opens.", 409);
      }
      const id = freshId(index.value.rows);
      let reference = referenceCode();
      const usedRefs = new Set(index.value.rows.map((row) => row.reference));
      while (usedRefs.has(reference)) reference = referenceCode();
      const now = new Date().toISOString();
      const record: RegistrationRecord = {
        id,
        reference,
        createdAt: now,
        updatedAt: now,
        ticketId: ticket.id,
        ticketName: ticket.name,
        priceGhs: ticket.priceGhs,
        seats: ticket.seats,
        name: input.name,
        email: input.email,
        phone: input.phone,
        ageGroup: input.ageGroup,
        industry: input.industry,
        residence: input.residence,
        taccMember: input.taccMember,
        pfcc: input.pfcc,
        heard: input.heard,
        growthLab: input.growthLab,
        otherNames: input.otherNames,
        paymentStatus: "pending",
        paidAt: null,
        paystackReference: null,
        amountPaidGhs: null,
        notes: null,
      };
      await writeJson(recordPath(id), record, null);
      try {
        await writeJson(INDEX_PATH, { rows: [...index.value.rows, toRow(record)] }, index.etag);
        return { id, reference };
      } catch (error) {
        await del(recordPath(id), { token: token() }).catch(() => undefined);
        if (isConflict(error) && attempt < 5) continue;
        throw error;
      }
    }
    throw new RegistrationError("Could not save the registration. Please try again.", 503);
  });
}

function cleanOptional(value: string | null, max: number): string | null {
  if (value == null) return null;
  const text = value.replace(/[\u0000-\u001F\u007F]/g, "").replace(/[<>]/g, "").trim().slice(0, max);
  return text.length ? text : null;
}

function applyPatch(record: RegistrationRecord, patch: RegistrationPatch): RegistrationRecord {
  const next: RegistrationRecord = { ...record, updatedAt: new Date().toISOString() };
  if ("notes" in patch) next.notes = cleanOptional(patch.notes ?? null, 500);
  if ("paystackReference" in patch) next.paystackReference = cleanOptional(patch.paystackReference ?? null, 80);
  if (patch.paymentStatus) {
    next.paymentStatus = patch.paymentStatus;
    if (patch.paymentStatus === "paid") {
      next.paidAt = record.paymentStatus === "paid" && record.paidAt ? record.paidAt : next.updatedAt;
      next.amountPaidGhs = record.paymentStatus === "paid" && record.amountPaidGhs != null ? record.amountPaidGhs : record.priceGhs;
    } else {
      next.paidAt = null;
      next.amountPaidGhs = null;
    }
  }
  return next;
}

export async function updateRegistration(id: string, patch: RegistrationPatch): Promise<RegistrationRecord> {
  token();
  const path = recordPath(id);
  return enqueue(async () => {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const stored = await readJson<RegistrationRecord>(path);
      if (!stored) throw new RegistrationError("Registration was not found.", 404);
      const updated = applyPatch(stored.value, patch);
      const index = await readIndex();
      if (!index.value.rows.some((row) => row.id === id)) {
        throw new RegistrationError("Registration was not found in the index.", 404);
      }
      try {
        await writeJson(path, updated, stored.etag);
      } catch (error) {
        if (isConflict(error) && attempt < 5) continue;
        throw error;
      }
      const rows = index.value.rows.map((row) => (row.id === id ? toRow(updated) : row));
      try {
        await writeJson(INDEX_PATH, { rows }, index.etag);
        return updated;
      } catch (error) {
        if (isConflict(error) && attempt < 5) continue;
        throw error;
      }
    }
    throw new RegistrationError("Could not update the registration. Please try again.", 503);
  });
}

export async function listIndex(): Promise<IndexRow[]> {
  token();
  const index = await readIndex();
  return index.value.rows;
}

export async function listRegistrations(status?: PaymentStatus, query?: string): Promise<IndexRow[]> {
  const needle = (query ?? "").trim().toLowerCase();
  const rows = (await listIndex()).filter((row) => {
    if (status && row.paymentStatus !== status) return false;
    if (!needle) return true;
    return [row.name, row.email, row.phone, row.reference, row.industry, row.heard, row.ageGroup]
      .join("\n")
      .toLowerCase()
      .includes(needle);
  });
  rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  return rows;
}

async function mapPool<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const output: R[] = new Array(items.length);
  let cursor = 0;
  async function run(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      output[index] = await worker(items[index]);
    }
  }
  const workers = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workers }, () => run()));
  return output;
}

export async function readRegistration(id: string): Promise<RegistrationRecord | null> {
  const stored = await readJson<RegistrationRecord>(recordPath(id));
  return stored?.value ?? null;
}

export async function allRegistrations(): Promise<RegistrationRecord[]> {
  const rows = await listIndex();
  const sorted = [...rows].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  return mapPool(sorted, 6, async (row) => {
    const full = await readRegistration(row.id);
    if (full) return full;
    return {
      id: row.id,
      reference: row.reference,
      createdAt: row.createdAt,
      updatedAt: row.createdAt,
      ticketId: row.ticket,
      ticketName: ticketById(row.ticket)?.name ?? row.ticket,
      priceGhs: row.priceGhs,
      seats: row.seats,
      name: row.name,
      email: row.email,
      phone: row.phone,
      ageGroup: row.ageGroup,
      industry: row.industry,
      residence: "",
      taccMember: "No",
      pfcc: "",
      heard: row.heard,
      growthLab: [],
      otherNames: [],
      paymentStatus: row.paymentStatus,
      paidAt: row.paymentStatus === "paid" ? row.createdAt : null,
      paystackReference: null,
      amountPaidGhs: row.amountPaidGhs,
      notes: "Full record missing from storage.",
    };
  });
}
