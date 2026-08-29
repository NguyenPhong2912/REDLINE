import { useMemo, useState } from "react";
import { address } from "@solana/kit";
import {
  useConnect,
  useConnectedWallet,
  useDisconnect,
  useSignMessage,
  useWallets,
  useWalletStatus,
} from "@solana/kit-plugin-wallet/react";
import { useClient, useRequest } from "@solana/react";
import { ChevronDown, KeyRound, LoaderCircle, PlugZap, Wallet } from "lucide-react";
import type { AppClient } from "../solana/client";
import { loadSession } from "../lib/api";
import { sessionFor, signIn, signOut } from "../lib/signin";
import { color } from "../theme";

const ACCENT = color.primary;

function WalletBalance({ owner }: { owner: string }) {
  const client = useClient<AppClient>();
  const source = useMemo(() => client.rpc.getBalance(address(owner)), [client, owner]);
  const { data, status } = useRequest(source);
  const sol = data ? Number(data.value) / 1_000_000_000 : null;

  return (
    <span className="hidden xl:inline text-[10px]" style={{ color: color.textMuted }}>
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
  const signMessage = useSignMessage(client);
  const [open, setOpen] = useState(false);
  // Mirrors the stored session so the button re-renders when it changes;
  // localStorage on its own does not notify React.
  const [sessionWallet, setSessionWallet] = useState<string | null>(() => loadSession()?.wallet ?? null);
  const [signingIn, setSigningIn] = useState(false);
  const [signinError, setSigninError] = useState("");

  if (connected) {
    const owner = String(connected.account.address);
    const short = `${owner.slice(0, 4)}…${owner.slice(-4)}`;
    const signedIn = !!sessionFor(owner) && sessionWallet === owner;
    return (
      <div className="relative flex items-center gap-2">
        <WalletBalance owner={owner} />
        {!signedIn && (
          <button
            type="button"
            onClick={async () => {
              setSigninError("");
              setSigningIn(true);
              try {
                const s = await signIn(m => signMessage.dispatchAsync(m), owner);
                setSessionWallet(s.wallet);
              } catch (e) {
                setSigninError(e instanceof Error ? e.message : "Sign-in was rejected.");
              } finally {
                setSigningIn(false);
              }
            }}
            disabled={signingIn}
            className="hidden sm:flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-[11px] font-semibold transition-all disabled:opacity-60"
            style={{ background: "#38bdf80e", border: "1px solid #38bdf835", color: color.info }}
            title="Prove you hold this wallet. Signs a message only — no transfer, no funds moved."
          >
            {signingIn ? <LoaderCircle size={12} className="animate-spin" /> : <KeyRound size={12} />}
            {signingIn ? "Check your wallet…" : "Sign in"}
          </button>
        )}
        {signinError && <span role="alert" className="hidden lg:inline text-[10px]" style={{ color: color.danger }}>{signinError}</span>}
        <button
          type="button"
          onClick={() => { signOut(); setSessionWallet(null); disconnect.dispatch(); }}
          className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all"
          style={{ background: `${ACCENT}0e`, border: `1px solid ${ACCENT}35`, color: ACCENT }}
          title={signedIn ? "Signed in. Click to disconnect and end the session." : "Disconnect Solana wallet"}
        >
          <Wallet size={13} />
          <span>{short}</span>
          {signedIn && <KeyRound size={11} style={{ color: color.info }} />}
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: ACCENT }} />
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
        style={{ background: color.surfaceSubtle, border: `1px solid ${color.border}`, color: color.textSecondary }}
      >
        {pending ? <LoaderCircle size={13} className="animate-spin" /> : <PlugZap size={13} />}
        <span>{pending ? "Connecting" : "Connect Solana"}</span>
        <ChevronDown size={11} />
      </button>

      {open && !pending && (
        <div
          className="absolute right-0 top-[calc(100%+8px)] w-64 rounded-xl p-2 z-50 shadow-2xl"
          style={{ background: color.surface, border: `1px solid ${color.border}` }}
        >
          <div className="px-2 py-1.5 text-[10px] uppercase tracking-[0.14em]" style={{ color: color.textMuted }}>
            Solana Wallet Standard · Devnet
          </div>
          {wallets.length === 0 ? (
            <div className="px-2 py-3 text-xs" style={{ color: color.textSecondary }}>
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
                style={{ color: color.text }}
              >
                <span>{wallet.name}</span>
                <span style={{ color: ACCENT }}>Connect</span>
              </button>
            ))
          )}
          {Boolean(connect.error) && (
            <div className="px-2 py-2 text-[10px]" role="alert" style={{ color: color.danger }}>
              Wallet connection was rejected or unavailable.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
