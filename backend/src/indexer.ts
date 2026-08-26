import type { Address } from "@solana/kit";
import { eventsFromLogs, errorCodeToReason, extractCustomError } from "./chain/anchor.js";
import type { SolanaChain } from "./chain/solana.js";
import { prisma } from "./db/client.js";
import { audit } from "./db/audit.js";

// Listens to every transaction that mentions the program and turns Anchor
// events into audit rows + counter updates. This is the path that makes the
// dashboard trustworthy: numbers come from chain logs, not from whatever the
// runtime thought happened. Works for transactions we sent AND for ones sent
// by anyone else (browser wallet, another runtime, an attacker).

export async function startIndexer(chain: SolanaChain, log: (msg: string) => void) {
  let backoff = 1_000;
  for (;;) {
    try {
      const abort = new AbortController();
      const notifications = await chain.rpcSubscriptions
        .logsNotifications({ mentions: [chain.programId as Address] }, { commitment: "confirmed" })
        .subscribe({ abortSignal: abort.signal });
      log(`indexer: subscribed to ${chain.programId}`);
      backoff = 1_000;
      for await (const n of notifications) {
        try {
          await handle(chain, n.value.signature as string, n.value.err, n.context.slot, n.value.logs ?? []);
        } catch (e) {
          log(`indexer: failed on ${n.value.signature}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      log("indexer: subscription ended, reconnecting");
    } catch (e) {
      log(`indexer: ${e instanceof Error ? e.message : String(e)}; retry in ${backoff}ms`);
      await new Promise(r => setTimeout(r, backoff));
      backoff = Math.min(backoff * 2, 30_000);
    }
  }
}

async function handle(chain: SolanaChain, signature: string, err: unknown, slot: bigint, logs: readonly string[]) {
  // Idempotent: the executor may already have written this signature.
  const seen = await prisma.auditEvent.findFirst({ where: { chainSignature: signature, actorType: "chain", eventType: { startsWith: "chain." } } });
  if (seen) return;

  if (err) {
    const code = extractCustomError(err) ?? extractCustomError(logs.join("\n"));
    const mapped = code === null ? null : errorCodeToReason(code);
    const grantId = await grantIdForSignature(signature);
    await audit({
      actorType: "chain", actorId: chain.programId, eventType: "chain.tx_failed", subjectType: "signature", subjectId: signature, chainSignature: signature,
      payload: { grantId, slot, code, variant: mapped?.variant ?? null, reasonCode: mapped?.reasonCode ?? null },
    });
    return;
  }

  for (const ev of eventsFromLogs(logs)) {
    if (ev.name === "PolicyDecision") {
      const grant = await prisma.agentGrant.findUnique({ where: { grantPda: ev.grant } });
      if (grant) {
        await prisma.agentGrant.update({
          where: { id: grant.id },
          data: { spentUnits: ev.spentUnits, transactionCount: ev.transactionCount, nextNonce: Number(ev.nonce) + 1, lastExecutionAt: new Date() },
        });
      }
      await audit({
        actorType: "chain", actorId: chain.programId, eventType: "chain.policy_decision", subjectType: "grant", subjectId: grant?.id ?? ev.grant, chainSignature: signature,
        payload: { grantId: grant?.id ?? null, grantPda: ev.grant, nonce: ev.nonce, mint: ev.mint, destination: ev.destination, amountUnits: ev.amountUnits, spentUnits: ev.spentUnits, transactionCount: ev.transactionCount, slot: ev.slot },
      });
    } else if (ev.name === "GrantRevoked") {
      const grant = await prisma.agentGrant.findUnique({ where: { grantPda: ev.grant } });
      if (grant) await prisma.agentGrant.update({ where: { id: grant.id }, data: { revoked: true } });
      await audit({ actorType: "chain", actorId: chain.programId, eventType: "chain.grant_revoked", subjectType: "grant", subjectId: grant?.id ?? ev.grant, chainSignature: signature, payload: { grantId: grant?.id ?? null, grantPda: ev.grant, owner: ev.owner, slot } });
    } else if (ev.name === "GrantCreated") {
      const grant = await prisma.agentGrant.findUnique({ where: { grantPda: ev.grant } });
      await audit({ actorType: "chain", actorId: chain.programId, eventType: "chain.grant_created", subjectType: "grant", subjectId: grant?.id ?? ev.grant, chainSignature: signature, payload: { grantId: grant?.id ?? null, grantPda: ev.grant, owner: ev.owner, vault: ev.vault, executor: ev.executor, policyHash: ev.policyHash, spendCapUnits: ev.spendCapUnits, maxTransactions: ev.maxTransactions, expiresAt: ev.expiresAt, slot } });
    } else {
      await audit({ actorType: "chain", actorId: chain.programId, eventType: `chain.${ev.name.toLowerCase()}`, subjectType: "signature", subjectId: signature, chainSignature: signature, payload: { ...ev, slot } });
    }
  }
}

async function grantIdForSignature(signature: string): Promise<string | null> {
  const tx = await prisma.chainTransaction.findUnique({ where: { signature }, include: { decision: { include: { intent: true } } } });
  return tx?.decision.intent.grantId ?? null;
}
