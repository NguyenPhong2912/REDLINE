import type { FastifyInstance } from "fastify";
import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "../db/client.js";
import { audit } from "../db/audit.js";
import { json } from "./json.js";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

// Immutable agent versions. agent_hash binds model + code + config; a change
// to any of them is a new row, never an update.
export async function agentRoutes(app: FastifyInstance) {
  app.post("/agents", async (req, reply) => {
    const body = z.object({
      name: z.string().min(1).max(80),
      version: z.string().min(1).max(20),
      strategy: z.string().min(1).max(200),
      modelRef: z.string().min(1).max(120),   // e.g. "openai:gpt-5.4-mini" or a weights CID
      codeRef: z.string().min(1).max(120),    // e.g. git commit of the runtime
      config: z.record(z.unknown()).default({}),
    }).parse(req.body);
    const modelHash = sha(body.modelRef);
    const codeHash = sha(body.codeRef);
    const configHash = sha(JSON.stringify(body.config, Object.keys(body.config).sort()));
    const agentHash = sha(`${modelHash}|${codeHash}|${configHash}`);
    const agent = await prisma.agentVersion.upsert({
      where: { agentHash },
      update: {},
      create: { name: body.name, version: body.version, strategy: body.strategy, modelHash, codeHash, configHash, agentHash },
    });
    const listing = await prisma.agentListing.upsert({
      where: { id: `${agent.id}-default` },
      update: {},
      create: { id: `${agent.id}-default`, agentVersionId: agent.id, termsHash: sha("default-terms-v1") },
    });
    await audit({ actorType: "admin", actorId: "registry", eventType: "agent.published", subjectType: "agent", subjectId: agent.id, payload: { agentHash, name: agent.name, version: agent.version, listingId: listing.id } });
    return reply.code(201).send(json({ agent, listing }));
  });

  app.get("/agents", async () => json(await prisma.agentVersion.findMany({ include: { listings: true }, orderBy: { createdAt: "desc" } })));
}
