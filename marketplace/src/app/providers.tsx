"use client";

import type { ClusterMoniker, SolanaClientConfig } from "@solana/client";
import { SolanaProvider } from "@solana/react-hooks";

const supportedClusters: ClusterMoniker[] = [
  "mainnet",
  "mainnet-beta",
  "testnet",
  "devnet",
  "localnet",
  "localhost",
];
const configuredCluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER;
const cluster: ClusterMoniker = supportedClusters.includes(
  configuredCluster as ClusterMoniker,
)
  ? (configuredCluster as ClusterMoniker)
  : "devnet";
const rpc =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const websocket =
  process.env.NEXT_PUBLIC_SOLANA_WS_URL ?? "wss://api.devnet.solana.com";

const solanaConfig: SolanaClientConfig = {
  cluster,
  rpc,
  websocket,
};

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SolanaProvider
      config={solanaConfig}
      query={{ resetOnClusterChange: true }}
      walletPersistence={{ autoConnect: true }}
    >
      {children}
    </SolanaProvider>
  );
}
