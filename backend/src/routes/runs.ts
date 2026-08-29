import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db/client.js";
import { activeRunIds, startRun, stopRun } from "../runtime/runner.js";
import { requireGrantOwner } from "../auth.js";
import { json } from "./json.js";

export async function runRoutes(app: FastifyInstance) {
  app.post("/runs", async (req, reply) => {
    const body = z.object({ grantId: z.string().min(1), mode: z.enum(["scripted", "llm"]).default("scripted"), tickMs: z.number().int().min(250).max(600_000).optional() }).parse(req.body);
    // Starting a run makes the executor spend from this grant's vault.
    await requireGrantOwner(req, body.grantId);
    const run = await startRun(body.grantId, body.mode, body.tickMs);
    return reply.code(201).send(json(run));
  });

  app.post("/runs/:id/stop", async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!stopRun(id)) return reply.code(404).send({ error: "run is not active" });
    return { ok: true };
  });

  app.get("/runs", async () => {
    const runs = await prisma.agentRun.findMany({ orderBy: { startedAt: "desc" }, take: 50 });
    return json({ active: activeRunIds(), runs });
  });
}
