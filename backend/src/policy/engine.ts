import { createHash } from "node:crypto";
import type { GrantState, Intent, ReasonCode, Verdict } from "./types.js";

// Off-chain mirror of the on-chain gates in programs/redline_guardrails.
// This engine is advisory: it lets the runtime explain a rejection before
// paying for a transaction. The program remains the only authority.
//
// Gate order matches ERD §02 and the Rust `require!` sequence exactly, so a
// precheck reason code always equals the program error the chain would return.

const MESSAGES: Record<ReasonCode, string> = {
  OK: "All gates passed.",
  REVOKED: "Grant has been revoked by the owner.",
  EXPIRED: "Grant validity window has ended.",
  NONCE_REPLAY: "Intent nonce does not match the grant's next nonce.",
  MINT_NOT_ALLOWED: "Token mint is not on the grant allowlist.",
  DESTINATION_NOT_ALLOWED: "Destination is not on the grant allowlist.",
  TX_CAP_EXCEEDED: "Transaction count would exceed the grant cap.",
  SPEND_CAP_EXCEEDED: "Cumulative spend would exceed the grant cap.",
  COOLDOWN_ACTIVE: "Cooldown since the last execution has not elapsed.",
};

function fail(gate: number, reasonCode: ReasonCode): Verdict {
  return { allow: false, reasonCode, gate, message: MESSAGES[reasonCode] };
}

export function evaluateIntent(grant: GrantState, intent: Intent, nowSeconds: number): Verdict {
  if (!grant.active) return fail(1, "REVOKED");
  if (nowSeconds >= grant.expiresAt) return fail(2, "EXPIRED");
  if (intent.nonce !== grant.nextNonce) return fail(3, "NONCE_REPLAY");
  if (!grant.allowedMints.includes(intent.mint)) return fail(4, "MINT_NOT_ALLOWED");
  if (!grant.allowedDestinations.includes(intent.destination)) return fail(5, "DESTINATION_NOT_ALLOWED");
  if (grant.transactionCount >= grant.maxTransactions) return fail(6, "TX_CAP_EXCEEDED");
  if (grant.spentUnits + intent.amountUnits > grant.spendCapUnits) return fail(6, "SPEND_CAP_EXCEEDED");
  if (grant.lastExecutionAt > 0 && nowSeconds - grant.lastExecutionAt < grant.cooldownSeconds) {
    return fail(7, "COOLDOWN_ACTIVE");
  }
  return { allow: true, reasonCode: "OK", gate: 0, message: MESSAGES.OK };
}

// Pure state transition applied after an ALLOW. Used by MockChain and by the
// DB mirror so both stay byte-identical with the program's counter updates.
export function applyExecution(grant: GrantState, intent: Intent, nowSeconds: number): GrantState {
  return {
    ...grant,
    spentUnits: grant.spentUnits + intent.amountUnits,
    transactionCount: grant.transactionCount + 1,
    nextNonce: grant.nextNonce + 1,
    lastExecutionAt: nowSeconds,
  };
}

// Canonical hash of an intent. Field order is fixed; bigint rendered as decimal.
export function intentHash(intent: Intent): string {
  const canonical = JSON.stringify({
    grantPda: intent.grantPda,
    mint: intent.mint,
    amountUnits: intent.amountUnits.toString(),
    destination: intent.destination,
    nonce: intent.nonce,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

// Hash of the rule set in force when a decision was made — stored with every
// decision so an auditor can prove which limits applied.
export function ruleSnapshotHash(grant: GrantState): string {
  const canonical = JSON.stringify({
    spendCapUnits: grant.spendCapUnits.toString(),
    maxTransactions: grant.maxTransactions,
    cooldownSeconds: grant.cooldownSeconds,
    expiresAt: grant.expiresAt,
    allowedMints: [...grant.allowedMints].sort(),
    allowedDestinations: [...grant.allowedDestinations].sort(),
  });
  return createHash("sha256").update(canonical).digest("hex");
}
