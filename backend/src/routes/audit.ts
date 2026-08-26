import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client.js";
import { feed } from "../feed.js";
import { json } from "./json.js";

export async function auditRoutes(app: FastifyInstance) {
  // Everything that happened for a grant, oldest first, with explorer-ready
  // signatures. This is the page a treasury operator pays for.
  app.get("/audit", async (req) => {
    const { grant, limit } = req.query as { grant?: string; limit?: string };
    const take = Math.min(Number(limit ?? 200), 1000);
    const where = grant
      ? { OR: [{ subjectType: "grant", subjectId: grant }, { payload: { contains: `"grantId":"${grant}"` } }] }
      : {};
    const rows = await prisma.auditEvent.findMany({ where, orderBy: { createdAt: "asc" }, take });
    return json(rows.map(r => ({ ...r, payload: JSON.parse(r.payload) })));
  });

  // Server-sent events. `grant=*` streams every grant.
  app.get("/grants/:id/feed", async (req, reply) => {
    const { id } = req.params as { id: string };
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });
    reply.raw.write(`event: hello\ndata: ${JSON.stringify({ grantId: id })}\n\n`);
    const unsubscribe = feed.subscribe(id, e => {
      reply.raw.write(`event: ${e.eventType}\ndata: ${JSON.stringify(e, (_k, v) => (typeof v === "bigint" ? v.toString() : v))}\n\n`);
    });
    const ping = setInterval(() => reply.raw.write(": ping\n\n"), 15_000);
    req.raw.on("close", () => { clearInterval(ping); unsubscribe(); });
    await new Promise(() => {}); // keep the handler open until the client leaves
  });
}
