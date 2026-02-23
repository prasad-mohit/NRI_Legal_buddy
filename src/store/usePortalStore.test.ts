import { beforeEach, describe, expect, it, vi } from "vitest";

const createVideoMeetingMock = vi.fn();
const updateCaseRecordMock = vi.fn();

vi.mock("@/lib/api-client", () => ({
  createCaseRecord: vi.fn(),
  createRazorpayOrder: vi.fn(),
  fetchCaseRecord: vi.fn(),
  verifyRazorpayPayment: vi.fn(),
  createVideoMeeting: (...args: unknown[]) => createVideoMeetingMock(...args),
  updateCaseRecord: (...args: unknown[]) => updateCaseRecordMock(...args),
}));

import { usePortalStore } from "./usePortalStore";

const sampleProfile = {
  fullName: "QA Client",
  email: "qa@nri-law-buddy.com",
  country: "USA",
};

const slot = "2026-01-27 09:00 GMT";

describe("usePortalStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePortalStore.getState().reset();
    createVideoMeetingMock.mockResolvedValue({
      meeting: {
        id: "MTG-1001",
        caseId: "CASE-1001",
        scheduledAt: slot,
        link: "/meeting/MTG-1001",
        provider: "amazon-chime",
        createdByEmail: "qa@nri-law-buddy.com",
        createdAt: new Date().toISOString(),
        chimeMeetingId: "chime-demo-1",
        chimeExternalMeetingId: "case1001meeting",
        mediaRegion: "us-east-1",
      },
      caseRecord: {},
    });
    updateCaseRecordMock.mockResolvedValue({});
  });

  it("progresses through the concierge flow", async () => {
    const store = usePortalStore.getState();

    store.loginUser(sampleProfile);
    expect(usePortalStore.getState().stage).toBe("service-selection");

    store.selectService("property-dispute");
    expect(usePortalStore.getState().selectedService?.id).toBe("property-dispute");

    usePortalStore.setState({
      caseId: "CASE-1001",
      platformFeePaid: true,
      paymentStatus: "approved",
    });

    await store.scheduleVideoCall(slot);
    expect(usePortalStore.getState().videoCall?.scheduledAt).toBe(slot);

    await store.addDocument("Affidavit", "Litigation");
    expect(usePortalStore.getState().documents.length).toBeGreaterThan(2);

    await store.advanceEscrow();
    const [agreement] = usePortalStore.getState().escrowMilestones;
    expect(agreement.unlocked).toBe(true);
  });

  it("resets to a clean login state", () => {
    const store = usePortalStore.getState();
    store.loginUser(sampleProfile);
    store.selectService("will-probate");

    store.reset();
    const snapshot = usePortalStore.getState();
    expect(snapshot.stage).toBe("login");
    expect(snapshot.selectedService).toBeUndefined();
    expect(snapshot.timeline).toHaveLength(0);
  });
});
