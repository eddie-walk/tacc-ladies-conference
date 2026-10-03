"use client";

import { useMemo, useState } from "react";
import { AGE_GROUPS, EVENT, GROWTH_LAB, HEARD_OPTIONS, INDUSTRIES, TICKETS } from "@/lib/constants";
import type { TicketId } from "@/lib/types";
import { validateRegister } from "@/lib/validate";

type Success = { reference: string; paymentStatus: "pending" };
type Phase = "room" | "beat" | "seat";
type BeatId = "name" | "email" | "phone" | "age" | "industry" | "member" | "heard" | "live" | "lab";

const LINES = [
  "You can be feminine and formidable.",
  "You can be playful and dominate.",
  "You can own your industry and still be graceful.",
  "Building. Dominating. Leading.",
  "Your Gift. Your Voice. Your Impact.",
] as const;

const BEATS: { id: BeatId; line: (typeof LINES)[number] }[] = [
  { id: "name", line: LINES[0] },
  { id: "email", line: LINES[1] },
  { id: "phone", line: LINES[2] },
  { id: "age", line: LINES[3] },
  { id: "industry", line: LINES[4] },
  { id: "member", line: LINES[0] },
  { id: "heard", line: LINES[1] },
  { id: "live", line: LINES[2] },
  { id: "lab", line: LINES[4] },
];

const MARKED = LINES[0];
const STARS = ["s0", "s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9", "s10", "s11", "s12", "s13", "s14", "s15", "s16"] as const;

function Vine({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 1440 80" preserveAspectRatio="none" aria-hidden="true">
      <path d="M-20 46C120 8 220 72 360 34s220-28 340 8 250 40 390-6 220-30 370 10" stroke="#C4A46A" strokeWidth="1.6" fill="none" />
      <path d="M-20 58C160 28 260 74 420 46s240-20 360 12 230 28 360-4 200-24 320 8" stroke="#C4A46A" strokeWidth="1.1" fill="none" opacity="0.75" />
    </svg>
  );
}

function Bloom({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 86 110" fill="none" aria-hidden="true">
      <path d="M43 108c1-18 0-34 0-50" stroke="#C4A46A" strokeWidth="1.4" />
      <path d="M43 76c-16 6-28 2-36-8" stroke="#C4A46A" strokeWidth="1.15" />
      <ellipse cx="18" cy="66" rx="12" ry="5.5" transform="rotate(-42 18 66)" fill="#E9D6F1" stroke="#C4A46A" strokeWidth="1.1" />
      <ellipse cx="43" cy="32" rx="10" ry="18" fill="#E9D6F1" stroke="#C4A46A" strokeWidth="1.25" />
      <ellipse cx="43" cy="32" rx="10" ry="18" transform="rotate(72 43 32)" fill="#F4E9F7" stroke="#C4A46A" strokeWidth="1.25" />
      <ellipse cx="43" cy="32" rx="10" ry="18" transform="rotate(144 43 32)" fill="#E9D6F1" stroke="#C4A46A" strokeWidth="1.25" />
      <ellipse cx="43" cy="32" rx="10" ry="18" transform="rotate(216 43 32)" fill="#F4E9F7" stroke="#C4A46A" strokeWidth="1.25" />
      <ellipse cx="43" cy="32" rx="10" ry="18" transform="rotate(288 43 32)" fill="#E9D6F1" stroke="#C4A46A" strokeWidth="1.25" />
      <circle cx="43" cy="32" r="4.5" fill="#C4A46A" />
    </svg>
  );
}

function Florals() {
  return (
    <div className="florals" aria-hidden="true">
      <Vine className="vine top" />
      <Vine className="vine bottom" />
      {["t0", "t1", "t2", "t3", "t4", "t5", "t6"].map((name) => (
        <Bloom key={name} className={`bloom ${name}`} />
      ))}
      {["d0", "d1", "d2", "d3", "d4", "d5"].map((name) => (
        <Bloom key={name} className={`bloom ${name}`} />
      ))}
      <Bloom className="bloom edge-l" />
      <Bloom className="bloom edge-r" />
      {STARS.map((name, index) => (
        <i key={name} className={`star ${index % 3 === 1 ? "cut" : ""} ${name}`} />
      ))}
    </div>
  );
}

export default function HomePage() {
  const [phase, setPhase] = useState<Phase>("room");
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
  const current = BEATS[beat];

  function toggleLab(lab: string) {
    setLabs((currentLabs) => (currentLabs.includes(lab) ? currentLabs.filter((item) => item !== lab) : [...currentLabs, lab]));
  }

  function hold(line: string) {
    setHeld((currentLines) => (currentLines.includes(line) ? currentLines.filter((item) => item !== line) : [...currentLines, line]));
  }

  function chooseTicket(id: TicketId) {
    setError("");
    setTicketId(id);
    const seats = TICKETS.find((item) => item.id === id)?.seats ?? 1;
    setOtherNames((currentNames) => Array.from({ length: Math.max(0, seats - 1) }, (_, index) => currentNames[index] ?? ""));
  }

  function go(next: Phase, nextBeat = beat) {
    setError("");
    setPhase(next);
    setBeat(nextBeat);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function beatError(id: BeatId): string {
    if (id === "name" && name.trim().length < 2) return "Add your full name.";
    if (id === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return "Add an email address so we can send your Paystack link.";
    }
    if (id === "phone") {
      const digits = phone.replace(/\D/g, "");
      if (digits.length < 9 || digits.length > 15) return "Add a phone number.";
    }
    if (id === "age" && !(AGE_GROUPS as readonly string[]).includes(ageGroup)) return "Choose your age group.";
    if (id === "industry" && !(INDUSTRIES as readonly string[]).includes(industry)) return "Choose your industry.";
    if (id === "member") {
      if (member !== "Yes" && member !== "No") return "Let us know if you’re a member of TACC.";
      if (member === "Yes" && pfcc.trim().length < 2) return "Add your PFCC.";
    }
    if (id === "heard" && !(HEARD_OPTIONS as readonly string[]).includes(heard)) return "Tell us how you heard about the conference.";
    return "";
  }

  function continueBeat() {
    const problem = beatError(current.id);
    if (problem) {
      setError(problem);
      return;
    }
    if (beat < BEATS.length - 1) {
      go("beat", beat + 1);
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
    go("seat", beat);
  }

  function back() {
    if (phase === "seat") go("beat", BEATS.length - 1);
    else if (beat === 0) go("room", 0);
    else go("beat", beat - 1);
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

  return (
    <main className={`visit${phase === "room" && !success ? " is-room" : ""}`}>
      {success ? (
        <section className="invite">
          <Florals />
          <p className="kicker">{EVENT.name}</p>
          <div className="lockup">
            <div className="lockup-type">
              <span className="next">The next</span>
              <span className="script">her.</span>
            </div>
          </div>
          <h1 className="guest">{name.trim()}</h1>
          <p className="when">
            {EVENT.when}, {EVENT.time}
          </p>
          <p className="meta">
            {ticket ? ticket.name : "Seat"}
            {otherNames.some((item) => item.trim()) ? ` · ${otherNames.filter((item) => item.trim()).join(" · ")}` : ""}
          </p>
          <div className="ref-label">Reference</div>
          <p className="ref">{success.reference}</p>
          <div className="pill">Payment pending</div>
          <p className="held">Your seat is reserved. We&apos;ll email your Paystack link when payment opens.</p>
          <p className="whisper">Invest in her. Inspire her. Empower her legacy.</p>
        </section>
      ) : null}

      {!success && phase === "room" ? (
        <section className="room">
          <Florals />
          <div className="mast">
            <p className="kicker">{EVENT.name}</p>
            <p className="when">
              {EVENT.when}, {EVENT.time}
            </p>
          </div>
          <div className="lockup">
            <div className="lockup-type">
              <span className="next">The next</span>
              <span className="script">her.</span>
            </div>
            <div className="cluster">
              <i className="star float" style={{ width: 18, height: 18 }} />
              <i className="star cut float" style={{ width: 12, height: 12 }} />
              <Bloom className="bloom near" />
              <i className="star float" style={{ width: 20, height: 20 }} />
              <Bloom className="bloom near" />
            </div>
          </div>
          <div className="wall">
            {LINES.map((line) => (
              <button key={line} type="button" className={`line${held.includes(line) ? " on" : ""}`} aria-pressed={held.includes(line)} onClick={() => hold(line)}>
                {line === MARKED ? <span className="mark">{line}</span> : line}
              </button>
            ))}
          </div>
          <div className="room-nav">
            <button className="go" type="button" onClick={() => go("beat", 0)}>
              Continue <span aria-hidden="true">→</span>
            </button>
          </div>
        </section>
      ) : null}

      {!success && phase === "beat" ? (
        <section className="beat">
          <Florals />
          <p className="kicker">Your details</p>
          <h1 className="proposal">{current.line}</h1>
          <form
            className="answer"
            onSubmit={(event) => {
              event.preventDefault();
              continueBeat();
            }}
          >
            {current.id === "name" ? (
              <label className="field">
                Full name
                <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" type="text" placeholder="Your full name" />
              </label>
            ) : null}
            {current.id === "email" ? (
              <label className="field">
                Email address
                <input value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" type="email" placeholder="Your email address" inputMode="email" />
              </label>
            ) : null}
            {current.id === "phone" ? (
              <label className="field">
                Phone number
                <input value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" type="tel" placeholder="024 000 0000" inputMode="tel" />
              </label>
            ) : null}
            {current.id === "age" ? (
              <div className="field">
                Age group
                <div className="chips stretch">
                  {AGE_GROUPS.map((group) => (
                    <button key={group} type="button" className={`chip${ageGroup === group ? " on" : ""}`} onClick={() => setAgeGroup(group)}>
                      {group}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {current.id === "industry" ? (
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
            ) : null}
            {current.id === "member" ? (
              <>
                <div className="field">
                  Member of TACC
                  <div className="chips pair">
                    {(["Yes", "No"] as const).map((value) => (
                      <button key={value} type="button" className={`chip${member === value ? " on" : ""}`} onClick={() => setMember(value)}>
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
                {member === "Yes" ? (
                  <label className="field" style={{ marginTop: 16 }}>
                    Which PFCC
                    <input value={pfcc} onChange={(event) => setPfcc(event.target.value)} type="text" placeholder="Your PFCC" />
                  </label>
                ) : null}
              </>
            ) : null}
            {current.id === "heard" ? (
              <div className="field">
                How did you hear about us?
                <div className="chips stretch">
                  {HEARD_OPTIONS.map((value) => (
                    <button key={value} type="button" className={`chip${heard === value ? " on" : ""}`} onClick={() => setHeard(value)}>
                      {value}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {current.id === "live" ? (
              <label className="field">
                Where you reside <span className="opt">optional</span>
                <input value={residence} onChange={(event) => setResidence(event.target.value)} type="text" placeholder="City or area" />
              </label>
            ) : null}
            {current.id === "lab" ? (
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
            ) : null}
            <div className={`alert${error ? " show" : ""}`} role="alert">
              {error}
            </div>
            <div className="beat-nav">
              <button className="back" type="button" onClick={back}>
                Back
              </button>
              <button className="go wide" type="submit">
                Continue <span aria-hidden="true">→</span>
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {!success && phase === "seat" ? (
        <section className="seat">
          <Florals />
          <p className="kicker">Your seat</p>
          <h1 className="proposal">{LINES[4]}</h1>
          <div className="passes" role="radiogroup" aria-label="Tickets">
            {TICKETS.map((item) => (
              <button key={item.id} type="button" className={`pass${item.id === ticketId ? " on" : ""}`} role="radio" aria-checked={item.id === ticketId} onClick={() => chooseTicket(item.id)}>
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
                      setOtherNames((currentNames) => {
                        const next = Array.from({ length: ticket.seats - 1 }, (_, item) => currentNames[item] ?? "");
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
          <div className="seat-nav">
            <button className="back" type="button" onClick={back}>
              Back
            </button>
            <button className="go wide" type="button" onClick={submit} disabled={busy} aria-busy={busy}>
              Complete registration
            </button>
          </div>
          <p className="fine">Payment opens soon. We&apos;ll send your Paystack link when it&apos;s ready.</p>
        </section>
      ) : null}
    </main>
  );
}
