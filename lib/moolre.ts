export * from "./moolre-channel";
import { detectMoolreCollectionChannel, type MoolreCollectionChannel } from "./moolre-channel";

function extractJwtInfo(jwt?: string): { userId?: string; walletId?: string } {
  if (!jwt) return {};
  try {
    const parts = jwt.split(".");
    if (parts.length >= 2) {
      const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"));
      return {
        userId: payload.userid != null ? String(payload.userid) : undefined,
        walletId: payload.walletid != null ? String(payload.walletid) : undefined,
      };
    }
  } catch {
    return {};
  }
  return {};
}

function getEnv(key: string): string {
  return process.env[key]?.trim() || "";
}

export function isMoolreConfigured(): boolean {
  const jwt = getEnv("MOOLRE_PUBLIC_KEY") || getEnv("MOOLRE_API_KEY") || process.env.MOOLRE_PUBLIC_KEY || process.env.MOOLRE_API_KEY;
  const jwtInfo = extractJwtInfo(jwt);
  const hasUser = Boolean(getEnv("MOOLRE_API_USER") || process.env.MOOLRE_API_USER || jwtInfo.userId);
  const hasKey = Boolean(getEnv("MOOLRE_API_KEY") || getEnv("MOOLRE_PUBLIC_KEY") || process.env.MOOLRE_API_KEY || process.env.MOOLRE_PUBLIC_KEY);
  const hasAccount = Boolean(getEnv("MOOLRE_ACCOUNT_NUMBER") || process.env.MOOLRE_ACCOUNT_NUMBER || jwtInfo.walletId);
  return hasUser && hasKey && hasAccount;
}

function getMoolreConfig() {
  const baseUrl = (getEnv("MOOLRE_BASE_URL") || process.env.MOOLRE_BASE_URL || "https://api.moolre.com").replace(/\/+$/, "");
  const apiKey = getEnv("MOOLRE_API_KEY") || process.env.MOOLRE_API_KEY || "";
  const pubKey = getEnv("MOOLRE_PUBLIC_KEY") || process.env.MOOLRE_PUBLIC_KEY || apiKey;
  const jwtInfo = extractJwtInfo(pubKey);

  const apiUser = getEnv("MOOLRE_API_USER") || process.env.MOOLRE_API_USER || jwtInfo.userId || "";
  const accountNumber = getEnv("MOOLRE_ACCOUNT_NUMBER") || process.env.MOOLRE_ACCOUNT_NUMBER || jwtInfo.walletId || "";

  return { baseUrl, apiUser, apiKey, pubKey, accountNumber };
}

export type RequestPaymentResult = {
  ok: boolean;
  promptSent: boolean;
  otpRequired?: boolean;
  message?: string;
  transactionId?: string;
  error?: string;
};

/**
 * Sends a USSD mobile money payment prompt to the attendee's phone.
 */
export async function requestMoolrePayment(params: {
  payerPhone: string;
  amountGhs: number;
  externalRef: string;
  channel?: MoolreCollectionChannel;
  otpCode?: string;
}): Promise<RequestPaymentResult> {
  const { baseUrl, apiUser, apiKey, pubKey, accountNumber } = getMoolreConfig();

  if (!apiUser || !pubKey || !accountNumber) {
    return {
      ok: false,
      promptSent: false,
      error: "Moolre credentials are not configured.",
    };
  }

  let cleanPhone = params.payerPhone.replace(/\D/g, "");
  if (cleanPhone.startsWith("233") && cleanPhone.length === 12) {
    cleanPhone = "0" + cleanPhone.slice(3);
  }

  const channel = params.channel || detectMoolreCollectionChannel(cleanPhone);
  const url = `${baseUrl}/open/transact/payment`;

  const payload: Record<string, unknown> = {
    type: 1,
    channel,
    currency: "GHS",
    payer: cleanPhone,
    amount: params.amountGhs.toFixed(2),
    externalref: params.externalRef,
    accountnumber: accountNumber,
  };

  if (params.otpCode && params.otpCode.trim()) {
    payload.otpcode = params.otpCode.trim();
  }

  try {
    const headers: Record<string, string> = {
      "X-API-USER": apiUser,
      "Content-Type": "application/json",
    };
    if (apiKey) headers["X-API-KEY"] = apiKey;
    if (pubKey) headers["X-API-PUBKEY"] = pubKey;

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const body = (await response.json().catch(() => null)) as {
      status?: number | string;
      code?: string;
      message?: string | null;
      data?: unknown;
    } | null;

    if (!response.ok || !body) {
      const errMsg = body?.message || "Moolre payment request was declined.";
      return {
        ok: false,
        promptSent: false,
        error: body?.code === "AIN01" ? "Authentication Error (AIN01): API access has not been activated on this Moolre account. Please contact Moolre support or enable API access in your dashboard." : errMsg,
      };
    }

    // If Moolre requires SMS verification code
    if (body.code === "TP14") {
      return {
        ok: false,
        promptSent: false,
        otpRequired: true,
        message: body.message || "Please enter the verification code sent to your phone via SMS.",
        error: body.message || "Please enter the verification code sent to your phone via SMS.",
      };
    }

    if (body.code === "TP15") {
      return {
        ok: false,
        promptSent: false,
        error: "Invalid SMS verification code. Please check the code and try again.",
      };
    }

    if (body.code === "TP13") {
      return {
        ok: false,
        promptSent: false,
        error: "This payment reference has already been processed.",
      };
    }

    // TP17: phone number verified via OTP. No prompt is sent yet, so request the payment again without the OTP.
    if (body.code === "TP17" && params.otpCode) {
      return requestMoolrePayment({ ...params, otpCode: undefined });
    }

    // Status 1 indicates prompt was dispatched to customer's phone
    if (String(body.status) === "1") {
      const txId = typeof body.data === "string" ? body.data : undefined;
      return {
        ok: true,
        promptSent: true,
        transactionId: txId,
        message: body.message || "Payment prompt sent to customer phone.",
      };
    }

    const errDetail = body.code === "AIN01"
      ? "Authentication Error (AIN01): API access has not been activated on this Moolre account. Please contact Moolre support or enable API access in your dashboard."
      : (body.message || "Could not initiate payment prompt.");

    return {
      ok: false,
      promptSent: false,
      error: errDetail,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error contacting Moolre.";
    return {
      ok: false,
      promptSent: false,
      error: message,
    };
  }
}


export type PaymentStatusResult = {
  ok: boolean;
  paid: boolean;
  transactionId?: string;
  amount?: string;
  message?: string;
  error?: string;
};

/**
 * Checks if a payment with a given reference has been successfully approved/paid.
 */
export async function checkMoolrePaymentStatus(externalRef: string): Promise<PaymentStatusResult> {
  const { baseUrl, apiUser, apiKey, pubKey, accountNumber } = getMoolreConfig();
  const keyToUse = apiKey || pubKey;

  if (!apiUser || !keyToUse || !accountNumber) {
    return {
      ok: false,
      paid: false,
      error: "Moolre is not configured.",
    };
  }

  const url = `${baseUrl}/open/transact/status`;

  const payload = {
    type: 1,
    idtype: 1, // 1 for externalref
    id: externalRef,
    accountnumber: accountNumber,
  };

  try {
    const headers: Record<string, string> = {
      "X-API-USER": apiUser,
      "Content-Type": "application/json",
    };
    if (apiKey) headers["X-API-KEY"] = apiKey;
    if (pubKey) headers["X-API-PUBKEY"] = pubKey;

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const body = (await response.json().catch(() => null)) as {
      status?: number | string;
      code?: string;
      message?: string;
      data?: {
        txstatus?: number;
        amount?: string;
        transactionid?: string;
      };
    } | null;

    if (!response.ok || !body) {
      return {
        ok: false,
        paid: false,
        error: body?.message || "Could not check payment status.",
      };
    }

    const txStatus = body.data?.txstatus;
    const isPaid = txStatus === 1;

    return {
      ok: true,
      paid: isPaid,
      transactionId: body.data?.transactionid,
      amount: body.data?.amount,
      message: body.message,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error checking payment status.";
    return {
      ok: false,
      paid: false,
      error: message,
    };
  }
}


export type PaymentLinkResult = {
  ok: boolean;
  url?: string;
  error?: string;
};

/**
 * Creates a Moolre hosted (POS) checkout link. The attendee pays on Moolre's page and
 * the result is confirmed afterwards with checkMoolrePaymentStatus(externalRef).
 */
export async function createMoolrePaymentLink(params: { amountGhs: number; externalRef: string; email?: string }): Promise<PaymentLinkResult> {
  const { baseUrl, apiUser, pubKey, accountNumber } = getMoolreConfig();

  if (!apiUser || !pubKey || !accountNumber) {
    return { ok: false, error: "Moolre credentials are not configured." };
  }

  try {
    const response = await fetch(`${baseUrl}/embed/link`, {
      method: "POST",
      headers: {
        "X-API-USER": apiUser,
        "X-API-PUBKEY": pubKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: 1,
        amount: params.amountGhs.toFixed(2),
        email: params.email?.trim() || getEnv("MOOLRE_BUSINESS_EMAIL") || "noreply@example.com",
        externalref: params.externalRef,
        reusable: "0",
        expiration_time: 1440,
        currency: "GHS",
        accountnumber: accountNumber,
      }),
    });

    const body = (await response.json().catch(() => null)) as {
      status?: number | string;
      code?: string;
      message?: string | null;
      data?: { authorization_url?: string } | null;
    } | null;

    const url = body?.data?.authorization_url;
    if (response.ok && String(body?.status) === "1" && url) {
      return { ok: true, url };
    }
    return { ok: false, error: body?.message || "Could not create the payment link." };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error contacting Moolre." };
  }
}
