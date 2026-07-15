import {
  address,
  getAddressEncoder,
  getProgramDerivedAddress,
  type Address,
  type ProgramDerivedAddress,
} from "@solana/kit";

export const MARKETPLACE_PROGRAM_ADDRESS = address(
  process.env.NEXT_PUBLIC_MARKETPLACE_PROGRAM_ID ??
    "H6VwUUKHsBs6WdoJbye69E3124Fuo877azj9D9HqvniD",
);

const addressEncoder = getAddressEncoder();

export async function hashAgentId(agentId: string) {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(agentId)),
  );
}

export function deriveMarketplaceAddress(): Promise<ProgramDerivedAddress> {
  return getProgramDerivedAddress({
    programAddress: MARKETPLACE_PROGRAM_ADDRESS,
    seeds: ["marketplace"],
  });
}

export async function deriveAgentListingAddress(
  creator: string,
  agentId: string,
): Promise<ProgramDerivedAddress> {
  return getProgramDerivedAddress({
    programAddress: MARKETPLACE_PROGRAM_ADDRESS,
    seeds: [
      "agent",
      addressEncoder.encode(address(creator)),
      await hashAgentId(agentId),
    ],
  });
}

export function deriveAccessGrantAddress(
  listing: Address,
  owner: string,
): Promise<ProgramDerivedAddress> {
  return getProgramDerivedAddress({
    programAddress: MARKETPLACE_PROGRAM_ADDRESS,
    seeds: [
      "access",
      addressEncoder.encode(listing),
      addressEncoder.encode(address(owner)),
    ],
  });
}

export function accessLabel(pricingModel: string) {
  switch (pricingModel) {
    case "pay-per-use":
      return "one run credit";
    case "subscription":
      return "30 days";
    case "one-time":
      return "permanent access";
    default:
      return "open access";
  }
}
