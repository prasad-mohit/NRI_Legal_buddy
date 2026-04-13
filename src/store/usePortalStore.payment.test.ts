import { beforeEach, describe, expect, it, vi } from "vitest";

const createCaseRecordMock = vi.fn();
const updateCaseRecordMock = vi.fn();
const fetchCaseRecordMock = vi.fn();

vi.mock("@/lib/api-client", () => ({
  createCaseRecord: (...args: unknown[]) => createCaseRecordMock(...args),
  updateCaseRecord: (...args: unknown[]) => updateCaseRecordMock(...args),
  fetchCaseRecord: (...args: unknown[]) => fetchCaseRecordMock(...args),
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

  it("creates case record and moves to payment-pending stage", async () => {
    const store = usePortalStore.getState();
    store.loginUser(sampleProfile);
    store.selectService("property-dispute");
    await store.capturePlatformFee();

    const snapshot = usePortalStore.getState();
    expect(createCaseRecordMock).toHaveBeenCalledTimes(1);
    expect(snapshot.caseId).toBe("CASE-1001");
    expect(snapshot.stage).toBe("payment-pending");
    expect(snapshot.paymentCaptured).toBe(false);
    expect(snapshot.caseStatus).toBe("SUBMITTED");
  });

  it("skips case creation if caseId already exists", async () => {
    const store = usePortalStore.getState();
    store.loginUser(sampleProfile);
    store.selectService("property-dispute");
    usePortalStore.setState({ caseId: "CASE-2002" });

    await store.capturePlatformFee();

    const snapshot = usePortalStore.getState();
    expect(createCaseRecordMock).not.toHaveBeenCalled();
    expect(snapshot.stage).toBe("payment-pending");
    expect(snapshot.caseId).toBe("CASE-2002");
  });

  it("submits bank transfer proof and marks payment captured", async () => {
    const store = usePortalStore.getState();
    store.loginUser(sampleProfile);
    store.selectService("property-dispute");
    usePortalStore.setState({ caseId: "CASE-3003" });

    fetchCaseRecordMock.mockResolvedValueOnce({
      paymentProofs: [{ id: "proof-1", submittedBy: "user", submittedAt: "2024-01-01", url: "https://example.com/receipt.jpg" }],
    });

    await store.submitPaymentProof({ url: "https://example.com/receipt.jpg", note: "NEFT transfer done" });

    const snapshot = usePortalStore.getState();
    expect(updateCaseRecordMock).toHaveBeenCalledWith(
      "CASE-3003",
      expect.objectContaining({
        paymentProof: expect.objectContaining({ url: "https://example.com/receipt.jpg" }),
      })
    );
    expect(snapshot.paymentCaptured).toBe(true);
  });
});
