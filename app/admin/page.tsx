"use client";

import { useCallback, useEffect, useState } from "react";
import type { IndexRow, PaymentStatus } from "@/lib/types";
import type { StatsPayload } from "@/lib/stats";

const SECRET_KEY = "tacc-admin-secret";

type RowsResponse = { registrations: IndexRow[] };

async function adminFetch(path: string, secret: string, init?: RequestInit) {
  return fetch(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      "x-admin-secret": secret,
    },
  });
}

function money(value: number) {
  return `GHS ${value.toLocaleString("en-GH")}`;
}

function when(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: "Africa/Accra",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function Bars({ items }: { items: { label: string; value: number }[] }) {
  const max = Math.max(1, ...items.map((item) => item.value));
  if (items.length === 0) return <p className="sub">No registrations yet.</p>;
  return (
    <ul className="bars">
      {items.map((item) => (
        <li key={item.label}>
          <span>{item.label}</span>
          <span className="bar-track">
            <i style={{ width: `${(item.value / max) * 100}%` }} />
          </span>
          <span className="bar-value">{item.value}</span>
        </li>
      ))}
    </ul>
  );
}

export default function AdminPage() {
  const [ready, setReady] = useState(false);
  const [secret, setSecret] = useState("");
  const [rechecking, setRechecking] = useState(false);
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState("");
  const [gateError, setGateError] = useState("");
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [rows, setRows] = useState<IndexRow[]>([]);
  const [status, setStatus] = useState<"" | PaymentStatus>("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (nextSecret: string, nextStatus = status, nextQuery = query) => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      if (nextStatus) params.set("status", nextStatus);
      if (nextQuery.trim()) params.set("q", nextQuery.trim());
      const [statsRes, rowsRes] = await Promise.all([
        adminFetch("/api/admin/stats", nextSecret),
        adminFetch(`/api/admin/registrations?${params.toString()}`, nextSecret),
      ]);
      if (statsRes.status === 401 || rowsRes.status === 401) {
        sessionStorage.removeItem(SECRET_KEY);
        setSecret("");
        setGateError("That password is not right.");
        setLoading(false);
        return;
      }
      if (!statsRes.ok || !rowsRes.ok) {
        const body = (await statsRes.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error || "Could not load the dashboard.");
        setLoading(false);
        return;
      }
      setStats((await statsRes.json()) as StatsPayload);
      const listed = (await rowsRes.json()) as RowsResponse;
      setRows(listed.registrations ?? []);
      setLoading(false);
    },
    [query, status],
  );

  useEffect(() => {
    const saved = sessionStorage.getItem(SECRET_KEY) ?? "";
    if (saved) setSecret(saved);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!secret) return;
    void load(secret);
  }, [secret, load]);

  async function enter(event: React.FormEvent) {
    event.preventDefault();
    const value = draft.trim();
    if (!value) return;
    sessionStorage.setItem(SECRET_KEY, value);
    setGateError("");
    setSecret(value);
  }

  function signOut() {
    sessionStorage.removeItem(SECRET_KEY);
    setSecret("");
    setStats(null);
    setRows([]);
  }

  async function setPayment(row: IndexRow, paymentStatus: PaymentStatus) {
    let paystackReference: string | undefined;
    if (paymentStatus === "paid") {
      const entered = window.prompt("Payment reference (optional)", row.reference);
      if (entered === null) return;
      paystackReference = entered.trim();
    }
    setBusyId(row.id);
    setError("");
    const response = await adminFetch(`/api/admin/registrations/${row.id}`, secret, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentStatus,
        ...(paystackReference ? { paystackReference } : {}),
      }),
    });
    setBusyId("");
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error || "Could not update that registration.");
      return;
    }
    await load(secret);
  }

  async function deleteUser(row: IndexRow) {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete registration for ${row.name} (${row.reference})? This will free up ${row.seats} seat(s) and cannot be undone.`
    );
    if (!confirmDelete) return;

    setBusyId(row.id);
    setError("");
    try {
      const response = await adminFetch(`/api/admin/registrations/${row.id}`, secret, {
        method: "DELETE",
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error || "Could not delete that registration.");
        return;
      }
      await load(secret);
    } catch {
      setError("Network error deleting registration.");
    } finally {
      setBusyId("");
    }
  }

  async function recheckPending() {
    setRechecking(true);
    setError("");
    setNotice("");
    try {
      const response = await adminFetch("/api/admin/registrations/recheck", secret, { method: "POST" });
      const body = (await response.json().catch(() => null)) as
        | { checked?: number; markedPaid?: number; stillPending?: number; errors?: unknown[]; error?: string }
        | null;
      if (!response.ok || !body) {
        setError(body?.error || "Could not re-check pending payments.");
      } else {
        setNotice(
          `Checked ${body.checked ?? 0} pending: ${body.markedPaid ?? 0} marked paid, ${body.stillPending ?? 0} still pending` +
            (body.errors?.length ? `, ${body.errors.length} errors.` : ".")
        );
        await load(secret);
      }
    } catch {
      setError("Network error re-checking payments.");
    } finally {
      setRechecking(false);
    }
  }

  async function exportCsv() {
    const response = await adminFetch("/api/admin/export", secret);
    if (!response.ok) {
      setError("Could not export registrations.");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "tacc-ladies-registrations.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!ready) return null;

  if (!secret) {
    return (
      <main className="admin">
        <form className="gate" onSubmit={enter}>
          <p className="sub">TACC Ladies Conference</p>
          <h1>Admin</h1>
          <label>
            Password
            <input type="password" autoComplete="current-password" value={draft} onChange={(event) => setDraft(event.target.value)} />
          </label>
          {gateError ? <div className="error">{gateError}</div> : null}
          <div className="actions" style={{ marginTop: 16 }}>
            <button className="btn" type="submit">
              Enter dashboard
            </button>
          </div>
        </form>
      </main>
    );
  }

  const totals = stats?.totals;
  const takenPct = totals ? Math.min(100, Math.round((totals.seatsTaken / totals.seatsTarget) * 100)) : 0;

  return (
    <main className="admin">
      <div className="top">
        <div>
          <h1>Registrations</h1>
          <p className="sub">The Next Her · Saturday 17 October 2026 · 11:00 am</p>
        </div>
        <div className="tools">
          <button className="btn" type="button" onClick={recheckPending} disabled={rechecking}>
            {rechecking ? "Re-checking…" : "Re-check pending payments"}
          </button>
          <button className="btn" type="button" onClick={exportCsv}>
            Export CSV
          </button>
          <button className="btn secondary" type="button" onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>

      <p className="note">
        Pending attendee seats stay reserved while payment status is pending.
      </p>
      {notice ? <div className="note">{notice}</div> : null}
      {error ? <div className="error">{error}</div> : null}

      <section className="cards">
        <article className="card">
          <div className="lbl">Seats taken</div>
          <strong>
            {totals ? totals.seatsTaken : "–"} / {totals?.seatsTarget ?? 400}
          </strong>
          <div className="meter">
            <i style={{ width: `${takenPct}%` }} />
          </div>
          <span>{totals ? `${totals.remaining} remaining` : "Loading"}</span>
        </article>
        <article className="card">
          <div className="lbl">Paid</div>
          <strong>{totals?.paidCount ?? "–"}</strong>
          <span>{totals ? `${totals.paidSeats} seats` : ""}</span>
        </article>
        <article className="card">
          <div className="lbl">Awaiting payment</div>
          <strong>{totals?.pendingCount ?? "–"}</strong>
          <span>{totals ? `${totals.pendingSeats} seats` : ""}</span>
        </article>
        <article className="card">
          <div className="lbl">Revenue collected</div>
          <strong>{totals ? money(totals.revenuePaidGhs) : "–"}</strong>
          <span>{totals ? `${money(totals.revenuePendingGhs)} pending` : ""}</span>
        </article>
        <article className="card">
          <div className="lbl">Today</div>
          <strong>{stats?.today.registrations ?? "–"}</strong>
          <span>{stats ? `${stats.today.seats} seats · ${stats.today.paid} paid · ${stats.today.pending} pending` : ""}</span>
        </article>
      </section>

      <section className="charts">
        <article className="panel wide">
          <h2>Last 7 days</h2>
          <Bars items={(stats?.last7Days ?? []).map((day) => ({ label: day.date.slice(5), value: day.registrations }))} />
        </article>
        <article className="panel">
          <h2>By ticket</h2>
          <Bars items={(stats?.byTicket ?? []).map((item) => ({ label: item.name, value: item.registrations }))} />
        </article>
        <article className="panel">
          <h2>How she heard</h2>
          <Bars items={(stats?.byHeard ?? []).map((item) => ({ label: item.heard, value: item.registrations }))} />
        </article>
        <article className="panel">
          <h2>Industry</h2>
          <Bars items={(stats?.byIndustry ?? []).map((item) => ({ label: item.industry, value: item.registrations }))} />
        </article>
        <article className="panel">
          <h2>Age group</h2>
          <Bars items={(stats?.byAgeGroup ?? []).map((item) => ({ label: item.ageGroup, value: item.registrations }))} />
        </article>
      </section>

      <div className="toolbar">
        <input
          type="search"
          placeholder="Search name, email, phone, reference"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select value={status} onChange={(event) => setStatus(event.target.value as "" | PaymentStatus)}>
          <option value="">All statuses</option>
          <option value="pending">Awaiting payment</option>
          <option value="paid">Paid</option>
          <option value="waived">Waived</option>
        </select>
        <button className="btn secondary" type="button" onClick={() => load(secret)} disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Reference</th>
              <th>Name</th>
              <th>Contact</th>
              <th>Ticket</th>
              <th>Status</th>
              <th>Registered</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7}>No registrations match.</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.reference}</td>
                  <td>
                    {row.name}
                    <div className="sub">
                      {row.industry} · {row.ageGroup}
                    </div>
                  </td>
                  <td>
                    {row.email}
                    <div className="sub">{row.phone}</div>
                  </td>
                  <td>
                    {row.ticket} · {row.seats}
                    <div className="sub">{money(row.priceGhs)}</div>
                  </td>
                  <td>
                    <span className={`badge ${row.paymentStatus}`}>{row.paymentStatus}</span>
                  </td>
                  <td>{when(row.createdAt)}</td>
                  <td>
                    <div className="row-actions">
                      <button className="btn tiny" type="button" disabled={busyId === row.id || row.paymentStatus === "paid"} onClick={() => setPayment(row, "paid")}>
                        Mark paid
                      </button>
                      <button
                        className="btn tiny secondary"
                        type="button"
                        disabled={busyId === row.id || row.paymentStatus === "pending"}
                        onClick={() => setPayment(row, "pending")}
                      >
                        Awaiting payment
                      </button>
                      <button
                        className="btn tiny danger"
                        type="button"
                        style={{ color: "#b91c1c", borderColor: "#fecaca", background: "#fef2f2" }}
                        disabled={busyId === row.id}
                        onClick={() => deleteUser(row)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
