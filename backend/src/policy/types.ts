// Shared shapes for the policy engine, chain adapters and runtime.
// Units are raw token base units (e.g. 1 USDC = 1_000_000 with 6 decimals).

export interface GrantLimits {
  spendCapUnits: bigint;
  maxTransactions: number;
  cooldownSeconds: number;
  expiresAt: number; // unix seconds
  allowedMints: string[];
  allowedDestinations: string[];
}

export interface GrantState extends GrantLimits {
  grantPda: string;
  executor: string;
  active: boolean;
  spentUnits: bigint;
  transactionCount: number;
  nextNonce: number;
  lastExecutionAt: number; // unix seconds, 0 if never
}

export interface Intent {
  grantPda: string;
  mint: string;
  amountUnits: bigint;
  destination: string;
  nonce: number;
  reason?: string;
}

// Mirrors the program's error enum, in gate order. The first failing gate wins.
export type ReasonCode =
  | "OK"
  | "REVOKED"
  | "EXPIRED"
  | "NONCE_REPLAY"
  | "MINT_NOT_ALLOWED"
  | "DESTINATION_NOT_ALLOWED"
  | "TX_CAP_EXCEEDED"
  | "SPEND_CAP_EXCEEDED"
  | "COOLDOWN_ACTIVE"
  // Not a gate: the chain rejected the transaction for a reason outside the
  // policy (an Anchor framework error, a missing account). Kept distinct so an
  // infrastructure failure is never reported as an owner's policy decision.
  | "CHAIN_ERROR";

export interface Verdict {
  allow: boolean;
  reasonCode: ReasonCode;
  gate: number; // 0 = passed all, 1..7 = index of failed gate
  message: string;
}
