import "./env.js";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { ZodError } from "zod";
import { getChain, initChain } from "./chain/index.js";
import { SolanaChain } from "./chain/solana.js";
import { startIndexer } from "./indexer.js";
import { clockSpeed } from "./clock.js";
import { agentRoutes } from "./routes/agents.js";
import { registerAuth } from "./auth.js";
import { prisma } from "./db/client.js";
import { auditRoutes } from "./routes/audit.js";
import { vaultRoutes } from "./routes/vaults.js";
import { devnetRoutes } from "./routes/devnet.js";
import { grantRoutes } from "./routes/grants.js";
import { intentRoutes } from "./routes/intents.js";
import { riskRoutes } from "./routes/risk.js";
import { runRoutes } from "./routes/runs.js";

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? "info",
    // never echo secrets or wallet keys into logs
    redact: ["req.headers.authorization", "req.headers['x-redline-key']"],
  },
});

const chain = await initChain();
app.log.info({ chain: chain.kind, programId: chain.programId, executor: chain.executorPubkey }, "chain adapter ready");
if (chain instanceof SolanaChain) void startIndexer(chain, msg => app.log.info(msg));

await app.register(cors, { origin: true });
// Per-IP ceiling; SSE (/feed) is exempt because one connection is long-lived.
await app.register(rateLimit, { max: Number(process.env.RATE_LIMIT_PER_MINUTE ?? 120), timeWindow: "1 minute", allowList: (req) => req.url.endsWith("/feed") });
registerAuth(app);

// Sweep intents that never reached a decision (crashed mid-request).
{
  const cutoff = new Date(Date.now() - 10 * 60 * 1000);
  const { count } = await prisma.transactionIntent.deleteMany({ where: { decision: null, createdAt: { lt: cutoff } } });
  if (count) app.log.info({ count }, "swept intents without a decision");
}

// Solana errors carry BigInts in `context`; logging the raw object makes pino
// throw and the client would see "Do not know how to serialize a BigInt"
// instead of the real failure. Log and return a safe projection.
const safe = (v: unknown) => { try { return JSON.parse(JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x))); } catch { return String(v); } };
app.setErrorHandler((err, _req, reply) => {
  if (err instanceof ZodError) return reply.code(400).send({ error: "Invalid input", details: err.issues });
  const context = safe((err as { context?: unknown }).context ?? null);
  app.log.error({ err: { message: err.message, stack: err.stack, context } }, "request failed");
  return reply.code(err.statusCode ?? 500).send({ error: err.message, context });
});

app.get("/health", async () => {
  const chain = getChain();
  return { ok: true, chain: chain.kind, programId: chain.programId, executor: chain.executorPubkey, clockSpeed, version: (process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.GIT_SHA ?? "local").slice(0, 7) };
});

await app.register(agentRoutes);
await app.register(grantRoutes);
await app.register(intentRoutes);
await app.register(runRoutes);
await app.register(auditRoutes);
await app.register(riskRoutes);
await app.register(devnetRoutes);
await app.register(vaultRoutes);

const port = Number(process.env.PORT ?? 8787);
await app.listen({ port, host: "0.0.0.0" });
