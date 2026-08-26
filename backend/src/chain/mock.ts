import { createHash, randomBytes } from "node:crypto";
import { nowSeconds } from "../clock.js";
import { applyExecution, evaluateIntent } from "../policy/engine.js";
import type { GrantLimits, GrantState, Intent } from "../policy/types.js";
import type { ChainAdapter, ExecutionResult } from "./adapter.js";

// In-memory stand-in for the deployed program. Same gate order, same counter
// updates, same "reject = nothing moves" rule. Signatures are fake base58-ish
// strings prefixed MOCK so nobody mistakes them for Devnet evidence.

function fakeSignature(): string {
  return `MOCK${randomBytes(40).toString("base64url").replace(/[-_]/g, "x").slice(0, 84)}`;
}

function derivePda(...seeds: string[]): string {
  return `mock${createHash("sha256").update(seeds.join("|")).digest("base64url").slice(0, 40)}`;
}

export class MockChain implements ChainAdapter {
  readonly kind = "mock" as const;
  readonly programId = "MockRedline11111111111111111111111111111111";
  readonly executorPubkey: string;
  private grants = new Map<string, GrantState>();
  private slot = 1_000n;
  private now: () => number;

  constructor(executorPubkey = "MockExecutor1111111111111111111111111111111", now = nowSeconds) {
    this.executorPubkey = executorPubkey;
    this.now = now;
  }

  async createGrant(ownerWallet: string, vaultPda: string, agentId: string, limits: GrantLimits, policyHash: string) {
    const grantPda = derivePda("grant", ownerWallet, agentId);
    if (this.grants.has(grantPda)) throw new Error("grant PDA already exists");
    void vaultPda; void policyHash; // stored on the real account; irrelevant to the mock key
    this.grants.set(grantPda, {
      ...limits,
      grantPda,
      executor: this.executorPubkey,
      active: true,
      spentUnits: 0n,
      transactionCount: 0,
      nextNonce: 0,
      lastExecutionAt: 0,
    });
    return { grantPda, signature: fakeSignature() };
  }

  async readGrant(grantPda: string) {
    const g = this.grants.get(grantPda);
    return g ? { ...g } : null;
  }

  async executeTransfer(intent: Intent): Promise<ExecutionResult> {
    const grant = this.grants.get(intent.grantPda);
    const signature = fakeSignature();
    this.slot += 1n;
    if (!grant) return { signature, success: false, reasonCode: "REVOKED", error: "AccountNotFound", slot: this.slot };
    const verdict = evaluateIntent(grant, intent, this.now());
    if (!verdict.allow) {
      return { signature, success: false, reasonCode: verdict.reasonCode, error: `custom program error: ${verdict.reasonCode}`, slot: this.slot };
    }
    this.grants.set(intent.grantPda, applyExecution(grant, intent, this.now()));
    return { signature, success: true, reasonCode: "OK", slot: this.slot };
  }

  async revokeGrant(grantPda: string) {
    const grant = this.grants.get(grantPda);
    if (grant) this.grants.set(grantPda, { ...grant, active: false });
    return { signature: fakeSignature() };
  }
}
