import "./env.js";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { ZodError } from "zod";
import { getChain, initChain } from "./chain/index.js";
import { SolanaChain } from "./chain/solana.js";
import { startIndexer } from "./indexer.js";
import { clockSpeed } from "./clock.js";
import { agentRoutes } from "./routes/agents.js";
import { auditRoutes } from "./routes/audit.js";
import { devnetRoutes } from "./routes/devnet.js";
import { grantRoutes } from "./routes/grants.js";
import { intentRoutes } from "./routes/intents.js";
import { riskRoutes } from "./routes/risk.js";
import { runRoutes } from "./routes/runs.js";

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? "info" } });

const chain = await initChain();
app.log.info({ chain: chain.kind, programId: chain.programId, executor: chain.executorPubkey }, "chain adapter ready");
if (chain instanceof SolanaChain) void startIndexer(chain, msg => app.log.info(msg));

await app.register(cors, { origin: true });

app.setErrorHandler((err, _req, reply) => {
  if (err instanceof ZodError) return reply.code(400).send({ error: "Invalid input", details: err.issues });
  app.log.error(err);
  return reply.code(err.statusCode ?? 500).send({ error: err.message });
});

app.get("/health", async () => {
  const chain = getChain();
  return { ok: true, chain: chain.kind, programId: chain.programId, executor: chain.executorPubkey, clockSpeed };
});

await app.register(agentRoutes);
await app.register(grantRoutes);
await app.register(intentRoutes);
await app.register(runRoutes);
await app.register(auditRoutes);
await app.register(riskRoutes);
await app.register(devnetRoutes);

const port = Number(process.env.PORT ?? 8787);
await app.listen({ port, host: "0.0.0.0" });
