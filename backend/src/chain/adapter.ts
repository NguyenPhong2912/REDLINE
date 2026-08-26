import type { GrantLimits, GrantState, Intent, ReasonCode } from "../policy/types.js";

// The runtime and API talk to the chain only through this interface.
// MockChain applies the same gates in memory so the whole flow works before
// the Anchor program is deployed; SolanaChain sends real transactions.

export interface ExecutionResult {
  signature: string;
  success: boolean;
  reasonCode: ReasonCode;
  error?: string;
  slot?: bigint;
}

export interface ChainAdapter {
  readonly kind: "mock" | "solana";
  readonly programId: string;
  readonly executorPubkey: string;
  // agentId is the 16-byte PDA seed (hex) — unique per grant, same as the
  // program's `agent_id` so one owner can hold many grants.
  createGrant(ownerWallet: string, vaultPda: string, agentId: string, limits: GrantLimits, policyHash: string): Promise<{ grantPda: string; signature: string }>;
  readGrant(grantPda: string): Promise<GrantState | null>;
  // Submits execute_transfer. Returns a failed result (never throws) when the
  // program rejects, so the demo can show a deliberately failed transaction.
  executeTransfer(intent: Intent): Promise<ExecutionResult>;
  revokeGrant(grantPda: string): Promise<{ signature: string }>;
}
