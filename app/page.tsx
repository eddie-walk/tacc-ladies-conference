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
const MARKED = LINES[0];

function Sprig({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 180 180" fill="none" aria-hidden="true">
      <path d="M4 18c22 10 40 28 58 52" stroke="#C4A46A" strokeWidth="1.45" />
      <path d="M18 4c16 24 30 42 52 62" stroke="#C4A46A" strokeWidth="1.3" />
      <ellipse cx="36" cy="48" rx="14" ry="6" transform="rotate(-32 36 48)" fill="#E9D6F1" stroke="#C4A46A" strokeWidth="1.15" />
      <ellipse cx="78" cy="74" rx="13" ry="28" fill="#E9D6F1" stroke="#C4A46A" strokeWidth="1.3" />
      <ellipse cx="78" cy="74" rx="13" ry="28" transform="rotate(60 78 74)" fill="#F3E6F6" stroke="#C4A46A" strokeWidth="1.3" />
      <ellipse cx="78" cy="74" rx="13" ry="28" transform="rotate(120 78 74)" fill="#E9D6F1" stroke="#C4A46A" strokeWidth="1.3" />
      <circle cx="78" cy="74" r="5.5" fill="#C4A46A" />
      <ellipse cx="118" cy="52" rx="8" ry="14" transform="rotate(26 118 52)" fill="#E9D6F1" stroke="#C4A46A" strokeWidth="1.1" />
      <path d="M96 58c12-6 20-8 32-4" stroke="#C4A46A" strokeWidth="1.1" />
    </svg>
  );
}

function Edge() {
  return (
    <div className="edge" aria-hidden="true">
      <Sprig className="sprig a" />
      <Sprig className="sprig b" />
      <Sprig className="sprig c" />
      <Sprig className="sprig d" />
      <i className="glint g1" />
      <i className="glint cut g2" />
      <i className="glint g3" />
      <i className="glint cut g4" />
      <i className="glint g5" />
      <i className="glint cut g6" />
      <i className="glint g7" />
      <i className="glint cut g8" />
    </div>
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

  function toggleLab(lab: string) {
    setLabs((current) => (current.includes(lab) ? current.filter((item) => item !== lab) : [...current, lab]));
  }

  function hold(line: string) {
    setHeld((current) => (current.includes(line) ? current.filter((item) => item !== line) : [...current, line]));
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

  const detailFill = phase === "her" ? ((beat + 1) / HER_BEATS) * 100 : phase === "seat" ? 100 : 0;

  return (
    <main className={`hall${phase === "story" && !success ? " is-opening" : ""}`}>
      <Edge />
      {success ? (
        <section className="scene scene-invite">
          <div className="invite-body">
            <p className="kicker">{EVENT.name}</p>
            <p className="theme">
              <span className="next">The next</span>
              <span className="mark-lilac">her.</span>
            </p>
            <h1 className="guest">{name.trim()}</h1>
            <p className="when">
              {EVENT.when}, {EVENT.time}
            </p>
            <p className="meta">
              {ticket ? ticket.name : "Seat"}
              {otherNames.some((item) => item.trim()) ? ` · ${otherNames.filter((item) => item.trim()).join(" · ")}` : ""}
            </p>
            <hr className="rule" />
            <div className="ref-label">Reference</div>
            <p className="ref">{success.reference}</p>
            <div className="pill">Payment pending</div>
            <p className="held">Your seat is reserved. We&apos;ll email your Paystack link when payment opens.</p>
            <p className="whisper">Invest in her. Inspire her. Empower her legacy.</p>
          </div>
        </section>
      ) : (
        <>
          <div className="rail" aria-hidden="true">
            <span className={phase === "story" ? "on" : ""}>Conference</span>
            <b>
              <i style={{ width: phase === "story" ? "8%" : "100%" }} />
            </b>
            <span className={phase === "her" ? "on" : ""}>Details</span>
            <b>
              <i style={{ width: `${detailFill}%` }} />
            </b>
            <span className={phase === "seat" ? "on" : ""}>Seat</span>
          </div>

          {phase === "story" ? (
            <section className="scene scene-open">
              <div className="copy">
                <p className="kicker">{EVENT.name}</p>
                <h1>
                  <span className="next">The next</span>
                  <span className="mark-lilac">her.</span>
                </h1>
                <p className="when">
                  {EVENT.when}, {EVENT.time}
                </p>
                <p className="sense">
                  Women across industries learning from women already making their mark, and the woman behind the work: femininity, friendships, self-care, personal growth.
                </p>
                <div className="nav">
                  <button className="forward" type="button" onClick={() => go("her", 0)}>
                    Continue <span aria-hidden="true">→</span>
                  </button>
                </div>
              </div>
              <div className="lines">
                {LINES.map((line) => (
                  <button
                    key={line}
                    type="button"
                    className={`line${held.includes(line) ? " on" : ""}`}
                    aria-pressed={held.includes(line)}
                    onClick={() => hold(line)}
                  >
                    {line === MARKED ? <span className="mark-gold">{line}</span> : line}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {phase === "her" ? (
            <section className="scene scene-beat">
              <div className="copy">
                <p className="kicker">Your details</p>
                <h2>{LINES[beat]}</h2>
                <p className="idx">
                  0{beat + 1}
                  <span aria-hidden="true"> / 04</span>
                </p>
              </div>
              <form
                className="panel"
                onSubmit={(event) => {
                  event.preventDefault();
                  continueHer();
                }}
              >
                {beat === 0 ? (
                  <>
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
                  </>
                ) : null}

                {beat === 1 ? (
                  <>
                    <div className="field">
                      Age group
                      <div className="choices">
                        {AGE_GROUPS.map((group) => (
                          <button key={group} type="button" className={`choice${ageGroup === group ? " on" : ""}`} onClick={() => setAgeGroup(group)}>
                            {group}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="field">
                      Industry
                      <div className="choices">
                        {INDUSTRIES.map((item) => (
                          <button key={item} type="button" className={`choice${industry === item ? " on" : ""}`} onClick={() => setIndustry(item)}>
                            {item}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                ) : null}

                {beat === 2 ? (
                  <>
                    <div className="field">
                      Member of TACC
                      <div className="choices">
                        {(["Yes", "No"] as const).map((value) => (
                          <button key={value} type="button" className={`choice${member === value ? " on" : ""}`} onClick={() => setMember(value)}>
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
                      <div className="choices">
                        {HEARD_OPTIONS.map((value) => (
                          <button key={value} type="button" className={`choice${heard === value ? " on" : ""}`} onClick={() => setHeard(value)}>
                            {value}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                ) : null}

                {beat === 3 ? (
                  <>
                    <label className="field">
                      Where you reside <span className="opt">optional</span>
                      <input value={residence} onChange={(event) => setResidence(event.target.value)} type="text" placeholder="City or area" />
                    </label>
                    <div className="field">
                      Growth Lab <span className="opt">optional</span>
                      <div className="choices">
                        {GROWTH_LAB.map((value) => (
                          <button key={value} type="button" className={`choice${labs.includes(value) ? " on" : ""}`} onClick={() => toggleLab(value)}>
                            {value}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                ) : null}

                <div className={`alert${error ? " show" : ""}`} role="alert">
                  {error}
                </div>
                <div className="nav">
                  <button className="back" type="button" onClick={back}>
                    Back
                  </button>
                  <button className="forward block" type="submit">
                    Continue <span aria-hidden="true">→</span>
                  </button>
                </div>
              </form>
            </section>
          ) : null}

          {phase === "seat" ? (
            <section className="scene scene-seat">
              <p className="kicker">Your seat</p>
              <h2>{LINES[4]}</h2>
              <div className="passes" role="radiogroup" aria-label="Tickets">
                {TICKETS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`pass${item.id === ticketId ? " on" : ""}`}
                    role="radio"
                    aria-checked={item.id === ticketId}
                    onClick={() => chooseTicket(item.id)}
                  >
                    <span className="who">{item.name}</span>
                    <span className="price">GHS {item.priceGhs}</span>
                    <span className="save">{item.note}</span>
                  </button>
                ))}
              </div>
              {ticket && ticket.seats > 1 ? (
                <div className="circle">
                  <p className="span">The other ladies</p>
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
              <div className={`alert${error ? " show" : ""}`} role="alert">
                {error}
              </div>
              <div className="nav">
                <button className="back" type="button" onClick={back}>
                  Back
                </button>
                <button className="forward" type="button" onClick={submit} disabled={busy} aria-busy={busy}>
                  Complete registration
                </button>
              </div>
              <p className="fine">Payment opens soon. We&apos;ll send your Paystack link when it&apos;s ready.</p>
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}
