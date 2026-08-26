import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getChain } from "../chain/index.js";
import { nowSeconds } from "../clock.js";
import { prisma } from "../db/client.js";
import { evaluateIntent, intentHash, ruleSnapshotHash } from "../policy/engine.js";
import { processIntent } from "../runtime/executor.js";
import { json } from "./json.js";

const IntentBody = z.object({
  grantId: z.string().min(1),
  mint: z.string().min(32).max(44),
  amountUnits: z.string().regex(/^\d+$/),
  destination: z.string().min(32).max(44),
  reason: z.string().max(200).optional(),
  nonce: z.number().int().min(0).optional(),
});

export async function intentRoutes(app: FastifyInstance) {
  // Dry run: same gates, no DB write, no fee. For the UI's "what would happen".
  app.post("/intents/preview", async (req, reply) => {
    const body = IntentBody.parse(req.body);
    const grant = await prisma.agentGrant.findUnique({ where: { id: body.grantId } });
    if (!grant) return reply.code(404).send({ error: "grant not found" });
    const state = await getChain().readGrant(grant.grantPda);
    if (!state) return reply.code(404).send({ error: "grant not on chain" });
    const intent = { grantPda: grant.grantPda, mint: body.mint, amountUnits: BigInt(body.amountUnits), destination: body.destination, nonce: body.nonce ?? state.nextNonce };
    const verdict = evaluateIntent(state, intent, nowSeconds());
    return json({ verdict, intentHash: intentHash(intent), ruleSnapshotHash: ruleSnapshotHash(state), nonce: intent.nonce });
  });

  // Manual submission (owner or demo driver). submitEvenIfDenied=true reproduces
  // the "program rejects it on-chain" moment on demand.
  app.post("/intents", async (req, reply) => {
    const body = IntentBody.extend({ submitEvenIfDenied: z.boolean().optional() }).parse(req.body);
    const result = await processIntent(body.grantId, { mint: body.mint, amountUnits: BigInt(body.amountUnits), destination: body.destination, reason: body.reason, nonce: body.nonce }, { submitEvenIfDenied: body.submitEvenIfDenied });
    return reply.code(201).send(json(result));
  });

  app.get("/grants/:id/intents", async (req) => {
    const { id } = req.params as { id: string };
    const intents = await prisma.transactionIntent.findMany({ where: { grantId: id }, include: { decision: { include: { chainTx: true } } }, orderBy: { createdAt: "desc" } });
    return json(intents);
  });
}
