import { createClient } from "@solana/kit";
import { solanaRpc } from "@solana/kit-plugin-rpc";
import { walletSigner } from "@solana/kit-plugin-wallet";

export const SOLANA_CLUSTER = "devnet" as const;
export const SOLANA_CHAIN = "solana:devnet" as const;
export const SOLANA_RPC_URL =
  import.meta.env.VITE_SOLANA_RPC_URL?.trim() || "https://api.devnet.solana.com";

export const solanaClient = createClient()
  .use(walletSigner({ chain: SOLANA_CHAIN }))
  .use(solanaRpc({ rpcUrl: SOLANA_RPC_URL }));

export type AppClient = Awaited<typeof solanaClient>;

export function explorerTransactionUrl(signature: string): string {
  return `https://explorer.solana.com/tx/${encodeURIComponent(signature)}?cluster=${SOLANA_CLUSTER}`;
}
