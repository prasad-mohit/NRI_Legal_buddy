import { createHmac, timingSafeEqual } from "crypto";

import { logEvent } from "@/server/logger";

const DEFAULT_PLATFORM_FEE_PAISE = 50 * 100;
const DEFAULT_CURRENCY = "INR";
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RAZORPAY_API_BASE_URL = "https://api.razorpay.com";

const trimValue = (value: string | undefined) => (value ?? "").trim();

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const parseIntegerEnv = (value: string | undefined, fallback: number, min: number, max: number) => {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
};

export type RazorpayMode = "mock" | "live";

interface RazorpayConfigBase {
  mode: RazorpayMode;
  apiBaseUrl: string;
  amountPaise: number;
  currency: string;
  timeoutMs: number;
}

interface LiveRazorpayConfig extends RazorpayConfigBase {
  mode: "live";
  keyId: string;
  keySecret: string;
}

interface MockRazorpayConfig extends RazorpayConfigBase {
  mode: "mock";
}

type RazorpayConfig = LiveRazorpayConfig | MockRazorpayConfig;

interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
  status?: string;
  created_at?: number;
  [key: string]: unknown;
}

export interface PlatformFeeOrderResponse {
  mode: RazorpayMode;
  order: RazorpayOrder;
  keyId?: string;
}

export interface VerifyRazorpayPayload {
  orderId: string;
  paymentId: string;
  signature: string;
}

const getRazorpayConfig = (): RazorpayConfig => {
  const keyId = trimValue(process.env.RAZORPAY_KEY_ID);
  const keySecret = trimValue(process.env.RAZORPAY_KEY_SECRET);
  const hasKeyId = Boolean(keyId);
  const hasKeySecret = Boolean(keySecret);

  if (hasKeyId !== hasKeySecret) {
    throw new Error("RAZORPAY_CONFIG_INCOMPLETE");
  }

  const configBase: RazorpayConfigBase = {
    mode: hasKeyId ? "live" : "mock",
    apiBaseUrl: trimTrailingSlash(
      trimValue(process.env.RAZORPAY_API_BASE_URL) || DEFAULT_RAZORPAY_API_BASE_URL
    ),
    amountPaise: parseIntegerEnv(
      process.env.PLATFORM_FEE_AMOUNT_PAISE,
      DEFAULT_PLATFORM_FEE_PAISE,
      100,
      1_000_000
    ),
    currency: trimValue(process.env.RAZORPAY_CURRENCY) || DEFAULT_CURRENCY,
    timeoutMs: parseIntegerEnv(
      process.env.RAZORPAY_TIMEOUT_MS,
      DEFAULT_TIMEOUT_MS,
      1_000,
      60_000
    ),
  };

  if (!hasKeyId || !hasKeySecret) {
    return { ...configBase, mode: "mock" };
  }

  return {
    ...configBase,
    mode: "live",
    keyId,
    keySecret,
  };
};

const withTimeout = async (url: string, init: RequestInit, timeoutMs: number) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timer);
  }
};

const toReceipt = (caseId: string) => {
  const compact = caseId.replace(/\s+/g, "-");
  return compact.length <= 40 ? compact : compact.slice(0, 40);
};

export const createPlatformFeeOrder = async (payload: {
  caseId: string;
  requesterEmail: string;
}): Promise<PlatformFeeOrderResponse> => {
  const config = getRazorpayConfig();
  if (config.mode === "mock") {
    return {
      mode: "mock",
      order: {
        id: `order_mock_${Date.now()}`,
        amount: config.amountPaise,
        currency: config.currency,
        receipt: toReceipt(payload.caseId),
        status: "created",
        created_at: Math.floor(Date.now() / 1000),
        notes: {
          caseId: payload.caseId,
          email: payload.requesterEmail,
          mode: "mock",
        },
      },
    };
  }

  const authHeader = Buffer.from(`${config.keyId}:${config.keySecret}`).toString("base64");
  let response: Response;
  try {
    response = await withTimeout(
      `${config.apiBaseUrl}/v1/orders`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${authHeader}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: config.amountPaise,
          currency: config.currency,
          receipt: toReceipt(payload.caseId),
          notes: {
            caseId: payload.caseId,
            email: payload.requesterEmail,
          },
        }),
      },
      config.timeoutMs
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    logEvent("error", "payments.razorpay.order_request_failed", {
      reason: message,
      caseId: payload.caseId,
      requesterEmail: payload.requesterEmail,
    });
    throw new Error("RAZORPAY_ORDER_REQUEST_FAILED");
  }

  const responseData = (await response.json().catch(() => null)) as
    | (RazorpayOrder & { error?: { description?: string } })
    | null;

  if (!response.ok || !responseData || typeof responseData.id !== "string") {
    logEvent("warn", "payments.razorpay.order_rejected", {
      status: response.status,
      caseId: payload.caseId,
      requesterEmail: payload.requesterEmail,
      message:
        responseData &&
        typeof responseData === "object" &&
        responseData.error &&
        typeof responseData.error.description === "string"
          ? responseData.error.description
          : "unknown",
    });
    throw new Error("RAZORPAY_ORDER_REJECTED");
  }

  return {
    mode: "live",
    keyId: config.keyId,
    order: responseData,
  };
};

export const verifyRazorpayPaymentSignature = (payload: VerifyRazorpayPayload) => {
  const config = getRazorpayConfig();
  if (config.mode === "mock") {
    return (
      payload.orderId.startsWith("order_mock_") &&
      payload.paymentId.startsWith("pay_mock_") &&
      payload.signature === "mock_signature"
    );
  }

  const signedPayload = `${payload.orderId}|${payload.paymentId}`;
  const expected = createHmac("sha256", config.keySecret).update(signedPayload).digest("hex");
  const actual = payload.signature.trim();
  if (actual.length !== expected.length) return false;

  return timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
};

