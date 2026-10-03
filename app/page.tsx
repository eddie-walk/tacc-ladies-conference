"use client";

import { useMemo, useState } from "react";
import { AGE_GROUPS, EVENT, GROWTH_LAB, HEARD_OPTIONS, INDUSTRIES, TICKETS } from "@/lib/constants";
import type { TicketId } from "@/lib/types";
import { validateRegister } from "@/lib/validate";

type Success = { reference: string; paymentStatus: "pending" };

function Floral({ className }: { className: string }) {
  return (
    <svg className={className} width="150" height="120" viewBox="0 0 150 120" fill="none" aria-hidden="true">
      <path d="M10 90c30-10 40-40 28-68" stroke="#C4A46A" strokeWidth="1.2" />
      <path d="M30 78c18-6 28-24 22-40" stroke="#C4A46A" strokeWidth="1.1" />
      <path d="M18 70c20 8 48 6 70-12" stroke="#C4A46A" strokeWidth="1.1" />
      <ellipse cx="42" cy="28" rx="10" ry="16" transform="rotate(-30 42 28)" stroke="#C4A46A" strokeWidth="1.1" />
      <ellipse cx="62" cy="22" rx="8" ry="14" transform="rotate(20 62 22)" stroke="#C4A46A" strokeWidth="1.1" />
      <circle cx="50" cy="36" r="4" stroke="#C4A46A" strokeWidth="1.1" />
    </svg>
  );
}

export default function HomePage() {
  const [ticketId, setTicketId] = useState<TicketId>("one");
  const [showDetails, setShowDetails] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [ageGroup, setAgeGroup] = useState("");
  const [industry, setIndustry] = useState("");
  const [residence, setResidence] = useState("");
  const [member, setMember] = useState<"" | "Yes" | "No">("");
  const [pfcc, setPfcc] = useState("");
  const [heard, setHeard] = useState("");
  const [labs, setLabs] = useState<string[]>([]);
  const [otherNames, setOtherNames] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<Success | null>(null);

  const ticket = useMemo(() => TICKETS.find((item) => item.id === ticketId) ?? TICKETS[0], [ticketId]);

  function chooseTicket(id: TicketId) {
    setTicketId(id);
    const seats = TICKETS.find((item) => item.id === id)?.seats ?? 1;
    setOtherNames((current) => Array.from({ length: Math.max(0, seats - 1) }, (_, index) => current[index] ?? ""));
  }

  function toggleLab(lab: string) {
    setLabs((current) => (current.includes(lab) ? current.filter((item) => item !== lab) : [...current, lab]));
  }

  async function submit() {
    setError("");
    const parsed = validateRegister({
      ticketId,
      name,
      email,
      phone,
      ageGroup,
      industry,
      residence,
      taccMember: member,
      pfcc,
      heard,
      growthLab: labs,
      otherNames: otherNames.slice(0, ticket.seats - 1),
    });
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.value),
      });
      const data = (await response.json().catch(() => null)) as { reference?: string; error?: string } | null;
      if (!response.ok || !data?.reference) {
        setError(data?.error || "We couldn’t save your registration. Please try again.");
        return;
      }
      setSuccess({ reference: data.reference, paymentStatus: "pending" });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("We couldn’t save your registration. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={`public${showDetails ? " show-details" : ""}${success ? " is-done" : ""}`}>
      <div className="wrap">
        <div className="stage">
          <section className="hero">
            <Floral className="floral tl" />
            <Floral className="floral tr" />
            <p className="kicker">{EVENT.name}</p>
            <h1>
              The next
              <br />
              <em>her.</em>
            </h1>
            <p className="tagline">{EVENT.tagline}</p>
            <div className="pills">
              <span className="pill">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <rect x="2" y="3" width="12" height="11" rx="2" stroke="#4E2D5A" strokeWidth="1.2" />
                  <path d="M2 6.5h12M5 2v3M11 2v3" stroke="#4E2D5A" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                {EVENT.when}
              </span>
              <span className="pill">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <circle cx="8" cy="8" r="5.5" stroke="#4E2D5A" strokeWidth="1.2" />
                  <path d="M8 5.2V8l2 1.4" stroke="#4E2D5A" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                {EVENT.time}
              </span>
            </div>
            <div className="invite">
              <h2>Take your seat</h2>
              <p>Choose your registration and secure your place at The Next Her.</p>
            </div>
            <div className="tickets" role="radiogroup" aria-label="Tickets">
              {TICKETS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`ticket${item.id === ticketId ? " selected" : ""}`}
                  role="radio"
                  aria-checked={item.id === ticketId}
                  onClick={() => chooseTicket(item.id)}
                >
                  <span>
                    <span className="name">{item.name}</span>
                    {item.note ? <span className="note">{item.note}</span> : null}
                  </span>
                  <span className="price">GHS {item.priceGhs}</span>
                  <span className="radio">
                    <span />
                  </span>
                </button>
              ))}
            </div>
            <div className="actions">
              <button className="btn" type="button" onClick={() => setShowDetails(true)}>
                Register <span aria-hidden="true">→</span>
              </button>
              <p className="whisper">Invest in her. Inspire her. Empower her legacy.</p>
            </div>
          </section>

          <section className="panel" id="details">
            <h3>Your details</h3>
            <div className={`error${error ? " show" : ""}`} role="alert">
              {error}
            </div>
            <div className="grid two">
              <label className="field">
                Full name
                <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" type="text" placeholder="Your full name" />
              </label>
              <label className="field">
                Email address
                <input value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" type="email" placeholder="Your email address" inputMode="email" />
              </label>
              <label className="field">
                Phone number
                <input value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" type="tel" placeholder="024 000 0000" inputMode="tel" />
              </label>
              <label className="field">
                Age group
                <select value={ageGroup} onChange={(event) => setAgeGroup(event.target.value)}>
                  <option value="">Select</option>
                  {AGE_GROUPS.map((group) => (
                    <option key={group}>{group}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                Industry
                <select value={industry} onChange={(event) => setIndustry(event.target.value)}>
                  <option value="">Select your industry</option>
                  {INDUSTRIES.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                Where you reside <span className="opt">optional</span>
                <input value={residence} onChange={(event) => setResidence(event.target.value)} type="text" placeholder="City or area" />
              </label>
            </div>

            <div className="stack">
              <div className="field">
                Member of TACC
                <div className="chips">
                  {(["Yes", "No"] as const).map((value) => (
                    <button key={value} type="button" className={`chip${member === value ? " on" : ""}`} onClick={() => setMember(value)}>
                      {value}
                    </button>
                  ))}
                </div>
              </div>
              {member === "Yes" ? (
                <label className="field">
                  Which PFCC
                  <input value={pfcc} onChange={(event) => setPfcc(event.target.value)} type="text" placeholder="Your PFCC" />
                </label>
              ) : null}
              <div className="field">
                How did you hear about us?
                <div className="chips">
                  {HEARD_OPTIONS.map((value) => (
                    <button key={value} type="button" className={`chip${heard === value ? " on" : ""}`} onClick={() => setHeard(value)}>
                      {value}
                    </button>
                  ))}
                </div>
              </div>
              <div className="field">
                Growth Lab <span className="opt">optional</span>
                <div className="chips">
                  {GROWTH_LAB.map((value) => (
                    <button key={value} type="button" className={`chip${labs.includes(value) ? " on" : ""}`} onClick={() => toggleLab(value)}>
                      {value}
                    </button>
                  ))}
                </div>
              </div>
              {ticket.seats > 1 ? (
                <div className="grid">
                  <div className="field">{ticket.seats === 2 ? "The other lady" : "The other ladies"}</div>
                  {Array.from({ length: ticket.seats - 1 }, (_, index) => (
                    <label className="field" key={index}>
                      Name {index + 2}
                      <input
                        type="text"
                        placeholder="Her full name"
                        value={otherNames[index] ?? ""}
                        onChange={(event) =>
                          setOtherNames((current) => {
                            const next = Array.from({ length: ticket.seats - 1 }, (_, item) => current[item] ?? "");
                            next[index] = event.target.value;
                            return next;
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="actions">
              <button className="btn" type="button" onClick={submit} disabled={busy}>
                {busy ? "Reserving your seat…" : "Complete registration"} {!busy ? <span aria-hidden="true">→</span> : null}
              </button>
              <p className="fine">Payment opens soon. We&apos;ll send your Paystack link when it&apos;s ready.</p>
              <p className="whisper">Invest in her. Inspire her. Empower her legacy.</p>
            </div>
          </section>
        </div>

        <section className="done">
          <div className="done-card">
            <Floral className="floral tl" />
            <Floral className="floral tr" />
            <div className="check" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <circle cx="14" cy="14" r="12" stroke="#4E2D5A" strokeWidth="1.4" />
                <path d="M8.5 14.2l3.4 3.4 7.2-7.4" stroke="#4E2D5A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="kicker">You&apos;re in</p>
            <h2>
              See you
              <br />
              on the 17th
            </h2>
            <div className="ref">
              <div className="lbl">Reference</div>
              <strong>{success?.reference}</strong>
              <div className="status-pill">Payment pending</div>
              <p>
                Your seat is reserved. Payment status is pending. We&apos;ll email your Paystack link when payment opens. Screenshot this reference.
              </p>
            </div>
            <p className="whisper">Invest in her. Inspire her. Empower her legacy.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
