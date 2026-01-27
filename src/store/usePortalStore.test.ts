import { beforeEach, describe, expect, it } from "vitest";

import { usePortalStore } from "./usePortalStore";

const sampleProfile = {
  fullName: "QA Client",
  email: "qa@nri-law-buddy.com",
  country: "USA",
};

const slot = "2026-01-27 09:00 GMT";

describe("usePortalStore", () => {
  beforeEach(() => {
    usePortalStore.getState().reset();
  });

  it("progresses through the concierge flow", async () => {
    const store = usePortalStore.getState();

    store.loginUser(sampleProfile);
    expect(usePortalStore.getState().stage).toBe("service-selection");

    store.selectService("property-dispute");
    expect(usePortalStore.getState().selectedService?.id).toBe("property-dispute");

    await store.capturePlatformFee();
  expect(usePortalStore.getState().platformFeePaid).toBe(false);
  expect(usePortalStore.getState().paymentStatus).toBe("pending");

  usePortalStore.setState({ platformFeePaid: true, paymentStatus: "approved" });

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
