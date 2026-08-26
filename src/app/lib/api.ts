// Single place the UI talks to the REDLINE backend. Every page reads through
// these helpers so switching hosts (localhost → Railway) is one env change.

export const API_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:8787").replace(/\/$/, "");
// Shared write key (see backend/src/auth.ts for what it does and does not protect).
const API_KEY = import.meta.env.VITE_API_KEY ?? "";

export interface Health { ok: boolean; chain: "mock" | "solana"; programId: string; executor: string; clockSpeed: number }
export interface AgentVersion { id: string; name: string; version: string; strategy: string; agentHash: string }
export interface OnchainGrant { active: boolean; spentUnits: string; transactionCount: number; nextNonce: number; spendCapUnits: string; maxTransactions: number; cooldownSeconds: number; expiresAt: number; allowedMints: string[]; allowedDestinations: string[] }
export interface Grant {
  id: string; grantPda: string; agentId: string; executorPubkey: string; createSignature: string | null;
  spentUnits: string; transactionCount: number; nextNonce: number; revoked: boolean; createdAt: string;
  agentVersion: AgentVersion;
  policyVersion: { policyHash: string; spendCapUnits: string; maxTransactions: number; cooldownSeconds: number; expiresAt: string; allowedMints: string; allowedDests: string };
  owner: { wallet: string };
  onchain?: OnchainGrant | null;
  runs?: { id: string; mode: string; status: string; startedAt: string }[];
}
export interface IntentRow {
  id: string; nonce: number; amountUnits: string; destination: string; reason: string; intentHash: string; createdAt: string;
  decision: null | { allow: boolean; reasonCode: string; stage: string; chainTx: null | { signature: string; result: string; error: string | null; slot: string | null } };
}
export interface AuditRow { id: string; createdAt: string; actorType: string; eventType: string; subjectType: string; subjectId: string; chainSignature: string | null; payload: Record<string, unknown> }
export interface VaultView { owner: string; vaultPda: string; vaultAta: string; mint: string; balanceUnits: string | null; exists: boolean }
export interface FeedEvent { id: string; at: string; eventType: string; actorType: string; payload: Record<string, unknown>; chainSignature?: string | null }

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { ...init, headers: { "Content-Type": "application/json", ...(API_KEY ? { "x-redline-key": API_KEY } : {}), ...(init?.headers ?? {}) } });
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try { const body = await res.json() as { error?: string; details?: unknown }; if (body.error) msg = body.error; } catch { /* keep status text */ }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => req<Health>("/health"),
  agents: () => req<AgentVersion[]>("/agents"),
  publishAgent: (a: { name: string; version: string; strategy: string; modelRef: string; codeRef: string; config?: Record<string, unknown> }) =>
    req<{ agent: AgentVersion }>("/agents", { method: "POST", body: JSON.stringify(a) }),
  grants: () => req<Grant[]>("/grants"),
  grant: (id: string) => req<Grant>(`/grants/${id}`),
  createGrant: (b: {
    ownerWallet: string; vaultPda: string; agentVersionId: string; grantPda: string; createSignature: string; agentId: string;
    policy: { agentName: string; strategy: string; tokens: string[]; spendCapUsdc: number; maxTransactions: number; durationHours: number; cooldownMinutes: number; allowedMints: string[]; allowedDestinations: string[] };
  }) => req<{ grant: Grant; policyHash: string; chain: string }>("/grants", { method: "POST", body: JSON.stringify(b) }),
  revoke: (id: string, signature?: string) => req<{ ok: boolean; signature: string }>(`/grants/${id}/revoke`, { method: "POST", body: JSON.stringify({ signature }) }),
  intents: (grantId: string) => req<IntentRow[]>(`/grants/${grantId}/intents`),
  submitIntent: (b: { grantId: string; mint: string; amountUnits: string; destination: string; reason?: string; submitEvenIfDenied?: boolean }) =>
    req<{ intentId: string; precheck: { reasonCode: string; message: string }; submitted: boolean; signature?: string; onchainSuccess?: boolean; onchainReason?: string }>("/intents", { method: "POST", body: JSON.stringify(b) }),
  startRun: (grantId: string, mode: "scripted" | "llm" = "scripted") => req<{ id: string }>("/runs", { method: "POST", body: JSON.stringify({ grantId, mode }) }),
  stopRun: (runId: string) => req<{ ok: boolean }>(`/runs/${runId}/stop`, { method: "POST" }),
  audit: (grantId?: string) => req<AuditRow[]>(`/audit${grantId ? `?grant=${grantId}` : ""}`),
  vault: (owner: string) => req<VaultView>(`/vaults/${owner}`),
  fundVault: (ownerWallet: string) => req<{ vaultPda: string; vaultAta: string; signature: string; balance: string }>("/devnet/fund", { method: "POST", body: JSON.stringify({ ownerWallet }) }),
};

// Server-sent events. grantId "*" streams every grant.
export function subscribeFeed(grantId: string, onEvent: (e: FeedEvent) => void): () => void {
  const es = new EventSource(`${API_URL}/grants/${encodeURIComponent(grantId)}/feed`);
  const handler = (ev: MessageEvent) => { try { onEvent(JSON.parse(ev.data) as FeedEvent); } catch { /* ignore malformed */ } };
  for (const t of ["grant.created", "grant.revoked", "run.started", "run.ended", "intent.created", "decision.precheck", "tx.confirmed", "tx.rejected", "chain.policy_decision", "chain.grant_revoked", "chain.grant_created", "chain.tx_failed", "agent.published"]) {
    es.addEventListener(t, handler as EventListener);
  }
  return () => es.close();
}

export const fmtUsdc = (units: string | number | bigint, decimals = 6) => (Number(units) / 10 ** decimals).toLocaleString("en-US", { maximumFractionDigits: 2 });
export const short = (s: string, n = 4) => (s.length > n * 2 + 1 ? `${s.slice(0, n)}…${s.slice(-n)}` : s);
