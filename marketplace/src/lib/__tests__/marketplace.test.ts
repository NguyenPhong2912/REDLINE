import { describe, expect, it } from "vitest";
import {
  accessLabel,
  deriveAccessGrantAddress,
  deriveAgentListingAddress,
  deriveMarketplaceAddress,
} from "@/lib/solana/marketplace";

const creator = "GgBaCs3N6mTQkjgcK6md6JQX7w6fUSp42a8LsLwK5GEx";
const buyer = "9xQeWvG816bUx9EPfAqGm7bV6MTpMhsYJX7vMBxFvmR7";

describe("marketplace PDAs", () => {
  it("derives stable and distinct listing addresses", async () => {
    const first = await deriveAgentListingAddress(creator, "agent-one");
    const repeated = await deriveAgentListingAddress(creator, "agent-one");
    const second = await deriveAgentListingAddress(creator, "agent-two");

    expect(first).toEqual(repeated);
    expect(first[0]).not.toBe(second[0]);
  });

  it("derives marketplace and access grant addresses", async () => {
    const [marketplace] = await deriveMarketplaceAddress();
    const [listing] = await deriveAgentListingAddress(creator, "agent-one");
    const [grant] = await deriveAccessGrantAddress(listing, buyer);

    expect(marketplace).toHaveLength(44);
    expect(grant).not.toBe(listing);
  });

  it("labels every supported access policy", () => {
    expect(accessLabel("pay-per-use")).toBe("one run credit");
    expect(accessLabel("subscription")).toBe("30 days");
    expect(accessLabel("one-time")).toBe("permanent access");
    expect(accessLabel("free")).toBe("open access");
  });
});
