import { randomBytes, randomInt } from "crypto";
import fs from "fs/promises";
import path from "path";
import { BlobNotFoundError, BlobPreconditionFailedError, del, get, put } from "@vercel/blob";
import { after } from "next/server";
import { sendEmail } from "./email";
import { buildEmail, type EmailKind } from "./email-templates";
import { SEAT_TARGET, ticketById } from "./constants";
import type { IndexFile, IndexRow, PaymentStatus, RegisterInput, RegistrationPatch, RegistrationRecord } from "./types";

const INDEX_PATH = "registrations/_index.json";
const LOCAL_DIR = path.join(process.cwd(), ".data");

export class RegistrationError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "RegistrationError";
    this.status = status;
  }
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
  return name === "BlobPreconditionFailedError" || /already exists|precondition failed|condition|etag|mismatch/i.test(message);
}

type Stored<T> = { value: T; etag: string | null };

async function localReadJson<T>(pathname: string): Promise<Stored<T> | null> {
  const filePath = path.join(LOCAL_DIR, pathname);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return { value: JSON.parse(raw) as T, etag: "local" };
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "ENOENT") {
      return null;
    }
    throw err;
  }
}

async function localWriteJson(pathname: string, value: unknown): Promise<void> {
  const filePath = path.join(LOCAL_DIR, pathname);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

async function localDelJson(pathname: string): Promise<void> {
  const filePath = path.join(LOCAL_DIR, pathname);
  await fs.unlink(filePath).catch(() => undefined);
}

function defaultBlobAccess(): "public" | "private" {
  if (process.env.BLOB_ACCESS === "private") return "private";
  return "public";
}

function getBlobToken(): string {
  if (process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    return process.env.BLOB_READ_WRITE_TOKEN.trim();
  }
  if (process.env.VERCEL_BLOB_READ_WRITE_TOKEN?.trim()) {
    return process.env.VERCEL_BLOB_READ_WRITE_TOKEN.trim();
  }
  for (const [key, val] of Object.entries(process.env)) {
    if (
      (key.endsWith("_READ_WRITE_TOKEN") || (key.includes("BLOB") && key.includes("TOKEN"))) &&
      val &&
      typeof val === "string" &&
      val.trim()
    ) {
      return val.trim();
    }
  }
  return "";
}

async function readJson<T>(pathname: string): Promise<Stored<T> | null> {
  const token = getBlobToken() || undefined;
  const storeId = process.env.BLOB_STORE_ID?.trim();
  if (!token && !storeId) {
    if (process.env.VERCEL) {
      const blobEnv = Object.keys(process.env).filter((k) => /blob/i.test(k)).join(", ");
      const hint = blobEnv ? ` (detected keys: ${blobEnv})` : "";
      throw new RegistrationError(
        `Vercel Blob Storage is not connected${hint}. In your Vercel Dashboard, go to Project Settings > Environment Variables, verify BLOB_READ_WRITE_TOKEN is set for Production & Preview, and redeploy.`,
        500
      );
    }
    return localReadJson<T>(pathname);
  }

  const primaryAccess = defaultBlobAccess();
  const secondaryAccess = primaryAccess === "public" ? "private" : "public";

  try {
    let result = await get(pathname, {
      access: primaryAccess,
      useCache: false,
      ...(token ? { token } : {}),
    }).catch(async (primaryError) => {
      // If store type differs from primary, try alternative access
      const msg = primaryError instanceof Error ? primaryError.message : "";
      if (/access|private|public|403|unsupported/i.test(msg)) {
        return get(pathname, { access: secondaryAccess, useCache: false, ...(token ? { token } : {}) });
      }
      throw primaryError;
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
  const token = getBlobToken() || undefined;
  const storeId = process.env.BLOB_STORE_ID?.trim();
  if (!token && !storeId) {
    if (process.env.VERCEL) {
      const blobEnv = Object.keys(process.env).filter((k) => /blob/i.test(k)).join(", ");
      const hint = blobEnv ? ` (detected keys: ${blobEnv})` : "";
      throw new RegistrationError(
        `Vercel Blob Storage is not connected${hint}. In your Vercel Dashboard, go to Project Settings > Environment Variables, verify BLOB_READ_WRITE_TOKEN is set for Production & Preview, and redeploy.`,
        500
      );
    }
    return localWriteJson(pathname, value);
  }

  const primaryAccess = defaultBlobAccess();
  const secondaryAccess = primaryAccess === "public" ? "private" : "public";

  const buildOptions = (access: "public" | "private", matchEtag: string | null) => ({
    access,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 0,
    ...(token ? { token } : {}),
    ...(matchEtag ? { ifMatch: matchEtag } : {}),
  });

  try {
    await put(pathname, JSON.stringify(value), buildOptions(primaryAccess, etag));
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (/access|private|public|403|unsupported/i.test(msg)) {
      try {
        await put(pathname, JSON.stringify(value), buildOptions(secondaryAccess, etag));
        return;
      } catch (secError) {
        if (etag && /etag|precondition|mismatch|conflict/i.test(secError instanceof Error ? secError.message : "")) {
          await put(pathname, JSON.stringify(value), buildOptions(secondaryAccess, null));
          return;
        }
        throw secError;
      }
    }
    // If precondition or ETag mismatch occurred, retry unconditionally so index write never crashes
    if (etag && /etag|precondition|mismatch|conflict/i.test(msg)) {
      await put(pathname, JSON.stringify(value), buildOptions(primaryAccess, null));
      return;
    }
    throw error;
  }
}

async function deleteJson(pathname: string): Promise<void> {
  const token = getBlobToken() || undefined;
  const storeId = process.env.BLOB_STORE_ID?.trim();
  if (!token && !storeId) {
    if (process.env.VERCEL) return;
    return localDelJson(pathname);
  }
  await del(pathname, token ? { token } : undefined).catch(() => undefined);
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
        await deleteJson(recordPath(id));
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
  if ("reservationEmailSentAt" in patch) next.reservationEmailSentAt = patch.reservationEmailSentAt ?? null;
  if ("confirmationEmailSentAt" in patch) next.confirmationEmailSentAt = patch.confirmationEmailSentAt ?? null;
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

/** Sends the reservation or confirmation email and records the send time. Never throws. */
export async function sendRegistrationEmail(
  record: RegistrationRecord,
  kind: EmailKind,
  force = false,
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  try {
    const sentField = kind === "confirmed" ? "confirmationEmailSentAt" : "reservationEmailSentAt";
    if (!force && record[sentField]) return { ok: false, skipped: true };
    if (!record.email?.trim()) return { ok: false, skipped: true };
    const result = await sendEmail({ to: record.email, ...buildEmail(kind, record) });
    if (result.ok) {
      await rawUpdateRegistration(record.id, { [sentField]: new Date().toISOString() }).catch(() => undefined);
    }
    return result;
  } catch {
    return { ok: false, error: "Email could not be sent." };
  }
}

/** Runs work after the response is sent; falls back to a bounded inline await outside a request. Never throws. */
export function runInBackground(task: () => Promise<unknown>): void {
  const safe = () => task().catch(() => undefined);
  try {
    after(safe);
  } catch {
    void safe();
  }
}

export async function updateRegistration(id: string, patch: RegistrationPatch): Promise<RegistrationRecord> {
  const before = patch.paymentStatus ? await getRegistration(id).catch(() => null) : null;
  const updated = await rawUpdateRegistration(id, patch);
  if (patch.paymentStatus === "paid" && before && before.paymentStatus !== "paid" && updated.paymentStatus === "paid") {
    runInBackground(() => sendRegistrationEmail(updated, "confirmed"));
  }
  return updated;
}

async function rawUpdateRegistration(id: string, patch: RegistrationPatch): Promise<RegistrationRecord> {
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

export async function deleteRegistration(id: string): Promise<void> {
  const path = recordPath(id);
  return enqueue(async () => {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const index = await readIndex();
      const existing = index.value.rows.find((row) => row.id === id);
      if (!existing) {
        await deleteJson(path);
        return;
      }

      const rows = index.value.rows.filter((row) => row.id !== id);
      try {
        await writeJson(INDEX_PATH, { rows }, index.etag);
      } catch (error) {
        if (isConflict(error) && attempt < 5) continue;
        throw error;
      }

      await deleteJson(path);
      return;
    }
    throw new RegistrationError("Could not delete the registration. Please try again.", 503);
  });
}

export async function listIndex(): Promise<IndexRow[]> {
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
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => run());
  await Promise.all(workers);
  return output;
}

export async function allRegistrations(): Promise<RegistrationRecord[]> {
  const rows = await listIndex();
  rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  const full = await mapPool(rows, 6, async (row) => {
    const stored = await readJson<RegistrationRecord>(recordPath(row.id));
    return stored?.value ?? null;
  });
  return full.filter((item): item is RegistrationRecord => item !== null);
}

export async function getRegistration(id: string): Promise<RegistrationRecord | null> {
  const stored = await readJson<RegistrationRecord>(recordPath(id));
  return stored?.value ?? null;
}
