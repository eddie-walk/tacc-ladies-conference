"use client";

import { useEffect, useMemo, useState } from "react";
import { AGE_GROUPS, EVENT, GROWTH_LAB, HEARD_OPTIONS, INDUSTRIES, TICKETS } from "@/lib/constants";
import { detectMoolreCollectionChannel, type MoolreCollectionChannel } from "@/lib/moolre-channel";
import type { TicketId } from "@/lib/types";
import { validateRegister } from "@/lib/validate";

type Success = {
  id?: string;
  reference: string;
  paymentStatus: "pending" | "paid";
  moolrePrompt?: boolean;
  paymentUrl?: string;
  otpRequired?: boolean;
  promptMessage?: string;
  paymentError?: string;
  payerPhone?: string;
  amountGhs?: number;
};
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

const BEAT_QUESTIONS: Record<BeatId, { title: string; subtitle?: string; fieldLabel: string }> = {
  name: {
    title: "What is your full name?",
    subtitle: "We will personalise your conference pass with this name",
    fieldLabel: "Full Name",
  },
  email: {
    title: "Where may we send your invitation?",
    subtitle: "Your pass and digital receipt will be delivered here",
    fieldLabel: "Email Address",
  },
  phone: {
    title: "What is your contact phone number?",
    subtitle: "For registration updates and mobile money confirmation",
    fieldLabel: "Phone Number",
  },
  age: {
    title: "Which age group represents you?",
    subtitle: "Helping us curate sessions for every season of womanhood",
    fieldLabel: "Age Group",
  },
  industry: {
    title: "What is your sphere or industry?",
    subtitle: "Connect with formidable women leading in your field",
    fieldLabel: "Industry",
  },
  member: {
    title: "Are you a member of TACC?",
    fieldLabel: "Membership",
  },
  heard: {
    title: "How did you hear about us?",
    subtitle: "We love knowing how our circle discovers us",
    fieldLabel: "Discovery",
  },
  live: {
    title: "Where do you reside?",
    subtitle: "Optional · City or residential area",
    fieldLabel: "Residence",
  },
  lab: {
    title: "Which Growth Lab speaks to your vision?",
    subtitle: "Optional · Select any tracks you wish to explore",
    fieldLabel: "Growth Lab",
  },
};

function Sprig() {
  return (
    <div className="sprigs" aria-hidden="true">
      <svg className="sprig a" viewBox="0 0 120 180" fill="none">
        <path d="M28 172c6-36 4-70 26-104" stroke="#C4A46A" strokeWidth="1" />
        <path d="M42 138c-18 0-32-10-40-26" stroke="#C4A46A" strokeWidth="1" />
        <path d="M48 108c16 1 28-8 36-20" stroke="#C4A46A" strokeWidth="1" />
        <ellipse cx="62" cy="52" rx="6" ry="13" transform="rotate(-18 62 52)" stroke="#C4A46A" strokeWidth="1" />
        <ellipse cx="76" cy="44" rx="5" ry="11" transform="rotate(28 76 44)" stroke="#C4A46A" strokeWidth="1" />
        <ellipse cx="54" cy="40" rx="5" ry="10" transform="rotate(-58 54 40)" stroke="#C4A46A" strokeWidth="1" />
      </svg>
      <svg className="sprig b" viewBox="0 0 120 180" fill="none">
        <path d="M92 172c-6-36-4-70-26-104" stroke="#C4A46A" strokeWidth="1" />
        <path d="M78 138c18 0 32-10 40-26" stroke="#C4A46A" strokeWidth="1" />
        <path d="M72 108c-16 1-28-8-36-20" stroke="#C4A46A" strokeWidth="1" />
        <ellipse cx="58" cy="52" rx="6" ry="13" transform="rotate(18 58 52)" stroke="#C4A46A" strokeWidth="1" />
        <ellipse cx="44" cy="44" rx="5" ry="11" transform="rotate(-28 44 44)" stroke="#C4A46A" strokeWidth="1" />
        <ellipse cx="66" cy="40" rx="5" ry="10" transform="rotate(58 66 40)" stroke="#C4A46A" strokeWidth="1" />
      </svg>
    </div>
  );
}

export default function HomePage() {
  const [phase, setPhase] = useState<Phase>("room");
  const [beat, setBeat] = useState(0);
  const [ticketId, setTicketId] = useState<TicketId | "">("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [ageGroup, setAgeGroup] = useState("");
  const [industry, setIndustry] = useState("");
  const [industryOther, setIndustryOther] = useState("");
  const [residence, setResidence] = useState("");
  const [member, setMember] = useState<"" | "Yes" | "No">("");
  const [pfcc, setPfcc] = useState("");
  const [heard, setHeard] = useState("");
  const [labs, setLabs] = useState<string[]>([]);
  const [otherNames, setOtherNames] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<Success | null>(null);

  // Checkout modal state
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [payMethod, setPayMethod] = useState<"momo" | "later">("momo");
  const [paymentPhone, setPaymentPhone] = useState("");
  const [paymentChannel, setPaymentChannel] = useState<MoolreCollectionChannel>("13");
  const [otpCode, setOtpCode] = useState("");
  const [otpRequired, setOtpRequired] = useState(false);
  const [pendingReg, setPendingReg] = useState<{ id: string; reference: string } | null>(null);
  const [checkoutTxRef, setCheckoutTxRef] = useState("");

  // Success card payment states
  const [cardPhone, setCardPhone] = useState("");
  const [cardChannel, setCardChannel] = useState<MoolreCollectionChannel>("13");
  const [cardOtpCode, setCardOtpCode] = useState("");
  const [cardOtpRequired, setCardOtpRequired] = useState(false);
  const [cardTxRef, setCardTxRef] = useState("");
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [promptingPayment, setPromptingPayment] = useState(false);
  const [promptNotice, setPromptNotice] = useState<string | null>(null);

  // Reservation lookup state
  const [lookupOpen, setLookupOpen] = useState(false);
  const [lookupQuery, setLookupQuery] = useState("");
  const [lookupError, setLookupError] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);
  const [prevPhase, setPrevPhase] = useState<Phase>("seat");
  const [copiedRef, setCopiedRef] = useState(false);

  // Restore draft or confirmed reservation on refresh
  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem("tacc_reg_draft_v1");
      if (savedDraft) {
        const d = JSON.parse(savedDraft);
        if (d.name) setName(d.name);
        if (d.email) setEmail(d.email);
        if (d.phone) setPhone(d.phone);
        if (d.ageGroup) setAgeGroup(d.ageGroup);
        if (d.industry) {
          if (d.industry.startsWith("Other: ")) {
            setIndustry("Other");
            setIndustryOther(d.industry.slice(7));
          } else if (d.industry === "Other") {
            setIndustry("Other");
            if (d.industryOther) setIndustryOther(d.industryOther);
          } else {
            setIndustry(d.industry);
          }
        }
        if (d.industryOther) setIndustryOther(d.industryOther);
        if (d.residence) setResidence(d.residence);
        if (d.member) setMember(d.member);
        if (d.pfcc) setPfcc(d.pfcc);
        if (d.heard) setHeard(d.heard);
        if (Array.isArray(d.labs)) setLabs(d.labs);
        if (Array.isArray(d.otherNames)) setOtherNames(d.otherNames);
        if (d.ticketId) setTicketId(d.ticketId);
        if (d.phase && (d.phase === "beat" || d.phase === "seat")) {
          setPhase(d.phase);
          if (typeof d.beat === "number") setBeat(d.beat);
        }
        if (d.pendingReg) setPendingReg(d.pendingReg);
        if (d.paymentPhone) {
          setPaymentPhone(d.paymentPhone);
          const detected = detectMoolreCollectionChannel(d.paymentPhone);
          setPaymentChannel(detected);
        }
      }

      const savedSuccess = localStorage.getItem("tacc_reg_success_v1");
      if (savedSuccess) {
        const parsed = JSON.parse(savedSuccess);
        if (parsed && parsed.reference) {
          setSuccess(parsed);
          if (parsed.name) setName(parsed.name);
          if (parsed.payerPhone) {
            setCardPhone(parsed.payerPhone);
            const detected = detectMoolreCollectionChannel(parsed.payerPhone);
            setCardChannel(detected);
          }
        }
      }
    } catch { }
  }, []);

  // Save changes to localStorage so refreshing never loses progress
  useEffect(() => {
    try {
      if (success) {
        localStorage.setItem("tacc_reg_success_v1", JSON.stringify({ ...success, name }));
      } else {
        localStorage.removeItem("tacc_reg_success_v1");
      }

      if (phase !== "room" || name || email || phone) {
        localStorage.setItem(
          "tacc_reg_draft_v1",
          JSON.stringify({
            phase: phase === "room" && success ? "seat" : phase,
            beat,
            ticketId,
            name,
            email,
            phone,
            ageGroup,
            industry: industry === "Other" && industryOther.trim() ? `Other: ${industryOther.trim()}` : industry,
            industryOther,
            residence,
            member,
            pfcc,
            heard,
            labs,
            otherNames,
            pendingReg,
            paymentPhone,
          })
        );
      }
    } catch { }
  }, [
    phase,
    beat,
    ticketId,
    name,
    email,
    phone,
    ageGroup,
    industry,
    industryOther,
    residence,
    member,
    pfcc,
    heard,
    labs,
    otherNames,
    success,
    pendingReg,
    paymentPhone,
  ]);

  const ticket = useMemo(() => TICKETS.find((item) => item.id === ticketId), [ticketId]);
  const current = BEATS[beat];

  function toggleLab(lab: string) {
    setLabs((currentLabs) => (currentLabs.includes(lab) ? currentLabs.filter((item) => item !== lab) : [...currentLabs, lab]));
  }

  function chooseTicket(id: TicketId) {
    setError("");
    setCheckoutError("");
    setTicketId(id);
    setPendingReg(null);
    setOtpRequired(false);
    setOtpCode("");
    const seats = TICKETS.find((item) => item.id === id)?.seats ?? 1;
    setOtherNames((currentNames) => Array.from({ length: Math.max(0, seats - 1) }, (_, index) => currentNames[index] ?? ""));
  }

  function go(next: Phase, nextBeat = beat) {
    setError("");
    setCheckoutError("");
    setPhase(next);
    setBeat(nextBeat);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handlePaymentPhoneChange(val: string) {
    setPaymentPhone(val);
    const detected = detectMoolreCollectionChannel(val);
    setPaymentChannel(detected);
  }

  function handleCardPhoneChange(val: string) {
    setCardPhone(val);
    const detected = detectMoolreCollectionChannel(val);
    setCardChannel(detected);
  }

  function beatError(id: BeatId): string {
    if (id === "name" && name.trim().length < 2) return "Add your full name.";
    if (id === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return "Add an email address so we can send your confirmation details.";
    }
    if (id === "phone") {
      const digits = phone.replace(/\D/g, "");
      if (digits.length < 9 || digits.length > 15) return "Add a phone number.";
    }
    if (id === "age" && !(AGE_GROUPS as readonly string[]).includes(ageGroup)) return "Choose your age group.";
    if (id === "industry") {
      if (!(INDUSTRIES as readonly string[]).includes(industry)) return "Choose your industry.";
      if (industry === "Other" && industryOther.trim().length < 2) {
        return "Please specify your industry.";
      }
    }
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
    const finalIndustry = industry === "Other" && industryOther.trim()
      ? `Other: ${industryOther.trim()}`
      : industry;
    const parsed = validateRegister({
      ticketId: "one",
      name,
      email,
      phone,
      ageGroup,
      industry: finalIndustry,
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

    if (!ticketId) {
      setTicketId("one");
    }
    go("seat", beat);
  }

  function back() {
    if (phase === "seat") go("beat", BEATS.length - 1);
    else if (beat === 0) go("room", 0);
    else go("beat", beat - 1);
  }

  function handleProceedToPayment() {
    if (!ticketId) {
      setError("Please choose a ticket pass.");
      return;
    }
    setError("");
    setCheckoutError("");
    setCheckoutOpen(true);
  }

  async function submit(payNow: boolean) {
    if (!ticketId) {
      setError("Please choose a ticket pass.");
      return;
    }
    setError("");
    setCheckoutError("");

    const finalIndustry = industry === "Other" && industryOther.trim()
      ? `Other: ${industryOther.trim()}`
      : industry;

    const parsed = validateRegister({
      ticketId,
      name,
      email,
      phone,
      ageGroup,
      industry: finalIndustry,
      residence,
      taccMember: member,
      pfcc,
      heard,
      growthLab: labs,
      otherNames: otherNames.slice(0, (ticket?.seats ?? 1) - 1),
    });
    if (!parsed.ok) {
      setError(parsed.error);
      setCheckoutError(parsed.error);
      return;
    }

    if (payNow) {
      const cleanDigits = paymentPhone.replace(/\D/g, "");
      if (cleanDigits.length < 9 || cleanDigits.length > 15) {
        setCheckoutError("Please enter a valid Mobile Money number to receive the prompt.");
        return;
      }
    } else if (pendingReg) {
      // If user had already initiated a registration that required OTP, but switched to Pay Later
      setCheckoutOpen(false);
      const chosenPhone = paymentPhone.trim() || phone.trim();
      setCardPhone(chosenPhone);
      setCardChannel(paymentChannel);
      setSuccess({
        reference: pendingReg.reference,
        id: pendingReg.id,
        paymentStatus: "pending",
        moolrePrompt: false,
        payerPhone: chosenPhone,
        amountGhs: ticket?.priceGhs || 100,
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...parsed.value,
          payment: {
            payNow,
            payerPhone: payNow ? paymentPhone.trim() : undefined,
            channel: paymentChannel,
            otpCode: otpCode.trim() || undefined,
          },
        }),
      });
      const data = (await response.json().catch(() => null)) as {
        reference?: string;
        id?: string;
        paymentStatus?: "pending" | "paid";
        moolrePrompt?: boolean;
        paymentUrl?: string;
        otpRequired?: boolean;
        promptMessage?: string;
        paymentError?: string;
        payerPhone?: string;
        amountGhs?: number;
        txRef?: string;
        error?: string;
      } | null;
      if (!response.ok || !data?.reference) {
        setCheckoutError(data?.error || "We couldn’t save your registration. Please try again.");
        return;
      }
      if (data.otpRequired) {
        if (data.id && data.reference) {
          setPendingReg({ id: data.id, reference: data.reference });
        }
        if (data.txRef) {
          setCheckoutTxRef(data.txRef);
        }
        setOtpRequired(true);
        setCheckoutError(data.promptMessage || "A verification code was sent to your phone via SMS. Please enter it below to proceed.");
        return;
      }
      setCheckoutOpen(false);
      const chosenPhone = paymentPhone.trim() || data.payerPhone || "";
      const chosenChannel = paymentChannel;
      setCardPhone(chosenPhone);
      setCardChannel(chosenChannel);
      setSuccess({
        reference: data.reference,
        id: data.id,
        paymentStatus: data.paymentStatus || "pending",
        moolrePrompt: data.moolrePrompt,
        paymentUrl: data.paymentUrl,
        otpRequired: data.otpRequired,
        promptMessage: data.promptMessage,
        paymentError: data.paymentError,
        payerPhone: chosenPhone,
        amountGhs: data.amountGhs || ticket?.priceGhs || 100,
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
      if (data.paymentUrl) window.open(data.paymentUrl, "_blank", "noopener");
    } catch {
      setCheckoutError("We couldn’t save your registration. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function submitOtpVerification() {
    const code = otpCode.trim();
    if (!code) {
      setCheckoutError("Please enter the verification code sent to your phone via SMS.");
      return;
    }
    const targetReg = pendingReg || (success?.id && success?.reference ? { id: success.id, reference: success.reference } : null);
    if (!targetReg) {
      setCheckoutError("Could not locate your reservation. Please try again.");
      return;
    }

    const cleanDigits = paymentPhone.replace(/\D/g, "");
    if (cleanDigits.length < 9) {
      setCheckoutError("Please enter a valid Mobile Money number.");
      return;
    }

    setBusy(true);
    setCheckoutError("");
    try {
      const res = await fetch("/api/payment/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: targetReg.id,
          reference: targetReg.reference,
          phone: paymentPhone.trim(),
          channel: paymentChannel,
          txRef: checkoutTxRef || undefined,
          otpCode: code,
        }),
      });

      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        promptSent?: boolean;
        otpRequired?: boolean;
        txRef?: string;
        message?: string;
        error?: string;
      } | null;

      if (data?.txRef) {
        setCheckoutTxRef(data.txRef);
      }

      if (res.ok && data?.promptSent) {
        setCheckoutOpen(false);
        const chosenPhone = paymentPhone.trim();
        setCardPhone(chosenPhone);
        setCardChannel(paymentChannel);
        setSuccess({
          reference: targetReg.reference,
          id: targetReg.id,
          paymentStatus: "pending",
          moolrePrompt: true,
          promptMessage: data.message || `A payment prompt has been sent to ${chosenPhone} to complete payment.`,
          payerPhone: chosenPhone,
          amountGhs: ticket?.priceGhs || 100,
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else if (data?.otpRequired) {
        setOtpRequired(true);
        setCheckoutError(data.message || "Please enter the verification code sent to your phone via SMS.");
      } else {
        setCheckoutError(data?.error || data?.message || "Invalid verification code. Please check your SMS and try again.");
      }
    } catch {
      setCheckoutError("Network error. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function resendOtp() {
    const targetReg = pendingReg || (success?.id && success?.reference ? { id: success.id, reference: success.reference } : null);
    if (!targetReg) return;
    const targetPhone = paymentPhone.trim();
    const cleanDigits = targetPhone.replace(/\D/g, "");
    if (cleanDigits.length < 9) {
      setCheckoutError("Please enter a valid Mobile Money number.");
      return;
    }

    setBusy(true);
    setCheckoutError("");
    try {
      const res = await fetch("/api/payment/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: targetReg.id,
          reference: targetReg.reference,
          phone: targetPhone,
          channel: paymentChannel,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        otpRequired?: boolean;
        txRef?: string;
        message?: string;
        error?: string;
      } | null;
      if (data?.txRef) {
        setCheckoutTxRef(data.txRef);
      }
      if (res.ok || data?.otpRequired) {
        setOtpCode("");
        setCheckoutError(data?.message || `A new verification code has been sent to ${targetPhone} via SMS.`);
      } else {
        setCheckoutError(data?.error || "Could not resend code. Please try again.");
      }
    } catch {
      setCheckoutError("Network error. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  function startNewRegistration() {
    try {
      localStorage.removeItem("tacc_reg_success_v1");
      localStorage.removeItem("tacc_reg_draft_v1");
    } catch { }
    setSuccess(null);
    setPendingReg(null);
    setPhase("room");
    setBeat(0);
    setTicketId("");
    setName("");
    setEmail("");
    setPhone("");
    setAgeGroup("");
    setIndustry("");
    setIndustryOther("");
    setResidence("");
    setMember("");
    setPfcc("");
    setHeard("");
    setLabs([]);
    setOtherNames([]);
    setPaymentPhone("");
    setOtpCode("");
    setOtpRequired(false);
    setCardOtpCode("");
    setCardOtpRequired(false);
    setCardTxRef("");
    setCheckoutTxRef("");
    setCheckoutOpen(false);
    setError("");
    setCheckoutError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleInviteBack() {
    setSuccess(null);
    setPhase("room");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleRegisterNew() {
    try {
      localStorage.removeItem("tacc_reg_success_v1");
      localStorage.removeItem("tacc_reg_draft_v1");
    } catch { }
    setSuccess(null);
    setName("");
    setEmail("");
    setPhone("");
    setAgeGroup("");
    setIndustry("");
    setIndustryOther("");
    setResidence("");
    setMember("");
    setPfcc("");
    setHeard("");
    setLabs([]);
    setOtherNames([]);
    setTicketId("one");
    setPendingReg(null);
    setCheckoutTxRef("");
    setPaymentPhone("");
    setCardPhone("");
    setCardOtpRequired(false);
    setCardOtpCode("");
    setPromptNotice(null);
    setError("");
    setCheckoutError("");
    setPhase("seat");
    setBeat(0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleLookup() {
    const q = lookupQuery.trim();
    if (!q) {
      setLookupError("Please enter your reference code.");
      return;
    }
    setLookupBusy(true);
    setLookupError("");
    try {
      const res = await fetch(`/api/register/lookup?q=${encodeURIComponent(q)}`);
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.found || !data?.registration) {
        setLookupError(data?.error || "No reservation was found with that reference code.");
        return;
      }
      const reg = data.registration;
      setLookupOpen(false);
      setPrevPhase("seat");

      // Fully populate registration form fields
      setName(reg.name || "");
      setEmail(reg.email || "");
      setPhone(reg.phone || "");
      setAgeGroup(reg.ageGroup || "");
      if (reg.industry) {
        if (reg.industry.startsWith("Other: ")) {
          setIndustry("Other");
          setIndustryOther(reg.industry.slice(7));
        } else {
          setIndustry(reg.industry);
          setIndustryOther("");
        }
      } else {
        setIndustry("");
        setIndustryOther("");
      }
      setResidence(reg.residence || "");
      setMember(reg.taccMember || "");
      setPfcc(reg.pfcc || "");
      setHeard(reg.heard || "");
      setLabs(Array.isArray(reg.growthLab) ? reg.growthLab : []);
      setTicketId(reg.ticketId || "one");
      setOtherNames(Array.isArray(reg.otherNames) ? reg.otherNames : []);

      const phoneNum = reg.phone || "";
      setCardPhone(phoneNum);
      setPaymentPhone(phoneNum);
      const detected = detectMoolreCollectionChannel(phoneNum);
      setCardChannel(detected);
      setPaymentChannel(detected);

      setPendingReg({ id: reg.id, reference: reg.reference });
      setCardOtpCode("");
      setCardOtpRequired(false);
      setCardTxRef("");
      setCheckoutTxRef("");
      setPromptNotice(null);

      const successObj: Success = {
        reference: reg.reference,
        id: reg.id,
        paymentStatus: reg.paymentStatus || "pending",
        payerPhone: phoneNum,
        amountGhs: reg.priceGhs,
      };
      setSuccess(successObj);

      try {
        localStorage.setItem("tacc_reg_success_v1", JSON.stringify({ ...successObj, name: reg.name }));
        localStorage.setItem(
          "tacc_reg_draft_v1",
          JSON.stringify({
            phase: "seat",
            beat: 0,
            ticketId: reg.ticketId || "one",
            name: reg.name || "",
            email: reg.email || "",
            phone: reg.phone || "",
            ageGroup: reg.ageGroup || "",
            industry: reg.industry || "",
            industryOther: reg.industry?.startsWith("Other: ") ? reg.industry.slice(7) : "",
            residence: reg.residence || "",
            member: reg.taccMember || "",
            pfcc: reg.pfcc || "",
            heard: reg.heard || "",
            labs: reg.growthLab || [],
            otherNames: reg.otherNames || [],
            pendingReg: { id: reg.id, reference: reg.reference },
            paymentPhone: phoneNum,
          })
        );
      } catch { }

      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setLookupError("Network error. Please check your connection and try again.");
    } finally {
      setLookupBusy(false);
    }
  }

  return (
    <main className={`visit${phase === "room" && !success ? " is-room" : ""}`}>
      {success ? (
        <section className="invite">
          <div className="invite-topbar">
            <button
              type="button"
              className="invite-nav-link"
              onClick={handleInviteBack}
            >
              ← Event Details
            </button>
            <button
              type="button"
              className="invite-nav-link"
              onClick={handleRegisterNew}
            >
              + Register New
            </button>
          </div>
          <div className="pass-card">
            <div className="pass-card-image-col">
              <img
                src="/images/pass-portrait.png?v=2"
                alt="TACC Ladies Conference — The next her."
                className="pass-card-image"
              />
              <div className="pass-card-image-overlay">
                <span className="pass-image-badge">{EVENT.headline}</span>
                <p className="pass-image-tagline">{EVENT.tagline}</p>
              </div>
            </div>

            <div className="pass-card-content-col">
              <div className="pass-header">
                <p className="pass-kicker">{EVENT.name}</p>
                <div className="pass-lockup">
                  <span className="next">The next</span>
                  <span className="script">her.</span>
                </div>
              </div>

              <div className="pass-divider" />

              <div className="pass-guest-block">
                <p className="pass-label">CONFIRMED ATTENDEE</p>
                <h1 className="guest">{name.trim()}</h1>
                <p className="when">
                  {EVENT.when}, {EVENT.time}
                </p>
                <p className="meta">
                  {ticket ? ticket.name : "Seat"}
                  {otherNames.some((item) => item.trim()) ? ` · ${otherNames.filter((item) => item.trim()).join(" · ")}` : ""}
                </p>
              </div>

              <div className="pass-divider" />

              <div className="pass-tier-section">
                <p className="pass-label">SEAT PASS TIER</p>
                <div className="pass-tier-row">
                  <p className="pass-tier-name">{ticket?.name || "One seat"} · GHS {success.amountGhs || ticket?.priceGhs || 100}</p>
                  <span className={`pass-status-badge${success.paymentStatus === "paid" ? " paid" : " pending"}`}>
                    {success.paymentStatus === "paid" ? "Confirmed" : "Reserved · Pending Payment"}
                  </span>
                </div>
              </div>

              <div className="pass-divider" />

              <div className="pass-ref-section">
                <p className="pass-label">REFERENCE CODE</p>
                <div
                  className="ref-box"
                  role="button"
                  tabIndex={0}
                  title="Click to copy reference code"
                  onClick={() => {
                    if (typeof navigator !== "undefined" && navigator.clipboard) {
                      navigator.clipboard.writeText(success.reference);
                      setCopiedRef(true);
                      setTimeout(() => setCopiedRef(false), 2000);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (typeof navigator !== "undefined" && navigator.clipboard) {
                        navigator.clipboard.writeText(success.reference);
                        setCopiedRef(true);
                        setTimeout(() => setCopiedRef(false), 2000);
                      }
                    }
                  }}
                >
                  <p className="ref">{success.reference}</p>
                  <button
                    type="button"
                    className={`copy-ref-btn${copiedRef ? " is-copied" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (typeof navigator !== "undefined" && navigator.clipboard) {
                        navigator.clipboard.writeText(success.reference);
                        setCopiedRef(true);
                        setTimeout(() => setCopiedRef(false), 2000);
                      }
                    }}
                    aria-label="Copy reference code"
                  >
                    {copiedRef ? "Copied" : "Copy"}
                  </button>
                </div>
                {success.paymentStatus !== "paid" ? (
                  <div className="ref-reminder">
                    Save this reference code to retrieve your pass anytime or complete payment.
                  </div>
                ) : null}
              </div>

              <div className="pass-divider" />

              {success.paymentStatus === "paid" ? (
                <div className="pass-paid-block">
                  <div className="pill" style={{ background: "#e7f4ea", color: "#21633a", border: "1px solid #b7e1cd" }}>Payment confirmed</div>
                  <p className="held" style={{ color: "var(--plum)" }}>Your seat is fully secured! We look forward to welcoming you.</p>
                </div>
              ) : success.moolrePrompt ? (
                <div className="pass-actions-block">
                  <div className="invite-payment-header">
                    <span className="invite-payment-kicker">PASS PAYMENT</span>
                    <h3 className="invite-payment-title">Complete Your Reservation</h3>
                    <p className="invite-payment-desc">
                      {success.promptMessage && !success.promptMessage.toLowerCase().includes("moolre")
                        ? success.promptMessage
                        : "Your seat reservation is held. Complete payment below via Mobile Money to secure your pass."}
                    </p>
                  </div>

                  <div className="invite-payment-actions">
                    {success.paymentUrl ? (
                      <a
                        className="invite-pay-btn"
                        href={success.paymentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <span>Pay GHS {success.amountGhs || ticket?.priceGhs || 100} with MoMo</span>
                        <svg className="invite-pay-btn-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="5" y1="12" x2="19" y2="12" />
                          <polyline points="12 5 19 12 12 19" />
                        </svg>
                      </a>
                    ) : null}
                    <button
                      type="button"
                      className="invite-check-btn"
                      disabled={checkingPayment}
                      onClick={async () => {
                        if (!success.id && !success.reference) return;
                        setCheckingPayment(true);
                        try {
                          const query = success.id
                            ? `id=${encodeURIComponent(success.id)}&ref=${encodeURIComponent(success.reference)}`
                            : `ref=${encodeURIComponent(success.reference)}`;
                          const res = await fetch(`/api/payment/check?${query}`);
                          const check = await res.json().catch(() => null);
                          if (check?.paid) {
                            setSuccess((prev) => (prev ? { ...prev, paymentStatus: "paid" } : null));
                          } else {
                            alert("Payment is still pending. If you just approved on your phone, wait a moment and try again.");
                          }
                        } finally {
                          setCheckingPayment(false);
                        }
                      }}
                    >
                      {checkingPayment ? (
                        <>
                          <span className="invite-spinner" />
                          <span>Checking status...</span>
                        </>
                      ) : (
                        <span>Check payment status</span>
                      )}
                    </button>
                  </div>

                  <div className="invite-secondary-actions">
                    <button
                      type="button"
                      className="invite-text-btn"
                      onClick={() => setSuccess((prev) => (prev ? { ...prev, moolrePrompt: false } : null))}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M23 4v6h-6" />
                        <path d="M1 20v-6h6" />
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                      </svg>
                      <span>New payment link</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="pass-momo-block">
                  <div className="pill">Payment pending</div>
                  <p className="held">Your seat is reserved. Complete payment below with Mobile Money to secure your seat.</p>

                  {success.paymentError ? (
                    <div className="alert show" style={{ marginTop: 8 }}>
                      Note: {success.paymentError}
                    </div>
                  ) : null}

                  {/* Instant Payment Trigger Panel for Reserved Reference */}
                  <div className="momo-action-card" style={{ marginTop: 14 }}>
                    <p className="title">Pay with Mobile Money (MoMo)</p>
                    <p className="desc">
                      {cardOtpRequired
                        ? `Step 2 of 2: Enter the 6-digit verification code sent to ${cardPhone} via SMS.`
                        : "Enter your Mobile Money number to proceed with payment."}
                    </p>

                    <div className="field">
                      Network
                      <div className="checkout-network-grid" style={{ marginTop: 6 }}>
                        <button
                          type="button"
                          className={`checkout-network-btn${cardChannel === "13" ? " on" : ""}`}
                          onClick={() => setCardChannel("13")}
                        >
                          MTN MoMo
                        </button>
                        <button
                          type="button"
                          className={`checkout-network-btn${cardChannel === "6" ? " on" : ""}`}
                          onClick={() => setCardChannel("6")}
                        >
                          Telecel Cash
                        </button>
                        <button
                          type="button"
                          className={`checkout-network-btn${cardChannel === "7" ? " on" : ""}`}
                          onClick={() => setCardChannel("7")}
                        >
                          AT Money
                        </button>
                      </div>
                    </div>

                    <label className="field" style={{ marginTop: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span>Mobile Money Number</span>
                        {cardOtpRequired ? (
                          <button
                            type="button"
                            className="back"
                            style={{ fontSize: "11px", textDecoration: "underline", padding: 0 }}
                            onClick={() => {
                              setCardOtpRequired(false);
                              setCardOtpCode("");
                              setPromptNotice(null);
                            }}
                          >
                            Change number
                          </button>
                        ) : null}
                      </div>
                      <input
                        type="tel"
                        value={cardPhone}
                        disabled={cardOtpRequired || promptingPayment}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCardPhone(val);
                          setCardChannel(detectMoolreCollectionChannel(val));
                        }}
                        placeholder="024 000 0000"
                      />
                    </label>

                    {cardOtpRequired ? (
                      <label className="field" style={{ marginTop: 14 }}>
                        Verification Code (SMS OTP)
                        <input
                          type="text"
                          value={cardOtpCode}
                          onChange={(e) => setCardOtpCode(e.target.value)}
                          placeholder="Enter 6-digit code"
                          autoComplete="one-time-code"
                          autoFocus
                        />
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                          <span className="field-hint">
                            Enter the 6-digit code sent to your phone via SMS.
                          </span>
                          <button
                            type="button"
                            className="back"
                            style={{ fontSize: "11px", textDecoration: "underline", padding: 0 }}
                            disabled={promptingPayment}
                            onClick={async () => {
                              const targetPhone = cardPhone.trim();
                              if (targetPhone.replace(/\D/g, "").length < 9) {
                                setPromptNotice("Please enter a valid Mobile Money number.");
                                return;
                              }
                              setPromptingPayment(true);
                              setPromptNotice(null);
                              try {
                                const res = await fetch("/api/payment/prompt", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    id: success.id,
                                    reference: success.reference,
                                    phone: targetPhone,
                                    channel: cardChannel,
                                  }),
                                });
                                const resData = await res.json().catch(() => null);
                                if (resData?.txRef) {
                                  setCardTxRef(resData.txRef);
                                }
                                if (res.ok || resData?.otpRequired) {
                                  setCardOtpCode("");
                                  setPromptNotice(resData?.message || `A new verification code has been sent to ${targetPhone} via SMS.`);
                                } else {
                                  setPromptNotice(resData?.error || "Could not resend code. Please try again.");
                                }
                              } catch {
                                setPromptNotice("Network error. Please try again.");
                              } finally {
                                setPromptingPayment(false);
                              }
                            }}
                          >
                            Resend SMS code
                          </button>
                        </div>
                      </label>
                    ) : null}

                    {promptNotice ? (
                      <div className="alert show" style={{ marginTop: 10 }}>
                        {promptNotice}
                      </div>
                    ) : null}

                    <button
                      type="button"
                      className="invite-pay-btn"
                      style={{ marginTop: 20 }}
                      disabled={promptingPayment}
                      onClick={async () => {
                        const targetPhone = cardPhone.trim();
                        if (targetPhone.replace(/\D/g, "").length < 9) {
                          setPromptNotice("Please enter a valid Mobile Money number.");
                          return;
                        }
                        if (cardOtpRequired) {
                          const code = cardOtpCode.trim();
                          if (!code) {
                            setPromptNotice("Please enter the verification code sent to your phone via SMS.");
                            return;
                          }
                        }
                        setPromptingPayment(true);
                        setPromptNotice(null);
                        try {
                          const res = await fetch("/api/payment/prompt", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              id: success.id,
                              reference: success.reference,
                              phone: targetPhone,
                              channel: cardChannel,
                              txRef: cardTxRef || undefined,
                              otpCode: cardOtpRequired ? cardOtpCode.trim() : undefined,
                            }),
                          });
                          const resData = await res.json().catch(() => null);
                          if (resData?.txRef) {
                            setCardTxRef(resData.txRef);
                          }
                          if (res.ok && resData?.promptSent) {
                            setSuccess((prev) =>
                              prev
                                ? {
                                  ...prev,
                                  moolrePrompt: true,
                                  paymentUrl: resData.paymentUrl,
                                  promptMessage: resData.message,
                                }
                                : null
                            );
                            if (resData.paymentUrl) window.open(resData.paymentUrl, "_blank", "noopener");
                          } else if (resData?.otpRequired) {
                            setCardOtpRequired(true);
                            setPromptNotice(resData.message || `A verification code was sent to ${targetPhone} via SMS. Please enter it below.`);
                          } else {
                            setPromptNotice(resData?.error || "Payment prompt could not be dispatched. Please verify your number.");
                          }
                        } catch {
                          setPromptNotice("Network error. Please check your connection and try again.");
                        } finally {
                          setPromptingPayment(false);
                        }
                      }}
                    >
                      {promptingPayment ? (
                        <>
                          <span className="invite-spinner" style={{ borderTopColor: "#fff", borderColor: "rgba(255,255,255,0.3)" }} />
                          <span>{cardOtpRequired ? "Verifying..." : "Dispatching prompt..."}</span>
                        </>
                      ) : (
                        <>
                          <span>
                            {cardOtpRequired
                              ? "Verify Code & Authorize"
                              : `Pay GHS ${success.amountGhs || ticket?.priceGhs || 100} with MoMo`}
                          </span>
                          <svg className="invite-pay-btn-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="5" y1="12" x2="19" y2="12" />
                            <polyline points="12 5 19 12 12 19" />
                          </svg>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              <div className="pass-contact-box">
                <p className="pass-contact-text">
                  All questions can be sent to{" "}
                  <a href="mailto:taccladiesconference@gmail.com" className="pass-contact-email">
                    taccladiesconference@gmail.com
                  </a>
                </p>
              </div>

              <p className="whisper" style={{ marginTop: 22, textAlign: "left" }}>
                Invest in her. Inspire her. Empower her legacy.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {!success && phase === "room" ? (
        <section className="room">
          <div className="room-hero-card">
            <div className="room-hero-image-col">
              <img
                src="/images/landing-hero.png?v=2"
                alt="TACC Ladies Conference — The next her."
                className="room-hero-image"
              />
              <div className="room-hero-image-overlay">
                <span className="room-image-badge">{EVENT.headline}</span>
                <p className="room-image-tagline">{EVENT.tagline}</p>
                <p className="room-image-sub">Accra, Ghana · 2026</p>
              </div>
            </div>

            <div className="room-hero-content-col">
              <Sprig />

              <div className="room-header">
                <p className="room-kicker">{EVENT.name}</p>
                <h1 className="room-lockup">
                  <span className="next">The next</span>
                  <span className="script">her.</span>
                </h1>
                <p className="room-when">
                  {EVENT.when} · {EVENT.time} · Accra
                </p>
              </div>

              <div className="room-divider" />

              <div className="room-manifesto">
                <p className="room-manifesto-lead">
                  &ldquo;{LINES[0]} {LINES[2]}&rdquo;
                </p>
                <p className="room-manifesto-sub">
                  {LINES[4]}
                </p>
              </div>

              <div className="room-divider" />

              <div className="room-cta-block">
                <button
                  className="room-cta-btn"
                  type="button"
                  onClick={() => go("beat", 0)}
                >
                  Claim Your Seat →
                </button>
                <button
                  type="button"
                  className="room-lookup-link"
                  onClick={() => {
                    setLookupOpen(true);
                    setLookupError("");
                    setLookupQuery("");
                  }}
                >
                  Already registered? Retrieve your reservation →
                </button>
              </div>

              <p className="room-whisper">
                Invest in her. Inspire her. Empower her legacy.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {!success && phase === "beat" ? (
        <section className="beat">
          <div className="beat-card">
            <Sprig />

            <p className="beat-poetic-quote">&ldquo;{current.line}&rdquo;</p>
            <h1 className="beat-question-title">
              {BEAT_QUESTIONS[current.id].title}
            </h1>
            {BEAT_QUESTIONS[current.id].subtitle ? (
              <p className="beat-question-sub">
                {BEAT_QUESTIONS[current.id].subtitle}
              </p>
            ) : null}

            <form
              className="answer"
              onSubmit={(event) => {
                event.preventDefault();
                continueBeat();
              }}
            >
              {current.id === "name" ? (
                <label className="beat-field">
                  <span className="beat-field-label">Full Name</span>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    autoComplete="name"
                    type="text"
                    placeholder="Your full name"
                    className="beat-input"
                    autoFocus
                  />
                </label>
              ) : null}
              {current.id === "email" ? (
                <label className="beat-field">
                  <span className="beat-field-label">Email Address</span>
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    type="email"
                    placeholder="your.email@example.com"
                    inputMode="email"
                    className="beat-input"
                    autoFocus
                  />
                </label>
              ) : null}
              {current.id === "phone" ? (
                <label className="beat-field">
                  <span className="beat-field-label">Phone Number</span>
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    autoComplete="tel"
                    type="tel"
                    placeholder="024 000 0000"
                    inputMode="tel"
                    className="beat-input"
                    autoFocus
                  />
                </label>
              ) : null}
              {current.id === "age" ? (
                <div className="beat-field">
                  <span className="beat-field-label">Select Age Group</span>
                  <div className="chips stretch">
                    {AGE_GROUPS.map((group) => (
                      <button
                        key={group}
                        type="button"
                        className={`chip${ageGroup === group ? " on" : ""}`}
                        onClick={() => setAgeGroup(group)}
                      >
                        {group}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {current.id === "industry" ? (
                <>
                  <div className="beat-field">
                    <span className="beat-field-label">Select Industry</span>
                    <div className="chips">
                      {INDUSTRIES.map((item) => (
                        <button
                          key={item}
                          type="button"
                          className={`chip${industry === item ? " on" : ""}`}
                          onClick={() => {
                            setIndustry(item);
                            if (item !== "Other") {
                              setError("");
                            }
                          }}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                  {industry === "Other" ? (
                    <label className="beat-field" style={{ marginTop: 18 }}>
                      <span className="beat-field-label">Specify Your Industry</span>
                      <input
                        value={industryOther}
                        onChange={(event) => {
                          setIndustryOther(event.target.value);
                          if (error) setError("");
                        }}
                        type="text"
                        placeholder="e.g. Agriculture, Real Estate, Aviation"
                        className="beat-input"
                        autoFocus
                      />
                    </label>
                  ) : null}
                </>
              ) : null}
              {current.id === "member" ? (
                <>
                  <div className="beat-field">
                    <span className="beat-field-label">Member of TACC</span>
                    <div className="chips pair">
                      {(["Yes", "No"] as const).map((value) => (
                        <button
                          key={value}
                          type="button"
                          className={`chip${member === value ? " on" : ""}`}
                          onClick={() => setMember(value)}
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  </div>
                  {member === "Yes" ? (
                    <label className="beat-field" style={{ marginTop: 18 }}>
                      <span className="beat-field-label">Which PFCC Chapter?</span>
                      <input
                        value={pfcc}
                        onChange={(event) => setPfcc(event.target.value)}
                        type="text"
                        placeholder="Your PFCC chapter or fellowship"
                        className="beat-input"
                        autoFocus
                      />
                    </label>
                  ) : null}
                </>
              ) : null}
              {current.id === "heard" ? (
                <div className="beat-field">
                  <span className="beat-field-label">How Did You Hear About Us?</span>
                  <div className="chips stretch">
                    {HEARD_OPTIONS.map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={`chip${heard === value ? " on" : ""}`}
                        onClick={() => setHeard(value)}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {current.id === "live" ? (
                <label className="beat-field">
                  <div className="beat-field-label-row">
                    <span className="beat-field-label">Where You Reside</span>
                    <span className="beat-field-opt">Optional</span>
                  </div>
                  <input
                    value={residence}
                    onChange={(event) => setResidence(event.target.value)}
                    type="text"
                    placeholder="City or residential area"
                    className="beat-input"
                    autoFocus
                  />
                </label>
              ) : null}
              {current.id === "lab" ? (
                <div className="beat-field">
                  <div className="beat-field-label-row">
                    <span className="beat-field-label">Growth Lab Selection</span>
                    <span className="beat-field-opt">Optional · Select all that apply</span>
                  </div>
                  <div className="chips">
                    {GROWTH_LAB.map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={`chip${labs.includes(value) ? " on" : ""}`}
                        onClick={() => toggleLab(value)}
                      >
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
                <button className="beat-back-btn" type="button" onClick={back}>
                  ← Back
                </button>
                <button className="beat-continue-btn" type="submit">
                  Continue →
                </button>
              </div>
            </form>
          </div>
        </section>
      ) : null}

      {!success && phase === "seat" ? (
        <section className="seat">
          <div className="seat-card">
            <Sprig />

            <p className="beat-poetic-quote">&ldquo;{LINES[4]}&rdquo;</p>
            <h1 className="beat-question-title">Select your conference pass</h1>
            <p className="beat-question-sub">
              Choose an individual seat or bring women from your circle
            </p>

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
                  <label className="beat-field" key={index}>
                    <span className="beat-field-label">Her Full Name</span>
                    <input
                      type="text"
                      placeholder="Her full name"
                      className="beat-input"
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
            <div className="beat-nav">
              <button className="beat-back-btn" type="button" onClick={back}>
                ← Back
              </button>
              <button
                className="beat-continue-btn"
                type="button"
                onClick={handleProceedToPayment}
              >
                Proceed to Payment →
              </button>
            </div>
            <p className="fine" style={{ marginTop: 22, textAlign: "center" }}>
              Payment details are processed securely. All questions can be sent to{" "}
              <a href="mailto:taccladiesconference@gmail.com" style={{ color: "var(--plum)", textDecoration: "underline" }}>
                taccladiesconference@gmail.com
              </a>
            </p>
          </div>

          {/* Checkout Modal Overlay */}
          {checkoutOpen && ticket ? (
            <div
              className="checkout-overlay"
              role="dialog"
              aria-modal="true"
              aria-labelledby="checkout-title"
              onClick={() => !busy && setCheckoutOpen(false)}
            >
              <div className="checkout-dialog" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="checkout-close"
                  aria-label="Close checkout"
                  disabled={busy}
                  onClick={() => setCheckoutOpen(false)}
                >
                  ×
                </button>
                <p className="checkout-kicker">Checkout</p>
                <h2 id="checkout-title" className="checkout-title">
                  Complete Reservation
                </h2>

                <div className="checkout-summary">
                  <span className="item-name">
                    {ticket.name} ({ticket.seats} {ticket.seats > 1 ? "seats" : "seat"})
                  </span>
                  <span className="item-price">GHS {ticket.priceGhs}</span>
                </div>

                <div className="checkout-methods" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={payMethod === "momo"}
                    className={`checkout-method-tab${payMethod === "momo" ? " active" : ""}`}
                    onClick={() => {
                      setPayMethod("momo");
                      setCheckoutError("");
                    }}
                  >
                    Mobile Money
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={payMethod === "later"}
                    className={`checkout-method-tab${payMethod === "later" ? " active" : ""}`}
                    onClick={() => {
                      setPayMethod("later");
                      setCheckoutError("");
                    }}
                  >
                    Pay Later
                  </button>
                </div>

                <div className="checkout-body">
                  {payMethod === "momo" ? (
                    <>
                      <div className="checkout-field">
                        <span className="checkout-field-label">Mobile Network</span>
                        <div className="checkout-network-grid">
                          <button
                            type="button"
                            className={`checkout-network-btn${paymentChannel === "13" ? " on" : ""}`}
                            onClick={() => setPaymentChannel("13")}
                          >
                            MTN MoMo
                          </button>
                          <button
                            type="button"
                            className={`checkout-network-btn${paymentChannel === "6" ? " on" : ""}`}
                            onClick={() => setPaymentChannel("6")}
                          >
                            Telecel Cash
                          </button>
                          <button
                            type="button"
                            className={`checkout-network-btn${paymentChannel === "7" ? " on" : ""}`}
                            onClick={() => setPaymentChannel("7")}
                          >
                            AT Money
                          </button>
                        </div>
                      </div>

                      <div className="checkout-field" style={{ marginTop: 16 }}>
                        <span className="checkout-field-label">Mobile Money Number</span>
                        <input
                          type="tel"
                          className="checkout-input"
                          value={paymentPhone}
                          onChange={(e) => handlePaymentPhoneChange(e.target.value)}
                          placeholder="024 000 0000"
                          autoComplete="tel"
                          autoFocus
                        />
                        <p className="checkout-field-hint">
                          Enter the phone number to be debited for this payment.
                        </p>
                      </div>

                      {otpRequired ? (
                        <div className="checkout-field" style={{ marginTop: 16 }}>
                          <span className="checkout-field-label">Verification Code (SMS OTP)</span>
                          <input
                            type="text"
                            className="checkout-input"
                            value={otpCode}
                            onChange={(e) => setOtpCode(e.target.value)}
                            placeholder="Enter SMS code"
                            autoComplete="one-time-code"
                            autoFocus
                          />
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, flexWrap: "wrap", gap: 6 }}>
                            <p className="checkout-field-hint" style={{ margin: 0 }}>
                              Enter the verification code sent to your phone via SMS.
                            </p>
                            <button
                              type="button"
                              className="checkout-resend-link"
                              disabled={busy}
                              onClick={resendOtp}
                            >
                              Resend SMS code
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="pay-later-box">
                      <p className="pay-later-note">
                        Your seat will be reserved immediately and a unique <strong>Reference Code</strong> will be generated for you.
                      </p>
                      <div className="pay-later-notice">
                        <strong>Important:</strong> Please make sure to note down or copy your Reference Code once generated. You will need this code to retrieve your reservation and pay later.
                      </div>
                    </div>
                  )}
                </div>

                {checkoutError ? (
                  <div className="alert show" style={{ marginTop: 14 }} role="alert">
                    {checkoutError}
                  </div>
                ) : null}

                <div className="checkout-actions">
                  <button
                    type="button"
                    className="checkout-pay-btn"
                    disabled={busy}
                    aria-busy={busy}
                    onClick={() => {
                      if (payMethod === "momo" && otpRequired) {
                        submitOtpVerification();
                      } else {
                        submit(payMethod === "momo");
                      }
                    }}
                  >
                    {busy
                      ? (otpRequired ? "Verifying..." : "Processing...")
                      : payMethod === "momo"
                        ? (otpRequired ? `Verify & Pay GHS ${ticket.priceGhs}` : `Pay GHS ${ticket.priceGhs} with MoMo`)
                        : "Reserve seat & pay later"}
                  </button>
                  <button
                    type="button"
                    className="checkout-back-btn"
                    disabled={busy}
                    onClick={() => {
                      if (otpRequired) {
                        setOtpRequired(false);
                        setOtpCode("");
                        setCheckoutError("");
                      } else {
                        setCheckoutOpen(false);
                      }
                    }}
                  >
                    {otpRequired ? "← Back to payment details" : "← Back to seat passes"}
                  </button>
                  <button
                    type="button"
                    className="checkout-home-link"
                    onClick={() => {
                      setCheckoutOpen(false);
                      setPhase("room");
                      window.history.pushState(null, "", "/");
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    Home
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Reservation Lookup Modal */}
      {lookupOpen ? (
        <div
          className="checkout-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lookup-title"
          onClick={() => !lookupBusy && setLookupOpen(false)}
        >
          <div className="checkout-dialog" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="checkout-close"
              aria-label="Close"
              disabled={lookupBusy}
              onClick={() => setLookupOpen(false)}
            >
              ×
            </button>
            <p className="checkout-kicker">Find Reservation</p>
            <h2 id="lookup-title" className="checkout-title">
              Retrieve Pass
            </h2>
            <p className="field-hint" style={{ marginTop: 8, fontSize: "14px", lineHeight: "1.5" }}>
              Enter the unique <strong>Reference Code</strong> you received when reserving your seat (e.g. <strong>PS-17OCT-XXXXX</strong>).
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleLookup();
              }}
              style={{ marginTop: 18 }}
            >
              <label className="field">
                Reference Code
                <input
                  type="text"
                  value={lookupQuery}
                  onChange={(e) => setLookupQuery(e.target.value)}
                  placeholder="e.g. PS-17OCT-XXXXX"
                  autoFocus
                />
              </label>

              {lookupError ? (
                <div className="alert show" style={{ marginTop: 12 }} role="alert">
                  {lookupError}
                </div>
              ) : null}

              <div className="checkout-actions" style={{ marginTop: 20 }}>
                <button
                  type="submit"
                  className="go wide"
                  disabled={lookupBusy}
                  aria-busy={lookupBusy}
                >
                  {lookupBusy ? "Searching..." : "Retrieve reservation"}
                </button>
                <button
                  type="button"
                  className="back"
                  disabled={lookupBusy}
                  style={{ textAlign: "center", width: "100%" }}
                  onClick={() => setLookupOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
