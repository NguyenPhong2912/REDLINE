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

export function explorerAddressUrl(address: string): string {
  return `https://explorer.solana.com/address/${encodeURIComponent(address)}?cluster=${SOLANA_CLUSTER}`;
}

export function explorerTransactionUrl(signature: string): string {
  return `https://explorer.solana.com/tx/${encodeURIComponent(signature)}?cluster=${SOLANA_CLUSTER}`;
}

// Shape check only — base58 (no 0, O, I, l) at the length a 32-byte key
// encodes to. It catches an obviously wrong paste before the wallet is asked
// to sign. It does not prove the address exists, and because valid addresses
// run 32–44 characters it cannot tell a real one from itself minus a couple
// of characters. The wallet and the program are the real check.
export function isAddressLike(value: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}
