import { useMemo, useState } from "react";
import { address } from "@solana/kit";
import {
  useConnect,
  useConnectedWallet,
  useDisconnect,
  useWallets,
  useWalletStatus,
} from "@solana/kit-plugin-wallet/react";
import { useClient, useRequest } from "@solana/react";
import { ChevronDown, LoaderCircle, PlugZap, Wallet } from "lucide-react";
import type { AppClient } from "../solana/client";

const ACCENT = "#00ffc4";

function WalletBalance({ owner }: { owner: string }) {
  const client = useClient<AppClient>();
  const source = useMemo(() => client.rpc.getBalance(address(owner)), [client, owner]);
  const { data, status } = useRequest(source);
  const sol = data ? Number(data.value) / 1_000_000_000 : null;

  return (
    <span className="hidden xl:inline text-[10px]" style={{ color: "#64748b" }}>
      {status === "fetching" ? "syncing…" : sol === null ? "balance unavailable" : `${sol.toFixed(3)} SOL`}
    </span>
  );
}

export function SolanaWalletControl() {
  const client = useClient<AppClient>();
  const wallets = useWallets(client);
  const status = useWalletStatus(client);
  const connected = useConnectedWallet(client);
  const connect = useConnect(client);
  const disconnect = useDisconnect(client);
  const [open, setOpen] = useState(false);

  if (connected) {
    const owner = String(connected.account.address);
    const short = `${owner.slice(0, 4)}…${owner.slice(-4)}`;
    return (
      <div className="relative flex items-center gap-2">
        <WalletBalance owner={owner} />
        <button
          type="button"
          onClick={() => disconnect.dispatch()}
          className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all"
          style={{ background: `${ACCENT}0e`, border: `1px solid ${ACCENT}35`, color: ACCENT }}
          title="Disconnect Solana wallet"
        >
          <Wallet size={13} />
          <span>{short}</span>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: ACCENT, boxShadow: `0 0 8px ${ACCENT}` }} />
        </button>
      </div>
    );
  }

  const pending = status === "pending" || status === "connecting" || connect.isRunning;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        disabled={pending}
        className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-60"
        style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8" }}
      >
        {pending ? <LoaderCircle size={13} className="animate-spin" /> : <PlugZap size={13} />}
        <span>{pending ? "Connecting" : "Connect Solana"}</span>
        <ChevronDown size={11} />
      </button>

      {open && !pending && (
        <div
          className="absolute right-0 top-[calc(100%+8px)] w-64 rounded-xl p-2 z-50 shadow-2xl"
          style={{ background: "#09100f", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          <div className="px-2 py-1.5 text-[10px] uppercase tracking-[0.14em]" style={{ color: "#64748b" }}>
            Solana Wallet Standard · Devnet
          </div>
          {wallets.length === 0 ? (
            <div className="px-2 py-3 text-xs" style={{ color: "#94a3b8" }}>
              No compatible wallet detected. Install Phantom, Solflare, or another Wallet Standard wallet.
            </div>
          ) : (
            wallets.map(wallet => (
              <button
                type="button"
                key={wallet.name}
                onClick={() => {
                  connect.dispatch(wallet);
                  setOpen(false);
                }}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs transition-colors hover:bg-white/[0.05]"
                style={{ color: "#e2e8f0" }}
              >
                <span>{wallet.name}</span>
                <span style={{ color: ACCENT }}>Connect</span>
              </button>
            ))
          )}
          {Boolean(connect.error) && (
            <div className="px-2 py-2 text-[10px]" role="alert" style={{ color: "#f87171" }}>
              Wallet connection was rejected or unavailable.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
