const DEFAULT_CHECKOUT_SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

interface RazorpaySuccessPayload {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayErrorPayload {
  error?: {
    code?: string;
    description?: string;
    source?: string;
    step?: string;
    reason?: string;
    metadata?: {
      payment_id?: string;
      order_id?: string;
    };
  };
}

interface RazorpayInstance {
  open: () => void;
  on?: (event: "payment.failed", handler: (payload: RazorpayErrorPayload) => void) => void;
}

interface RazorpayConstructor {
  new (options: Record<string, unknown>): RazorpayInstance;
}

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

const getCheckoutScriptSrc = () =>
  (process.env.NEXT_PUBLIC_RAZORPAY_CHECKOUT_SRC ?? "").trim() || DEFAULT_CHECKOUT_SCRIPT_SRC;

const ensureCheckoutLoaded = async () => {
  if (typeof window === "undefined") {
    throw new Error("CHECKOUT_UNAVAILABLE");
  }

  if (window.Razorpay) return window.Razorpay;

  const existing = document.querySelector(
    'script[data-razorpay-checkout="true"]'
  ) as HTMLScriptElement | null;

  if (existing) {
    await new Promise<void>((resolve, reject) => {
      if (window.Razorpay) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("CHECKOUT_SCRIPT_LOAD_FAILED")), {
        once: true,
      });
    });
    if (!window.Razorpay) {
      throw new Error("CHECKOUT_UNAVAILABLE");
    }
    return window.Razorpay;
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = getCheckoutScriptSrc();
    script.async = true;
    script.setAttribute("data-razorpay-checkout", "true");
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("CHECKOUT_SCRIPT_LOAD_FAILED"));
    document.head.appendChild(script);
  });

  if (!window.Razorpay) {
    throw new Error("CHECKOUT_UNAVAILABLE");
  }
  return window.Razorpay;
};

export interface RazorpayCheckoutInput {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefill?: {
    name?: string;
    email?: string;
  };
}

export interface RazorpayCheckoutResult {
  orderId: string;
  paymentId: string;
  signature: string;
}

export const openRazorpayCheckout = async (
  payload: RazorpayCheckoutInput
): Promise<RazorpayCheckoutResult> => {
  const Razorpay = await ensureCheckoutLoaded();

  return new Promise<RazorpayCheckoutResult>((resolve, reject) => {
    let settled = false;
    const settleOnce = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };

    const checkout = new Razorpay({
      key: payload.keyId,
      order_id: payload.orderId,
      amount: payload.amount,
      currency: payload.currency,
      name: payload.name,
      description: payload.description,
      prefill: payload.prefill,
      retry: {
        enabled: true,
        max_count: 2,
      },
      modal: {
        ondismiss: () => {
          settleOnce(() => reject(new Error("CHECKOUT_DISMISSED")));
        },
      },
      handler: (response: RazorpaySuccessPayload) => {
        settleOnce(() =>
          resolve({
            orderId: response.razorpay_order_id,
            paymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature,
          })
        );
      },
    });

    checkout.on?.("payment.failed", (response: RazorpayErrorPayload) => {
      const message = response.error?.description?.trim() || "Payment failed";
      settleOnce(() => reject(new Error(`CHECKOUT_PAYMENT_FAILED:${message}`)));
    });

    try {
      checkout.open();
    } catch {
      settleOnce(() => reject(new Error("CHECKOUT_OPEN_FAILED")));
    }
  });
};
