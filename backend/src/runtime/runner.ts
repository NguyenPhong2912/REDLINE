import { getChain } from "../chain/index.js";
import { isTransientChainError } from "../chain/solana.js";
import { realMs } from "../clock.js";
import { prisma } from "../db/client.js";
import { audit } from "../db/audit.js";
import { processIntent } from "./executor.js";
import { scriptedPlan } from "./scripted.js";
import { llmPlan } from "./llm.js";

// Agent runtime: one loop per active run. Each tick plans one intent and
// hands it to the executor. Ticks are spaced by the grant cooldown so a
// well-behaved agent never trips gate 7 by accident.

const active = new Map<string, { stop: () => void }>();

export async function startRun(grantId: string, mode: "scripted" | "llm", tickMs?: number) {
  const chain = getChain();
  const grant = await prisma.agentGrant.findUniqueOrThrow({ where: { id: grantId } });
  const state = await chain.readGrant(grant.grantPda);
  if (!state) throw new Error("grant not found on chain");
  if (!state.active) throw new Error("grant is revoked");

  const run = await prisma.agentRun.create({ data: { grantId, mode } });
  await audit({ actorType: "agent", actorId: chain.executorPubkey, eventType: "run.started", subjectType: "run", subjectId: run.id, payload: { grantId, mode } });

  // Space ticks by the cooldown (on the shared clock) so a compliant agent
  // never trips gate 7; tickMs only overrides for tests.
  const interval = tickMs ?? Math.max(250, realMs(state.cooldownSeconds) + 250);
  let step = 0;
  let stopped = false;

  const finish = async (status: "stopped" | "failed", reason: string) => {
    if (stopped) return;
    stopped = true;
    active.delete(run.id);
    await prisma.agentRun.update({ where: { id: run.id }, data: { status, endedAt: new Date() } });
    await audit({ actorType: "agent", actorId: chain.executorPubkey, eventType: "run.ended", subjectType: "run", subjectId: run.id, payload: { grantId, status, reason, steps: step } });
  };

  const tick = async () => {
    if (stopped) return;
    try {
      const fresh = await chain.readGrant(grant.grantPda);
      if (!fresh) return finish("failed", "grant vanished");
      const plan = mode === "scripted" ? scriptedPlan(fresh, step) : await llmPlan(fresh, grant.id);
      if (!plan) return finish("stopped", "script complete");
      step += 1;
      const res = await processIntent(grantId, plan, { runId: run.id, submitEvenIfDenied: plan.submitEvenIfDenied });
      // A revoked grant ends the run; any other rejection lets the loop go on
      // so the owner can watch the agent keep getting denied.
      if (res.precheck.reasonCode === "REVOKED" || res.onchainReason === "REVOKED") return finish("stopped", "grant revoked");
      if (res.precheck.reasonCode === "EXPIRED") return finish("stopped", "grant expired");
      // A gate denial is the demo; a chain error is a broken setup the agent
      // cannot retry its way out of, so end the run instead of looping on it.
      if (res.onchainReason === "CHAIN_ERROR") return finish("failed", "chain rejected the transfer outside the policy");
    } catch (err) {
      if (isTransientChainError(err)) {
        // RPC throttled: keep the run alive, retry this step on the next tick.
        step = Math.max(0, step - 1);
        await audit({ actorType: "system", actorId: "runtime", eventType: "run.retry", subjectType: "run", subjectId: run.id, payload: { grantId, step, error: err instanceof Error ? err.message.slice(0, 200) : String(err) } });
      } else {
        return finish("failed", err instanceof Error ? err.message : String(err));
      }
    }
    if (!stopped) timer = setTimeout(tick, interval);
  };

  let timer = setTimeout(tick, 250);
  active.set(run.id, { stop: () => { clearTimeout(timer); void finish("stopped", "stopped by owner"); } });
  return run;
}

export function stopRun(runId: string): boolean {
  const h = active.get(runId);
  if (!h) return false;
  h.stop();
  return true;
}

export function activeRunIds(): string[] {
  return [...active.keys()];
}
