import type { FastifyInstance } from "fastify";
import type { Signature } from "@solana/kit";
import { z } from "zod";
import { getChain } from "../chain/index.js";
import { SolanaChain } from "../chain/solana.js";
import { prisma } from "../db/client.js";
import { audit } from "../db/audit.js";
import { requireWallet } from "../auth.js";
import { json } from "./json.js";
import { hireStatsByListing, listingStats, volumeByListing } from "./market-stats.js";

// Real marketplace: a listing is the (already-existing) default AgentListing
// row created when an agent is published. Hiring is a plain wallet-signed SOL
// transfer to the developer's wallet — no escrow program, so nothing new had
// to be added to the deployed Anchor program. On CHAIN=solana the payment
// transaction is fetched from Devnet and checked before the hire is recorded;
// on CHAIN=mock (no real RPC) the signature is trusted, matching how the rest
// of the mock adapter treats owner-signed instructions.
async function verifyPayment(signature: string, payer: string, payee: string, minLamports: bigint) {
  const chain = getChain();
  if (!(chain instanceof SolanaChain)) return; // mock: nothing to verify against
  const tx = await chain.rpc.getTransaction(signature as Signature, { commitment: "confirmed", encoding: "json", maxSupportedTransactionVersion: 0 }).send();
  if (!tx) throw new Error("payment transaction not found on Devnet");
  if (tx.meta?.err) throw new Error(`payment transaction failed on-chain: ${JSON.stringify(tx.meta.err)}`);
  const keys = tx.transaction.message.accountKeys as unknown as string[];
  if (keys[0] !== payer) throw new Error("payment was not signed by the renting wallet");
  const payeeIndex = keys.indexOf(payee);
  if (payeeIndex === -1) throw new Error("payment does not touch the developer wallet");
  const pre = BigInt(tx.meta?.preBalances?.[payeeIndex] ?? 0);
  const post = BigInt(tx.meta?.postBalances?.[payeeIndex] ?? 0);
  if (post - pre < minLamports) throw new Error(`payment of ${post - pre} lamports is below the listing price of ${minLamports}`);
}

export async function listingRoutes(app: FastifyInstance) {
  // Real listings — the ones auto-created by POST /agents, enriched with hire
  // stats so the marketplace can show real demand: active hires, all-time
  // count, 24h count, and total lamports paid. The volume figure is summed
  // from the `listing.hired` audit events, the one place the exact amount paid
  // at hire time is written down.
  app.get("/listings", async () => {
    const [listings, hiredEvents] = await Promise.all([
      prisma.agentListing.findMany({
        where: { status: "active" },
        include: { agentVersion: true, hires: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.auditEvent.findMany({ where: { eventType: "listing.hired" }, select: { payload: true } }),
    ]);
    const volumes = volumeByListing(hiredEvents);
    const counts = hireStatsByListing(listings.flatMap(l => l.hires));
    return json(listings.map(l => ({
      ...l,
      hires: undefined,
      activeHires: l.hires.filter(h => h.status === "active").length,
      ...listingStats(l.id, volumes, counts),
    })));
  });

  // A publisher claims their listing by setting a price and the wallet that
  // should receive rental payments.
  //
  // The payout wallet must be one the caller has signed in with, so a listing
  // can only be claimed by someone holding that key. The write-once rule stays
  // underneath it: once claimed, later calls may only change the price, and
  // only from the same wallet.
  app.patch("/listings/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      developerWallet: z.string().min(32).max(44),
      priceLamports: z.coerce.bigint().min(0n),
    }).parse(req.body);
    const listing = await prisma.agentListing.findUnique({ where: { id } });
    if (!listing) return reply.code(404).send({ error: "listing not found" });
    requireWallet(req, body.developerWallet);
    if (listing.developerWallet && listing.developerWallet !== body.developerWallet) {
      return reply.code(403).send({ error: "this listing is already claimed by another wallet" });
    }
    const updated = await prisma.agentListing.update({ where: { id }, data: body });
    return json(updated);
  });

  app.get("/hires", async (req) => {
    const { wallet } = req.query as { wallet?: string };
    const hires = await prisma.hireAgreement.findMany({
      where: wallet ? { ownerWallet: wallet } : undefined,
      include: { listing: { include: { agentVersion: true } } },
      orderBy: { startsAt: "desc" },
    });
    return json(hires);
  });

  app.post("/hires", async (req, reply) => {
    const body = z.object({
      listingId: z.string().min(1),
      ownerWallet: z.string().min(32).max(44),
      durationHours: z.number().int().min(1).max(24 * 30),
      paymentSignature: z.string().min(1),
    }).parse(req.body);

    const listing = await prisma.agentListing.findUnique({ where: { id: body.listingId } });
    if (!listing) return reply.code(404).send({ error: "listing not found" });
    // Listings are auto-created at price 0 when an agent is published; that
    // means "not offered yet", not "free". The publisher opts in by setting a
    // payout wallet and a price.
    if (!listing.developerWallet || listing.priceLamports <= 0n) {
      return reply.code(400).send({ error: "this listing is not offered for rent — the publisher has not set a price" });
    }

    // One payment funds one hire. The unique index on paymentSignature is the
    // real guard (two racing requests both pass this check); it just lets the
    // common case answer with something clearer than a constraint violation.
    if (await prisma.hireAgreement.findUnique({ where: { paymentSignature: body.paymentSignature } })) {
      return reply.code(409).send({ error: "that payment signature has already been used for a hire" });
    }

    // The listing price is a 24h rate, so a longer hire has to pay for every
    // period it covers — otherwise one day's payment would buy thirty.
    const periods = BigInt(Math.ceil(body.durationHours / 24));
    const required = listing.priceLamports * periods;
    try {
      await verifyPayment(body.paymentSignature, body.ownerWallet, listing.developerWallet, required);
    } catch (err) {
      // A payment that does not check out is the caller's problem, not a
      // server fault — 400 so the UI can show the reason as-is.
      return reply.code(400).send({ error: err instanceof Error ? err.message : String(err) });
    }

    const hire = await prisma.hireAgreement.create({
      data: {
        listingId: listing.id,
        ownerWallet: body.ownerWallet,
        paymentSignature: body.paymentSignature,
        endsAt: new Date(Date.now() + body.durationHours * 3600_000),
      },
    });
    await audit({
      actorType: "owner", actorId: body.ownerWallet, eventType: "listing.hired", subjectType: "hire", subjectId: hire.id,
      chainSignature: body.paymentSignature,
      payload: { listingId: listing.id, agentVersionId: listing.agentVersionId, rateLamportsPer24h: listing.priceLamports.toString(), paidLamports: required.toString(), durationHours: body.durationHours },
    });
    return reply.code(201).send(json(hire));
  });
}
