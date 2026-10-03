# TACC Ladies Conference

Registration site for **The Next Her**, Saturday 17 October 2026, 11:00 am.

Public page at `/` reserves a seat and stores the registration with `paymentStatus: "pending"`. Paystack is intentionally not connected yet.

Admin dashboard at `/admin`.

## Environment

Copy `.env.example` to `.env.local` (never commit it):

- `BLOB_READ_WRITE_TOKEN` — Vercel Blob read/write token for a **private** store. Server only.
- `ADMIN_SECRET` — password for `/admin`. Server only. The browser keeps it in `sessionStorage` and sends it as `x-admin-secret`.

## Storage

Each registration is a private JSON blob at `registrations/{id}.json`. A private index at `registrations/_index.json` holds lightweight rows for stats and the admin table. Blob tokens never reach the client.

## Payment reminders later

When Paystack opens, export or list registrations where `paymentStatus` is `pending` and email those addresses a payment link. After payment, mark the row paid (and store the Paystack reference) from the admin dashboard or `PATCH /api/admin/registrations/[id]`. Pending seats are already reserved.

## Scripts

```bash
npm install
npm run dev
npm run build
```
