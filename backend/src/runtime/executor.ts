import { getChain } from "../chain/index.js";
import { nowSeconds } from "../clock.js";
import { prisma } from "../db/client.js";
import { audit } from "../db/audit.js";
import { evaluateIntent, intentHash, ruleSnapshotHash } from "../policy/engine.js";
import type { GrantState, Intent, Verdict } from "../policy/types.js";

// One intent, end to end:
//   record intent → off-chain precheck → (optionally) submit on-chain →
//   record decision + chain tx → audit every step.
//
// `submitEvenIfDenied` is the demo switch: normally a DENY stops here and no
// fee is paid; for the "watch the program reject it" moment we send anyway.

export interface ProcessOptions {
  runId?: string;
  submitEvenIfDenied?: boolean;
  now?: () => number;
}

export interface ProcessResult {
  intentId: string;
  intentHash: string;
  precheck: Verdict;
  submitted: boolean;
  signature?: string;
  onchainSuccess?: boolean;
  onchainReason?: string;
}

async function loadGrantState(grantId: string): Promise<{ state: GrantState; grantPda: string }> {
  const chain = getChain();
  const grant = await prisma.agentGrant.findUniqueOrThrow({ where: { id: grantId } });
  const state = await chain.readGrant(grant.grantPda);
  if (!state) throw new Error(`grant ${grant.grantPda} not found on ${chain.kind}`);
  return { state, grantPda: grant.grantPda };
}

export async function processIntent(
  grantId: string,
  draft: { mint: string; amountUnits: bigint; destination: string; reason?: string; nonce?: number },
  opts: ProcessOptions = {},
): Promise<ProcessResult> {
  const now = opts.now ?? nowSeconds;
  const chain = getChain();
  const { state, grantPda } = await loadGrantState(grantId);

  const intent: Intent = {
    grantPda,
    mint: draft.mint,
    amountUnits: draft.amountUnits,
    destination: draft.destination,
    nonce: draft.nonce ?? state.nextNonce,
    reason: draft.reason,
  };
  const hash = intentHash(intent);

  const row = await prisma.transactionIntent.create({
    data: {
      runId: opts.runId,
      grantId,
      mint: intent.mint,
      amountUnits: intent.amountUnits,
      destination: intent.destination,
      nonce: intent.nonce,
      reason: intent.reason ?? "",
      intentHash: hash,
    },
  });
  await audit({
    actorType: "agent", actorId: chain.executorPubkey, eventType: "intent.created",
    subjectType: "intent", subjectId: row.id,
    payload: { grantId, intentHash: hash, mint: intent.mint, amountUnits: intent.amountUnits, destination: intent.destination, nonce: intent.nonce, reason: intent.reason ?? "" },
  });

  const precheck = evaluateIntent(state, intent, now());
  const snapshot = ruleSnapshotHash(state);
  await audit({
    actorType: "system", actorId: "policy-engine", eventType: "decision.precheck",
    subjectType: "intent", subjectId: row.id,
    payload: { grantId, allow: precheck.allow, reasonCode: precheck.reasonCode, gate: precheck.gate, message: precheck.message, ruleSnapshotHash: snapshot },
  });

  const shouldSubmit = precheck.allow || opts.submitEvenIfDenied === true;
  if (!shouldSubmit) {
    await prisma.policyDecision.create({
      data: { intentId: row.id, allow: false, reasonCode: precheck.reasonCode, ruleSnapshotHash: snapshot, stage: "precheck" },
    });
    return { intentId: row.id, intentHash: hash, precheck, submitted: false };
  }

  const result = await chain.executeTransfer(intent);
  const decision = await prisma.policyDecision.create({
    data: { intentId: row.id, allow: result.success, reasonCode: result.reasonCode, ruleSnapshotHash: snapshot, stage: "onchain" },
  });
  await prisma.chainTransaction.create({
    data: { decisionId: decision.id, signature: result.signature, slot: result.slot, programId: chain.programId, result: result.success ? "success" : "failed", error: result.error },
  });

  // Mirror counters from the chain. The indexer will do this from events on
  // Solana; on mock we read back immediately.
  const fresh = await chain.readGrant(grantPda);
  if (fresh) {
    await prisma.agentGrant.update({
      where: { id: grantId },
      data: {
        spentUnits: fresh.spentUnits,
        transactionCount: fresh.transactionCount,
        nextNonce: fresh.nextNonce,
        lastExecutionAt: fresh.lastExecutionAt ? new Date(fresh.lastExecutionAt * 1000) : null,
        revoked: !fresh.active,
      },
    });
  }

  await audit({
    actorType: "chain", actorId: chain.programId, eventType: result.success ? "tx.confirmed" : "tx.rejected",
    subjectType: "intent", subjectId: row.id, chainSignature: result.signature,
    payload: { grantId, signature: result.signature, success: result.success, reasonCode: result.reasonCode, error: result.error ?? null, slot: result.slot ?? null, counters: fresh ? { spentUnits: fresh.spentUnits, transactionCount: fresh.transactionCount, nextNonce: fresh.nextNonce } : null },
  });

  return { intentId: row.id, intentHash: hash, precheck, submitted: true, signature: result.signature, onchainSuccess: result.success, onchainReason: result.reasonCode };
}
