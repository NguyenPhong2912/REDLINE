import type { FastifyInstance } from "fastify";

// Write-route guard. When REDLINE_API_KEY is set, every mutating request must
// carry it in `x-redline-key`. Reads stay public (the dashboard is a viewer).
//
// Honest scope: a key shipped to a public frontend is visible to anyone who
// opens devtools, so this stops drive-by abuse of /runs and /devnet/fund, not
// a determined attacker. Owner actions (create_grant, revoke, withdraw) are
// already authorised by the wallet signature the program verifies; the next
// step for production is sign-in-with-Solana sessions instead of a shared key.

const PUBLIC_WRITES = new Set(["/risk-assess"]);

export function registerAuth(app: FastifyInstance) {
  const key = process.env.REDLINE_API_KEY;
  if (!key) {
    app.log.warn("REDLINE_API_KEY not set — write routes are open (fine for local/mock, not for a public deployment)");
    return;
  }
  app.addHook("onRequest", async (req, reply) => {
    if (req.method === "GET" || req.method === "OPTIONS" || req.method === "HEAD") return;
    const path = req.url.split("?")[0];
    if (PUBLIC_WRITES.has(path)) return;
    const provided = req.headers["x-redline-key"];
    if (provided !== key) return reply.code(401).send({ error: "Missing or invalid x-redline-key" });
  });
}
