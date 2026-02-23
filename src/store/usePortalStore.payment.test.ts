import { beforeEach, describe, expect, it, vi } from "vitest";

const createCaseRecordMock = vi.fn();
const createRazorpayOrderMock = vi.fn();
const verifyRazorpayPaymentMock = vi.fn();
const updateCaseRecordMock = vi.fn();
const fetchCaseRecordMock = vi.fn();
const openRazorpayCheckoutMock = vi.fn();

vi.mock("@/lib/api-client", () => ({
  createCaseRecord: (...args: unknown[]) => createCaseRecordMock(...args),
  createRazorpayOrder: (...args: unknown[]) => createRazorpayOrderMock(...args),
  verifyRazorpayPayment: (...args: unknown[]) => verifyRazorpayPaymentMock(...args),
  updateCaseRecord: (...args: unknown[]) => updateCaseRecordMock(...args),
  fetchCaseRecord: (...args: unknown[]) => fetchCaseRecordMock(...args),
}));

vi.mock("@/lib/razorpay-checkout", () => ({
  openRazorpayCheckout: (...args: unknown[]) => openRazorpayCheckoutMock(...args),
}));

import { usePortalStore } from "./usePortalStore";

const sampleProfile = {
  fullName: "QA Client",
  email: "qa@nri-law-buddy.com",
  country: "USA",
};

describe("usePortalStore payment flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePortalStore.getState().reset();

    createCaseRecordMock.mockResolvedValue({ id: "CASE-1001" });
    updateCaseRecordMock.mockResolvedValue({});
    fetchCaseRecordMock.mockResolvedValue({});
  });

  it("captures payment in mock mode and sets success state", async () => {
    createRazorpayOrderMock.mockResolvedValue({
      mode: "mock",
      order: {
        id: "order_mock_1001",
        amount: 5000,
        currency: "INR",
        receipt: "CASE-1001",
      },
    });
    verifyRazorpayPaymentMock.mockResolvedValue({
      verified: true,
      caseId: "CASE-1001",
      paymentStatus: "pending",
      requiresAdminApproval: true,
    });

    const store = usePortalStore.getState();
    store.loginUser(sampleProfile);
    store.selectService("property-dispute");
    await store.capturePlatformFee();

    const snapshot = usePortalStore.getState();
    expect(createCaseRecordMock).toHaveBeenCalledTimes(1);
    expect(createRazorpayOrderMock).toHaveBeenCalledWith({ caseId: "CASE-1001" });
    expect(verifyRazorpayPaymentMock).toHaveBeenCalledWith({
      caseId: "CASE-1001",
      orderId: "order_mock_1001",
      paymentId: expect.stringMatching(/^pay_mock_/),
      signature: "mock_signature",
    });
    expect(openRazorpayCheckoutMock).not.toHaveBeenCalled();
    expect(snapshot.paymentCaptured).toBe(true);
    expect(snapshot.paymentActionState).toBe("success");
    expect(snapshot.paymentStatus).toBe("pending");
    expect(snapshot.paymentActionMessage).toContain("Payment verified");
    expect(snapshot.timeline.some((item) => item.title === "Payment captured")).toBe(true);
  });

  it("handles checkout dismissal and succeeds on retry", async () => {
    createCaseRecordMock.mockResolvedValue({ id: "CASE-2002" });
    createRazorpayOrderMock.mockResolvedValue({
      mode: "live",
      keyId: "rzp_test_demo",
      order: {
        id: "order_live_2002",
        amount: 5000,
        currency: "INR",
        receipt: "CASE-2002",
      },
    });
    openRazorpayCheckoutMock
      .mockRejectedValueOnce(new Error("CHECKOUT_DISMISSED"))
      .mockResolvedValueOnce({
        orderId: "order_live_2002",
        paymentId: "pay_live_2002",
        signature: "sig_live_2002",
      });
    verifyRazorpayPaymentMock.mockResolvedValue({
      verified: true,
      caseId: "CASE-2002",
      paymentStatus: "pending",
      requiresAdminApproval: true,
    });

    const store = usePortalStore.getState();
    store.loginUser(sampleProfile);
    store.selectService("property-dispute");

    await store.capturePlatformFee();
    let snapshot = usePortalStore.getState();
    expect(snapshot.paymentActionState).toBe("error");
    expect(snapshot.paymentActionMessage).toContain("closed");
    expect(snapshot.paymentCaptured).toBe(false);
    expect(createCaseRecordMock).toHaveBeenCalledTimes(1);

    await store.capturePlatformFee();
    snapshot = usePortalStore.getState();
    expect(snapshot.paymentActionState).toBe("success");
    expect(snapshot.paymentCaptured).toBe(true);
    expect(createCaseRecordMock).toHaveBeenCalledTimes(1);
    expect(createRazorpayOrderMock).toHaveBeenCalledTimes(2);
    expect(openRazorpayCheckoutMock).toHaveBeenCalledTimes(2);
    expect(verifyRazorpayPaymentMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces verification failure as error state", async () => {
    createCaseRecordMock.mockResolvedValue({ id: "CASE-3003" });
    createRazorpayOrderMock.mockResolvedValue({
      mode: "live",
      keyId: "rzp_test_demo",
      order: {
        id: "order_live_3003",
        amount: 5000,
        currency: "INR",
        receipt: "CASE-3003",
      },
    });
    openRazorpayCheckoutMock.mockResolvedValue({
      orderId: "order_live_3003",
      paymentId: "pay_live_3003",
      signature: "sig_live_3003",
    });
    verifyRazorpayPaymentMock.mockRejectedValue(new Error("Invalid payment signature"));

    const store = usePortalStore.getState();
    store.loginUser(sampleProfile);
    store.selectService("property-dispute");
    await store.capturePlatformFee();

    const snapshot = usePortalStore.getState();
    expect(snapshot.paymentActionState).toBe("error");
    expect(snapshot.paymentActionMessage).toContain("Invalid payment signature");
    expect(snapshot.paymentCaptured).toBe(false);
    expect(snapshot.paymentStatus).toBe("pending");
  });
});
