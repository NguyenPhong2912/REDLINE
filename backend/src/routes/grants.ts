import type { FastifyInstance } from "fastify";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { getChain } from "../chain/index.js";
import { nowSeconds } from "../clock.js";
import { prisma } from "../db/client.js";
import { audit } from "../db/audit.js";
import { PolicySchema, canonicalPolicy, policyHash, toGrantLimits } from "../policy/canonical.js";
import { deterministic } from "./risk.js";
import { json } from "./json.js";

const CreateGrant = z.object({
  ownerWallet: z.string().min(32).max(44),
  vaultPda: z.string().min(1).max(64).optional(),
  agentVersionId: z.string().min(1),
  policy: PolicySchema,
  // On Solana the browser signs create_grant and sends us the signature +
  // PDA; on mock the adapter creates it for us.
  grantPda: z.string().optional(),
  createSignature: z.string().optional(),
  agentId: z.string().regex(/^[0-9a-f]{32}$/).optional(),
  // Set when the owner was shown a REVIEW verdict and accepted it anyway. The
  // browser reports this; the server recomputes the deterministic floor below
  // rather than taking the claim at face value.
  riskAcknowledged: z.boolean().optional(),
});

export async function grantRoutes(app: FastifyInstance) {
  app.post("/grants", async (req, reply) => {
    const body = CreateGrant.parse(req.body);
    const chain = getChain();
    const now = nowSeconds();
    const hash = policyHash(body.policy);
    const limits = toGrantLimits(body.policy, now);

    const owner = await prisma.owner.upsert({ where: { wallet: body.ownerWallet }, update: {}, create: { wallet: body.ownerWallet } });
    const vaultPda = body.vaultPda ?? `mockvault${createHash("sha256").update(body.ownerWallet).digest("base64url").slice(0, 32)}`;
    const vault = await prisma.vault.upsert({ where: { vaultPda }, update: {}, create: { ownerId: owner.id, vaultPda } });
    const agentVersion = await prisma.agentVersion.findUniqueOrThrow({ where: { id: body.agentVersionId } });

    const policy = await prisma.policyVersion.upsert({
      where: { policyHash: hash },
      update: {},
      create: {
        policyHash: hash,
        canonicalJson: canonicalPolicy(body.policy),
        spendCapUnits: limits.spendCapUnits,
        maxTransactions: limits.maxTransactions,
        cooldownSeconds: limits.cooldownSeconds,
        expiresAt: new Date(limits.expiresAt * 1000),
        allowedMints: JSON.stringify(limits.allowedMints),
        allowedDests: JSON.stringify(limits.allowedDestinations),
      },
    });

    const agentId = body.agentId ?? randomBytes(16).toString("hex");
    let grantPda = body.grantPda;
    let createSignature = body.createSignature;
    if (chain.kind === "mock" || !grantPda) {
      const created = await chain.createGrant(body.ownerWallet, vaultPda, agentId, limits, hash);
      grantPda = created.grantPda;
      createSignature = created.signature;
    }

    const grant = await prisma.agentGrant.create({
      data: {
        ownerId: owner.id, vaultId: vault.id, agentVersionId: agentVersion.id, policyVersionId: policy.id,
        grantPda, agentId, executorPubkey: chain.executorPubkey, createSignature,
      },
    });
    // The wallet signs create_grant before this call, so the grant already
    // exists on-chain and refusing here would only orphan it. What the record
    // can do is state the risk this policy carried and whether the owner
    // acknowledged it — recomputed here, not taken from the browser, so a
    // client that skips the prompt cannot also erase the verdict.
    const floor = deterministic(body.policy);
    const risk = {
      deterministicDecision: floor.decision,
      deterministicScore: floor.score,
      findings: floor.findings,
      acknowledged: body.riskAcknowledged === true,
      acknowledgementRequired: floor.decision !== "ALLOW",
    };
    await audit({
      actorType: "owner", actorId: body.ownerWallet, eventType: "grant.created", subjectType: "grant", subjectId: grant.id, chainSignature: createSignature,
      payload: { grantId: grant.id, grantPda, agentId, policyHash: hash, agentHash: agentVersion.agentHash, limits, risk },
    });
    // An unacknowledged non-ALLOW policy is worth its own row: it is the case
    // an auditor would want to find without reading every grant payload.
    if (risk.acknowledgementRequired && !risk.acknowledged) {
      await audit({
        actorType: "system", actorId: "risk-engine", eventType: "grant.risk_unacknowledged", subjectType: "grant", subjectId: grant.id, chainSignature: createSignature,
        payload: { grantId: grant.id, decision: floor.decision, score: floor.score, findings: floor.findings },
      });
    }
    return reply.code(201).send(json({ grant, policyHash: hash, chain: chain.kind }));
  });

  app.get("/grants", async () => {
    const grants = await prisma.agentGrant.findMany({ include: { agentVersion: true, policyVersion: true, owner: true }, orderBy: { createdAt: "desc" } });
    return json(grants);
  });

  app.get("/grants/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const grant = await prisma.agentGrant.findUnique({ where: { id }, include: { agentVersion: true, policyVersion: true, owner: true, vault: true, runs: { orderBy: { startedAt: "desc" } } } });
    if (!grant) return reply.code(404).send({ error: "grant not found" });
    // The mirrored row is still worth returning when the chain read fails —
    // an RPC hiccup, or a grantPda written by a different CHAIN adapter, must
    // not take the whole page down. `onchain: null` is the honest answer.
    let onchain = null;
    try {
      onchain = await getChain().readGrant(grant.grantPda);
    } catch (err) {
      app.log.warn({ grantId: id, grantPda: grant.grantPda, err: String(err) }, "on-chain grant read failed");
    }
    return json({ ...grant, onchain });
  });

  app.post("/grants/:id/revoke", async (req, reply) => {
    const { id } = req.params as { id: string };
    const grant = await prisma.agentGrant.findUnique({ where: { id } });
    if (!grant) return reply.code(404).send({ error: "grant not found" });
    // Browser flow posts the signature of a revoke_grant it already sent;
    // mock / headless demo lets the adapter sign.
    const body = (req.body ?? {}) as { signature?: string };
    const chain = getChain();
    // On Solana the owner must have signed revoke_grant in their wallet; the
    // server never signs on an owner's behalf outside the mock adapter.
    if (chain.kind === "solana" && !body.signature) {
      return reply.code(400).send({ error: "signature required: sign revoke_grant in the owner wallet, then post its signature" });
    }
    const signature = body.signature ?? (await chain.revokeGrant(grant.grantPda)).signature;
    await prisma.agentGrant.update({ where: { id }, data: { revoked: true } });
    await audit({ actorType: "owner", actorId: grant.ownerId, eventType: "grant.revoked", subjectType: "grant", subjectId: id, chainSignature: signature, payload: { grantId: id, grantPda: grant.grantPda } });
    return json({ ok: true, signature });
  });
}
