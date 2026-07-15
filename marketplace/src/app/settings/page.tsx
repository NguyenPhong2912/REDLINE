"use client";

import { useEffect, useState } from "react";
import { useWalletConnection } from "@solana/react-hooks";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Bot,
  Check,
  CircleAlert,
  ExternalLink,
  LogOut,
  Settings as SettingsIcon,
  User,
  Wallet,
} from "lucide-react";
import WalletButton from "@/components/wallet/WalletButton";
import { truncateAddress } from "@/lib/utils";
import { useStore } from "@/store/useStore";

type HealthStatus = {
  status: string;
  ai: { mode: "live" | "demo"; model: string | null };
  solana: { cluster: string; customRpc: boolean };
};

type TabId = "profile" | "notifications" | "wallet" | "runtime";

const tabs: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "wallet", label: "Wallet", icon: Wallet },
  { id: "runtime", label: "Runtime", icon: Bot },
];

export default function SettingsPage() {
  const { currentConnector, disconnect, status, wallet } = useWalletConnection();
  const profile = useStore((state) => state.profile);
  const updateProfile = useStore((state) => state.updateProfile);
  const preferences = useStore((state) => state.preferences);
  const updatePreference = useStore((state) => state.updatePreference);
  const addNotification = useStore((state) => state.addNotification);
  const [activeTab, setActiveTab] = useState<TabId>("profile");
  const [draft, setDraft] = useState(profile);
  const [saved, setSaved] = useState(false);
  const [health, setHealth] = useState<HealthStatus>();
  const [healthError, setHealthError] = useState(false);
  const walletAddress = wallet?.account.address.toString();

  useEffect(() => {
    let active = true;
    fetch("/api/health")
      .then((response) => {
        if (!response.ok) throw new Error("Health request failed");
        return response.json() as Promise<HealthStatus>;
      })
      .then((data) => active && setHealth(data))
      .catch(() => active && setHealthError(true));
    return () => {
      active = false;
    };
  }, []);

  function saveProfile() {
    updateProfile({
      displayName: draft.displayName.trim() || "Anonymous creator",
      bio: draft.bio.trim(),
      location: draft.location.trim(),
      website: draft.website.trim(),
      socialHandle: draft.socialHandle.trim(),
    });
    addNotification({
      id: crypto.randomUUID(),
      type: "success",
      title: "Profile updated",
      message: "Your creator profile settings were saved.",
      read: false,
      createdAt: new Date().toISOString(),
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1_500);
  }

  return (
    <div className="min-h-screen py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-7"
        >
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-accent">
            <SettingsIcon className="h-3.5 w-3.5" /> Workspace
          </div>
          <h1 className="text-3xl font-bold">Settings</h1>
        </motion.header>

        <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <nav className="flex gap-1 overflow-x-auto lg:flex-col" aria-label="Settings sections">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex min-w-fit items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors lg:w-full ${
                    activeTab === tab.id
                      ? "bg-primary-dim text-primary-hover"
                      : "text-text-muted hover:bg-surface hover:text-text-primary"
                  }`}
                >
                  <Icon className="h-4 w-4" /> {tab.label}
                </button>
              );
            })}
          </nav>

          <motion.section
            key={activeTab}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            className="rounded-lg border border-border bg-surface"
          >
            {activeTab === "profile" && (
              <div>
                <div className="border-b border-border px-5 py-4 sm:px-7">
                  <h2 className="font-semibold">Creator profile</h2>
                  <p className="mt-1 text-xs text-text-muted">Public identity shown beside your agents.</p>
                </div>
                <div className="space-y-5 p-5 sm:p-7">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field
                      label="Display name"
                      value={draft.displayName}
                      onChange={(value) => setDraft((current) => ({ ...current, displayName: value }))}
                    />
                    <Field
                      label="Location"
                      value={draft.location}
                      onChange={(value) => setDraft((current) => ({ ...current, location: value }))}
                    />
                    <Field
                      label="Website"
                      value={draft.website}
                      onChange={(value) => setDraft((current) => ({ ...current, website: value }))}
                      type="url"
                    />
                    <Field
                      label="Social handle"
                      value={draft.socialHandle}
                      onChange={(value) => setDraft((current) => ({ ...current, socialHandle: value }))}
                    />
                  </div>
                  <div>
                    <label htmlFor="profile-bio" className="mb-2 block text-sm font-medium">Bio</label>
                    <textarea
                      id="profile-bio"
                      rows={4}
                      maxLength={280}
                      value={draft.bio}
                      onChange={(event) => setDraft((current) => ({ ...current, bio: event.target.value }))}
                      className="w-full resize-none rounded-lg border border-border bg-background px-4 py-3 text-sm leading-6 outline-none transition-colors focus:border-primary/50"
                    />
                    <p className="mt-1 text-right text-xs text-text-muted">{draft.bio.length}/280</p>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={saveProfile}
                      className="btn-primary flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm"
                    >
                      {saved ? <Check className="relative z-10 h-4 w-4" /> : null}
                      <span>{saved ? "Saved" : "Save profile"}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "notifications" && (
              <div>
                <div className="border-b border-border px-5 py-4 sm:px-7">
                  <h2 className="font-semibold">Notification preferences</h2>
                  <p className="mt-1 text-xs text-text-muted">Choose which events appear in your activity feed.</p>
                </div>
                <div className="divide-y divide-border px-5 sm:px-7">
                  {[
                    ["agentUpdates", "Agent updates", "Status changes for agents you own or use."],
                    ["transactions", "Transactions", "Purchase, payout, and registration confirmations."],
                    ["governance", "Governance", "Voting windows and proposal outcomes."],
                    ["productNews", "Product news", "Occasional marketplace release notes."],
                  ].map(([key, title, description]) => (
                    <label key={key} className="flex cursor-pointer items-center gap-4 py-5">
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{title}</span>
                        <span className="mt-1 block text-xs leading-5 text-text-muted">{description}</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={preferences[key as keyof typeof preferences]}
                        onChange={(event) =>
                          updatePreference(
                            key as keyof typeof preferences,
                            event.target.checked,
                          )
                        }
                        className="h-4 w-4 accent-primary"
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "wallet" && (
              <div>
                <div className="border-b border-border px-5 py-4 sm:px-7">
                  <h2 className="font-semibold">Solana wallet</h2>
                  <p className="mt-1 text-xs text-text-muted">Wallet Standard connection for Devnet transactions.</p>
                </div>
                <div className="p-5 sm:p-7">
                  {walletAddress ? (
                    <div className="rounded-lg border border-border bg-background p-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-success-dim text-success">
                            <Wallet className="h-5 w-5" />
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold">{currentConnector?.name ?? wallet?.connector.name ?? "Solana wallet"}</p>
                              <span className="h-2 w-2 rounded-full bg-success" />
                            </div>
                            <p className="mt-1 font-mono text-xs text-text-muted">{truncateAddress(walletAddress)}</p>
                          </div>
                        </div>
                        <span className="badge badge-success">Devnet</span>
                      </div>
                      <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
                        <a
                          href={`https://explorer.solana.com/address/${walletAddress}?cluster=devnet`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-secondary flex items-center gap-2 rounded-lg px-4 py-2 text-xs"
                        >
                          Explorer <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                        <button
                          type="button"
                          onClick={() => void disconnect()}
                          className="flex items-center gap-2 rounded-lg border border-danger/30 px-4 py-2 text-xs font-medium text-danger transition-colors hover:bg-danger-dim"
                        >
                          <LogOut className="h-3.5 w-3.5" /> Disconnect
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-background p-5">
                      <div>
                        <p className="text-sm font-medium">No wallet connected</p>
                        <p className="mt-1 text-xs text-text-muted">Status: {status}</p>
                      </div>
                      <WalletButton />
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "runtime" && (
              <div>
                <div className="border-b border-border px-5 py-4 sm:px-7">
                  <h2 className="font-semibold">Runtime status</h2>
                  <p className="mt-1 text-xs text-text-muted">Server and network configuration visible to this app.</p>
                </div>
                <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-7">
                  {healthError ? (
                    <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-dim p-4 text-sm text-danger sm:col-span-2">
                      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /> Runtime health could not be loaded.
                    </div>
                  ) : (
                    <>
                      <StatusPanel
                        label="Application API"
                        value={health ? "Operational" : "Checking..."}
                        healthy={Boolean(health)}
                      />
                      <StatusPanel
                        label="AI execution"
                        value={health ? (health.ai.mode === "live" ? health.ai.model ?? "Live" : "Demo fallback") : "Checking..."}
                        healthy={health?.ai.mode === "live"}
                      />
                      <StatusPanel
                        label="Solana cluster"
                        value={health?.solana.cluster ?? "Checking..."}
                        healthy={health?.solana.cluster === "devnet"}
                      />
                      <StatusPanel
                        label="RPC endpoint"
                        value={health ? (health.solana.customRpc ? "Custom endpoint" : "Public Devnet") : "Checking..."}
                        healthy={Boolean(health)}
                      />
                    </>
                  )}
                </div>
              </div>
            )}
          </motion.section>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "url";
}) {
  const id = `profile-${label.toLowerCase().replaceAll(" ", "-")}`;
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium">{label}</label>
      <input
        id={id}
        type={type}
        maxLength={120}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-primary/50"
      />
    </div>
  );
}

function StatusPanel({ label, value, healthy }: { label: string; value: string; healthy: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs uppercase text-text-muted">{label}</p>
        <span className={`h-2 w-2 rounded-full ${healthy ? "bg-success" : "bg-warning"}`} />
      </div>
      <p className="text-sm font-semibold capitalize">{value}</p>
    </div>
  );
}
