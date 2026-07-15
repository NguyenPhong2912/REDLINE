import { beforeEach, describe, expect, it } from "vitest";
import { agents } from "@/lib/mock-data";
import { useStore } from "@/store/useStore";

const buyer = "9xQeWvG816bUx9EPfAqGm7bV6MTpMhsYJX7vMBxFvmR7";

describe("marketplace access policy", () => {
  beforeEach(() => {
    useStore.setState({ accessGrants: [], createdAgents: [] });
  });

  it("consumes exactly one pay-per-use credit", () => {
    const agent = agents.find((item) => item.pricingModel === "pay-per-use");
    expect(agent).toBeDefined();
    if (!agent) return;

    useStore.getState().grantAccess({
      agentId: agent.id,
      ownerAddress: buyer,
      pricingModel: "pay-per-use",
      remainingRuns: 1,
      grantedAt: new Date().toISOString(),
    });

    expect(useStore.getState().hasAccess(agent.id, buyer)).toBe(true);
    useStore.getState().consumeAccess(agent.id, buyer);
    expect(useStore.getState().hasAccess(agent.id, buyer)).toBe(false);
  });

  it("rejects expired subscriptions and accepts active ones", () => {
    const agent = agents.find((item) => item.pricingModel === "subscription");
    expect(agent).toBeDefined();
    if (!agent) return;

    useStore.setState({
      accessGrants: [
        {
          agentId: agent.id,
          ownerAddress: buyer,
          pricingModel: "subscription",
          grantedAt: new Date(Date.now() - 60_000).toISOString(),
          expiresAt: new Date(Date.now() - 1_000).toISOString(),
        },
      ],
    });
    expect(useStore.getState().hasAccess(agent.id, buyer)).toBe(false);

    useStore.setState({
      accessGrants: [
        {
          agentId: agent.id,
          ownerAddress: buyer,
          pricingModel: "subscription",
          grantedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        },
      ],
    });
    expect(useStore.getState().hasAccess(agent.id, buyer)).toBe(true);
  });

  it("always gives a creator access to their own listing", () => {
    const agent = agents.find((item) => item.pricingModel !== "free");
    expect(agent).toBeDefined();
    if (!agent) return;

    expect(
      useStore.getState().hasAccess(agent.id, agent.creator.address),
    ).toBe(true);
  });
});
