import type { FastifyInstance } from "fastify";
import { getChain } from "../chain/index.js";
import { SolanaChain } from "../chain/solana.js";
import { findVaultPda } from "../chain/anchor.js";

// Vault view for the Treasury page: PDA, demo-USDC ATA and live balance.
// Withdraw is not here on purpose — it is owner-signed in the browser.
export async function vaultRoutes(app: FastifyInstance) {
  app.get("/vaults/:owner", async (req, reply) => {
    const { owner } = req.params as { owner: string };
    const chain = getChain();
    if (!(chain instanceof SolanaChain)) return reply.code(400).send({ error: "vault view needs CHAIN=solana" });
    const mint = process.env.DEMO_USDC_MINT;
    if (!mint) return reply.code(500).send({ error: "DEMO_USDC_MINT not configured" });
    const { address: vaultPda } = await findVaultPda(chain.programId, owner);
    const view = await chain.vaultView(vaultPda, mint);
    return { owner, vaultPda, mint, ...view };
  });
}
