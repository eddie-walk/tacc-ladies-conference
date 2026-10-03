"use client";

import { useMemo, useState } from "react";
import { AGE_GROUPS, EVENT, GROWTH_LAB, HEARD_OPTIONS, INDUSTRIES, TICKETS } from "@/lib/constants";
import type { TicketId } from "@/lib/types";
import { validateRegister } from "@/lib/validate";

type Success = { reference: string; paymentStatus: "pending" };
type Phase = "story" | "her" | "seat";

const LINES = [
  "You can be feminine and formidable.",
  "You can be playful and dominate.",
  "You can own your industry and still be graceful.",
  "Building. Dominating. Leading.",
  "Your Gift. Your Voice. Your Impact.",
] as const;

const HER_BEATS = 4;

function Floral({ className }: { className: string }) {
  return (
    <svg className={className} width="220" height="176" viewBox="0 0 150 120" fill="none" aria-hidden="true">
      <path d="M10 90c30-10 40-40 28-68" stroke="#C4A46A" strokeWidth="1.2" />
      <path d="M30 78c18-6 28-24 22-40" stroke="#C4A46A" strokeWidth="1.1" />
      <path d="M18 70c20 8 48 6 70-12" stroke="#C4A46A" strokeWidth="1.1" />
      <ellipse cx="42" cy="28" rx="10" ry="16" transform="rotate(-30 42 28)" stroke="#C4A46A" strokeWidth="1.1" />
      <ellipse cx="62" cy="22" rx="8" ry="14" transform="rotate(20 62 22)" stroke="#C4A46A" strokeWidth="1.1" />
      <circle cx="50" cy="36" r="4" stroke="#C4A46A" strokeWidth="1.1" />
    </svg>
  );
}

function Petal() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <ellipse cx="12" cy="13" rx="5.2" ry="8" transform="rotate(-28 12 13)" fill="currentColor" />
    </svg>
  );
}

export default function HomePage() {
  const [phase, setPhase] = useState<Phase>("story");
  const [beat, setBeat] = useState(0);
  const [held, setHeld] = useState<string[]>([]);
  const [ticketId, setTicketId] = useState<TicketId | "">("");
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

  const ticket = useMemo(() => TICKETS.find((item) => item.id === ticketId), [ticketId]);
  const storyReady = LINES.every((line) => held.includes(line));
  const phaseIndex = phase === "story" ? 0 : phase === "her" ? 1 : 2;
  const fill = phase === "story" ? (held.length / LINES.length) * 0.5 : phase === "her" ? 0.5 + (beat / (HER_BEATS - 1)) * 0.5 : 1;

  function toggleLab(lab: string) {
    setLabs((current) => (current.includes(lab) ? current.filter((item) => item !== lab) : [...current, lab]));
  }

  function hold(line: string) {
    setError("");
    setHeld((current) => (current.includes(line) ? current : [...current, line]));
  }

  function chooseTicket(id: TicketId) {
    setError("");
    setTicketId(id);
    const seats = TICKETS.find((item) => item.id === id)?.seats ?? 1;
    setOtherNames((current) => Array.from({ length: Math.max(0, seats - 1) }, (_, index) => current[index] ?? ""));
  }

  function go(nextPhase: Phase, nextBeat = 0) {
    setError("");
    setPhase(nextPhase);
    setBeat(nextBeat);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function herError(which: number): string {
    if (which === 0) {
      if (name.trim().length < 2) return "Add your full name.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return "Add an email address so we can send your Paystack link.";
      }
      const digits = phone.replace(/\D/g, "");
      if (digits.length < 9 || digits.length > 15) return "Add a phone number.";
    }
    if (which === 1) {
      if (!(AGE_GROUPS as readonly string[]).includes(ageGroup)) return "Choose your age group.";
      if (!(INDUSTRIES as readonly string[]).includes(industry)) return "Choose your industry.";
    }
    if (which === 2) {
      if (member !== "Yes" && member !== "No") return "Let us know if you’re a member of TACC.";
      if (member === "Yes" && pfcc.trim().length < 2) return "Add your PFCC.";
      if (!(HEARD_OPTIONS as readonly string[]).includes(heard)) return "Tell us how you heard about the conference.";
    }
    return "";
  }

  function continueStory() {
    if (!storyReady) {
      setError("Tap each line.");
      return;
    }
    go("her", 0);
  }

  function continueHer() {
    const problem = herError(beat);
    if (problem) {
      setError(problem);
      return;
    }
    if (beat < HER_BEATS - 1) {
      go("her", beat + 1);
      return;
    }
    const parsed = validateRegister({
      ticketId: "one",
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
      otherNames: [],
    });
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    go("seat", 0);
  }

  function back() {
    if (phase === "seat") go("her", HER_BEATS - 1);
    else if (beat === 0) go("story", 0);
    else go("her", beat - 1);
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
      otherNames: otherNames.slice(0, (ticket?.seats ?? 1) - 1),
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

  const steps = [
    { id: "story", label: "The conference" },
    { id: "her", label: "Your details" },
    { id: "seat", label: "Your seat" },
  ] as const;

  return (
    <main className={`public${success ? " is-done" : ""}`}>
      <div className="wrap">
        {!success ? (
          <div className="steps" aria-label="Registration">
            <span className="step-line" aria-hidden="true">
              <i style={{ transform: `scaleX(${fill})` }} />
            </span>
            {steps.map((step, index) => (
              <span key={step.id} className={`step${index === phaseIndex ? " now" : ""}${index < phaseIndex ? " done" : ""}`}>
                <i className="bloom">
                  <Petal />
                </i>
                <span>{step.label}</span>
              </span>
            ))}
          </div>
        ) : null}

        {!success ? (
          <div className="stage">
            {phase === "story" ? (
              <section className="card story" key="story">
                <Floral className="floral tl" />
                <Floral className="floral tr" />
                <p className="kicker">{EVENT.name}</p>
                <h1>
                  The next
                  <br />
                  <em>her.</em>
                </h1>
                <p className="when">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <rect x="2" y="3" width="12" height="11" rx="2" stroke="#4E2D5A" strokeWidth="1.2" />
                    <path d="M2 6.5h12M5 2v3M11 2v3" stroke="#4E2D5A" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                  {EVENT.when}, {EVENT.time}
                </p>
                <p className="lede">
                  The conference brings together women across industries to learn from women already making their mark. It also talks about the woman behind the work: femininity, friendships, self-care, and personal growth.
                </p>
                <div className="lines">
                  {LINES.map((line) => (
                    <button key={line} type="button" className={`phrase${held.includes(line) ? " on" : ""}`} onClick={() => hold(line)}>
                      {line}
                    </button>
                  ))}
                </div>
                <div className={`error${error ? " show" : ""}`} role="alert">
                  {error}
                </div>
                <div className="nav">
                  <button className="btn" type="button" onClick={continueStory}>
                    Continue <span aria-hidden="true">→</span>
                  </button>
                </div>
              </section>
            ) : null}

            {phase === "her" ? (
              <section className="card her" key={`her-${beat}`}>
                <Floral className="floral tl" />
                <Floral className="floral tr" />
                <p className="kicker">Your details</p>
                <div className={`error${error ? " show" : ""}`} role="alert">
                  {error}
                </div>

                {beat === 0 ? (
                  <div className="measure">
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
                  </div>
                ) : null}

                {beat === 1 ? (
                  <div className="measure">
                    <div className="field">
                      Age group
                      <div className="chips">
                        {AGE_GROUPS.map((group) => (
                          <button key={group} type="button" className={`chip${ageGroup === group ? " on" : ""}`} onClick={() => setAgeGroup(group)}>
                            {group}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="field">
                      Industry
                      <div className="chips">
                        {INDUSTRIES.map((item) => (
                          <button key={item} type="button" className={`chip${industry === item ? " on" : ""}`} onClick={() => setIndustry(item)}>
                            {item}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}

                {beat === 2 ? (
                  <div className="measure">
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
                  </div>
                ) : null}

                {beat === 3 ? (
                  <div className="measure">
                    <label className="field">
                      Where you reside <span className="opt">optional</span>
                      <input value={residence} onChange={(event) => setResidence(event.target.value)} type="text" placeholder="City or area" />
                    </label>
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
                  </div>
                ) : null}

                <div className="nav">
                  <button className="btn ghost" type="button" onClick={back}>
                    Back
                  </button>
                  <button className="btn" type="button" onClick={continueHer}>
                    Continue <span aria-hidden="true">→</span>
                  </button>
                </div>
              </section>
            ) : null}

            {phase === "seat" ? (
              <section className="card seats" key="seat">
                <Floral className="floral tl" />
                <Floral className="floral tr" />
                <p className="kicker">Your seat</p>
                <h2>Take your seat</h2>
                <p className="quiet">Take a seat, or bring her circle.</p>
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
                      <span className="marks" aria-hidden="true">
                        {Array.from({ length: item.seats }, (_, index) => (
                          <i key={index} />
                        ))}
                      </span>
                      <span className="name">{item.name}</span>
                      <span className="price">GHS {item.priceGhs}</span>
                      {item.note ? <span className="note">{item.note}</span> : <span className="note">&nbsp;</span>}
                    </button>
                  ))}
                </div>
                {ticket && ticket.seats > 1 ? (
                  <div className="circle">
                    <p>The other ladies</p>
                    {Array.from({ length: ticket.seats - 1 }, (_, index) => (
                      <label className="field" key={index}>
                        Her name
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
                <div className={`error${error ? " show" : ""}`} role="alert">
                  {error}
                </div>
                <div className="nav">
                  <button className="btn ghost" type="button" onClick={back}>
                    Back
                  </button>
                  <button className="btn" type="button" onClick={submit} disabled={busy}>
                    {busy ? "Reserving your seat…" : "Complete registration"} {!busy ? <span aria-hidden="true">→</span> : null}
                  </button>
                </div>
                <p className="fine">Payment opens soon. We&apos;ll send your Paystack link when it&apos;s ready.</p>
              </section>
            ) : null}
          </div>
        ) : (
          <section className="card invite-card">
            <Floral className="floral tl" />
            <Floral className="floral tr" />
            <p className="kicker">{EVENT.name}</p>
            <h2>
              The next
              <br />
              <em>her.</em>
            </h2>
            <p className="when">
              {EVENT.when}, {EVENT.time}
            </p>
            <article className="seat-card">
              <p className="seat-name">{name}</p>
              {ticket ? <p className="seat-kind">{ticket.name}</p> : null}
              {otherNames.some((item) => item.trim()) ? <p className="with">{otherNames.filter((item) => item.trim()).join(" · ")}</p> : null}
              <div className="lbl">Reference</div>
              <strong>{success.reference}</strong>
              <div className="status-pill">Payment pending</div>
              <p>Your seat is reserved. We&apos;ll email your Paystack link when payment opens. Screenshot this reference.</p>
            </article>
            <p className="whisper">Invest in her. Inspire her. Empower her legacy.</p>
          </section>
        )}
      </div>
    </main>
  );
}
