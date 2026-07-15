"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useBalance, useWalletConnection } from "@solana/react-hooks";
import {
  ChevronDown,
  CircleAlert,
  ExternalLink,
  LogOut,
  Settings,
  User,
  Wallet,
} from "lucide-react";
import { truncateAddress } from "@/lib/utils";

function formatBalance(lamports: bigint | null) {
  if (lamports === null) return "--";
  return `${(Number(lamports) / 1_000_000_000).toFixed(3)} SOL`;
}

export default function WalletButton() {
  const {
    connect,
    connectors,
    currentConnector,
    disconnect,
    error,
    status,
    wallet,
  } = useWalletConnection();
  const address = wallet?.account.address.toString();
  const { lamports } = useBalance(address);
  const [open, setOpen] = useState(false);
  const [pendingConnector, setPendingConnector] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  async function handleConnect(connectorId: string) {
    setPendingConnector(connectorId);
    try {
      await connect(connectorId, { allowInteractiveFallback: true });
      setOpen(false);
    } finally {
      setPendingConnector(null);
    }
  }

  async function handleDisconnect() {
    await disconnect();
    setOpen(false);
  }

  const connected = status === "connected" && Boolean(address);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={
          connected
            ? "flex h-10 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-text-primary transition-colors hover:border-success/50"
            : "btn-primary flex h-10 items-center gap-2 rounded-lg px-4 text-sm"
        }
        aria-haspopup="menu"
        aria-expanded={open}
        id="connect-wallet-button"
      >
        {connected ? (
          <span className="h-2 w-2 rounded-full bg-success" />
        ) : (
          <Wallet className="h-4 w-4" />
        )}
        <span className="relative z-10 hidden sm:inline">
          {connected ? truncateAddress(address ?? "") : "Connect wallet"}
        </span>
        <ChevronDown className="relative z-10 h-4 w-4" />
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-72 overflow-hidden rounded-lg border border-border bg-surface shadow-2xl shadow-black/40"
          role="menu"
        >
          {connected ? (
            <>
              <div className="border-b border-border p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-success">Connected</span>
                  <span className="rounded bg-success-dim px-2 py-1 text-[10px] font-semibold text-success">
                    DEVNET
                  </span>
                </div>
                <p className="truncate font-mono text-xs text-text-secondary">{address}</p>
                <p className="mt-2 text-lg font-semibold">{formatBalance(lamports)}</p>
                <p className="text-xs text-text-muted">
                  {currentConnector?.name ?? wallet?.connector.name}
                </p>
              </div>
              <div className="p-1.5">
                <Link
                  href="/profile"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
                  role="menuitem"
                >
                  <User className="h-4 w-4" /> Profile
                </Link>
                <Link
                  href="/settings"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
                  role="menuitem"
                >
                  <Settings className="h-4 w-4" /> Settings
                </Link>
                <a
                  href={`https://explorer.solana.com/address/${address}?cluster=devnet`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
                  role="menuitem"
                >
                  <ExternalLink className="h-4 w-4" /> View on Explorer
                </a>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm text-danger transition-colors hover:bg-danger-dim"
                  role="menuitem"
                >
                  <LogOut className="h-4 w-4" /> Disconnect
                </button>
              </div>
            </>
          ) : (
            <div className="p-3">
              <p className="px-2 pb-2 text-xs font-semibold uppercase text-text-muted">
                Available wallets
              </p>
              {connectors.length > 0 ? (
                <div className="space-y-1">
                  {connectors.map((connector) => (
                    <button
                      key={connector.id}
                      type="button"
                      onClick={() => handleConnect(connector.id)}
                      disabled={status === "connecting"}
                      className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left transition-colors hover:bg-surface-hover disabled:cursor-wait disabled:opacity-60"
                      role="menuitem"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-dim font-semibold text-primary-hover">
                        {connector.name.charAt(0)}
                      </span>
                      <span className="flex-1 text-sm font-medium">{connector.name}</span>
                      {pendingConnector === connector.id && (
                        <span className="text-xs text-text-muted">Connecting...</span>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-md border border-border bg-background p-3">
                  <p className="text-sm font-medium">No Solana wallet detected</p>
                  <div className="mt-3 flex gap-2">
                    <a
                      href="https://phantom.com/"
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-primary-hover hover:text-primary"
                    >
                      Phantom
                    </a>
                    <a
                      href="https://solflare.com/"
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-primary-hover hover:text-primary"
                    >
                      Solflare
                    </a>
                  </div>
                </div>
              )}
              {Boolean(error) && (
                <p className="mt-2 flex items-start gap-2 rounded-md bg-danger-dim p-2 text-xs text-danger">
                  <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Wallet connection failed. Please retry.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
