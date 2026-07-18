"use client";

import type {
  ClientLogger,
  ClusterMoniker,
  SolanaClientConfig,
} from "@solana/client";
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

const solanaLogger: ClientLogger = ({ data, level, message }) => {
  if (message === "wallet connection failed") {
    console.warn(`[react-core] ${message}`, data ?? {});
    return;
  }

  if (level === "error") {
    console.error(`[react-core] ${message}`, data ?? {});
  } else if (level === "warn") {
    console.warn(`[react-core] ${message}`, data ?? {});
  } else if (level === "info") {
    console.info(`[react-core] ${message}`, data ?? {});
  } else {
    console.debug(`[react-core] ${message}`, data ?? {});
  }
};

const solanaConfig: SolanaClientConfig = {
  cluster,
  logger: solanaLogger,
  rpc,
  websocket,
};

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SolanaProvider
      config={solanaConfig}
      query={{ resetOnClusterChange: true }}
      walletPersistence={{
        autoConnect: false,
        storageKey: "agentx.wallet.v2",
      }}
    >
      {children}
    </SolanaProvider>
  );
}
